import { describe, expect, it } from 'vitest';
import { spawnProjectile, updateProjectiles } from './projectiles';
import { beginBattle, createBattleState } from './state';
import { testRegistry } from './testing';
import type { BattleState, CharProgress, HitSource, StageDef, Unit } from './types';

const STAGE: StageDef = {
  id: 'teststage', order: 10, name: 'テスト', cell: 32,
  mapRows: ['..........', '..........', '..........'],
  placement: { minY: 0, starts: [{ x: 16, y: 16 }] },
  roster: ['roran', 'ines', 'mist', 'gau'],
  enemies: [{ defId: 'narazumono', pos: { x: 216, y: 16 }, ai: { kind: 'aggressive' } }],
  victory: { type: 'reach', pos: { x: 304, y: 80 }, radius: 20, by: 'any' },
  defeat: [{ type: 'unitLost', defIds: ['roran'] }],
};
const LV1: Record<string, CharProgress> = {
  roran: { level: 1, xp: 0 }, ines: { level: 1, xp: 0 },
  mist: { level: 1, xp: 0 }, gau: { level: 1, xp: 0 },
};

function fresh(): { state: BattleState; shooter: Unit; target: Unit } {
  const state = createBattleState(testRegistry(), STAGE, LV1, 42);
  beginBattle(state);
  const shooter = state.units.find((u) => u.defId === 'ines')!;
  const target = state.units.find((u) => u.side === 'enemy')!;
  shooter.pos = { x: 16, y: 16 };
  target.pos = { x: 216, y: 16 };
  return { state, shooter, target };
}

const sourceOf = (u: Unit, over: Partial<HitSource> = {}): HitSource => ({
  uid: u.uid, defId: u.defId, attack: u.attack, pos: { ...u.pos },
  neraiuchi: false, power: u.power, bondBonus: 0, ...over,
});

describe('updateProjectiles', () => {
  it('うった しゅんかんは まだ あたっていない', () => {
    const { state, shooter, target } = fresh();
    const hp = target.hp;
    spawnProjectile(state, sourceOf(shooter), target);
    updateProjectiles(state, 1 / 60);

    expect(state.projectiles.length).toBe(1);
    expect(target.hp).toBe(hp);
  });

  it('とどいた しゅんかんに ダメージが はいる', () => {
    const { state, shooter, target } = fresh();
    const hp = target.hp;
    spawnProjectile(state, sourceOf(shooter), target);
    for (let i = 0; i < 40; i++) updateProjectiles(state, 1 / 60);

    expect(state.projectiles.length).toBe(0);
    expect(target.hp).toBeLessThan(hp);
    expect(state.events.some((e) => e.type === 'hit')).toBe(true);
  });

  it('もくひょうが たいじょうしたら ふはつに なる', () => {
    const { state, shooter, target } = fresh();
    spawnProjectile(state, sourceOf(shooter), target);
    target.retired = true;
    updateProjectiles(state, 1 / 60);

    expect(state.projectiles.length).toBe(0);
    expect(state.events.length).toBe(0);
  });

  it('ぼうぎょがわの ふんばりは ちゃくだんじに はんていされる', () => {
    const hit = (funbaru: boolean): number => {
      const { state, shooter, target } = fresh();
      const hp = target.hp;
      spawnProjectile(state, sourceOf(shooter), target);
      if (funbaru) target.funbaruUntil = state.time + 10;  // 撃った後でふんばる
      for (let i = 0; i < 40; i++) updateProjectiles(state, 1 / 60);
      return hp - target.hp;
    };

    expect(hit(true)).toBeLessThan(hit(false));
  });
});
