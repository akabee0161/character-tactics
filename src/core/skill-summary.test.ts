import { describe, expect, it } from 'vitest';
import { skillSummary } from './skill-summary';
import { testRegistry } from './testing';

describe('skillSummary', () => {
  it('params の値を差し込む', () => {
    expect(skillSummary({ id: 'x', label: 'X', summary: '{duration}秒 +{power}', params: { duration: 8, power: 2, cooldown: 1 } }))
      .toBe('8秒 +2');
  });

  it('ハイフンを含むキーも差し込む', () => {
    expect(skillSummary({ id: 'x', label: 'X', summary: '{damage-rate}倍', params: { 'damage-rate': 7, cooldown: 1 } }))
      .toBe('7倍');
  });

  it('本物の skills.json の全部の技に summary があり、差し込み忘れが無い', () => {
    const skills = [...testRegistry().skills.values()];
    expect(skills.length).toBeGreaterThan(0);
    for (const s of skills) {
      expect(skillSummary(s)).not.toMatch(/[{}]/);
      expect(skillSummary(s).length).toBeGreaterThan(0);
    }
  });
});
