import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  BOTTOM_PANEL_Y, BTN, FACE_PX, MESSAGE_BAR, SPEECH_BODY_X, SPEECH_MAX_LINES, TALK_WINDOW,
  hpBarIn, portraitSlot, resultSlot, roleBadgeIn, rosterSlot, speechLines, stageSlot,
  STAGE_LIST_VIEW, stageListContentH,
} from './layout';
import { MAX_PARTY } from '../core/constants';
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

  it('8 枠とも画面に収まり重ならない', () => {
    for (let i = 0; i < MAX_PARTY; i++) expect(inScreen(portraitSlot(i))).toBe(true);
    for (let i = 1; i < MAX_PARTY; i++) {
      const prev = portraitSlot(i - 1);
      expect(portraitSlot(i).x).toBeGreaterThanOrEqual(prev.x + prev.w);
      expect(portraitSlot(i).y).toBe(prev.y);
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

  it('仲間の一覧 8 人が画面に収まる（2 列）', () => {
    for (let i = 0; i < MAX_PARTY; i++) expect(inScreen(rosterSlot(i))).toBe(true);
    expect(rosterSlot(1).y).toBe(rosterSlot(0).y);
    expect(rosterSlot(1).x).toBeGreaterThanOrEqual(rosterSlot(0).x + rosterSlot(0).w);
    expect(rosterSlot(2).y).toBeGreaterThanOrEqual(rosterSlot(0).y + rosterSlot(0).h);
  });

  it('リザルトの 8 行が次へのボタン（BTN.next）にかからない', () => {
    for (let i = 0; i < MAX_PARTY; i++) {
      const r = resultSlot(i);
      expect(inScreen(r)).toBe(true);
      expect(r.y + r.h).toBeLessThanOrEqual(BTN.next.y);
    }
    expect(resultSlot(7).y + resultSlot(7).h).toBeLessThanOrEqual(450);
    expect(resultSlot(1).x).toBeGreaterThanOrEqual(resultSlot(0).x + resultSlot(0).w);
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
    expect(roleBadgeIn(slot).y + roleBadgeIn(slot).h).toBeLessThanOrEqual(hpBarIn(slot).y);
  });

  it('クラスの わくは 16px の角', () => {
    expect(roleBadgeIn(portraitSlot(0)).h).toBe(16);
    expect(roleBadgeIn(portraitSlot(0)).w).toBe(16);
  });

  it('顔（40px）は枠の内側で、HPバーの上', () => {
    const slot = portraitSlot(0);
    expect(FACE_PX.panel).toBe(40);
    expect(slot.x + 4 + FACE_PX.panel).toBeLessThanOrEqual(slot.x + slot.w);
    expect(slot.y + 6 + FACE_PX.panel).toBeLessThanOrEqual(hpBarIn(slot).y);
  });

  it('HPバーは ポートレートの なかに ある', () => {
    const slot = portraitSlot(0);
    const bar = hpBarIn(slot);
    expect(bar.x).toBeGreaterThanOrEqual(slot.x);
    expect(bar.x + bar.w).toBeLessThanOrEqual(slot.x + slot.w);
    expect(bar.y + bar.h).toBeLessThanOrEqual(slot.y + slot.h);
  });

  it('HPバーは 技の ゲージと かさならない', () => {
    const slot = portraitSlot(0);
    // 技のゲージは HP バーの 1px 下、高さ 5。枠の内側に収まる
    expect(hpBarIn(slot).y + hpBarIn(slot).h + 1 + 5).toBeLessThanOrEqual(slot.y + slot.h);
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

  it('64px の顔が枠線（2px）の内側に収まる高さ', () => {
    expect(MESSAGE_BAR.h).toBeGreaterThanOrEqual(FACE_PX.large + 4);
  });

  it('本文は顔の右から始まる', () => {
    // drawSpeechBar は顔の中心を x+36 に置く
    expect(SPEECH_BODY_X).toBeGreaterThanOrEqual(36 + FACE_PX.large / 2 + 8);
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

describe('FACE_PX', () => {
  it('顔の枠は 64px と、その半分の 32px の2通り', () => {
    expect(FACE_PX.large).toBe(64);
    expect(FACE_PX.small).toBe(FACE_PX.large / 2);
  });
});

describe('戦闘中のセリフ', () => {
  it('assets/lines のセリフは、どれもセリフ欄の行数に収まる', () => {
    const dir = 'assets/lines';
    for (const name of readdirSync(dir)) {
      if (!name.endsWith('.json')) continue;
      const lines = JSON.parse(readFileSync(join(dir, name), 'utf8')) as Record<string, string>;
      for (const [key, text] of Object.entries(lines)) {
        expect(speechLines(text).length, `${name} の ${key}`).toBeLessThanOrEqual(SPEECH_MAX_LINES);
      }
    }
  });
});
