import { describe, expect, it } from 'vitest';
import { ORTHO_COST } from './field';
import { createBattleState, placeAlly, startWave, statsForLevel } from './state';
import { testRegistry } from './testing';
import { FORT_MAX_HP } from './types';
import type { CharProgress, StageDef } from './types';

const STAGE: StageDef = {
  id: 1,
  name: 'テストの しま',
  cell: 32,
  mapRows: ['.....', '.....', '.....'],
  fort: { x: 16, y: 16 },
  landings: [{ x: 144, y: 16 }],
  garumFlees: true,
  waves: [
    { spawns: [{ at: 0, kind: 'narazumono', from: { x: 144, y: 16 } }] },
    { spawns: [{ at: 1, kind: 'narazumono', from: { x: 144, y: 16 } }] },
  ],
};

const PROGRESS: Record<string, CharProgress> = {
  roran: { level: 1, xp: 0 },
  ines: { level: 1, xp: 0 },
  mist: { level: 1, xp: 0 },
  gau: { level: 1, xp: 0 },
};

describe('statsForLevel', () => {
  it('レベル1 は基礎値どおり', () => {
    const reg = testRegistry();
    expect(statsForLevel(reg.units.get('roran')!, 1)).toEqual({ maxHp: 30, power: 6 });
  });

  it('レベルが上がると HP+3 / ちから+1', () => {
    const reg = testRegistry();
    expect(statsForLevel(reg.units.get('roran')!, 3)).toEqual({ maxHp: 36, power: 8 });
  });
});

describe('createBattleState', () => {
  it('4人ぶんのユニットが作られる', () => {
    const reg = testRegistry();
    const s = createBattleState(reg, STAGE, PROGRESS, 1);
    expect(s.allies.map((a) => a.id).sort()).toEqual([...reg.units.keys()].sort());
  });

  it('砦 HP は満タン、フェーズは placement', () => {
    const reg = testRegistry();
    const s = createBattleState(reg, STAGE, PROGRESS, 1);
    expect(s.fortHp).toBe(FORT_MAX_HP);
    expect(s.phase).toBe('placement');
  });

  it('敵はまだ出ていない', () => {
    const reg = testRegistry();
    const s = createBattleState(reg, STAGE, PROGRESS, 1);
    expect(s.enemies).toEqual([]);
    expect(s.pending).toEqual([]);
  });

  it('レベルが反映される', () => {
    const reg = testRegistry();
    const s = createBattleState(reg, STAGE, { ...PROGRESS, roran: { level: 3, xp: 0 } }, 1);
    const roran = s.allies.find((a) => a.id === 'roran')!;
    expect(roran.maxHp).toBe(36);
    expect(roran.hp).toBe(36);
    expect(roran.power).toBe(8);
  });

  it('砦へのフローフィールドが計算されている', () => {
    const reg = testRegistry();
    const s = createBattleState(reg, STAGE, PROGRESS, 1);
    expect(s.enemyField.dist[0]).toBe(0);
    expect(s.enemyField.dist[4]).toBe(ORTHO_COST * 4);
  });

  it('カウンタは からで しょきかされる', () => {
    const reg = testRegistry();
    const s = createBattleState(reg, STAGE, PROGRESS, 1);
    expect(s.counters).toEqual({});
  });
});

describe('createBattleState: レジストリ参照', () => {
  it('レジストリの UnitDef から 味方を つくる', () => {
    const reg = testRegistry();
    const s = createBattleState(reg, STAGE, PROGRESS, 1);
    const roran = s.allies.find((a) => a.id === 'roran')!;
    expect(roran.maxHp).toBe(reg.units.get('roran')!.maxHp);
    expect(roran.skill).toBe('funbaru');
  });

  it('state から レジストリを 引ける', () => {
    const reg = testRegistry();
    const s = createBattleState(reg, STAGE, PROGRESS, 1);
    expect(s.reg).toBe(reg);
  });

  it('roster は レジストリの units の じゅんばん', () => {
    const reg = testRegistry();
    const s = createBattleState(reg, STAGE, PROGRESS, 1);
    expect(s.allies.map((a) => a.id)).toEqual([...reg.units.keys()]);
  });
});

