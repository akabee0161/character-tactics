import { describe, expect, it } from 'vitest';
import { makeGrid } from './field';
import { dropUnitField, fieldToStatic, fieldToUnit, makeFieldCache } from './fields';
import type { Unit } from './types';

const GRID = makeGrid(32, [
  '########',
  '#......#',
  '#......#',
  '#......#',
  '########',
]);

function fakeUnit(uid: string, x: number, y: number): Unit {
  return { uid, pos: { x, y } } as unknown as Unit;
}

describe('fieldToUnit', () => {
  it('おなじ セルに いる あいだは おなじ フィールドを かえす', () => {
    const cache = makeFieldCache();
    const u = fakeUnit('e1', 48, 48);
    const first = fieldToUnit(cache, GRID, u);
    u.pos = { x: 60, y: 60 };   // 同じセル (1,1) のなか
    expect(fieldToUnit(cache, GRID, u)).toBe(first);
  });

  it('セルを またいだら さいけいさんする', () => {
    const cache = makeFieldCache();
    const u = fakeUnit('e1', 48, 48);
    const first = fieldToUnit(cache, GRID, u);
    u.pos = { x: 80, y: 48 };   // セル (2,1)
    expect(fieldToUnit(cache, GRID, u)).not.toBe(first);
  });

  it('セルを もどっても さいけいさんする（もつのは 1まいだけ）', () => {
    const cache = makeFieldCache();
    const u = fakeUnit('e1', 48, 48);
    const first = fieldToUnit(cache, GRID, u);
    u.pos = { x: 80, y: 48 };
    fieldToUnit(cache, GRID, u);
    u.pos = { x: 48, y: 48 };
    expect(fieldToUnit(cache, GRID, u)).not.toBe(first);
    expect(cache.byUnit.size).toBe(1);
  });

  it('ユニットごとに 1まいだけ もつ', () => {
    const cache = makeFieldCache();
    fieldToUnit(cache, GRID, fakeUnit('a', 48, 48));
    fieldToUnit(cache, GRID, fakeUnit('b', 80, 48));
    expect(cache.byUnit.size).toBe(2);
  });

  it('ゴールへの きょりが ただしく はいる', () => {
    const cache = makeFieldCache();
    const field = fieldToUnit(cache, GRID, fakeUnit('e1', 48, 48));
    expect(field.dist[1 * GRID.cols + 1]).toBe(0);
    expect(field.dist[1 * GRID.cols + 2]).toBeGreaterThan(0);
  });
});

describe('fieldToStatic', () => {
  it('おなじ セルの ゴールなら つかいまわす', () => {
    const cache = makeFieldCache();
    const first = fieldToStatic(cache, GRID, { x: 48, y: 48 });
    expect(fieldToStatic(cache, GRID, { x: 60, y: 60 })).toBe(first);
    expect(cache.static.size).toBe(1);
  });

  it('ちがう セルの ゴールなら べつに もつ', () => {
    const cache = makeFieldCache();
    fieldToStatic(cache, GRID, { x: 48, y: 48 });
    fieldToStatic(cache, GRID, { x: 80, y: 48 });
    expect(cache.static.size).toBe(2);
  });
});

describe('dropUnitField', () => {
  it('していした ユニットの ぶんだけ すてる', () => {
    const cache = makeFieldCache();
    fieldToUnit(cache, GRID, fakeUnit('a', 48, 48));
    fieldToUnit(cache, GRID, fakeUnit('b', 80, 48));
    dropUnitField(cache, 'a');
    expect(cache.byUnit.has('a')).toBe(false);
    expect(cache.byUnit.has('b')).toBe(true);
  });

  it('いない uid を わたしても おちない', () => {
    const cache = makeFieldCache();
    expect(() => dropUnitField(cache, 'nai')).not.toThrow();
  });
});
