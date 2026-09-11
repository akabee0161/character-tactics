# issue #13 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** issue #13 の4項目（必殺技の発動可能表示、黄色い線より下の敵、「!」の出っぱなし、ステージ10本への量産）を直す。

**Architecture:** 前半3項目は既存コードへの局所的な修正。4項目めはステージ選択画面を縦スクロール化し、遠距離の敵を2種足したうえで、`assets/stages/` に7本の JSON を置いて10本にする。ゲームロジックの拡張は不要で、コードが増えるのはスクロールと検証の2か所だけ。

**Tech Stack:** TypeScript / Vite / Vitest / Canvas2D。実行時の依存ライブラリなし。

**Spec:** `docs/superpowers/specs/2026-09-10-issue13-stages-design.md`

## Global Constraints

- ブランチは `feat/issue13-stages`。すでに切ってある
- コミットは Conventional Commits + 日本語の要約（`feat:` / `fix:` / `refactor:` / `test:` / `docs:` / `chore:`）
- **ゲーム内 UI の表示文字列は漢字仮名交じり**（常用漢字中心、ルビなし、低学年でも読める語）。総ひらがなにしない
- **ただし `src/engine/schema.ts` の検証エラー文だけは既存のひらがな調に合わせる**（例: `あるけない マスに ある`）。ここは開発者向けのエラー画面で、周りのメッセージが全部ひらがなのため
- **描画コード（Canvas2D）にユニットテストを書かない。** テストは純ロジックとレイアウト計算に寄せる
- `src/core/**` と `src/engine/**` は `window` / `document` / `localStorage` を参照しない
- 各タスクの最後に `npm test` を通してからコミットする
- 論理解像度は 540×945（`LOGICAL_W` / `LOGICAL_H`）

### 全ステージ共通の骨格

新しく作るステージ JSON は、以下のフィールドを**全ステージ同じ値**で持つ。各タスクでは
`mapRows` / `enemies` / `spawners` / `intro` / `outro` と、`id` / `order` / `name` だけを指定する。

```json
{
  "cell": 32,
  "placement": {
    "minY": 528,
    "starts": [
      { "x": 144, "y": 656 },
      { "x": 240, "y": 656 },
      { "x": 144, "y": 592 },
      { "x": 240, "y": 592 }
    ]
  },
  "roster": ["roran", "ines", "mist", "gau"],
  "victory": { "type": "reach", "pos": { "x": 240, "y": 48 }, "radius": 40, "by": "any" },
  "defeat": [{ "type": "unitLost", "defIds": ["roran"] }]
}
```

マップは **16列 × 23行**、`cell` は 32。座標はセル中心を使う（列 c 行 r の中心は `x = c * 32 + 16`、`y = r * 32 + 16`）。
`placement.minY` が 528 なので、**敵と時間湧きは必ず `y < 528`（= 行15以下）**に置く。行16の中心は
ちょうど 528 で、これはプレイヤーの配置側に入るため使えない。

---

### Task 1: 必殺技の発動可能表示を明滅させる

**Files:**
- Modify: `src/render/effects.ts`
- Modify: `src/ui/screens.ts:184-200`
- Test: `src/render/effects.test.ts`

**Interfaces:**
- Consumes: なし
- Produces: `READY_GLOW_PERIOD: number`（= 1.0）、`readyGlowAlpha(time: number): number`

- [ ] **Step 1: 失敗するテストを書く**

`src/render/effects.test.ts` の末尾に足す。

```ts
describe('readyGlowAlpha', () => {
  it('周期の頭は いちばん明るい', () => {
    expect(readyGlowAlpha(0)).toBeCloseTo(1);
    expect(readyGlowAlpha(READY_GLOW_PERIOD)).toBeCloseTo(1);
    expect(readyGlowAlpha(READY_GLOW_PERIOD * 3)).toBeCloseTo(1);
  });

  it('周期の半分で いちばん暗い', () => {
    expect(readyGlowAlpha(READY_GLOW_PERIOD / 2)).toBeCloseTo(0.45);
  });

  it('つねに 0.45〜1 に収まる', () => {
    for (let t = 0; t < 5; t += 0.05) {
      const a = readyGlowAlpha(t);
      expect(a).toBeGreaterThanOrEqual(0.45);
      expect(a).toBeLessThanOrEqual(1);
    }
  });
});
```

同じファイルの先頭 import に `READY_GLOW_PERIOD` と `readyGlowAlpha` を足す。

- [ ] **Step 2: テストが落ちることを確かめる**

Run: `npx vitest run src/render/effects.test.ts`
Expected: FAIL（`readyGlowAlpha` が export されていない）

- [ ] **Step 3: 実装する**

`src/render/effects.ts` の定数群（`HP_BAR_CATCHUP_RATE` の下）に足す。

```ts
/** 発動可能を示す枠の明滅の周期（秒） */
export const READY_GLOW_PERIOD = 1.0;
const READY_GLOW_MIN = 0.45;

/**
 * 発動可能を示す枠の明るさ。周期 READY_GLOW_PERIOD の三角波で
 * READY_GLOW_MIN〜1 を往復する。動きがつくと視界の端でも気づける。
 * 描画にはテストを書かない方針なので、値の計算だけをここに切り出す
 */
export function readyGlowAlpha(time: number): number {
  const phase = (time % READY_GLOW_PERIOD) / READY_GLOW_PERIOD;
  const triangle = 1 - 2 * Math.abs(phase - 0.5); // 0 → 1 → 0
  return 1 - (1 - READY_GLOW_MIN) * (1 - triangle);
}
```

- [ ] **Step 4: テストが通ることを確かめる**

Run: `npx vitest run src/render/effects.test.ts`
Expected: PASS

- [ ] **Step 5: 描画側をつなぐ**

`src/ui/screens.ts` の import に足す。

```ts
import { readyGlowAlpha } from '../render/effects';
```

`drawBottomBar` の発動可能の枠（現在は `if (state.phase === 'battle' && remaining <= 0) { ... }`）を
まるごと差し替える。

```ts
        // 押せば技が出る状態を縁で示す。押せない理由を文字で出す代わり
        // 配置フェーズは全員 time===0 かつクールダウン未消化で「発動可能」に見えてしまうため、戦闘フェーズ限定にする
        if (state.phase === 'battle' && remaining <= 0) {
          ctx.save();
          ctx.globalAlpha = readyGlowAlpha(state.time);
          ctx.strokeStyle = '#ffd479';
          ctx.lineWidth = 4;
          ctx.strokeRect(r.x + 2, r.y + 2, r.w - 4, r.h - 4);
          ctx.restore();
        }
```

`ctx.save()` / `ctx.restore()` で囲むのは、この直後に `unit.retired` の分岐が
`ctx.globalAlpha` を前提にせず描くため。`globalAlpha` を戻し忘れると下の描画まで薄くなる。

- [ ] **Step 6: 型チェックとテストを通す**

Run: `npm test && npm run build`
Expected: どちらも成功

- [ ] **Step 7: コミット**

```bash
git add src/render/effects.ts src/render/effects.test.ts src/ui/screens.ts
git commit -m "feat: 必殺技が使えるポートレートの枠を太くして明滅させる"
```

---

### Task 2: 黄色い線より下に敵を置けなくする

`placement.minY` より下はプレイヤーの配置範囲なので、敵と時間湧きはそこに置けない。
検証を足すと同時に、既に違反している stage2 / stage3 のデータを直す。
**検証とデータ修正は必ず同じコミットにする。** 片方だけ入れると `testRegistry()`
（実アセットを読むテスト用ヘルパ）が落ちてゲームも起動しなくなる。

**Files:**
- Modify: `src/engine/schema.ts:608-649`（`validateStageDef` の読み順と新しい検査）
- Modify: `src/engine/schema.test.ts:262-272`（`VALID_STAGE`）、`:498-511`（`stageRaw`）、`:544-548`
- Modify: `src/engine/registry.test.ts:27-35`（`STAGE`）
- Modify: `assets/stages/stage2.json`、`assets/stages/stage3.json`

**Interfaces:**
- Consumes: なし
- Produces: なし（`validateStageDef` の外から見た型は変わらない）

- [ ] **Step 1: 失敗するテストを書く**

`src/engine/schema.test.ts` の `describe('validateStageDef: placement', ...)` の直後に足す。

```ts
describe('validateStageDef: 敵は配置範囲より上', () => {
  it('敵が minY より下だとエラー', () => {
    const raw = stageRaw({
      enemies: [{ defId: 'narazumono', pos: { x: 48, y: 80 }, ai: { kind: 'aggressive' } }],
    });
    const r = validateStageDef('assets/stages/t.json', raw);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.some((e) => e.path === 'enemies[0].pos')).toBe(true);
  });

  it('敵が minY ちょうどでもエラー（線上は配置できる側）', () => {
    const raw = stageRaw({
      enemies: [{ defId: 'narazumono', pos: { x: 48, y: 64 }, ai: { kind: 'aggressive' } }],
    });
    expect(validateStageDef('assets/stages/t.json', raw).ok).toBe(false);
  });

  it('敵が minY より上なら通る', () => {
    const raw = stageRaw({
      enemies: [{ defId: 'narazumono', pos: { x: 48, y: 48 }, ai: { kind: 'aggressive' } }],
    });
    expect(validateStageDef('assets/stages/t.json', raw).ok).toBe(true);
  });

  it('時間湧きが minY より下だとエラー', () => {
    const raw = stageRaw({
      spawners: [{ defId: 'narazumono', pos: { x: 48, y: 80 }, firstAfter: 5, every: 10, total: 2 }],
    });
    const r = validateStageDef('assets/stages/t.json', raw);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.some((e) => e.path === 'spawners[0].pos')).toBe(true);
  });

  it('placement 自体が無いときは、敵の位置では弾かない', () => {
    const raw = stageRaw({
      enemies: [{ defId: 'narazumono', pos: { x: 48, y: 80 }, ai: { kind: 'aggressive' } }],
    });
    delete (raw as Record<string, unknown>).placement;
    const r = validateStageDef('assets/stages/t.json', raw);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.every((e) => !e.path.startsWith('enemies['))).toBe(true);
  });
});
```

- [ ] **Step 2: テストのフィクスチャを新しい前提に合わせる**

`stageRaw`（`src/engine/schema.test.ts:498` 付近）の `placement` を変える。
いまは `minY: 32` で `starts` が `y: 48` にあり、既存の spawner テストが
`pos: { x: 48, y: 48 }` を使っているため、新しい検査に引っかかる。
マップ `['###', '#.#', '#.#', '###']` の歩けるマスは x 32〜63 / y 32〜95 なので、
線を真ん中（64）に引けば上下に1マスずつ取れる。

