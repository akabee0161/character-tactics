import { AI_BEHAVIORS } from './ai';
import { pickCloseTarget } from './autoclose';
import { bondSupporters } from './bonds';
import { effectiveInterval, hasThreatWithinMelee, nearestWithin } from './combat';
import { MIN_SEPARATION, RANGE_EPS } from './constants';
import { accumulate } from './counters';
import { applyDamage } from './damage';
import {
  computeFlowField, distance, flowDirection, hasLineOfSight, isWalkableAt, resolveMoveDest,
} from './field';
import { dropUnitField, fieldToStatic, fieldToUnit } from './fields';
import { awardXpForEvents } from './growth';
import { updateObjectives } from './objectives';
import { spawnProjectile, updateProjectiles } from './projectiles';
import { separatedStep } from './separation';
import { useSkill } from './skills';
import { dueSpawns } from './spawns';
import { makeEnemyUnit } from './state';
import type { BattleState, FlowField, HitSource, Unit, Vec2 } from './types';

export function playerUnits(state: BattleState): Unit[] {
  return state.units.filter((u) => u.side === 'player' && !u.retired);
}

export function hostilesOf(state: BattleState, self: Unit): Unit[] {
  // hp <= 0 は resolveRemoval がまだ retired にしていない、同じ tick で倒れた直後の状態。
  // これを含めると、死んだ直後の敵がまだ近接脅威や AI の標的として扱われてしまう
  return state.units.filter((u) => u.side !== self.side && !u.retired && u.hp > 0);
}

export function unitByUid(state: BattleState, uid: string): Unit | undefined {
  return state.units.find((u) => u.uid === uid);
}

export type SimCommand =
  | { type: 'move'; uid: string; dest: Vec2 }
  | { type: 'skill'; uid: string; dest?: Vec2 };

function updateAi(state: BattleState): void {
  for (const u of state.units) {
    if (u.retired || u.controller !== 'ai' || u.ai === null) continue;
    const behavior = AI_BEHAVIORS[u.ai.def.kind];
    if (!behavior) continue;
    const decision = behavior({ self: u, hostiles: hostilesOf(state, u), grid: state.grid });
    // chase へ入った瞬間だけ時刻を打つ。追い続けているあいだ更新すると印が消えない
    if (decision.mode === 'chase') {
      if (u.ai.mode !== 'chase') u.ai.spottedAt = state.time;
    } else {
      u.ai.spottedAt = null;
    }
    u.ai.mode = decision.mode;
    u.ai.targetUid = decision.targetUid;
    u.goalPos = decision.goal;
  }
}

/** 時間湧き。湧いた敵は aggressive 固定でプレイヤーを追う */
function runSpawns(state: BattleState): void {
  for (const due of dueSpawns(state.stage.spawners, state.spawnCounts, state.time)) {
    state.spawnCounts[due.index] = (state.spawnCounts[due.index] ?? 0) + 1;
    const unit = makeEnemyUnit(
      state.reg, `e${state.nextEnemyUid++}`, due.spawner.defId, due.spawner.pos,
      { kind: 'aggressive' },
    );
    state.units.push(unit);
    state.events.push({
      type: 'enemySpawned', uid: unit.uid, defId: unit.defId, pos: { ...unit.pos },
    });
  }
}

export function step(state: BattleState, commands: SimCommand[], dt: number): void {
  state.events = [];
  if (state.phase !== 'battle') return;

  state.time += dt;
  runSpawns(state);

  const movedThisTick = applyCommands(state, commands);
  updateAi(state);
  updateEngagements(state, movedThisTick);
  updateAutoClose(state);
  moveUnits(state, dt);
  // 発射で追加された飛翔体は次の tick まで進めない。同じ tick で着弾させると、
  // 至近距離で撃ったときに飛翔体が1フレームも描画されないままダメージが入る
  updateProjectiles(state, dt);
  resolveAttacks(state, dt);
  resolveRemoval(state);
  awardXpForEvents(state);
  updateObjectives(state);
  accumulate(state.counters, state.events);
}

