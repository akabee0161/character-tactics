import { wrapText } from './talk';
import type { Rect } from './hit';

/** 下パネルの上端。マップ領域(MAP_ORIGIN.y + 23行 × 32px)の直下 */
export const BOTTOM_PANEL_Y = 786;

/**
 * 下パネルの上段。配置フェーズは「始める」ボタン、戦闘中はセリフ欄として使う。
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

export const SPEECH_FONT_PX = 18;
export const SPEECH_LINE_H = 22;
/** セリフ欄に出す最大行数。これを超える行は切る */
export const SPEECH_MAX_LINES = 2;
/** 本文の描き始め（顔のぶん右へ寄せる） */
export const SPEECH_BODY_X = 68;
/** 本文の折り返し幅。MESSAGE_BAR から顔と右の余白を引いた残り */
const SPEECH_CONTENT_W = MESSAGE_BAR.w - SPEECH_BODY_X - 12;

/**
 * 幅の見積り。measureText は使わない（レイアウト側が描画コンテキストを持たないため）。
 * 半角は全角の半分で数える。「Lv3」のような半角混在を全角前提で数えると幅を
 * 過大に見積もり、入るはずの行が折り返される
 */
const measure = (t: string): number => {
  let w = 0;
  for (const ch of t) w += /^[\x20-\x7e]$/.test(ch) ? SPEECH_FONT_PX / 2 : SPEECH_FONT_PX;
  return w;
};

/**
 * セリフ欄に実際に描く行。描画はこの1本を通す。
 * 別々に折り返すと箱から文字がはみ出す
 */
export function speechLines(text: string): string[] {
  return wrapText(text, measure, SPEECH_CONTENT_W);
}
