import type { Registry } from '../engine/registry';
import type { BattleState } from '../core/types';

export type SkillButtonState = { label: string; enabled: boolean };

const NO_SELECTION: SkillButtonState = { label: 'なかまを えらぶ', enabled: false };
const RETIRED: SkillButtonState = { label: 'たいきゃくした', enabled: false };
const NO_SKILL: SkillButtonState = { label: 'わざが ない', enabled: false };

/**
 * ボタンは常に出しっぱなしにして、押せない理由を文字で見せる。
 * 押せないときに消してしまうと、なぜ押せないのかが画面から読めない。
 * 「なかまを えらぶ」は未選択のときだけの文言なので、選択済みで押せない場合は
 * 退却・スキルなしそれぞれの理由を別のラベルで返す。
 */
export function skillButtonState(
  reg: Registry,
  state: BattleState,
  selected: string | null,
): SkillButtonState {
  if (selected === null) return NO_SELECTION;
  const unit = state.units.find((u) => u.uid === selected);
  if (!unit) return NO_SELECTION;
  if (unit.retired) return RETIRED;
  if (unit.skillId === null) return NO_SKILL;

  const label = reg.skills.get(unit.skillId)?.label ?? 'スキル';
  const remaining = unit.skillCooldownUntil - state.time;
  if (remaining > 0) return { label: `${label}  あと ${Math.ceil(remaining)}`, enabled: false };
  return { label, enabled: true };
}
