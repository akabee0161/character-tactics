import { SUMMARY_PLACEHOLDER } from '../engine/schema';
import type { SkillDef } from '../engine/schema';

/** 技を使う人の攻撃力（魔力）を足して出す量。ダメージの技の damage と、回復の技の heal */
export const SCALED_SKILL_PARAMS = ['damage', 'heal'] as const;

/**
 * 技の一言の説明。`{名前}` を params の値に置き換える（検証は validateSkillsFile が済ませている）。
 * {damage}・{heal} は power（使う人の攻撃力、魔法なら魔力）を足した値にする。技の量が基本量 + 攻撃力なので、
 * カードで見える数がそのまま実際の量になる
 */
export function skillSummary(skill: SkillDef, power = 0): string {
  return skill.summary.replace(new RegExp(SUMMARY_PLACEHOLDER, 'g'), (_, key: string) => {
    if (!Object.hasOwn(skill.params, key)) return '';
    const base = skill.params[key]!;
    const scaled = (SCALED_SKILL_PARAMS as readonly string[]).includes(key);
    return String(scaled ? base + power : base);
  });
}
