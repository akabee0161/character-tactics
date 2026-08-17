import { describe, expect, it } from 'vitest';
import { STAGES } from './index';
import { cellIndexAt, computeFlowField, isWalkableAt, makeGrid } from '../../core/field';

describe('STAGES', () => {
  it('3 ステージある', () => {
    expect(STAGES).toHaveLength(3);
  });

  it('id は 1,2,3 の順', () => {
    expect(STAGES.map((s) => s.id)).toEqual([1, 2, 3]);
  });

  it('ステージ名に漢字が含まれない', () => {
    for (const s of STAGES) {
      expect(s.name, `stage ${s.id}`).not.toMatch(/[一-鿿]/);
    }
  });

  for (const stage of STAGES) {
    describe(`ステージ ${stage.id}`, () => {
      it('マップは 30 列 x 14 行で、全行の長さがそろっている', () => {
        expect(stage.mapRows).toHaveLength(14);
        for (const row of stage.mapRows) expect(row.length).toBe(30);
      });

      it('いちばん下の行はすべて海（ポートレートバーが重なるため）', () => {
        expect(stage.mapRows[13]).toBe('#'.repeat(30));
      });

      it('砦は歩ける場所にある', () => {
        const grid = makeGrid(stage.cell, stage.mapRows);
        expect(isWalkableAt(grid, stage.fort)).toBe(true);
      });

      it('上陸地点はすべて歩ける場所にある', () => {
        const grid = makeGrid(stage.cell, stage.mapRows);
        for (const l of stage.landings) {
          expect(isWalkableAt(grid, l), `landing ${l.x},${l.y}`).toBe(true);
        }
      });

      it('すべての上陸地点から砦へ到達できる', () => {
        const grid = makeGrid(stage.cell, stage.mapRows);
        const field = computeFlowField(grid, stage.fort);
        for (const l of stage.landings) {
          const idx = cellIndexAt(grid, l);
          expect(field.dist[idx], `landing ${l.x},${l.y}`).toBeGreaterThan(0);
        }
      });

      it('3 ウェーブある', () => {
        expect(stage.waves).toHaveLength(3);
      });

      it('1 ウェーブの敵は 6 体まで', () => {
        for (const w of stage.waves) expect(w.spawns.length).toBeLessThanOrEqual(6);
      });

      it('すべてのスポーン地点が上陸地点のいずれかと一致する', () => {
        const keys = new Set(stage.landings.map((l) => `${l.x},${l.y}`));
        for (const w of stage.waves) {
          for (const sp of w.spawns) expect(keys.has(`${sp.from.x},${sp.from.y}`)).toBe(true);
        }
      });

      it('スポーン時刻は 0 以上', () => {
        for (const w of stage.waves) {
          for (const sp of w.spawns) expect(sp.at).toBeGreaterThanOrEqual(0);
        }
      });

      it('ガルムが登場する', () => {
        const kinds = stage.waves.flatMap((w) => w.spawns.map((s) => s.kind));
        expect(kinds).toContain('garum');
      });
    });
  }

  it('たてもちはステージ 3 でだけ出る', () => {
    for (const stage of STAGES) {
      const kinds = stage.waves.flatMap((w) => w.spawns.map((s) => s.kind));
      expect(kinds.includes('tatemochi'), `stage ${stage.id}`).toBe(stage.id === 3);
    }
  });

  it('ガルムはステージ 3 でだけ撤退しない', () => {
    expect(STAGES.map((s) => s.garumFlees)).toEqual([true, true, false]);
  });

  it('ステージ 1 の上陸地点は 1 つ、2 と 3 は 2 つ', () => {
    expect(STAGES.map((s) => s.landings.length)).toEqual([1, 2, 2]);
  });
});
