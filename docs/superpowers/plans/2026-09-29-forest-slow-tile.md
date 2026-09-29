# 森で移動が遅くなる（issue #6 の⑤）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 通れるが移動が遅くなるマス（森）を作り、stage1 に置く。森を避けた方が早ければ回り道する。

**Architecture:** ステージの `legend` の項目に `speed`（倍率）を足し、`makeGrid` が `Grid.speed` に埋める。1歩の長さに足元のマスの倍率を掛け、フローフィールドの隣へ移るコストを倍率で割る。まっすぐの線が倍率1でないマスを通るときは直行せずフローフィールドに従う。

**Tech Stack:** TypeScript、Vitest（`npm test`）、Vite（`npm run build`）

**Spec:** `docs/superpowers/specs/2026-09-29-forest-slow-tile-design.md`

## Global Constraints

- 森の倍率は 0.5。`legend` の `speed` は省略時 1、0 より大きく 1 以下の数だけ受け付ける
- `walkable: false` の項目に `speed` を書いたらエラー
- どのマスにいるかは足元の点（`u.pos`）で決める
- 隣へ移るコスト = `Math.round(基本コスト / 2 / 出るマスの倍率 + 基本コスト / 2 / 入るマスの倍率)`（縦横 10・15・20、斜め 14・21・28）
- 直行の条件: 目的地と同じマスにいる、または「足元の箱ごとまっすぐ行ける（`hasClearPath`）かつ足元の点からの線が倍率1でないマスを通らない」
- `kakenukeru` と `hasLineOfSight` の挙動は変えない。`DEFAULT_LEGEND` は変えない
- コミットは Conventional Commits ＋日本語の要約。スキーマのエラーメッセージは既存と同じ文体（ひらがな中心・分かち書き）
- 描画コード（Canvas2D）にユニットテストは書かない。見た目は CDP で確かめる

## Review Focus

- 足元の点がマスの境界ちょうど（x が 32 の倍数）にいるとき、`speedAt` は `cellIndexAt` と同じマス（右・下のマス）の倍率を返すこと → Task 2 のテスト
- 森の中の目的地を指示したとき、フローフィールドで森に入り、目的地のマスで直行に切り替わって止まらず着くこと → Task 4 のテスト
- 森の中にいるユニットが森の外の目的地を指示されたとき、止まらずに森を出て着くこと → Task 4 のテスト
- 敵（AI）も森の中では半分の速さになること → Task 4 のテスト
- 0.5 以外の倍率（例 0.3）でもコストが整数になり、向きで値が変わらないこと → Task 3 のテスト

---

### Task 1: legend に speed を足す（スキーマ）

**Files:**
- Modify: `src/engine/schema.ts:414-416`（`LegendEntry`）、`src/engine/schema.ts:475-496`（`readLegend`）
- Test: `src/engine/schema.test.ts`（`describe('validateStageDef: legend'` の中、583 行目の `it` の後ろ）

**Interfaces:**
- Produces: `export type LegendEntry = { tile: string | null; walkable: boolean; speed?: number }`。`speed` は書かれたときだけ入る（省略時はプロパティ自体が無い。既定値 1 は Task 2 の `makeGrid` で補う）

- [ ] **Step 1: 失敗するテストを書く**

`src/engine/schema.test.ts` の `describe('validateStageDef: legend', ...)` の最後（`walkable が 真偽値で なければ弾く` の後ろ）に足す。