describe('placeAlly', () => {
  it('歩ける場所には置ける', () => {
    const reg = testRegistry();
    const s = createBattleState(reg, STAGE, PROGRESS, 1);
    placeAlly(s, 'roran', { x: 80, y: 48 });
    expect(s.allies.find((a) => a.id === 'roran')!.pos).toEqual({ x: 80, y: 48 });
  });

  it('歩けない場所には置けない（位置が変わらない）', () => {
    const reg = testRegistry();
    const stage: StageDef = { ...STAGE, mapRows: ['.....', '.#...', '.....'] };
    const s = createBattleState(reg, stage, PROGRESS, 1);
    const before = { ...s.allies.find((a) => a.id === 'roran')!.pos };
    placeAlly(s, 'roran', { x: 48, y: 48 });
    expect(s.allies.find((a) => a.id === 'roran')!.pos).toEqual(before);
  });
});

describe('placeAlly の戻り値', () => {
  it('歩ける場所なら true を返して移動する', () => {
    const reg = testRegistry();
    const s = createBattleState(reg, STAGE, PROGRESS, 1);
    expect(placeAlly(s, 'roran', { x: 48, y: 48 })).toBe(true);
    expect(s.allies.find((a) => a.id === 'roran')!.pos).toEqual({ x: 48, y: 48 });
  });

  it('歩けない場所なら false を返して動かさない', () => {
    const reg = testRegistry();
    const stage = { ...STAGE, mapRows: ['..........', '..####....', '..........'] };
    const s = createBattleState(reg, stage, PROGRESS, 1);
    const before = { ...s.allies.find((a) => a.id === 'roran')!.pos };
    expect(placeAlly(s, 'roran', { x: 80, y: 48 })).toBe(false);
    expect(s.allies.find((a) => a.id === 'roran')!.pos).toEqual(before);
  });
});

describe('startWave', () => {
  it('フェーズが wave になり、時刻がリセットされる', () => {
    const reg = testRegistry();
    const s = createBattleState(reg, STAGE, PROGRESS, 1);
    s.time = 99;
    startWave(s);
    expect(s.phase).toBe('wave');
    expect(s.time).toBe(0);
  });

  it('そのウェーブのスポーンが pending に積まれる', () => {
    const reg = testRegistry();
    const s = createBattleState(reg, STAGE, PROGRESS, 1);
    startWave(s);
    expect(s.pending).toHaveLength(1);
    expect(s.pending[0]!.kind).toBe('narazumono');
  });

  it('生き残りは最大 HP の 30% 回復する', () => {
    const reg = testRegistry();
    const s = createBattleState(reg, STAGE, PROGRESS, 1);
    const roran = s.allies.find((a) => a.id === 'roran')!;
    roran.hp = 10;
    startWave(s);
    expect(roran.hp).toBe(19); // 10 + floor(30 * 0.3)
  });

  it('回復しても最大 HP を超えない', () => {
    const reg = testRegistry();
    const s = createBattleState(reg, STAGE, PROGRESS, 1);
    const roran = s.allies.find((a) => a.id === 'roran')!;
    roran.hp = 29;
    startWave(s);
    expect(roran.hp).toBe(30);
  });

  it('たいきゃく中の味方は最大 HP の 50% で復帰し、30% 回復は重ねない', () => {
    const reg = testRegistry();
    const s = createBattleState(reg, STAGE, PROGRESS, 1);
    const roran = s.allies.find((a) => a.id === 'roran')!;
    roran.retired = true;
    roran.hp = 0;
    startWave(s);
    expect(roran.retired).toBe(false);
    expect(roran.hp).toBe(15);
  });

  it('スキル使用フラグとピンチ表示フラグがリセットされる', () => {
    const reg = testRegistry();
    const s = createBattleState(reg, STAGE, PROGRESS, 1);
    const roran = s.allies.find((a) => a.id === 'roran')!;
    roran.skillUsed = true;
    roran.pinchShown = true;
    roran.engagedWith = 'e1';
    startWave(s);
    expect(roran.skillUsed).toBe(false);
    expect(roran.pinchShown).toBe(false);
    expect(roran.engagedWith).toBeNull();
  });

  it('2 回目の startWave は次のウェーブを読む', () => {
    const reg = testRegistry();
    const s = createBattleState(reg, STAGE, PROGRESS, 1);
    startWave(s);
    s.waveIndex = 1;
    startWave(s);
    expect(s.pending[0]!.at).toBe(1);
  });
});
