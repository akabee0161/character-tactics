import { describe, expect, it } from 'vitest';
import { pickDialogue, pickStageIntro } from './dialogue';
import { testRegistry } from './testing';
import type { SimEvent } from './types';

describe('lines', () => {
  it('すべてのセリフが ひらがな・カタカナ のみ', () => {
    const reg = testRegistry();
    for (const [id, text] of reg.lines) {
      expect(text, id).not.toMatch(/[一-鿿]/);
    }
  });

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
      { speaker: { side: 'ally', id: 'gau' }, lineId: 'first:gau:narazumono', text: reg.lines.get('first:gau:narazumono') },
    ]);
  });

  it('2 回目の交戦ではセリフが出ない', () => {
    const reg = testRegistry();
    const events: SimEvent[] = [
      { type: 'engage', uid: 'p1', defId: 'gau', targetUid: 'e1', targetDefId: 'narazumono', firstMeeting: false },
    ];
    expect(pickDialogue(reg, events)).toEqual([]);
  });

  it('ロランがガルムと会うと いんねん のセリフになる', () => {
    const reg = testRegistry();
    const events: SimEvent[] = [
      { type: 'engage', uid: 'p1', defId: 'roran', targetUid: 'g1', targetDefId: 'garum', firstMeeting: true },
    ];
    expect(pickDialogue(reg, events)).toEqual([
      { speaker: { side: 'ally', id: 'roran' }, lineId: 'rival:roran', text: reg.lines.get('rival:roran') },
    ]);
  });

  it('ミストがガルムと会うと ふつうの はじめまして', () => {
    const reg = testRegistry();
    const events: SimEvent[] = [
      { type: 'engage', uid: 'p1', defId: 'mist', targetUid: 'g1', targetDefId: 'garum', firstMeeting: true },
    ];
    expect(pickDialogue(reg, events)[0]!.lineId).toBe('first:mist:garum');
  });

  it('対応するセリフがなければ出さない', () => {
    const reg = testRegistry();
    const events: SimEvent[] = [
      { type: 'engage', uid: 'p1', defId: 'roran', targetUid: 'g1', targetDefId: 'garum', firstMeeting: false },
    ];
    expect(pickDialogue(reg, events)).toEqual([]);
  });

  it('スキル・ピンチ・勝利・撤退のセリフが出る', () => {
    const reg = testRegistry();
    expect(pickDialogue(reg, [
      { type: 'skill', uid: 'p2', defId: 'ines', skillId: 'neraiuchi', hits: 0 },
    ])[0]!.lineId).toBe('skill:ines');
    expect(pickDialogue(reg, [{ type: 'pinch', uid: 'p3', defId: 'mist' }])[0]!.lineId).toBe('pinch:mist');
    expect(pickDialogue(reg, [
      { type: 'unitFled', uid: 'g1', defId: 'garum', byUid: 'p4', byDefId: 'gau' },
    ])[0]!.lineId).toBe('win:gau');
    expect(pickDialogue(reg, [
      { type: 'unitRetired', uid: 'p1', defId: 'roran' },
    ])[0]!.lineId).toBe('retire:roran');
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
      { type: 'hit', targetPos: { x: 0, y: 0 }, amount: 3 },
      { type: 'bondSupport', targetUid: 'p1', targetDefId: 'roran', supporterUids: ['p2'] },
      { type: 'unitDefeated', uid: 'e1', defId: 'narazumono', byUid: 'p4', byDefId: 'gau', neraiuchi: false },
    ];
    expect(pickDialogue(reg, events)).toEqual([]);
  });

  it('複数同時なら 優先度順（いんねん → はじめまして → スキル → ピンチ → 勝利 → たいきゃく）', () => {
    const reg = testRegistry();
    const events: SimEvent[] = [
      { type: 'unitRetired', uid: 'p1', defId: 'roran' },
      { type: 'pinch', uid: 'p3', defId: 'mist' },
      { type: 'skill', uid: 'p4', defId: 'gau', skillId: 'kakenukeru', hits: 0 },
      { type: 'engage', uid: 'p3', defId: 'mist', targetUid: 'e1', targetDefId: 'narazumono', firstMeeting: true },
      { type: 'engage', uid: 'p2', defId: 'ines', targetUid: 'g1', targetDefId: 'garum', firstMeeting: true },
      { type: 'unitFled', uid: 'g1', defId: 'garum', byUid: 'p4', byDefId: 'gau' },
    ];
    expect(pickDialogue(reg, events).map((d) => d.lineId)).toEqual([
      'rival:ines',
      'first:mist:narazumono',
      'skill:gau',
      'pinch:mist',
      'win:gau',
      'retire:roran',
    ]);
  });
});

describe('pickStageIntro', () => {
  it('intro が定義されていなければ空配列', () => {
    const reg = testRegistry();
    const stage = { ...reg.stages[0]!, intro: undefined };
    expect(pickStageIntro(reg, stage)).toEqual([]);
  });

  it('intro の順番どおりに DialogueRequest を返す', () => {
    const reg = testRegistry();
    const stage = reg.stages[0]!;
    expect(pickStageIntro(reg, stage)).toEqual([
      { speaker: { side: 'ally', id: 'roran' }, lineId: 'stage:stage1:roran', text: reg.lines.get('stage:stage1:roran') },
      { speaker: { side: 'ally', id: 'gau' }, lineId: 'stage:stage1:gau', text: reg.lines.get('stage:stage1:gau') },
    ]);
  });
});
