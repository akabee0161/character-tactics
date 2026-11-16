import type { GrowthDef } from '../engine/schema';
import type { CharProgress } from './types';

export function xpToNext(level: number, xpPerLevel: number): number {
  return level * xpPerLevel;
}

export function applyXp(p: CharProgress, gained: number, growth: GrowthDef): CharProgress {
  let level = p.level;
  let xp = p.xp;
  if (level >= growth.maxLevel) return { ...p, level, xp };

  xp += gained;
  while (level < growth.maxLevel && xp >= xpToNext(level, growth.xpPerLevel)) {
    xp -= xpToNext(level, growth.xpPerLevel);
    level += 1;
  }
  if (level >= growth.maxLevel) xp = 0;
  return { ...p, level, xp };
}

