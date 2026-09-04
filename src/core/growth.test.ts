import { describe, expect, it } from 'vitest';
import { awardXp, awardXpForDefeats } from './growth';
import { MAX_LEVEL, xpToNext } from './progress';
import { beginBattle, createBattleState, statsForLevel } from './state';
import { testRegistry } from './testing';
import type { BattleState, Unit } from './types';

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
    awardXp(s, u, xpToNext(1));
    expect(u.level).toBe(2);
  });

  it('レベルアップで さいだい HP と こうげきりょくが あがる', () => {
    const s = fresh();
    const u = playerOf(s, 'roran');
    const def = s.reg.units.get('roran')!;
    awardXp(s, u, xpToNext(1));
    expect(u.maxHp).toBe(statsForLevel(def, 2).maxHp);
    expect(u.power).toBe(statsForLevel(def, 2).power);
  });

  it('ふえた さいだい HP の ぶんだけ いまの HP も ふえる', () => {
    const s = fresh();
    const u = playerOf(s, 'roran');
    const beforeMax = u.maxHp;
    u.hp = 10;
    awardXp(s, u, xpToNext(1));
    expect(u.hp).toBe(10 + (u.maxHp - beforeMax));
  });

  it('ぜんかいふくには しない', () => {
    const s = fresh();
    const u = playerOf(s, 'roran');
    u.hp = 1;
    awardXp(s, u, xpToNext(1));
    expect(u.hp).toBeLessThan(u.maxHp);
  });

  it('レベルアップの イベントが でる', () => {
    const s = fresh();
    const u = playerOf(s, 'roran');
    awardXp(s, u, xpToNext(1));
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
    awardXp(s, u, xpToNext(1) + xpToNext(2));
    expect(u.level).toBe(3);
    expect(s.events.filter((e) => e.type === 'levelUp')).toEqual([
      { type: 'levelUp', uid: u.uid, defId: 'roran', level: 3 },
    ]);
  });

  it('さいだいレベルでは あがらない', () => {
    const s = fresh();
    const u = playerOf(s, 'roran');
    u.level = MAX_LEVEL;
    awardXp(s, u, 9999);
    expect(u.level).toBe(MAX_LEVEL);
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

describe('awardXpForDefeats', () => {
  it('とどめを さした ユニットに xpReward を あげる', () => {
    const s = fresh();
    const u = playerOf(s, 'gau');
    const e = s.units.find((x) => x.side === 'enemy')!;
    const reward = s.reg.enemies.get(e.defId)!.xpReward;
    s.events = [{
      type: 'unitDefeated', uid: e.uid, defId: e.defId,
      byUid: u.uid, byDefId: u.defId, neraiuchi: false, pos: { x: 0, y: 0 },
    }];
    awardXpForDefeats(s);
    expect(u.xp).toBe(reward);
  });

  it('てがらが なければ だれにも あげない', () => {
    const s = fresh();
    const e = s.units.find((x) => x.side === 'enemy')!;
    s.events = [{
      type: 'unitDefeated', uid: e.uid, defId: e.defId,
      byUid: null, byDefId: null, neraiuchi: false, pos: { x: 0, y: 0 },
    }];
    awardXpForDefeats(s);
    expect(s.units.filter((u) => u.side === 'player').every((u) => u.xp === 0)).toBe(true);
  });

  it('てったい（unitFled）では けいけんちを あげない', () => {
    const s = fresh();
    const u = playerOf(s, 'gau');
    const e = s.units.find((x) => x.side === 'enemy')!;
    s.events = [{ type: 'unitFled', uid: e.uid, defId: e.defId, byUid: u.uid, byDefId: u.defId }];
    awardXpForDefeats(s);
    expect(u.xp).toBe(0);
  });

  it('おなじ tick に 2たい たおしたら 2たいぶん', () => {
    const s = fresh();
    const u = playerOf(s, 'gau');
    const [a, b] = s.units.filter((x) => x.side === 'enemy');
    const total =
      s.reg.enemies.get(a!.defId)!.xpReward + s.reg.enemies.get(b!.defId)!.xpReward;
    s.events = [
      { type: 'unitDefeated', uid: a!.uid, defId: a!.defId, byUid: u.uid, byDefId: u.defId, neraiuchi: false, pos: { x: 0, y: 0 } },
      { type: 'unitDefeated', uid: b!.uid, defId: b!.defId, byUid: u.uid, byDefId: u.defId, neraiuchi: false, pos: { x: 0, y: 0 } },
    ];
    awardXpForDefeats(s);
    expect(u.xp).toBe(total);
  });
});
