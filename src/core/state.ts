import { CHARACTERS } from '../content/characters';
import { computeFlowField, isWalkableAt, makeGrid } from './field';
import { makeRng } from './rng';
import { CHAR_IDS, FORT_MAX_HP } from './types';
import type {
  AllyUnit,
  BattleState,
  CharBattleStats,
  CharId,
  CharProgress,
  StageDef,
  Vec2,
} from './types';

const HP_PER_LEVEL = 3;
const POWER_PER_LEVEL = 1;
const WAVE_HEAL_RATIO = 0.3;
const REVIVE_HP_RATIO = 0.5;

export function statsForLevel(id: CharId, level: number): { maxHp: number; power: number } {
  const def = CHARACTERS[id];
  const steps = Math.max(0, level - 1);
  return {
    maxHp: def.maxHp + steps * HP_PER_LEVEL,
    power: def.power + steps * POWER_PER_LEVEL,
  };
}

function emptyStats(): CharBattleStats {
  return { defeats: 0, skillUses: 0, neraiuchiKills: 0, kakenukeruHits: 0, bondSupports: 0 };
}

function makeAlly(id: CharId, level: number, pos: Vec2): AllyUnit {
  const def = CHARACTERS[id];
  const { maxHp, power } = statsForLevel(id, level);
  return {
    id,
    pos: { ...pos },
    hp: maxHp,
    maxHp,
    power,
    guard: def.guard,
    attack: def.attack,
    range: def.range,
    attackInterval: def.attackInterval,
    speed: def.speed,
    skill: def.skill,
    goalField: null,
    goalPos: null,
    engagedWith: null,
    attackCooldown: 0,
    skillUsed: false,
    retired: false,
    funbaruUntil: -1,
    neraiuchiArmed: false,
    pinchShown: false,
    seenKinds: [],
  };
}

export function createBattleState(
  stage: StageDef,
  progress: Record<CharId, CharProgress>,
  seed: number,
): BattleState {
  const grid = makeGrid(stage.cell, stage.mapRows);
  const stats = {} as Record<CharId, CharBattleStats>;
  for (const id of CHAR_IDS) stats[id] = emptyStats();

  return {
    stage,
    grid,
    enemyField: computeFlowField(grid, stage.fort),
    fortHp: FORT_MAX_HP,
    waveIndex: 0,
    time: 0,
    phase: 'placement',
    allies: CHAR_IDS.map((id) => makeAlly(id, progress[id].level, stage.fort)),
    enemies: [],
    pending: [],
    events: [],
    rng: makeRng(seed),
    stats,
    nextEnemyUid: 1,
  };
}

export function placeAlly(state: BattleState, id: CharId, pos: Vec2): boolean {
  if (!isWalkableAt(state.grid, pos)) return false;
  const ally = state.allies.find((a) => a.id === id);
  if (!ally) return false;
  ally.pos = { ...pos };
  ally.goalField = null;
  ally.goalPos = null;
  return true;
}

export function startWave(state: BattleState): void {
  for (const ally of state.allies) {
    if (ally.retired) {
      ally.retired = false;
      ally.hp = Math.max(1, Math.floor(ally.maxHp * REVIVE_HP_RATIO));
    } else {
      ally.hp = Math.min(ally.maxHp, ally.hp + Math.floor(ally.maxHp * WAVE_HEAL_RATIO));
    }
    ally.skillUsed = false;
    ally.pinchShown = false;
    ally.engagedWith = null;
    ally.attackCooldown = 0;
    ally.goalField = null;
    ally.goalPos = null;
    ally.funbaruUntil = -1;
    ally.neraiuchiArmed = false;
  }

  const wave = state.stage.waves[state.waveIndex];
  state.pending = wave ? wave.spawns.map((s) => ({ ...s, from: { ...s.from } })) : [];
  state.enemies = [];
  state.events = [];
  state.time = 0;
  state.phase = 'wave';
}
