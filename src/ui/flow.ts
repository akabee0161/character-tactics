import { STAGES } from '../content/stages';
import { mergeCounters, COUNTER_DEFEAT_BY } from '../core/counters';
import { applyXp, earnedTitles, xpGain } from '../core/progress';
import type { Registry } from '../engine/registry';
import type { BattleState, CharProgress } from '../core/types';
import type { SaveData } from '../save/save';

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
  reg: Registry,
  save: SaveData,
  stageIndex: number,
  battle: BattleState,
): StageResult {
  const chars: Record<string, CharProgress> = { ...save.chars };
  const gains: XpGain[] = [];

  for (const defId of reg.units.keys()) {
    const before = save.chars[defId] ?? { level: 1, xp: 0 };
    const gained = xpGain(battle.counters[COUNTER_DEFEAT_BY(defId)] ?? 0);
    const after = applyXp(before, gained);
    chars[defId] = after;
    gains.push({ id: defId, before, after, gained, leveledUp: after.level > before.level });
  }

  const counters = mergeCounters(save.counters, battle.counters, reg.titles);
  const allTitles = earnedTitles(reg, counters);
  const newTitles = allTitles.filter((t) => !save.titles.includes(t));

  return {
    save: {
      ...save,
      clearedStages: Math.max(save.clearedStages, stageIndex + 1),
      chars, counters, titles: allTitles,
    },
    gains, newTitles,
  };
}
