import { describe, expect, it } from 'vitest';
import { AI_BEHAVIORS } from './ai';
import { makeGrid } from './field';
import type { AiDef } from '../engine/schema';
import type { Unit } from './types';

// よこに ながい へや。まんなかに かべが 1れつ ある
const GRID = makeGrid(32, [
  '################',
  '#..............#',
  '#..............#',
  '#######.########',
  '#..............#',
  '#..............#',
  '################',
]);

function unit(uid: string, x: number, y: number, def: AiDef | null, home = { x, y }): Unit {
  return {
    uid, pos: { x, y }, retired: false, side: def ? 'enemy' : 'player',
    ai: def ? { def, mode: 'idle', targetUid: null, home } : null,
  } as unknown as Unit;
}

function run(kind: AiDef['kind'], self: Unit, hostiles: Unit[]) {
  return AI_BEHAVIORS[kind]({ self, hostiles, grid: GRID });
}

describe('sentry', () => {
  const def: AiDef = { kind: 'sentry', sightRange: 100 };

  it('だれも いなければ idle', () => {
    const self = unit('e1', 100, 48, def);
    expect(run('sentry', self, [])).toEqual({ mode: 'idle', targetUid: null, goal: null });
  });

  it('さくてき はんいに はいったら chase', () => {
    const self = unit('e1', 100, 48, def);
    const p = unit('p1', 160, 48, null);
    const d = run('sentry', self, [p]);
    expect(d.mode).toBe('chase');
    expect(d.targetUid).toBe('p1');
    expect(d.goal).toEqual({ x: 160, y: 48 });
  });

  it('さくてき はんいの そとなら idle の まま', () => {
    const self = unit('e1', 100, 48, def);
    const p = unit('p1', 400, 48, null);
    expect(run('sentry', self, [p]).mode).toBe('idle');
  });

  it('かべごしの あいてには きづかない', () => {
    // (3,1) と (3,4) のあいだには y=3 の かべが ある
    const self = unit('e1', 112, 48, def);
    const p = unit('p1', 112, 144, null);
    expect(run('sentry', self, [p]).mode).toBe('idle');
  });

  it('もっとも ちかい あいてを えらぶ', () => {
    const self = unit('e1', 100, 48, def);
    const near = unit('near', 140, 48, null);
    const far = unit('far', 180, 48, null);
    expect(run('sentry', self, [far, near]).targetUid).toBe('near');
  });

  it('たおれた あいては ねらわない', () => {
    const self = unit('e1', 100, 48, def);
    const p = unit('p1', 140, 48, null);
    p.retired = true;
    expect(run('sentry', self, [p]).mode).toBe('idle');
  });

  it('みうしなったら home へ return', () => {
    const self = unit('e1', 200, 48, def, { x: 100, y: 48 });
    const d = run('sentry', self, []);
    expect(d.mode).toBe('return');
    expect(d.goal).toEqual({ x: 100, y: 48 });
    expect(d.targetUid).toBeNull();
  });

  it('home に ついたら idle に もどる', () => {
    const self = unit('e1', 100, 48, def, { x: 100, y: 48 });
    expect(run('sentry', self, []).mode).toBe('idle');
  });

  it('もどる とちゅうでも みつけたら chase に もどる', () => {
    const self = unit('e1', 200, 48, def, { x: 100, y: 48 });
    const p = unit('p1', 240, 48, null);
    expect(run('sentry', self, [p]).mode).toBe('chase');
  });
});

describe('aggressive', () => {
  const def: AiDef = { kind: 'aggressive' };

  it('さくてき はんいを むしして いちばん ちかい あいてを おう', () => {
    const self = unit('e1', 100, 48, def);
    const p = unit('p1', 440, 48, null);
    const d = run('aggressive', self, [p]);
    expect(d.mode).toBe('chase');
    expect(d.targetUid).toBe('p1');
  });

  it('かべごしでも おう', () => {
    const self = unit('e1', 112, 48, def);
    const p = unit('p1', 112, 144, null);
    expect(run('aggressive', self, [p]).mode).toBe('chase');
  });

  it('あいてが いなければ idle', () => {
    const self = unit('e1', 100, 48, def);
    expect(run('aggressive', self, [])).toEqual({ mode: 'idle', targetUid: null, goal: null });
  });

  it('home には もどらない', () => {
    const self = unit('e1', 400, 48, def, { x: 100, y: 48 });
    expect(run('aggressive', self, []).mode).toBe('idle');
  });
});

describe('guard', () => {
  const def: AiDef = { kind: 'guard', post: { x: 100, y: 48 }, leash: 120, sightRange: 100 };

  it('post に いて だれも いなければ idle', () => {
    const self = unit('e1', 100, 48, def);
    expect(run('guard', self, []).mode).toBe('idle');
  });

  it('さくてき はんいに はいったら chase', () => {
    const self = unit('e1', 100, 48, def);
    const p = unit('p1', 160, 48, null);
    expect(run('guard', self, [p]).targetUid).toBe('p1');
  });

  it('post から leash を こえたら ついせきを うちきって もどる', () => {
    const self = unit('e1', 240, 48, def);   // post から 140 > leash 120
    const p = unit('p1', 260, 48, null);
    const d = run('guard', self, [p]);
    expect(d.mode).toBe('return');
    expect(d.targetUid).toBeNull();
    expect(d.goal).toEqual({ x: 100, y: 48 });
  });

  it('leash の うちなら ついせきを つづける', () => {
    const self = unit('e1', 200, 48, def);   // post から 100 <= leash 120
    const p = unit('p1', 240, 48, null);
    expect(run('guard', self, [p]).mode).toBe('chase');
  });

  it('いちど return に なったら post に つくまで ふたたび みえても chase に もどらない（ラッチ）', () => {
    const self = unit('e1', 200, 48, def);   // post から 100 <= leash 120 (leash じたいは こえていない)
    self.ai!.mode = 'return';                // まえの tick で すでに ついせきを うちきっている
    const p = unit('p1', 220, 48, null);     // さくてき はんいに はいっている
    const d = run('guard', self, [p]);
    expect(d.mode).toBe('return');
    expect(d.targetUid).toBeNull();
    expect(d.goal).toEqual({ x: 100, y: 48 });
  });

  it('post は home と べつに もてる', () => {
    const self = unit('e1', 100, 48, def, { x: 400, y: 48 });
    expect(run('guard', self, []).mode).toBe('idle');   // home ではなく post を みる
  });

  it('post に もどる とちゅうは return', () => {
    const self = unit('e1', 180, 48, def);
    expect(run('guard', self, []).goal).toEqual({ x: 100, y: 48 });
  });

  it('かべごしの あいてには きづかない', () => {
    const self = unit('e1', 112, 48, { kind: 'guard', post: { x: 112, y: 48 }, leash: 200, sightRange: 200 });
    const p = unit('p1', 112, 144, null);
    expect(run('guard', self, [p]).mode).toBe('idle');
  });
});
