# フィールド上のユニットのアニメーション 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** フィールド上のユニットを、3状態（待機・歩行・攻撃）× 4方向のスプライトシートで動かす。仮アセットも同梱して、絵が入った状態で遊べるようにする。

**Architecture:** `sprites.map` を「ファイル名の文字列」から `MapSheet` オブジェクトへ広げる。アニメの状態計算は DOM に触らない純粋モジュール `src/render/anim.ts` に閉じ込め、`battle.time`（シム時刻）だけを時計として使う。描画側は「どのコマを描くか」を `frameFor` に聞き、`drawMapUnit` の中で1回だけ画像とプレースホルダを分岐する。`core` への変更は `attack` イベントの純粋な追加1点のみ。

**Tech Stack:** TypeScript 5.6 / Vite 5.4 / Vitest 2.1 / Canvas2D。実行時の依存パッケージなし。仮アセットの生成は Node 標準の `zlib` だけで書く。

**Spec:** `docs/superpowers/specs/2026-09-06-map-sprite-animation-design.md`

## Global Constraints

- Node.js 22 以上。`npm test` は `vitest run`、`npm run build` は `tsc --noEmit && vite build`
- シートの並びは **行 = 状態index × 4 + 方向index**。状態は `idle, walk, attack` の順、方向は `down, up, left, right` の順。全12行
- 列数はシート全体で最大フレーム数にそろえる。余った右側は透明のまま置く
- **フレームは正方形**。`frame` はその一辺の px
- `src/core/**` と `src/engine/**` は `window` / `document` / `localStorage` を参照しない
- `src/engine/**` は `src/core/**` を知らない（逆に `src/render/**` が `src/engine/**` を参照するのは既存のとおり可）
- **描画コード（Canvas2D）にユニットテストを書かない。** テストは純ロジックに寄せ、見た目は README の CDP 手順で目視する
- アニメの時計は壁時計ではなく `battle.time`
- 画面に出す文字は総ひらがな（漢字を使わない）。**テスト名・コミットメッセージ・コメントには適用しない**（テスト名は既存ファイルの書き方に合わせる）
- コミットは Conventional Commits（`feat:` / `fix:` / `refactor:` / `test:` / `docs:` / `chore:`）+ 通常の日本語（漢字仮名交じり）の要約
- 各タスクの最後に `npm test` と `npm run build` の両方を通してからコミットする
- ブランチは `feat/map-sprite-animation`（spec のコミット 2c4065b が先頭）

---

## ファイル構成

| ファイル | 責務 | 変更 |
|---|---|---|
| `src/engine/schema.ts` | JSON の検証。`MapSheet` の定義もここ | 変更（Task 1） |
| `src/engine/registry.ts` | 索引と相互参照の検証 | 変更（Task 2） |
| `src/core/types.ts` | `SimEvent` の定義 | 変更（Task 3） |
| `src/core/sim.ts` | 1 tick の進行。`attack` イベントの発火 | 変更（Task 3） |
| `src/render/anim.ts` | **新規**。向き・状態・コマ番号の計算（DOM に触らない） | 新規（Task 4, 5） |
| `src/render/sprites.ts` | 画像とプレースホルダの分岐。描画サイズの唯一の定義 | 変更（Task 6） |
| `src/render/draw.ts` | 戦場の描画 | 変更（Task 7） |
| `src/main.ts` | アニメ状態の保持と配線 | 変更（Task 7） |
| `tools/gen-placeholder-sprites.mjs` | **新規**。仮アセットの生成器。本番の絵が揃ったら消す | 新規（Task 8） |
| `assets/images/*.png` | 仮アセット（シート7枚・顔7枚・クラス5枚） | 新規（Task 8） |
| `assets/units/*.json`, `assets/enemies/*.json` | ユニット定義。`sprites` にシートを書く | 変更（Task 9） |
| `src/engine/sheet-size.test.ts` | **新規**。PNG の実寸と JSON の突き合わせ | 新規（Task 9） |
| `README.md`, `assets/images/README.txt` | 正典。シート規約と差し替え手順 | 変更（Task 10） |

---

## Task 1: schema に MapSheet を入れる

**Files:**
- Modify: `src/engine/schema.ts`
- Test: `src/engine/schema.test.ts`

**Interfaces:**
- Consumes: なし（最初のタスク）
- Produces: `export type MapAnim = { frames: number; fps: number }`、`export type MapSheet = { sheet: string; frame: number; idle: MapAnim; walk: MapAnim; attack: MapAnim }`、`export type Sprites = { role: string | null; face: string | null; map: MapSheet | null }`。以降のすべてのタスクがこの3つを前提にする

- [ ] **Step 1: 失敗するテストを書く**

`src/engine/schema.test.ts` の `describe('sprites ...')` のあたりに足す。`VALID_UNIT` は同ファイルの既存の定数。

```ts
const SHEET = {
  sheet: 'roran-map.png', frame: 32,
  idle: { frames: 2, fps: 4 },
  walk: { frames: 4, fps: 8 },
  attack: { frames: 3, fps: 12 },
};

describe('sprites.map の シート', () => {
  it('シートを かくと そのまま よめる', () => {
    const r = validateUnitDef('assets/units/roran.json', { ...VALID_UNIT, sprites: { map: SHEET } });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.sprites.map).toEqual(SHEET);
  });

  it('null なら null の まま', () => {
    const r = validateUnitDef('assets/units/roran.json', { ...VALID_UNIT, sprites: { map: null } });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.sprites.map).toBe(null);
  });

  it('もじれつは うけつけない', () => {
    const r = validateUnitDef('assets/units/roran.json', { ...VALID_UNIT, sprites: { map: 'roran.png' } });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.errors[0]?.path).toBe('sprites.map');
  });

  it('frames が 0 なら エラー', () => {
    const r = validateUnitDef('assets/units/roran.json', {
      ...VALID_UNIT, sprites: { map: { ...SHEET, walk: { frames: 0, fps: 8 } } },
    });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.errors.some((e) => e.path === 'sprites.map.walk.frames')).toBe(true);
  });

  it('frame が かけていると エラー', () => {
    const { frame, ...noFrame } = SHEET;
    const r = validateUnitDef('assets/units/roran.json', { ...VALID_UNIT, sprites: { map: noFrame } });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.errors.some((e) => e.path === 'sprites.map.frame')).toBe(true);
  });
});
```

- [ ] **Step 2: テストが落ちることを確かめる**

Run: `npx vitest run src/engine/schema.test.ts`
Expected: FAIL。`sprites.map` が文字列型のままなので「シートを かくと そのまま よめる」で `sprites.map` が `null` になる、または型エラーになる

- [ ] **Step 3: schema.ts を書き換える**

`src/engine/schema.ts` の `Sprites` / `NO_SPRITES` / `readSprites` を、まるごと次に置き換える。

```ts
/** フィールド用スプライトシートの1状態ぶん */
export type MapAnim = { frames: number; fps: number };

/**
 * フィールド用スプライトシート。行 = 状態index × 4 + 方向index の 12 行。
 * 状態は idle, walk, attack の順、方向は down, up, left, right の順
 */
export type MapSheet = {
  /** assets/images 内のファイル名 */
  sheet: string;
  /** 1フレームの一辺。正方形 */
  frame: number;
  idle: MapAnim;
  walk: MapAnim;
  attack: MapAnim;
};

/** ユニットの絵。role と face は静止画のまま。map だけがシート */
export type Sprites = { role: string | null; face: string | null; map: MapSheet | null };

const NO_SPRITES: Sprites = { role: null, face: null, map: null };

function readMapAnim(ctx: Ctx, path: string, v: unknown): MapAnim | null {
  const o = requireObject(ctx, path, v);
  if (!o) return null;
  const frames = requireNumber(ctx, `${path}.frames`, o.frames, { min: 1, int: true });
  // 1fps 未満は 1コマが 1秒より長い。実用しないので下限を 1 にする
  const fps = requireNumber(ctx, `${path}.fps`, o.fps, { min: 1 });
  if (frames === null || fps === null) return null;
  return { frames, fps };
}

function readMapSheet(ctx: Ctx, v: unknown): MapSheet | null {
  if (v === undefined || v === null) return null;
  const o = requireObject(ctx, 'sprites.map', v);
  if (!o) return null;
  const sheet = requireString(ctx, 'sprites.map.sheet', o.sheet);
  const frame = requireNumber(ctx, 'sprites.map.frame', o.frame, { min: 1, int: true });
  const idle = readMapAnim(ctx, 'sprites.map.idle', o.idle);
  const walk = readMapAnim(ctx, 'sprites.map.walk', o.walk);
  const attack = readMapAnim(ctx, 'sprites.map.attack', o.attack);
  if (sheet === null || frame === null || idle === null || walk === null || attack === null) return null;
  return { sheet, frame, idle, walk, attack };
}

function readSprites(ctx: Ctx, v: unknown): Sprites {
  if (v === undefined) return { ...NO_SPRITES };
  const o = requireObject(ctx, 'sprites', v);
  if (!o) return { ...NO_SPRITES };
  const name = (key: 'role' | 'face'): string | null => {
    const raw = o[key];
    if (raw === undefined || raw === null) return null;
    return requireString(ctx, `sprites.${key}`, raw);
  };
  return { role: name('role'), face: name('face'), map: readMapSheet(ctx, o.map) };
}
```

