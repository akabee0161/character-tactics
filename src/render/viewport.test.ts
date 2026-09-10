import { describe, expect, it } from 'vitest';
import {
  computeViewport, fitCanvas, logicalToMap, LOGICAL_H, LOGICAL_W, mapToLogical, MAP_ORIGIN, screenToLogical,
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
    expect(mapToLogical({ x: 10, y: 20 })).toEqual({ x: 10 + MAP_ORIGIN.x, y: 20 + MAP_ORIGIN.y });
  });

  it('往復して元に戻る', () => {
    const p = { x: 123, y: 45 };
    expect(logicalToMap(mapToLogical(p))).toEqual(p);
  });
});

describe('たてがたの ろんりかいぞうど', () => {
  it('たてながである', () => {
    expect(LOGICAL_W).toBe(540);
    expect(LOGICAL_H).toBe(945);
  });

  it('マップは じょうほうバーの したから はじまる', () => {
    expect(MAP_ORIGIN).toEqual({ x: 14, y: 50 });
  });

  it('mapToLogical と logicalToMap は ぎゃくの かんけい', () => {
    const p = { x: 100, y: 200 };
    expect(logicalToMap(mapToLogical(p))).toEqual(p);
  });
});

describe('fitCanvas', () => {
  it('縦に余裕があるときは幅が決め手になる', () => {
    expect(fitCanvas(540, 2000, 1)).toEqual({ cssW: 540, cssH: 945 });
  });

  it('横に余裕があるときは高さが決め手になる', () => {
    expect(fitCanvas(2000, 945, 1)).toEqual({ cssW: 540, cssH: 945 });
  });

  it('拡大率が1を超えても縦横比を保つ', () => {
    // 1920x1080 は高さが決め手。945 -> 1080 の 1.1428 倍
    const fit = fitCanvas(1920, 1080, 1);
    expect(fit.cssH).toBe(1080);
    expect(fit.cssW).toBe(617);
    // 540/945 = 0.5714。1px 未満のずれだけに収まること
    expect(Math.abs(fit.cssW / fit.cssH - LOGICAL_W / LOGICAL_H)).toBeLessThan(0.001);
  });
});