```ts
  it('speed を 書けば legend に はいる', () => {
    const r = validateStageDef('stages/x.json', {
      ...VALID_STAGE,
      mapRows: ['FFFF', 'F..F', 'F..F', 'FFFF'],
      legend: { ...LEGEND, F: { tile: 'tile-forest.png', walkable: true, speed: 0.5 } },
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.legend?.F).toEqual({ tile: 'tile-forest.png', walkable: true, speed: 0.5 });
  });

  it('speed を 省略すると speed は はいらない', () => {
    const r = validateStageDef('stages/x.json', {
      ...VALID_STAGE, mapRows: ['TTTT', 'T..T', 'T..T', 'TTTT'], legend: LEGEND,
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.legend?.['.']).not.toHaveProperty('speed');
  });

  it('speed は 1 ちょうどでも よい', () => {
    const r = validateStageDef('stages/x.json', {
      ...VALID_STAGE,
      mapRows: ['TTTT', 'T..T', 'T..T', 'TTTT'],
      legend: { ...LEGEND, '.': { tile: null, walkable: true, speed: 1 } },
    });
    expect(r.ok).toBe(true);
  });

  it.each([
    ['0', 0, '0 より 大きい かずが ひつよう'],
    ['マイナス', -0.5, '0 より 大きい かずが ひつよう'],
    ['1 より 大きい', 1.5, '1 いかが ひつよう'],
    ['かずで ない', 'slow', 'かずが ひつよう'],
  ])('speed が %s なら弾く', (_label, speed, reason) => {
    const r = validateStageDef('stages/x.json', {
      ...VALID_STAGE,
      mapRows: ['TTTT', 'T..T', 'T..T', 'TTTT'],
      legend: { ...LEGEND, '.': { tile: null, walkable: true, speed } },
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors[0]?.path).toBe('legend...speed');
      expect(r.errors[0]?.reason).toBe(reason);
    }
  });

  it('walkable: false の こうもくに speed が あれば弾く', () => {
    const r = validateStageDef('stages/x.json', {
      ...VALID_STAGE,
      mapRows: ['TTTT', 'T..T', 'T..T', 'TTTT'],
      legend: { ...LEGEND, T: { tile: 'tile-tree.png', walkable: false, speed: 0.5 } },
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors[0]?.path).toBe('legend.T.speed');
      expect(r.errors[0]?.reason).toBe('とおれない マスには かけない');
    }
  });
```

注: キー `.` のパスは `legend.` ＋ `.` ＋ `.speed` で `legend...speed` になる（既存の `path = \`legend.${key}\`` の組み方のまま）。

- [ ] **Step 2: 失敗を確かめる**

Run: `npx vitest run src/engine/schema.test.ts -t "speed"`
Expected: `speed を 書けば legend に はいる` などが FAIL（`speed` が捨てられる／エラーが出ない）

- [ ] **Step 3: 実装する**

`src/engine/schema.ts` の型を変える。

```ts
/**
 * mapRows の1文字が何を表すか。tile は assets/images 内のファイル名。null なら単色で描く。
 * speed はそのマスでの移動の速さの倍率（0 より大きく 1 以下）。省略時は 1 で、書かれたときだけ入る
 */
export type LegendEntry = { tile: string | null; walkable: boolean; speed?: number };
```

`readLegend` のループの `out[key] = { tile, walkable };` を置き換える。

```ts
    const walkable = requireBoolean(ctx, `${path}.walkable`, e.walkable);
    if (walkable === null) continue;
    if (e.speed === undefined) {
      out[key] = { tile, walkable };
      continue;
    }
    if (!walkable) {
      fail(ctx, `${path}.speed`, 'とおれない マスには かけない');
      continue;
    }
    const speed = requireNumber(ctx, `${path}.speed`, e.speed, { max: 1 });
    if (speed === null) continue;
    if (speed <= 0) {
      fail(ctx, `${path}.speed`, '0 より 大きい かずが ひつよう');
      continue;
    }
    out[key] = { tile, walkable, speed };
```

- [ ] **Step 4: 通ることを確かめる**

Run: `npx vitest run src/engine/schema.test.ts`
Expected: PASS（既存の legend のテストも含めて全部）

- [ ] **Step 5: コミット**

```bash
git add src/engine/schema.ts src/engine/schema.test.ts
git commit -m "feat: ステージの legend にマスの移動の速さの倍率 speed を書けるようにする"
```

---

### Task 2: Grid にマスごとの倍率を持たせる（makeGrid・speedAt）

**Files:**
- Modify: `src/core/types.ts:8-13`（`Grid`）、`src/core/field.ts:4-20`（`makeGrid`）、`src/core/field.ts`（`isWalkableAt` の後ろに `speedAt` を足す）
- Test: `src/core/field.test.ts`（`describe('makeGrid'` の中と、新しい `describe('speedAt'`）

**Interfaces:**
- Consumes: Task 1 の `LegendEntry.speed?: number`
- Produces:
  - `Grid` に `speed: number[]`（マス番号 `y * cols + x` ごとの倍率。既定 1）
  - `export function speedAt(grid: Grid, pos: Vec2): number`（足元の点のマスの倍率。マップの外は 1）

- [ ] **Step 1: 失敗するテストを書く**

`src/core/field.test.ts` の import に `speedAt` を足し、`describe('makeGrid', ...)` の中に2つ足す。

```ts
  it('legend が無ければ 全マスの speed は 1', () => {
    const g = makeGrid(32, MAP);
    expect(g.speed).toEqual(new Array(15).fill(1));
  });

  it('legend の speed を マスに入れる。省略した項目は 1', () => {
    const g = makeGrid(32, ['.F', 'T.'], {
      '.': { tile: null, walkable: true },
      F: { tile: null, walkable: true, speed: 0.5 },
      T: { tile: null, walkable: false },
    });
    expect(g.speed).toEqual([1, 0.5, 1, 1]);
  });
```

