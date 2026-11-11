import { describe, expect, it } from 'vitest';
import { DEFAULT_LEGEND } from '../engine/schema';
import type { StageDef, VillageDef } from '../engine/schema';
import { MAX_PARTY } from './constants';
import {
  completeRecruit, isVisiting, rewardKey, updatePersuasions, updateVillages, VILLAGE_DONE_TEXT,
} from './events';
import { step } from './sim';
import { beginBattle, createBattleState } from './state';
import { testRegistry } from './testing';
import type { BattleState, Unit } from './types';

const V_COL = 5;
const V_ROW = 5;

/** 実ステージの写し。(V_COL, V_ROW) のマスを通れない V にして、そこへ村を置く */
function fresh(villages: VillageDef[], claimedBefore: string[] = []): BattleState {
  const reg = testRegistry();
  const base = reg.stages[0]!;
  const mapRows = base.mapRows.map((row, y) =>
    y === V_ROW ? row.slice(0, V_COL) + 'V' + row.slice(V_COL + 1) : row,
  );
  const stage: StageDef = {
    ...base,
    mapRows,
    legend: { ...DEFAULT_LEGEND, V: { tile: null, walkable: false } },
    villages,
  };
  const progress: Record<string, { level: number; xp: number }> = {};
  for (const id of reg.units.keys()) progress[id] = { level: 1, xp: 0 };
  const s = createBattleState(reg, stage, { units: progress, members: [], claimed: claimedBefore }, 1);
  beginBattle(s);
  return s;
}

const village = (effect: VillageDef['effect'], id = 'v1'): VillageDef => ({
  id, col: V_COL, row: V_ROW, text: 'むらだ', effect,
});

const NEAR = { x: V_COL * 32 - 8, y: V_ROW * 32 + 16 };
const FAR = { x: 60, y: 400 };

function players(s: BattleState): Unit[] {
  return s.units.filter((u) => u.side === 'player');
}

function placeAll(s: BattleState, pos: { x: number; y: number }): void {
  for (const u of players(s)) u.pos = { ...pos };
}

describe('isVisiting', () => {
  const v = village({ type: 'talk' });
  it('村のマスの四角を少し広げた中なら訪れている', () => {
    expect(isVisiting(32, { x: 142, y: 176 }, v)).toBe(true);
    expect(isVisiting(32, { x: 141, y: 176 }, v)).toBe(false);
  });

  it('隣のマスの中心（縁から 16px）に立てば訪れ、2 マス離れた中心（縁から 48px）では訪れない', () => {
    // 村は (5,5) のマス（x 160〜192, y 160〜192）。隣のマスの中心は x=144 / 208、y=144 / 208
    expect(isVisiting(32, { x: 144, y: 176 }, v)).toBe(true);
    expect(isVisiting(32, { x: 208, y: 176 }, v)).toBe(true);
    expect(isVisiting(32, { x: 176, y: 144 }, v)).toBe(true);
    expect(isVisiting(32, { x: 176, y: 208 }, v)).toBe(true);
    expect(isVisiting(32, { x: 112, y: 176 }, v)).toBe(false);
    expect(isVisiting(32, { x: 240, y: 176 }, v)).toBe(false);
  });
});

describe('rewardKey', () => {
  it('ステージと村の id をつなぐ', () => {
    expect(rewardKey('stage1', 'v1')).toBe('stage1/v1');
  });
});

