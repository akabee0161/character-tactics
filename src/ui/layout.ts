import { wrapText } from './talk';
import type { Rect } from './hit';

/** 下パネルの上端。マップ領域(MAP_ORIGIN.y + 23行 × 32px)の直下 */
export const BOTTOM_PANEL_Y = 786;

/**
 * 下パネルの上段。配置フェーズは「始める」ボタン、戦闘中はセリフ欄として使う。
 * 押す場所・読む場所がフェーズで動かないほうが覚えやすい
 */
export const MESSAGE_BAR: Rect = { x: 8, y: 788, w: 524, h: 68 };

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

/**
 * ステージ一覧の見える範囲。ここでクリップして中身をスクロールさせる。
 * 下端は rosterSlot(0) の上に収める（仲間一覧は下に固定で出す）
 */
export const STAGE_LIST_VIEW: Rect = { x: 0, y: 140, w: 540, h: 480 };

/** ステージ選択ボタン。2れつ×なんぎょうの グリッド */
export function stageSlot(index: number): Rect {
  const col = index % 2;
  const row = Math.floor(index / 2);
  return { x: 20 + col * 260, y: 160 + row * 140, w: 240, h: 120 };
}

/** ステージ一覧の中身の高さ。STAGE_LIST_VIEW の上端から最終行の下端まで */
export function stageListContentH(count: number): number {
  if (count <= 0) return 0;
  const last = stageSlot(count - 1);
  return last.y + last.h - STAGE_LIST_VIEW.y;
}

/** ステージ選択の下に出す仲間の一覧。3列×5行（最大 15 人）。上に見出しを出す */
export function rosterSlot(index: number): Rect {
  return { x: 12 + (index % 3) * 174, y: 652 + Math.floor(index / 3) * 56, w: 168, h: 50 };
}

/** ステージの枠の中の「敵を 見る」ボタン。下寄りの中央 */
export function enemyBtnIn(slot: Rect): Rect {
  return { x: slot.x + 50, y: slot.y + 72, w: 140, h: 36 };
}

/** リザルトの仲間の行。2列×4行（最大 8 人） */
export function resultSlot(index: number): Rect {
  return { x: 20 + (index % 2) * 260, y: 150 + Math.floor(index / 2) * 64, w: 240, h: 56 };
}

/** 戦闘中の下パネルのポートレート。8枠を 1 段に並べる */
export function portraitSlot(index: number): Rect {
  return { x: 4 + index * 66, y: 858, w: 64, h: 80 };
}

/**
 * 顔の枠の直径。顔は 64px のドット絵で、大きい枠（会話・セリフ欄）は等倍、
 * 小さい枠（仲間一覧・リザルト・下のバー）は半分で描く（README「アセットの大きさの規約」）
 */
export const FACE_PX = { large: 64, small: 32, panel: 40 } as const;

/**
 * ポートレートの中でクラス（役割）を出す場所。
 * 画像・プレースホルダの文字・テストの3者が必ずこの1本を見る。
 * 別々に持つと、画像を入れたときだけ位置がずれる。
 * 16px のアイコンを等倍で、枠の右上に置く
 */
export function roleBadgeIn(slot: Rect): Rect {
  return { x: slot.x + slot.w - 20, y: slot.y + 6, w: 16, h: 16 };
}

/** ポートレートの HP バー。顔の下に置く。技のゲージは 1px 下 */
export function hpBarIn(slot: Rect): Rect {
  return { x: slot.x + 6, y: slot.y + 56, w: slot.w - 12, h: 7 };
}

export const SPEECH_FONT_PX = 18;
export const SPEECH_LINE_H = 22;
/** セリフ欄に出す最大行数。これを超える行は切る */
export const SPEECH_MAX_LINES = 2;
/** 本文の描き始め（顔のぶん右へ寄せる） */
export const SPEECH_BODY_X = 76;
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

/** 能力の札（仲間・敵・レベルアップで共通）。画面の中ほどに重ねる */
export const STAT_CARD: Rect = { x: 30, y: 130, w: 480, h: 640 };
export const CARD_CLOSE_BTN: Rect = { x: 170, y: 696, w: 200, h: 56 };

/** ステージに出る敵の一覧。見出しの下に行を 64px ずつ並べ、下端の中央に閉じるボタン */
export const ENEMY_LIST: Rect = { x: 30, y: 200, w: 480, h: 520 };
export function enemyListRow(index: number): Rect {
  return { x: ENEMY_LIST.x + 12, y: ENEMY_LIST.y + 64 + index * 64, w: ENEMY_LIST.w - 24, h: 60 };
}
export const ENEMY_LIST_CLOSE_BTN: Rect = { x: ENEMY_LIST.x + (ENEMY_LIST.w - 200) / 2, y: ENEMY_LIST.y + ENEMY_LIST.h - 64, w: 200, h: 52 };

/** 敵の一覧に並べられる行の数。最後の行の下端が「閉じる」ボタンに届かない最大の行数（ステージの敵の種類はこれ以下） */
export const ENEMY_LIST_MAX_ROWS: number =
  Math.floor((ENEMY_LIST_CLOSE_BTN.y - (enemyListRow(0).y + enemyListRow(0).h)) / 64) + 1;

/** 配置の場面の上段。出撃を選べるときだけ、左を「出撃を 選ぶ」・右を「始める」に分ける（合わせて MESSAGE_BAR の幅） */
export const SORTIE_BTN: Rect = { x: 8, y: 788, w: 220, h: 68 };
export const START_BTN: Rect = { x: 236, y: 788, w: 296, h: 68 };

/** 出撃の一覧。見出し・説明の下に 3 列で 15 枠、その下に断りの文、下寄りの中央に「決める」 */
export const SORTIE_SHEET: Rect = { x: 12, y: 120, w: 516, h: 640 };
export function sortieSlot(index: number): Rect {
  return { x: SORTIE_SHEET.x + 8 + (index % 3) * 168, y: SORTIE_SHEET.y + 90 + Math.floor(index / 3) * 80, w: 160, h: 74 };
}
/** 枠の右下の「強さ」ボタン（押すとその仲間のカード） */
export function sortieStrengthBtn(slot: Rect): Rect {
  return { x: slot.x + slot.w - 58, y: slot.y + slot.h - 32, w: 52, h: 26 };
}
/**
 * 「強さ」ボタンの当たり判定。見た目（sortieStrengthBtn、52×26）は小さいので、上・左・下に広げる。
 * 枠の右下の半分程度までにとどめ、枠そのもの（入れる・外す）を押せる場所を残す。枠の中に収まる
 */
export function sortieStrengthHit(slot: Rect): Rect {
  const w = 80;
  const h = 44;
  return { x: slot.x + slot.w - w, y: slot.y + slot.h - h, w, h };
}
/** 断りの文を出す行（15 枠の下と「決める」の間）の中心の y */
export const SORTIE_MESSAGE_Y = 642;
export const SORTIE_DECIDE_BTN: Rect = { x: SORTIE_SHEET.x + (SORTIE_SHEET.w - 200) / 2, y: 690, w: 200, h: 56 };
