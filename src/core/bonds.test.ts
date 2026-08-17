import { describe, expect, it } from 'vitest';
import { BONDS, BOND_RANGE, bondBonus, bondSupporters } from './bonds';
import type { BondSupporter } from './bonds';

const at = (id: BondSupporter['id'], x: number, retired = false): BondSupporter => ({
  id, pos: { x, y: 0 }, retired,
});

describe('BONDS', () => {
  it('設計書どおり 3 ペア', () => {
    expect(BONDS).toHaveLength(3);
    expect(BONDS).toContainEqual({ a: 'roran', b: 'ines', bonus: 2 });
    expect(BONDS).toContainEqual({ a: 'mist', b: 'gau', bonus: 2 });
    expect(BONDS).toContainEqual({ a: 'roran', b: 'mist', bonus: 1 });
  });
});

describe('bondBonus', () => {
  it('なかよし相手が範囲内にいると加算される', () => {
    expect(bondBonus('roran', { x: 0, y: 0 }, [at('ines', 100)])).toBe(2);
  });

  it('範囲外なら 0', () => {
    expect(bondBonus('roran', { x: 0, y: 0 }, [at('ines', 201)])).toBe(0);
  });

  it('ちょうど 200px は範囲内', () => {
    expect(bondBonus('roran', { x: 0, y: 0 }, [at('ines', BOND_RANGE)])).toBe(2);
  });

  it('なかよしでない相手は加算されない', () => {
    expect(bondBonus('ines', { x: 0, y: 0 }, [at('gau', 50)])).toBe(0);
  });

  it('複数のなかよし相手がいれば合計する', () => {
    expect(bondBonus('roran', { x: 0, y: 0 }, [at('ines', 50), at('mist', 80)])).toBe(3);
  });

  it('たいきゃく中の相手は支援しない', () => {
    expect(bondBonus('roran', { x: 0, y: 0 }, [at('ines', 50, true)])).toBe(0);
  });

  it('自分自身は数えない', () => {
    expect(bondBonus('roran', { x: 0, y: 0 }, [at('roran', 0)])).toBe(0);
  });

  it('ペアはどちら向きでも成立する', () => {
    expect(bondBonus('ines', { x: 0, y: 0 }, [at('roran', 50)])).toBe(2);
  });
});

describe('bondSupporters', () => {
  it('支援している相手の一覧を返す', () => {
    const r = bondSupporters('roran', { x: 0, y: 0 }, [at('ines', 50), at('mist', 80), at('gau', 10)]);
    expect(r).toEqual([
      { id: 'ines', bonus: 2 },
      { id: 'mist', bonus: 1 },
    ]);
  });

  it('誰もいなければ空配列', () => {
    expect(bondSupporters('gau', { x: 0, y: 0 }, [at('ines', 10)])).toEqual([]);
  });
});
