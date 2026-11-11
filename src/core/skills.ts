import { bondSupporters, BOND_RANGE } from './bonds';
import { nearestWithin } from './combat';
import { MELEE_RANGE } from './constants';
import { hostilesOf, playerUnits } from './sim';
import { skillParam } from '../engine/registry';
import { distance, distanceToSegment, fitInCell, hasClearPath } from './field';
import type { BattleState, Unit, Vec2 } from './types';

/** skills.json に値がなかったときのふぉーるばっく。JSON が正なのでふつうは使われない */
export const FUNBARU_DURATION = 5;
export const OMAJINAI_HEAL = 12;
export const KAKENUKERU_DAMAGE = 5;
export const HIKITSUKERU_RANGE = 96;
export const HIKITSUKERU_DURATION = 6;
export const HINOAME_RADIUS = 48;
export const HINOAME_DAMAGE = 6;
export const TSUKI_LENGTH = 80;
export const TSUKI_DAMAGE = 7;
export const HAGEMASU_RANGE = 120;
export const HAGEMASU_POWER = 2;
export const HAGEMASU_DURATION = 8;
export const DEFAULT_SKILL_COOLDOWN = 10;

export type SkillContext = { state: BattleState; self: Unit; dest?: Vec2 };

/**
 * 効果の本体。戻り値は「当てた数」で、称号のカウンタ（skill:<id>:hits）に積まれる。
 * 発動できなかった場合だけ null を返す。呼び出し側はそのとき使用回数も消費させない。
 */
export type SkillEffect = (ctx: SkillContext) => number | null;

/** 必殺技が敵 1 体に当たったときの処理。ダメージ・最後に当てた相手・アシストの記録・hit イベント */
export function skillHit(state: BattleState, self: Unit, enemy: Unit, damage: number, fromPos: Vec2): void {
  enemy.hp -= damage;
  enemy.lastHitBy = self.uid;
  enemy.lastHitNeraiuchi = false;
  if (!enemy.damagedBy.includes(self.uid)) enemy.damagedBy.push(self.uid);
  state.events.push({
    type: 'hit', targetUid: enemy.uid, targetPos: { ...enemy.pos }, amount: damage,
    sourceUid: self.uid, sourceDefId: self.defId, attackKind: self.attack, sourcePos: { ...fromPos }, neraiuchi: false,
  });
}