`describe('isWalkableAt', ...)` の後ろに足す。

```ts
describe('speedAt', () => {
  const g = makeGrid(32, ['.F', '..'], {
    '.': { tile: null, walkable: true },
    F: { tile: null, walkable: true, speed: 0.5 },
  });

  it('足元の点のマスの倍率を返す', () => {
    expect(speedAt(g, { x: 48, y: 16 })).toBe(0.5);
    expect(speedAt(g, { x: 16, y: 16 })).toBe(1);
  });

  it('境界ちょうどは cellIndexAt と同じく右のマス', () => {
    expect(speedAt(g, { x: 32, y: 16 })).toBe(0.5);
    expect(speedAt(g, { x: 31.99, y: 16 })).toBe(1);
  });

  it('マップの外は 1', () => {
    expect(speedAt(g, { x: -5, y: 16 })).toBe(1);
  });
});
```

- [ ] **Step 2: 失敗を確かめる**

Run: `npx vitest run src/core/field.test.ts`
Expected: FAIL（`speedAt` が無い／`g.speed` が undefined）

- [ ] **Step 3: 実装する**

`src/core/types.ts` の `Grid`:

```ts
export type Grid = {
  cols: number;
  rows: number;
  cell: number;
  walkable: boolean[];
  /** マスごとの移動の速さの倍率（legend の speed。省略時 1） */
  speed: number[];
};
```

`src/core/field.ts` の `makeGrid`:

```ts
/** legend を渡さなければ '#' だけが歩けない（legend の無いステージとテストの既定）。速さの倍率は legend の speed、無ければ 1 */
export function makeGrid(cell: number, rows: string[], legend?: Legend): Grid {
  const r = rows.length;
  const c = rows[0]?.length ?? 0;
  const walkable = new Array<boolean>(c * r);
  const speed = new Array<number>(c * r);
  for (let y = 0; y < r; y++) {
    const line = rows[y] ?? '';
    if (line.length !== c) {
      throw new Error(`grid row ${y} has length ${line.length}, expected ${c}`);
    }
    for (let x = 0; x < c; x++) {
      const ch = line[x]!;
      walkable[y * c + x] = legend ? legend[ch]?.walkable === true : ch !== '#';
      speed[y * c + x] = legend?.[ch]?.speed ?? 1;
    }
  }
  return { cols: c, rows: r, cell, walkable, speed };
}
```

`isWalkableAt` の後ろに:

```ts
/** 足元の点のマスでの移動の速さの倍率。マップの外は 1 */
export function speedAt(grid: Grid, pos: Vec2): number {
  const i = cellIndexAt(grid, pos);
  return i < 0 ? 1 : (grid.speed[i] ?? 1);
}
```

- [ ] **Step 4: 通ることを確かめる**

Run: `npx vitest run src/core/field.test.ts && npx tsc --noEmit`
Expected: PASS、型エラー無し（`Grid` をオブジェクトリテラルで作っている箇所があれば型エラーになるので、そこに `speed` を足す。2026-09-29 時点では `makeGrid` だけ）

- [ ] **Step 5: コミット**

```bash
git add src/core/types.ts src/core/field.ts src/core/field.test.ts
git commit -m "feat: Grid にマスごとの移動の速さの倍率を持たせ、足元のマスの倍率を返す speedAt を足す"
```

---

### Task 3: フローフィールドのコストに倍率を反映する

**Files:**
- Modify: `src/core/field.ts:64-125`（`ORTHO_COST` 付近と `computeFlowField`）
- Test: `src/core/field.test.ts`（`describe('computeFlowField'` の中）

**Interfaces:**
- Consumes: Task 2 の `Grid.speed`
- Produces: `export function stepCost(base: number, fromSpeed: number, toSpeed: number): number`（隣へ移るコスト。`computeFlowField` の中で使う）

- [ ] **Step 1: 失敗するテストを書く**

import に `stepCost` を足し、`describe('computeFlowField', ...)` の前に足す。

