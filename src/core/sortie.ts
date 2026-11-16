import { MAX_PARTY } from './constants';
import { partyIds } from './party';
import type { Registry } from '../engine/registry';
import type { StageDef } from '../engine/schema';
import type { CharProgress, PartyProgress } from './types';

/** 倒れたら即敗北するユニットの defId（出撃から外せない）。定義順・重複なし */
export function lockedIds(stage: StageDef): string[] {
  const out: string[] = [];
  for (const cond of stage.defeat) {
    if (cond.type !== 'unitLost') continue;
    for (const defId of cond.defIds) {
      if (!out.includes(defId)) out.push(defId);
    }
  }
  return out;
}

/** そのステージの開始時に加わる仲間（すでに仲間・roster にいる人は除く）。出てきた順・重複なし */
function startJoinIds(stage: StageDef, members: readonly string[]): string[] {
  const out: string[] = [];
  for (const j of stage.joins) {
    if (members.includes(j.unitId) || stage.roster.includes(j.unitId) || out.includes(j.unitId)) continue;
    out.push(j.unitId);
  }
  return out;
}

/**
 * そのステージで場に出られる全員。並びは roster → 加わった順（members） → 開始時の加入。
 * 8 人を超えてよい（切るのは出撃を決めるところ）
 */
export function sortieCandidates(reg: Registry, stage: StageDef, members: readonly string[]): string[] {
  const out: string[] = [];
  const add = (id: string): void => {
    if (!out.includes(id)) out.push(id);
  };
  for (const id of stage.roster) add(id);
  for (const id of partyIds(reg, members)) if (members.includes(id)) add(id);
  for (const id of startJoinIds(stage, members)) add(id);
  return out;
}

/** 候補の進行。開始時の加入は加わるときのレベル、それ以外はセーブの値（なければ Lv1） */
export function sortieProgress(stage: StageDef, party: PartyProgress, defId: string): CharProgress {
  if (startJoinIds(stage, party.members).includes(defId)) {
    const j = stage.joins.find((x) => x.unitId === defId)!;
    return { level: j.level, xp: 0 };
  }
  return party.units[defId] ?? { level: 1, xp: 0 };
}

/**
 * ステージに入ったときの出撃。外せない仲間 → 開始時の加入 → 前回の出撃 → 自動の順
 * （開始時の加入 → roster → members）で MAX_PARTY 人まで埋める。
 * 候補にいない ID は飛ばし、重複を除く。返す並びは sortieCandidates の並び
 */
export function initialSortie(
  reg: Registry, stage: StageDef, members: readonly string[], previous: readonly string[],
): string[] {
  const candidates = sortieCandidates(reg, stage, members);
  const joins = startJoinIds(stage, members);
  const priority = [
    ...lockedIds(stage), ...joins, ...previous, ...joins, ...stage.roster, ...members,
  ];
  const picked: string[] = [];
  for (const id of priority) {
    if (picked.length >= MAX_PARTY) break;
    if (candidates.includes(id) && !picked.includes(id)) picked.push(id);
  }
  return candidates.filter((id) => picked.includes(id));
}

/**
 * 一覧で枠を押したときの判定。外せる→外す、外せない→locked、満員で入れられない→full、
 * 入れる。返す chosen は candidates の並び。候補にいない id は何もしない
 */
export function toggleSortie(
  stage: StageDef, chosen: readonly string[], id: string, candidates: readonly string[],
): { chosen: string[]; refusal: 'locked' | 'full' | null } {
  const keep = (ids: readonly string[]): string[] => candidates.filter((c) => ids.includes(c));
  if (!candidates.includes(id)) return { chosen: [...chosen], refusal: null };
  if (chosen.includes(id)) {
    if (lockedIds(stage).includes(id)) return { chosen: [...chosen], refusal: 'locked' };
    return { chosen: keep(chosen.filter((c) => c !== id)), refusal: null };
  }
  if (chosen.length >= MAX_PARTY) return { chosen: [...chosen], refusal: 'full' };
  return { chosen: keep([...chosen, id]), refusal: null };
}

/** 出撃を選ぶ画面を出すのは、候補が MAX_PARTY 人を超えるときだけ */
export function canChooseSortie(candidates: readonly string[]): boolean {
  return candidates.length > MAX_PARTY;
}
