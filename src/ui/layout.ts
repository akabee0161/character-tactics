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

export const STAGE_BTN: Rect[] = [0, 1, 2].map((i) => ({
  x: 96 + i * 264, y: 200, w: 240, h: 160,
}));

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
