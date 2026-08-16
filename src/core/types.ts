export type Vec2 = { x: number; y: number };

export type CharId = 'roran' | 'ines' | 'mist' | 'gau';
export type EnemyKind = 'narazumono' | 'tatemochi' | 'garum';
export type SkillId = 'funbaru' | 'neraiuchi' | 'omajinai' | 'kakenukeru';
export type AttackKind = 'melee' | 'bow';

export const CHAR_IDS: readonly CharId[] = ['roran', 'ines', 'mist', 'gau'];

export type Grid = {
  cols: number;
  rows: number;
  cell: number;
  walkable: boolean[];
};

export type FlowField = {
  cols: number;
  rows: number;
  /** ゴールからのセル距離。-1 は到達不能 */
  dist: Int32Array;
};