```ts
    placement: { minY: 64, starts: [{ x: 48, y: 80 }] },
```

同ファイル `:544-548` の期待値も合わせる。

```ts
  it('minY と starts を読む', () => {
    const r = validateStageDef('assets/stages/t.json', stageRaw());
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.placement).toEqual({ minY: 64, starts: [{ x: 48, y: 80 }] });
  });
```

`VALID_STAGE`（`:262` 付近）はマップ `['####', '#..#', '#..#', '####']` で
歩けるマスが x 32〜95 / y 32〜95。線を 64 にし、味方は下の行、敵は上の行へ。

```ts
  placement: { minY: 64, starts: [{ x: 48, y: 80 }] },
  roster: ['roran', 'ines'],
  enemies: [{ defId: 'narazumono', pos: { x: 80, y: 48 }, ai: { kind: 'aggressive' } }],
```

`src/engine/registry.test.ts` の `STAGE`（`:27` 付近）も同じ理由で直す。

```ts
  placement: { minY: 64, starts: [{ x: 48, y: 80 }] },
  roster: ['roran'],
  enemies: [{ defId: 'narazumono', pos: { x: 80, y: 48 }, ai: { kind: 'aggressive' } }],
```

- [ ] **Step 3: テストが落ちることを確かめる**

Run: `npx vitest run src/engine/schema.test.ts`
Expected: FAIL（新しい5件が落ちる。「敵が minY より上なら通る」だけは先に通ってよい）

- [ ] **Step 4: `validateStageDef` の読み順を変えて検査を足す**

`src/engine/schema.ts` の `validateStageDef` で、いまは `enemies` → `placement` の順に読んでいる。
`minY` を敵の検査に使うので、`placement` を先に読む。`checkWalkable` の定義の直後に置く。

```ts
  const placement = readPlacement(ctx, o.placement, mapRows, cell, checkWalkable);
  // placement 自体が読めなかったときは minY がフォールバックの 0 になり、
  // すべての敵が「線より下」と誤検出される。その場合はこの検査を止める
  const zoneMinY =
    typeof o.placement === 'object' && o.placement !== null && !Array.isArray(o.placement)
      ? placement.minY
      : null;
  const checkAboveLine = (path: string, pos: Vec2): void => {
    if (zoneMinY !== null && pos.y >= zoneMinY) {
      fail(ctx, path, `placement.minY（${zoneMinY}）より うえに ないと いけない`);
    }
  };
```

`enemies` の `map` の中、`checkWalkable(`${path}.pos`, pos);` の次の行に足す。

```ts
    checkAboveLine(`${path}.pos`, pos);
```

`readSpawners` は `checkWalkable` を引数で受け取っているので、同じ形で `checkAboveLine` も渡す。
シグネチャを変える。

```ts
function readSpawners(
  ctx: Ctx,
  v: unknown,
  checkWalkable: (path: string, pos: Vec2) => void,
  checkAboveLine: (path: string, pos: Vec2) => void,
): SpawnerDef[] {
```

`readSpawners` の中、`checkWalkable(`${path}.pos`, pos);` の次の行に足す。

```ts
    checkAboveLine(`${path}.pos`, pos);
```

最後に `stage` オブジェクトの組み立てを、先に読んだ `placement` と新しい引数に合わせる。

```ts
    placement,
    roster: readStringArray(ctx, 'roster', o.roster, 1),
    enemies,
    spawners: readSpawners(ctx, o.spawners, checkWalkable, checkAboveLine),
```

- [ ] **Step 5: テストが通ることを確かめる**

Run: `npx vitest run src/engine/schema.test.ts src/engine/registry.test.ts`
Expected: PASS

- [ ] **Step 6: 実アセットの違反を直す**

Run: `npm test`
Expected: FAIL。`testRegistry()` を使うテスト（`src/core/state.test.ts` など）が
stage2 / stage3 の敵の位置で落ちる。

`assets/stages/stage2.json` の `enemies` を差し替える。線（y=528）より下にいた
2体を、線のすぐ上（行15 = y 496）へ上げる。見張りが砦の手前にいる、というねらいは変わらない。

```json
  "enemies": [
    { "defId": "narazumono", "pos": { "x": 240, "y": 336 }, "ai": { "kind": "sentry", "sightRange": 110 } },
    { "defId": "tatemochi",  "pos": { "x": 112, "y": 336 }, "ai": { "kind": "sentry", "sightRange": 110 } },
    { "defId": "narazumono", "pos": { "x": 208, "y": 496 }, "ai": { "kind": "sentry", "sightRange": 90 } },
    { "defId": "narazumono", "pos": { "x": 400, "y": 496 }, "ai": { "kind": "sentry", "sightRange": 90 } },
    { "defId": "tatemochi",  "pos": { "x": 240, "y": 144 }, "ai": { "kind": "aggressive" } }
  ],
```

`assets/stages/stage3.json` の `enemies` の先頭2体（y=528、線ちょうど）も上げる。

```json
    { "defId": "narazumono", "pos": { "x": 176, "y": 496 }, "ai": { "kind": "sentry", "sightRange": 100 } },
    { "defId": "narazumono", "pos": { "x": 368, "y": 496 }, "ai": { "kind": "sentry", "sightRange": 100 } },
```

y=496 は行15。stage2 / stage3 とも行15 は `#..............#` で、x=112 / 176 / 208 / 240 / 368 / 400
はいずれも歩けるマスに入る（列 3 / 5 / 6 / 7 / 11 / 12）。

- [ ] **Step 7: 全テストと型チェックを通す**

Run: `npm test && npm run build`
Expected: どちらも成功

- [ ] **Step 8: コミット**

```bash
git add src/engine/schema.ts src/engine/schema.test.ts src/engine/registry.test.ts assets/stages/stage2.json assets/stages/stage3.json
git commit -m "fix: 黄色い線より下に敵を置けないようにして、違反していたステージを直す"
```

---

### Task 3: 「!」を発見の瞬間から2秒だけ出す

いまは `ai.mode === 'chase'` のあいだずっと出るので、交戦中も出たままになっている。
発見した時刻を持たせ、そこから一定時間だけ出す。

**Files:**
- Modify: `src/core/types.ts:26-32`（`AiState`）
- Modify: `src/core/state.ts:54`（`AiState` の生成）
- Modify: `src/core/sim.ts:34-44`（`updateAi`）
- Modify: `src/render/objectives-view.ts:16-32`（`alertMarks`）
- Modify: `src/render/draw.ts:92-103`（呼び出し）
- Test: `src/render/objectives-view.test.ts`、`src/core/sim.test.ts`
- Modify（フィクスチャの追従）: `src/core/skills.test.ts:27`、`src/core/sim-combat.test.ts:49`、`src/core/ai.test.ts:21`、`src/core/sim.test.ts:18`、`src/core/sim.test.ts:79`

**Interfaces:**
- Consumes: なし
- Produces:
  - `AiState.spottedAt: number | null` — 直近に `chase` へ入ったシム時刻。`chase` でなければ `null`
  - `ALERT_MARK_DURATION: number`（= 2.0、`src/render/objectives-view.ts`）
  - `alertMarks(units: Unit[], time: number): AlertMark[]` — 第2引数が増える

- [ ] **Step 1: 失敗するテストを書く（表示側）**

`src/render/objectives-view.test.ts:36-38` の `enemy` ヘルパはそのまま使う
（`ai` は `Unit['ai']` 型を受け取るので、`spottedAt` を書かないと型エラーになる。
それが狙いどおりの「落ちるテスト」になる）。

`describe('alertMarks', ...)`（`:40-65`）をまるごと差し替える。

```ts
const SENTRY = { kind: 'sentry' as const, sightRange: 100 };

describe('alertMarks', () => {
  it('見つかった直後は 印が出る', () => {
    const u = enemy('e1', 10, 20, { def: SENTRY, mode: 'chase', targetUid: 'p1', home: { x: 10, y: 20 }, spottedAt: 5 });
    expect(alertMarks([u], 5)).toEqual([{ pos: { x: 10, y: 20 }, defId: u.defId }]);
  });

  it('ALERT_MARK_DURATION ちょうどまでは 出る', () => {
    const u = enemy('e1', 10, 20, { def: SENTRY, mode: 'chase', targetUid: 'p1', home: { x: 10, y: 20 }, spottedAt: 5 });
    expect(alertMarks([u], 5 + ALERT_MARK_DURATION).length).toBe(1);
  });

  it('ALERT_MARK_DURATION を すぎたら消える（交戦中でも出しっぱなしにしない）', () => {
    const u = enemy('e1', 10, 20, { def: SENTRY, mode: 'chase', targetUid: 'p1', home: { x: 10, y: 20 }, spottedAt: 5 });
    expect(alertMarks([u], 5 + ALERT_MARK_DURATION + 0.01)).toEqual([]);
  });

  it('spottedAt が null なら出ない', () => {
    const u = enemy('e1', 10, 20, { def: SENTRY, mode: 'idle', targetUid: null, home: { x: 10, y: 20 }, spottedAt: null });
    expect(alertMarks([u], 1)).toEqual([]);
  });

  it('aggressive は返さない（常に追ってくるので「気づかれた」印にならない）', () => {
    const u = enemy('e1', 10, 20, { def: { kind: 'aggressive' }, mode: 'chase', targetUid: 'p1', home: { x: 10, y: 20 }, spottedAt: 0 });
    expect(alertMarks([u], 0)).toEqual([]);
  });

  it('退場した敵は返さない', () => {
    const u = enemy('e1', 10, 20, { def: { kind: 'guard', post: { x: 0, y: 0 }, leash: 10, sightRange: 100 }, mode: 'chase', targetUid: 'p1', home: { x: 10, y: 20 }, spottedAt: 0 });
    expect(alertMarks([{ ...u, retired: true }], 0)).toEqual([]);
  });

  it('ai を持たない味方は返さない', () => {
    const ally = { uid: 'p1', defId: 'roran', pos: { x: 1, y: 2 }, side: 'player', retired: false, ai: null } as unknown as Unit;
    expect(alertMarks([ally], 0)).toEqual([]);
  });
});
```

import に `ALERT_MARK_DURATION` を足す。

- [ ] **Step 2: 失敗するテストを書く（シム側）**

`src/core/sim.test.ts` の末尾に足す。`AI_STAGE`（既存の広い部屋。30列×15行、全部歩ける）と
`fresh()` を使う。`fresh()` は中で `beginBattle` を呼び、味方4人を `(16, 80)` へどけるので、
ここでは呼ばない。動かしたい1人だけ `pos` を書き換える。

