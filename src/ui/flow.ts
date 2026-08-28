import { mergeCounters, COUNTER_DEFEAT_BY } from '../core/counters';
import { applyXp, earnedTitles, xpGain } from '../core/progress';
import type { Registry } from '../engine/registry';
import type { BattleState, CharProgress } from '../core/types';
import type { SaveData } from '../save/save';

export function isStageUnlocked(reg: Registry, save: SaveData, index: number): boolean {
  if (index < 0 || index >= reg.stages.length) return false;
  if (index === 0) return true;
  const prev = reg.stages[index - 1];
  return prev !== undefined && save.clearedStageIds.includes(prev.id);
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
  stageId: string,
  battle: BattleState,
): StageResult {
  const units: Record<string, CharProgress> = { ...save.units };
  const gains: XpGain[] = [];

  for (const defId of reg.units.keys()) {
    const before = save.units[defId] ?? { level: 1, xp: 0 };
    const gained = xpGain(battle.counters[COUNTER_DEFEAT_BY(defId)] ?? 0);
    const after = applyXp(before, gained);
    units[defId] = after;
    gains.push({ id: defId, before, after, gained, leveledUp: after.level > before.level });
  }

  const counters = mergeCounters(save.counters, battle.counters, reg.titles);
  const allTitles = earnedTitles(reg, counters);
  const newTitles = allTitles.filter((t) => !save.titles.includes(t));

  return {
    save: {
      ...save,
      clearedStageIds: save.clearedStageIds.includes(stageId)
        ? save.clearedStageIds
        : [...save.clearedStageIds, stageId],
      units, counters, titles: allTitles,
    },
    gains, newTitles,
  };
}
