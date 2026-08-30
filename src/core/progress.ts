import type { Registry } from '../engine/registry';
import type { TitleDef } from '../engine/schema';
import type { CharProgress } from './types';

export const MAX_LEVEL = 5;
const XP_PER_LEVEL = 30;

export function xpToNext(level: number): number {
  return level * XP_PER_LEVEL;
}

export function applyXp(p: CharProgress, gained: number): CharProgress {
  let level = p.level;
  let xp = p.xp;
  if (level >= MAX_LEVEL) return { level, xp };

  xp += gained;
  while (level < MAX_LEVEL && xp >= xpToNext(level)) {
    xp -= xpToNext(level);
    level += 1;
  }
  if (level >= MAX_LEVEL) xp = 0;
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
