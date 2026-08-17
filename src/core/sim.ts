import { ENEMIES } from '../content/enemies';
import { nearestWithin } from './combat';
import { computeFlowField, flowDirection, isWalkableAt } from './field';
import { nextFloat } from './rng';
import { useSkill } from './skills';
import type { AllyUnit, BattleState, CharId, EnemyUnit, Vec2 } from './types';

export const SPAWN_JITTER = 12;

export type SimCommand =
  | { type: 'move'; allyId: CharId; dest: Vec2 }
  | { type: 'skill'; allyId: CharId; dest?: Vec2 };

export function step(state: BattleState, commands: SimCommand[], dt: number): void {
  state.events = [];
  if (state.phase !== 'wave') return;

  state.time += dt;

  const movedThisTick = applyCommands(state, commands);
  spawnDueEnemies(state);
  updateEngagements(state, movedThisTick);
  moveUnits(state, dt);
}

function applyCommands(state: BattleState, commands: SimCommand[]): Set<CharId> {
  const movedThisTick = new Set<CharId>();
  for (const cmd of commands) {
    const ally = state.allies.find((a) => a.id === cmd.allyId);
    if (!ally || ally.retired) continue;

    if (cmd.type === 'move') {
      if (!isWalkableAt(state.grid, cmd.dest)) continue;
      ally.goalField = computeFlowField(state.grid, cmd.dest);
      ally.engagedWith = null;
      movedThisTick.add(ally.id);
    } else {
      useSkill(state, cmd.allyId, cmd.dest);
    }
  }
  return movedThisTick;
}

function spawnDueEnemies(state: BattleState): void {
  const remaining: typeof state.pending = [];
  for (const entry of state.pending) {
    if (entry.at > state.time) {
      remaining.push(entry);
      continue;
    }
    const def = ENEMIES[entry.kind];
    const jitter = () => (nextFloat(state.rng) * 2 - 1) * SPAWN_JITTER;
    const enemy: EnemyUnit = {
      uid: `e${state.nextEnemyUid++}`,
      kind: entry.kind,
      pos: { x: entry.from.x + jitter(), y: entry.from.y + jitter() },
      hp: def.maxHp,
      maxHp: def.maxHp,
      engagedWith: null,
      attackCooldown: 0,
      lastHitBy: null,
      lastHitNeraiuchi: false,
    };
    state.enemies.push(enemy);
  }
  state.pending = remaining;
}

function activeAllies(state: BattleState): AllyUnit[] {
  return state.allies.filter((a) => !a.retired);
}

function updateEngagements(state: BattleState, movedThisTick: Set<CharId>): void {
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
      ally.attackCooldown = 0;
      claimed.add(target.uid);
      const firstMeeting = !ally.seenKinds.includes(target.kind);
      if (firstMeeting) ally.seenKinds.push(target.kind);
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
    const range = ENEMIES[enemy.kind].range;
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
        enemy.attackCooldown = 0;
      }
    }
  }
}

function distanceBetween(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function moveUnits(state: BattleState, dt: number): void {
  for (const ally of state.allies) {
    if (ally.retired || ally.engagedWith !== null || !ally.goalField) continue;
    const dir = flowDirection(state.grid, ally.goalField, ally.pos);
    if (!dir) {
      ally.goalField = null;
      continue;
    }
    ally.pos = { x: ally.pos.x + dir.x * ally.speed * dt, y: ally.pos.y + dir.y * ally.speed * dt };
  }

  for (const enemy of state.enemies) {
    if (enemy.engagedWith !== null) continue;
    const dir = flowDirection(state.grid, state.enemyField, enemy.pos);
    if (!dir) continue;
    const speed = ENEMIES[enemy.kind].speed;
    enemy.pos = { x: enemy.pos.x + dir.x * speed * dt, y: enemy.pos.y + dir.y * speed * dt };
  }
}
