/**
 * ステージの難易度を測るボットと、通しの実行・集計（純ロジック。window などには触れない）。
 *
 * ボットの動かし方（のちに表の数字を読む人のため）。「敵を全部倒してからゴールへ」:
 * - 配置は placement.starts のまま（createBattleState が決める）。
 * - 生きている敵がいる間、生きている味方全員が、その味方から見て最寄りの敵の位置へ move する
 *   （歩きながら攻撃する移動なので、詰めながら戦う）。ゴールへは向かわない。
 *   目標（敵の uid・村・ゴール）が変わったときと、60 tick ごとに出し直す。
 * - 説得の相手（persuasion が付いた生きている敵）は、persuader の defId を持つ生きている味方 1 人
 *   （先に並んだ方）だけが目標にし、ほかの味方の最寄りの敵の候補から外す。説得の相手以外の敵がいなくなれば、
 *   全員が相手へ向かう。persuader が死んでいる（いない）ときは普通の敵として扱う。
 * - 敵が 0 体で、spawners に湧き残り（spawnCounts[i] < total）があれば、その場に留まる（move を出さない）。
 *   湧き残りも無く敵が全滅したら、全員がゴール（victory.pos）へ move する。
 * - 加入の村（recruit）があり、その unitId がまだ仲間にいなければ、最も speed が高い生きている味方 1 人
 *   （同じ speed なら先に並んだ方）を、敵より先に村のマスの中心へ向かわせる（歩けないマスなので
 *   resolveMoveDest が最寄りの歩けるマスに置き換える）。村を訪れた（state.visited）後は上の動きに戻る。
 * - 必殺技は canUseSkill が真のとき即座に出す。needsDest が 1 のものは、最寄りの生きている敵
 *   （距離が同じなら先に並んだ方）の位置を dest にする。敵がいなければ needsDest のものは出さない。
 *   本物のゲーム（main.ts）と同じく、skill コマンドとして step に渡す。
 * - 揺らぎ（seed は runBattle だけが使う。sim 本体は乱数を使わないため、ボット側で入れる）:
 *   beginBattle の前に、開始位置への味方の割り当て順を seed でシャッフルして置き直す（置けなければ置き直さない）。
 *   味方 1 人ごとに 0〜1.5 秒（seed から決める）が過ぎるまで、その人に move を出さない（必殺技は出す）。
 * - pendingRecruit が立ったら、次の tick の前に completeRecruit を呼ぶ（本物は会話のあとに呼ぶ）。
 * - 乱数は使わない。1 戦は戦闘時間 BATTLE_TIME_LIMIT 秒まで。超えたら timeout（負け扱い）。
 * 通し・集計の決まりは各関数のコメントを参照。
 */
import { skillParam } from '../engine/registry';
import type { Registry } from '../engine/registry';
import type { StageDef } from '../engine/schema';
import { applyStageClear } from '../ui/flow';
import { newSave } from '../save/save';
import type { SaveData } from '../save/save';
import { completeRecruit } from './events';
import { distance } from './field';
import { makeRng, nextFloat } from './rng';
import { step } from './sim';
import type { SimCommand } from './sim';
import { canUseSkill } from './skills';
import { beginBattle, createBattleState, placeUnit } from './state';
import type { BattleState, PartyProgress, Unit, Vec2 } from './types';

export const BATTLE_DT = 1 / 60;
export const BATTLE_TIME_LIMIT = 300; // 秒
export const MAX_ATTEMPTS = 5;
const MOVE_REISSUE_TICKS = 60;
const MAX_REACTION_DELAY = 1.5; // 秒

export type BattleOutcome = {
  result: 'victory' | 'defeat' | 'timeout';
  seconds: number;
  deployed: number; // 出撃した人数（会話で加わった人も含む。最終）
  survivors: number; // 終了時に生きている味方の数
  state: BattleState;
};

const alive = (u: Unit): boolean => !u.retired && u.hp > 0;

/** まだ訪れていない加入の村のうち、その仲間がいないもの（先に並んだ方）の中心 */
function pendingVillageCenter(state: BattleState): Vec2 | null {
  for (const v of state.stage.villages) {
    if (v.effect.type !== 'recruit' || state.visited.includes(v.id)) continue;
    const id = v.effect.recruit.unitId;
    const present = state.joined.includes(id)
      || state.units.some((u) => u.side === 'player' && u.defId === id);
    if (present) continue;
    const c = state.grid.cell;
    return { x: (v.col + 0.5) * c, y: (v.row + 0.5) * c };
  }
  return null;
}

