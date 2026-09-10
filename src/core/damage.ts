import { computeDamage, isFunbaruActive } from './combat';
import { PINCH_RATIO } from './constants';
import type { BattleState, HitSource, Unit } from './types';

/**
 * 命中1回ぶんを解決する。近接の攻撃も飛翔体の着弾も必ずここを通す。
 * 2箇所に分けて書くと、ピンチの判定やカウンタの積み方がすぐに食い違う
 */
export function applyDamage(state: BattleState, source: HitSource, target: Unit): number {
  const before = target.hp;
  const dmg = computeDamage({
    power: source.power,
    guard: target.guard,
    attackKind: source.attack,
    bowDamageCap: target.bowDamageCap,
    bondBonus: source.bondBonus,
    neraiuchi: source.neraiuchi,
    targetFunbaru: isFunbaruActive(target, state.time),
  });

  target.hp -= dmg;
  target.lastHitBy = source.uid;
  target.lastHitNeraiuchi = source.neraiuchi;
  if (!target.damagedBy.includes(source.uid)) target.damagedBy.push(source.uid);

  state.events.push({
    type: 'hit', targetUid: target.uid, targetPos: { ...target.pos }, amount: dmg,
    sourceUid: source.uid, sourceDefId: source.defId, attackKind: source.attack,
    sourcePos: { ...source.pos }, neraiuchi: source.neraiuchi,
  });

  // ピンチのセリフは操作できる味方にだけ出す
  if (target.side === 'player' && target.hp > 0 && !target.pinchShown) {
    const ratio = target.hp / target.maxHp;
    if (ratio < PINCH_RATIO && before / target.maxHp >= PINCH_RATIO) {
      target.pinchShown = true;
      state.events.push({ type: 'pinch', uid: target.uid, defId: target.defId });
    }
  }

  return dmg;
}
