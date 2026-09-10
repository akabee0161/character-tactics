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
  const after = applyXp({ level: unit.level, xp: unit.xp }, amount, state.reg.growth);
  unit.level = after.level;
  unit.xp = after.xp;
  if (after.level === before) return;

  const def = state.reg.units.get(unit.defId) ?? state.reg.enemies.get(unit.defId);
  if (!def) return;
  const stats = statsForLevel(def, after.level, state.reg.growth);
  const gainedMaxHp = stats.maxHp - unit.maxHp;
  unit.maxHp = stats.maxHp;
  unit.power = stats.power;
  unit.hp = Math.min(unit.maxHp, unit.hp + Math.max(0, gainedMaxHp));

  state.events.push({ type: 'levelUp', uid: unit.uid, defId: unit.defId, level: after.level });
}

/** 味方にだけ経験値を入れる。敵は育たない */
function awardXpTo(state: BattleState, uid: string, amount: number): void {
  if (amount <= 0) return;
  const unit = state.units.find((u) => u.uid === uid);
  if (!unit || unit.side !== 'player') return;
  awardXp(state, unit, amount);
}

/**
 * その tick のイベントを見て経験値を配る。
 * 命中・回復・撃破の3つが入り口で、撃破はとどめ役に全額、
 * ダメージを与えた他の味方に assistRatio ぶんを配る
 */
export function awardXpForEvents(state: BattleState): void {
  const { hitXp, healXp, assistRatio } = state.reg.growth;
  // 走査中に events へ levelUp が積まれるので、先にコピーを取る
  const events = [...state.events];
  for (const ev of events) {
    if (ev.type === 'hit') {
      awardXpTo(state, ev.sourceUid, hitXp);
    } else if (ev.type === 'heal') {
      awardXpTo(state, ev.sourceUid, healXp);
    } else if (ev.type === 'unitDefeated') {
      const reward = state.reg.enemies.get(ev.defId)?.xpReward ?? 0;
      if (ev.byUid !== null) awardXpTo(state, ev.byUid, reward);
      const victim = state.units.find((u) => u.uid === ev.uid);
      const assist = Math.floor(reward * assistRatio);
      for (const uid of victim?.damagedBy ?? []) {
        // とどめ役は全額を受け取っているので二重取りさせない
        if (uid === ev.byUid) continue;
        awardXpTo(state, uid, assist);
      }
    }
  }
}
