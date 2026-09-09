import { describe, expect, it } from 'vitest';
import { cellIndexAt } from './field';
import { fieldToStatic } from './fields';
import { beginBattle, canPlaceAt, createBattleState, placeUnit, statsForLevel } from './state';
import { testRegistry } from './testing';
import type { Registry } from '../engine/registry';
import type { StageDef } from '../engine/schema';
import type { BattleState, CharProgress } from './types';

function fresh(): { reg: Registry; stage: StageDef; state: BattleState } {
  const reg = testRegistry();
  const stage = reg.stages[0]!;
  const progress: Record<string, CharProgress> = {};
  for (const id of reg.units.keys()) progress[id] = { level: 1, xp: 0 };
  return { reg, stage, state: createBattleState(reg, stage, progress, 1) };
}

function unitOf(s: BattleState, defId: string) {
  const u = s.units.find((x) => x.defId === defId && x.side === 'player');
  if (!u) throw new Error(`いない: ${defId}`);
  return u;
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
    const playerDefIds = state.units.filter((u) => u.side === 'player').map((u) => u.defId);
    expect(playerDefIds).toEqual(stage.roster);
  });

  it('味方を placement.starts の座標に置く', () => {
    const { stage, state } = fresh();
    const players = state.units.filter((u) => u.side === 'player');
    players.forEach((u, i) => {
      expect(u.pos).toEqual(stage.placement.starts[i % stage.placement.starts.length]);
    });
  });

  it('敵を ステージ定義の ざひょうに はいちずみで つくる', () => {
    const { stage, state } = fresh();
    const enemies = state.units.filter((u) => u.side === 'enemy');
    expect(enemies.length).toBe(stage.enemies.length);
    expect(enemies[0]!.pos).toEqual(stage.enemies[0]!.pos);
    expect(enemies[0]!.defId).toBe(stage.enemies[0]!.defId);
  });

  it('敵は それぞれの ai ていぎを もつ', () => {
    const { stage, state } = fresh();
    const enemies = state.units.filter((u) => u.side === 'enemy');
    expect(enemies[0]!.ai!.def).toEqual(stage.enemies[0]!.ai);
  });

  it('uid は かぶらない', () => {
    const { state } = fresh();
    expect(new Set(state.units.map((u) => u.uid)).size).toBe(state.units.length);
  });

  it('はじめは placement フェーズ', () => {
    const { state } = fresh();
    expect(state.phase).toBe('placement');
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
    const roran = unitOf(state, 'roran');
    expect(roran.maxHp).toBe(36);
    expect(roran.hp).toBe(36);
    expect(roran.power).toBe(8);
  });

  it('フィールドキャッシュは からで しょきかされる', () => {
    const { state } = fresh();
    expect(state.fields.byUnit.size).toBe(0);
    expect(state.fields.static.size).toBe(0);
  });

  it('味方の初期配置地点への フローフィールドを キャッシュから ひける', () => {
    const { stage, state } = fresh();
    const goal = stage.placement.starts[0]!;
    const idx = cellIndexAt(state.grid, goal);
    const field = fieldToStatic(state.fields, state.grid, goal);
    expect(field.dist[idx]).toBe(0);
  });
});

describe('canPlaceAt', () => {
  it('境界の線より下なら置ける', () => {
    const { stage, state } = fresh();
    expect(canPlaceAt(stage, state.grid, { x: 240, y: stage.placement.minY })).toBe(true);
  });

  it('境界の線より上は置けない', () => {
    const { stage, state } = fresh();
    expect(canPlaceAt(stage, state.grid, { x: 240, y: stage.placement.minY - 1 })).toBe(false);
  });

  it('歩けないマスは置けない', () => {
    const { stage, state } = fresh();
    expect(canPlaceAt(stage, state.grid, { x: 0, y: 0 })).toBe(false);
  });
});

describe('placeUnit', () => {
  it('境界の線より下なら置ける', () => {
    const { stage, state } = fresh();
    const dest = { x: 400, y: stage.placement.minY + 32 };
    const uid = unitOf(state, 'roran').uid;
    expect(placeUnit(state, uid, dest)).toBe(true);
    expect(unitOf(state, 'roran').pos).toEqual(dest);
  });

  it('境界の線より上には置けない', () => {
    const { stage, state } = fresh();
    const uid = unitOf(state, 'roran').uid;
    const before = { ...unitOf(state, 'roran').pos };
    expect(placeUnit(state, uid, { x: 240, y: stage.placement.minY - 32 })).toBe(false);
    expect(unitOf(state, 'roran').pos).toEqual(before);
  });

  it('歩けないマスには置けない', () => {
    const { state } = fresh();
    const uid = unitOf(state, 'roran').uid;
    expect(placeUnit(state, uid, { x: 0, y: 0 })).toBe(false);
  });

  it('知らない uid なら false', () => {
    const { state } = fresh();
    expect(placeUnit(state, 'yuurei', { x: 112, y: 600 })).toBe(false);
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
    unitOf(state, state.stage.roster[0]!).attackCooldown = 5;
    beginBattle(state);
    expect(state.time).toBe(0);
    expect(unitOf(state, state.stage.roster[0]!).attackCooldown).toBe(0);
  });

  it('敵は そのまま のこる（ウェーブごとに わきなおさない）', () => {
    const { stage, state } = fresh();
    beginBattle(state);
    expect(state.units.filter((u) => u.side === 'enemy').length).toBe(stage.enemies.length);
  });
});
