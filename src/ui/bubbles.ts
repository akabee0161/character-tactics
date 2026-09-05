import type { DialogueRequest } from '../core/dialogue';

/** 頭上の吹き出しが消えるまでの秒数。読ませるのではなく気づかせるための長さ */
export const BUBBLE_DURATION = 3.0;

export type Bubble = { uid: string; text: string; ttl: number };

/**
 * uid をキーにするので、同じキャラの連続発話は自動的に上書きになる。
 * 位置は持たない。描画のたびにそのユニットの現在位置を引くので、
 * 喋りながら移動しても吹き出しが付いてくる。
 */
export type BubbleState = { items: Map<string, Bubble> };

export function makeBubbleState(): BubbleState {
  return { items: new Map() };
}

export function pushBubbles(state: BubbleState, reqs: DialogueRequest[]): void {
  for (const r of reqs) {
    state.items.set(r.uid, { uid: r.uid, text: r.text, ttl: BUBBLE_DURATION });
  }
}

export function tickBubbles(state: BubbleState, dt: number): void {
  // Map は反復中の delete が安全に定義されている
  for (const [uid, b] of state.items) {
    b.ttl -= dt;
    if (b.ttl <= 0) state.items.delete(uid);
  }
}

export function dismissBubble(state: BubbleState, uid: string): void {
  state.items.delete(uid);
}

export function clearBubbles(state: BubbleState): void {
  state.items.clear();
}
