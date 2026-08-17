import { describe, expect, it } from 'vitest';
import { makeRng, nextFloat, nextInt } from './rng';

describe('rng', () => {
  it('同じシードなら同じ列を返す', () => {
    const a = makeRng(12345);
    const b = makeRng(12345);
    const seqA = [nextFloat(a), nextFloat(a), nextFloat(a)];
    const seqB = [nextFloat(b), nextFloat(b), nextFloat(b)];
    expect(seqA).toEqual(seqB);
  });

  it('違うシードなら違う列を返す', () => {
    const a = makeRng(1);
    const b = makeRng(2);
    expect(nextFloat(a)).not.toBe(nextFloat(b));
  });

  it('nextFloat は 0 以上 1 未満を返す', () => {
    const r = makeRng(7);
    for (let i = 0; i < 500; i++) {
      const v = nextFloat(r);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('nextInt は 0 以上 maxExclusive 未満の整数を返す', () => {
    const r = makeRng(99);
    for (let i = 0; i < 500; i++) {
      const v = nextInt(r, 5);
      expect(Number.isInteger(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(5);
    }
  });

  it('maxExclusive が 0 以下なら 0 を返す', () => {
    const r = makeRng(3);
    expect(nextInt(r, 0)).toBe(0);
    expect(nextInt(r, -4)).toBe(0);
  });
});
