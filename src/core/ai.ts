import { nearestWithin } from './combat';
import { distance, hasLineOfSight } from './field';
import type { AiDef } from '../engine/schema';
import type { AiState, Grid, Unit, Vec2 } from './types';

/** 帰還先に着いたとみなす距離 */
export const HOME_EPS = 8;

export type AiContext = { self: Unit; hostiles: Unit[]; grid: Grid };
export type AiDecision = { mode: AiState['mode']; targetUid: string | null; goal: Vec2 | null };
export type AiBehavior = (ctx: AiContext) => AiDecision;

const IDLE: AiDecision = { mode: 'idle', targetUid: null, goal: null };

function chase(target: Unit): AiDecision {
  return { mode: 'chase', targetUid: target.uid, goal: { ...target.pos } };
}

function returnTo(goal: Vec2): AiDecision {
  return { mode: 'return', targetUid: null, goal: { ...goal } };
}

/**
 * 索敵は距離と視線の両方で判定する。距離だけで判定すると、壁の向こうの見えない敵が
 * 反応してプレイヤーに理不尽に映る。
 */
function spot(ctx: AiContext, sightRange: number): Unit | null {
  const visible = ctx.hostiles.filter(
    (h) => !h.retired && hasLineOfSight(ctx.grid, ctx.self.pos, h.pos),
  );
  return nearestWithin(ctx.self.pos, visible, sightRange);
}

/** post や home へ戻る途中なら return、着いていれば idle */
function settleAt(self: Unit, goal: Vec2): AiDecision {
  return distance(self.pos, goal) <= HOME_EPS ? IDLE : returnTo(goal);
}

export const AI_BEHAVIORS: Record<AiDef['kind'], AiBehavior> = {
  sentry: (ctx) => {
    const def = ctx.self.ai?.def;
    if (def?.kind !== 'sentry') return IDLE;
    const target = spot(ctx, def.sightRange);
    if (target) return chase(target);
    return settleAt(ctx.self, ctx.self.ai!.home);
  },

  aggressive: (ctx) => {
    // 索敵範囲も視線も無視して、常に最寄りの敵対ユニットを追う
    const alive = ctx.hostiles.filter((h) => !h.retired);
    const target = nearestWithin(ctx.self.pos, alive, Infinity);
    return target ? chase(target) : IDLE;
  },

  guard: (ctx) => {
    const ai = ctx.self.ai;
    const def = ai?.def;
    if (def?.kind !== 'guard') return IDLE;
    const distToPost = distance(ctx.self.pos, def.post);
    // 一度 leash を抜けて撤退モードに入ったら、post に着くまで再追跡しない（ラッチ）。
    // これがないと leash の境界付近で 追跡打ち切り→1歩戻って再追跡 を毎tick繰り返し振動する
    if (ai!.mode === 'return' && distToPost > HOME_EPS) return returnTo(def.post);
    // leash を超えていたら、相手が見えていても追跡を打ち切る
    if (distToPost > def.leash) return returnTo(def.post);
    const target = spot(ctx, def.sightRange);
    if (target) return chase(target);
    return settleAt(ctx.self, def.post);
  },
};
