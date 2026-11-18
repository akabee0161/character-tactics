import { describe, expect, it } from 'vitest';
import {
  pickDialogue, pickRecruitTalk, pickStageIntro, pickStageOutro, pickVillageTalk, villageStops,
} from './dialogue';
import { testRegistry } from './testing';
import type { SimEvent } from './types';
import type { StageDef } from '../engine/schema';

describe('lines', () => {
  it('すべてのセリフが 2 行いない', () => {
    const reg = testRegistry();
    for (const [id, text] of reg.lines) {
      expect(text.split('\n').length, id).toBeLessThanOrEqual(2);
    }
  });
});

describe('pickDialogue', () => {
  it('はじめての交戦でセリフが出る', () => {
    const reg = testRegistry();
    const events: SimEvent[] = [
      { type: 'engage', uid: 'p1', defId: 'gau', targetUid: 'e1', targetDefId: 'narazumono', firstMeeting: true },
    ];
    expect(pickDialogue(reg, events)).toEqual([
      {
        uid: 'p1', speaker: { side: 'ally', id: 'gau' }, lineId: 'first:gau:narazumono',
        text: reg.lines.get('first:gau:narazumono'),
      },
    ]);
  });

  it('2 回目の交戦ではセリフが出ない', () => {
    const reg = testRegistry();
    const events: SimEvent[] = [
      { type: 'engage', uid: 'p1', defId: 'gau', targetUid: 'e1', targetDefId: 'narazumono', firstMeeting: false },
    ];
    expect(pickDialogue(reg, events)).toEqual([]);
  });

  it('スキル・ピンチ・勝利・撤退のセリフが出る', () => {
    const reg = testRegistry();
    const skillReq = pickDialogue(reg, [
      { type: 'skill', uid: 'p2', defId: 'ines', skillId: 'neraiuchi', fromPos: { x: 0, y: 0 }, toPos: { x: 0, y: 0 }, aim: null, affected: [] },
    ])[0]!;
    expect(skillReq.lineId).toBe('skill:ines');
    expect(skillReq.uid).toBe('p2');
    expect(pickDialogue(reg, [{ type: 'pinch', uid: 'p3', defId: 'mist' }])[0]!.lineId).toBe('pinch:mist');
    // 喋るのは撃退した側 (byUid) であって、撃退された側 (uid: 'g1') ではない
    const fledReq = pickDialogue(reg, [
      { type: 'unitFled', uid: 'g1', defId: 'garum', byUid: 'p4', byDefId: 'gau' },
    ])[0]!;
    expect(fledReq.lineId).toBe('win:gau');
    expect(fledReq.uid).toBe('p4');
  });

  it('だれが倒したか分からない撃退ではセリフを出さない', () => {
    const reg = testRegistry();
    expect(pickDialogue(reg, [
      { type: 'unitFled', uid: 'g1', defId: 'garum', byUid: null, byDefId: null },
    ])).toEqual([]);
  });

  it('セリフの出ないイベントは無視する', () => {
    const reg = testRegistry();
    const events: SimEvent[] = [
      {
        type: 'hit', targetUid: 'p1', targetPos: { x: 0, y: 0 }, amount: 3,
        sourceUid: 'e1', sourceDefId: 'narazumono', attackKind: 'melee',
        sourcePos: { x: 10, y: 0 }, neraiuchi: false,
      },
      { type: 'bondSupport', targetUid: 'p1', targetDefId: 'roran', supporterUids: ['p2'], pos: { x: 0, y: 0 } },
      { type: 'unitDefeated', uid: 'e1', defId: 'narazumono', byUid: 'p4', byDefId: 'gau', pos: { x: 0, y: 0 } },
    ];
    expect(pickDialogue(reg, events)).toEqual([]);
  });

  it('複数同時なら 優先度順（いんねん → はじめまして → スキル → ピンチ → 勝利）', () => {
    const reg = testRegistry();
    const events: SimEvent[] = [
      { type: 'pinch', uid: 'p3', defId: 'mist' },
      { type: 'skill', uid: 'p4', defId: 'gau', skillId: 'kakenukeru', fromPos: { x: 0, y: 0 }, toPos: { x: 0, y: 0 }, aim: null, affected: [] },
      { type: 'engage', uid: 'p3', defId: 'mist', targetUid: 'e1', targetDefId: 'narazumono', firstMeeting: true },
      { type: 'engage', uid: 'p2', defId: 'ines', targetUid: 'g1', targetDefId: 'garum', firstMeeting: true },
      { type: 'unitFled', uid: 'g1', defId: 'garum', byUid: 'p4', byDefId: 'gau' },
    ];
    expect(pickDialogue(reg, events).map((d) => d.lineId)).toEqual([
      'rival:ines:garum',
      'first:mist:narazumono',
      'skill:gau',
      'pinch:mist',
      'win:gau',
    ]);
  });
});

