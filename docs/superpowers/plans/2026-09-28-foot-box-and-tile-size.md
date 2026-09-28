# 足元の箱とタイルの大きさ 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ユニットの当たり判定を足元の1点から「足元の箱」に広げて通れないマスへのめり込みを防ぎ、タイルを画像の元の大きさで描く。

**Architecture:** 箱の定数と四隅は `src/engine/footprint.ts` に置き、ステージの JSON の検査（engine）とシム（core）の両方が使う。判定の関数（`fitsAt`・`fitInCell`・`hasClearPath`・`slideStep`）は `src/core/field.ts` に純関数として足し、移動・目的地の置き換え・配置・かけぬけるがそれを通る。経路探索（フローフィールド）はマス単位のまま。タイルは `tileSide` で一辺を決めて描く。

**Tech Stack:** TypeScript、Canvas2D、Vitest、Vite

**Spec:** `docs/superpowers/specs/2026-09-28-foot-box-and-tile-size-design.md`

## Global Constraints

- コミットは Conventional Commits（`feat:` / `fix:` / `refactor:` / `test:` / `docs:` / `chore:`）＋日本語の要約
- 描画コード（Canvas2D）にはユニットテストを書かない。テストは純ロジックとレイアウト計算に寄せ、見た目は README の CDP 手順で確かめる（CLAUDE.md）
- `src/core/**` と `src/engine/**` は `window` / `document` / `localStorage` を参照しない。engine は core を参照しない（README）
- 足元の箱は、足元の点から左右 6px・下 2px・上 0px。ユニットによらず1つの値
- 敵に気づく判定と詰め寄る相手を選ぶ判定（`ai.ts`・`autoclose.ts`）は `hasLineOfSight` のまま変えない
- 経路探索（フローフィールド）はマス単位のまま変えない
- 画像ファイル（`assets/images/*.png`）とステージの JSON は変えない
- 各タスクの終わりに `npm test` と `npm run build` が通ること。**既存のテストが落ちたら、テストを書き換えずに落ちたテスト名と理由を報告して止まる**

## Review Focus

- **箱が収まらない位置にいるユニット**（テストで置いた位置など）が閉じ込められないこと → `slideStep` は、出発点に箱が収まらないときは足元の1点で判定する（Task 1 のテスト）
- **マップの端**: マップの外は通れない扱いなので、端から 6px 以内は立てない。端を指したら内側へ寄る（Task 1 の `fitInCell` のテスト）
- **壁の角で止まる・行ったり来たりする** → 壁の脇を通る移動が目的地に着くこと（Task 2 のテスト）
- **敵との押し合い（`separatedStep`）で壁へ押し込まれる** → 押し戻したあとの位置も `slideStep` を通す（Task 2 のコード）
- **配置のプレビューと実際の配置の食い違い** → どちらも `canPlaceAt` を通る（Task 3 のテスト）

---

## ファイル構成

| ファイル | 変更 |
|---|---|
| `src/engine/footprint.ts` | 新規。`FOOT_HALF_W`・`FOOT_BELOW`・`footCorners` |
| `src/core/field.ts` | `fitsAt`・`fitInCell`・`hasClearPath`・`slideStep` を足し、`resolveMoveDest` を `fitInCell` で寄せる |
| `src/core/field.test.ts` | 上の関数のテスト |
| `src/render/sprites.test.ts` | `FOOT_BELOW` と `FOOT_INSET` が同じ値、`tileSide` のテスト |
| `src/core/sim.ts` | `stepTo` を `slideStep` に、直進判定を `hasClearPath` に |
| `src/core/sim.test.ts` | 壁の脇を通る移動のテスト |
| `src/core/state.ts` | `canPlaceAt` を `fitsAt` に |
| `src/core/state.test.ts` | 配置のテスト |
| `src/core/skills.ts` | かけぬけるの行き先を `fitInCell`、途中を `fitsAt` に |
| `src/core/skills.test.ts` | かけぬけるのテスト |
| `src/engine/schema.ts` | `checkWalkable` を箱で判定 |
| `src/engine/schema.test.ts` | JSON の検査のテスト |
| `src/render/sprites.ts` | `TILE_PX` を消し、`TILE_SIDES`・`tileSide` を足す |
| `src/render/draw.ts` | `drawTerrain` をタイルの元の大きさで描く |
| `src/engine/sheet-size.test.ts` | タイルの検査を 16 か 32 に広げる |
| `README.md` | 操作・ステージの足しかた・規約の節 |
| `HANDOVER.md` | 完了を書く |

---

### Task 1: 足元の箱と判定の関数

**Files:**
- Create: `src/engine/footprint.ts`
- Modify: `src/core/field.ts`（`isWalkableAt` の下と、`resolveMoveDest` の下）
- Test: `src/core/field.test.ts`、`src/render/sprites.test.ts`

