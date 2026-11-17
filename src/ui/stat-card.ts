import { skillSummary } from '../core/skill-summary';
import { statsForLevel } from '../core/state';
import type { AttackKind, CharProgress, StatKey, Unit, UnitStats } from '../core/types';
import { lookupDef } from '../engine/registry';
import type { Registry } from '../engine/registry';
import type { EnemyDef, StageDef, UnitDef } from '../engine/schema';
import type { SaveData } from '../save/save';
import type { XpGain } from './flow';

/** 札に並べる能力の順 */
export const STAT_ORDER: readonly StatKey[] = ['maxHp', 'power', 'guard', 'resist', 'speed'];
export const STAT_LABEL: Record<StatKey, string> = {
  maxHp: 'HP', power: '攻撃力', guard: '守備', resist: '魔法防御', speed: '速さ',
};
/** 棒の長さの上限。仲間と敵で共通（同じ物差しで比べられるように） */
export const BAR_MAX: Record<StatKey, number> = { maxHp: 40, power: 18, guard: 8, resist: 12, speed: 100 };
export const KIND_LABEL: Record<AttackKind, string> = { melee: '近接', bow: '弓', magic: '魔法' };
/** 攻撃の種類の色（札と、ステージ選択の仲間一覧の印で共通） */
export const KIND_COLOR: Record<AttackKind, string> = { melee: '#e8c48a', bow: '#9fd38a', magic: '#c8a2ff' };
export const KIND_NOTE: Record<AttackKind, string> = {
  melee: '相手の 守備で 減る', bow: '相手の 守備で 減る', magic: '相手の 魔法防御で 減る',
};

export type StatCard = {
  defId: string;
  name: string;
  /** 仲間だけ。敵は null */
  level: number | null;
  /** 敵だけ。ステージに出る数。仲間は null */
  count: number | null;
  role: string;
  attack: AttackKind;
  range: number;
  /** ダメージがどちらの守りで減るか。斧（守備を無視）は別の文 */
  note: string;
  stats: UnitStats;
  /** レベルアップの札だけ。上がる前の値と見出しのレベル */
  before: { level: number; stats: UnitStats } | null;
  skill: { label: string; summary: string } | null;
  traits: string[];
  /** レベルアップのカードだけ。その仲間のレベルアップのセリフ。無ければ null */
  line: string | null;
};

export type StageEnemy = { defId: string; name: string; count: number };

function defOf(reg: Registry, defId: string): UnitDef | EnemyDef {
  const def = lookupDef(reg, defId);
  if (!def) throw new Error(`札を 作れない: 定義が ない id ${defId}`);
  return def;
}

function skillOf(reg: Registry, skillId: string | null): StatCard['skill'] {
  if (skillId === null) return null;
  const skill = reg.skills.get(skillId);
  return skill ? { label: skill.label, summary: skillSummary(skill) } : null;
}

function traitsOf(flying: boolean, ignoresGuard: boolean, bowDamageCap: number | null): string[] {
  const out: string[] = [];
  if (flying) out.push('飛行: 水や 壁の 上を 飛んで 越える');
  if (ignoresGuard) out.push('斧: 相手の 守備を 無視して 攻撃する');
  if (bowDamageCap !== null) out.push(`盾: 矢の ダメージは ${bowDamageCap} まで`);
  return out;
}

function capOf(def: UnitDef | EnemyDef): number | null {
  return 'bowDamageCap' in def ? def.bowDamageCap : null;
}

function baseCard(def: UnitDef | EnemyDef, stats: UnitStats, skill: StatCard['skill']): StatCard {
  return {
    defId: def.id, name: def.name, level: null, count: null, role: def.role,
    attack: def.attack, range: def.range, note: noteOf(def.attack, def.ignoresGuard), stats, before: null, skill,
    traits: traitsOf(def.flying === true, def.ignoresGuard, capOf(def)), line: null,
  };
}

function progressStats(reg: Registry, def: UnitDef | EnemyDef, p: CharProgress): UnitStats {
  return statsForLevel(def, p.level, p.bonus);
}

/** ステージ選択の仲間の札。セーブのレベルと、セーブに残った能力の加算から出す */
export function allyCardFromSave(reg: Registry, save: SaveData, defId: string): StatCard {
  const def = defOf(reg, defId);
  const p = save.units[defId] ?? { level: 1, xp: 0 };
  return { ...baseCard(def, progressStats(reg, def, p), skillOf(reg, def.skillId)), level: p.level };
}

/** 配置の場面の札。場に出ているユニットの今の値 */
export function cardFromUnit(reg: Registry, unit: Unit, count: number | null): StatCard {
  const def = defOf(reg, unit.defId);
  const card = baseCard(def, {
    maxHp: unit.maxHp, power: unit.power, guard: unit.guard, resist: unit.resist, speed: unit.speed,
  }, skillOf(reg, unit.skillId));
  return {
    ...card,
    level: unit.side === 'player' ? unit.level : null,
    count,
    note: noteOf(unit.attack, unit.ignoresGuard),
    traits: traitsOf(unit.flying, unit.ignoresGuard, unit.bowDamageCap),
  };
}

/** 敵の札。敵は育たないので定義の値のまま */
export function enemyCard(reg: Registry, defId: string, count: number): StatCard {
  const def = defOf(reg, defId);
  const stats = statsForLevel(def, 1);
  return { ...baseCard(def, stats, skillOf(reg, def.skillId)), count };
}

/** ステージに出る敵を名前ごとにまとめる。並びは最初に出てきた順 */
export function stageEnemies(reg: Registry, stage: StageDef): StageEnemy[] {
  const rows = new Map<string, StageEnemy>();
  const add = (defId: string, n: number): void => {
    const name = defOf(reg, defId).name;
    const row = rows.get(name);
    if (row) row.count += n;
    else rows.set(name, { defId, name, count: n });
  };
  for (const e of stage.enemies) add(e.defId, 1);
  for (const s of stage.spawners) add(s.defId, s.total);
  for (const p of stage.persuasions) add(p.foeId, 1);
  return [...rows.values()];
}

/** レベルアップの札。上がる前と後を持つ */
export function cardFromGain(reg: Registry, gain: XpGain): StatCard {
  const def = defOf(reg, gain.id);
  return {
    ...baseCard(def, progressStats(reg, def, gain.after), skillOf(reg, def.skillId)),
    level: gain.after.level,
    before: { level: gain.before.level, stats: progressStats(reg, def, gain.before) },
  };
}

/** 上がった能力だけを、札の並びで返す */
export function statGains(before: UnitStats, after: UnitStats): { key: StatKey; delta: number }[] {
  const out: { key: StatKey; delta: number }[] = [];
  for (const key of STAT_ORDER) {
    const delta = after[key] - before[key];
    if (delta > 0) out.push({ key, delta });
  }
  return out;
}

/** 棒の長さ（0〜1）。上限で止める */
export function barRatio(key: StatKey, value: number): number {
  return Math.min(1, Math.max(0, value / BAR_MAX[key]));
}

/** 定義と能力値から札を組む（レベル・数・前後は呼び出し側が足す） */
export function cardFromDef(reg: Registry, defId: string, stats: UnitStats): StatCard {
  const def = defOf(reg, defId);
  return baseCard(def, stats, skillOf(reg, def.skillId));
}

/** 攻撃がどちらの守りで減るか。斧は通常の近接・弓で守備を無視するので、守備で減るとは書かない */
function noteOf(attack: AttackKind, ignoresGuard: boolean): string {
  return ignoresGuard && attack !== 'magic' ? '相手の 守備に 関係なく 減る' : KIND_NOTE[attack];
}
