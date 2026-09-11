import { describe, expect, it } from 'vitest';
import { clampScroll, isTap, maxScroll } from './scroll';

describe('maxScroll', () => {
  it('収まるなら 0', () => {
    expect(maxScroll(300, 480)).toBe(0);
    expect(maxScroll(480, 480)).toBe(0);
  });

  it('あふれたぶんを返す', () => {
    expect(maxScroll(700, 480)).toBe(220);
  });
});

describe('clampScroll', () => {
  it('0 より小さくならない', () => {
    expect(clampScroll(-50, 220)).toBe(0);
  });

  it('max より大きくならない', () => {
    expect(clampScroll(999, 220)).toBe(220);
  });

  it('あいだは そのまま', () => {
    expect(clampScroll(100, 220)).toBe(100);
  });

  it('max が 0 なら つねに 0', () => {
    expect(clampScroll(100, 0)).toBe(0);
  });
});

describe('isTap', () => {
  it('動いていなければ タップ', () => {
    expect(isTap(0)).toBe(true);
  });

  it('上下どちらの向きでも 同じ しきい値', () => {
    expect(isTap(12)).toBe(true);
    expect(isTap(-12)).toBe(true);
    expect(isTap(13)).toBe(false);
    expect(isTap(-13)).toBe(false);
  });
});
