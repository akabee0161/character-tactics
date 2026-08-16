import { describe, expect, it } from 'vitest';
import {
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
  it('ゴールの距離は 0、隣接セルは 1', () => {
    const g = makeGrid(32, MAP);
    const f = computeFlowField(g, { x: 16, y: 16 }); // セル 0
    expect(f.dist[0]).toBe(0);
    expect(f.dist[1]).toBe(1);
    expect(f.dist[5]).toBe(1);
  });

  it('壁セルは到達不能の -1 のまま', () => {
    const g = makeGrid(32, MAP);
    const f = computeFlowField(g, { x: 16, y: 16 });
    expect(f.dist[1 * 5 + 1]).toBe(-1);
  });

  it('壁を回り込んだ距離になる', () => {
    const g = makeGrid(32, MAP);
    const f = computeFlowField(g, { x: 16, y: 16 }); // 左上
    // 右上(セル4)へは上段をまっすぐ4歩
    expect(f.dist[4]).toBe(4);
    // 中央下(セル11)へは左端を下って右へ、で 3歩
    expect(f.dist[2 * 5 + 1]).toBe(3);
  });

  it('壁の中をゴールに指定すると全セル到達不能になる', () => {
    const g = makeGrid(32, MAP);
    const f = computeFlowField(g, { x: 48, y: 48 });
    expect(Array.from(f.dist).every((d) => d === -1)).toBe(true);
  });
});

describe('flowDirection', () => {
  it('距離が減る隣へ向かう単位ベクトルを返す', () => {
    const g = makeGrid(32, MAP);
    const f = computeFlowField(g, { x: 16, y: 16 });
    const dir = flowDirection(g, f, { x: 144, y: 16 }); // 右上から左へ
    expect(dir).not.toBeNull();
    expect(dir!.x).toBeCloseTo(-1);
    expect(dir!.y).toBeCloseTo(0);
  });

  it('ゴールに着いていたら null', () => {
    const g = makeGrid(32, MAP);
    const f = computeFlowField(g, { x: 16, y: 16 });
    expect(flowDirection(g, f, { x: 16, y: 16 })).toBeNull();
  });

  it('到達不能な場所にいたら null', () => {
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
