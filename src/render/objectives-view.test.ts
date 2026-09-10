import { describe, expect, it } from 'vitest';
import { alertMarks, escortDefIds } from './objectives-view';
import type { StageDef } from '../engine/schema';
import type { Unit } from '../core/types';

const BASE = { id: 's', name: 'S', cell: 32, mapRows: ['..'], placement: { minY: 0, starts: [] }, roster: [], enemies: [] } as unknown as StageDef;

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
  return { uid, defId: 'narazumono', pos: { x, y }, side: 'enemy', retired: false, ai } as unknown as Unit;
}

describe('alertMarks', () => {
  it('追跡中の敵を返す', () => {
    const u = enemy('e1', 10, 20, { def: { kind: 'sentry', sightRange: 100 }, mode: 'chase', targetUid: 'p1', home: { x: 10, y: 20 } });
    expect(alertMarks([u])).toEqual([{ pos: { x: 10, y: 20 }, defId: u.defId }]);
  });

  it('追跡していない敵は返さない', () => {
    const u = enemy('e1', 10, 20, { def: { kind: 'sentry', sightRange: 100 }, mode: 'idle', targetUid: null, home: { x: 10, y: 20 } });
    expect(alertMarks([u])).toEqual([]);
  });

  it('aggressive は返さない（常に追ってくるので「気づかれた」印にならない）', () => {
    const u = enemy('e1', 10, 20, { def: { kind: 'aggressive' }, mode: 'chase', targetUid: 'p1', home: { x: 10, y: 20 } });
    expect(alertMarks([u])).toEqual([]);
  });

  it('退場した敵は返さない', () => {
    const u = enemy('e1', 10, 20, { def: { kind: 'guard', post: { x: 0, y: 0 }, leash: 10, sightRange: 100 }, mode: 'chase', targetUid: 'p1', home: { x: 10, y: 20 } });
    expect(alertMarks([{ ...u, retired: true }])).toEqual([]);
  });

  it('ai を持たない味方は返さない', () => {
    const ally = { uid: 'p1', defId: 'roran', pos: { x: 1, y: 2 }, side: 'player', retired: false, ai: null } as unknown as Unit;
    expect(alertMarks([ally])).toEqual([]);
  });
});
