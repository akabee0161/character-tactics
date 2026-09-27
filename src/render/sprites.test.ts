import { describe, expect, it } from 'vitest';
import { FOOT_INSET, bodyCenter } from './sprites';
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
