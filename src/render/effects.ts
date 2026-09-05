import type { SimEvent, Unit, Vec2 } from '../core/types';

export const HIT_EFFECT_DURATION = 0.25;
export const DAMAGE_TEXT_DURATION = 2.0;
export const HEAL_TEXT_DURATION = 0.6;
export const ATTACK_LINE_DURATION = 0.15;
export const HEAL_RING_DURATION = 0.4;
export const HEAL_BEAM_DURATION = 0.3;
export const SKILL_CAST_DURATION = 0.35;
export const TRAIL_DURATION = 0.25;
export const DEFEAT_DURATION = 0.5;
export const BOND_PULSE_DURATION = 0.3;
export const KNOCKBACK_DURATION = 0.15;
export const HP_BAR_CATCHUP_RATE = 6;

export type Effect =
  | { kind: 'hit'; pos: Vec2; ttl: number; critical: boolean }
  | { kind: 'damageText'; pos: Vec2; ttl: number; amount: number; critical: boolean }
  | { kind: 'healText'; pos: Vec2; ttl: number; amount: number }
  | { kind: 'attackLine'; from: Vec2; to: Vec2; ttl: number }
  | { kind: 'heal'; pos: Vec2; ttl: number }
  | { kind: 'healBeam'; from: Vec2; to: Vec2; ttl: number }
  | { kind: 'skillCast'; skillId: string; pos: Vec2; ttl: number }
  | { kind: 'trail'; from: Vec2; to: Vec2; ttl: number }
  | { kind: 'defeat'; pos: Vec2; ttl: number }
  | { kind: 'bondPulse'; pos: Vec2; ttl: number };

export type EffectState = {
  items: Effect[];
  knockback: Map<string, { ttl: number; dir: Vec2 }>;
  displayedHp: Map<string, number>;
};

export function makeEffectState(): EffectState {
  return { items: [], knockback: new Map(), displayedHp: new Map() };
}

/** ステージ跨ぎなどで演出状態を完全にクリアする。items だけでなく knockback / displayedHp も空にする */
export function resetEffects(state: EffectState): void {
  state.items.length = 0;
  state.knockback.clear();
  state.displayedHp.clear();
}

function knockbackDir(from: Vec2, to: Vec2): Vec2 {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.hypot(dx, dy);
  if (len < 1e-6) return { x: 0, y: 0 };
  return { x: dx / len, y: dy / len };
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
      state.knockback.set(ev.targetUid, { ttl: KNOCKBACK_DURATION, dir: knockbackDir(ev.sourcePos, ev.targetPos) });
    } else if (ev.type === 'heal') {
      state.items.push({ kind: 'healText', pos: { ...ev.targetPos }, ttl: HEAL_TEXT_DURATION, amount: ev.amount });
      state.items.push({ kind: 'heal', pos: { ...ev.targetPos }, ttl: HEAL_RING_DURATION });
      state.items.push({ kind: 'healBeam', from: { ...ev.sourcePos }, to: { ...ev.targetPos }, ttl: HEAL_BEAM_DURATION });
    } else if (ev.type === 'skill') {
      if (ev.skillId === 'kakenukeru') {
        state.items.push({ kind: 'trail', from: { ...ev.fromPos }, to: { ...ev.toPos }, ttl: TRAIL_DURATION });
      } else {
        state.items.push({ kind: 'skillCast', skillId: ev.skillId, pos: { ...ev.toPos }, ttl: SKILL_CAST_DURATION });
      }
    } else if (ev.type === 'unitDefeated') {
      state.items.push({ kind: 'defeat', pos: { ...ev.pos }, ttl: DEFEAT_DURATION });
    } else if (ev.type === 'bondSupport') {
      state.items.push({ kind: 'bondPulse', pos: { ...ev.pos }, ttl: BOND_PULSE_DURATION });
    }
  }
}

export function tickEffects(state: EffectState, dt: number): void {
  for (const e of state.items) e.ttl -= dt;
  state.items = state.items.filter((e) => e.ttl > 0);

  for (const [uid, kb] of state.knockback) {
    kb.ttl -= dt;
    if (kb.ttl <= 0) state.knockback.delete(uid);
  }
}

export function syncDisplayedHp(state: EffectState, units: Unit[], dt: number): void {
  const seen = new Set<string>();
  for (const u of units) {
    seen.add(u.uid);
    const current = state.displayedHp.get(u.uid) ?? u.hp;
    const diff = u.hp - current;
    const next = Math.abs(diff) < 0.05 ? u.hp : current + diff * Math.min(1, dt * HP_BAR_CATCHUP_RATE);
    state.displayedHp.set(u.uid, next);
  }
  for (const uid of state.displayedHp.keys()) {
    if (!seen.has(uid)) state.displayedHp.delete(uid);
  }
}
