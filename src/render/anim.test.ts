import { describe, expect, it } from 'vitest';
import { DIRS, STATES, STILL, WALK_HOLD, dirOf, frameFor, frameOf, makeAnimStore, noteAttacks, resetAnim, stateOf, updateMotion } from './anim';
import type { MapSheet } from '../engine/schema';
import type { AnimUnit } from './anim';
import type { SimEvent, Vec2 } from '../core/types';

const SHEET: MapSheet = {
  sheet: 'roran-map.png', frame: 32,
  idle: { frames: 2, fps: 4 }, walk: { frames: 4, fps: 8 }, attack: { frames: 3, fps: 12 },
};

describe('ならびの きやく', () => {
  it('ほうこうは down, up, left, right の じゅん', () => {
    expect(DIRS).toEqual(['down', 'up', 'left', 'right']);
  });

  it('じょうたいは idle, walk, attack の じゅん', () => {
    expect(STATES).toEqual(['idle', 'walk', 'attack']);
  });

  it('STILL は 0ぎょう 0れつ', () => {
    expect(STILL).toEqual({ row: 0, col: 0 });
  });
});

describe('dirOf', () => {
  it('ゆうせいな じくで きめる', () => {
    expect(dirOf(10, 1)).toBe('right');
    expect(dirOf(-10, 1)).toBe('left');
    expect(dirOf(1, 10)).toBe('down');
    expect(dirOf(1, -10)).toBe('up');
  });

  it('たてよこが おなじなら たてを とる', () => {
    expect(dirOf(5, 5)).toBe('down');
    expect(dirOf(5, -5)).toBe('up');
  });

  it('うごいていなければ null', () => {
    expect(dirOf(0, 0)).toBe(null);
    expect(dirOf(0.001, -0.001)).toBe(null);
  });
});

describe('frameOf', () => {
  it('ぎょうは じょうたいindex × 4 + ほうこうindex', () => {
    expect(frameOf('idle', 'down', SHEET, 0).row).toBe(0);
    expect(frameOf('idle', 'right', SHEET, 0).row).toBe(3);
    expect(frameOf('walk', 'down', SHEET, 0).row).toBe(4);
    expect(frameOf('attack', 'right', SHEET, 0).row).toBe(11);
  });

  it('idle と walk は ループする', () => {
    // idle は 2コマ・4fps なので 0.25びょうで 1コマ すすむ
    expect(frameOf('idle', 'down', SHEET, 0).col).toBe(0);
    expect(frameOf('idle', 'down', SHEET, 0.26).col).toBe(1);
    expect(frameOf('idle', 'down', SHEET, 0.51).col).toBe(0);
    // walk は 4コマ・8fps
    expect(frameOf('walk', 'up', SHEET, 0.38).col).toBe(3);
    expect(frameOf('walk', 'up', SHEET, 0.51).col).toBe(0);
  });

  it('attack は さいごの コマで とまる', () => {
    // attack は 3コマ・12fps なので 0.25びょうで おわる
    expect(frameOf('attack', 'left', SHEET, 0).col).toBe(0);
    expect(frameOf('attack', 'left', SHEET, 0.09).col).toBe(1);
    expect(frameOf('attack', 'left', SHEET, 0.2).col).toBe(2);
    expect(frameOf('attack', 'left', SHEET, 10).col).toBe(2);
  });

  it('けいかじかんが マイナスでも 0コマめに おちる', () => {
    expect(frameOf('walk', 'down', SHEET, -1).col).toBe(0);
  });
});

describe('AnimStore', () => {
  it('つくった ときは からっぽ', () => {
    expect(makeAnimStore().byUid.size).toBe(0);
  });

  it('reset で からに なる', () => {
    const store = makeAnimStore();
    store.byUid.set('u1', {
      dir: 'up', lastPos: { x: 0, y: 0 }, movingUntil: 1, attackUntil: 0, attackFrom: 0,
    });
    resetAnim(store);
    expect(store.byUid.size).toBe(0);
  });
});

const ATTACK_DUR = SHEET.attack.frames / SHEET.attack.fps; // 0.25

function ally(uid: string, x: number, y: number): AnimUnit {
  return { uid, pos: { x, y }, side: 'player' };
}

function attackEvent(uid: string, from: Vec2, to: Vec2): SimEvent {
  return { type: 'attack', uid, defId: 'roran', pos: from, targetPos: to };
}

