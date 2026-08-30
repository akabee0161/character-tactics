import { bondSupporters } from './bonds';
import { computeDamage, effectiveInterval, hasThreatWithinMelee, nearestWithin } from './combat';
import { accumulate } from './counters';
import { computeFlowField, distance, flowDirection, hasLineOfSight, isWalkableAt } from './field';
import { isFunbaruActive, useSkill } from './skills';
import type { EnemyDef } from '../engine/schema';
import type { AllyUnit, BattleState, EnemyUnit, Vec2 } from './types';

export const FORT_RADIUS = 24;
export const PINCH_RATIO = 0.3;

function enemyDefOf(state: BattleState, enemy: EnemyUnit): EnemyDef {
  const def = state.reg.enemies.get(enemy.kind);
  if (!def) throw new Error(`しらない てき: ${enemy.kind}`);
  return def;
}

export type SimCommand =
  | { type: 'move'; allyId: string; dest: Vec2 }
  | { type: 'skill'; allyId: string; dest?: Vec2 };

export function step(state: BattleState, commands: SimCommand[], dt: number): void {
  state.events = [];
  if (state.phase !== 'battle') return;

  state.time += dt;

  const movedThisTick = applyCommands(state, commands);
  updateEngagements(state, movedThisTick);
  moveUnits(state, dt);
  resolveAttacks(state, dt);
  resolveEnemyRemoval(state);
  resolveAllyRetirement(state);
  resolveFort(state);
  updatePhase(state);
  accumulate(state.counters, state.events);
}

function applyCommands(state: BattleState, commands: SimCommand[]): Set<string> {
  const movedThisTick = new Set<string>();
  for (const cmd of commands) {
    const ally = state.allies.find((a) => a.id === cmd.allyId);
    if (!ally || ally.retired) continue;

    if (cmd.type === 'move') {
      if (!isWalkableAt(state.grid, cmd.dest)) continue;
      ally.goalField = computeFlowField(state.grid, cmd.dest);
      ally.goalPos = { ...cmd.dest };
      ally.engagedWith = null;
      movedThisTick.add(ally.id);
    } else {
      useSkill(state, cmd.allyId, cmd.dest);
    }
  }
  return movedThisTick;
}

function activeAllies(state: BattleState): AllyUnit[] {
  return state.allies.filter((a) => !a.retired);
}

function updateEngagements(state: BattleState, movedThisTick: Set<string>): void {
  const byUid = new Map(state.enemies.map((e) => [e.uid, e]));

  // 解除
  for (const ally of state.allies) {
    if (ally.retired) {
      ally.engagedWith = null;
      continue;
    }
    if (ally.engagedWith !== null) {
      const target = byUid.get(ally.engagedWith);
      if (!target || distanceBetween(ally.pos, target.pos) > ally.range) {
        ally.engagedWith = null;
      }
    }
  }

  // 敵1体につき交戦できる味方は1人（1対1が基本）。すでに誰かの相手になっている敵は
  // 新たな相手として選ばれない
  const claimed = new Set(
    state.allies.filter((a) => a.engagedWith !== null).map((a) => a.engagedWith as string),
  );

  // 成立。直前の move コマンドで交戦を解いた味方は、その tick では再成立させない
  // （まだ位置が動く前なので、そのままだと即座に再交戦してしまう）
  for (const ally of state.allies) {
    if (ally.retired || ally.engagedWith !== null || movedThisTick.has(ally.id)) continue;
    const available = state.enemies.filter((e) => !claimed.has(e.uid));
    const target = nearestWithin(ally.pos, available, ally.range);
    if (target) {
      ally.engagedWith = target.uid;
      // 交戦成立の直後は攻撃していないので、1 攻撃間隔ぶんのクールダウンを与える
      ally.attackCooldown = effectiveInterval(
        ally.attackInterval,
        ally.attack,
        hasThreatWithinMelee(ally.pos, state.enemies),
      );
      claimed.add(target.uid);
      const firstMeeting = !ally.seenDefIds.includes(target.kind);
      if (firstMeeting) ally.seenDefIds.push(target.kind);
      state.events.push({
        type: 'engage',
        allyId: ally.id,
        enemyUid: target.uid,
        kind: target.kind,
        firstMeeting,
      });
    }
  }

  const allies = activeAllies(state);
  for (const enemy of state.enemies) {
    const range = enemyDefOf(state, enemy).range;
    if (enemy.engagedWith !== null) {
      const target = allies.find((a) => a.id === enemy.engagedWith);
      if (!target || distanceBetween(enemy.pos, target.pos) > range) {
        enemy.engagedWith = null;
      }
    }
    if (enemy.engagedWith === null) {
      const target = nearestWithin(enemy.pos, allies, range);
      if (target) {
        enemy.engagedWith = target.id;
        // 敵は常に近接なので、交戦成立の直後は素の攻撃間隔ぶんのクールダウンを与える
        enemy.attackCooldown = enemyDefOf(state, enemy).attackInterval;
      }
    }
  }
}

