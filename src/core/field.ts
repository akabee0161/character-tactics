import type { FlowField, Grid, Vec2 } from './types';

export function makeGrid(cell: number, rows: string[]): Grid {
  const r = rows.length;
  const c = rows[0]?.length ?? 0;
  const walkable = new Array<boolean>(c * r);
  for (let y = 0; y < r; y++) {
    const line = rows[y] ?? '';
    if (line.length !== c) {
      throw new Error(`grid row ${y} has length ${line.length}, expected ${c}`);
    }
    for (let x = 0; x < c; x++) {
      walkable[y * c + x] = line[x] !== '#';
    }
  }
  return { cols: c, rows: r, cell, walkable };
}

export function cellIndexAt(grid: Grid, pos: Vec2): number {
  const cx = Math.floor(pos.x / grid.cell);
  const cy = Math.floor(pos.y / grid.cell);
  if (cx < 0 || cy < 0 || cx >= grid.cols || cy >= grid.rows) return -1;
  return cy * grid.cols + cx;
}

export function cellCenter(grid: Grid, index: number): Vec2 {
  const cx = index % grid.cols;
  const cy = Math.floor(index / grid.cols);
  return { x: cx * grid.cell + grid.cell / 2, y: cy * grid.cell + grid.cell / 2 };
}

export function isWalkableAt(grid: Grid, pos: Vec2): boolean {
  const i = cellIndexAt(grid, pos);
  return i >= 0 && grid.walkable[i] === true;
}

/** セル距離を整数で持つためのスケール。斜めは √2 ≒ 1.4 倍 */
export const ORTHO_COST = 10;
export const DIAG_COST = 14;

const NEIGHBORS: readonly [number, number, number][] = [
  [1, 0, ORTHO_COST],
  [-1, 0, ORTHO_COST],
  [0, 1, ORTHO_COST],
  [0, -1, ORTHO_COST],
  [1, 1, DIAG_COST],
  [1, -1, DIAG_COST],
  [-1, 1, DIAG_COST],
  [-1, -1, DIAG_COST],
];

/** 斜めに進むには両隣のセルも歩けること。これがないと壁の角をすり抜ける */
function canStep(grid: Grid, cx: number, cy: number, dx: number, dy: number): boolean {
  const nx = cx + dx;
  const ny = cy + dy;
  if (nx < 0 || ny < 0 || nx >= grid.cols || ny >= grid.rows) return false;
  if (grid.walkable[ny * grid.cols + nx] !== true) return false;
  if (dx !== 0 && dy !== 0) {
    if (grid.walkable[cy * grid.cols + nx] !== true) return false;
    if (grid.walkable[ny * grid.cols + cx] !== true) return false;
  }
  return true;
}

export function computeFlowField(grid: Grid, goal: Vec2): FlowField {
  const n = grid.cols * grid.rows;
  const dist = new Int32Array(n).fill(-1);
  const field: FlowField = { cols: grid.cols, rows: grid.rows, dist };
  const start = cellIndexAt(grid, goal);
  if (start < 0 || grid.walkable[start] !== true) return field;

  // グリッドは最大でも 30x14 なので、優先度キューは持たず素朴に最小値を線形探索する
  const settled = new Uint8Array(n);
  dist[start] = 0;
  for (;;) {
    let cur = -1;
    let curDist = Infinity;
    for (let i = 0; i < n; i++) {
      const d = dist[i]!;
      if (settled[i] === 1 || d < 0 || d >= curDist) continue;
      curDist = d;
      cur = i;
    }
    if (cur < 0) break;
    settled[cur] = 1;

    const cx = cur % grid.cols;
    const cy = Math.floor(cur / grid.cols);
    for (const [dx, dy, cost] of NEIGHBORS) {
      if (!canStep(grid, cx, cy, dx, dy)) continue;
      const ni = (cy + dy) * grid.cols + (cx + dx);
      if (settled[ni] === 1) continue;
      const nd = curDist + cost;
      if (dist[ni]! < 0 || nd < dist[ni]!) dist[ni] = nd;
    }
  }
  return field;
}

export function flowDirection(grid: Grid, field: FlowField, pos: Vec2): Vec2 | null {
  const cur = cellIndexAt(grid, pos);
  if (cur < 0) return null;
  const curDist = field.dist[cur];
  if (curDist === undefined || curDist < 0) return null;
  if (curDist === 0) return null;

  const cx = cur % grid.cols;
  const cy = Math.floor(cur / grid.cols);
  let best = -1;
  let bestDist = curDist;
  for (const [dx, dy] of NEIGHBORS) {
    if (!canStep(grid, cx, cy, dx, dy)) continue;
    const ni = (cy + dy) * grid.cols + (cx + dx);
    const d = field.dist[ni];
    if (d === undefined || d < 0) continue;
    if (d < bestDist) {
      bestDist = d;
      best = ni;
    }
  }
  if (best < 0) return null;
  const target = cellCenter(grid, best);
  const dx = target.x - pos.x;
  const dy = target.y - pos.y;
  const len = Math.hypot(dx, dy);
  if (len === 0) return null;
  return { x: dx / len, y: dy / len };
}

export function distance(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function distanceToSegment(p: Vec2, a: Vec2, b: Vec2): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return distance(p, a);
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  return distance(p, { x: a.x + t * dx, y: a.y + t * dy });
}
