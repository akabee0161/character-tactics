import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { validateEnemyDef, validateUnitDef } from './schema';
import type { MapSheet } from './schema';
import { readPng } from './png-node';
import type { Rgba } from './png-node';

const STATES = ['idle', 'walk', 'attack'] as const;
const DIR_NAMES = ['down', 'up', 'left', 'right'] as const;

function sheetsInDir(dir: string, validate: (file: string, raw: unknown) => { ok: boolean; value?: unknown }): MapSheet[] {
  const out: MapSheet[] = [];
  for (const name of readdirSync(dir)) {
    if (!name.endsWith('.json')) continue;
    const file = join(dir, name);
    const r = validate(file, JSON.parse(readFileSync(file, 'utf8')));
    // ここはテストの外（読み込み時）なので expect は使わない
    if (!r.ok) throw new Error(`${file} の けんしょうに しっぱい`);
    const sheet = (r.value as { sprites: { map: MapSheet | null } }).sprites.map;
    if (sheet !== null) out.push(sheet);
  }
  return out;
}

// 同じシートを複数の定義が指す（敵の見た目違い・味方と -foe）ので、ファイル名で 1 回に絞る
const UNIQUE = new Map<string, MapSheet>();
for (const s of [...sheetsInDir('assets/units', validateUnitDef), ...sheetsInDir('assets/enemies', validateEnemyDef)]) {
  if (!UNIQUE.has(s.sheet)) UNIQUE.set(s.sheet, s);
}
const SHEETS = [...UNIQUE.values()].map((sheet) => ({ name: sheet.sheet, sheet }));

type Cell = { row: number; col: number; state: (typeof STATES)[number]; dir: (typeof DIR_NAMES)[number] };

function describeCell(name: string, c: Cell): string {
  return `${name} ${c.state} ${c.dir} 列${c.col}`;
}

/** コマ (row, col) の中のアルファを、行ごと (y) に走査する */
function eachAlpha(png: Rgba, sheet: MapSheet, row: number, col: number, fn: (y: number, x: number, a: number) => void): void {
  const f = sheet.frame;
  for (let y = 0; y < f; y++) {
    for (let x = 0; x < f; x++) {
      fn(y, x, png.data[((row * f + y) * png.width + col * f + x) * 4 + 3]!);
    }
  }
}

function cellsOf(sheet: MapSheet): Cell[] {
  const cols = Math.max(sheet.idle.frames, sheet.walk.frames, sheet.attack.frames);
  const out: Cell[] = [];
  for (let row = 0; row < 12; row++) {
    for (let col = 0; col < cols; col++) {
      out.push({ row, col, state: STATES[Math.floor(row / 4)]!, dir: DIR_NAMES[row % 4]! });
    }
  }
  return out;
}

describe('シートの中身（コマと足元）', () => {
  it('シートを持つ定義が 1 つ以上ある', () => {
    expect(SHEETS.length).toBeGreaterThan(0);
  });

  it.each(SHEETS)('$name: 各行の、コマ数より左の列には絵がある', ({ name, sheet }) => {
    const png = readPng(readFileSync(join('assets/images', name)));
    const empty: string[] = [];
    for (const c of cellsOf(sheet)) {
      if (c.col >= sheet[c.state].frames) continue;
      let any = false;
      eachAlpha(png, sheet, c.row, c.col, (_y, _x, a) => { if (a > 0) any = true; });
      if (!any) empty.push(describeCell(name, c));
    }
    expect(empty, '絵が無いコマ').toEqual([]);
  });

  it.each(SHEETS)('$name: 各行の、コマ数から右の列は空', ({ name, sheet }) => {
    const png = readPng(readFileSync(join('assets/images', name)));
    const dirty: string[] = [];
    for (const c of cellsOf(sheet)) {
      if (c.col < sheet[c.state].frames) continue;
      let any = false;
      eachAlpha(png, sheet, c.row, c.col, (_y, _x, a) => { if (a > 0) any = true; });
      if (any) dirty.push(describeCell(name, c));
    }
    expect(dirty, '余りの列に絵があるコマ').toEqual([]);
  });

  // 「足元の行より下は空」は確かめない（依頼者 2026-11-28）。attack の一部のコマが足元の 1 行下（32px で y=31）まで
  // 描いていて、承認済みの絵が問題ないため。足元の位置は npm run unit-view の画素の照らし合わせが見る。
});
