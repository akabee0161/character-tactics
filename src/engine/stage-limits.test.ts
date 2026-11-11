import { describe, expect, it } from 'vitest';
import { testRegistry } from '../core/testing';

describe('ステージの敵の総数', () => {
  it('どのステージも enemies と spawners の total の合計が 16 体以下', () => {
    const reg = testRegistry();
    for (const s of reg.stages) {
      const total = s.enemies.length + s.spawners.reduce((sum, sp) => sum + sp.total, 0);
      expect(total, `${s.id} の敵の総数`).toBeLessThanOrEqual(16);
    }
  });
});