```ts
describe('spottedAt', () => {
  function sentryState(): BattleState {
    const stage: StageDef = {
      ...AI_STAGE,
      enemies: [{
        defId: 'narazumono',
        pos: { x: 400, y: 240 },
        ai: { kind: 'sentry', sightRange: 100 },
      }],
    };
    return fresh(stage).state;
  }

  it('はじめは null', () => {
    const state = sentryState();
    const e = state.units.find((u) => u.side === 'enemy')!;
    expect(e.ai!.spottedAt).toBeNull();
  });

  it('見つけた tick の時刻が入る', () => {
    const state = sentryState();
    const e = state.units.find((u) => u.side === 'enemy')!;
    const p = state.units.find((u) => u.side === 'player')!;
    p.pos = { x: 440, y: 240 }; // 索敵範囲の内側
    step(state, [], 0.1);
    expect(e.ai!.mode).toBe('chase');
    expect(e.ai!.spottedAt).toBeCloseTo(state.time);
  });

  it('追いかけているあいだ 時刻は更新されない', () => {
    const state = sentryState();
    const e = state.units.find((u) => u.side === 'enemy')!;
    const p = state.units.find((u) => u.side === 'player')!;
    p.pos = { x: 440, y: 240 };
    step(state, [], 0.1);
    const first = e.ai!.spottedAt;
    step(state, [], 0.1);
    expect(e.ai!.spottedAt).toBe(first);
  });

  it('見失ったら null に戻り、見つけ直すと入り直す', () => {
    const state = sentryState();
    const e = state.units.find((u) => u.side === 'enemy')!;
    const p = state.units.find((u) => u.side === 'player')!;
    p.pos = { x: 440, y: 240 };
    step(state, [], 0.1);
    expect(e.ai!.spottedAt).not.toBeNull();

    p.pos = { x: 40, y: 40 }; // 索敵範囲の外
    step(state, [], 0.1);
    expect(e.ai!.spottedAt).toBeNull();

    p.pos = { x: e.pos.x + 40, y: e.pos.y };
    step(state, [], 0.1);
    expect(e.ai!.spottedAt).toBeCloseTo(state.time);
  });
});
```

`describe` / `it` / `expect` / `step` / `StageDef` / `BattleState` はすべて
`src/core/sim.test.ts` の既存の import にある。足す import は無い。

- [ ] **Step 3: テストが落ちることを確かめる**

Run: `npx vitest run src/render/objectives-view.test.ts src/core/sim.test.ts`
Expected: FAIL（`ALERT_MARK_DURATION` が無い、`spottedAt` が無い）

- [ ] **Step 4: 型に足す**

`src/core/types.ts` の `AiState` に足す。

```ts
export type AiState = {
  def: AiDef;
  mode: 'idle' | 'chase' | 'return';
  targetUid: string | null;
  /** 初期位置。sentry の帰還先 */
  home: Vec2;
  /**
   * 直近に chase へ入ったシム時刻。chase でなければ null。
   * 「気づかれた」印を一瞬だけ出すために使う（追跡中ずっと出すと意味を失う）
   */
  spottedAt: number | null;
};
```

`src/core/state.ts:54` の生成を直す。

```ts
    ai: a.ai === null
      ? null
      : { def: a.ai, mode: 'idle', targetUid: null, home: { ...a.pos }, spottedAt: null },
```

- [ ] **Step 5: `AiState` を直書きしているテストのフィクスチャを追従させる**

`AiState` に必須フィールドが増えるので、リテラルで組んでいる箇所が型エラーになる。
5か所あるので、それぞれ `home: ...` の直後に `spottedAt: null,` を足す。

| ファイル | 行 | いまの形 |
|---|---|---|
| `src/core/sim.test.ts` | 18 | `ai: { def: ai, mode: 'idle', targetUid: null, home: { ...pos } },` |
| `src/core/sim.test.ts` | 79 | `ai: { def: { kind: 'aggressive' }, mode: 'idle', targetUid: null, home: { ...pos } },` |
| `src/core/skills.test.ts` | 27 | `ai: { def: { kind: 'aggressive' }, mode: 'idle', targetUid: null, home: { x, y } },` |
| `src/core/sim-combat.test.ts` | 49 | `ai: { def: { kind: 'aggressive' }, mode: 'idle', targetUid: null, home: { ...pos } },` |
| `src/core/ai.test.ts` | 21 | `ai: def ? { def, mode: 'idle', targetUid: null, home } : null,` |

直したあとの形（`src/core/sim.test.ts:18` の例）。

```ts
    ai: { def: ai, mode: 'idle', targetUid: null, home: { ...pos }, spottedAt: null },
```

`src/core/ai.test.ts:21` は三項演算子の中なので、こう直す。

```ts
    ai: def ? { def, mode: 'idle', targetUid: null, home, spottedAt: null } : null,
```

Run: `npm run build`
Expected: 型エラーが出ない（残っていれば、そのファイルの `AiState` リテラルも同じ形で直す）

- [ ] **Step 6: シムで記録する**

`src/core/sim.ts` の `updateAi` を差し替える。

```ts
function updateAi(state: BattleState): void {
  for (const u of state.units) {
    if (u.retired || u.controller !== 'ai' || u.ai === null) continue;
    const behavior = AI_BEHAVIORS[u.ai.def.kind];
    if (!behavior) continue;
    const decision = behavior({ self: u, hostiles: hostilesOf(state, u), grid: state.grid });
    // chase へ入った瞬間だけ時刻を打つ。追い続けているあいだ更新すると印が消えない
    if (decision.mode === 'chase') {
      if (u.ai.mode !== 'chase') u.ai.spottedAt = state.time;
    } else {
      u.ai.spottedAt = null;
    }
    u.ai.mode = decision.mode;
    u.ai.targetUid = decision.targetUid;
    u.goalPos = decision.goal;
  }
}
```

- [ ] **Step 7: 表示側に時間の窓を入れる**

`src/render/objectives-view.ts` の `alertMarks` を差し替える。

```ts
/** 「気づかれた」印を出しておく長さ（秒） */
export const ALERT_MARK_DURATION = 2.0;

/**
 * 気づかれた敵。索敵範囲そのものは見せない。
 * 範囲が見えると「どこまでなら近づけるか」を測る作業になって緊張感が削がれるため、
 * 気づかれたことだけを伝える。
 *
 * 印は発見の瞬間から ALERT_MARK_DURATION のあいだだけ出す。追跡中ずっと出すと
 * 交戦中も出たままになり、「いま気づかれた」という意味を失う。
 * aggressive は開始時から追ってくるので対象外（常に印が出て意味を持たなくなる）
 */
export function alertMarks(units: Unit[], time: number): AlertMark[] {
  const out: AlertMark[] = [];
  for (const u of units) {
    if (u.retired || u.side !== 'enemy' || u.ai === null) continue;
    if (u.ai.def.kind === 'aggressive') continue;
    const spottedAt = u.ai.spottedAt;
    if (spottedAt === null || time - spottedAt > ALERT_MARK_DURATION) continue;
    out.push({ pos: { ...u.pos }, defId: u.defId });
  }
  return out;
}
```

`src/render/draw.ts:97` の呼び出しに時刻を渡す。

```ts
  for (const m of alertMarks(state.units, state.time)) {
```

- [ ] **Step 8: テストが通ることを確かめる**

Run: `npm test && npm run build`
Expected: どちらも成功

- [ ] **Step 9: コミット**

```bash
git add src/core/types.ts src/core/state.ts src/core/sim.ts src/core/sim.test.ts \
        src/core/skills.test.ts src/core/sim-combat.test.ts src/core/ai.test.ts \
        src/render/objectives-view.ts src/render/objectives-view.test.ts src/render/draw.ts
git commit -m "fix: 敵発見の「！」を発見から2秒だけ出す"
```

---

### Task 4: スクロールの純関数とレイアウトを用意する

ステージが10本になると、いまの2列グリッドでは仲間一覧と重なる。
先に計算だけを純関数として作り、テストを付ける。描画と入力は次のタスク。

**Files:**
- Create: `src/ui/scroll.ts`
- Create: `src/ui/scroll.test.ts`
- Modify: `src/ui/layout.ts:31-36`
- Test: `src/ui/layout.test.ts`

**Interfaces:**
- Consumes: `TAP_SLOP`（既存、`src/ui/input.ts`、値は 12）
- Produces:
  - `maxScroll(contentH: number, viewH: number): number`
  - `clampScroll(offset: number, max: number): number`
  - `isTap(dy: number): boolean`
  - `STAGE_LIST_VIEW: Rect`（`src/ui/layout.ts`）
  - `stageListContentH(count: number): number`（`src/ui/layout.ts`）

- [ ] **Step 1: 失敗するテストを書く**

`src/ui/scroll.test.ts` を新規作成する。

```ts
import { describe, expect, it } from 'vitest';
import { clampScroll, isTap, maxScroll } from './scroll';

describe('maxScroll', () => {
  it('収まるなら 0', () => {
    expect(maxScroll(300, 480)).toBe(0);
    expect(maxScroll(480, 480)).toBe(0);
  });

  it('あふれたぶんを返す', () => {
    expect(maxScroll(700, 480)).toBe(220);
  });
});

describe('clampScroll', () => {
  it('0 より小さくならない', () => {
    expect(clampScroll(-50, 220)).toBe(0);
  });

  it('max より大きくならない', () => {
    expect(clampScroll(999, 220)).toBe(220);
  });

  it('あいだは そのまま', () => {
    expect(clampScroll(100, 220)).toBe(100);
  });

  it('max が 0 なら つねに 0', () => {
    expect(clampScroll(100, 0)).toBe(0);
  });
});

describe('isTap', () => {
  it('動いていなければ タップ', () => {
    expect(isTap(0)).toBe(true);
  });

  it('上下どちらの向きでも 同じ しきい値', () => {
    expect(isTap(12)).toBe(true);
    expect(isTap(-12)).toBe(true);
    expect(isTap(13)).toBe(false);
    expect(isTap(-13)).toBe(false);
  });
});
```

`src/ui/layout.test.ts` の末尾に足す。

```ts
describe('ステージ一覧のスクロール', () => {
  it('3本なら 見える範囲に収まる', () => {
    expect(stageListContentH(3)).toBeLessThanOrEqual(STAGE_LIST_VIEW.h);
  });

  it('10本なら あふれる', () => {
    expect(stageListContentH(10)).toBeGreaterThan(STAGE_LIST_VIEW.h);
  });

  it('最終行の下端を含む高さを返す', () => {
    const last = stageSlot(9);
    expect(stageListContentH(10)).toBe(last.y + last.h - STAGE_LIST_VIEW.y);
  });

  it('0本なら 0', () => {
    expect(stageListContentH(0)).toBe(0);
  });

  it('見える範囲は 仲間一覧に かぶらない', () => {
    expect(STAGE_LIST_VIEW.y + STAGE_LIST_VIEW.h).toBeLessThanOrEqual(rosterSlot(0).y);
  });
});
```