export const SKILL_EFFECTS: Record<string, SkillEffect> = {
  funbaru: ({ state, self }) => {
    self.funbaruUntil = state.time + skillParam(state.reg, 'funbaru', 'duration', FUNBARU_DURATION);
    return 0;
  },

  neraiuchi: ({ self }) => {
    self.neraiuchiArmed = true;
    return 0;
  },

  omajinai: ({ state, self }) => {
    const range = skillParam(state.reg, 'omajinai', 'range', BOND_RANGE);
    const heal = skillParam(state.reg, 'omajinai', 'heal', OMAJINAI_HEAL);
    const candidates = playerUnits(state).filter((u) => distance(self.pos, u.pos) <= range);
    if (candidates.length === 0) return null;
    let target = candidates[0]!;
    for (const c of candidates) {
      if (c.hp / c.maxHp < target.hp / target.maxHp) target = c;
    }
    const before = target.hp;
    target.hp = Math.min(target.maxHp, target.hp + heal);
    const healed = target.hp - before;
    if (healed > 0) {
      state.events.push({
        type: 'heal', targetPos: { ...target.pos }, amount: healed,
        sourceUid: self.uid, sourceDefId: self.defId, sourcePos: { ...self.pos },
      });
    }
    return 0;
  },

  kakenukeru: ({ state, self, dest }) => {
    if (!dest) return null;
    // 壁の脇を指しても、足元の箱が壁にかからない位置へ寄せる
    const to = fitInCell(state.grid, dest);
    if (!to) return null;
    const from = { ...self.pos };
    // 移動と同じ基準。点をまばらに調べると、点と点のあいだで箱が壁の角をかすめる経路を通してしまう
    if (!hasClearPath(state.grid, from, to)) return null;
    const damage = skillParam(state.reg, 'kakenukeru', 'damage', KAKENUKERU_DAMAGE);
    let hits = 0;
    for (const enemy of hostilesOf(state, self)) {
      if (distanceToSegment(enemy.pos, from, to) > MELEE_RANGE) continue;
      skillHit(state, self, enemy, damage, from);
      hits++;
    }
    self.pos = { ...to };
    self.goalField = null;
    self.goalPos = null;
    self.engagedWith = null;
    return hits;
  },

  hikitsukeru: ({ state, self }) => {
    const range = skillParam(state.reg, 'hikitsukeru', 'range', HIKITSUKERU_RANGE);
    self.tauntUntil = state.time + skillParam(state.reg, 'hikitsukeru', 'duration', HIKITSUKERU_DURATION);
    return hostilesOf(state, self).filter((e) => distance(self.pos, e.pos) <= range).length;
  },

  hinoame: ({ state, self, dest }) => {
    if (!dest) return null;
    const radius = skillParam(state.reg, 'hinoame', 'radius', HINOAME_RADIUS);
    const damage = skillParam(state.reg, 'hinoame', 'damage', HINOAME_DAMAGE);
    let hits = 0;
    for (const enemy of hostilesOf(state, self)) {
      if (distance(enemy.pos, dest) > radius) continue;
      skillHit(state, self, enemy, damage, self.pos);
      hits++;
    }
    return hits;
  },

  tsuki: ({ state, self }) => {
    const length = skillParam(state.reg, 'tsuki', 'length', TSUKI_LENGTH);
    const damage = skillParam(state.reg, 'tsuki', 'damage', TSUKI_DAMAGE);
    const hostiles = hostilesOf(state, self);
    // 向きは交戦中の相手。いなければ長さの内で最寄りの敵
    const engaged = self.engagedWith === null ? undefined : hostiles.find((e) => e.uid === self.engagedWith);
    const target = engaged ?? nearestWithin(self.pos, hostiles, length);
    if (!target) return null;
    const d = distance(self.pos, target.pos);
    // 重なっていて向きが決まらないときは出さない（0 で割らない）
    if (d === 0) return null;
    const to = {
      x: self.pos.x + ((target.pos.x - self.pos.x) / d) * length,
      y: self.pos.y + ((target.pos.y - self.pos.y) / d) * length,
    };
    let hits = 0;
    for (const enemy of hostiles) {
      if (distanceToSegment(enemy.pos, self.pos, to) > MELEE_RANGE / 2) continue;
      skillHit(state, self, enemy, damage, self.pos);
      hits++;
    }
    return hits;
  },

  hagemasu: ({ state, self }) => {
    const range = skillParam(state.reg, 'hagemasu', 'range', HAGEMASU_RANGE);
    const power = skillParam(state.reg, 'hagemasu', 'power', HAGEMASU_POWER);
    const until = state.time + skillParam(state.reg, 'hagemasu', 'duration', HAGEMASU_DURATION);
    const allies = playerUnits(state).filter((u) => u.hp > 0 && distance(self.pos, u.pos) <= range);
    for (const a of allies) {
      a.cheerUntil = until;
      a.cheerPower = power;
    }
    return allies.length;
  },
};

export const SKILL_EFFECT_IDS: readonly string[] = Object.keys(SKILL_EFFECTS);

export function canUseSkill(state: BattleState, uid: string): boolean {
  if (state.phase !== 'battle') return false;
  const unit = state.units.find((u) => u.uid === uid && u.side === 'player');
  if (!unit) return false;
  return !unit.retired && state.time >= unit.skillCooldownUntil;
}

export function useSkill(state: BattleState, uid: string, dest?: Vec2): boolean {
  if (!canUseSkill(state, uid)) return false;
  const self = state.units.find((u) => u.uid === uid)!;
  const effect = SKILL_EFFECTS[self.skillId ?? ''];
  if (!effect) return false;

  const fromPos = { ...self.pos };
  const hits = effect({ state, self, dest });
  if (hits === null) return false;

  const cooldown = skillParam(state.reg, self.skillId!, 'cooldown', DEFAULT_SKILL_COOLDOWN);
  self.skillCooldownUntil = state.time + cooldown;
  state.events.push({
    type: 'skill', uid: self.uid, defId: self.defId, skillId: self.skillId!, hits,
    fromPos, toPos: { ...self.pos },
  });
  return true;
}
