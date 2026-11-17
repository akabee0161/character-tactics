import { describe, expect, it } from 'vitest';
import { testRegistry } from '../core/testing';
import { sortieSlot } from '../ui/layout';
import { SORTIE_DECIDE_BTN, SORTIE_MESSAGE_Y } from '../ui/layout';
import { MAX_MEMBERS } from './limits';

describe('仲間の数（出撃の一覧の枠）', () => {
  it('仲間の定義は出撃の一覧の枠（15）以下', () => {
    expect(testRegistry().units.size).toBeLessThanOrEqual(MAX_MEMBERS);
    expect(MAX_MEMBERS).toBe(15);
  });

  it('15 番目の枠は断りの文の行・「決める」にかからない', () => {
    const last = sortieSlot(MAX_MEMBERS - 1);
    expect(last.y + last.h).toBeLessThanOrEqual(SORTIE_MESSAGE_Y);
    expect(last.y + last.h).toBeLessThanOrEqual(SORTIE_DECIDE_BTN.y);
  });
});

describe('ステージの敵の総数', () => {
  it('どのステージも enemies と spawners の total の合計が 16 体以下', () => {
    const reg = testRegistry();
    for (const s of reg.stages) {
      const total = s.enemies.length + s.spawners.reduce((sum, sp) => sum + sp.total, 0);
      expect(total, `${s.id} の敵の総数`).toBeLessThanOrEqual(16);
    }
  });
});