`stageSlot` と `rosterSlot` は `src/ui/layout.test.ts` の既存の import にあるので、
足すのは `STAGE_LIST_VIEW` と `stageListContentH` の2つだけ。

- [ ] **Step 2: テストが落ちることを確かめる**

Run: `npx vitest run src/ui/scroll.test.ts src/ui/layout.test.ts`
Expected: FAIL（`src/ui/scroll.ts` が無い、`STAGE_LIST_VIEW` が無い）

- [ ] **Step 3: `src/ui/scroll.ts` を書く**

```ts
import { TAP_SLOP } from './input';

/**
 * 縦スクロールの計算。描画にも入力にも属さないので独立させる。
 * ステージ選択の一覧が画面に収まらなくなったため用意した
 */

/** 内容が見える範囲に収まりきらないぶんの高さ。収まるなら 0 */
export function maxScroll(contentH: number, viewH: number): number {
  return Math.max(0, contentH - viewH);
}

/** スクロール位置を 0〜max に収める */
export function clampScroll(offset: number, max: number): number {
  return Math.min(max, Math.max(0, offset));
}

/**
 * 指を離したときにタップ扱いにするか。しきい値は盤面のドラッグ判定と同じ
 * TAP_SLOP を使う。画面ごとに違う値にすると、同じ指の動きが場所によって
 * タップになったりならなかったりする
 */
export function isTap(dy: number): boolean {
  return Math.abs(dy) <= TAP_SLOP;
}
```

- [ ] **Step 4: `src/ui/layout.ts` に足す**

既存の `stageSlot` の直前・直後に置く。`stageSlot` 自体は変えない。

```ts
/**
 * ステージ一覧の見える範囲。ここでクリップして中身をスクロールさせる。
 * 下端は rosterSlot(0) の上に収める（仲間一覧は下に固定で出す）
 */
export const STAGE_LIST_VIEW: Rect = { x: 0, y: 140, w: 540, h: 480 };

/** ステージ選択ボタン。2れつ×なんぎょうの グリッド */
export function stageSlot(index: number): Rect {
  const col = index % 2;
  const row = Math.floor(index / 2);
  return { x: 20 + col * 260, y: 160 + row * 140, w: 240, h: 120 };
}

/** ステージ一覧の中身の高さ。STAGE_LIST_VIEW の上端から最終行の下端まで */
export function stageListContentH(count: number): number {
  if (count <= 0) return 0;
  const last = stageSlot(count - 1);
  return last.y + last.h - STAGE_LIST_VIEW.y;
}
```

`STAGE_LIST_VIEW.y + h = 620`、`rosterSlot(0).y = 640` なので重ならない。
10本のとき `stageSlot(9)` は `y = 160 + 4 * 140 = 720`、`h = 120` で下端 840、
`stageListContentH(10) = 700` となり、見える範囲 480 を 220 あふれる。

- [ ] **Step 5: テストが通ることを確かめる**

Run: `npm test && npm run build`
Expected: どちらも成功

- [ ] **Step 6: コミット**

```bash
git add src/ui/scroll.ts src/ui/scroll.test.ts src/ui/layout.ts src/ui/layout.test.ts
git commit -m "feat: ステージ一覧の縦スクロールの計算を用意する"
```

---

### Task 5: ステージ選択をスクロールできるようにする

Task 4 の純関数を使って、描画をクリップし、入力を pointerdown 即決定から
pointerup 判定へ移す。

**Files:**
- Modify: `src/ui/screens.ts:77-99`（`drawStageSelect`）
- Modify: `src/main.ts`（import、状態、`onPointerDown` / `onPointerMove` / `onPointerUp` / `onPointerCancel`、`phase = 'select'` の4か所、描画呼び出し）

**Interfaces:**
- Consumes: `maxScroll` / `clampScroll` / `isTap`（`src/ui/scroll.ts`）、`STAGE_LIST_VIEW` / `stageListContentH`（`src/ui/layout.ts`）
- Produces: `drawStageSelect(ctx, reg, save, images, scrollY: number)` — 第5引数が増える

- [ ] **Step 1: 描画をクリップしてスクロールさせる**

`src/ui/screens.ts` の import に `STAGE_LIST_VIEW` と `stageListContentH` を足し、
`../ui/scroll` から `maxScroll` を足す（同じディレクトリなので `./scroll`）。

`drawStageSelect` を差し替える。

```ts
export function drawStageSelect(
  ctx: CanvasRenderingContext2D,
  reg: Registry,
  save: SaveData,
  images: ImageCache,
  scrollY: number,
): void {
  clear(ctx);
  ctx.fillStyle = INK;
  ctx.font = '30px sans-serif';
  ctx.fillText('どの ステージに 行く？', 40, 100);

  const v = STAGE_LIST_VIEW;
  ctx.save();
  ctx.beginPath();
  ctx.rect(v.x, v.y, v.w, v.h);
  ctx.clip();
  ctx.translate(0, -scrollY);

  reg.stages.forEach((stage, i) => {
    const r = stageSlot(i);
    const unlocked = isStageUnlocked(reg, save, i);
    panel(ctx, r, unlocked ? '#2c4a63' : '#2a2f35');
    ctx.fillStyle = unlocked ? INK : '#78808a';
    ctx.font = '22px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(unlocked ? stage.name : 'まだ 行けない', r.x + r.w / 2, r.y + 50);
    ctx.font = '18px sans-serif';
    if (unlocked && save.clearedStageIds.includes(stage.id)) ctx.fillText('クリア済み', r.x + r.w / 2, r.y + 88);
    ctx.textAlign = 'left';
  });

  ctx.restore();
  drawScrollBar(ctx, reg.stages.length, scrollY);
  drawRoster(ctx, reg, save, images);
}

/**
 * まだ下に続きがあることを見せる。出さないと、画面に収まっている数が
 * 全部だと思われる。収まりきっているときは出さない
 */
function drawScrollBar(ctx: CanvasRenderingContext2D, count: number, scrollY: number): void {
  const v = STAGE_LIST_VIEW;
  const max = maxScroll(stageListContentH(count), v.h);
  if (max <= 0) return;

  const trackX = v.x + v.w - 10;
  const thumbH = Math.max(40, (v.h * v.h) / stageListContentH(count));
  const thumbY = v.y + (v.h - thumbH) * (scrollY / max);
  ctx.fillStyle = 'rgba(242, 239, 228, 0.18)';
  ctx.fillRect(trackX, v.y, 4, v.h);
  ctx.fillStyle = 'rgba(242, 239, 228, 0.55)';
  ctx.fillRect(trackX, thumbY, 4, thumbH);
}
```

- [ ] **Step 2: `src/main.ts` に状態を足す**

import に足す。

```ts
import { clampScroll, isTap, maxScroll } from './ui/scroll';
import { STAGE_LIST_VIEW, stageListContentH } from './ui/layout';
```

（`./ui/layout` からの import は既存の一括 import に足す）

状態の宣言（`let dragMap: Vec2 | null = null;` の下あたり）に足す。

```ts
/**
 * ステージ選択の縦スクロール。盤面のドラッグ（pointerStart / dragMap）とは
 * 別系統で持つ。1つに混ぜると、フェーズごとに意味の違う値が同じ変数に入って読めなくなる
 */
let stageScrollY = 0;
let stageDrag: { pointerId: number; startY: number; startScrollY: number } | null = null;

function stageScrollMax(): number {
  return maxScroll(stageListContentH(registry.stages.length), STAGE_LIST_VIEW.h);
}

/** 選択画面に入るたびに一番上へ戻す */
function toStageSelect(): void {
  stageScrollY = 0;
  stageDrag = null;
  phase = 'select';
}
```

- [ ] **Step 3: `phase = 'select'` を4か所とも差し替える**

`src/main.ts:164`、`:166`、`:219`、`:224` の `phase = 'select';` を
`toStageSelect();` に置き換える。`:219` と `:224` は
`if (hitRect(BTN.next, p)) phase = 'select';` のような1行の形なので、
`if (hitRect(BTN.next, p)) toStageSelect();` にする。

- [ ] **Step 4: `onPointerDown` の select を書き換える**

いまは pointerdown で即 `beginStage` している。ここではドラッグの開始だけを覚える。

```ts
    case 'select':
      if (hitRect(STAGE_LIST_VIEW, p)) {
        stageDrag = { pointerId: ev.pointerId, startY: p.y, startScrollY: stageScrollY };
        canvas.setPointerCapture(ev.pointerId);
      }
      return;
```

- [ ] **Step 5: `onPointerMove` / `onPointerUp` / `onPointerCancel` を足す**

`onPointerMove` の先頭（既存の `pointerStart` の判定より前）に足す。

```ts
function onPointerMove(ev: PointerEvent): void {
  if (stageDrag && ev.pointerId === stageDrag.pointerId) {
    const dy = toLogical(ev).y - stageDrag.startY;
    stageScrollY = clampScroll(stageDrag.startScrollY - dy, stageScrollMax());
    return;
  }
  if (!pointerStart || ev.pointerId !== pointerStart.pointerId) return;
  dragMap = logicalToMap(toLogical(ev));
}
```

`onPointerUp` の先頭に足す。

```ts
function onPointerUp(ev: PointerEvent): void {
  if (stageDrag && ev.pointerId === stageDrag.pointerId) {
    const start = stageDrag;
    stageDrag = null;
    const p = toLogical(ev);
    // 指がほとんど動いていなければ選んだとみなす。動いていればスクロールだった
    if (phase === 'select' && isTap(p.y - start.startY)) {
      const hit = { x: p.x, y: p.y + stageScrollY };
      for (let i = 0; i < registry.stages.length; i++) {
        if (hitRect(stageSlot(i), hit) && isStageUnlocked(registry, save, i)) beginStage(i);
      }
    }
    return;
  }
  if (!pointerStart || ev.pointerId !== pointerStart.pointerId) return;
  // ...以下は既存のまま
```

`hit` の y に `stageScrollY` を足すのは、`stageSlot` が中身の座標系で、
指の位置が画面の座標系だから。描画で `translate(0, -scrollY)` している
ぶんを、当たり判定では逆向きに足して戻す。

`onPointerCancel` の先頭に足す。

```ts
function onPointerCancel(ev: PointerEvent): void {
  if (stageDrag && ev.pointerId === stageDrag.pointerId) {
    stageDrag = null;
    return;
  }
  if (!pointerStart || ev.pointerId !== pointerStart.pointerId) return;
```