- [ ] **Step 4: テストが通ることを確かめる**

Run: `npx vitest run src/engine/schema.test.ts`
Expected: PASS

- [ ] **Step 5: 型エラーが出ていないか確かめる**

Run: `npm test && npm run build`
Expected: どちらも成功。`draw.ts` の `FALLBACK_DEF` は `map: null` なので通る。もし `registry.test.ts` の `withSprite` で型エラーが出たら、引数の型を `Record<string, string | null>` から `Record<string, unknown>` に広げる（Task 2 でも使う）

- [ ] **Step 6: コミット**

```bash
git add src/engine/schema.ts src/engine/schema.test.ts src/engine/registry.test.ts
git commit -m "feat: sprites.map をスプライトシート定義に広げる"
```

---

## Task 2: registry で sheet の実在を検証する

**Files:**
- Modify: `src/engine/registry.ts`（`checkSprites`）
- Test: `src/engine/registry.test.ts`

**Interfaces:**
- Consumes: Task 1 の `Sprites` / `MapSheet`
- Produces: `sprites.map.sheet` が `assets/images/` に無いとき、`path: 'sprites.map.sheet'` の `ValidationError` が出る

- [ ] **Step 1: 失敗するテストを書く**

`src/engine/registry.test.ts` の `describe('sprites の ファイルの そんざい', ...)` の中に足す。`withSprite` の引数型が `Record<string, string | null>` のままなら `Record<string, unknown>` に広げること。

```ts
  const SHEET = {
    sheet: 'roran-map.png', frame: 32,
    idle: { frames: 2, fps: 4 }, walk: { frames: 4, fps: 8 }, attack: { frames: 3, fps: 12 },
  };

  it('ある シートなら とおる', () => {
    const r = buildRegistry(withSprite({ map: SHEET }), KNOWN_SKILLS, ['roran-map.png']);
    expect(r.ok).toBe(true);
  });

  it('ない シートは エラーに なる', () => {
    const r = buildRegistry(withSprite({ map: { ...SHEET, sheet: 'nai.png' } }), KNOWN_SKILLS, ['roran-map.png']);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.errors[0]?.path).toBe('sprites.map.sheet');
    expect(r.errors[0]?.reason).toContain('nai.png');
  });
```

- [ ] **Step 2: テストが落ちることを確かめる**

Run: `npx vitest run src/engine/registry.test.ts`
Expected: FAIL。「ない シートは エラーに なる」で `r.ok` が `true` のまま（`checkSprites` が `map` を文字列として見ていて、オブジェクトを素通しする）

- [ ] **Step 3: checkSprites を書き換える**

`src/engine/registry.ts` の `checkSprites` を置き換える。

```ts
  const images = new Set(imageNames);
  const checkSprites = (file: string, sprites: Sprites): void => {
    for (const key of ['role', 'face'] as const) {
      const name = sprites[key];
      if (name !== null && !images.has(name)) {
        errors.push({ file, path: `sprites.${key}`, reason: `assets/images/ に ない ファイル: ${name}` });
      }
    }
    // シートの実寸（frame と行数の整合）は起動時には見られない。images.ts は
    // 読み込みを待たない方針なので、この時点では幅も高さも分からない。
    // 実寸は src/engine/sheet-size.test.ts が見る
    const sheet = sprites.map?.sheet;
    if (sheet !== undefined && !images.has(sheet)) {
      errors.push({ file, path: 'sprites.map.sheet', reason: `assets/images/ に ない ファイル: ${sheet}` });
    }
  };
```

- [ ] **Step 4: テストが通ることを確かめる**

Run: `npm test && npm run build`
Expected: どちらも成功

- [ ] **Step 5: コミット**

```bash
git add src/engine/registry.ts src/engine/registry.test.ts
git commit -m "feat: シートのファイル名が実在するかを起動時に検証する"
```

---

## Task 3: core に attack イベントを足す

**Files:**
- Modify: `src/core/types.ts`（`SimEvent`）
- Modify: `src/core/sim.ts`（`resolveAttacks`）
- Test: `src/core/sim-combat.test.ts`

**Interfaces:**
- Consumes: なし
- Produces: `SimEvent` に `{ type: 'attack'; uid: string; defId: string; pos: Vec2; targetPos: Vec2 }` が加わる。通常攻撃1回につき1件、近接でも飛翔体でも出る。必殺技では出ない

- [ ] **Step 1: 失敗するテストを書く**

`src/core/sim-combat.test.ts` の末尾に足す。同ファイルの既存のヘルパ（`fresh` / `unitOf` / `spawnEnemy` / `engageAndAttack`）をそのまま使う。`step` は毎回 `state.events = []` から始めるので、`engageAndAttack` のあとに残っているのは2回目の `step` のぶんだけになる。

```ts
describe('attack イベント', () => {
  it('きんせつの こうげきの たびに でる', () => {
    const s = fresh();
    const roran = unitOf(s, 'roran');
    roran.pos = { x: 100, y: 100 };
    spawnEnemy(s, 'narazumono', { x: 110, y: 100 });
    engageAndAttack(s);

    // てきも おなじ tick で こうげきするので、uid で しぼる
    const attacks = s.events.filter((e) => e.type === 'attack' && e.uid === roran.uid);
    expect(attacks.length).toBe(1);
    const ev = attacks[0]!;
    if (ev.type !== 'attack') return;
    expect(ev.uid).toBe(roran.uid);
    expect(ev.defId).toBe('roran');
    // てきは みぎに いるので、むきは みぎむきに なる
    expect(ev.targetPos.x).toBeGreaterThan(ev.pos.x);
  });

  it('とおくの てきに うつ ゆみでも でる', () => {
    const s = fresh();
    const ines = unitOf(s, 'ines');
    ines.pos = { x: 100, y: 100 };
    spawnEnemy(s, 'narazumono', { x: 200, y: 100 });
    engageAndAttack(s, 2.4);

    expect(s.events.some((e) => e.type === 'attack' && e.uid === ines.uid)).toBe(true);
  });
});
```

- [ ] **Step 2: テストが落ちることを確かめる**

Run: `npx vitest run src/core/sim-combat.test.ts`
Expected: FAIL。`'attack'` が `SimEvent` の型に無いので型エラー、または「attack イベントが 1けんも でなかった」

- [ ] **Step 3: SimEvent に足す**

`src/core/types.ts` の `SimEvent` に1行足す（`engage` の次あたり）。

```ts
  | { type: 'attack'; uid: string; defId: string; pos: Vec2; targetPos: Vec2 }
```

- [ ] **Step 4: sim.ts で発火させる**

`src/core/sim.ts` の `resolveAttacks` の中、`u.attackCooldown = interval;` の直後に足す。近接と飛翔体の分岐より手前なので、両方が1回ずつ通る。

```ts
    u.attackCooldown = interval;

    // 攻撃モーションの起点。近接も飛翔体もここを通る。必殺技は出さない
    state.events.push({
      type: 'attack', uid: u.uid, defId: u.defId,
      pos: { ...u.pos }, targetPos: { ...target.pos },
    });

    if (u.attack === 'melee') applyDamage(state, source, target);
    else spawnProjectile(state, source, target);
```

- [ ] **Step 5: テストが通ることを確かめる**

Run: `npm test && npm run build`
Expected: どちらも成功。既存のイベント数を数えているテストが落ちたら、それは `attack` が増えたぶんなので、そのテストの期待値を直す（挙動が変わったわけではない）

- [ ] **Step 6: コミット**

```bash
git add src/core/types.ts src/core/sim.ts src/core/sim-combat.test.ts
git commit -m "feat: 通常攻撃のたびに attack イベントを出す"
```

---

## Task 4: anim.ts の骨格（向きとコマ番号）

**Files:**
- Create: `src/render/anim.ts`
- Test: `src/render/anim.test.ts`（新規）

