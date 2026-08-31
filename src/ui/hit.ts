import { distance } from '../core/field';
import type { Unit, Vec2 } from '../core/types';

export const MIN_TAP = 64;

export type Rect = { x: number; y: number; w: number; h: number };

export function hitRect(r: Rect, p: Vec2): boolean {
  return p.x >= r.x && p.x < r.x + r.w && p.y >= r.y && p.y < r.y + r.h;
}

export function pickUnit(units: Unit[], mapPoint: Vec2, radius = 32): string | null {
  let best: string | null = null;
  let bestDist = Infinity;
  for (const u of units) {
    if (u.retired) continue;
    const d = distance(mapPoint, u.pos);
    if (d <= radius && d < bestDist) {
      bestDist = d;
      best = u.uid;
    }
  }
  return best;
}
