import { describe, expect, it } from 'vitest';
import { distance } from './field';
import { separatedStep } from './separation';

const MIN = 24;

describe('separatedStep', () => {
  it('相手がいなければ to をそのまま返す', () => {
    expect(separatedStep({ x: 0, y: 0 }, { x: 10, y: 0 }, [], MIN)).toEqual({ x: 10, y: 0 });
  });

  it('相手が遠ければ to のまま', () => {
    expect(separatedStep({ x: 0, y: 0 }, { x: 10, y: 0 }, [{ x: 100, y: 0 }], MIN)).toEqual({ x: 10, y: 0 });
  });

  it('真正面の相手には minDist ちょうどで止まる', () => {
    const p = separatedStep({ x: 0, y: 0 }, { x: 10, y: 0 }, [{ x: 30, y: 0 }], MIN);
    expect(p.x).toBeCloseTo(6, 10);
    expect(p.y).toBeCloseTo(0, 10);
  });

  it('斜めに当たると、相手の横へすべって進む', () => {
    const other = { x: 30, y: 10 };
    const p = separatedStep({ x: 0, y: 0 }, { x: 10, y: 0 }, [other], MIN);
    expect(distance(p, other)).toBeCloseTo(MIN, 10);
    expect(p.x).toBeGreaterThan(5);
    expect(p.y).toBeLessThan(0);
  });

  it('すでに内側にいるとき、離れる向きには動ける', () => {
    expect(separatedStep({ x: 0, y: 0 }, { x: -1, y: 0 }, [{ x: 10, y: 0 }], MIN)).toEqual({ x: -1, y: 0 });
  });

  it('すでに内側にいるとき、近づく向きには動けない', () => {
    const p = separatedStep({ x: 0, y: 0 }, { x: 1, y: 0 }, [{ x: 10, y: 0 }], MIN);
    expect(p.x).toBeCloseTo(0, 10);
    expect(p.y).toBeCloseTo(0, 10);
  });

  it('どんな向きに動いても、相手へ min(minDist, 今の距離) より近づかない', () => {
    const others = [{ x: 20, y: 5 }, { x: 5, y: 22 }, { x: -18, y: -8 }];
    for (let a = 0; a < 16; a++) {
      const ang = (a / 16) * Math.PI * 2;
      const from = { x: 0, y: 0 };
      const to = { x: Math.cos(ang) * 3, y: Math.sin(ang) * 3 };
      const p = separatedStep(from, to, others, MIN);
      for (const o of others) {
        expect(distance(p, o)).toBeGreaterThanOrEqual(Math.min(MIN, distance(from, o)) - 1e-6);
      }
    }
  });
});