/** 最も speed の高い生きている味方（同じなら先に並んだ方） */
function fastestPlayer(state: BattleState): Unit | null {
  let best: Unit | null = null;
  for (const u of state.units) {
    if (u.side !== 'player' || !alive(u)) continue;
    if (best === null || u.speed > best.speed) best = u;
  }
  return best;
}

type MoveMemory = Map<string, { key: string; tick: number }>;

function nearestOf(from: Vec2, units: Unit[]): Unit | null {
  let best: Unit | null = null;
  let bestD = Infinity;
  for (const e of units) {
    const d = distance(from, e.pos);
    if (d < bestD) { best = e; bestD = d; }
  }
  return best;
}

/** 説得できる相手（persuader が生きている）。persuader の生きている味方（先に並んだ方）と対にして返す */
function persuadePairs(state: BattleState, enemies: Unit[]): { foe: Unit; persuader: Unit }[] {
  const pairs: { foe: Unit; persuader: Unit }[] = [];
  for (const foe of enemies) {
    if (foe.persuasion === null) continue;
    const def = state.stage.persuasions[foe.persuasion];
    if (!def) continue;
    const persuader = state.units.find((u) => u.side === 'player' && alive(u) && u.defId === def.persuader);
    if (persuader) pairs.push({ foe, persuader });
  }
  return pairs;
}

type Target = { key: string; dest: Vec2 } | null;

export function botCommands(
  state: BattleState, tick: number, memory: MoveMemory = new Map(), delays: Map<string, number> = new Map(),
): SimCommand[] {
  const cmds: SimCommand[] = [];
  const enemies = state.units.filter((u) => u.side === 'enemy' && alive(u));
  const pairs = persuadePairs(state, enemies);
  const persuadable = new Set(pairs.map((p) => p.foe.uid));
  const normal = enemies.filter((e) => !persuadable.has(e.uid));
  const village = pendingVillageCenter(state);
  const visitor = village ? fastestPlayer(state) : null;
  const spawnsLeft = state.stage.spawners.some((sp, i) => (state.spawnCounts[i] ?? 0) < sp.total);

  const targetFor = (u: Unit): Target => {
    if (visitor && u.uid === visitor.uid) return { key: 'village', dest: village! };
    const mine = pairs.find((p) => p.persuader.uid === u.uid);
    if (mine) return { key: mine.foe.uid, dest: { ...mine.foe.pos } };
    const foe = nearestOf(u.pos, normal) ?? nearestOf(u.pos, enemies);
    if (foe) return { key: foe.uid, dest: { ...foe.pos } };
    if (spawnsLeft) return null;
    return { key: 'goal', dest: { ...state.stage.victory.pos } };
  };

  for (const u of state.units) {
    if (u.side !== 'player' || !alive(u)) continue;
    const t = state.time < (delays.get(u.uid) ?? 0) ? null : targetFor(u);
    if (t) {
      const mem = memory.get(u.uid);
      if (!mem || mem.key !== t.key || tick - mem.tick >= MOVE_REISSUE_TICKS) {
        cmds.push({ type: 'move', uid: u.uid, dest: t.dest });
        memory.set(u.uid, { key: t.key, tick });
      }
    }
    if (u.skillId !== null && canUseSkill(state, u.uid)) {
      if (skillParam(state.reg, u.skillId, 'needsDest', 0) === 1) {
        const target = nearestOf(u.pos, enemies);
        if (target) cmds.push({ type: 'skill', uid: u.uid, dest: { ...target.pos } });
      } else {
        cmds.push({ type: 'skill', uid: u.uid });
      }
    }
  }
  return cmds;
}

export function runBattle(reg: Registry, stage: StageDef, party: PartyProgress, seed: number): BattleOutcome {
  const state = createBattleState(reg, stage, party, seed);
  const rng = makeRng(seed);
  const players = state.units.filter((u) => u.side === 'player');
  const spots = players.map((u) => ({ ...u.pos }));
  for (let i = spots.length - 1; i > 0; i--) {
    const j = Math.floor(nextFloat(rng) * (i + 1));
    [spots[i], spots[j]] = [spots[j]!, spots[i]!];
  }
  const delays = new Map<string, number>();
  players.forEach((u, i) => {
    placeUnit(state, u.uid, spots[i]!);
    delays.set(u.uid, nextFloat(rng) * MAX_REACTION_DELAY);
  });
  beginBattle(state);
  const memory: MoveMemory = new Map();
  let tick = 0;
  let result: BattleOutcome['result'] = 'timeout';
  for (;;) {
    if (state.pendingRecruit !== null) completeRecruit(state);
    if (state.phase === 'victory') { result = 'victory'; break; }
    if (state.phase === 'defeat') { result = 'defeat'; break; }
    if (state.time >= BATTLE_TIME_LIMIT) break;
    step(state, botCommands(state, tick, memory, delays), BATTLE_DT);
    tick++;
  }
  const finalPlayers = state.units.filter((u) => u.side === 'player');
  return {
    result,
    seconds: state.time,
    deployed: finalPlayers.length,
    survivors: finalPlayers.filter(alive).length,
    state,
  };
}

