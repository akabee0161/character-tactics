/**
 * ステージの難易度を測るボットと、通しの実行・集計（純ロジック。window などには触れない）。
 *
 * ボットの動かし方（のちに表の数字を読む人のため）。「敵を全部倒してからゴールへ」:
 * - 配置は placement.starts のまま（createBattleState が決める）。
 * - 生きている敵がいる間、生きている味方全員が、その味方から見て最寄りの敵の位置へ move する
 *   （歩きながら攻撃する移動なので、詰めながら戦う）。ゴールへは向かわない。
 *   目標（敵の uid・村・ゴール）が変わったときと、60 tick ごとに出し直す。
 *   ただし交戦中（engagedWith あり）の味方には出さない（move は交戦を解き、攻撃のクールダウンを振り出しに戻すため）。
 * - 説得の相手（persuasion が付いた生きている敵）は、persuader の defId を持つ生きている味方 1 人
 *   （先に並んだ方）だけが目標にし、ほかの味方の最寄りの敵の候補から外す。説得の相手以外の敵がいなくなれば、
 *   全員が相手へ向かう。persuader が死んでいる（いない）ときは普通の敵として扱う。
 * - 敵（説得の相手を含む）への move の目的地は、goalSafeDest でゴールの半径 + 20 の外へ押し出す
 *   （敵が残ったままゴールに入って勝つ、を防ぐ。ゲームの決まりは変えない）。
 * - 敵が 0 体で、spawners に湧き残り（spawnCounts[i] < total）があれば、その場に留まる（move を出さない）。
 *   湧き残りも無く敵が全滅したら、全員がゴール（victory.pos）へ move する。
 * - 加入の村（recruit）があり、その unitId がまだ仲間にいなければ、最も speed が高い生きている味方 1 人
 *   （同じ speed なら先に並んだ方）を、敵より先に村のマスの中心へ向かわせる（歩けないマスなので
 *   resolveMoveDest が最寄りの歩けるマスに置き換える）。村を訪れた（state.visited）後は上の動きに戻る。
 * - 必殺技は canUseSkill が真のとき即座に出す。needsDest が 1 のものは、最寄りの生きている敵
 *   （距離が同じなら先に並んだ方）の位置を dest にする。敵がいなければ needsDest のものは出さない。
 *   本物のゲーム（main.ts）と同じく、skill コマンドとして step に渡す。
 * - 揺らぎ（seed は runBattle だけが使う。sim 本体は乱数を使わないため、ボット側で入れる）:
 *   beginBattle の前に、開始位置への味方の割り当て順を seed でシャッフルして置き直す（開始位置はすべて置ける位置なので必ず置ける。置けなければ例外）。
 *   味方 1 人ごとに 0〜1.5 秒（seed から決める）が過ぎるまで、その人に move を出さない（必殺技は出す）。
 * - pendingRecruit が立ったら、次の tick の前に completeRecruit を呼ぶ（本物は会話のあとに呼ぶ）。
 * - 乱数は使わない。1 戦は戦闘時間 BATTLE_TIME_LIMIT 秒まで。超えたら timeout（負け扱い）。
 * 通し・集計の決まりは各関数のコメントを参照。
 */
import { skillParam } from '../engine/registry';
import type { Registry } from '../engine/registry';
import type { StageDef, VictoryCond } from '../engine/schema';
import { applyStageClear } from '../ui/flow';
import { newSave } from '../save/save';
import type { SaveData } from '../save/save';
import { completeRecruit } from './events';
import { cellCenter, cellIndexAt, computeFlowField, distance, distanceToSegment, flowDirection, hasClearPath, isWalkableAt } from './field';
import { makeRng, nextFloat } from './rng';
import { step } from './sim';
import type { SimCommand } from './sim';
import { canUseSkill } from './skills';
import { beginBattle, createBattleState, placeUnit } from './state';
import type { BattleState, FlowField, Grid, PartyProgress, Unit, Vec2 } from './types';

