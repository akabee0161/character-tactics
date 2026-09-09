import { describe, expect, it } from 'vitest';
import { beginBattle, createBattleState } from '../core/state';
import { testRegistry } from '../core/testing';
import { skillButtonState } from './skillbutton';
import type { BattleState, CharProgress, StageDef } from '../core/types';

const STAGE: StageDef = {
  id: 'teststage', order: 10, name: 'テスト', cell: 32,
  mapRows: ['..........', '..........', '..........'],
  placement: { minY: 0, starts: [{ x: 16, y: 16 }] },
  roster: ['roran', 'ines', 'mist', 'gau'],
  enemies: [{ defId: 'narazumono', pos: { x: 304, y: 16 }, ai: { kind: 'aggressive' } }],
  victory: { type: 'reach', pos: { x: 304, y: 16 }, radius: 40, by: 'any' },
  defeat: [{ type: 'unitLost', defIds: ['roran'] }],
};
const LV1: Record<string, CharProgress> = {
  roran: { level: 1, xp: 0 }, ines: { level: 1, xp: 0 },
  mist: { level: 1, xp: 0 }, gau: { level: 1, xp: 0 },
};

function fresh(): BattleState {
  const s = createBattleState(testRegistry(), STAGE, LV1, 42);
  beginBattle(s);
  return s;
}

describe('skillButtonState', () => {
  it('えらんでいないと おせない', () => {
    const s = fresh();
    expect(skillButtonState(s.reg, s, null)).toEqual({ label: 'なかまを えらぶ', enabled: false });
  });

  it('えらんでいて クールダウンが あけていれば わざめいが でて おせる', () => {
    const s = fresh();
    const roran = s.units.find((u) => u.defId === 'roran')!;
    expect(skillButtonState(s.reg, s, roran.uid)).toEqual({ label: 'ふんばる', enabled: true });
  });

  it('クールダウンちゅうは のこりびょうすうが でて おせない', () => {
    const s = fresh();
    const roran = s.units.find((u) => u.defId === 'roran')!;
    s.time = 10;
    roran.skillCooldownUntil = 12.5;
    const r = skillButtonState(s.reg, s, roran.uid);
    expect(r.enabled).toBe(false);
    expect(r.label).toContain('ふんばる');
    expect(r.label).toContain('3');   // 2.5秒 → 切り上げて3
  });

  it('たいきゃくした なかまは おせない。りゆうも「たいきゃくした」に なる', () => {
    const s = fresh();
    const roran = s.units.find((u) => u.defId === 'roran')!;
    roran.retired = true;
    expect(skillButtonState(s.reg, s, roran.uid)).toEqual({ label: 'たいきゃくした', enabled: false });
  });

  it('わざを もたない なかまは おせない。りゆうも「わざが ない」に なる', () => {
    const s = fresh();
    const enemy = s.units.find((u) => u.side === 'enemy')!;
    expect(skillButtonState(s.reg, s, enemy.uid)).toEqual({ label: 'わざが ない', enabled: false });
  });
});