describe('しょそうぐうの セリフ', () => {
  const reg = testRegistry();
  const engage = (defId: string, targetDefId: string) => ({
    type: 'engage' as const, uid: 'p1', defId, targetUid: 'e1', targetDefId, firstMeeting: true,
  });

  it('rival: が あれば そちらを つかう', () => {
    expect(pickDialogue(reg, [engage('roran', 'garum')]).map((d) => d.lineId))
      .toEqual(['rival:roran:garum']);
  });

  it('rival: が なければ first: に おちる', () => {
    expect(pickDialogue(reg, [engage('mist', 'garum')]).map((d) => d.lineId))
      .toEqual(['first:mist:garum']);
  });

  it('どちらも なければ なにも でない', () => {
    expect(pickDialogue(reg, [engage('roran', 'yuurei')])).toEqual([]);
  });

  it('rival は first より さきに でる', () => {
    const got = pickDialogue(reg, [engage('mist', 'garum'), engage('roran', 'garum')]);
    expect(got.map((d) => d.lineId)).toEqual(['rival:roran:garum', 'first:mist:garum']);
  });

  it('firstMeeting でなければ でない', () => {
    expect(pickDialogue(reg, [{ ...engage('roran', 'garum'), firstMeeting: false }])).toEqual([]);
  });
});

const st = { maxHp: 30, power: 6, guard: 5, resist: 2, speed: 60 };
const lvEv = (uid: string, defId: string) => ({ type: 'levelUp' as const, uid, defId, fromLevel: 1, level: 2, before: st, after: st });

describe('levelUp の トリガ', () => {
  it('レベルアップで セリフが でる', () => {
    const reg = testRegistry();
    const got = pickDialogue(reg, [lvEv('p1', 'roran')]);
    expect(got.map((d) => d.lineId)).toEqual(['levelup:roran']);
  });

  it('セリフが ない ユニットなら なにも でない', () => {
    const reg = testRegistry();
    expect(pickDialogue(reg, [lvEv('e1', 'garum')])).toEqual([]);
  });

  it('ゆうせん じゅんは skill の あと、pinch の まえ', () => {
    const reg = testRegistry();
    const got = pickDialogue(reg, [
      { type: 'pinch', uid: 'p1', defId: 'roran' },
      lvEv('p1', 'roran'),
      { type: 'skill', uid: 'p1', defId: 'roran', skillId: 'funbaru', fromPos: { x: 0, y: 0 }, toPos: { x: 0, y: 0 }, aim: null, affected: [] },
    ]);
    expect(got.map((d) => d.lineId)).toEqual(['skill:roran', 'levelup:roran', 'pinch:roran']);
  });
});

describe('pickStageIntro', () => {
  const reg = testRegistry();

  it('lineId を ひいて text に する', () => {
    const stage = { intro: [{ speaker: 'roran', text: null, lineId: 'stage:stage1:roran' }] } as unknown as StageDef;
    const r = pickStageIntro(reg, stage, []);
    expect(r).toHaveLength(1);
    expect(r[0]!.speaker).toBe('roran');
    expect(r[0]!.text).toBe(reg.lines.get('stage:stage1:roran'));
  });

  it('text の ちょくがきを そのまま つかう', () => {
    const stage = { intro: [{ speaker: 'gau', text: 'いくぞー', lineId: null }] } as unknown as StageDef;
    expect(pickStageIntro(reg, stage, [])).toEqual([{ speaker: 'gau', text: 'いくぞー' }]);
  });

  it('speaker が null なら 地の文に なる', () => {
    const stage = { intro: [{ speaker: null, text: 'しずかだ。', lineId: null }] } as unknown as StageDef;
    expect(pickStageIntro(reg, stage, [])).toEqual([{ speaker: null, text: 'しずかだ。' }]);
  });

  it('intro が なければ からの はいれつ', () => {
    expect(pickStageIntro(reg, {} as unknown as StageDef, [])).toEqual([]);
  });
});

describe('加入の会話', () => {
  const reg = testRegistry();
  const join = { unitId: 'gau', level: 1, talk: [{ speaker: 'gau', text: 'おれも {gau} だ', lineId: null }] };
  const stage = {
    intro: [{ speaker: null, text: 'はじまり', lineId: null }], joins: [join],
  } as unknown as StageDef;

  it('開始時の加入の会話が intro の後に続く', () => {
    expect(pickStageIntro(reg, stage, [])).toEqual([
      { speaker: null, text: 'はじまり' },
      { speaker: 'gau', text: 'おれも {gau} だ' },
    ]);
  });

  it('加入済みなら続かない', () => {
    expect(pickStageIntro(reg, stage, ['gau'])).toEqual([{ speaker: null, text: 'はじまり' }]);
  });

  it('加入の会話の {id} が名前になっている', () => {
    for (const st of reg.stages) {
      const villages = st.villages.flatMap((v) => (v.effect.type === 'recruit' ? [v.effect.recruit] : []));
      for (const r of [...st.joins, ...st.persuasions, ...villages]) {
        for (const l of pickRecruitTalk(reg, r)) expect(l.text, `${st.id}/${r.unitId}`).not.toMatch(/\{[^}]*\}/);
      }
    }
  });

  it('pickRecruitTalk は talk の行を返す', () => {
    expect(pickRecruitTalk(reg, join)).toEqual([{ speaker: 'gau', text: 'おれも {gau} だ' }]);
  });
});

