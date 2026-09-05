import { describe, expect, it } from 'vitest';
import {
  BUBBLE_DURATION, clearBubbles, dismissBubble, makeBubbleState, pushBubbles, tickBubbles,
} from './bubbles';
import type { DialogueRequest } from '../core/dialogue';

const req = (uid: string, text: string): DialogueRequest =>
  ({ uid, speaker: { side: 'ally', id: 'roran' }, lineId: text, text });

describe('BubbleState', () => {
  it('さいしょは からっぽ', () => {
    expect(makeBubbleState().items.size).toBe(0);
  });

  it('つむと uid ごとに はいる', () => {
    const s = makeBubbleState();
    pushBubbles(s, [req('p1', 'あ'), req('p2', 'い')]);
    expect(s.items.size).toBe(2);
    expect(s.items.get('p1')!.text).toBe('あ');
  });

  it('おなじ uid は うわがきする', () => {
    const s = makeBubbleState();
    pushBubbles(s, [req('p1', 'ふるい')]);
    tickBubbles(s, 1);
    pushBubbles(s, [req('p1', 'あたらしい')]);
    expect(s.items.size).toBe(1);
    expect(s.items.get('p1')!.text).toBe('あたらしい');
    expect(s.items.get('p1')!.ttl).toBe(BUBBLE_DURATION);  // 寿命も引き直す
  });

  it('じゅみょうが つきたら きえる', () => {
    const s = makeBubbleState();
    pushBubbles(s, [req('p1', 'あ')]);
    tickBubbles(s, BUBBLE_DURATION - 0.1);
    expect(s.items.size).toBe(1);
    tickBubbles(s, 0.2);
    expect(s.items.size).toBe(0);
  });

  it('べつの uid は どうじに のこる', () => {
    const s = makeBubbleState();
    pushBubbles(s, [req('p1', 'あ')]);
    tickBubbles(s, 2);
    pushBubbles(s, [req('p2', 'い')]);
    tickBubbles(s, 1.5);
    expect(s.items.has('p1')).toBe(false);  // 3.5秒たった
    expect(s.items.has('p2')).toBe(true);   // 1.5秒しかたっていない
  });

  it('うちけすと その1つだけ きえる', () => {
    const s = makeBubbleState();
    pushBubbles(s, [req('p1', 'あ'), req('p2', 'い')]);
    dismissBubble(s, 'p1');
    expect(s.items.has('p1')).toBe(false);
    expect(s.items.has('p2')).toBe(true);
  });

  it('いない uid を うちけしても こわれない', () => {
    const s = makeBubbleState();
    expect(() => dismissBubble(s, 'いない')).not.toThrow();
  });

  it('からっぽを tick しても こわれない', () => {
    const s = makeBubbleState();
    expect(() => tickBubbles(s, 1)).not.toThrow();
  });

  it('clearBubbles で ぜんぶ きえる', () => {
    const s = makeBubbleState();
    pushBubbles(s, [req('p1', 'あ'), req('p2', 'い')]);
    clearBubbles(s);
    expect(s.items.size).toBe(0);
  });
});