**Interfaces:**
- Consumes: Task 1 の `MapSheet`
- Produces: `Dir`, `AnimState`, `AnimFrame`, `AnimEntry`, `AnimStore`, `DIRS`, `STATES`, `STILL`, `WALK_HOLD`, `makeAnimStore()`, `resetAnim(store)`, `dirOf(dx, dy)`, `frameOf(state, dir, sheet, elapsed)`。Task 5 がこの上に store の更新を足す

- [ ] **Step 1: 失敗するテストを書く**

`src/render/anim.test.ts` を新規作成する。

```ts
import { describe, expect, it } from 'vitest';
import { DIRS, STATES, STILL, dirOf, frameOf, makeAnimStore, resetAnim } from './anim';
import type { MapSheet } from '../engine/schema';

const SHEET: MapSheet = {
  sheet: 'roran-map.png', frame: 32,
  idle: { frames: 2, fps: 4 }, walk: { frames: 4, fps: 8 }, attack: { frames: 3, fps: 12 },
};

describe('ならびの きやく', () => {
  it('ほうこうは down, up, left, right の じゅん', () => {
    expect(DIRS).toEqual(['down', 'up', 'left', 'right']);
  });

  it('じょうたいは idle, walk, attack の じゅん', () => {
    expect(STATES).toEqual(['idle', 'walk', 'attack']);
  });

  it('STILL は 0ぎょう 0れつ', () => {
    expect(STILL).toEqual({ row: 0, col: 0 });
  });
});

describe('dirOf', () => {
  it('ゆうせいな じくで きめる', () => {
    expect(dirOf(10, 1)).toBe('right');
    expect(dirOf(-10, 1)).toBe('left');
    expect(dirOf(1, 10)).toBe('down');
    expect(dirOf(1, -10)).toBe('up');
  });

  it('たてよこが おなじなら たてを とる', () => {
    expect(dirOf(5, 5)).toBe('down');
    expect(dirOf(5, -5)).toBe('up');
  });

  it('うごいていなければ null', () => {
    expect(dirOf(0, 0)).toBe(null);
    expect(dirOf(0.001, -0.001)).toBe(null);
  });
});

describe('frameOf', () => {
  it('ぎょうは じょうたいindex × 4 + ほうこうindex', () => {
    expect(frameOf('idle', 'down', SHEET, 0).row).toBe(0);
    expect(frameOf('idle', 'right', SHEET, 0).row).toBe(3);
    expect(frameOf('walk', 'down', SHEET, 0).row).toBe(4);
    expect(frameOf('attack', 'right', SHEET, 0).row).toBe(11);
  });

  it('idle と walk は ループする', () => {
    // idle は 2コマ・4fps なので 0.25びょうで 1コマ すすむ
    expect(frameOf('idle', 'down', SHEET, 0).col).toBe(0);
    expect(frameOf('idle', 'down', SHEET, 0.26).col).toBe(1);
    expect(frameOf('idle', 'down', SHEET, 0.51).col).toBe(0);
    // walk は 4コマ・8fps
    expect(frameOf('walk', 'up', SHEET, 0.38).col).toBe(3);
    expect(frameOf('walk', 'up', SHEET, 0.51).col).toBe(0);
  });

  it('attack は さいごの コマで とまる', () => {
    // attack は 3コマ・12fps なので 0.25びょうで おわる
    expect(frameOf('attack', 'left', SHEET, 0).col).toBe(0);
    expect(frameOf('attack', 'left', SHEET, 0.09).col).toBe(1);
    expect(frameOf('attack', 'left', SHEET, 0.2).col).toBe(2);
    expect(frameOf('attack', 'left', SHEET, 10).col).toBe(2);
  });

  it('けいかじかんが マイナスでも 0コマめに おちる', () => {
    expect(frameOf('walk', 'down', SHEET, -1).col).toBe(0);
  });
});

describe('AnimStore', () => {
  it('つくった ときは からっぽ', () => {
    expect(makeAnimStore().byUid.size).toBe(0);
  });

  it('reset で からに なる', () => {
    const store = makeAnimStore();
    store.byUid.set('u1', {
      dir: 'up', lastPos: { x: 0, y: 0 }, movingUntil: 1, attackUntil: 0, attackFrom: 0,
    });
    resetAnim(store);
    expect(store.byUid.size).toBe(0);
  });
});
```

- [ ] **Step 2: テストが落ちることを確かめる**

Run: `npx vitest run src/render/anim.test.ts`
Expected: FAIL。`./anim` が存在しない

- [ ] **Step 3: anim.ts を書く**

`src/render/anim.ts` を新規作成する。

```ts
import type { MapSheet } from '../engine/schema';
import type { Vec2 } from '../core/types';

export type Dir = 'down' | 'up' | 'left' | 'right';
export type AnimState = 'idle' | 'walk' | 'attack';
export type AnimFrame = { row: number; col: number };

/** 行の並びの規約。シートの 12 行はこの順で並ぶ */
export const DIRS: readonly Dir[] = ['down', 'up', 'left', 'right'];
export const STATES: readonly AnimState[] = ['idle', 'walk', 'attack'];

/** アニメ状態を持たない相手（ドラッグ中の残像など）に使う静止コマ */
export const STILL: AnimFrame = { row: 0, col: 0 };

/**
 * 歩行と判定する時間を伸ばす幅。シムは 1/60 の固定ステップ、描画は rAF なので、
 * 120Hz 端末では描画2回につきシム1回になり、差分ゼロのフレームが必ず出る。
 * 素直に差分だけで判定すると歩行と待機がちらつく
 */
export const WALK_HOLD = 0.12;

/** これ以下の移動は止まっているとみなす */
const MOVE_EPS = 0.01;

export type AnimEntry = {
  dir: Dir;
  lastPos: Vec2;
  movingUntil: number;
  attackUntil: number;
  attackFrom: number;
};

export type AnimStore = { byUid: Map<string, AnimEntry> };

export function makeAnimStore(): AnimStore {
  return { byUid: new Map() };
}

/** ステージ跨ぎで捨てる。uid は使い回されうるので持ち越さない */
export function resetAnim(store: AnimStore): void {
  store.byUid.clear();
}

/** 優勢な軸で4方向に丸める。動いていなければ null。y は下向きが正 */
export function dirOf(dx: number, dy: number): Dir | null {
  if (Math.abs(dx) < MOVE_EPS && Math.abs(dy) < MOVE_EPS) return null;
  if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? 'right' : 'left';
  return dy > 0 ? 'down' : 'up';
}

/**
 * 行 = 状態index × 4 + 方向index。列は経過時間から。
 * idle と walk はループし、attack だけは最終コマでクランプする
 */
export function frameOf(state: AnimState, dir: Dir, sheet: MapSheet, elapsed: number): AnimFrame {
  const row = STATES.indexOf(state) * 4 + DIRS.indexOf(dir);
  const anim = sheet[state];
  const i = Math.floor(Math.max(0, elapsed) * anim.fps);
  const col = state === 'attack' ? Math.min(i, anim.frames - 1) : i % anim.frames;
  return { row, col };
}
```

- [ ] **Step 4: テストが通ることを確かめる**

Run: `npm test && npm run build`
Expected: どちらも成功

- [ ] **Step 5: コミット**

```bash
git add src/render/anim.ts src/render/anim.test.ts
git commit -m "feat: スプライトシートの向きとコマ番号を計算する anim を足す"
```

---

## Task 5: anim.ts の状態更新

**Files:**
- Modify: `src/render/anim.ts`
- Test: `src/render/anim.test.ts`

**Interfaces:**
- Consumes: Task 3 の `attack` イベント、Task 4 の `AnimStore` / `dirOf` / `frameOf`
- Produces: `AnimUnit`, `noteAttacks(store, events, now, durationOf)`, `updateMotion(store, units, now)`, `stateOf(store, uid, now)`, `frameFor(store, uid, sheet, now)`。描画側が呼ぶのは `frameFor` 1本

- [ ] **Step 1: 失敗するテストを書く**

`src/render/anim.test.ts` の末尾に足す。先頭の import に `WALK_HOLD`, `frameFor`, `noteAttacks`, `stateOf`, `updateMotion` を、型の import に `AnimUnit` を足すこと。あわせて `import type { SimEvent, Vec2 } from '../core/types';` を足す。

