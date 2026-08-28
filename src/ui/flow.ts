import { ALL_CHAR_IDS } from '../content/characters';
import { STAGES } from '../content/stages';
import { accumulateCounters, applyXp, earnedTitles, xpGain } from '../core/progress';
import type { SaveData } from '../save/save';
import type { CharBattleStats, CharProgress } from '../core/types';

export function isStageUnlocked(save: SaveData, index: number): boolean {
  if (index < 0 || index >= STAGES.length) return false;
  return index <= save.clearedStages;
}

export type XpGain = {
  id: string;
  before: CharProgress;
  after: CharProgress;
  gained: number;
  leveledUp: boolean;
};

export type StageResult = { save: SaveData; gains: XpGain[]; newTitles: string[] };

export function applyStageClear(
  save: SaveData,
  stageIndex: number,
  stats: Record<string, CharBattleStats>,
): StageResult {
  const chars = {} as Record<string, CharProgress>;
  const gains: XpGain[] = [];

  for (const id of ALL_CHAR_IDS) {
    const before = save.chars[id]!;
    const gained = xpGain(stats[id]!.defeats);
    const after = applyXp(before, gained);
    chars[id] = after;
    gains.push({ id, before, after, gained, leveledUp: after.level > before.level });
  }

  const counters = accumulateCounters(save.counters, stats);
  const allTitles = earnedTitles(counters);
  const newTitles = allTitles.filter((t) => !save.titles.includes(t));

  return {
    save: {
      ...save,
      clearedStages: Math.max(save.clearedStages, stageIndex + 1),
      chars,
      counters,
      titles: allTitles,
    },
    gains,
    newTitles,
  };
}
