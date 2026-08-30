import { computeFlowField, distance, isWalkableAt, makeGrid } from './field';
import { makeRng } from './rng';
import { FORT_MAX_HP } from './types';
import type { Registry } from '../engine/registry';
import type { EnemyDef, EnemyPlacement, StageDef, UnitDef } from '../engine/schema';
import type { AllyUnit, BattleState, CharProgress, EnemyUnit, Vec2 } from './types';

const HP_PER_LEVEL = 3;
const POWER_PER_LEVEL = 1;
export const PLACEMENT_RADIUS = 64;

export function statsForLevel(def: UnitDef, level: number): { maxHp: number; power: number } {
  const steps = Math.max(0, level - 1);
  return { maxHp: def.maxHp + steps * HP_PER_LEVEL, power: def.power + steps * POWER_PER_LEVEL };
}

function makeAlly(def: UnitDef, level: number, pos: Vec2): AllyUnit {
  const { maxHp, power } = statsForLevel(def, level);
  return {
    id: def.id,
    pos: { ...pos },
    hp: maxHp,
    maxHp,
    power,
    guard: def.guard,
    attack: def.attack,
    range: def.range,
    attackInterval: def.attackInterval,
    speed: def.speed,
    skill: def.skillId ?? '',
    goalField: null,
    goalPos: null,
    engagedWith: null,
    attackCooldown: 0,
    skillUsed: false,
    retired: false,
    funbaruUntil: -1,
    neraiuchiArmed: false,
    pinchShown: false,
    seenDefIds: [],
  };
}

function makeEnemy(uid: string, def: EnemyDef, placement: EnemyPlacement): EnemyUnit {
  return {
    uid,
    kind: def.id,
    ai: placement.ai,
    pos: { ...placement.pos },
    hp: def.maxHp,
    maxHp: def.maxHp,
    engagedWith: null,
    attackCooldown: 0,
    lastHitBy: null,
    lastHitNeraiuchi: false,
  };
}

export function createBattleState(
  reg: Registry,
  stage: StageDef,
  progress: Record<string, CharProgress>,
  seed: number,
): BattleState {
  const grid = makeGrid(stage.cell, stage.mapRows);

  const allies = stage.roster.map((defId, i) => {
    const def = reg.units.get(defId);
    if (!def) throw new Error(`roster に しらない ユニット: ${defId}`);
    const zone = stage.placementZone[i % stage.placementZone.length]!;
    return makeAlly(def, progress[defId]?.level ?? 1, zone.pos);
  });

  let nextEnemyUid = 1;
  const enemies = stage.enemies.map((placement) => {
    const def = reg.enemies.get(placement.defId);
    if (!def) throw new Error(`はいちに しらない てき: ${placement.defId}`);
    return makeEnemy(`e${nextEnemyUid++}`, def, placement);
  });

  return {
    reg,
    stage,
    grid,
    // フェーズ 6 まで、敵は全員このフィールドを降りてくる。ゴールは味方の初期配置地点
    enemyField: computeFlowField(grid, stage.placementZone[0]!.pos),
    fortHp: FORT_MAX_HP,
    time: 0,
    phase: 'placement',
    allies,
    enemies,
    events: [],
    counters: {},
    rng: makeRng(seed),
    nextEnemyUid,
  };
}

export function placeUnit(state: BattleState, defId: string, pos: Vec2): boolean {
  if (!isWalkableAt(state.grid, pos)) return false;
  const inZone = state.stage.placementZone.some((z) => distance(z.pos, pos) <= PLACEMENT_RADIUS);
  if (!inZone) return false;
  const ally = state.allies.find((a) => a.id === defId);
  if (!ally) return false;
  ally.pos = { ...pos };
  ally.goalField = null;
  ally.goalPos = null;
  return true;
}

/** 配置フェーズから戦闘へ。ウェーブが無いので、これはステージ中に1度しか呼ばれない */
export function beginBattle(state: BattleState): void {
  for (const ally of state.allies) {
    ally.engagedWith = null;
    ally.attackCooldown = 0;
    ally.goalField = null;
    ally.goalPos = null;
  }
  state.events = [];
  state.time = 0;
  state.phase = 'battle';
}
