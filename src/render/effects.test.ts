import { describe, expect, it } from 'vitest';
import {
  BOND_PULSE_DURATION, DAMAGE_TEXT_DURATION, DEFEAT_DURATION, HEAL_BEAM_DURATION,
  HEAL_RING_DURATION, HEAL_TEXT_DURATION, HIT_EFFECT_DURATION, HP_BAR_CATCHUP_RATE,
  FALLEN_BLINK_DURATION, READY_GLOW_PERIOD, cancelDash, displayPos, isBlinkVisible, readyGlowAlpha,
  makeEffectState, resetEffects, spawnEffects, syncDisplayedHp, tickEffects,
} from './effects';
import type { EffectState } from './effects';
import { DASH_DURATION, SKILL_FX, SKILL_FX_DURATION } from './skill-fx';
import skillsJson from '../../assets/skills.json';
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
  it('unitDefeated イベントから defeat を追加する', () => {
    const state = makeEffectState();
    const events: SimEvent[] = [
      { type: 'unitDefeated', uid: 'e1', defId: 'narazumono', byUid: 'p1', byDefId: 'roran', pos: { x: 30, y: 40 } },
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
      knockback: new Map(), displayedHp: new Map(), dash: new Map(), lingering: new Map(), fallen: new Map(),
    };
    tickEffects(state, 0.1);
    expect(state.items[0]!.ttl).toBeCloseTo(0.15);
  });

  it('ttl が 0 以下になったら取り除く', () => {
    const state: EffectState = {
      items: [{ kind: 'hit', pos: { x: 0, y: 0 }, ttl: 0.05, critical: false }],
      knockback: new Map(), displayedHp: new Map(), dash: new Map(), lingering: new Map(), fallen: new Map(),
    };
    tickEffects(state, 0.1);
    expect(state.items).toEqual([]);
  });

  it('ノックバックの ttl が尽きたら削除する', () => {
    const state: EffectState = { items: [], knockback: new Map([['e1', { ttl: 0.05, dir: { x: 1, y: 0 } }]]), displayedHp: new Map(), dash: new Map(), lingering: new Map(), fallen: new Map() };
    tickEffects(state, 0.1);
    expect(state.knockback.has('e1')).toBe(false);
  });
});

