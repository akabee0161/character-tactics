import { describe, expect, it } from 'vitest';
import { resultLine } from './result-text';
import type { XpGain } from './flow';
import { testRegistry } from '../core/testing';
import { statsForLevel } from '../core/state';

describe('resultLine', () => {
  it('レベルアップした行に上がった能力を書く', () => {
    const reg = testRegistry();
    const g: XpGain = { id: 'roran', before: { level: 3, xp: 0 }, after: { level: 4, xp: 1 }, leveledUp: true, joined: false };
    expect(resultLine(reg, g)).toBe('レベルアップ！ Lv3 → Lv4　HP+1　攻撃力+1');
  });

  it('魔法のユニット（ミスト）の行は「攻撃力+」でなく「魔力+」', () => {
    const reg = testRegistry();
    const mist = reg.units.get('mist')!;
    // 魔力が上がるレベルを探す（伸びが 0 でなければ、どこかで上がる）
    let level = 2;
    while (level < 30 && statsForLevel(mist, level).power === statsForLevel(mist, 1).power) level++;
    const g: XpGain = { id: 'mist', before: { level: 1, xp: 0 }, after: { level, xp: 0 }, leveledUp: true, joined: false };
    const line = resultLine(reg, g);
    expect(line).toContain('魔力+');
    expect(line).not.toContain('攻撃力+');
  });

  it('2 レベル以上上がったら、まとめた分を書く', () => {
    const reg = testRegistry();
    const g: XpGain = { id: 'roran', before: { level: 1, xp: 0 }, after: { level: 3, xp: 0 }, leveledUp: true, joined: false };
    expect(resultLine(reg, g)).toBe('レベルアップ！ Lv1 → Lv3　HP+2');
  });

  it('上がらなかった行は今の形', () => {
    const reg = testRegistry();
    const g: XpGain = { id: 'roran', before: { level: 3, xp: 0 }, after: { level: 3, xp: 5 }, leveledUp: false, joined: false };
    expect(resultLine(reg, g)).toBe(`Lv3 (5/${3 * reg.growth.xpPerLevel})`);
  });

  it('加入した行は加入の文', () => {
    const reg = testRegistry();
    const g: XpGain = { id: 'ally05', before: { level: 1, xp: 0 }, after: { level: 2, xp: 0 }, leveledUp: true, joined: true };
    expect(resultLine(reg, g)).toBe('仲間に 加わった！');
  });
});
