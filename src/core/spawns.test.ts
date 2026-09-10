import { describe, expect, it } from 'vitest';
import { dueSpawns } from './spawns';
import type { SpawnerDef } from '../engine/schema';

const sp = (over: Partial<SpawnerDef> = {}): SpawnerDef => ({
  defId: 'narazumono', pos: { x: 0, y: 0 }, firstAfter: 10, every: 5, total: 3, ...over,
});

describe('dueSpawns', () => {
  it('firstAfter より前は湧かない', () => {
    expect(dueSpawns([sp()], [0], 9.9)).toEqual([]);
  });

  it('firstAfter に達したら1体目が湧く', () => {
    expect(dueSpawns([sp()], [0], 10)).toEqual([{ index: 0, spawner: sp() }]);
  });

  it('2体目は every ぶん待つ', () => {
    expect(dueSpawns([sp()], [1], 14.9)).toEqual([]);
    expect(dueSpawns([sp()], [1], 15)).toHaveLength(1);
  });

  it('total に達したら湧かない', () => {
    expect(dueSpawns([sp()], [3], 9999)).toEqual([]);
  });

  it('1回の呼び出しで湧き口ごとに最大1体', () => {
    expect(dueSpawns([sp()], [0], 9999)).toHaveLength(1);
  });

  it('湧き口ごとに独立して数える', () => {
    const r = dueSpawns([sp({ total: 1 }), sp({ firstAfter: 0 })], [1, 0], 10);
    expect(r.map((d) => d.index)).toEqual([1]);
  });

  it('湧き口が無ければ何も返さない', () => {
    expect(dueSpawns([], [], 9999)).toEqual([]);
  });
});
