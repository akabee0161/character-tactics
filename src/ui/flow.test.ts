import { describe, expect, it } from 'vitest';
import { applyStageClear, isStageUnlocked } from './flow';
import { newSave } from '../save/save';
import { COUNTER_DEFEAT_BY } from '../core/counters';
import { testRegistry } from '../core/testing';
import type { BattleState } from '../core/types';

/** どのキャラの スキルが どの称号カウンタに つながるかは titles.json の きめごとなので、
 * テストの ぶんだけ 対応表を もつ */
const SKILL_OF: Record<string, string> = {
  roran: 'funbaru', ines: 'neraiuchi', mist: 'omajinai', gau: 'kakenukeru',
};

type BattleOver = Partial<Record<string, { defeats?: number; skillUses?: number }>>;

/** applyStageClear が読む counters だけを もった かんいな BattleState */
const battleWith = (over: BattleOver = {}): BattleState => {
  const counters: Record<string, number> = {};
  for (const [id, v] of Object.entries(over)) {
    if (!v) continue;
    if (v.defeats) counters[COUNTER_DEFEAT_BY(id)] = v.defeats;
    if (v.skillUses) counters[`skill:${SKILL_OF[id]}:uses`] = v.skillUses;
  }
  return { counters } as unknown as BattleState;
};

describe('isStageUnlocked', () => {
  const reg = testRegistry();

  it('さいしょの ステージは いつでも あいている', () => {
    expect(isStageUnlocked(reg, { ...newSave(reg), clearedStageIds: [] }, 0)).toBe(true);
  });

  it('1つ まえを クリアしていれば あく', () => {
    const save = { ...newSave(reg), clearedStageIds: ['stage1'] };
    expect(isStageUnlocked(reg, save, 1)).toBe(true);
  });

  it('1つ まえを クリアしていなければ あかない', () => {
    expect(isStageUnlocked(reg, newSave(reg), 1)).toBe(false);
  });

  it('とびこえた さきは あかない', () => {
    const save = { ...newSave(reg), clearedStageIds: ['stage1'] };
    expect(isStageUnlocked(reg, save, 2)).toBe(false);
  });

  it('はんいがいは false', () => {
    expect(isStageUnlocked(reg, newSave(reg), -1)).toBe(false);
    expect(isStageUnlocked(reg, newSave(reg), 99)).toBe(false);
  });
});

describe('applyStageClear', () => {
  const reg = testRegistry();

  it('クリア済みステージ id が増える', () => {
    const r = applyStageClear(reg, newSave(reg), 'stage1', battleWith());
    expect(r.save.clearedStageIds).toEqual(['stage1']);
  });

  it('すでにクリア済みのステージを遊び直しても増えない', () => {
    const save = { ...newSave(reg), clearedStageIds: ['stage1', 'stage2', 'stage3'] };
    const r = applyStageClear(reg, save, 'stage1', battleWith());
    expect(r.save.clearedStageIds).toEqual(['stage1', 'stage2', 'stage3']);
  });

  it('全員が経験値を得る（撃破数ぶん上乗せ）', () => {
    const r = applyStageClear(reg, newSave(reg), 'stage1', battleWith({ roran: { defeats: 4 } }));
    const roran = r.gains.find((g) => g.id === 'roran')!;
    const mist = r.gains.find((g) => g.id === 'mist')!;
    expect(roran.gained).toBe(40);
    expect(mist.gained).toBe(20);
  });

  it('必要量に届けばレベルが上がる', () => {
    const r = applyStageClear(reg, newSave(reg), 'stage1', battleWith({ ines: { defeats: 2 } }));
    const ines = r.gains.find((g) => g.id === 'ines')!;
    expect(ines.after.level).toBe(2);
    expect(ines.leveledUp).toBe(true);
    expect(r.save.units.ines!.level).toBe(2);
  });

  it('届かなければレベルは据え置き', () => {
    const r = applyStageClear(reg, newSave(reg), 'stage1', battleWith());
    const gau = r.gains.find((g) => g.id === 'gau')!;
    expect(gau.after).toEqual({ level: 1, xp: 20 });
    expect(gau.leveledUp).toBe(false);
  });

  it('新しく取った称号だけ newTitles に入る', () => {
    const first = applyStageClear(reg, newSave(reg), 'stage1', battleWith({ roran: { skillUses: 5 } }));
    expect(first.newTitles).toEqual(['gamanzuyoi']);
    expect(first.save.titles).toEqual(['gamanzuyoi']);

    const second = applyStageClear(reg, first.save, 'stage2', battleWith({ roran: { skillUses: 1 } }));
    expect(second.newTitles).toEqual([]);
    expect(second.save.titles).toEqual(['gamanzuyoi']);
  });

  it('カウンタが積み上がる', () => {
    const first = applyStageClear(reg, newSave(reg), 'stage1', battleWith({ roran: { skillUses: 2 } }));
    const second = applyStageClear(reg, first.save, 'stage2', battleWith({ roran: { skillUses: 3 } }));
    expect(second.save.counters['skill:funbaru:uses']).toBe(5);
    expect(second.newTitles).toEqual(['gamanzuyoi']);
  });

  it('元のセーブを書き換えない', () => {
    const save = newSave(reg);
    applyStageClear(reg, save, 'stage1', battleWith({ roran: { defeats: 10 } }));
    expect(save.clearedStageIds).toEqual([]);
    expect(save.units.roran).toEqual({ level: 1, xp: 0 });
  });
});
