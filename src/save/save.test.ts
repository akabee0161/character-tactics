import { describe, expect, it } from 'vitest';
import { SAVE_KEY, SAVE_VERSION, loadSave, newSave, writeSave } from './save';
import type { StorageLike } from './save';
import { CHAR_IDS } from '../core/types';

function fakeStorage(initial: Record<string, string> = {}): StorageLike & { data: Record<string, string> } {
  const data = { ...initial };
  return {
    data,
    getItem: (k) => (k in data ? data[k]! : null),
    setItem: (k, v) => { data[k] = v; },
  };
}

describe('newSave', () => {
  it('全員レベル1、クリア 0 ステージ、称号なし', () => {
    const s = newSave();
    expect(s.version).toBe(SAVE_VERSION);
    expect(s.clearedStages).toBe(0);
    expect(s.titles).toEqual([]);
    for (const id of CHAR_IDS) {
      expect(s.chars[id]).toEqual({ level: 1, xp: 0 });
    }
  });
});

describe('writeSave / loadSave', () => {
  it('書いたものが読み戻せる', () => {
    const st = fakeStorage();
    const data = newSave();
    data.clearedStages = 2;
    data.chars.roran = { level: 3, xp: 17 };
    data.counters.funbaruUses = 9;
    data.titles = ['gamanzuyoi'];

    writeSave(st, data);
    expect(loadSave(st)).toEqual(data);
  });

  it('決まったキーに書く', () => {
    const st = fakeStorage();
    writeSave(st, newSave());
    expect(Object.keys(st.data)).toEqual([SAVE_KEY]);
  });

  it('セーブがなければ null', () => {
    expect(loadSave(fakeStorage())).toBeNull();
  });

  it('壊れた JSON なら null', () => {
    expect(loadSave(fakeStorage({ [SAVE_KEY]: '{{{' }))).toBeNull();
  });

  it('バージョンが違えば null', () => {
    const old = JSON.stringify({ ...newSave(), version: SAVE_VERSION + 1 });
    expect(loadSave(fakeStorage({ [SAVE_KEY]: old }))).toBeNull();
  });

  it('キャラが欠けていれば null', () => {
    const broken = newSave() as unknown as Record<string, unknown>;
    delete (broken.chars as Record<string, unknown>).gau;
    expect(loadSave(fakeStorage({ [SAVE_KEY]: JSON.stringify(broken) }))).toBeNull();
  });

  it('JSON が配列やプリミティブなら null', () => {
    expect(loadSave(fakeStorage({ [SAVE_KEY]: '[]' }))).toBeNull();
    expect(loadSave(fakeStorage({ [SAVE_KEY]: '42' }))).toBeNull();
    expect(loadSave(fakeStorage({ [SAVE_KEY]: 'null' }))).toBeNull();
  });
});