```ts
const ATTACK_DUR = SHEET.attack.frames / SHEET.attack.fps; // 0.25

function ally(uid: string, x: number, y: number): AnimUnit {
  return { uid, pos: { x, y }, side: 'player' };
}

function attackEvent(uid: string, from: Vec2, to: Vec2): SimEvent {
  return { type: 'attack', uid, defId: 'roran', pos: from, targetPos: to };
}

describe('updateMotion', () => {
  it('うごいたら walk に なる', () => {
    const store = makeAnimStore();
    updateMotion(store, [ally('u1', 0, 100)], 0);
    expect(stateOf(store, 'u1', 0)).toBe('idle');

    updateMotion(store, [ally('u1', 0, 90)], 0.1);
    expect(stateOf(store, 'u1', 0.1)).toBe('walk');
    expect(store.byUid.get('u1')?.dir).toBe('up');
  });

  it('さぶんゼロの フレームが はさまっても walk の まま', () => {
    const store = makeAnimStore();
    updateMotion(store, [ally('u1', 0, 100)], 0);
    updateMotion(store, [ally('u1', 0, 90)], 0.1);
    // うごいていない フレーム。WALK_HOLD の うちは walk の まま
    updateMotion(store, [ally('u1', 0, 90)], 0.1 + WALK_HOLD / 2);
    expect(stateOf(store, 'u1', 0.1 + WALK_HOLD / 2)).toBe('walk');
  });

  it('WALK_HOLD を すぎたら idle に もどる', () => {
    const store = makeAnimStore();
    updateMotion(store, [ally('u1', 0, 100)], 0);
    updateMotion(store, [ally('u1', 0, 90)], 0.1);
    const after = 0.1 + WALK_HOLD + 0.01;
    updateMotion(store, [ally('u1', 0, 90)], after);
    expect(stateOf(store, 'u1', after)).toBe('idle');
  });

  it('いなくなった uid は きえる', () => {
    const store = makeAnimStore();
    updateMotion(store, [ally('u1', 0, 100), ally('u2', 0, 100)], 0);
    expect(store.byUid.size).toBe(2);
    updateMotion(store, [ally('u1', 0, 100)], 0.1);
    expect(store.byUid.has('u2')).toBe(false);
  });

  it('てきの はじめの むきは down', () => {
    const store = makeAnimStore();
    updateMotion(store, [{ uid: 'e1', pos: { x: 0, y: 0 }, side: 'enemy' }], 0);
    expect(store.byUid.get('e1')?.dir).toBe('down');
  });
});

describe('noteAttacks', () => {
  const durationOf = (): number | null => ATTACK_DUR;

  it('こうげきの むきに なり attack に なる', () => {
    const store = makeAnimStore();
    updateMotion(store, [ally('u1', 100, 100)], 0);
    noteAttacks(store, [attackEvent('u1', { x: 100, y: 100 }, { x: 140, y: 100 })], 1, durationOf);

    expect(stateOf(store, 'u1', 1)).toBe('attack');
    expect(store.byUid.get('u1')?.dir).toBe('right');
  });

  it('こうげきちゅうは うごいても むきが かわらない', () => {
    const store = makeAnimStore();
    updateMotion(store, [ally('u1', 100, 100)], 0);
    noteAttacks(store, [attackEvent('u1', { x: 100, y: 100 }, { x: 140, y: 100 })], 1, durationOf);
    // みぎを むいたまま うえへ あるく
    updateMotion(store, [ally('u1', 100, 80)], 1.1);

    expect(store.byUid.get('u1')?.dir).toBe('right');
    expect(stateOf(store, 'u1', 1.1)).toBe('attack');
  });

  it('こうげきが おわれば walk に もどる', () => {
    const store = makeAnimStore();
    updateMotion(store, [ally('u1', 100, 100)], 0);
    noteAttacks(store, [attackEvent('u1', { x: 100, y: 100 }, { x: 140, y: 100 })], 1, durationOf);
    const after = 1 + ATTACK_DUR + 0.01;
    updateMotion(store, [ally('u1', 100, 80)], after);

    expect(stateOf(store, 'u1', after)).toBe('walk');
    expect(store.byUid.get('u1')?.dir).toBe('up');
  });

  it('シートの ない ユニットは attack に ならない', () => {
    const store = makeAnimStore();
    updateMotion(store, [ally('u1', 100, 100)], 0);
    noteAttacks(store, [attackEvent('u1', { x: 100, y: 100 }, { x: 140, y: 100 })], 1, () => null);

    expect(stateOf(store, 'u1', 1)).toBe('idle');
    // むきだけは かわる
    expect(store.byUid.get('u1')?.dir).toBe('right');
  });
});

describe('frameFor', () => {
  it('しらない uid は STILL', () => {
    expect(frameFor(makeAnimStore(), 'u1', SHEET, 5)).toEqual(STILL);
  });

  it('attack の れつは こうげきを だした ときからの けいかじかんで きまる', () => {
    const store = makeAnimStore();
    updateMotion(store, [ally('u1', 100, 100)], 0);
    noteAttacks(store, [attackEvent('u1', { x: 100, y: 100 }, { x: 140, y: 100 })], 10, () => ATTACK_DUR);

    // attack / right は 11ぎょうめ。10.0 が 0コマめ、10.09 が 1コマめ
    expect(frameFor(store, 'u1', SHEET, 10)).toEqual({ row: 11, col: 0 });
    expect(frameFor(store, 'u1', SHEET, 10.09)).toEqual({ row: 11, col: 1 });
  });
});
```

- [ ] **Step 2: テストが落ちることを確かめる**

Run: `npx vitest run src/render/anim.test.ts`
Expected: FAIL。`noteAttacks` などが `./anim` から export されていない

- [ ] **Step 3: anim.ts に足す**

`src/render/anim.ts` の末尾に足す。先頭の import に `SimEvent` を型として足すこと（`import type { SimEvent, Vec2 } from '../core/types';`）。

```ts
/** updateMotion が必要とするぶんだけ。core の Unit がそのまま通る */
export type AnimUnit = { uid: string; pos: Vec2; side: 'player' | 'enemy' };

function entryFor(store: AnimStore, uid: string, pos: Vec2, initialDir: Dir): AnimEntry {
  const found = store.byUid.get(uid);
  if (found) return found;
  const made: AnimEntry = {
    dir: initialDir, lastPos: { ...pos }, movingUntil: 0, attackUntil: 0, attackFrom: 0,
  };
  store.byUid.set(uid, made);
  return made;
}

/**
 * 前フレームとの位置の差から歩行と向きを決める。
 * 攻撃中は向きを固定する（歩きながら撃つので、移動由来の向きと競合する）
 */
export function updateMotion(store: AnimStore, units: readonly AnimUnit[], now: number): void {
  const seen = new Set<string>();
  for (const u of units) {
    seen.add(u.uid);
    // 味方は上へ、敵は下へ攻めるので、動き出す前の向きはそちらに向けておく
    const e = entryFor(store, u.uid, u.pos, u.side === 'player' ? 'up' : 'down');
    const d = dirOf(u.pos.x - e.lastPos.x, u.pos.y - e.lastPos.y);
    if (d !== null) {
      e.movingUntil = now + WALK_HOLD;
      if (now >= e.attackUntil) e.dir = d;
    }
    e.lastPos = { ...u.pos };
  }
  for (const uid of store.byUid.keys()) {
    if (!seen.has(uid)) store.byUid.delete(uid);
  }
}

/**
 * attack イベントから攻撃モーションを立てる。
 * durationOf はそのユニットの attack.frames / attack.fps を返す。
 * シートを持たないユニットには null を返し、その場合は向きだけ更新する
 */
export function noteAttacks(
  store: AnimStore,
  events: readonly SimEvent[],
  now: number,
  durationOf: (defId: string) => number | null,
): void {
  for (const ev of events) {
    if (ev.type !== 'attack') continue;
    const e = entryFor(store, ev.uid, ev.pos, 'down');
    const d = dirOf(ev.targetPos.x - ev.pos.x, ev.targetPos.y - ev.pos.y);
    if (d !== null) e.dir = d;
    const dur = durationOf(ev.defId);
    if (dur === null || dur <= 0) continue;
    e.attackFrom = now;
    e.attackUntil = now + dur;
  }
}

export function stateOf(store: AnimStore, uid: string, now: number): AnimState {
  const e = store.byUid.get(uid);
  if (!e) return 'idle';
  if (now < e.attackUntil) return 'attack';
  if (now < e.movingUntil) return 'walk';
  return 'idle';
}

/** 描画側が呼ぶのはこれ1本。now は battle.time（シム時刻） */
export function frameFor(store: AnimStore, uid: string, sheet: MapSheet, now: number): AnimFrame {
  const e = store.byUid.get(uid);
  if (!e) return STILL;
  const state = stateOf(store, uid, now);
  const elapsed = state === 'attack' ? now - e.attackFrom : now;
  return frameOf(state, e.dir, sheet, elapsed);
}
```

- [ ] **Step 4: テストが通ることを確かめる**