```ts
describe('stepCost', () => {
  it('半分ずつ出るマスと入るマスの倍率で割る', () => {
    expect(stepCost(ORTHO_COST, 1, 1)).toBe(10);
    expect(stepCost(ORTHO_COST, 1, 0.5)).toBe(15);
    expect(stepCost(ORTHO_COST, 0.5, 1)).toBe(15);
    expect(stepCost(ORTHO_COST, 0.5, 0.5)).toBe(20);
    expect(stepCost(DIAG_COST, 1, 1)).toBe(14);
    expect(stepCost(DIAG_COST, 1, 0.5)).toBe(21);
    expect(stepCost(DIAG_COST, 0.5, 0.5)).toBe(28);
  });

  it('割り切れない倍率でも整数で、向きで値が変わらない', () => {
    const a = stepCost(ORTHO_COST, 1, 0.3);
    expect(Number.isInteger(a)).toBe(true);
    expect(a).toBe(stepCost(ORTHO_COST, 0.3, 1));
    expect(a).toBe(22); // 5 + 16.67 を丸める
  });
});
```

`describe('computeFlowField', ...)` の中に足す。

```ts
  const FOREST = {
    '.': { tile: null, walkable: true },
    F: { tile: null, walkable: true, speed: 0.5 },
  };

  it('森に入るマスと森の中のマスはコストが上がる', () => {
    const g = makeGrid(32, ['.FF'], FOREST);
    const f = computeFlowField(g, { x: 16, y: 16 });
    expect(f.dist[1]).toBe(15);
    expect(f.dist[2]).toBe(35);
  });

  it('森を横切るより回る方が安ければ、回る向きを出す', () => {
    // 列 3〜6 の行 0〜2 が森。(16,16) から (304,16) は横切ると 140、行3 を回ると 114
    const g = makeGrid(32, [
      '...FFFF...',
      '...FFFF...',
      '...FFFF...',
      '..........',
    ], FOREST);
    const f = computeFlowField(g, { x: 304, y: 16 });
    expect(f.dist[0]).toBe(114);
    const dir = flowDirection(g, f, { x: 16, y: 16 });
    expect(dir).not.toBeNull();
    expect(dir!.y).toBeGreaterThan(0); // 下（行3）へ向かう
  });

  it('森の中のゴールにも距離が入る', () => {
    const g = makeGrid(32, ['..F'], FOREST);
    const f = computeFlowField(g, { x: 80, y: 16 });
    expect(f.dist[2]).toBe(0);
    expect(f.dist[1]).toBe(15);
    expect(f.dist[0]).toBe(25);
  });
```

- [ ] **Step 2: 失敗を確かめる**

Run: `npx vitest run src/core/field.test.ts -t "stepCost|森"`
Expected: FAIL（`stepCost` が無い／距離が 10・20 のまま）

- [ ] **Step 3: 実装する**

`src/core/field.ts` の `DIAG_COST` の後ろに:

```ts
/**
 * 隣のマスへ移るコスト。半分は出るマス、半分は入るマスを進むとみなし、それぞれの速さの倍率で割る。
 * 向きで値が変わらないので、ゴールから逆向きにたどる computeFlowField でもそのまま使える
 */
export function stepCost(base: number, fromSpeed: number, toSpeed: number): number {
  return Math.round(base / 2 / fromSpeed + base / 2 / toSpeed);
}
```

`computeFlowField` の近傍ループの `const nd = curDist + cost;` を置き換える。

```ts
      const nd = curDist + stepCost(cost, grid.speed[cur] ?? 1, grid.speed[ni] ?? 1);
```

- [ ] **Step 4: 通ることを確かめる**

Run: `npx vitest run src/core/field.test.ts`
Expected: PASS（既存の `computeFlowField`・`flowDirection`・`resolveMoveDest` のテストも。倍率 1 のマップではコストが変わらない）

- [ ] **Step 5: コミット**

```bash
git add src/core/field.ts src/core/field.test.ts
git commit -m "feat: フローフィールドの隣へ移るコストをマスの速さの倍率で割る"
```

---

### Task 4: 移動の速さと直行の条件（sim）

**Files:**
- Modify: `src/core/field.ts:224-272`（`hasLineOfSight` を切り出して `isFullSpeedLine` を足す）、`src/core/sim.ts:8-10`（import）、`src/core/sim.ts:226-238`（`moveTowardGoal`）、`src/core/sim.ts:270`（`closeIn`）
- Test: `src/core/field.test.ts`（`describe('hasLineOfSight'` の後ろ）、`src/core/sim.test.ts`（新しい `describe('森'`）

**Interfaces:**
- Consumes: Task 2 の `speedAt(grid, pos)`・`Grid.speed`、Task 3 のフローフィールド
- Produces: `export function isFullSpeedLine(grid: Grid, from: Vec2, to: Vec2): boolean`（線が通るマスがすべてマップの中で倍率 1 か）

- [ ] **Step 1: field の失敗するテストを書く**

`src/core/field.test.ts` の import に `isFullSpeedLine` を足し、`describe('hasLineOfSight', ...)` の後ろに足す。

