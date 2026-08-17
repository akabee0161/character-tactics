import { describe, expect, it } from 'vitest';
import { advanceBubble, currentBubble, enqueue, isBlocking, makeBubbleQueue } from './bubbles';
import type { DialogueRequest } from '../core/dialogue';

const req = (lineId: string): DialogueRequest => ({ speaker: 'roran', lineId, text: lineId });

describe('BubbleQueue', () => {
  it('空なら止めないし、表示するものもない', () => {
    const q = makeBubbleQueue();
    expect(isBlocking(q)).toBe(false);
    expect(currentBubble(q)).toBeNull();
  });

  it('積むと止まり、先頭が表示される', () => {
    const q = makeBubbleQueue();
    enqueue(q, [req('a'), req('b')]);
    expect(isBlocking(q)).toBe(true);
    expect(currentBubble(q)!.lineId).toBe('a');
  });

  it('送ると次に進む', () => {
    const q = makeBubbleQueue();
    enqueue(q, [req('a'), req('b')]);
    advanceBubble(q);
    expect(currentBubble(q)!.lineId).toBe('b');
    expect(isBlocking(q)).toBe(true);
  });

  it('全部送ると止まらなくなる', () => {
    const q = makeBubbleQueue();
    enqueue(q, [req('a')]);
    advanceBubble(q);
    expect(isBlocking(q)).toBe(false);
    expect(currentBubble(q)).toBeNull();
  });

  it('空のキューを送っても壊れない', () => {
    const q = makeBubbleQueue();
    expect(() => advanceBubble(q)).not.toThrow();
    expect(isBlocking(q)).toBe(false);
  });

  it('残っているところに積むと後ろに並ぶ', () => {
    const q = makeBubbleQueue();
    enqueue(q, [req('a')]);
    enqueue(q, [req('b')]);
    expect(q.items.map((i) => i.lineId)).toEqual(['a', 'b']);
  });

  it('空配列を積んでも止まらない', () => {
    const q = makeBubbleQueue();
    enqueue(q, []);
    expect(isBlocking(q)).toBe(false);
  });
});
