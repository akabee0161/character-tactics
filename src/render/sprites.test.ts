import { describe, expect, it } from 'vitest';
import { FOOT_BELOW } from '../engine/footprint';
import { FOOT_INSET, TILE_SIDES, bodyCenter, smoothFor, tileSide } from './sprites';
import type { SpriteDef } from './sprites';

const ANIM = { frames: 1, fps: 1 };
function withSheet(frame: number): SpriteDef {
  return {
    color: '#ffffff', role: '',
    sprites: { role: null, face: null, map: { sheet: 'x.png', frame, idle: ANIM, walk: ANIM, attack: ANIM } },
  };
}
const NO_SHEET: SpriteDef = { color: '#ffffff', role: '', sprites: { role: null, face: null, map: null } };

describe('bodyCenter', () => {
  it('32px のコマでは、足元の行（y=30）が足元に来るよう、中心は 14px 上', () => {
    expect(FOOT_INSET).toBe(2);
    expect(bodyCenter({ x: 100, y: 200 }, withSheet(32), 11)).toEqual({ x: 100, y: 186 });
  });

  it('48px のコマ（ガルム）では 22px 上', () => {
    expect(bodyCenter({ x: 100, y: 200 }, withSheet(48), 11)).toEqual({ x: 100, y: 178 });
  });

  it('シートが無ければ、丸の下端が足元に来るよう fallback ぶん上', () => {
    expect(bodyCenter({ x: 100, y: 200 }, NO_SHEET, 11)).toEqual({ x: 100, y: 189 });
  });
});

describe('smoothFor', () => {
  it('64px の顔を 32px の枠に出すときはぼかす', () => {
    expect(smoothFor(64, 32)).toBe(true);
  });

  it('等倍ではぼかさない', () => {
    expect(smoothFor(64, 64)).toBe(false);
  });

  it('拡大ではぼかさない（16px の役割アイコンを 32px で出すなど）', () => {
    expect(smoothFor(16, 32)).toBe(false);
  });

  it('差し替え前の 128px の顔は、64px の枠でも 32px の枠でもぼかす', () => {
    expect(smoothFor(128, 64)).toBe(true);
    expect(smoothFor(128, 32)).toBe(true);
  });
});

describe('足元の箱', () => {
  it('下の幅は、足元の行から絵の下端までの FOOT_INSET と同じ', () => {
    expect(FOOT_BELOW).toBe(FOOT_INSET);
  });
});

describe('tileSide', () => {
  const img = (w: number, h = w) => ({ naturalWidth: w, naturalHeight: h }) as HTMLImageElement;

  it('16px と 32px の画像は、その一辺を返す', () => {
    expect(tileSide(img(16))).toBe(16);
    expect(tileSide(img(32))).toBe(32);
  });

  it('それ以外の大きさ（読み込み前の 0 を含む）は 0（単色で描く）', () => {
    expect(tileSide(img(24))).toBe(0);
    expect(tileSide(img(0))).toBe(0);
  });

  it('正方形でない画像は、幅が 16px か 32px でも 0（正方形に引き伸ばさない）', () => {
    expect(tileSide(img(32, 64))).toBe(0);
    expect(tileSide(img(16, 32))).toBe(0);
  });

  it('描けるタイルの一辺は、どれも1マス（32px）を割り切る', () => {
    for (const side of TILE_SIDES) expect(32 % side).toBe(0);
  });
});