function applyCommands(state: BattleState, commands: SimCommand[]): Set<string> {
  const movedThisTick = new Set<string>();
  for (const cmd of commands) {
    const u = unitByUid(state, cmd.uid);
    if (!u || u.retired || u.side !== 'player') continue;

    if (cmd.type === 'move') {
      // 歩けない場所（マップの外を含む）は、たどり着けるうちで最も近いマスへ置き換える
      const dest = resolveMoveDest(state.grid, u.pos, cmd.dest);
      if (dest === null) continue;
      u.goalField = computeFlowField(state.grid, dest);
      u.goalPos = dest;
      u.engagedWith = null;
      movedThisTick.add(u.uid);
    } else {
      useSkill(state, cmd.uid, cmd.dest);
    }
  }
  return movedThisTick;
}

function updateEngagements(state: BattleState, movedThisTick: Set<string>): void {
  const byUid = new Map(state.units.map((u) => [u.uid, u]));

  // 解除
  for (const u of state.units) {
    if (u.retired) { u.engagedWith = null; continue; }
    if (u.engagedWith === null) continue;
    const target = byUid.get(u.engagedWith);
    if (!target || target.retired || distance(u.pos, target.pos) > u.range + RANGE_EPS) u.engagedWith = null;
  }

  // 1ユニットにつき交戦相手は1体。すでに誰かの相手になっている相手は選ばれない
  const claimed = new Set(
    state.units.filter((u) => u.engagedWith !== null).map((u) => u.engagedWith as string),
  );

  // 成立。直前の move コマンドで交戦を解いたユニットは、その tick では再成立させない
  // （まだ位置が動く前なので、そのままだと即座に再交戦してしまう）
  for (const u of state.units) {
    if (u.retired || !u.combat || u.engagedWith !== null || movedThisTick.has(u.uid)) continue;
    const available = hostilesOf(state, u).filter((h) => !claimed.has(h.uid));
    const target = nearestWithin(u.pos, available, u.range + RANGE_EPS);
    if (!target) continue;

    u.engagedWith = target.uid;
    // 交戦成立の直後は攻撃していないので、1 攻撃間隔ぶんのクールダウンを与える
    u.attackCooldown = effectiveInterval(
      u.attackInterval, u.attack, hasThreatWithinMelee(u.pos, hostilesOf(state, u)),
    );
    claimed.add(target.uid);
    const firstMeeting = !u.seenDefIds.includes(target.defId);
    if (firstMeeting) u.seenDefIds.push(target.defId);
    state.events.push({
      type: 'engage', uid: u.uid, defId: u.defId, targetUid: target.uid, targetDefId: target.defId, firstMeeting,
    });
  }
}

/** 近接の味方が詰め寄る相手を、毎 tick 選び直す。条件から外れたら（指示・交戦・相手が遠い）null になる */
function updateAutoClose(state: BattleState): void {
  const claimed = new Set(
    state.units.filter((u) => u.engagedWith !== null).map((u) => u.engagedWith as string),
  );
  for (const u of state.units) {
    u.closingOn = pickCloseTarget(u, hostilesOf(state, u), claimed, state.grid)?.uid ?? null;
  }
}

/**
 * そのユニットが今つかうフローフィールド。
 * 追跡中は相手の位置（相手がセルを移ったときだけ再計算）、それ以外は動かないゴール。
 */
function fieldFor(state: BattleState, u: Unit): FlowField | null {
  if (u.controller === 'player') return u.goalField;
  if (u.ai === null) return null;
  if (u.ai.targetUid !== null) {
    const target = unitByUid(state, u.ai.targetUid);
    if (target && !target.retired) return fieldToUnit(state.fields, state.grid, target);
  }
  return u.goalPos ? fieldToStatic(state.fields, state.grid, u.goalPos) : null;
}

/** 動いた量がこれ未満なら、ふさがれて動けなかったとみなす */
const BLOCKED_EPS = 1e-3;

type StepResult = 'moved' | 'adjusted' | 'blocked';

/**
 * next へ動く。敵対ユニットに MIN_SEPARATION より近づくぶんは separatedStep で補正する。
 * moved: next にそのまま着いた / adjusted: 補正して動いた / blocked: 動けなかった
 */
function stepTo(state: BattleState, u: Unit, next: Vec2): StepResult {
  const p = separatedStep(u.pos, next, hostilesOf(state, u).map((h) => h.pos), MIN_SEPARATION);
  if (p.x === next.x && p.y === next.y) {
    u.pos = p;
    return 'moved';
  }
  // 押し戻した先は、見通しやフローフィールドが保証した道から外れうる
  if (distance(u.pos, p) < BLOCKED_EPS || !isWalkableAt(state.grid, p)) return 'blocked';
  u.pos = p;
  return 'adjusted';
}

