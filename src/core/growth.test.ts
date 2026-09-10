import { describe, expect, it } from 'vitest';
import { awardXp, awardXpForEvents } from './growth';
import { xpToNext } from './progress';
import { beginBattle, createBattleState, statsForLevel } from './state';
import { testRegistry } from './testing';
import type { Registry } from '../engine/registry';
import type { BattleState, CharProgress, Unit } from './types';

function fresh(): BattleState {
  const reg = testRegistry();
  const progress: Record<string, { level: number; xp: number }> = {};
  for (const id of reg.units.keys()) progress[id] = { level: 1, xp: 0 };
  const s = createBattleState(reg, reg.stages[0]!, progress, 1);
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
    awardXp(s, u, 5);
    expect(u.level).toBe(1);
    expect(u.xp).toBe(5);
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
    expect(u.maxHp).toBe(statsForLevel(def, 2, s.reg.growth).maxHp);
    expect(u.power).toBe(statsForLevel(def, 2, s.reg.growth).power);
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

  it('レベルアップの イベントが でる', () => {
    const s = fresh();
    const u = playerOf(s, 'roran');
    awardXp(s, u, xpToNext(1, s.reg.growth.xpPerLevel));
    expect(s.events).toContainEqual({ type: 'levelUp', uid: u.uid, defId: 'roran', level: 2 });
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
      { type: 'levelUp', uid: u.uid, defId: 'roran', level: 3 },
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
    const state = createBattleState(reg, stage, progress, 1);
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
      neraiuchi: false, pos: { x: 0, y: 0 },
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
      neraiuchi: false, pos: { x: 0, y: 0 },
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