**Interfaces:**
- Produces（`src/engine/footprint.ts`）:
  - `export const FOOT_HALF_W = 6;`
  - `export const FOOT_BELOW = 2;`
  - `export function footCorners(pos: Vec2): Vec2[]`（左上・右上・左下・右下の順）
- Produces（`src/core/field.ts`）:
  - `export function fitsAt(grid: Grid, pos: Vec2): boolean`
  - `export function fitInCell(grid: Grid, pos: Vec2): Vec2 | null`
  - `export function hasClearPath(grid: Grid, from: Vec2, to: Vec2): boolean`
  - `export function slideStep(grid: Grid, from: Vec2, to: Vec2): Vec2`

- [ ] **Step 1: 失敗するテストを書く**

`src/core/field.test.ts` の import に `fitInCell`・`fitsAt`・`hasClearPath`・`slideStep` を足す（アルファベット順の既存の並びに入れる）。

ファイルの末尾に足す。

```ts
// 3×3 マスの真ん中だけ歩けない。マスは 32px
const RING = [
  '...',
  '.#.',
  '...',
];

describe('fitsAt', () => {
  it('マスの中心には収まる', () => {
    expect(fitsAt(makeGrid(32, RING), { x: 16, y: 16 })).toBe(true);
  });

  it('右隣が通れないマスで、足元から 6px 以内なら収まらない', () => {
    // (0,1) の右隣 (1,1) が '#'。x=27 なら箱の右端は 33 で、境界 32 を越える
    const g = makeGrid(32, RING);
    expect(fitsAt(g, { x: 26, y: 48 })).toBe(true);
    expect(fitsAt(g, { x: 27, y: 48 })).toBe(false);
  });

  it('左隣が通れないマスで、足元から 6px 以内なら収まらない', () => {
    const g = makeGrid(32, RING);
    expect(fitsAt(g, { x: 70, y: 48 })).toBe(true);
    expect(fitsAt(g, { x: 69, y: 48 })).toBe(false);
  });

  it('下が通れないマスなら、足先の 2px がかかる位置には立てない', () => {
    // (1,0) の下 (1,1) が '#'
    const g = makeGrid(32, RING);
    expect(fitsAt(g, { x: 48, y: 30 })).toBe(true);
    expect(fitsAt(g, { x: 48, y: 31 })).toBe(false);
  });

  it('上が通れないマスでも、頭のぶんは広げない（下から近づいたら境界まで立てる）', () => {
    // (1,2) の上 (1,1) が '#'
    expect(fitsAt(makeGrid(32, RING), { x: 48, y: 64 })).toBe(true);
  });

  it('マップの外は通れない扱い。端から 6px 以内には立てない', () => {
    const g = makeGrid(32, RING);
    expect(fitsAt(g, { x: 6, y: 16 })).toBe(true);
    expect(fitsAt(g, { x: 5, y: 16 })).toBe(false);
  });
});

describe('fitInCell', () => {
  it('収まる位置はそのまま返す', () => {
    expect(fitInCell(makeGrid(32, RING), { x: 20, y: 20 })).toEqual({ x: 20, y: 20 });
  });

  it('右隣が壁なら、箱が収まるところまで左へ寄せる', () => {
    expect(fitInCell(makeGrid(32, RING), { x: 30, y: 48 })).toEqual({ x: 26, y: 48 });
  });

  it('下が壁なら、足先が収まるところまで上へ寄せる', () => {
    expect(fitInCell(makeGrid(32, RING), { x: 48, y: 31 })).toEqual({ x: 48, y: 30 });
  });

  it('マップの端なら内側へ寄せる', () => {
    expect(fitInCell(makeGrid(32, RING), { x: 2, y: 16 })).toEqual({ x: 6, y: 16 });
  });

  it('通れないマスなら null', () => {
    expect(fitInCell(makeGrid(32, RING), { x: 48, y: 48 })).toBeNull();
  });
});

describe('hasClearPath', () => {
  it('壁から離れた直線なら通れる', () => {
    expect(hasClearPath(makeGrid(32, RING), { x: 16, y: 16 }, { x: 80, y: 16 })).toBe(true);
  });

  it('足元の点は壁の外を通っても、箱の端が壁にかかる直線は通れない', () => {
    // x=28 で縦に下りる。点は (0,1) を通るが、箱の右端 34 は '#' の (1,1) にかかる
    const g = makeGrid(32, RING);
    expect(hasLineOfSight(g, { x: 28, y: 16 }, { x: 28, y: 80 })).toBe(true);
    expect(hasClearPath(g, { x: 28, y: 16 }, { x: 28, y: 80 })).toBe(false);
  });
});

describe('slideStep', () => {
  it('箱が収まるならそのまま進む', () => {
    expect(slideStep(makeGrid(32, RING), { x: 16, y: 16 }, { x: 18, y: 18 })).toEqual({ x: 18, y: 18 });
  });

  it('斜めに壁へ寄るときは、収まる向きだけ進む（壁に沿ってすべる）', () => {
    // (22,30) から右下 (28,40) へ。x=28 は右の壁に箱がかかる。y だけなら収まる
    expect(slideStep(makeGrid(32, RING), { x: 22, y: 30 }, { x: 28, y: 40 })).toEqual({ x: 22, y: 40 });
  });

  it('どの向きにも進めなければ動かない', () => {
    // 右の壁に張り付いた位置からさらに右へ
    expect(slideStep(makeGrid(32, RING), { x: 26, y: 48 }, { x: 28, y: 48 })).toEqual({ x: 26, y: 48 });
  });

  it('出発点に箱が収まらないときは、足元の1点で判定して抜け出せる', () => {
    // (28,48) は箱が壁にかかっている。左へ動くなら点は歩けるので進む
    expect(slideStep(makeGrid(32, RING), { x: 28, y: 48 }, { x: 27, y: 48 })).toEqual({ x: 27, y: 48 });
  });
});
```