describe('updateVillages', () => {
  it('村の隣に着くと訪れる', () => {
    const s = fresh([village({ type: 'talk' })]);
    placeAll(s, FAR);
    players(s)[0]!.pos = { ...NEAR };
    updateVillages(s);
    expect(s.visited).toEqual(['v1']);
    expect(s.events).toEqual([
      { type: 'villageVisited', uid: players(s)[0]!.uid, defId: players(s)[0]!.defId, villageId: 'v1', text: 'むらだ' },
    ]);
  });

  it('離れていると訪れない', () => {
    const s = fresh([village({ type: 'talk' })]);
    placeAll(s, FAR);
    updateVillages(s);
    expect(s.visited).toEqual([]);
    expect(s.events).toEqual([]);
  });

  it('倒れた味方は訪れない', () => {
    const s = fresh([village({ type: 'talk' })]);
    placeAll(s, FAR);
    players(s)[0]!.pos = { ...NEAR };
    players(s)[0]!.hp = 0;
    updateVillages(s);
    expect(s.visited).toEqual([]);
  });

  it('同じ村は 2 回訪れない', () => {
    const s = fresh([village({ type: 'talk' })]);
    placeAll(s, FAR);
    players(s)[0]!.pos = { ...NEAR };
    updateVillages(s);
    s.events = [];
    updateVillages(s);
    expect(s.events).toEqual([]);
  });

  it('回復は全員に効く', () => {
    const s = fresh([village({ type: 'heal' })]);
    placeAll(s, FAR);
    for (const u of players(s)) u.hp = 1;
    players(s)[0]!.pos = { ...NEAR };
    updateVillages(s);
    for (const u of players(s)) expect(u.hp).toBe(u.maxHp);
  });

  it('攻撃力アップは訪れた人だけ', () => {
    const s = fresh([village({ type: 'powerUp', amount: 3 })]);
    placeAll(s, FAR);
    players(s)[0]!.pos = { ...NEAR };
    updateVillages(s);
    expect(players(s)[0]!.stagePower).toBe(3);
    for (const u of players(s).slice(1)) expect(u.stagePower).toBe(0);
  });

  it('経験値は一度きり', () => {
    const s = fresh([village({ type: 'xp', amount: 1 })]);
    placeAll(s, FAR);
    const u = players(s)[0]!;
    u.pos = { ...NEAR };
    const before = u.xp;
    updateVillages(s);
    expect(u.xp).toBe(before + 1);
    expect(s.claimed).toEqual([rewardKey(s.stage.id, 'v1')]);
    expect(s.events[0]).toMatchObject({ type: 'villageVisited', text: 'むらだ' });

    const t = fresh([village({ type: 'xp', amount: 1 })], [rewardKey(fresh([]).stage.id, 'v1')]);
    placeAll(t, FAR);
    const w = players(t)[0]!;
    w.pos = { ...NEAR };
    const xp = w.xp;
    updateVillages(t);
    expect(w.xp).toBe(xp);
    expect(t.claimed).toEqual([]);
    expect(t.events[0]).toMatchObject({ type: 'villageVisited', text: VILLAGE_DONE_TEXT });
  });

  it('能力値の村で守りが上がり statBonus に残る', () => {
    const s = fresh([village({ type: 'stat', stat: 'guard', amount: 2 })]);
    placeAll(s, FAR);
    const u = players(s)[0]!;
    u.pos = { ...NEAR };
    const guard = u.guard;
    updateVillages(s);
    expect(u.guard).toBe(guard + 2);
    expect(u.statBonus.guard).toBe(2);
    expect(s.claimed).toEqual([rewardKey(s.stage.id, 'v1')]);
  });

  it('最大 HP の村は現在 HP も上げる', () => {
    const s = fresh([village({ type: 'stat', stat: 'maxHp', amount: 4 })]);
    placeAll(s, FAR);
    const u = players(s)[0]!;
    u.pos = { ...NEAR };
    const hp = u.hp;
    const maxHp = u.maxHp;
    updateVillages(s);
    expect(u.maxHp).toBe(maxHp + 4);
    expect(u.hp).toBe(hp + 4);
  });

  it('2 人が同時に着いても効果は 1 回', () => {
    const s = fresh([village({ type: 'powerUp', amount: 3 })]);
    placeAll(s, FAR);
    const [a, b] = players(s);
    a!.pos = { ...NEAR };
    b!.pos = { ...NEAR };
    updateVillages(s);
    expect(a!.stagePower).toBe(3);
    expect(b!.stagePower).toBe(0);
    expect(s.events.filter((e) => e.type === 'villageVisited')).toHaveLength(1);
  });

  const recruit = (unitId: string) => ({
    type: 'recruit' as const,
    recruit: { unitId, level: 1, talk: [{ speaker: null, lineId: null, text: 'よろしく' }] },
  });

  it('仲間の村は pendingRecruit を立て、シムが止まる', () => {
    const s = fresh([{ ...village(recruit('ghost')), text: null }]);
    placeAll(s, FAR);
    const u = players(s)[0]!;
    u.pos = { ...NEAR };
    updateVillages(s);
    expect(s.visited).toEqual(['v1']);
    expect(s.pendingRecruit).not.toBeNull();
    expect(s.pendingRecruit!.recruit.unitId).toBe('ghost');
    expect(s.pendingRecruit!.foeUid).toBeNull();
    expect(s.events).toEqual([]);

    const time = s.time;
    step(s, [], 1 / 30);
    expect(s.time).toBe(time);
  });

  it('加入済みの仲間の村は pendingRecruit を立てない。text があればその文を出し、無ければ何も出さない', () => {
    const s = fresh([{ ...village(recruit('roran')), text: null }]);
    placeAll(s, FAR);
    players(s)[0]!.pos = { ...NEAR };
    updateVillages(s);
    expect(s.pendingRecruit).toBeNull();
    expect(s.visited).toEqual(['v1']);
    expect(s.events).toEqual([]);

    const s2 = fresh([{ ...village(recruit('roran')), text: 'もう 仲間だ' }]);
    placeAll(s2, FAR);
    players(s2)[0]!.pos = { ...NEAR };
    updateVillages(s2);
    expect(s2.events[0]).toMatchObject({ type: 'villageVisited', text: 'もう 仲間だ' });
  });

  it('加入の会話の間は加入の村を訪れ済みにせず、会話が終わった次の tick で加入が始まる', () => {
    const s = fresh([{ ...village(recruit('ghost')), text: null }]);
    placeAll(s, FAR);
    players(s)[0]!.pos = { ...NEAR };
    const other = { recruit: { unitId: 'ally05', level: 1, talk: [] }, pos: { x: 1, y: 2 }, foeUid: null };
    s.pendingRecruit = other;
    updateVillages(s);
    expect(s.visited).toEqual([]);
    expect(s.pendingRecruit).toBe(other);
    s.pendingRecruit = null;
    updateVillages(s);
    expect(s.visited).toEqual(['v1']);
    expect(s.pendingRecruit!.recruit.unitId).toBe('ghost');
  });
});

