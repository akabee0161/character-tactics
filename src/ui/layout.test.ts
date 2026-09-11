import { describe, expect, it } from 'vitest';
import {
  BOTTOM_PANEL_Y, BTN, MESSAGE_BAR, TALK_WINDOW,
  portraitSlot, roleBadgeIn, rosterSlot, speechLines, stageSlot,
  STAGE_LIST_VIEW, stageListContentH,
} from './layout';
import { LOGICAL_H, LOGICAL_W, MAP_ORIGIN } from '../render/viewport';
import { testRegistry } from '../core/testing';

describe('speechLines', () => {
  it('明示的な改行で分かれる', () => {
    expect(speechLines('あ\nい')).toEqual(['あ', 'い']);
  });

  it('折り返し幅を超えたら折り返す', () => {
    expect(speechLines('あ'.repeat(60)).length).toBeGreaterThan(1);
  });

  it('半角文字は全角の半分の幅で数える', () => {
    // 同じ文字数なら、半角だけの行は全角だけの行より折り返しが少ない
    const half = speechLines('a'.repeat(40)).length;
    const full = speechLines('あ'.repeat(40)).length;
    expect(half).toBeLessThan(full);
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

describe('MESSAGE_BAR', () => {
  it('下パネルの中にある', () => {
    expect(MESSAGE_BAR.y).toBeGreaterThanOrEqual(BOTTOM_PANEL_Y);
    expect(MESSAGE_BAR.y + MESSAGE_BAR.h).toBeLessThanOrEqual(LOGICAL_H);
  });

  it('ポートレートと重ならない', () => {
    expect(MESSAGE_BAR.y + MESSAGE_BAR.h).toBeLessThanOrEqual(portraitSlot(0).y);
  });

  it('画面の横幅に収まる', () => {
    expect(MESSAGE_BAR.x).toBeGreaterThanOrEqual(0);
    expect(MESSAGE_BAR.x + MESSAGE_BAR.w).toBeLessThanOrEqual(LOGICAL_W);
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

describe('ステージ一覧のスクロール', () => {
  it('3本なら 見える範囲に収まる', () => {
    expect(stageListContentH(3)).toBeLessThanOrEqual(STAGE_LIST_VIEW.h);
  });

  it('10本なら あふれる', () => {
    expect(stageListContentH(10)).toBeGreaterThan(STAGE_LIST_VIEW.h);
  });

  it('最終行の下端を含む高さを返す', () => {
    const last = stageSlot(9);
    expect(stageListContentH(10)).toBe(last.y + last.h - STAGE_LIST_VIEW.y);
  });

  it('0本なら 0', () => {
    expect(stageListContentH(0)).toBe(0);
  });

  it('見える範囲は 仲間一覧に かぶらない', () => {
    expect(STAGE_LIST_VIEW.y + STAGE_LIST_VIEW.h).toBeLessThanOrEqual(rosterSlot(0).y);
  });
});
