import { describe, expect, it } from 'vitest';
import type { Registry } from '../engine/registry';
import type { EnemyDef, MapSheet, UnitDef } from '../engine/schema';
import { DIRS, STATES } from '../render/anim';
import { FOOT_INSET } from '../render/sprites';
import { CELL_PAD, LABEL_H, layoutUnitView, pickViewEntries } from './unit-view-layout';
import type { ViewEntry } from './unit-view-layout';

function sheet(name: string, frame: number, frames: [number, number, number] = [2, 4, 3]): MapSheet {
  return {
    sheet: name, frame,
    idle: { frames: frames[0], fps: 4 }, walk: { frames: frames[1], fps: 8 }, attack: { frames: frames[2], fps: 8 },
  } as MapSheet;
}

function unit(id: string, map: MapSheet | null, extra: Partial<UnitDef> = {}): UnitDef {
  return { id, sprites: { role: null, face: null, faceSmall: null, map }, ...extra } as UnitDef;
}

function enemy(id: string, map: MapSheet | null, bowDamageCap: number | null = null): EnemyDef {
  return { id, sprites: { role: null, face: null, faceSmall: null, map }, bowDamageCap } as EnemyDef;
}

function registry(units: UnitDef[], enemies: EnemyDef[]): Registry {
  return {
    units: new Map(units.map((u) => [u.id, u])),
    enemies: new Map(enemies.map((e) => [e.id, e])),
  } as unknown as Registry;
}

function entry(i: number, frame: number): ViewEntry {
  return { defId: `d${i}`, isAlly: i % 2 === 0, flying: false, bowCap: false, sheet: sheet(`s${i}.png`, frame, [2, 4, 3 + (i % 3)]) };
}

describe('pickViewEntries', () => {
  it('シートを共有する定義は 1 区画にまとめ、味方を選ぶ', () => {
    const shared = sheet('a-map.png', 32);
    const r = registry([unit('a', shared)], [enemy('a-foe', shared)]);
    const e = pickViewEntries(r);
    expect(e).toHaveLength(1);
    expect(e[0]).toMatchObject({ defId: 'a', isAlly: true });
  });

  it('シートを持たない定義は入れない', () => {
    const r = registry([unit('a', null)], [enemy('b', null)]);
    expect(pickViewEntries(r)).toEqual([]);
  });

  it('味方は ID 順、その後に敵が ID 順で並ぶ。飛行と弓の印の有無を持つ', () => {
    const r = registry(
      [unit('b', sheet('b.png', 32), { flying: true }), unit('a', sheet('a.png', 32))],
      [enemy('y', sheet('y.png', 32), 5), enemy('x', sheet('x.png', 48))],
    );
    const e = pickViewEntries(r);
    expect(e.map((v) => v.defId)).toEqual(['a', 'b', 'x', 'y']);
    expect(e.map((v) => v.isAlly)).toEqual([true, true, false, false]);
    expect(e.map((v) => v.flying)).toEqual([false, true, false, false]);
    expect(e.map((v) => v.bowCap)).toEqual([false, false, false, true]);
  });
});

describe('layoutUnitView', () => {
  it('区画は 12 行 × 最大のコマ数の升を持つ', () => {
    const l = layoutUnitView([entry(0, 32)], 2048);
    const cells = l.sections[0]!.cells;
    expect(cells).toHaveLength(12 * 4); // idle 2・walk 4・attack 3 → 最大 4 コマ
    for (const c of cells) {
      expect(c.state).toBe(STATES[Math.floor(c.row / 4)]);
      expect(c.dir).toBe(DIRS[c.row % 4]);
    }
    expect(new Set(cells.map((c) => c.col))).toEqual(new Set([0, 1, 2, 3]));
  });

  it('48px のシートの升は 48 + 2 × 16', () => {
    const l = layoutUnitView([entry(0, 48)], 2048);
    for (const c of l.sections[0]!.cells) {
      expect(c.box.w).toBe(48 + 2 * CELL_PAD);
      expect(c.box.h).toBe(48 + 2 * CELL_PAD);
    }
    expect(CELL_PAD).toBe(16);
  });

  const many = Array.from({ length: 40 }, (_, i) => entry(i, i % 3 === 0 ? 48 : 32));

  type Rect = { x: number; y: number; w: number; h: number };
  function rects(l: ReturnType<typeof layoutUnitView>): { kind: string; r: Rect }[] {
    const out: { kind: string; r: Rect }[] = [];
    for (const s of l.sections) {
      const w = Math.max(...s.cells.map((c) => c.box.x + c.box.w)) - s.label.x;
      out.push({ kind: `帯 ${s.entry.defId}`, r: { x: s.label.x, y: s.label.y, w, h: LABEL_H } });
      for (const c of s.cells) out.push({ kind: `升 ${s.entry.defId} ${c.row},${c.col}`, r: c.box });
    }
    return out;
  }
  const overlaps = (a: Rect, b: Rect) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

  it('升どうしも、升と文字の帯も重ならない', () => {
    const rs = rects(layoutUnitView(many, 2048));
    const hit: string[] = [];
    for (let i = 0; i < rs.length; i++) {
      for (let j = i + 1; j < rs.length; j++) {
        if (overlaps(rs[i]!.r, rs[j]!.r)) hit.push(`${rs[i]!.kind} × ${rs[j]!.kind}`);
      }
    }
    expect(hit.slice(0, 5)).toEqual([]);
  });

  it('全部がキャンバスに収まり、全体の高さと幅は 8192 以下', () => {
    const l = layoutUnitView(many, 2048);
    expect(l.width).toBeLessThanOrEqual(8192);
    expect(l.height).toBeLessThanOrEqual(8192);
    for (const { kind, r } of rects(l)) {
      expect(r.x, kind).toBeGreaterThanOrEqual(0);
      expect(r.y, kind).toBeGreaterThanOrEqual(0);
      expect(r.x + r.w, kind).toBeLessThanOrEqual(l.width);
      expect(r.y + r.h, kind).toBeLessThanOrEqual(l.height);
    }
  });

  it('足元は升の中で、コマの下端から FOOT_INSET 上', () => {
    for (const frame of [32, 48]) {
      const l = layoutUnitView([entry(0, frame)], 2048);
      for (const c of l.sections[0]!.cells) {
        // コマの正方形は升の四方を CELL_PAD だけ空けた内側
        const frameBottom = c.box.y + CELL_PAD + frame;
        expect(c.foot.y).toBe(frameBottom - FOOT_INSET);
        expect(c.foot.x).toBe(c.box.x + c.box.w / 2);
        expect(c.foot.x).toBeGreaterThan(c.box.x);
        expect(c.foot.y).toBeLessThan(c.box.y + c.box.h);
        expect(Number.isInteger(c.foot.x) && Number.isInteger(c.foot.y)).toBe(true);
      }
    }
  });

  it('maxWidth を超えたら次の段へ送る', () => {
    const l = layoutUnitView([entry(0, 32), entry(1, 32), entry(2, 32)], 600);
    const ys = new Set(l.sections.map((s) => s.label.y));
    expect(ys.size).toBeGreaterThan(1);
    expect(l.width).toBeLessThanOrEqual(600);
  });
});