Run: `npm test && npm run build`
Expected: どちらも成功

- [ ] **Step 5: コミット**

```bash
git add src/render/anim.ts src/render/anim.test.ts
git commit -m "feat: 移動と攻撃からアニメの状態と向きを決める"
```

---

## Task 6: sprites.ts をシート対応にする

**Files:**
- Modify: `src/render/sprites.ts`

**Interfaces:**
- Consumes: Task 1 の `MapSheet`、Task 4 の `AnimFrame`
- Produces: `drawMapUnit(ctx, center, radius, def, images, frame)`（第6引数 `frame: AnimFrame` が必須になる）、`drawHalf(def, fallback): number`

**テストなし。** 描画コードにユニットテストを書かない方針（CLAUDE.md）。見た目は Task 10 の CDP 目視で確かめる。

- [ ] **Step 1: sprites.ts を書き換える**

`src/render/sprites.ts` の import と `drawMapUnit` を置き換え、`drawHalf` を足す。`drawSquareOrCircle` は `drawFace` / `drawRoleBadge` がまだ使うので残す。

```ts
import { imageFor } from './images';
import type { ImageCache } from './images';
import type { AnimFrame } from './anim';
import type { Sprites } from '../engine/schema';
import type { Vec2 } from '../core/types';
import type { Rect } from '../ui/hit';
```

`drawMapUnit` を次に差し替える。

```ts
/**
 * シートがあるときの描画サイズは frame から決まる（等倍）。
 * radius は丸フォールバック専用で、シートがあるときは使わない
 */
export function drawMapUnit(
  ctx: CanvasRenderingContext2D, center: Vec2, radius: number,
  def: SpriteDef, images: ImageCache, frame: AnimFrame,
): void {
  const sheet = def.sprites.map;
  if (sheet === null) {
    circle(ctx, center, radius, def.color);
    return;
  }
  const img = imageFor(images, sheet.sheet);
  if (img === null) {
    circle(ctx, center, radius, def.color);
    return;
  }
  const s = sheet.frame;
  ctx.drawImage(
    img, frame.col * s, frame.row * s, s, s,
    Math.round(center.x - s / 2), Math.round(center.y - s / 2), s, s,
  );
}

/**
 * 実際に描く大きさの半分。HPバー・はた・リングの基準にする。
 * 画像の読み込み待ちでも同じ値を返す（読み終わった瞬間に位置が跳ねないように）
 */
export function drawHalf(def: SpriteDef, fallback: number): number {
  return def.sprites.map === null ? fallback : def.sprites.map.frame / 2;
}
```

- [ ] **Step 2: 型が通らないことを確かめる**

Run: `npm run build`
Expected: FAIL。`draw.ts` の `drawMapUnit` 呼び出し2箇所で引数が足りない（Task 7 で直す）

- [ ] **Step 3: 呼び出し側を最小限だけ直してコミットできる状態にする**

`src/render/draw.ts` の2箇所に `STILL` を渡して、いったんビルドを通す。Task 7 で本来のコマに差し替える。

```ts
// 先頭の import に足す
import { STILL } from './anim';
```

- `src/render/draw.ts:221` → `drawMapUnit(ctx, p, radius, defOf(reg, unit.defId), images, STILL);`
- `src/render/draw.ts:461` → `drawMapUnit(ctx, b, UNIT_R, { ...def, color }, images, STILL);`

- [ ] **Step 4: 通ることを確かめる**

Run: `npm test && npm run build`
Expected: どちらも成功。この時点ではまだシートを参照している JSON が無いので、見た目は今までどおり丸のまま

- [ ] **Step 5: コミット**

```bash
git add src/render/sprites.ts src/render/draw.ts
git commit -m "feat: drawMapUnit がスプライトシートの1コマを描けるようにする"
```

---

## Task 7: draw.ts と main.ts を配線する

**Files:**
- Modify: `src/render/draw.ts`
- Modify: `src/main.ts`

**Interfaces:**
- Consumes: Task 5 の `makeAnimStore` / `noteAttacks` / `resetAnim` / `updateMotion` / `frameFor` / `STILL`、Task 6 の `drawHalf`
- Produces: `drawBattle(ctx, reg, state, selected, effects, escorts, images, anim)`（第8引数 `anim: AnimStore` が増える）

**テストなし。** 描画コードにユニットテストを書かない方針。見た目は Task 10 の CDP 目視で確かめる。

- [ ] **Step 1: draw.ts の import と drawBattle の口を広げる**

```ts
// 先頭の import を差し替える（Task 6 で足した STILL の行を置き換える）
import { STILL, frameFor } from './anim';
import type { AnimStore } from './anim';
import { drawHalf, drawMapUnit } from './sprites';
```

`drawBattle` の引数の最後に `anim: AnimStore` を足し、`drawUnits(ctx, reg, state, selected, effects, images)` の呼び出しを `drawUnits(ctx, reg, state, selected, effects, images, anim)` にする。

- [ ] **Step 2: drawUnits を drawHalf 基準にする**

`drawUnits` の引数に `anim: AnimStore` を足したうえで、ループの中を次のようにする。`UNIT_R` を直接見ていた4箇所（はた・選択リング・ふんばりリング・ねらいうちリング）と `drawHpBar` の呼び出しを `half` に差し替えるのが要点。

```ts
    const def = defOf(reg, unit.defId);
    const radius = isAlly ? UNIT_R : enemyRadius(unit.maxHp);
    const sheet = def.sprites.map;
    const frame = sheet === null ? STILL : frameFor(anim, unit.uid, sheet, state.time);
    drawMapUnit(ctx, p, radius, def, images, frame);
    // 絵が入ると 22px から 32px になる。HPバーやリングはこの half を基準にする
    const half = drawHalf(def, radius);
```

差し替える箇所:

| 今 | あと |
|---|---|
| `ctx.fillRect(p.x + UNIT_R - 2, p.y - UNIT_R - 6, 2, 10)` | `ctx.fillRect(p.x + half - 2, p.y - half - 6, 2, 10)` |
| `ctx.fillRect(p.x + UNIT_R, p.y - UNIT_R - 6, 7, 5)` | `ctx.fillRect(p.x + half, p.y - half - 6, 7, 5)` |
| `ctx.arc(p.x, p.y, UNIT_R + 10, ...)`（選択リング） | `ctx.arc(p.x, p.y, half + 10, ...)` |
| `ctx.arc(p.x, p.y, UNIT_R + 4, ...)`（ふんばり） | `ctx.arc(p.x, p.y, half + 4, ...)` |
| `ctx.arc(p.x, p.y, UNIT_R + 7, ...)`（ねらいうち） | `ctx.arc(p.x, p.y, half + 7, ...)` |
| `drawHpBar(ctx, p, displayedHp / unit.maxHp, ...)` | `drawHpBar(ctx, p, half, displayedHp / unit.maxHp, ...)` |

`drawHpBar` の宣言も直す。

```ts
function drawHpBar(
  ctx: CanvasRenderingContext2D, p: Vec2, half: number, ratio: number, color: string,
): void {
  const w = 26;
  ctx.fillStyle = COLORS.hpBack;
  ctx.fillRect(p.x - w / 2, p.y - half - 9, w, 4);
  ctx.fillStyle = color;
  ctx.fillRect(p.x - w / 2, p.y - half - 9, w * Math.max(0, Math.min(1, ratio)), 4);
}
```

- [ ] **Step 3: 護衛の印も drawHalf 基準にする**

`drawEscortMarks` は `state.reg` を持っているので `defOf` が使える。ループの中を次にする。

```ts
    const p = mapToLogical(u.pos);
    const half = drawHalf(defOf(state.reg, u.defId), UNIT_R);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y - half - 14);
    ctx.lineTo(p.x - 6, p.y - half - 24);
    ctx.lineTo(p.x + 6, p.y - half - 24);
    ctx.closePath();
    ctx.fill();
```

- [ ] **Step 4: ドラッグの残像を直す**

`drawDragPreview` の末尾を次に差し替える。色の差し替え（`{ ...def, color }`）は画像に効かないので、残像は素の見た目のまま alpha 0.5 で描き、配置不可のときだけ赤いリングを重ねる。破線は今までどおり赤くなるので、赤の手がかりは二重に残る。

```ts
  ctx.globalAlpha = 0.5;
  drawMapUnit(ctx, b, UNIT_R, def, images, STILL);
  ctx.globalAlpha = 1;

  if (blocked) {
    const half = drawHalf(def, UNIT_R);
    ctx.strokeStyle = COLORS.hpEnemy;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(b.x, b.y, half + 3, 0, Math.PI * 2);
    ctx.stroke();
  }
```

