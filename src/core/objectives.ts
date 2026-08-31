import { distance } from './field';
import type { DefeatCond, VictoryCond } from '../engine/schema';
import type { BattleState, Unit } from './types';

function livingPlayers(state: BattleState): Unit[] {
  return state.units.filter((u) => u.side === 'player' && !u.retired);
}

export function isVictorious(state: BattleState, cond: VictoryCond): boolean {
  const candidates =
    cond.by === 'any'
      ? livingPlayers(state)
      : livingPlayers(state).filter((u) => u.defId === cond.by);
  return candidates.some((u) => distance(u.pos, cond.pos) <= cond.radius);
}

export function isDefeated(state: BattleState, cond: DefeatCond): boolean {
  if (cond.type === 'allPlayerUnitsLost') return livingPlayers(state).length === 0;
  const living = new Set(livingPlayers(state).map((u) => u.defId));
  return cond.defIds.some((defId) => !living.has(defId));
}

/**
 * 敗北を先に見る。同じ tick で護衛対象が倒れかつ到達条件が満たされた場合は敗北とする。
 * 「守りきれなかったが目的地には着いた」を勝利にすると、護衛という目的が意味を失う。
 */
export function updateObjectives(state: BattleState): void {
  if (state.phase !== 'battle') return;
  for (const cond of state.stage.defeat) {
    if (isDefeated(state, cond)) {
      state.phase = 'defeat';
      return;
    }
  }
  if (isVictorious(state, state.stage.victory)) state.phase = 'victory';
}
