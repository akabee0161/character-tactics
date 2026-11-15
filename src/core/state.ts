import { cellCenter, fitsAt, makeGrid } from './field';
import { MAX_PARTY } from './constants';
import { partyIds } from './party';
import { makeFieldCache } from './fields';
import { makeRng } from './rng';
import type { Registry } from '../engine/registry';
import type { AiDef, EnemyDef, GrowthDef, StageDef, UnitDef } from '../engine/schema';
import { NO_BONUS } from './types';
import type { BattleState, Grid, PartyProgress, StatBonus, Unit, Vec2 } from './types';

/**
 * レベルからステータスを出す。HP は毎レベル、攻撃力は levelsPerPower レベルごとに上がる。
 * 攻撃力を小数にしないのは computeDamage が整数前提で組まれているため
 */
export function statsForLevel(
  def: UnitDef | EnemyDef, level: number, growth: GrowthDef, bonus: StatBonus = NO_BONUS,
): { maxHp: number; power: number; guard: number; speed: number; resist: number } {
  const steps = Math.max(0, level - 1);
  return {
    maxHp: def.maxHp + steps * growth.hpPerLevel + bonus.maxHp,
    power: def.power + Math.floor(steps / growth.levelsPerPower) + bonus.power,
    guard: def.guard + bonus.guard,
    speed: def.speed + bonus.speed,
    resist: def.resist + bonus.resist,
  };
}

/** 攻撃モーションの最後のコマ（振り下ろし）が出るまでの秒数。シートが無いユニットは即時 */
export function windupOf(def: UnitDef | EnemyDef): number {
  const sheet = def.sprites.map;
  return sheet === null ? 0 : (sheet.attack.frames - 1) / sheet.attack.fps;
}

type MakeUnitArgs = {
  uid: string;
  def: UnitDef | EnemyDef;
  side: 'player' | 'enemy';
  controller: 'player' | 'ai';
  pos: Vec2;
  level: number;
  xp: number;
  bonus?: StatBonus;
  ai: AiDef | null;
  growth: GrowthDef;
};

