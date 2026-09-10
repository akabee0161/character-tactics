import type { Registry } from '../engine/registry';
import type { GrowthDef, TitleDef } from '../engine/schema';
import type { CharProgress } from './types';

export function xpToNext(level: number, xpPerLevel: number): number {
  return level * xpPerLevel;
}

export function applyXp(p: CharProgress, gained: number, growth: GrowthDef): CharProgress {
  let level = p.level;
  let xp = p.xp;
  if (level >= growth.maxLevel) return { level, xp };

  xp += gained;
  while (level < growth.maxLevel && xp >= xpToNext(level, growth.xpPerLevel)) {
    xp -= xpToNext(level, growth.xpPerLevel);
    level += 1;
  }
  if (level >= growth.maxLevel) xp = 0;
  return { level, xp };
}

export function earnedTitles(reg: Registry, counters: Record<string, number>): string[] {
  return reg.titles.filter((t) => (counters[t.counter] ?? 0) >= t.threshold).map((t) => t.id);
}

/** そのユニットが表示すべき称号。owner が一致するものと、全員共通（owner === null）のもの */
export function titlesOf(reg: Registry, owned: string[], defId: string): TitleDef[] {
  const set = new Set(owned);
  return reg.titles.filter((t) => set.has(t.id) && (t.owner === defId || t.owner === null));
}