export const BATTLE_DT = 1 / 60;
export const BATTLE_TIME_LIMIT = 300; // 秒
export const MAX_ATTEMPTS = 5;
const MOVE_REISSUE_TICKS = 60;
const MAX_REACTION_DELAY = 1.5; // 秒
/** 敵が残る間、ゴールの半径にこの余白を足した円の内側へは向かわない */
export const GOAL_KEEP_OUT_MARGIN = 20;
/** 敵が残るのに、ゴールの半径にこの余白を足した円の内側へ入りかけた味方には、60 tick を待たず move を出し直す */
export const GOAL_ALERT_MARGIN = 14;
/** 育てた場合の測定で、通しの各ステージに着いたときのセーブの全員に足すレベル */
export const GROWN_LEVEL_BOOST = 3;

export type BattleOutcome = {
  result: 'victory' | 'defeat' | 'timeout';
  seconds: number;
  deployed: number; // 出撃した人数（会話で加わった人も含む。最終）
  survivors: number; // 終了時に生きている味方の数
  enemiesLeft: number; // 終了時に生きている敵の数 + 湧き残りの数
  state: BattleState;
};

const alive = (u: Unit): boolean => !u.retired && u.hp > 0;

/**
 * ゴールの中心から radius + margin より内側の点を、中心からの向きを保ってその円周へ押し出す。
 * 外側の点はそのまま。中心と同じ点は真下（y を増やす向き）へ押し出す
 */
export function goalSafeDest(dest: Vec2, victory: VictoryCond, margin: number = GOAL_KEEP_OUT_MARGIN): Vec2 {
  const keep = victory.radius + margin;
  const dx = dest.x - victory.pos.x;
  const dy = dest.y - victory.pos.y;
  const d = Math.hypot(dx, dy);
  if (d >= keep) return dest;
  if (d === 0) return { x: victory.pos.x, y: victory.pos.y + keep };
  return { x: victory.pos.x + (dx / d) * keep, y: victory.pos.y + (dy / d) * keep };
}

/**
 * 目的地を、歩けるマスで、ゴールの立入禁止の円の外にある点にする。
 * goalSafeDest で押し出した先が歩けないマス（石など）だと、ゲームが最寄りの歩けるマスに置き換え、
 * それが円の中になることがある（s6 の石の列の裏）。歩けないときは、円の外の歩けるマスの中心のうち最も近いものにする。
 * 押し出した点が歩けるマスでも、そのマスの中心が円の中なら同じく寄せる（円の中のマスは経路の探索から外すので、
 * 目的地がそのマスだと道が見つからず、円を横切る目的地に戻ってしまう）
 */
export function walkableSafeDest(grid: Grid, dest: Vec2, victory: VictoryCond): Vec2 {
  const keep = victory.radius + GOAL_KEEP_OUT_MARGIN;
  const safe = goalSafeDest(dest, victory);
  if (isWalkableAt(grid, safe) && distance(cellCenter(grid, cellIndexAt(grid, safe)), victory.pos) >= keep) return safe;
  let best: Vec2 | null = null;
  let bestD = Infinity;
  for (let i = 0; i < grid.walkable.length; i++) {
    if (grid.walkable[i] !== true) continue;
    const c = cellCenter(grid, i);
    if (distance(c, victory.pos) < keep) continue;
    const d = distance(c, safe);
    if (d < bestD) { best = c; bestD = d; }
  }
  return best ?? safe;
}

const WAYPOINT_STEP = 8; // px
const WAYPOINT_LOOKAHEAD = 240; // px

type AvoidanceCache = { blocked: Grid; fields: Map<number, FlowField> };
// 戦闘ごとに地図の実体は作り直されるので、中身（大きさ・歩けるマス・速さ・ゴール）が同じなら使い回す
const avoidanceCaches = new Map<string, AvoidanceCache>();

/**
 * ゴールの円の中を歩けないことにした地図と、dest のマスへの最短の道。
 * 道の計算は重いので、地図ごと・ゴールごと・dest のマスごとに覚える（敵が動いても同じマスなら使い回す）
 */
