import { describe, expect, it } from 'vitest';
import { bubbleRectAt } from './layout';

describe('bubbleRectAt', () => {
  it('キャラの まうえに でる', () => {
    const r = bubbleRectAt({ x: 480, y: 300 }, 'あいう');
    expect(r.x + r.w / 2).toBeCloseTo(480);
    expect(r.y + r.h).toBeLessThan(300);  // キャラより上
  });

  it('もじすうに おうじて はばが かわる', () => {
    const narrow = bubbleRectAt({ x: 480, y: 300 }, 'あ');
    const wide = bubbleRectAt({ x: 480, y: 300 }, 'あいうえおかきくけこ');
    expect(wide.w).toBeGreaterThan(narrow.w);
  });

  it('ぎょうすうに おうじて たかさが かわる', () => {
    const one = bubbleRectAt({ x: 480, y: 300 }, 'あ');
    const two = bubbleRectAt({ x: 480, y: 300 }, 'あ\nい');
    expect(two.h).toBeGreaterThan(one.h);
  });

  it('ひだりはしで はみださない', () => {
    expect(bubbleRectAt({ x: 0, y: 300 }, 'あいうえお').x).toBeGreaterThanOrEqual(8);
  });

  it('みぎはしで はみださない', () => {
    const r = bubbleRectAt({ x: 960, y: 300 }, 'あいうえお');
    expect(r.x + r.w).toBeLessThanOrEqual(952);
  });

  it('うえはしで はみださない', () => {
    expect(bubbleRectAt({ x: 480, y: 0 }, 'あ').y).toBeGreaterThanOrEqual(52);
  });
});
