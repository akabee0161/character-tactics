import { villageStops } from '../core/dialogue';
import type { PendingRecruit, SimEvent } from '../core/types';
import type { LevelUpEvent } from './levelup';

/** 戦闘を止める理由。村の会話 → 加入の会話 → レベルアップのカードの順に出す */
export type Interrupt =
  | { kind: 'village'; villageId: string; visitorDefId: string }
  | { kind: 'recruit' }
  | { kind: 'levelUp' };

/**
 * 同じ tick に起きた止める理由のうち、先に出すものを選ぶ（純ロジック）。
 * 経験値の村では、会話の最後の行が「経験値が入った」で、その結果がカードになる順
 */
export function nextInterrupt(
  events: readonly SimEvent[],
  levelUps: readonly LevelUpEvent[],
  pendingRecruit: PendingRecruit | null,
): Interrupt | null {
  for (const ev of events) {
    if (ev.type === 'villageVisited' && villageStops(ev)) {
      return { kind: 'village', villageId: ev.villageId, visitorDefId: ev.defId };
    }
  }
  if (pendingRecruit !== null) return { kind: 'recruit' };
  if (levelUps.length > 0) return { kind: 'levelUp' };
  return null;
}