```ts
describe('isFullSpeedLine', () => {
  const g = makeGrid(32, ['.....', '..F..', '.....'], {
    '.': { tile: null, walkable: true },
    F: { tile: null, walkable: true, speed: 0.5 },
  });

  it('森を通らない線は true', () => {
    expect(isFullSpeedLine(g, { x: 16, y: 16 }, { x: 144, y: 16 })).toBe(true);
  });

  it('森を通る線は false', () => {
    expect(isFullSpeedLine(g, { x: 16, y: 48 }, { x: 144, y: 48 })).toBe(false);
  });

  it('端点が森のマスでも false', () => {
    expect(isFullSpeedLine(g, { x: 16, y: 48 }, { x: 80, y: 48 })).toBe(false);
  });

  it('森の角をかすめる斜めの線も false（hasLineOfSight と同じく両隣を見る）', () => {
    // (16,16)→(48,48) は格子点 (32,32) を通る。端点の (0,0)・(1,1) は草だが、
    // 斜めに移る瞬間に両隣 (1,0)・(0,1) も見るので、(1,0) の森で false になる
    const g2 = makeGrid(32, ['.F', '..'], {
      '.': { tile: null, walkable: true },
      F: { tile: null, walkable: true, speed: 0.5 },
    });
    expect(isFullSpeedLine(g2, { x: 16, y: 16 }, { x: 48, y: 48 })).toBe(false);
  });

  it('森が無いマップの hasLineOfSight は今までどおり', () => {
    expect(hasLineOfSight(g, { x: 16, y: 48 }, { x: 144, y: 48 })).toBe(true);
  });
});
```

- [ ] **Step 2: sim の失敗するテストを書く**

`src/core/sim.test.ts` の import の `from './field'` に `speedAt` を足す。ファイル末尾に足す。

```ts
describe('森', () => {
  const FOREST_LEGEND = {
    '.': { tile: null, walkable: true },
    F: { tile: null, walkable: true, speed: 0.5 },
  };
  const ALL_FOREST: StageDef = {
    ...STAGE, mapRows: ['FFFFFFFFFF', 'FFFFFFFFFF', 'FFFFFFFFFF'], legend: FOREST_LEGEND,
  };

  it('森の中では指示した移動が半分の速さになる（ロランは 30px/秒）', () => {
    const { state: s } = fresh(ALL_FOREST);
    const roran = unitOf(s, 'roran');
    roran.pos = { x: 16, y: 80 };
    step(s, [{ type: 'move', uid: roran.uid, dest: { x: 304, y: 80 } }], 1);
    expect(roran.pos.x).toBeCloseTo(46, 0);
    expect(roran.pos.y).toBeCloseTo(80, 4);
  });

  it('森の中では敵も半分の速さになる', () => {
    const { state: s } = fresh(ALL_FOREST);
    const e = spawnEnemy(s, 'narazumono', { x: 304, y: 16 });
    const before = { ...e.pos };
    step(s, [], 1);
    expect(distance(before, e.pos)).toBeCloseTo(e.speed * 0.5, 0);
  });

  it('森の中では詰め寄りも半分の速さになる', () => {
    const { state: s } = fresh(ALL_FOREST);
    const roran = unitOf(s, 'roran');
    for (const u of s.units) if (u.side === 'player' && u !== roran) u.retired = true;
    roran.pos = { x: 100, y: 48 };
    const e = s.units.find((u) => u.side === 'enemy')!;
    e.pos = { x: 150, y: 48 };
    e.speed = 0;
    e.combat = false;
    step(s, [], 1 / 60);
    expect(roran.closingOn).toBe(e.uid);
    expect(roran.pos.x).toBeCloseTo(100 + 60 * 0.5 / 60, 6);
  });

  // 列 3〜6 の行 0〜2 が森。(16,16) から (304,16) は横切ると 140、行3 を回ると 114
  const DETOUR: StageDef = {
    ...STAGE,
    mapRows: ['...FFFF...', '...FFFF...', '...FFFF...', '..........'],
    legend: FOREST_LEGEND,
    enemies: [],
  };

  it('まっすぐの線が森を通るときは、森を回って目的地に着く', () => {
    const { state: s } = fresh(DETOUR);
    const roran = unitOf(s, 'roran');
    roran.pos = { x: 16, y: 16 };
    const dest = { x: 304, y: 16 };
    step(s, [{ type: 'move', uid: roran.uid, dest }], 0.1);
    let maxY = roran.pos.y;
    for (let i = 0; i < 600 && unitOf(s, 'roran').goalPos; i++) {
      step(s, [], 0.1);
      maxY = Math.max(maxY, unitOf(s, 'roran').pos.y);
    }
    expect(maxY).toBeGreaterThanOrEqual(96); // 行3 に下りた
    expect(unitOf(s, 'roran').pos).toEqual(dest);
  });

  it('まっすぐの線が森を通らなければ、今までどおり直行する', () => {
    const { state: s } = fresh(DETOUR);
    const roran = unitOf(s, 'roran');
    roran.pos = { x: 16, y: 112 };
    const dest = { x: 304, y: 112 };
    step(s, [{ type: 'move', uid: roran.uid, dest }], 0.1);
    expect(roran.pos.y).toBeCloseTo(112, 4);
    expect(roran.pos.x).toBeCloseTo(22, 4);
  });

  it('森の中の目的地を指示すると、森に入って目的地に着く', () => {
    const { state: s } = fresh(DETOUR);
    const roran = unitOf(s, 'roran');
    roran.pos = { x: 16, y: 16 };
    const dest = { x: 176, y: 48 };
    step(s, [{ type: 'move', uid: roran.uid, dest }], 0.1);
    for (let i = 0; i < 600 && unitOf(s, 'roran').goalPos; i++) step(s, [], 0.1);
    expect(unitOf(s, 'roran').pos).toEqual(dest);
    expect(speedAt(s.grid, dest)).toBe(0.5);
  });

  it('森の中から森の外の目的地へ、止まらずに着く', () => {
    const { state: s } = fresh(DETOUR);
    const roran = unitOf(s, 'roran');
    roran.pos = { x: 144, y: 48 };
    const dest = { x: 304, y: 112 };
    step(s, [{ type: 'move', uid: roran.uid, dest }], 0.1);
    for (let i = 0; i < 600 && unitOf(s, 'roran').goalPos; i++) step(s, [], 0.1);
    expect(unitOf(s, 'roran').pos).toEqual(dest);
  });
});
```

