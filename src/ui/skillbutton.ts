import type { Registry } from '../engine/registry';
import type { BattleState } from '../core/types';

export type SkillButtonState = { label: string; enabled: boolean };

const NO_SELECTION: SkillButtonState = { label: 'なかまを えらぶ', enabled: false };

/**
 * ボタンは常に出しっぱなしにして、押せない理由を文字で見せる。
 * 押せないときに消してしまうと、なぜ押せないのかが画面から読めない。
 */
export function skillButtonState(
  reg: Registry,
  state: BattleState,
  selected: string | null,
): SkillButtonState {
  if (selected === null) return NO_SELECTION;
  const unit = state.units.find((u) => u.uid === selected);
  if (!unit || unit.retired || unit.skillId === null) return NO_SELECTION;

  const label = reg.skills.get(unit.skillId)?.label ?? 'スキル';
  const remaining = unit.skillCooldownUntil - state.time;
  if (remaining > 0) return { label: `${label}  あと ${Math.ceil(remaining)}`, enabled: false };
  return { label, enabled: true };
}