export type StageRun = {
  stageId: string; firstTryWon: boolean; attempts: number; cleared: boolean; deployed: number; survivors: number;
};

/**
 * newSave から reg.stages の順に 1 本通す。勝てばセーブを持ち越し、負け・時間切れならセーブを変えず
 * 同じステージをやり直す（最大 MAX_ATTEMPTS 回）。勝てなければそこで打ち切る（最後の要素が cleared:false）。
 * createBattleState のシードは seed * 100 + 試行番号（0 始まり）。
 * deployed・survivors は、勝った試行のもの（勝てなかったときは最後の試行のもの）
 */
export function playThrough(reg: Registry, seed: number): StageRun[] {
  const runs: StageRun[] = [];
  let save: SaveData = newSave(reg);
  for (const stage of reg.stages) {
    let last: BattleOutcome | null = null;
    let attempts = 0;
    let firstTryWon = false;
    let cleared = false;
    while (attempts < MAX_ATTEMPTS) {
      last = runBattle(reg, stage, save, seed * 100 + attempts);
      attempts++;
      if (last.result === 'victory') {
        cleared = true;
        firstTryWon = attempts === 1;
        save = applyStageClear(reg, save, stage.id, last.state).save;
        break;
      }
    }
    runs.push({
      stageId: stage.id, firstTryWon, attempts, cleared,
      deployed: last!.deployed, survivors: last!.survivors,
    });
    if (!cleared) break;
  }
  return runs;
}

export type StageStat = {
  stageId: string; name: string; reached: number; firstTryRate: number; avgDeployed: number; avgSurvivors: number;
};

/**
 * シード 1..seeds の通しを回して集計する。1 回目の勝率 = 1 回目で勝った通し ÷ そのステージに到達した通し（％）。
 * 生き残りの平均は、勝ったステージの通しだけで取る（その通しの勝った試行）。出撃人数の平均は到達した通し全部
 */
export function measure(reg: Registry, seeds: number): StageStat[] {
  if (!Number.isInteger(seeds) || seeds < 1) throw new Error(`seeds は 1 以上の整数: ${seeds}`);
  const runs: StageRun[][] = [];
  for (let s = 1; s <= seeds; s++) runs.push(playThrough(reg, s));
  return reg.stages.map((stage) => {
    const reached = runs.map((r) => r.find((x) => x.stageId === stage.id)).filter((x): x is StageRun => !!x);
    const won = reached.filter((x) => x.cleared);
    const mean = (xs: number[]): number => (xs.length === 0 ? 0 : xs.reduce((a, b) => a + b, 0) / xs.length);
    return {
      stageId: stage.id,
      name: stage.name,
      reached: reached.length,
      firstTryRate: reached.length === 0 ? 0 : (reached.filter((x) => x.firstTryWon).length / reached.length) * 100,
      avgDeployed: mean(reached.map((x) => x.deployed)),
      avgSurvivors: mean(won.map((x) => x.survivors)),
    };
  });
}

/** 目標の 1 回目の勝率の帯（％）。stageId → [下限, 上限] */
export const TARGET_BANDS: Record<string, [number, number]> = {
  stage1: [90, 100],
  stage2: [85, 100],
  stage3: [30, 55],
  stage4: [80, 95],
  stage5: [75, 95],
  stage6: [70, 90],
  stage7: [60, 85],
  stage8: [55, 80],
  stage9: [50, 75],
  stage10: [45, 70],
};

export function formatTable(stats: StageStat[]): string {
  const lines = [
    '| ステージ | 名前 | 到達 | 1回目の勝率(%) | 目標(%) | 出撃(平均) | 生き残り(平均) | 判定 |',
    '|---|---|---|---|---|---|---|---|',
  ];
  for (const s of stats) {
    const band = TARGET_BANDS[s.stageId];
    const out = band ? s.firstTryRate < band[0] || s.firstTryRate > band[1] : false;
    lines.push(
      `| ${s.stageId} | ${s.name} | ${s.reached} | ${s.firstTryRate.toFixed(1)} | ${band ? `${band[0]}〜${band[1]}` : '-'}`
      + ` | ${s.avgDeployed.toFixed(1)} | ${s.avgSurvivors.toFixed(1)} | ${out ? '帯の外' : ''} |`,
    );
  }
  return lines.join('\n');
}
