import { describe, expect, it } from 'vitest';
import { newSave } from '../save/save';
import {
  BATTLE_DT, BATTLE_TIME_LIMIT, botCommands, MAX_ATTEMPTS, TARGET_BANDS, formatTable, isOutOfBand, measure, playThrough, runBattle,
} from './balance';
import type { StageStat } from './balance';
import { step } from './sim';
import { beginBattle, createBattleState } from './state';
import type { BattleState } from './types';
import { testRegistry } from './testing';

const reg = testRegistry();
const stage = (id: string) => reg.stages.find((s) => s.id === id)!;

describe('runBattle', () => {
  it('ステージ1が上限の時間内に終わり、人数が合う', () => {
    const out = runBattle(reg, stage('stage1'), newSave(reg), 1);
    expect(['victory', 'defeat', 'timeout']).toContain(out.result);
    expect(out.seconds).toBeLessThanOrEqual(BATTLE_TIME_LIMIT + BATTLE_DT);
    expect(out.deployed).toBe(4);
    expect(out.survivors).toBeLessThanOrEqual(out.deployed);
  });

  it('同じ引数なら同じ結果になる', () => {
    const a = runBattle(reg, stage('stage1'), newSave(reg), 7);
    const b = runBattle(reg, stage('stage1'), newSave(reg), 7);
    expect([a.result, a.seconds, a.survivors]).toEqual([b.result, b.seconds, b.survivors]);
  });

  it('ステージ4で村へ寄って ally07 が加わる', () => {
    const save = { ...newSave(reg), members: [] };
    const joined = [1, 2, 3, 4, 5].map((seed) => runBattle(reg, stage('stage4'), save, seed).state.joined);
    expect(joined.some((j) => j.includes('ally07'))).toBe(true);
  });

  it('ステージ2は開始時に ally05 が加わり5人で出る', () => {
    const out = runBattle(reg, stage('stage2'), { ...newSave(reg), members: [] }, 1);
    expect(out.state.joined).toContain('ally05');
    expect(out.deployed).toBe(5);
  });

  it('敵が残っている間は、全員の move の目的地が敵の位置のどれかになる', () => {
    const state = createBattleState(reg, stage('stage1'), newSave(reg), 1);
    beginBattle(state);
    const memory = new Map();
    let checked = 0;
    for (let tick = 0; tick < 600 && state.phase === 'battle'; tick++) {
      const enemies = state.units.filter((u) => u.side === 'enemy' && !u.retired && u.hp > 0);
      const cmds = botCommands(state, tick, memory);
      if (enemies.length > 0) {
        for (const c of cmds) {
          if (c.type !== 'move') continue;
          checked++;
          expect(enemies.some((e) => e.pos.x === c.dest.x && e.pos.y === c.dest.y)).toBe(true);
        }
      }
      step(state, cmds, BATTLE_DT);
    }
    expect(checked).toBeGreaterThan(0);
  });

  it('ステージ2は seed が違えば seconds が全部同じにはならない', () => {
    const secs = [1, 2, 3, 4, 5, 6, 7, 8].map((seed) => runBattle(reg, stage('stage2'), { ...newSave(reg), members: [] }, seed).seconds);
    expect(new Set(secs).size).toBeGreaterThan(1);
  }, 60_000);

  it('ステージ2は走り抜けず、敵を倒すぶん時間がかかる（20秒超）', () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const out = runBattle(reg, stage('stage2'), { ...newSave(reg), members: [] }, seed);
      expect(out.seconds).toBeGreaterThan(20);
    }
  }, 60_000);

  it('ステージ7で ally06 が説得で加わる', () => {
    const joined = [1, 2, 3, 4, 5].map((seed) => runBattle(reg, stage('stage7'), newSave(reg), seed).state.joined);
    expect(joined.some((j) => j.includes('ally06'))).toBe(true);
  }, 60_000);

  it('ステージ9で ally08 が説得で加わる', () => {
    const joined = [1, 2, 3, 4, 5].map((seed) => runBattle(reg, stage('stage9'), newSave(reg), seed).state.joined);
    expect(joined.some((j) => j.includes('ally08'))).toBe(true);
  }, 60_000);
});

describe('playThrough', () => {
  it('ステージ順に進み、打ち切りは最後の1つだけ', () => {
    const runs = playThrough(reg, 1);
    expect(runs[0]!.stageId).toBe(reg.stages[0]!.id);
    expect(runs.length).toBeLessThanOrEqual(reg.stages.length);
    for (const r of runs) {
      expect(r.attempts).toBeGreaterThanOrEqual(1);
      expect(r.attempts).toBeLessThanOrEqual(MAX_ATTEMPTS);
    }
    expect(runs.filter((r) => !r.cleared).length).toBeLessThanOrEqual(1);
    const bad = runs.findIndex((r) => !r.cleared);
    if (bad >= 0) expect(bad).toBe(runs.length - 1);
  });

  it('同じシードなら同じ結果になる', () => {
    expect(playThrough(reg, 3)).toEqual(playThrough(reg, 3));
  });
});