function distanceBetween(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function moveAlly(state: BattleState, ally: AllyUnit, dt: number): void {
  const goal = ally.goalPos;
  if (!goal) return;

  const remaining = distance(ally.pos, goal);
  const stepLen = ally.speed * dt;
  if (remaining <= stepLen) {
    ally.pos = { ...goal };
    ally.goalPos = null;
    ally.goalField = null;
    return;
  }

  // 目的地まで見通せるならフローフィールドを使わず直行する
  const dir = hasLineOfSight(state.grid, ally.pos, goal)
    ? { x: (goal.x - ally.pos.x) / remaining, y: (goal.y - ally.pos.y) / remaining }
    : ally.goalField && flowDirection(state.grid, ally.goalField, ally.pos);

  if (!dir) {
    ally.goalPos = null;
    ally.goalField = null;
    return;
  }
  ally.pos = { x: ally.pos.x + dir.x * stepLen, y: ally.pos.y + dir.y * stepLen };
}

function moveUnits(state: BattleState, dt: number): void {
  for (const ally of state.allies) {
    if (ally.retired || ally.engagedWith !== null) continue;
    moveAlly(state, ally, dt);
  }

  for (const enemy of state.enemies) {
    if (enemy.engagedWith !== null) continue;
    const dir = flowDirection(state.grid, state.enemyField, enemy.pos);
    if (!dir) continue;
    const speed = enemyDefOf(state, enemy).speed;
    enemy.pos = { x: enemy.pos.x + dir.x * speed * dt, y: enemy.pos.y + dir.y * speed * dt };
  }
}

function resolveAttacks(state: BattleState, dt: number): void {
  const byUid = new Map(state.enemies.map((e) => [e.uid, e]));

  for (const ally of state.allies) {
    if (ally.retired) continue;
    ally.attackCooldown -= dt;
    if (ally.engagedWith === null) continue;
    const target = byUid.get(ally.engagedWith);
    if (!target) continue;

    const interval = effectiveInterval(
      ally.attackInterval,
      ally.attack,
      hasThreatWithinMelee(ally.pos, state.enemies),
    );
    if (ally.attackCooldown > 0) continue;

    const supporters = bondSupporters(state.reg, ally.id, ally.pos, state.allies);
    let bonus = 0;
    for (const s of supporters) bonus += s.bonus;
    if (supporters.length > 0) {
      state.events.push({
        type: 'bondSupport', targetId: ally.id, supporterIds: supporters.map((s) => s.id),
      });
    }

    const neraiuchi = ally.neraiuchiArmed;
    const targetDef = enemyDefOf(state, target);
    const dmg = computeDamage({
      power: ally.power,
      guard: targetDef.guard,
      attackKind: ally.attack,
      bowDamageCap: targetDef.bowDamageCap,
      bondBonus: bonus,
      neraiuchi,
      targetFunbaru: false,
    });
    target.hp -= dmg;
    target.lastHitBy = ally.id;
    target.lastHitNeraiuchi = neraiuchi;
    ally.neraiuchiArmed = false;
    ally.attackCooldown = interval;
    state.events.push({ type: 'hit', targetPos: { ...target.pos }, amount: dmg });
  }

  for (const enemy of state.enemies) {
    enemy.attackCooldown -= dt;
    if (enemy.engagedWith === null) continue;
    const target = state.allies.find((a) => a.id === enemy.engagedWith && !a.retired);
    if (!target) continue;
    if (enemy.attackCooldown > 0) continue;

    const def = enemyDefOf(state, enemy);
    const before = target.hp;
    const dmg = computeDamage({
      power: def.power,
      guard: target.guard,
      attackKind: 'melee',
      bowDamageCap: null,
      bondBonus: 0,
      neraiuchi: false,
      targetFunbaru: isFunbaruActive(target, state.time),
    });
    target.hp -= dmg;
    enemy.attackCooldown = def.attackInterval;
    state.events.push({ type: 'hit', targetPos: { ...target.pos }, amount: dmg });

    const ratio = target.hp / target.maxHp;
    const beforeRatio = before / target.maxHp;
    if (target.hp > 0 && ratio < PINCH_RATIO && beforeRatio >= PINCH_RATIO && !target.pinchShown) {
      target.pinchShown = true;
      state.events.push({ type: 'pinch', allyId: target.id });
    }
  }
}

function resolveEnemyRemoval(state: BattleState): void {
  const survivors: EnemyUnit[] = [];
  for (const enemy of state.enemies) {
    const def = enemyDefOf(state, enemy);
    if (def.fleeAtHpRatio !== null && enemy.hp / enemy.maxHp < def.fleeAtHpRatio) {
      state.events.push({
        type: 'unitFled', uid: enemy.uid, kind: enemy.kind, byAlly: enemy.lastHitBy,
      });
      continue;
    }
    if (enemy.hp <= 0) {
      state.events.push({
        type: 'enemyDefeated',
        uid: enemy.uid, kind: enemy.kind,
        byAlly: enemy.lastHitBy,
        neraiuchi: enemy.lastHitNeraiuchi,
      });
      continue;
    }
    survivors.push(enemy);
  }
  if (survivors.length !== state.enemies.length) {
    const alive = new Set(survivors.map((e) => e.uid));
    for (const ally of state.allies) {
      if (ally.engagedWith !== null && !alive.has(ally.engagedWith)) ally.engagedWith = null;
    }
  }
  state.enemies = survivors;
}

function resolveAllyRetirement(state: BattleState): void {
  for (const ally of state.allies) {
    if (ally.retired || ally.hp > 0) continue;
    ally.hp = 0;
    ally.retired = true;
    ally.engagedWith = null;
    ally.goalField = null;
    ally.goalPos = null;
    for (const enemy of state.enemies) {
      if (enemy.engagedWith === ally.id) enemy.engagedWith = null;
    }
    state.events.push({ type: 'allyRetired', allyId: ally.id });
  }
}

function resolveFort(state: BattleState): void {
  const goal = state.stage.placementZone[0]!.pos;
  const survivors: EnemyUnit[] = [];
  for (const enemy of state.enemies) {
    // 交戦中の敵はその場で足止めされているので、たまたま到達地点の近くで戦っていても
    // 到達扱いにはしない
    if (enemy.engagedWith === null && distance(enemy.pos, goal) <= FORT_RADIUS) {
      // フェーズ 5 でこの処理ごと消える。それまでの暫定として一律 5 ダメージにする
      state.fortHp -= 5;
      state.events.push({ type: 'fortDamaged', amount: 5 });
      continue;
    }
    survivors.push(enemy);
  }
  state.enemies = survivors;
}

function updatePhase(state: BattleState): void {
  if (state.fortHp <= 0) {
    state.fortHp = 0;
    state.phase = 'defeat';
    return;
  }
  // フェーズ 5 で updateObjectives に置き換わる
  if (state.enemies.length === 0) state.phase = 'victory';
}