function avoidanceField(grid: Grid, dest: Vec2, victory: VictoryCond): { blocked: Grid; field: FlowField } {
  const keep = victory.radius + GOAL_KEEP_OUT_MARGIN;
  const key = [
    grid.cols, grid.rows, grid.cell, victory.pos.x, victory.pos.y, keep,
    grid.walkable.map((w) => (w ? 1 : 0)).join(''), grid.speed.join(','),
  ].join('|');
  let cache = avoidanceCaches.get(key);
  if (!cache) {
    const walkable = grid.walkable.map((w, i) => {
      const c = cellCenter(grid, i);
      return w && distance(c, victory.pos) >= keep;
    });
    cache = { blocked: { ...grid, walkable }, fields: new Map() };
    avoidanceCaches.set(key, cache);
  }
  const cell = cellIndexAt(grid, dest);
  let field = cache.fields.get(cell);
  if (!field) { field = computeFlowField(cache.blocked, dest); cache.fields.set(cell, field); }
  return { blocked: cache.blocked, field };
}

/**
 * from から dest へ向かう途中でゴールの立入禁止の円（半径 + margin）に入らないための、次の目的地。
 * まっすぐ行けて円を通らなければ dest のまま。そうでなければ、円の中を歩けないことにした地図で
 * 最短の道を作り、その道をたどって「直進でき、円を通らない」いちばん先の点を返す（途中の点が取れなければ dest。
 * 道そのものが無いときは from）。
 * ステージによっては、敵のいる所への最短の道がゴールを横切る（s6 の上の通路など）ため。
 */
export function routeAvoidingGoal(grid: Grid, from: Vec2, dest: Vec2, victory: VictoryCond): Vec2 {
  const keep = victory.radius + GOAL_KEEP_OUT_MARGIN;
  const clearOf = (a: Vec2, b: Vec2): boolean => hasClearPath(grid, a, b) && distanceToSegment(victory.pos, a, b) >= keep;
  // すでに円の中にいる（壁沿いにすべるなどで入りかけた）なら、まず円の外へ出る
  if (distance(from, victory.pos) < keep) return walkableSafeDest(grid, from, victory);
  if (clearOf(from, dest)) return dest;
  const { blocked, field } = avoidanceField(grid, dest, victory);
  // 出発のマスそのものが円の中扱い（マスの中心が円の中）なら、道の探索の外にいる。まず円の外のマスへ出る
  const fromCell = cellIndexAt(grid, from);
  if (fromCell >= 0 && grid.walkable[fromCell] === true && blocked.walkable[fromCell] !== true) return walkableSafeDest(grid, from, victory);
  // 円を避けては dest へ行けない（道が見つからない）なら、円を横切る dest へは向かわず、その場に留まる
  if ((field.dist[fromCell] ?? -1) < 0) return from;
  let pos = from;
  let best: Vec2 | null = null;
  for (let walked = 0; walked < WAYPOINT_LOOKAHEAD; walked += WAYPOINT_STEP) {
    if (distance(pos, dest) <= WAYPOINT_STEP) { if (clearOf(from, dest)) best = dest; break; }
    const dir = flowDirection(blocked, field, pos);
    if (!dir) break;
    pos = { x: pos.x + dir.x * WAYPOINT_STEP, y: pos.y + dir.y * WAYPOINT_STEP };
    if (clearOf(from, pos)) best = pos;
  }
  return best ?? dest;
}

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

