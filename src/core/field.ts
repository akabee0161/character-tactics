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

const NEIGHBORS: readonly [number, number][] = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

export function computeFlowField(grid: Grid, goal: Vec2): FlowField {
  const dist = new Int32Array(grid.cols * grid.rows).fill(-1);
  const start = cellIndexAt(grid, goal);
  const field: FlowField = { cols: grid.cols, rows: grid.rows, dist };
  if (start < 0 || grid.walkable[start] !== true) return field;

  dist[start] = 0;
  const queue: number[] = [start];
  for (let head = 0; head < queue.length; head++) {
    const cur = queue[head]!;
    const cx = cur % grid.cols;
    const cy = Math.floor(cur / grid.cols);
    for (const [dx, dy] of NEIGHBORS) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (nx < 0 || ny < 0 || nx >= grid.cols || ny >= grid.rows) continue;
      const ni = ny * grid.cols + nx;
      if (grid.walkable[ni] !== true) continue;
      if (dist[ni] !== -1) continue;
      dist[ni] = dist[cur]! + 1;
      queue.push(ni);
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
    const nx = cx + dx;
    const ny = cy + dy;
    if (nx < 0 || ny < 0 || nx >= grid.cols || ny >= grid.rows) continue;
    const ni = ny * grid.cols + nx;
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