/** 説得の相手を 1 人置いた状態。相手は離れた場所に置き、ローランが persuader */
function withPersuasion(): { s: BattleState; foe: Unit } {
  const s = fresh([]);
  const foe = s.units.find((u) => u.side === 'enemy' && u.defId === 'narazumono')!;
  s.stage = {
    ...s.stage,
    persuasions: [{
      foeId: 'narazumono', pos: { ...foe.pos }, ai: { kind: 'aggressive' }, persuader: 'roran',
      unitId: 'ally05', level: 3, talk: [{ speaker: 'ally05', text: 'こんにちは', lineId: null }],
    }],
  };
  foe.persuasion = 0;
  for (const u of s.units) if (u.side === 'enemy' && u !== foe) u.retired = true;
  placeAll(s, FAR);
  foe.pos = { x: 300, y: 300 };
  return { s, foe };
}

const roranOf = (s: BattleState): Unit => players(s).find((u) => u.defId === 'roran')!;

describe('updatePersuasions', () => {
  it('決められた仲間が 64px 以内に入ると説得が始まる', () => {
    const { s, foe } = withPersuasion();
    roranOf(s).pos = { x: 364, y: 300 };
    updatePersuasions(s);
    expect(s.pendingRecruit).toEqual({ recruit: s.stage.persuasions[0], pos: { x: 300, y: 300 }, foeUid: foe.uid });
  });

  it('64px より遠いと始まらない', () => {
    const { s } = withPersuasion();
    roranOf(s).pos = { x: 365, y: 300 };
    updatePersuasions(s);
    expect(s.pendingRecruit).toBeNull();
  });

  it('ほかの仲間では始まらない', () => {
    const { s } = withPersuasion();
    for (const u of players(s)) if (u.defId !== 'roran') u.pos = { x: 300, y: 310 };
    updatePersuasions(s);
    expect(s.pendingRecruit).toBeNull();
  });

  it('倒れた相手は説得されない', () => {
    const { s, foe } = withPersuasion();
    roranOf(s).pos = { x: 310, y: 300 };
    foe.hp = 0;
    updatePersuasions(s);
    expect(s.pendingRecruit).toBeNull();
    foe.hp = foe.maxHp;
    foe.retired = true;
    updatePersuasions(s);
    expect(s.pendingRecruit).toBeNull();
  });

  it('味方が MAX_PARTY 人いれば説得を始めない', () => {
    const { s } = withPersuasion();
    roranOf(s).pos = { x: 310, y: 300 };
    const base = players(s)[0]!;
    while (players(s).length < MAX_PARTY) s.units.push({ ...base, uid: `x${s.units.length}`, pos: { ...FAR } });
    updatePersuasions(s);
    expect(s.pendingRecruit).toBeNull();
  });

  it('すでに加入の会話があれば何もしない', () => {
    const { s } = withPersuasion();
    roranOf(s).pos = { x: 310, y: 300 };
    const pending = { recruit: s.stage.persuasions[0]!, pos: { x: 1, y: 2 }, foeUid: null };
    s.pendingRecruit = pending;
    updatePersuasions(s);
    expect(s.pendingRecruit).toBe(pending);
  });
});

