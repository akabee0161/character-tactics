import { describe, expect, it } from 'vitest';
import { awardXp, awardXpForEvents, xpForDefeat } from './growth';
import { xpToNext } from './progress';
import { beginBattle, createBattleState, statsForLevel } from './state';
import { testRegistry } from './testing';
import type { Registry } from '../engine/registry';
import type { BattleState, CharProgress, Unit } from './types';

function fresh(): BattleState {
  const reg = testRegistry();
  const progress: Record<string, { level: number; xp: number }> = {};
  for (const id of reg.units.keys()) progress[id] = { level: 1, xp: 0 };
  const s = createBattleState(reg, reg.stages[0]!, { units: progress, members: [], claimed: [] }, 1);
  beginBattle(s);
  return s;
}

function playerOf(s: BattleState, defId: string): Unit {
  return s.units.find((u) => u.side === 'player' && u.defId === defId)!;
}

describe('awardXp', () => {
  it('レベルが あがらない ぶんは xp に たまる', () => {
    const s = fresh();
    const u = playerOf(s, 'roran');
    const amount = xpToNext(1, s.reg.growth.xpPerLevel) - 1; // しきいちの1手前
    awardXp(s, u, amount);
    expect(u.level).toBe(1);
    expect(u.xp).toBe(amount);
  });

  it('しきいちを こえたら レベルが あがる', () => {
    const s = fresh();
    const u = playerOf(s, 'roran');
    awardXp(s, u, xpToNext(1, s.reg.growth.xpPerLevel));
    expect(u.level).toBe(2);
  });

  it('レベルアップで さいだい HP と こうげきりょくが あがる', () => {
    const s = fresh();
    const u = playerOf(s, 'roran');
    const def = s.reg.units.get('roran')!;
    awardXp(s, u, xpToNext(1, s.reg.growth.xpPerLevel));
    expect(u.maxHp).toBe(statsForLevel(def, 2).maxHp);
    expect(u.power).toBe(statsForLevel(def, 2).power);
  });

  it('レベルアップしても上乗せが残る', () => {
    const s = fresh();
    const u = playerOf(s, 'roran');
    const def = s.reg.units.get('roran')!;
    u.statBonus = { maxHp: 3, power: 1, guard: 2, speed: 0, resist: 0 };
    u.maxHp += 3; u.power += 1; u.guard += 2;
    awardXp(s, u, xpToNext(1, s.reg.growth.xpPerLevel));
    expect(u.level).toBe(2);
    expect(u.maxHp).toBe(statsForLevel(def, 2, u.statBonus).maxHp);
    expect(u.power).toBe(statsForLevel(def, 2, u.statBonus).power);
    expect(u.guard).toBe(def.guard + 2);
    expect(u.speed).toBe(def.speed);
  });

  it('ふえた さいだい HP の ぶんだけ いまの HP も ふえる', () => {
    const s = fresh();
    const u = playerOf(s, 'roran');
    const beforeMax = u.maxHp;
    u.hp = 10;
    awardXp(s, u, xpToNext(1, s.reg.growth.xpPerLevel));
    expect(u.hp).toBe(10 + (u.maxHp - beforeMax));
  });

  it('ぜんかいふくには しない', () => {
    const s = fresh();
    const u = playerOf(s, 'roran');
    u.hp = 1;
    awardXp(s, u, xpToNext(1, s.reg.growth.xpPerLevel));
    expect(u.hp).toBeLessThan(u.maxHp);
  });

  it('レベルアップの イベントが でる。上がる前と後の能力も のる', () => {
    const s = fresh();
    const u = playerOf(s, 'roran');
    awardXp(s, u, xpToNext(1, s.reg.growth.xpPerLevel));
    const ev = s.events.find((e) => e.type === 'levelUp')!;
    const def = s.reg.units.get('roran')!;
    expect(ev).toMatchObject({
      uid: u.uid, defId: 'roran', fromLevel: 1, level: 2,
      before: statsForLevel(def, 1), after: statsForLevel(def, 2),
    });
  });

  it('あがらなければ イベントは でない', () => {
    const s = fresh();
    awardXp(s, playerOf(s, 'roran'), 1);
    expect(s.events.filter((e) => e.type === 'levelUp')).toEqual([]);
  });

  it('1どに 2レベル あがったら イベントは さいしゅうレベルで 1けん', () => {
    const s = fresh();
    const u = playerOf(s, 'roran');
    awardXp(s, u, xpToNext(1, s.reg.growth.xpPerLevel) + xpToNext(2, s.reg.growth.xpPerLevel));
    expect(u.level).toBe(3);
    expect(s.events.filter((e) => e.type === 'levelUp')).toEqual([
      expect.objectContaining({ type: 'levelUp', uid: u.uid, defId: 'roran', fromLevel: 1, level: 3 }),
    ]);
  });

  it('さいだいレベルでは あがらない', () => {
    const s = fresh();
    const u = playerOf(s, 'roran');
    u.level = s.reg.growth.maxLevel;
    awardXp(s, u, 9999);
    expect(u.level).toBe(s.reg.growth.maxLevel);
    expect(s.events.filter((e) => e.type === 'levelUp')).toEqual([]);
  });

  it('たおれた ユニットには あげない', () => {
    const s = fresh();
    const u = playerOf(s, 'roran');
    u.retired = true;
    awardXp(s, u, 9999);
    expect(u.xp).toBe(0);
  });
});

