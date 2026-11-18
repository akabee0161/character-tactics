import { describe, expect, it } from 'vitest';
import type { PendingRecruit, SimEvent } from '../core/types';
import type { LevelUpEvent } from './levelup';
import { nextInterrupt } from './interrupts';

const village = (fresh: boolean, villageId = 'v1', defId = 'gau'): SimEvent => ({
  type: 'villageVisited', uid: 'p1', defId, villageId, text: 'むらだ', fresh,
});
const levelUp: LevelUpEvent = {
  type: 'levelUp', uid: 'p1', defId: 'gau', level: 2, fromLevel: 1,
  before: { maxHp: 1, power: 1, guard: 1, resist: 1, speed: 1 }, after: { maxHp: 2, power: 2, guard: 1, resist: 1, speed: 1 },
};
const pending: PendingRecruit = {
  recruit: { unitId: 'ally05', level: 1, talk: [] }, pos: { x: 0, y: 0 }, foeUid: null, village: null,
};

describe('nextInterrupt', () => {
  it('fresh な村の出来事があれば村を返す', () => {
    expect(nextInterrupt([village(true, 'v7', 'mist')], [], null)).toEqual({
      kind: 'village', villageId: 'v7', visitorDefId: 'mist',
    });
  });

  it('fresh でない村だけなら止めない', () => {
    expect(nextInterrupt([village(false)], [], null)).toBeNull();
  });

  it('村とレベルアップが同じ束なら村が先', () => {
    expect(nextInterrupt([village(true)], [levelUp], null)?.kind).toBe('village');
  });

  it('同じ束に fresh な村が複数あれば、最初の 1 つ', () => {
    expect(nextInterrupt([village(true, 'a'), village(true, 'b')], [], null)).toMatchObject({ villageId: 'a' });
  });

  it('加入とレベルアップなら加入が先', () => {
    expect(nextInterrupt([], [levelUp], pending)).toEqual({ kind: 'recruit' });
  });

  it('レベルアップだけならレベルアップ', () => {
    expect(nextInterrupt([], [levelUp], null)).toEqual({ kind: 'levelUp' });
  });

  it('何もなければ null', () => {
    expect(nextInterrupt([], [], null)).toBeNull();
  });
});
