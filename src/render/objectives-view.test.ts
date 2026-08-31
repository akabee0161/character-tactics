import { describe, expect, it } from 'vitest';
import { escortDefIds, sightCircles } from './objectives-view';
import type { StageDef } from '../engine/schema';
import type { Unit } from '../core/types';

const BASE = { id: 's', name: 'S', cell: 32, mapRows: ['..'], placementZone: [], roster: [], enemies: [] } as unknown as StageDef;

describe('escortDefIds', () => {
  it('unitLost の defIds を あつめる', () => {
    const stage = { ...BASE, defeat: [{ type: 'unitLost' as const, defIds: ['roran', 'mist'] }] };
    expect(escortDefIds(stage)).toEqual(['roran', 'mist']);
  });

  it('ふくすうの じょうけんを あわせる', () => {
    const stage = { ...BASE, defeat: [
      { type: 'unitLost' as const, defIds: ['roran'] },
      { type: 'unitLost' as const, defIds: ['ines'] },
    ] };
    expect(escortDefIds(stage)).toEqual(['roran', 'ines']);
  });

  it('じゅうふくを のぞく', () => {
    const stage = { ...BASE, defeat: [
      { type: 'unitLost' as const, defIds: ['roran'] },
      { type: 'unitLost' as const, defIds: ['roran', 'gau'] },
    ] };
    expect(escortDefIds(stage)).toEqual(['roran', 'gau']);
  });

  it('allPlayerUnitsLost だけなら からっぽ', () => {
    const stage = { ...BASE, defeat: [{ type: 'allPlayerUnitsLost' as const }] };
    expect(escortDefIds(stage)).toEqual([]);
  });
});

function enemy(uid: string, x: number, y: number, ai: Unit['ai']): Unit {
  return { uid, pos: { x, y }, side: 'enemy', retired: false, ai } as unknown as Unit;
}

describe('sightCircles', () => {
  it('sentry は げんざいいちを ちゅうしんに した えん', () => {
    const u = enemy('e1', 200, 100, {
      def: { kind: 'sentry', sightRange: 90 }, mode: 'idle', targetUid: null, home: { x: 100, y: 100 },
    });
    expect(sightCircles([u])).toEqual([{ pos: { x: 200, y: 100 }, radius: 90, alerted: false }]);
  });

  it('guard は げんざいいちを ちゅうしんに した えん', () => {
    const u = enemy('e1', 200, 100, {
      def: { kind: 'guard', post: { x: 50, y: 60 }, leash: 120, sightRange: 80 },
      mode: 'idle', targetUid: null, home: { x: 200, y: 100 },
    });
    expect(sightCircles([u])).toEqual([{ pos: { x: 200, y: 100 }, radius: 80, alerted: false }]);
  });

  it('aggressive は えんを もたない', () => {
    const u = enemy('e1', 200, 100, {
      def: { kind: 'aggressive' }, mode: 'chase', targetUid: 'p1', home: { x: 200, y: 100 },
    });
    expect(sightCircles([u])).toEqual([]);
  });

  it('ついせきちゅうは alerted に なる', () => {
    const u = enemy('e1', 200, 100, {
      def: { kind: 'sentry', sightRange: 90 }, mode: 'chase', targetUid: 'p1', home: { x: 100, y: 100 },
    });
    expect(sightCircles([u])[0]?.alerted).toBe(true);
  });

  it('たおれた 敵の えんは ださない', () => {
    const u = enemy('e1', 200, 100, {
      def: { kind: 'sentry', sightRange: 90 }, mode: 'idle', targetUid: null, home: { x: 100, y: 100 },
    });
    u.retired = true;
    expect(sightCircles([u])).toEqual([]);
  });

  it('味方（ai が null）は えんを もたない', () => {
    const p = { uid: 'p1', pos: { x: 0, y: 0 }, side: 'player', retired: false, ai: null } as unknown as Unit;
    expect(sightCircles([p])).toEqual([]);
  });
});
