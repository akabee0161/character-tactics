import { describe, expect, it } from 'vitest';
import { applyStageClear, isStageUnlocked } from './flow';
import { newSave } from '../save/save';
import { testRegistry } from '../core/testing';
import type { BattleState } from '../core/types';

/** どのキャラの スキルが どの称号カウンタに つながるかは titles.json の きめごとなので、
 * テストの ぶんだけ 対応表を もつ */
const SKILL_OF: Record<string, string> = {
  roran: 'funbaru', ines: 'neraiuchi', mist: 'omajinai', gau: 'kakenukeru',
};

type UnitOver = { level: number; xp: number };
type BattleOver = {
  units?: Partial<Record<string, UnitOver>>;
  skillUses?: Partial<Record<string, number>>;
};

/** applyStageClear が読む units（player ぶんの level/xp）と counters だけを もった かんいな BattleState */
const battleWith = (over: BattleOver = {}): BattleState => {
  const counters: Record<string, number> = {};
  for (const [id, uses] of Object.entries(over.skillUses ?? {})) {
    if (!uses) continue;
    counters[`skill:${SKILL_OF[id]}:uses`] = uses;
  }
  const units = Object.entries(over.units ?? {}).map(([defId, p]) => ({
    side: 'player' as const,
    defId,
    level: p!.level,
    xp: p!.xp,
  }));
  return { units, counters } as unknown as BattleState;
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

  it('ステージちゅうに かくていした level / xp が そのまま save.units へ 書き戻される', () => {
    const battle = battleWith({ units: { roran: { level: 2, xp: 5 }, mist: { level: 1, xp: 20 } } });
    const r = applyStageClear(reg, newSave(reg), 'stage1', battle);
    expect(r.save.units.roran).toEqual({ level: 2, xp: 5 });
    expect(r.save.units.mist).toEqual({ level: 1, xp: 20 });
  });

  it('ステージちゅうに レベルが あがっていれば leveledUp が true になる', () => {
    const battle = battleWith({ units: { ines: { level: 2, xp: 0 } } });
    const r = applyStageClear(reg, newSave(reg), 'stage1', battle);
    const ines = r.gains.find((g) => g.id === 'ines')!;
    expect(ines.after).toEqual({ level: 2, xp: 0 });
    expect(ines.leveledUp).toBe(true);
    expect(r.save.units.ines).toEqual({ level: 2, xp: 0 });
  });

  it('レベルが かわっていなければ leveledUp は false', () => {
    const battle = battleWith({ units: { gau: { level: 1, xp: 12 } } });
    const r = applyStageClear(reg, newSave(reg), 'stage1', battle);
    const gau = r.gains.find((g) => g.id === 'gau')!;
    expect(gau.after).toEqual({ level: 1, xp: 12 });
    expect(gau.leveledUp).toBe(false);
  });

  it('たたかいに 参加しなかった キャラは save.units が そのまま', () => {
    const save = { ...newSave(reg), units: { ...newSave(reg).units, mist: { level: 3, xp: 7 } } };
    const battle = battleWith({ units: { roran: { level: 2, xp: 0 } } });
    const r = applyStageClear(reg, save, 'stage1', battle);
    expect(r.save.units.mist).toEqual({ level: 3, xp: 7 });
    expect(r.gains.find((g) => g.id === 'mist')).toBeUndefined();
  });

  it('新しく取った称号だけ newTitles に入る', () => {
    const first = applyStageClear(reg, newSave(reg), 'stage1', battleWith({ skillUses: { roran: 5 } }));
    expect(first.newTitles).toEqual(['gamanzuyoi']);
    expect(first.save.titles).toEqual(['gamanzuyoi']);

    const second = applyStageClear(reg, first.save, 'stage2', battleWith({ skillUses: { roran: 1 } }));
    expect(second.newTitles).toEqual([]);
    expect(second.save.titles).toEqual(['gamanzuyoi']);
  });

  it('カウンタが積み上がる', () => {
    const first = applyStageClear(reg, newSave(reg), 'stage1', battleWith({ skillUses: { roran: 2 } }));
    const second = applyStageClear(reg, first.save, 'stage2', battleWith({ skillUses: { roran: 3 } }));
    expect(second.save.counters['skill:funbaru:uses']).toBe(5);
    expect(second.newTitles).toEqual(['gamanzuyoi']);
  });

  it('元のセーブを書き換えない', () => {
    const save = newSave(reg);
    applyStageClear(reg, save, 'stage1', battleWith({ units: { roran: { level: 4, xp: 3 } } }));
    expect(save.clearedStageIds).toEqual([]);
    expect(save.units.roran).toEqual({ level: 1, xp: 0 });
  });
});
