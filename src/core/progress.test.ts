import { describe, expect, it } from 'vitest';
import { applyXp, earnedTitles, titlesOf, xpToNext } from './progress';
import { testRegistry } from './testing';

const growth = () => testRegistry().growth;

describe('xpToNext', () => {
  it('レベル × xpPerLevel', () => {
    expect(xpToNext(1, 12)).toBe(12);
    expect(xpToNext(4, 12)).toBe(48);
  });
});

describe('applyXp', () => {
  it('必要量に届けばレベルが上がる', () => {
    expect(applyXp({ level: 1, xp: 0 }, 12, growth())).toEqual({ level: 2, xp: 0 });
  });

  it('余りは次のレベルに繰り越す', () => {
    expect(applyXp({ level: 1, xp: 0 }, 15, growth())).toEqual({ level: 2, xp: 3 });
  });

  it('一度に複数レベル上がる', () => {
    // Lv2 まで 12、Lv3 まで 24
    expect(applyXp({ level: 1, xp: 0 }, 36, growth()).level).toBe(3);
  });

  it('上限に達したら増えない', () => {
    const g = growth();
    expect(applyXp({ level: g.maxLevel, xp: 0 }, 999, g)).toEqual({ level: g.maxLevel, xp: 0 });
  });
});

describe('earnedTitles', () => {
  it('しきいちに とどいた しょうごうだけを かえす', () => {
    const reg = testRegistry();
    expect(earnedTitles(reg, { 'skill:funbaru:uses': 3 })).toEqual(['gamanzuyoi']);
  });

  it('しきいちの 1つ てまえでは かえさない', () => {
    const reg = testRegistry();
    expect(earnedTitles(reg, { 'skill:funbaru:uses': 2 })).toEqual([]);
  });

  it('カウンタが なければ かえさない', () => {
    const reg = testRegistry();
    expect(earnedTitles(reg, {})).toEqual([]);
  });

  it('ふくすうの しょうごうを どうじに かえす', () => {
    const reg = testRegistry();
    const got = earnedTitles(reg, { 'skill:funbaru:uses': 3, 'bond:supports': 20 });
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
