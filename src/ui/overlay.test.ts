import { describe, expect, it } from 'vitest';
import { closeOverlay, overlayTap } from './overlay';
import type { Overlay } from './overlay';
import { CARD_CLOSE_BTN, ENEMY_LIST, ENEMY_LIST_CLOSE_BTN, STAT_CARD, enemyListRow } from './layout';
import { enemyCard } from './stat-card';
import { testRegistry } from '../core/testing';

const card = enemyCard(testRegistry(), 'tatemochi', 1);

describe('overlayTap', () => {
  it('札の外を押すと閉じる。中を押しても何も起きない', () => {
    const o: Overlay = { kind: 'card', card, back: null };
    expect(overlayTap(o, { x: 5, y: 5 })).toEqual({ type: 'close' });
    expect(overlayTap(o, { x: STAT_CARD.x + 20, y: STAT_CARD.y + 20 })).toEqual({ type: 'none' });
    expect(overlayTap(o, { x: CARD_CLOSE_BTN.x + 5, y: CARD_CLOSE_BTN.y + 5 })).toEqual({ type: 'close' });
  });

  it('敵の一覧の行を押すとその札が開く', () => {
    const list: Overlay = { kind: 'enemies', title: 't', enemies: [{ defId: 'tatemochi', name: '盾持ち', count: 1 }], cards: [card] };
    const r = enemyListRow(0);
    expect(overlayTap(list, { x: r.x + 5, y: r.y + 5 })).toEqual({ type: 'open', card });
  });

  it('敵の一覧は、行の無い所は何も起きず、閉じるボタンと外で閉じる', () => {
    const list: Overlay = { kind: 'enemies', title: 't', enemies: [{ defId: 'tatemochi', name: '盾持ち', count: 1 }], cards: [card] };
    const empty = enemyListRow(1);
    expect(overlayTap(list, { x: empty.x + 5, y: empty.y + 5 })).toEqual({ type: 'none' });
    expect(overlayTap(list, { x: ENEMY_LIST_CLOSE_BTN.x + 5, y: ENEMY_LIST_CLOSE_BTN.y + 5 })).toEqual({ type: 'close' });
    expect(overlayTap(list, { x: ENEMY_LIST.x - 10, y: ENEMY_LIST.y + 10 })).toEqual({ type: 'close' });
  });
});

describe('closeOverlay', () => {
  it('札を閉じると開いた元の一覧へ戻り、一覧を閉じると何も残らない', () => {
    const list: Overlay = { kind: 'enemies', title: 't', enemies: [], cards: [] };
    expect(closeOverlay({ kind: 'card', card, back: list })).toBe(list);
    expect(closeOverlay({ kind: 'card', card, back: null })).toBeNull();
    expect(closeOverlay(list)).toBeNull();
  });
});
