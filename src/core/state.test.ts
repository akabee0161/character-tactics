import { describe, expect, it } from 'vitest';
import { MAX_PARTY } from './constants';
import { cellIndexAt } from './field';
import { fieldToStatic } from './fields';
import { beginBattle, canPlaceAt, createBattleState, placeUnit, startPositions, statsForLevel, windupOf } from './state';
import { testRegistry } from './testing';
import type { Registry } from '../engine/registry';
import type { StageDef } from '../engine/schema';
import type { BattleState, CharProgress } from './types';

function fresh(): { reg: Registry; stage: StageDef; state: BattleState } {
  const reg = testRegistry();
  const stage = reg.stages[0]!;
  const progress: Record<string, CharProgress> = {};
  for (const id of reg.units.keys()) progress[id] = { level: 1, xp: 0 };
  return { reg, stage, state: createBattleState(reg, stage, { units: progress, members: [], claimed: [] }, 1) };
}

function unitOf(s: BattleState, defId: string) {
  const u = s.units.find((x) => x.defId === defId && x.side === 'player');
  if (!u) throw new Error(`いない: ${defId}`);
  return u;
}

describe('statsForLevel', () => {
  it('レベル1 は基礎値どおり', () => {
    const reg = testRegistry();
    expect(statsForLevel(reg.units.get('roran')!, 1, reg.growth)).toEqual({
      maxHp: 30, power: 6, guard: reg.units.get('roran')!.guard, speed: reg.units.get('roran')!.speed,
    });
  });

  it('HP は1レベルごとに+1', () => {
    const reg = testRegistry();
    expect(statsForLevel(reg.units.get('roran')!, 4, reg.growth).maxHp).toBe(33);
  });

  it('攻撃力は3レベルごとに+1', () => {
    const reg = testRegistry();
    expect(statsForLevel(reg.units.get('roran')!, 3, reg.growth).power).toBe(6);
    expect(statsForLevel(reg.units.get('roran')!, 4, reg.growth).power).toBe(7);
  });

  it('上限レベルでも現状の上限とほぼ同じ強さ', () => {
    const reg = testRegistry();
    expect(statsForLevel(reg.units.get('roran')!, 12, reg.growth)).toEqual({
      maxHp: 41, power: 9, guard: reg.units.get('roran')!.guard, speed: reg.units.get('roran')!.speed,
    });
  });

  it('上乗せが能力値に入る', () => {
    const reg = testRegistry();
    const def = reg.units.get('roran')!;
    const s = statsForLevel(def, 1, reg.growth, { maxHp: 3, power: 1, guard: 2, speed: 5 });
    expect(s).toEqual({ maxHp: def.maxHp + 3, power: def.power + 1, guard: def.guard + 2, speed: def.speed + 5 });
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
    const state = createBattleState(reg, stage, { units: progress, members: [], claimed: [] }, 1);
    const roran = unitOf(state, 'roran');
    expect(roran.maxHp).toBe(32);
    expect(roran.hp).toBe(32);
    expect(roran.power).toBe(6);
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

  it('通れないマスの脇で、足元の箱がかかる位置には置けない', () => {
    // stage1 の 18行目・13列目（x:416-448, y:576-608）が木。x=413 は箱の右端 419 が木にかかる
    const { stage, state } = fresh();
    expect(canPlaceAt(stage, state.grid, { x: 410, y: 592 })).toBe(true);
    expect(canPlaceAt(stage, state.grid, { x: 413, y: 592 })).toBe(false);
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

describe('windupOf', () => {
  it('シートの attack から、最後のコマが出るまでの秒数を出す', () => {
    const def = testRegistry().units.get('roran')!;
    const a = def.sprites.map!.attack;
    expect(windupOf(def)).toBeCloseTo((a.frames - 1) / a.fps, 10);
  });

  it('シートが無ければ 0（即時）', () => {
    const def = { ...testRegistry().units.get('roran')!, sprites: { role: null, face: null, map: null } };
    expect(windupOf(def)).toBe(0);
  });
});

describe('出撃メンバーと開始位置', () => {
  const base = testRegistry();
  // roster に足して MAX_PARTY を 2 人超えるだけの仲間 id（MAX_PARTY・roster の人数に依存しない）
  const ALL_IDS = Array.from({ length: MAX_PARTY + 2 }, (_, i) => `ally${String(i + 5).padStart(2, '0')}`);
  const NEW_IDS = ALL_IDS.slice(0, 4);
  const talk = [{ speaker: 'roran', text: 'よろしく' }] as unknown as StageDef['joins'][number]['talk'];
  const recruitOf = (unitId: string) => ({ unitId, level: 2, talk });
  /** 新しい 4 人を足した登録簿。4 人は stage[0] の joins に書かれているので「加入しうる仲間」になる */
  function reg8() {
    const units = new Map(base.units);
    for (const id of ALL_IDS) units.set(id, { ...base.units.get('roran')!, id });
    const stage = { ...base.stages[0]!, joins: ALL_IDS.map(recruitOf) };
    const reg: Registry = { ...base, units, stages: [stage, ...base.stages.slice(1)] };
    return { reg, stage };
  }
  const party = (members: string[]) => ({ units: {}, members, claimed: [] as string[] });
  const players = (s: BattleState) => s.units.filter((u) => u.side === 'player');

  it('加わった仲間が roster の後ろに並ぶ', () => {
    const { reg, stage } = reg8();
    const s = createBattleState(reg, { ...stage, joins: [] }, party(['ally05']), 1);
    expect(players(s).map((u) => u.defId)).toEqual([...stage.roster, 'ally05']);
    expect(s.joined).toEqual([]);
  });

  it('開始時の加入は加入済みなら入らない', () => {
    const { reg, stage } = reg8();
    const s = createBattleState(reg, { ...stage, joins: [recruitOf('ally05'), recruitOf('ally06')] }, party(['ally05']), 1);
    expect(players(s).map((u) => u.defId)).toEqual([...stage.roster, 'ally05', 'ally06']);
    expect(s.joined).toEqual(['ally06']);
    expect(players(s).find((u) => u.defId === 'ally06')!.level).toBe(2);
  });

  it('出撃は 8 人まで', () => {
    const { reg, stage } = reg8();
    // roster の上に members が MAX_PARTY 人超えるほどいる。超えた分は出撃しない
    const room = ALL_IDS.slice(0, MAX_PARTY - stage.roster.length);
    const s = createBattleState(reg, { ...stage, joins: [] }, party(ALL_IDS), 1);
    expect(players(s).map((u) => u.defId)).toEqual([...stage.roster, ...room]);
    expect(players(s)).toHaveLength(MAX_PARTY);
    // MAX_PARTY 人そろっているとき、開始時の加入は加えず joined にも入れない
    const extra = ALL_IDS[ALL_IDS.length - 1]!;
    const s2 = createBattleState(reg, { ...stage, joins: [recruitOf(extra)] }, party(room), 1);
    expect(players(s2)).toHaveLength(MAX_PARTY);
    expect(players(s2).map((u) => u.defId)).not.toContain(extra);
    expect(s2.joined).toEqual([]);
  });

  it('開始位置: starts が足りないと近いマスで補い、補えなければ starts を繰り返す', () => {
    const { stage, state } = fresh();
    const n = stage.placement.starts.length;
    const pos = startPositions(stage, state.grid, n + 2);
    expect(pos.slice(0, n)).toEqual(stage.placement.starts);
    expect(pos).toHaveLength(n + 2);
    const none = startPositions({ ...stage, placement: { ...stage.placement, minY: 99999 } }, state.grid, n + 1);
    expect(none[n]).toEqual(stage.placement.starts[0]);
  });

  it('加入済みの説得の相手は出てこない', () => {
    const { reg, stage } = reg8();
    const foeId = stage.enemies[0]!.defId;
    const pers = { ...recruitOf('ally05'), foeId, pos: stage.enemies[0]!.pos, ai: stage.enemies[0]!.ai, persuader: 'roran' };
    const before = stage.enemies.length;
    const s = createBattleState(reg, { ...stage, joins: [], persuasions: [pers] }, party([]), 1);
    const foes = s.units.filter((u) => u.side === 'enemy');
    expect(foes).toHaveLength(before + 1);
    expect(foes.filter((u) => u.persuasion === 0)).toHaveLength(1);
    const s2 = createBattleState(reg, { ...stage, joins: [], persuasions: [pers] }, party(['ally05']), 1);
    expect(s2.units.filter((u) => u.side === 'enemy')).toHaveLength(before);
  });

  it('開始位置が重ならない', () => {
    const { reg, stage } = reg8();
    const s = createBattleState(reg, stage, party(NEW_IDS), 1);
    const ps = players(s);
    expect(ps).toHaveLength(8);
    for (const u of ps) expect(canPlaceAt(s.stage, s.grid, u.pos)).toBe(true);
    for (let i = 0; i < ps.length; i++) {
      for (let j = i + 1; j < ps.length; j++) {
        expect(Math.hypot(ps[i]!.pos.x - ps[j]!.pos.x, ps[i]!.pos.y - ps[j]!.pos.y)).toBeGreaterThanOrEqual(24);
      }
    }
  });

  it('新しい状態の項目が初期化される', () => {
    const s = createBattleState(base, base.stages[0]!, { units: {}, members: [], claimed: ['x'] }, 1);
    expect(s.joined).toEqual([]);
    expect(s.claimed).toEqual([]);
    expect(s.visited).toEqual([]);
    expect(s.pendingRecruit).toBeNull();
    expect(s.nextPlayerUid).toBe(s.units.filter((u) => u.side === 'player').length + 1);
    expect(s.claimedBefore.has('x')).toBe(true);
  });
});