`const color = blocked ? COLORS.hpEnemy : def.color;` は破線がまだ使うので残す。

- [ ] **Step 5: main.ts に AnimStore を持たせる**

```ts
// import に足す
import { makeAnimStore, noteAttacks, resetAnim, updateMotion } from './render/anim';
```

`const effects = makeEffectState();` の隣に置く。

```ts
const anim = makeAnimStore();

/** 攻撃モーションの長さ。シートを持たないユニットは null */
function attackDuration(defId: string): number | null {
  const def = registry.units.get(defId) ?? registry.enemies.get(defId);
  const sheet = def?.sprites.map;
  if (!sheet) return null;
  return sheet.attack.frames / sheet.attack.fps;
}
```

- [ ] **Step 6: main.ts の update と描画をつなぐ**

`beginStage` の `resetEffects(effects);` の直後に `resetAnim(anim);` を足す。

`update` の固定ステップのループと、そのあとを次にする。

```ts
  while (accumulator >= FIXED_DT) {
    accumulator -= FIXED_DT;
    const batch = commands.splice(0, commands.length);
    step(battle, batch, FIXED_DT);
    spawnEffects(effects, battle.events);
    noteAttacks(anim, battle.events, battle.time, attackDuration);
    pushBubbles(bubbles, pickDialogue(battle.reg, battle.events));
  }
  updateMotion(anim, battle.units, battle.time);
```

`drawBattle(...)` の呼び出し4箇所すべての末尾に `anim` を足す。

```ts
drawBattle(ctx, registry, battle, null, effects, escorts, images, anim);
drawBattle(ctx, registry, battle, selected, effects, escorts, images, anim);
```

- [ ] **Step 7: 補間を切る**

`resize()` の末尾に足す。`canvas.width` への代入は 2D コンテキストの状態を全部リセットするので、生成時に1回入れるだけでは端末の回転やウィンドウのリサイズで補間が復活する。

```ts
function resize(): void {
  const scale = Math.min(window.innerWidth / LOGICAL_W, window.innerHeight / LOGICAL_H);
  canvas.width = Math.floor(LOGICAL_W * scale * window.devicePixelRatio);
  canvas.height = Math.floor(LOGICAL_H * scale * window.devicePixelRatio);
  canvas.style.width = `${Math.floor(LOGICAL_W * scale)}px`;
  canvas.style.height = `${Math.floor(LOGICAL_H * scale)}px`;
  // width への代入でコンテキストの状態が全部リセットされるので、ここで毎回入れ直す
  ctx.imageSmoothingEnabled = false;
}
```

`resize()` は `const ctx = canvas.getContext('2d')!;` より後ろで定義されているので、`ctx` はそのまま参照できる。

- [ ] **Step 8: 通ることを確かめる**

Run: `npm test && npm run build`
Expected: どちらも成功。この時点でもまだシートを参照している JSON が無いので、見た目は今までどおり

- [ ] **Step 9: コミット**

```bash
git add src/render/draw.ts src/main.ts
git commit -m "feat: アニメ状態を描画につなぎ、HPバーやリングを実描画サイズ基準にする"
```

---

## Task 8: 仮アセットの生成器を書く

**Files:**
- Create: `tools/gen-placeholder-sprites.mjs`
- Create: `assets/images/*.png`（シート7枚・顔7枚・クラス5枚）

**Interfaces:**
- Consumes: なし（コードから独立した道具）
- Produces: `assets/images/` に次のファイルが並ぶ。Task 9 の JSON がこの名前を参照する
  - シート: `roran-map.png` / `ines-map.png` / `mist-map.png` / `gau-map.png` / `garum-map.png` / `narazumono-map.png` / `tatemochi-map.png`
  - 顔: 同じ7体の `<id>-face.png`（128×128）
  - クラス: `role-tate.png` / `role-yumi.png` / `role-mahou.png` / `role-monomi.png` / `role-teki.png`（64×64）
  - シートの実寸は `frame` を32として **128×384**、ガルムだけ `frame` 48 で **192×576**

**テストなし。** 生成物の実寸は Task 9 のテストが見る。

- [ ] **Step 1: 生成器を書く**

`tools/gen-placeholder-sprites.mjs` を新規作成する。Node 標準の `zlib` だけで PNG を書く（依存の追加なし）。本番の絵が揃った時点でこのファイルごと消す前提。

