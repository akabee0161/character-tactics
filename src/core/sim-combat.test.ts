import { describe, expect, it } from 'vitest';
import { step } from './sim';
import { applyXp } from './progress';
import { beginBattle, createBattleState } from './state';
import { testRegistry } from './testing';
import type { StageDef, Unit } from './types';
import type { BattleState, CharProgress, Vec2 } from './types';

// units のうち敵側に常時1体だけ入れておく。ゴールから遠く離れた位置に置いて
// 自然には撃破されない状態にしておく
const STAGE: StageDef = {
  id: 'teststage', order: 10, name: 'テスト', cell: 32,
  mapRows: ['..........', '..........', '..........'],
  placement: { minY: 0, starts: [{ x: 16, y: 16 }] },
  roster: ['roran', 'ines', 'mist', 'gau'],
  enemies: [{ defId: 'narazumono', pos: { x: 304, y: 16 }, ai: { kind: 'aggressive' } }],
  spawners: [],
  victory: { type: 'reach', pos: { x: 304, y: 16 }, radius: 40, by: 'any' },
  defeat: [{ type: 'unitLost', defIds: ['roran'] }],
};

const LV1: Record<string, CharProgress> = {
  roran: { level: 1, xp: 0 }, ines: { level: 1, xp: 0 },
  mist: { level: 1, xp: 0 }, gau: { level: 1, xp: 0 },
};

function fresh(stage: StageDef = STAGE): BattleState {
  const s = createBattleState(testRegistry(), stage, LV1, 42);
  beginBattle(s);
  for (const u of s.units) if (u.side === 'player') u.pos = { x: 16, y: 300 }; // マップ外の遠くへ退避
  return s;
}

function unitOf(s: BattleState, defId: string): Unit {
  const u = s.units.find((x) => x.defId === defId && x.side === 'player');
  if (!u) throw new Error(`いない: ${defId}`);
  return u;
}

function spawnEnemy(s: BattleState, defId: string, pos: Vec2, hp?: number): Unit {
  const def = s.reg.enemies.get(defId)!;
  const uid = `t${s.nextEnemyUid++}`;
  const u: Unit = {
    uid, defId, side: 'enemy', controller: 'ai', combat: def.combat,
    pos: { ...pos }, hp: hp ?? def.maxHp, maxHp: def.maxHp, power: def.power, guard: def.guard,
    attack: def.attack, range: def.range, attackInterval: def.attackInterval, speed: def.speed,
    bowDamageCap: def.bowDamageCap, skillId: def.skillId,
    level: 1, xp: 0,
    goalPos: null, goalField: null, engagedWith: null, attackCooldown: 0, retired: false,
    ai: { def: { kind: 'aggressive' }, mode: 'idle', targetUid: null, home: { ...pos }, spottedAt: null },
    skillCooldownUntil: 0, funbaruUntil: -1, neraiuchiArmed: false, pinchShown: false,
    seenDefIds: [], lastHitBy: null, lastHitNeraiuchi: false, damagedBy: [],
  };
  s.units.push(u);
  return u;
}

/** 交戦させて 1 回攻撃が入るところまで進める */
function engageAndAttack(s: BattleState, dt = 1.7): void {
  step(s, [], 0.01);
  step(s, [], dt);
}

/**
 * 飛翔体（弓・魔法）は発射と着弾が別 tick になったため、大きな dt を 1 回渡すだけでは
 * 着弾まで進まないことがある。1/60 刻みで積み上げて同じ経過時間を再現する
 */
function advanceFine(s: BattleState, totalDt: number): void {
  let remaining = totalDt;
  const step60 = 1 / 60;
  while (remaining > 1e-9) {
    const dt = Math.min(step60, remaining);
    step(s, [], dt);
    remaining -= dt;
  }
}

