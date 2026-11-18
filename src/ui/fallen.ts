import type { Registry } from '../engine/registry';
import type { SimEvent } from '../core/types';

/** 倒れたときの画面の速さ（実時間に掛ける）。戦闘の計算の 1 歩の長さは変えない */
export const SLOW_SCALE = 0.3;
/** 1 人の帯を出す長さ（実時間の秒）。ゆっくりの長さも同じ */
export const SLOW_PER_UNIT = 1.5;

export type FallenBanner = { uid: string; defId: string; text: string | null };

/** queue の先頭が今出ている帯。shown はその帯が出てからの実時間 */
export type FallenState = { queue: FallenBanner[]; remaining: number; shown: number };

export function makeFallenState(): FallenState {
  return { queue: [], remaining: 0, shown: 0 };
}

/** 仲間が倒れた出来事（unitRetired）ごとに、最期の言葉の帯を順番待ちに積む。敵には何もしない */
export function noteFallen(state: FallenState, reg: Registry, events: SimEvent[]): void {
  for (const ev of events) {
    if (ev.type !== 'unitRetired') continue;
    state.queue.push({ uid: ev.uid, defId: ev.defId, text: reg.lines.get(`retire:${ev.defId}`) ?? null });
    state.remaining += SLOW_PER_UNIT;
  }
}

/** 実時間で進める。先頭の持ち時間を使い切ったら次の帯へ */
export function tickFallen(state: FallenState, realDt: number): void {
  if (state.queue.length === 0) return;
  state.remaining = Math.max(0, state.remaining - realDt);
  state.shown += realDt;
  while (state.queue.length > 0 && state.shown >= SLOW_PER_UNIT) {
    state.queue.shift();
    state.shown -= SLOW_PER_UNIT;
  }
  if (state.queue.length === 0) clearFallen(state);
}

export function currentBanner(state: FallenState): FallenBanner | null {
  return state.queue[0] ?? null;
}

export function timeScale(state: FallenState): number {
  return state.remaining > 0 ? SLOW_SCALE : 1;
}

export function clearFallen(state: FallenState): void {
  state.queue.length = 0;
  state.remaining = 0;
  state.shown = 0;
}
