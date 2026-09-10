import { mergeCounters } from '../core/counters';
import { applyXp, earnedTitles } from '../core/progress';
import type { Registry } from '../engine/registry';
import type { BattleState, CharProgress } from '../core/types';
import type { SaveData } from '../save/save';

export function isStageUnlocked(reg: Registry, save: SaveData, index: number): boolean {
  if (index < 0 || index >= reg.stages.length) return false;
  if (index === 0) return true;
  const prev = reg.stages[index - 1];
  return prev !== undefined && save.clearedStageIds.includes(prev.id);
}

export function hasReadIntro(save: SaveData, stageId: string): boolean {
  return save.readIntroStageIds.includes(stageId);
}

/** 変化がなければ同じ参照を返す。呼び出し側が無駄な writeSave をしなくて済む */
export function markIntroRead(save: SaveData, stageId: string): SaveData {
  if (save.readIntroStageIds.includes(stageId)) return save;
  return { ...save, readIntroStageIds: [...save.readIntroStageIds, stageId] };
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

  // 経験値はステージ中に確定済み。ここでやるのは確定した進行の書き戻しと、
  // 退場していない仲間へのクリアボーナス
  for (const u of battle.units) {
    if (u.side !== 'player') continue;
    const before = save.units[u.defId] ?? { level: 1, xp: 0 };
    const after = u.retired
      ? { level: u.level, xp: u.xp }
      : applyXp({ level: u.level, xp: u.xp }, reg.growth.clearXp, reg.growth);
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
