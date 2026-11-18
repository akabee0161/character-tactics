import type { SimEvent, Unit, Vec2 } from '../core/types';
import { DASH_DURATION, DASH_LIFT, SKILL_FX_DURATION } from './skill-fx';

export const HIT_EFFECT_DURATION = 0.25;
export const DAMAGE_TEXT_DURATION = 2.0;
export const HEAL_TEXT_DURATION = 0.6;
export const HEAL_RING_DURATION = 0.4;
export const HEAL_BEAM_DURATION = 0.3;
export const DEFEAT_DURATION = 0.5;
export const BOND_PULSE_DURATION = 0.3;
export const SPAWN_DURATION = 0.5;
export const KNOCKBACK_DURATION = 0.15;
export const HP_BAR_CATCHUP_RATE = 6;
/** 発動可能を示す枠の明滅の周期（秒） */
export const READY_GLOW_PERIOD = 1.0;
const READY_GLOW_MIN = 0.45;

/**
 * 発動可能を示す枠の明るさ。周期 READY_GLOW_PERIOD の三角波で
 * READY_GLOW_MIN〜1 を往復する。動きがつくと視界の端でも気づける。
 * 描画にはテストを書かない方針なので、値の計算だけをここに切り出す
 */
export function readyGlowAlpha(time: number): number {
  const phase = (time % READY_GLOW_PERIOD) / READY_GLOW_PERIOD;
  const triangle = 1 - 2 * Math.abs(phase - 0.5); // 0 → 1 → 0
  return 1 - (1 - READY_GLOW_MIN) * triangle;
}

/** wait が 0 より大きい間は描かず、寿命も減らさない（滑る技の通り道の敵に、見た目が着く時刻まで待たせる） */
export type Effect = EffectBody & { wait?: number };

export type SkillFx = Extract<Effect, { kind: 'skillFx' }>;

type EffectBody =
  | { kind: 'hit'; pos: Vec2; ttl: number; critical: boolean }
  | { kind: 'damageText'; pos: Vec2; ttl: number; amount: number; critical: boolean }
  | { kind: 'healText'; pos: Vec2; ttl: number; amount: number }
  | { kind: 'heal'; pos: Vec2; ttl: number }
  | { kind: 'healBeam'; from: Vec2; to: Vec2; ttl: number }
  | {
    kind: 'skillFx'; skillId: string; from: Vec2; to: Vec2; aim: Vec2 | null; affected: Vec2[];
    ttl: number; duration: number;
  }
  | { kind: 'defeat'; pos: Vec2; ttl: number }
  | { kind: 'bondPulse'; pos: Vec2; ttl: number }
  | { kind: 'spawn'; pos: Vec2; ttl: number };

/** 滑っている最中のユニットの見た目の位置。計算の位置は先に行き先に着いている */
export type Dash = { from: Vec2; to: Vec2; elapsed: number; duration: number; lift: number };

export type EffectState = {
  items: Effect[];
  knockback: Map<string, { ttl: number; dir: Vec2 }>;
  displayedHp: Map<string, number>;
  dash: Map<string, Dash>;
};

export function makeEffectState(): EffectState {
  return { items: [], knockback: new Map(), displayedHp: new Map(), dash: new Map() };
}

/** 滑っている間は from→to を線形に補間した位置、それ以外は計算の位置 */
export function displayPos(state: EffectState, uid: string, pos: Vec2): Vec2 {
  const d = state.dash.get(uid);
  if (!d) return pos;
  const s = Math.min(1, d.elapsed / d.duration);
  return { x: d.from.x + (d.to.x - d.from.x) * s, y: d.from.y + (d.to.y - d.from.y) * s };
}

/** 飛んでいる間の持ち上げ（px。足元の影は持ち上げない） */
export function displayLift(state: EffectState, uid: string): number {
  const d = state.dash.get(uid);
  if (!d || d.lift === 0) return 0;
  const s = Math.min(1, d.elapsed / d.duration);
  return 4 * d.lift * s * (1 - s);
}

/** 滑りを打ち切る。見た目は計算の位置へ飛んで続く */
export function cancelDash(state: EffectState, uid: string): void {
  state.dash.delete(uid);
}

/** ステージ跨ぎなどで演出状態を完全にクリアする。items だけでなく knockback / displayedHp も空にする */
export function resetEffects(state: EffectState): void {
  state.items.length = 0;
  state.knockback.clear();
  state.displayedHp.clear();
  state.dash.clear();
}

