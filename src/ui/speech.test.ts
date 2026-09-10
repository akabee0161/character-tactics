import { describe, expect, it } from 'vitest';
import { SPEECH_DURATION, clearSpeech, makeSpeechState, pushSpeech, tickSpeech } from './speech';
import type { DialogueRequest } from '../core/dialogue';

const req = (uid: string, defId: string, text: string): DialogueRequest =>
  ({ uid, speaker: { side: 'ally', id: defId }, lineId: text, text });

describe('SpeechState', () => {
  it('最初は空', () => {
    expect(makeSpeechState().current).toBeNull();
  });

  it('積むと話者と本文が入る', () => {
    const s = makeSpeechState();
    pushSpeech(s, [req('p1', 'roran', 'ここは とおさない！')]);
    expect(s.current).toEqual({
      uid: 'p1', defId: 'roran', text: 'ここは とおさない！', ttl: SPEECH_DURATION,
    });
  });

  it('同じ tick に複数来たら先頭だけを採る', () => {
    const s = makeSpeechState();
    // pickDialogue は優先順位の昇順で返す。末尾で上書きすると優先度の低い方が勝つ
    pushSpeech(s, [req('p1', 'roran', 'さきに でる'), req('p2', 'gau', 'あとの やつ')]);
    expect(s.current!.text).toBe('さきに でる');
  });

  it('空の配列では何も変わらない', () => {
    const s = makeSpeechState();
    pushSpeech(s, [req('p1', 'roran', 'あ')]);
    pushSpeech(s, []);
    expect(s.current!.text).toBe('あ');
  });

  it('新しい発話で上書きし、寿命も引き直す', () => {
    const s = makeSpeechState();
    pushSpeech(s, [req('p1', 'roran', 'ふるい')]);
    tickSpeech(s, 1);
    pushSpeech(s, [req('p2', 'gau', 'あたらしい')]);
    expect(s.current!.text).toBe('あたらしい');
    expect(s.current!.ttl).toBe(SPEECH_DURATION);
  });

  it('寿命が尽きたら消える', () => {
    const s = makeSpeechState();
    pushSpeech(s, [req('p1', 'roran', 'あ')]);
    tickSpeech(s, SPEECH_DURATION - 0.1);
    expect(s.current).not.toBeNull();
    tickSpeech(s, 0.2);
    expect(s.current).toBeNull();
  });

  it('空を tick しても壊れない', () => {
    expect(() => tickSpeech(makeSpeechState(), 1)).not.toThrow();
  });

  it('clearSpeech で消える', () => {
    const s = makeSpeechState();
    pushSpeech(s, [req('p1', 'roran', 'あ')]);
    clearSpeech(s);
    expect(s.current).toBeNull();
  });
});
