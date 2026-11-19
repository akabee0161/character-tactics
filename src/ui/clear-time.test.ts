import { describe, expect, it } from 'vitest';
import { formatClearTime, rankFor, RANK_COLOR, RANK_LABEL } from './clear-time';

const par = { gold: 60, silver: 90, bronze: 120 };

describe('formatClearTime', () => {
  it('1 分未満は秒だけ。端数は切り捨てる', () => {
    expect(formatClearTime(48.9)).toBe('48秒');
    expect(formatClearTime(0.4)).toBe('0秒');
  });
  it('1 分以上は分と秒。秒は 0 埋めしない', () => {
    expect(formatClearTime(60.9)).toBe('1分0秒');
    expect(formatClearTime(125)).toBe('2分5秒');
    expect(formatClearTime(134.2)).toBe('2分14秒');
  });
});

describe('rankFor', () => {
  it('画面に出す秒（切り捨て）で比べ、目安ちょうどを含む', () => {
    expect(rankFor(60.9, par)).toBe('gold');
    expect(rankFor(61, par)).toBe('silver');
    expect(rankFor(90.99, par)).toBe('silver');
    expect(rankFor(120.5, par)).toBe('bronze');
    expect(rankFor(121, par)).toBeNull();
  });
  it('金より速ければ金', () => {
    expect(rankFor(5, par)).toBe('gold');
  });
});

describe('RANK_LABEL / RANK_COLOR', () => {
  it('金・銀・銅の文字と色がある', () => {
    expect(RANK_LABEL).toEqual({ gold: '金', silver: '銀', bronze: '銅' });
    for (const k of ['gold', 'silver', 'bronze'] as const) expect(RANK_COLOR[k]).toMatch(/^#[0-9a-f]{6}$/);
  });
});