describe('pickStageOutro', () => {
  it('outro を じゅんばんどおり かえす', () => {
    const reg = testRegistry();
    const stage = { ...reg.stages[0]!, outro: [
      { speaker: null, text: 'ちのぶん', lineId: null },
      { speaker: 'roran', text: 'やったね', lineId: null },
    ] };
    expect(pickStageOutro(reg, stage)).toEqual([
      { speaker: null, text: 'ちのぶん' },
      { speaker: 'roran', text: 'やったね' },
    ]);
  });

  it('outro が なければ からの はいれつ', () => {
    const reg = testRegistry();
    expect(pickStageOutro(reg, { ...reg.stages[0]!, outro: undefined })).toEqual([]);
  });
});

describe('village', () => {
  it('村のセリフ（fresh でない）は一番先に出る', () => {
    const reg = testRegistry();
    const events: SimEvent[] = [
      { type: 'skill', uid: 'p2', defId: 'ines', skillId: 'neraiuchi', fromPos: { x: 0, y: 0 }, toPos: { x: 0, y: 0 }, aim: null, affected: [] },
      { type: 'villageVisited', uid: 'p1', defId: 'gau', villageId: 'v1', text: 'むらだ', fresh: false },
    ];
    const out = pickDialogue(reg, events);
    expect(out[0]).toEqual({
      uid: 'p1', speaker: { side: 'ally', id: 'gau' }, lineId: 'village:v1', text: 'むらだ',
    });
  });
});

describe('仲間が倒れたときのセリフ', () => {
  it('仲間が倒れたときのセリフはセリフ欄に出さない（帯で出す）', () => {
    const reg = testRegistry();
    expect(pickDialogue(reg, [{ type: 'unitRetired', uid: 'p1', defId: 'roran' }])).toEqual([]);
  });
});

describe('pickVillageTalk と villageStops', () => {
  const reg = testRegistry();
  const talk = [
    { speaker: 'npc01', text: 'ようこそ', lineId: null },
    { speaker: '$visitor', text: '{visitor}です。よろしく', lineId: null },
  ];
  const stageWith = (village: Partial<StageDef['villages'][number]>): StageDef => ({
    ...reg.stages[0]!,
    villages: [{ id: 'v1', col: 0, row: 0, text: '{visitor}の HPが 回復した！', npc: 'npc01', talk, effect: { type: 'heal' }, ...village }],
  });

  it('pickVillageTalk は村人の行・訪れた仲間の行・何が起きたかの行の順', () => {
    const lines = pickVillageTalk(reg, stageWith({}), 'v1', 'gau');
    expect(lines).toEqual([
      { speaker: 'npc01', text: 'ようこそ' },
      { speaker: 'gau', text: 'ガウです。よろしく' },
      { speaker: null, text: 'ガウの HPが 回復した！' },
    ]);
  });

  it('recruit の村は村人の行の後に加入の会話', () => {
    const recruit = { unitId: 'ally05', level: 1, talk: [{ speaker: 'ally05', text: '連れて いって', lineId: null }] };
    const lines = pickVillageTalk(reg, stageWith({ text: null, effect: { type: 'recruit', recruit } }), 'v1', 'gau');
    expect(lines).toEqual([
      { speaker: 'npc01', text: 'ようこそ' },
      { speaker: 'gau', text: 'ガウです。よろしく' },
      { speaker: 'ally05', text: '連れて いって' },
    ]);
  });

  it('talk の無い村は何が起きたかの行だけ', () => {
    const lines = pickVillageTalk(reg, stageWith({ talk: [], npc: null }), 'v1', 'gau');
    expect(lines).toEqual([{ speaker: null, text: 'ガウの HPが 回復した！' }]);
  });

  it('fresh な村の出来事はセリフ欄に出さない', () => {
    const ev = { type: 'villageVisited', uid: 'p1', defId: 'gau', villageId: 'v1', text: 'むらだ', fresh: true } as const;
    expect(villageStops(ev)).toBe(true);
    expect(pickDialogue(reg, [ev])).toEqual([]);
  });

  it('fresh でない村の出来事はセリフ欄に出す', () => {
    const ev = { type: 'villageVisited', uid: 'p1', defId: 'gau', villageId: 'v1', text: '村の 人が 手を ふっている', fresh: false } as const;
    expect(villageStops(ev)).toBe(false);
    expect(pickDialogue(reg, [ev])[0]).toMatchObject({ lineId: 'village:v1', text: '村の 人が 手を ふっている' });
  });
});