export function makeUnit(a: MakeUnitArgs): Unit {
  const statBonus = { ...(a.bonus ?? NO_BONUS) };
  const { maxHp, power, guard, speed, resist } = statsForLevel(a.def, a.level, a.growth, statBonus);
  const enemyDef = 'bowDamageCap' in a.def ? a.def : null;
  return {
    uid: a.uid,
    defId: a.def.id,
    kindId: enemyDef?.kind ?? a.def.id,
    side: a.side,
    controller: a.controller,
    combat: a.def.combat,
    pos: { ...a.pos },
    hp: maxHp, maxHp, power,
    guard,
    resist,
    ignoresGuard: a.def.ignoresGuard,
    attack: a.def.attack,
    range: a.def.range,
    attackInterval: a.def.attackInterval,
    speed,
    bowDamageCap: enemyDef?.bowDamageCap ?? null,
    skillId: a.def.skillId,
    level: a.level, xp: a.xp,
    statBonus, stagePower: 0, cheerUntil: -1, cheerPower: 0, wardUntil: -1, wardResist: 0, flying: a.def.flying ?? false, tauntUntil: -1, persuasion: null,
    goalPos: null, goalField: null, engagedWith: null, closingOn: null, attackCooldown: 0, retired: false,
    windup: windupOf(a.def), pendingHit: null,
    ai: a.ai === null
      ? null
      : { def: a.ai, mode: 'idle', targetUid: null, home: { ...a.pos }, spottedAt: null },
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

const START_SPACING = 32;

/**
 * 出撃する味方の開始位置。先頭から placement.starts を使い、足りない分は
 * 配置できるマス（minY 以降）の中心を starts[0] に近い順に見て、選んだ位置から 32px 以上離れたものを足す。
 * それでも足りなければ starts を繰り返す
 */
export function startPositions(stage: StageDef, grid: Grid, count: number): Vec2[] {
  const starts = stage.placement.starts;
  const out: Vec2[] = starts.slice(0, count).map((p) => ({ ...p }));
  if (out.length < count) {
    const anchor = starts[0]!;
    const cells: Vec2[] = [];
    for (let i = 0; i < grid.cols * grid.rows; i++) {
      const c = cellCenter(grid, i);
      if (c.y >= stage.placement.minY && fitsAt(grid, c)) cells.push(c);
    }
    cells.sort((a, b) => Math.hypot(a.x - anchor.x, a.y - anchor.y) - Math.hypot(b.x - anchor.x, b.y - anchor.y));
    for (const c of cells) {
      if (out.length >= count) break;
      if (out.every((p) => Math.hypot(p.x - c.x, p.y - c.y) >= START_SPACING)) out.push(c);
    }
  }
  for (let i = 0; out.length < count; i++) out.push({ ...starts[i % starts.length]! });
  return out;
}

export function createBattleState(
  reg: Registry,
  stage: StageDef,
  party: PartyProgress,
  seed: number,
): BattleState {
  const grid = makeGrid(stage.cell, stage.mapRows, stage.legend);

  // 場に出る味方。並びは roster、続けて加わった仲間、続けて開始時の加入。
  // 8 人を超えるときに誰を残すかは、開始時の加入 → roster → 加わった順（members）の優先で決める
  type Entry = { defId: string; level: number; xp: number; bonus?: StatBonus };
  const progressOf = (defId: string): Entry => ({
    defId, level: party.units[defId]?.level ?? 1, xp: party.units[defId]?.xp ?? 0, bonus: party.units[defId]?.bonus,
  });
  for (const defId of stage.roster) {
    if (!reg.units.has(defId)) throw new Error(`roster に しらない ユニット: ${defId}`);
  }
  // roster に無いのに出るのは、加わった仲間（members）だけ。加入しうる仲間でない units は roster が決める
  const memberIds = partyIds(reg, party.members).filter((id) => party.members.includes(id));
  const joined: string[] = [];
  const joinEntries: Entry[] = [];
  for (const j of stage.joins) {
    if (party.members.includes(j.unitId) || stage.roster.includes(j.unitId) || joined.includes(j.unitId)) continue;
    if (!reg.units.has(j.unitId)) throw new Error(`joins に しらない ユニット: ${j.unitId}`);
    // 場に出られなくても、加入の記録は必ず残す
    joined.push(j.unitId);
    joinEntries.push({ defId: j.unitId, level: j.level, xp: 0 });
  }
  const inOrder: Entry[] = [];
  const seen = new Set<string>();
  const push = (e: Entry): void => {
    if (seen.has(e.defId)) return;
    seen.add(e.defId);
    inOrder.push(e);
  };
  for (const defId of stage.roster) push(progressOf(defId));
  for (const defId of memberIds) push(progressOf(defId));
  for (const e of joinEntries) push(e);
  const priority = [
    ...joinEntries.map((e) => e.defId), ...stage.roster, ...memberIds,
  ].filter((id, i, all) => all.indexOf(id) === i).slice(0, MAX_PARTY);
  const entries = inOrder.filter((e) => priority.includes(e.defId));

  const starts = startPositions(stage, grid, entries.length);
  const roster = entries.map((e, i) => makeUnit({
    uid: `p${i + 1}`, def: reg.units.get(e.defId)!, side: 'player', controller: 'player', pos: starts[i]!,
    level: e.level, xp: e.xp, bonus: e.bonus, ai: null, growth: reg.growth,
  }));

  let nextEnemyUid = 1;
  const enemies = stage.enemies.map((placement) =>
    makeEnemyUnit(reg, `e${nextEnemyUid++}`, placement.defId, placement.pos, placement.ai));
  stage.persuasions.forEach((p, i) => {
    if (party.members.includes(p.unitId)) return;
    const foe = makeEnemyUnit(reg, `e${nextEnemyUid++}`, p.foeId, p.pos, p.ai);
    foe.persuasion = i;
    enemies.push(foe);
  });

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
    rng: makeRng(seed),
    nextEnemyUid,
    spawnCounts: stage.spawners.map(() => 0),
    projectiles: [],
    nextProjectileId: 1,
    joined,
    benchedRecruits: [],
    claimed: [],
    visited: [],
    pendingRecruit: null,
    nextPlayerUid: roster.length + 1,
    claimedBefore: new Set(party.claimed),
  };
}

/**
 * そこへ配置できるか。配置の実行とドラッグプレビューの赤表示が必ずこの1本を通る。
 * 別々に書くと「プレビューは置けそうに見えるのに離すと失敗する」がすぐ起きる
 */
export function canPlaceAt(stage: StageDef, grid: Grid, pos: Vec2): boolean {
  if (!fitsAt(grid, pos)) return false;
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
