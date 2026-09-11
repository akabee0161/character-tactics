import { describe, expect, it } from 'vitest';
import { applyXp, earnedTitles, titlesOf, xpToNext } from './progress';
import { testRegistry } from './testing';
import type { Registry } from '../engine/registry';
import type { GrowthDef, StageDef } from '../engine/schema';

describe('xpToNext', () => {
  it('レベル × xpPerLevel', () => {
    expect(xpToNext(1, 12)).toBe(12);
    expect(xpToNext(4, 12)).toBe(48);
  });
});

describe('applyXp', () => {
  // 実際の assets/growth.json の値には依存しない（xpPerLevel はステージ数に合わせて変わりうる）
  const growth = (): GrowthDef => ({
    maxLevel: 12,
    xpPerLevel: 12,
    hpPerLevel: 1,
    levelsPerPower: 3,
    hitXp: 1,
    healXp: 1,
    assistRatio: 0.5,
    clearXp: 10,
  });

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

  it('元のオブジェクトを書き換えない', () => {
    const p = { level: 1, xp: 0 };
    applyXp(p, 50, growth());
    expect(p).toEqual({ level: 1, xp: 0 });
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

describe('10ステージぶんの成長曲線', () => {
  /**
   * 1ステージで仲間ひとりが受け取る経験値の下限。
   * 撃破ぶんを4人で均等に割り、クリアボーナスを足しただけの見積り。
   * 命中とアシストのぶんは数えていないので、実際はこれより多く入る
   */
  function floorXpPerStage(reg: Registry, stage: StageDef): number {
    const rewardOf = (defId: string): number => reg.enemies.get(defId)?.xpReward ?? 0;
    let total = 0;
    for (const e of stage.enemies) total += rewardOf(e.defId);
    for (const s of stage.spawners) total += rewardOf(s.defId) * s.total;
    return reg.growth.clearXp + total / 4;
  }

  /** Lv1 から maxLevel に届くまでに要る経験値の合計 */
  function xpToMaxLevel(growth: GrowthDef): number {
    let sum = 0;
    for (let lv = 1; lv < growth.maxLevel; lv++) sum += xpToNext(lv, growth.xpPerLevel);
    return sum;
  }

  it('全ステージを通せば 上限レベルに届く', () => {
    const reg = testRegistry();
    const total = reg.stages.reduce((sum, s) => sum + floorXpPerStage(reg, s), 0);
    expect(total).toBeGreaterThanOrEqual(xpToMaxLevel(reg.growth));
  });

  it('前半5ステージでは まだ上限に届かない', () => {
    const reg = testRegistry();
    const half = reg.stages.slice(0, 5).reduce((sum, s) => sum + floorXpPerStage(reg, s), 0);
    expect(half).toBeLessThan(xpToMaxLevel(reg.growth) * 0.6);
  });
});
