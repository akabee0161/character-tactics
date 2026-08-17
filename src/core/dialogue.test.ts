import { describe, expect, it } from 'vitest';
import { pickDialogue } from './dialogue';
import { LINES } from '../content/lines';
import type { SimEvent } from './types';

describe('LINES', () => {
  it('すべてのセリフが ひらがな・カタカナ のみ', () => {
    for (const [id, text] of Object.entries(LINES)) {
      expect(text, id).not.toMatch(/[一-鿿]/);
    }
  });

  it('すべてのセリフが 2 行いない', () => {
    for (const [id, text] of Object.entries(LINES)) {
      expect(text.split('\n').length, id).toBeLessThanOrEqual(2);
    }
  });
});

describe('pickDialogue', () => {
  it('はじめての交戦でセリフが出る', () => {
    const events: SimEvent[] = [
      { type: 'engage', allyId: 'gau', enemyUid: 'e1', kind: 'narazumono', firstMeeting: true },
    ];
    expect(pickDialogue(events)).toEqual([
      { speaker: 'gau', lineId: 'first:gau:narazumono', text: LINES['first:gau:narazumono'] },
    ]);
  });

  it('2 回目の交戦ではセリフが出ない', () => {
    const events: SimEvent[] = [
      { type: 'engage', allyId: 'gau', enemyUid: 'e1', kind: 'narazumono', firstMeeting: false },
    ];
    expect(pickDialogue(events)).toEqual([]);
  });

  it('ロランがガルムと会うと いんねん のセリフになる', () => {
    const events: SimEvent[] = [
      { type: 'engage', allyId: 'roran', enemyUid: 'g1', kind: 'garum', firstMeeting: true },
    ];
    expect(pickDialogue(events)).toEqual([
      { speaker: 'roran', lineId: 'rival:roran', text: LINES['rival:roran'] },
    ]);
  });

  it('ミストがガルムと会うと ふつうの はじめまして', () => {
    const events: SimEvent[] = [
      { type: 'engage', allyId: 'mist', enemyUid: 'g1', kind: 'garum', firstMeeting: true },
    ];
    expect(pickDialogue(events)[0]!.lineId).toBe('first:mist:garum');
  });

  it('対応するセリフがなければ出さない', () => {
    const events: SimEvent[] = [
      { type: 'engage', allyId: 'roran', enemyUid: 'g1', kind: 'garum', firstMeeting: false },
    ];
    expect(pickDialogue(events)).toEqual([]);
  });

  it('スキル・ピンチ・勝利・撤退のセリフが出る', () => {
    expect(pickDialogue([{ type: 'skill', allyId: 'ines', skill: 'neraiuchi' }])[0]!.lineId).toBe('skill:ines');
    expect(pickDialogue([{ type: 'pinch', allyId: 'mist' }])[0]!.lineId).toBe('pinch:mist');
    expect(pickDialogue([{ type: 'garumRepelled', byAlly: 'gau' }])[0]!.lineId).toBe('win:gau');
    expect(pickDialogue([{ type: 'allyRetired', allyId: 'roran' }])[0]!.lineId).toBe('retire:roran');
  });

  it('だれが倒したか分からない撃退ではセリフを出さない', () => {
    expect(pickDialogue([{ type: 'garumRepelled', byAlly: null }])).toEqual([]);
  });

  it('セリフの出ないイベントは無視する', () => {
    const events: SimEvent[] = [
      { type: 'hit', targetPos: { x: 0, y: 0 }, amount: 3 },
      { type: 'bondSupport', supporterId: 'ines', targetId: 'roran' },
      { type: 'fortDamaged', amount: 3 },
      { type: 'enemyDefeated', uid: 'e1', kind: 'narazumono', byAlly: 'gau' },
    ];
    expect(pickDialogue(events)).toEqual([]);
  });

  it('複数同時なら 優先度順（いんねん → はじめまして → スキル → ピンチ → 勝利 → たいきゃく）', () => {
    const events: SimEvent[] = [
      { type: 'allyRetired', allyId: 'roran' },
      { type: 'pinch', allyId: 'mist' },
      { type: 'skill', allyId: 'gau', skill: 'kakenukeru' },
      { type: 'engage', allyId: 'mist', enemyUid: 'e1', kind: 'narazumono', firstMeeting: true },
      { type: 'engage', allyId: 'ines', enemyUid: 'g1', kind: 'garum', firstMeeting: true },
      { type: 'garumRepelled', byAlly: 'gau' },
    ];
    expect(pickDialogue(events).map((d) => d.lineId)).toEqual([
      'rival:ines',
      'first:mist:narazumono',
      'skill:gau',
      'pinch:mist',
      'win:gau',
      'retire:roran',
    ]);
  });
});
