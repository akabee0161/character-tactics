import { distance } from '../core/field';
import type { Unit, Vec2 } from '../core/types';

export const MIN_TAP = 64;

export type Rect = { x: number; y: number; w: number; h: number };

export function hitRect(r: Rect, p: Vec2): boolean {
  return p.x >= r.x && p.x < r.x + r.w && p.y >= r.y && p.y < r.y + r.h;
}

/**
 * mapPoint から radius 以内の、いちばん近い味方。
 * centerOf は判定の中心。既定はユニットの位置（足元）で、描画側は絵の中心を渡す
 */
export function pickUnit(
  units: Unit[], mapPoint: Vec2, radius = 32, centerOf: (u: Unit) => Vec2 = (u) => u.pos,
): string | null {
  let best: string | null = null;
  let bestDist = Infinity;
  for (const u of units) {
    if (u.retired) continue;
    const d = distance(mapPoint, centerOf(u));
    if (d <= radius && d < bestDist) {
      bestDist = d;
      best = u.uid;
    }
  }
  return best;
}