describe('resetEffects', () => {
  it('items / knockback / displayedHp をすべて空にする', () => {
    const state: EffectState = {
      items: [{ kind: 'hit', pos: { x: 0, y: 0 }, ttl: 0.25, critical: false }],
      knockback: new Map([['e1', { ttl: 0.1, dir: { x: 1, y: 0 } }]]),
      displayedHp: new Map([['p1', 40]]), dash: new Map(), lingering: new Map(), fallen: new Map(),
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

function skillEvent(skillId: string, overrides: Partial<Extract<SimEvent, { type: 'skill' }>> = {}): SimEvent {
  return {
    type: 'skill', uid: 'p1', defId: 'roran', skillId,
    fromPos: { x: 0, y: 0 }, toPos: { x: 0, y: 0 }, aim: null, affected: [],
    ...overrides,
  };
}

describe('技の見た目（skillFx）', () => {
  const ids = skillsJson.map((s) => s.id);

  it.each(ids)('skill 出来事から skillFx を 1 つ足し、長さは SKILL_FX_DURATION（%s）', (id) => {
    const state = makeEffectState();
    spawnEffects(state, [skillEvent(id)]);
    const fx = state.items.filter((i) => i.kind === 'skillFx');
    expect(fx).toHaveLength(1);
    expect(fx[0]).toMatchObject({ skillId: id, ttl: SKILL_FX_DURATION[id], duration: SKILL_FX_DURATION[id] });
  });

  it('SKILL_FX は SKILL_FX_DURATION と同じ 11 個の技を持つ', () => {
    expect(Object.keys(SKILL_FX).sort()).toEqual([...ids].sort());
    expect(Object.keys(SKILL_FX_DURATION).sort()).toEqual([...ids].sort());
    expect(ids).toHaveLength(11);
  });

  it('駆け抜けるは dash を始め、displayPos は半分の時刻で中点', () => {
    const state = makeEffectState();
    spawnEffects(state, [skillEvent('kakenukeru', { fromPos: { x: 0, y: 0 }, toPos: { x: 100, y: 0 } })]);
    tickEffects(state, 0.3);
    expect(displayPos(state, 'p1', { x: 100, y: 0 })).toEqual({ x: 50, y: 0 });
    tickEffects(state, 0.3);
    expect(state.dash.has('p1')).toBe(false);
    expect(displayPos(state, 'p1', { x: 100, y: 0 })).toEqual({ x: 100, y: 0 });
  });

  it('駆け抜けるの通り道の敵の hit と数字は、見た目がその敵を通る時刻まで wait する', () => {
    const state = makeEffectState();
    spawnEffects(state, [
      hitEvent({ sourceUid: 'p1', targetPos: { x: 25, y: 10 } }),
      skillEvent('kakenukeru', { fromPos: { x: 0, y: 0 }, toPos: { x: 100, y: 0 } }),
    ]);
    const waits = state.items.filter((i) => i.kind === 'hit' || i.kind === 'damageText').map((i) => i.wait);
    expect(waits).toHaveLength(2);
    for (const w of waits) expect(w).toBeCloseTo(DASH_DURATION.kakenukeru! * 0.25);
  });

  it('急降下の hit は着く時刻まで wait する', () => {
    const state = makeEffectState();
    spawnEffects(state, [
      hitEvent({ sourceUid: 'p1', targetPos: { x: 90, y: 0 } }),
      skillEvent('kyuukouka', { fromPos: { x: 0, y: 0 }, toPos: { x: 100, y: 0 } }),
    ]);
    const hit = state.items.find((i) => i.kind === 'hit')!;
    expect(hit.wait).toBe(DASH_DURATION.kyuukouka);
  });

  it('滑らない技の出来事と同じ束の hit には wait を付けない', () => {
    const state = makeEffectState();
    spawnEffects(state, [hitEvent({ sourceUid: 'p1' }), skillEvent('hinoame')]);
    expect(state.items.find((i) => i.kind === 'hit')!.wait).toBeUndefined();
  });

  it('wait の間は ttl が減らず、明けた分から減る', () => {
    const state = makeEffectState();
    state.items.push({ kind: 'hit', pos: { x: 0, y: 0 }, ttl: 0.25, critical: false, wait: 0.2 });
    tickEffects(state, 0.1);
    expect(state.items[0]).toMatchObject({ ttl: 0.25, wait: expect.closeTo(0.1) });
    tickEffects(state, 0.15);
    expect(state.items[0]!.ttl).toBeCloseTo(0.2);
    expect(state.items[0]!.wait).toBe(0);
  });

  it('cancelDash の後は displayPos が計算の位置を返す', () => {
    const state = makeEffectState();
    spawnEffects(state, [skillEvent('kakenukeru', { fromPos: { x: 0, y: 0 }, toPos: { x: 100, y: 0 } })]);
    tickEffects(state, 0.1);
    cancelDash(state, 'p1');
    expect(displayPos(state, 'p1', { x: 100, y: 0 })).toEqual({ x: 100, y: 0 });
    tickEffects(state, 0.1);
    expect(state.dash.size).toBe(0);
  });

  it('resetEffects は dash も空にする', () => {
    const state = makeEffectState();
    spawnEffects(state, [skillEvent('kyuukouka', { toPos: { x: 50, y: 0 } })]);
    resetEffects(state);
    expect(state.dash.size).toBe(0);
  });
});

describe('滑る技で倒した敵・滑っている仲間への攻撃', () => {
  const defeated = (uid: string, byUid: string, pos: { x: number; y: number }): SimEvent => ({
    type: 'unitDefeated', uid, defId: 'narazumono', byUid, byDefId: 'gau', pos,
  });

  it('駆け抜けるで倒した敵の白い輪は、その敵を通る時刻まで wait し、それまで姿が残る', () => {
    const state = makeEffectState();
    spawnEffects(state, [
      defeated('e3', 'p1', { x: 75, y: 0 }),
      skillEvent('kakenukeru', { fromPos: { x: 0, y: 0 }, toPos: { x: 100, y: 0 } }),
    ]);
    const ring = state.items.find((i) => i.kind === 'defeat')!;
    expect(ring.wait).toBeCloseTo(DASH_DURATION.kakenukeru! * 0.75);
    expect(state.lingering.get('e3')).toBeCloseTo(DASH_DURATION.kakenukeru! * 0.75);
    tickEffects(state, 0.5);
    expect(state.lingering.has('e3')).toBe(false);
  });

  it('急降下で倒した敵は着く時刻まで姿が残る', () => {
    const state = makeEffectState();
    spawnEffects(state, [
      defeated('e1', 'p1', { x: 90, y: 0 }),
      skillEvent('kyuukouka', { fromPos: { x: 0, y: 0 }, toPos: { x: 100, y: 0 } }),
    ]);
    expect(state.items.find((i) => i.kind === 'defeat')!.wait).toBe(DASH_DURATION.kyuukouka);
    expect(state.lingering.get('e1')).toBe(DASH_DURATION.kyuukouka);
  });

  it('滑らない技で倒した敵は wait も lingering も無い', () => {
    const state = makeEffectState();
    spawnEffects(state, [defeated('e1', 'p1', { x: 5, y: 5 }), skillEvent('hinoame')]);
    expect(state.items.find((i) => i.kind === 'defeat')!.wait).toBeUndefined();
    expect(state.lingering.size).toBe(0);
  });

  it('滑っている仲間への攻撃の hit は、着く時刻まで wait する', () => {
    const state = makeEffectState();
    spawnEffects(state, [skillEvent('kakenukeru', { fromPos: { x: 0, y: 0 }, toPos: { x: 100, y: 0 } })]);
    tickEffects(state, 0.2);
    spawnEffects(state, [hitEvent({ sourceUid: 'e9', targetUid: 'p1', targetPos: { x: 100, y: 0 } })]);
    const hit = state.items.find((i) => i.kind === 'hit')!;
    expect(hit.wait).toBeCloseTo(DASH_DURATION.kakenukeru! - 0.2);
  });
});

describe('倒れた仲間の点滅', () => {
  it('unitRetired で点滅を 2.5 秒始め、時間がたつと消える', () => {
    const state = makeEffectState();
    spawnEffects(state, [{ type: 'unitRetired', uid: 'p1', defId: 'roran' }]);
    expect(state.fallen.get('p1')).toBe(FALLEN_BLINK_DURATION);
    expect(FALLEN_BLINK_DURATION).toBe(2.5);
    tickEffects(state, 1);
    expect(state.fallen.get('p1')).toBeCloseTo(1.5);
    tickEffects(state, 1.5);
    expect(state.fallen.has('p1')).toBe(false);
  });

  it('isBlinkVisible は 0.15 秒ごとに切り替わる', () => {
    expect(isBlinkVisible(2.5)).toBe(true);
    expect(isBlinkVisible(2.5 - 0.1)).toBe(true);
    expect(isBlinkVisible(2.5 - 0.2)).toBe(false);
    expect(isBlinkVisible(2.5 - 0.4)).toBe(true);
  });

  it('resetEffects は点滅も空にする', () => {
    const state = makeEffectState();
    spawnEffects(state, [{ type: 'unitRetired', uid: 'p1', defId: 'roran' }]);
    resetEffects(state);
    expect(state.fallen.size).toBe(0);
  });
});
