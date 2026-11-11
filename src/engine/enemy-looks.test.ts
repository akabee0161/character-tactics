import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
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

describe('ステージへの割り当て', () => {
  const STAGE_DIR = 'assets/stages';
  const BASES = ['narazumono', 'tatemochi', 'yumihei', 'majinaishi', 'garum'];
  type StageJson = {
    enemies: { defId: string; pos: unknown; ai: unknown }[];
    spawners?: { defId: string }[];
  };
  const stageFiles = readdirSync(STAGE_DIR).filter((f) => f.endsWith('.json'));
  const kindById = new Map(DEFS.map((d) => [d.id, kindOf(d)]));
  const load = (f: string): StageJson => JSON.parse(readFileSync(join(STAGE_DIR, f), 'utf8')) as StageJson;

  it('2 体以上いる種類は、2 つ以上の見た目で出る', () => {
    for (const f of stageFiles) {
      const byKind = new Map<string, string[]>();
      for (const e of load(f).enemies) {
        const k = kindById.get(e.defId) ?? e.defId;
        byKind.set(k, [...(byKind.get(k) ?? []), e.defId]);
      }
      for (const [k, ids] of byKind) {
        if (ids.length >= 2) expect(new Set(ids).size, `${f} ${k}`).toBeGreaterThanOrEqual(2);
      }
    }
  });

  it('ならず者は同じ見た目が 2 体並ばない', () => {
    for (const f of stageFiles) {
      const ids = load(f).enemies.map((e) => e.defId).filter((id) => kindById.get(id) === 'narazumono');
      for (let i = 1; i < ids.length; i++) expect(ids[i], `${f} ${i}`).not.toBe(ids[i - 1]);
    }
  });

  it('時間湧きの defId は 1 つ目の見た目のまま', () => {
    for (const f of stageFiles) {
      for (const s of load(f).spawners ?? []) expect(BASES, `${f} ${s.defId}`).toContain(s.defId);
    }
  });

  it('敵の位置・AI・数はステージごとに変わらない', () => {
    for (const f of stageFiles) {
      const before = JSON.parse(
        execFileSync('git', ['show', `main:${STAGE_DIR}/${f}`], { encoding: 'utf8' }),
      ) as StageJson;
      const now = load(f);
      expect(now.enemies.length, f).toBe(before.enemies.length);
      now.enemies.forEach((e, i) => {
        expect(e.pos, `${f} ${i}`).toEqual(before.enemies[i]!.pos);
        expect(e.ai, `${f} ${i}`).toEqual(before.enemies[i]!.ai);
      });
    }
  });
});
