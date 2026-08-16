# とりでの なかまたち 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 島の砦を4人の仲間で守るリアルタイム防衛シミュレーションを、3ステージの縦切り1本として実装し、ankardo にデプロイできる状態にする。

**Architecture:** 描画・DOM に依存しない純ロジック層 `src/core/` と、データのみの `src/content/`、Canvas2D 描画の `src/render/`、画面遷移と入力の `src/ui/` に分ける。`core` は引数と戻り値だけで完結するため Vitest で単体テストできる。ゲームループは吹き出し表示中に `step()` を呼ばないことで「吹き出し中は時間が止まる」を構造的に表現する。

**Tech Stack:** TypeScript / Vite / Canvas2D / Vitest / Wrangler (Cloudflare Workers Static Assets)

**Spec:** `docs/superpowers/specs/2026-08-17-character-tactics-design.md`

## Global Constraints

- Node.js 22 以上。`package.json` の `engines.node` に `>=22` を書く
- `wrangler` は `devDependencies` に `^4` で固定する（未固定だと wrangler-action が 3.90.0 を入れて失敗する）
- `vite.config.ts` の `base` は `/play/character-tactics/`
- `vite.config.ts` の `build.outDir` は `out/play/character-tactics`（`out` のままだと Workers のパス付きルートで失敗する）
- 論理解像度は 960×540 固定。すべての座標はこの論理座標系で扱う
- ゲーム内に表示する日本語のセリフ・ラベルは**全文ひらがな・カタカナ**。漢字を使わない（README・コメント・設計書は除く）
- `src/core/**` と `src/content/**` は `window` / `document` / `HTMLCanvasElement` / `localStorage` を参照しない
- コミットは Conventional Commits 形式（`feat:` / `fix:` / `test:` / `chore:` / `docs:`）
- ボタンの当たり判定は論理座標で最小 64×64

---

### Task 1: プロジェクト初期化とシード付き乱数

**Files:**
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`, `.gitignore`
- Create: `src/core/rng.ts`
- Test: `src/core/rng.test.ts`

**Interfaces:**
- Consumes: なし
- Produces: `makeRng(seed: number): Rng`、`nextFloat(rng: Rng): number`、`nextInt(rng: Rng, maxExclusive: number): number`、`Rng = { seed: number }`

- [ ] **Step 1: package.json を作る**

```json
{
  "name": "character-tactics",
  "private": true,
  "type": "module",
  "engines": { "node": ">=22" },
  "scripts": {
    "dev": "vite",
    "build": "tsc --noEmit && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "devDependencies": {
    "typescript": "^5.6.0",
    "vite": "^5.4.0",
    "vitest": "^2.1.0",
    "wrangler": "^4.0.0"
  }
}
```

- [ ] **Step 2: tsconfig.json を作る**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2022", "DOM"],
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noEmit": true,
    "skipLibCheck": true,
    "types": ["vitest/globals"]
  },
  "include": ["src"]
}
```

- [ ] **Step 3: vite.config.ts を作る**

`base` と `build.outDir` は Global Constraints のとおり。ここを間違えるとデプロイが失敗する。

```ts
import { defineConfig } from 'vite';

export default defineConfig({
  base: '/play/character-tactics/',
  build: {
    outDir: 'out/play/character-tactics',
    emptyOutDir: true,
  },
  test: {
    globals: true,
    environment: 'node',
  },
});
```

- [ ] **Step 4: index.html と .gitignore を作る**

`index.html`:

```html
<!doctype html>
<html lang="ja">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, user-scalable=no" />
    <title>とりでの なかまたち</title>
    <style>
      html, body { margin: 0; padding: 0; height: 100%; background: #101820; overflow: hidden; }
      #app { display: flex; align-items: center; justify-content: center; height: 100%; }
      canvas { display: block; image-rendering: pixelated; touch-action: none; }
    </style>
  </head>
  <body>
    <div id="app"><canvas id="game"></canvas></div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

`.gitignore`:

```
node_modules/
out/
.wrangler/
*.log
.DS_Store
```

- [ ] **Step 5: 依存をインストールする**

Run: `npm install`
Expected: `node_modules/` が作られ、エラーなく終了する

- [ ] **Step 6: 失敗するテストを書く**

`src/core/rng.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { makeRng, nextFloat, nextInt } from './rng';