describe('awardXpForEvents', () => {
  function battle() {
    const reg = testRegistry();
    const stage = reg.stages[0]!;
    const progress: Record<string, CharProgress> = {};
    for (const id of reg.units.keys()) progress[id] = { level: 1, xp: 0 };
    const state = createBattleState(reg, stage, { units: progress, members: [], claimed: [] }, 1);
    beginBattle(state);
    return state;
  }

  const player = (s: BattleState, defId: string) =>
    s.units.find((u) => u.side === 'player' && u.defId === defId)!;
  const enemy = (s: BattleState) => s.units.find((u) => u.side === 'enemy')!;

  it('命中で攻撃側に hitXp が入る', () => {
    const s = battle();
    const roran = player(s, 'roran');
    const before = roran.xp;
    s.events = [{
      type: 'hit', targetUid: enemy(s).uid, targetPos: { x: 0, y: 0 }, amount: 3,
      sourceUid: roran.uid, sourceDefId: 'roran', attackKind: 'melee',
      sourcePos: { x: 0, y: 0 }, neraiuchi: false,
    }];
    awardXpForEvents(s);
    expect(roran.xp).toBe(before + s.reg.growth.hitXp);
  });

  it('敵の命中では敵に経験値が入らない', () => {
    const s = battle();
    const e = enemy(s);
    s.events = [{
      type: 'hit', targetUid: player(s, 'roran').uid, targetPos: { x: 0, y: 0 }, amount: 3,
      sourceUid: e.uid, sourceDefId: e.defId, attackKind: 'melee',
      sourcePos: { x: 0, y: 0 }, neraiuchi: false,
    }];
    awardXpForEvents(s);
    expect(e.xp).toBe(0);
  });

  it('回復で術者に healXp が入る', () => {
    const s = battle();
    const mist = player(s, 'mist');
    s.events = [{
      type: 'heal', targetPos: { x: 0, y: 0 }, amount: 5,
      sourceUid: mist.uid, sourceDefId: 'mist', sourcePos: { x: 0, y: 0 },
    }];
    awardXpForEvents(s);
    expect(mist.xp).toBe(s.reg.growth.healXp);
  });

  it('撃破でとどめ役に全額、ダメージを与えた他の味方に半額が入る', () => {
    const s = battle();
    const roran = player(s, 'roran');
    const ines = player(s, 'ines');
    const e = enemy(s);
    const reward = s.reg.enemies.get(e.defId)!.xpReward;
    e.damagedBy = [roran.uid, ines.uid];
    s.events = [{
      type: 'unitDefeated', uid: e.uid, defId: e.defId, byUid: roran.uid, byDefId: 'roran',
      pos: { x: 0, y: 0 },
    }];
    awardXpForEvents(s);
    const assist = Math.floor(reward * s.reg.growth.assistRatio);
    // レベルが上がると xp が繰り越しで減るので、レベルと xp の両方から総量を見る
    expect(totalXp(s.reg, roran)).toBe(reward);
    expect(totalXp(s.reg, ines)).toBe(assist);
  });

  it('とどめ役はアシストぶんを二重取りしない', () => {
    const s = battle();
    const roran = player(s, 'roran');
    const e = enemy(s);
    const reward = s.reg.enemies.get(e.defId)!.xpReward;
    e.damagedBy = [roran.uid];
    s.events = [{
      type: 'unitDefeated', uid: e.uid, defId: e.defId, byUid: roran.uid, byDefId: 'roran',
      pos: { x: 0, y: 0 },
    }];
    awardXpForEvents(s);
    expect(totalXp(s.reg, roran)).toBe(reward);
  });
});

describe('撃破の経験値（敵のレベルで増える）', () => {
  it('xpForDefeat は xpReward + enemyLevelXp × (レベル − 1)', () => {
    const reg = testRegistry();
    const growth = { ...reg.growth, enemyLevelXp: 2 };
    const s = fresh();
    const e = s.units.find((u) => u.side === 'enemy')!;
    const base = reg.enemies.get(e.defId)!.xpReward;
    e.level = 5;
    expect(xpForDefeat({ ...reg, growth }, e)).toBe(base + 2 * 4);
    e.level = 1;
    expect(xpForDefeat({ ...reg, growth }, e)).toBe(base);
  });

  it('撃破でとどめ役に入る経験値は敵のレベルのぶん多い', () => {
    const s = fresh();
    s.reg = { ...s.reg, growth: { ...s.reg.growth, enemyLevelXp: 3 } };
    const roran = playerOf(s, 'roran');
    const e = s.units.find((u) => u.side === 'enemy')!;
    e.level = 4;
    const reward = s.reg.enemies.get(e.defId)!.xpReward + 3 * 3;
    s.events = [{
      type: 'unitDefeated', uid: e.uid, defId: e.defId, byUid: roran.uid, byDefId: 'roran',
      pos: { x: 0, y: 0 },
    }];
    awardXpForEvents(s);
    expect(totalXp(s.reg, roran)).toBe(reward);
  });
});

/** レベルアップで繰り越した経験値を足し戻し、累計で何 xp 入ったかを出す */
function totalXp(reg: Registry, unit: Unit): number {
  let total = unit.xp;
  for (let lv = 1; lv < unit.level; lv++) total += xpToNext(lv, reg.growth.xpPerLevel);
  return total;
}
