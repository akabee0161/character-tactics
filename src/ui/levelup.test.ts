import { describe, expect, it } from 'vitest';
import { levelUpCard, mergeLevelUps } from './levelup';
import type { LevelUpEvent } from './levelup';
import { testRegistry } from '../core/testing';

const st = (hp: number) => ({ maxHp: hp, power: 6, guard: 5, resist: 2, speed: 60 });
const lv = (uid: string, from: number, to: number, b: number, a: number): LevelUpEvent =>
  ({ type: 'levelUp', uid, defId: 'roran', fromLevel: from, level: to, before: st(b), after: st(a) });

describe('mergeLevelUps', () => {
  it('同じ人の 2 回は 1 件にまとめ、前は最初・後は最後', () => {
    expect(mergeLevelUps([], [lv('p1', 1, 2, 30, 31), lv('p1', 2, 3, 31, 32)])).toEqual([lv('p1', 1, 3, 30, 32)]);
  });

  it('前の tick から残っている同じ人にも続けてまとめる', () => {
    expect(mergeLevelUps([lv('p1', 1, 2, 30, 31)], [lv('p1', 2, 3, 31, 32)])).toEqual([lv('p1', 1, 3, 30, 32)]);
  });

  it('別の人は起きた順に並ぶ。ほかのイベントは無視する', () => {
    const q = mergeLevelUps([lv('p1', 1, 2, 30, 31)], [{ type: 'unitRetired', uid: 'x', defId: 'x' }, lv('p2', 3, 4, 20, 21)]);
    expect(q.map((e) => e.uid)).toEqual(['p1', 'p2']);
  });

  it('元の queue を書き換えない', () => {
    const q = [lv('p1', 1, 2, 30, 31)];
    mergeLevelUps(q, [lv('p1', 2, 3, 31, 32)]);
    expect(q).toEqual([lv('p1', 1, 2, 30, 31)]);
  });
});

describe('levelUpCard', () => {
  it('札の前後と見出しのレベル', () => {
    const c = levelUpCard(testRegistry(), lv('p1', 4, 5, 33, 34));
    expect(c.level).toBe(5);
    expect(c.before).toEqual({ level: 4, stats: st(33) });
    expect(c.stats).toEqual(st(34));
  });
});