`isStageUnlocked` と `stageSlot` が `src/main.ts` に import 済みであることを確かめる
（どちらも既存の import にある）。

- [ ] **Step 6: 描画の呼び出しを直す**

`src/main.ts:358`。

```ts
      drawStageSelect(ctx, registry, save, images, stageScrollY);
```

- [ ] **Step 7: 型チェックとテストを通す**

Run: `npm test && npm run build`
Expected: どちらも成功

- [ ] **Step 8: ブラウザで確かめる**

README の CDP 手順でヘッドレス Chromium を起動し、ステージ選択画面を出す。
いまはステージが3本なのでスクロールは効かない（`maxScroll` が 0）。
確かめるのは**タップで今までどおりステージに入れること**と、
**位置バーが出ていないこと**の2点。スクロールそのものは Task 9 のあとで見る。

- [ ] **Step 9: コミット**

```bash
git add src/ui/screens.ts src/main.ts
git commit -m "feat: ステージ選択を縦スクロールできるようにする"
```

---

### Task 6: 遠距離の敵を2種足す

いまの敵は3種とも `melee` なので、地形の意味が薄い。弓とまじないの敵を足す。

**Files:**
- Modify: `tools/gen-placeholder-sprites.mjs:196-212`（`CHARS` と `ROLES`）
- Create: `assets/enemies/yumihei.json`
- Create: `assets/enemies/majinaishi.json`
- Create（生成物）: `assets/images/yumihei-map.png`、`yumihei-face.png`、`majinaishi-map.png`、`majinaishi-face.png`、`role-teki-yumi.png`、`role-teki-mahou.png`

**Interfaces:**
- Consumes: なし
- Produces: 敵の defId `yumihei` と `majinaishi`（Task 7〜9 のステージが参照する）

- [ ] **Step 1: 生成器に足す**

`tools/gen-placeholder-sprites.mjs` の `CHARS` の末尾に足す。

```js
  { id: 'yumihei', color: '#7a6a3a', weapon: 'bow', frame: 32 },
  { id: 'majinaishi', color: '#6a4a8a', weapon: 'staff', frame: 32 },
```

`ROLES` の末尾に足す。既存の `role-teki` は剣なので、遠距離ぶんを別に用意する。

```js
  ['role-teki-yumi', 'bow', '#7a6a3a'],
  ['role-teki-mahou', 'staff', '#6a4a8a'],
```

- [ ] **Step 2: 絵を生成する**

Run: `node tools/gen-placeholder-sprites.mjs`
Expected: `yumihei-map.png 128x384` などのログが出て、6枚の PNG が
`assets/images/` に増える（既存の PNG も上書きされるが中身は同じ）。

Run: `git status --short assets/images`
Expected: 6枚が `??`（新規）で出る。既存の PNG が `M` になっていないこと。
なっていたら生成器の共通部分を触ってしまっているので、その変更を戻す。

- [ ] **Step 3: 敵の定義を書く**

`assets/enemies/yumihei.json`。

```json
{
  "id": "yumihei", "name": "弓兵", "role": "敵",
  "combat": true,
  "maxHp": 10, "power": 4, "guard": 0,
  "attack": "bow", "range": 120,
  "attackInterval": 1.8, "speed": 30,
  "skillId": null,
  "color": "#7a6a3a",
  "sprites": {
    "role": "role-teki-yumi.png",
    "face": "yumihei-face.png",
    "map": {
      "sheet": "yumihei-map.png", "frame": 32,
      "idle": { "frames": 2, "fps": 4 },
      "walk": { "frames": 4, "fps": 8 },
      "attack": { "frames": 3, "fps": 12 }
    }
  },
  "xpReward": 10, "bowDamageCap": null, "fleeAtHpRatio": null
}
```

`assets/enemies/majinaishi.json`。

```json
{
  "id": "majinaishi", "name": "まじない師", "role": "敵",
  "combat": true,
  "maxHp": 9, "power": 7, "guard": 0,
  "attack": "magic", "range": 140,
  "attackInterval": 2.6, "speed": 24,
  "skillId": null,
  "color": "#6a4a8a",
  "sprites": {
    "role": "role-teki-mahou.png",
    "face": "majinaishi-face.png",
    "map": {
      "sheet": "majinaishi-map.png", "frame": 32,
      "idle": { "frames": 2, "fps": 4 },
      "walk": { "frames": 4, "fps": 8 },
      "attack": { "frames": 3, "fps": 12 }
    }
  },
  "xpReward": 14, "bowDamageCap": null, "fleeAtHpRatio": null
}
```

- [ ] **Step 4: テストを通す**

Run: `npm test`
Expected: PASS。`src/engine/sheet-size.test.ts` が実ファイルの寸法と JSON を
突き合わせるので、シートの列数・行数がずれていればここで落ちる。

- [ ] **Step 5: 型チェックを通す**

Run: `npm run build`
Expected: 成功

- [ ] **Step 6: コミット**

```bash
git add tools/gen-placeholder-sprites.mjs assets/enemies/yumihei.json assets/enemies/majinaishi.json assets/images
git commit -m "feat: 遠距離の敵（弓兵・まじない師）を足す"
```

---

### Task 7: 新ステージ stage4・stage5 を足す

以降、ステージ JSON は「全ステージ共通の骨格」（この計画の冒頭）の
フィールドをそのまま持ち、`id` / `order` / `name` / `mapRows` / `enemies` /
`spawners` / `intro` / `outro` だけを差し替える。書き方の見本として、
**stage4 だけは完全な JSON を載せる**。stage5 以降は差分だけを示す。

**Files:**
- Create: `assets/stages/stage4.json`、`assets/stages/stage5.json`

**Interfaces:**
- Consumes: 敵の defId `yumihei`（Task 6）
- Produces: なし

- [ ] **Step 1: `assets/stages/stage4.json` を書く**

弓兵の初登場。横に走る壁のすきまが渡り口になっていて、
そこを狙って弓兵が構えている。遮蔽の取り方を覚えるステージ。

```json
{
  "id": "stage4",
  "order": 30,
  "name": "川原の 渡し",
  "cell": 32,
  "mapRows": [
    "################",
    "#..............#",
    "#..............#",
    "#..............#",
    "#..............#",
    "#..............#",
    "####.......#####",
    "####.......#####",
    "#..............#",
    "#..............#",
    "#..............#",
    "#####....#######",
    "#####....#######",
    "#..............#",
    "#..............#",
    "#..............#",
    "#..............#",
    "#..............#",
    "#..............#",
    "#..............#",
    "#..............#",
    "#..............#",
    "################"
  ],
  "placement": {
    "minY": 528,
    "starts": [
      { "x": 144, "y": 656 },
      { "x": 240, "y": 656 },
      { "x": 144, "y": 592 },
      { "x": 240, "y": 592 }
    ]
  },
  "roster": ["roran", "ines", "mist", "gau"],
  "enemies": [
    { "defId": "narazumono", "pos": { "x": 208, "y": 464 }, "ai": { "kind": "sentry", "sightRange": 100 } },
    { "defId": "narazumono", "pos": { "x": 240, "y": 400 }, "ai": { "kind": "sentry", "sightRange": 100 } },
    { "defId": "yumihei",    "pos": { "x": 176, "y": 272 }, "ai": { "kind": "sentry", "sightRange": 130 } },
    { "defId": "yumihei",    "pos": { "x": 272, "y": 272 }, "ai": { "kind": "sentry", "sightRange": 130 } },
    { "defId": "tatemochi",  "pos": { "x": 240, "y": 144 }, "ai": { "kind": "aggressive" } }
  ],
  "victory": { "type": "reach", "pos": { "x": 240, "y": 48 }, "radius": 40, "by": "any" },
  "defeat": [{ "type": "unitLost", "defIds": ["roran"] }],
  "intro": [
    { "text": "川の 音が 近づいてきた。" },
    { "speaker": "gau", "text": "渡れる 場所は\nひとつしか ないみたいだ" },
    { "speaker": "ines", "text": "向こう岸に 弓を 持った 敵。\n壁の かげを 使って 進もう" }
  ],
  "outro": [
    { "speaker": "roran", "text": "渡りきった。\nみんな 無事だね" },
    { "text": "川の 向こうは、まだ 見えない。" }
  ]
}
```

座標の確かめかた: 列 c 行 r の中心は `x = c * 32 + 16`、`y = r * 32 + 16`。
`(208, 464)` は列6行14、`(240, 400)` は列7行12、`(176, 272)` は列5行8、
`(272, 272)` は列8行8、`(240, 144)` は列7行4。行12 は `#####....#######`
で歩けるのは列5〜8、行8 と行14 と行4 は全部開いている。すべて `y < 528`。

- [ ] **Step 2: `assets/stages/stage5.json` を書く**

sentry が多く、ブロックで視線が切れる。見つからずに抜けられる道を探すステージ。
共通の骨格は stage4 と同じ。差し替えるのは次のフィールド。

`id`: `stage5`、`order`: `40`、`name`: `森の 細道`

```json
  "mapRows": [
    "################",
    "#..............#",
    "#..###....###..#",
    "#..###....###..#",
    "#..............#",
    "#.###..##..###.#",
    "#.###..##..###.#",
    "#..............#",
    "#..##..##..##..#",
    "#..##..##..##..#",
    "#..............#",
    "#.###..##..###.#",
    "#.###..##..###.#",
    "#..............#",
    "#..###....###..#",
    "#..###....###..#",
    "#..............#",
    "#..............#",
    "#..............#",
    "#..............#",
    "#..............#",
    "#..............#",
    "################"
  ],
  "enemies": [
    { "defId": "narazumono", "pos": { "x": 144, "y": 432 }, "ai": { "kind": "sentry", "sightRange": 90 } },
    { "defId": "narazumono", "pos": { "x": 336, "y": 432 }, "ai": { "kind": "sentry", "sightRange": 90 } },
    { "defId": "yumihei",    "pos": { "x": 112, "y": 336 }, "ai": { "kind": "sentry", "sightRange": 130 } },
    { "defId": "tatemochi",  "pos": { "x": 240, "y": 336 }, "ai": { "kind": "sentry", "sightRange": 110 } },
    { "defId": "narazumono", "pos": { "x": 144, "y": 240 }, "ai": { "kind": "sentry", "sightRange": 90 } },
    { "defId": "narazumono", "pos": { "x": 336, "y": 240 }, "ai": { "kind": "sentry", "sightRange": 90 } },
    { "defId": "yumihei",    "pos": { "x": 240, "y": 144 }, "ai": { "kind": "sentry", "sightRange": 130 } }
  ],
  "intro": [
    { "text": "木が 立ちならんで、先が 見えない。" },
    { "speaker": "mist", "text": "気配が いくつも あります。\n数は 多そう" },
    { "speaker": "roran", "text": "全部と 戦わなくて いい。\n見つからない 道を 探そう" }
  ],
  "outro": [
    { "speaker": "gau", "text": "抜けた！\n気づかれずに 済んだな" },
    { "speaker": "mist", "text": "森の 先に、石を 切る 音が します" }
  ]
```