describe('updateMotion', () => {
  it('うごいたら walk に なる', () => {
    const store = makeAnimStore();
    updateMotion(store, [ally('u1', 0, 100)], 0);
    expect(stateOf(store, 'u1', 0)).toBe('idle');

    updateMotion(store, [ally('u1', 0, 90)], 0.1);
    expect(stateOf(store, 'u1', 0.1)).toBe('walk');
    expect(store.byUid.get('u1')?.dir).toBe('up');
  });

  it('さぶんゼロの フレームが はさまっても walk の まま', () => {
    const store = makeAnimStore();
    updateMotion(store, [ally('u1', 0, 100)], 0);
    updateMotion(store, [ally('u1', 0, 90)], 0.1);
    // うごいていない フレーム。WALK_HOLD の うちは walk の まま
    updateMotion(store, [ally('u1', 0, 90)], 0.1 + WALK_HOLD / 2);
    expect(stateOf(store, 'u1', 0.1 + WALK_HOLD / 2)).toBe('walk');
  });

  it('WALK_HOLD を すぎたら idle に もどる', () => {
    const store = makeAnimStore();
    updateMotion(store, [ally('u1', 0, 100)], 0);
    updateMotion(store, [ally('u1', 0, 90)], 0.1);
    const after = 0.1 + WALK_HOLD + 0.01;
    updateMotion(store, [ally('u1', 0, 90)], after);
    expect(stateOf(store, 'u1', after)).toBe('idle');
  });

  it('いなくなった uid は きえる', () => {
    const store = makeAnimStore();
    updateMotion(store, [ally('u1', 0, 100), ally('u2', 0, 100)], 0);
    expect(store.byUid.size).toBe(2);
    updateMotion(store, [ally('u1', 0, 100)], 0.1);
    expect(store.byUid.has('u2')).toBe(false);
  });

  it('てきの はじめの むきは down', () => {
    const store = makeAnimStore();
    updateMotion(store, [{ uid: 'e1', pos: { x: 0, y: 0 }, side: 'enemy' }], 0);
    expect(store.byUid.get('e1')?.dir).toBe('down');
  });
});

describe('noteAttacks', () => {
  const durationOf = (): number | null => ATTACK_DUR;

  it('こうげきの むきに なり attack に なる', () => {
    const store = makeAnimStore();
    updateMotion(store, [ally('u1', 100, 100)], 0);
    noteAttacks(store, [attackEvent('u1', { x: 100, y: 100 }, { x: 140, y: 100 })], 1, durationOf);

    expect(stateOf(store, 'u1', 1)).toBe('attack');
    expect(store.byUid.get('u1')?.dir).toBe('right');
  });

  it('こうげきちゅうは うごいても むきが かわらない', () => {
    const store = makeAnimStore();
    updateMotion(store, [ally('u1', 100, 100)], 0);
    noteAttacks(store, [attackEvent('u1', { x: 100, y: 100 }, { x: 140, y: 100 })], 1, durationOf);
    // みぎを むいたまま うえへ あるく
    updateMotion(store, [ally('u1', 100, 80)], 1.1);

    expect(store.byUid.get('u1')?.dir).toBe('right');
    expect(stateOf(store, 'u1', 1.1)).toBe('attack');
  });

  it('こうげきが おわれば walk に もどる', () => {
    const store = makeAnimStore();
    updateMotion(store, [ally('u1', 100, 100)], 0);
    noteAttacks(store, [attackEvent('u1', { x: 100, y: 100 }, { x: 140, y: 100 })], 1, durationOf);
    const after = 1 + ATTACK_DUR + 0.01;
    updateMotion(store, [ally('u1', 100, 80)], after);

    expect(stateOf(store, 'u1', after)).toBe('walk');
    expect(store.byUid.get('u1')?.dir).toBe('up');
  });

  it('シートの ない ユニットは attack に ならない', () => {
    const store = makeAnimStore();
    updateMotion(store, [ally('u1', 100, 100)], 0);
    noteAttacks(store, [attackEvent('u1', { x: 100, y: 100 }, { x: 140, y: 100 })], 1, () => null);

    expect(stateOf(store, 'u1', 1)).toBe('idle');
    // むきだけは かわる
    expect(store.byUid.get('u1')?.dir).toBe('right');
  });
});

describe('frameFor', () => {
  it('しらない uid は STILL', () => {
    expect(frameFor(makeAnimStore(), 'u1', SHEET, 5)).toEqual(STILL);
  });

  it('attack の れつは こうげきを だした ときからの けいかじかんで きまる', () => {
    const store = makeAnimStore();
    updateMotion(store, [ally('u1', 100, 100)], 0);
    noteAttacks(store, [attackEvent('u1', { x: 100, y: 100 }, { x: 140, y: 100 })], 10, () => ATTACK_DUR);

    // attack / right は 11ぎょうめ。10.0 が 0コマめ、10.09 が 1コマめ
    expect(frameFor(store, 'u1', SHEET, 10)).toEqual({ row: 11, col: 0 });
    expect(frameFor(store, 'u1', SHEET, 10.09)).toEqual({ row: 11, col: 1 });
  });
});