/** 自分で指示された移動の目的地を消す。追跡中の AI は相手が動くので消さない */
function clearOrderedGoal(u: Unit): void {
  if (u.controller !== 'player') return;
  u.goalPos = null;
  u.goalField = null;
}

/**
 * 指示された目的地が、すでに接触している敵の最小距離の内側にあるか。
 * 足元アンカーのスプライトは敵の胴体をタップすると目的地が敵の最小距離circleの内側（向こう側）を
 * 指してしまう。すでに接触しているなら、そこから先へすべって回り込ませず、指示移動を終える
 */
function isGoalInsideContactedHostile(state: BattleState, u: Unit, goal: Vec2): boolean {
  return hostilesOf(state, u).some((h) => (
    distance(h.pos, goal) < MIN_SEPARATION && distance(u.pos, h.pos) <= MIN_SEPARATION + RANGE_EPS
  ));
}

function moveTowardGoal(state: BattleState, u: Unit, dt: number): void {
  const goal = u.goalPos;
  if (!goal) return;

  if (u.controller === 'player' && isGoalInsideContactedHostile(state, u, goal)) {
    clearOrderedGoal(u);
    return;
  }

  const remaining = distance(u.pos, goal);
  const stepLen = u.speed * dt;
  if (remaining <= stepLen) {
    // 着いたか、敵にふさがれて着けないなら指示は終わり。すべって回り込み中なら続ける
    if (stepTo(state, u, goal) !== 'adjusted') clearOrderedGoal(u);
    return;
  }

  // 目的地まで見通せるならフローフィールドを使わず直行する
  const dir = hasLineOfSight(state.grid, u.pos, goal)
    ? { x: (goal.x - u.pos.x) / remaining, y: (goal.y - u.pos.y) / remaining }
    : (() => {
        const field = fieldFor(state, u);
        return field ? flowDirection(state.grid, field, u.pos) : null;
      })();

  if (!dir) {
    clearOrderedGoal(u);
    return;
  }
  const next = { x: u.pos.x + dir.x * stepLen, y: u.pos.y + dir.y * stepLen };
  // 敵に行く手を完全にふさがれたら、指示された移動はそこで終える
  if (stepTo(state, u, next) === 'blocked') clearOrderedGoal(u);
}

/**
 * プレイヤーが出した移動指示は交戦より優先する。
 * 指示した移動が途中で勝手に止まると、プレイヤーの意図が黙って消える。
 * 攻撃は交戦しているかぎり続くので、歩きながら撃つ形になる
 */
function hasOrderedMove(u: Unit): boolean {
  return u.controller === 'player' && u.goalPos !== null;
}

/** 詰め寄り。相手の位置へ直進し、最小距離で止まる（そこで次の tick に交戦が成立する） */
function closeIn(state: BattleState, u: Unit, dt: number): void {
  const target = u.closingOn === null ? undefined : unitByUid(state, u.closingOn);
  if (!target) return;
  const d = distance(u.pos, target.pos);
  if (d === 0) return;
  const stepLen = Math.min(u.speed * dt, d);
  stepTo(state, u, {
    x: u.pos.x + ((target.pos.x - u.pos.x) / d) * stepLen,
    y: u.pos.y + ((target.pos.y - u.pos.y) / d) * stepLen,
  });
}

function moveUnits(state: BattleState, dt: number): void {
  for (const u of state.units) {
    if (u.retired) continue;
    if (u.closingOn !== null) {
      closeIn(state, u, dt);
      continue;
    }
    if (u.engagedWith !== null && !hasOrderedMove(u)) continue;
    moveTowardGoal(state, u, dt);
  }
}

/** 近接はその場でダメージ、弓と魔法は飛翔体を出す */
function deliver(state: BattleState, source: HitSource, target: Unit): void {
  if (source.attack === 'melee') applyDamage(state, source, target);
  else spawnProjectile(state, source, target);
}

/** 振りかぶりが終わった攻撃を出す。相手が倒れていたら捨てる。射程は判定し直さない（空振りは作らない） */
function resolvePendingHit(state: BattleState, u: Unit, byUid: Map<string, Unit>): void {
  const pending = u.pendingHit;
  if (pending === null || state.time < pending.at) return;
  u.pendingHit = null;
  const target = byUid.get(pending.targetUid);
  if (!target || target.retired || target.hp <= 0) return;
  // 飛翔体は発射地点から出る。振りかぶり中に歩いた分だけ、攻撃を出した時点の位置は
  // ずれているので、発動する今の位置に差し替える（近接は位置を使わないので影響しない）
  const source = pending.source.attack === 'melee'
    ? pending.source
    : { ...pending.source, pos: { ...u.pos } };
  deliver(state, source, target);
}

