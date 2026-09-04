import type { SimEvent, Vec2 } from '../core/types';

export const HIT_EFFECT_DURATION = 0.25;
export const DAMAGE_TEXT_DURATION = 0.6;
export const HEAL_TEXT_DURATION = 0.6;
export const ATTACK_LINE_DURATION = 0.15;
export const HEAL_RING_DURATION = 0.4;
export const HEAL_BEAM_DURATION = 0.3;

export type Effect =
  | { kind: 'hit'; pos: Vec2; ttl: number; critical: boolean }
  | { kind: 'damageText'; pos: Vec2; ttl: number; amount: number; critical: boolean }
  | { kind: 'healText'; pos: Vec2; ttl: number; amount: number }
  | { kind: 'attackLine'; from: Vec2; to: Vec2; ttl: number }
  | { kind: 'heal'; pos: Vec2; ttl: number }
  | { kind: 'healBeam'; from: Vec2; to: Vec2; ttl: number };

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
      if (ev.attackKind === 'bow') {
        state.items.push({ kind: 'attackLine', from: { ...ev.sourcePos }, to: { ...ev.targetPos }, ttl: ATTACK_LINE_DURATION });
      }
    } else if (ev.type === 'heal') {
      state.items.push({ kind: 'healText', pos: { ...ev.targetPos }, ttl: HEAL_TEXT_DURATION, amount: ev.amount });
      state.items.push({ kind: 'heal', pos: { ...ev.targetPos }, ttl: HEAL_RING_DURATION });
      state.items.push({ kind: 'healBeam', from: { ...ev.sourcePos }, to: { ...ev.targetPos }, ttl: HEAL_BEAM_DURATION });
    }
  }
}

export function tickEffects(state: EffectState, dt: number): void {
  for (const e of state.items) e.ttl -= dt;
  state.items = state.items.filter((e) => e.ttl > 0);
}
