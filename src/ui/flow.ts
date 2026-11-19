import { applyXp } from '../core/progress';
import type { Registry } from '../engine/registry';
import type { StageDef } from '../engine/schema';
import type { BattleState,CharProgress, StatBonus } from '../core/types';
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

/**
 * 導入の会話の「とばす」を出せるか。既読で、かつ開始時の加入の会話（joins）がすべて読み終わっている（仲間になっている）こと。
 * 未読の加入の会話は導入につながっているので、飛ばすと仲間の加入を見ずに済んでしまう
 */
export function canSkipIntro(save: SaveData, stage: StageDef): boolean {
  return hasReadIntro(save, stage.id) && stage.joins.every((j) => save.members.includes(j.unitId));
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
  /** このステージで仲間に加わった（リザルトで「仲間に 加わった！」と出す） */
  joined: boolean;
};

function hasBonus(b: StatBonus): boolean {
  return b.maxHp > 0 || b.power > 0 || b.guard > 0 || b.speed > 0 || b.resist > 0;
}

/** 今回のクリアの時間と、一番速い記録。best は書き換えた後の値、isRecord は初めてか前より速いとき */
export type ClearRecord = { seconds: number; best: number; prevBest: number | null; isRecord: boolean };

export type StageResult = { save: SaveData; gains: XpGain[]; clear: ClearRecord };

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
    const base: CharProgress = hasBonus(u.statBonus)
      ? { level: u.level, xp: u.xp, bonus: { ...u.statBonus } }
      : { level: u.level, xp: u.xp };
    const after = u.retired ? base : applyXp(base, reg.growth.clearXp, reg.growth);
    units[u.defId] = after;
    gains.push({ id: u.defId, before, after, leveledUp: after.level > before.level, joined: battle.joined.includes(u.defId) });
  }

  // 場に出なかった仲間にも、加わったときのレベルで記録を作る（無いとレベル 1 に戻る）。
  // セーブには未加入の仲間も初期値（レベル 1・経験値 0）で入っているので、初期値のままなら書き換える
  for (const b of battle.benchedRecruits) {
    const cur = units[b.defId];
    if (!cur || (cur.level === 1 && cur.xp === 0 && cur.bonus === undefined)) {
      units[b.defId] = { level: b.level, xp: 0 };
    }
  }

  // 場に出なかった加入者のリザルト表示。リザルトの枠は 8 件なので、加入の表示を先頭に並べて切り捨てられないようにする
  for (const b of battle.benchedRecruits) {
    const rec = { level: b.level, xp: 0 };
    gains.unshift({ id: b.defId, before: rec, after: { ...rec }, leveledUp: false, joined: true });
  }

  // 一番速い記録。勝ったときだけここを通るので、負けた回の時間は残らない
  const seconds = battle.time;
  const prevBest = save.bestTimes[stageId] ?? null;
  const isRecord = prevBest === null || seconds < prevBest;
  const best = isRecord ? seconds : prevBest;

  return {
    clear: { seconds, best, prevBest, isRecord },
    save: {
      ...save,
      bestTimes: isRecord ? { ...save.bestTimes, [stageId]: seconds } : save.bestTimes,
      clearedStageIds: save.clearedStageIds.includes(stageId)
        ? save.clearedStageIds
        : [...save.clearedStageIds, stageId],
      units,
      members: [...save.members, ...battle.joined.filter((id) => !save.members.includes(id))],
      claimed: [...save.claimed, ...battle.claimed.filter((id) => !save.claimed.includes(id))],
    },
    gains,
  };
}