注: `fresh` は味方を全員 (16,80) にどけるので、ロラン以外の味方も同じマップにいる。`DETOUR` は `enemies: []` にして敵に邪魔させない。`ALL_FOREST` の2つ目のテストは `STAGE` の敵 (304,16) もいるが、`spawnEnemy` で足した敵だけを測る。3つ目の詰め寄りのテストは既存の `describe('近接の自動の詰め寄り'` の `setup` と同じ置き方。

- [ ] **Step 3: 失敗を確かめる**

Run: `npx vitest run src/core/field.test.ts src/core/sim.test.ts -t "isFullSpeedLine|森"`
Expected: FAIL（`isFullSpeedLine` が無い／森の中でも 60px/秒で進む／森を横切る）

- [ ] **Step 4: field を実装する**

`src/core/field.ts` の `hasLineOfSight` を、マスの判定を引数にした内部関数に切り出す。DDA の本体は変えない。

```ts
/**
 * 2点を結ぶ線分が通るマスが、すべて ok を満たすか。
 * DDA で線分が通過するセルを漏れなく列挙し、対角に隣のセルへ移る瞬間は
 * 両側の直交セルも ok か確認する（computeFlowField の canStep と同じ理由で、
 * 壁の角をかすめてすり抜けるのを禁止する）。
 */
function lineCellsAll(grid: Grid, from: Vec2, to: Vec2, ok: (x: number, y: number) => boolean): boolean {
  let cx = Math.floor(from.x / grid.cell);
  let cy = Math.floor(from.y / grid.cell);
  const ex = Math.floor(to.x / grid.cell);
  const ey = Math.floor(to.y / grid.cell);
  if (!ok(cx, cy)) return false;

  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const stepX = dx > 0 ? 1 : dx < 0 ? -1 : 0;
  const stepY = dy > 0 ? 1 : dy < 0 ? -1 : 0;

  let tMaxX = stepX !== 0 ? ((cx + (stepX > 0 ? 1 : 0)) * grid.cell - from.x) / dx : Infinity;
  let tMaxY = stepY !== 0 ? ((cy + (stepY > 0 ? 1 : 0)) * grid.cell - from.y) / dy : Infinity;
  const tDeltaX = stepX !== 0 ? grid.cell / Math.abs(dx) : Infinity;
  const tDeltaY = stepY !== 0 ? grid.cell / Math.abs(dy) : Infinity;
  const EPS = 1e-9;

  while (cx !== ex || cy !== ey) {
    if (Math.abs(tMaxX - tMaxY) < EPS) {
      // 両方の境界を同時に跨ぐ = 格子点(壁の角)を通過する対角遷移
      const nx = cx + stepX;
      const ny = cy + stepY;
      if (!ok(nx, ny) || !ok(cx, ny) || !ok(nx, cy)) return false;
      cx = nx;
      cy = ny;
      tMaxX += tDeltaX;
      tMaxY += tDeltaY;
    } else if (tMaxX < tMaxY) {
      cx += stepX;
      if (!ok(cx, cy)) return false;
      tMaxX += tDeltaX;
    } else {
      cy += stepY;
      if (!ok(cx, cy)) return false;
      tMaxY += tDeltaY;
    }
  }
  return true;
}

function insideGrid(grid: Grid, x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < grid.cols && y < grid.rows;
}

/** 2点を結ぶ線分がすべて歩けるセルの上を通るか（壁の角のすり抜けは lineCellsAll が禁止する） */
export function hasLineOfSight(grid: Grid, from: Vec2, to: Vec2): boolean {
  return lineCellsAll(grid, from, to, (x, y) => insideGrid(grid, x, y) && grid.walkable[y * grid.cols + x] === true);
}

/** 2点を結ぶ線分が、速さの倍率が 1 のマスだけを通るか。森を通る線なら false */
export function isFullSpeedLine(grid: Grid, from: Vec2, to: Vec2): boolean {
  return lineCellsAll(grid, from, to, (x, y) => insideGrid(grid, x, y) && grid.speed[y * grid.cols + x] === 1);
}
```