`src/render/sprites.test.ts` の import に足し、末尾にテストを足す。

```ts
import { FOOT_BELOW } from '../engine/footprint';
```

```ts
describe('足元の箱', () => {
  it('下の幅は、足元の行から絵の下端までの FOOT_INSET と同じ', () => {
    expect(FOOT_BELOW).toBe(FOOT_INSET);
  });
});
```

- [ ] **Step 2: テストが落ちることを確かめる**

Run: `npx vitest run src/core/field.test.ts src/render/sprites.test.ts`
Expected: FAIL（`fitsAt` などが export されていない、`../engine/footprint` が無い）

- [ ] **Step 3: 足元の箱を書く**

`src/engine/footprint.ts` を作る。

```ts
import type { Vec2 } from './schema';

/**
 * 足元の箱。ユニットの位置（足元の点）から左右に FOOT_HALF_W、下に FOOT_BELOW、上には広げない。
 * 32px のコマの体は x=10〜23（中心16）。下の 2px は足先のぶんで、描画側の FOOT_INSET と同じ値。
 * 上を広げないのは、通れないマスの下に立ったとき頭が上のマスに重なるのを、
 * マスの手前に立っている見え方として残すため（README「アセットの大きさの規約」）
 */
export const FOOT_HALF_W = 6;
export const FOOT_BELOW = 2;

/** 右端と下端は含めない。箱の端がマスの境界ちょうどなら、隣のマスにはかからない */
const EDGE = 1e-6;

/**
 * 箱の四隅（左上・右上・左下・右下）。箱は1マス（32px）より小さいので、
 * 四隅がすべて通れるマスにあれば箱全体が通れるマスに収まる
 */
export function footCorners(pos: Vec2): Vec2[] {
  const left = pos.x - FOOT_HALF_W;
  const right = pos.x + FOOT_HALF_W - EDGE;
  const bottom = pos.y + FOOT_BELOW - EDGE;
  return [
    { x: left, y: pos.y }, { x: right, y: pos.y },
    { x: left, y: bottom }, { x: right, y: bottom },
  ];
}
```

- [ ] **Step 4: 判定の関数を書く**

`src/core/field.ts` の先頭に import を足す。

```ts
import { FOOT_BELOW, FOOT_HALF_W, footCorners } from '../engine/footprint';
```

`isWalkableAt` の直後に足す。

```ts
/** 足元の箱（engine/footprint.ts）の四隅が、すべて通れるマスの中にあるか。マップの外は通れない扱い */
export function fitsAt(grid: Grid, pos: Vec2): boolean {
  return footCorners(pos).every((c) => isWalkableAt(grid, c));
}

/**
 * 箱が収まらない位置を、同じマスの中で箱が収まる位置へ寄せる。
 * 横だけ・縦だけ・両方を寄せた候補のうち、収まって元の位置に最も近いもの。
 * どれも収まらなければマスの中心（通れるマスの中心には必ず収まる）。マス自体が通れなければ null
 */
export function fitInCell(grid: Grid, pos: Vec2): Vec2 | null {
  const i = cellIndexAt(grid, pos);
  if (i < 0 || grid.walkable[i] !== true) return null;
  if (fitsAt(grid, pos)) return { ...pos };
  const left = (i % grid.cols) * grid.cell;
  const top = Math.floor(i / grid.cols) * grid.cell;
  const x = Math.min(Math.max(pos.x, left + FOOT_HALF_W), left + grid.cell - FOOT_HALF_W);
  const y = Math.min(pos.y, top + grid.cell - FOOT_BELOW);
  const fitting = [{ x, y: pos.y }, { x: pos.x, y }, { x, y }]
    .filter((p) => fitsAt(grid, p))
    .sort((a, b) => distance(a, pos) - distance(b, pos));
  return fitting[0] ?? cellCenter(grid, i);
}
```

