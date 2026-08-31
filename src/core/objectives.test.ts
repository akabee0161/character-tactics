import { describe, expect, it } from 'vitest';
import { beginBattle, createBattleState } from './state';
import { isDefeated, isVictorious, updateObjectives } from './objectives';
import { testRegistry } from './testing';
import type { BattleState, Unit } from './types';

function fresh(): BattleState {
  const reg = testRegistry();
  const stage = reg.stages[0]!;
  const progress: Record<string, { level: number; xp: number }> = {};
  for (const id of reg.units.keys()) progress[id] = { level: 1, xp: 0 };
  const s = createBattleState(reg, stage, progress, 1);
  beginBattle(s);
  return s;
}

function playerOf(s: BattleState, defId: string): Unit {
  return s.units.find((u) => u.side === 'player' && u.defId === defId)!;
}

describe('isVictorious: reach', () => {
  it('だれかが はんいに はいれば しょうり', () => {
    const s = fresh();
    const cond = { type: 'reach' as const, pos: { x: 400, y: 240 }, radius: 40, by: 'any' };
    expect(isVictorious(s, cond)).toBe(false);
    playerOf(s, 'roran').pos = { x: 400, y: 240 };
    expect(isVictorious(s, cond)).toBe(true);
  });

  it('はんいの ふちの そとなら しょうりに ならない', () => {
    const s = fresh();
    const cond = { type: 'reach' as const, pos: { x: 400, y: 240 }, radius: 40, by: 'any' };
    playerOf(s, 'roran').pos = { x: 441, y: 240 };
    expect(isVictorious(s, cond)).toBe(false);
  });

  it('by が していされていたら その ユニットだけ', () => {
    const s = fresh();
    const cond = { type: 'reach' as const, pos: { x: 400, y: 240 }, radius: 40, by: 'roran' };
    playerOf(s, 'ines').pos = { x: 400, y: 240 };
    expect(isVictorious(s, cond)).toBe(false);
    playerOf(s, 'roran').pos = { x: 400, y: 240 };
    expect(isVictorious(s, cond)).toBe(true);
  });

  it('たおれた ユニットは とうたつと みなさない', () => {
    const s = fresh();
    const cond = { type: 'reach' as const, pos: { x: 400, y: 240 }, radius: 40, by: 'any' };
    for (const u of s.units) {
      if (u.side === 'player') { u.pos = { x: 400, y: 240 }; u.retired = true; }
    }
    expect(isVictorious(s, cond)).toBe(false);
  });

  it('敵が はんいに いても しょうりに ならない', () => {
    const s = fresh();
    const cond = { type: 'reach' as const, pos: { x: 400, y: 240 }, radius: 40, by: 'any' };
    s.units.find((u) => u.side === 'enemy')!.pos = { x: 400, y: 240 };
    expect(isVictorious(s, cond)).toBe(false);
  });
});

describe('isDefeated', () => {
  it('unitLost: ごえい たいしょうが たおれたら はいぼく', () => {
    const s = fresh();
    const cond = { type: 'unitLost' as const, defIds: ['roran'] };
    expect(isDefeated(s, cond)).toBe(false);
    playerOf(s, 'roran').retired = true;
    expect(isDefeated(s, cond)).toBe(true);
  });

  it('unitLost: ふくすう していなら どれか 1つで はいぼく', () => {
    const s = fresh();
    const cond = { type: 'unitLost' as const, defIds: ['roran', 'ines'] };
    playerOf(s, 'ines').retired = true;
    expect(isDefeated(s, cond)).toBe(true);
  });

  it('unitLost: ごえい たいしょう いがいが たおれても はいぼくしない', () => {
    const s = fresh();
    const cond = { type: 'unitLost' as const, defIds: ['roran'] };
    playerOf(s, 'gau').retired = true;
    expect(isDefeated(s, cond)).toBe(false);
  });

  it('allPlayerUnitsLost: ぜんいん たおれたら はいぼく', () => {
    const s = fresh();
    const cond = { type: 'allPlayerUnitsLost' as const };
    for (const u of s.units) if (u.side === 'player') u.retired = true;
    expect(isDefeated(s, cond)).toBe(true);
  });

  it('allPlayerUnitsLost: 1にん のこっていれば はいぼくしない', () => {
    const s = fresh();
    const cond = { type: 'allPlayerUnitsLost' as const };
    const ps = s.units.filter((u) => u.side === 'player');
    ps.slice(1).forEach((u) => { u.retired = true; });
    expect(isDefeated(s, cond)).toBe(false);
  });
});

describe('updateObjectives', () => {
  it('とうたつしたら phase が victory に なる', () => {
    const s = fresh();
    playerOf(s, 'roran').pos = { ...s.stage.victory.pos };
    updateObjectives(s);
    expect(s.phase).toBe('victory');
  });

  it('ごえい たいしょうが たおれたら phase が defeat に なる', () => {
    const s = fresh();
    playerOf(s, 'roran').retired = true;
    updateObjectives(s);
    expect(s.phase).toBe('defeat');
  });

  it('どうじに せいりつしたら はいぼくが かつ', () => {
    const s = fresh();
    const roran = playerOf(s, 'roran');
    roran.pos = { ...s.stage.victory.pos };
    roran.retired = true;
    updateObjectives(s);
    expect(s.phase).toBe('defeat');
  });

  it('battle いがいの フェーズでは なにも しない', () => {
    const s = fresh();
    s.phase = 'placement';
    playerOf(s, 'roran').pos = { ...s.stage.victory.pos };
    updateObjectives(s);
    expect(s.phase).toBe('placement');
  });
});
