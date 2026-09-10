import { isWalkableAt, makeGrid } from './field';
import { makeFieldCache } from './fields';
import { makeRng } from './rng';
import type { Registry } from '../engine/registry';
import type { AiDef, EnemyDef, GrowthDef, StageDef, UnitDef } from '../engine/schema';
import type { BattleState, CharProgress, Grid, Unit, Vec2 } from './types';

/**
 * レベルからステータスを出す。HP は毎レベル、攻撃力は levelsPerPower レベルごとに上がる。
 * 攻撃力を小数にしないのは computeDamage が整数前提で組まれているため
 */
export function statsForLevel(
  def: UnitDef | EnemyDef, level: number, growth: GrowthDef,
): { maxHp: number; power: number } {
  const steps = Math.max(0, level - 1);
  return {
    maxHp: def.maxHp + steps * growth.hpPerLevel,
    power: def.power + Math.floor(steps / growth.levelsPerPower),
  };
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
  growth: GrowthDef;
};

function makeUnit(a: MakeUnitArgs): Unit {
  const { maxHp, power } = statsForLevel(a.def, a.level, a.growth);
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
    skillCooldownUntil: 0, funbaruUntil: -1, neraiuchiArmed: false, pinchShown: false,
    seenDefIds: [], lastHitBy: null, lastHitNeraiuchi: false, damagedBy: [],
  };
}

/** 敵ユニットを1体つくる。ステージ開始時の配置と時間湧きの両方がここを通る */
export function makeEnemyUnit(
  reg: Registry, uid: string, defId: string, pos: Vec2, ai: AiDef,
): Unit {
  const def = reg.enemies.get(defId);
  if (!def) throw new Error(`はいちに しらない てき: ${defId}`);
  return makeUnit({
    uid, def, side: 'enemy', controller: 'ai', pos, level: 1, xp: 0, ai, growth: reg.growth,
  });
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
    const start = stage.placement.starts[i % stage.placement.starts.length]!;
    return makeUnit({
      uid: `p${i + 1}`, def, side: 'player', controller: 'player', pos: start,
      level: progress[defId]?.level ?? 1, xp: progress[defId]?.xp ?? 0, ai: null,
      growth: reg.growth,
    });
  });

  let nextEnemyUid = 1;
  const enemies = stage.enemies.map((placement) =>
    makeEnemyUnit(reg, `e${nextEnemyUid++}`, placement.defId, placement.pos, placement.ai));

  return {
    reg,
    stage,
    grid,
    // フェーズ 6 まで、敵は全員 placement.starts[0] を目指す。フローフィールドは fields でキャッシュする
    fields: makeFieldCache(),
    time: 0,
    phase: 'placement',
    units: [...roster, ...enemies],
    events: [],
    counters: {},
    rng: makeRng(seed),
    nextEnemyUid,
    spawnCounts: stage.spawners.map(() => 0),
    projectiles: [],
    nextProjectileId: 1,
  };
}

/**
 * そこへ配置できるか。配置の実行とドラッグプレビューの赤表示が必ずこの1本を通る。
 * 別々に書くと「プレビューは置けそうに見えるのに離すと失敗する」がすぐ起きる
 */
export function canPlaceAt(stage: StageDef, grid: Grid, pos: Vec2): boolean {
  if (!isWalkableAt(grid, pos)) return false;
  return pos.y >= stage.placement.minY;
}

export function placeUnit(state: BattleState, uid: string, pos: Vec2): boolean {
  if (!canPlaceAt(state.stage, state.grid, pos)) return false;
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
  state.projectiles = [];
}
