import { describe, expect, it } from 'vitest';
import { DIRS, STATES, STILL, dirOf, frameOf, makeAnimStore, resetAnim } from './anim';
import type { MapSheet } from '../engine/schema';

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
