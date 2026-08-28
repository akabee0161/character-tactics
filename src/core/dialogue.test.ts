import { describe, expect, it } from 'vitest';
import { pickDialogue, pickWaveIntro } from './dialogue';
import { testRegistry } from './testing';
import type { Speaker, SimEvent } from './types';

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
      { type: 'engage', allyId: 'gau', enemyUid: 'e1', kind: 'narazumono', firstMeeting: true },
    ];
    expect(pickDialogue(reg, events)).toEqual([
      { speaker: { side: 'ally', id: 'gau' }, lineId: 'first:gau:narazumono', text: reg.lines.get('first:gau:narazumono') },
    ]);
  });

  it('2 回目の交戦ではセリフが出ない', () => {
    const reg = testRegistry();
    const events: SimEvent[] = [
      { type: 'engage', allyId: 'gau', enemyUid: 'e1', kind: 'narazumono', firstMeeting: false },
    ];
    expect(pickDialogue(reg, events)).toEqual([]);
  });

  it('ロランがガルムと会うと いんねん のセリフになる', () => {
    const reg = testRegistry();
    const events: SimEvent[] = [
      { type: 'engage', allyId: 'roran', enemyUid: 'g1', kind: 'garum', firstMeeting: true },
    ];
    expect(pickDialogue(reg, events)).toEqual([
      { speaker: { side: 'ally', id: 'roran' }, lineId: 'rival:roran', text: reg.lines.get('rival:roran') },
    ]);
  });

  it('ミストがガルムと会うと ふつうの はじめまして', () => {
    const reg = testRegistry();
    const events: SimEvent[] = [
      { type: 'engage', allyId: 'mist', enemyUid: 'g1', kind: 'garum', firstMeeting: true },
    ];
    expect(pickDialogue(reg, events)[0]!.lineId).toBe('first:mist:garum');
  });

  it('対応するセリフがなければ出さない', () => {
    const reg = testRegistry();
    const events: SimEvent[] = [
      { type: 'engage', allyId: 'roran', enemyUid: 'g1', kind: 'garum', firstMeeting: false },
    ];
    expect(pickDialogue(reg, events)).toEqual([]);
  });

  it('スキル・ピンチ・勝利・撤退のセリフが出る', () => {
    const reg = testRegistry();
    expect(pickDialogue(reg, [{ type: 'skill', allyId: 'ines', skill: 'neraiuchi' }])[0]!.lineId).toBe('skill:ines');
    expect(pickDialogue(reg, [{ type: 'pinch', allyId: 'mist' }])[0]!.lineId).toBe('pinch:mist');
    expect(pickDialogue(reg, [{ type: 'garumRepelled', byAlly: 'gau' }])[0]!.lineId).toBe('win:gau');
    expect(pickDialogue(reg, [{ type: 'allyRetired', allyId: 'roran' }])[0]!.lineId).toBe('retire:roran');
  });

  it('だれが倒したか分からない撃退ではセリフを出さない', () => {
    const reg = testRegistry();
    expect(pickDialogue(reg, [{ type: 'garumRepelled', byAlly: null }])).toEqual([]);
  });

  it('セリフの出ないイベントは無視する', () => {
    const reg = testRegistry();
    const events: SimEvent[] = [
      { type: 'hit', targetPos: { x: 0, y: 0 }, amount: 3 },
      { type: 'bondSupport', supporterId: 'ines', targetId: 'roran' },
      { type: 'fortDamaged', amount: 3 },
      { type: 'enemyDefeated', uid: 'e1', kind: 'narazumono', byAlly: 'gau' },
    ];
    expect(pickDialogue(reg, events)).toEqual([]);
  });

  it('複数同時なら 優先度順（いんねん → はじめまして → スキル → ピンチ → 勝利 → たいきゃく）', () => {
    const reg = testRegistry();
    const events: SimEvent[] = [
      { type: 'allyRetired', allyId: 'roran' },
      { type: 'pinch', allyId: 'mist' },
      { type: 'skill', allyId: 'gau', skill: 'kakenukeru' },
      { type: 'engage', allyId: 'mist', enemyUid: 'e1', kind: 'narazumono', firstMeeting: true },
      { type: 'engage', allyId: 'ines', enemyUid: 'g1', kind: 'garum', firstMeeting: true },
      { type: 'garumRepelled', byAlly: 'gau' },
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

describe('pickWaveIntro', () => {
  it('intro が定義されていなければ空配列', () => {
    const reg = testRegistry();
    const stage = { waves: [{ spawns: [] }] };
    expect(pickWaveIntro(reg, stage, 0)).toEqual([]);
  });

  it('intro の順番どおりに DialogueRequest を返す', () => {
    const reg = testRegistry();
    const intro: { speaker: Speaker; lineId: string }[] = [
      { speaker: { side: 'ally', id: 'roran' }, lineId: 'rival:roran' },
      { speaker: { side: 'enemy', id: 'garum' }, lineId: 'rival:roran' },
    ];
    const stage = {
      waves: [
        {
          spawns: [],
          intro,
        },
      ],
    };
    expect(pickWaveIntro(reg, stage, 0)).toEqual([
      { speaker: { side: 'ally', id: 'roran' }, lineId: 'rival:roran', text: reg.lines.get('rival:roran') },
      { speaker: { side: 'enemy', id: 'garum' }, lineId: 'rival:roran', text: reg.lines.get('rival:roran') },
    ]);
  });

  it('存在しない waveIndex では空配列', () => {
    const reg = testRegistry();
    const stage = { waves: [{ spawns: [] }] };
    expect(pickWaveIntro(reg, stage, 5)).toEqual([]);
  });
});
