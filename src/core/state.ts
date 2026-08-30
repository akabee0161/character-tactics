import { computeFlowField, distance, isWalkableAt, makeGrid } from './field';
import { makeRng } from './rng';
import type { Registry } from '../engine/registry';
import type { AiDef, EnemyDef, StageDef, UnitDef } from '../engine/schema';
import type { BattleState, CharProgress, Unit, Vec2 } from './types';

const HP_PER_LEVEL = 3;
const POWER_PER_LEVEL = 1;
export const PLACEMENT_RADIUS = 64;

export function statsForLevel(def: UnitDef, level: number): { maxHp: number; power: number } {
  const steps = Math.max(0, level - 1);
  return { maxHp: def.maxHp + steps * HP_PER_LEVEL, power: def.power + steps * POWER_PER_LEVEL };
}

type MakeUnitArgs = {
  uid: string;
  def: UnitDef | EnemyDef;
  side: 'player' | 'enemy';
  controller: 'player' | 'ai';
  pos: Vec2;
  level: number;
  xp: number;
  ai: AiDef | null;
};

function makeUnit(a: MakeUnitArgs): Unit {
  const { maxHp, power } = statsForLevel(a.def, a.level);
  const enemyDef = 'bowDamageCap' in a.def ? a.def : null;
  return {
    uid: a.uid,
    defId: a.def.id,
    side: a.side,
    controller: a.controller,
    combat: a.def.combat,
    pos: { ...a.pos },
    hp: maxHp, maxHp, power,
    guard: a.def.guard,
    attack: a.def.attack,
    range: a.def.range,
    attackInterval: a.def.attackInterval,
    speed: a.def.speed,
    bowDamageCap: enemyDef?.bowDamageCap ?? null,
    skillId: a.def.skillId,
    level: a.level, xp: a.xp,
    goalPos: null, goalField: null, engagedWith: null, attackCooldown: 0, retired: false,
    ai: a.ai === null ? null : { def: a.ai, mode: 'idle', targetUid: null, home: { ...a.pos } },
    skillUsed: false, funbaruUntil: -1, neraiuchiArmed: false, pinchShown: false,
    seenDefIds: [], lastHitBy: null, lastHitNeraiuchi: false,
  };
}

export function createBattleState(
  reg: Registry,
  stage: StageDef,
  progress: Record<string, CharProgress>,
  seed: number,
): BattleState {
  const grid = makeGrid(stage.cell, stage.mapRows);

  const roster = stage.roster.map((defId, i) => {
    const def = reg.units.get(defId);
    if (!def) throw new Error(`roster に しらない ユニット: ${defId}`);
    const zone = stage.placementZone[i % stage.placementZone.length]!;
    return makeUnit({
      uid: `p${i + 1}`, def, side: 'player', controller: 'player', pos: zone.pos,
      level: progress[defId]?.level ?? 1, xp: progress[defId]?.xp ?? 0, ai: null,
    });
  });

  let nextEnemyUid = 1;
  const enemies = stage.enemies.map((placement) => {
    const def = reg.enemies.get(placement.defId);
    if (!def) throw new Error(`はいちに しらない てき: ${placement.defId}`);
    return makeUnit({
      uid: `e${nextEnemyUid++}`, def, side: 'enemy', controller: 'ai', pos: placement.pos,
      level: 1, xp: 0, ai: placement.ai,
    });
  });

  return {
    reg,
    stage,
    grid,
    // フェーズ 6 まで、敵は全員このフィールドを降りてくる。ゴールは味方の初期配置地点
    enemyField: computeFlowField(grid, stage.placementZone[0]!.pos),
    time: 0,
    phase: 'placement',
    units: [...roster, ...enemies],
    events: [],
    counters: {},
    rng: makeRng(seed),
    nextEnemyUid,
  };
}

export function placeUnit(state: BattleState, uid: string, pos: Vec2): boolean {
  if (!isWalkableAt(state.grid, pos)) return false;
  const inZone = state.stage.placementZone.some((z) => distance(z.pos, pos) <= PLACEMENT_RADIUS);
  if (!inZone) return false;
  const unit = state.units.find((u) => u.uid === uid && u.side === 'player');
  if (!unit) return false;
  unit.pos = { ...pos };
  unit.goalField = null;
  unit.goalPos = null;
  return true;
}

/** 配置フェーズから戦闘へ。ウェーブが無いので、これはステージ中に1度しか呼ばれない */
export function beginBattle(state: BattleState): void {
  for (const unit of state.units) {
    if (unit.side !== 'player') continue;
    unit.engagedWith = null;
    unit.attackCooldown = 0;
    unit.goalField = null;
    unit.goalPos = null;
  }
  state.events = [];
  state.time = 0;
  state.phase = 'battle';
}
