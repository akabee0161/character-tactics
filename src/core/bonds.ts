import { distance } from './field';
import type { CharId, Vec2 } from './types';

export const BOND_RANGE = 200;

export type Bond = { a: CharId; b: CharId; bonus: number };

export const BONDS: readonly Bond[] = [
  { a: 'roran', b: 'ines', bonus: 2 },
  { a: 'mist', b: 'gau', bonus: 2 },
  { a: 'roran', b: 'mist', bonus: 1 },
];

export type BondSupporter = { id: CharId; pos: Vec2; retired: boolean };

function bonusBetween(a: CharId, b: CharId): number {
  for (const bond of BONDS) {
    if ((bond.a === a && bond.b === b) || (bond.a === b && bond.b === a)) {
      return bond.bonus;
    }
  }
  return 0;
}

export function bondSupporters(
  selfId: CharId,
  selfPos: Vec2,
  others: BondSupporter[],
): { id: CharId; bonus: number }[] {
  const result: { id: CharId; bonus: number }[] = [];
  for (const other of others) {
    if (other.id === selfId) continue;
    if (other.retired) continue;
    const bonus = bonusBetween(selfId, other.id);
    if (bonus === 0) continue;
    if (distance(selfPos, other.pos) > BOND_RANGE) continue;
    result.push({ id: other.id, bonus });
  }
  return result;
}

export function bondBonus(selfId: CharId, selfPos: Vec2, others: BondSupporter[]): number {
  return bondSupporters(selfId, selfPos, others).reduce((sum, s) => sum + s.bonus, 0);
}
