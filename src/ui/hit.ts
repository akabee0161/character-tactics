import { distance } from '../core/field';
import type { AllyUnit, Vec2 } from '../core/types';

export const MIN_TAP = 64;

export type Rect = { x: number; y: number; w: number; h: number };

export function hitRect(r: Rect, p: Vec2): boolean {
  return p.x >= r.x && p.x < r.x + r.w && p.y >= r.y && p.y < r.y + r.h;
}

export function pickAlly(allies: AllyUnit[], mapPoint: Vec2, radius = 32): string | null {
  let best: string | null = null;
  let bestDist = Infinity;
  for (const a of allies) {
    if (a.retired) continue;
    const d = distance(mapPoint, a.pos);
    if (d <= radius && d < bestDist) {
      bestDist = d;
      best = a.id;
    }
  }
  return best;
}