describe('completeRecruit', () => {
  it('加入すると敵が消え、同じ位置に味方が現れる', () => {
    const { s, foe } = withPersuasion();
    foe.engagedWith = roranOf(s).uid;
    roranOf(s).engagedWith = foe.uid;
    roranOf(s).pos = { x: 310, y: 300 };
    const xpBefore = players(s).map((u) => u.xp);
    updatePersuasions(s);
    s.events = [];
    const joined = completeRecruit(s);
    expect(joined).not.toBeNull();
    expect(s.pendingRecruit).toBeNull();
    expect(foe.retired).toBe(true);
    expect(roranOf(s).engagedWith).toBeNull();
    expect(s.events.some((e) => e.type === 'unitDefeated')).toBe(false);
    expect(players(s).slice(0, xpBefore.length).map((u) => u.xp)).toEqual(xpBefore);
    expect(joined!.side).toBe('player');
    expect(joined!.defId).toBe('ally05');
    expect(joined!.level).toBe(3);
    expect(joined!.hp).toBe(joined!.maxHp);
    expect(joined!.pos).toEqual({ x: 300, y: 300 });
    expect(joined!.uid).toBe('p5');
    expect(s.nextPlayerUid).toBe(6);
    expect(s.units).toContain(joined);
    expect(s.joined).toContain('ally05');
  });

  it('すでに MAX_PARTY 人いれば加えない', () => {
    const { s, foe } = withPersuasion();
    roranOf(s).pos = { x: 310, y: 300 };
    updatePersuasions(s);
    const base = players(s)[0]!;
    while (players(s).length < MAX_PARTY) s.units.push({ ...base, uid: `x${s.units.length}` });
    const n = s.units.length;
    expect(completeRecruit(s)).toBeNull();
    expect(s.units.length).toBe(n);
    expect(s.pendingRecruit).toBeNull();
    expect(foe.retired).toBe(true);
  });

  it('勝利の条件を満たしても、加入の会話が先に出る', () => {
    const { s } = withPersuasion();
    roranOf(s).pos = { x: 310, y: 300 };
    s.stage = { ...s.stage, victory: { ...s.stage.victory, pos: { x: 310, y: 300 }, radius: 40, by: 'roran' } };
    step(s, [], 1 / 60);
    expect(s.pendingRecruit).not.toBeNull();
    expect(s.phase).toBe('battle');
    completeRecruit(s);
    step(s, [], 1 / 60);
    expect(s.phase).toBe('victory');
  });
});
