import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { validateEnemyDef, validateUnitDef } from './schema';
import type { MapSheet } from './schema';

/** PNG の IHDR は先頭24バイトに入っている。幅は 16、高さは 20 バイト目から */
function pngSize(path: string): { w: number; h: number } {
  const b = readFileSync(path);
  const sig = b.subarray(0, 8).toString('hex');
  if (sig !== '89504e470d0a1a0a') throw new Error(`PNG では ない: ${path}`);
  if (b.subarray(12, 16).toString('latin1') !== 'IHDR') throw new Error(`IHDR が ない: ${path}`);
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
}

function sheetsInDir(dir: string, validate: (file: string, raw: unknown) => { ok: boolean; value?: unknown }):
  { file: string; sheet: MapSheet }[] {
  const out: { file: string; sheet: MapSheet }[] = [];
  for (const name of readdirSync(dir)) {
    if (!name.endsWith('.json')) continue;
    const file = join(dir, name);
    const r = validate(file, JSON.parse(readFileSync(file, 'utf8')));
    // ここはテストの外（読み込み時）なので expect は使わない
    if (!r.ok) throw new Error(`${file} の けんしょうに しっぱい`);
    const sheet = (r.value as { sprites: { map: MapSheet | null } }).sprites.map;
    if (sheet !== null) out.push({ file, sheet });
  }
  return out;
}

const SHEETS = [
  ...sheetsInDir('assets/units', validateUnitDef),
  ...sheetsInDir('assets/enemies', validateEnemyDef),
];

describe('シートの じっすんと JSON', () => {
  it('シートを もつ ユニットが 1たい いじょう ある', () => {
    expect(SHEETS.length).toBeGreaterThan(0);
  });

  it.each(SHEETS)('$sheet.sheet の たてよこが JSON と あう', ({ file, sheet }) => {
    const { w, h } = pngSize(join('assets/images', sheet.sheet));
    const cols = Math.max(sheet.idle.frames, sheet.walk.frames, sheet.attack.frames);

    expect(w, `${file}: よこは frame × さいだいコマすう`).toBe(sheet.frame * cols);
    // 3状態 × 4方向 = 12行
    expect(h, `${file}: たては frame × 12`).toBe(sheet.frame * 12);
  });
});
