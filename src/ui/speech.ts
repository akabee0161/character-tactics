import type { DialogueRequest } from '../core/dialogue';

/** セリフが消えるまでの秒数。読ませるのではなく気づかせるための長さ */
export const SPEECH_DURATION = 3.0;

export type Speech = { uid: string; defId: string; text: string; ttl: number };

/**
 * 下パネルのセリフ欄は1件しか出せないので、状態も1件だけ持つ。
 * 新しい発話は前の発話を上書きする
 */
export type SpeechState = { current: Speech | null };

export function makeSpeechState(): SpeechState {
  return { current: null };
}

/**
 * 同じ tick に複数の発話が来たときは先頭だけを採る。pickDialogue は優先順位
 * （rival → first → skill → levelup → pinch → win → retire）の昇順で返すので、
 * 末尾で上書きすると優先度の低いセリフが勝ってしまう
 */
export function pushSpeech(state: SpeechState, reqs: DialogueRequest[]): void {
  const first = reqs[0];
  if (first === undefined) return;
  state.current = {
    uid: first.uid, defId: first.speaker.id, text: first.text, ttl: SPEECH_DURATION,
  };
}

export function tickSpeech(state: SpeechState, dt: number): void {
  const s = state.current;
  if (s === null) return;
  s.ttl -= dt;
  if (s.ttl <= 0) state.current = null;
}

export function clearSpeech(state: SpeechState): void {
  state.current = null;
}
