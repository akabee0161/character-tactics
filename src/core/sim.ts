import { AI_BEHAVIORS } from './ai';
import { bondSupporters } from './bonds';
import { computeDamage, effectiveInterval, hasThreatWithinMelee, nearestWithin } from './combat';
import { accumulate } from './counters';
import { computeFlowField, distance, flowDirection, hasLineOfSight, isWalkableAt } from './field';
import { dropUnitField, fieldToStatic, fieldToUnit } from './fields';
import { awardXpForDefeats } from './growth';
import { updateObjectives } from './objectives';
import { isFunbaruActive, useSkill } from './skills';
import type { BattleState, FlowField, Unit, Vec2 } from './types';

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

function updateAi(state: BattleState): void {
  for (const u of state.units) {
    if (u.retired || u.controller !== 'ai' || u.ai === null) continue;
    const behavior = AI_BEHAVIORS[u.ai.def.kind];
    if (!behavior) continue;
    const decision = behavior({ self: u, hostiles: hostilesOf(state, u), grid: state.grid });
    u.ai.mode = decision.mode;
    u.ai.targetUid = decision.targetUid;
    u.goalPos = decision.goal;
  }
}

export function step(state: BattleState, commands: SimCommand[], dt: number): void {
  state.events = [];
  if (state.phase !== 'battle') return;

  state.time += dt;

  const movedThisTick = applyCommands(state, commands);
  updateAi(state);
  updateEngagements(state, movedThisTick);
  moveUnits(state, dt);
  resolveAttacks(state, dt);
  resolveRemoval(state);
  awardXpForDefeats(state);
  updateObjectives(state);
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

function moveTowardGoal(state: BattleState, u: Unit, dt: number): void {
  const goal = u.goalPos;
  if (!goal) return;

  const remaining = distance(u.pos, goal);
  const stepLen = u.speed * dt;
  if (remaining <= stepLen) {
    u.pos = { ...goal };
    // 追跡中は相手が動くので目的地を消さない。消すのは自分で指示された移動だけ
    if (u.controller === 'player') {
      u.goalPos = null;
      u.goalField = null;
    }
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
    if (u.controller === 'player') {
      u.goalPos = null;
      u.goalField = null;
    }
    return;
  }
  u.pos = { x: u.pos.x + dir.x * stepLen, y: u.pos.y + dir.y * stepLen };
}

function moveUnits(state: BattleState, dt: number): void {
  for (const u of state.units) {
    if (u.retired || u.engagedWith !== null) continue;
    moveTowardGoal(state, u, dt);
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
    const supporters = bondSupporters(state.reg, u.uid, u.defId, u.pos, allies.map((o) => ({
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
      dropUnitField(state.fields, u.uid);
      u.engagedWith = null;
      u.goalField = null;
      u.goalPos = null;
      for (const other of state.units) {
        if (other.engagedWith === u.uid) other.engagedWith = null;
      }
    }
  }
}