/** dest は move を出すときだけ呼ぶ（ゴールを避ける道の計算が重いため） */
type Target = { key: string; dest: () => Vec2 } | null;

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
    const toward = (dest: Vec2) => (): Vec2 => routeAvoidingGoal(
      state.grid, u.pos, walkableSafeDest(state.grid, dest, state.stage.victory), state.stage.victory,
    );
    if (visitor && u.uid === visitor.uid) return { key: 'village', dest: toward(village!) };
    const mine = pairs.find((p) => p.persuader.uid === u.uid);
    if (mine) return { key: mine.foe.uid, dest: toward({ ...mine.foe.pos }) };
    const foe = nearestOf(u.pos, normal) ?? nearestOf(u.pos, enemies);
    if (foe) return { key: foe.uid, dest: toward({ ...foe.pos }) };
    if (spawnsLeft) return null;
    return { key: 'goal', dest: () => ({ ...state.stage.victory.pos }) };
  };

  for (const u of state.units) {
    if (u.side !== 'player' || !alive(u)) continue;
    const t = state.time < (delays.get(u.uid) ?? 0) ? null : targetFor(u);
    // 交戦中に move を出すと交戦が解け、再び成立するたびに攻撃のクールダウンが振り出しに戻って攻撃できなくなる。
    // 交戦中は出さない（相手が倒れて交戦が解けたら、次の tick で新しい目標へ出す）
    if (t && u.engagedWith === null) {
      const mem = memory.get(u.uid);
      const v = state.stage.victory;
      const nearGoal = t.key !== 'goal' && distance(u.pos, v.pos) < v.radius + GOAL_ALERT_MARGIN;
      if (!mem || mem.key !== t.key || nearGoal || tick - mem.tick >= MOVE_REISSUE_TICKS) {
        cmds.push({ type: 'move', uid: u.uid, dest: t.dest() });
        memory.set(u.uid, { key: t.key, tick });
      }
    }
    if (u.skillId !== null && canUseSkill(state, u.uid)) {
      if (skillParam(state.reg, u.skillId, 'needsDest', 0) === 1) {
        const target = nearestOf(u.pos, enemies);
        if (target) {
          // 駆け抜ける・急降下などは目的地へ動くので、move と同じくゴールの円の外へ押し出す。
          // 途中で円を通る向きのときは出さない（敵が残ったままゴールに入って勝つのを防ぐ）
          const v = state.stage.victory;
          const dest = walkableSafeDest(state.grid, { ...target.pos }, v);
          if (distanceToSegment(v.pos, u.pos, dest) >= v.radius + GOAL_KEEP_OUT_MARGIN) {
            cmds.push({ type: 'skill', uid: u.uid, dest });
          }
        }
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
    if (!placeUnit(state, u.uid, spots[i]!)) {
      throw new Error(`開始位置に置けません: ${stage.id} ${u.defId} (${spots[i]!.x}, ${spots[i]!.y})`);
    }
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
  const spawnLeft = state.stage.spawners.reduce((a, sp, i) => a + Math.max(0, sp.total - (state.spawnCounts[i] ?? 0)), 0);
  return {
    result,
    seconds: state.time,
    deployed: finalPlayers.length,
    survivors: finalPlayers.filter(alive).length,
    enemiesLeft: state.units.filter((u) => u.side === 'enemy' && alive(u)).length + spawnLeft,
    state,
  };
}

export type StageRun = {
  stageId: string; firstTryWon: boolean; attempts: number; cleared: boolean; deployed: number; survivors: number;
  /** 育てた場合（そのステージに着いたときのセーブの全員を +GROWN_LEVEL_BOOST）の 1 回目で勝ったか */
  grownWon: boolean;
  /** 勝った試行の出撃した仲間の、クリア後のセーブでの平均レベル（勝てなかったときは 0） */
  avgLevel: number;
  /** 1 回目で勝ち、そのとき敵が残っていた（enemiesLeft > 0） */
  leftover: boolean;
};

/** 全員のレベルを by 上げ（上限 maxLevel）、経験値を 0 にしたセーブを返す。元は変えない */
export function boostLevels(save: SaveData, by: number, maxLevel: number): SaveData {
  const units: SaveData['units'] = {};
  for (const [id, p] of Object.entries(save.units)) {
    units[id] = { ...p, level: Math.min(maxLevel, p.level + by), xp: 0 };
  }
  return { ...save, units };
}

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
    let leftover = false;
    let avgLevel = 0;
    const grown = boostLevels(save, GROWN_LEVEL_BOOST, reg.growth.maxLevel);
    const grownWon = runBattle(reg, stage, grown, seed * 100 + 50).result === 'victory';
    while (attempts < MAX_ATTEMPTS) {
      last = runBattle(reg, stage, save, seed * 100 + attempts);
      attempts++;
      if (last.result === 'victory') {
        cleared = true;
        firstTryWon = attempts === 1;
        leftover = firstTryWon && last.enemiesLeft > 0;
        save = applyStageClear(reg, save, stage.id, last.state).save;
        const ids = last.state.units.filter((u) => u.side === 'player').map((u) => u.defId);
        avgLevel = ids.length === 0 ? 0 : ids.reduce((a, id) => a + (save.units[id]?.level ?? 1), 0) / ids.length;
        break;
      }
    }
    runs.push({
      stageId: stage.id, firstTryWon, attempts, cleared,
      deployed: last!.deployed, survivors: last!.survivors, grownWon, avgLevel, leftover,
    });
    if (!cleared) break;
  }
  return runs;
}

