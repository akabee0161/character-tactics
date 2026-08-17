import type { DialogueRequest } from '../core/dialogue';

export type BubbleQueue = { items: DialogueRequest[] };

export function makeBubbleQueue(): BubbleQueue {
  return { items: [] };
}

export function enqueue(q: BubbleQueue, reqs: DialogueRequest[]): void {
  for (const r of reqs) q.items.push(r);
}

export function currentBubble(q: BubbleQueue): DialogueRequest | null {
  return q.items[0] ?? null;
}

export function advanceBubble(q: BubbleQueue): void {
  q.items.shift();
}

export function isBlocking(q: BubbleQueue): boolean {
  return q.items.length > 0;
}
