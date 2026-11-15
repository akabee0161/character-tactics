import type { SkillDef } from '../engine/schema';

/** 技の一言の説明。`{名前}` を params の値に置き換える（検証は validateSkillsFile が済ませている） */
export function skillSummary(skill: SkillDef): string {
  return skill.summary.replace(/\{(\w+)\}/g, (_, key: string) => String(skill.params[key] ?? ''));
}