行4 / 行7 / 行10 / 行13 は全部開いている行。`(144, 432)` は列4行13、
`(336, 432)` は列10行13、`(112, 336)` は列3行10、`(240, 336)` は列7行10、
`(144, 240)` は列4行7、`(336, 240)` は列10行7、`(240, 144)` は列7行4。
`spawners` は書かない（省略できる）。

- [ ] **Step 3: テストを通す**

Run: `npm test`
Expected: PASS。JSON が壊れていたり、敵が壁の中や線より下にいると
`testRegistry()` を使うテストが理由つきで落ちる。

- [ ] **Step 4: 型チェックを通す**

Run: `npm run build`
Expected: 成功

- [ ] **Step 5: コミット**

```bash
git add assets/stages/stage4.json assets/stages/stage5.json
git commit -m "feat: ステージ「川原の 渡し」「森の 細道」を足す"
```

---

### Task 8: 新ステージ stage6・stage7・stage8 を足す

**Files:**
- Create: `assets/stages/stage6.json`、`assets/stages/stage7.json`、`assets/stages/stage8.json`

**Interfaces:**
- Consumes: 敵の defId `yumihei` / `majinaishi`（Task 6）
- Produces: なし

- [ ] **Step 1: `assets/stages/stage6.json` を書く**

大きな岩の塊が正面をふさぎ、`guard` の盾持ちが通り道を守る。迂回を覚えるステージ。
共通の骨格は stage4 と同じ。`id`: `stage6`、`order`: `50`、`name`: `石切り場`

```json
  "mapRows": [
    "################",
    "#..............#",
    "#..............#",
    "#....######....#",
    "#....######....#",
    "#....######....#",
    "#..............#",
    "#..............#",
    "#######...######",
    "#######...######",
    "#..............#",
    "#..............#",
    "#..............#",
    "######...#######",
    "######...#######",
    "#..............#",
    "#..............#",
    "#..............#",
    "#..............#",
    "#..............#",
    "#..............#",
    "#..............#",
    "################"
  ],
  "enemies": [
    { "defId": "narazumono", "pos": { "x": 240, "y": 432 }, "ai": { "kind": "sentry", "sightRange": 100 } },
    { "defId": "tatemochi",  "pos": { "x": 240, "y": 368 }, "ai": { "kind": "guard", "post": { "x": 240, "y": 368 }, "leash": 140, "sightRange": 120 } },
    { "defId": "yumihei",    "pos": { "x": 272, "y": 272 }, "ai": { "kind": "sentry", "sightRange": 130 } },
    { "defId": "tatemochi",  "pos": { "x": 240, "y": 224 }, "ai": { "kind": "guard", "post": { "x": 240, "y": 224 }, "leash": 140, "sightRange": 120 } },
    { "defId": "narazumono", "pos": { "x": 144, "y": 208 }, "ai": { "kind": "sentry", "sightRange": 100 } },
    { "defId": "narazumono", "pos": { "x": 368, "y": 208 }, "ai": { "kind": "sentry", "sightRange": 100 } }
  ],
  "spawners": [
    { "defId": "narazumono", "pos": { "x": 240, "y": 80 }, "firstAfter": 25, "every": 18, "total": 3 }
  ],
  "intro": [
    { "text": "切りかけの 石が、山のように 積んである。" },
    { "speaker": "roran", "text": "正面は 岩で ふさがれてる。\n回りこもう" },
    { "speaker": "gau", "text": "盾を 持った やつが 通り道を 見てるぞ" }
  ],
  "outro": [
    { "speaker": "ines", "text": "岩を 抜けた。\n道は まだ 続いてる" },
    { "text": "遠くに、細い 塔が 立っていた。" }
  ]
```

行13 は `######...#######` で歩けるのは列6〜8。`(240, 432)` は列7行13 で入る。
行11 は開いているので `(240, 368)` は列7行11。行8 は `#######...######`
で歩けるのは列7〜9、`(272, 272)` は列8行8。`(240, 224)` は列7行7（開いている行）。
`(144, 208)` は列4行6、`(368, 208)` は列11行6（どちらも開いている行）。
時間湧きの `(240, 80)` は列7行2（開いている行）。すべて `y < 528`。

- [ ] **Step 2: `assets/stages/stage7.json` を書く**

まじない師の初登場。塔の中は狭く、逃げ場が少ない。
共通の骨格は stage4 と同じ。`id`: `stage7`、`order`: `60`、`name`: `まじない師の 塔`

```json
  "mapRows": [
    "################",
    "#..............#",
    "#..............#",
    "#..####..####..#",
    "#..####..####..#",
    "#..#........#..#",
    "#..#........#..#",
    "#..#..####..#..#",
    "#..#..####..#..#",
    "#..#........#..#",
    "#..#........#..#",
    "#..####..####..#",
    "#..####..####..#",
    "#..............#",
    "#..............#",
    "#..............#",
    "#..............#",
    "#..............#",
    "#..............#",
    "#..............#",
    "#..............#",
    "#..............#",
    "################"
  ],
  "enemies": [
    { "defId": "narazumono", "pos": { "x": 112, "y": 432 }, "ai": { "kind": "sentry", "sightRange": 100 } },
    { "defId": "narazumono", "pos": { "x": 368, "y": 432 }, "ai": { "kind": "sentry", "sightRange": 100 } },
    { "defId": "tatemochi",  "pos": { "x": 240, "y": 432 }, "ai": { "kind": "sentry", "sightRange": 110 } },
    { "defId": "majinaishi", "pos": { "x": 240, "y": 304 }, "ai": { "kind": "sentry", "sightRange": 150 } },
    { "defId": "yumihei",    "pos": { "x": 176, "y": 240 }, "ai": { "kind": "sentry", "sightRange": 130 } },
    { "defId": "yumihei",    "pos": { "x": 336, "y": 240 }, "ai": { "kind": "sentry", "sightRange": 130 } },
    { "defId": "majinaishi", "pos": { "x": 240, "y": 176 }, "ai": { "kind": "sentry", "sightRange": 150 } }
  ],
  "intro": [
    { "text": "塔の 中は うす暗く、風の 音だけが する。" },
    { "speaker": "mist", "text": "まじないの 気配です。\n遠くから 撃ってきます" },
    { "speaker": "roran", "text": "一気に 詰めよう。\n止まっていると 当てられる" }
  ],
  "outro": [
    { "speaker": "mist", "text": "まじないが 止みました" },
    { "speaker": "roran", "text": "上へ 抜けよう。\nまだ 先は ある" }
  ]
```

行5 と行9 と行10 は `#..#........#..#` で歩けるのは列4〜11。`(240, 304)` は列7行9、
`(240, 176)` は列7行5。行7 は `#..#..####..#..#` で歩けるのは列1・2・4・5・10・11・13・14。
`(176, 240)` は列5行7、`(336, 240)` は列10行7。行13 は開いているので
`(112, 432)` は列3行13、`(240, 432)` は列7行13、`(368, 432)` は列11行13。
`spawners` は書かない。

- [ ] **Step 3: `assets/stages/stage8.json` を書く**

関所。柱のあいだを縫って進む。混成に加えて時間湧きがあるので、長引かせられない。
共通の骨格は stage4 と同じ。`id`: `stage8`、`order`: `70`、`name`: `関所`

```json
  "mapRows": [
    "################",
    "#..............#",
    "#....#....#....#",
    "#....#....#....#",
    "#....#....#....#",
    "#..............#",
    "#..............#",
    "##....####....##",
    "##....####....##",
    "#..............#",
    "#..............#",
    "#....#....#....#",
    "#....#....#....#",
    "#....#....#....#",
    "#..............#",
    "#..............#",
    "#..............#",
    "#..............#",
    "#..............#",
    "#..............#",
    "#..............#",
    "#..............#",
    "################"
  ],
  "enemies": [
    { "defId": "narazumono", "pos": { "x": 176, "y": 464 }, "ai": { "kind": "sentry", "sightRange": 100 } },
    { "defId": "narazumono", "pos": { "x": 336, "y": 464 }, "ai": { "kind": "sentry", "sightRange": 100 } },
    { "defId": "majinaishi", "pos": { "x": 240, "y": 336 }, "ai": { "kind": "sentry", "sightRange": 150 } },
    { "defId": "yumihei",    "pos": { "x": 112, "y": 304 }, "ai": { "kind": "sentry", "sightRange": 130 } },
    { "defId": "yumihei",    "pos": { "x": 400, "y": 304 }, "ai": { "kind": "sentry", "sightRange": 130 } },
    { "defId": "tatemochi",  "pos": { "x": 176, "y": 176 }, "ai": { "kind": "guard", "post": { "x": 176, "y": 176 }, "leash": 130, "sightRange": 120 } },
    { "defId": "tatemochi",  "pos": { "x": 336, "y": 176 }, "ai": { "kind": "guard", "post": { "x": 336, "y": 176 }, "leash": 130, "sightRange": 120 } }
  ],
  "spawners": [
    { "defId": "narazumono", "pos": { "x": 112, "y": 48 }, "firstAfter": 20, "every": 15, "total": 3 },
    { "defId": "yumihei",    "pos": { "x": 368, "y": 48 }, "firstAfter": 30, "every": 20, "total": 2 }
  ],
  "intro": [
    { "text": "道を ふさぐように、関所が 建っている。" },
    { "speaker": "gau", "text": "奥から 増えてくるぞ。\nもたもたしてられない" },
    { "speaker": "roran", "text": "決めて 進もう。\n止まったら 囲まれる" }
  ],
  "outro": [
    { "speaker": "roran", "text": "門を 抜けた" },
    { "speaker": "ines", "text": "この 先は ガルムの 領地です" }
  ]
```

行1 / 行5 / 行6 / 行9 / 行10 / 行14 は全部開いている行。`(176, 464)` は列5行14、
`(336, 464)` は列10行14、`(240, 336)` は列7行10、`(112, 304)` は列3行9、
`(400, 304)` は列12行9、`(176, 176)` は列5行5、`(336, 176)` は列10行5。
時間湧きの `(112, 48)` は列3行1、`(368, 48)` は列11行1。
勝利地点は `(240, 48)`（列7行1）なので、湧き口はそこから離して置いてある。

- [ ] **Step 4: テストと型チェックを通す**

