import { SUMMARY_PLACEHOLDER } from '../engine/schema';
import type { SkillDef } from '../engine/schema';

/** 技の一言の説明。`{名前}` を params の値に置き換える（検証は validateSkillsFile が済ませている） */
export function skillSummary(skill: SkillDef): string {
  return skill.summary.replace(new RegExp(SUMMARY_PLACEHOLDER, 'g'), (_, key: string) =>
    Object.hasOwn(skill.params, key) ? String(skill.params[key]) : '');
}
