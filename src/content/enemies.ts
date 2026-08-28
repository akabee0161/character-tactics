import { MELEE_RANGE } from './characters';

export type EnemyDef = {
  kind: string;
  name: string;
  maxHp: number;
  power: number;
  guard: number;
  range: number;
  attackInterval: number;
  speed: number;
  /** 砦に到達したときに砦へ与えるダメージ */
  fortDamage: number;
  /** 弓によるダメージの上限。null なら上限なし */
  bowDamageCap: number | null;
  /** この HP 割合を下回ると撤退する。null なら撤退しない */
  fleeAtHpRatio: number | null;
  color: string;
};

export const ENEMIES: Record<string, EnemyDef> = {
  narazumono: {
    kind: 'narazumono', name: 'ならずもの',
    maxHp: 12, power: 5, guard: 1,
    range: MELEE_RANGE, attackInterval: 1.6, speed: 45,
    fortDamage: 3, bowDamageCap: null, fleeAtHpRatio: null,
    color: '#8a5a4a',
  },
  tatemochi: {
    kind: 'tatemochi', name: 'たてもち',
    maxHp: 20, power: 5, guard: 3,
    range: MELEE_RANGE, attackInterval: 1.8, speed: 35,
    fortDamage: 5, bowDamageCap: 1, fleeAtHpRatio: null,
    color: '#6b6b7a',
  },
  garum: {
    kind: 'garum', name: 'ガルム',
    maxHp: 40, power: 9, guard: 4,
    range: MELEE_RANGE, attackInterval: 1.4, speed: 55,
    fortDamage: 10, bowDamageCap: null, fleeAtHpRatio: 0.3,
    color: '#b03a3a',
  },
};

export function enemyDef(kind: string): EnemyDef {
  const def = ENEMIES[kind];
  if (!def) throw new Error(`しらない てき: ${kind}`);
  return def;
}
