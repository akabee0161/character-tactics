import { describe, expect, it } from 'vitest';
import { applyStageClear, hasReadIntro, isStageUnlocked, markIntroRead } from './flow';
import { applyXp } from '../core/progress';
import { newSave } from '../save/save';
import { beginBattle, createBattleState } from '../core/state';
import { testRegistry } from '../core/testing';
import type { Registry } from '../engine/registry';
import type { BattleState, CharProgress } from '../core/types';

/** どのキャラのスキルがどの称号カウンタにつながるかは titles.json の決め事なので、
 * テストの分だけ対応表を持つ */
const SKILL_OF: Record<string, string> = {
  roran: 'funbaru', ines: 'neraiuchi', mist: 'omajinai', gau: 'kakenukeru',
};

type UnitOver = { level: number; xp: number; retired?: boolean };
type BattleOver = {
  units?: Partial<Record<string, UnitOver>>;
  skillUses?: Partial<Record<string, number>>;
};

/**
 * applyStageClear が読む units(player 分の level/xp)と counters だけを持った簡易な BattleState。
 * クリアボーナスの対象外にするため、retired を明示しない限りは退場済み扱いにする
 * （このヘルパを使う既存テストは書き戻し・称号まわりの検証で、クリアボーナスの計算対象ではないため）
 */
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
    retired: p!.retired ?? true,
  }));
  return { units, counters } as unknown as BattleState;
};

/** クリアボーナスのテスト用に、実際の Unit(retired: false がデフォルト)を持つ BattleState を組む */
function freshBattle(reg: Registry): BattleState {
  const stage = reg.stages[0]!;
  const progress: Record<string, CharProgress> = {};
  for (const id of reg.units.keys()) progress[id] = { level: 1, xp: 0 };
  const state = createBattleState(reg, stage, progress, 1);
  beginBattle(state);
  return state;
}

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

describe('applyStageClear: クリアボーナス', () => {
  it('退場していない味方に clearXp が入る', () => {
    const reg = testRegistry();
    const state = freshBattle(reg);
    const roran = state.units.find((u) => u.defId === 'roran')!;
    const r = applyStageClear(reg, newSave(reg), state.stage.id, state);
    expect(r.save.units.roran!.xp).toBe(reg.growth.clearXp);
    expect(roran.retired).toBe(false);
  });

  it('退場した味方には入らない', () => {
    const reg = testRegistry();
    const state = freshBattle(reg);
    const gau = state.units.find((u) => u.defId === 'gau')!;
    gau.retired = true;
    const r = applyStageClear(reg, newSave(reg), state.stage.id, state);
    expect(r.save.units.gau!.xp).toBe(0);
  });

  it('生存していて既に進行がある味方には、確定済みの進行にクリアボーナスが上乗せされる', () => {
    const reg = testRegistry();
    const state = freshBattle(reg);
    const roran = state.units.find((u) => u.defId === 'roran')!;
    roran.level = 2;
    roran.xp = 5; // 戦闘中に確定した想定の level / xp
    expect(roran.retired).toBe(false);

    const r = applyStageClear(reg, newSave(reg), state.stage.id, state);

    const expected = applyXp({ level: 2, xp: 5 }, reg.growth.clearXp, reg.growth);
    expect(r.save.units.roran).toEqual(expected);
  });
});

describe('既読の きろく', () => {
  const reg = testRegistry();

  it('きろくが なければ みどく', () => {
    expect(hasReadIntro(newSave(reg), 'stage1')).toBe(false);
  });

  it('きろくすると きどくに なる', () => {
    const s = markIntroRead(newSave(reg), 'stage1');
    expect(hasReadIntro(s, 'stage1')).toBe(true);
    expect(hasReadIntro(s, 'stage2')).toBe(false);
  });

  it('おなじ ステージを 2ど きろくしても ふえない', () => {
    const once = markIntroRead(newSave(reg), 'stage1');
    const twice = markIntroRead(once, 'stage1');
    expect(twice.readIntroStageIds).toEqual(['stage1']);
    expect(twice).toBe(once);  // 変化がなければ同じ参照を返す
  });

  it('もとの セーブを かきかえない', () => {
    const before = newSave(reg);
    markIntroRead(before, 'stage1');
    expect(before.readIntroStageIds).toEqual([]);
  });
});