describe('rng', () => {
  it('同じシードなら同じ列を返す', () => {
    const a = makeRng(12345);
    const b = makeRng(12345);
    const seqA = [nextFloat(a), nextFloat(a), nextFloat(a)];
    const seqB = [nextFloat(b), nextFloat(b), nextFloat(b)];
    expect(seqA).toEqual(seqB);
  });

  it('違うシードなら違う列を返す', () => {
    const a = makeRng(1);
    const b = makeRng(2);
    expect(nextFloat(a)).not.toBe(nextFloat(b));
  });

  it('nextFloat は 0 以上 1 未満を返す', () => {
    const r = makeRng(7);
    for (let i = 0; i < 500; i++) {
      const v = nextFloat(r);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('nextInt は 0 以上 maxExclusive 未満の整数を返す', () => {
    const r = makeRng(99);
    for (let i = 0; i < 500; i++) {
      const v = nextInt(r, 5);
      expect(Number.isInteger(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(5);
    }
  });

  it('maxExclusive が 0 以下なら 0 を返す', () => {
    const r = makeRng(3);
    expect(nextInt(r, 0)).toBe(0);
    expect(nextInt(r, -4)).toBe(0);
  });
});
```

- [ ] **Step 7: テストを走らせて失敗を確認する**

Run: `npm test -- src/core/rng.test.ts`
Expected: FAIL（`Failed to resolve import "./rng"`）

- [ ] **Step 8: 実装を書く**

`src/core/rng.ts`（mulberry32）:

```ts
export type Rng = { seed: number };

export function makeRng(seed: number): Rng {
  return { seed: seed >>> 0 };
}

export function nextFloat(rng: Rng): number {
  rng.seed = (rng.seed + 0x6d2b79f5) >>> 0;
  let t = rng.seed;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export function nextInt(rng: Rng, maxExclusive: number): number {
  if (maxExclusive <= 0) return 0;
  return Math.floor(nextFloat(rng) * maxExclusive);
}
```

- [ ] **Step 9: テストを走らせて通ることを確認する**

Run: `npm test -- src/core/rng.test.ts`
Expected: PASS（5 tests）

- [ ] **Step 10: コミット**

```bash
git add package.json package-lock.json tsconfig.json vite.config.ts index.html .gitignore src/core/rng.ts src/core/rng.test.ts
git commit -m "chore: scaffold vite/typescript/vitest project with seeded rng"
```

---

### Task 2: 型定義とグリッド・フローフィールド

**Files:**
- Create: `src/core/types.ts`, `src/core/field.ts`
- Test: `src/core/field.test.ts`

**Interfaces:**
- Consumes: `Rng` (Task 1)
- Produces:
  - `Vec2 = { x: number; y: number }`
  - `CharId = 'roran' | 'ines' | 'mist' | 'gau'`
  - `EnemyKind = 'narazumono' | 'tatemochi' | 'garum'`
  - `SkillId = 'funbaru' | 'neraiuchi' | 'omajinai' | 'kakenukeru'`
  - `AttackKind = 'melee' | 'bow'`
  - `Grid = { cols: number; rows: number; cell: number; walkable: boolean[] }`
  - `FlowField = { cols: number; rows: number; dist: Int32Array }`
  - `makeGrid(cell: number, rows: string[]): Grid`
  - `cellIndexAt(grid: Grid, pos: Vec2): number`（範囲外は -1）
  - `cellCenter(grid: Grid, index: number): Vec2`
  - `isWalkableAt(grid: Grid, pos: Vec2): boolean`
  - `computeFlowField(grid: Grid, goal: Vec2): FlowField`
  - `flowDirection(grid: Grid, field: FlowField, pos: Vec2): Vec2 | null`
  - `distance(a: Vec2, b: Vec2): number`
  - `distanceToSegment(p: Vec2, a: Vec2, b: Vec2): number`

- [ ] **Step 1: 型定義ファイルを作る**

`src/core/types.ts`（この時点では以降のタスクで使う共通型のうち、座標と識別子だけを置く。ユニットの実行時型は Task 7 で追加する）:

```ts
export type Vec2 = { x: number; y: number };

export type CharId = 'roran' | 'ines' | 'mist' | 'gau';
export type EnemyKind = 'narazumono' | 'tatemochi' | 'garum';
export type SkillId = 'funbaru' | 'neraiuchi' | 'omajinai' | 'kakenukeru';
export type AttackKind = 'melee' | 'bow';

export const CHAR_IDS: readonly CharId[] = ['roran', 'ines', 'mist', 'gau'];
```

- [ ] **Step 2: 失敗するテストを書く**

`src/core/field.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  cellCenter,
  cellIndexAt,
  computeFlowField,
  distance,
  distanceToSegment,
  flowDirection,
  isWalkableAt,
  makeGrid,
} from './field';

// '.' = 歩ける / '#' = 歩けない
const MAP = [
  '.....',
  '.###.',
  '.....',
];

describe('makeGrid', () => {
  it('ASCII マップから列数・行数・歩行可否を作る', () => {
    const g = makeGrid(32, MAP);
    expect(g.cols).toBe(5);
    expect(g.rows).toBe(3);
    expect(g.cell).toBe(32);
    expect(g.walkable[0]).toBe(true);
    expect(g.walkable[1 * 5 + 1]).toBe(false);
  });
});

describe('cellIndexAt / cellCenter', () => {
  it('座標からセル番号を求める', () => {
    const g = makeGrid(32, MAP);
    expect(cellIndexAt(g, { x: 0, y: 0 })).toBe(0);
    expect(cellIndexAt(g, { x: 33, y: 33 })).toBe(1 * 5 + 1);
  });

  it('マップ外は -1 を返す', () => {
    const g = makeGrid(32, MAP);
    expect(cellIndexAt(g, { x: -1, y: 0 })).toBe(-1);
    expect(cellIndexAt(g, { x: 0, y: 999 })).toBe(-1);
  });

  it('セル番号から中心座標を求める', () => {
    const g = makeGrid(32, MAP);
    expect(cellCenter(g, 0)).toEqual({ x: 16, y: 16 });
    expect(cellCenter(g, 6)).toEqual({ x: 48, y: 48 });
  });
});

describe('isWalkableAt', () => {
  it('壁の上では false、床の上では true', () => {
    const g = makeGrid(32, MAP);
    expect(isWalkableAt(g, { x: 48, y: 48 })).toBe(false);
    expect(isWalkableAt(g, { x: 16, y: 16 })).toBe(true);
  });

  it('マップ外は false', () => {
    const g = makeGrid(32, MAP);
    expect(isWalkableAt(g, { x: -5, y: -5 })).toBe(false);
  });
});

describe('computeFlowField', () => {
  it('ゴールの距離は 0、隣接セルは 1', () => {
    const g = makeGrid(32, MAP);
    const f = computeFlowField(g, { x: 16, y: 16 }); // セル 0
    expect(f.dist[0]).toBe(0);
    expect(f.dist[1]).toBe(1);
    expect(f.dist[5]).toBe(1);
  });

  it('壁セルは到達不能の -1 のまま', () => {
    const g = makeGrid(32, MAP);
    const f = computeFlowField(g, { x: 16, y: 16 });
    expect(f.dist[1 * 5 + 1]).toBe(-1);
  });

  it('壁を回り込んだ距離になる', () => {
    const g = makeGrid(32, MAP);
    const f = computeFlowField(g, { x: 16, y: 16 }); // 左上
    // 右上(セル4)へは上段をまっすぐ4歩
    expect(f.dist[4]).toBe(4);
    // 中央下(セル11)へは左端を下って右へ、で 3歩
    expect(f.dist[2 * 5 + 1]).toBe(3);
  });

  it('壁の中をゴールに指定すると全セル到達不能になる', () => {
    const g = makeGrid(32, MAP);
    const f = computeFlowField(g, { x: 48, y: 48 });
    expect(Array.from(f.dist).every((d) => d === -1)).toBe(true);
  });
});

describe('flowDirection', () => {
  it('距離が減る隣へ向かう単位ベクトルを返す', () => {
    const g = makeGrid(32, MAP);
    const f = computeFlowField(g, { x: 16, y: 16 });
    const dir = flowDirection(g, f, { x: 144, y: 16 }); // 右上から左へ
    expect(dir).not.toBeNull();
    expect(dir!.x).toBeCloseTo(-1);
    expect(dir!.y).toBeCloseTo(0);
  });

  it('ゴールに着いていたら null', () => {
    const g = makeGrid(32, MAP);
    const f = computeFlowField(g, { x: 16, y: 16 });
    expect(flowDirection(g, f, { x: 16, y: 16 })).toBeNull();
  });

  it('到達不能な場所にいたら null', () => {
    const g = makeGrid(32, MAP);
    const f = computeFlowField(g, { x: 16, y: 16 });
    expect(flowDirection(g, f, { x: 48, y: 48 })).toBeNull();
  });
});

describe('distance / distanceToSegment', () => {
  it('2点間の距離', () => {
    expect(distance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
  });

  it('線分の途中がいちばん近いとき', () => {
    expect(distanceToSegment({ x: 5, y: 3 }, { x: 0, y: 0 }, { x: 10, y: 0 })).toBe(3);
  });

  it('線分の端の外側にあるとき', () => {
    expect(distanceToSegment({ x: -4, y: 0 }, { x: 0, y: 0 }, { x: 10, y: 0 })).toBe(4);
  });

  it('線分が点に潰れているとき', () => {
    expect(distanceToSegment({ x: 0, y: 5 }, { x: 0, y: 0 }, { x: 0, y: 0 })).toBe(5);
  });
});
```

- [ ] **Step 3: テストを走らせて失敗を確認する**

Run: `npm test -- src/core/field.test.ts`
Expected: FAIL（`Failed to resolve import "./field"`）

- [ ] **Step 4: 実装を書く**

`src/core/field.ts`:

```ts
import type { FlowField, Grid, Vec2 } from './types';

export function makeGrid(cell: number, rows: string[]): Grid {
  const r = rows.length;
  const c = rows[0]?.length ?? 0;
  const walkable = new Array<boolean>(c * r);
  for (let y = 0; y < r; y++) {
    const line = rows[y] ?? '';
    if (line.length !== c) {
      throw new Error(`grid row ${y} has length ${line.length}, expected ${c}`);
    }
    for (let x = 0; x < c; x++) {
      walkable[y * c + x] = line[x] !== '#';
    }
  }
  return { cols: c, rows: r, cell, walkable };
}

export function cellIndexAt(grid: Grid, pos: Vec2): number {
  const cx = Math.floor(pos.x / grid.cell);
  const cy = Math.floor(pos.y / grid.cell);
  if (cx < 0 || cy < 0 || cx >= grid.cols || cy >= grid.rows) return -1;
  return cy * grid.cols + cx;
}

export function cellCenter(grid: Grid, index: number): Vec2 {
  const cx = index % grid.cols;
  const cy = Math.floor(index / grid.cols);
  return { x: cx * grid.cell + grid.cell / 2, y: cy * grid.cell + grid.cell / 2 };
}

export function isWalkableAt(grid: Grid, pos: Vec2): boolean {
  const i = cellIndexAt(grid, pos);
  return i >= 0 && grid.walkable[i] === true;
}

const NEIGHBORS: readonly [number, number][] = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

export function computeFlowField(grid: Grid, goal: Vec2): FlowField {
  const dist = new Int32Array(grid.cols * grid.rows).fill(-1);
  const start = cellIndexAt(grid, goal);
  const field: FlowField = { cols: grid.cols, rows: grid.rows, dist };
  if (start < 0 || grid.walkable[start] !== true) return field;

  dist[start] = 0;
  const queue: number[] = [start];
  for (let head = 0; head < queue.length; head++) {
    const cur = queue[head]!;
    const cx = cur % grid.cols;
    const cy = Math.floor(cur / grid.cols);
    for (const [dx, dy] of NEIGHBORS) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (nx < 0 || ny < 0 || nx >= grid.cols || ny >= grid.rows) continue;
      const ni = ny * grid.cols + nx;
      if (grid.walkable[ni] !== true) continue;
      if (dist[ni] !== -1) continue;
      dist[ni] = dist[cur]! + 1;
      queue.push(ni);
    }
  }
  return field;
}

export function flowDirection(grid: Grid, field: FlowField, pos: Vec2): Vec2 | null {
  const cur = cellIndexAt(grid, pos);
  if (cur < 0) return null;
  const curDist = field.dist[cur];
  if (curDist === undefined || curDist < 0) return null;
  if (curDist === 0) return null;

  const cx = cur % grid.cols;
  const cy = Math.floor(cur / grid.cols);
  let best = -1;
  let bestDist = curDist;
  for (const [dx, dy] of NEIGHBORS) {
    const nx = cx + dx;
    const ny = cy + dy;
    if (nx < 0 || ny < 0 || nx >= grid.cols || ny >= grid.rows) continue;
    const ni = ny * grid.cols + nx;
    const d = field.dist[ni];
    if (d === undefined || d < 0) continue;
    if (d < bestDist) {
      bestDist = d;
      best = ni;
    }
  }
  if (best < 0) return null;
  const target = cellCenter(grid, best);
  const dx = target.x - pos.x;
  const dy = target.y - pos.y;
  const len = Math.hypot(dx, dy);
  if (len === 0) return null;
  return { x: dx / len, y: dy / len };
}

export function distance(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function distanceToSegment(p: Vec2, a: Vec2, b: Vec2): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return distance(p, a);
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  return distance(p, { x: a.x + t * dx, y: a.y + t * dy });
}
```

- [ ] **Step 5: types.ts に Grid と FlowField を追加する**

`src/core/types.ts` の末尾に追記:

```ts
export type Grid = {
  cols: number;
  rows: number;
  cell: number;
  walkable: boolean[];
};

export type FlowField = {
  cols: number;
  rows: number;
  /** ゴールからのセル距離。-1 は到達不能 */
  dist: Int32Array;
};
```

- [ ] **Step 6: テストを走らせて通ることを確認する**

Run: `npm test -- src/core/field.test.ts`
Expected: PASS（15 tests）

- [ ] **Step 7: コミット**

```bash
git add src/core/types.ts src/core/field.ts src/core/field.test.ts
git commit -m "feat: add grid, BFS flow field and geometry helpers"
```

---

### Task 3: キャラクターと敵のデータ定義

**Files:**
- Create: `src/content/characters.ts`, `src/content/enemies.ts`
- Test: `src/content/content.test.ts`

**Interfaces:**
- Consumes: `CharId`, `EnemyKind`, `SkillId`, `AttackKind` (Task 2)
- Produces:
  - `CharDef = { id: CharId; name: string; role: string; maxHp: number; power: number; guard: number; attack: AttackKind; range: number; attackInterval: number; speed: number; skill: SkillId; color: string }`
  - `CHARACTERS: Record<CharId, CharDef>`
  - `EnemyDef = { kind: EnemyKind; name: string; maxHp: number; power: number; guard: number; range: number; attackInterval: number; speed: number; fortDamage: number; bowDamageCap: number | null; fleeAtHpRatio: number | null; color: string }`
  - `ENEMIES: Record<EnemyKind, EnemyDef>`
  - `MELEE_RANGE = 24`、`BOW_RANGE = 160`

- [ ] **Step 1: 失敗するテストを書く**

`src/content/content.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { CHARACTERS, MELEE_RANGE, BOW_RANGE } from './characters';
import { ENEMIES } from './enemies';
import { CHAR_IDS } from '../core/types';

describe('CHARACTERS', () => {
  it('4人が定義されている', () => {
    expect(Object.keys(CHARACTERS).sort()).toEqual([...CHAR_IDS].sort());
  });

  it('キーと id が一致している', () => {
    for (const id of CHAR_IDS) {
      expect(CHARACTERS[id].id).toBe(id);
    }
  });

  it('設計書のステータスどおり', () => {
    expect(CHARACTERS.roran).toMatchObject({ maxHp: 30, power: 6, guard: 5, attack: 'melee', skill: 'funbaru' });
    expect(CHARACTERS.ines).toMatchObject({ maxHp: 20, power: 8, guard: 2, attack: 'bow', skill: 'neraiuchi' });
    expect(CHARACTERS.mist).toMatchObject({ maxHp: 22, power: 4, guard: 3, attack: 'melee', skill: 'omajinai' });
    expect(CHARACTERS.gau).toMatchObject({ maxHp: 24, power: 7, guard: 3, attack: 'melee', skill: 'kakenukeru' });
  });

  it('イネスだけ弓レンジ、ほかは近接レンジ', () => {
    expect(CHARACTERS.ines.range).toBe(BOW_RANGE);
    expect(CHARACTERS.roran.range).toBe(MELEE_RANGE);
    expect(CHARACTERS.mist.range).toBe(MELEE_RANGE);
    expect(CHARACTERS.gau.range).toBe(MELEE_RANGE);
  });

  it('攻撃間隔は近接 1.6 秒 / 弓 2.2 秒', () => {
    expect(CHARACTERS.roran.attackInterval).toBe(1.6);
    expect(CHARACTERS.ines.attackInterval).toBe(2.2);
  });

  it('ガウだけ速い', () => {
    expect(CHARACTERS.gau.speed).toBe(100);
    for (const id of ['roran', 'ines', 'mist'] as const) {
      expect(CHARACTERS[id].speed).toBe(60);
    }
  });

  it('表示名に漢字が含まれない', () => {
    for (const id of CHAR_IDS) {
      expect(CHARACTERS[id].name).not.toMatch(/[一-鿿]/);
    }
  });
});

describe('ENEMIES', () => {
  it('3種が定義されている', () => {
    expect(Object.keys(ENEMIES).sort()).toEqual(['garum', 'narazumono', 'tatemochi']);
  });

  it('設計書のステータスどおり', () => {
    expect(ENEMIES.narazumono).toMatchObject({ maxHp: 12, power: 5, guard: 1, fortDamage: 3, bowDamageCap: null, fleeAtHpRatio: null });
    expect(ENEMIES.tatemochi).toMatchObject({ maxHp: 20, power: 5, guard: 3, fortDamage: 5, bowDamageCap: 1, fleeAtHpRatio: null });
    expect(ENEMIES.garum).toMatchObject({ maxHp: 40, power: 9, guard: 4, fortDamage: 10, bowDamageCap: null, fleeAtHpRatio: 0.3 });
  });

  it('敵は全員近接', () => {
    for (const e of Object.values(ENEMIES)) {
      expect(e.range).toBe(MELEE_RANGE);
    }
  });

  it('表示名に漢字が含まれない', () => {
    for (const e of Object.values(ENEMIES)) {
      expect(e.name).not.toMatch(/[一-鿿]/);
    }
  });
});
```

- [ ] **Step 2: テストを走らせて失敗を確認する**

Run: `npm test -- src/content/content.test.ts`
Expected: FAIL（`Failed to resolve import "./characters"`）

- [ ] **Step 3: characters.ts を書く**

```ts
import type { AttackKind, CharId, SkillId } from '../core/types';

export const MELEE_RANGE = 24;
export const BOW_RANGE = 160;

export type CharDef = {
  id: CharId;
  name: string;
  role: string;
  maxHp: number;
  power: number;
  guard: number;
  attack: AttackKind;
  range: number;
  attackInterval: number;
  speed: number;
  skill: SkillId;
  color: string;
};

export const CHARACTERS: Record<CharId, CharDef> = {
  roran: {
    id: 'roran', name: 'ロラン', role: 'たて',
    maxHp: 30, power: 6, guard: 5,
    attack: 'melee', range: MELEE_RANGE, attackInterval: 1.6, speed: 60,
    skill: 'funbaru', color: '#4a80c8',
  },
  ines: {
    id: 'ines', name: 'イネス', role: 'ゆみ',
    maxHp: 20, power: 8, guard: 2,
    attack: 'bow', range: BOW_RANGE, attackInterval: 2.2, speed: 60,
    skill: 'neraiuchi', color: '#3faa6a',
  },
  mist: {
    id: 'mist', name: 'ミスト', role: 'いやし',
    maxHp: 22, power: 4, guard: 3,
    attack: 'melee', range: MELEE_RANGE, attackInterval: 1.6, speed: 60,
    skill: 'omajinai', color: '#c86fb0',
  },
  gau: {
    id: 'gau', name: 'ガウ', role: 'ものみ',
    maxHp: 24, power: 7, guard: 3,
    attack: 'melee', range: MELEE_RANGE, attackInterval: 1.6, speed: 100,
    skill: 'kakenukeru', color: '#e0a03c',
  },
};
```

- [ ] **Step 4: enemies.ts を書く**

```ts
import type { EnemyKind } from '../core/types';
import { MELEE_RANGE } from './characters';

export type EnemyDef = {
  kind: EnemyKind;
  name: string;
  maxHp: number;
  power: number;
  guard: number;
  range: number;
  attackInterval: number;
  speed: number;
  /** 砦に到達したときに砦へ与えるダメージ */
  fortDamage: number;
  /** 弓によるダメージの上限。null なら上限なし */
  bowDamageCap: number | null;
  /** この HP 割合を下回ると撤退する。null なら撤退しない */
  fleeAtHpRatio: number | null;
  color: string;
};

export const ENEMIES: Record<EnemyKind, EnemyDef> = {
  narazumono: {
    kind: 'narazumono', name: 'ならずもの',
    maxHp: 12, power: 5, guard: 1,
    range: MELEE_RANGE, attackInterval: 1.6, speed: 45,
    fortDamage: 3, bowDamageCap: null, fleeAtHpRatio: null,
    color: '#8a5a4a',
  },
  tatemochi: {
    kind: 'tatemochi', name: 'たてもち',
    maxHp: 20, power: 5, guard: 3,
    range: MELEE_RANGE, attackInterval: 1.8, speed: 35,
    fortDamage: 5, bowDamageCap: 1, fleeAtHpRatio: null,
    color: '#6b6b7a',
  },
  garum: {
    kind: 'garum', name: 'ガルム',
    maxHp: 40, power: 9, guard: 4,
    range: MELEE_RANGE, attackInterval: 1.4, speed: 55,
    fortDamage: 10, bowDamageCap: null, fleeAtHpRatio: 0.3,
    color: '#b03a3a',
  },
};
```

`fleeAtHpRatio` は敵の定義としては常に 0.3 だが、ステージ 3 では撤退させない。ステージ側でこの値を無効化する仕組みは Task 8 で `StageDef.garumFlees: boolean` として入れる。

- [ ] **Step 5: テストを走らせて通ることを確認する**

Run: `npm test -- src/content/content.test.ts`
Expected: PASS（12 tests）

- [ ] **Step 6: コミット**

```bash
git add src/content/characters.ts src/content/enemies.ts src/content/content.test.ts
git commit -m "feat: add character and enemy definitions"
```

---

### Task 4: ダメージ計算と交戦判定

**Files:**
- Create: `src/core/combat.ts`
- Test: `src/core/combat.test.ts`

**Interfaces:**
- Consumes: `Vec2`, `AttackKind` (Task 2)、`distance` (Task 2)
- Produces:
  - `DamageParams = { power: number; guard: number; attackKind: AttackKind; bowDamageCap: number | null; bondBonus: number; neraiuchi: boolean; targetFunbaru: boolean }`
  - `computeDamage(p: DamageParams): number`
  - `nearestWithin<T extends { pos: Vec2 }>(from: Vec2, candidates: T[], range: number): T | null`
  - `hasThreatWithinMelee(pos: Vec2, threats: { pos: Vec2 }[]): boolean`
  - `effectiveInterval(base: number, attackKind: AttackKind, meleeThreat: boolean): number`

- [ ] **Step 1: 失敗するテストを書く**

`src/core/combat.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { computeDamage, effectiveInterval, hasThreatWithinMelee, nearestWithin } from './combat';
import type { DamageParams } from './combat';

const base: DamageParams = {
  power: 6, guard: 1, attackKind: 'melee',
  bowDamageCap: null, bondBonus: 0, neraiuchi: false, targetFunbaru: false,
};

describe('computeDamage', () => {
  it('ちから - まもり', () => {
    expect(computeDamage({ ...base, power: 6, guard: 1 })).toBe(5);
  });

  it('引き算の結果が 0 以下でも最低 1', () => {
    expect(computeDamage({ ...base, power: 4, guard: 9 })).toBe(1);
  });

  it('なかよし支援ぶんが加算される', () => {
    expect(computeDamage({ ...base, power: 8, guard: 1, bondBonus: 2 })).toBe(9);
  });

  it('たてもちは弓ダメージが上限 1 に固定される', () => {
    expect(computeDamage({ ...base, power: 8, guard: 3, attackKind: 'bow', bowDamageCap: 1 })).toBe(1);
  });

  it('近接ならたてもちの上限は効かない', () => {
    expect(computeDamage({ ...base, power: 8, guard: 3, attackKind: 'melee', bowDamageCap: 1 })).toBe(5);
  });

  it('ねらいうちは 2 倍になり、たてもちの上限を無視する', () => {
    expect(computeDamage({ ...base, power: 8, guard: 3, attackKind: 'bow', bowDamageCap: 1, neraiuchi: true })).toBe(10);
  });

  it('ふんばり中の相手には切り捨てで半分', () => {
    expect(computeDamage({ ...base, power: 9, guard: 4, targetFunbaru: true })).toBe(2);
  });

  it('ふんばりで 0 になっても最低 1', () => {
    expect(computeDamage({ ...base, power: 5, guard: 5, targetFunbaru: true })).toBe(1);
  });

  it('支援と半減の両方がかかる順序（加算 → 半減）', () => {
    // (8 + 2) - 4 = 6 -> ふんばりで 3
    expect(computeDamage({ ...base, power: 8, guard: 4, bondBonus: 2, targetFunbaru: true })).toBe(3);
  });
});

describe('nearestWithin', () => {
  const from = { x: 0, y: 0 };

  it('レンジ内でいちばん近いものを返す', () => {
    const c = [{ pos: { x: 100, y: 0 } }, { pos: { x: 30, y: 0 } }, { pos: { x: 60, y: 0 } }];
    expect(nearestWithin(from, c, 160)).toBe(c[1]);
  });

  it('レンジ外しかなければ null', () => {
    expect(nearestWithin(from, [{ pos: { x: 200, y: 0 } }], 160)).toBeNull();
  });

  it('ちょうどレンジ上は含む', () => {
    const c = [{ pos: { x: 24, y: 0 } }];
    expect(nearestWithin(from, c, 24)).toBe(c[0]);
  });

  it('候補が空なら null', () => {
    expect(nearestWithin(from, [], 160)).toBeNull();
  });
});

describe('hasThreatWithinMelee', () => {
  it('24px 以内に敵がいれば true', () => {
    expect(hasThreatWithinMelee({ x: 0, y: 0 }, [{ pos: { x: 20, y: 0 } }])).toBe(true);
  });

  it('24px より外なら false', () => {
    expect(hasThreatWithinMelee({ x: 0, y: 0 }, [{ pos: { x: 25, y: 0 } }])).toBe(false);
  });
});

describe('effectiveInterval', () => {
  it('弓は密着されると攻撃間隔が倍', () => {
    expect(effectiveInterval(2.2, 'bow', true)).toBeCloseTo(4.4);
  });

  it('弓でも密着されていなければそのまま', () => {
    expect(effectiveInterval(2.2, 'bow', false)).toBeCloseTo(2.2);
  });

  it('近接は密着されていても変わらない', () => {
    expect(effectiveInterval(1.6, 'melee', true)).toBeCloseTo(1.6);
  });
});
```

- [ ] **Step 2: テストを走らせて失敗を確認する**

Run: `npm test -- src/core/combat.test.ts`
Expected: FAIL（`Failed to resolve import "./combat"`）

- [ ] **Step 3: 実装を書く**

`src/core/combat.ts`:

```ts
import { distance } from './field';
import { MELEE_RANGE } from '../content/characters';
import type { AttackKind, Vec2 } from './types';

export type DamageParams = {
  power: number;
  guard: number;
  attackKind: AttackKind;
  /** 防御側が弓ダメージに上限を持つならその値。持たないなら null */
  bowDamageCap: number | null;
  /** 攻撃側にかかっているなかよし支援の合計 */
  bondBonus: number;
  /** ねらいうちが乗っているか */
  neraiuchi: boolean;
  /** 防御側がふんばり中か */
  targetFunbaru: boolean;
};

export function computeDamage(p: DamageParams): number {
  let dmg = p.power + p.bondBonus - p.guard;
  if (dmg < 1) dmg = 1;

  if (p.neraiuchi) {
    dmg *= 2;
  } else if (p.attackKind === 'bow' && p.bowDamageCap !== null) {
    dmg = Math.min(dmg, p.bowDamageCap);
  }

  if (p.targetFunbaru) {
    dmg = Math.floor(dmg / 2);
  }

  return Math.max(1, dmg);
}

export function nearestWithin<T extends { pos: Vec2 }>(
  from: Vec2,
  candidates: T[],
  range: number,
): T | null {
  let best: T | null = null;
  let bestDist = Infinity;
  for (const c of candidates) {
    const d = distance(from, c.pos);
    if (d <= range && d < bestDist) {
      bestDist = d;
      best = c;
    }
  }
  return best;
}

export function hasThreatWithinMelee(pos: Vec2, threats: { pos: Vec2 }[]): boolean {
  return threats.some((t) => distance(pos, t.pos) <= MELEE_RANGE);
}

export function effectiveInterval(
  base: number,
  attackKind: AttackKind,
  meleeThreat: boolean,
): number {
  return attackKind === 'bow' && meleeThreat ? base * 2 : base;
}
```

- [ ] **Step 4: テストを走らせて通ることを確認する**

Run: `npm test -- src/core/combat.test.ts`
Expected: PASS（18 tests）

- [ ] **Step 5: コミット**

```bash
git add src/core/combat.ts src/core/combat.test.ts
git commit -m "feat: add damage calculation and engagement helpers"
```

---

### Task 5: なかよし支援

**Files:**
- Create: `src/core/bonds.ts`
- Test: `src/core/bonds.test.ts`

**Interfaces:**
- Consumes: `CharId`, `Vec2` (Task 2)、`distance` (Task 2)
- Produces:
  - `BOND_RANGE = 200`
  - `Bond = { a: CharId; b: CharId; bonus: number }`
  - `BONDS: readonly Bond[]`
  - `BondSupporter = { id: CharId; pos: Vec2; retired: boolean }`
  - `bondSupporters(selfId: CharId, selfPos: Vec2, others: BondSupporter[]): { id: CharId; bonus: number }[]`
  - `bondBonus(selfId: CharId, selfPos: Vec2, others: BondSupporter[]): number`

- [ ] **Step 1: 失敗するテストを書く**

`src/core/bonds.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { BONDS, BOND_RANGE, bondBonus, bondSupporters } from './bonds';
import type { BondSupporter } from './bonds';

const at = (id: BondSupporter['id'], x: number, retired = false): BondSupporter => ({
  id, pos: { x, y: 0 }, retired,
});

describe('BONDS', () => {
  it('設計書どおり 3 ペア', () => {
    expect(BONDS).toHaveLength(3);
    expect(BONDS).toContainEqual({ a: 'roran', b: 'ines', bonus: 2 });
    expect(BONDS).toContainEqual({ a: 'mist', b: 'gau', bonus: 2 });
    expect(BONDS).toContainEqual({ a: 'roran', b: 'mist', bonus: 1 });
  });
});

describe('bondBonus', () => {
  it('なかよし相手が範囲内にいると加算される', () => {
    expect(bondBonus('roran', { x: 0, y: 0 }, [at('ines', 100)])).toBe(2);
  });

  it('範囲外なら 0', () => {
    expect(bondBonus('roran', { x: 0, y: 0 }, [at('ines', 201)])).toBe(0);
  });

  it('ちょうど 200px は範囲内', () => {
    expect(bondBonus('roran', { x: 0, y: 0 }, [at('ines', BOND_RANGE)])).toBe(2);
  });

  it('なかよしでない相手は加算されない', () => {
    expect(bondBonus('ines', { x: 0, y: 0 }, [at('gau', 50)])).toBe(0);
  });

  it('複数のなかよし相手がいれば合計する', () => {
    expect(bondBonus('roran', { x: 0, y: 0 }, [at('ines', 50), at('mist', 80)])).toBe(3);
  });

  it('たいきゃく中の相手は支援しない', () => {
    expect(bondBonus('roran', { x: 0, y: 0 }, [at('ines', 50, true)])).toBe(0);
  });

  it('自分自身は数えない', () => {
    expect(bondBonus('roran', { x: 0, y: 0 }, [at('roran', 0)])).toBe(0);
  });

  it('ペアはどちら向きでも成立する', () => {
    expect(bondBonus('ines', { x: 0, y: 0 }, [at('roran', 50)])).toBe(2);
  });
});

describe('bondSupporters', () => {
  it('支援している相手の一覧を返す', () => {
    const r = bondSupporters('roran', { x: 0, y: 0 }, [at('ines', 50), at('mist', 80), at('gau', 10)]);
    expect(r).toEqual([
      { id: 'ines', bonus: 2 },
      { id: 'mist', bonus: 1 },
    ]);
  });

  it('誰もいなければ空配列', () => {
    expect(bondSupporters('gau', { x: 0, y: 0 }, [at('ines', 10)])).toEqual([]);
  });
});
```

- [ ] **Step 2: テストを走らせて失敗を確認する**

Run: `npm test -- src/core/bonds.test.ts`
Expected: FAIL（`Failed to resolve import "./bonds"`）

- [ ] **Step 3: 実装を書く**

`src/core/bonds.ts`:

```ts
import { distance } from './field';
import type { CharId, Vec2 } from './types';

export const BOND_RANGE = 200;

export type Bond = { a: CharId; b: CharId; bonus: number };

export const BONDS: readonly Bond[] = [
  { a: 'roran', b: 'ines', bonus: 2 },
  { a: 'mist', b: 'gau', bonus: 2 },
  { a: 'roran', b: 'mist', bonus: 1 },
];

export type BondSupporter = { id: CharId; pos: Vec2; retired: boolean };

function bonusBetween(a: CharId, b: CharId): number {
  for (const bond of BONDS) {
    if ((bond.a === a && bond.b === b) || (bond.a === b && bond.b === a)) {
      return bond.bonus;
    }
  }
  return 0;
}

export function bondSupporters(
  selfId: CharId,
  selfPos: Vec2,
  others: BondSupporter[],
): { id: CharId; bonus: number }[] {
  const result: { id: CharId; bonus: number }[] = [];
  for (const other of others) {
    if (other.id === selfId) continue;
    if (other.retired) continue;
    const bonus = bonusBetween(selfId, other.id);
    if (bonus === 0) continue;
    if (distance(selfPos, other.pos) > BOND_RANGE) continue;
    result.push({ id: other.id, bonus });
  }
  return result;
}

export function bondBonus(selfId: CharId, selfPos: Vec2, others: BondSupporter[]): number {
  return bondSupporters(selfId, selfPos, others).reduce((sum, s) => sum + s.bonus, 0);
}
```

- [ ] **Step 4: テストを走らせて通ることを確認する**

Run: `npm test -- src/core/bonds.test.ts`
Expected: PASS（11 tests）

- [ ] **Step 5: コミット**

```bash
git add src/core/bonds.ts src/core/bonds.test.ts
git commit -m "feat: add bond support calculation"
```

---

### Task 6: 戦闘状態の型と初期化・ウェーブ開始

**Files:**
- Modify: `src/core/types.ts`（末尾に追記）
- Create: `src/core/state.ts`
- Test: `src/core/state.test.ts`

**Interfaces:**
- Consumes: `Grid`, `FlowField`, `makeGrid`, `computeFlowField` (Task 2)、`CHARACTERS` (Task 3)、`ENEMIES` (Task 3)、`makeRng` (Task 1)
- Produces（`types.ts`）:
  - `CharProgress = { level: number; xp: number }`
  - `AllyUnit`, `EnemyUnit`, `SpawnEntry`, `WaveDef`, `StageDef`, `BattlePhase`, `SimEvent`, `CharBattleStats`, `BattleState`（本文のコード参照）
  - `FORT_MAX_HP = 30`
- Produces（`state.ts`）:
  - `statsForLevel(id: CharId, level: number): { maxHp: number; power: number }`
  - `createBattleState(stage: StageDef, progress: Record<CharId, CharProgress>, seed: number): BattleState`
  - `placeAlly(state: BattleState, id: CharId, pos: Vec2): void`
  - `startWave(state: BattleState): void`

- [ ] **Step 1: types.ts に実行時の型を追記する**

`src/core/types.ts` の末尾に追記:

```ts
import type { Rng } from './rng';

export const FORT_MAX_HP = 30;

export type CharProgress = { level: number; xp: number };

export type AllyUnit = {
  id: CharId;
  pos: Vec2;
  hp: number;
  maxHp: number;
  power: number;
  guard: number;
  attack: AttackKind;
  range: number;
  attackInterval: number;
  speed: number;
  skill: SkillId;
  /** 移動先へのフローフィールド。null なら移動しない */
  goalField: FlowField | null;
  /** 交戦中の敵の uid。null なら非交戦 */
  engagedWith: string | null;
  attackCooldown: number;
  /** このウェーブでスキルを使ったか */
  skillUsed: boolean;
  retired: boolean;
  /** ふんばりの効果が切れる時刻（state.time 基準）。過去の値なら効果なし */
  funbaruUntil: number;
  neraiuchiArmed: boolean;
  /** このウェーブでピンチのセリフを出したか */
  pinchShown: boolean;
  /** このステージで交戦したことのある敵種 */
  seenKinds: EnemyKind[];
};

export type EnemyUnit = {
  uid: string;
  kind: EnemyKind;
  pos: Vec2;
  hp: number;
  maxHp: number;
  engagedWith: CharId | null;
  attackCooldown: number;
  /** 最後にこの敵を攻撃した味方。撃破の手柄をつけるのに使う */
  lastHitBy: CharId | null;
  /** 最後に受けた攻撃がねらいうちだったか */
  lastHitNeraiuchi: boolean;
};

export type SpawnEntry = { at: number; kind: EnemyKind; from: Vec2 };
export type WaveDef = { spawns: SpawnEntry[] };

export type StageDef = {
  id: number;
  name: string;
  cell: number;
  /** '.' = 歩ける / '#' = 歩けない */
  mapRows: string[];
  fort: Vec2;
  landings: Vec2[];
  waves: WaveDef[];
  /** false ならガルムは撤退せず最後まで戦う（ステージ3） */
  garumFlees: boolean;
};

export type BattlePhase = 'placement' | 'wave' | 'waveCleared' | 'stageCleared' | 'defeat';

export type SimEvent =
  | { type: 'engage'; allyId: CharId; enemyUid: string; kind: EnemyKind; firstMeeting: boolean }
  | { type: 'skill'; allyId: CharId; skill: SkillId }
  | { type: 'pinch'; allyId: CharId }
  | { type: 'hit'; targetPos: Vec2; amount: number }
  | { type: 'enemyDefeated'; uid: string; kind: EnemyKind; byAlly: CharId | null }
  | { type: 'garumRepelled'; byAlly: CharId | null }
  | { type: 'allyRetired'; allyId: CharId }
  | { type: 'bondSupport'; supporterId: CharId; targetId: CharId }
  | { type: 'fortDamaged'; amount: number };

export type CharBattleStats = {
  defeats: number;
  skillUses: number;
  neraiuchiKills: number;
  kakenukeruHits: number;
  bondSupports: number;
};

export type BattleState = {
  stage: StageDef;
  grid: Grid;
  /** 砦をゴールとするフローフィールド。全敵で共有する */
  enemyField: FlowField;
  fortHp: number;
  waveIndex: number;
  /** ウェーブ開始からの経過秒 */
  time: number;
  phase: BattlePhase;
  allies: AllyUnit[];
  enemies: EnemyUnit[];
  /** まだ出現していないスポーン */
  pending: SpawnEntry[];
  /** 直近の step で発生したイベント */
  events: SimEvent[];
  rng: Rng;
  stats: Record<CharId, CharBattleStats>;
  nextEnemyUid: number;
};
```

- [ ] **Step 2: 失敗するテストを書く**

`src/core/state.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { createBattleState, placeAlly, startWave, statsForLevel } from './state';
import { CHAR_IDS, FORT_MAX_HP } from './types';
import type { CharId, CharProgress, StageDef } from './types';

const STAGE: StageDef = {
  id: 1,
  name: 'テストの しま',
  cell: 32,
  mapRows: ['.....', '.....', '.....'],
  fort: { x: 16, y: 16 },
  landings: [{ x: 144, y: 16 }],
  garumFlees: true,
  waves: [
    { spawns: [{ at: 0, kind: 'narazumono', from: { x: 144, y: 16 } }] },
    { spawns: [{ at: 1, kind: 'narazumono', from: { x: 144, y: 16 } }] },
  ],
};

const LV1: Record<CharId, CharProgress> = {
  roran: { level: 1, xp: 0 },
  ines: { level: 1, xp: 0 },
  mist: { level: 1, xp: 0 },
  gau: { level: 1, xp: 0 },
};

describe('statsForLevel', () => {
  it('レベル1 は基礎値どおり', () => {
    expect(statsForLevel('roran', 1)).toEqual({ maxHp: 30, power: 6 });
  });

  it('レベルが上がると HP+3 / ちから+1', () => {
    expect(statsForLevel('roran', 3)).toEqual({ maxHp: 36, power: 8 });
  });
});

describe('createBattleState', () => {
  it('4人ぶんのユニットが作られる', () => {
    const s = createBattleState(STAGE, LV1, 1);
    expect(s.allies.map((a) => a.id).sort()).toEqual([...CHAR_IDS].sort());
  });

  it('砦 HP は満タン、フェーズは placement', () => {
    const s = createBattleState(STAGE, LV1, 1);
    expect(s.fortHp).toBe(FORT_MAX_HP);
    expect(s.phase).toBe('placement');
  });

  it('敵はまだ出ていない', () => {
    const s = createBattleState(STAGE, LV1, 1);
    expect(s.enemies).toEqual([]);
    expect(s.pending).toEqual([]);
  });

  it('レベルが反映される', () => {
    const s = createBattleState(STAGE, { ...LV1, roran: { level: 3, xp: 0 } }, 1);
    const roran = s.allies.find((a) => a.id === 'roran')!;
    expect(roran.maxHp).toBe(36);
    expect(roran.hp).toBe(36);
    expect(roran.power).toBe(8);
  });

  it('砦へのフローフィールドが計算されている', () => {
    const s = createBattleState(STAGE, LV1, 1);
    expect(s.enemyField.dist[0]).toBe(0);
    expect(s.enemyField.dist[4]).toBe(4);
  });

  it('戦績カウンタが 0 で初期化される', () => {
    const s = createBattleState(STAGE, LV1, 1);
    expect(s.stats.roran).toEqual({ defeats: 0, skillUses: 0, neraiuchiKills: 0, kakenukeruHits: 0, bondSupports: 0 });
  });
});

describe('placeAlly', () => {
  it('歩ける場所には置ける', () => {
    const s = createBattleState(STAGE, LV1, 1);
    placeAlly(s, 'roran', { x: 80, y: 48 });
    expect(s.allies.find((a) => a.id === 'roran')!.pos).toEqual({ x: 80, y: 48 });
  });

  it('歩けない場所には置けない（位置が変わらない）', () => {
    const stage: StageDef = { ...STAGE, mapRows: ['.....', '.#...', '.....'] };
    const s = createBattleState(stage, LV1, 1);
    const before = { ...s.allies.find((a) => a.id === 'roran')!.pos };
    placeAlly(s, 'roran', { x: 48, y: 48 });
    expect(s.allies.find((a) => a.id === 'roran')!.pos).toEqual(before);
  });
});

describe('startWave', () => {
  it('フェーズが wave になり、時刻がリセットされる', () => {
    const s = createBattleState(STAGE, LV1, 1);
    s.time = 99;
    startWave(s);
    expect(s.phase).toBe('wave');
    expect(s.time).toBe(0);
  });

  it('そのウェーブのスポーンが pending に積まれる', () => {
    const s = createBattleState(STAGE, LV1, 1);
    startWave(s);
    expect(s.pending).toHaveLength(1);
    expect(s.pending[0]!.kind).toBe('narazumono');
  });

  it('生き残りは最大 HP の 30% 回復する', () => {
    const s = createBattleState(STAGE, LV1, 1);
    const roran = s.allies.find((a) => a.id === 'roran')!;
    roran.hp = 10;
    startWave(s);
    expect(roran.hp).toBe(19); // 10 + floor(30 * 0.3)
  });

  it('回復しても最大 HP を超えない', () => {
    const s = createBattleState(STAGE, LV1, 1);
    const roran = s.allies.find((a) => a.id === 'roran')!;
    roran.hp = 29;
    startWave(s);
    expect(roran.hp).toBe(30);
  });

  it('たいきゃく中の味方は最大 HP の 50% で復帰し、30% 回復は重ねない', () => {
    const s = createBattleState(STAGE, LV1, 1);
    const roran = s.allies.find((a) => a.id === 'roran')!;
    roran.retired = true;
    roran.hp = 0;
    startWave(s);
    expect(roran.retired).toBe(false);
    expect(roran.hp).toBe(15);
  });

  it('スキル使用フラグとピンチ表示フラグがリセットされる', () => {
    const s = createBattleState(STAGE, LV1, 1);
    const roran = s.allies.find((a) => a.id === 'roran')!;
    roran.skillUsed = true;
    roran.pinchShown = true;
    roran.engagedWith = 'e1';
    startWave(s);
    expect(roran.skillUsed).toBe(false);
    expect(roran.pinchShown).toBe(false);
    expect(roran.engagedWith).toBeNull();
  });

  it('2 回目の startWave は次のウェーブを読む', () => {
    const s = createBattleState(STAGE, LV1, 1);
    startWave(s);
    s.waveIndex = 1;
    startWave(s);
    expect(s.pending[0]!.at).toBe(1);
  });
});
```

- [ ] **Step 3: テストを走らせて失敗を確認する**

Run: `npm test -- src/core/state.test.ts`
Expected: FAIL（`Failed to resolve import "./state"`）

- [ ] **Step 4: 実装を書く**

`src/core/state.ts`:

```ts
import { CHARACTERS } from '../content/characters';
import { computeFlowField, isWalkableAt, makeGrid } from './field';
import { makeRng } from './rng';
import { CHAR_IDS, FORT_MAX_HP } from './types';
import type {
  AllyUnit,
  BattleState,
  CharBattleStats,
  CharId,
  CharProgress,
  StageDef,
  Vec2,
} from './types';

const HP_PER_LEVEL = 3;
const POWER_PER_LEVEL = 1;
const WAVE_HEAL_RATIO = 0.3;
const REVIVE_HP_RATIO = 0.5;

export function statsForLevel(id: CharId, level: number): { maxHp: number; power: number } {
  const def = CHARACTERS[id];
  const steps = Math.max(0, level - 1);
  return {
    maxHp: def.maxHp + steps * HP_PER_LEVEL,
    power: def.power + steps * POWER_PER_LEVEL,
  };
}

function emptyStats(): CharBattleStats {
  return { defeats: 0, skillUses: 0, neraiuchiKills: 0, kakenukeruHits: 0, bondSupports: 0 };
}

function makeAlly(id: CharId, level: number, pos: Vec2): AllyUnit {
  const def = CHARACTERS[id];
  const { maxHp, power } = statsForLevel(id, level);
  return {
    id,
    pos: { ...pos },
    hp: maxHp,
    maxHp,
    power,
    guard: def.guard,
    attack: def.attack,
    range: def.range,
    attackInterval: def.attackInterval,
    speed: def.speed,
    skill: def.skill,
    goalField: null,
    engagedWith: null,
    attackCooldown: 0,
    skillUsed: false,
    retired: false,
    funbaruUntil: -1,
    neraiuchiArmed: false,
    pinchShown: false,
    seenKinds: [],
  };
}

export function createBattleState(
  stage: StageDef,
  progress: Record<CharId, CharProgress>,
  seed: number,
): BattleState {
  const grid = makeGrid(stage.cell, stage.mapRows);
  const stats = {} as Record<CharId, CharBattleStats>;
  for (const id of CHAR_IDS) stats[id] = emptyStats();

  return {
    stage,
    grid,
    enemyField: computeFlowField(grid, stage.fort),
    fortHp: FORT_MAX_HP,
    waveIndex: 0,
    time: 0,
    phase: 'placement',
    allies: CHAR_IDS.map((id) => makeAlly(id, progress[id].level, stage.fort)),
    enemies: [],
    pending: [],
    events: [],
    rng: makeRng(seed),
    stats,
    nextEnemyUid: 1,
  };
}

export function placeAlly(state: BattleState, id: CharId, pos: Vec2): void {
  if (!isWalkableAt(state.grid, pos)) return;
  const ally = state.allies.find((a) => a.id === id);
  if (!ally) return;
  ally.pos = { ...pos };
  ally.goalField = null;
}

export function startWave(state: BattleState): void {
  for (const ally of state.allies) {
    if (ally.retired) {
      ally.retired = false;
      ally.hp = Math.max(1, Math.floor(ally.maxHp * REVIVE_HP_RATIO));
    } else {
      ally.hp = Math.min(ally.maxHp, ally.hp + Math.floor(ally.maxHp * WAVE_HEAL_RATIO));
    }
    ally.skillUsed = false;
    ally.pinchShown = false;
    ally.engagedWith = null;
    ally.attackCooldown = 0;
    ally.goalField = null;
    ally.funbaruUntil = -1;
    ally.neraiuchiArmed = false;
  }

  const wave = state.stage.waves[state.waveIndex];
  state.pending = wave ? wave.spawns.map((s) => ({ ...s, from: { ...s.from } })) : [];
  state.enemies = [];
  state.events = [];
  state.time = 0;
  state.phase = 'wave';
}
```

- [ ] **Step 5: テストを走らせて通ることを確認する**

Run: `npm test -- src/core/state.test.ts`
Expected: PASS（17 tests）

- [ ] **Step 6: 型チェックを走らせる**

Run: `npx tsc --noEmit`
Expected: エラーなし

- [ ] **Step 7: コミット**

```bash
git add src/core/types.ts src/core/state.ts src/core/state.test.ts
git commit -m "feat: add battle state types, creation and wave setup"
```

---

### Task 7: 固有スキル

**Files:**
- Create: `src/core/skills.ts`
- Test: `src/core/skills.test.ts`

**Interfaces:**
- Consumes: `BattleState`, `AllyUnit`, `CharId`, `Vec2` (Task 6)、`distance`, `distanceToSegment`, `isWalkableAt` (Task 2)、`MELEE_RANGE` (Task 3)、`BOND_RANGE` (Task 5)
- Produces:
  - `FUNBARU_DURATION = 5`、`OMAJINAI_HEAL = 12`、`KAKENUKERU_DAMAGE = 5`
  - `canUseSkill(state: BattleState, allyId: CharId): boolean`
  - `useSkill(state: BattleState, allyId: CharId, dest?: Vec2): boolean`（発動できたら true）
  - `isFunbaruActive(ally: AllyUnit, time: number): boolean`

スキルは HP を減らすだけで、撃破判定と敵の除去はしない。それは `step()` の後段（Task 9）がまとめて行う。

- [ ] **Step 1: 失敗するテストを書く**

`src/core/skills.test.ts`:

```ts
import { beforeEach, describe, expect, it } from 'vitest';
import { createBattleState, startWave } from './state';
import { canUseSkill, isFunbaruActive, useSkill, FUNBARU_DURATION, OMAJINAI_HEAL, KAKENUKERU_DAMAGE } from './skills';
import type { BattleState, CharId, CharProgress, EnemyUnit, StageDef } from './types';

const STAGE: StageDef = {
  id: 1, name: 'テスト', cell: 32,
  mapRows: ['..........', '..........', '..........'],
  fort: { x: 16, y: 16 },
  landings: [{ x: 300, y: 16 }],
  garumFlees: true,
  waves: [{ spawns: [] }],
};

const LV1: Record<CharId, CharProgress> = {
  roran: { level: 1, xp: 0 }, ines: { level: 1, xp: 0 },
  mist: { level: 1, xp: 0 }, gau: { level: 1, xp: 0 },
};

function addEnemy(s: BattleState, x: number, y: number, hp = 12): EnemyUnit {
  const e: EnemyUnit = {
    uid: `e${s.nextEnemyUid++}`, kind: 'narazumono',
    pos: { x, y }, hp, maxHp: 12, engagedWith: null, attackCooldown: 0,
    lastHitBy: null, lastHitNeraiuchi: false,
  };
  s.enemies.push(e);
  return e;
}

const ally = (s: BattleState, id: CharId) => s.allies.find((a) => a.id === id)!;

describe('canUseSkill', () => {
  let s: BattleState;
  beforeEach(() => {
    s = createBattleState(STAGE, LV1, 1);
    startWave(s);
  });

  it('ウェーブ中で未使用なら使える', () => {
    expect(canUseSkill(s, 'roran')).toBe(true);
  });

  it('一度使うと同じウェーブでは使えない', () => {
    useSkill(s, 'roran');
    expect(canUseSkill(s, 'roran')).toBe(false);
  });

  it('たいきゃく中は使えない', () => {
    ally(s, 'roran').retired = true;
    expect(canUseSkill(s, 'roran')).toBe(false);
  });

  it('ウェーブ中でなければ使えない', () => {
    s.phase = 'waveCleared';
    expect(canUseSkill(s, 'roran')).toBe(false);
  });

  it('次のウェーブが始まればまた使える', () => {
    useSkill(s, 'roran');
    startWave(s);
    expect(canUseSkill(s, 'roran')).toBe(true);
  });
});

describe('ふんばる', () => {
  it('5 秒間の効果が付き、skill イベントが出る', () => {
    const s = createBattleState(STAGE, LV1, 1);
    startWave(s);
    s.time = 10;
    expect(useSkill(s, 'roran')).toBe(true);
    expect(ally(s, 'roran').funbaruUntil).toBe(10 + FUNBARU_DURATION);
    expect(s.events).toContainEqual({ type: 'skill', allyId: 'roran', skill: 'funbaru' });
    expect(s.stats.roran.skillUses).toBe(1);
  });

  it('isFunbaruActive は期限内だけ true', () => {
    const s = createBattleState(STAGE, LV1, 1);
    startWave(s);
    useSkill(s, 'roran');
    expect(isFunbaruActive(ally(s, 'roran'), 4.9)).toBe(true);
    expect(isFunbaruActive(ally(s, 'roran'), 5.1)).toBe(false);
  });
});

describe('ねらいうち', () => {
  it('次の一撃に効果が乗る', () => {
    const s = createBattleState(STAGE, LV1, 1);
    startWave(s);
    expect(useSkill(s, 'ines')).toBe(true);
    expect(ally(s, 'ines').neraiuchiArmed).toBe(true);
  });
});

describe('おまじない', () => {
  it('範囲内で HP 割合がいちばん低い味方を回復する', () => {
    const s = createBattleState(STAGE, LV1, 1);
    startWave(s);
    ally(s, 'mist').pos = { x: 100, y: 16 };
    ally(s, 'roran').pos = { x: 150, y: 16 };
    ally(s, 'roran').hp = 5;
    ally(s, 'gau').pos = { x: 120, y: 16 };
    ally(s, 'gau').hp = 20;
    useSkill(s, 'mist');
    expect(ally(s, 'roran').hp).toBe(5 + OMAJINAI_HEAL);
    expect(ally(s, 'gau').hp).toBe(20);
  });

  it('最大 HP を超えて回復しない', () => {
    const s = createBattleState(STAGE, LV1, 1);
    startWave(s);
    for (const a of s.allies) a.pos = { x: 100, y: 16 };
    ally(s, 'ines').hp = 19;
    useSkill(s, 'mist');
    expect(ally(s, 'ines').hp).toBe(20);
  });

  it('範囲内に誰もいなければ自分を回復する', () => {
    const s = createBattleState(STAGE, LV1, 1);
    startWave(s);
    ally(s, 'mist').pos = { x: 16, y: 16 };
    for (const a of s.allies) if (a.id !== 'mist') a.pos = { x: 300, y: 80 };
    ally(s, 'mist').hp = 5;
    useSkill(s, 'mist');
    expect(ally(s, 'mist').hp).toBe(17);
  });

  it('たいきゃく中の味方は対象にならない', () => {
    const s = createBattleState(STAGE, LV1, 1);
    startWave(s);
    for (const a of s.allies) a.pos = { x: 100, y: 16 };
    ally(s, 'roran').hp = 1;
    ally(s, 'roran').retired = true;
    ally(s, 'ines').hp = 10;
    useSkill(s, 'mist');
    expect(ally(s, 'roran').hp).toBe(1);
    expect(ally(s, 'ines').hp).toBe(20);
  });
});

describe('かけぬける', () => {
  it('目的地まで移動し、経路上の敵にダメージを与える', () => {
    const s = createBattleState(STAGE, LV1, 1);
    startWave(s);
    ally(s, 'gau').pos = { x: 16, y: 16 };
    const onPath = addEnemy(s, 100, 16);
    const offPath = addEnemy(s, 100, 80);
    expect(useSkill(s, 'gau', { x: 200, y: 16 })).toBe(true);
    expect(ally(s, 'gau').pos).toEqual({ x: 200, y: 16 });
    expect(onPath.hp).toBe(12 - KAKENUKERU_DAMAGE);
    expect(offPath.hp).toBe(12);
    expect(s.stats.gau.kakenukeruHits).toBe(1);
  });

  it('目的地の指定がなければ発動しない', () => {
    const s = createBattleState(STAGE, LV1, 1);
    startWave(s);
    expect(useSkill(s, 'gau')).toBe(false);
    expect(canUseSkill(s, 'gau')).toBe(true);
  });

  it('歩けない目的地なら発動しない', () => {
    const stage: StageDef = { ...STAGE, mapRows: ['..........', '.....#....', '..........'] };
    const s = createBattleState(stage, LV1, 1);
    startWave(s);
    expect(useSkill(s, 'gau', { x: 176, y: 48 })).toBe(false);
    expect(canUseSkill(s, 'gau')).toBe(true);
  });

  it('交戦は解除される', () => {
    const s = createBattleState(STAGE, LV1, 1);
    startWave(s);
    ally(s, 'gau').pos = { x: 16, y: 16 };
    ally(s, 'gau').engagedWith = 'e1';
    useSkill(s, 'gau', { x: 200, y: 16 });
    expect(ally(s, 'gau').engagedWith).toBeNull();
  });
});
```

- [ ] **Step 2: テストを走らせて失敗を確認する**

Run: `npm test -- src/core/skills.test.ts`
Expected: FAIL（`Failed to resolve import "./skills"`）

- [ ] **Step 3: 実装を書く**

`src/core/skills.ts`:

```ts
import { BOND_RANGE } from './bonds';
import { MELEE_RANGE } from '../content/characters';
import { distance, distanceToSegment, isWalkableAt } from './field';
import type { AllyUnit, BattleState, CharId, Vec2 } from './types';

export const FUNBARU_DURATION = 5;
export const OMAJINAI_HEAL = 12;
export const KAKENUKERU_DAMAGE = 5;

export function isFunbaruActive(ally: AllyUnit, time: number): boolean {
  return time < ally.funbaruUntil;
}

export function canUseSkill(state: BattleState, allyId: CharId): boolean {
  if (state.phase !== 'wave') return false;
  const ally = state.allies.find((a) => a.id === allyId);
  if (!ally) return false;
  return !ally.retired && !ally.skillUsed;
}

export function useSkill(state: BattleState, allyId: CharId, dest?: Vec2): boolean {
  if (!canUseSkill(state, allyId)) return false;
  const ally = state.allies.find((a) => a.id === allyId)!;

  switch (ally.skill) {
    case 'funbaru':
      ally.funbaruUntil = state.time + FUNBARU_DURATION;
      break;

    case 'neraiuchi':
      ally.neraiuchiArmed = true;
      break;

    case 'omajinai': {
      const candidates = state.allies.filter(
        (a) => !a.retired && distance(ally.pos, a.pos) <= BOND_RANGE,
      );
      if (candidates.length === 0) return false;
      let target = candidates[0]!;
      for (const c of candidates) {
        if (c.hp / c.maxHp < target.hp / target.maxHp) target = c;
      }
      target.hp = Math.min(target.maxHp, target.hp + OMAJINAI_HEAL);
      break;
    }

    case 'kakenukeru': {
      if (!dest) return false;
      if (!isWalkableAt(state.grid, dest)) return false;
      const from = { ...ally.pos };
      let hits = 0;
      for (const enemy of state.enemies) {
        if (distanceToSegment(enemy.pos, from, dest) <= MELEE_RANGE) {
          enemy.hp -= KAKENUKERU_DAMAGE;
          hits++;
          state.events.push({ type: 'hit', targetPos: { ...enemy.pos }, amount: KAKENUKERU_DAMAGE });
        }
      }
      state.stats[allyId].kakenukeruHits += hits;
      ally.pos = { ...dest };
      ally.goalField = null;
      ally.engagedWith = null;
      break;
    }
  }

  ally.skillUsed = true;
  state.stats[allyId].skillUses += 1;
  state.events.push({ type: 'skill', allyId, skill: ally.skill });
  return true;
}
```

- [ ] **Step 4: テストを走らせて通ることを確認する**

Run: `npm test -- src/core/skills.test.ts`
Expected: PASS（15 tests）

- [ ] **Step 5: コミット**

```bash
git add src/core/skills.ts src/core/skills.test.ts
git commit -m "feat: add character skills"
```

---

### Task 8: シミュレーション（コマンド・出現・移動・交戦成立）

**Files:**
- Create: `src/core/sim.ts`
- Test: `src/core/sim.test.ts`

**Interfaces:**
- Consumes: `BattleState` ほか (Task 6)、`useSkill` (Task 7)、`nearestWithin` (Task 4)、`computeFlowField`, `flowDirection`, `distance`, `isWalkableAt` (Task 2)、`ENEMIES` (Task 3)、`nextFloat` (Task 1)
- Produces:
  - `SimCommand = { type: 'move'; allyId: CharId; dest: Vec2 } | { type: 'skill'; allyId: CharId; dest?: Vec2 }`
  - `step(state: BattleState, commands: SimCommand[], dt: number): void`（状態をインプレースで更新する）
  - `SPAWN_JITTER = 12`

このタスクでは攻撃の解決は行わない。Task 9 で `step` に追加する。

- [ ] **Step 1: 失敗するテストを書く**

`src/core/sim.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { createBattleState, startWave } from './state';
import { step } from './sim';
import type { BattleState, CharId, CharProgress, EnemyUnit, StageDef } from './types';

const STAGE: StageDef = {
  id: 1, name: 'テスト', cell: 32,
  mapRows: ['..........', '..........', '..........'],
  fort: { x: 16, y: 16 },
  landings: [{ x: 304, y: 16 }],
  garumFlees: true,
  waves: [{
    spawns: [
      { at: 0, kind: 'narazumono', from: { x: 304, y: 16 } },
      { at: 2, kind: 'narazumono', from: { x: 304, y: 16 } },
    ],
  }],
};

const LV1: Record<CharId, CharProgress> = {
  roran: { level: 1, xp: 0 }, ines: { level: 1, xp: 0 },
  mist: { level: 1, xp: 0 }, gau: { level: 1, xp: 0 },
};

function fresh(stage: StageDef = STAGE): BattleState {
  const s = createBattleState(stage, LV1, 42);
  startWave(s);
  // 邪魔にならない場所へ全員どける
  for (const a of s.allies) a.pos = { x: 16, y: 80 };
  return s;
}

const ally = (s: BattleState, id: CharId) => s.allies.find((a) => a.id === id)!;

function addEnemy(s: BattleState, x: number, y: number, hp = 12): EnemyUnit {
  const e: EnemyUnit = {
    uid: `t${s.nextEnemyUid++}`, kind: 'narazumono',
    pos: { x, y }, hp, maxHp: 12, engagedWith: null, attackCooldown: 0,
    lastHitBy: null, lastHitNeraiuchi: false,
  };
  s.enemies.push(e);
  return e;
}

describe('step: 時間とイベント', () => {
  it('dt ぶん時刻が進む', () => {
    const s = fresh();
    step(s, [], 0.5);
    expect(s.time).toBeCloseTo(0.5);
  });

  it('events は毎 step クリアされる', () => {
    const s = fresh();
    step(s, [{ type: 'skill', allyId: 'roran' }], 0.1);
    expect(s.events.length).toBeGreaterThan(0);
    step(s, [], 0.1);
    expect(s.events).toEqual([]);
  });

  it('wave フェーズでなければ何も進まない', () => {
    const s = fresh();
    s.phase = 'waveCleared';
    step(s, [], 1);
    expect(s.time).toBe(0);
    expect(s.enemies).toHaveLength(0);
  });
});

describe('step: 出現', () => {
  it('時刻が来たスポーンが敵になる', () => {
    const s = fresh();
    step(s, [], 0.1);
    expect(s.enemies).toHaveLength(1);
    expect(s.pending).toHaveLength(1);
  });

  it('後のスポーンはその時刻まで出ない', () => {
    const s = fresh();
    step(s, [], 1.0);
    expect(s.enemies).toHaveLength(1);
    step(s, [], 1.5);
    expect(s.enemies).toHaveLength(2);
    expect(s.pending).toHaveLength(0);
  });

  it('出現位置は指定地点の近く（ばらつきは 12px 以内）', () => {
    const s = fresh();
    step(s, [], 0.1);
    const e = s.enemies[0]!;
    expect(Math.abs(e.pos.x - 304)).toBeLessThanOrEqual(12);
    expect(Math.abs(e.pos.y - 16)).toBeLessThanOrEqual(12);
  });

  it('敵の HP は定義どおり', () => {
    const s = fresh();
    step(s, [], 0.1);
    expect(s.enemies[0]!.hp).toBe(12);
    expect(s.enemies[0]!.maxHp).toBe(12);
  });
});

describe('step: 移動', () => {
  it('move コマンドで味方が目的地へ向かう', () => {
    const s = fresh();
    const before = ally(s, 'roran').pos.x;
    step(s, [{ type: 'move', allyId: 'roran', dest: { x: 300, y: 80 } }], 1);
    expect(ally(s, 'roran').pos.x).toBeGreaterThan(before);
  });

  it('速度どおりに進む（ロランは 60px/秒）', () => {
    const s = fresh();
    ally(s, 'roran').pos = { x: 16, y: 80 };
    step(s, [{ type: 'move', allyId: 'roran', dest: { x: 304, y: 80 } }], 1);
    expect(ally(s, 'roran').pos.x).toBeCloseTo(76, 0);
  });

  it('歩けない目的地は無視される', () => {
    const s = fresh({ ...STAGE, mapRows: ['..........', '.....#....', '..........'] });
    ally(s, 'roran').pos = { x: 16, y: 80 };
    step(s, [{ type: 'move', allyId: 'roran', dest: { x: 176, y: 48 } }], 1);
    expect(ally(s, 'roran').pos).toEqual({ x: 16, y: 80 });
  });

  it('たいきゃく中の味方は動かない', () => {
    const s = fresh();
    ally(s, 'roran').retired = true;
    step(s, [{ type: 'move', allyId: 'roran', dest: { x: 300, y: 80 } }], 1);
    expect(ally(s, 'roran').pos).toEqual({ x: 16, y: 80 });
  });

  it('敵は砦に向かって進む', () => {
    const s = fresh();
    const e = addEnemy(s, 304, 16);
    step(s, [], 1);
    expect(e.pos.x).toBeLessThan(304);
  });

  it('交戦中の味方は移動しない', () => {
    const s = fresh();
    const e = addEnemy(s, 20, 80);
    step(s, [], 0.1);
    const pos = { ...ally(s, 'roran').pos };
    step(s, [], 1);
    expect(ally(s, 'roran').pos).toEqual(pos);
    expect(e.engagedWith).toBe('roran');
  });
});

describe('step: 交戦の成立と解除', () => {
  it('レンジ内に入ると交戦が成立し engage イベントが出る', () => {
    const s = fresh();
    const e = addEnemy(s, 30, 80);
    step(s, [], 0.1);
    expect(ally(s, 'roran').engagedWith).toBe(e.uid);
    expect(s.events).toContainEqual({
      type: 'engage', allyId: 'roran', enemyUid: e.uid, kind: 'narazumono', firstMeeting: true,
    });
  });

  it('同じ敵種の 2 回目は firstMeeting が false', () => {
    const s = fresh();
    const e1 = addEnemy(s, 30, 80);
    step(s, [], 0.1);
    e1.pos = { x: 900, y: 900 };
    step(s, [], 0.1);
    addEnemy(s, 30, 80);
    step(s, [], 0.1);
    const engages = s.events.filter((ev) => ev.type === 'engage');
    expect(engages).toHaveLength(1);
    expect(engages[0]).toMatchObject({ firstMeeting: false });
  });

  it('イネスは 160px 離れていても交戦できる', () => {
    const s = fresh();
    ally(s, 'ines').pos = { x: 16, y: 80 };
    for (const a of s.allies) if (a.id !== 'ines') a.pos = { x: 16, y: 300 };
    const e = addEnemy(s, 170, 80);
    step(s, [], 0.1);
    expect(ally(s, 'ines').engagedWith).toBe(e.uid);
  });

  it('レンジから外れると交戦が解除される', () => {
    const s = fresh();
    const e = addEnemy(s, 30, 80);
    step(s, [], 0.1);
    e.pos = { x: 900, y: 900 };
    step(s, [], 0.1);
    expect(ally(s, 'roran').engagedWith).toBeNull();
  });

  it('move コマンドで交戦から離脱できる', () => {
    const s = fresh();
    addEnemy(s, 30, 80);
    step(s, [], 0.1);
    expect(ally(s, 'roran').engagedWith).not.toBeNull();
    step(s, [{ type: 'move', allyId: 'roran', dest: { x: 300, y: 80 } }], 0.1);
    expect(ally(s, 'roran').engagedWith).toBeNull();
  });

  it('一度成立した交戦相手は、より近い敵が来ても入れ替わらない', () => {
    const s = fresh();
    const first = addEnemy(s, 40, 80);
    step(s, [], 0.1);
    addEnemy(s, 18, 80);
    step(s, [], 0.1);
    expect(ally(s, 'roran').engagedWith).toBe(first.uid);
  });
});

describe('step: skill コマンド', () => {
  it('skill コマンドでスキルが発動する', () => {
    const s = fresh();
    step(s, [{ type: 'skill', allyId: 'roran' }], 0.1);
    expect(ally(s, 'roran').skillUsed).toBe(true);
  });

  it('かけぬけるは dest つきで発動する', () => {
    const s = fresh();
    step(s, [{ type: 'skill', allyId: 'gau', dest: { x: 200, y: 80 } }], 0.1);
    expect(ally(s, 'gau').pos).toEqual({ x: 200, y: 80 });
  });
});
```

- [ ] **Step 2: テストを走らせて失敗を確認する**

Run: `npm test -- src/core/sim.test.ts`
Expected: FAIL（`Failed to resolve import "./sim"`）

- [ ] **Step 3: 実装を書く**

`src/core/sim.ts`:

```ts
import { ENEMIES } from '../content/enemies';
import { nearestWithin } from './combat';
import { computeFlowField, flowDirection, isWalkableAt } from './field';
import { nextFloat } from './rng';
import { useSkill } from './skills';
import type { AllyUnit, BattleState, CharId, EnemyUnit, Vec2 } from './types';

export const SPAWN_JITTER = 12;

export type SimCommand =
  | { type: 'move'; allyId: CharId; dest: Vec2 }
  | { type: 'skill'; allyId: CharId; dest?: Vec2 };

export function step(state: BattleState, commands: SimCommand[], dt: number): void {
  state.events = [];
  if (state.phase !== 'wave') return;

  state.time += dt;

  applyCommands(state, commands);
  spawnDueEnemies(state);
  updateEngagements(state);
  moveUnits(state, dt);
}

function applyCommands(state: BattleState, commands: SimCommand[]): void {
  for (const cmd of commands) {
    const ally = state.allies.find((a) => a.id === cmd.allyId);
    if (!ally || ally.retired) continue;

    if (cmd.type === 'move') {
      if (!isWalkableAt(state.grid, cmd.dest)) continue;
      ally.goalField = computeFlowField(state.grid, cmd.dest);
      ally.engagedWith = null;
    } else {
      useSkill(state, cmd.allyId, cmd.dest);
    }
  }
}

function spawnDueEnemies(state: BattleState): void {
  const remaining: typeof state.pending = [];
  for (const entry of state.pending) {
    if (entry.at > state.time) {
      remaining.push(entry);
      continue;
    }
    const def = ENEMIES[entry.kind];
    const jitter = () => (nextFloat(state.rng) * 2 - 1) * SPAWN_JITTER;
    const enemy: EnemyUnit = {
      uid: `e${state.nextEnemyUid++}`,
      kind: entry.kind,
      pos: { x: entry.from.x + jitter(), y: entry.from.y + jitter() },
      hp: def.maxHp,
      maxHp: def.maxHp,
      engagedWith: null,
      attackCooldown: 0,
      lastHitBy: null,
      lastHitNeraiuchi: false,
    };
    state.enemies.push(enemy);
  }
  state.pending = remaining;
}

function activeAllies(state: BattleState): AllyUnit[] {
  return state.allies.filter((a) => !a.retired);
}

function updateEngagements(state: BattleState): void {
  const byUid = new Map(state.enemies.map((e) => [e.uid, e]));

  for (const ally of state.allies) {
    if (ally.retired) {
      ally.engagedWith = null;
      continue;
    }
    // 解除
    if (ally.engagedWith !== null) {
      const target = byUid.get(ally.engagedWith);
      if (!target || distanceBetween(ally.pos, target.pos) > ally.range) {
        ally.engagedWith = null;
      }
    }
    // 成立
    if (ally.engagedWith === null) {
      const target = nearestWithin(ally.pos, state.enemies, ally.range);
      if (target) {
        ally.engagedWith = target.uid;
        ally.attackCooldown = 0;
        const firstMeeting = !ally.seenKinds.includes(target.kind);
        if (firstMeeting) ally.seenKinds.push(target.kind);
        state.events.push({
          type: 'engage',
          allyId: ally.id,
          enemyUid: target.uid,
          kind: target.kind,
          firstMeeting,
        });
      }
    }
  }

  const allies = activeAllies(state);
  for (const enemy of state.enemies) {
    const range = ENEMIES[enemy.kind].range;
    if (enemy.engagedWith !== null) {
      const target = allies.find((a) => a.id === enemy.engagedWith);
      if (!target || distanceBetween(enemy.pos, target.pos) > range) {
        enemy.engagedWith = null;
      }
    }
    if (enemy.engagedWith === null) {
      const target = nearestWithin(enemy.pos, allies, range);
      if (target) {
        enemy.engagedWith = target.id;
        enemy.attackCooldown = 0;
      }
    }
  }
}

function distanceBetween(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function moveUnits(state: BattleState, dt: number): void {
  for (const ally of state.allies) {
    if (ally.retired || ally.engagedWith !== null || !ally.goalField) continue;
    const dir = flowDirection(state.grid, ally.goalField, ally.pos);
    if (!dir) {
      ally.goalField = null;
      continue;
    }
    ally.pos = { x: ally.pos.x + dir.x * ally.speed * dt, y: ally.pos.y + dir.y * ally.speed * dt };
  }

  for (const enemy of state.enemies) {
    if (enemy.engagedWith !== null) continue;
    const dir = flowDirection(state.grid, state.enemyField, enemy.pos);
    if (!dir) continue;
    const speed = ENEMIES[enemy.kind].speed;
    enemy.pos = { x: enemy.pos.x + dir.x * speed * dt, y: enemy.pos.y + dir.y * speed * dt };
  }
}
```

- [ ] **Step 4: テストを走らせて通ることを確認する**

Run: `npm test -- src/core/sim.test.ts`
Expected: PASS（19 tests）

- [ ] **Step 5: コミット**

```bash
git add src/core/sim.ts src/core/sim.test.ts
git commit -m "feat: add simulation step with spawning, movement and engagement"
```

---

### Task 9: シミュレーション（攻撃解決・撃破・撤退・砦・フェーズ遷移）

**Files:**
- Modify: `src/core/sim.ts`（`step` に後段の処理を足す）
- Test: `src/core/sim-combat.test.ts`

**Interfaces:**
- Consumes: Task 8 の `step` 内部関数、`computeDamage`, `effectiveInterval`, `hasThreatWithinMelee` (Task 4)、`bondSupporters` (Task 5)、`isFunbaruActive` (Task 7)
- Produces:
  - `FORT_RADIUS = 24`、`PINCH_RATIO = 0.3`
  - `step` が `hit` / `enemyDefeated` / `garumRepelled` / `allyRetired` / `bondSupport` / `pinch` / `fortDamaged` イベントを出すようになる
  - `state.phase` が `'defeat'` / `'waveCleared'` / `'stageCleared'` に遷移するようになる

- [ ] **Step 1: 失敗するテストを書く**

`src/core/sim-combat.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { createBattleState, startWave } from './state';
import { step } from './sim';
import type { BattleState, CharId, CharProgress, EnemyKind, EnemyUnit, StageDef } from './types';

const STAGE: StageDef = {
  id: 1, name: 'テスト', cell: 32,
  mapRows: ['..........', '..........', '..........'],
  fort: { x: 16, y: 16 },
  landings: [{ x: 304, y: 16 }],
  garumFlees: true,
  waves: [{ spawns: [] }, { spawns: [] }],
};

const LV1: Record<CharId, CharProgress> = {
  roran: { level: 1, xp: 0 }, ines: { level: 1, xp: 0 },
  mist: { level: 1, xp: 0 }, gau: { level: 1, xp: 0 },
};

function fresh(stage: StageDef = STAGE): BattleState {
  const s = createBattleState(stage, LV1, 42);
  startWave(s);
  for (const a of s.allies) a.pos = { x: 16, y: 300 }; // マップ外の遠くへ退避
  return s;
}

const ally = (s: BattleState, id: CharId) => s.allies.find((a) => a.id === id)!;

function addEnemy(s: BattleState, kind: EnemyKind, x: number, y: number, hp?: number): EnemyUnit {
  const maxHp = { narazumono: 12, tatemochi: 20, garum: 40 }[kind];
  const e: EnemyUnit = {
    uid: `t${s.nextEnemyUid++}`, kind, pos: { x, y },
    hp: hp ?? maxHp, maxHp, engagedWith: null, attackCooldown: 0,
    lastHitBy: null, lastHitNeraiuchi: false,
  };
  s.enemies.push(e);
  return e;
}

/** 交戦させて 1 回攻撃が入るところまで進める */
function engageAndAttack(s: BattleState, dt = 1.7): void {
  step(s, [], 0.01);
  step(s, [], dt);
}

describe('攻撃の解決', () => {
  it('攻撃間隔ごとに 1 回ダメージが入る', () => {
    const s = fresh();
    ally(s, 'roran').pos = { x: 16, y: 16 };
    const e = addEnemy(s, 'narazumono', 30, 16);
    step(s, [], 0.01);
    expect(e.hp).toBe(12);      // 交戦成立の直後はまだ攻撃していない
    step(s, [], 1.7);
    expect(e.hp).toBe(12 - 5);  // ロラン ちから6 - まもり1
  });

  it('攻撃間隔が来るまでは追加ダメージが入らない', () => {
    const s = fresh();
    ally(s, 'roran').pos = { x: 16, y: 16 };
    const e = addEnemy(s, 'narazumono', 30, 16);
    step(s, [], 0.01);
    step(s, [], 1.7);
    step(s, [], 0.5);
    expect(e.hp).toBe(7);
  });

  it('なかよし支援が乗り、bondSupport イベントが出る', () => {
    const s = fresh();
    ally(s, 'roran').pos = { x: 16, y: 16 };
    ally(s, 'ines').pos = { x: 100, y: 16 };
    const e = addEnemy(s, 'narazumono', 30, 16);
    step(s, [], 0.01);
    step(s, [], 1.7);
    expect(e.hp).toBe(12 - 7); // (6+2)-1
    expect(s.events).toContainEqual({ type: 'bondSupport', supporterId: 'ines', targetId: 'roran' });
    expect(s.stats.roran.bondSupports).toBe(1);
  });

  it('イネスはたてもちに 1 しか通らない', () => {
    const s = fresh();
    ally(s, 'ines').pos = { x: 16, y: 16 };
    const e = addEnemy(s, 'tatemochi', 100, 16);
    step(s, [], 0.01);
    step(s, [], 2.3);
    expect(e.hp).toBe(19);
  });

  it('ねらいうちならたてもちにも通る', () => {
    const s = fresh();
    ally(s, 'ines').pos = { x: 16, y: 16 };
    const e = addEnemy(s, 'tatemochi', 100, 16);
    step(s, [{ type: 'skill', allyId: 'ines' }], 0.01);
    step(s, [], 2.3);
    expect(e.hp).toBe(20 - 10); // (8-3)*2
    expect(ally(s, 'ines').neraiuchiArmed).toBe(false);
  });

  it('イネスは密着されると攻撃間隔が倍になる', () => {
    const s = fresh();
    ally(s, 'ines').pos = { x: 16, y: 16 };
    const e = addEnemy(s, 'narazumono', 32, 16);
    step(s, [], 0.01);
    step(s, [], 2.3);
    expect(e.hp).toBe(12); // まだ撃てない
    step(s, [], 2.2);
    expect(e.hp).toBe(12 - 7);
  });

  it('敵の攻撃で味方の HP が減る', () => {
    const s = fresh();
    ally(s, 'roran').pos = { x: 16, y: 16 };
    addEnemy(s, 'garum', 30, 16);
    engageAndAttack(s, 1.5);
    expect(ally(s, 'roran').hp).toBe(30 - 4); // 9 - 5
  });

  it('ふんばり中はダメージが半分になる', () => {
    const s = fresh();
    ally(s, 'roran').pos = { x: 16, y: 16 };
    addEnemy(s, 'garum', 30, 16);
    step(s, [{ type: 'skill', allyId: 'roran' }], 0.01);
    step(s, [], 1.5);
    expect(ally(s, 'roran').hp).toBe(30 - 2);
  });
});

describe('ピンチ', () => {
  it('HP が 30% を切った瞬間に 1 回だけ pinch イベントが出る', () => {
    const s = fresh();
    ally(s, 'roran').pos = { x: 16, y: 16 };
    ally(s, 'roran').hp = 11;
    addEnemy(s, 'garum', 30, 16);
    engageAndAttack(s, 1.5);
    expect(ally(s, 'roran').hp).toBe(7);
    expect(s.events).toContainEqual({ type: 'pinch', allyId: 'roran' });
    step(s, [], 1.5);
    expect(s.events.filter((e) => e.type === 'pinch')).toHaveLength(0);
  });
});

describe('撃破と撤退', () => {
  it('敵を倒すと消え、enemyDefeated が出て戦績が増える', () => {
    const s = fresh();
    ally(s, 'roran').pos = { x: 16, y: 16 };
    const e = addEnemy(s, 'narazumono', 30, 16, 3);
    engageAndAttack(s, 1.7);
    expect(s.enemies).toHaveLength(0);
    expect(s.events).toContainEqual({ type: 'enemyDefeated', uid: e.uid, kind: 'narazumono', byAlly: 'roran' });
    expect(s.stats.roran.defeats).toBe(1);
  });

  it('ねらいうちで倒すと neraiuchiKills が増える', () => {
    const s = fresh();
    ally(s, 'ines').pos = { x: 16, y: 16 };
    addEnemy(s, 'narazumono', 100, 16, 5);
    step(s, [{ type: 'skill', allyId: 'ines' }], 0.01);
    step(s, [], 2.3);
    expect(s.stats.ines.neraiuchiKills).toBe(1);
  });

  it('ガルムは 30% を切ると撤退する（garumFlees が true のとき）', () => {
    const s = fresh();
    ally(s, 'roran').pos = { x: 16, y: 16 };
    addEnemy(s, 'garum', 30, 16, 12);
    engageAndAttack(s, 1.7);
    expect(s.enemies).toHaveLength(0);
    expect(s.events).toContainEqual({ type: 'garumRepelled', byAlly: 'roran' });
    expect(s.stats.roran.defeats).toBe(0);
  });

  it('garumFlees が false なら撤退せず最後まで戦う', () => {
    const s = fresh({ ...STAGE, garumFlees: false });
    ally(s, 'roran').pos = { x: 16, y: 16 };
    const g = addEnemy(s, 'garum', 30, 16, 12);
    engageAndAttack(s, 1.7);
    expect(s.enemies).toHaveLength(1);
    expect(g.hp).toBe(10);
  });

  it('味方は HP 0 でたいきゃくし、交戦が解除される', () => {
    const s = fresh();
    ally(s, 'roran').pos = { x: 16, y: 16 };
    ally(s, 'roran').hp = 2;
    const e = addEnemy(s, 'garum', 30, 16);
    engageAndAttack(s, 1.5);
    expect(ally(s, 'roran').retired).toBe(true);
    expect(ally(s, 'roran').hp).toBe(0);
    expect(ally(s, 'roran').engagedWith).toBeNull();
    expect(e.engagedWith).toBeNull();
    expect(s.events).toContainEqual({ type: 'allyRetired', allyId: 'roran' });
  });
});

describe('砦とフェーズ遷移', () => {
  it('敵が砦に着くと砦 HP が減り、その敵は消える', () => {
    const s = fresh();
    const e = addEnemy(s, 'narazumono', 20, 16);
    step(s, [], 0.01);
    expect(s.fortHp).toBe(30 - 3);
    expect(s.enemies).toHaveLength(0);
    expect(s.events).toContainEqual({ type: 'fortDamaged', amount: 3 });
    expect(e.hp).toBeGreaterThan(0);
  });

  it('砦 HP が 0 で defeat', () => {
    const s = fresh();
    s.fortHp = 2;
    addEnemy(s, 'narazumono', 20, 16);
    step(s, [], 0.01);
    expect(s.fortHp).toBeLessThanOrEqual(0);
    expect(s.phase).toBe('defeat');
  });

  it('敵が全滅し pending も空なら waveCleared', () => {
    const s = fresh();
    ally(s, 'roran').pos = { x: 16, y: 16 };
    addEnemy(s, 'narazumono', 30, 16, 3);
    engageAndAttack(s, 1.7);
    expect(s.phase).toBe('waveCleared');
  });

  it('最終ウェーブなら stageCleared', () => {
    const s = fresh();
    s.waveIndex = 1;
    ally(s, 'roran').pos = { x: 16, y: 16 };
    addEnemy(s, 'narazumono', 30, 16, 3);
    engageAndAttack(s, 1.7);
    expect(s.phase).toBe('stageCleared');
  });

  it('まだ pending が残っていれば wave のまま', () => {
    const s = fresh();
    s.pending = [{ at: 99, kind: 'narazumono', from: { x: 304, y: 16 } }];
    step(s, [], 0.01);
    expect(s.phase).toBe('wave');
  });
});
```

- [ ] **Step 2: テストを走らせて失敗を確認する**

Run: `npm test -- src/core/sim-combat.test.ts`
Expected: FAIL（攻撃が実装されていないので `e.hp` が減らない等で複数失敗）

- [ ] **Step 3: sim.ts に後段の処理を足す**

`src/core/sim.ts` の import に追記:

```ts
import { bondSupporters } from './bonds';
import { computeDamage, effectiveInterval, hasThreatWithinMelee, nearestWithin } from './combat';
import { isFunbaruActive } from './skills';
import { distance } from './field';
```

`combat` からの import は Task 8 で `nearestWithin` だけを取り込んでいるので、上のように 1 行にまとめて置き換える。

`step` の本体を差し替える:

```ts
export const FORT_RADIUS = 24;
export const PINCH_RATIO = 0.3;

export function step(state: BattleState, commands: SimCommand[], dt: number): void {
  state.events = [];
  if (state.phase !== 'wave') return;

  state.time += dt;

  applyCommands(state, commands);
  spawnDueEnemies(state);
  updateEngagements(state);
  moveUnits(state, dt);
  resolveAttacks(state, dt);
  resolveEnemyRemoval(state);
  resolveAllyRetirement(state);
  resolveFort(state);
  updatePhase(state);
}
```

`step` の下に追加:

```ts
function resolveAttacks(state: BattleState, dt: number): void {
  const byUid = new Map(state.enemies.map((e) => [e.uid, e]));

  for (const ally of state.allies) {
    if (ally.retired) continue;
    ally.attackCooldown -= dt;
    if (ally.engagedWith === null) continue;
    const target = byUid.get(ally.engagedWith);
    if (!target) continue;

    const interval = effectiveInterval(
      ally.attackInterval,
      ally.attack,
      hasThreatWithinMelee(ally.pos, state.enemies),
    );
    if (ally.attackCooldown > 0) continue;

    const supporters = bondSupporters(ally.id, ally.pos, state.allies);
    let bonus = 0;
    for (const s of supporters) {
      bonus += s.bonus;
      state.events.push({ type: 'bondSupport', supporterId: s.id, targetId: ally.id });
    }
    if (supporters.length > 0) state.stats[ally.id].bondSupports += 1;

    const neraiuchi = ally.neraiuchiArmed;
    const dmg = computeDamage({
      power: ally.power,
      guard: ENEMIES[target.kind].guard,
      attackKind: ally.attack,
      bowDamageCap: ENEMIES[target.kind].bowDamageCap,
      bondBonus: bonus,
      neraiuchi,
      targetFunbaru: false,
    });
    target.hp -= dmg;
    target.lastHitBy = ally.id;
    target.lastHitNeraiuchi = neraiuchi;
    ally.neraiuchiArmed = false;
    ally.attackCooldown = interval;
    state.events.push({ type: 'hit', targetPos: { ...target.pos }, amount: dmg });
  }

  for (const enemy of state.enemies) {
    enemy.attackCooldown -= dt;
    if (enemy.engagedWith === null) continue;
    const target = state.allies.find((a) => a.id === enemy.engagedWith && !a.retired);
    if (!target) continue;
    if (enemy.attackCooldown > 0) continue;

    const def = ENEMIES[enemy.kind];
    const before = target.hp;
    const dmg = computeDamage({
      power: def.power,
      guard: target.guard,
      attackKind: 'melee',
      bowDamageCap: null,
      bondBonus: 0,
      neraiuchi: false,
      targetFunbaru: isFunbaruActive(target, state.time),
    });
    target.hp -= dmg;
    enemy.attackCooldown = def.attackInterval;
    state.events.push({ type: 'hit', targetPos: { ...target.pos }, amount: dmg });

    const ratio = target.hp / target.maxHp;
    const beforeRatio = before / target.maxHp;
    if (target.hp > 0 && ratio < PINCH_RATIO && beforeRatio >= PINCH_RATIO && !target.pinchShown) {
      target.pinchShown = true;
      state.events.push({ type: 'pinch', allyId: target.id });
    }
  }
}

function resolveEnemyRemoval(state: BattleState): void {
  const survivors: EnemyUnit[] = [];
  for (const enemy of state.enemies) {
    const def = ENEMIES[enemy.kind];
    const flees =
      def.fleeAtHpRatio !== null &&
      state.stage.garumFlees &&
      enemy.hp / enemy.maxHp < def.fleeAtHpRatio;

    if (flees) {
      state.events.push({ type: 'garumRepelled', byAlly: enemy.lastHitBy });
      continue;
    }
    if (enemy.hp <= 0) {
      state.events.push({
        type: 'enemyDefeated', uid: enemy.uid, kind: enemy.kind, byAlly: enemy.lastHitBy,
      });
      if (enemy.lastHitBy) {
        state.stats[enemy.lastHitBy].defeats += 1;
        if (enemy.lastHitNeraiuchi) state.stats[enemy.lastHitBy].neraiuchiKills += 1;
      }
      continue;
    }
    survivors.push(enemy);
  }
  if (survivors.length !== state.enemies.length) {
    const alive = new Set(survivors.map((e) => e.uid));
    for (const ally of state.allies) {
      if (ally.engagedWith !== null && !alive.has(ally.engagedWith)) ally.engagedWith = null;
    }
  }
  state.enemies = survivors;
}

function resolveAllyRetirement(state: BattleState): void {
  for (const ally of state.allies) {
    if (ally.retired || ally.hp > 0) continue;
    ally.hp = 0;
    ally.retired = true;
    ally.engagedWith = null;
    ally.goalField = null;
    for (const enemy of state.enemies) {
      if (enemy.engagedWith === ally.id) enemy.engagedWith = null;
    }
    state.events.push({ type: 'allyRetired', allyId: ally.id });
  }
}

function resolveFort(state: BattleState): void {
  const survivors: EnemyUnit[] = [];
  for (const enemy of state.enemies) {
    if (distance(enemy.pos, state.stage.fort) <= FORT_RADIUS) {
      const amount = ENEMIES[enemy.kind].fortDamage;
      state.fortHp -= amount;
      state.events.push({ type: 'fortDamaged', amount });
      continue;
    }
    survivors.push(enemy);
  }
  state.enemies = survivors;
}

function updatePhase(state: BattleState): void {
  if (state.fortHp <= 0) {
    state.fortHp = 0;
    state.phase = 'defeat';
    return;
  }
  if (state.enemies.length === 0 && state.pending.length === 0) {
    const isLast = state.waveIndex >= state.stage.waves.length - 1;
    state.phase = isLast ? 'stageCleared' : 'waveCleared';
  }
}
```

- [ ] **Step 4: テストを走らせて通ることを確認する**

Run: `npm test -- src/core/sim-combat.test.ts`
Expected: PASS（19 tests）

- [ ] **Step 5: これまでのテストが壊れていないか確認する**

Run: `npm test`
Expected: すべて PASS

- [ ] **Step 6: 型チェック**

Run: `npx tsc --noEmit`
Expected: エラーなし

- [ ] **Step 7: コミット**

```bash
git add src/core/sim.ts src/core/sim-combat.test.ts
git commit -m "feat: resolve attacks, defeats, retreat, fort damage and phase transitions"
```

---

### Task 10: セリフの決定

**Files:**
- Create: `src/content/lines.ts`, `src/core/dialogue.ts`
- Test: `src/core/dialogue.test.ts`

**Interfaces:**
- Consumes: `SimEvent`, `CharId` (Task 6)
- Produces:
  - `LINES: Record<string, string>`（`src/content/lines.ts`）
  - `DialogueRequest = { speaker: CharId; lineId: string; text: string }`
  - `pickDialogue(events: SimEvent[]): DialogueRequest[]`（優先度順に並べて返す。表示は UI が 1 つずつ行う）

セリフ ID の形式:

| 形式 | いつ |
|---|---|
| `first:<charId>:<enemyKind>` | その敵種と初めて交戦した |
| `rival:<charId>` | ロラン / イネスがガルムと初めて交戦した（`first:` より優先） |
| `skill:<charId>` | スキルを撃った |
| `pinch:<charId>` | HP が 30% を切った |
| `win:<charId>` | ガルムを退けた |
| `retire:<charId>` | たいきゃくした |

優先度は上の表の順。ID に対応するセリフが `LINES` にない場合、その吹き出しは出さない。

- [ ] **Step 1: lines.ts を書く**

全文ひらがな・カタカナ。1 つ 2 行以内。

```ts
export const LINES: Record<string, string> = {
  // はじめて であったとき
  'first:roran:narazumono': 'あぶないよ！\nみんな さがって！',
  'first:roran:tatemochi': 'おおきな たてだ……\nぼくが うけとめる',
  'first:ines:narazumono': 'よわそう。\nさっさと かたづけるわ',
  'first:ines:tatemochi': 'うっ、 やが はじかれる！\nだれか まえに でて！',
  'first:mist:narazumono': 'こんにちは……\nあ、 てきでしたね',
  'first:mist:tatemochi': 'その たて、\nおもくないですか？',
  'first:mist:garum': 'わあ、 おおきいひと',
  'first:gau:narazumono': 'よーし、\nいっちょ やるか！',
  'first:gau:tatemochi': 'かたい！\nまわりこめば いける？',
  'first:gau:garum': 'うわ、\nつよそうなのが きた！',

  // ガルムとの いんねん
  'rival:roran': 'ガルム……\nまた きたんだね',
  'rival:ines': 'また あんたか！\nこんどこそ おいかえす',

  // スキル
  'skill:roran': 'ここは とおさない！',
  'skill:ines': 'うごかないで……\nいまっ！',
  'skill:mist': 'げんきに なあれ……',
  'skill:gau': 'そこ どいて どいて どいてー！',

  // ピンチ
  'pinch:roran': 'まだ……\nたてる……！',
  'pinch:ines': 'ちょっと まずいかも',
  'pinch:mist': 'めが まわりますう',
  'pinch:gau': 'いたた！\nちょっと やすませて！',

  // ガルムを おいかえした
  'win:roran': 'かえって もらったよ',
  'win:ines': 'ふん。\nにげあしだけは はやいのね',
  'win:mist': 'いって しまいましたね',
  'win:gau': 'やった！\nおいかえしたぞ！',

  // たいきゃく
  'retire:roran': 'ごめん……\nあとは たのむ',
  'retire:ines': 'くっ……\nここまでね',
  'retire:mist': 'ちょっと……\nやすみますね……',
  'retire:gau': 'うう、\nまだ やれるのに……',
};
```

- [ ] **Step 2: 失敗するテストを書く**

`src/core/dialogue.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { pickDialogue } from './dialogue';
import { LINES } from '../content/lines';
import type { SimEvent } from './types';

describe('LINES', () => {
  it('すべてのセリフが ひらがな・カタカナ のみ', () => {
    for (const [id, text] of Object.entries(LINES)) {
      expect(text, id).not.toMatch(/[一-鿿]/);
    }
  });

  it('すべてのセリフが 2 行いない', () => {
    for (const [id, text] of Object.entries(LINES)) {
      expect(text.split('\n').length, id).toBeLessThanOrEqual(2);
    }
  });
});

describe('pickDialogue', () => {
  it('はじめての交戦でセリフが出る', () => {
    const events: SimEvent[] = [
      { type: 'engage', allyId: 'gau', enemyUid: 'e1', kind: 'narazumono', firstMeeting: true },
    ];
    expect(pickDialogue(events)).toEqual([
      { speaker: 'gau', lineId: 'first:gau:narazumono', text: LINES['first:gau:narazumono'] },
    ]);
  });

  it('2 回目の交戦ではセリフが出ない', () => {
    const events: SimEvent[] = [
      { type: 'engage', allyId: 'gau', enemyUid: 'e1', kind: 'narazumono', firstMeeting: false },
    ];
    expect(pickDialogue(events)).toEqual([]);
  });

  it('ロランがガルムと会うと いんねん のセリフになる', () => {
    const events: SimEvent[] = [
      { type: 'engage', allyId: 'roran', enemyUid: 'g1', kind: 'garum', firstMeeting: true },
    ];
    expect(pickDialogue(events)).toEqual([
      { speaker: 'roran', lineId: 'rival:roran', text: LINES['rival:roran'] },
    ]);
  });

  it('ミストがガルムと会うと ふつうの はじめまして', () => {
    const events: SimEvent[] = [
      { type: 'engage', allyId: 'mist', enemyUid: 'g1', kind: 'garum', firstMeeting: true },
    ];
    expect(pickDialogue(events)[0]!.lineId).toBe('first:mist:garum');
  });

  it('対応するセリフがなければ出さない', () => {
    const events: SimEvent[] = [
      { type: 'engage', allyId: 'roran', enemyUid: 'g1', kind: 'garum', firstMeeting: false },
    ];
    expect(pickDialogue(events)).toEqual([]);
  });

  it('スキル・ピンチ・勝利・撤退のセリフが出る', () => {
    expect(pickDialogue([{ type: 'skill', allyId: 'ines', skill: 'neraiuchi' }])[0]!.lineId).toBe('skill:ines');
    expect(pickDialogue([{ type: 'pinch', allyId: 'mist' }])[0]!.lineId).toBe('pinch:mist');
    expect(pickDialogue([{ type: 'garumRepelled', byAlly: 'gau' }])[0]!.lineId).toBe('win:gau');
    expect(pickDialogue([{ type: 'allyRetired', allyId: 'roran' }])[0]!.lineId).toBe('retire:roran');
  });

  it('だれが倒したか分からない撃退ではセリフを出さない', () => {
    expect(pickDialogue([{ type: 'garumRepelled', byAlly: null }])).toEqual([]);
  });

  it('セリフの出ないイベントは無視する', () => {
    const events: SimEvent[] = [
      { type: 'hit', targetPos: { x: 0, y: 0 }, amount: 3 },
      { type: 'bondSupport', supporterId: 'ines', targetId: 'roran' },
      { type: 'fortDamaged', amount: 3 },
      { type: 'enemyDefeated', uid: 'e1', kind: 'narazumono', byAlly: 'gau' },
    ];
    expect(pickDialogue(events)).toEqual([]);
  });

  it('複数同時なら 優先度順（いんねん → はじめまして → スキル → ピンチ → 勝利 → たいきゃく）', () => {
    const events: SimEvent[] = [
      { type: 'allyRetired', allyId: 'roran' },
      { type: 'pinch', allyId: 'mist' },
      { type: 'skill', allyId: 'gau', skill: 'kakenukeru' },
      { type: 'engage', allyId: 'mist', enemyUid: 'e1', kind: 'narazumono', firstMeeting: true },
      { type: 'engage', allyId: 'ines', enemyUid: 'g1', kind: 'garum', firstMeeting: true },
      { type: 'garumRepelled', byAlly: 'gau' },
    ];
    expect(pickDialogue(events).map((d) => d.lineId)).toEqual([
      'rival:ines',
      'first:mist:narazumono',
      'skill:gau',
      'pinch:mist',
      'win:gau',
      'retire:roran',
    ]);
  });
});
```

- [ ] **Step 3: テストを走らせて失敗を確認する**

Run: `npm test -- src/core/dialogue.test.ts`
Expected: FAIL（`Failed to resolve import "./dialogue"`）

- [ ] **Step 4: 実装を書く**

`src/core/dialogue.ts`:

```ts
import { LINES } from '../content/lines';
import type { CharId, SimEvent } from './types';

export type DialogueRequest = { speaker: CharId; lineId: string; text: string };

const RIVAL_SPEAKERS: readonly CharId[] = ['roran', 'ines'];

/** 小さいほど先に表示する */
const PRIORITY = ['rival', 'first', 'skill', 'pinch', 'win', 'retire'] as const;

function make(speaker: CharId, lineId: string): DialogueRequest | null {
  const text = LINES[lineId];
  if (text === undefined) return null;
  return { speaker, lineId, text };
}

export function pickDialogue(events: SimEvent[]): DialogueRequest[] {
  const found: { order: number; req: DialogueRequest }[] = [];

  const push = (kind: (typeof PRIORITY)[number], req: DialogueRequest | null) => {
    if (req) found.push({ order: PRIORITY.indexOf(kind), req });
  };

  for (const ev of events) {
    switch (ev.type) {
      case 'engage': {
        if (!ev.firstMeeting) break;
        if (ev.kind === 'garum' && RIVAL_SPEAKERS.includes(ev.allyId)) {
          push('rival', make(ev.allyId, `rival:${ev.allyId}`));
        } else {
          push('first', make(ev.allyId, `first:${ev.allyId}:${ev.kind}`));
        }
        break;
      }
      case 'skill':
        push('skill', make(ev.allyId, `skill:${ev.allyId}`));
        break;
      case 'pinch':
        push('pinch', make(ev.allyId, `pinch:${ev.allyId}`));
        break;
      case 'garumRepelled':
        if (ev.byAlly) push('win', make(ev.byAlly, `win:${ev.byAlly}`));
        break;
      case 'allyRetired':
        push('retire', make(ev.allyId, `retire:${ev.allyId}`));
        break;
      default:
        break;
    }
  }

  return found
    .map((f, i) => ({ ...f, i }))
    .sort((a, b) => a.order - b.order || a.i - b.i)
    .map((f) => f.req);
}
```

- [ ] **Step 5: テストを走らせて通ることを確認する**

Run: `npm test -- src/core/dialogue.test.ts`
Expected: PASS（11 tests）

- [ ] **Step 6: コミット**

```bash
git add src/content/lines.ts src/core/dialogue.ts src/core/dialogue.test.ts
git commit -m "feat: add dialogue lines and selection"
```

---

### Task 11: 経験値・レベルアップ・称号

**Files:**
- Create: `src/core/progress.ts`
- Test: `src/core/progress.test.ts`

**Interfaces:**
- Consumes: `CharProgress`, `CharBattleStats`, `CharId`, `CHAR_IDS` (Task 6)
- Produces:
  - `MAX_LEVEL = 5`、`XP_BASE = 20`、`XP_PER_DEFEAT = 5`
  - `TitleId = 'gamanzuyoi' | 'ichigekihissatsu' | 'minnanookaasan' | 'kazenoyouni' | 'nakayoshi'`
  - `TITLE_LABELS: Record<TitleId, string>`
  - `TITLE_OWNER: Record<TitleId, CharId | null>`（`null` は全員共通の称号）
  - `Counters = { funbaruUses: number; neraiuchiKills: number; omajinaiUses: number; kakenukeruHits: number; bondSupports: number }`
  - `emptyCounters(): Counters`
  - `xpGain(defeats: number): number`
  - `xpToNext(level: number): number`
  - `applyXp(p: CharProgress, gained: number): CharProgress`
  - `accumulateCounters(prev: Counters, stats: Record<CharId, CharBattleStats>): Counters`
  - `earnedTitles(c: Counters): TitleId[]`

- [ ] **Step 1: 失敗するテストを書く**

`src/core/progress.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  accumulateCounters, applyXp, earnedTitles, emptyCounters,
  MAX_LEVEL, TITLE_LABELS, TITLE_OWNER, xpGain, xpToNext,
} from './progress';
import type { CharBattleStats, CharId } from './types';

const stats = (over: Partial<Record<CharId, Partial<CharBattleStats>>> = {}) => {
  const base: CharBattleStats = { defeats: 0, skillUses: 0, neraiuchiKills: 0, kakenukeruHits: 0, bondSupports: 0 };
  return {
    roran: { ...base, ...over.roran },
    ines: { ...base, ...over.ines },
    mist: { ...base, ...over.mist },
    gau: { ...base, ...over.gau },
  } as Record<CharId, CharBattleStats>;
};

describe('xpGain / xpToNext', () => {
  it('クリア基礎 20 + 撃破数 x 5', () => {
    expect(xpGain(0)).toBe(20);
    expect(xpGain(4)).toBe(40);
  });

  it('次のレベルに必要な経験値は レベル x 30', () => {
    expect(xpToNext(1)).toBe(30);
    expect(xpToNext(4)).toBe(120);
  });
});

describe('applyXp', () => {
  it('足りなければレベルは上がらない', () => {
    expect(applyXp({ level: 1, xp: 0 }, 25)).toEqual({ level: 1, xp: 25 });
  });

  it('ちょうど足りればレベルが上がって余りが繰り越される', () => {
    expect(applyXp({ level: 1, xp: 10 }, 20)).toEqual({ level: 2, xp: 0 });
  });

  it('一度に 2 レベル上がることもある', () => {
    // Lv1: 30 必要 -> Lv2: 60 必要
    expect(applyXp({ level: 1, xp: 0 }, 95)).toEqual({ level: 3, xp: 5 });
  });

  it('上限レベルでは経験値が貯まらない', () => {
    expect(applyXp({ level: MAX_LEVEL, xp: 0 }, 999)).toEqual({ level: MAX_LEVEL, xp: 0 });
  });

  it('元のオブジェクトを書き換えない', () => {
    const p = { level: 1, xp: 0 };
    applyXp(p, 50);
    expect(p).toEqual({ level: 1, xp: 0 });
  });
});

describe('accumulateCounters', () => {
  it('各キャラのスキル使用が対応するカウンタに積まれる', () => {
    const c = accumulateCounters(emptyCounters(), stats({
      roran: { skillUses: 2 },
      mist: { skillUses: 3 },
      ines: { neraiuchiKills: 1 },
      gau: { kakenukeruHits: 4 },
    }));
    expect(c).toMatchObject({ funbaruUses: 2, omajinaiUses: 3, neraiuchiKills: 1, kakenukeruHits: 4 });
  });

  it('なかよし支援は全員ぶんの合計', () => {
    const c = accumulateCounters(emptyCounters(), stats({
      roran: { bondSupports: 3 }, ines: { bondSupports: 2 },
    }));
    expect(c.bondSupports).toBe(5);
  });

  it('前回までのぶんに積み増す', () => {
    const prev = { ...emptyCounters(), funbaruUses: 4 };
    const c = accumulateCounters(prev, stats({ roran: { skillUses: 2 } }));
    expect(c.funbaruUses).toBe(6);
  });

  it('元のカウンタを書き換えない', () => {
    const prev = emptyCounters();
    accumulateCounters(prev, stats({ roran: { skillUses: 2 } }));
    expect(prev.funbaruUses).toBe(0);
  });
});

describe('earnedTitles', () => {
  it('条件を満たしていなければ空', () => {
    expect(earnedTitles(emptyCounters())).toEqual([]);
  });

  it('ふんばる 5 回で がまんづよい', () => {
    expect(earnedTitles({ ...emptyCounters(), funbaruUses: 5 })).toEqual(['gamanzuyoi']);
  });

  it('ねらいうちで 3 体倒すと いちげきひっさつ', () => {
    expect(earnedTitles({ ...emptyCounters(), neraiuchiKills: 3 })).toEqual(['ichigekihissatsu']);
  });

  it('おまじない 5 回で みんなのおかあさん', () => {
    expect(earnedTitles({ ...emptyCounters(), omajinaiUses: 5 })).toEqual(['minnanookaasan']);
  });

  it('かけぬけるで 8 体に当てると かぜのように', () => {
    expect(earnedTitles({ ...emptyCounters(), kakenukeruHits: 8 })).toEqual(['kazenoyouni']);
  });

  it('なかよし支援 20 回で なかよし', () => {
    expect(earnedTitles({ ...emptyCounters(), bondSupports: 20 })).toEqual(['nakayoshi']);
  });

  it('複数まとめて返す', () => {
    expect(earnedTitles({ funbaruUses: 9, neraiuchiKills: 3, omajinaiUses: 0, kakenukeruHits: 0, bondSupports: 30 }))
      .toEqual(['gamanzuyoi', 'ichigekihissatsu', 'nakayoshi']);
  });
});

describe('TITLE_LABELS / TITLE_OWNER', () => {
  it('全称号にひらがな表記のラベルがある', () => {
    for (const label of Object.values(TITLE_LABELS)) {
      expect(label).not.toMatch(/[一-鿿]/);
      expect(label.length).toBeGreaterThan(0);
    }
  });

  it('スキルの称号は持ち主が決まっていて、なかよしだけ全員共通', () => {
    expect(TITLE_OWNER.gamanzuyoi).toBe('roran');
    expect(TITLE_OWNER.ichigekihissatsu).toBe('ines');
    expect(TITLE_OWNER.minnanookaasan).toBe('mist');
    expect(TITLE_OWNER.kazenoyouni).toBe('gau');
    expect(TITLE_OWNER.nakayoshi).toBeNull();
  });
});
```

- [ ] **Step 2: テストを走らせて失敗を確認する**

Run: `npm test -- src/core/progress.test.ts`
Expected: FAIL（`Failed to resolve import "./progress"`）

- [ ] **Step 3: 実装を書く**

`src/core/progress.ts`:

```ts
import { CHAR_IDS } from './types';
import type { CharBattleStats, CharId, CharProgress } from './types';

export const MAX_LEVEL = 5;
export const XP_BASE = 20;
export const XP_PER_DEFEAT = 5;
const XP_PER_LEVEL = 30;

export type TitleId =
  | 'gamanzuyoi'
  | 'ichigekihissatsu'
  | 'minnanookaasan'
  | 'kazenoyouni'
  | 'nakayoshi';

export const TITLE_LABELS: Record<TitleId, string> = {
  gamanzuyoi: 'がまんづよい',
  ichigekihissatsu: 'いちげきひっさつ',
  minnanookaasan: 'みんなの おかあさん',
  kazenoyouni: 'かぜの ように',
  nakayoshi: 'なかよし',
};

/** その称号が誰のものか。null は全員共通 */
export const TITLE_OWNER: Record<TitleId, CharId | null> = {
  gamanzuyoi: 'roran',
  ichigekihissatsu: 'ines',
  minnanookaasan: 'mist',
  kazenoyouni: 'gau',
  nakayoshi: null,
};

export type Counters = {
  funbaruUses: number;
  neraiuchiKills: number;
  omajinaiUses: number;
  kakenukeruHits: number;
  bondSupports: number;
};

export function emptyCounters(): Counters {
  return { funbaruUses: 0, neraiuchiKills: 0, omajinaiUses: 0, kakenukeruHits: 0, bondSupports: 0 };
}

export function xpGain(defeats: number): number {
  return XP_BASE + defeats * XP_PER_DEFEAT;
}

export function xpToNext(level: number): number {
  return level * XP_PER_LEVEL;
}

export function applyXp(p: CharProgress, gained: number): CharProgress {
  let level = p.level;
  let xp = p.xp;
  if (level >= MAX_LEVEL) return { level, xp };

  xp += gained;
  while (level < MAX_LEVEL && xp >= xpToNext(level)) {
    xp -= xpToNext(level);
    level += 1;
  }
  if (level >= MAX_LEVEL) xp = 0;
  return { level, xp };
}

export function accumulateCounters(
  prev: Counters,
  stats: Record<CharId, CharBattleStats>,
): Counters {
  let bondSupports = prev.bondSupports;
  for (const id of CHAR_IDS) bondSupports += stats[id].bondSupports;

  return {
    funbaruUses: prev.funbaruUses + stats.roran.skillUses,
    neraiuchiKills: prev.neraiuchiKills + stats.ines.neraiuchiKills,
    omajinaiUses: prev.omajinaiUses + stats.mist.skillUses,
    kakenukeruHits: prev.kakenukeruHits + stats.gau.kakenukeruHits,
    bondSupports,
  };
}

const TITLE_RULES: { id: TitleId; test: (c: Counters) => boolean }[] = [
  { id: 'gamanzuyoi', test: (c) => c.funbaruUses >= 5 },
  { id: 'ichigekihissatsu', test: (c) => c.neraiuchiKills >= 3 },
  { id: 'minnanookaasan', test: (c) => c.omajinaiUses >= 5 },
  { id: 'kazenoyouni', test: (c) => c.kakenukeruHits >= 8 },
  { id: 'nakayoshi', test: (c) => c.bondSupports >= 20 },
];

export function earnedTitles(c: Counters): TitleId[] {
  return TITLE_RULES.filter((r) => r.test(c)).map((r) => r.id);
}
```

- [ ] **Step 4: テストを走らせて通ることを確認する**

Run: `npm test -- src/core/progress.test.ts`
Expected: PASS（18 tests）

- [ ] **Step 5: コミット**

```bash
git add src/core/progress.ts src/core/progress.test.ts
git commit -m "feat: add experience, leveling and titles"
```

---

### Task 12: セーブデータ

**Files:**
- Create: `src/save/save.ts`
- Test: `src/save/save.test.ts`

**Interfaces:**
- Consumes: `CharProgress`, `CharId`, `CHAR_IDS` (Task 6)、`Counters`, `TitleId`, `emptyCounters` (Task 11)
- Produces:
  - `SAVE_KEY = 'character-tactics/save'`、`SAVE_VERSION = 1`
  - `SaveData = { version: number; clearedStages: number; chars: Record<CharId, CharProgress>; counters: Counters; titles: TitleId[] }`
  - `newSave(): SaveData`
  - `loadSave(storage: StorageLike): SaveData | null`
  - `writeSave(storage: StorageLike, data: SaveData): void`
  - `StorageLike = { getItem(k: string): string | null; setItem(k: string, v: string): void }`

`localStorage` そのものは受け取らず `StorageLike` を引数で受ける。これで `save` レイヤも `window` に依存せずテストできる。実際の `localStorage` を渡すのは `main.ts`（Task 14）。

- [ ] **Step 1: 失敗するテストを書く**

`src/save/save.test.ts`:

```ts
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
```

- [ ] **Step 2: テストを走らせて失敗を確認する**

Run: `npm test -- src/save/save.test.ts`
Expected: FAIL（`Failed to resolve import "./save"`）

- [ ] **Step 3: 実装を書く**

`src/save/save.ts`:

```ts
import { emptyCounters } from '../core/progress';
import { CHAR_IDS } from '../core/types';
import type { Counters, TitleId } from '../core/progress';
import type { CharId, CharProgress } from '../core/types';

export const SAVE_KEY = 'character-tactics/save';
export const SAVE_VERSION = 1;

export type StorageLike = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
};

export type SaveData = {
  version: number;
  clearedStages: number;
  chars: Record<CharId, CharProgress>;
  counters: Counters;
  titles: TitleId[];
};

export function newSave(): SaveData {
  const chars = {} as Record<CharId, CharProgress>;
  for (const id of CHAR_IDS) chars[id] = { level: 1, xp: 0 };
  return { version: SAVE_VERSION, clearedStages: 0, chars, counters: emptyCounters(), titles: [] };
}

function isValid(value: unknown): value is SaveData {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const v = value as Record<string, unknown>;
  if (v.version !== SAVE_VERSION) return false;
  if (typeof v.clearedStages !== 'number') return false;
  if (!Array.isArray(v.titles)) return false;
  if (typeof v.counters !== 'object' || v.counters === null) return false;
  if (typeof v.chars !== 'object' || v.chars === null) return false;

  const chars = v.chars as Record<string, unknown>;
  for (const id of CHAR_IDS) {
    const p = chars[id] as Record<string, unknown> | undefined;
    if (!p || typeof p.level !== 'number' || typeof p.xp !== 'number') return false;
  }
  return true;
}

export function loadSave(storage: StorageLike): SaveData | null {
  const raw = storage.getItem(SAVE_KEY);
  if (raw === null) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    return isValid(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function writeSave(storage: StorageLike, data: SaveData): void {
  storage.setItem(SAVE_KEY, JSON.stringify(data));
}
```

- [ ] **Step 4: テストを走らせて通ることを確認する**

Run: `npm test -- src/save/save.test.ts`
Expected: PASS（9 tests）

- [ ] **Step 5: コミット**

```bash
git add src/save/save.ts src/save/save.test.ts
git commit -m "feat: add save data load and write"
```

---

### Task 13: ステージデータ 3 本

**Files:**
- Create: `src/content/stages/stage1.ts`, `src/content/stages/stage2.ts`, `src/content/stages/stage3.ts`, `src/content/stages/index.ts`
- Test: `src/content/stages/stages.test.ts`

**Interfaces:**
- Consumes: `StageDef` (Task 6)、`makeGrid`, `computeFlowField`, `cellIndexAt`, `isWalkableAt` (Task 2)
- Produces: `STAGES: readonly StageDef[]`（`src/content/stages/index.ts`）

マップは 30 列 × 14 行、セル 32px（= 960×448）。画面上部 46px を情報バー、下部 46px をポートレートバーに使うため、マップは y=46 から描画する（描画は Task 14）。

- [ ] **Step 1: stage1.ts を書く**

```ts
import type { StageDef } from '../../core/types';

const L = { x: 848, y: 240 };

export const STAGE1: StageDef = {
  id: 1,
  name: 'はじまりの しま',
  cell: 32,
  mapRows: [
    '##############################',
    '##############################',
    '####......................####',
    '###........................###',
    '##..........................##',
    '##..........................##',
    '##..........................##',
    '##..........................##',
    '##..........................##',
    '##..........................##',
    '###........................###',
    '####......................####',
    '##############################',
    '##############################',
  ],
  fort: { x: 144, y: 240 },
  landings: [L],
  garumFlees: true,
  waves: [
    { spawns: [
      { at: 0, kind: 'narazumono', from: L },
      { at: 3, kind: 'narazumono', from: L },
      { at: 6, kind: 'narazumono', from: L },
    ] },
    { spawns: [
      { at: 0, kind: 'narazumono', from: L },
      { at: 2.5, kind: 'narazumono', from: L },
      { at: 5, kind: 'narazumono', from: L },
      { at: 7.5, kind: 'narazumono', from: L },
    ] },
    { spawns: [
      { at: 0, kind: 'narazumono', from: L },
      { at: 2, kind: 'narazumono', from: L },
      { at: 4, kind: 'narazumono', from: L },
      { at: 6, kind: 'garum', from: L },
    ] },
  ],
};
```

- [ ] **Step 2: stage2.ts を書く**

```ts
import type { StageDef } from '../../core/types';

const A = { x: 848, y: 80 };
const B = { x: 848, y: 368 };

export const STAGE2: StageDef = {
  id: 2,
  name: 'ふたつの みなと',
  cell: 32,
  mapRows: [
    '##############################',
    '####......................####',
    '###........................###',
    '##..........................##',
    '##..........................##',
    '##.......####...............##',
    '##.......####...............##',
    '##.......####...............##',
    '##.......####...............##',
    '##..........................##',
    '##..........................##',
    '###........................###',
    '####......................####',
    '##############################',
  ],
  fort: { x: 144, y: 240 },
  landings: [A, B],
  garumFlees: true,
  waves: [
    { spawns: [
      { at: 0, kind: 'narazumono', from: A },
      { at: 1.5, kind: 'narazumono', from: B },
      { at: 3, kind: 'narazumono', from: A },
      { at: 4.5, kind: 'narazumono', from: B },
    ] },
    { spawns: [
      { at: 0, kind: 'narazumono', from: A },
      { at: 1, kind: 'narazumono', from: B },
      { at: 2.5, kind: 'narazumono', from: A },
      { at: 3.5, kind: 'narazumono', from: B },
      { at: 5, kind: 'narazumono', from: A },
      { at: 6, kind: 'narazumono', from: B },
    ] },
    { spawns: [
      { at: 0, kind: 'narazumono', from: A },
      { at: 0, kind: 'narazumono', from: B },
      { at: 3, kind: 'narazumono', from: A },
      { at: 3, kind: 'narazumono', from: B },
      { at: 6, kind: 'garum', from: A },
    ] },
  ],
};
```

- [ ] **Step 3: stage3.ts を書く**

```ts
import type { StageDef } from '../../core/types';

const A = { x: 848, y: 80 };
const B = { x: 848, y: 368 };

export const STAGE3: StageDef = {
  id: 3,
  name: 'ガルムの さいご',
  cell: 32,
  mapRows: [
    '##############################',
    '####......................####',
    '###........................###',
    '##...........####...........##',
    '##...........####...........##',
    '##..........................##',
    '##..........................##',
    '##..........................##',
    '##..........................##',
    '##...........####...........##',
    '##...........####...........##',
    '###........................###',
    '####......................####',
    '##############################',
  ],
  fort: { x: 144, y: 240 },
  landings: [A, B],
  garumFlees: false,
  waves: [
    { spawns: [
      { at: 0, kind: 'narazumono', from: A },
      { at: 1, kind: 'tatemochi', from: B },
      { at: 3, kind: 'narazumono', from: A },
    ] },
    { spawns: [
      { at: 0, kind: 'tatemochi', from: A },
      { at: 1, kind: 'tatemochi', from: B },
      { at: 2, kind: 'narazumono', from: A },
      { at: 3, kind: 'narazumono', from: B },
      { at: 4, kind: 'narazumono', from: A },
    ] },
    { spawns: [
      { at: 0, kind: 'narazumono', from: A },
      { at: 0, kind: 'narazumono', from: B },
      { at: 2, kind: 'narazumono', from: A },
      { at: 2, kind: 'narazumono', from: B },
      { at: 4, kind: 'tatemochi', from: A },
      { at: 5, kind: 'garum', from: B },
    ] },
  ],
};
```

- [ ] **Step 4: index.ts を書く**

```ts
import { STAGE1 } from './stage1';
import { STAGE2 } from './stage2';
import { STAGE3 } from './stage3';
import type { StageDef } from '../../core/types';

export const STAGES: readonly StageDef[] = [STAGE1, STAGE2, STAGE3];
```

- [ ] **Step 5: 検証テストを書く**

`src/content/stages/stages.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { STAGES } from './index';
import { cellIndexAt, computeFlowField, isWalkableAt, makeGrid } from '../../core/field';

describe('STAGES', () => {
  it('3 ステージある', () => {
    expect(STAGES).toHaveLength(3);
  });

  it('id は 1,2,3 の順', () => {
    expect(STAGES.map((s) => s.id)).toEqual([1, 2, 3]);
  });

  it('ステージ名に漢字が含まれない', () => {
    for (const s of STAGES) {
      expect(s.name, `stage ${s.id}`).not.toMatch(/[一-鿿]/);
    }
  });

  for (const stage of STAGES) {
    describe(`ステージ ${stage.id}`, () => {
      it('マップは 30 列 x 14 行で、全行の長さがそろっている', () => {
        expect(stage.mapRows).toHaveLength(14);
        for (const row of stage.mapRows) expect(row.length).toBe(30);
      });

      it('いちばん下の行はすべて海（ポートレートバーが重なるため）', () => {
        expect(stage.mapRows[13]).toBe('#'.repeat(30));
      });

      it('砦は歩ける場所にある', () => {
        const grid = makeGrid(stage.cell, stage.mapRows);
        expect(isWalkableAt(grid, stage.fort)).toBe(true);
      });

      it('上陸地点はすべて歩ける場所にある', () => {
        const grid = makeGrid(stage.cell, stage.mapRows);
        for (const l of stage.landings) {
          expect(isWalkableAt(grid, l), `landing ${l.x},${l.y}`).toBe(true);
        }
      });

      it('すべての上陸地点から砦へ到達できる', () => {
        const grid = makeGrid(stage.cell, stage.mapRows);
        const field = computeFlowField(grid, stage.fort);
        for (const l of stage.landings) {
          const idx = cellIndexAt(grid, l);
          expect(field.dist[idx], `landing ${l.x},${l.y}`).toBeGreaterThan(0);
        }
      });

      it('3 ウェーブある', () => {
        expect(stage.waves).toHaveLength(3);
      });

      it('1 ウェーブの敵は 6 体まで', () => {
        for (const w of stage.waves) expect(w.spawns.length).toBeLessThanOrEqual(6);
      });

      it('すべてのスポーン地点が上陸地点のいずれかと一致する', () => {
        const keys = new Set(stage.landings.map((l) => `${l.x},${l.y}`));
        for (const w of stage.waves) {
          for (const sp of w.spawns) expect(keys.has(`${sp.from.x},${sp.from.y}`)).toBe(true);
        }
      });

      it('スポーン時刻は 0 以上', () => {
        for (const w of stage.waves) {
          for (const sp of w.spawns) expect(sp.at).toBeGreaterThanOrEqual(0);
        }
      });

      it('ガルムが登場する', () => {
        const kinds = stage.waves.flatMap((w) => w.spawns.map((s) => s.kind));
        expect(kinds).toContain('garum');
      });
    });
  }

  it('たてもちはステージ 3 でだけ出る', () => {
    for (const stage of STAGES) {
      const kinds = stage.waves.flatMap((w) => w.spawns.map((s) => s.kind));
      expect(kinds.includes('tatemochi'), `stage ${stage.id}`).toBe(stage.id === 3);
    }
  });

  it('ガルムはステージ 3 でだけ撤退しない', () => {
    expect(STAGES.map((s) => s.garumFlees)).toEqual([true, true, false]);
  });

  it('ステージ 1 の上陸地点は 1 つ、2 と 3 は 2 つ', () => {
    expect(STAGES.map((s) => s.landings.length)).toEqual([1, 2, 2]);
  });
});
```

- [ ] **Step 6: テストを走らせて通ることを確認する**

Run: `npm test -- src/content/stages/stages.test.ts`
Expected: PASS（すべて緑。落ちた場合はマップ文字列の長さか砦・上陸地点の座標を直す）

- [ ] **Step 7: コミット**

```bash
git add src/content/stages src/content/stages/stages.test.ts
git commit -m "feat: add three stage definitions"
```

---

### Task 14: 描画

**Files:**
- Create: `src/render/viewport.ts`, `src/render/draw.ts`
- Test: `src/render/viewport.test.ts`

**Interfaces:**
- Consumes: `BattleState`, `Vec2` (Task 6)、`CHARACTERS` (Task 3)、`ENEMIES` (Task 3)、`bondSupporters` (Task 5)、`isFunbaruActive` (Task 7)、`FORT_MAX_HP` (Task 6)
- Produces:
  - `LOGICAL_W = 960`、`LOGICAL_H = 540`、`MAP_ORIGIN = { x: 0, y: 46 }`
  - `Viewport = { scale: number; offsetX: number; offsetY: number }`
  - `computeViewport(canvasW: number, canvasH: number): Viewport`
  - `screenToLogical(vp: Viewport, sx: number, sy: number): Vec2`
  - `mapToLogical(p: Vec2): Vec2`、`logicalToMap(p: Vec2): Vec2`
  - `drawBattle(ctx: CanvasRenderingContext2D, state: BattleState): void`

`render` は `state` を読むだけで書き換えない。

- [ ] **Step 1: 失敗するテストを書く**

`src/render/viewport.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  computeViewport, logicalToMap, LOGICAL_H, LOGICAL_W, mapToLogical, MAP_ORIGIN, screenToLogical,
} from './viewport';

describe('computeViewport', () => {
  it('ぴったりの大きさなら等倍・余白なし', () => {
    expect(computeViewport(LOGICAL_W, LOGICAL_H)).toEqual({ scale: 1, offsetX: 0, offsetY: 0 });
  });

  it('よこに広いと左右に余白が付く', () => {
    const vp = computeViewport(LOGICAL_W * 2, LOGICAL_H);
    expect(vp.scale).toBe(1);
    expect(vp.offsetX).toBe(LOGICAL_W / 2);
    expect(vp.offsetY).toBe(0);
  });

  it('たてに高いと上下に余白が付く', () => {
    const vp = computeViewport(LOGICAL_W, LOGICAL_H * 2);
    expect(vp.scale).toBe(1);
    expect(vp.offsetY).toBe(LOGICAL_H / 2);
  });

  it('2 倍の大きさなら scale が 2', () => {
    expect(computeViewport(LOGICAL_W * 2, LOGICAL_H * 2).scale).toBe(2);
  });
});

describe('screenToLogical', () => {
  it('等倍・余白なしならそのまま', () => {
    const vp = computeViewport(LOGICAL_W, LOGICAL_H);
    expect(screenToLogical(vp, 100, 200)).toEqual({ x: 100, y: 200 });
  });

  it('拡大と余白を打ち消す', () => {
    const vp = computeViewport(LOGICAL_W * 2, LOGICAL_H * 4); // scale 2, offsetY (2160-1080)/2
    const p = screenToLogical(vp, 200 * 1 + vp.offsetX, 100 + vp.offsetY);
    expect(p.x).toBeCloseTo(100);
    expect(p.y).toBeCloseTo(50);
  });
});

describe('mapToLogical / logicalToMap', () => {
  it('マップ原点ぶんずれる', () => {
    expect(mapToLogical({ x: 10, y: 20 })).toEqual({ x: 10, y: 20 + MAP_ORIGIN.y });
  });

  it('往復して元に戻る', () => {
    const p = { x: 123, y: 45 };
    expect(logicalToMap(mapToLogical(p))).toEqual(p);
  });
});
```

- [ ] **Step 2: テストを走らせて失敗を確認する**

Run: `npm test -- src/render/viewport.test.ts`
Expected: FAIL（`Failed to resolve import "./viewport"`）

- [ ] **Step 3: viewport.ts を書く**

```ts
import type { Vec2 } from '../core/types';

export const LOGICAL_W = 960;
export const LOGICAL_H = 540;
/** マップは情報バーのぶんだけ下にずらして描く */
export const MAP_ORIGIN = { x: 0, y: 46 };

export type Viewport = { scale: number; offsetX: number; offsetY: number };

export function computeViewport(canvasW: number, canvasH: number): Viewport {
  const scale = Math.min(canvasW / LOGICAL_W, canvasH / LOGICAL_H);
  return {
    scale,
    offsetX: (canvasW - LOGICAL_W * scale) / 2,
    offsetY: (canvasH - LOGICAL_H * scale) / 2,
  };
}

export function screenToLogical(vp: Viewport, sx: number, sy: number): Vec2 {
  return { x: (sx - vp.offsetX) / vp.scale, y: (sy - vp.offsetY) / vp.scale };
}

export function mapToLogical(p: Vec2): Vec2 {
  return { x: p.x + MAP_ORIGIN.x, y: p.y + MAP_ORIGIN.y };
}

export function logicalToMap(p: Vec2): Vec2 {
  return { x: p.x - MAP_ORIGIN.x, y: p.y - MAP_ORIGIN.y };
}
```

- [ ] **Step 4: テストを走らせて通ることを確認する**

Run: `npm test -- src/render/viewport.test.ts`
Expected: PASS（10 tests）

- [ ] **Step 5: draw.ts を書く**

キャラはスプライトを使わず、色付きの丸と旗で描き分ける（スコープ外の項目）。

```ts
import { CHARACTERS } from '../content/characters';
import { ENEMIES } from '../content/enemies';
import { bondSupporters } from '../core/bonds';
import { isFunbaruActive } from '../core/skills';
import { FORT_MAX_HP } from '../core/types';
import { LOGICAL_H, LOGICAL_W, mapToLogical } from './viewport';
import type { BattleState, Vec2 } from '../core/types';

const COLORS = {
  sea: '#12303f',
  ground: '#3f5d3a',
  rock: '#2b3a44',
  fort: '#d8c98a',
  bar: '#101820',
  text: '#f2efe4',
  hpBack: '#000000',
  hpAlly: '#5ad06a',
  hpEnemy: '#d05a5a',
  bond: 'rgba(255, 190, 220, 0.55)',
};

const UNIT_R = 11;

export function drawBattle(ctx: CanvasRenderingContext2D, state: BattleState): void {
  ctx.save();
  ctx.fillStyle = COLORS.sea;
  ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);

  drawTerrain(ctx, state);
  drawFort(ctx, state);
  drawBonds(ctx, state);
  drawEnemies(ctx, state);
  drawAllies(ctx, state);
  drawTopBar(ctx, state);
  ctx.restore();
}

function drawTerrain(ctx: CanvasRenderingContext2D, state: BattleState): void {
  const { grid } = state;
  for (let i = 0; i < grid.walkable.length; i++) {
    const cx = i % grid.cols;
    const cy = Math.floor(i / grid.cols);
    const p = mapToLogical({ x: cx * grid.cell, y: cy * grid.cell });
    ctx.fillStyle = grid.walkable[i] ? COLORS.ground : COLORS.rock;
    ctx.fillRect(p.x, p.y, grid.cell, grid.cell);
  }
}

function drawFort(ctx: CanvasRenderingContext2D, state: BattleState): void {
  const p = mapToLogical(state.stage.fort);
  ctx.fillStyle = COLORS.fort;
  ctx.fillRect(p.x - 18, p.y - 18, 36, 36);
  ctx.fillStyle = COLORS.bar;
  ctx.fillRect(p.x - 4, p.y - 10, 8, 20);
}

function drawBonds(ctx: CanvasRenderingContext2D, state: BattleState): void {
  ctx.lineWidth = 3;
  ctx.strokeStyle = COLORS.bond;
  for (const ally of state.allies) {
    if (ally.retired || ally.engagedWith === null) continue;
    for (const s of bondSupporters(ally.id, ally.pos, state.allies)) {
      const other = state.allies.find((a) => a.id === s.id);
      if (!other) continue;
      const a = mapToLogical(ally.pos);
      const b = mapToLogical(other.pos);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
      drawHeart(ctx, mapToLogical({ x: other.pos.x, y: other.pos.y - 20 }));
    }
  }
}

function drawHeart(ctx: CanvasRenderingContext2D, p: Vec2): void {
  ctx.fillStyle = '#ff9ec4';
  ctx.beginPath();
  ctx.arc(p.x - 3, p.y, 3.5, 0, Math.PI * 2);
  ctx.arc(p.x + 3, p.y, 3.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(p.x - 6.2, p.y + 1);
  ctx.lineTo(p.x, p.y + 8);
  ctx.lineTo(p.x + 6.2, p.y + 1);
  ctx.fill();
}

function drawHpBar(ctx: CanvasRenderingContext2D, p: Vec2, ratio: number, color: string): void {
  const w = 26;
  ctx.fillStyle = COLORS.hpBack;
  ctx.fillRect(p.x - w / 2, p.y - UNIT_R - 9, w, 4);
  ctx.fillStyle = color;
  ctx.fillRect(p.x - w / 2, p.y - UNIT_R - 9, w * Math.max(0, Math.min(1, ratio)), 4);
}

function drawEnemies(ctx: CanvasRenderingContext2D, state: BattleState): void {
  for (const enemy of state.enemies) {
    const p = mapToLogical(enemy.pos);
    const def = ENEMIES[enemy.kind];
    ctx.fillStyle = def.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, enemy.kind === 'garum' ? UNIT_R + 3 : UNIT_R, 0, Math.PI * 2);
    ctx.fill();
    if (enemy.kind === 'tatemochi') {
      ctx.fillStyle = '#c8ccd4';
      ctx.fillRect(p.x - 14, p.y - 8, 5, 16);
    }
    drawHpBar(ctx, p, enemy.hp / enemy.maxHp, COLORS.hpEnemy);
  }
}

function drawAllies(ctx: CanvasRenderingContext2D, state: BattleState): void {
  for (const ally of state.allies) {
    if (ally.retired) continue;
    const p = mapToLogical(ally.pos);
    ctx.fillStyle = CHARACTERS[ally.id].color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, UNIT_R, 0, Math.PI * 2);
    ctx.fill();

    // はた（キャラだとわかるように）
    ctx.fillStyle = COLORS.text;
    ctx.fillRect(p.x + UNIT_R - 2, p.y - UNIT_R - 6, 2, 10);
    ctx.fillRect(p.x + UNIT_R, p.y - UNIT_R - 6, 7, 5);

    if (isFunbaruActive(ally, state.time)) {
      ctx.strokeStyle = '#ffe27a';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(p.x, p.y, UNIT_R + 4, 0, Math.PI * 2);
      ctx.stroke();
    }
    if (ally.neraiuchiArmed) {
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(p.x, p.y, UNIT_R + 7, 0, Math.PI * 2);
      ctx.stroke();
    }
    drawHpBar(ctx, p, ally.hp / ally.maxHp, COLORS.hpAlly);
  }
}

function drawTopBar(ctx: CanvasRenderingContext2D, state: BattleState): void {
  ctx.fillStyle = COLORS.bar;
  ctx.fillRect(0, 0, LOGICAL_W, 46);
  ctx.fillStyle = COLORS.text;
  ctx.font = '20px sans-serif';
  ctx.textBaseline = 'middle';
  ctx.fillText(`とりで ${state.fortHp} / ${FORT_MAX_HP}`, 16, 23);
  ctx.fillText(`なみ ${state.waveIndex + 1} / ${state.stage.waves.length}`, 280, 23);
  ctx.fillText(state.stage.name, 500, 23);
}
```

- [ ] **Step 6: 型チェック**

Run: `npx tsc --noEmit`
Expected: エラーなし（未使用 import があれば消す）

- [ ] **Step 7: コミット**

```bash
git add src/render/viewport.ts src/render/viewport.test.ts src/render/draw.ts
git commit -m "feat: add canvas rendering for the battle screen"
```

---

### Task 15: 吹き出しキューと当たり判定

**Files:**
- Create: `src/ui/bubbles.ts`, `src/ui/hit.ts`
- Test: `src/ui/bubbles.test.ts`, `src/ui/hit.test.ts`

**Interfaces:**
- Consumes: `DialogueRequest` (Task 10)、`AllyUnit`, `CharId`, `Vec2` (Task 6)
- Produces:
  - `BubbleQueue = { items: DialogueRequest[] }`、`makeBubbleQueue(): BubbleQueue`
  - `enqueue(q: BubbleQueue, reqs: DialogueRequest[]): void`
  - `currentBubble(q: BubbleQueue): DialogueRequest | null`
  - `advanceBubble(q: BubbleQueue): void`
  - `isBlocking(q: BubbleQueue): boolean`
  - `Rect = { x: number; y: number; w: number; h: number }`、`MIN_TAP = 64`
  - `hitRect(r: Rect, p: Vec2): boolean`
  - `pickAlly(allies: AllyUnit[], mapPoint: Vec2, radius?: number): CharId | null`

**吹き出しが 1 つでもキューにある間、ゲームループは `step()` を呼ばない。** これが設計書 6.1 の「吹き出し中は時間が止まる」の実装そのものになる。

- [ ] **Step 1: bubbles の失敗するテストを書く**

`src/ui/bubbles.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { advanceBubble, currentBubble, enqueue, isBlocking, makeBubbleQueue } from './bubbles';
import type { DialogueRequest } from '../core/dialogue';

const req = (lineId: string): DialogueRequest => ({ speaker: 'roran', lineId, text: lineId });

describe('BubbleQueue', () => {
  it('空なら止めないし、表示するものもない', () => {
    const q = makeBubbleQueue();
    expect(isBlocking(q)).toBe(false);
    expect(currentBubble(q)).toBeNull();
  });

  it('積むと止まり、先頭が表示される', () => {
    const q = makeBubbleQueue();
    enqueue(q, [req('a'), req('b')]);
    expect(isBlocking(q)).toBe(true);
    expect(currentBubble(q)!.lineId).toBe('a');
  });

  it('送ると次に進む', () => {
    const q = makeBubbleQueue();
    enqueue(q, [req('a'), req('b')]);
    advanceBubble(q);
    expect(currentBubble(q)!.lineId).toBe('b');
    expect(isBlocking(q)).toBe(true);
  });

  it('全部送ると止まらなくなる', () => {
    const q = makeBubbleQueue();
    enqueue(q, [req('a')]);
    advanceBubble(q);
    expect(isBlocking(q)).toBe(false);
    expect(currentBubble(q)).toBeNull();
  });

  it('空のキューを送っても壊れない', () => {
    const q = makeBubbleQueue();
    expect(() => advanceBubble(q)).not.toThrow();
    expect(isBlocking(q)).toBe(false);
  });

  it('残っているところに積むと後ろに並ぶ', () => {
    const q = makeBubbleQueue();
    enqueue(q, [req('a')]);
    enqueue(q, [req('b')]);
    expect(q.items.map((i) => i.lineId)).toEqual(['a', 'b']);
  });

  it('空配列を積んでも止まらない', () => {
    const q = makeBubbleQueue();
    enqueue(q, []);
    expect(isBlocking(q)).toBe(false);
  });
});
```

- [ ] **Step 2: hit の失敗するテストを書く**

`src/ui/hit.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { MIN_TAP, hitRect, pickAlly } from './hit';
import type { AllyUnit } from '../core/types';

const unit = (id: AllyUnit['id'], x: number, y: number, retired = false) =>
  ({ id, pos: { x, y }, retired } as unknown as AllyUnit);

describe('hitRect', () => {
  const r = { x: 10, y: 20, w: 100, h: 50 };

  it('内側なら true', () => {
    expect(hitRect(r, { x: 50, y: 40 })).toBe(true);
  });

  it('外側なら false', () => {
    expect(hitRect(r, { x: 5, y: 40 })).toBe(false);
    expect(hitRect(r, { x: 50, y: 80 })).toBe(false);
  });

  it('左上のかどは含む', () => {
    expect(hitRect(r, { x: 10, y: 20 })).toBe(true);
  });

  it('右下のかどは含まない', () => {
    expect(hitRect(r, { x: 110, y: 70 })).toBe(false);
  });
});

describe('MIN_TAP', () => {
  it('こどもの ゆびを 想定して 64', () => {
    expect(MIN_TAP).toBe(64);
  });
});

describe('pickAlly', () => {
  const allies = [unit('roran', 100, 100), unit('ines', 140, 100), unit('gau', 300, 300, true)];

  it('近い味方を返す', () => {
    expect(pickAlly(allies, { x: 105, y: 100 })).toBe('roran');
  });

  it('どちらにも近いときは いちばん近いほう', () => {
    expect(pickAlly(allies, { x: 132, y: 100 })).toBe('ines');
  });

  it('遠ければ null', () => {
    expect(pickAlly(allies, { x: 500, y: 500 })).toBeNull();
  });

  it('たいきゃく中の味方は選べない', () => {
    expect(pickAlly(allies, { x: 300, y: 300 })).toBeNull();
  });

  it('半径を指定できる', () => {
    expect(pickAlly(allies, { x: 100, y: 160 }, 70)).toBe('roran');
    expect(pickAlly(allies, { x: 100, y: 160 }, 40)).toBeNull();
  });
});
```

- [ ] **Step 3: テストを走らせて失敗を確認する**

Run: `npm test -- src/ui`
Expected: FAIL（`Failed to resolve import "./bubbles"` / `"./hit"`）

- [ ] **Step 4: 実装を書く**

`src/ui/bubbles.ts`:

```ts
import type { DialogueRequest } from '../core/dialogue';

export type BubbleQueue = { items: DialogueRequest[] };

export function makeBubbleQueue(): BubbleQueue {
  return { items: [] };
}

export function enqueue(q: BubbleQueue, reqs: DialogueRequest[]): void {
  for (const r of reqs) q.items.push(r);
}

export function currentBubble(q: BubbleQueue): DialogueRequest | null {
  return q.items[0] ?? null;
}

export function advanceBubble(q: BubbleQueue): void {
  q.items.shift();
}

export function isBlocking(q: BubbleQueue): boolean {
  return q.items.length > 0;
}
```

`src/ui/hit.ts`:

```ts
import { distance } from '../core/field';
import type { AllyUnit, CharId, Vec2 } from '../core/types';

export const MIN_TAP = 64;

export type Rect = { x: number; y: number; w: number; h: number };

export function hitRect(r: Rect, p: Vec2): boolean {
  return p.x >= r.x && p.x < r.x + r.w && p.y >= r.y && p.y < r.y + r.h;
}

export function pickAlly(allies: AllyUnit[], mapPoint: Vec2, radius = 24): CharId | null {
  let best: CharId | null = null;
  let bestDist = Infinity;
  for (const a of allies) {
    if (a.retired) continue;
    const d = distance(mapPoint, a.pos);
    if (d <= radius && d < bestDist) {
      bestDist = d;
      best = a.id;
    }
  }
  return best;
}
```

- [ ] **Step 5: テストを走らせて通ることを確認する**

Run: `npm test -- src/ui`
Expected: PASS（17 tests）

- [ ] **Step 6: コミット**

```bash
git add src/ui/bubbles.ts src/ui/bubbles.test.ts src/ui/hit.ts src/ui/hit.test.ts
git commit -m "feat: add bubble queue and pointer hit testing"
```

---

### Task 16: キャンペーン進行のルール

**Files:**
- Create: `src/ui/flow.ts`
- Test: `src/ui/flow.test.ts`

**Interfaces:**
- Consumes: `SaveData`, `newSave` (Task 12)、`applyXp`, `xpGain`, `accumulateCounters`, `earnedTitles`, `TitleId` (Task 11)、`STAGES` (Task 13)、`CharBattleStats`, `CharId`, `CHAR_IDS` (Task 6)
- Produces:
  - `isStageUnlocked(save: SaveData, index: number): boolean`
  - `XpGain = { id: CharId; before: CharProgress; after: CharProgress; gained: number; leveledUp: boolean }`
  - `StageResult = { save: SaveData; gains: XpGain[]; newTitles: TitleId[] }`
  - `applyStageClear(save: SaveData, stageIndex: number, stats: Record<CharId, CharBattleStats>): StageResult`

`applyStageClear` は元の `save` を書き換えず、新しい `SaveData` を返す。ステージ失敗時は何も呼ばない（設計書 3.2 の「ステージ開始時点に巻き戻る」は、失敗時にセーブを書かないことで実現する）。

- [ ] **Step 1: 失敗するテストを書く**

`src/ui/flow.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { applyStageClear, isStageUnlocked } from './flow';
import { newSave } from '../save/save';
import { STAGES } from '../content/stages';
import type { CharBattleStats, CharId } from '../core/types';

const stats = (over: Partial<Record<CharId, Partial<CharBattleStats>>> = {}) => {
  const base: CharBattleStats = { defeats: 0, skillUses: 0, neraiuchiKills: 0, kakenukeruHits: 0, bondSupports: 0 };
  return {
    roran: { ...base, ...over.roran }, ines: { ...base, ...over.ines },
    mist: { ...base, ...over.mist }, gau: { ...base, ...over.gau },
  } as Record<CharId, CharBattleStats>;
};

describe('isStageUnlocked', () => {
  it('最初はステージ 1 だけ開いている', () => {
    const s = newSave();
    expect(isStageUnlocked(s, 0)).toBe(true);
    expect(isStageUnlocked(s, 1)).toBe(false);
  });

  it('1 つクリアすると次が開く', () => {
    const s = { ...newSave(), clearedStages: 1 };
    expect(isStageUnlocked(s, 1)).toBe(true);
    expect(isStageUnlocked(s, 2)).toBe(false);
  });

  it('範囲外の index は false', () => {
    expect(isStageUnlocked({ ...newSave(), clearedStages: 3 }, STAGES.length)).toBe(false);
    expect(isStageUnlocked(newSave(), -1)).toBe(false);
  });
});

describe('applyStageClear', () => {
  it('クリア済みステージ数が増える', () => {
    const r = applyStageClear(newSave(), 0, stats());
    expect(r.save.clearedStages).toBe(1);
  });

  it('すでにクリア済みのステージを遊び直しても数は減らない', () => {
    const save = { ...newSave(), clearedStages: 3 };
    const r = applyStageClear(save, 0, stats());
    expect(r.save.clearedStages).toBe(3);
  });

  it('全員が経験値を得る（撃破数ぶん上乗せ）', () => {
    const r = applyStageClear(newSave(), 0, stats({ roran: { defeats: 4 } }));
    const roran = r.gains.find((g) => g.id === 'roran')!;
    const mist = r.gains.find((g) => g.id === 'mist')!;
    expect(roran.gained).toBe(40);
    expect(mist.gained).toBe(20);
  });

  it('必要量に届けばレベルが上がる', () => {
    const r = applyStageClear(newSave(), 0, stats({ ines: { defeats: 2 } }));
    const ines = r.gains.find((g) => g.id === 'ines')!;
    expect(ines.after.level).toBe(2);
    expect(ines.leveledUp).toBe(true);
    expect(r.save.chars.ines.level).toBe(2);
  });

  it('届かなければレベルは据え置き', () => {
    const r = applyStageClear(newSave(), 0, stats());
    const gau = r.gains.find((g) => g.id === 'gau')!;
    expect(gau.after).toEqual({ level: 1, xp: 20 });
    expect(gau.leveledUp).toBe(false);
  });

  it('新しく取った称号だけ newTitles に入る', () => {
    const first = applyStageClear(newSave(), 0, stats({ roran: { skillUses: 5 } }));
    expect(first.newTitles).toEqual(['gamanzuyoi']);
    expect(first.save.titles).toEqual(['gamanzuyoi']);

    const second = applyStageClear(first.save, 1, stats({ roran: { skillUses: 1 } }));
    expect(second.newTitles).toEqual([]);
    expect(second.save.titles).toEqual(['gamanzuyoi']);
  });

  it('カウンタが積み上がる', () => {
    const first = applyStageClear(newSave(), 0, stats({ roran: { skillUses: 2 } }));
    const second = applyStageClear(first.save, 1, stats({ roran: { skillUses: 3 } }));
    expect(second.save.counters.funbaruUses).toBe(5);
    expect(second.newTitles).toEqual(['gamanzuyoi']);
  });

  it('元のセーブを書き換えない', () => {
    const save = newSave();
    applyStageClear(save, 0, stats({ roran: { defeats: 10 } }));
    expect(save.clearedStages).toBe(0);
    expect(save.chars.roran).toEqual({ level: 1, xp: 0 });
  });
});
```

- [ ] **Step 2: テストを走らせて失敗を確認する**

Run: `npm test -- src/ui/flow.test.ts`
Expected: FAIL（`Failed to resolve import "./flow"`）

- [ ] **Step 3: 実装を書く**

`src/ui/flow.ts`:

```ts
import { STAGES } from '../content/stages';
import { accumulateCounters, applyXp, earnedTitles, xpGain } from '../core/progress';
import { CHAR_IDS } from '../core/types';
import type { TitleId } from '../core/progress';
import type { SaveData } from '../save/save';
import type { CharBattleStats, CharId, CharProgress } from '../core/types';

export function isStageUnlocked(save: SaveData, index: number): boolean {
  if (index < 0 || index >= STAGES.length) return false;
  return index <= save.clearedStages;
}

export type XpGain = {
  id: CharId;
  before: CharProgress;
  after: CharProgress;
  gained: number;
  leveledUp: boolean;
};

export type StageResult = { save: SaveData; gains: XpGain[]; newTitles: TitleId[] };

export function applyStageClear(
  save: SaveData,
  stageIndex: number,
  stats: Record<CharId, CharBattleStats>,
): StageResult {
  const chars = {} as Record<CharId, CharProgress>;
  const gains: XpGain[] = [];

  for (const id of CHAR_IDS) {
    const before = save.chars[id];
    const gained = xpGain(stats[id].defeats);
    const after = applyXp(before, gained);
    chars[id] = after;
    gains.push({ id, before, after, gained, leveledUp: after.level > before.level });
  }

  const counters = accumulateCounters(save.counters, stats);
  const allTitles = earnedTitles(counters);
  const newTitles = allTitles.filter((t) => !save.titles.includes(t));

  return {
    save: {
      ...save,
      clearedStages: Math.max(save.clearedStages, stageIndex + 1),
      chars,
      counters,
      titles: allTitles,
    },
    gains,
    newTitles,
  };
}
```

- [ ] **Step 4: テストを走らせて通ることを確認する**

Run: `npm test -- src/ui/flow.test.ts`
Expected: PASS（12 tests）

- [ ] **Step 5: コミット**

```bash
git add src/ui/flow.ts src/ui/flow.test.ts
git commit -m "feat: add campaign progression rules"
```

---

### Task 17: 画面遷移とゲームループ（アプリシェル）

**Files:**
- Create: `src/ui/layout.ts`, `src/ui/screens.ts`, `src/main.ts`
- Test: 手動確認（`npm run dev`）

**Interfaces:**
- Consumes: これまでの全モジュール
- Produces:
  - `src/ui/layout.ts`: `BTN`（画面ごとのボタン矩形）、`portraitSlot(index: number): Rect`、`BOTTOM_BAR_Y = 476`
  - `src/ui/screens.ts`: `drawTitle`, `drawStageSelect`, `drawPlacement`, `drawBottomBar`, `drawBubble`, `drawWaveCleared`, `drawResult`, `drawDefeat`
  - `src/main.ts`: ブートとゲームループ

ゲームループの中心は次の 1 行のルール:

```ts
if (!isBlocking(bubbles)) step(battle, commands, FIXED_DT);
```

- [ ] **Step 1: layout.ts を書く**

```ts
import type { Rect } from './hit';

export const BOTTOM_BAR_Y = 476;
export const BOTTOM_BAR_H = 64;

export const BTN = {
  titleNew: { x: 330, y: 300, w: 300, h: 72 } as Rect,
  titleContinue: { x: 330, y: 388, w: 300, h: 72 } as Rect,
  back: { x: 24, y: 400, w: 180, h: 64 } as Rect,
  start: { x: 720, y: 400, w: 216, h: 64 } as Rect,
  next: { x: 380, y: 380, w: 200, h: 72 } as Rect,
  retry: { x: 250, y: 380, w: 200, h: 72 } as Rect,
  toSelect: { x: 510, y: 380, w: 200, h: 72 } as Rect,
} as const;

export const STAGE_BTN: Rect[] = [0, 1, 2].map((i) => ({
  x: 96 + i * 264, y: 200, w: 240, h: 160,
}));

export function portraitSlot(index: number): Rect {
  return { x: index * 240 + 8, y: BOTTOM_BAR_Y, w: 224, h: BOTTOM_BAR_H };
}

/** 選択中のキャラの上に出すスキルボタン。マップ座標ではなく論理座標で返す */
export function skillButtonAt(logicalPos: { x: number; y: number }): Rect {
  const w = 132;
  const h = 64;
  const x = Math.max(8, Math.min(960 - w - 8, logicalPos.x - w / 2));
  const y = Math.max(52, logicalPos.y - 86);
  return { x, y, w, h };
}
```

- [ ] **Step 2: screens.ts を書く**

```ts
import { CHARACTERS } from '../content/characters';
import { STAGES } from '../content/stages';
import { TITLE_LABELS, TITLE_OWNER, xpToNext } from '../core/progress';
import { CHAR_IDS } from '../core/types';
import { LOGICAL_H, LOGICAL_W, mapToLogical } from '../render/viewport';
import { BOTTOM_BAR_H, BOTTOM_BAR_Y, BTN, STAGE_BTN, portraitSlot, skillButtonAt } from './layout';
import { isStageUnlocked } from './flow';
import type { DialogueRequest } from '../core/dialogue';
import type { XpGain } from './flow';
import type { TitleId } from '../core/progress';
import type { SaveData } from '../save/save';
import type { BattleState, CharId } from '../core/types';
import type { Rect } from './hit';

const INK = '#f2efe4';
const PANEL = 'rgba(16, 24, 32, 0.88)';

function panel(ctx: CanvasRenderingContext2D, r: Rect, fill = PANEL): void {
  ctx.fillStyle = fill;
  ctx.fillRect(r.x, r.y, r.w, r.h);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2;
  ctx.strokeRect(r.x + 1, r.y + 1, r.w - 2, r.h - 2);
}

function button(ctx: CanvasRenderingContext2D, r: Rect, label: string, enabled = true): void {
  panel(ctx, r, enabled ? '#2c4a63' : '#2a2f35');
  ctx.fillStyle = enabled ? INK : '#78808a';
  ctx.font = '26px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, r.x + r.w / 2, r.y + r.h / 2);
  ctx.textAlign = 'left';
}

function clear(ctx: CanvasRenderingContext2D): void {
  ctx.fillStyle = '#101820';
  ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);
}

export function drawTitle(ctx: CanvasRenderingContext2D, hasSave: boolean): void {
  clear(ctx);
  ctx.fillStyle = INK;
  ctx.font = '58px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('とりでの なかまたち', LOGICAL_W / 2, 180);
  ctx.font = '22px sans-serif';
  ctx.fillText('4にんの なかまで しまを まもろう', LOGICAL_W / 2, 232);
  ctx.textAlign = 'left';
  button(ctx, BTN.titleNew, 'はじめから');
  button(ctx, BTN.titleContinue, 'つづきから', hasSave);
}

export function drawStageSelect(ctx: CanvasRenderingContext2D, save: SaveData): void {
  clear(ctx);
  ctx.fillStyle = INK;
  ctx.font = '36px sans-serif';
  ctx.fillText('どの しまを まもる？', 40, 100);

  STAGES.forEach((stage, i) => {
    const r = STAGE_BTN[i]!;
    const unlocked = isStageUnlocked(save, i);
    panel(ctx, r, unlocked ? '#2c4a63' : '#2a2f35');
    ctx.fillStyle = unlocked ? INK : '#78808a';
    ctx.font = '24px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(unlocked ? stage.name : 'まだ いけない', r.x + r.w / 2, r.y + 60);
    ctx.font = '18px sans-serif';
    if (unlocked && i < save.clearedStages) ctx.fillText('クリア ずみ', r.x + r.w / 2, r.y + 104);
    ctx.textAlign = 'left';
  });

  drawRoster(ctx, save);
}

function drawRoster(ctx: CanvasRenderingContext2D, save: SaveData): void {
  ctx.font = '18px sans-serif';
  CHAR_IDS.forEach((id, i) => {
    const r = portraitSlot(i);
    panel(ctx, r, '#18222c');
    ctx.fillStyle = CHARACTERS[id].color;
    ctx.beginPath();
    ctx.arc(r.x + 28, r.y + 32, 16, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = INK;
    ctx.fillText(`${CHARACTERS[id].name} Lv${save.chars[id].level}`, r.x + 54, r.y + 26);
    const own = save.titles.filter((t) => TITLE_OWNER[t] === id || TITLE_OWNER[t] === null);
    ctx.fillStyle = '#9fb3c4';
    ctx.fillText(own.map((t) => TITLE_LABELS[t]).join('、'), r.x + 54, r.y + 48);
  });
}

export function drawPlacement(ctx: CanvasRenderingContext2D, state: BattleState): void {
  ctx.fillStyle = 'rgba(16, 24, 32, 0.35)';
  ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);

  ctx.fillStyle = '#ffd479';
  for (const l of state.stage.landings) {
    const p = mapToLogical(l);
    ctx.beginPath();
    ctx.moveTo(p.x + 26, p.y);
    ctx.lineTo(p.x - 6, p.y - 16);
    ctx.lineTo(p.x - 6, p.y + 16);
    ctx.closePath();
    ctx.fill();
  }

  ctx.fillStyle = INK;
  ctx.font = '24px sans-serif';
  ctx.fillText('なかまを ドラッグして おこう', 40, 380);
  button(ctx, BTN.start, 'はじめる');
}

export function drawBottomBar(
  ctx: CanvasRenderingContext2D,
  state: BattleState,
  selected: CharId | null,
): void {
  ctx.fillStyle = 'rgba(16, 24, 32, 0.92)';
  ctx.fillRect(0, BOTTOM_BAR_Y, LOGICAL_W, BOTTOM_BAR_H);

  CHAR_IDS.forEach((id, i) => {
    const ally = state.allies.find((a) => a.id === id)!;
    const r = portraitSlot(i);
    panel(ctx, r, selected === id ? '#3a5f7d' : '#18222c');

    ctx.globalAlpha = ally.retired ? 0.4 : 1;
    ctx.fillStyle = CHARACTERS[id].color;
    ctx.beginPath();
    ctx.arc(r.x + 26, r.y + 32, 15, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = INK;
    ctx.font = '17px sans-serif';
    ctx.fillText(CHARACTERS[id].name, r.x + 50, r.y + 24);

    ctx.fillStyle = '#000';
    ctx.fillRect(r.x + 50, r.y + 34, 120, 8);
    ctx.fillStyle = ally.retired ? '#666' : '#5ad06a';
    ctx.fillRect(r.x + 50, r.y + 34, 120 * Math.max(0, ally.hp / ally.maxHp), 8);

    ctx.fillStyle = ally.skillUsed || ally.retired ? '#555' : '#ffd479';
    ctx.beginPath();
    ctx.arc(r.x + 198, r.y + 32, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    if (ally.retired) {
      ctx.fillStyle = '#ff9a9a';
      ctx.font = '15px sans-serif';
      ctx.fillText('たいきゃく', r.x + 50, r.y + 56);
    }
  });
}

export function drawSkillButton(
  ctx: CanvasRenderingContext2D,
  state: BattleState,
  selected: CharId,
): Rect | null {
  const ally = state.allies.find((a) => a.id === selected);
  if (!ally || ally.retired || ally.skillUsed) return null;
  const r = skillButtonAt(mapToLogical(ally.pos));
  const labels: Record<string, string> = {
    funbaru: 'ふんばる', neraiuchi: 'ねらいうち', omajinai: 'おまじない', kakenukeru: 'かけぬける',
  };
  button(ctx, r, labels[ally.skill] ?? 'スキル');
  return r;
}

export function drawBubble(ctx: CanvasRenderingContext2D, req: DialogueRequest): void {
  ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
  ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);

  const r: Rect = { x: 120, y: 300, w: 720, h: 150 };
  panel(ctx, r, '#f7f3e6');
  ctx.fillStyle = CHARACTERS[req.speaker].color;
  ctx.beginPath();
  ctx.arc(r.x + 54, r.y + 60, 30, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#1a1a1a';
  ctx.font = '20px sans-serif';
  ctx.fillText(CHARACTERS[req.speaker].name, r.x + 100, r.y + 34);
  ctx.font = '26px sans-serif';
  req.text.split('\n').forEach((line, i) => {
    ctx.fillText(line, r.x + 100, r.y + 74 + i * 36);
  });

  ctx.font = '18px sans-serif';
  ctx.fillStyle = '#666';
  ctx.textAlign = 'right';
  ctx.fillText('タップで つぎへ', r.x + r.w - 20, r.y + r.h - 18);
  ctx.textAlign = 'left';
}

export function drawWaveCleared(ctx: CanvasRenderingContext2D, state: BattleState): void {
  ctx.fillStyle = 'rgba(16, 24, 32, 0.6)';
  ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);
  ctx.fillStyle = INK;
  ctx.font = '40px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('つぎの なみが くるよ', LOGICAL_W / 2, 260);
  ctx.font = '20px sans-serif';
  ctx.fillText(`なみ ${state.waveIndex + 2} / ${state.stage.waves.length}`, LOGICAL_W / 2, 306);
  ctx.textAlign = 'left';
  button(ctx, BTN.next, 'つぎへ');
}

export function drawResult(
  ctx: CanvasRenderingContext2D,
  state: BattleState,
  gains: XpGain[],
  newTitles: TitleId[],
): void {
  clear(ctx);
  ctx.fillStyle = INK;
  ctx.font = '44px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('しまを まもった！', LOGICAL_W / 2, 90);
  ctx.textAlign = 'left';

  ctx.font = '19px sans-serif';
  gains.forEach((g, i) => {
    const y = 150 + i * 46;
    ctx.fillStyle = CHARACTERS[g.id].color;
    ctx.beginPath();
    ctx.arc(60, y - 6, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = INK;
    const st = state.stats[g.id];
    ctx.fillText(
      `${CHARACTERS[g.id].name}  たおした ${st.defeats}  スキル ${st.skillUses}  おうえん ${st.bondSupports}`,
      90, y,
    );
    ctx.fillText(`+${g.gained} けいけんち`, 620, y);
    ctx.fillStyle = g.leveledUp ? '#ffd479' : '#9fb3c4';
    ctx.fillText(
      g.leveledUp ? `レベルアップ！ Lv${g.after.level}` : `Lv${g.after.level} (${g.after.xp}/${xpToNext(g.after.level)})`,
      770, y,
    );
  });

  if (newTitles.length > 0) {
    ctx.fillStyle = '#ffd479';
    ctx.font = '22px sans-serif';
    ctx.fillText(`しょうごう ゲット: ${newTitles.map((t) => TITLE_LABELS[t]).join('、')}`, 60, 350);
  }

  button(ctx, BTN.next, 'つぎへ');
}

export function drawDefeat(ctx: CanvasRenderingContext2D): void {
  clear(ctx);
  ctx.fillStyle = INK;
  ctx.font = '44px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('とりでが やぶられた', LOGICAL_W / 2, 240);
  ctx.textAlign = 'left';
  button(ctx, BTN.retry, 'もういちど');
  button(ctx, BTN.toSelect, 'しまを えらぶ');
}
```

- [ ] **Step 3: main.ts を書く**

```ts
import { STAGES } from './content/stages';
import { pickDialogue } from './core/dialogue';
import { createBattleState, placeAlly, startWave } from './core/state';
import { step } from './core/sim';
import type { SimCommand } from './core/sim';
import { drawBattle } from './render/draw';
import { LOGICAL_H, LOGICAL_W, computeViewport, logicalToMap, mapToLogical, screenToLogical } from './render/viewport';
import { advanceBubble, currentBubble, enqueue, isBlocking, makeBubbleQueue } from './ui/bubbles';
import { applyStageClear, isStageUnlocked } from './ui/flow';
import { hitRect, pickAlly } from './ui/hit';
import { BTN, STAGE_BTN, portraitSlot, skillButtonAt } from './ui/layout';
import {
  drawBottomBar, drawBubble, drawDefeat, drawPlacement, drawResult,
  drawSkillButton, drawStageSelect, drawTitle, drawWaveCleared,
} from './ui/screens';
import { loadSave, newSave, writeSave } from './save/save';
import type { SaveData } from './save/save';
import type { XpGain } from './ui/flow';
import type { TitleId } from './core/progress';
import type { BattleState, CharId, Vec2 } from './core/types';

const FIXED_DT = 1 / 60;

type Phase = 'title' | 'select' | 'placement' | 'battle' | 'waveCleared' | 'result' | 'defeat';

const canvas = document.getElementById('game') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;

const loaded = loadSave(window.localStorage);
let save: SaveData = loaded ?? newSave();
let hasSave = loaded !== null;
let phase: Phase = 'title';
let stageIndex = 0;
let battle: BattleState | null = null;
let selected: CharId | null = null;
let dragging: CharId | null = null;
let pendingSkill: CharId | null = null;
let result: { gains: XpGain[]; newTitles: TitleId[] } | null = null;
const bubbles = makeBubbleQueue();
const commands: SimCommand[] = [];
let accumulator = 0;
let lastTime = performance.now();

function resize(): void {
  const scale = Math.min(window.innerWidth / LOGICAL_W, window.innerHeight / LOGICAL_H);
  canvas.width = Math.floor(LOGICAL_W * scale * window.devicePixelRatio);
  canvas.height = Math.floor(LOGICAL_H * scale * window.devicePixelRatio);
  canvas.style.width = `${Math.floor(LOGICAL_W * scale)}px`;
  canvas.style.height = `${Math.floor(LOGICAL_H * scale)}px`;
}
window.addEventListener('resize', resize);
resize();

function toLogical(ev: PointerEvent): Vec2 {
  const rect = canvas.getBoundingClientRect();
  const vp = computeViewport(rect.width, rect.height);
  return screenToLogical(vp, ev.clientX - rect.left, ev.clientY - rect.top);
}

function beginStage(index: number): void {
  stageIndex = index;
  battle = createBattleState(STAGES[index]!, save.chars, Date.now() % 100000);
  selected = null;
  pendingSkill = null;
  bubbles.items.length = 0;
  phase = 'placement';
}

function onPointerDown(ev: PointerEvent): void {
  const p = toLogical(ev);

  if (isBlocking(bubbles)) {
    advanceBubble(bubbles);
    return;
  }

  switch (phase) {
    case 'title':
      if (hitRect(BTN.titleNew, p)) {
        save = newSave();
        writeSave(window.localStorage, save);
        hasSave = true;
        phase = 'select';
      } else if (hasSave && hitRect(BTN.titleContinue, p)) {
        phase = 'select';
      }
      return;

    case 'select':
      for (let i = 0; i < STAGE_BTN.length; i++) {
        if (hitRect(STAGE_BTN[i]!, p) && isStageUnlocked(save, i)) beginStage(i);
      }
      return;

    case 'placement': {
      if (!battle) return;
      if (hitRect(BTN.start, p)) {
        writeSave(window.localStorage, save); // ステージ開始時点を保存する
        startWave(battle);
        phase = 'battle';
        return;
      }
      const hit = pickAlly(battle.allies, logicalToMap(p));
      if (hit) dragging = hit;
      return;
    }

    case 'battle': {
      if (!battle) return;
      if (pendingSkill) {
        commands.push({ type: 'skill', allyId: pendingSkill, dest: logicalToMap(p) });
        pendingSkill = null;
        return;
      }
      if (selected) {
        const ally = battle.allies.find((a) => a.id === selected)!;
        const canTap = !ally.retired && !ally.skillUsed;
        if (canTap && hitRect(skillButtonAt(mapToLogical(ally.pos)), p)) {
          if (ally.skill === 'kakenukeru') pendingSkill = selected;
          else commands.push({ type: 'skill', allyId: selected });
          return;
        }
      }
      for (let i = 0; i < 4; i++) {
        if (hitRect(portraitSlot(i), p)) {
          selected = battle.allies[i]!.id;
          return;
        }
      }
      const hit = pickAlly(battle.allies, logicalToMap(p));
      if (hit) {
        selected = hit;
        dragging = hit;
      } else if (selected) {
        commands.push({ type: 'move', allyId: selected, dest: logicalToMap(p) });
      }
      return;
    }

    case 'waveCleared': {
      if (!battle) return;
      if (hitRect(BTN.next, p)) {
        battle.waveIndex += 1;
        startWave(battle);
        phase = 'battle';
        return;
      }
      // なみの あいだは 再配置できる
      const hit = pickAlly(battle.allies, logicalToMap(p));
      if (hit) dragging = hit;
      return;
    }

    case 'result':
      if (hitRect(BTN.next, p)) phase = 'select';
      return;

    case 'defeat':
      if (hitRect(BTN.retry, p)) beginStage(stageIndex);
      else if (hitRect(BTN.toSelect, p)) phase = 'select';
      return;
  }
}

function onPointerUp(ev: PointerEvent): void {
  if (!battle || !dragging) return;
  const dest = logicalToMap(toLogical(ev));
  if (phase === 'placement' || phase === 'waveCleared') placeAlly(battle, dragging, dest);
  else if (phase === 'battle') commands.push({ type: 'move', allyId: dragging, dest });
  dragging = null;
}

canvas.addEventListener('pointerdown', onPointerDown);
canvas.addEventListener('pointerup', onPointerUp);

function update(dt: number): void {
  if (phase !== 'battle' || !battle) return;
  if (isBlocking(bubbles)) return; // 吹き出し中は時間が止まる

  accumulator += dt;
  while (accumulator >= FIXED_DT) {
    accumulator -= FIXED_DT;
    const batch = commands.splice(0, commands.length);
    step(battle, batch, FIXED_DT);
    enqueue(bubbles, pickDialogue(battle.events));
    if (isBlocking(bubbles)) break;
  }

  if (battle.phase === 'defeat') {
    phase = 'defeat';
  } else if (battle.phase === 'waveCleared') {
    phase = 'waveCleared';
  } else if (battle.phase === 'stageCleared') {
    const r = applyStageClear(save, stageIndex, battle.stats);
    save = r.save;
    writeSave(window.localStorage, save);
    hasSave = true;
    result = { gains: r.gains, newTitles: r.newTitles };
    phase = 'result';
  }
}

function render(): void {
  const vp = computeViewport(canvas.width, canvas.height);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.setTransform(vp.scale, 0, 0, vp.scale, vp.offsetX, vp.offsetY);

  switch (phase) {
    case 'title':
      drawTitle(ctx, hasSave);
      break;
    case 'select':
      drawStageSelect(ctx, save);
      break;
    case 'placement':
      if (battle) {
        drawBattle(ctx, battle);
        drawPlacement(ctx, battle);
        drawBottomBar(ctx, battle, selected);
      }
      break;
    case 'battle':
      if (battle) {
        drawBattle(ctx, battle);
        drawBottomBar(ctx, battle, selected);
        if (selected) drawSkillButton(ctx, battle, selected);
      }
      break;
    case 'waveCleared':
      if (battle) {
        drawBattle(ctx, battle);
        drawBottomBar(ctx, battle, selected);
        drawWaveCleared(ctx, battle);
      }
      break;
    case 'result':
      if (battle && result) drawResult(ctx, battle, result.gains, result.newTitles);
      break;
    case 'defeat':
      drawDefeat(ctx);
      break;
  }

  const bubble = currentBubble(bubbles);
  if (bubble) drawBubble(ctx, bubble);
}

function loop(now: number): void {
  const dt = Math.min(0.25, (now - lastTime) / 1000);
  lastTime = now;
  update(dt);
  render();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
```

- [ ] **Step 4: 型チェックとテストを走らせる**

Run: `npx tsc --noEmit && npm test`
Expected: どちらもエラーなし

- [ ] **Step 5: 開発サーバで手動確認する**

Run: `npm run dev`

ブラウザで開いて、次を上から順に確かめる。1 つでも通らなければ直してから次へ進む。

1. タイトルが出て「はじめから」が押せる。セーブがない状態では「つづきから」が灰色
2. ステージ選択で、ステージ 1 だけ選べて 2・3 はロック表示
3. 配置画面で上陸地点に矢印が出る。4 人をドラッグで動かせる。海の上には置けない
4. 「はじめる」で敵が出現し、砦へ向かって歩いてくる
5. 味方が敵に近づくと足を止めて交戦し、**初対面の吹き出しが出て時間が止まる**。タップで送ると再開する
6. キャラをタップするとスキルボタンが出る。押すとスキルが発動し、吹き出しが出る
7. ガウの「かけぬける」はボタンを押したあと移動先をタップする 2 段階になっている
8. ロランとイネスを近づけると、2 人の間に線とハートが出る
9. 敵を全滅させると「つぎの なみが くるよ」が出る。この画面で味方をドラッグして再配置でき、たいきゃくしていた味方が HP 半分で復帰している
10. 3 ウェーブ耐えると結果画面が出て、経験値と（条件を満たしていれば）レベルアップ・称号が表示される
11. 「つぎへ」でステージ選択に戻り、ステージ 2 が解放されている
12. ブラウザを再読み込みしてもタイトルの「つづきから」が有効で、レベルが保持されている
13. わざと砦を落とすと「とりでが やぶられた」が出て、「もういちど」でステージ最初からやり直せる
14. ウィンドウサイズを変えても、レターボックスで比率が保たれ、タップ位置がずれない

- [ ] **Step 6: コミット**

```bash
git add src/ui/layout.ts src/ui/screens.ts src/main.ts
git commit -m "feat: add screen flow, input handling and game loop"
```

---

### Task 18: デプロイ設定（wrangler と GitHub Actions）

**Files:**
- Create: `wrangler.toml`, `.github/workflows/deploy.yml`, `README.md`
- Modify: なし（`vite.config.ts` の `base` / `outDir` は Task 1 で設定済み）

**Interfaces:**
- Consumes: Task 1 の `vite.config.ts`
- Produces: `main` への push でビルド・デプロイされる CI

- [ ] **Step 1: ビルド出力の構造を確認する**

Run: `npm run build && find out -type f | head -20`
Expected: `out/play/character-tactics/index.html` が存在すること。`out/index.html` になっていたら `vite.config.ts` の `build.outDir` が間違っている（Global Constraints 参照）

- [ ] **Step 2: wrangler.toml を作る**

`assets.directory` はネスト前の起点 `./out` を指す。Wrangler がその中から `play/character-tactics/*` を探す。

```toml
name = "ankardo-game-character-tactics"
compatibility_date = "2026-08-17"

routes = [
  { pattern = "ankardo.com/play/character-tactics/*", zone_name = "ankardo.com" }
]

[assets]
directory = "./out"
not_found_handling = "404-page"
```

- [ ] **Step 3: pin する actions の SHA を調べる**

SHA は推測せず、必ず実際に引く。

```bash
gh api repos/actions/checkout/commits/v4.2.2 --jq .sha
gh api repos/actions/setup-node/commits/v4.1.0 --jq .sha
gh api repos/cloudflare/wrangler-action/commits/v3.14.0 --jq .sha
```

- [ ] **Step 4: .github/workflows/deploy.yml を作る**

`<SHA_*>` は Step 3 の出力で置き換える。`node-version` は 22 以上、`wrangler` は Task 1 で `^4` に固定済み。どちらかを外すと wrangler-action が 3.90.0 にフォールバックし、パス付きルート + Assets のネスト構造をサポートせず `Workers which have static assets cannot be routed on a URL which has a path component` で失敗する。

```yaml
name: deploy

on:
  push:
    branches: [main]

permissions:
  contents: read

jobs:
  deploy:
    runs-on: ubuntu-latest
    environment: production
    steps:
      - uses: actions/checkout@<SHA_CHECKOUT> # v4.2.2
      - uses: actions/setup-node@<SHA_SETUP_NODE> # v4.1.0
        with:
          node-version: '22'
          cache: npm
      - run: npm ci
      - run: npm test
      - run: npm run build
      - uses: cloudflare/wrangler-action@<SHA_WRANGLER_ACTION> # v3.14.0
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
```

ankardo の `site.yml` にある `on.push.paths: ["site/**"]` / `defaults.run.working-directory: site` / `cache-dependency-path: site/package-lock.json` / Wrangler の `workingDirectory: site` は、`site/` サブディレクトリ構成を前提にした設定である。本リポジトリはルート直下構成なのでコピーしない。

- [ ] **Step 5: README.md を作る**

```markdown
# とりでの なかまたち (character-tactics)

小さな島の砦を、4人の仲間で守るリアルタイム防衛シミュレーション。
[ankardo](https://ankardo.com) のサブリソースとして `ankardo.com/play/character-tactics/` で公開する。

- 設計: `docs/superpowers/specs/2026-08-17-character-tactics-design.md`
- 実装計画: `docs/superpowers/plans/2026-08-17-character-tactics.md`

## 開発

必要なもの: Node.js 22 以上

```bash
npm install
npm run dev     # 開発サーバ
npm test        # ユニットテスト (Vitest)
npm run build   # 型チェック + 本番ビルド (out/play/character-tactics/)
```

## 構成

| ディレクトリ | 責務 |
|---|---|
| `src/core/` | 描画・DOM に依存しない純ロジック。ここだけでゲームのルールが完結する |
| `src/content/` | キャラ・敵・セリフ・ステージのデータ。ロジックを置かない |
| `src/render/` | Canvas2D 描画。`core` の状態を読むだけで書き換えない |
| `src/ui/` | 画面遷移・入力・吹き出しキュー |
| `src/save/` | localStorage の読み書き |

`src/core/**` と `src/content/**` は `window` / `document` / `localStorage` を参照しない。

## デプロイ

`main` への push で GitHub Actions がビルドし、Cloudflare Workers Static Assets へデプロイする。

ビルド設定で注意する点:

- `vite.config.ts` の `base` は `/play/character-tactics/`
- `vite.config.ts` の `build.outDir` は `out/play/character-tactics`（`out` 直下にすると、パス付きルートの Workers では deploy が失敗する）
- `wrangler` は `^4` 系に固定し、CI の Node.js は 22 以上にする
```

- [ ] **Step 6: ローカルで最終確認する**

Run: `npm test && npm run build`
Expected: どちらも成功。`out/play/character-tactics/index.html` が生成される

- [ ] **Step 7: コミット**

```bash
git add wrangler.toml .github/workflows/deploy.yml README.md
git commit -m "chore: add wrangler config, deploy workflow and README"
```

---

### Task 19: ankardo カタログへの登録内容と手動手順

**Files:**
- Create: `docs/ankardo-registration.md`

**Interfaces:**
- Consumes: 設計書 10 章
- Produces: ankardo リポジトリ側で行う作業の手順書

ankardo は別リポジトリなので、このリポジトリからは**変更しない**。登録内容と手順をドキュメントとして残し、実施は別 PR で行う。

- [ ] **Step 1: 手順書を書く**

`docs/ankardo-registration.md`:

```markdown
# ankardo への登録手順

このゲームを `ankardo.com/play/character-tactics/` で公開するために、
ankardo リポジトリ側と GitHub 側で必要な作業をまとめる。
ankardo の `.claude/skills/new-game/SKILL.md` に対応する。

## 1. ankardo リポジトリに追加するファイル（別 PR）

`site/content/games/character-tactics.json`:

```json
{
  "slug": "character-tactics",
  "title": "とりでの なかまたち",
  "description": "4人のなかまを動かして、島のとりでを守るシミュレーションゲーム。",
  "playUrl": "/play/character-tactics/",
  "genre": "simulation",
  "ageRange": "6〜10歳",
  "players": "ひとり用",
  "difficulty": "ふつう"
}
```

`site/lib/games.ts` の `getAllGames()` がこのディレクトリを自動で拾うので、コード変更は不要。
ただし必須フィールドが欠けていたり `genre` が `site/lib/genres.ts` の `GENRES` のキーでない場合、
`next build` がビルド時検証で失敗する。`simulation` は定義済みのキー。

## 2. 人手が必要な作業

エージェントは実行しない。Cloudflare 認証情報を持つ担当者が行う。

- [ ] このリポジトリの GitHub Secrets を設定する

  ```bash
  CLOUDFLARE_API_TOKEN=... CLOUDFLARE_ACCOUNT_ID=... \
    ankardo/scripts/setup-game-secrets.sh akabee0161/character-tactics
  ```

  `gh auth login` 済みで、対象リポジトリへの admin 権限が必要。

- [ ] このリポジトリに `production` environment の保護ルールを設定する（必須レビュアー、`main` ブランチのみ許可）
- [ ] 初回の `wrangler deploy` を承認して実行する
- [ ] ankardo 側の `site/` を再ビルド・デプロイし、カタログ一覧と詳細ページに反映されたことを確認する
- [ ] `https://ankardo.com/play/character-tactics/` を実機（PC とスマホ横持ち）で開いて動作を確認する
```

- [ ] **Step 2: コミット**

```bash
git add docs/ankardo-registration.md
git commit -m "docs: add ankardo catalog registration steps"
```

---

## 実装後の全体確認

すべてのタスクが終わったら、以下を通しで確認する。

- [ ] `npm test` — 全テストが PASS
- [ ] `npx tsc --noEmit` — 型エラーなし
- [ ] `npm run build` — `out/play/character-tactics/index.html` が生成される
- [ ] `src/core/**` と `src/content/**` に `window` / `document` / `localStorage` の参照がないこと

  Run: `grep -rn "window\.\|document\.\|localStorage" src/core src/content`
  Expected: 何も出力されない

- [ ] ゲーム内テキストに漢字が含まれないこと

  Run: `grep -rnP "[\x{4e00}-\x{9fff}]" src/content/lines.ts src/content/characters.ts src/content/enemies.ts src/ui/screens.ts`
  Expected: 何も出力されない（コメント行に漢字がある場合はコメントを除いて確認する）

- [ ] Task 17 Step 5 の手動確認 14 項目がすべて通ること
