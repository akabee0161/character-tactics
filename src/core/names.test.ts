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
  it('波かっこが無ければ変えない', () => {
    expect(fillNames('ふつうの 文', nameOf).text).toBe('ふつうの 文');
  });
});
