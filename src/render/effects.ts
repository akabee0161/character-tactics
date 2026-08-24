import type { SimEvent, Vec2 } from '../core/types';

export const HIT_EFFECT_DURATION = 0.25;

export type Effect = { pos: Vec2; ttl: number };
export type EffectState = { items: Effect[] };

export function makeEffectState(): EffectState {
  return { items: [] };
}

export function spawnHitEffects(state: EffectState, events: SimEvent[]): void {
  for (const ev of events) {
    if (ev.type === 'hit') {
      state.items.push({ pos: { ...ev.targetPos }, ttl: HIT_EFFECT_DURATION });
    }
  }
}

export function tickEffects(state: EffectState, dt: number): void {
  for (const e of state.items) e.ttl -= dt;
  state.items = state.items.filter((e) => e.ttl > 0);
}
