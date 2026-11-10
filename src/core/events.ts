import type { VillageDef } from '../engine/schema';
import { MAX_PARTY, PERSUADE_RANGE, VISIT_MARGIN } from './constants';
import { distance, resolveMoveDest } from './field';
import { retireUnit } from './retire';
import { makeUnit } from './state';
import { awardXp } from './growth';
import type { BattleState, Unit, Vec2 } from './types';

/** 一度きりのごほうびをもう受け取っているときの村の文 */
export const VILLAGE_DONE_TEXT = '村の 人が 手を ふっている';

/** 村のマスの四角を VISIT_MARGIN 広げた中に pos があるか */
export function isVisiting(cell: number, pos: Vec2, v: VillageDef): boolean {
  const left = v.col * cell - VISIT_MARGIN;
  const top = v.row * cell - VISIT_MARGIN;
  const right = (v.col + 1) * cell + VISIT_MARGIN;
  const bottom = (v.row + 1) * cell + VISIT_MARGIN;
  return pos.x >= left && pos.x <= right && pos.y >= top && pos.y <= bottom;
}

/** 一度きりのごほうびの印（セーブの claimed に入る） */
export function rewardKey(stageId: string, villageId: string): string {
  return `${stageId}/${villageId}`;
}

function applyVillage(state: BattleState, u: Unit, v: VillageDef): void {
  const key = rewardKey(state.stage.id, v.id);
  const effect = v.effect;
  const taken = state.claimed.includes(key) || state.claimedBefore.has(key);
  let text = v.text ?? VILLAGE_DONE_TEXT;

  switch (effect.type) {
    case 'talk':
      break;
    case 'heal':
      for (const p of state.units) {
        if (p.side === 'player' && !p.retired && p.hp > 0) p.hp = p.maxHp;
      }
      break;
    case 'powerUp':
      u.stagePower += effect.amount;
      break;
    case 'xp':
      if (taken) { text = VILLAGE_DONE_TEXT; break; }
      awardXp(state, u, effect.amount);
      state.claimed.push(key);
      break;
    case 'stat':
      if (taken) { text = VILLAGE_DONE_TEXT; break; }
      u.statBonus[effect.stat] += effect.amount;
      u[effect.stat] += effect.amount;
      if (effect.stat === 'maxHp') u.hp += effect.amount;
      state.claimed.push(key);
      break;
    case 'recruit': {
      const id = effect.recruit.unitId;
      const present = state.joined.includes(id) || state.units.some((p) => p.side === 'player' && p.defId === id);
      if (!present && state.pendingRecruit === null) {
        const pos = resolveMoveDest(state.grid, u.pos, { x: u.pos.x + 24, y: u.pos.y }) ?? u.pos;
        state.pendingRecruit = { recruit: effect.recruit, pos: { ...pos }, foeUid: null };
        return;
      }
      state.events.push({
        type: 'villageVisited', uid: u.uid, defId: u.defId, villageId: v.id, text: VILLAGE_DONE_TEXT,
      });
      return;
    }
  }
  state.events.push({ type: 'villageVisited', uid: u.uid, defId: u.defId, villageId: v.id, text });
}

/** 生きている味方を state.units の順に見て、まだ訪れていない村に着いた最初の 1 人に効果を出す */
export function updateVillages(state: BattleState): void {
  for (const v of state.stage.villages) {
    if (state.visited.includes(v.id)) continue;
    const visitor = state.units.find(
      (u) => u.side === 'player' && !u.retired && u.hp > 0 && isVisiting(state.grid.cell, u.pos, v),
    );
    if (!visitor) continue;
    state.visited.push(v.id);
    applyVillage(state, visitor, v);
  }
}

/**
 * 説得の相手（生きている）に、決められた仲間が PERSUADE_RANGE 以内へ入ったら加入の会話を始める。
 * 1 tick に 1 つまで。すでに加入の会話があれば何もしない
 */
export function updatePersuasions(state: BattleState): void {
  if (state.pendingRecruit !== null) return;
  for (const foe of state.units) {
    if (foe.side !== 'enemy' || foe.persuasion === null || foe.retired || foe.hp <= 0) continue;
    const def = state.stage.persuasions[foe.persuasion];
    if (!def) continue;
    const near = state.units.some(
      (u) => u.side === 'player' && !u.retired && u.hp > 0 && u.defId === def.persuader
        && distance(u.pos, foe.pos) <= PERSUADE_RANGE,
    );
    if (!near) continue;
    state.pendingRecruit = { recruit: def, pos: { ...foe.pos }, foeUid: foe.uid };
    return;
  }
}

/**
 * 加入の会話が終わったあとに呼ぶ。説得の相手を（倒れた扱いにせず）取り除き、新しい味方を足す。
 * すでに MAX_PARTY 人いれば足さずに null
 */
export function completeRecruit(state: BattleState): Unit | null {
  const pending = state.pendingRecruit;
  if (pending === null) return null;
  state.pendingRecruit = null;
  if (pending.foeUid !== null) {
    const foe = state.units.find((u) => u.uid === pending.foeUid);
    if (foe) retireUnit(state, foe);
  }
  const allies = state.units.filter((u) => u.side === 'player' && !u.retired).length;
  if (allies >= MAX_PARTY) return null;
  const unit = makeUnit({
    uid: `p${state.nextPlayerUid++}`, def: state.reg.units.get(pending.recruit.unitId)!, side: 'player',
    controller: 'player', pos: { ...pending.pos }, level: pending.recruit.level, xp: 0, ai: null,
    growth: state.reg.growth,
  });
  state.units.push(unit);
  state.joined.push(pending.recruit.unitId);
  return unit;
}
