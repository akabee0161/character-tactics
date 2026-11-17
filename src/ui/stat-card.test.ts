import { describe, expect, it } from 'vitest';
import {
  allyCardFromSave, barRatio, cardFromGain, cardFromUnit, enemyCard, stageEnemies, statGains, statLabel,
} from './stat-card';
import { statsForLevel } from '../core/state';
import { beginBattle, createBattleState } from '../core/state';
import { testRegistry } from '../core/testing';
import { newSave } from '../save/save';
import { ENEMY_LIST_CLOSE_BTN, ENEMY_LIST_MAX_ROWS, enemyListRow } from './layout';
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

describe('敵のカード', () => {
  it('盾持ちのカードに矢の上限の特徴が出る', () => {
    const reg = testRegistry();
    const c = enemyCard(reg, 'tatemochi', 1, 1);
    expect(c.traits).toEqual(['盾: 矢の ダメージは 1 まで']);
    expect(c.level).toBe(1);
    expect(c.count).toBe(1);
    expect(c.stats).toEqual(statsForLevel(reg.enemies.get('tatemochi')!, 1));
  });

  it('敵のカードはレベルを持ち、そのレベルの能力', () => {
    const reg = testRegistry();
    const card = enemyCard(reg, 'majinaishi', 7, 5);
    expect(card.level).toBe(5);
    expect(card.count).toBe(7);
    expect(card.stats).toEqual(statsForLevel(reg.enemies.get('majinaishi')!, 5));
  });
});

describe('statLabel（魔法のユニットは攻撃力を「魔力」と呼ぶ）', () => {
  it('魔法の仲間と敵は power を「魔力」と呼ぶ', () => {
    expect(statLabel('power', 'magic')).toBe('魔力');
    expect(statLabel('power', 'melee')).toBe('攻撃力');
    expect(statLabel('power', 'bow')).toBe('攻撃力');
    expect(statLabel('guard', 'magic')).toBe('守備');
    expect(statLabel('maxHp', 'magic')).toBe('HP');
  });

  it('カードの attack が魔法なら、仲間にも敵にも当てはまる（ミスト・まじない師）', () => {
    const reg = testRegistry();
    expect(allyCardFromSave(reg, newSave(reg), 'mist').attack).toBe('magic');
    expect(enemyCard(reg, 'majinaishi', 1, 1).attack).toBe('magic');
  });
});

describe('仲間のカード: 技の一言', () => {
  it('ミストのカードの技の一言は、そのレベルの魔力を足した回復量', () => {
    const reg = testRegistry();
    const save = newSave(reg);
    save.units.mist = { level: 10, xp: 0 };
    const c = allyCardFromSave(reg, save, 'mist');
    const heal = reg.skills.get('omajinai')!.params.heal! + c.stats.power;
    expect(c.skill!.summary).toContain(`HPを ${heal} 回復`);
  });
});

describe('仲間のカード', () => {
  it('セーブのレベルと加算から仲間のカードの値を出す', () => {
    const reg = testRegistry();
    const save = newSave(reg);
    save.units.roran = { level: 7, xp: 0, bonus: { maxHp: 0, power: 0, guard: 1, speed: 0, resist: 0 } };
    const c = allyCardFromSave(reg, save, 'roran');
    expect(c.level).toBe(7);
    expect(c.count).toBeNull();
    expect(c.stats).toEqual(
      statsForLevel(reg.units.get('roran')!, 7, { maxHp: 0, power: 0, guard: 1, speed: 0, resist: 0 }),
    );
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
    expect(cardFromUnit(reg, enemy, 3)).toMatchObject({ level: enemy.level, count: 3 });
  });
});

describe('配置の場面の敵のカード', () => {
  it('敵のカードもそのユニットのレベルを持つ', () => {
    const reg = testRegistry();
    const stage = { ...reg.stages.find((s) => s.enemies.length > 0)!, enemyLevel: 6 };
    const state = createBattleState(reg, stage, newSave(reg), 1);
    const enemy = state.units.find((u) => u.side === 'enemy')!;
    expect(cardFromUnit(reg, enemy, 1).level).toBe(6);
  });
});

describe('レベルアップのカード', () => {
  it('上がる前と後を持つ', () => {
    const reg = testRegistry();
    const c = cardFromGain(reg, {
      id: 'roran', before: { level: 3, xp: 0 }, after: { level: 4, xp: 1 }, leveledUp: true, joined: false,
    });
    expect(c.level).toBe(4);
    const def = reg.units.get('roran')!;
    expect(c.before).toEqual({ level: 3, stats: statsForLevel(def, 3) });
    expect(c.stats).toEqual(statsForLevel(def, 4));
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

describe('ダメージが減る守りの案内（note）', () => {
  it('通常の近接は守備で減ると案内する', () => {
    expect(enemyCard(testRegistry(), 'tatemochi', 1, 1).note).toBe('相手の 守備で 減る');
  });

  it('斧（守備を無視）のカードは、守備で減るとは案内しない', () => {
    const reg = testRegistry();
    const save = newSave(reg);
    const c = allyCardFromSave(reg, save, 'ally09');
    expect(c.traits.some((t) => t.startsWith('斧'))).toBe(true);
    expect(c.note).toBe('相手の 守備に 関係なく 減る');
  });

  it('魔法は魔法防御で減ると案内する', () => {
    const reg = testRegistry();
    expect(allyCardFromSave(reg, newSave(reg), 'mist').note).toBe('相手の 魔法防御で 減る');
  });
});

describe('敵の一覧の行数の上限', () => {
  it('どのステージも敵の種類は一覧の行に収まる', () => {
    const reg = testRegistry();
    for (const s of reg.stages) {
      expect(stageEnemies(reg, s).length, s.id).toBeLessThanOrEqual(ENEMY_LIST_MAX_ROWS);
    }
  });
  it('上限は、最後の行の下端が「閉じる」に届かない最大の行数', () => {
    const bottom = (i: number) => enemyListRow(i).y + enemyListRow(i).h;
    expect(bottom(ENEMY_LIST_MAX_ROWS - 1)).toBeLessThanOrEqual(ENEMY_LIST_CLOSE_BTN.y);
    expect(bottom(ENEMY_LIST_MAX_ROWS)).toBeGreaterThan(ENEMY_LIST_CLOSE_BTN.y);
  });
});
