import { describe, expect, it } from 'vitest';
import { MIN_TAP, hitRect, pickUnit } from './hit';
import type { Unit } from '../core/types';

const unit = (uid: string, x: number, y: number, retired = false) =>
  ({ uid, pos: { x, y }, retired } as unknown as Unit);

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

describe('pickUnit', () => {
  const units = [unit('u-roran', 100, 100), unit('u-ines', 140, 100), unit('u-gau', 300, 300, true)];

  it('近い味方を返す', () => {
    expect(pickUnit(units, { x: 105, y: 100 })).toBe('u-roran');
  });

  it('どちらにも近いときは いちばん近いほう', () => {
    expect(pickUnit(units, { x: 132, y: 100 })).toBe('u-ines');
  });

  it('遠ければ null', () => {
    expect(pickUnit(units, { x: 500, y: 500 })).toBeNull();
  });

  it('たいきゃく中の味方は選べない', () => {
    expect(pickUnit(units, { x: 300, y: 300 })).toBeNull();
  });

  it('半径を指定できる', () => {
    expect(pickUnit(units, { x: 100, y: 160 }, 70)).toBe('u-roran');
    expect(pickUnit(units, { x: 100, y: 160 }, 40)).toBeNull();
  });

  it('既定の判定半径は 32 まで拾う', () => {
    const list = [unit('u-roran', 100, 100)];
    expect(pickUnit(list, { x: 132, y: 100 })).toBe('u-roran');
    expect(pickUnit(list, { x: 133, y: 100 })).toBeNull();
  });
});
