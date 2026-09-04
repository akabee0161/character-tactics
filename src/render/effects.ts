import type { SimEvent, Vec2 } from '../core/types';

export const HIT_EFFECT_DURATION = 0.25;
export const DAMAGE_TEXT_DURATION = 0.6;
export const HEAL_TEXT_DURATION = 0.6;

export type Effect =
  | { kind: 'hit'; pos: Vec2; ttl: number; critical: boolean }
  | { kind: 'damageText'; pos: Vec2; ttl: number; amount: number; critical: boolean }
  | { kind: 'healText'; pos: Vec2; ttl: number; amount: number };

export type EffectState = { items: Effect[] };

export function makeEffectState(): EffectState {
  return { items: [] };
}

export function spawnEffects(state: EffectState, events: SimEvent[]): void {
  for (const ev of events) {
    if (ev.type === 'hit') {
      state.items.push({ kind: 'hit', pos: { ...ev.targetPos }, ttl: HIT_EFFECT_DURATION, critical: ev.neraiuchi });
      state.items.push({
        kind: 'damageText', pos: { ...ev.targetPos }, ttl: DAMAGE_TEXT_DURATION,
        amount: ev.amount, critical: ev.neraiuchi,
      });
    } else if (ev.type === 'heal') {
      state.items.push({ kind: 'healText', pos: { ...ev.targetPos }, ttl: HEAL_TEXT_DURATION, amount: ev.amount });
    }
  }
}

export function tickEffects(state: EffectState, dt: number): void {
  for (const e of state.items) e.ttl -= dt;
  state.items = state.items.filter((e) => e.ttl > 0);
}