function knockbackDir(from: Vec2, to: Vec2): Vec2 {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.hypot(dx, dy);
  if (len < 1e-6) return { x: 0, y: 0 };
  return { x: dx / len, y: dy / len };
}

/** 線分 a→b への p の射影の割合（0〜1 に丸める） */
function alongSegment(p: Vec2, a: Vec2, b: Vec2): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return 0;
  return Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2));
}

export function spawnEffects(state: EffectState, events: SimEvent[]): void {
  // 1 回目: 滑る技を集める（同じ束の hit が先に並んでいても、wait を付けられるように）
  const dashers = new Map<string, Extract<SimEvent, { type: 'skill' }>>();
  for (const ev of events) {
    if (ev.type === 'skill' && DASH_DURATION[ev.skillId] !== undefined) dashers.set(ev.uid, ev);
  }
  for (const ev of events) {
    if (ev.type === 'hit') {
      const dasher = dashers.get(ev.sourceUid);
      let wait: number | undefined;
      if (dasher) {
        const dur = DASH_DURATION[dasher.skillId]!;
        // 駆け抜けるは通り道を通る時刻、急降下は着く時刻
        wait = dasher.skillId === 'kakenukeru'
          ? dur * alongSegment(ev.targetPos, dasher.fromPos, dasher.toPos)
          : dur;
      }
      const w = wait === undefined ? {} : { wait };
      state.items.push({ kind: 'hit', pos: { ...ev.targetPos }, ttl: HIT_EFFECT_DURATION, critical: ev.neraiuchi, ...w });
      state.items.push({
        kind: 'damageText', pos: { ...ev.targetPos }, ttl: DAMAGE_TEXT_DURATION,
        amount: ev.amount, critical: ev.neraiuchi, ...w,
      });
      state.knockback.set(ev.targetUid, { ttl: KNOCKBACK_DURATION, dir: knockbackDir(ev.sourcePos, ev.targetPos) });
    } else if (ev.type === 'heal') {
      state.items.push({ kind: 'healText', pos: { ...ev.targetPos }, ttl: HEAL_TEXT_DURATION, amount: ev.amount });
      state.items.push({ kind: 'heal', pos: { ...ev.targetPos }, ttl: HEAL_RING_DURATION });
      state.items.push({ kind: 'healBeam', from: { ...ev.sourcePos }, to: { ...ev.targetPos }, ttl: HEAL_BEAM_DURATION });
    } else if (ev.type === 'skill') {
      const duration = SKILL_FX_DURATION[ev.skillId] ?? 0.5;
      state.items.push({
        kind: 'skillFx', skillId: ev.skillId, from: { ...ev.fromPos }, to: { ...ev.toPos },
        aim: ev.aim === null ? null : { ...ev.aim }, affected: ev.affected.map((p) => ({ ...p })),
        ttl: duration, duration,
      });
      const dashDuration = DASH_DURATION[ev.skillId];
      if (dashDuration !== undefined) {
        state.dash.set(ev.uid, {
          from: { ...ev.fromPos }, to: { ...ev.toPos }, elapsed: 0, duration: dashDuration,
          lift: DASH_LIFT[ev.skillId] ?? 0,
        });
      }
    } else if (ev.type === 'unitDefeated') {
      state.items.push({ kind: 'defeat', pos: { ...ev.pos }, ttl: DEFEAT_DURATION });
    } else if (ev.type === 'bondSupport') {
      state.items.push({ kind: 'bondPulse', pos: { ...ev.pos }, ttl: BOND_PULSE_DURATION });
    } else if (ev.type === 'enemySpawned') {
      state.items.push({ kind: 'spawn', pos: { ...ev.pos }, ttl: SPAWN_DURATION });
    }
  }
}

export function tickEffects(state: EffectState, dt: number): void {
  for (const e of state.items) {
    let rest = dt;
    if (e.wait !== undefined && e.wait > 0) {
      const used = Math.min(e.wait, rest);
      e.wait -= used;
      rest -= used;
    }
    e.ttl -= rest;
  }
  state.items = state.items.filter((e) => e.ttl > 0);

  for (const [uid, d] of state.dash) {
    d.elapsed += dt;
    if (d.elapsed >= d.duration) state.dash.delete(uid);
  }

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
