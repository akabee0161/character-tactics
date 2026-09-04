import { describe, expect, it } from 'vitest';
import { accumulate, mergeCounters } from './counters';
import type { SimEvent } from './types';
import type { TitleDef } from '../engine/schema';

const TITLES: TitleDef[] = [
  { id: 'a', label: 'エー', owner: 'roran', counter: 'skill:funbaru:uses', threshold: 5 },
  { id: 'b', label: 'ビー', owner: null, counter: 'bond:supports', threshold: 20 },
];

describe('accumulate', () => {
  it('スキルの しようかいすうを skill:<id>:uses に つむ', () => {
    const c: Record<string, number> = {};
    accumulate(c, [{ type: 'skill', uid: 'p1', defId: 'roran', skillId: 'funbaru', hits: 0, fromPos: { x: 0, y: 0 }, toPos: { x: 0, y: 0 } }]);
    accumulate(c, [{ type: 'skill', uid: 'p1', defId: 'roran', skillId: 'funbaru', hits: 0, fromPos: { x: 0, y: 0 }, toPos: { x: 0, y: 0 } }]);
    expect(c['skill:funbaru:uses']).toBe(2);
  });

  it('スキルの めいちゅうすうを skill:<id>:hits に つむ', () => {
    const c: Record<string, number> = {};
    accumulate(c, [{ type: 'skill', uid: 'p4', defId: 'gau', skillId: 'kakenukeru', hits: 3, fromPos: { x: 0, y: 0 }, toPos: { x: 0, y: 0 } }]);
    expect(c['skill:kakenukeru:hits']).toBe(3);
    expect(c['skill:kakenukeru:uses']).toBe(1);
  });

  it('めいちゅう 0 でも uses は つむが hits は 0 の まま', () => {
    const c: Record<string, number> = {};
    accumulate(c, [{ type: 'skill', uid: 'p4', defId: 'gau', skillId: 'kakenukeru', hits: 0, fromPos: { x: 0, y: 0 }, toPos: { x: 0, y: 0 } }]);
    expect(c['skill:kakenukeru:uses']).toBe(1);
    expect(c['skill:kakenukeru:hits']).toBe(0);
  });

  it('ねらいうちでの げきはを kill:neraiuchi に つむ', () => {
    const c: Record<string, number> = {};
    const ev: SimEvent[] = [
      { type: 'unitDefeated', uid: 'e1', defId: 'x', byUid: 'p2', byDefId: 'ines', neraiuchi: true, pos: { x: 0, y: 0 } },
      { type: 'unitDefeated', uid: 'e2', defId: 'x', byUid: 'p2', byDefId: 'ines', neraiuchi: false, pos: { x: 0, y: 0 } },
    ];
    accumulate(c, ev);
    expect(c['kill:neraiuchi']).toBe(1);
  });

  it('だれの てがらでも ない げきはは つまない', () => {
    const c: Record<string, number> = {};
    accumulate(c, [
      { type: 'unitDefeated', uid: 'e1', defId: 'x', byUid: null, byDefId: null, neraiuchi: true, pos: { x: 0, y: 0 } },
    ]);
    expect(c['kill:neraiuchi']).toBeUndefined();
  });

  it('おうえんは 1かいの こうげきに つき 1 だけ つむ', () => {
    const c: Record<string, number> = {};
    accumulate(c, [
      { type: 'bondSupport', targetUid: 'p1', targetDefId: 'roran', supporterUids: ['p2', 'p3'], pos: { x: 0, y: 0 } },
    ]);
    expect(c['bond:supports']).toBe(1);
  });
});

describe('mergeCounters', () => {
  it('しょうごうが さんしょうする キーだけを もちこす', () => {
    const prev = { 'skill:funbaru:uses': 2, 'bond:supports': 1 };
    const battle = { 'skill:funbaru:uses': 3, 'bond:supports': 4, 'temp:key': 9 };
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
