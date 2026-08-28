import { describe, expect, it } from 'vitest';
import { ALL_CHAR_IDS, SAVE_KEY, SAVE_VERSION, loadSave, newSave, writeSave } from './save';
import type { StorageLike } from './save';

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
    for (const id of ALL_CHAR_IDS) {
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

  it('counters のフィールドが数値でなければ null', () => {
    const broken = newSave() as unknown as { counters: Record<string, unknown> };
    broken.counters.bondSupports = 'たくさん';
    expect(loadSave(fakeStorage({ [SAVE_KEY]: JSON.stringify(broken) }))).toBeNull();
  });

  it('counters のフィールドが負の数や小数なら null', () => {
    const negative = newSave() as unknown as { counters: Record<string, unknown> };
    negative.counters.bondSupports = -1;
    expect(loadSave(fakeStorage({ [SAVE_KEY]: JSON.stringify(negative) }))).toBeNull();

    const fractional = newSave() as unknown as { counters: Record<string, unknown> };
    fractional.counters.bondSupports = 1.5;
    expect(loadSave(fakeStorage({ [SAVE_KEY]: JSON.stringify(fractional) }))).toBeNull();
  });

  it('chars の level / xp が負の数や小数なら null', () => {
    const negative = newSave();
    negative.chars.roran = { level: -1, xp: 0 };
    expect(loadSave(fakeStorage({ [SAVE_KEY]: JSON.stringify(negative) }))).toBeNull();

    const fractional = newSave();
    fractional.chars.roran = { level: 1, xp: 0.5 };
    expect(loadSave(fakeStorage({ [SAVE_KEY]: JSON.stringify(fractional) }))).toBeNull();
  });

  it('clearedStages が負の数や小数なら null', () => {
    const negative = { ...newSave(), clearedStages: -1 };
    expect(loadSave(fakeStorage({ [SAVE_KEY]: JSON.stringify(negative) }))).toBeNull();

    const fractional = { ...newSave(), clearedStages: 1.5 };
    expect(loadSave(fakeStorage({ [SAVE_KEY]: JSON.stringify(fractional) }))).toBeNull();
  });

  it('titles が 文字列の 配列であれば OK（レジストリとの照合は Task 11 で追加）', () => {
    const withTitle = { ...newSave(), titles: ['nazono-shougou'] };
    expect(loadSave(fakeStorage({ [SAVE_KEY]: JSON.stringify(withTitle) }))).toEqual(withTitle);
  });
});

describe('writeSave の失敗', () => {
  it('setItem が例外を投げても writeSave は例外を投げず false を返す', () => {
    const throwingStorage: StorageLike = {
      getItem: () => null,
      setItem: () => {
        throw new Error('QuotaExceededError');
      },
    };
    expect(() => writeSave(throwingStorage, newSave())).not.toThrow();
    expect(writeSave(throwingStorage, newSave())).toBe(false);
  });

  it('setItem が成功すれば true を返す', () => {
    const st = fakeStorage();
    expect(writeSave(st, newSave())).toBe(true);
  });
});
