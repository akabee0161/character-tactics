import type { Registry } from '../engine/registry';
import type { Speaker, StageDef, SimEvent } from './types';

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
        if (ev.kind === 'garum' && RIVAL_SPEAKERS.includes(ev.allyId)) {
          push('rival', make(reg, ally(ev.allyId), `rival:${ev.allyId}`));
        } else {
          push('first', make(reg, ally(ev.allyId), `first:${ev.allyId}:${ev.kind}`));
        }
        break;
      }
      case 'skill':
        push('skill', make(reg, ally(ev.allyId), `skill:${ev.allyId}`));
        break;
      case 'pinch':
        push('pinch', make(reg, ally(ev.allyId), `pinch:${ev.allyId}`));
        break;
      case 'garumRepelled':
        if (ev.byAlly) push('win', make(reg, ally(ev.byAlly), `win:${ev.byAlly}`));
        break;
      case 'allyRetired':
        push('retire', make(reg, ally(ev.allyId), `retire:${ev.allyId}`));
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

/** ウェーブ開始時の会話を、そのウェーブの `intro` 定義どおりの順番で返す */
export function pickWaveIntro(
  reg: Registry,
  stage: Pick<StageDef, 'waves'>,
  waveIndex: number,
): DialogueRequest[] {
  const wave = stage.waves[waveIndex];
  if (!wave?.intro) return [];
  const found: DialogueRequest[] = [];
  for (const { speaker, lineId } of wave.intro) {
    const req = make(reg, speaker, lineId);
    if (req) found.push(req);
  }
  return found;
}
