import { FOOT_BELOW, FOOT_HALF_W, footCorners } from '../engine/footprint';
import type { FlowField, Grid, Legend, Vec2 } from './types';

/** legend を渡さなければ '#' だけが歩けない（legend の無いステージとテストの既定）。速さの倍率は legend の speed、無ければ 1 */
export function makeGrid(cell: number, rows: string[], legend?: Legend): Grid {
  const r = rows.length;
  const c = rows[0]?.length ?? 0;
  const walkable = new Array<boolean>(c * r);
  const speed = new Array<number>(c * r);
  for (let y = 0; y < r; y++) {
    const line = rows[y] ?? '';
    if (line.length !== c) {
      throw new Error(`grid row ${y} has length ${line.length}, expected ${c}`);
    }
    for (let x = 0; x < c; x++) {
      const ch = line[x]!;
      walkable[y * c + x] = legend ? legend[ch]?.walkable === true : ch !== '#';
      speed[y * c + x] = legend?.[ch]?.speed ?? 1;
    }
  }
  return { cols: c, rows: r, cell, walkable, speed };
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

/** 足元の点のマスでの移動の速さの倍率。マップの外は 1 */
export function speedAt(grid: Grid, pos: Vec2): number {
  const i = cellIndexAt(grid, pos);
  return i < 0 ? 1 : (grid.speed[i] ?? 1);
}

/** 足元の箱（engine/footprint.ts）の四隅が、すべて通れるマスの中にあるか。マップの外は通れない扱い */
export function fitsAt(grid: Grid, pos: Vec2): boolean {
  return footCorners(pos).every((c) => isWalkableAt(grid, c));
}

/**
 * 箱が収まらない位置を、同じマスの中で箱が収まる位置へ寄せる。
 * 横だけ・縦だけ・両方を寄せた候補のうち、収まって元の位置に最も近いもの。
 * どれも収まらなければマスの中心（通れるマスの中心には必ず収まる）。マス自体が通れなければ null
 */
export function fitInCell(grid: Grid, pos: Vec2): Vec2 | null {
  const i = cellIndexAt(grid, pos);
  if (i < 0 || grid.walkable[i] !== true) return null;
  if (fitsAt(grid, pos)) return { ...pos };
  const left = (i % grid.cols) * grid.cell;
  const top = Math.floor(i / grid.cols) * grid.cell;
  const x = Math.min(Math.max(pos.x, left + FOOT_HALF_W), left + grid.cell - FOOT_HALF_W);
  const y = Math.min(pos.y, top + grid.cell - FOOT_BELOW);
  const fitting = [{ x, y: pos.y }, { x: pos.x, y }, { x, y }]
    .filter((p) => fitsAt(grid, p))
    .sort((a, b) => distance(a, pos) - distance(b, pos));
  return fitting[0] ?? cellCenter(grid, i);
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

/**
 * from から to へ、足元の箱ごと直進できるか。箱の四隅から引いた4本の線を hasLineOfSight で確かめる。
 * 「見えるか」の判定（ai.ts・autoclose.ts）は1本の線のままでよいので、移動にだけ使う
 */
export function hasClearPath(grid: Grid, from: Vec2, to: Vec2): boolean {
  const a = footCorners(from);
  const b = footCorners(to);
  return a.every((c, k) => hasLineOfSight(grid, c, b[k]!));
}

/**
 * from から to への1歩を、足元の箱が収まるように直す（壁に沿って横すべりする）。
 * 候補は x だけ・y だけの移動と、to を同じマスの中で箱が収まる位置へ寄せた点（寄せる量が1歩ぶん以内のとき）。
 * 箱が収まり、from からの途中でも箱が壁にかからない（hasClearPath）候補のうち to に最も近いものを返し、
 * どれも from より近くなければ from。両端だけを見ると、1歩のあいだに箱が壁の角をかすめる動きを通してしまう。
 * 寄せた点を候補に入れるのは、足元が境界から数px食い込んでいるだけで横へ進めず、
 * 縦の成分でしか近づけないまま止まるのを防ぐため。寄せた点だけは、まっすぐでなくても
 * 縦→横の2段で壁にかからずに行けるなら選ぶ（まっすぐだけにすると、寄せる動きが壁の角で塞がれて止まる）。
 * from 自体に箱が収まらないとき（テストで置いた位置など）は、閉じ込めないよう足元の1点で判定する
 */
export function slideStep(grid: Grid, from: Vec2, to: Vec2): Vec2 {
  if (!fitsAt(grid, from)) return isWalkableAt(grid, to) ? { ...to } : { ...from };
  const reachable = (p: Vec2): boolean => fitsAt(grid, p) && hasClearPath(grid, from, p);
  if (reachable(to)) return { ...to };
  const candidates = [{ x: to.x, y: from.y }, { x: from.x, y: to.y }].filter(reachable);
  const nudged = fitInCell(grid, to);
  if (nudged && distance(to, nudged) <= distance(from, to) && fitsAt(grid, nudged)) {
    const corner = { x: from.x, y: nudged.y };
    const inTwo = hasClearPath(grid, from, corner) && hasClearPath(grid, corner, nudged);
    if (hasClearPath(grid, from, nudged) || inTwo) candidates.push(nudged);
  }
  let best = { ...from };
  for (const p of candidates) {
    if (distance(p, to) < distance(best, to)) best = p;
  }
  return best;
}

/**
 * 移動先の置き換え。dest が歩けるマスなら、足元の箱が収まる位置へ寄せて返す（fitInCell）。
 * 歩けなければ（マップの外を含む）、from からたどり着けるマスのうち dest に最も近いマスの中心を返す。
 * 近さが同じならフローフィールドの距離が短い方。たどり着けるマスが無ければ null
 */
export function resolveMoveDest(grid: Grid, from: Vec2, dest: Vec2): Vec2 | null {
  const fitted = fitInCell(grid, dest);
  if (fitted) return fitted;
  const field = computeFlowField(grid, from);
  let best = -1;
  let bestDist = Infinity;
  let bestFlow = Infinity;
  for (let i = 0; i < field.dist.length; i++) {
    const flow = field.dist[i]!;
    if (flow < 0) continue;
    const d = distance(cellCenter(grid, i), dest);
    if (d < bestDist - 1e-9 || (Math.abs(d - bestDist) <= 1e-9 && flow < bestFlow)) {
      best = i;
      bestDist = d;
      bestFlow = flow;
    }
  }
  return best < 0 ? null : cellCenter(grid, best);
}

export function distance(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/**
 * 2点を結ぶ線分がすべて歩けるセルの上を通るか。
 * DDA で線分が通過するセルを漏れなく列挙し、対角に隣のセルへ移る瞬間は
 * 両側の直交セルも歩行可能か確認する（computeFlowField の canStep と同じ理由で、
 * 壁の角をかすめてすり抜けるのを禁止する）。
 */
export function hasLineOfSight(grid: Grid, from: Vec2, to: Vec2): boolean {
  const walkableCell = (x: number, y: number): boolean =>
    x >= 0 && y >= 0 && x < grid.cols && y < grid.rows && grid.walkable[y * grid.cols + x] === true;

  let cx = Math.floor(from.x / grid.cell);
  let cy = Math.floor(from.y / grid.cell);
  const ex = Math.floor(to.x / grid.cell);
  const ey = Math.floor(to.y / grid.cell);
  if (!walkableCell(cx, cy)) return false;

  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const stepX = dx > 0 ? 1 : dx < 0 ? -1 : 0;
  const stepY = dy > 0 ? 1 : dy < 0 ? -1 : 0;

  let tMaxX = stepX !== 0 ? ((cx + (stepX > 0 ? 1 : 0)) * grid.cell - from.x) / dx : Infinity;
  let tMaxY = stepY !== 0 ? ((cy + (stepY > 0 ? 1 : 0)) * grid.cell - from.y) / dy : Infinity;
  const tDeltaX = stepX !== 0 ? grid.cell / Math.abs(dx) : Infinity;
  const tDeltaY = stepY !== 0 ? grid.cell / Math.abs(dy) : Infinity;
  const EPS = 1e-9;

  while (cx !== ex || cy !== ey) {
    if (Math.abs(tMaxX - tMaxY) < EPS) {
      // 両方の境界を同時に跨ぐ = 格子点(壁の角)を通過する対角遷移
      const nx = cx + stepX;
      const ny = cy + stepY;
      if (!walkableCell(nx, ny) || !walkableCell(cx, ny) || !walkableCell(nx, cy)) return false;
      cx = nx;
      cy = ny;
      tMaxX += tDeltaX;
      tMaxY += tDeltaY;
    } else if (tMaxX < tMaxY) {
      cx += stepX;
      if (!walkableCell(cx, cy)) return false;
      tMaxX += tDeltaX;
    } else {
      cy += stepY;
      if (!walkableCell(cx, cy)) return false;
      tMaxY += tDeltaY;
    }
  }
  return true;
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
