import { mergeCounters } from '../core/counters';
import { earnedTitles } from '../core/progress';
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

  // 経験値はステージ中に確定済み。ここでやるのは確定した進行の書き戻しだけ
  for (const u of battle.units) {
    if (u.side !== 'player') continue;
    const before = save.units[u.defId] ?? { level: 1, xp: 0 };
    const after = { level: u.level, xp: u.xp };
    units[u.defId] = after;
    gains.push({ id: u.defId, before, after, leveledUp: after.level > before.level });
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
