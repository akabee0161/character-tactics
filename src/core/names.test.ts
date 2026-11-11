import { describe, expect, it } from 'vitest';
import { fillNames } from './names';

const nameOf = (id: string) => ({ ally06: 'セラ', mist: 'ミスト' } as Record<string, string>)[id] ?? null;

describe('fillNames', () => {
  it('{id} を名前にする', () => {
    expect(fillNames('{ally06}と {mist}', nameOf)).toEqual({ text: 'セラと ミスト', unknown: [] });
  });
  it('知らない id はそのまま残し unknown に入れる', () => {
    expect(fillNames('{nobody}だ', nameOf)).toEqual({ text: '{nobody}だ', unknown: ['nobody'] });
  });
  it('知らない id が重なっても unknown は 1 回だけ。既知と混ざっても既知は名前になる', () => {
    expect(fillNames('{x}と {x}と {ally06}と {y}', nameOf)).toEqual({
      text: '{x}と {x}と セラと {y}', unknown: ['x', 'y'],
    });
  });
  it('波かっこが無ければ変えない', () => {
    expect(fillNames('ふつうの 文', nameOf).text).toBe('ふつうの 文');
  });
});
