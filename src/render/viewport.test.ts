import { describe, expect, it } from 'vitest';
import {
  computeViewport, logicalToMap, LOGICAL_H, LOGICAL_W, mapToLogical, MAP_ORIGIN, screenToLogical,
} from './viewport';

describe('computeViewport', () => {
  it('ぴったりの大きさなら等倍・余白なし', () => {
    expect(computeViewport(LOGICAL_W, LOGICAL_H)).toEqual({ scale: 1, offsetX: 0, offsetY: 0 });
  });

  it('よこに広いと左右に余白が付く', () => {
    const vp = computeViewport(LOGICAL_W * 2, LOGICAL_H);
    expect(vp.scale).toBe(1);
    expect(vp.offsetX).toBe(LOGICAL_W / 2);
    expect(vp.offsetY).toBe(0);
  });

  it('たてに高いと上下に余白が付く', () => {
    const vp = computeViewport(LOGICAL_W, LOGICAL_H * 2);
    expect(vp.scale).toBe(1);
    expect(vp.offsetY).toBe(LOGICAL_H / 2);
  });

  it('2 倍の大きさなら scale が 2', () => {
    expect(computeViewport(LOGICAL_W * 2, LOGICAL_H * 2).scale).toBe(2);
  });
});

describe('screenToLogical', () => {
  it('等倍・余白なしならそのまま', () => {
    const vp = computeViewport(LOGICAL_W, LOGICAL_H);
    expect(screenToLogical(vp, 100, 200)).toEqual({ x: 100, y: 200 });
  });

  it('拡大と余白を打ち消す', () => {
    const vp = computeViewport(LOGICAL_W * 2, LOGICAL_H * 4); // scale 2, offsetY (2160-1080)/2
    const p = screenToLogical(vp, 200 * 1 + vp.offsetX, 100 + vp.offsetY);
    expect(p.x).toBeCloseTo(100);
    expect(p.y).toBeCloseTo(50);
  });
});

describe('mapToLogical / logicalToMap', () => {
  it('マップ原点ぶんずれる', () => {
    expect(mapToLogical({ x: 10, y: 20 })).toEqual({ x: 10, y: 20 + MAP_ORIGIN.y });
  });

  it('往復して元に戻る', () => {
    const p = { x: 123, y: 45 };
    expect(logicalToMap(mapToLogical(p))).toEqual(p);
  });
});