`resolveMoveDest` の直前に足す。

```ts
/**
 * from から to へ、足元の箱ごと直進できるか。箱の四隅から引いた4本の線を hasLineOfSight で確かめる。
 * 「見えるか」の判定（ai.ts・autoclose.ts）は1本の線のままでよいので、移動にだけ使う
 */
export function hasClearPath(grid: Grid, from: Vec2, to: Vec2): boolean {
  const a = footCorners(from);
  const b = footCorners(to);
  return a.every((c, k) => hasLineOfSight(grid, c, b[k]!));
}

/**
 * from から to への1歩を、足元の箱が収まるように直す。収まらなければ x だけ・y だけの移動を試し、
 * 進む量が大きいほうを返す（壁に沿って横すべりする）。どちらも収まらなければ from。
 * from 自体に箱が収まらないとき（テストで置いた位置など）は、閉じ込めないよう足元の1点で判定する
 */
export function slideStep(grid: Grid, from: Vec2, to: Vec2): Vec2 {
  if (fitsAt(grid, to)) return { ...to };
  if (!fitsAt(grid, from)) return isWalkableAt(grid, to) ? { ...to } : { ...from };
  let best = { ...from };
  for (const p of [{ x: to.x, y: from.y }, { x: from.x, y: to.y }]) {
    if (fitsAt(grid, p) && distance(from, p) > distance(from, best)) best = p;
  }
  return best;
}
```

（`hasLineOfSight` と `distance` は同じファイルの下のほうにある関数宣言なので、上で使ってよい）

- [ ] **Step 5: テストが通ることを確かめる**

Run: `npx vitest run src/core/field.test.ts src/render/sprites.test.ts`
Expected: PASS

Run: `npm test && npm run build`
Expected: すべて PASS、ビルド成功（まだ誰も新しい関数を使っていないので、既存のテストは変わらない）

- [ ] **Step 6: コミット**

```bash
git add src/engine/footprint.ts src/core/field.ts src/core/field.test.ts src/render/sprites.test.ts
git commit -m "feat: 足元の箱と、箱で判定する関数を足す"
```

---

### Task 2: 移動を足元の箱で判定する

**Files:**
- Modify: `src/core/field.ts`（`resolveMoveDest`）
- Modify: `src/core/sim.ts:9`（import）、`src/core/sim.ts:182-196`（`stepTo`）、`src/core/sim.ts:234`（直進判定）
- Test: `src/core/field.test.ts`、`src/core/sim.test.ts`

**Interfaces:**
- Consumes: `fitInCell`・`hasClearPath`・`slideStep`（Task 1、`src/core/field.ts`）

- [ ] **Step 1: 失敗するテストを書く**

`src/core/field.test.ts` の `describe('resolveMoveDest', ...)` の中に足す。

```ts
  it('歩けるマスでも、足元の箱が壁にかかる位置なら内側へ寄せる', () => {
    // (30,48) は歩けるマス (0,1)。右隣 (1,1) が '#' なので x=26 まで寄せる
    const g = makeGrid(32, RING);
    expect(resolveMoveDest(g, { x: 16, y: 16 }, { x: 30, y: 48 })).toEqual({ x: 26, y: 48 });
  });
```

`src/core/sim.test.ts` の import の `'./field'` に `fitsAt` を足す。

```ts
import { distance, fitsAt, isWalkableAt } from './field';
```

`describe('step: 移動', ...)` の中に足す。

```ts
  it('壁の脇を指すと、足元の箱が壁にかからない位置へ寄せる', () => {
    // (5,1) が '#'（x:160-192）。(158,48) の箱の右端は 164 で壁にかかるので、x=154 に寄る
    const { state: s } = fresh({ ...STAGE, mapRows: ['..........', '.....#....', '..........'], enemies: [] });
    unitOf(s, 'roran').pos = { x: 16, y: 80 };
    step(s, [{ type: 'move', uid: unitOf(s, 'roran').uid, dest: { x: 158, y: 48 } }], 1 / 60);
    expect(unitOf(s, 'roran').goalPos).toEqual({ x: 154, y: 48 });
  });

  it('壁の脇を通り抜けるあいだ、足元の箱は一度も壁にかからず、目的地に着く', () => {
    // (158,16) から真下の (158,80) へ。まっすぐ下りると (5,1) の壁に箱がかかる
    const { state: s } = fresh({ ...STAGE, mapRows: ['..........', '.....#....', '..........'], enemies: [] });
    const roran = unitOf(s, 'roran');
    roran.pos = { x: 158, y: 16 };
    step(s, [{ type: 'move', uid: roran.uid, dest: { x: 158, y: 80 } }], 1 / 60);
    for (let i = 0; i < 300; i++) {
      step(s, [], 1 / 60);
      expect(fitsAt(s.grid, unitOf(s, 'roran').pos), `tick ${i}`).toBe(true);
    }
    expect(distance(unitOf(s, 'roran').pos, { x: 158, y: 80 })).toBeLessThan(1);
  });
```

