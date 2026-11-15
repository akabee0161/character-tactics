import type { Vec2 } from '../core/types';
import { hitRect } from './hit';
import { CARD_CLOSE_BTN, ENEMY_LIST, ENEMY_LIST_CLOSE_BTN, STAT_CARD, enemyListRow } from './layout';
import type { StageEnemy, StatCard } from './stat-card';

/** 画面に重ねて出す物。重ねている間は、下の画面に入力が届かない */
export type Overlay =
  | { kind: 'card'; card: StatCard; back: Overlay | null }
  | { kind: 'enemies'; title: string; enemies: StageEnemy[]; cards: StatCard[] };

export type OverlayTap = { type: 'close' } | { type: 'open'; card: StatCard } | { type: 'none' };

export function overlayTap(o: Overlay, p: Vec2): OverlayTap {
  if (o.kind === 'card') {
    if (hitRect(CARD_CLOSE_BTN, p) || !hitRect(STAT_CARD, p)) return { type: 'close' };
    return { type: 'none' };
  }
  if (hitRect(ENEMY_LIST_CLOSE_BTN, p) || !hitRect(ENEMY_LIST, p)) return { type: 'close' };
  for (let i = 0; i < o.cards.length; i++) {
    if (hitRect(enemyListRow(i), p)) return { type: 'open', card: o.cards[i]! };
  }
  return { type: 'none' };
}

/** 閉じた後に残る物。札を閉じたら、開いた元の敵の一覧へ戻る */
export function closeOverlay(o: Overlay): Overlay | null {
  return o.kind === 'card' ? o.back : null;
}
