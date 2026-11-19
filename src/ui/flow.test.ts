import { describe, expect, it } from 'vitest';
import { applyStageClear, canSkipIntro, hasReadIntro, isStageUnlocked, markIntroRead } from './flow';
import { applyXp } from '../core/progress';
import { newSave } from '../save/save';
import { beginBattle, createBattleState } from '../core/state';
import { testRegistry } from '../core/testing';
import type { Registry } from '../engine/registry';
import type { BattleState, CharProgress } from '../core/types';

type UnitOver = { level: number; xp: number; retired?: boolean };
type BattleOver = {
  units?: Partial<Record<string, UnitOver>>;
  /** 戦闘の時計（秒）。既定は 30 */
  time?: number;
};

/**
 * applyStageClear が読む units(player 分の level/xp)だけを持った簡易な BattleState。
 * クリアボーナスの対象外にするため、retired を明示しない限りは退場済み扱いにする
 * （このヘルパを使う既存テストは書き戻しの検証で、クリアボーナスの計算対象ではないため）
 */
const battleWith = (over: BattleOver = {}): BattleState => {
  const units = Object.entries(over.units ?? {}).map(([defId, p]) => ({
    side: 'player' as const,
    defId,
    level: p!.level,
    xp: p!.xp,
    retired: p!.retired ?? true,
    statBonus: { maxHp: 0, power: 0, guard: 0, speed: 0 },
  }));
  return { units, joined: [], benchedRecruits: [], claimed: [], time: over.time ?? 30 } as unknown as BattleState;
};

