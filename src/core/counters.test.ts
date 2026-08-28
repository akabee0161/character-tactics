import { describe, expect, it } from 'vitest';
import { accumulate, COUNTER_DEFEAT_BY, mergeCounters } from './counters';
import type { SimEvent } from './types';
import type { TitleDef } from '../engine/schema';

const TITLES: TitleDef[] = [
  { id: 'a', label: 'エー', owner: 'roran', counter: 'skill:funbaru:uses', threshold: 5 },
  { id: 'b', label: 'ビー', owner: null, counter: 'bond:supports', threshold: 20 },
];

describe('accumulate', () => {
  it('スキルの しようかいすうを skill:<id>:uses に つむ', () => {
    const c: Record<string, number> = {};
    accumulate(c, [{ type: 'skill', allyId: 'roran', skill: 'funbaru', hits: 0 }]);
    accumulate(c, [{ type: 'skill', allyId: 'roran', skill: 'funbaru', hits: 0 }]);
    expect(c['skill:funbaru:uses']).toBe(2);
  });

  it('スキルの めいちゅうすうを skill:<id>:hits に つむ', () => {
    const c: Record<string, number> = {};
    accumulate(c, [{ type: 'skill', allyId: 'gau', skill: 'kakenukeru', hits: 3 }]);
    expect(c['skill:kakenukeru:hits']).toBe(3);
    expect(c['skill:kakenukeru:uses']).toBe(1);
  });

  it('めいちゅう 0 でも uses は つむが hits は 0 の まま', () => {
    const c: Record<string, number> = {};
    accumulate(c, [{ type: 'skill', allyId: 'gau', skill: 'kakenukeru', hits: 0 }]);
    expect(c['skill:kakenukeru:uses']).toBe(1);
    expect(c['skill:kakenukeru:hits']).toBe(0);
  });

  it('ねらいうちでの げきはを kill:neraiuchi に つむ', () => {
    const c: Record<string, number> = {};
    const ev: SimEvent[] = [
      { type: 'enemyDefeated', uid: 'e1', kind: 'x', byAlly: 'ines', neraiuchi: true },
      { type: 'enemyDefeated', uid: 'e2', kind: 'x', byAlly: 'ines', neraiuchi: false },
    ];
    accumulate(c, ev);
    expect(c['kill:neraiuchi']).toBe(1);
  });

  it('げきはを defeat:by:<defId> に つむ', () => {
    const c: Record<string, number> = {};
    accumulate(c, [{ type: 'enemyDefeated', uid: 'e1', kind: 'x', byAlly: 'gau', neraiuchi: false }]);
    expect(c[COUNTER_DEFEAT_BY('gau')]).toBe(1);
  });

  it('だれの てがらでも ない げきはは つまない', () => {
    const c: Record<string, number> = {};
    accumulate(c, [{ type: 'enemyDefeated', uid: 'e1', kind: 'x', byAlly: null, neraiuchi: true }]);
    expect(c['kill:neraiuchi']).toBeUndefined();
  });

  it('おうえんは 1かいの こうげきに つき 1 だけ つむ', () => {
    const c: Record<string, number> = {};
    accumulate(c, [{ type: 'bondSupport', targetId: 'roran', supporterIds: ['ines', 'mist'] }]);
    expect(c['bond:supports']).toBe(1);
  });
});

describe('mergeCounters', () => {
  it('しょうごうが さんしょうする キーだけを もちこす', () => {
    const prev = { 'skill:funbaru:uses': 2, 'bond:supports': 1 };
    const battle = { 'skill:funbaru:uses': 3, 'bond:supports': 4, [COUNTER_DEFEAT_BY('gau')]: 9 };
    const merged = mergeCounters(prev, battle, TITLES);
    expect(merged).toEqual({ 'skill:funbaru:uses': 5, 'bond:supports': 5 });
  });

  it('もとに なかった キーも しょうごうが さんしょうするなら 入る', () => {
    const merged = mergeCounters({}, { 'bond:supports': 2 }, TITLES);
    expect(merged['bond:supports']).toBe(2);
  });

  it('たたかいで うごかなかった キーは まえの あたいの まま', () => {
    const merged = mergeCounters({ 'skill:funbaru:uses': 7 }, {}, TITLES);
    expect(merged['skill:funbaru:uses']).toBe(7);
  });
});
