import { describe, expect, it } from 'vitest';
import { canAutoClose, pickCloseTarget } from './autoclose';
import { makeGrid } from './field';
import type { Unit } from './types';

function unit(over: Partial<Unit>): Unit {
  return {
    uid: 'u', side: 'player', controller: 'player', attack: 'melee', combat: true, retired: false,
    goalPos: null, engagedWith: null, pos: { x: 0, y: 0 }, hp: 10,
    ...over,
  } as unknown as Unit;
}

const OPEN = makeGrid(32, ['..........', '..........', '..........']);

describe('canAutoClose', () => {
  it('移動の指示が無く、交戦していない近接の味方だけ', () => {
    expect(canAutoClose(unit({}))).toBe(true);
    expect(canAutoClose(unit({ attack: 'bow' }))).toBe(false);
    expect(canAutoClose(unit({ combat: false }))).toBe(false);
    expect(canAutoClose(unit({ controller: 'ai' }))).toBe(false);
    expect(canAutoClose(unit({ goalPos: { x: 1, y: 1 } }))).toBe(false);
    expect(canAutoClose(unit({ engagedWith: 'e1' }))).toBe(false);
    expect(canAutoClose(unit({ retired: true }))).toBe(false);
  });
});

describe('pickCloseTarget', () => {
  const self = unit({ pos: { x: 48, y: 48 } });

  it('64px 以内で最寄りの敵を返す', () => {
    const near = unit({ uid: 'e1', side: 'enemy', pos: { x: 98, y: 48 } });   // 50px
    const nearer = unit({ uid: 'e2', side: 'enemy', pos: { x: 48, y: 88 } }); // 40px
    expect(pickCloseTarget(self, [near, nearer], new Set(), OPEN)?.uid).toBe('e2');
  });

  it('64px より遠ければ null', () => {
    const far = unit({ uid: 'e1', side: 'enemy', pos: { x: 120, y: 48 } }); // 72px
    expect(pickCloseTarget(self, [far], new Set(), OPEN)).toBeNull();
  });

  it('ほかのユニットの交戦相手になっている敵は選ばない', () => {
    const e = unit({ uid: 'e1', side: 'enemy', pos: { x: 98, y: 48 } });
    expect(pickCloseTarget(self, [e], new Set(['e1']), OPEN)).toBeNull();
  });

  it('壁ごしの敵は選ばない', () => {
    const walled = makeGrid(32, ['..#.......', '..#.......', '..#.......']);
    const e = unit({ uid: 'e1', side: 'enemy', pos: { x: 104, y: 48 } }); // 56px。間に壁
    expect(pickCloseTarget(self, [e], new Set(), walled)).toBeNull();
  });

  it('詰め寄れない味方なら null', () => {
    const e = unit({ uid: 'e1', side: 'enemy', pos: { x: 98, y: 48 } });
    expect(pickCloseTarget(unit({ pos: { x: 48, y: 48 }, attack: 'bow' }), [e], new Set(), OPEN)).toBeNull();
  });
});