```js
#!/usr/bin/env node
// 仮アセットの生成器。本番の絵が揃ったら、このファイルごと消してよい。
// 使い方: node tools/gen-placeholder-sprites.mjs
import { deflateSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'images');

// ---- PNG の書き出し（8bit RGBA、フィルタなし） ----

const CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'latin1'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function encodePng(c) {
  const stride = 1 + c.w * 4;
  const raw = Buffer.alloc(c.h * stride);
  for (let y = 0; y < c.h; y++) {
    raw[y * stride] = 0; // フィルタ種別 0
    Buffer.from(c.px.buffer, c.px.byteOffset + y * c.w * 4, c.w * 4).copy(raw, y * stride + 1);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(c.w, 0);
  ihdr.writeUInt32BE(c.h, 4);
  ihdr[8] = 8; // ビット深度
  ihdr[9] = 6; // カラータイプ RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ---- 画布 ----

const canvas = (w, h) => ({ w, h, px: new Uint8Array(w * h * 4) });
const hex = (s) => [parseInt(s.slice(1, 3), 16), parseInt(s.slice(3, 5), 16), parseInt(s.slice(5, 7), 16)];
const shade = (c, f) => c.map((v) => Math.max(0, Math.min(255, Math.round(v * f))));

function put(c, x, y, col) {
  x = Math.round(x); y = Math.round(y);
  if (x < 0 || y < 0 || x >= c.w || y >= c.h) return;
  const i = (y * c.w + x) * 4;
  c.px[i] = col[0]; c.px[i + 1] = col[1]; c.px[i + 2] = col[2]; c.px[i + 3] = 255;
}

function rect(c, x, y, w, h, col) {
  for (let j = 0; j < Math.round(h); j++) for (let i = 0; i < Math.round(w); i++) put(c, x + i, y + j, col);
}

function disc(c, cx, cy, r, col) {
  for (let y = Math.floor(cy - r); y <= cy + r; y++)
    for (let x = Math.floor(cx - r); x <= cx + r; x++)
      if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) put(c, x, y, col);
}

const SKIN = [242, 214, 178];
const DARK = [40, 36, 44];
const STEEL = [176, 182, 196];

const WEAPON = {
  shield: { w: 0.20, h: 0.26, col: STEEL },
  bow:    { w: 0.07, h: 0.30, col: [150, 106, 62] },
  staff:  { w: 0.07, h: 0.36, col: [198, 150, 96] },
  dagger: { w: 0.07, h: 0.18, col: STEEL },
  sword:  { w: 0.08, h: 0.28, col: STEEL },
  club:   { w: 0.12, h: 0.30, col: [122, 92, 66] },
};

// ---- 1コマ ----

/** s×s のコマを (ox, oy) に描く */
function drawFrame(c, ox, oy, s, def, state, dir, i) {
  const body = hex(def.color);
  const hair = shade(body, 0.55);
  const bob = state === 'idle' && i % 2 === 1 ? 1 : 0;
  const ext = state === 'attack' ? [0, 0.14, 0.07][i] * s : 0;
  const w = WEAPON[def.weapon];
  const ww = w.w * s, wh = w.h * s;

  const drawWeapon = () => {
    if (dir === 'left') rect(c, ox + 0.20 * s - ext, oy + 0.46 * s + bob, ww, wh, w.col);
    else if (dir === 'right') rect(c, ox + 0.80 * s - ww + ext, oy + 0.46 * s + bob, ww, wh, w.col);
    else if (dir === 'down') rect(c, ox + 0.66 * s, oy + 0.50 * s + bob + ext, ww, wh * 0.7, w.col);
    else rect(c, ox + 0.24 * s, oy + 0.34 * s + bob - ext, ww, wh * 0.7, w.col);
  };

  // 上向きは背中なので、武器は体より先に（＝奥に）描く
  if (dir === 'up') drawWeapon();

  // あし。walk は左右を振る
  const swing = state === 'walk' ? [0, 1, 0, -1][i] * 0.05 * s : 0;
  rect(c, ox + 0.36 * s, oy + 0.74 * s + bob, 0.10 * s, 0.14 * s + swing, DARK);
  rect(c, ox + 0.54 * s, oy + 0.74 * s + bob, 0.10 * s, 0.14 * s - swing, DARK);

  // どう
  rect(c, ox + 0.32 * s, oy + 0.48 * s + bob, 0.36 * s, 0.28 * s, body);
  // あたま
  disc(c, ox + 0.50 * s, oy + 0.36 * s + bob, 0.17 * s, SKIN);

  // かみ・かぶりもの。上向きは後頭部なので頭を全部おおう
  const capH = dir === 'up' ? 0.34 * s : 0.16 * s;
  for (let y = 0; y < capH; y++) {
    for (let x = 0; x < 0.34 * s; x++) {
      const px = ox + 0.33 * s + x, py = oy + 0.19 * s + bob + y;
      const dx = px - (ox + 0.50 * s), dy = py - (oy + 0.36 * s + bob);
      if (dx * dx + dy * dy <= (0.17 * s) ** 2) put(c, px, py, hair);
    }
  }

  // かお。下向きは両目、横向きは片目だけ、上向きは無し
  if (dir === 'down') {
    rect(c, ox + 0.42 * s, oy + 0.38 * s + bob, 0.05 * s, 0.06 * s, DARK);
    rect(c, ox + 0.55 * s, oy + 0.38 * s + bob, 0.05 * s, 0.06 * s, DARK);
  } else if (dir === 'left') {
    rect(c, ox + 0.38 * s, oy + 0.38 * s + bob, 0.05 * s, 0.06 * s, DARK);
  } else if (dir === 'right') {
    rect(c, ox + 0.58 * s, oy + 0.38 * s + bob, 0.05 * s, 0.06 * s, DARK);
  }

  if (dir !== 'up') drawWeapon();
}

// ---- シート・顔・クラス ----

const STATES = [['idle', 2], ['walk', 4], ['attack', 3]];
const DIRS = ['down', 'up', 'left', 'right'];

function sheetFor(def) {
  const s = def.frame;
  const cols = Math.max(...STATES.map(([, n]) => n));
  const c = canvas(cols * s, 12 * s);
  STATES.forEach(([state, n], si) => {
    DIRS.forEach((dir, di) => {
      // フレーム数が少ない状態の余った右側は透明のまま置く
      for (let i = 0; i < n; i++) drawFrame(c, i * s, (si * 4 + di) * s, s, def, state, dir, i);
    });
  });
  return c;
}

/** 顔。128×128 のバスト */
function faceFor(def) {
  const s = 128, c = canvas(s, s);
  const body = hex(def.color), hair = shade(body, 0.55);
  rect(c, 0, 0, s, s, shade(body, 1.35));
  rect(c, 0.22 * s, 0.74 * s, 0.56 * s, 0.26 * s, body);
  disc(c, 0.50 * s, 0.46 * s, 0.26 * s, SKIN);
  for (let y = 0; y < 0.30 * s; y++) {
    for (let x = 0; x < 0.54 * s; x++) {
      const px = 0.23 * s + x, py = 0.20 * s + y;
      if ((px - 0.50 * s) ** 2 + (py - 0.46 * s) ** 2 <= (0.26 * s) ** 2) put(c, px, py, hair);
    }
  }
  rect(c, 0.38 * s, 0.48 * s, 0.06 * s, 0.08 * s, DARK);
  rect(c, 0.56 * s, 0.48 * s, 0.06 * s, 0.08 * s, DARK);
  rect(c, 0.45 * s, 0.62 * s, 0.10 * s, 0.03 * s, shade(SKIN, 0.75));
  return c;
}

/** クラスの印。64×64。武器の形だけ */
function roleFor(weapon, color) {
  const s = 64, c = canvas(s, s);
  const w = WEAPON[weapon];
  rect(c, 0, 0, s, s, shade(hex(color), 0.45));
  rect(c, 0.5 * s - (w.w * s * 1.6) / 2, 0.5 * s - (w.h * s * 1.6) / 2, w.w * s * 1.6, w.h * s * 1.6, w.col);
  return c;
}

// ---- 定義 ----

const CHARS = [
  { id: 'roran', color: '#4a80c8', weapon: 'shield', frame: 32 },
  { id: 'ines', color: '#3faa6a', weapon: 'bow', frame: 32 },
  { id: 'mist', color: '#c86fb0', weapon: 'staff', frame: 32 },
  { id: 'gau', color: '#e0a03c', weapon: 'dagger', frame: 32 },
  // ボスだけ大きい。ユニットごとに違う frame が通ることも実地で確かめる
  { id: 'garum', color: '#b03a3a', weapon: 'club', frame: 48 },
  { id: 'narazumono', color: '#8a5a4a', weapon: 'sword', frame: 32 },
  { id: 'tatemochi', color: '#6b6b7a', weapon: 'shield', frame: 32 },
];

const ROLES = [
  ['role-tate', 'shield', '#4a80c8'],
  ['role-yumi', 'bow', '#3faa6a'],
  ['role-mahou', 'staff', '#c86fb0'],
  ['role-monomi', 'dagger', '#e0a03c'],
  ['role-teki', 'sword', '#b03a3a'],
];

for (const def of CHARS) {
  const sheet = sheetFor(def);
  writeFileSync(join(OUT, `${def.id}-map.png`), encodePng(sheet));
  writeFileSync(join(OUT, `${def.id}-face.png`), encodePng(faceFor(def)));
  console.log(`${def.id}-map.png ${sheet.w}x${sheet.h}`);
}
for (const [name, weapon, color] of ROLES) {
  writeFileSync(join(OUT, `${name}.png`), encodePng(roleFor(weapon, color)));
  console.log(`${name}.png 64x64`);
}
```

- [ ] **Step 2: 走らせる**

Run: `node tools/gen-placeholder-sprites.mjs`
Expected: 12行の出力。`roran-map.png 128x384` … `garum-map.png 192x576` … `role-teki.png 64x64`

- [ ] **Step 3: できた PNG を確かめる**

Run: `file assets/images/*.png | head -3`
Expected: `PNG image data, 128 x 384, 8-bit/color RGBA, non-interlaced` のように出る。`file` が無ければ `node -e "const b=require('fs').readFileSync('assets/images/roran-map.png');console.log(b.readUInt32BE(16), b.readUInt32BE(20))"` で `128 384` を確かめる

- [ ] **Step 4: 通ることを確かめる**

Run: `npm test && npm run build`
Expected: どちらも成功。まだ JSON が参照していないので、増えた PNG は読まれるだけで使われない

- [ ] **Step 5: コミット**

```bash
git add tools/gen-placeholder-sprites.mjs assets/images
git commit -m "feat: 仮スプライトの生成器を足し、生成した PNG を同梱する"
```

---

## Task 9: JSON をシートにつなぎ、実寸を検証する

**Files:**
- Modify: `assets/units/roran.json`, `ines.json`, `mist.json`, `gau.json`
- Modify: `assets/enemies/garum.json`, `narazumono.json`, `tatemochi.json`
- Create: `src/engine/sheet-size.test.ts`
- Modify: `package.json`, `tsconfig.json`（`@types/node`）

**Interfaces:**
- Consumes: Task 1 のスキーマ、Task 2 の存在検証、Task 8 の PNG
- Produces: 7体すべてが `sprites.map` にシートを持つ。実寸が JSON と食い違うと `npm test` が落ちる

- [ ] **Step 1: node の型を使えるようにする**

テストが `node:fs` を読むので型が要る。`tsconfig.json` の `include` は `["src"]` なので、テストも `tsc --noEmit` の対象になる。

```bash
npm install --save-dev @types/node
```

`tsconfig.json` の `types` に `"node"` を足す。

```json
    "types": ["vitest/globals", "vite/client", "node"]
```

- [ ] **Step 2: 失敗するテストを書く**

`src/engine/sheet-size.test.ts` を新規作成する。「シートが1枚以上ある」ことも表明する — これが無いと、JSON からシートが消えたときにテストが空回りして通ってしまう。

