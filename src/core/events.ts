import type { VillageDef } from '../engine/schema';
import { VISIT_MARGIN } from './constants';
import { resolveMoveDest } from './field';
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
