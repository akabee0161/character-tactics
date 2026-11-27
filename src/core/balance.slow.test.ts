// ステージ全部を最後まで遊ばせる遅いテスト（合わせて約 20 分）。`npm test` は流さず、`npm run test:full` と本番反映の CI が流す。
import { describe, expect, it } from 'vitest';
import { MAX_ATTEMPTS, measure, playThrough } from './balance';
import { testRegistry } from './testing';

const reg = testRegistry();

describe('playThrough', () => {
  it('ステージ順に進み、打ち切りは最後の1つだけ', () => {
    const runs = playThrough(reg, 1);
    expect(runs[0]!.stageId).toBe(reg.stages[0]!.id);
    expect(runs.length).toBeLessThanOrEqual(reg.stages.length);
    for (const r of runs) {
      expect(r.attempts).toBeGreaterThanOrEqual(1);
      expect(r.attempts).toBeLessThanOrEqual(MAX_ATTEMPTS);
    }
    expect(runs.filter((r) => !r.cleared).length).toBeLessThanOrEqual(1);
    const bad = runs.findIndex((r) => !r.cleared);
    if (bad >= 0) expect(bad).toBe(runs.length - 1);
  });

  it('同じシードなら同じ結果になる', () => {
    expect(playThrough(reg, 3)).toEqual(playThrough(reg, 3));
  });
});

describe('measure', () => {
  it('ステージと同じ順・長さで、値が範囲内', () => {
    const stats = measure(reg, 2);
    expect(stats.map((s) => s.stageId)).toEqual(reg.stages.map((s) => s.id));
    for (const s of stats) {
      expect(s.firstTryRate).toBeGreaterThanOrEqual(0);
      expect(s.firstTryRate).toBeLessThanOrEqual(100);
      expect(s.reached).toBeGreaterThanOrEqual(0);
    }
    expect(stats[0]!.reached).toBe(2);
  }, 120_000);
});

describe('playThrough の育てた場合・平均レベル', () => {
  it('各ステージに grownWon・avgLevel・leftover がある', () => {
    const runs = playThrough(reg, 1);
    expect(runs.length).toBeGreaterThan(0);
    for (const r of runs) {
      expect(typeof r.grownWon).toBe('boolean');
      if (r.cleared) expect(r.avgLevel).toBeGreaterThanOrEqual(1);
      expect(typeof r.leftover).toBe('boolean');
    }
  }, 120_000);
});
