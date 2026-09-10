import { describe, expect, it } from 'vitest';
import {
  BOND_PULSE_DURATION, DAMAGE_TEXT_DURATION, DEFEAT_DURATION, HEAL_BEAM_DURATION,
  HEAL_RING_DURATION, HEAL_TEXT_DURATION, HIT_EFFECT_DURATION, HP_BAR_CATCHUP_RATE,
  SKILL_CAST_DURATION, TRAIL_DURATION, READY_GLOW_PERIOD, readyGlowAlpha,
  makeEffectState, resetEffects, spawnEffects, syncDisplayedHp, tickEffects,
} from './effects';
import type { EffectState } from './effects';
import type { SimEvent, Unit } from '../core/types';

function hitEvent(overrides: Partial<Extract<SimEvent, { type: 'hit' }>> = {}): SimEvent {
  return {
    type: 'hit', targetUid: 'e1', targetPos: { x: 10, y: 20 }, amount: 3,
    sourceUid: 'p1', sourceDefId: 'roran', attackKind: 'melee',
    sourcePos: { x: 0, y: 0 }, neraiuchi: false,
    ...overrides,
  };
}

/** syncDisplayedHp は uid / hp しか見ないため、テストでは最小限のフィールドだけ埋める */
function testUnit(uid: string, hp: number, maxHp = 100): Unit {
  return { uid, hp, maxHp } as unknown as Unit;
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

  it('ゆみの ヒットで せんの えんしゅつは でない(ひしょうたいが あるため)', () => {
    const state = makeEffectState();
    spawnEffects(state, [{
      type: 'hit', targetUid: 'e1', targetPos: { x: 10, y: 10 }, amount: 3,
      sourceUid: 'p1', sourceDefId: 'ines', attackKind: 'bow',
      sourcePos: { x: 0, y: 0 }, neraiuchi: false,
    }]);
    expect(state.items.some((e) => (e.kind as string) === 'attackLine')).toBe(false);
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

  it('unitDefeated イベントから defeat を追加する', () => {
    const state = makeEffectState();
    const events: SimEvent[] = [
      { type: 'unitDefeated', uid: 'e1', defId: 'narazumono', byUid: 'p1', byDefId: 'roran', neraiuchi: false, pos: { x: 30, y: 40 } },
    ];
    spawnEffects(state, events);
    expect(state.items).toEqual([{ kind: 'defeat', pos: { x: 30, y: 40 }, ttl: DEFEAT_DURATION }]);
  });

  it('bondSupport イベントから bondPulse を追加する', () => {
    const state = makeEffectState();
    const events: SimEvent[] = [
      { type: 'bondSupport', targetUid: 'p1', targetDefId: 'roran', supporterUids: ['p2'], pos: { x: 1, y: 2 } },
    ];
    spawnEffects(state, events);
    expect(state.items).toEqual([{ kind: 'bondPulse', pos: { x: 1, y: 2 }, ttl: BOND_PULSE_DURATION }]);
  });

  it('hit で被弾したユニットにノックバックが付く', () => {
    const state = makeEffectState();
    spawnEffects(state, [hitEvent({
      targetUid: 'e1', targetPos: { x: 10, y: 0 }, sourcePos: { x: 0, y: 0 },
    })]);
    const kb = state.knockback.get('e1');
    expect(kb).toBeDefined();
    expect(kb!.dir.x).toBeCloseTo(1);
    expect(kb!.dir.y).toBeCloseTo(0);
  });
});

describe('tickEffects', () => {
  it('dt の分だけ ttl を減らす', () => {
    const state: EffectState = {
      items: [{ kind: 'hit', pos: { x: 0, y: 0 }, ttl: 0.25, critical: false }],
      knockback: new Map(), displayedHp: new Map(),
    };
    tickEffects(state, 0.1);
    expect(state.items[0]!.ttl).toBeCloseTo(0.15);
  });

  it('ttl が 0 以下になったら取り除く', () => {
    const state: EffectState = {
      items: [{ kind: 'hit', pos: { x: 0, y: 0 }, ttl: 0.05, critical: false }],
      knockback: new Map(), displayedHp: new Map(),
    };
    tickEffects(state, 0.1);
    expect(state.items).toEqual([]);
  });

  it('ノックバックの ttl が尽きたら削除する', () => {
    const state: EffectState = { items: [], knockback: new Map([['e1', { ttl: 0.05, dir: { x: 1, y: 0 } }]]), displayedHp: new Map() };
    tickEffects(state, 0.1);
    expect(state.knockback.has('e1')).toBe(false);
  });
});

describe('resetEffects', () => {
  it('items / knockback / displayedHp をすべて空にする', () => {
    const state: EffectState = {
      items: [{ kind: 'hit', pos: { x: 0, y: 0 }, ttl: 0.25, critical: false }],
      knockback: new Map([['e1', { ttl: 0.1, dir: { x: 1, y: 0 } }]]),
      displayedHp: new Map([['p1', 40]]),
    };
    resetEffects(state);
    expect(state.items).toEqual([]);
    expect(state.knockback.size).toBe(0);
    expect(state.displayedHp.size).toBe(0);
  });
});

describe('syncDisplayedHp', () => {
  it('差分を dt の分だけ指数減衰で追従させる', () => {
    const state = makeEffectState();
    state.displayedHp.set('p1', 40);
    syncDisplayedHp(state, [testUnit('p1', 50)], 0.1);
    // diff=10, factor=min(1, 0.1*HP_BAR_CATCHUP_RATE)=0.6 → 40 + 10*0.6 = 46
    expect(HP_BAR_CATCHUP_RATE).toBe(6);
    expect(state.displayedHp.get('p1')).toBeCloseTo(46);
  });

  it('displayedHp に未登録の uid は実HPをそのまま初期値にする', () => {
    const state = makeEffectState();
    syncDisplayedHp(state, [testUnit('p1', 72)], 0.1);
    expect(state.displayedHp.get('p1')).toBe(72);
  });

  it('差分が 0.05 未満なら実HPへスナップする', () => {
    const state = makeEffectState();
    state.displayedHp.set('p1', 49.98);
    syncDisplayedHp(state, [testUnit('p1', 50)], 0.1);
    expect(state.displayedHp.get('p1')).toBe(50);
  });

  it('units から消えた uid は displayedHp から削除する', () => {
    const state = makeEffectState();
    state.displayedHp.set('e1', 10);
    syncDisplayedHp(state, [], 0.1);
    expect(state.displayedHp.has('e1')).toBe(false);
  });
});

describe('readyGlowAlpha', () => {
  it('周期の頭は いちばん明るい', () => {
    expect(readyGlowAlpha(0)).toBeCloseTo(1);
    expect(readyGlowAlpha(READY_GLOW_PERIOD)).toBeCloseTo(1);
    expect(readyGlowAlpha(READY_GLOW_PERIOD * 3)).toBeCloseTo(1);
  });

  it('周期の半分で いちばん暗い', () => {
    expect(readyGlowAlpha(READY_GLOW_PERIOD / 2)).toBeCloseTo(0.45);
  });

  it('つねに 0.45〜1 に収まる', () => {
    for (let t = 0; t < 5; t += 0.05) {
      const a = readyGlowAlpha(t);
      expect(a).toBeGreaterThanOrEqual(0.45);
      expect(a).toBeLessThanOrEqual(1);
    }
  });
});