- [ ] **Step 2: テストが落ちることを確かめる**

Run: `npx vitest run src/core/field.test.ts src/core/sim.test.ts`
Expected: FAIL（寄せていないので goalPos が `{ x: 158, y: 48 }`、通り抜けのテストは箱が壁にかかった tick で落ちる）

- [ ] **Step 3: 目的地を寄せる**

`src/core/field.ts` の `resolveMoveDest` の説明と先頭の1行を次にする。

```ts
/**
 * 移動先の置き換え。dest が歩けるマスなら、足元の箱が収まる位置へ寄せて返す（fitInCell）。
 * 歩けなければ（マップの外を含む）、from からたどり着けるマスのうち dest に最も近いマスの中心を返す。
 * 近さが同じならフローフィールドの距離が短い方。たどり着けるマスが無ければ null
 */
export function resolveMoveDest(grid: Grid, from: Vec2, dest: Vec2): Vec2 | null {
  const fitted = fitInCell(grid, dest);
  if (fitted) return fitted;
```

（置き換える元の行は `if (isWalkableAt(grid, dest)) return { ...dest };`）

- [ ] **Step 4: 1歩ごとの移動と直進判定を直す**

`src/core/sim.ts:9` の `'./field'` からの import で、`hasLineOfSight` と `isWalkableAt` を外し、`hasClearPath` と `slideStep` を足す（sim.ts ではほかに使っていない）。

`stepTo` を次に置き換える。

```ts
/**
 * next へ動く。敵対ユニットに MIN_SEPARATION より近づくぶんは separatedStep で補正し、
 * 足元の箱が通れないマスにかかるぶんは slideStep で補正する（壁に沿ってすべる）。
 * moved: next にそのまま着いた / adjusted: 補正して動いた / blocked: 動けなかった
 */
function stepTo(state: BattleState, u: Unit, next: Vec2): StepResult {
  const separated = separatedStep(u.pos, next, hostilesOf(state, u).map((h) => h.pos), MIN_SEPARATION);
  const p = slideStep(state.grid, u.pos, separated);
  if (p.x === next.x && p.y === next.y) {
    u.pos = p;
    return 'moved';
  }
  if (distance(u.pos, p) < BLOCKED_EPS) return 'blocked';
  u.pos = p;
  return 'adjusted';
}
```

`moveTowardGoal` の直進判定を置き換える。

```ts
  // 目的地まで足元の箱ごと直進できるならフローフィールドを使わず直行する
  const dir = hasClearPath(state.grid, u.pos, goal)
```

（元は `// 目的地まで見通せるならフローフィールドを使わず直行する` と `const dir = hasLineOfSight(state.grid, u.pos, goal)`）

- [ ] **Step 5: テストとビルドが通ることを確かめる**

Run: `npx vitest run src/core/field.test.ts src/core/sim.test.ts`
Expected: PASS

Run: `npm test && npm run build`
Expected: すべて PASS、ビルド成功。既存のテストが落ちたら、テストを書き換えずに落ちたテスト名と理由を報告して止まる

- [ ] **Step 6: コミット**

```bash
git add src/core/field.ts src/core/field.test.ts src/core/sim.ts src/core/sim.test.ts
git commit -m "feat: 移動を足元の箱で判定し、通れないマスへのめり込みを防ぐ"
```

---

### Task 3: 配置・かけぬける・ステージの JSON の検査を足元の箱で判定する

**Files:**
- Modify: `src/core/state.ts:1`（import）、`src/core/state.ts:126-129`（`canPlaceAt`）
- Modify: `src/core/skills.ts:5`（import）、`src/core/skills.ts:14-23`（`isPathWalkable`）、`src/core/skills.ts:65-89`（`kakenukeru`）
- Modify: `src/engine/schema.ts`（`import` と `checkWalkable`）
- Test: `src/core/state.test.ts`、`src/core/skills.test.ts`、`src/engine/schema.test.ts`

**Interfaces:**
- Consumes: `fitsAt`・`fitInCell`（Task 1、`src/core/field.ts`）、`footCorners`（Task 1、`src/engine/footprint.ts`）

- [ ] **Step 1: 失敗するテストを書く**

