import type { Rect } from './hit';
import type { Vec2 } from '../core/types';

export const BOTTOM_BAR_Y = 476;
export const BOTTOM_BAR_H = 64;

export const BTN = {
  titleNew: { x: 330, y: 300, w: 300, h: 72 } as Rect,
  titleContinue: { x: 330, y: 388, w: 300, h: 72 } as Rect,
  back: { x: 24, y: 400, w: 180, h: 64 } as Rect,
  start: { x: 720, y: 400, w: 216, h: 64 } as Rect,
  next: { x: 380, y: 380, w: 200, h: 72 } as Rect,
  retry: { x: 250, y: 380, w: 200, h: 72 } as Rect,
  toSelect: { x: 510, y: 380, w: 200, h: 72 } as Rect,
  skip: { x: 780, y: 276, w: 140, h: 44 } as Rect,
} as const;

/** 会話ウィンドウ。論理解像度 960×540 の下部に置く */
export const TALK_WINDOW = { x: 40, y: 330, w: 880, h: 180 } as Rect;
/** 本文の描き始め（話者の顔の丸のぶん右へ寄せる）。地の文では TALK_PAD を使う */
export const TALK_BODY_X = 100;
export const TALK_PAD = 24;
export const TALK_LINE_H = 36;
export const TALK_MAX_LINES = 3;
export const TALK_FONT = '26px sans-serif';

/** ステージ選択ボタン。3れつ×なんぎょうの グリッド。ステージ数は assets/stages/*.json ぶんだけ ふえる */
export function stageSlot(index: number): Rect {
  const col = index % 3;
  const row = Math.floor(index / 3);
  return { x: 96 + col * 264, y: 200 + row * 180, w: 240, h: 160 };
}

export function portraitSlot(index: number): Rect {
  return { x: index * 240 + 8, y: BOTTOM_BAR_Y, w: 224, h: BOTTOM_BAR_H };
}

/** 選択中のキャラの上に出すスキルボタン。マップ座標ではなく論理座標で返す */
export function skillButtonAt(logicalPos: { x: number; y: number }): Rect {
  const w = 132;
  const h = 64;
  const x = Math.max(8, Math.min(960 - w - 8, logicalPos.x - w / 2));
  const y = Math.max(52, logicalPos.y - 86);
  return { x, y, w, h };
}

export const BUBBLE_FONT_PX = 16;
export const BUBBLE_LINE_H = 20;
const BUBBLE_PAD = 10;
const BUBBLE_MAX_W = 320;
/** キャラの中心から吹き出しの下端までの距離。丸（当たり判定は半径32）と重ならない値 */
const BUBBLE_LIFT = 44;

/**
 * キャラの頭上に出す吹き出しの矩形。描画と当たり判定の両方がこれを使う。
 * 別々に書くと必ずずれるため、必ずこの1本を通すこと。
 *
 * 幅は文字数からの概算で、measureText は使わない。当たり判定側が
 * 描画コンテキストを持たないため。全角前提なので実測とほぼ合う。
 */
export function bubbleRectAt(logicalPos: Vec2, text: string): Rect {
  const lines = text.split('\n');
  const longest = lines.reduce((n, l) => Math.max(n, l.length), 0);
  const w = Math.min(BUBBLE_MAX_W, longest * BUBBLE_FONT_PX + BUBBLE_PAD * 2);
  const h = lines.length * BUBBLE_LINE_H + BUBBLE_PAD * 2;
  // 960 は論理解像度の幅。skillButtonAt と同じ書き方に揃えている
  const x = Math.max(8, Math.min(960 - w - 8, logicalPos.x - w / 2));
  const y = Math.max(52, logicalPos.y - BUBBLE_LIFT - h);
  return { x, y, w, h };
}
