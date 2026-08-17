import { distance } from './field';
import { MELEE_RANGE } from '../content/characters';
import type { AttackKind, Vec2 } from './types';

export type DamageParams = {
  power: number;
  guard: number;
  attackKind: AttackKind;
  /** 防御側が弓ダメージに上限を持つならその値。持たないなら null */
  bowDamageCap: number | null;
  /** 攻撃側にかかっているなかよし支援の合計 */
  bondBonus: number;
  /** ねらいうちが乗っているか */
  neraiuchi: boolean;
  /** 防御側がふんばり中か */
  targetFunbaru: boolean;
};

export function computeDamage(p: DamageParams): number {
  let dmg = p.power + p.bondBonus - p.guard;
  if (dmg < 1) dmg = 1;

  if (p.neraiuchi) {
    dmg *= 2;
  } else if (p.attackKind === 'bow' && p.bowDamageCap !== null) {
    dmg = Math.min(dmg, p.bowDamageCap);
  }

  if (p.targetFunbaru) {
    dmg = Math.floor(dmg / 2);
  }

  return Math.max(1, dmg);
}

export function nearestWithin<T extends { pos: Vec2 }>(
  from: Vec2,
  candidates: T[],
  range: number,
): T | null {
  let best: T | null = null;
  let bestDist = Infinity;
  for (const c of candidates) {
    const d = distance(from, c.pos);
    if (d <= range && d < bestDist) {
      bestDist = d;
      best = c;
    }
  }
  return best;
}

export function hasThreatWithinMelee(pos: Vec2, threats: { pos: Vec2 }[]): boolean {
  return threats.some((t) => distance(pos, t.pos) <= MELEE_RANGE);
}

export function effectiveInterval(
  base: number,
  attackKind: AttackKind,
  meleeThreat: boolean,
): number {
  return attackKind === 'bow' && meleeThreat ? base * 2 : base;
}
