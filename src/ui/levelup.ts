import type { SimEvent } from '../core/types';
import type { Registry } from '../engine/registry';
import { cardFromDef } from './stat-card';
import type { StatCard } from './stat-card';

export type LevelUpEvent = Extract<SimEvent, { type: 'levelUp' }>;

/**
 * queue に events の levelUp を足す。同じ uid は 1 件にまとめ、
 * fromLevel・before は最初のもの、level・after は最後のもの（同じ tick に 2 回上がった人を 1 枚の札にする）。
 * queue は書き換えない
 */
export function mergeLevelUps(queue: LevelUpEvent[], events: SimEvent[]): LevelUpEvent[] {
  const out = [...queue];
  for (const ev of events) {
    if (ev.type !== 'levelUp') continue;
    const i = out.findIndex((q) => q.uid === ev.uid);
    if (i < 0) out.push(ev);
    else out[i] = { ...out[i]!, level: ev.level, after: ev.after };
  }
  return out;
}

/** 戦闘を止めて出すカード（その仲間のセリフ付き）。stats は上がった後、before は上がる前 */
export function levelUpCard(reg: Registry, ev: LevelUpEvent): StatCard {
  return {
    ...cardFromDef(reg, ev.defId, ev.after),
    level: ev.level,
    before: { level: ev.fromLevel, stats: ev.before },
    line: reg.lines.get(`levelup:${ev.defId}`) ?? null,
  };
}