`src/core/state.test.ts` の `describe('canPlaceAt', ...)` の中に足す。

```ts
  it('通れないマスの脇で、足元の箱がかかる位置には置けない', () => {
    // stage1 の 18行目・13列目（x:416-448, y:576-608）が木。x=413 は箱の右端 419 が木にかかる
    const { stage, state } = fresh();
    expect(canPlaceAt(stage, state.grid, { x: 410, y: 592 })).toBe(true);
    expect(canPlaceAt(stage, state.grid, { x: 413, y: 592 })).toBe(false);
  });
```

`src/core/skills.test.ts` の `describe('かけぬける', ...)` の中に足す。

```ts
  it('壁の脇を指すと、足元の箱がかからない位置まで寄せて移動する', () => {
    const reg = testRegistry();
    // row6（y:192-224）の col6-8（x:192-288）を壁にする。(190,208) は箱の右端 196 が壁にかかる
    const stage: StageDef = {
      ...reg.stages[0]!,
      mapRows: reg.stages[0]!.mapRows.map((row, y) =>
        y === 6 ? `${row.slice(0, 6)}###${row.slice(9)}` : row,
      ),
    };
    const s = fresh(stage);
    const gau = unitOf(s, 'gau');
    gau.pos = { x: 80, y: 208 };
    expect(useSkill(s, gau.uid, { x: 190, y: 208 })).toBe(true);
    expect(unitOf(s, 'gau').pos).toEqual({ x: 186, y: 208 });
  });
```

`src/engine/schema.test.ts` の「walkable: false の マスに 敵が いれば弾く」の直後に足す。

```ts
  it('敵の足元の箱が 通れない マスに かかれば弾く', () => {
    // VALID_STAGE の敵を (92,48) に。マス (2,1) は歩けるが、箱の右端 98 が右隣の '#'（x:96-）にかかる
    const r = validateStageDef('stages/x.json', {
      ...VALID_STAGE,
      enemies: [{ defId: 'narazumono', pos: { x: 92, y: 48 }, ai: { kind: 'aggressive' } }],
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors[0]?.path).toBe('enemies[0].pos');
      expect(r.errors[0]?.reason).toBe('足元が 通れない マスに かかる');
    }
  });
```

（`ValidationError` は `{ file, path, reason }`。`src/engine/schema.ts:6`）

- [ ] **Step 2: テストが落ちることを確かめる**

Run: `npx vitest run src/core/state.test.ts src/core/skills.test.ts src/engine/schema.test.ts`
Expected: FAIL（x=413 に置ける、かけぬけるが (190,208) に着く、敵の位置が通る）

- [ ] **Step 3: 配置を直す**

`src/core/state.ts:1` の import を `import { fitsAt, makeGrid } from './field';` にする（`isWalkableAt` は state.ts ではほかに使っていない）。

`canPlaceAt` の1行目を次にする。

```ts
  if (!fitsAt(grid, pos)) return false;
```

- [ ] **Step 4: かけぬけるを直す**

`src/core/skills.ts:5` の import を次にする。

```ts
import { distance, distanceToSegment, fitInCell, fitsAt } from './field';
```

`isPathWalkable` の中の判定を `fitsAt` にする。

```ts
    if (!fitsAt(state.grid, p)) return false;
