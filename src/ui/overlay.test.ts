import { describe, expect, it } from 'vitest';
import { applySortieToggle, closeOverlay, overlayTap } from './overlay';
import type { SortieOverlay } from './overlay';
import { initialSortie, sortieCandidates } from '../core/sortie';
import type { Rect } from './hit';
import type { Overlay } from './overlay';
import {
  CARD_CLOSE_BTN, ENEMY_LIST, ENEMY_LIST_CLOSE_BTN, SORTIE_DECIDE_BTN, STAT_CARD, enemyListRow, sortieSlot, sortieStrengthBtn,
} from './layout';
import { enemyCard } from './stat-card';
import { testRegistry } from '../core/testing';

const card = enemyCard(testRegistry(), 'tatemochi', 1, 1);

describe('overlayTap', () => {
  it('カードの外を押すと閉じる。中を押しても何も起きない', () => {
    const o: Overlay = { kind: 'card', card, back: null };
    expect(overlayTap(o, { x: 5, y: 5 })).toEqual({ type: 'close' });
    expect(overlayTap(o, { x: STAT_CARD.x + 20, y: STAT_CARD.y + 20 })).toEqual({ type: 'none' });
    expect(overlayTap(o, { x: CARD_CLOSE_BTN.x + 5, y: CARD_CLOSE_BTN.y + 5 })).toEqual({ type: 'close' });
  });

  it('敵の一覧の行を押すとそのカードが開く', () => {
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
  it('カードを閉じると開いた元の一覧へ戻り、一覧を閉じると何も残らない', () => {
    const list: Overlay = { kind: 'enemies', title: 't', enemies: [], cards: [] };
    expect(closeOverlay({ kind: 'card', card, back: list })).toBe(list);
    expect(closeOverlay({ kind: 'card', card, back: null })).toBeNull();
    expect(closeOverlay(list)).toBeNull();
  });
});

describe('出撃の一覧', () => {
  const reg = testRegistry();
  const stage = reg.stages.find((s) => s.id === 'stage9')!;
  const M9 = ['ally05', 'ally07', 'ally09', 'ally12', 'ally10', 'ally06', 'ally11', 'ally13'];
  const candidates = sortieCandidates(reg, stage, M9);
  const make = (chosen: string[], message: string | null = null): SortieOverlay =>
    ({ kind: 'sortie', stage, candidates, chosen, message });
  const full = initialSortie(reg, stage, M9, []);
  const nameOf = (id: string) => reg.units.get(id)!.name;
  const center = (r: Rect) => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 });

  it('枠を押すと toggle、強さを押すと strength', () => {
    const o = make(full);
    const slot = sortieSlot(1);
    expect(overlayTap(o, { x: slot.x + 10, y: slot.y + 10 })).toEqual({ type: 'toggle', id: candidates[1] });
    expect(overlayTap(o, center(sortieStrengthBtn(slot)))).toEqual({ type: 'strength', id: candidates[1] });
  });
  it('一覧の外を押しても閉じない', () => {
    expect(overlayTap(make(full), { x: 2, y: 2 })).toEqual({ type: 'none' });
  });
  it('決めるで decide。0 人のときは押せない', () => {
    expect(overlayTap(make(full), center(SORTIE_DECIDE_BTN))).toEqual({ type: 'decide' });
    expect(overlayTap(make([]), center(SORTIE_DECIDE_BTN))).toEqual({ type: 'none' });
  });
  it('候補の数より後ろの枠は何も起きない', () => {
    const slot = sortieSlot(candidates.length);
    expect(overlayTap(make(full), center(slot))).toEqual({ type: 'none' });
  });
  it('8 人で入れようとすると断りの文', () => {
    const o = applySortieToggle(make(full), 'ally12', nameOf);
    expect(o.chosen).toEqual(full);
    expect(o.message).toBe('8 人まで。先に 誰かを 外す');
  });
  it('外せない仲間を外そうとすると名前入りの断りの文', () => {
    const o = applySortieToggle(make(full), 'roran', nameOf);
    expect(o.chosen).toEqual(full);
    expect(o.message).toBe(`${nameOf('roran')}は 倒れたら 負けなので 外せない`);
  });
  it('入れ直すと断りの文が消える', () => {
    const refused = applySortieToggle(make(full), 'ally12', nameOf);
    const removed = applySortieToggle(refused, 'gau', nameOf);
    expect(removed.message).toBeNull();
    expect(removed.chosen).not.toContain('gau');
    expect(applySortieToggle(removed, 'ally12', nameOf).chosen).toContain('ally12');
  });
  it('カードを閉じると、選択中の一覧に戻る', () => {
    const o = applySortieToggle(make(full), 'gau', nameOf);
    const back = closeOverlay({ kind: 'card', card, back: o });
    expect(back).toBe(o);
    expect((back as SortieOverlay).chosen).toEqual(o.chosen);
  });
});
