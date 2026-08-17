import { describe, expect, it } from 'vitest';
import { computeDamage, effectiveInterval, hasThreatWithinMelee, nearestWithin } from './combat';
import type { DamageParams } from './combat';

const base: DamageParams = {
  power: 6, guard: 1, attackKind: 'melee',
  bowDamageCap: null, bondBonus: 0, neraiuchi: false, targetFunbaru: false,
};

describe('computeDamage', () => {
  it('ちから - まもり', () => {
    expect(computeDamage({ ...base, power: 6, guard: 1 })).toBe(5);
  });

  it('引き算の結果が 0 以下でも最低 1', () => {
    expect(computeDamage({ ...base, power: 4, guard: 9 })).toBe(1);
  });

  it('なかよし支援ぶんが加算される', () => {
    expect(computeDamage({ ...base, power: 8, guard: 1, bondBonus: 2 })).toBe(9);
  });

  it('たてもちは弓ダメージが上限 1 に固定される', () => {
    expect(computeDamage({ ...base, power: 8, guard: 3, attackKind: 'bow', bowDamageCap: 1 })).toBe(1);
  });

  it('近接ならたてもちの上限は効かない', () => {
    expect(computeDamage({ ...base, power: 8, guard: 3, attackKind: 'melee', bowDamageCap: 1 })).toBe(5);
  });

  it('ねらいうちは 2 倍になり、たてもちの上限を無視する', () => {
    expect(computeDamage({ ...base, power: 8, guard: 3, attackKind: 'bow', bowDamageCap: 1, neraiuchi: true })).toBe(10);
  });

  it('ふんばり中の相手には切り捨てで半分', () => {
    expect(computeDamage({ ...base, power: 9, guard: 4, targetFunbaru: true })).toBe(2);
  });

  it('ふんばりで 0 になっても最低 1', () => {
    expect(computeDamage({ ...base, power: 5, guard: 5, targetFunbaru: true })).toBe(1);
  });

  it('支援と半減の両方がかかる順序（加算 → 半減）', () => {
    // (8 + 2) - 4 = 6 -> ふんばりで 3
    expect(computeDamage({ ...base, power: 8, guard: 4, bondBonus: 2, targetFunbaru: true })).toBe(3);
  });
});

describe('nearestWithin', () => {
  const from = { x: 0, y: 0 };

  it('レンジ内でいちばん近いものを返す', () => {
    const c = [{ pos: { x: 100, y: 0 } }, { pos: { x: 30, y: 0 } }, { pos: { x: 60, y: 0 } }];
    expect(nearestWithin(from, c, 160)).toBe(c[1]);
  });

  it('レンジ外しかなければ null', () => {
    expect(nearestWithin(from, [{ pos: { x: 200, y: 0 } }], 160)).toBeNull();
  });

  it('ちょうどレンジ上は含む', () => {
    const c = [{ pos: { x: 24, y: 0 } }];
    expect(nearestWithin(from, c, 24)).toBe(c[0]);
  });

  it('候補が空なら null', () => {
    expect(nearestWithin(from, [], 160)).toBeNull();
  });
});

describe('hasThreatWithinMelee', () => {
  it('24px 以内に敵がいれば true', () => {
    expect(hasThreatWithinMelee({ x: 0, y: 0 }, [{ pos: { x: 20, y: 0 } }])).toBe(true);
  });

  it('24px より外なら false', () => {
    expect(hasThreatWithinMelee({ x: 0, y: 0 }, [{ pos: { x: 25, y: 0 } }])).toBe(false);
  });
});

describe('effectiveInterval', () => {
  it('弓は密着されると攻撃間隔が倍', () => {
    expect(effectiveInterval(2.2, 'bow', true)).toBeCloseTo(4.4);
  });

  it('弓でも密着されていなければそのまま', () => {
    expect(effectiveInterval(2.2, 'bow', false)).toBeCloseTo(2.2);
  });

  it('近接は密着されていても変わらない', () => {
    expect(effectiveInterval(1.6, 'melee', true)).toBeCloseTo(1.6);
  });
});
