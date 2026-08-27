import { describe, expect, it } from 'vitest';
import { MIN_TAP, hitRect, pickAlly } from './hit';
import type { AllyUnit } from '../core/types';

const unit = (id: AllyUnit['id'], x: number, y: number, retired = false) =>
  ({ id, pos: { x, y }, retired } as unknown as AllyUnit);

describe('hitRect', () => {
  const r = { x: 10, y: 20, w: 100, h: 50 };

  it('内側なら true', () => {
    expect(hitRect(r, { x: 50, y: 40 })).toBe(true);
  });

  it('外側なら false', () => {
    expect(hitRect(r, { x: 5, y: 40 })).toBe(false);
    expect(hitRect(r, { x: 50, y: 80 })).toBe(false);
  });

  it('左上のかどは含む', () => {
    expect(hitRect(r, { x: 10, y: 20 })).toBe(true);
  });

  it('右下のかどは含まない', () => {
    expect(hitRect(r, { x: 110, y: 70 })).toBe(false);
  });
});

describe('MIN_TAP', () => {
  it('こどもの ゆびを 想定して 64', () => {
    expect(MIN_TAP).toBe(64);
  });
});

describe('pickAlly', () => {
  const allies = [unit('roran', 100, 100), unit('ines', 140, 100), unit('gau', 300, 300, true)];

  it('近い味方を返す', () => {
    expect(pickAlly(allies, { x: 105, y: 100 })).toBe('roran');
  });

  it('どちらにも近いときは いちばん近いほう', () => {
    expect(pickAlly(allies, { x: 132, y: 100 })).toBe('ines');
  });

  it('遠ければ null', () => {
    expect(pickAlly(allies, { x: 500, y: 500 })).toBeNull();
  });

  it('たいきゃく中の味方は選べない', () => {
    expect(pickAlly(allies, { x: 300, y: 300 })).toBeNull();
  });

  it('半径を指定できる', () => {
    expect(pickAlly(allies, { x: 100, y: 160 }, 70)).toBe('roran');
    expect(pickAlly(allies, { x: 100, y: 160 }, 40)).toBeNull();
  });

  it('既定の判定半径は 32 まで拾う', () => {
    const list = [unit('roran', 100, 100)];
    expect(pickAlly(list, { x: 132, y: 100 })).toBe('roran');
    expect(pickAlly(list, { x: 133, y: 100 })).toBeNull();
  });
});