- [ ] **Step 5: sim を実装する**

`src/core/sim.ts` の import:

```ts
import {
  cellIndexAt, computeFlowField, distance, flowDirection, hasClearPath, isFullSpeedLine, resolveMoveDest,
  slideStep, speedAt,
} from './field';
```

`moveTowardGoal` の `const stepLen = u.speed * dt;` を置き換える。

```ts
  const stepLen = u.speed * speedAt(state.grid, u.pos) * dt;
```

同じ関数の直行の判定とコメントを置き換える。

```ts
  // 目的地まで足元の箱ごと直進でき、線が森（速さの倍率が 1 でないマス）を通らないなら、
  // フローフィールドを使わず直行する。森を通るなら、回った方が早いかをフローフィールドに任せる。
  // 目的地と同じマスにいるときも直行する。フローフィールドは同じマスの中では向きを出せず（距離0）、
  // 指示が黙って消えてしまう。壁にかかるぶんは stepTo の slideStep が横すべりで吸収する
  const direct = (hasClearPath(state.grid, u.pos, goal) && isFullSpeedLine(state.grid, u.pos, goal))
    || cellIndexAt(state.grid, u.pos) === cellIndexAt(state.grid, goal);
```

`closeIn` の `const stepLen = Math.min(u.speed * dt, d);` を置き換える。

```ts
  const stepLen = Math.min(u.speed * speedAt(state.grid, u.pos) * dt, d);
```

- [ ] **Step 6: 通ることを確かめる**

Run: `npx vitest run src/core/field.test.ts src/core/sim.test.ts`
Expected: PASS（既存の移動・詰め寄り・`hasLineOfSight` のテストも）

失敗したら、テストの期待値を変える前に止めて報告する（`fresh` の味方の置き方や、森の中の曲がり方で数値がずれる可能性がある）。

- [ ] **Step 7: 全体を確かめる**

Run: `npm test && npx tsc --noEmit`
Expected: 全テスト PASS、型エラー無し

- [ ] **Step 8: コミット**

```bash
git add src/core/field.ts src/core/field.test.ts src/core/sim.ts src/core/sim.test.ts
git commit -m "feat: 森では移動が遅くなり、まっすぐの線が森を通るときはフローフィールドで回り道する"
```

---

### Task 5: stage1 に森を置き、画面で確かめる

**Files:**
- Create: `assets/images/tile-forest.png`（forge の `build/tile/forest.png` のコピー）
- Modify: `assets/stages/stage1.json`（`mapRows` の 9〜12 行目、`legend`）
- Modify: `README.md:26`（「そうさ」の移動の段落）、`README.md:128`（「コンテンツの足しかた」のステージ）
- Modify: `HANDOVER.md`

**Interfaces:**
- Consumes: Task 1〜4 のすべて

- [ ] **Step 1: 森の絵をコピーする**

```bash
cp ../pixel-asset-forge/build/tile/forest.png assets/images/tile-forest.png
file assets/images/tile-forest.png
```

Expected: `PNG image data, 16 x 16`。forge の `build/` が古い可能性があるので、forge で `.venv/bin/python tools/render.py` を先に実行してから写す（forge の作業ツリーは `docs/issue6-asset-policy` ブランチ。`build/` は git 管理外）。

