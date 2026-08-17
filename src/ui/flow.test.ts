import { describe, expect, it } from 'vitest';
import { applyStageClear, isStageUnlocked } from './flow';
import { newSave } from '../save/save';
import { STAGES } from '../content/stages';
import type { CharBattleStats, CharId } from '../core/types';

const stats = (over: Partial<Record<CharId, Partial<CharBattleStats>>> = {}) => {
  const base: CharBattleStats = { defeats: 0, skillUses: 0, neraiuchiKills: 0, kakenukeruHits: 0, bondSupports: 0 };
  return {
    roran: { ...base, ...over.roran }, ines: { ...base, ...over.ines },
    mist: { ...base, ...over.mist }, gau: { ...base, ...over.gau },
  } as Record<CharId, CharBattleStats>;
};

describe('isStageUnlocked', () => {
  it('最初はステージ 1 だけ開いている', () => {
    const s = newSave();
    expect(isStageUnlocked(s, 0)).toBe(true);
    expect(isStageUnlocked(s, 1)).toBe(false);
  });

  it('1 つクリアすると次が開く', () => {
    const s = { ...newSave(), clearedStages: 1 };
    expect(isStageUnlocked(s, 1)).toBe(true);
    expect(isStageUnlocked(s, 2)).toBe(false);
  });

  it('範囲外の index は false', () => {
    expect(isStageUnlocked({ ...newSave(), clearedStages: 3 }, STAGES.length)).toBe(false);
    expect(isStageUnlocked(newSave(), -1)).toBe(false);
  });
});

describe('applyStageClear', () => {
  it('クリア済みステージ数が増える', () => {
    const r = applyStageClear(newSave(), 0, stats());
    expect(r.save.clearedStages).toBe(1);
  });

  it('すでにクリア済みのステージを遊び直しても数は減らない', () => {
    const save = { ...newSave(), clearedStages: 3 };
    const r = applyStageClear(save, 0, stats());
    expect(r.save.clearedStages).toBe(3);
  });

  it('全員が経験値を得る（撃破数ぶん上乗せ）', () => {
    const r = applyStageClear(newSave(), 0, stats({ roran: { defeats: 4 } }));
    const roran = r.gains.find((g) => g.id === 'roran')!;
    const mist = r.gains.find((g) => g.id === 'mist')!;
    expect(roran.gained).toBe(40);
    expect(mist.gained).toBe(20);
  });

  it('必要量に届けばレベルが上がる', () => {
    const r = applyStageClear(newSave(), 0, stats({ ines: { defeats: 2 } }));
    const ines = r.gains.find((g) => g.id === 'ines')!;
    expect(ines.after.level).toBe(2);
    expect(ines.leveledUp).toBe(true);
    expect(r.save.chars.ines.level).toBe(2);
  });

  it('届かなければレベルは据え置き', () => {
    const r = applyStageClear(newSave(), 0, stats());
    const gau = r.gains.find((g) => g.id === 'gau')!;
    expect(gau.after).toEqual({ level: 1, xp: 20 });
    expect(gau.leveledUp).toBe(false);
  });

  it('新しく取った称号だけ newTitles に入る', () => {
    const first = applyStageClear(newSave(), 0, stats({ roran: { skillUses: 5 } }));
    expect(first.newTitles).toEqual(['gamanzuyoi']);
    expect(first.save.titles).toEqual(['gamanzuyoi']);

    const second = applyStageClear(first.save, 1, stats({ roran: { skillUses: 1 } }));
    expect(second.newTitles).toEqual([]);
    expect(second.save.titles).toEqual(['gamanzuyoi']);
  });

  it('カウンタが積み上がる', () => {
    const first = applyStageClear(newSave(), 0, stats({ roran: { skillUses: 2 } }));
    const second = applyStageClear(first.save, 1, stats({ roran: { skillUses: 3 } }));
    expect(second.save.counters.funbaruUses).toBe(5);
    expect(second.newTitles).toEqual(['gamanzuyoi']);
  });

  it('元のセーブを書き換えない', () => {
    const save = newSave();
    applyStageClear(save, 0, stats({ roran: { defeats: 10 } }));
    expect(save.clearedStages).toBe(0);
    expect(save.chars.roran).toEqual({ level: 1, xp: 0 });
  });
});