Run: `npm test && npm run build`
Expected: どちらも成功

- [ ] **Step 5: コミット**

```bash
git add assets/stages/stage6.json assets/stages/stage7.json assets/stages/stage8.json
git commit -m "feat: ステージ「石切り場」「まじない師の 塔」「関所」を足す"
```

---

### Task 9: 新ステージ stage9・stage10 を足し、ガルム戦を最後尾へ移す

**Files:**
- Create: `assets/stages/stage9.json`、`assets/stages/stage10.json`
- Modify: `assets/stages/stage3.json`（`order` を 30 → 100）
- Test: `src/engine/registry.test.ts`

**Interfaces:**
- Consumes: 敵の defId `yumihei` / `majinaishi`（Task 6）
- Produces: `reg.stages` が10本になる

- [ ] **Step 1: 失敗するテストを書く**

`src/engine/registry.test.ts` の末尾に足す。実アセットを読むので `testRegistry` を使う
（同ファイル冒頭で import 済み）。

```ts
describe('実アセットのステージ', () => {
  it('10本ある', () => {
    expect(testRegistry().stages.length).toBe(10);
  });

  it('order は昇順で 重複しない', () => {
    const orders = testRegistry().stages.map((s) => s.order);
    expect(orders).toEqual([...orders].sort((a, b) => a - b));
    expect(new Set(orders).size).toBe(orders.length);
  });

  it('ガルム戦が いちばん最後', () => {
    const stages = testRegistry().stages;
    expect(stages[stages.length - 1]!.id).toBe('stage3');
  });
});
```

- [ ] **Step 2: テストが落ちることを確かめる**

Run: `npx vitest run src/engine/registry.test.ts`
Expected: FAIL（いまは8本で、最後は stage8）

- [ ] **Step 3: `assets/stages/stage9.json` を書く**

夜の野営地。sentry が密に置かれていて、正面から行くと次々に気づかれる。
共通の骨格は stage4 と同じ。`id`: `stage9`、`order`: `80`、`name`: `夜の 野営地`

```json
  "mapRows": [
    "################",
    "#..............#",
    "#..............#",
    "#...##....##...#",
    "#...##....##...#",
    "#..............#",
    "#..............#",
    "#..##..##..##..#",
    "#..##..##..##..#",
    "#..............#",
    "#..............#",
    "#...##....##...#",
    "#...##....##...#",
    "#..............#",
    "#..............#",
    "#..............#",
    "#..............#",
    "#..............#",
    "#..............#",
    "#..............#",
    "#..............#",
    "#..............#",
    "################"
  ],
  "enemies": [
    { "defId": "narazumono", "pos": { "x": 144, "y": 432 }, "ai": { "kind": "sentry", "sightRange": 90 } },
    { "defId": "tatemochi",  "pos": { "x": 336, "y": 432 }, "ai": { "kind": "sentry", "sightRange": 110 } },
    { "defId": "narazumono", "pos": { "x": 176, "y": 304 }, "ai": { "kind": "sentry", "sightRange": 90 } },
    { "defId": "yumihei",    "pos": { "x": 240, "y": 304 }, "ai": { "kind": "sentry", "sightRange": 130 } },
    { "defId": "narazumono", "pos": { "x": 336, "y": 304 }, "ai": { "kind": "sentry", "sightRange": 90 } },
    { "defId": "narazumono", "pos": { "x": 112, "y": 176 }, "ai": { "kind": "sentry", "sightRange": 90 } },
    { "defId": "yumihei",    "pos": { "x": 240, "y": 176 }, "ai": { "kind": "sentry", "sightRange": 130 } },
    { "defId": "narazumono", "pos": { "x": 368, "y": 176 }, "ai": { "kind": "sentry", "sightRange": 90 } },
    { "defId": "majinaishi", "pos": { "x": 240, "y": 80 },  "ai": { "kind": "aggressive" } }
  ],
  "intro": [
    { "text": "たき火が いくつも ともっている。" },
    { "speaker": "gau", "text": "見張りだらけだ。\n一度 気づかれたら 全部 来るぞ" },
    { "speaker": "mist", "text": "火の 届かない ところを 選びましょう" }
  ],
  "outro": [
    { "speaker": "gau", "text": "静かなままで 抜けられた" },
    { "speaker": "roran", "text": "次で ガルムの 門だ。\n休んでから 行こう" }
  ]
```

行5 / 行6 / 行9 / 行10 / 行13 / 行2 は全部開いている行。`(144, 432)` は列4行13、
`(336, 432)` は列10行13、`(176, 304)` は列5行9、`(240, 304)` は列7行9、
`(336, 304)` は列10行9、`(112, 176)` は列3行5、`(240, 176)` は列7行5、
`(368, 176)` は列11行5、`(240, 80)` は列7行2。

- [ ] **Step 4: `assets/stages/stage10.json` を書く**

ガルムの門前。これまで出た敵が全部そろう総力戦。
共通の骨格は stage4 と同じ。`id`: `stage10`、`order`: `90`、`name`: `ガルムの 門前`

```json
  "mapRows": [
    "################",
    "#..............#",
    "#...########...#",
    "#...########...#",
    "#..............#",
    "#..............#",
    "#.####....####.#",
    "#.####....####.#",
    "#..............#",
    "#..............#",
    "####........####",
    "####........####",
    "#..............#",
    "#..............#",
    "#.####....####.#",
    "#.####....####.#",
    "#..............#",
    "#..............#",
    "#..............#",
    "#..............#",
    "#..............#",
    "#..............#",
    "################"
  ],
  "enemies": [
    { "defId": "narazumono", "pos": { "x": 208, "y": 448 }, "ai": { "kind": "sentry", "sightRange": 100 } },
    { "defId": "narazumono", "pos": { "x": 272, "y": 448 }, "ai": { "kind": "sentry", "sightRange": 100 } },
    { "defId": "yumihei",    "pos": { "x": 144, "y": 288 }, "ai": { "kind": "sentry", "sightRange": 130 } },
    { "defId": "narazumono", "pos": { "x": 240, "y": 288 }, "ai": { "kind": "sentry", "sightRange": 100 } },
    { "defId": "yumihei",    "pos": { "x": 368, "y": 288 }, "ai": { "kind": "sentry", "sightRange": 130 } },
    { "defId": "tatemochi",  "pos": { "x": 176, "y": 160 }, "ai": { "kind": "guard", "post": { "x": 176, "y": 160 }, "leash": 150, "sightRange": 120 } },
    { "defId": "majinaishi", "pos": { "x": 240, "y": 128 }, "ai": { "kind": "sentry", "sightRange": 150 } },
    { "defId": "tatemochi",  "pos": { "x": 336, "y": 160 }, "ai": { "kind": "guard", "post": { "x": 336, "y": 160 }, "leash": 150, "sightRange": 120 } }
  ],
  "spawners": [
    { "defId": "narazumono", "pos": { "x": 80, "y": 80 },  "firstAfter": 20, "every": 14, "total": 3 },
    { "defId": "narazumono", "pos": { "x": 432, "y": 80 }, "firstAfter": 26, "every": 14, "total": 3 }
  ],
  "intro": [
    { "text": "大きな 門が、道の 先を ふさいでいる。" },
    { "speaker": "ines", "text": "この 門の 向こうに ガルムが います" },
    { "speaker": "roran", "text": "ここを 抜ければ 終わりだ。\n最後まで 気を ぬかないで" }
  ],
  "outro": [
    { "speaker": "roran", "text": "門が 開いた" },
    { "text": "その 奥に、ガルムが 立っていた。" }
  ]
```

行14 と行6 は `#.####....####.#` で歩けるのは列1・6〜9・14。`(208, 448)` は列6行14、
`(272, 448)` は列8行14。行9 は開いているので `(144, 288)` は列4行9、`(240, 288)` は列7行9、
`(368, 288)` は列11行9。行5 と行4 は開いているので `(176, 160)` は列5行5、
`(336, 160)` は列10行5、`(240, 128)` は列7行4。行2 は `#...########...#`
で歩けるのは列1〜3・12〜14、`(80, 80)` は列2行2、`(432, 80)` は列13行2。

- [ ] **Step 5: ガルム戦を最後尾へ移す**

`assets/stages/stage3.json` の `order` だけを変える。他のフィールドは触らない。

```json
  "order": 100,
```

`id` は `stage3` のまま残す。セーブデータの `clearedStageIds` は id 文字列で
持っているので、振り直すと既存プレイヤーのクリア記録が消える。
その代わり、id の数字と並び順が一致しなくなる点は Task 11 で README に書く。

- [ ] **Step 6: テストと型チェックを通す**

Run: `npm test && npm run build`
Expected: どちらも成功

- [ ] **Step 7: コミット**

```bash
git add assets/stages/stage9.json assets/stages/stage10.json assets/stages/stage3.json src/engine/registry.test.ts
git commit -m "feat: ステージ「夜の 野営地」「ガルムの 門前」を足し、ガルム戦を最後尾へ移す"
```

---

### Task 10: 成長曲線を10ステージに合わせる

いまの `maxLevel 12` / `xpPerLevel 12` では Lv1 → Lv12 に
`Σ(level × 12) = 12 × 66 = 792` xp 要る。10ステージ通しても届かず、上限が飾りになる。
`assets/growth.json` の数値だけを直す。コードは変えない。

**Files:**
- Modify: `assets/growth.json`
- Test: `src/core/progress.test.ts`

**Interfaces:**
- Consumes: `reg.stages`（Task 9 で10本になっている）、`reg.enemies`、`reg.growth`
- Produces: なし

- [ ] **Step 1: 失敗するテストを書く**

`src/core/progress.test.ts` の末尾に足す。

見積りは**下限のモデル**を使う。撃破の経験値だけを4人で均等に分け、
命中とアシストのぶんは数えない。実際に遊べばこれより多く入るので、
「下限でも上限レベルに届く」なら安全側に外れない。