```

`kakenukeru` の先頭から `const damage` の直前までを次にする。

```ts
  kakenukeru: ({ state, self, dest }) => {
    if (!dest) return null;
    // 壁の脇を指しても、足元の箱が壁にかからない位置へ寄せる
    const to = fitInCell(state.grid, dest);
    if (!to) return null;
    const from = { ...self.pos };
    if (!isPathWalkable(state, from, to)) return null;
```

同じ関数の中の `dest` を `to` に置き換える（`distanceToSegment(enemy.pos, from, to)` と `self.pos = { ...to };` の2か所）。

- [ ] **Step 5: ステージの JSON の検査を直す**

`src/engine/schema.ts` の先頭の import に足す。

```ts
import { footCorners } from './footprint';
```

`validateStageDef` の中の `checkWalkable` を次にする。

```ts
  const checkWalkable = (path: string, pos: Vec2): void => {
    if (mapRows.length === 0) return;
    // ユニットは足元の箱（engine/footprint.ts）で立つので、四隅がすべて通れるマスにあること
    if (!footCorners(pos).every((c) => isWalkableCell(cell, mapRows, effectiveLegend, c))) {
      fail(ctx, path, '足元が 通れない マスに かかる');
    }
  };
```

- [ ] **Step 6: テストとビルドが通ることを確かめる**

Run: `npx vitest run src/core/state.test.ts src/core/skills.test.ts src/engine/schema.test.ts`
Expected: PASS

Run: `npm test && npm run build`
Expected: すべて PASS、ビルド成功。今のステージはどれも箱が収まる位置にある（spec で確認済み）。既存のテストが落ちたら、テストを書き換えずに報告して止まる

- [ ] **Step 7: コミット**

```bash
git add src/core/state.ts src/core/state.test.ts src/core/skills.ts src/core/skills.test.ts src/engine/schema.ts src/engine/schema.test.ts
git commit -m "feat: 配置・かけぬける・ステージの検査も足元の箱で判定する"
```

---

### Task 4: タイルを元の大きさで描く

**Files:**
- Modify: `src/render/sprites.ts:108-109`（`TILE_PX`）
- Modify: `src/render/draw.ts:12`（import）、`src/render/draw.ts:92-114`（`drawTerrain`）
- Modify: `src/engine/sheet-size.test.ts:6, 72-76`
- Test: `src/render/sprites.test.ts`

**Interfaces:**
- Produces（`src/render/sprites.ts`）:
  - `export const TILE_SIDES: readonly number[] = [16, 32];`
  - `export function tileSide(img: CanvasImageSource): number`
- `TILE_PX` は消す

- [ ] **Step 1: 失敗するテストを書く**

`src/render/sprites.test.ts` の `'./sprites'` からの import に `TILE_SIDES` と `tileSide` を足し、末尾に足す。

```ts
describe('tileSide', () => {
  const img = (w: number) => ({ naturalWidth: w }) as HTMLImageElement;

  it('16px と 32px の画像は、その一辺を返す', () => {
    expect(tileSide(img(16))).toBe(16);
    expect(tileSide(img(32))).toBe(32);
  });

  it('それ以外の大きさ（読み込み前の 0 を含む）は 0（単色で描く）', () => {
    expect(tileSide(img(24))).toBe(0);
    expect(tileSide(img(0))).toBe(0);
  });

  it('描けるタイルの一辺は、どれも1マス（32px）を割り切る', () => {
    for (const side of TILE_SIDES) expect(32 % side).toBe(0);
  });
});
```

- [ ] **Step 2: テストが落ちることを確かめる**

Run: `npx vitest run src/render/sprites.test.ts`
Expected: FAIL（`tileSide` が export されていない）

- [ ] **Step 3: 一辺の判定を書く**

`src/render/sprites.ts` の `TILE_PX` の2行（説明と定数）を次に置き換える。

```ts
/** タイルとして描ける画像の一辺。1マス（32px）を割り切る大きさだけ（README「アセットの大きさの規約」） */
export const TILE_SIDES: readonly number[] = [16, 32];

/** タイル画像の一辺。TILE_SIDES に無い大きさ（読み込み前の 0 を含む）なら 0 を返し、呼び出し側は単色で描く */
export function tileSide(img: CanvasImageSource): number {
  const w = 'naturalWidth' in img ? img.naturalWidth : 0;
  return TILE_SIDES.includes(w) ? w : 0;
}
```

- [ ] **Step 4: 描画を直す**

`src/render/draw.ts:12` の import で `TILE_PX` を `tileSide` に置き換える。

`drawTerrain` を次にする。

```ts
function drawTerrain(ctx: CanvasRenderingContext2D, state: BattleState, images: ImageCache): void {
  const { grid, stage } = state;
  for (let i = 0; i < grid.walkable.length; i++) {
    const cx = i % grid.cols;
    const cy = Math.floor(i / grid.cols);
    const p = mapToLogical({ x: cx * grid.cell, y: cy * grid.cell });
    const ch = stage.mapRows[cy]?.[cx];
    const tile = ch === undefined ? null : imageFor(images, stage.legend?.[ch]?.tile ?? null);
    const side = tile === null ? 0 : tileSide(tile);
    if (tile !== null && side > 0 && grid.cell % side === 0) {
      // タイルは拡大せず元の大きさで、1マスに per × per 枚並べる。キャラの絵（等倍）と画素の細かさをそろえるため
      const per = grid.cell / side;
      for (let ty = 0; ty < per; ty++) {
        for (let tx = 0; tx < per; tx++) {
          ctx.drawImage(tile, p.x + tx * side, p.y + ty * side, side, side);
        }
      }
      continue;
    }
    // legend の無いステージと、タイルの読み込み前は単色
    ctx.fillStyle = grid.walkable[i] ? COLORS.ground : COLORS.rock;
    ctx.fillRect(p.x, p.y, grid.cell, grid.cell);
  }
}
```

- [ ] **Step 5: タイルの実寸の検査を広げる**

`src/engine/sheet-size.test.ts:6` を `import { TILE_SIDES } from '../render/sprites';` にし、タイルごとのテストを次にする。

```ts
  for (const tile of tiles) {
    it(`${tile} は 正方形で、一辺が ${TILE_SIDES.join(' か ')}`, () => {
      const { w, h } = pngSize(join('assets/images', tile));
      expect(w).toBe(h);
      expect(TILE_SIDES).toContain(w);
    });
  }
```

- [ ] **Step 6: テストとビルドが通ることを確かめる**

Run: `grep -rn "TILE_PX" src`
Expected: 何も出ない

Run: `npm test && npm run build`
Expected: すべて PASS、ビルド成功

- [ ] **Step 7: コミット**

```bash
git add src/render/sprites.ts src/render/sprites.test.ts src/render/draw.ts src/engine/sheet-size.test.ts
git commit -m "feat: タイルを画像の元の大きさ（16px か 32px）で描く"
```

---

### Task 5: README を直し、画面を撮って確かめる

**Files:**
- Modify: `README.md`
- Modify: `HANDOVER.md`

**Interfaces:**
- Consumes: Task 1〜4 の変更

- [ ] **Step 1: 操作の説明に足す**

`README.md` の「## そうさ」の、「移動先は 4 人ぶんが常に表示される。」で始まる段落の末尾に足す。

```markdown
通れないマス（木・岩など）のすぐ脇を指したときは、足元が通れないマスにかからない位置まで内側に寄せて移動する。
```

- [ ] **Step 2: ステージの足しかたを直す**

「コンテンツの足しかた」の「**ステージ**」の項で、次の部分を置き換える。

置き換え前:
```
線より下はプレイヤーの配置範囲なので、置くと起動時エラーになる。
```

置き換え後:
```
線より下はプレイヤーの配置範囲なので、置くと起動時エラーになる。敵・開始位置・時間湧き・見張りの持ち場は、足元の箱（「アセットの大きさの規約」）が通れないマスにかからない位置に置く（かかると起動時エラー）。
```

同じ項で、次の部分を置き換える。

置き換え前:
```
タイル画像は 16×16 で、1マス（32px）に拡大せず 2×2 で敷く（実寸が違うと `npm test` が落ちる）
```

置き換え後:
```
タイル画像は 16×16 か 32×32 で、拡大せず元の大きさで敷く（16px なら1マスに 2×2、32px なら1枚。ほかの大きさだと `npm test` が落ちる）
```

- [ ] **Step 3: 規約の節を直す**

「## アセットの大きさの規約」の箇条書き（「- 物の絵は地面（草）を背景に含めて描く」で始まる3行）の末尾に1行足す。

```markdown
- ユニットの当たり判定は足元の箱（足元の点から左右6px・下2px・上0px。`src/engine/footprint.ts`）。通れないマスに横と上からはめり込まない。下から近づいたときに頭が上のマスに重なるのは、マスの手前に立っている見え方として残す
```

同じ節の「**まだ規約に追いついていないもの:**」の、次の部分を置き換える。

置き換え前:
```
（32pxで描く対応は次の作業）。
```

置き換え後:
```
（ゲームは32pxの画像を1マスに1枚で描けるので、forge で32pxのセットに描き直して差し替える）。
```

- [ ] **Step 4: 画面を撮って確かめる**

README の「描画と入力をブラウザで確認する」の手順で、`npm run build` した `out/` を配信し、ヘッドレス Chromium（540×945）で次を撮る。

1. ステージ1の戦闘中に、ロランを木（11行目・2列目、マップ座標 x:64-96, y:352-384）の右の脇（マップ座標 x:98, y:368。論理座標は `MAP_ORIGIN` の (14,50) を足す）へ移動させ、着いたところを拡大して撮る。体が木の絵に重ならない
2. 同じ木の真下（マップ座標 x:80, y:386）へ移動させて撮る。頭が木の絵に重なる（手前に立つ見え方。意図どおり）
3. マップ全体を撮る。タイルが今までと同じに見える（今の画像はすべて 16px なので 2×2 で敷かれる）

撮った画像は依頼者に見せる（コミットしない）。重なりが残っていれば、座標と画像を添えて報告して止まる。

- [ ] **Step 5: HANDOVER.md を更新する**

- 「Current State」の Branch を `feat/foot-box-and-tile-size`（`docs/asset-size-conventions` から分岐）にし、状態を「issue #6 対応の③（足元の箱・タイルの描き方）の実装が完了。PR 未作成。規約のブランチの PR を先にマージする必要がある」に書き換える
- 「issue #6 への対応の順番」の 3 を「済み」にし、「← 次はここ」を 4（forge 側）に移す
- 撮った画面で気付いたことがあれば「後回しにした軽微な点」に足す

- [ ] **Step 6: テストとビルドを通してコミット**

Run: `npm test && npm run build`
Expected: すべて PASS、ビルド成功

```bash
git add README.md HANDOVER.md
git commit -m "docs: 足元の箱とタイルの大きさを README に書く"
```
