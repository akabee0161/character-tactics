import type { AttackKind } from '../core/types';

export const MELEE_RANGE = 24;
export const BOW_RANGE = 160;

export type CharDef = {
  id: string;
  name: string;
  role: string;
  maxHp: number;
  power: number;
  guard: number;
  attack: AttackKind;
  range: number;
  attackInterval: number;
  speed: number;
  skill: string;
  color: string;
};

export const CHARACTERS: Record<string, CharDef> = {
  roran: {
    id: 'roran', name: 'ロラン', role: 'たて',
    maxHp: 30, power: 6, guard: 5,
    attack: 'melee', range: MELEE_RANGE, attackInterval: 1.6, speed: 60,
    skill: 'funbaru', color: '#4a80c8',
  },
  ines: {
    id: 'ines', name: 'イネス', role: 'ゆみ',
    maxHp: 20, power: 8, guard: 2,
    attack: 'bow', range: BOW_RANGE, attackInterval: 2.2, speed: 60,
    skill: 'neraiuchi', color: '#3faa6a',
  },
  mist: {
    id: 'mist', name: 'ミスト', role: 'いやし',
    maxHp: 22, power: 4, guard: 3,
    attack: 'melee', range: MELEE_RANGE, attackInterval: 1.6, speed: 60,
    skill: 'omajinai', color: '#c86fb0',
  },
  gau: {
    id: 'gau', name: 'ガウ', role: 'ものみ',
    maxHp: 24, power: 7, guard: 3,
    attack: 'melee', range: MELEE_RANGE, attackInterval: 1.6, speed: 100,
    skill: 'kakenukeru', color: '#e0a03c',
  },
};

/** CHAR_IDS の置き換え。Task 10 でレジストリに移り、このファイルごと消える */
export const ALL_CHAR_IDS: readonly string[] = Object.keys(CHARACTERS);

export function charDef(id: string): CharDef {
  const def = CHARACTERS[id];
  if (!def) throw new Error(`しらない キャラ: ${id}`);
  return def;
}
