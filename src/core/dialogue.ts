import { LINES } from '../content/lines';
import type { CharId, SimEvent } from './types';

export type DialogueRequest = { speaker: CharId; lineId: string; text: string };

const RIVAL_SPEAKERS: readonly CharId[] = ['roran', 'ines'];

/** 小さいほど先に表示する */
const PRIORITY = ['rival', 'first', 'skill', 'pinch', 'win', 'retire'] as const;

function make(speaker: CharId, lineId: string): DialogueRequest | null {
  const text = LINES[lineId];
  if (text === undefined) return null;
  return { speaker, lineId, text };
}

export function pickDialogue(events: SimEvent[]): DialogueRequest[] {
  const found: { order: number; req: DialogueRequest }[] = [];

  const push = (kind: (typeof PRIORITY)[number], req: DialogueRequest | null) => {
    if (req) found.push({ order: PRIORITY.indexOf(kind), req });
  };

  for (const ev of events) {
    switch (ev.type) {
      case 'engage': {
        if (!ev.firstMeeting) break;
        if (ev.kind === 'garum' && RIVAL_SPEAKERS.includes(ev.allyId)) {
          push('rival', make(ev.allyId, `rival:${ev.allyId}`));
        } else {
          push('first', make(ev.allyId, `first:${ev.allyId}:${ev.kind}`));
        }
        break;
      }
      case 'skill':
        push('skill', make(ev.allyId, `skill:${ev.allyId}`));
        break;
      case 'pinch':
        push('pinch', make(ev.allyId, `pinch:${ev.allyId}`));
        break;
      case 'garumRepelled':
        if (ev.byAlly) push('win', make(ev.byAlly, `win:${ev.byAlly}`));
        break;
      case 'allyRetired':
        push('retire', make(ev.allyId, `retire:${ev.allyId}`));
        break;
      default:
        break;
    }
  }

  return found
    .map((f, i) => ({ ...f, i }))
    .sort((a, b) => a.order - b.order || a.i - b.i)
    .map((f) => f.req);
}
