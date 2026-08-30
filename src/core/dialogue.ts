import type { Registry } from '../engine/registry';
import type { Speaker, SimEvent, StageDef } from './types';

export type DialogueRequest = { speaker: Speaker; lineId: string; text: string };

const RIVAL_SPEAKERS: readonly string[] = ['roran', 'ines'];

/** 小さいほど先に表示する */
const PRIORITY = ['rival', 'first', 'skill', 'pinch', 'win', 'retire'] as const;

function ally(id: string): Speaker {
  return { side: 'ally', id };
}

function make(reg: Registry, speaker: Speaker, lineId: string): DialogueRequest | null {
  const text = reg.lines.get(lineId);
  if (text === undefined) return null;
  return { speaker, lineId, text };
}

export function pickDialogue(reg: Registry, events: SimEvent[]): DialogueRequest[] {
  const found: { order: number; req: DialogueRequest }[] = [];

  const push = (kind: (typeof PRIORITY)[number], req: DialogueRequest | null) => {
    if (req) found.push({ order: PRIORITY.indexOf(kind), req });
  };

  for (const ev of events) {
    switch (ev.type) {
      case 'engage': {
        if (!ev.firstMeeting) break;
        if (ev.targetDefId === 'garum' && RIVAL_SPEAKERS.includes(ev.defId)) {
          push('rival', make(reg, ally(ev.defId), `rival:${ev.defId}`));
        } else {
          push('first', make(reg, ally(ev.defId), `first:${ev.defId}:${ev.targetDefId}`));
        }
        break;
      }
      case 'skill':
        push('skill', make(reg, ally(ev.defId), `skill:${ev.defId}`));
        break;
      case 'pinch':
        push('pinch', make(reg, ally(ev.defId), `pinch:${ev.defId}`));
        break;
      case 'unitFled':
        if (ev.byDefId) push('win', make(reg, ally(ev.byDefId), `win:${ev.byDefId}`));
        break;
      case 'unitRetired':
        push('retire', make(reg, ally(ev.defId), `retire:${ev.defId}`));
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

/** ステージ開始時の会話を、stage.intro の順番どおりに返す */
export function pickStageIntro(reg: Registry, stage: StageDef): DialogueRequest[] {
  const found: DialogueRequest[] = [];
  for (const { speaker, lineId } of stage.intro ?? []) {
    const side = reg.units.has(speaker) ? 'ally' : 'enemy';
    const req = make(reg, { side, id: speaker }, lineId);
    if (req) found.push(req);
  }
  return found;
}
