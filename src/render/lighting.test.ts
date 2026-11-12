import { describe, expect, it } from 'vitest';
import { flicker, lightSources } from './lighting';
import type { StageDef } from '../engine/schema';

function stage(mapRows: string[], legend: StageDef['legend'], darkness?: number): StageDef {
  return { cell: 32, mapRows, legend, ...(darkness !== undefined ? { darkness } : {}) } as StageDef;
}

describe('lightSources', () => {
  it('light のある文字の マスごとに、マスの中心と半径を 返す', () => {
    const s = stage(['a.C', 'C.a'], {
      a: { tile: null, walkable: true },
      '.': { tile: null, walkable: true },
      C: { tile: null, walkable: false, light: 40 },
    }, 0.7);
    expect(lightSources(s)).toEqual([
      { x: 80, y: 16, radius: 40 },
      { x: 16, y: 48, radius: 40 },
    ]);
  });

  it('light のある 文字が なければ 空', () => {
    const s = stage(['..'], { '.': { tile: null, walkable: true } }, 0.7);
    expect(lightSources(s)).toEqual([]);
  });

  it('legend が なければ 空', () => {
    expect(lightSources(stage(['..'], undefined))).toEqual([]);
  });
});

describe('flicker', () => {
  it('radius は ±6%、alpha は 0.85〜1 の 範囲で 揺れる', () => {
    for (let t = 0; t <= 10000; t += 100) {
      const f = flicker(72, t, 5);
      expect(f.radius).toBeGreaterThanOrEqual(72 * 0.94 - 1e-9);
      expect(f.radius).toBeLessThanOrEqual(72 * 1.06 + 1e-9);
      expect(f.alpha).toBeGreaterThanOrEqual(0.85 - 1e-9);
      expect(f.alpha).toBeLessThanOrEqual(1 + 1e-9);
    }
  });

  it('同じ 引数なら 同じ 値', () => {
    expect(flicker(72, 1234, 9)).toEqual(flicker(72, 1234, 9));
  });

  it('seed が 違うと t=0 の radius が 違う', () => {
    expect(flicker(72, 0, 1).radius).not.toBe(flicker(72, 0, 2).radius);
  });

  it('時間が たつと 実際に 揺れる（値が 一定でない）', () => {
    const rs = new Set<number>();
    for (let t = 0; t <= 3000; t += 100) rs.add(Math.round(flicker(72, t, 3).radius * 100));
    expect(rs.size).toBeGreaterThan(5);
  });
});
