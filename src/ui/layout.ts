import { wrapText } from './talk';
import { LOGICAL_W } from '../render/viewport';
import type { Rect } from './hit';
import type { Vec2 } from '../core/types';

/** 下パネルの上端。マップ領域(MAP_ORIGIN.y + 23行 × 32px)の直下 */
export const BOTTOM_PANEL_Y = 786;

/**
 * 下パネルの上段。配置フェーズは「はじめる」ボタン、戦闘中はセリフ欄として使う。
 * 押す場所・読む場所がフェーズで動かないほうが覚えやすい
 */
export const MESSAGE_BAR: Rect = { x: 8, y: 788, w: 524, h: 64 };

export const BTN = {
  titleNew: { x: 120, y: 520, w: 300, h: 76 } as Rect,
  titleContinue: { x: 120, y: 620, w: 300, h: 76 } as Rect,
  next: { x: 120, y: 700, w: 300, h: 76 } as Rect,
  retry: { x: 60, y: 700, w: 200, h: 72 } as Rect,
  toSelect: { x: 280, y: 700, w: 200, h: 72 } as Rect,
  skip: { x: 380, y: 585, w: 140, h: 44 } as Rect,
} as const;

/** 会話ウィンドウ。論理解像度 540×945 の下寄りに置く */
export const TALK_WINDOW = { x: 20, y: 645, w: 500, h: 260 } as Rect;
/** 本文の描き始め（話者の顔の丸のぶん右へ寄せる）。地の文では TALK_PAD を使う */
export const TALK_BODY_X = 100;
export const TALK_PAD = 24;
export const TALK_LINE_H = 36;
export const TALK_MAX_LINES = 3;
export const TALK_FONT = '26px sans-serif';

/** ステージ選択ボタン。2れつ×なんぎょうの グリッド */
export function stageSlot(index: number): Rect {
  const col = index % 2;
  const row = Math.floor(index / 2);
  return { x: 20 + col * 260, y: 160 + row * 140, w: 240, h: 120 };
}

/** ステージ選択の下に出す仲間の一覧。名前と称号を並べるので1列にする */
export function rosterSlot(index: number): Rect {
  return { x: 20, y: 640 + index * 72, w: 500, h: 64 };
}

/** 戦闘中の下パネルのポートレート。4枠を横に並べる */
export function portraitSlot(index: number): Rect {
  return { x: 6 + index * 133, y: 858, w: 129, h: 80 };
}

/**
 * ポートレートの中でクラス（役割）を出す場所。
 * 画像・プレースホルダの文字・テストの3者が必ずこの1本を見る。
 * 別々に持つと、画像を入れたときだけ位置がずれる
 */
export function roleBadgeIn(slot: Rect): Rect {
  return { x: slot.x + 42, y: slot.y + 32, w: 84, h: 26 };
}

export const BUBBLE_FONT_PX = 16;
export const BUBBLE_LINE_H = 20;
export const BUBBLE_PAD = 10;
/** 吹き出しの本文の折り返し幅。長い台詞はここで折り返す */
const BUBBLE_CONTENT_W = 300;
/** キャラの中心から吹き出しの下端までの距離。丸（当たり判定は半径32）と重ならない値 */
const BUBBLE_LIFT = 44;

/**
 * 幅の見積り。measureText は使わない。当たり判定側が描画コンテキストを
 * 持たないため。全角前提なので実測とほぼ合う。
 */
const measure = (t: string): number => t.length * BUBBLE_FONT_PX;

/**
 * 吹き出しに実際に描く行。矩形の計算と描画が必ず同じ行を見るように、
 * 折り返しはこの1本に通す。別々に折り返すと箱から文字がはみ出す。
 */
export function bubbleLines(text: string): string[] {
  return wrapText(text, measure, BUBBLE_CONTENT_W);
}

/**
 * キャラの頭上に出す吹き出しの矩形。描画と当たり判定の両方がこれを使う。
 * 別々に書くと必ずずれるため、必ずこの1本を通すこと。
 */
export function bubbleRectAt(logicalPos: Vec2, text: string): Rect {
  const lines = bubbleLines(text);
  const longest = lines.reduce((n, l) => Math.max(n, l.length), 0);
  // 折り返し幅ではなく実際の行長から出す。行頭禁則のぶら下げで
  // BUBBLE_CONTENT_W を数文字ぶん超える行がありうるため
  const w = longest * BUBBLE_FONT_PX + BUBBLE_PAD * 2;
  const h = lines.length * BUBBLE_LINE_H + BUBBLE_PAD * 2;
  const x = Math.max(8, Math.min(LOGICAL_W - w - 8, logicalPos.x - w / 2));
  const y = Math.max(52, logicalPos.y - BUBBLE_LIFT - h);
  return { x, y, w, h };
}
