import { describe, expect, it } from 'vitest';
import { ALERT_MARK_DURATION, alertMarks, escortDefIds } from './objectives-view';
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

const SENTRY = { kind: 'sentry' as const, sightRange: 100 };

describe('alertMarks', () => {
  it('見つかった直後は 印が出る', () => {
    const u = enemy('e1', 10, 20, { def: SENTRY, mode: 'chase', targetUid: 'p1', home: { x: 10, y: 20 }, spottedAt: 5 });
    expect(alertMarks([u], 5)).toEqual([{ pos: { x: 10, y: 20 }, defId: u.defId }]);
  });

  it('ALERT_MARK_DURATION ちょうどまでは 出る', () => {
    const u = enemy('e1', 10, 20, { def: SENTRY, mode: 'chase', targetUid: 'p1', home: { x: 10, y: 20 }, spottedAt: 5 });
    expect(alertMarks([u], 5 + ALERT_MARK_DURATION).length).toBe(1);
  });

  it('ALERT_MARK_DURATION を すぎたら消える（交戦中でも出しっぱなしにしない）', () => {
    const u = enemy('e1', 10, 20, { def: SENTRY, mode: 'chase', targetUid: 'p1', home: { x: 10, y: 20 }, spottedAt: 5 });
    expect(alertMarks([u], 5 + ALERT_MARK_DURATION + 0.01)).toEqual([]);
  });

  it('spottedAt が null なら出ない', () => {
    const u = enemy('e1', 10, 20, { def: SENTRY, mode: 'idle', targetUid: null, home: { x: 10, y: 20 }, spottedAt: null });
    expect(alertMarks([u], 1)).toEqual([]);
  });

  it('aggressive は返さない（常に追ってくるので「気づかれた」印にならない）', () => {
    const u = enemy('e1', 10, 20, { def: { kind: 'aggressive' }, mode: 'chase', targetUid: 'p1', home: { x: 10, y: 20 }, spottedAt: 0 });
    expect(alertMarks([u], 0)).toEqual([]);
  });

  it('退場した敵は返さない', () => {
    const u = enemy('e1', 10, 20, { def: { kind: 'guard', post: { x: 0, y: 0 }, leash: 10, sightRange: 100 }, mode: 'chase', targetUid: 'p1', home: { x: 10, y: 20 }, spottedAt: 0 });
    expect(alertMarks([{ ...u, retired: true }], 0)).toEqual([]);
  });

  it('ai を持たない味方は返さない', () => {
    const ally = { uid: 'p1', defId: 'roran', pos: { x: 1, y: 2 }, side: 'player', retired: false, ai: null } as unknown as Unit;
    expect(alertMarks([ally], 0)).toEqual([]);
  });
});
