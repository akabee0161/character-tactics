import { distance } from './field';
import { MELEE_RANGE, RANGE_EPS } from './constants';
import type { AttackKind, Unit, Vec2 } from './types';

export function isFunbaruActive(unit: Unit, time: number): boolean {
  return time < unit.funbaruUntil;
}

export type DamageParams = {
  power: number;
  guard: number;
  /** 防御側の魔法防御。魔法の攻撃では guard の代わりにこれを引く */
  resist: number;
  /** 攻撃側が守備を無視するか（斧）。魔法防御には関係しない */
  ignoresGuard: boolean;
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
  const defense = p.attackKind === 'magic' ? p.resist : (p.ignoresGuard ? 0 : p.guard);
  let dmg = p.power + p.bondBonus - defense;
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
  return threats.some((t) => distance(pos, t.pos) <= MELEE_RANGE + RANGE_EPS);
}

/** 遠距離職は接近されると弱い、という一貫したルールにする */
export function effectiveInterval(
  base: number,
  attackKind: AttackKind,
  meleeThreat: boolean,
): number {
  return attackKind !== 'melee' && meleeThreat ? base * 2 : base;
}
