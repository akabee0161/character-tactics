import { toggleSortie } from '../core/sortie';
import type { Vec2 } from '../core/types';
import type { StageDef } from '../engine/schema';
import { hitRect } from './hit';
import {
  CARD_CLOSE_BTN, ENEMY_LIST, ENEMY_LIST_CLOSE_BTN, SORTIE_DECIDE_BTN, STAT_CARD, enemyListRow, sortieSlot, sortieStrengthBtn,
} from './layout';
import type { StageEnemy, StatCard } from './stat-card';

/** 画面に重ねて出す物。重ねている間は、下の画面に入力が届かない */
export type Overlay =
  | { kind: 'card'; card: StatCard; back: Overlay | null }
  | { kind: 'enemies'; title: string; enemies: StageEnemy[]; cards: StatCard[] }
  | { kind: 'sortie'; stage: StageDef; candidates: string[]; chosen: string[]; message: string | null };

export type SortieOverlay = Extract<Overlay, { kind: 'sortie' }>;

export type OverlayTap =
  | { type: 'close' } | { type: 'open'; card: StatCard } | { type: 'none' }
  | { type: 'toggle'; id: string } | { type: 'strength'; id: string } | { type: 'decide' };

export function overlayTap(o: Overlay, p: Vec2): OverlayTap {
  if (o.kind === 'card') {
    if (hitRect(CARD_CLOSE_BTN, p) || !hitRect(STAT_CARD, p)) return { type: 'close' };
    return { type: 'none' };
  }
  if (o.kind === 'sortie') {
    // 一覧の外を押しても閉じない（選び直しが消えるため）。閉じるのは「決める」だけ
    if (hitRect(SORTIE_DECIDE_BTN, p)) return o.chosen.length === 0 ? { type: 'none' } : { type: 'decide' };
    for (let i = 0; i < o.candidates.length; i++) {
      const slot = sortieSlot(i);
      if (hitRect(sortieStrengthBtn(slot), p)) return { type: 'strength', id: o.candidates[i]! };
      if (hitRect(slot, p)) return { type: 'toggle', id: o.candidates[i]! };
    }
    return { type: 'none' };
  }
  if (hitRect(ENEMY_LIST_CLOSE_BTN, p) || !hitRect(ENEMY_LIST, p)) return { type: 'close' };
  for (let i = 0; i < o.cards.length; i++) {
    if (hitRect(enemyListRow(i), p)) return { type: 'open', card: o.cards[i]! };
  }
  return { type: 'none' };
}

/** 一覧で枠を押したときの結果。断られたら選んだ内容は変えず、理由を message に出す。入れ外しができたら message を消す */
export function applySortieToggle(o: SortieOverlay, id: string, nameOf: (id: string) => string): SortieOverlay {
  const r = toggleSortie(o.stage, o.chosen, id, o.candidates);
  const message =
    r.refusal === 'locked' ? `${nameOf(id)}は 倒れたら 負けなので 外せない`
    : r.refusal === 'full' ? '8 人まで。先に 誰かを 外す'
    : null;
  return { ...o, chosen: r.chosen, message };
}

/** 閉じた後に残る物。カードを閉じたら、開いた元の一覧（敵の一覧・出撃の一覧）へ戻る */
export function closeOverlay(o: Overlay): Overlay | null {
  return o.kind === 'card' ? o.back : null;
}
