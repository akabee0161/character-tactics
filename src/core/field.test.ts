import { describe, expect, it } from 'vitest';
import {
  DIAG_COST,
  ORTHO_COST,
  cellCenter,
  cellIndexAt,
  computeFlowField,
  distance,
  distanceToSegment,
  flowDirection,
  isWalkableAt,
  makeGrid,
} from './field';

// '.' = 歩ける / '#' = 歩けない
const MAP = [
  '.....',
  '.###.',
  '.....',
];

describe('makeGrid', () => {
  it('ASCII マップから列数・行数・歩行可否を作る', () => {
    const g = makeGrid(32, MAP);
    expect(g.cols).toBe(5);
    expect(g.rows).toBe(3);
    expect(g.cell).toBe(32);
    expect(g.walkable[0]).toBe(true);
    expect(g.walkable[1 * 5 + 1]).toBe(false);
  });
});

describe('cellIndexAt / cellCenter', () => {
  it('座標からセル番号を求める', () => {
    const g = makeGrid(32, MAP);
    expect(cellIndexAt(g, { x: 0, y: 0 })).toBe(0);
    expect(cellIndexAt(g, { x: 33, y: 33 })).toBe(1 * 5 + 1);
  });

  it('マップ外は -1 を返す', () => {
    const g = makeGrid(32, MAP);
    expect(cellIndexAt(g, { x: -1, y: 0 })).toBe(-1);
    expect(cellIndexAt(g, { x: 0, y: 999 })).toBe(-1);
  });

  it('セル番号から中心座標を求める', () => {
    const g = makeGrid(32, MAP);
    expect(cellCenter(g, 0)).toEqual({ x: 16, y: 16 });
    expect(cellCenter(g, 6)).toEqual({ x: 48, y: 48 });
  });
});

describe('isWalkableAt', () => {
  it('壁の上では false、床の上では true', () => {
    const g = makeGrid(32, MAP);
    expect(isWalkableAt(g, { x: 48, y: 48 })).toBe(false);
    expect(isWalkableAt(g, { x: 16, y: 16 })).toBe(true);
  });

  it('マップ外は false', () => {
    const g = makeGrid(32, MAP);
    expect(isWalkableAt(g, { x: -5, y: -5 })).toBe(false);
  });
});

describe('computeFlowField', () => {
  it('ゴールからのコストを 8 近傍で埋める', () => {
    const g = makeGrid(32, MAP);
    const f = computeFlowField(g, { x: 16, y: 16 }); // セル 0
    expect(f.dist[0]).toBe(0);
    expect(f.dist[1]).toBe(ORTHO_COST);
    expect(f.dist[5]).toBe(ORTHO_COST);
  });

  it('壁は -1 のまま', () => {
    const g = makeGrid(32, MAP);
    const f = computeFlowField(g, { x: 16, y: 16 });
    expect(f.dist[1 * 5 + 1]).toBe(-1);
  });

  it('開けたマップでは斜めが直交2回より安い', () => {
    const g = makeGrid(32, ['.....', '.....', '.....']);
    const f = computeFlowField(g, { x: 16, y: 16 }); // 左上
    expect(f.dist[1 * 5 + 1]).toBe(DIAG_COST);
    expect(f.dist[1 * 5 + 1]).toBeLessThan(ORTHO_COST * 2);
  });

  it('壁の角はすり抜けない（コーナーカット禁止）', () => {
    // セル(1,1) が壁。(0,0) から (2,2) へ斜めに 2 回では行けない
    const g = makeGrid(32, ['...', '.#.', '...']);
    const f = computeFlowField(g, { x: 16, y: 16 });
    expect(f.dist[2 * 3 + 2]).toBeGreaterThan(DIAG_COST * 2);
  });

  it('壁の内側をゴールにしたら全部 -1', () => {
    const g = makeGrid(32, MAP);
    const f = computeFlowField(g, { x: 48, y: 48 });
    expect(Array.from(f.dist).every((d) => d === -1)).toBe(true);
  });
});

describe('flowDirection', () => {
  it('コストが下がる隣へ向かう', () => {
    const g = makeGrid(32, MAP);
    const f = computeFlowField(g, { x: 16, y: 16 });
    const dir = flowDirection(g, f, { x: 144, y: 16 })!; // 右上から左へ
    expect(dir.x).toBeLessThan(0);
  });

  it('開けたマップでは斜めを返す', () => {
    const g = makeGrid(32, ['.....', '.....', '.....']);
    const f = computeFlowField(g, { x: 16, y: 16 }); // 左上
    const dir = flowDirection(g, f, { x: 80, y: 80 })!; // セル(2,2)
    expect(dir.x).toBeLessThan(0);
    expect(dir.y).toBeLessThan(0);
  });

  it('ゴールのセルにいたら null', () => {
    const g = makeGrid(32, MAP);
    const f = computeFlowField(g, { x: 16, y: 16 });
    expect(flowDirection(g, f, { x: 16, y: 16 })).toBeNull();
  });

  it('到達できないセルからは null', () => {
    const g = makeGrid(32, MAP);
    const f = computeFlowField(g, { x: 16, y: 16 });
    expect(flowDirection(g, f, { x: 48, y: 48 })).toBeNull();
  });
});

describe('distance / distanceToSegment', () => {
  it('2点間の距離', () => {
    expect(distance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
  });

  it('線分の途中がいちばん近いとき', () => {
    expect(distanceToSegment({ x: 5, y: 3 }, { x: 0, y: 0 }, { x: 10, y: 0 })).toBe(3);
  });

  it('線分の端の外側にあるとき', () => {
    expect(distanceToSegment({ x: -4, y: 0 }, { x: 0, y: 0 }, { x: 10, y: 0 })).toBe(4);
  });

  it('線分が点に潰れているとき', () => {
    expect(distanceToSegment({ x: 0, y: 5 }, { x: 0, y: 0 }, { x: 0, y: 0 })).toBe(5);
  });
});
