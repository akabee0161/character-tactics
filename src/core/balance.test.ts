import { describe, expect, it } from 'vitest';
import { newSave } from '../save/save';
import {
  BATTLE_DT, BATTLE_TIME_LIMIT, botCommands, MAX_ATTEMPTS, TARGET_BANDS, formatTable, isOutOfBand, measure, playThrough, runBattle,
  boostLevels, goalSafeDest, routeAvoidingGoal, walkableSafeDest,
  isOutOfBandRush, pickRushers, rushCommands, runRush, RUSH_MAX, RUSH_SEEDS, RUSH_SKILL_NEAR, RUSH_EXEMPT,
} from './balance';
import { cellCenter, cellIndexAt, distanceToSegment, isWalkableAt, makeGrid } from './field';
import type { StageStat } from './balance';
import { step } from './sim';
import { beginBattle, createBattleState } from './state';
import { limitReach } from './skills';
import type { BattleState } from './types';
import { testRegistry } from './testing';

const reg = testRegistry();
const stage = (id: string) => reg.stages.find((s) => s.id === id)!;
const NO_RUSH = { medianSeconds: 0, rushRates: {}, fastMedianSeconds: 0 };

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
    const row = (r: number, grownRate = 100): StageStat => ({
      stageId: 'stage1', name: '', reached: 1, firstTryRate: r, avgDeployed: 0, avgSurvivors: 0, grownRate, avgLevel: 1, leftoverRate: 0, ...NO_RUSH,
    });
    expect([row(95), row(100), row(94.9)].map(isOutOfBand)).toEqual([false, false, true]);
  });

  it('育てた場合が 80〜100 の外でも帯の外になる', () => {
    const row = (grownRate: number): StageStat => ({
      stageId: 'stage1', name: '', reached: 1, firstTryRate: 100, avgDeployed: 0, avgSurvivors: 0, grownRate, avgLevel: 1, leftoverRate: 0, ...NO_RUSH,
    });
    expect([row(80), row(100), row(79.9)].map(isOutOfBand)).toEqual([false, false, true]);
  });

  it('キーがステージの id と一致する', () => {
    expect(Object.keys(TARGET_BANDS).sort()).toEqual(reg.stages.map((s) => s.id).sort());
  });

  it('帯の外の行だけに「帯の外」が出る', () => {
    const row = (stageId: string, firstTryRate: number): StageStat => ({
      stageId, name: stageId, reached: 10, firstTryRate, avgDeployed: 4, avgSurvivors: 3, grownRate: 100, avgLevel: 5, leftoverRate: 0, ...NO_RUSH,
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

describe('goalSafeDest', () => {
  const victory = { type: 'reach', pos: { x: 240, y: 48 }, radius: 40, by: 'any' } as const;
  it('ゴールの内側の点は半径 + 20 の円周へ押し出す', () => {
    expect(goalSafeDest({ x: 240, y: 68 }, victory)).toEqual({ x: 240, y: 108 });
  });
  it('外側の点はそのまま', () => {
    expect(goalSafeDest({ x: 240, y: 200 }, victory)).toEqual({ x: 240, y: 200 });
  });
  it('中心と同じ点は真下へ押し出す', () => {
    expect(goalSafeDest({ x: 240, y: 48 }, victory)).toEqual({ x: 240, y: 108 });
  });
});

describe('boostLevels', () => {
  it('全員を +3、上限で止め、経験値を 0 にする。元は変えない', () => {
    const save = newSave(reg);
    save.units.roran = { level: 29, xp: 5 };
    save.units.ines = { level: 4, xp: 3 };
    const out = boostLevels(save, 3, 30);
    expect(out.units.roran).toEqual({ level: 30, xp: 0 });
    expect(out.units.ines).toEqual({ level: 7, xp: 0 });
    expect(save.units.roran).toEqual({ level: 29, xp: 5 });
  });
});

it('ボットは敵が残っている間、ゴールの半径 + 20 の内側へ move を出さない', () => {
  const state = createBattleState(reg, stage('stage1'), newSave(reg), 1);
  beginBattle(state);
  const { pos, radius } = state.stage.victory;
  const foe = state.units.find((u) => u.side === 'enemy')!;
  foe.pos = { x: pos.x + 5, y: pos.y + 5 }; // ゴールの中に敵がいる
  const ms = botCommands(state, 0, new Map()).filter((c) => c.type === 'move');
  expect(ms.length).toBeGreaterThan(0);
  for (const c of ms) {
    if (c.type !== 'move') continue;
    expect(Math.hypot(c.dest.x - pos.x, c.dest.y - pos.y)).toBeGreaterThanOrEqual(radius + 20 - 1e-6);
  }
});

it('runBattle は終了時の敵の残り（生きている敵 + 湧き残り）を返す', () => {
  const out = runBattle(reg, stage('stage1'), newSave(reg), 1);
  const alive = out.state.units.filter((u) => u.side === 'enemy' && !u.retired && u.hp > 0).length;
  const spawnLeft = out.state.stage.spawners.reduce((a, sp, i) => a + sp.total - (out.state.spawnCounts[i] ?? 0), 0);
  expect(out.enemiesLeft).toBe(alive + spawnLeft);
});

describe('playThrough の育てた場合・平均レベル', () => {
  it('各ステージに grownWon・avgLevel・leftover がある', () => {
    const runs = playThrough(reg, 1);
    expect(runs.length).toBeGreaterThan(0);
    for (const r of runs) {
      expect(typeof r.grownWon).toBe('boolean');
      if (r.cleared) expect(r.avgLevel).toBeGreaterThanOrEqual(1);
      expect(typeof r.leftover).toBe('boolean');
    }
  }, 120_000);
});

describe('ゴールの円を避ける目的地', () => {
  const s6 = () => createBattleState(reg, stage('stage6'), newSave(reg), 1);
  it('walkableSafeDest: 押し出した先が石のマスなら、円の外の歩けるマスへ寄せる（s6 の湧き位置）', () => {
    const state = s6();
    const v = state.stage.victory;
    const out = walkableSafeDest(state.grid, { x: 240, y: 80 }, v);
    expect(isWalkableAt(state.grid, out)).toBe(true);
    expect(Math.hypot(out.x - v.pos.x, out.y - v.pos.y)).toBeGreaterThanOrEqual(v.radius + 20 - 1e-6);
  });
  it('routeAvoidingGoal: 最短の道がゴールを横切るとき、円を通らない道の途中の点を返す（s6 の上の通路）', () => {
    const state = s6();
    const v = state.stage.victory;
    const from = { x: 270, y: 230 };
    const dest = { x: 112, y: 100 };
    const w = routeAvoidingGoal(state.grid, from, dest, v);
    expect(w).not.toEqual(dest);
    expect(distanceToSegment(v.pos, from, w)).toBeGreaterThanOrEqual(v.radius + 20 - 1e-6);
  });
  it('routeAvoidingGoal: まっすぐ行けて円を通らないなら dest のまま', () => {
    const state = s6();
    const dest = { x: 240, y: 560 };
    expect(routeAvoidingGoal(state.grid, { x: 240, y: 620 }, dest, state.stage.victory)).toEqual(dest);
  });
});

describe('ゴールの円に入りかけた味方', () => {
  const s6 = () => createBattleState(reg, stage('stage6'), newSave(reg), 1);
  it('routeAvoidingGoal: 円の中にいる点からは、まず円の外（半径 + 20 以上、すぐ近く）へ出る点を返す', () => {
    const state = s6();
    const v = state.stage.victory;
    const from = { x: v.pos.x - 16, y: v.pos.y + 30 }; // 円の中（距離 34）
    const w = routeAvoidingGoal(state.grid, from, { x: 112, y: 100 }, v);
    const d = Math.hypot(w.x - v.pos.x, w.y - v.pos.y);
    expect(d).toBeGreaterThanOrEqual(v.radius + 20 - 1e-6);
    expect(d).toBeLessThanOrEqual(v.radius + 20 + state.grid.cell * 1.5); // 押し出し先が石なら、近くの歩けるマスの中心
  });

  it('ボットは、敵が残るのに半径 + 14 の内側へ入りかけた味方へ、60 tick を待たず move を出し直す', () => {
    const state = s6();
    beginBattle(state);
    const v = state.stage.victory;
    const roran = state.units.find((u) => u.side === 'player' && u.defId === 'roran')!;
    roran.pos = { x: v.pos.x + 10, y: v.pos.y + v.radius + 6 }; // 縁のすぐ外（距離 46 < 54）
    roran.engagedWith = null;
    const memory = new Map();
    const moveFor = (tick: number) => botCommands(state, tick, memory).filter((c) => c.type === 'move' && c.uid === roran.uid);
    expect(moveFor(0).length).toBe(1);
    expect(moveFor(1).length).toBe(1); // 同じ目標でも、縁の近くなら 1 tick 後にも出す
  });

  it('縁から遠い味方には、今までどおり 60 tick は出し直さない', () => {
    const state = s6();
    beginBattle(state);
    const v = state.stage.victory;
    const roran = state.units.find((u) => u.side === 'player' && u.defId === 'roran')!;
    roran.pos = { x: v.pos.x, y: v.pos.y + 300 };
    roran.engagedWith = null;
    const memory = new Map();
    const moveFor = (tick: number) => botCommands(state, tick, memory).filter((c) => c.type === 'move' && c.uid === roran.uid);
    expect(moveFor(0).length).toBe(1);
    expect(moveFor(1).length).toBe(0);
  });
});

describe('目的地のマスの中心が円の中のとき（レビューの指摘）', () => {
  // 32px の開けた 10×10。ゴールは (112,112)、半径 40（立入禁止の円は半径 60）。敵はゴールの中の (117,117)
  const open = makeGrid(32, Array.from({ length: 10 }, () => '.'.repeat(10)));
  const victory = { type: 'reach', pos: { x: 112, y: 112 }, radius: 40, by: 'any' } as const;
  const enemy = { x: 117, y: 117 };

  it('walkableSafeDest: 押し出した点が円の外でも、そのマスの中心が円の中なら、中心も円の外のマスへ寄せる', () => {
    const dest = walkableSafeDest(open, enemy, victory);
    const cellC = cellCenter(open, cellIndexAt(open, dest));
    expect(Math.hypot(cellC.x - victory.pos.x, cellC.y - victory.pos.y)).toBeGreaterThanOrEqual(victory.radius + 20 - 1e-6);
  });

  it('routeAvoidingGoal: 経路が円を通らない（円の反対側から、円の中の敵へ向かうとき）', () => {
    const dest = walkableSafeDest(open, enemy, victory);
    const from = { x: 16, y: 16 };
    const w = routeAvoidingGoal(open, from, dest, victory);
    expect(distanceToSegment(victory.pos, from, w)).toBeGreaterThanOrEqual(victory.radius + 20 - 1e-6);
  });
});

describe('出発のマスの中心が円の中のとき（レビューの指摘 2）', () => {
  const open = makeGrid(32, Array.from({ length: 10 }, () => '.'.repeat(10)));
  const victory = { type: 'reach', pos: { x: 112, y: 112 }, radius: 40, by: 'any' } as const;

  it('円の外にいても、マスの中心が円の中なら、その場に留まらず円の外のマスへ出る点を返す', () => {
    const from = { x: 155, y: 155 }; // 円の外（距離 約 61）。マスの中心 (144,144) は円の中（距離 約 45）
    expect(Math.hypot(from.x - victory.pos.x, from.y - victory.pos.y)).toBeGreaterThanOrEqual(victory.radius + 20);
    const w = routeAvoidingGoal(open, from, { x: 16, y: 16 }, victory);
    expect(w).not.toEqual(from);
    const c = cellCenter(open, cellIndexAt(open, w));
    expect(Math.hypot(c.x - victory.pos.x, c.y - victory.pos.y)).toBeGreaterThanOrEqual(victory.radius + 20 - 1e-6);
  });
});

describe('出発のマスの中心が円の中のとき: 脱出先までの経路（レビューの指摘 3）', () => {
  const victory = { type: 'reach', pos: { x: 112, y: 112 }, radius: 40, by: 'any' } as const;
  it('脱出先への線がゴールの勝利半径を横切るなら、向かわずその場に留まる', () => {
    // 行 4 だけが細い通路（col 1〜4）。円の外へ出る道が、ゴールのすぐそばを通る
    const rows = Array.from({ length: 10 }, (_, y) => (y === 4 ? '#....#####' : '##########'));
    const grid = makeGrid(32, rows);
    const from = { x: 155, y: 155 }; // 円の外（距離 約 61）。マスの中心 (144,144) は円の中
    const w = routeAvoidingGoal(grid, from, { x: 48, y: 144 }, victory);
    expect(w).toEqual(from);
  });
});

describe('1 人の突っ込みと全員の急ぎ', () => {
  const battleOf = (id: string): BattleState => {
    const state = createBattleState(reg, stage(id), newSave(reg), 1);
    beginBattle(state);
    return state;
  };
  const players = (state: BattleState) => state.units.filter((u) => u.side === 'player');

  it('pickRushers: walker は飛行でない生きている仲間で speed が一番高い 1 人', () => {
    const state = battleOf('stage1');
    const got = pickRushers(state, 'walker');
    expect(got).toHaveLength(1);
    const best = Math.max(...players(state).filter((u) => !u.flying).map((u) => u.speed));
    expect(got[0]!.speed).toBe(best);
    expect(got[0]!.flying).toBe(false);
  });

  it('pickRushers: 飛行の仲間がいなければ flyer は空、gau は defId gau の 1 人、all は全員', () => {
    const state = battleOf('stage1');
    expect(pickRushers(state, 'flyer')).toEqual([]);
    expect(pickRushers(state, 'gau').map((u) => u.defId)).toEqual(['gau']);
    expect(pickRushers(state, 'all')).toHaveLength(players(state).length);
  });

  it('pickRushers: 倒れた仲間は数えない', () => {
    const state = battleOf('stage1');
    for (const u of players(state)) u.hp = 0;
    expect(pickRushers(state, 'all')).toEqual([]);
    expect(pickRushers(state, 'walker')).toEqual([]);
  });

  it('rushCommands は走らせる仲間にだけゴールへの move を出し、ほかには何も出さない', () => {
    const state = battleOf('stage1');
    const roran = players(state).find((u) => u.defId === 'roran')!;
    const cmds = rushCommands(state, new Set([roran.uid]), 0, new Map());
    expect(cmds.length).toBeGreaterThan(0);
    expect(cmds.every((c) => c.uid === roran.uid)).toBe(true);
    const moves = cmds.flatMap((c) => (c.type === 'move' ? [c] : []));
    expect(moves).toHaveLength(1);
    expect(moves[0]!.dest).toEqual(state.stage.victory.pos);
  });

  it('rushCommands は交戦中でも move を出し、60 tick は出し直さない', () => {
    const state = battleOf('stage1');
    const roran = players(state).find((u) => u.defId === 'roran')!;
    roran.engagedWith = 'dummy';
    const memory = new Map();
    const set = new Set([roran.uid]);
    expect(rushCommands(state, set, 0, memory).some((c) => c.type === 'move')).toBe(true);
    expect(rushCommands(state, set, 30, memory).some((c) => c.type === 'move')).toBe(false);
    expect(rushCommands(state, set, 60, memory).some((c) => c.type === 'move')).toBe(true);
  });

  it('rushCommands は needsDest の技を、敵が近くにいないあいだは取っておく（壁の前まで使わない人を測る）', () => {
    const state = battleOf('stage1');
    const gau = players(state).find((u) => u.defId === 'gau')!;
    gau.skillCooldownUntil = 0;
    const cmds = rushCommands(state, new Set([gau.uid]), 0, new Map());
    expect(cmds.some((c) => c.type === 'skill')).toBe(false);
  });

  it('rushCommands は敵が近い（RUSH_SKILL_NEAR 以内）か交戦中なら、needsDest の技を出す', () => {
    const state = battleOf('stage1');
    const gau = players(state).find((u) => u.defId === 'gau')!;
    gau.skillCooldownUntil = 0;
    const foe = state.units.find((u) => u.side === 'enemy')!;
    foe.pos = { x: gau.pos.x + RUSH_SKILL_NEAR - 1, y: gau.pos.y };
    expect(rushCommands(state, new Set([gau.uid]), 0, new Map()).some((c) => c.type === 'skill')).toBe(true);
    foe.pos = { x: gau.pos.x + RUSH_SKILL_NEAR + 5, y: gau.pos.y };
    expect(rushCommands(state, new Set([gau.uid]), 0, new Map()).some((c) => c.type === 'skill')).toBe(false);
    gau.engagedWith = foe.uid;
    expect(rushCommands(state, new Set([gau.uid]), 0, new Map()).some((c) => c.type === 'skill')).toBe(true);
  });

  it('rushCommands は needsDest の技を、ゴールへの向きに、届く距離で止めて出す', () => {
    const state = battleOf('stage1');
    const gau = players(state).find((u) => u.defId === 'gau')!;
    gau.skillCooldownUntil = 0;
    gau.engagedWith = 'dummy';
    const cmds = rushCommands(state, new Set([gau.uid]), 0, new Map());
    const skill = cmds.find((c) => c.type === 'skill');
    expect(skill).toBeDefined();
    if (skill?.type !== 'skill' || !skill.dest) throw new Error('dest が無い');
    expect(distanceToSegment(skill.dest, gau.pos, state.stage.victory.pos)).toBeLessThan(1);
    const max = 4 * state.grid.cell;
    const expected = limitReach(gau.pos, state.stage.victory.pos, max);
    expect(skill.dest.x).toBeCloseTo(expected.x, 6);
    expect(skill.dest.y).toBeCloseTo(expected.y, 6);
  });

  describe('行き先の要る技のあとの move', () => {
    const setup = () => {
      const state = battleOf('stage1');
      const gau = players(state).find((u) => u.defId === 'gau')!;
      gau.skillCooldownUntil = 0;
      gau.engagedWith = 'dummy';
      const set = new Set([gau.uid]);
      const memory = new Map();
      const first = rushCommands(state, set, 0, memory);
      expect(first.some((c) => c.type === 'move')).toBe(true);
      expect(first.some((c) => c.type === 'skill')).toBe(true);
      return { state, gau, set, memory };
    };

    it('技が成功した（再使用の待ちが入った）次の tick に、ゴールへの move を出し直す（技が移動の指示を消すため）', () => {
      const { state, gau, set, memory } = setup();
      gau.skillCooldownUntil = state.time + 14; // 成功のしるし
      const next = rushCommands(state, set, 1, memory);
      expect(next.some((c) => c.type === 'move')).toBe(true);
    });

    it('技が壁で出なかった（再使用の待ちが入らない）なら、次の tick に move を出し直さない（交戦を解き続けないため）', () => {
      const { state, set, memory } = setup();
      const next = rushCommands(state, set, 1, memory);
      expect(next.some((c) => c.type === 'move')).toBe(false);
    });
  });

  it('runRush は走らせる仲間がいなければ null', () => {
    expect(runRush(reg, stage('stage1'), newSave(reg), 1, 'flyer')).toBeNull();
  });

  it('runRush は同じ引数なら同じ結果になり、時間の上限で終わる', () => {
    const a = runRush(reg, stage('stage1'), newSave(reg), 3, 'walker')!;
    const b = runRush(reg, stage('stage1'), newSave(reg), 3, 'walker')!;
    expect([a.result, a.seconds]).toEqual([b.result, b.seconds]);
    expect(a.seconds).toBeLessThanOrEqual(BATTLE_TIME_LIMIT + BATTLE_DT);
  });

  it('isOutOfBandRush は RUSH_MAX ちょうどを含まず、超えたら真。all は見ない', () => {
    const row = (rushRates: StageStat['rushRates']): StageStat => ({
      stageId: 'stage2', name: '', reached: 1, firstTryRate: 100, avgDeployed: 0, avgSurvivors: 0, grownRate: 100, avgLevel: 1,
      leftoverRate: 0, medianSeconds: 0, fastMedianSeconds: 0, rushRates,
    });
    expect(isOutOfBandRush(row({ walker: RUSH_MAX }))).toBe(false);
    expect(isOutOfBandRush(row({ walker: RUSH_MAX + 0.1 }))).toBe(true);
    expect(isOutOfBandRush(row({ flyer: RUSH_MAX + 1 }))).toBe(true);
    expect(isOutOfBandRush(row({ gau: RUSH_MAX + 1 }))).toBe(true);
    expect(isOutOfBandRush(row({ all: 100 }))).toBe(false);
    expect(isOutOfBand(row({ gau: RUSH_MAX + 1 }))).toBe(true);
  });

  it('チュートリアルのステージ（RUSH_EXEMPT）は、突っ込みが 100% でも帯の外にしない。ほかの帯は見る', () => {
    expect(RUSH_EXEMPT).toEqual(['stage1']);
    const row = (stageId: string, firstTryRate: number): StageStat => ({
      stageId, name: '', reached: 1, firstTryRate, avgDeployed: 0, avgSurvivors: 0, grownRate: 100, avgLevel: 1,
      leftoverRate: 0, medianSeconds: 0, fastMedianSeconds: 0, rushRates: { walker: 100, gau: 100 },
    });
    expect(isOutOfBandRush(row('stage1', 100))).toBe(false);
    expect(isOutOfBand(row('stage1', 100))).toBe(false);
    expect(isOutOfBand(row('stage1', 50))).toBe(true);
    expect(isOutOfBandRush(row('stage2', 100))).toBe(true);
  });

  it('formatTable に突っ込み・急ぎの列と、突っ込みの判定が出る', () => {
    const s: StageStat = {
      stageId: 'stage2', name: 'a', reached: 10, firstTryRate: 100, avgDeployed: 4, avgSurvivors: 3, grownRate: 100, avgLevel: 5,
      leftoverRate: 0, medianSeconds: 75.3, fastMedianSeconds: 40, rushRates: { walker: 50, gau: 0, all: 100 },
    };
    const text = formatTable([s]);
    for (const h of ['突っ込み(歩き)', '突っ込み(飛行)', '突っ込み(ガウ)', '急ぎ(秒)', 'クリア(秒)']) expect(text).toContain(h);
    const line = text.split('\n').find((l) => l.includes('stage2'))!;
    expect(line).toContain('突っ込み');
    expect(line).toContain('75.3');
  });

  it('playThrough のシード ≤ RUSH_SEEDS は rush が入り、それより上は空', () => {
    const small = { ...reg, stages: reg.stages.slice(0, 1) };
    const withRush = playThrough(small, 1)[0]!;
    expect(Object.keys(withRush.rush).length).toBeGreaterThan(0);
    expect(withRush.rush.walker).toBeDefined();
    const without = playThrough(small, RUSH_SEEDS + 1)[0]!;
    expect(without.rush).toEqual({});
  }, 120_000);
});
