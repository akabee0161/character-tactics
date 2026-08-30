import { describe, expect, it } from 'vitest';
import { BOND_RANGE, bondBonus, bondSupporters } from './bonds';
import { testRegistry } from './testing';
import type { BondSupporter } from './bonds';

const at = (id: BondSupporter['id'], x: number, retired = false): BondSupporter => ({
  uid: `u:${id}`, id, pos: { x, y: 0 }, retired,
});

describe('レジストリの bonds', () => {
  it('設計書どおり 3 ペア', () => {
    const reg = testRegistry();
    expect(reg.bonds).toHaveLength(3);
    expect(reg.bonds).toContainEqual({ a: 'roran', b: 'ines', bonus: 2 });
    expect(reg.bonds).toContainEqual({ a: 'mist', b: 'gau', bonus: 2 });
    expect(reg.bonds).toContainEqual({ a: 'roran', b: 'mist', bonus: 1 });
  });
});

describe('bondBonus', () => {
  it('なかよし相手が範囲内にいると加算される', () => {
    const reg = testRegistry();
    expect(bondBonus(reg, 'roran', { x: 0, y: 0 }, [at('ines', 100)])).toBe(2);
  });

  it('範囲外なら 0', () => {
    const reg = testRegistry();
    expect(bondBonus(reg, 'roran', { x: 0, y: 0 }, [at('ines', 201)])).toBe(0);
  });

  it('ちょうど 200px は範囲内', () => {
    const reg = testRegistry();
    expect(bondBonus(reg, 'roran', { x: 0, y: 0 }, [at('ines', BOND_RANGE)])).toBe(2);
  });

  it('なかよしでない相手は加算されない', () => {
    const reg = testRegistry();
    expect(bondBonus(reg, 'ines', { x: 0, y: 0 }, [at('gau', 50)])).toBe(0);
  });

  it('複数のなかよし相手がいれば合計する', () => {
    const reg = testRegistry();
    expect(bondBonus(reg, 'roran', { x: 0, y: 0 }, [at('ines', 50), at('mist', 80)])).toBe(3);
  });

  it('たいきゃく中の相手は支援しない', () => {
    const reg = testRegistry();
    expect(bondBonus(reg, 'roran', { x: 0, y: 0 }, [at('ines', 50, true)])).toBe(0);
  });

  it('自分自身は数えない', () => {
    const reg = testRegistry();
    expect(bondBonus(reg, 'roran', { x: 0, y: 0 }, [at('roran', 0)])).toBe(0);
  });

  it('ペアはどちら向きでも成立する', () => {
    const reg = testRegistry();
    expect(bondBonus(reg, 'ines', { x: 0, y: 0 }, [at('roran', 50)])).toBe(2);
  });
});

describe('bondSupporters', () => {
  it('支援している相手の一覧を返す', () => {
    const reg = testRegistry();
    const r = bondSupporters(reg, 'roran', { x: 0, y: 0 }, [at('ines', 50), at('mist', 80), at('gau', 10)]);
    expect(r).toEqual([
      { uid: 'u:ines', id: 'ines', bonus: 2 },
      { uid: 'u:mist', id: 'mist', bonus: 1 },
    ]);
  });

  it('誰もいなければ空配列', () => {
    const reg = testRegistry();
    expect(bondSupporters(reg, 'gau', { x: 0, y: 0 }, [at('ines', 10)])).toEqual([]);
  });
});
