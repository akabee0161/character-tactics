import { describe, expect, it } from 'vitest';
import { TAP_SLOP, resolveMapGesture } from './input';
import type { PointerStart } from './input';

const at = (x: number, y: number) => ({ x, y });

function start(uid: PointerStart['uid'], wasSelected = false): PointerStart {
  return { uid, startMap: at(100, 100), wasSelected, pointerId: 0 };
}

describe('resolveMapGesture', () => {
  it('キャラを短くタップしたら選択する', () => {
    expect(resolveMapGesture(start('roran'), at(103, 101), null))
      .toEqual({ type: 'select', uid: 'roran' });
  });

  it('選択中のキャラを短くタップしたら選択を外す', () => {
    expect(resolveMapGesture(start('roran', true), at(103, 101), 'roran'))
      .toEqual({ type: 'deselect' });
  });

  it('キャラを掴んで動かしたら、そのキャラへの移動になる', () => {
    expect(resolveMapGesture(start('roran'), at(300, 100), null))
      .toEqual({ type: 'moveUnit', uid: 'roran', dest: at(300, 100) });
  });

  it('地面を短くタップしたら、選択中のキャラへの移動になる', () => {
    expect(resolveMapGesture(start(null), at(103, 101), 'ines'))
      .toEqual({ type: 'moveUnit', uid: 'ines', dest: at(103, 101) });
  });

  it('選択中のキャラがいなければ、地面のタップは何もしない', () => {
    expect(resolveMapGesture(start(null), at(103, 101), null)).toEqual({ type: 'none' });
  });

  it('地面を掴んで動かしても何も起きない（誤操作を移動にしない）', () => {
    expect(resolveMapGesture(start(null), at(300, 100), 'ines')).toEqual({ type: 'none' });
  });

  it('しきい値ちょうどはタップ扱い', () => {
    const end = at(100 + TAP_SLOP, 100);
    expect(resolveMapGesture(start(null), end, 'ines'))
      .toEqual({ type: 'moveUnit', uid: 'ines', dest: end });
  });
});
