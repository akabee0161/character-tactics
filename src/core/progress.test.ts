import { describe, expect, it } from 'vitest';
import { applyXp, earnedTitles, MAX_LEVEL, titlesOf, xpGain, xpToNext } from './progress';
import { testRegistry } from './testing';

describe('xpGain / xpToNext', () => {
  it('クリア基礎 20 + 撃破数 x 5', () => {
    expect(xpGain(0)).toBe(20);
    expect(xpGain(4)).toBe(40);
  });

  it('次のレベルに必要な経験値は レベル x 30', () => {
    expect(xpToNext(1)).toBe(30);
    expect(xpToNext(4)).toBe(120);
  });
});

describe('applyXp', () => {
  it('足りなければレベルは上がらない', () => {
    expect(applyXp({ level: 1, xp: 0 }, 25)).toEqual({ level: 1, xp: 25 });
  });

  it('ちょうど足りればレベルが上がって余りが繰り越される', () => {
    expect(applyXp({ level: 1, xp: 10 }, 20)).toEqual({ level: 2, xp: 0 });
  });

  it('一度に 2 レベル上がることもある', () => {
    // Lv1: 30 必要 -> Lv2: 60 必要
    expect(applyXp({ level: 1, xp: 0 }, 95)).toEqual({ level: 3, xp: 5 });
  });

  it('上限レベルでは経験値が貯まらない', () => {
    expect(applyXp({ level: MAX_LEVEL, xp: 0 }, 999)).toEqual({ level: MAX_LEVEL, xp: 0 });
  });

  it('元のオブジェクトを書き換えない', () => {
    const p = { level: 1, xp: 0 };
    applyXp(p, 50);
    expect(p).toEqual({ level: 1, xp: 0 });
  });
});

describe('earnedTitles', () => {
  it('しきいちに とどいた しょうごうだけを かえす', () => {
    const reg = testRegistry();
    expect(earnedTitles(reg, { 'skill:funbaru:uses': 5 })).toEqual(['gamanzuyoi']);
  });

  it('しきいちの 1つ てまえでは かえさない', () => {
    const reg = testRegistry();
    expect(earnedTitles(reg, { 'skill:funbaru:uses': 4 })).toEqual([]);
  });

  it('カウンタが なければ かえさない', () => {
    const reg = testRegistry();
    expect(earnedTitles(reg, {})).toEqual([]);
  });

  it('ふくすうの しょうごうを どうじに かえす', () => {
    const reg = testRegistry();
    const got = earnedTitles(reg, { 'skill:funbaru:uses': 5, 'bond:supports': 20 });
    expect(got.sort()).toEqual(['gamanzuyoi', 'nakayoshi']);
  });
});

describe('titlesOf', () => {
  it('もちぬしの しょうごうと ぜんいん きょうつうの しょうごうを かえす', () => {
    const reg = testRegistry();
    const got = titlesOf(reg, ['gamanzuyoi', 'kazenoyouni', 'nakayoshi'], 'roran');
    expect(got.map((t) => t.id)).toEqual(['gamanzuyoi', 'nakayoshi']);
  });

  it('もっていない しょうごうは かえさない', () => {
    const reg = testRegistry();
    expect(titlesOf(reg, [], 'roran')).toEqual([]);
  });
});