describe('攻撃の解決', () => {
  it('攻撃間隔ごとに 1 回ダメージが入る', () => {
    const s = fresh();
    unitOf(s, 'roran').pos = { x: 16, y: 16 };
    const e = spawnEnemy(s, 'narazumono', { x: 30, y: 16 });
    step(s, [], 0.01);
    expect(e.hp).toBe(12);      // 交戦成立の直後はまだ攻撃していない
    step(s, [], 1.7);
    expect(e.hp).toBe(12 - 5);  // ロラン 力6 - 守り1
  });

  it('攻撃間隔が来るまでは追加ダメージが入らない', () => {
    const s = fresh();
    unitOf(s, 'roran').pos = { x: 16, y: 16 };
    const e = spawnEnemy(s, 'narazumono', { x: 30, y: 16 });
    step(s, [], 0.01);
    step(s, [], 1.7);
    step(s, [], 0.5);
    expect(e.hp).toBe(7);
  });

  it('なかよし支援が乗り、bondSupport イベントが出る', () => {
    const s = fresh();
    const roran = unitOf(s, 'roran');
    roran.pos = { x: 16, y: 16 };
    // イネスの弓レンジ(160)の外、なかよしレンジ(200)の内に置き、
    // イネス自身が交戦を横取りせず支援だけする状況にする
    const ines = unitOf(s, 'ines');
    ines.pos = { x: 200, y: 16 };
    const e = spawnEnemy(s, 'narazumono', { x: 30, y: 16 });
    step(s, [], 0.01);
    step(s, [], 1.7);
    expect(e.hp).toBe(12 - 7); // (6+2)-1
    expect(s.events).toContainEqual({
      type: 'bondSupport', targetUid: roran.uid, targetDefId: 'roran', supporterUids: [ines.uid],
      pos: roran.pos,
    });
    expect(s.counters['bond:supports']).toBe(1);
  });

  it('イネスはたてもちに 1 しか通らない', () => {
    const s = fresh();
    unitOf(s, 'ines').pos = { x: 16, y: 16 };
    const e = spawnEnemy(s, 'tatemochi', { x: 100, y: 16 });
    step(s, [], 0.01);
    advanceFine(s, 2.3);
    expect(e.hp).toBe(19);
  });

  it('ねらいうちならたてもちにも通る', () => {
    const s = fresh();
    const ines = unitOf(s, 'ines');
    ines.pos = { x: 16, y: 16 };
    const e = spawnEnemy(s, 'tatemochi', { x: 100, y: 16 });
    step(s, [{ type: 'skill', uid: ines.uid }], 0.01);
    advanceFine(s, 2.3);
    expect(e.hp).toBe(20 - 10); // (8-3)*2
    expect(unitOf(s, 'ines').neraiuchiArmed).toBe(false);
  });

  it('イネスは密着されると攻撃間隔が倍になる', () => {
    const s = fresh();
    unitOf(s, 'ines').pos = { x: 16, y: 16 };
    const e = spawnEnemy(s, 'narazumono', { x: 32, y: 16 });
    step(s, [], 0.01);
    advanceFine(s, 2.3);
    expect(e.hp).toBe(12); // まだ撃てない
    advanceFine(s, 2.2);
    expect(e.hp).toBe(12 - 7);
  });

  it('敵の攻撃で味方の HP が減る', () => {
    const s = fresh();
    unitOf(s, 'roran').pos = { x: 16, y: 16 };
    spawnEnemy(s, 'garum', { x: 30, y: 16 });
    engageAndAttack(s, 1.5);
    expect(unitOf(s, 'roran').hp).toBe(30 - 4); // 9 - 5
  });

  it('ふんばり中はダメージが半分になる', () => {
    const s = fresh();
    const roran = unitOf(s, 'roran');
    roran.pos = { x: 16, y: 16 };
    spawnEnemy(s, 'garum', { x: 30, y: 16 });
    step(s, [{ type: 'skill', uid: roran.uid }], 0.01);
    step(s, [], 1.5);
    expect(unitOf(s, 'roran').hp).toBe(30 - 2);
  });
});

describe('ピンチ', () => {
  it('HP が 30% を切った瞬間に 1 回だけ pinch イベントが出る', () => {
    const s = fresh();
    const roran = unitOf(s, 'roran');
    roran.pos = { x: 16, y: 16 };
    roran.hp = 11;
    spawnEnemy(s, 'garum', { x: 30, y: 16 });
    engageAndAttack(s, 1.5);
    expect(unitOf(s, 'roran').hp).toBe(7);
    expect(s.events).toContainEqual({ type: 'pinch', uid: roran.uid, defId: 'roran' });
    step(s, [], 1.5);
    expect(s.events.filter((e) => e.type === 'pinch')).toHaveLength(0);
  });
});

