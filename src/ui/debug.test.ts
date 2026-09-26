import { describe, expect, it } from 'vitest';
import { SLOW_FACTOR, debugKey, debugLabel, isDebugMode, makeDebugClock, simDt } from './debug';

const FIXED = 1 / 60;

describe('isDebugMode', () => {
  it('?debug が あれば true', () => {
    expect(isDebugMode('?debug')).toBe(true);
    expect(isDebugMode('?stage=1&debug=1')).toBe(true);
  });
  it('なければ false', () => {
    expect(isDebugMode('')).toBe(false);
    expect(isDebugMode('?stage=1')).toBe(false);
  });
});

describe('simDt', () => {
  it('ふだんは実時間のまま', () => {
    expect(simDt(makeDebugClock(), 0.02, FIXED)).toBe(0.02);
  });

  it('S で 1/4 の速さになり、もう一度で戻る', () => {
    const c = makeDebugClock();
    expect(debugKey(c, 's')).toBe(true);
    expect(simDt(c, 0.02, FIXED)).toBeCloseTo(0.02 * SLOW_FACTOR, 10);
    debugKey(c, 'S');
    expect(simDt(c, 0.02, FIXED)).toBe(0.02);
  });

  it('P で止まり、もう一度で動き出す', () => {
    const c = makeDebugClock();
    debugKey(c, 'p');
    expect(simDt(c, 0.02, FIXED)).toBe(0);
    debugKey(c, 'P');
    expect(simDt(c, 0.02, FIXED)).toBe(0.02);
  });

  it('止まっているあいだ . で1ステップぶんだけ進む', () => {
    const c = makeDebugClock();
    debugKey(c, 'p');
    debugKey(c, '.');
    expect(simDt(c, 0.02, FIXED)).toBe(FIXED);
    expect(simDt(c, 0.02, FIXED)).toBe(0);
  });

  it('動いているあいだの . は何もしない（次に止めたときに勝手に進まない）', () => {
    const c = makeDebugClock();
    debugKey(c, '.');
    debugKey(c, 'p');
    expect(simDt(c, 0.02, FIXED)).toBe(0);
  });

  it('知らないキーは false を返す', () => {
    expect(debugKey(makeDebugClock(), 'x')).toBe(false);
  });
});

describe('debugLabel', () => {
  it('状態を短く表す', () => {
    const c = makeDebugClock();
    expect(debugLabel(c)).toBe('x1');
    debugKey(c, 's');
    expect(debugLabel(c)).toBe('x1/4');
    debugKey(c, 'p');
    expect(debugLabel(c)).toBe('PAUSE');
  });
});
