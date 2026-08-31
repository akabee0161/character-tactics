import { describe, expect, it } from 'vitest';
import { loadSave, newSave, SAVE_KEY, SAVE_VERSION, writeSave } from './save';
import { testRegistry } from '../core/testing';
import type { StorageLike } from './save';

function memoryStorage(initial?: string): StorageLike & { raw: string | null } {
  return {
    raw: initial ?? null,
    getItem(_key: string) { return this.raw; },
    setItem(_key: string, value: string) { this.raw = value; },
  };
}

describe('newSave', () => {
  it('レジストリの すべての ユニットを レベル1で いれる', () => {
    const reg = testRegistry();
    const s = newSave(reg);
    expect(Object.keys(s.units).sort()).toEqual([...reg.units.keys()].sort());
    expect(s.units.roran).toEqual({ level: 1, xp: 0 });
    expect(s.version).toBe(SAVE_VERSION);
    expect(s.clearedStageIds).toEqual([]);
  });
});

describe('loadSave', () => {
  const reg = testRegistry();
  const valid = {
    version: 2,
    clearedStageIds: ['stage1'],
    units: { roran: { level: 3, xp: 10 }, ines: { level: 2, xp: 0 }, mist: { level: 1, xp: 5 }, gau: { level: 1, xp: 0 } },
    counters: { 'bond:supports': 4 },
    titles: ['nakayoshi'],
  };

  it('ただしい セーブを よむ', () => {
    const s = loadSave(memoryStorage(JSON.stringify(valid)), reg);
    expect(s?.units.roran).toEqual({ level: 3, xp: 10 });
    expect(s?.clearedStageIds).toEqual(['stage1']);
  });

  it('セーブが なければ null', () => {
    expect(loadSave(memoryStorage(), reg)).toBeNull();
  });

  it('こわれた JSON なら null', () => {
    expect(loadSave(memoryStorage('{{{'), reg)).toBeNull();
  });

  it('version 1 の きゅうセーブは よみすてる', () => {
    const old = { version: 1, clearedStages: 2, chars: {}, counters: {}, titles: [] };
    expect(loadSave(memoryStorage(JSON.stringify(old)), reg)).toBeNull();
  });

  it('レジストリに ない ユニットの エントリは むしする', () => {
    const raw = { ...valid, units: { ...valid.units, yuurei: { level: 9, xp: 0 } } };
    const s = loadSave(memoryStorage(JSON.stringify(raw)), reg);
    expect(s?.units.yuurei).toBeUndefined();
    expect(s?.units.roran).toEqual({ level: 3, xp: 10 });
  });

  it('レジストリに あって セーブに ない ユニットは レベル1で おぎなう', () => {
    const { gau: _drop, ...units } = valid.units;
    const s = loadSave(memoryStorage(JSON.stringify({ ...valid, units })), reg);
    expect(s?.units.gau).toEqual({ level: 1, xp: 0 });
    expect(s?.units.roran).toEqual({ level: 3, xp: 10 });
  });

  it('かたが こわれた エントリだけを すてて、ほかは のこす', () => {
    const raw = { ...valid, units: { ...valid.units, ines: { level: 'つよい', xp: 0 } } };
    const s = loadSave(memoryStorage(JSON.stringify(raw)), reg);
    expect(s?.units.ines).toEqual({ level: 1, xp: 0 });
    expect(s?.units.roran).toEqual({ level: 3, xp: 10 });
  });

  it('level が 0 いかの エントリは こわれた ちとして すてる', () => {
    const raw = { ...valid, units: { ...valid.units, ines: { level: 0, xp: 0 } } };
    const s = loadSave(memoryStorage(JSON.stringify(raw)), reg);
    expect(s?.units.ines).toEqual({ level: 1, xp: 0 });
    expect(s?.units.roran).toEqual({ level: 3, xp: 10 });
  });

  it('レジストリに ない ステージ id は clearedStageIds から おとす', () => {
    const raw = { ...valid, clearedStageIds: ['stage1', 'kesareta'] };
    expect(loadSave(memoryStorage(JSON.stringify(raw)), reg)?.clearedStageIds).toEqual(['stage1']);
  });

  it('レジストリに ない しょうごうは おとす', () => {
    const raw = { ...valid, titles: ['nakayoshi', 'kesareta'] };
    expect(loadSave(memoryStorage(JSON.stringify(raw)), reg)?.titles).toEqual(['nakayoshi']);
  });

  it('カウンタの あたいが せいすうで なければ その キーだけ おとす', () => {
    const raw = { ...valid, counters: { 'bond:supports': 4, 'kill:neraiuchi': -1 } };
    expect(loadSave(memoryStorage(JSON.stringify(raw)), reg)?.counters).toEqual({ 'bond:supports': 4 });
  });

  it('units が オブジェクトで なければ null', () => {
    expect(loadSave(memoryStorage(JSON.stringify({ ...valid, units: [] })), reg)).toBeNull();
  });
});

describe('writeSave', () => {
  it('かきこめたら true', () => {
    const reg = testRegistry();
    const st = memoryStorage();
    expect(writeSave(st, newSave(reg))).toBe(true);
    expect(JSON.parse(st.raw!).version).toBe(2);
  });

  it('れいがいを なげる ストレージでは false', () => {
    const reg = testRegistry();
    const st: StorageLike = {
      getItem: () => null,
      setItem: () => { throw new Error('いっぱい'); },
    };
    expect(writeSave(st, newSave(reg))).toBe(false);
  });

  it('SAVE_KEY は かわらない', () => {
    expect(SAVE_KEY).toBe('character-tactics/save');
  });
});