describe('撃破と撤退', () => {
  it('敵を倒すと消え、unitDefeated が出て とどめを さした ユニットに けいけんちが はいる', () => {
    const s = fresh();
    const roran = unitOf(s, 'roran');
    roran.pos = { x: 16, y: 16 };
    const e = spawnEnemy(s, 'narazumono', { x: 30, y: 16 }, 3);
    engageAndAttack(s, 1.7);
    expect(e.retired).toBe(true);
    expect(s.events).toContainEqual({
      type: 'unitDefeated', uid: e.uid, defId: 'narazumono', byUid: roran.uid, byDefId: 'roran', neraiuchi: false,
      pos: e.pos,
    });
    // とどめの一撃も hit イベントとして hitXp が入るので、撃破報酬に上乗せされる。
    // xpPerLevel が小さいとこの合計だけでレベルが上がり xp が繰り越されるので、
    // 生の合計ではなく applyXp を通した値と比べる
    const gained = s.reg.enemies.get('narazumono')!.xpReward + s.reg.growth.hitXp;
    const expected = applyXp({ level: 1, xp: 0 }, gained, s.reg.growth);
    expect({ level: roran.level, xp: roran.xp }).toEqual(expected);
  });

  it('ねらいうちで倒すと kill:neraiuchi が増える', () => {
    const s = fresh();
    const ines = unitOf(s, 'ines');
    ines.pos = { x: 16, y: 16 };
    spawnEnemy(s, 'narazumono', { x: 100, y: 16 }, 5);
    step(s, [{ type: 'skill', uid: ines.uid }], 0.01);
    advanceFine(s, 2.3);
    expect(s.counters['kill:neraiuchi']).toBe(1);
  });

  it('かけぬけるで倒すと unitDefeated イベントに byDefId が入り、けいけんちが はいる', () => {
    const s = fresh();
    const gau = unitOf(s, 'gau');
    gau.pos = { x: 16, y: 16 };
    const e = spawnEnemy(s, 'narazumono', { x: 100, y: 16 }, 3);
    step(s, [{ type: 'skill', uid: gau.uid, dest: { x: 200, y: 16 } }], 0.01);
    expect(e.retired).toBe(true);
    expect(s.events).toContainEqual({
      type: 'unitDefeated', uid: e.uid, defId: 'narazumono', byUid: gau.uid, byDefId: 'gau', neraiuchi: false,
      pos: e.pos,
    });
    // とどめの一撃も hit イベントとして hitXp が入るので、撃破報酬に上乗せされる。
    // xpPerLevel が小さいとこの合計だけでレベルが上がり xp が繰り越されるので、
    // 生の合計ではなく applyXp を通した値と比べる
    const gained = s.reg.enemies.get('narazumono')!.xpReward + s.reg.growth.hitXp;
    const expected = applyXp({ level: 1, xp: 0 }, gained, s.reg.growth);
    expect({ level: gau.level, xp: gau.xp }).toEqual(expected);
  });

  it('ガルムは 30% を切ると撤退し unitFled が出る', () => {
    const s = fresh();
    const roran = unitOf(s, 'roran');
    roran.pos = { x: 16, y: 16 };
    const e = spawnEnemy(s, 'garum', { x: 30, y: 16 }, 12);
    engageAndAttack(s, 1.7);
    expect(e.retired).toBe(true);
    expect(s.events).toContainEqual({
      type: 'unitFled', uid: e.uid, defId: 'garum', byUid: roran.uid, byDefId: 'roran',
    });
    // 撃破報酬は入らないが、撤退までに当てた一撃ぶんの hitXp は入る
    expect(roran.xp).toBe(s.reg.growth.hitXp);
  });

  it('味方は HP 0 でたいきゃくし、交戦が解除される', () => {
    const s = fresh();
    const roran = unitOf(s, 'roran');
    roran.pos = { x: 16, y: 16 };
    roran.hp = 2;
    const e = spawnEnemy(s, 'garum', { x: 30, y: 16 });
    engageAndAttack(s, 1.5);
    expect(unitOf(s, 'roran').retired).toBe(true);
    expect(unitOf(s, 'roran').hp).toBe(0);
    expect(unitOf(s, 'roran').engagedWith).toBeNull();
    expect(e.engagedWith).toBeNull();
    expect(s.events).toContainEqual({ type: 'unitRetired', uid: roran.uid, defId: 'roran' });
  });
});

