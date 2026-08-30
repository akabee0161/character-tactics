import { describe, expect, it } from 'vitest';
import { HIT_EFFECT_DURATION, makeEffectState, spawnHitEffects, tickEffects } from './effects';
import type { SimEvent } from '../core/types';

describe('spawnHitEffects', () => {
  it('hit イベントからエフェクトを1つ追加する', () => {
    const state = makeEffectState();
    const events: SimEvent[] = [{ type: 'hit', targetPos: { x: 10, y: 20 }, amount: 3 }];
    spawnHitEffects(state, events);
    expect(state.items).toEqual([{ pos: { x: 10, y: 20 }, ttl: HIT_EFFECT_DURATION }]);
  });

  it('hit 以外のイベントは無視する', () => {
    const state = makeEffectState();
    const events: SimEvent[] = [{ type: 'unitRetired', uid: 'p1', defId: 'roran' }];
    spawnHitEffects(state, events);
    expect(state.items).toEqual([]);
  });

  it('複数の hit をすべて追加する', () => {
    const state = makeEffectState();
    const events: SimEvent[] = [
      { type: 'hit', targetPos: { x: 0, y: 0 }, amount: 1 },
      { type: 'hit', targetPos: { x: 5, y: 5 }, amount: 2 },
    ];
    spawnHitEffects(state, events);
    expect(state.items).toHaveLength(2);
  });
});

describe('tickEffects', () => {
  it('dt の分だけ ttl を減らす', () => {
    const state = { items: [{ pos: { x: 0, y: 0 }, ttl: 0.25 }] };
    tickEffects(state, 0.1);
    expect(state.items[0]!.ttl).toBeCloseTo(0.15);
  });

  it('ttl が 0 以下になったら取り除く', () => {
    const state = { items: [{ pos: { x: 0, y: 0 }, ttl: 0.05 }] };
    tickEffects(state, 0.1);
    expect(state.items).toEqual([]);
  });
});
