import { dropUnitField } from './fields';
import type { BattleState, Unit } from './types';

/** 退場したユニットの後始末（経路・交戦・予約された攻撃を外す）。resolveRemoval と加入で共有する */
export function cleanupRetired(state: BattleState, u: Unit): void {
  dropUnitField(state.fields, u.uid);
  u.pendingHit = null;
  u.engagedWith = null;
  u.closingOn = null;
  u.goalField = null;
  u.goalPos = null;
  for (const other of state.units) {
    if (other.engagedWith === u.uid) other.engagedWith = null;
  }
}

/** イベントも経験値も出さずに退場させる（説得で仲間になった敵） */
export function retireUnit(state: BattleState, u: Unit): void {
  u.retired = true;
  cleanupRetired(state, u);
}