describe('ひしょうたい', () => {
  it('ゆみの こうげきは うった tick では ダメージに ならない', () => {
    const s = fresh();
    const ines = unitOf(s, 'ines');
    ines.pos = { x: 16, y: 16 };
    const enemy = spawnEnemy(s, 'narazumono', { x: 120, y: 16 });
    const hp = enemy.hp;

    // 攻撃間隔があくまで回す
    for (let i = 0; i < 200; i++) {
      step(s, [], 1 / 60);
      if (s.projectiles.length > 0) break;
    }
    expect(s.projectiles.length).toBeGreaterThan(0);
    expect(enemy.hp).toBe(hp);
  });

  it('ちかくで うっても うった tick では ダメージに ならない(はっしゃと ちゃくだんは べつの tick)', () => {
    const s = fresh();
    const ines = unitOf(s, 'ines');
    ines.pos = { x: 16, y: 16 };
    // 弓の1tick分の移動距離(480 * 1/60 = 8px)より近い距離
    const enemy = spawnEnemy(s, 'narazumono', { x: 20, y: 16 });
    const hp = enemy.hp;

    // 密着(距離4px < MELEE_RANGE)分の攻撃間隔倍増(2.2秒 -> 4.4秒)を待つ
    let firedAt = -1;
    for (let i = 0; i < 400; i++) {
      step(s, [], 1 / 60);
      if (s.projectiles.length > 0) { firedAt = i; break; }
    }
    expect(firedAt).toBeGreaterThanOrEqual(0);
    // 発射したその tick では着弾せず、ダメージもまだ入らない
    expect(s.projectiles.length).toBeGreaterThan(0);
    expect(enemy.hp).toBe(hp);

    // 次の tick で着弾する
    step(s, [], 1 / 60);
    expect(s.projectiles.length).toBe(0);
    expect(enemy.hp).toBeLessThan(hp);
  });

  it('ちゃくだんで しんだ ユニットは おなじ tick で はんげきしない', () => {
    const s = fresh();
    const ines = unitOf(s, 'ines');
    ines.pos = { x: 16, y: 16 };
    const enemy = spawnEnemy(s, 'narazumono', { x: 20, y: 16 }, 1); // hp=1, 距離4px
    step(s, [], 0.01); // 交戦成立

    ines.attackCooldown = 0;
    enemy.attackCooldown = 999; // まだ攻撃させない
    const inesHpBefore = ines.hp;

    step(s, [], 1 / 60); // 発射 tick
    expect(s.projectiles.length).toBe(1);
    expect(enemy.hp).toBe(1); // まだ着弾していない

    enemy.attackCooldown = 0; // 次の tick で反撃準備完了
    step(s, [], 1 / 60); // 着弾 tick
    expect(enemy.hp).toBeLessThanOrEqual(0);
    // 死んだユニットに反撃されていない(反撃されれば減るはず)。
    // このヒットで得た経験値によりレベルアップし現在HPが増えることがあるので、
    // 「減っていない」で判定する(反撃を受けていれば下回る)
    expect(ines.hp).toBeGreaterThanOrEqual(inesHpBefore);
  });

  it('どうじ tick に たおれた みかたは しえんしゃに ならない', () => {
    const s = fresh();
    const roran = unitOf(s, 'roran');
    roran.pos = { x: 16, y: 16 };
    // イネスの弓レンジ(160)の外、なかよしレンジ(200)の内に置き、支援だけする状況にする
    const ines = unitOf(s, 'ines');
    ines.pos = { x: 200, y: 16 };
    const e = spawnEnemy(s, 'narazumono', { x: 30, y: 16 });
    step(s, [], 0.01);
    // ここでイネスが同じ tick に倒れた想定(まだ retired=false)
    ines.hp = 0;
    step(s, [], 1.7);
    expect(e.hp).toBe(12 - 5); // 支援ボーナス抜きのロラン単独(6-1)
    expect(s.events.some((ev) => ev.type === 'bondSupport')).toBe(false);
  });
});

describe('attack イベント', () => {
  it('きんせつの こうげきの たびに でる', () => {
    const s = fresh();
    const roran = unitOf(s, 'roran');
    roran.pos = { x: 100, y: 100 };
    spawnEnemy(s, 'narazumono', { x: 110, y: 100 });
    engageAndAttack(s);

    // 敵も同じ tick で攻撃するので、uid で絞る
    const attacks = s.events.filter((e) => e.type === 'attack' && e.uid === roran.uid);
    expect(attacks.length).toBe(1);
    const ev = attacks[0]!;
    if (ev.type !== 'attack') return;
    expect(ev.uid).toBe(roran.uid);
    expect(ev.defId).toBe('roran');
    // 敵は右にいるので、向きは右向きになる
    expect(ev.targetPos.x).toBeGreaterThan(ev.pos.x);
  });

  it('とおくの てきに うつ ゆみでも でる', () => {
    const s = fresh();
    const ines = unitOf(s, 'ines');
    ines.pos = { x: 100, y: 100 };
    spawnEnemy(s, 'narazumono', { x: 200, y: 100 });
    engageAndAttack(s, 2.4);

    expect(s.events.some((e) => e.type === 'attack' && e.uid === ines.uid)).toBe(true);
  });
});

