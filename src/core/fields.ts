import { cellIndexAt, computeFlowField } from './field';
import type { FlowField, Grid, Unit, Vec2 } from './types';

/**
 * BFS の実行回数を「プレイヤーユニットのセル移動時」＋「静的ゴールの初回」に抑える。
 * 保持する枚数もユニット数と静的ゴール数の和で固定され、増え続けない。
 */
export type FieldCache = {
  byUnit: Map<string, { cell: number; field: FlowField }>;
  /** キーはゴールのセル index */
  static: Map<number, FlowField>;
};

export function makeFieldCache(): FieldCache {
  return { byUnit: new Map(), static: new Map() };
}

export function fieldToUnit(cache: FieldCache, grid: Grid, target: Unit): FlowField {
  const cell = cellIndexAt(grid, target.pos);
  const cached = cache.byUnit.get(target.uid);
  if (cached && cached.cell === cell) return cached.field;

  const field = computeFlowField(grid, target.pos);
  cache.byUnit.set(target.uid, { cell, field });
  return field;
}

export function fieldToStatic(cache: FieldCache, grid: Grid, goal: Vec2): FlowField {
  const cell = cellIndexAt(grid, goal);
  const cached = cache.static.get(cell);
  if (cached) return cached;

  const field = computeFlowField(grid, goal);
  cache.static.set(cell, field);
  return field;
}

export function dropUnitField(cache: FieldCache, uid: string): void {
  cache.byUnit.delete(uid);
}
