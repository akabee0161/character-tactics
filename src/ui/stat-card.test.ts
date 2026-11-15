import { describe, expect, it } from 'vitest';
import {
  allyCardFromSave, barRatio, cardFromGain, cardFromUnit, enemyCard, stageEnemies, statGains,
} from './stat-card';
import { beginBattle, createBattleState } from '../core/state';
import { testRegistry } from '../core/testing';
import { newSave } from '../save/save';
import type { CharProgress } from '../core/types';

describe('stageEnemies', () => {
  it('魔導士の塔の敵は名前ごとにまとまる', () => {
    const reg = testRegistry();
    const stage = reg.stages.find((s) => s.name === '魔導士の塔')!;
    const foe = reg.enemies.get('ally06-foe')!.name; // 説得できる敵（セラ）
    expect(stageEnemies(reg, stage).map((e) => [e.name, e.count])).toEqual(
      [['ならず者', 6], ['盾持ち', 1], ['まじない師', 7], ['弓兵', 2], [foe, 1]],
    );
  });

  it('湧き口の敵は total 体で数える（石切り場のならず者は配置 6 + 湧き口 3）', () => {
    const reg = testRegistry();
    const stage = reg.stages.find((s) => s.name === '石切り場')!;
    expect(stageEnemies(reg, stage).find((e) => e.name === 'ならず者')!.count).toBe(9);
  });
});

describe('敵の札', () => {
  it('盾持ちの札に矢の上限の特徴が出る', () => {
    const c = enemyCard(testRegistry(), 'tatemochi', 1);
    expect(c.traits).toEqual(['盾: 矢の ダメージは 1 まで']);
    expect(c.level).toBeNull();
    expect(c.count).toBe(1);
    expect(c.stats).toEqual({ maxHp: 20, power: 12, guard: 3, resist: 0, speed: 26 });
  });
});

describe('仲間の札', () => {
  it('セーブのレベルと加算から仲間の札の値を出す', () => {
    const reg = testRegistry();
    const save = newSave(reg);
    save.units.roran = { level: 7, xp: 0, bonus: { maxHp: 0, power: 0, guard: 1, speed: 0, resist: 0 } };
    const c = allyCardFromSave(reg, save, 'roran');
    expect(c.level).toBe(7);
    expect(c.count).toBeNull();
    expect(c.stats).toEqual({ maxHp: 36, power: 8, guard: 6, resist: 2, speed: 60 });
    expect(c.skill).toEqual({ label: '踏ん張る', summary: '5秒の あいだ、受ける ダメージが 半分' });
    expect(c.before).toBeNull();
  });

  it('戦闘中のユニットは今の値で出す', () => {
    const reg = testRegistry();
    const progress: Record<string, CharProgress> = {};
    for (const id of reg.units.keys()) progress[id] = { level: 1, xp: 0 };
    const state = createBattleState(reg, reg.stages[0]!, { units: progress, members: [], claimed: [] }, 1);
    beginBattle(state);
    const roran = state.units.find((u) => u.side === 'player' && u.defId === 'roran')!;
    roran.guard += 2;
    const c = cardFromUnit(reg, roran, null);
    expect(c.level).toBe(1);
    expect(c.stats.guard).toBe(7);
    const enemy = state.units.find((u) => u.side === 'enemy')!;
    expect(cardFromUnit(reg, enemy, 3)).toMatchObject({ level: null, count: 3 });
  });
});

describe('レベルアップの札', () => {
  it('上がる前と後を持つ', () => {
    const reg = testRegistry();
    const c = cardFromGain(reg, {
      id: 'roran', before: { level: 3, xp: 0 }, after: { level: 4, xp: 1 }, leveledUp: true, joined: false,
    });
    expect(c.level).toBe(4);
    expect(c.before).toEqual({ level: 3, stats: { maxHp: 32, power: 6, guard: 5, resist: 2, speed: 60 } });
    expect(c.stats).toEqual({ maxHp: 33, power: 7, guard: 5, resist: 2, speed: 60 });
  });

  it('上がった能力だけを順に返す', () => {
    const a = { maxHp: 30, power: 6, guard: 5, resist: 2, speed: 60 };
    expect(statGains(a, { ...a, maxHp: 31, power: 7 })).toEqual([{ key: 'maxHp', delta: 1 }, { key: 'power', delta: 1 }]);
  });
});

describe('barRatio', () => {
  it('棒は上限で止まる', () => {
    expect(barRatio('maxHp', 80)).toBe(1);
    expect(barRatio('guard', 4)).toBe(0.5);
    expect(barRatio('guard', -1)).toBe(0);
  });
});