describe('measure', () => {
  it('ステージと同じ順・長さで、値が範囲内', () => {
    const stats = measure(reg, 2);
    expect(stats.map((s) => s.stageId)).toEqual(reg.stages.map((s) => s.id));
    for (const s of stats) {
      expect(s.firstTryRate).toBeGreaterThanOrEqual(0);
      expect(s.firstTryRate).toBeLessThanOrEqual(100);
      expect(s.reached).toBeGreaterThanOrEqual(0);
    }
    expect(stats[0]!.reached).toBe(2);
  }, 120_000);
});

describe('TARGET_BANDS / formatTable', () => {
  it('isOutOfBand は帯の端を含み、外を真にする', () => {
    const row = (r: number): StageStat => ({ stageId: 'stage1', name: '', reached: 1, firstTryRate: r, avgDeployed: 0, avgSurvivors: 0 });
    expect([row(90), row(100), row(89.9)].map(isOutOfBand)).toEqual([false, false, true]);
  });

  it('キーがステージの id と一致する', () => {
    expect(Object.keys(TARGET_BANDS).sort()).toEqual(reg.stages.map((s) => s.id).sort());
  });

  it('帯の外の行だけに「帯の外」が出る', () => {
    const row = (stageId: string, firstTryRate: number): StageStat => ({
      stageId, name: stageId, reached: 10, firstTryRate, avgDeployed: 4, avgSurvivors: 3,
    });
    const [lo, hi] = TARGET_BANDS['stage1']!;
    const lines = formatTable([row('stage1', (lo + hi) / 2), row('stage2', 0)]).split('\n');
    const l1 = lines.find((l) => l.includes('stage1'))!;
    const l2 = lines.find((l) => l.includes('stage2'))!;
    expect(l1).not.toContain('帯の外');
    expect(l2).toContain('帯の外');
  });
});

describe('botCommands の動き', () => {
  const battleOf = (s: StageDefLike): BattleState => {
    const state = createBattleState(reg, s, newSave(reg), 1);
    beginBattle(state);
    return state;
  };
  type StageDefLike = ReturnType<typeof stage>;
  const moves = (cmds: ReturnType<typeof botCommands>) => cmds.flatMap((c) => (c.type === 'move' ? [c] : []));
  const players = (state: BattleState) => state.units.filter((u) => u.side === 'player');
  const spawnerOnly = (): StageDefLike => ({
    ...stage('stage1'),
    enemies: [],
    spawners: [{ defId: 'narazumono', pos: { x: 48, y: 208 }, firstAfter: 9999, every: 15, total: 1 }],
  });

  it('交戦中（engagedWith あり）の味方には move を出さない', () => {
    const state = battleOf(stage('stage1'));
    const [engaged, ...others] = players(state);
    engaged!.engagedWith = state.units.find((u) => u.side === 'enemy')!.uid;
    const ms = moves(botCommands(state, 0));
    expect(ms.some((c) => c.uid === engaged!.uid)).toBe(false);
    for (const o of others) expect(ms.some((c) => c.uid === o.uid)).toBe(true);
  });

  it('敵がいなくても湧き残りがあれば move を出さず、時間切れになる', () => {
    const s = spawnerOnly();
    expect(moves(botCommands(battleOf(s), 0))).toEqual([]);
    const out = runBattle(reg, s, newSave(reg), 1);
    expect(out.result).toBe('timeout');
    expect(out.seconds).toBeGreaterThanOrEqual(BATTLE_TIME_LIMIT);
    expect(out.seconds).toBeLessThanOrEqual(BATTLE_TIME_LIMIT + BATTLE_DT);
  }, 60_000);

  it('敵が 0 体で湧き残りも無ければ、全員がゴールへ move する', () => {
    const s = { ...stage('stage1'), enemies: [], spawners: [] };
    const state = battleOf(s);
    const ms = moves(botCommands(state, 0));
    expect(ms.length).toBe(players(state).length);
    for (const c of ms) expect(c.dest).toEqual(s.victory.pos);
  });

  it('反応の遅れが過ぎるまで move は出さないが、必殺技は出す', () => {
    const state = battleOf(stage('stage1'));
    const delays = new Map(players(state).map((u) => [u.uid, 1.0]));
    const early = botCommands(state, 0, new Map(), delays);
    expect(moves(early)).toEqual([]);
    expect(early.some((c) => c.type === 'skill')).toBe(true);
    state.time = 1.0;
    expect(moves(botCommands(state, 0, new Map(), delays)).length).toBe(players(state).length);
  });

  it('他の敵が残っている間は、説得の相手へは persuader の味方だけが向かう', () => {
    const state = battleOf(stage('stage7'));
    const foe = state.units.find((u) => u.side === 'enemy' && u.persuasion !== null)!;
    const persuader = players(state).find((u) => u.defId === 'mist')!;
    expect(state.units.some((u) => u.side === 'enemy' && u.persuasion === null)).toBe(true);
    const toFoe = moves(botCommands(state, 0)).filter((c) => c.dest.x === foe.pos.x && c.dest.y === foe.pos.y);
    expect(toFoe.map((c) => c.uid)).toEqual([persuader.uid]);
  });
});
