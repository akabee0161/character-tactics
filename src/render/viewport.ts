import type { Vec2 } from '../core/types';

export const LOGICAL_W = 960;
export const LOGICAL_H = 540;
/** マップは情報バーのぶんだけ下にずらして描く */
export const MAP_ORIGIN = { x: 0, y: 46 };

export type Viewport = { scale: number; offsetX: number; offsetY: number };

export function computeViewport(canvasW: number, canvasH: number): Viewport {
  const scale = Math.min(canvasW / LOGICAL_W, canvasH / LOGICAL_H);
  return {
    scale,
    offsetX: (canvasW - LOGICAL_W * scale) / 2,
    offsetY: (canvasH - LOGICAL_H * scale) / 2,
  };
}

export function screenToLogical(vp: Viewport, sx: number, sy: number): Vec2 {
  return { x: (sx - vp.offsetX) / vp.scale, y: (sy - vp.offsetY) / vp.scale };
}

export function mapToLogical(p: Vec2): Vec2 {
  return { x: p.x + MAP_ORIGIN.x, y: p.y + MAP_ORIGIN.y };
}

export function logicalToMap(p: Vec2): Vec2 {
  return { x: p.x - MAP_ORIGIN.x, y: p.y - MAP_ORIGIN.y };
}
