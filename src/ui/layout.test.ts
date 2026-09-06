import { describe, expect, it } from 'vitest';
import { BUBBLE_FONT_PX, BUBBLE_LINE_H, BUBBLE_PAD, bubbleLines, bubbleRectAt } from './layout';
import { LOGICAL_W } from '../render/viewport';

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
    const r = bubbleRectAt({ x: LOGICAL_W, y: 300 }, 'あいうえお');
    expect(r.x + r.w).toBeLessThanOrEqual(LOGICAL_W - 8);
  });

  it('うえはしで はみださない', () => {
    expect(bubbleRectAt({ x: 480, y: 0 }, 'あ').y).toBeGreaterThanOrEqual(52);
  });
});

describe('bubbleLines', () => {
  it('みじかい せりふは そのまま 1ぎょう', () => {
    expect(bubbleLines('ここは とおさない')).toEqual(['ここは とおさない']);
  });

  it('\\n で きられる', () => {
    expect(bubbleLines('あい\nうえ')).toEqual(['あい', 'うえ']);
  });

  it('ながい せりふは おりかえす', () => {
    const long = 'あ'.repeat(30);
    const lines = bubbleLines(long);
    expect(lines.length).toBeGreaterThan(1);
    expect(lines.join('')).toBe(long);  // 文字を落とさない
  });
});

describe('bubbleRectAt と bubbleLines の せいごうせい', () => {
  /** 折り返し後の行がすべて矩形の内側に収まっていること。ここがずれると
   *  見えている文字と当たり判定が食い違う */
  const fits = (text: string): boolean => {
    const r = bubbleRectAt({ x: 480, y: 300 }, text);
    return bubbleLines(text).every(
      (line) => BUBBLE_PAD + line.length * BUBBLE_FONT_PX + BUBBLE_PAD <= r.w,
    );
  };

  it('ながい せりふでも もじが わくから はみださない', () => {
    expect(fits('あ'.repeat(30))).toBe(true);
  });

  it('ぎょうとうきんそくで ぶらさがっても はみださない', () => {
    expect(fits(`${'あ'.repeat(18)}。かきくけこ`)).toBe(true);
  });

  it('たかさが おりかえしごの ぎょうすうに あう', () => {
    const text = 'あ'.repeat(30);
    const r = bubbleRectAt({ x: 480, y: 300 }, text);
    expect(r.h).toBe(bubbleLines(text).length * BUBBLE_LINE_H + BUBBLE_PAD * 2);
  });
});
