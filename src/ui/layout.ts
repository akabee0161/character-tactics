import type { Rect } from './hit';

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
} as const;

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
