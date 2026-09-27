import { nearestWithin } from './combat';
import { AUTO_CLOSE_RANGE } from './constants';
import { hasLineOfSight } from './field';
import type { Grid, Unit } from './types';

/**
 * 自分から詰め寄れる味方か。プレイヤーが操作する近接で、移動の指示が無く、交戦していないこと。
 * 移動の指示は交戦より優先する、という既存のルールに合わせ、指示中は詰め寄らない
 */
export function canAutoClose(u: Unit): boolean {
  return u.controller === 'player' && u.attack === 'melee' && u.combat && !u.retired
    && u.goalPos === null && u.engagedWith === null;
}

/**
 * 詰め寄る相手。AUTO_CLOSE_RANGE 以内で、見通せて、ほかのユニットの交戦相手になっていない最寄りの敵。
 * 交戦相手になっている敵へ近づいても、1体につき交戦は1体までなので攻撃できない
 */
export function pickCloseTarget(
  self: Unit, hostiles: readonly Unit[], claimed: ReadonlySet<string>, grid: Grid,
): Unit | null {
  if (!canAutoClose(self)) return null;
  const candidates = hostiles.filter(
    (h) => !claimed.has(h.uid) && hasLineOfSight(grid, self.pos, h.pos),
  );
  return nearestWithin(self.pos, candidates, AUTO_CLOSE_RANGE);
}