/** クリアボーナスのテスト用に、実際の Unit(retired: false がデフォルト)を持つ BattleState を組む */
function freshBattle(reg: Registry): BattleState {
  const stage = reg.stages[0]!;
  const progress: Record<string, CharProgress> = {};
  for (const id of reg.units.keys()) progress[id] = { level: 1, xp: 0 };
  const state = createBattleState(reg, stage, { units: progress, members: [], claimed: [] }, 1);
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
    const expected = applyXp({ level: 1, xp: 0 }, reg.growth.clearXp, reg.growth);
    expect(r.save.units.roran).toEqual(expected);
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

describe('applyStageClear: 加入と印と上乗せ', () => {
  it('クリアで加入と印と上乗せが残る', () => {
    const reg = testRegistry();
    const state = freshBattle(reg);
    state.joined = ['ally05'];
    state.claimed = ['village:v1'];
    const roran = state.units.find((u) => u.defId === 'roran')!;
    roran.statBonus = { maxHp: 3, power: 0, guard: 1, speed: 0, resist: 0 };
    const r = applyStageClear(reg, newSave(reg), state.stage.id, state);
    expect(r.save.members).toEqual(['ally05']);
    expect(r.save.claimed).toEqual(['village:v1']);
    expect(r.save.units.roran!.bonus).toEqual({ maxHp: 3, power: 0, guard: 1, speed: 0, resist: 0 });
    expect(r.save.units.ines!.bonus).toBeUndefined();
  });

  it('場に出なかった仲間は、加わったときのレベルで units に残る', () => {
    const reg = testRegistry();
    const state = freshBattle(reg);
    state.joined = ['ally06'];
    state.benchedRecruits = [{ defId: 'ally06', level: 4 }];
    const r = applyStageClear(reg, newSave(reg), state.stage.id, state);
    expect(r.save.members).toEqual(['ally06']);
    expect(r.save.units.ally06).toEqual({ level: 4, xp: 0 });
  });

  it('場に出なかった仲間にも、加入の表示（joined の XpGain）が出る。先頭に並ぶ', () => {
    const reg = testRegistry();
    const state = freshBattle(reg);
    state.joined = ['ally06'];
    state.benchedRecruits = [{ defId: 'ally06', level: 4 }];
    const r = applyStageClear(reg, newSave(reg), state.stage.id, state);
    const g = r.gains.find((x) => x.id === 'ally06')!;
    expect(g).toEqual({ id: 'ally06', before: { level: 4, xp: 0 }, after: { level: 4, xp: 0 }, leveledUp: false, joined: true });
    expect(r.gains[0]!.id).toBe('ally06');
    // 場の味方の分はそのまま残る
    expect(r.gains.length).toBe(state.units.filter((u) => u.side === 'player').length + 1);
  });

  it('2 回クリアしても members が重ならない', () => {
    const reg = testRegistry();
    const state = freshBattle(reg);
    state.joined = ['ally05'];
    state.claimed = ['village:v1'];
    const first = applyStageClear(reg, newSave(reg), state.stage.id, state);
    const second = applyStageClear(reg, first.save, state.stage.id, state);
    expect(second.save.members).toEqual(['ally05']);
    expect(second.save.claimed).toEqual(['village:v1']);
  });

  it('XpGain の joined は battle.joined の仲間だけ true', () => {
    const reg = testRegistry();
    const state = freshBattle(reg);
    state.joined = ['gau'];
    const r = applyStageClear(reg, newSave(reg), state.stage.id, state);
    expect(r.gains.find((g) => g.id === 'gau')!.joined).toBe(true);
    expect(r.gains.find((g) => g.id === 'roran')!.joined).toBe(false);
  });
});

describe('canSkipIntro', () => {
  const reg = testRegistry();
  const base = reg.stages[0]!;
  const join = { unitId: 'ally05', level: 1, talk: [] };
  const stage = { ...base, joins: [join] };

  it('既読でも、開始時の加入の会話が未読（まだ仲間でない）なら飛ばせない', () => {
    const s = markIntroRead(newSave(reg), stage.id);
    expect(canSkipIntro(s, stage)).toBe(false);
  });

  it('既読で加入済みなら飛ばせる。未読なら飛ばせない', () => {
    const read = markIntroRead(newSave(reg), stage.id);
    expect(canSkipIntro({ ...read, members: ['ally05'] }, stage)).toBe(true);
    expect(canSkipIntro({ ...newSave(reg), members: ['ally05'] }, stage)).toBe(false);
  });

  it('加入の会話が無いステージは既読だけで飛ばせる', () => {
    const s = markIntroRead(newSave(reg), base.id);
    expect(canSkipIntro(s, { ...base, joins: [] })).toBe(true);
  });
});

describe('applyStageClear: 一番速いクリアの記録', () => {
  const reg = testRegistry();
  const clear = (bestTimes: Record<string, number>, time: number) =>
    applyStageClear(reg, { ...newSave(reg), bestTimes }, 'stage1', battleWith({ time }));

  it('初めてのクリアは記録更新で、best が今回の秒', () => {
    const r = clear({}, 75.3);
    expect(r.clear).toEqual({ seconds: 75.3, best: 75.3, prevBest: null, isRecord: true });
    expect(r.save.bestTimes.stage1).toBe(75.3);
  });
  it('前より速ければ書き換えて記録更新', () => {
    const r = clear({ stage1: 80 }, 70);
    expect(r.clear).toEqual({ seconds: 70, best: 70, prevBest: 80, isRecord: true });
    expect(r.save.bestTimes.stage1).toBe(70);
  });
  it('前より遅ければ変えず、記録更新でない', () => {
    const r = clear({ stage1: 60 }, 70);
    expect(r.clear).toEqual({ seconds: 70, best: 60, prevBest: 60, isRecord: false });
    expect(r.save.bestTimes.stage1).toBe(60);
  });
  it('同じ秒は記録更新でない', () => {
    const r = clear({ stage1: 60 }, 60);
    expect(r.clear.isRecord).toBe(false);
    expect(r.save.bestTimes.stage1).toBe(60);
  });
  it('ほかのステージの記録は変えない。元のセーブも書き換えない', () => {
    const base = { ...newSave(reg), bestTimes: { stage2: 33 } };
    const r = applyStageClear(reg, base, 'stage1', battleWith({ time: 50 }));
    expect(r.save.bestTimes).toEqual({ stage2: 33, stage1: 50 });
    expect(base.bestTimes).toEqual({ stage2: 33 });
  });
});
