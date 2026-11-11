import type { Registry } from '../engine/registry';
import type { IntroLine, RecruitDef } from '../engine/schema';
import type { Speaker, SimEvent, StageDef } from './types';

export type DialogueRequest = { uid: string; speaker: Speaker; lineId: string; text: string };

/** 小さいほど先に表示する */
const PRIORITY = ['village', 'rival', 'first', 'skill', 'levelup', 'pinch', 'win', 'retire'] as const;

function ally(id: string): Speaker {
  return { side: 'ally', id };
}

function make(reg: Registry, uid: string, speaker: Speaker, lineId: string): DialogueRequest | null {
  const text = reg.lines.get(lineId);
  if (text === undefined) return null;
  return { uid, speaker, lineId, text };
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
        // rival があればそちらを優先し、なければ first に落ちる。
        // 特定の敵やキャラを名指しする分岐はここに書かない
        const rival = make(reg, ev.uid, ally(ev.defId), `rival:${ev.defId}:${ev.targetDefId}`);
        if (rival) push('rival', rival);
        else push('first', make(reg, ev.uid, ally(ev.defId), `first:${ev.defId}:${ev.targetDefId}`));
        break;
      }
      case 'skill':
        push('skill', make(reg, ev.uid, ally(ev.defId), `skill:${ev.defId}`));
        break;
      case 'levelUp':
        push('levelup', make(reg, ev.uid, { side: 'ally', id: ev.defId }, `levelup:${ev.defId}`));
        break;
      case 'pinch':
        push('pinch', make(reg, ev.uid, ally(ev.defId), `pinch:${ev.defId}`));
        break;
      case 'unitFled':
        // 喋るのは撃退した側なので byUid を使う
        if (ev.byDefId && ev.byUid) push('win', make(reg, ev.byUid, ally(ev.byDefId), `win:${ev.byDefId}`));
        break;
      case 'unitRetired':
        push('retire', make(reg, ev.uid, ally(ev.defId), `retire:${ev.defId}`));
        break;
      case 'villageVisited':
        push('village', { uid: ev.uid, speaker: ally(ev.defId), lineId: `village:${ev.villageId}`, text: ev.text });
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

/** 会話フェーズが読む1行。speaker が null なら地の文 */
export type TalkLine = { speaker: string | null; text: string };

/** intro / outro の共通部分。片方だけ直して食い違うことがないように1本にする */
function pickTalk(reg: Registry, lines: IntroLine[] | undefined): TalkLine[] {
  const out: TalkLine[] = [];
  for (const line of lines ?? []) {
    // 検証で片方だけが埋まることは保証済み。lines に無い lineId も検証で弾かれている
    const text = line.text ?? (line.lineId === null ? undefined : reg.lines.get(line.lineId));
    if (text === undefined) continue;
    out.push({ speaker: line.speaker, text });
  }
  return out;
}

/** 加わる会話 */
export function pickRecruitTalk(reg: Registry, recruit: RecruitDef): TalkLine[] {
  return pickTalk(reg, recruit.talk);
}

/** ステージ開始時の会話。intro の後に、まだ仲間でない joins の加入の会話が続く */
export function pickStageIntro(reg: Registry, stage: StageDef, members: readonly string[]): TalkLine[] {
  const out = pickTalk(reg, stage.intro);
  for (const j of stage.joins ?? []) {
    if (!members.includes(j.unitId)) out.push(...pickRecruitTalk(reg, j));
  }
  return out;
}

/** 敵の本拠地に到達したときの会話 */
export function pickStageOutro(reg: Registry, stage: StageDef): TalkLine[] {
  return pickTalk(reg, stage.outro);
}
