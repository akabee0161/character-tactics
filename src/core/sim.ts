import { bondSupporters } from './bonds';
import { computeDamage, effectiveInterval, hasThreatWithinMelee, nearestWithin } from './combat';
import { accumulate } from './counters';
import { computeFlowField, distance, flowDirection, hasLineOfSight, isWalkableAt } from './field';
import { isFunbaruActive, useSkill } from './skills';
import type { BattleState, Unit, Vec2 } from './types';

export const FORT_RADIUS = 24;
export const PINCH_RATIO = 0.3;

export function playerUnits(state: BattleState): Unit[] {
  return state.units.filter((u) => u.side === 'player' && !u.retired);
}

export function hostilesOf(state: BattleState, self: Unit): Unit[] {
  return state.units.filter((u) => u.side !== self.side && !u.retired);
}

export function unitByUid(state: BattleState, uid: string): Unit | undefined {
  return state.units.find((u) => u.uid === uid);
}

export type SimCommand =
  | { type: 'move'; uid: string; dest: Vec2 }
  | { type: 'skill'; uid: string; dest?: Vec2 };

export function step(state: BattleState, commands: SimCommand[], dt: number): void {
  state.events = [];
  if (state.phase !== 'battle') return;

  state.time += dt;

  const movedThisTick = applyCommands(state, commands);
  updateEngagements(state, movedThisTick);
  moveUnits(state, dt);
  resolveAttacks(state, dt);
  resolveRemoval(state);
  resolveFort(state);
  updatePhase(state);
  accumulate(state.counters, state.events);
}

function applyCommands(state: BattleState, commands: SimCommand[]): Set<string> {
  const movedThisTick = new Set<string>();
  for (const cmd of commands) {
    const u = unitByUid(state, cmd.uid);
    if (!u || u.retired || u.side !== 'player') continue;

    if (cmd.type === 'move') {
      if (!isWalkableAt(state.grid, cmd.dest)) continue;
      u.goalField = computeFlowField(state.grid, cmd.dest);
      u.goalPos = { ...cmd.dest };
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
    if (!target || target.retired || distance(u.pos, target.pos) > u.range) u.engagedWith = null;
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
    const target = nearestWithin(u.pos, available, u.range);
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

function moveTowardGoal(state: BattleState, u: Unit, dt: number): void {
  const goal = u.goalPos;
  if (!goal) return;

  const remaining = distance(u.pos, goal);
  const stepLen = u.speed * dt;
  if (remaining <= stepLen) {
    u.pos = { ...goal };
    u.goalPos = null;
    u.goalField = null;
    return;
  }

  // 目的地まで見通せるならフローフィールドを使わず直行する
  const dir = hasLineOfSight(state.grid, u.pos, goal)
    ? { x: (goal.x - u.pos.x) / remaining, y: (goal.y - u.pos.y) / remaining }
    : u.goalField && flowDirection(state.grid, u.goalField, u.pos);

  if (!dir) {
    u.goalPos = null;
    u.goalField = null;
    return;
  }
  u.pos = { x: u.pos.x + dir.x * stepLen, y: u.pos.y + dir.y * stepLen };
}

function moveUnits(state: BattleState, dt: number): void {
  for (const u of state.units) {
    if (u.retired || u.engagedWith !== null) continue;
    if (u.controller === 'player') {
      moveTowardGoal(state, u, dt);
    } else {
      // フェーズ 6 でここが AI の決定に置き換わる
      const dir = flowDirection(state.grid, state.enemyField, u.pos);
      if (!dir) continue;
      u.pos = { x: u.pos.x + dir.x * u.speed * dt, y: u.pos.y + dir.y * u.speed * dt };
    }
  }
}

function resolveAttacks(state: BattleState, dt: number): void {
  const byUid = new Map(state.units.map((u) => [u.uid, u]));

  for (const u of state.units) {
    if (u.retired) continue;
    u.attackCooldown -= dt;
    if (!u.combat || u.engagedWith === null) continue;
    const target = byUid.get(u.engagedWith);
    if (!target || target.retired) continue;

    const hostiles = hostilesOf(state, u);
    const interval = effectiveInterval(u.attackInterval, u.attack, hasThreatWithinMelee(u.pos, hostiles));
    if (u.attackCooldown > 0) continue;

    // 絆は味方どうしの支援なので、同じ side の生存ユニットだけを見る
    const allies = state.units.filter((o) => o.side === u.side);
    const supporters = bondSupporters(state.reg, u.defId, u.pos, allies.map((o) => ({
      id: o.defId, pos: o.pos, retired: o.retired, uid: o.uid,
    })));
    let bonus = 0;
    for (const s of supporters) bonus += s.bonus;
    if (supporters.length > 0) {
      state.events.push({
        type: 'bondSupport', targetUid: u.uid, targetDefId: u.defId,
        supporterUids: supporters.map((s) => s.uid),
      });
    }

    const neraiuchi = u.neraiuchiArmed;
    const before = target.hp;
    const dmg = computeDamage({
      power: u.power,
      guard: target.guard,
      attackKind: u.attack,
      bowDamageCap: target.bowDamageCap,
      bondBonus: bonus,
      neraiuchi,
      targetFunbaru: isFunbaruActive(target, state.time),
    });
    target.hp -= dmg;
    target.lastHitBy = u.uid;
    target.lastHitNeraiuchi = neraiuchi;
    u.neraiuchiArmed = false;
    u.attackCooldown = interval;
    state.events.push({ type: 'hit', targetPos: { ...target.pos }, amount: dmg });

    // ピンチのセリフは操作できる味方にだけ出す
    if (target.side === 'player' && target.hp > 0 && !target.pinchShown) {
      const ratio = target.hp / target.maxHp;
      if (ratio < PINCH_RATIO && before / target.maxHp >= PINCH_RATIO) {
        target.pinchShown = true;
        state.events.push({ type: 'pinch', uid: target.uid, defId: target.defId });
      }
    }
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
          neraiuchi: u.lastHitNeraiuchi,
        });
      }
    } else if (u.hp <= 0) {
      u.hp = 0;
      u.retired = true;
      state.events.push({ type: 'unitRetired', uid: u.uid, defId: u.defId });
    }

    if (u.retired) {
      u.engagedWith = null;
      u.goalField = null;
      u.goalPos = null;
      for (const other of state.units) {
        if (other.engagedWith === u.uid) other.engagedWith = null;
      }
    }
  }
}

function resolveFort(state: BattleState): void {
  const goal = state.stage.placementZone[0]!.pos;
  for (const u of state.units) {
    if (u.side !== 'enemy' || u.retired) continue;
    // 交戦中の敵はその場で足止めされているので、たまたま到達地点の近くで戦っていても
    // 到達扱いにはしない
    if (u.engagedWith === null && distance(u.pos, goal) <= FORT_RADIUS) {
      // フェーズ 5 でこの処理ごと消える。それまでの暫定として一律 5 ダメージにする
      state.fortHp -= 5;
      state.events.push({ type: 'fortDamaged', amount: 5 });
      u.retired = true;
      u.engagedWith = null;
      u.goalField = null;
      u.goalPos = null;
      for (const other of state.units) {
        if (other.engagedWith === u.uid) other.engagedWith = null;
      }
    }
  }
}

function updatePhase(state: BattleState): void {
  if (state.fortHp <= 0) {
    state.fortHp = 0;
    state.phase = 'defeat';
    return;
  }
  // フェーズ 5 で updateObjectives に置き換わる
  const enemiesLeft = state.units.some((u) => u.side === 'enemy' && !u.retired);
  if (!enemiesLeft) state.phase = 'victory';
}
