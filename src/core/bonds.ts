import { distance } from './field';
import type { Registry } from '../engine/registry';
import type { Vec2 } from './types';

export const BOND_RANGE = 200;

export type BondSupporter = { id: string; pos: Vec2; retired: boolean };

function bonusBetween(reg: Registry, a: string, b: string): number {
  for (const bond of reg.bonds) {
    if ((bond.a === a && bond.b === b) || (bond.a === b && bond.b === a)) return bond.bonus;
  }
  return 0;
}

export function bondSupporters(
  reg: Registry,
  selfId: string,
  selfPos: Vec2,
  others: BondSupporter[],
): { id: string; bonus: number }[] {
  const result: { id: string; bonus: number }[] = [];
  for (const other of others) {
    if (other.id === selfId || other.retired) continue;
    const bonus = bonusBetween(reg, selfId, other.id);
    if (bonus === 0) continue;
    if (distance(selfPos, other.pos) > BOND_RANGE) continue;
    result.push({ id: other.id, bonus });
  }
  return result;
}

export function bondBonus(reg: Registry, selfId: string, selfPos: Vec2, others: BondSupporter[]): number {
  return bondSupporters(reg, selfId, selfPos, others).reduce((sum, s) => sum + s.bonus, 0);
}
