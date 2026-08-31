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
    expect(bondBonus(reg, 'u:roran', 'roran', { x: 0, y: 0 }, [at('ines', 100)])).toBe(2);
  });

  it('範囲外なら 0', () => {
    const reg = testRegistry();
    expect(bondBonus(reg, 'u:roran', 'roran', { x: 0, y: 0 }, [at('ines', 201)])).toBe(0);
  });

  it('ちょうど 200px は範囲内', () => {
    const reg = testRegistry();
    expect(bondBonus(reg, 'u:roran', 'roran', { x: 0, y: 0 }, [at('ines', BOND_RANGE)])).toBe(2);
  });

  it('なかよしでない相手は加算されない', () => {
    const reg = testRegistry();
    expect(bondBonus(reg, 'u:ines', 'ines', { x: 0, y: 0 }, [at('gau', 50)])).toBe(0);
  });

  it('複数のなかよし相手がいれば合計する', () => {
    const reg = testRegistry();
    expect(bondBonus(reg, 'u:roran', 'roran', { x: 0, y: 0 }, [at('ines', 50), at('mist', 80)])).toBe(3);
  });

  it('たいきゃく中の相手は支援しない', () => {
    const reg = testRegistry();
    expect(bondBonus(reg, 'u:roran', 'roran', { x: 0, y: 0 }, [at('ines', 50, true)])).toBe(0);
  });

  it('自分自身は数えない', () => {
    const reg = testRegistry();
    expect(bondBonus(reg, 'u:roran', 'roran', { x: 0, y: 0 }, [at('roran', 0)])).toBe(0);
  });

  it('自分自身の はんていは uid で する（defId が おなじ べつの あいてを のぞかない）', () => {
    // roran どうしの きずなを もつ れじすとりを つくり、defId だけでは
    // くべつできない じょうきょうを さいげんする
    const base = testRegistry();
    const reg = { ...base, bonds: [...base.bonds, { a: 'roran', b: 'roran', bonus: 5 }] };
    const r = bondBonus(reg, 'u:roran-1', 'roran', { x: 0, y: 0 }, [
      { uid: 'u:roran-1', id: 'roran', pos: { x: 0, y: 0 }, retired: false }, // じぶん自身（のぞかれる）
      { uid: 'u:roran-2', id: 'roran', pos: { x: 0, y: 0 }, retired: false }, // おなじ defId の べつの ユニット
    ]);
    // 1つめは uid が じぶんと おなじなので のぞかれ、2つめだけ かさんされる
    expect(r).toBe(5);
  });

  it('ペアはどちら向きでも成立する', () => {
    const reg = testRegistry();
    expect(bondBonus(reg, 'u:ines', 'ines', { x: 0, y: 0 }, [at('roran', 50)])).toBe(2);
  });
});

describe('bondSupporters', () => {
  it('支援している相手の一覧を返す', () => {
    const reg = testRegistry();
    const r = bondSupporters(
      reg, 'u:roran', 'roran', { x: 0, y: 0 }, [at('ines', 50), at('mist', 80), at('gau', 10)],
    );
    expect(r).toEqual([
      { uid: 'u:ines', id: 'ines', bonus: 2 },
      { uid: 'u:mist', id: 'mist', bonus: 1 },
    ]);
  });

  it('誰もいなければ空配列', () => {
    const reg = testRegistry();
    expect(bondSupporters(reg, 'u:gau', 'gau', { x: 0, y: 0 }, [at('ines', 10)])).toEqual([]);
  });
});