```ts
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { validateEnemyDef, validateUnitDef } from './schema';
import type { MapSheet } from './schema';

/** PNG の IHDR は先頭24バイトに入っている。幅は 16、高さは 20 バイト目から */
function pngSize(path: string): { w: number; h: number } {
  const b = readFileSync(path);
  const sig = b.subarray(0, 8).toString('hex');
  if (sig !== '89504e470d0a1a0a') throw new Error(`PNG では ない: ${path}`);
  if (b.subarray(12, 16).toString('latin1') !== 'IHDR') throw new Error(`IHDR が ない: ${path}`);
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
}

function sheetsInDir(dir: string, validate: (file: string, raw: unknown) => { ok: boolean; value?: unknown }):
  { file: string; sheet: MapSheet }[] {
  const out: { file: string; sheet: MapSheet }[] = [];
  for (const name of readdirSync(dir)) {
    if (!name.endsWith('.json')) continue;
    const file = join(dir, name);
    const r = validate(file, JSON.parse(readFileSync(file, 'utf8')));
    // ここはテストの外（読み込み時）なので expect は使わない
    if (!r.ok) throw new Error(`${file} の けんしょうに しっぱい`);
    const sheet = (r.value as { sprites: { map: MapSheet | null } }).sprites.map;
    if (sheet !== null) out.push({ file, sheet });
  }
  return out;
}

const SHEETS = [
  ...sheetsInDir('assets/units', validateUnitDef),
  ...sheetsInDir('assets/enemies', validateEnemyDef),
];

describe('シートの じっすんと JSON', () => {
  it('シートを もつ ユニットが 1たい いじょう ある', () => {
    expect(SHEETS.length).toBeGreaterThan(0);
  });

  it.each(SHEETS)('$sheet.sheet の たてよこが JSON と あう', ({ file, sheet }) => {
    const { w, h } = pngSize(join('assets/images', sheet.sheet));
    const cols = Math.max(sheet.idle.frames, sheet.walk.frames, sheet.attack.frames);

    expect(w, `${file}: よこは frame × さいだいコマすう`).toBe(sheet.frame * cols);
    // 3じょうたい × 4ほうこう = 12ぎょう
    expect(h, `${file}: たては frame × 12`).toBe(sheet.frame * 12);
  });
});
```

- [ ] **Step 3: テストが落ちることを確かめる**

Run: `npx vitest run src/engine/sheet-size.test.ts`
Expected: FAIL。「シートを もつ ユニットが 1たい いじょう ある」で `SHEETS.length` が 0（まだどの JSON もシートを参照していない）

- [ ] **Step 4: 7つの JSON にシートを書く**

`assets/units/roran.json` の `sprites` を差し替える。

```json
  "sprites": {
    "role": "role-tate.png",
    "face": "roran-face.png",
    "map": {
      "sheet": "roran-map.png", "frame": 32,
      "idle": { "frames": 2, "fps": 4 },
      "walk": { "frames": 4, "fps": 8 },
      "attack": { "frames": 3, "fps": 12 }
    }
  }
```

残り6体も同じ形で書く。違うのは `role` / `face` / `sheet` / `frame` だけ。

| ファイル | role | face | sheet | frame |
|---|---|---|---|---|
| `assets/units/roran.json` | `role-tate.png` | `roran-face.png` | `roran-map.png` | 32 |
| `assets/units/ines.json` | `role-yumi.png` | `ines-face.png` | `ines-map.png` | 32 |
| `assets/units/mist.json` | `role-mahou.png` | `mist-face.png` | `mist-map.png` | 32 |
| `assets/units/gau.json` | `role-monomi.png` | `gau-face.png` | `gau-map.png` | 32 |
| `assets/enemies/garum.json` | `role-teki.png` | `garum-face.png` | `garum-map.png` | **48** |
| `assets/enemies/narazumono.json` | `role-teki.png` | `narazumono-face.png` | `narazumono-map.png` | 32 |
| `assets/enemies/tatemochi.json` | `role-teki.png` | `tatemochi-face.png` | `tatemochi-map.png` | 32 |

敵の3ファイルには `sprites` キー自体が無いので、`"color"` の次に新しく足す（JSON のカンマに注意）。

- [ ] **Step 5: テストが通ることを確かめる**

Run: `npm test && npm run build`
Expected: どちらも成功。`sheet-size.test.ts` が7件ぶん走る

- [ ] **Step 6: 見張りが効いていることを確かめる**

`assets/units/roran.json` の `walk.frames` を一時的に `5` にして走らせる。

Run: `npx vitest run src/engine/sheet-size.test.ts`
Expected: FAIL。`roran-map.png の たてよこが JSON と あう` が「よこは frame × さいだいコマすう」で落ちる（128 ≠ 160）

確かめたら `4` に戻し、もう一度走らせて PASS になることを見る。

- [ ] **Step 7: コミット**

```bash
git add assets/units assets/enemies src/engine/sheet-size.test.ts package.json package-lock.json tsconfig.json
git commit -m "feat: 7体のユニットをスプライトシートにつなぎ、実寸をテストで見張る"
```

---

## Task 10: ドキュメントを直し、ブラウザで目視する

**Files:**
- Modify: `README.md`
- Modify: `assets/images/README.txt`

**Interfaces:**
- Consumes: Task 1〜9 のすべて
- Produces: なし（最後のタスク）

- [ ] **Step 1: assets/images/README.txt を書き換える**

```
ユニットの え を PNG で ここに おく。

map は スプライトシート。れつ = コマ、ぎょう = 12（3じょうたい × 4ほうこう）。
  ぎょう 0-3   idle   : down, up, left, right
  ぎょう 4-7   walk   : down, up, left, right
  ぎょう 8-11  attack : down, up, left, right
ぎょうばんごう = じょうたいindex × 4 + ほうこうindex。コマは せいほうけい。
れつすうは シートぜんたいで さいだいコマすうに そろえ、あまりは とうめいの まま。

face は 128×128、role は 64×64 の せいほうけい。

units/*.json ・ enemies/*.json の sprites に ファイルめいを かくと つかわれる。
かりの え は tools/gen-placeholder-sprites.mjs で つくっている。
ほんばんの え が そろったら、その ファイルごと けしてよい。
```

- [ ] **Step 2: README.md の「ユニットの絵」を書き換える**

`## コンテンツの足しかた` の中の該当行を次に差し替える。

```markdown
- **ユニットの絵** — `assets/images/` に PNG を置き、`assets/units/<id>.json`（敵は `assets/enemies/<id>.json`）の `sprites` に書く。`role` はクラスアイコン（64×64）、`face` は顔（128×128。下パネル・ステージ選択・会話・リザルト）、`map` はフィールド上の姿。`map` だけはスプライトシートで、`{ "sheet": "<file>.png", "frame": 32, "idle": { "frames": 2, "fps": 4 }, "walk": {...}, "attack": {...} }` の形。シートは**列 = コマ、行 = 12（3状態 × 4方向）**で、行番号 = 状態index × 4 + 方向index、状態は `idle, walk, attack`、方向は `down, up, left, right` の順。コマは正方形。列数は最大コマ数にそろえ、余りは透明のまま置く。`null` のあいだは色つきの丸とクラス名の文字が出る。実寸と JSON が食い違うと `npm test` が落ちる（`src/engine/sheet-size.test.ts`）
- **仮の絵の作り直し** — `node tools/gen-placeholder-sprites.mjs`。本番の絵が揃ったらこの生成器は消してよい。差し替えは PNG を上書きするだけで、コマ数を変えるときだけ JSON の数値を直す
```

- [ ] **Step 3: README.md の構成表と設計資料のリンクを直す**

冒頭のリンク2行を差し替える（過去の運用どおり、前の設計資料は残さず置き換える）。

```markdown
- 設計: `docs/superpowers/specs/2026-09-06-map-sprite-animation-design.md`
- 実装計画: `docs/superpowers/plans/2026-09-07-map-sprite-animation.md`
```

`## 構成` の表に1行足す。

```markdown
| `src/render/anim.ts` | 向き・状態・コマ番号の計算（DOM に触らない） |
| `tools/` | 仮アセットの生成器。本番の絵が揃ったら消す |
```

- [ ] **Step 4: ブラウザで目視する**

README の CDP 手順で確かめる。

```bash
npm run build
# out/play/character-tactics/ を静的サーバで配信し、下の URL を chrome に渡す
chrome --headless=new --no-sandbox --disable-gpu \
       --remote-debugging-port=9222 --window-size=540,945 <URL>
```

見るのは5点。

| 見るもの | 期待 |
|---|---|
| 配置画面 | 味方が丸でなく絵になっている。輪郭がぼけていない（`imageSmoothingEnabled = false` が効いている） |
| 戦闘中 | 進軍中に歩行のコマが動く。止まると待機に戻る。ちらつかない |
| 交戦中 | 攻撃の瞬間に向きが敵のほうを向き、モーションが1回だけ出て止まる |
| HPバー・はた・選択リング | 32px の絵に食い込んでいない |
| ドラッグ中 | 残像が半透明の絵で出る。置けない場所では赤いリングが重なる |

ガルムのいるステージまで進めれば、48px の敵が他より大きく出ることも見える。

- [ ] **Step 5: コミット**

```bash
git add README.md assets/images/README.txt
git commit -m "docs: スプライトシートの規約と差し替え手順を README に書く"
```

- [ ] **Step 6: 仕上げ**

Run: `npm test && npm run build`
Expected: どちらも成功

`git log --oneline origin/main..HEAD` で、spec のコミットを含めて11本になっていることを確かめる。
