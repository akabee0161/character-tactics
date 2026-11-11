import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { validateEnemyDef } from './schema';
import type { EnemyDef } from './schema';

const DIR = 'assets/enemies';

function loadAll(): EnemyDef[] {
  const out: EnemyDef[] = [];
  for (const name of readdirSync(DIR)) {
    if (!name.endsWith('.json')) continue;
    const file = join(DIR, name);
    const r = validateEnemyDef(file, JSON.parse(readFileSync(file, 'utf8')));
    if (!r.ok) throw new Error(`${file} の 検証に 失敗`);
    out.push(r.value);
  }
  return out;
}

const DEFS = loadAll();
const KINDS = { narazumono: 14, tatemochi: 2, yumihei: 3, majinaishi: 3 } as const;

function kindOf(d: EnemyDef): string {
  return d.kind ?? d.id;
}

/** id・sprites.map.sheet・color を除いた中身 */
function stripLook(d: EnemyDef): unknown {
  const copy = JSON.parse(JSON.stringify(d)) as {
    id?: string;
    color?: string;
    sprites: { map: { sheet?: string } | null };
  };
  delete copy.id;
  delete copy.color;
  if (copy.sprites.map) delete copy.sprites.map.sheet;
  return copy;
}

describe('敵の見た目ごとの定義', () => {
  it.each(Object.keys(KINDS))('同じ kind の定義は、id・sprites.map.sheet・color 以外が一致する: %s', (kind) => {
    const group = DEFS.filter((d) => kindOf(d) === kind);
    expect(group.length).toBeGreaterThan(0);
    const first = stripLook(group[0]!);
    for (const d of group) expect(stripLook(d), d.id).toEqual(first);
  });

  it('種類ごとの見た目の数', () => {
    for (const [kind, n] of Object.entries(KINDS)) {
      expect(DEFS.filter((d) => kindOf(d) === kind).length, kind).toBe(n);
    }
  });

  it('kind を持つ定義は、kind の定義（id が kind と同じ）が存在する', () => {
    const ids = new Set(DEFS.map((d) => d.id));
    for (const d of DEFS) {
      if (d.kind !== undefined) expect(ids.has(d.kind), `${d.id} の kind ${d.kind}`).toBe(true);
    }
  });

  it('説得の相手・ガルムの定義は変えていない', () => {
    const expected: Record<string, string> = {
      'ally06-foe': 'ally06-map.png',
      'ally08-foe': 'ally08-map.png',
      garum: 'garum-map.png',
    };
    for (const [id, sheet] of Object.entries(expected)) {
      const d = DEFS.find((x) => x.id === id);
      expect(d, id).toBeDefined();
      expect(d?.kind, id).toBeUndefined();
      expect(d?.sprites.map?.sheet, id).toBe(sheet);
    }
  });
});
