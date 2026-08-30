import { applyXp } from './progress';
import { statsForLevel } from './state';
import type { BattleState, Unit } from './types';

/**
 * 経験値を渡し、レベルが上がったら能力を上げる。
 * 増えた最大 HP のぶんだけ現在 HP も増やすが、全回復にはしない。
 * 回復を目的にレベルアップを溜める、という戦い方を成立させないため。
 */
export function awardXp(state: BattleState, unit: Unit, amount: number): void {
  if (unit.retired || amount <= 0) return;

  const before = unit.level;
  const after = applyXp({ level: unit.level, xp: unit.xp }, amount);
  unit.level = after.level;
  unit.xp = after.xp;
  if (after.level === before) return;

  const def = state.reg.units.get(unit.defId) ?? state.reg.enemies.get(unit.defId);
  if (!def) return;
  const stats = statsForLevel(def, after.level);
  const gainedMaxHp = stats.maxHp - unit.maxHp;
  unit.maxHp = stats.maxHp;
  unit.power = stats.power;
  unit.hp = Math.min(unit.maxHp, unit.hp + Math.max(0, gainedMaxHp));

  state.events.push({ type: 'levelUp', uid: unit.uid, defId: unit.defId, level: after.level });
}

/** その tick の撃破を見て、とどめを刺したユニットへ経験値を渡す */
export function awardXpForDefeats(state: BattleState): void {
  // 走査中に events へ levelUp が積まれるので、先にコピーを取る
  const defeats = state.events.filter((e) => e.type === 'unitDefeated');
  for (const ev of defeats) {
    if (ev.type !== 'unitDefeated' || ev.byUid === null) continue;
    const killer = state.units.find((u) => u.uid === ev.byUid);
    if (!killer || killer.side !== 'player') continue;
    const reward = state.reg.enemies.get(ev.defId)?.xpReward ?? 0;
    awardXp(state, killer, reward);
  }
}