export type StageStat = {
  stageId: string; name: string; reached: number; firstTryRate: number; avgDeployed: number; avgSurvivors: number;
  /** 育てた場合の 1 回目の勝率（％） */
  grownRate: number;
  /** 勝った通しの、出撃した仲間のクリア後の平均レベル */
  avgLevel: number;
  /** 1 回目の勝ちのうち、敵が残っていた割合（％） */
  leftoverRate: number;
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
    const firstWins = reached.filter((x) => x.firstTryWon);
    return {
      stageId: stage.id,
      name: stage.name,
      reached: reached.length,
      firstTryRate: reached.length === 0 ? 0 : (reached.filter((x) => x.firstTryWon).length / reached.length) * 100,
      avgDeployed: mean(reached.map((x) => x.deployed)),
      avgSurvivors: mean(won.map((x) => x.survivors)),
      grownRate: reached.length === 0 ? 0 : (reached.filter((x) => x.grownWon).length / reached.length) * 100,
      avgLevel: mean(won.map((x) => x.avgLevel)),
      leftoverRate: firstWins.length === 0 ? 0 : (firstWins.filter((x) => x.leftover).length / firstWins.length) * 100,
    };
  });
}

/** 目標の 1 回目の勝率の帯（％、通し）。stageId → [下限, 上限] */
export const TARGET_BANDS: Record<string, [number, number]> = {
  stage1: [95, 100],
  stage2: [95, 100],
  stage3: [45, 70],
  stage4: [90, 100],
  stage5: [85, 100],
  stage6: [80, 100],
  stage7: [75, 95],
  stage8: [70, 90],
  stage9: [65, 85],
  stage10: [60, 80],
};

/** 育てた場合の目標の帯（％、全ステージ共通） */
export const GROWN_BAND: [number, number] = [80, 100];

const outside = (v: number, band: [number, number]): boolean => v < band[0] || v > band[1];

/** 通しが帯の外か（帯が決まっていないステージは外でない） */
export function isOutOfBandThrough(s: StageStat): boolean {
  const band = TARGET_BANDS[s.stageId];
  return band ? outside(s.firstTryRate, band) : false;
}

/** 育てた場合が帯の外か */
export function isOutOfBandGrown(s: StageStat): boolean {
  return outside(s.grownRate, GROWN_BAND);
}

/** 通しか育てたのどちらかが帯の外か */
export function isOutOfBand(s: StageStat): boolean {
  return isOutOfBandThrough(s) || isOutOfBandGrown(s);
}

export function formatTable(stats: StageStat[]): string {
  const lines = [
    '| ステージ | 名前 | 到達 | 1回目の勝率(%) | 目標(%) | 育てた(%) | 目標(育てた) | 出撃(平均) | 生き残り(平均) | 平均Lv | 敵が残った勝ち(%) | 判定 |',
    '|---|---|---|---|---|---|---|---|---|---|---|---|',
  ];
  for (const s of stats) {
    const band = TARGET_BANDS[s.stageId];
    const flags = [isOutOfBandThrough(s) ? '帯の外(通し)' : '', isOutOfBandGrown(s) ? '帯の外(育てた)' : ''].filter((x) => x);
    lines.push(
      `| ${s.stageId} | ${s.name} | ${s.reached} | ${s.firstTryRate.toFixed(1)} | ${band ? `${band[0]}〜${band[1]}` : '-'}`
      + ` | ${s.grownRate.toFixed(1)} | ${GROWN_BAND[0]}〜${GROWN_BAND[1]}`
      + ` | ${s.avgDeployed.toFixed(1)} | ${s.avgSurvivors.toFixed(1)} | ${s.avgLevel.toFixed(1)} | ${s.leftoverRate.toFixed(1)}`
      + ` | ${flags.join('・')} |`,
    );
  }
  return lines.join('\n');
}