```ts
describe('10ステージぶんの成長曲線', () => {
  /**
   * 1ステージで仲間ひとりが受け取る経験値の下限。
   * 撃破ぶんを4人で均等に割り、クリアボーナスを足しただけの見積り。
   * 命中とアシストのぶんは数えていないので、実際はこれより多く入る
   */
  function floorXpPerStage(reg: Registry, stage: StageDef): number {
    const rewardOf = (defId: string): number => reg.enemies.get(defId)?.xpReward ?? 0;
    let total = 0;
    for (const e of stage.enemies) total += rewardOf(e.defId);
    for (const s of stage.spawners) total += rewardOf(s.defId) * s.total;
    return reg.growth.clearXp + total / 4;
  }

  /** Lv1 から maxLevel に届くまでに要る経験値の合計 */
  function xpToMaxLevel(growth: GrowthDef): number {
    let sum = 0;
    for (let lv = 1; lv < growth.maxLevel; lv++) sum += xpToNext(lv, growth.xpPerLevel);
    return sum;
  }

  it('全ステージを通せば 上限レベルに届く', () => {
    const reg = testRegistry();
    const total = reg.stages.reduce((sum, s) => sum + floorXpPerStage(reg, s), 0);
    expect(total).toBeGreaterThanOrEqual(xpToMaxLevel(reg.growth));
  });

  it('前半5ステージでは まだ上限に届かない', () => {
    const reg = testRegistry();
    const half = reg.stages.slice(0, 5).reduce((sum, s) => sum + floorXpPerStage(reg, s), 0);
    expect(half).toBeLessThan(xpToMaxLevel(reg.growth) * 0.6);
  });
});
```

`testRegistry`（`./testing`）と `xpToNext`（`./progress`）は
`src/core/progress.test.ts` の既存の import にある。足すのは型3つだけ。

```ts
import type { Registry } from '../engine/registry';
import type { GrowthDef, StageDef } from '../engine/schema';
```

- [ ] **Step 2: テストが落ちることを確かめる**

Run: `npx vitest run src/core/progress.test.ts`
Expected: FAIL（「全ステージを通せば 上限レベルに届く」が落ちる。
`xpPerLevel: 12` だと必要 792 に対して下限の合計が足りない）

- [ ] **Step 3: `xpPerLevel` を決める**

落ちたテストの実測値を読む。`toBeGreaterThanOrEqual` の失敗メッセージに
下限の合計が出るので、それを `S` とする。必要量は `Σ(lv × xpPerLevel) = 66 × xpPerLevel`
（`maxLevel` が 12 のとき）なので、**`S / 66` 以下でいちばん大きい整数**を選ぶ。

見積りでは `S` は 280 前後になる（既存3ステージで約 78、新規7ステージで約 200）。
その場合 `S / 66 ≒ 4.2` なので **`xpPerLevel` は 4** になる見込み。
実測が違えば実測に従う。この数字は当てにせず、必ず失敗メッセージの値から出すこと。

`assets/growth.json` の `xpPerLevel` をその値にする。他のキーは触らない。

```json
{
  "maxLevel": 12,
  "xpPerLevel": <選んだ整数>,
  "hpPerLevel": 1,
  "levelsPerPower": 3,
  "hitXp": 1,
  "healXp": 1,
  "assistRatio": 0.5,
  "clearXp": 10
}
```

- [ ] **Step 4: 2本のテストが両方通ることを確かめる**

Run: `npx vitest run src/core/progress.test.ts`
Expected: PASS

「前半5ステージでは まだ上限に届かない」が落ちるなら `xpPerLevel` を選び直す。
その場合は `S / 66` より小さい整数へ下げるのではなく、**上げる**（必要量が増えて
前半で届きにくくなる）。両方を満たす整数が無ければ、`clearXp` を下げて
撃破の比重を上げるか、`maxLevel` を下げることを検討し、判断の理由をコミットメッセージに書く。

- [ ] **Step 5: 全テストと型チェックを通す**

Run: `npm test && npm run build`
Expected: どちらも成功

- [ ] **Step 6: コミット**

```bash
git add assets/growth.json src/core/progress.test.ts
git commit -m "balance: 10ステージで上限レベルに届くよう成長曲線を直す"
```

---

### Task 11: README を最新の状態に合わせる

`docs/superpowers/` は作成時点のログなので遡って直さない。正典は README.md と CLAUDE.md。
このタスクで直すのは README.md だけ（CLAUDE.md の内容は今回の変更で古くならない）。

**Files:**
- Modify: `README.md`

**Interfaces:**
- Consumes: なし
- Produces: なし

- [ ] **Step 1: 「そうさ」の節を直す**

必殺技の説明にある「いま出せるなかまのポートレートには明るい縁が付き」を、
明滅するようになったことに合わせて書き換える。

```
必殺技は下のポートレートをタップして出す。タップすると同時にそのなかまが選択される。クールダウン中・必殺技を持たない場合は選択だけになる。倒れているなかまはタップしても何も起きない（選択も変わらない）。いま出せるなかまのポートレートには太い縁がゆっくり明滅して付き、残り時間はポートレートのゲージで読める。配置フェーズでは同じ下パネルの上段に「始める」が出る。
```

ステージ選択がスクロールすることを書き足す。「ステージを選ぶと、まず会話から始まる。」の
段落の直前に1文入れる。

```
ステージ選択の一覧は縦にドラッグしてスクロールする。指をほとんど動かさずに離すとそのステージを選ぶ。右端の細いバーで今どのあたりを見ているかが分かる。
```

- [ ] **Step 2: 「!」の説明を直す**

```
敵の索敵範囲は表示しない。気づかれた瞬間、その敵の頭上に赤い「！」が2秒だけ出る。追われているあいだずっと出しっぱなしにはしない。
```

- [ ] **Step 3: 「コンテンツの足しかた」のステージの項を直す**

`order` と id の関係、および敵を線より上に置く決まりを足す。既存の
「**ステージ** — `assets/stages/<id>.json` を1本置く。…」の項をこう書き換える。

```
- **ステージ** — `assets/stages/<id>.json` を1本置く。ファイル名と `id` を一致させ、`order` に並び順を書く（昇順に並ぶ。欠番は自由、重複は起動時エラー。10, 20, 30 と空けておくと後から間に挟める）。**並び順を決めるのは `order` だけで、`id` の数字ではない**（ガルム戦は `stage3` のまま `order: 100` で最後尾にいる。`id` はセーブデータのクリア記録が参照するので、あとから振り直さない）。マップは **16列 × 23行、`cell` は 32**。`placement.minY` より下（画面で下）の歩けるマスが配置できる範囲で、`placement.starts` に開始時の立ち位置を並べる（roster より少なければ先頭から繰り返す）。**敵と時間湧きは `placement.minY` より上（`y < minY`）に置く**。線より下はプレイヤーの配置範囲なので、置くと起動時エラーになる。`victory.pos` は最上段に置く（下から上へ攻める）
```

- [ ] **Step 4: 構成の表に `src/ui/scroll.ts` を足す**

`| src/ui/speech.ts | 戦闘中のセリフの保持と寿命 |` の行の下に足す。

```
| `src/ui/scroll.ts` | 縦スクロールの計算（ステージ選択が使う） |
```

- [ ] **Step 5: 書いたとおりになっているか読み返す**

Run: `git diff README.md`
Expected: 上の5点だけが差分に出る。書き換えた文が実装と合っているか、
特に「2秒」「10, 20, 30」「16列 × 23行」の数値を実コードと突き合わせる。

- [ ] **Step 6: コミット**

```bash
git add README.md
git commit -m "docs: issue#13 の変更を README に反映する"
```

---

### Task 12: ブラウザで通しで確かめる

ユニットテストを書かない描画・入力まわりを、実ブラウザで目視する。
手順は README の「描画と入力をブラウザで確認する」に従う。

**Files:**
- Modify: なし（不具合が出たらそのファイルを直す）

**Interfaces:**
- Consumes: Task 1〜11 のすべて
- Produces: なし

- [ ] **Step 1: ビルドして配信する**

```bash
npm run build
npx --yes http-server out -p 8080 --silent
```

別のシェルでヘッドレス Chromium を起動する。

```bash
chrome --headless=new --no-sandbox --disable-gpu \
       --remote-debugging-port=9222 --window-size=540,945 \
       http://127.0.0.1:8080/play/character-tactics/
```

`http://127.0.0.1:9222/json/list` から WebSocket に繋ぎ、`Runtime.evaluate` で
`document.getElementById('game')` に `PointerEvent` を dispatch する。
`Input.dispatchMouseEvent` は使わない（headless で `pointerdown` / `pointerup`
として正しく届かないことがある）。論理座標 540×945 からクライアント座標への変換は
`computeViewport` と `fitCanvas`（`src/render/viewport.ts`）と同じ式を使う。

- [ ] **Step 2: ステージ選択のスクロールを確かめる**

- 一覧が10本ぶんあり、下へドラッグすると隠れていたステージが出てくる
- 右端に位置バーが出ていて、スクロールに合わせて動く
- 指をほとんど動かさずに離すと、そのステージに入る
- ドラッグして離したときは、ステージに入らない
- 仲間一覧が一覧の下に固定で出ていて、ステージの枠と重ならない
- 未解放のステージは「まだ 行けない」のまま、タップしても入れない

- [ ] **Step 3: 配置フェーズを確かめる**

stage2 と stage3 を開き、**黄色い線より下に敵がいないこと**を見る。
`Page.captureScreenshot` を撮り、論理 y が 528〜786 の帯に敵の色
（`narazumono` は `#8a5a4a`、`tatemochi` は `#6b6b7a`）が無いことを
`getImageData` で数えて確かめてもよい。

- [ ] **Step 4: 必殺技の枠を確かめる**

戦闘に入り、クールダウンが明けたポートレートを 0.2 秒間隔で連写する。
枠の明るさが変わっていること、クールダウン中は枠が出ていないこと、
配置フェーズでは枠が出ていないことを見る。

- [ ] **Step 5: 「！」を確かめる**

stage5（sentry が多い）で、敵の索敵範囲に入る位置へ仲間を動かす。
0.5 秒間隔で連写し、**気づかれた瞬間に「！」が出て、2秒あとには消えている**こと、
**交戦が続いていても出ていない**ことを見る。

- [ ] **Step 6: 新しいステージを通しで遊ぶ**

stage4 から stage10 まで順に開き、次を見る。

- 会話（intro / outro）が出て、文字が枠からはみ出していない
- 弓兵とまじない師が飛び道具を撃ってくる（着弾は数フレームなので短い間隔で連写する）
- 勝利地点まで到達でき、クリアできる
- 味方の初期配置が壁の中に入っていない

- [ ] **Step 7: 見つかった不具合を直す**

不具合が出たら、原因のファイルを直し、可能ならユニットテストを足す。
直したぶんは `fix:` で個別にコミットする。

- [ ] **Step 8: 最終確認**

Run: `npm test && npm run build`
Expected: どちらも成功

Run: `git log --oneline main..HEAD`
Expected: Task 1〜12 のコミットが並んでいる

---

## 完了の条件

- [ ] issue #13 の4項目すべてに対応するコミットがある
- [ ] `npm test` と `npm run build` が通る
- [ ] ステージが10本あり、`order` の昇順で最後がガルム戦
- [ ] 実ブラウザでの目視（Task 12）を通している
- [ ] README が最新の挙動を書いている
