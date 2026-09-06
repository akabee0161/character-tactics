import { describe, expect, it } from 'vitest';
import {
  BOTTOM_PANEL_Y, BTN, BUBBLE_FONT_PX, BUBBLE_LINE_H, BUBBLE_PAD, SKILL_BUTTON, TALK_WINDOW,
  bubbleLines, bubbleRectAt, portraitSlot, roleBadgeIn, rosterSlot, stageSlot,
} from './layout';
import { LOGICAL_H, LOGICAL_W, MAP_ORIGIN } from '../render/viewport';
import { testRegistry } from '../core/testing';

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

const inScreen = (r: { x: number; y: number; w: number; h: number }): boolean =>
  r.x >= 0 && r.y >= 0 && r.x + r.w <= LOGICAL_W && r.y + r.h <= LOGICAL_H;

describe('たてがたの レイアウト', () => {
  it('したパネルは マップの したに ある', () => {
    expect(BOTTOM_PANEL_Y).toBe(MAP_ORIGIN.y + 23 * 32);
  });

  it('ポートレート 4まいが がめんに おさまる', () => {
    for (let i = 0; i < 4; i++) expect(inScreen(portraitSlot(i))).toBe(true);
  });

  it('ポートレートどうしが かさならない', () => {
    for (let i = 1; i < 4; i++) {
      const prev = portraitSlot(i - 1);
      expect(portraitSlot(i).x).toBeGreaterThanOrEqual(prev.x + prev.w);
    }
  });

  it('ひっさつわざボタンは したパネルの なかで ポートレートと かさならない', () => {
    expect(inScreen(SKILL_BUTTON)).toBe(true);
    expect(SKILL_BUTTON.y).toBeGreaterThanOrEqual(BOTTOM_PANEL_Y);
    expect(SKILL_BUTTON.y + SKILL_BUTTON.h).toBeLessThanOrEqual(portraitSlot(0).y);
  });

  it('かいわウィンドウと ボタンが がめんに おさまる', () => {
    expect(inScreen(TALK_WINDOW)).toBe(true);
    for (const r of Object.values(BTN)) expect(inScreen(r)).toBe(true);
  });

  it('とばすボタンは かいわウィンドウと かさならない', () => {
    expect(BTN.skip.y + BTN.skip.h).toBeLessThanOrEqual(TALK_WINDOW.y);
  });

  it('ステージスロットは 2れつ で がめんに おさまる', () => {
    expect(stageSlot(0).y).toBe(stageSlot(1).y);       // 同じ行
    expect(stageSlot(2).y).toBeGreaterThan(stageSlot(0).y); // 3つめは次の行
    for (let i = 0; i < 6; i++) expect(inScreen(stageSlot(i))).toBe(true);
  });

  it('ロスターは 1れつ で ならぶ', () => {
    for (let i = 0; i < 4; i++) expect(inScreen(rosterSlot(i))).toBe(true);
    expect(rosterSlot(1).x).toBe(rosterSlot(0).x);
    expect(rosterSlot(1).y).toBeGreaterThan(rosterSlot(0).y);
  });

  it('クラスの わくは ポートレートの なかに ある', () => {
    const slot = portraitSlot(0);
    const badge = roleBadgeIn(slot);
    expect(badge.x).toBeGreaterThanOrEqual(slot.x);
    expect(badge.y).toBeGreaterThanOrEqual(slot.y);
    expect(badge.x + badge.w).toBeLessThanOrEqual(slot.x + slot.w);
    expect(badge.y + badge.h).toBeLessThanOrEqual(slot.y + slot.h);
  });

  it('クラスの わくは HPバーと かさならない', () => {
    const slot = portraitSlot(0);
    // drawBottomBar は HP バーを slot.y + 60 に描く
    expect(roleBadgeIn(slot).y + roleBadgeIn(slot).h).toBeLessThanOrEqual(slot.y + 60);
  });
});

describe('ステージが マップりょういきに おさまる', () => {
  for (const stage of testRegistry().stages) {
    it(`${stage.id} が はみださない`, () => {
      const w = (stage.mapRows[0]?.length ?? 0) * stage.cell;
      const h = stage.mapRows.length * stage.cell;
      expect(MAP_ORIGIN.x + w).toBeLessThanOrEqual(LOGICAL_W);
      expect(MAP_ORIGIN.y + h).toBeLessThanOrEqual(BOTTOM_PANEL_Y);
    });
  }
});
