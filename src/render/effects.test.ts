import { describe, expect, it } from 'vitest';
import {
  ATTACK_LINE_DURATION, DAMAGE_TEXT_DURATION, HEAL_BEAM_DURATION, HEAL_RING_DURATION, HEAL_TEXT_DURATION, HIT_EFFECT_DURATION,
  SKILL_CAST_DURATION, TRAIL_DURATION,
  makeEffectState, spawnEffects, tickEffects,
} from './effects';
import type { EffectState } from './effects';
import type { SimEvent } from '../core/types';

function hitEvent(overrides: Partial<Extract<SimEvent, { type: 'hit' }>> = {}): SimEvent {
  return {
    type: 'hit', targetUid: 'e1', targetPos: { x: 10, y: 20 }, amount: 3,
    sourceUid: 'p1', sourceDefId: 'roran', attackKind: 'melee',
    sourcePos: { x: 0, y: 0 }, neraiuchi: false,
    ...overrides,
  };
}

describe('spawnEffects', () => {
  it('hit イベントから hit と damageText を追加する', () => {
    const state = makeEffectState();
    spawnEffects(state, [hitEvent()]);
    expect(state.items).toEqual([
      { kind: 'hit', pos: { x: 10, y: 20 }, ttl: HIT_EFFECT_DURATION, critical: false },
      { kind: 'damageText', pos: { x: 10, y: 20 }, ttl: DAMAGE_TEXT_DURATION, amount: 3, critical: false },
    ]);
  });

  it('neraiuchi な hit は critical フラグが立つ', () => {
    const state = makeEffectState();
    spawnEffects(state, [hitEvent({ neraiuchi: true })]);
    expect(state.items[0]).toMatchObject({ kind: 'hit', critical: true });
    expect(state.items[1]).toMatchObject({ kind: 'damageText', critical: true });
  });

  it('heal イベントから healText / heal / healBeam を追加する', () => {
    const state = makeEffectState();
    const events: SimEvent[] = [
      { type: 'heal', targetPos: { x: 5, y: 5 }, amount: 12, sourceUid: 'p3', sourceDefId: 'mist', sourcePos: { x: 0, y: 0 } },
    ];
    spawnEffects(state, events);
    expect(state.items).toEqual([
      { kind: 'healText', pos: { x: 5, y: 5 }, ttl: HEAL_TEXT_DURATION, amount: 12 },
      { kind: 'heal', pos: { x: 5, y: 5 }, ttl: HEAL_RING_DURATION },
      { kind: 'healBeam', from: { x: 0, y: 0 }, to: { x: 5, y: 5 }, ttl: HEAL_BEAM_DURATION },
    ]);
  });

  it('関係ないイベントは無視する', () => {
    const state = makeEffectState();
    const events: SimEvent[] = [{ type: 'unitRetired', uid: 'p1', defId: 'roran' }];
    spawnEffects(state, events);
    expect(state.items).toEqual([]);
  });

  it('複数の hit をすべて追加する', () => {
    const state = makeEffectState();
    spawnEffects(state, [
      hitEvent({ targetUid: 'e1', targetPos: { x: 0, y: 0 } }),
      hitEvent({ targetUid: 'e2', targetPos: { x: 5, y: 5 } }),
    ]);
    expect(state.items.filter((i) => i.kind === 'hit')).toHaveLength(2);
  });

  it('bow の hit は attackLine も追加する', () => {
    const state = makeEffectState();
    spawnEffects(state, [hitEvent({ attackKind: 'bow', sourcePos: { x: 100, y: 20 }, targetPos: { x: 10, y: 20 } })]);
    expect(state.items).toContainEqual({
      kind: 'attackLine', from: { x: 100, y: 20 }, to: { x: 10, y: 20 }, ttl: ATTACK_LINE_DURATION,
    });
  });

  it('melee の hit は attackLine を追加しない', () => {
    const state = makeEffectState();
    spawnEffects(state, [hitEvent({ attackKind: 'melee' })]);
    expect(state.items.some((i) => i.kind === 'attackLine')).toBe(false);
  });

  it('kakenukeru の skill イベントから trail を追加する', () => {
    const state = makeEffectState();
    const events: SimEvent[] = [{
      type: 'skill', uid: 'p4', defId: 'gau', skillId: 'kakenukeru', hits: 1,
      fromPos: { x: 0, y: 0 }, toPos: { x: 100, y: 0 },
    }];
    spawnEffects(state, events);
    expect(state.items).toEqual([
      { kind: 'trail', from: { x: 0, y: 0 }, to: { x: 100, y: 0 }, ttl: TRAIL_DURATION },
    ]);
  });

  it('funbaru の skill イベントから skillCast を追加する', () => {
    const state = makeEffectState();
    const events: SimEvent[] = [{
      type: 'skill', uid: 'p1', defId: 'roran', skillId: 'funbaru', hits: 0,
      fromPos: { x: 10, y: 10 }, toPos: { x: 10, y: 10 },
    }];
    spawnEffects(state, events);
    expect(state.items).toEqual([
      { kind: 'skillCast', skillId: 'funbaru', pos: { x: 10, y: 10 }, ttl: SKILL_CAST_DURATION },
    ]);
  });

  it('neraiuchi の skill イベントから skillCast を追加する', () => {
    const state = makeEffectState();
    const events: SimEvent[] = [{
      type: 'skill', uid: 'p2', defId: 'ines', skillId: 'neraiuchi', hits: 0,
      fromPos: { x: 5, y: 5 }, toPos: { x: 5, y: 5 },
    }];
    spawnEffects(state, events);
    expect(state.items).toEqual([
      { kind: 'skillCast', skillId: 'neraiuchi', pos: { x: 5, y: 5 }, ttl: SKILL_CAST_DURATION },
    ]);
  });
});

describe('tickEffects', () => {
  it('dt の分だけ ttl を減らす', () => {
    const state: EffectState = { items: [{ kind: 'hit', pos: { x: 0, y: 0 }, ttl: 0.25, critical: false }] };
    tickEffects(state, 0.1);
    expect(state.items[0]!.ttl).toBeCloseTo(0.15);
  });

  it('ttl が 0 以下になったら取り除く', () => {
    const state: EffectState = { items: [{ kind: 'hit', pos: { x: 0, y: 0 }, ttl: 0.05, critical: false }] };
    tickEffects(state, 0.1);
    expect(state.items).toEqual([]);
  });
});