function resolveAttacks(state: BattleState, dt: number): void {
  const byUid = new Map(state.units.map((u) => [u.uid, u]));

  for (const u of state.units) {
    // hp <= 0 は resolveRemoval がまだ retired にしていない状態。飛翔体の着弾を
    // resolveAttacks の前に処理するようにしたため、着弾で倒れたユニットが同じ
    // tick でまだ反撃できてしまう。retired と合わせて hp も見て弾く
    if (u.retired || u.hp <= 0) {
      // 振りかぶり中に倒れたら、その攻撃は出ない
      u.pendingHit = null;
      continue;
    }
    u.attackCooldown -= dt;
    resolvePendingHit(state, u, byUid);
    if (!u.combat || u.engagedWith === null) continue;
    const target = byUid.get(u.engagedWith);
    if (!target || target.retired || target.hp <= 0) continue;

    const hostiles = hostilesOf(state, u);
    const interval = effectiveInterval(u.attackInterval, u.attack, hasThreatWithinMelee(u.pos, hostiles));
    if (u.attackCooldown > 0) continue;

    // 絆は味方どうしの支援なので、同じ side の生存ユニットだけを見る。
    // hp <= 0 の味方は resolveRemoval 前でも支援者に含めない
    const allies = state.units.filter((o) => o.side === u.side && o.hp > 0);
    const supporters = bondSupporters(state.reg, u.uid, u.defId, u.pos, allies.map((o) => ({
      id: o.defId, pos: o.pos, retired: o.retired, uid: o.uid,
    })));
    let bonus = 0;
    for (const s of supporters) bonus += s.bonus;
    if (supporters.length > 0) {
      state.events.push({
        type: 'bondSupport', targetUid: u.uid, targetDefId: u.defId,
        supporterUids: supporters.map((s) => s.uid), pos: { ...u.pos },
      });
    }

    const source: HitSource = {
      uid: u.uid, defId: u.defId, attack: u.attack, pos: { ...u.pos },
      neraiuchi: u.neraiuchiArmed, power: u.power, bondBonus: bonus,
    };
    u.neraiuchiArmed = false;
    u.attackCooldown = interval;

    // 攻撃モーションの起点。近接も飛翔体もここを通る。必殺技は出さない
    state.events.push({
      type: 'attack', uid: u.uid, defId: u.defId,
      pos: { ...u.pos }, targetPos: { ...target.pos },
    });

    // ダメージと飛翔体は、攻撃モーションの最後のコマ（振り下ろし）に合わせて出す
    if (u.windup <= 0) deliver(state, source, target);
    else u.pendingHit = { targetUid: target.uid, source, at: state.time + u.windup };
  }
}

function resolveRemoval(state: BattleState): void {
  for (const u of state.units) {
    if (u.retired) continue;
    const byUid = u.lastHitBy;
    const byDefId = byUid === null ? null : (unitByUid(state, byUid)?.defId ?? null);

    if (u.side === 'enemy') {
      const def = state.reg.enemies.get(u.defId);
      if (def?.fleeAtHpRatio != null && u.hp > 0 && u.hp / u.maxHp < def.fleeAtHpRatio) {
        u.retired = true;
        state.events.push({ type: 'unitFled', uid: u.uid, defId: u.defId, byUid, byDefId });
      } else if (u.hp <= 0) {
        u.hp = 0;
        u.retired = true;
        state.events.push({
          type: 'unitDefeated', uid: u.uid, defId: u.defId, byUid, byDefId,
          neraiuchi: u.lastHitNeraiuchi, pos: { ...u.pos },
        });
      }
    } else if (u.hp <= 0) {
      u.hp = 0;
      u.retired = true;
      state.events.push({ type: 'unitRetired', uid: u.uid, defId: u.defId });
    }

    if (u.retired) {
      dropUnitField(state.fields, u.uid);
      u.pendingHit = null;
      u.engagedWith = null;
      u.closingOn = null;
      u.goalField = null;
      u.goalPos = null;
      for (const other of state.units) {
        if (other.engagedWith === u.uid) other.engagedWith = null;
      }
    }
  }
}

