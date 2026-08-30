import { describe, expect, it } from 'vitest';
import { cellIndexAt } from './field';
import { beginBattle, createBattleState, placeUnit, PLACEMENT_RADIUS, statsForLevel } from './state';
import { testRegistry } from './testing';
import { FORT_MAX_HP } from './types';
import type { CharProgress } from './types';

function fresh() {
  const reg = testRegistry();
  const stage = reg.stages[0]!;
  const progress: Record<string, CharProgress> = {};
  for (const id of reg.units.keys()) progress[id] = { level: 1, xp: 0 };
  return { reg, stage, state: createBattleState(reg, stage, progress, 1) };
}

describe('statsForLevel', () => {
  it('レベル1 は基礎値どおり', () => {
    const reg = testRegistry();
    expect(statsForLevel(reg.units.get('roran')!, 1)).toEqual({ maxHp: 30, power: 6 });
  });

  it('レベルが上がると HP+3 / ちから+1', () => {
    const reg = testRegistry();
    expect(statsForLevel(reg.units.get('roran')!, 3)).toEqual({ maxHp: 36, power: 8 });
  });
});

describe('createBattleState: ステージからの はいち', () => {
  it('ステージの roster ぶんだけ 味方を つくる', () => {
    const { stage, state } = fresh();
    expect(state.allies.map((a) => a.id)).toEqual(stage.roster);
  });

  it('味方を placementZone の うえに おく', () => {
    const { stage, state } = fresh();
    for (const ally of state.allies) {
      const near = stage.placementZone.some(
        (z) => Math.hypot(z.pos.x - ally.pos.x, z.pos.y - ally.pos.y) <= PLACEMENT_RADIUS,
      );
      expect(`${ally.id} => ${near}`).toContain('true');
    }
  });

  it('敵を ステージ定義の ざひょうに はいちずみで つくる', () => {
    const { stage, state } = fresh();
    expect(state.enemies.length).toBe(stage.enemies.length);
    expect(state.enemies[0]!.pos).toEqual(stage.enemies[0]!.pos);
    expect(state.enemies[0]!.kind).toBe(stage.enemies[0]!.defId);
  });

  it('敵は それぞれの ai ていぎを もつ', () => {
    const { stage, state } = fresh();
    expect(state.enemies[0]!.ai).toEqual(stage.enemies[0]!.ai);
  });

  it('uid は かぶらない', () => {
    const { state } = fresh();
    expect(new Set(state.enemies.map((e) => e.uid)).size).toBe(state.enemies.length);
  });

  it('はじめは placement フェーズ', () => {
    const { state } = fresh();
    expect(state.phase).toBe('placement');
  });

  it('砦 HP は満タン', () => {
    const { state } = fresh();
    expect(state.fortHp).toBe(FORT_MAX_HP);
  });

  it('カウンタは からで しょきかされる', () => {
    const { state } = fresh();
    expect(state.counters).toEqual({});
  });

  it('レベルが反映される', () => {
    const reg = testRegistry();
    const stage = reg.stages[0]!;
    const progress: Record<string, CharProgress> = { roran: { level: 3, xp: 0 } };
    for (const id of reg.units.keys()) progress[id] ??= { level: 1, xp: 0 };
    const state = createBattleState(reg, stage, progress, 1);
    const roran = state.allies.find((a) => a.id === 'roran')!;
    expect(roran.maxHp).toBe(36);
    expect(roran.hp).toBe(36);
    expect(roran.power).toBe(8);
  });

  it('味方の初期配置地点へのフローフィールドが計算されている', () => {
    const { stage, state } = fresh();
    const goal = stage.placementZone[0]!.pos;
    const idx = cellIndexAt(state.grid, goal);
    expect(state.enemyField.dist[idx]).toBe(0);
  });
});

describe('placeUnit', () => {
  it('placementZone の ちかくなら おける', () => {
    const { stage, state } = fresh();
    const zone = stage.placementZone[0]!.pos;
    expect(placeUnit(state, 'roran', { ...zone })).toBe(true);
    expect(state.allies.find((a) => a.id === 'roran')!.pos).toEqual(zone);
  });

  it('placementZone から とおければ おけない', () => {
    const { stage, state } = fresh();
    const far = { x: stage.victory.pos.x, y: stage.victory.pos.y };
    const before = { ...state.allies.find((a) => a.id === 'roran')!.pos };
    expect(placeUnit(state, 'roran', far)).toBe(false);
    expect(state.allies.find((a) => a.id === 'roran')!.pos).toEqual(before);
  });

  it('あるけない マスには おけない', () => {
    const { state } = fresh();
    expect(placeUnit(state, 'roran', { x: 0, y: 0 })).toBe(false);
  });

  it('しらない defId なら false', () => {
    const { state } = fresh();
    expect(placeUnit(state, 'yuurei', { x: 112, y: 208 })).toBe(false);
  });
});

describe('beginBattle', () => {
  it('battle フェーズに する', () => {
    const { state } = fresh();
    beginBattle(state);
    expect(state.phase).toBe('battle');
  });

  it('じかんと クールダウンを リセットする', () => {
    const { state } = fresh();
    state.time = 99;
    state.allies[0]!.attackCooldown = 5;
    beginBattle(state);
    expect(state.time).toBe(0);
    expect(state.allies[0]!.attackCooldown).toBe(0);
  });

  it('敵は そのまま のこる（ウェーブごとに わきなおさない）', () => {
    const { stage, state } = fresh();
    beginBattle(state);
    expect(state.enemies.length).toBe(stage.enemies.length);
  });
});