- [ ] **Step 2: stage1 の legend と mapRows を変える**

`legend` に1行足す。

```json
    "V": { "tile": "tile-village.png", "walkable": false },
    "F": { "tile": "tile-forest.png", "walkable": true, "speed": 0.5 }
```

`mapRows` の 9〜12 行目（0 始まり）の列 4〜10 を `F` にする。

```json
    "....FFFFFFFR....",
    "....FFFFFFF.....",
    "..T.FFFFFFF.....",
    "....FFFFFFF.....",
```

置き換える前の同じ行は `"...........R...."`、`"................"`、`"..T............."`、`"................"`。ほかの行は変えない。

- [ ] **Step 3: ステージとタイルの検査を通す**

Run: `npm test`
Expected: PASS（`sheet-size.test.ts` がタイルの大きさ 16×16 を、`registry` / `loader` のテストが stage1 の読み込みと `tile-forest.png` の存在を確かめる）

- [ ] **Step 4: 正典を更新する**

`README.md` の「そうさ」の移動の段落（26 行目）の末尾に足す。

```
森のマスは通れるが、中では移動の速さが半分になる。指示した目的地までまっすぐ行くと森を通るときは、森を回った方が早ければ回り道する（森の中を目的地にすれば森に入る）。敵も同じ。
```

`README.md` の「コンテンツの足しかた」のステージの説明で、`legend` の形の説明を置き換える。

置き換え前:
```
マスの文字の意味は `legend` で決められる（`{ ".": { "tile": "tile-plain.png", "walkable": true }, "T": { "tile": "tile-tree.png", "walkable": false } }` の形。キーは1文字、`tile` は `assets/images/` のファイル名か `null`）。
```

置き換え後:
```
マスの文字の意味は `legend` で決められる（`{ ".": { "tile": "tile-plain.png", "walkable": true }, "T": { "tile": "tile-tree.png", "walkable": false }, "F": { "tile": "tile-forest.png", "walkable": true, "speed": 0.5 } }` の形。キーは1文字、`tile` は `assets/images/` のファイル名か `null`。`speed` はそのマスでの移動の速さの倍率で、省略時は 1、0 より大きく 1 以下。通れないマスには書けない）。
```

- [ ] **Step 5: 画面で確かめる**

README「描画と入力をブラウザで確認する」の手順で stage1 を開く。HANDOVER「後回しにした軽微な点」の注意も守る:

- `npx vite preview` は `localhost` でだけ待ち受ける（`127.0.0.1` では繋がらない）
- 接続のたびに CDP の `Emulation.setDeviceMetricsOverride`（width 540・height 945・deviceScaleFactor 1・mobile false）をかけると、論理座標 1px = 画面 1px になる
- Chromium は `~/.cache/ms-playwright/` のもの（または `/opt/pw-browsers/`）を使う。追加のインストールはしない

撮るもの（撮った PNG は依頼者に Read で見せる）:

1. 配置フェーズの stage1 全体。森（行 9〜12・列 4〜10）が描かれ、森の端と草の境目、木・岩との並びが分かること
2. 戦闘開始後、ロランを選んでゴール付近（例: 論理座標で (240, 48) のマップ上の位置）をタップし、数秒ごとに3〜4枚。森の脇（列 3 か列 11 の側）を回っていること
3. ロランに森の中（例: 行 10・列 7 のマスの中心）を指示し、森に入ったあと、草の上より遅く進むこと（`?debug` の `P` と `.` でコマ送りし、同じ tick 数での移動量を草の上と比べてもよい）

回り道が見て分かりにくいとき、または森の見え方に問題があるときは、直す前に止めて依頼者に画面を見せて判断を仰ぐ（spec「回り道が見て分かるかは画面で確かめる」）。

- [ ] **Step 6: HANDOVER を更新する**

`HANDOVER.md` の「What Remains」の⑤を `[x]` にし、「issue #6 への対応の順番」の5を「**済み**（ブランチ `feat/forest-slow-tile`、未 push）」にする。「⑤の前提」の節は「⑤で決めたこと」として、spec のパスと、依頼者が画面を見て決めたこと（森の位置の調整があればその内容）を書く。次は⑥であることを「← 次はここ」で示す。

- [ ] **Step 7: 全体を確かめてコミット**

Run: `npm test && npm run build`
Expected: 全テスト PASS、ビルド成功

```bash
git add assets/images/tile-forest.png assets/stages/stage1.json README.md HANDOVER.md
git commit -m "feat: stage1 に森を置き、森の移動の速さを README に書く"
```
