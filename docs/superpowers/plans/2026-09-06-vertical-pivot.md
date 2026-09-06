# 縦画面化と戦闘フィードバック作り直し 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 画面を縦（540×945）にして下から上へ攻める形に作り替え、必殺技・移動・弓/魔法の飛翔体・本拠地会話・画像アセットの受け口を入れる。

**Architecture:** 論理解像度と `MAP_ORIGIN` を縦向きに変え、`src/ui/layout.ts` の座標定数を組み直す。マップ座標を扱う描画と入力は `mapToLogical` / `logicalToMap` を通っているので追随するだけでよい。戦闘側は、交戦とプレイヤー指示の移動を分離し、遠距離攻撃を `BattleState.projectiles` の実体にする。画像は「ファイル名を JSON に書く／無ければ今の図形をプレースホルダとして描く」1本の関数に通す。

**Tech Stack:** TypeScript 5.6 / Vite 5.4 / Vitest 2.1 / Canvas2D。フレームワークなし、実行時の依存パッケージなし。

**Spec:** `docs/superpowers/specs/2026-09-06-vertical-pivot-design.md`

## Global Constraints

- Node.js 22 以上。`npm test` は `vitest run`、`npm run build` は `tsc --noEmit && vite build`
- 論理解像度は **540×945**。マップ原点は **`{ x: 14, y: 50 }`**
- マップは **16列 × 23行、`cell` は 32**（= 512×736）。下から上へ攻める
- `src/core/**` と `src/engine/**` は `window` / `document` / `localStorage` を参照しない
- `src/engine/**` は `src/core/**` を知らない
- **描画コードにユニットテストを書かない。** テストは純ロジックとレイアウト計算に寄せ、見た目は README の CDP 手順で目視する
- 画面に出す文字は総ひらがな（漢字を使わない）。子ども向けの表記に合わせる
- コミットは Conventional Commits（`feat:` / `fix:` / `refactor:` / `test:` / `docs:` / `chore:`）+ 日本語の要約
- 各タスクの最後に `npm test` と `npm run build` の両方を通してからコミットする
- ブランチは `feat/vertical-pivot`

---

## ファイル構成

| ファイル | 責務 | 変更 |
|---|---|---|
| `src/render/viewport.ts` | 論理解像度・マップ原点・座標変換 | 変更（Task 1） |
| `src/ui/layout.ts` | 画面上の矩形の唯一の定義 | 変更（Task 1, 2, 7, 9） |
| `src/ui/skillbutton.ts` | 必殺技ボタンの表示状態を決める純関数 | **新規**（Task 7） |
| `src/ui/screens.ts` | 各画面の描画 | 変更（Task 3, 7, 9, 13） |
| `src/render/draw.ts` | 戦場の描画 | 変更（Task 4, 13, 14, 16） |
| `src/render/images.ts` | 画像の読み込みとキャッシュ | **新規**（Task 12） |
| `src/render/sprites.ts` | 画像とプレースホルダを1本にまとめた描画 | **新規**（Task 13） |
| `src/core/damage.ts` | 命中1回ぶんの解決（近接も着弾も通る） | **新規**（Task 15） |
| `src/core/projectiles.ts` | 飛翔体の生成・移動・命中 | **新規**（Task 15） |
| `src/core/sim.ts` | 1 tick の進行 | 変更（Task 14, 15） |
| `src/core/combat.ts` | ダメージ計算・間合い・攻撃間隔 | 変更（Task 15, 17） |
| `src/core/constants.ts` | 数値定数 | 変更（Task 15） |
| `src/core/dialogue.ts` | イベント → 台詞、会話の組み立て | 変更（Task 18） |
| `src/engine/schema.ts` | JSON の検証 | 変更（Task 10, 17, 18） |
| `src/engine/registry.ts` | 索引と相互参照の検証 | 変更（Task 11, 18） |
| `src/engine/loader.ts` | アセットの取り込み | 変更（Task 12） |
| `src/ui/input.ts` | ポインタ操作 → ジェスチャ | 変更（Task 8） |
| `src/main.ts` | 画面遷移と入力の配線 | 変更（Task 7, 8, 12, 19） |
| `assets/stages/*.json` | ステージ定義 | 変更（Task 5, 19） |
| `assets/units/*.json` | 味方の定義 | 変更（Task 10, 17） |
| `index.html` | 表示の枠 | 変更（Task 6） |
| `README.md` | 正典 | 変更（Task 20） |

---

## Task 1: 論理解像度を縦にする

**Files:**
- Modify: `src/render/viewport.ts`
- Modify: `src/ui/layout.ts`（`960` の直書きを消す）
- Test: `src/render/viewport.test.ts`, `src/ui/layout.test.ts`

**Interfaces:**
- Consumes: なし（最初のタスク）
- Produces: `LOGICAL_W = 540`, `LOGICAL_H = 945`, `MAP_ORIGIN = { x: 14, y: 50 }`。以降のすべてのタスクがこの3つを前提にする

- [ ] **Step 1: 失敗するテストを書く**

`src/render/viewport.test.ts` の末尾に足す。先頭の import 行に `LOGICAL_H`, `LOGICAL_W`, `MAP_ORIGIN`, `logicalToMap`, `mapToLogical` が無ければ足すこと。

```ts
describe('たてがたの ろんりかいぞうど', () => {
  it('たてながである', () => {
    expect(LOGICAL_W).toBe(540);
    expect(LOGICAL_H).toBe(945);
  });

  it('マップは じょうほうバーの したから はじまる', () => {
    expect(MAP_ORIGIN).toEqual({ x: 14, y: 50 });
  });

  it('mapToLogical と logicalToMap は ぎゃくの かんけい', () => {
    const p = { x: 100, y: 200 };
    expect(logicalToMap(mapToLogical(p))).toEqual(p);
  });
});
```

- [ ] **Step 2: テストが落ちることを確かめる**

Run: `npx vitest run src/render/viewport.test.ts`
Expected: FAIL（`expected 960 to be 540`）

- [ ] **Step 3: `viewport.ts` を書き換える**

```ts
export const LOGICAL_W = 540;
export const LOGICAL_H = 945;
/** マップは情報バーのぶんだけ下へ、左右は 16列 × 32px を中央に置くぶんだけ内側へずらす */
export const MAP_ORIGIN = { x: 14, y: 50 };
```

- [ ] **Step 4: テストが通ることを確かめる**

Run: `npx vitest run src/render/viewport.test.ts`
Expected: PASS

- [ ] **Step 5: `layout.ts` の `960` 直書きを消す**

`src/ui/layout.ts` の先頭に `import { LOGICAL_W } from '../render/viewport';` を足し、`skillButtonAt` と `bubbleRectAt` の中の `960` を `LOGICAL_W` に置き換える。`bubbleRectAt` のコメント「960 は論理解像度の幅。skillButtonAt と同じ書き方に揃えている」は消す（直書きでなくなったので不要）。

- [ ] **Step 6: 吹き出しのクランプ試験を新しい幅に直す**

`src/ui/layout.test.ts` の `bubbleRectAt` の describe を直す。`960` / `952` を使っている2つを置き換える。

```ts
  it('みぎはしで はみださない', () => {
    const r = bubbleRectAt({ x: LOGICAL_W, y: 300 }, 'あいうえお');
    expect(r.x + r.w).toBeLessThanOrEqual(LOGICAL_W - 8);
  });
```

import 行に `LOGICAL_W` を足す（`import { LOGICAL_W } from '../render/viewport';`）。`{ x: 480, y: 300 }` を使っている他のケースは 540 幅でも内側なのでそのままでよい。

- [ ] **Step 7: すべてのテストを通す**

Run: `npm test`
Expected: PASS

- [ ] **Step 8: コミット**

```bash
git add src/render/viewport.ts src/render/viewport.test.ts src/ui/layout.ts src/ui/layout.test.ts
git commit -m "feat: ろんりかいぞうどを 540x945 の たてがたに する"
```

---

## Task 2: レイアウト定数を縦向きに組み直す

**Files:**
- Modify: `src/ui/layout.ts`
- Test: `src/ui/layout.test.ts`

**Interfaces:**
- Consumes: `LOGICAL_W`, `LOGICAL_H`, `MAP_ORIGIN`（Task 1）
- Produces:
  - `BOTTOM_PANEL_Y = 786`
  - `SKILL_BUTTON: Rect`（Task 7 が使う）
  - `portraitSlot(i: number): Rect`（4枠、下パネル）
  - `rosterSlot(i: number): Rect`（ステージ選択の1列リスト）
  - `stageSlot(i: number): Rect`（2列）
  - `TALK_WINDOW: Rect`, `BTN`

- [ ] **Step 1: 失敗するテストを書く**

`src/ui/layout.test.ts` の末尾に足す。import 行に `BOTTOM_PANEL_Y`, `BTN`, `SKILL_BUTTON`, `TALK_WINDOW`, `portraitSlot`, `rosterSlot`, `stageSlot` と、viewport から `LOGICAL_H` を足す。

```ts
const inScreen = (r: { x: number; y: number; w: number; h: number }): boolean =>
  r.x >= 0 && r.y >= 0 && r.x + r.w <= LOGICAL_W && r.y + r.h <= LOGICAL_H;

describe('たてがたの レイアウト', () => {
  it('したパネルは マップの したに ある', () => {
    expect(BOTTOM_PANEL_Y).toBe(MAP_ORIGIN.y + 23 * 32);
  });

  it('ポートレート 4まいが がめんに おさまる', () => {
    for (let i = 0; i < 4; i++) expect(inScreen(portraitSlot(i))).toBe(true);
  });

  it('ポートレートどうしが かさならない', () => {
    for (let i = 1; i < 4; i++) {
      const prev = portraitSlot(i - 1);
      expect(portraitSlot(i).x).toBeGreaterThanOrEqual(prev.x + prev.w);
    }
  });

  it('ひっさつわざボタンは したパネルの なかで ポートレートと かさならない', () => {
    expect(inScreen(SKILL_BUTTON)).toBe(true);
    expect(SKILL_BUTTON.y).toBeGreaterThanOrEqual(BOTTOM_PANEL_Y);
    expect(SKILL_BUTTON.y + SKILL_BUTTON.h).toBeLessThanOrEqual(portraitSlot(0).y);
  });

  it('かいわウィンドウと ボタンが がめんに おさまる', () => {
    expect(inScreen(TALK_WINDOW)).toBe(true);
    for (const r of Object.values(BTN)) expect(inScreen(r)).toBe(true);
  });

  it('とばすボタンは かいわウィンドウと かさならない', () => {
    expect(BTN.skip.y + BTN.skip.h).toBeLessThanOrEqual(TALK_WINDOW.y);
  });

  it('ステージスロットは 2れつ で がめんに おさまる', () => {
    expect(stageSlot(0).y).toBe(stageSlot(1).y);       // 同じ行
    expect(stageSlot(2).y).toBeGreaterThan(stageSlot(0).y); // 3つめは次の行
    for (let i = 0; i < 6; i++) expect(inScreen(stageSlot(i))).toBe(true);
  });

  it('ロスターは 1れつ で ならぶ', () => {
    for (let i = 0; i < 4; i++) expect(inScreen(rosterSlot(i))).toBe(true);
    expect(rosterSlot(1).x).toBe(rosterSlot(0).x);
    expect(rosterSlot(1).y).toBeGreaterThan(rosterSlot(0).y);
  });
});
```

- [ ] **Step 2: テストが落ちることを確かめる**

Run: `npx vitest run src/ui/layout.test.ts`
Expected: FAIL（`BOTTOM_PANEL_Y` などが未定義）

- [ ] **Step 3: `layout.ts` の定数を書き換える**

`BOTTOM_BAR_Y` / `BOTTOM_BAR_H` を消し、代わりに以下にする。`BTN.start` は Task 7 で `SKILL_BUTTON` に統合するので、この時点では残しておく。

```ts
/** 下パネルの上端。マップ領域（MAP_ORIGIN.y + 23行 × 32px）の直下 */
export const BOTTOM_PANEL_Y = 786;

/**
 * 必殺技ボタン。配置フェーズの「はじめる」と同じ矩形を使う。
 * 押す場所がフェーズで動かないほうが覚えやすい
 */
export const SKILL_BUTTON: Rect = { x: 8, y: 794, w: 524, h: 56 };

export const BTN = {
  titleNew: { x: 120, y: 520, w: 300, h: 76 } as Rect,
  titleContinue: { x: 120, y: 620, w: 300, h: 76 } as Rect,
  start: { x: 8, y: 794, w: 524, h: 56 } as Rect,
  next: { x: 120, y: 700, w: 300, h: 76 } as Rect,
  retry: { x: 60, y: 700, w: 200, h: 72 } as Rect,
  toSelect: { x: 280, y: 700, w: 200, h: 72 } as Rect,
  skip: { x: 380, y: 585, w: 140, h: 44 } as Rect,
} as const;

/** 会話ウィンドウ。論理解像度 540×945 の下寄りに置く */
export const TALK_WINDOW = { x: 20, y: 645, w: 500, h: 260 } as Rect;

/** ステージ選択ボタン。2れつ×なんぎょうの グリッド */
export function stageSlot(index: number): Rect {
  const col = index % 2;
  const row = Math.floor(index / 2);
  return { x: 20 + col * 260, y: 160 + row * 140, w: 240, h: 120 };
}

/** ステージ選択の下に出す仲間の一覧。名前と称号を並べるので1列にする */
export function rosterSlot(index: number): Rect {
  return { x: 20, y: 640 + index * 72, w: 500, h: 64 };
}

/** 戦闘中の下パネルのポートレート。4枠を横に並べる */
export function portraitSlot(index: number): Rect {
  return { x: 6 + index * 133, y: 858, w: 129, h: 80 };
}
```

`BTN.back` は今どこからも参照されていない。`grep -rn "BTN.back" src/` で確認し、参照が無ければ消す。

- [ ] **Step 4: テストが通ることを確かめる**

Run: `npx vitest run src/ui/layout.test.ts`
Expected: PASS

- [ ] **Step 5: 型チェックで壊れた参照を洗い出す**

Run: `npx tsc --noEmit`
Expected: `BOTTOM_BAR_Y` / `BOTTOM_BAR_H` を参照している `src/ui/screens.ts` でエラー。**ここでは直さない**（Task 3 で直す）。エラーの一覧を控えておく。

- [ ] **Step 6: コミット**

型チェックが通らない状態ではコミットしない。Task 3 まで進めてからまとめてコミットする。**このタスクの成果は Task 3 のコミットに含める。**

---

## Task 3: 各画面の描画を新しい座標に合わせる

**Files:**
- Modify: `src/ui/screens.ts`

**Interfaces:**
- Consumes: `BOTTOM_PANEL_Y`, `SKILL_BUTTON`, `portraitSlot`, `rosterSlot`, `stageSlot`, `TALK_WINDOW`, `BTN`（Task 2）
- Produces: なし（描画のみ）

- [ ] **Step 1: `drawBottomBar` を縦積みのポートレートに書き換える**

`BOTTOM_BAR_Y` / `BOTTOM_BAR_H` の import を `BOTTOM_PANEL_Y` に替える。パネルの下敷きは
`ctx.fillRect(0, BOTTOM_PANEL_Y, LOGICAL_W, LOGICAL_H - BOTTOM_PANEL_Y)` にする。

1枠 129×80 の中身は次の座標にする（`r` は `portraitSlot(i)`）。

| 要素 | 座標 |
|---|---|
| 顔の丸 | 中心 `(r.x + 22, r.y + 22)`、半径 13 |
| 名前 | `(r.x + 42, r.y + 28)`、`18px sans-serif` |
| クラス | Task 9 で入れる。この時点では描かない |
| HP バー | `(r.x + 8, r.y + 60, 113, 7)`。前景は `113 * hp/maxHp` |
| 必殺技クールダウンバー | `(r.x + 8, r.y + 70, 113, 5)` |
| 「たいきゃく」 | `(r.x + 42, r.y + 50)`、`14px sans-serif` |
| 護衛の印（三角） | `(r.x + 8, r.y + 10)` から一辺 12 の下向き三角 |

- [ ] **Step 2: `drawRoster` を1列リストに書き換える**

`portraitSlot` ではなく `rosterSlot` を使う。`r` は `rosterSlot(i)`。

| 要素 | 座標 |
|---|---|
| 顔の丸 | 中心 `(r.x + 28, r.y + 32)`、半径 16 |
| 名前と Lv | `(r.x + 56, r.y + 26)`、`18px sans-serif` |
| 称号 | `(r.x + 56, r.y + 50)`、`18px sans-serif`、`#9fb3c4` |

- [ ] **Step 3: `drawResult` を 540 幅に収める**

見出しの `44px` は「てきの ほんきょちに とうたつ！」（15文字）で 660px になり画面からはみ出す。以下に直す。

| 要素 | 変更前 | 変更後 |
|---|---|---|
| 見出しのフォント | `44px` | `28px` |
| 見出しの y | `90` | `100` |
| 行の y | `150 + i * 46` | `180 + i * 56` |
| 顔の丸 | `(60, y - 6)` r14 | `(40, y - 6)` r14 |
| 名前 | `(90, y)` | `(66, y)` |
| 経験値の文 | `(620, y)` | `(66, y + 24)`、`17px sans-serif` |
| 称号ゲット | `(60, 350)` | `(40, 560)` |

- [ ] **Step 4: `drawTitle` / `drawDefeat` / `drawPlacement` を直す**

| 対象 | 変更 |
|---|---|
| `drawTitle` 見出し | `58px` → `40px`、y `180` → `260` |
| `drawTitle` 説明 | `22px` のまま、y `232` → `320`。文言を「4にんの なかまで/てきの ほんきょちへ せめこもう」の2行に分け、`320` と `352` に描く（1行 24文字は 540 幅に入らない） |
| `drawDefeat` 見出し | `44px` → `32px`、y `240` → `320` |
| `drawPlacement` 説明文 | `(40, 380)` → `(24, 760)`、`20px sans-serif` |
| `drawStageSelect` 見出し | `(40, 100)` のまま、`36px` → `30px` |
| `drawStageSelect` のステージ名 | y `r.y + 60` → `r.y + 50`、`24px` → `22px` |
| `drawStageSelect` の「クリア ずみ」 | y `r.y + 104` → `r.y + 88` |
| `drawLoadErrors` | `16px monospace` → `13px monospace`、行間 `22` → `20` |

- [ ] **Step 5: 型チェックとテストを通す**

Run: `npx tsc --noEmit && npm test`
Expected: どちらも PASS

- [ ] **Step 6: コミット**

```bash
git add src/ui/layout.ts src/ui/layout.test.ts src/ui/screens.ts
git commit -m "feat: レイアウトていすうと かくがめんを たてがたに くみなおす"
```

---

## Task 4: 情報バーを縦向きに合わせる

**Files:**
- Modify: `src/render/draw.ts:368-374`（`drawTopBar`）

**Interfaces:**
- Consumes: `LOGICAL_W`, `MAP_ORIGIN`（Task 1）
- Produces: なし

- [ ] **Step 1: `drawTopBar` を直す**

高さ 46 は `MAP_ORIGIN.y`（50）と食い違っている。バーの下端とマップの上端を揃える。

```ts
function drawTopBar(ctx: CanvasRenderingContext2D, state: BattleState): void {
  ctx.fillStyle = COLORS.bar;
  ctx.fillRect(0, 0, LOGICAL_W, MAP_ORIGIN.y);
  ctx.fillStyle = COLORS.text;
  ctx.font = '20px sans-serif';
  ctx.textBaseline = 'middle';
  ctx.fillText(state.stage.name, 16, MAP_ORIGIN.y / 2);
}
```

import 行に `MAP_ORIGIN` を足す。

- [ ] **Step 2: 型チェックとテストを通す**

Run: `npx tsc --noEmit && npm test`
Expected: どちらも PASS

- [ ] **Step 3: コミット**

```bash
git add src/render/draw.ts
git commit -m "fix: じょうほうバーの たかさを マップげんてんに あわせる"
```

---

## Task 5: ステージ3本を縦向きに作り直す

**Files:**
- Modify: `assets/stages/stage1.json`, `assets/stages/stage2.json`, `assets/stages/stage3.json`
- Test: `src/ui/layout.test.ts`

**Interfaces:**
- Consumes: `MAP_ORIGIN`, `BOTTOM_PANEL_Y`（Task 1, 2）
- Produces: 16列×23行のステージ3本。以降のタスクはこの盤面で動作確認する

**共通の作り:** 外周1セルは `#`。`placementZone` は最下段、`victory.pos` は最上段 `{ x: 240, y: 48 }`（`radius` は 40）。`cell` は 32 のまま。`order` / `id` / `name` / `roster` / `defeat` / `intro` は変えない。

`placementZone` は3本とも同じにする。

```json
  "placementZone": [
    { "pos": { "x": 144, "y": 656 } },
    { "pos": { "x": 240, "y": 656 } },
    { "pos": { "x": 144, "y": 592 } },
    { "pos": { "x": 240, "y": 592 } }
  ],
```

- [ ] **Step 1: 「ステージがマップ領域に収まる」テストを書く**

`src/ui/layout.test.ts` の末尾に足す。import に `import { testRegistry } from '../core/testing';` と viewport の `MAP_ORIGIN` を足す。

```ts
describe('ステージが マップりょういきに おさまる', () => {
  for (const stage of testRegistry().stages) {
    it(`${stage.id} が はみださない`, () => {
      const w = (stage.mapRows[0]?.length ?? 0) * stage.cell;
      const h = stage.mapRows.length * stage.cell;
      expect(MAP_ORIGIN.x + w).toBeLessThanOrEqual(LOGICAL_W);
      expect(MAP_ORIGIN.y + h).toBeLessThanOrEqual(BOTTOM_PANEL_Y);
    });
  }
});
```

- [ ] **Step 2: テストが落ちることを確かめる**

Run: `npx vitest run src/ui/layout.test.ts`
Expected: FAIL（今のステージは 960×448 で横に 434px はみ出す）

- [ ] **Step 3: stage1 を書き換える**

障害物なしの一本道。`mapRows` は次の23行。

```json
  "mapRows": [
    "################",
    "#..............#",
    "#..............#",
    "#..............#",
    "#..............#",
    "#..............#",
    "#..............#",
    "#..............#",
    "#..............#",
    "#..............#",
    "#..............#",
    "#..............#",
    "#..............#",
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
```

```json
  "enemies": [
    { "defId": "narazumono", "pos": { "x": 144, "y": 464 }, "ai": { "kind": "aggressive" } },
    { "defId": "narazumono", "pos": { "x": 336, "y": 464 }, "ai": { "kind": "aggressive" } },
    { "defId": "narazumono", "pos": { "x": 240, "y": 240 }, "ai": { "kind": "aggressive" } }
  ],
  "victory": { "type": "reach", "pos": { "x": 240, "y": 48 }, "radius": 40, "by": "any" },
```

- [ ] **Step 4: stage2 を書き換える**

見張りの視界を避けて通る。stage1 の `mapRows` を基に、6・7行目と 14・15行目を差し替える（0 始まりの添字）。

```
  row 6:  "#.####....####.#"
  row 7:  "#.####....####.#"
  row 14: "#...####..####.#"
  row 15: "#...####..####.#"
```

```json
  "enemies": [
    { "defId": "narazumono", "pos": { "x": 240, "y": 336 }, "ai": { "kind": "sentry", "sightRange": 110 } },
    { "defId": "tatemochi",  "pos": { "x": 112, "y": 336 }, "ai": { "kind": "sentry", "sightRange": 110 } },
    { "defId": "narazumono", "pos": { "x": 208, "y": 560 }, "ai": { "kind": "sentry", "sightRange": 90 } },
    { "defId": "narazumono", "pos": { "x": 400, "y": 560 }, "ai": { "kind": "sentry", "sightRange": 90 } },
    { "defId": "tatemochi",  "pos": { "x": 240, "y": 144 }, "ai": { "kind": "aggressive" } }
  ],
  "victory": { "type": "reach", "pos": { "x": 240, "y": 48 }, "radius": 40, "by": "any" },
```

- [ ] **Step 5: stage3 を書き換える**

門番を抜けてボスへ。stage1 の `mapRows` を基に、5・6行目と 13・14行目を差し替える。

```
  row 5:  "#.###.....####.#"
  row 6:  "#.###.....####.#"
  row 13: "#####...####...#"
  row 14: "#####...####...#"
```

```json
  "enemies": [
    { "defId": "narazumono", "pos": { "x": 176, "y": 528 }, "ai": { "kind": "sentry", "sightRange": 100 } },
    { "defId": "narazumono", "pos": { "x": 368, "y": 528 }, "ai": { "kind": "sentry", "sightRange": 100 } },
    { "defId": "tatemochi",  "pos": { "x": 176, "y": 304 }, "ai": { "kind": "guard", "post": { "x": 176, "y": 272 }, "leash": 140, "sightRange": 120 } },
    { "defId": "tatemochi",  "pos": { "x": 336, "y": 304 }, "ai": { "kind": "guard", "post": { "x": 336, "y": 272 }, "leash": 140, "sightRange": 120 } },
    { "defId": "garum",      "pos": { "x": 240, "y": 112 }, "ai": { "kind": "aggressive" } }
  ],
  "victory": { "type": "reach", "pos": { "x": 240, "y": 48 }, "radius": 40, "by": "any" },
```

- [ ] **Step 6: テストを通す**

Run: `npm test`
Expected: PASS。落ちる場合は `assets` の検証エラーが理由つきで出る（`あるけない マスに ある` など座標のミス）ので、その座標を直す。

- [ ] **Step 7: 型チェックを通してコミット**

```bash
npx tsc --noEmit
git add assets/stages src/ui/layout.test.ts
git commit -m "feat: ステージ3ほんを したから うえへ せめる たてむきに つくりなおす"
```

---

## Task 6: 表示の枠を縦向きにする

**Files:**
- Modify: `index.html`

**Interfaces:**
- Consumes: `LOGICAL_W`, `LOGICAL_H`（Task 1）
- Produces: なし

- [ ] **Step 1: 現状を見る**

Run: `cat index.html`

- [ ] **Step 2: canvas の縦横比とセーフエリアを入れる**

sea-defence に倣う。`<style>` に以下を入れる（既存の style がある場合は該当する規則を置き換える）。

```css
html, body {
  width: 100%;
  height: 100%;
  margin: 0;
  background: #071428;
  display: flex;
  justify-content: center;
  align-items: center;
  overflow: hidden;
  padding-top: env(safe-area-inset-top);
  padding-bottom: env(safe-area-inset-bottom);
  padding-left: env(safe-area-inset-left);
  padding-right: env(safe-area-inset-right);
}

#game {
  display: block;
  width: 100%;
  max-width: 540px;
  aspect-ratio: 540 / 945;
  touch-action: none;
  max-height: calc(100svh - env(safe-area-inset-top) - env(safe-area-inset-bottom));
}
```

`<head>` の viewport meta を `<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />` にする。

- [ ] **Step 3: ブラウザで見る**

```bash
npm run build
npx vite preview --port 4173 &
chrome --headless=new --no-sandbox --disable-gpu \
       --remote-debugging-port=9222 --window-size=540,945 \
       http://127.0.0.1:4173/play/character-tactics/
```

`Page.captureScreenshot` でタイトル画面を撮り、**縦長で、ボタンが画面内に収まっていること**を確かめる。

- [ ] **Step 4: コミット**

```bash
git add index.html
git commit -m "feat: canvas を たてなが ひょうじに する"
```

---

## Task 7: 必殺技ボタンを下パネルへ移す

**Files:**
- Create: `src/ui/skillbutton.ts`
- Create: `src/ui/skillbutton.test.ts`
- Modify: `src/ui/layout.ts`（`skillButtonAt` を消す）, `src/ui/screens.ts`, `src/main.ts`

**Interfaces:**
- Consumes: `SKILL_BUTTON`（Task 2）
- Produces: `skillButtonState(reg, state, selected): { label: string; enabled: boolean }`

- [ ] **Step 1: 失敗するテストを書く**

`src/ui/skillbutton.test.ts` を作る。

```ts
import { describe, expect, it } from 'vitest';
import { beginBattle, createBattleState } from '../core/state';
import { testRegistry } from '../core/testing';
import { skillButtonState } from './skillbutton';
import type { BattleState, CharProgress, StageDef } from '../core/types';

const STAGE: StageDef = {
  id: 'teststage', order: 10, name: 'テスト', cell: 32,
  mapRows: ['..........', '..........', '..........'],
  placementZone: [{ pos: { x: 16, y: 16 } }],
  roster: ['roran', 'ines', 'mist', 'gau'],
  enemies: [{ defId: 'narazumono', pos: { x: 304, y: 16 }, ai: { kind: 'aggressive' } }],
  victory: { type: 'reach', pos: { x: 304, y: 16 }, radius: 40, by: 'any' },
  defeat: [{ type: 'unitLost', defIds: ['roran'] }],
};
const LV1: Record<string, CharProgress> = {
  roran: { level: 1, xp: 0 }, ines: { level: 1, xp: 0 },
  mist: { level: 1, xp: 0 }, gau: { level: 1, xp: 0 },
};

function fresh(): BattleState {
  const s = createBattleState(testRegistry(), STAGE, LV1, 42);
  beginBattle(s);
  return s;
}

describe('skillButtonState', () => {
  it('えらんでいないと おせない', () => {
    const s = fresh();
    expect(skillButtonState(s.reg, s, null)).toEqual({ label: 'なかまを えらぶ', enabled: false });
  });

  it('えらんでいて クールダウンが あけていれば わざめいが でて おせる', () => {
    const s = fresh();
    const roran = s.units.find((u) => u.defId === 'roran')!;
    expect(skillButtonState(s.reg, s, roran.uid)).toEqual({ label: 'ふんばる', enabled: true });
  });

  it('クールダウンちゅうは のこりびょうすうが でて おせない', () => {
    const s = fresh();
    const roran = s.units.find((u) => u.defId === 'roran')!;
    s.time = 10;
    roran.skillCooldownUntil = 12.5;
    const r = skillButtonState(s.reg, s, roran.uid);
    expect(r.enabled).toBe(false);
    expect(r.label).toContain('ふんばる');
    expect(r.label).toContain('3');   // 2.5 秒 → きりあげて 3
  });

  it('たいきゃくした なかまは おせない', () => {
    const s = fresh();
    const roran = s.units.find((u) => u.defId === 'roran')!;
    roran.retired = true;
    expect(skillButtonState(s.reg, s, roran.uid).enabled).toBe(false);
  });
});
```

- [ ] **Step 2: テストが落ちることを確かめる**

Run: `npx vitest run src/ui/skillbutton.test.ts`
Expected: FAIL（`skillbutton.ts` が無い）

- [ ] **Step 3: `src/ui/skillbutton.ts` を書く**

```ts
import type { Registry } from '../engine/registry';
import type { BattleState } from '../core/types';

export type SkillButtonState = { label: string; enabled: boolean };

const NO_SELECTION: SkillButtonState = { label: 'なかまを えらぶ', enabled: false };

/**
 * ボタンは常に出しっぱなしにして、押せない理由を文字で見せる。
 * 押せないときに消してしまうと、なぜ押せないのかが画面から読めない。
 */
export function skillButtonState(
  reg: Registry,
  state: BattleState,
  selected: string | null,
): SkillButtonState {
  if (selected === null) return NO_SELECTION;
  const unit = state.units.find((u) => u.uid === selected);
  if (!unit || unit.retired || unit.skillId === null) return NO_SELECTION;

  const label = reg.skills.get(unit.skillId)?.label ?? 'スキル';
  const remaining = unit.skillCooldownUntil - state.time;
  if (remaining > 0) return { label: `${label}  あと ${Math.ceil(remaining)}`, enabled: false };
  return { label, enabled: true };
}
```

- [ ] **Step 4: テストが通ることを確かめる**

Run: `npx vitest run src/ui/skillbutton.test.ts`
Expected: PASS

- [ ] **Step 5: `layout.ts` から `skillButtonAt` を消す**

`skillButtonAt` の関数ごと削除する。

- [ ] **Step 6: `screens.ts` の `drawSkillButton` を書き換える**

```ts
export function drawSkillButton(
  ctx: CanvasRenderingContext2D,
  reg: Registry,
  state: BattleState,
  selected: string | null,
): void {
  const s = skillButtonState(reg, state, selected);
  button(ctx, SKILL_BUTTON, s.label, s.enabled);
}
```

import から `mapToLogical` と `skillButtonAt` を外し、`SKILL_BUTTON` と `skillButtonState` を足す。戻り値が `Rect | null` から `void` に変わる。

- [ ] **Step 7: `main.ts` の配線を直す**

1. `case 'battle'` の 1) スキルボタンの分岐を書き換える。

```ts
      // 1) スキルボタン。下パネルにあるのでマップ操作とは重ならない
      if (hitRect(SKILL_BUTTON, p)) {
        pointerStart = null;
        if (selected === null) return;
        const unit = battle.units.find((u) => u.uid === selected);
        if (!unit || unit.retired || battle.time < unit.skillCooldownUntil) return;
        if (skillParam(battle.reg, unit.skillId ?? '', 'needsDest', 0) === 1) pendingSkill = selected;
        else commands.push({ type: 'skill', uid: selected });
        return;
      }
```

2. `case 'placement'` の `hitRect(BTN.start, p)` を `hitRect(SKILL_BUTTON, p)` にする。
3. `render()` の `if (selected) drawSkillButton(...)` を、選択の有無にかかわらず呼ぶ形にする。

```ts
        drawSkillButton(ctx, registry, battle, selected);
```

4. import 行を直す（`skillButtonAt` を外し `SKILL_BUTTON` を足す）。

- [ ] **Step 8: `screens.ts` の `drawPlacement` のボタンを直す**

`button(ctx, BTN.start, 'はじめる')` を `button(ctx, SKILL_BUTTON, 'はじめる')` にする。あわせて `layout.ts` の `BTN.start` を削除し、参照が残っていないか確認する。

Run: `grep -rn "BTN.start\|skillButtonAt" src/`
Expected: 出力なし

- [ ] **Step 9: 型チェックとテストを通す**

Run: `npx tsc --noEmit && npm test`
Expected: どちらも PASS

- [ ] **Step 10: コミット**

```bash
git add src/ui/skillbutton.ts src/ui/skillbutton.test.ts src/ui/layout.ts src/ui/screens.ts src/main.ts
git commit -m "feat: ひっさつわざボタンを したパネルの ていいちに うつす"
```

---

## Task 8: 吹き出しのタップ判定を pointerup へ移す

**Files:**
- Modify: `src/ui/input.ts`, `src/main.ts`
- Test: `src/ui/input.test.ts`

**Interfaces:**
- Consumes: なし
- Produces: `PointerStart.bubbleUid: string | null`、`MapGesture` に `{ type: 'dismissBubble'; uid: string }`

**背景:** 今は `pointerdown` の時点で吹き出しに当たると `return` するため、吹き出しの上から始めたドラッグを丸ごと食う。判定を離したときへ移す。

- [ ] **Step 1: 失敗するテストを書く**

`src/ui/input.test.ts` の末尾に足す。先頭の import に `import type { PointerStart } from './input';` を足す。既存のテストが `PointerStart` を組み立てている箇所にも `bubbleUid: null` を足す必要がある（`npx tsc --noEmit` が教えてくれる）。

```ts
describe('ふきだしの タップ', () => {
  const start = (over: Partial<PointerStart> = {}): PointerStart => ({
    uid: null, startMap: { x: 100, y: 100 }, wasSelected: false, pointerId: 1,
    bubbleUid: null, ...over,
  });

  it('ふきだしの うえで タップしたら ふきだしを けす', () => {
    const g = resolveMapGesture(start({ bubbleUid: 'p1' }), { x: 100, y: 100 }, 'p2');
    expect(g).toEqual({ type: 'dismissBubble', uid: 'p1' });
  });

  it('ふきだしの うえから ドラッグしたら ふきだしを けさない', () => {
    const g = resolveMapGesture(
      start({ uid: 'p1', bubbleUid: null }), { x: 300, y: 300 }, 'p1',
    );
    expect(g).toEqual({ type: 'moveUnit', uid: 'p1', dest: { x: 300, y: 300 } });
  });

  it('ふきだしが なければ これまでどおり', () => {
    const g = resolveMapGesture(start(), { x: 100, y: 100 }, 'p2');
    expect(g).toEqual({ type: 'moveUnit', uid: 'p2', dest: { x: 100, y: 100 } });
  });
});
```

- [ ] **Step 2: テストが落ちることを確かめる**

Run: `npx vitest run src/ui/input.test.ts`
Expected: FAIL（`bubbleUid` が型に無い）

- [ ] **Step 3: `input.ts` を書き換える**

```ts
export type PointerStart = {
  uid: string | null;
  startMap: Vec2;
  wasSelected: boolean;
  pointerId: number;
  /**
   * ポインターを下ろした位置にあった吹き出しの uid。地面でも吹き出しでもなければ null。
   * ユニットの上に下ろしたときは常に null（操作を吹き出しより優先する）
   */
  bubbleUid: string | null;
};

export type MapGesture =
  | { type: 'none' }
  | { type: 'select'; uid: string }
  | { type: 'deselect' }
  | { type: 'dismissBubble'; uid: string }
  | { type: 'moveUnit'; uid: string; dest: Vec2 };
```

`resolveMapGesture` の先頭に足す。

```ts
  const moved = distance(start.startMap, endMap) > TAP_SLOP;

  // 吹き出しを消すのはタップのときだけ。ドラッグは移動指示として通す
  if (!moved && start.bubbleUid !== null) {
    return { type: 'dismissBubble', uid: start.bubbleUid };
  }
```

- [ ] **Step 4: テストが通ることを確かめる**

Run: `npx vitest run src/ui/input.test.ts`
Expected: PASS

- [ ] **Step 5: `main.ts` の `case 'battle'` から吹き出しの早期 return を消す**

「2) 吹き出し。当たったらその1つだけ消す」のブロックを丸ごと削除する。

- [ ] **Step 6: `beginMapPointer` で `bubbleUid` を決める**

`main.ts` にヘルパを足す。

```ts
/** その論理座標に出ている吹き出しを探す。描画は挿入順（後が上）なので、逆順に見る */
function bubbleAt(state: BattleState, p: Vec2): string | null {
  for (const b of [...bubbles.items.values()].reverse()) {
    const unit = state.units.find((u) => u.uid === b.uid);
    if (!unit) continue;
    if (hitRect(bubbleRectAt(mapToLogical(unit.pos), b.text), p)) return b.uid;
  }
  return null;
}
```

`beginMapPointer` のシグネチャに論理座標 `p` はすでにある。`pointerStart` を組むところを直す。

```ts
  const startMap = logicalToMap(p);
  const uid = pickUnit(playerUnits(state), startMap);
  pointerStart = {
    uid,
    startMap,
    wasSelected: uid !== null && selected === uid,
    pointerId: ev.pointerId,
    // ユニットを掴んでいるときは吹き出しを見ない。操作のほうが優先
    bubbleUid: uid === null ? bubbleAt(state, p) : null,
  };
```

- [ ] **Step 7: `onPointerUp` で `dismissBubble` を処理する**

`switch (g.type)` に足す。

```ts
    case 'dismissBubble':
      dismissBubble(bubbles, g.uid);
      return;
```

- [ ] **Step 8: 型チェックとテストを通す**

Run: `npx tsc --noEmit && npm test`
Expected: どちらも PASS

- [ ] **Step 9: コミット**

```bash
git add src/ui/input.ts src/ui/input.test.ts src/main.ts
git commit -m "fix: ふきだしの タップはんていを はなしたときに うつして ドラッグを くわないようにする"
```

---

## Task 9: ポートレートにユニットクラスを出す

**Files:**
- Modify: `src/ui/layout.ts`, `src/ui/screens.ts`
- Test: `src/ui/layout.test.ts`

**Interfaces:**
- Consumes: `portraitSlot`（Task 2）
- Produces: `roleBadgeIn(slot: Rect): Rect` — Task 13 の画像描画もこの矩形を使う

- [ ] **Step 1: 失敗するテストを書く**

`src/ui/layout.test.ts` の `たてがたの レイアウト` の describe に足す。import に `roleBadgeIn` を足す。

```ts
  it('クラスの わくは ポートレートの なかに ある', () => {
    const slot = portraitSlot(0);
    const badge = roleBadgeIn(slot);
    expect(badge.x).toBeGreaterThanOrEqual(slot.x);
    expect(badge.y).toBeGreaterThanOrEqual(slot.y);
    expect(badge.x + badge.w).toBeLessThanOrEqual(slot.x + slot.w);
    expect(badge.y + badge.h).toBeLessThanOrEqual(slot.y + slot.h);
  });

  it('クラスの わくは HPバーと かさならない', () => {
    const slot = portraitSlot(0);
    // drawBottomBar は HP バーを slot.y + 60 に描く
    expect(roleBadgeIn(slot).y + roleBadgeIn(slot).h).toBeLessThanOrEqual(slot.y + 60);
  });
```

- [ ] **Step 2: テストが落ちることを確かめる**

Run: `npx vitest run src/ui/layout.test.ts`
Expected: FAIL（`roleBadgeIn` が無い）

- [ ] **Step 3: `layout.ts` に `roleBadgeIn` を足す**

```ts
/**
 * ポートレートの中でクラス（役割）を出す場所。
 * 画像・プレースホルダの文字・テストの3者が必ずこの1本を見る。
 * 別々に持つと、画像を入れたときだけ位置がずれる
 */
export function roleBadgeIn(slot: Rect): Rect {
  return { x: slot.x + 42, y: slot.y + 32, w: 84, h: 26 };
}
```

- [ ] **Step 4: テストが通ることを確かめる**

Run: `npx vitest run src/ui/layout.test.ts`
Expected: PASS

- [ ] **Step 5: `screens.ts` の `drawBottomBar` にクラスを描く**

名前を描いたすぐ後に足す。`def` は `lookupDef(reg, unit.defId)` の結果で、`role` を持たないフォールバック（`{ name, color }`）を使っている場合は `role` も足しておくこと。

```ts
      const badge = roleBadgeIn(r);
      ctx.fillStyle = '#ffd479';
      ctx.font = '14px sans-serif';
      ctx.fillText(def.role, badge.x, badge.y + 18);
```

`lookupDef` のフォールバックを次に直す。Task 13 の `drawFace` / `drawRoleBadge` も同じ値を受け取るので、`sprites` までここで揃えておく。

```ts
const FALLBACK_DEF = { name: '', color: '#888888', role: '', sprites: { role: null, face: null, map: null } };
```

- [ ] **Step 6: 型チェックとテストを通す**

Run: `npx tsc --noEmit && npm test`
Expected: どちらも PASS

- [ ] **Step 7: ブラウザで見る**

Task 6 の手順でステージ1を開き、下パネルに「たて」「ゆみ」「いやし」「ものみ」が名前の下に出ていることを確かめる。

- [ ] **Step 8: コミット**

```bash
git add src/ui/layout.ts src/ui/layout.test.ts src/ui/screens.ts
git commit -m "feat: ポートレートに ユニットクラスを だす"
```

---

## Task 10: ユニット定義に画像のファイル名を持たせる

**Files:**
- Modify: `src/engine/schema.ts`
- Modify: `assets/units/*.json`（4本）
- Test: `src/engine/schema.test.ts`

**Interfaces:**
- Consumes: なし
- Produces: `UnitDef.sprites: { role: string | null; face: string | null; map: string | null }`。`EnemyDef` も継承する

**注意:** `sprites` は**省略できる**（省略時は3つとも `null`）。必須にすると `registry.test.ts` の
フィクスチャと `assets/enemies/*.json` を全部書き換える必要が出るうえ、絵の無いユニットを足すのが面倒になる。

- [ ] **Step 1: 失敗するテストを書く**

`src/engine/schema.test.ts` の `validateUnitDef` の describe に足す。

```ts
  it('sprites を しょうりゃくすると すべて null に なる', () => {
    const r = validateUnitDef('assets/units/roran.json', UNIT);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.sprites).toEqual({ role: null, face: null, map: null });
  });

  it('sprites に ファイルめいを かける', () => {
    const r = validateUnitDef('assets/units/roran.json', {
      ...UNIT, sprites: { role: 'tate.png', face: 'roran-face.png', map: null },
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.sprites).toEqual({ role: 'tate.png', face: 'roran-face.png', map: null });
  });

  it('sprites の あたいが もじれつでも null でも ないと エラー', () => {
    const r = validateUnitDef('assets/units/roran.json', { ...UNIT, sprites: { role: 3 } });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.errors[0]?.path).toBe('sprites.role');
  });
```

`UNIT` はこのファイル内の既存フィクスチャを使う（無ければ `registry.test.ts` の `UNIT` と同じものをこのファイルにも定義する）。

- [ ] **Step 2: テストが落ちることを確かめる**

Run: `npx vitest run src/engine/schema.test.ts`
Expected: FAIL（`sprites` が型に無い）

- [ ] **Step 3: `schema.ts` に `Sprites` を足す**

```ts
/** ユニットの絵。値は assets/images/ の中のファイル名。null なら図形で描く */
export type Sprites = { role: string | null; face: string | null; map: string | null };

const NO_SPRITES: Sprites = { role: null, face: null, map: null };

function readSprites(ctx: Ctx, v: unknown): Sprites {
  if (v === undefined) return { ...NO_SPRITES };
  const o = requireObject(ctx, 'sprites', v);
  if (!o) return { ...NO_SPRITES };
  const one = (key: keyof Sprites): string | null => {
    const raw = o[key];
    if (raw === undefined || raw === null) return null;
    return requireString(ctx, `sprites.${key}`, raw);
  };
  return { role: one('role'), face: one('face'), map: one('map') };
}
```

`UnitDef` に `sprites: Sprites;` を足し、`readUnitFields` の戻り値に `sprites: readSprites(ctx, o.sprites),` を足す。

- [ ] **Step 4: テストが通ることを確かめる**

Run: `npx vitest run src/engine/schema.test.ts`
Expected: PASS

- [ ] **Step 5: 4本のユニット JSON に `sprites` を書く**

あとで絵を差し替える場所が分かるように、明示的に `null` を書いておく。`assets/units/gau.json` / `ines.json` / `mist.json` / `roran.json` の `color` の次の行に足す。

```json
  "sprites": { "role": null, "face": null, "map": null }
```

- [ ] **Step 6: 型チェックとテストを通す**

Run: `npx tsc --noEmit && npm test`
Expected: どちらも PASS

- [ ] **Step 7: コミット**

```bash
git add src/engine/schema.ts src/engine/schema.test.ts assets/units
git commit -m "feat: ユニットていぎに えの ファイルめいを もたせる"
```

---

## Task 11: 画像ファイルの存在を起動時に検証する

**Files:**
- Modify: `src/engine/registry.ts`
- Test: `src/engine/registry.test.ts`

**Interfaces:**
- Consumes: `UnitDef.sprites`（Task 10）
- Produces: `buildRegistry(files, knownSkillIds, imageNames?: readonly string[])`

- [ ] **Step 1: 失敗するテストを書く**

`src/engine/registry.test.ts` に足す。

```ts
describe('sprites の ファイルの そんざい', () => {
  const withSprite = (sprites: Record<string, string | null>) =>
    files({ 'assets/units/roran.json': { ...UNIT, sprites } });

  it('ある ファイルめいなら とおる', () => {
    const r = buildRegistry(withSprite({ role: 'tate.png' }), KNOWN_SKILLS, ['tate.png']);
    expect(r.ok).toBe(true);
  });

  it('ない ファイルめいは エラーに なる', () => {
    const r = buildRegistry(withSprite({ role: 'nai.png' }), KNOWN_SKILLS, ['tate.png']);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.errors[0]?.path).toBe('sprites.role');
    expect(r.errors[0]?.reason).toContain('nai.png');
  });

  it('null は せいじょう', () => {
    const r = buildRegistry(withSprite({ role: null, face: null, map: null }), KNOWN_SKILLS, []);
    expect(r.ok).toBe(true);
  });
});
```

- [ ] **Step 2: テストが落ちることを確かめる**

Run: `npx vitest run src/engine/registry.test.ts`
Expected: FAIL（3つめの引数が型に無い）

- [ ] **Step 3: `buildRegistry` に検証を足す**

シグネチャを変える。既定値を空配列にしておくと、既存の呼び出しがそのまま動く。

```ts
export function buildRegistry(
  files: Record<string, unknown>,
  knownSkillIds: readonly string[],
  imageNames: readonly string[] = [],
): Validated<Registry> {
```

「2) 相互参照を見る」のブロック、`checkSkillId` のループの後に足す。

```ts
  const images = new Set(imageNames);
  const checkSprites = (file: string, sprites: Sprites): void => {
    for (const key of ['role', 'face', 'map'] as const) {
      const name = sprites[key];
      if (name !== null && !images.has(name)) {
        errors.push({ file, path: `sprites.${key}`, reason: `assets/images/ に ない ファイル: ${name}` });
      }
    }
  };
  for (const [id, def] of reg.units) checkSprites(`assets/units/${id}.json`, def.sprites);
  for (const [id, def] of reg.enemies) checkSprites(`assets/enemies/${id}.json`, def.sprites);
```

import に `Sprites` を型として足す。

- [ ] **Step 4: テストが通ることを確かめる**

Run: `npx vitest run src/engine/registry.test.ts`
Expected: PASS

- [ ] **Step 5: 型チェックとテストを通す**

Run: `npx tsc --noEmit && npm test`
Expected: どちらも PASS

- [ ] **Step 6: コミット**

```bash
git add src/engine/registry.ts src/engine/registry.test.ts
git commit -m "feat: sprites に かいた がぞうファイルの そんざいを きどうじに みる"
```

---

## Task 12: 画像を読み込む

**Files:**
- Create: `src/render/images.ts`
- Modify: `src/engine/loader.ts`, `src/main.ts`

**Interfaces:**
- Consumes: `buildRegistry(files, knownSkillIds, imageNames)`（Task 11）
- Produces:
  - `imageUrls(): Record<string, string>`（`engine/loader.ts`）
  - `ImageCache`, `makeImageCache(urls: Record<string, string>): ImageCache`, `imageFor(cache: ImageCache, name: string | null): CanvasImageSource | null`（`render/images.ts`）

**注意:** `render/images.ts` は `document` を使わない（`new Image()` は使う）。`src/render/**` は
DOM を使ってよい層である。テストは書かない（画像の読み込みは実ブラウザでしか確かめられない）。

- [ ] **Step 1: `loader.ts` に `imageUrls` を足す**

```ts
/**
 * 画像もビルド時に取り込む。JSON と同じく base 付きの URL に解決されるので、
 * パス付きルートの Workers 上でも壊れない
 */
export function imageUrls(): Record<string, string> {
  return import.meta.glob('/assets/images/*.png', { eager: true, query: '?url', import: 'default' });
}

/** '/assets/images/tate.png' → 'tate.png' */
export function imageNames(urls: Record<string, string>): string[] {
  return Object.keys(urls).map((p) => p.split('/').pop() ?? '');
}
```

`loadRegistry` を直す。

```ts
export function loadRegistry(knownSkillIds: readonly string[]): Validated<Registry> {
  return buildRegistry(assetFiles(), knownSkillIds, imageNames(imageUrls()));
}
```

- [ ] **Step 2: `assets/images/` を作る**

Vite の glob は対象が0件でも通るが、ディレクトリが無いと分かりづらい。空ディレクトリは git に載らないので、置き場所を説明する `.gitkeep` 代わりの README を置く。

```bash
mkdir -p assets/images
printf 'ユニットの え を PNG で ここに おく。せいほうけい。\nunits/*.json の sprites に ファイルめいを かくと つかわれる。\n' > assets/images/README.txt
```

- [ ] **Step 3: `src/render/images.ts` を書く**

```ts
/**
 * 画像のキャッシュ。ローディング画面は作らない方針なので、読み込みは待たない。
 * 読み終わっていないあいだ imageFor は null を返し、呼び出し側は図形のプレースホルダに落ちる
 */
export type ImageCache = { byName: Map<string, HTMLImageElement> };

/** キーは '/assets/images/tate.png' のようなパス。ファイル名だけを索引にする */
export function makeImageCache(urls: Record<string, string>): ImageCache {
  const byName = new Map<string, HTMLImageElement>();
  for (const [path, url] of Object.entries(urls)) {
    const name = path.split('/').pop();
    if (name === undefined) continue;
    const img = new Image();
    img.src = url;
    byName.set(name, img);
  }
  return { byName };
}

export function imageFor(cache: ImageCache, name: string | null): CanvasImageSource | null {
  if (name === null) return null;
  const img = cache.byName.get(name);
  if (!img || !img.complete || img.naturalWidth === 0) return null;
  return img;
}
```

- [ ] **Step 4: `main.ts` でキャッシュを作る**

`const effects = makeEffectState();` の近くに足す。

```ts
const images = makeImageCache(imageUrls());
```

import 行に `import { imageUrls } from './engine/loader';`（既存の `loadRegistry` の import に足す）と
`import { makeImageCache } from './render/images';` を足す。この時点では誰も使わないので、
`npx tsc --noEmit` が未使用変数で警告する場合は Task 13 まで一時的に `void images;` を置く。

- [ ] **Step 5: 型チェックとテストを通す**

Run: `npx tsc --noEmit && npm test`
Expected: どちらも PASS

- [ ] **Step 6: コミット**

```bash
git add src/engine/loader.ts src/render/images.ts src/main.ts assets/images
git commit -m "feat: assets/images の PNG を よみこむ けいろを つくる"
```

---

## Task 13: 画像とプレースホルダを1本の関数に通す

**Files:**
- Create: `src/render/sprites.ts`
- Modify: `src/render/draw.ts`, `src/ui/screens.ts`, `src/main.ts`

**Interfaces:**
- Consumes: `ImageCache`, `imageFor`（Task 12）、`roleBadgeIn`（Task 9）、`UnitDef.sprites`（Task 10）
- Produces:
  - `drawFace(ctx, center: Vec2, radius: number, def: SpriteDef, images: ImageCache): void`
  - `drawMapUnit(ctx, center: Vec2, radius: number, def: SpriteDef, images: ImageCache): void`
  - `drawRoleBadge(ctx, rect: Rect, def: SpriteDef, images: ImageCache): void`
  - `SpriteDef = { color: string; role: string; sprites: Sprites }`

- [ ] **Step 1: `src/render/sprites.ts` を書く**

```ts
import { imageFor } from './images';
import type { ImageCache } from './images';
import type { Sprites } from '../engine/schema';
import type { Vec2 } from '../core/types';
import type { Rect } from '../ui/hit';

/** 描画に要るぶんだけ。UnitDef / EnemyDef のどちらでも渡せる */
export type SpriteDef = { color: string; role: string; sprites: Sprites };

function circle(ctx: CanvasRenderingContext2D, c: Vec2, radius: number, color: string): void {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(c.x, c.y, radius, 0, Math.PI * 2);
  ctx.fill();
}

/**
 * 画像とプレースホルダの分岐はこの中だけに置く。呼び出し側で分けると、
 * 片方だけ位置がずれる事故が必ず起きる。
 * 画像は直径 2*radius の正方形に収める。丸くしたいならアセット側でそう描く
 */
function drawSquareOrCircle(
  ctx: CanvasRenderingContext2D,
  c: Vec2,
  radius: number,
  color: string,
  img: CanvasImageSource | null,
): void {
  if (img === null) {
    circle(ctx, c, radius, color);
    return;
  }
  ctx.drawImage(img, c.x - radius, c.y - radius, radius * 2, radius * 2);
}

export function drawFace(
  ctx: CanvasRenderingContext2D, center: Vec2, radius: number,
  def: SpriteDef, images: ImageCache,
): void {
  drawSquareOrCircle(ctx, center, radius, def.color, imageFor(images, def.sprites.face));
}

export function drawMapUnit(
  ctx: CanvasRenderingContext2D, center: Vec2, radius: number,
  def: SpriteDef, images: ImageCache,
): void {
  drawSquareOrCircle(ctx, center, radius, def.color, imageFor(images, def.sprites.map));
}

/** クラス。画像が無ければ role の文字を出す */
export function drawRoleBadge(
  ctx: CanvasRenderingContext2D, rect: Rect, def: SpriteDef, images: ImageCache,
): void {
  const img = imageFor(images, def.sprites.role);
  if (img === null) {
    ctx.fillStyle = '#ffd479';
    ctx.font = '14px sans-serif';
    ctx.fillText(def.role, rect.x, rect.y + 18);
    return;
  }
  ctx.drawImage(img, rect.x, rect.y, rect.h, rect.h);
}
```

- [ ] **Step 2: `draw.ts` の丸を `drawMapUnit` に差し替える**

`drawUnits` の中の

```ts
    ctx.fillStyle = defOf(reg, unit.defId).color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
    ctx.fill();
```

を

```ts
    drawMapUnit(ctx, p, radius, defOf(reg, unit.defId), images);
```

に替える。`defOf` のフォールバックを
`{ name: defId, color: '#888888', role: '', sprites: { role: null, face: null, map: null } }` に直す。

`drawDragPreview` の丸も同じように差し替える（`ctx.globalAlpha = 0.5` はそのまま外側に残す）。

**HP バー・選択中のリング・ふんばり／ねらいうちのリング・護衛の印・味方のはた・たてもちの盾は
そのまま残す。** これらは絵ではなく状態の表示なので、画像に置き換わってはいけない。

- [ ] **Step 3: `images` を描画関数へ引き回す**

`EffectState` と同じように引数で渡す。以下のシグネチャに `images: ImageCache` を足す（最後の引数として）。

| 関数 | ファイル |
|---|---|
| `drawBattle` | `render/draw.ts` |
| `drawUnits`（内部） | `render/draw.ts` |
| `drawDragPreview` | `render/draw.ts` |
| `drawBottomBar` | `ui/screens.ts` |
| `drawStageSelect` | `ui/screens.ts` |
| `drawRoster`（内部） | `ui/screens.ts` |
| `drawTalk` | `ui/screens.ts` |
| `drawResult` | `ui/screens.ts` |

- [ ] **Step 4: `screens.ts` の顔の丸を `drawFace` に差し替える**

| 場所 | 中心 | 半径 |
|---|---|---|
| `drawBottomBar` | `(r.x + 22, r.y + 22)` | 13 |
| `drawRoster` | `(r.x + 28, r.y + 32)` | 16 |
| `drawTalk` | `(r.x + 54, r.y + 60)` | 30 |
| `drawResult` | `(40, y - 6)` | 14 |

Task 9 で足したクラスの文字は `drawRoleBadge(ctx, roleBadgeIn(r), def, images)` に置き換える。

- [ ] **Step 5: `main.ts` の呼び出しに `images` を足す**

`render()` の中の各 draw 呼び出しに `images` を渡す。Task 12 で置いた `void images;` があれば消す。

- [ ] **Step 6: 型チェックとテストを通す**

Run: `npx tsc --noEmit && npm test`
Expected: どちらも PASS

- [ ] **Step 7: プレースホルダのまま見た目が変わらないことを確かめる**

Task 6 の手順でステージ1を開き、**画像が1枚も無い状態で今までと同じ丸が出ていること**を確かめる。

- [ ] **Step 8: 画像を1枚入れて差し替わることを確かめる**

```bash
# 32x32 の まっしろな PNG を つくる（ImageMagick が あれば）
convert -size 32x32 xc:white assets/images/tate.png
```

`assets/units/roran.json` の `"sprites"` を `{ "role": "tate.png", "face": null, "map": null }` にして
`npm run build` → ブラウザで下パネルのロランのクラスが白い四角になることを確かめる。
**確認できたら PNG と JSON の変更は元に戻す**（絵の制作は本計画のスコープ外）。

```bash
rm assets/images/tate.png
git checkout assets/units/roran.json
```

- [ ] **Step 9: コミット**

```bash
git add src/render/sprites.ts src/render/draw.ts src/ui/screens.ts src/main.ts
git commit -m "feat: キャラの えを がぞうアセットで さしかえられるように する"
```

---

## Task 14: 指示された移動は交戦しても止まらない

**Files:**
- Modify: `src/core/sim.ts`（`moveUnits`）, `src/render/draw.ts`（`drawGoalMarkers`）
- Test: `src/core/sim.test.ts`

**Interfaces:**
- Consumes: なし
- Produces: なし（既存の挙動の変更）

**背景:** `moveUnits` は `engagedWith !== null` のユニットを移動から外す。移動コマンドは一度交戦を解くが、次の tick で射程内の敵に再交戦してまた止まる。これが「移動中に吹き出しが出ると移動が止まる」の正体。

- [ ] **Step 1: 失敗するテストを書く**

`src/core/sim.test.ts` の末尾に足す。`fresh()` と `STAGE` はこのファイルの既存のものを使う。

```ts
describe('しじされた いどうは とまらない', () => {
  it('こうせんちゅうでも プレイヤーの いどうしじは すすむ', () => {
    const { state } = fresh();
    const roran = state.units.find((u) => u.defId === 'roran')!;
    const enemy = state.units.find((u) => u.side === 'enemy')!;
    roran.pos = { x: 100, y: 16 };
    enemy.pos = { x: 110, y: 16 };   // ロランの しゃていない
    enemy.speed = 0;

    step(state, [{ type: 'move', uid: roran.uid, dest: { x: 240, y: 16 } }], 1 / 60);
    const before = roran.pos.x;
    for (let i = 0; i < 30; i++) step(state, [], 1 / 60);

    expect(roran.engagedWith).not.toBeNull();     // こうせんは している
    expect(roran.pos.x).toBeGreaterThan(before);  // それでも すすんでいる
  });

  it('とうちゃくすると こうせんで あしが とまる', () => {
    const { state } = fresh();
    const roran = state.units.find((u) => u.defId === 'roran')!;
    const enemy = state.units.find((u) => u.side === 'enemy')!;
    roran.pos = { x: 100, y: 16 };
    enemy.pos = { x: 110, y: 16 };
    enemy.speed = 0;

    step(state, [{ type: 'move', uid: roran.uid, dest: { x: 104, y: 16 } }], 1 / 60);
    for (let i = 0; i < 20; i++) step(state, [], 1 / 60);
    expect(roran.goalPos).toBeNull();

    const at = { ...roran.pos };
    for (let i = 0; i < 30; i++) step(state, [], 1 / 60);
    expect(roran.pos).toEqual(at);
  });

  it('てきは こうせんすると あしが とまる', () => {
    const { state } = fresh();
    const roran = state.units.find((u) => u.defId === 'roran')!;
    const enemy = state.units.find((u) => u.side === 'enemy')!;
    roran.pos = { x: 100, y: 16 };
    enemy.pos = { x: 118, y: 16 };

    for (let i = 0; i < 10; i++) step(state, [], 1 / 60);
    const at = { ...enemy.pos };
    for (let i = 0; i < 30; i++) step(state, [], 1 / 60);

    expect(enemy.engagedWith).not.toBeNull();
    expect(enemy.pos).toEqual(at);
  });
});
```

- [ ] **Step 2: テストが落ちることを確かめる**

Run: `npx vitest run src/core/sim.test.ts -t 'しじされた いどうは とまらない'`
Expected: 1つめが FAIL（`expected 100 to be greater than 100`）

- [ ] **Step 3: `moveUnits` を書き換える**

```ts
/**
 * プレイヤーが出した移動指示は交戦より優先する。
 * 指示した移動が途中で勝手に止まると、プレイヤーの意図が黙って消える。
 * 攻撃は交戦しているかぎり続くので、歩きながら撃つ形になる
 */
function hasOrderedMove(u: Unit): boolean {
  return u.controller === 'player' && u.goalPos !== null;
}

function moveUnits(state: BattleState, dt: number): void {
  for (const u of state.units) {
    if (u.retired) continue;
    if (u.engagedWith !== null && !hasOrderedMove(u)) continue;
    moveTowardGoal(state, u, dt);
  }
}
```

- [ ] **Step 4: テストが通ることを確かめる**

Run: `npx vitest run src/core/sim.test.ts`
Expected: PASS

- [ ] **Step 5: 移動先マーカーの「薄くする」をやめる**

`src/render/draw.ts` の `drawGoalMarkers` から、交戦中に半透明にする処理を消す。指示した移動はもう止まらないので、薄くする理由がなくなった。

```ts
    // 削除する2行
    // 交戦中は足が止まっているので薄くする。交戦が解けたら再開するため消しはしない
    ctx.globalAlpha = unit.engagedWith !== null ? 0.35 : 1;
```

末尾の `ctx.globalAlpha = 1;` も一緒に消す。

- [ ] **Step 6: 型チェックとテストを通す**

Run: `npx tsc --noEmit && npm test`
Expected: どちらも PASS

- [ ] **Step 7: コミット**

```bash
git add src/core/sim.ts src/core/sim.test.ts src/render/draw.ts
git commit -m "fix: しじされた いどうは こうせんしても とまらないように する"
```

---

## Task 15: 弓と魔法を飛翔体にする

**Files:**
- Create: `src/core/damage.ts`, `src/core/projectiles.ts`, `src/core/projectiles.test.ts`
- Modify: `src/core/types.ts`, `src/core/constants.ts`, `src/core/combat.ts`, `src/core/skills.ts`, `src/core/sim.ts`, `src/core/state.ts`
- Test: `src/core/projectiles.test.ts`, `src/core/sim-combat.test.ts`

**Interfaces:**
- Consumes: なし
- Produces:
  - `HitSource`, `Projectile`（`core/types.ts`）
  - `BattleState.projectiles: Projectile[]`, `BattleState.nextProjectileId: number`
  - `applyDamage(state, source: HitSource, target: Unit): number`（`core/damage.ts`）
  - `spawnProjectile(state, source: HitSource, target: Unit): void`, `updateProjectiles(state, dt): void`（`core/projectiles.ts`）
  - `PROJECTILE_SPEED`, `PINCH_RATIO`（`core/constants.ts`）

**依存の向き:** `sim.ts → damage.ts → combat.ts` と `sim.ts → projectiles.ts → damage.ts`。
`damage.ts` が `skills.ts` を参照すると `skills.ts → sim.ts → damage.ts` の循環になるので、
**`isFunbaruActive` を `skills.ts` から `combat.ts` へ移す**（`combat.ts` は型以外なにも import しない）。

- [ ] **Step 1: `isFunbaruActive` と `PINCH_RATIO` を移す**

1. `src/core/skills.ts` から `isFunbaruActive` を切り取り、`src/core/combat.ts` に貼る。`combat.ts` に `import type { Unit } from './types';` を足す。
2. `src/core/sim.ts` から `export const PINCH_RATIO = 0.3;` を切り取り、`src/core/constants.ts` へ移す。コメントを添える。

```ts
/** この HP 割合を下回ると、ピンチのセリフを1度だけ出す */
export const PINCH_RATIO = 0.3;

/** 飛翔体の速さ（px/秒）。攻撃種別だけで決まる */
export const PROJECTILE_SPEED: Record<'bow' | 'magic', number> = { bow: 480, magic: 360 };
```

3. 参照元を直す。

Run: `grep -rn "isFunbaruActive\|PINCH_RATIO" src/`
Expected: `sim.ts` / `skills.ts` / `render/draw.ts` / テストの import を `./combat` `./constants` に向け直す

Run: `npx tsc --noEmit && npm test`
Expected: どちらも PASS（挙動は変えていない）

```bash
git add src/core
git commit -m "refactor: isFunbaruActive と PINCH_RATIO を いどうさせて じゅんかんさんしょうを ふせぐ"
```

- [ ] **Step 2: 型を足す**

`src/core/types.ts` に足す。

```ts
/** 攻撃を出した時点で固定される攻撃側の値。近接も飛翔体も同じものを通す */
export type HitSource = {
  uid: string;
  defId: string;
  attack: AttackKind;
  /** 攻撃を出した位置。飛翔体では発射地点 */
  pos: Vec2;
  neraiuchi: boolean;
  power: number;
  bondBonus: number;
};

export type Projectile = {
  id: string;
  kind: Exclude<AttackKind, 'melee'>;
  /** 発射時に固定した攻撃側の値。防御側は着弾時に見る */
  source: HitSource;
  targetUid: string;
  pos: Vec2;
};
```

`BattleState` に足す。

```ts
  projectiles: Projectile[];
  nextProjectileId: number;
```

`src/core/state.ts` の `createBattleState` の戻り値に `projectiles: [], nextProjectileId: 1,` を足し、
`beginBattle` に `state.projectiles = [];` を足す。

- [ ] **Step 3: `src/core/damage.ts` を書く**

```ts
import { computeDamage, isFunbaruActive } from './combat';
import { PINCH_RATIO } from './constants';
import type { BattleState, HitSource, Unit } from './types';

/**
 * 命中1回ぶんを解決する。近接の攻撃も飛翔体の着弾も必ずここを通す。
 * 2箇所に分けて書くと、ピンチの判定やカウンタの積み方がすぐに食い違う
 */
export function applyDamage(state: BattleState, source: HitSource, target: Unit): number {
  const before = target.hp;
  const dmg = computeDamage({
    power: source.power,
    guard: target.guard,
    attackKind: source.attack,
    bowDamageCap: target.bowDamageCap,
    bondBonus: source.bondBonus,
    neraiuchi: source.neraiuchi,
    targetFunbaru: isFunbaruActive(target, state.time),
  });

  target.hp -= dmg;
  target.lastHitBy = source.uid;
  target.lastHitNeraiuchi = source.neraiuchi;

  state.events.push({
    type: 'hit', targetUid: target.uid, targetPos: { ...target.pos }, amount: dmg,
    sourceUid: source.uid, sourceDefId: source.defId, attackKind: source.attack,
    sourcePos: { ...source.pos }, neraiuchi: source.neraiuchi,
  });

  // ピンチのセリフは操作できる味方にだけ出す
  if (target.side === 'player' && target.hp > 0 && !target.pinchShown) {
    const ratio = target.hp / target.maxHp;
    if (ratio < PINCH_RATIO && before / target.maxHp >= PINCH_RATIO) {
      target.pinchShown = true;
      state.events.push({ type: 'pinch', uid: target.uid, defId: target.defId });
    }
  }

  return dmg;
}
```

- [ ] **Step 4: 失敗するテストを書く**

`src/core/projectiles.test.ts` を作る。

```ts
import { describe, expect, it } from 'vitest';
import { spawnProjectile, updateProjectiles } from './projectiles';
import { beginBattle, createBattleState } from './state';
import { testRegistry } from './testing';
import type { BattleState, CharProgress, HitSource, StageDef, Unit } from './types';

const STAGE: StageDef = {
  id: 'teststage', order: 10, name: 'テスト', cell: 32,
  mapRows: ['..........', '..........', '..........'],
  placementZone: [{ pos: { x: 16, y: 16 } }],
  roster: ['roran', 'ines', 'mist', 'gau'],
  enemies: [{ defId: 'narazumono', pos: { x: 216, y: 16 }, ai: { kind: 'aggressive' } }],
  victory: { type: 'reach', pos: { x: 304, y: 80 }, radius: 20, by: 'any' },
  defeat: [{ type: 'unitLost', defIds: ['roran'] }],
};
const LV1: Record<string, CharProgress> = {
  roran: { level: 1, xp: 0 }, ines: { level: 1, xp: 0 },
  mist: { level: 1, xp: 0 }, gau: { level: 1, xp: 0 },
};

function fresh(): { state: BattleState; shooter: Unit; target: Unit } {
  const state = createBattleState(testRegistry(), STAGE, LV1, 42);
  beginBattle(state);
  const shooter = state.units.find((u) => u.defId === 'ines')!;
  const target = state.units.find((u) => u.side === 'enemy')!;
  shooter.pos = { x: 16, y: 16 };
  target.pos = { x: 216, y: 16 };
  return { state, shooter, target };
}

const sourceOf = (u: Unit, over: Partial<HitSource> = {}): HitSource => ({
  uid: u.uid, defId: u.defId, attack: u.attack, pos: { ...u.pos },
  neraiuchi: false, power: u.power, bondBonus: 0, ...over,
});

describe('updateProjectiles', () => {
  it('うった しゅんかんは まだ あたっていない', () => {
    const { state, shooter, target } = fresh();
    const hp = target.hp;
    spawnProjectile(state, sourceOf(shooter), target);
    updateProjectiles(state, 1 / 60);

    expect(state.projectiles.length).toBe(1);
    expect(target.hp).toBe(hp);
  });

  it('とどいた しゅんかんに ダメージが はいる', () => {
    const { state, shooter, target } = fresh();
    const hp = target.hp;
    spawnProjectile(state, sourceOf(shooter), target);
    for (let i = 0; i < 40; i++) updateProjectiles(state, 1 / 60);

    expect(state.projectiles.length).toBe(0);
    expect(target.hp).toBeLessThan(hp);
    expect(state.events.some((e) => e.type === 'hit')).toBe(true);
  });

  it('もくひょうが たいじょうしたら ふはつに なる', () => {
    const { state, shooter, target } = fresh();
    spawnProjectile(state, sourceOf(shooter), target);
    target.retired = true;
    updateProjectiles(state, 1 / 60);

    expect(state.projectiles.length).toBe(0);
    expect(state.events.length).toBe(0);
  });

  it('ぼうぎょがわの ふんばりは ちゃくだんじに はんていされる', () => {
    const hit = (funbaru: boolean): number => {
      const { state, shooter, target } = fresh();
      const hp = target.hp;
      spawnProjectile(state, sourceOf(shooter), target);
      if (funbaru) target.funbaruUntil = state.time + 10;  // うった あとで ふんばる
      for (let i = 0; i < 40; i++) updateProjectiles(state, 1 / 60);
      return hp - target.hp;
    };

    expect(hit(true)).toBeLessThan(hit(false));
  });
});
```

- [ ] **Step 5: テストが落ちることを確かめる**

Run: `npx vitest run src/core/projectiles.test.ts`
Expected: FAIL（`projectiles.ts` が無い）

- [ ] **Step 6: `src/core/projectiles.ts` を書く**

```ts
import { PROJECTILE_SPEED } from './constants';
import { applyDamage } from './damage';
import { distance } from './field';
import type { BattleState, HitSource, Projectile, Unit } from './types';

/** 遠距離の1発を撃つ。近接はここを通らない */
export function spawnProjectile(state: BattleState, source: HitSource, target: Unit): void {
  if (source.attack === 'melee') return;
  state.projectiles.push({
    id: `pj${state.nextProjectileId++}`,
    kind: source.attack,
    source,
    targetUid: target.uid,
    pos: { ...source.pos },
  });
}

/**
 * 飛翔体を進め、届いたものを命中させる。
 * 追尾するので必ず当たる。外れる弾は子ども向けの操作感に合わない。
 * 目標が退場していたら不発として消える
 */
export function updateProjectiles(state: BattleState, dt: number): void {
  const byUid = new Map(state.units.map((u) => [u.uid, u]));
  const alive: Projectile[] = [];

  for (const pj of state.projectiles) {
    const target = byUid.get(pj.targetUid);
    if (!target || target.retired) continue;

    const stepLen = PROJECTILE_SPEED[pj.kind] * dt;
    const remaining = distance(pj.pos, target.pos);
    if (remaining > stepLen) {
      pj.pos = {
        x: pj.pos.x + ((target.pos.x - pj.pos.x) / remaining) * stepLen,
        y: pj.pos.y + ((target.pos.y - pj.pos.y) / remaining) * stepLen,
      };
      alive.push(pj);
      continue;
    }

    pj.pos = { ...target.pos };
    applyDamage(state, pj.source, target);
  }

  state.projectiles = alive;
}
```

- [ ] **Step 7: テストが通ることを確かめる**

Run: `npx vitest run src/core/projectiles.test.ts`
Expected: PASS

- [ ] **Step 8: `sim.ts` の `resolveAttacks` を差し替える**

ダメージを直接当てていた部分を、近接なら `applyDamage`、遠距離なら `spawnProjectile` に分ける。
`const neraiuchi = ...` から `state.events.push({ type: 'hit', ... })` とピンチ判定までを、次に置き換える。

```ts
    const source: HitSource = {
      uid: u.uid, defId: u.defId, attack: u.attack, pos: { ...u.pos },
      neraiuchi: u.neraiuchiArmed, power: u.power, bondBonus: bonus,
    };
    u.neraiuchiArmed = false;
    u.attackCooldown = interval;

    if (u.attack === 'melee') applyDamage(state, source, target);
    else spawnProjectile(state, source, target);
```

import を足す（`applyDamage` は `./damage`、`spawnProjectile` / `updateProjectiles` は `./projectiles`、`HitSource` は型として `./types`）。`computeDamage` と `isFunbaruActive` が `sim.ts` で使われなくなったら import から外す。

- [ ] **Step 9: `step` に `updateProjectiles` を挟む**

```ts
  moveUnits(state, dt);
  resolveAttacks(state, dt);
  updateProjectiles(state, dt);
  resolveRemoval(state);
```

- [ ] **Step 10: 統合テストを足す**

`src/core/sim-combat.test.ts` に足す。

```ts
  it('ゆみの こうげきは うった tick では ダメージに ならない', () => {
    const s = fresh();
    const ines = unitOf(s, 'ines');
    ines.pos = { x: 16, y: 16 };
    const enemy = spawnEnemy(s, 'narazumono', { x: 120, y: 16 });
    const hp = enemy.hp;

    // こうげきかんかくが あけるまで まわす
    for (let i = 0; i < 200; i++) {
      step(s, [], 1 / 60);
      if (s.projectiles.length > 0) break;
    }
    expect(s.projectiles.length).toBeGreaterThan(0);
    expect(enemy.hp).toBe(hp);
  });
```

- [ ] **Step 11: すべてのテストを通す**

Run: `npx tsc --noEmit && npm test`
Expected: どちらも PASS。既存の弓のテストが「1 tick でダメージが入る」前提なら、飛翔体が届くまで `step` を回す形に直す

- [ ] **Step 12: コミット**

```bash
git add src/core
git commit -m "feat: ゆみと まほうを ひしょうたいに して ちゃくだんじに ダメージを だす"
```

---

## Task 16: 飛翔体を描き、弓の線を廃止する

**Files:**
- Modify: `src/render/draw.ts`, `src/render/effects.ts`
- Test: `src/render/effects.test.ts`

**Interfaces:**
- Consumes: `BattleState.projectiles`（Task 15）
- Produces: なし

- [ ] **Step 1: `attackLine` を消すテストに直す**

`src/render/effects.test.ts` の `attackLine` に関する期待を書き換える。

```ts
  it('ゆみの ヒットで せんの えんしゅつは でない（ひしょうたいが あるため）', () => {
    const state = makeEffectState();
    spawnEffects(state, [{
      type: 'hit', targetUid: 'e1', targetPos: { x: 10, y: 10 }, amount: 3,
      sourceUid: 'p1', sourceDefId: 'ines', attackKind: 'bow',
      sourcePos: { x: 0, y: 0 }, neraiuchi: false,
    }]);
    expect(state.items.some((e) => e.kind === 'attackLine')).toBe(false);
  });
```

既存の「弓のヒットで attackLine が出る」テストは削除する。

- [ ] **Step 2: テストが落ちることを確かめる**

Run: `npx vitest run src/render/effects.test.ts`
Expected: FAIL

- [ ] **Step 3: `effects.ts` から `attackLine` を消す**

`Effect` union の `attackLine` の行、`ATTACK_LINE_DURATION` の定数、`spawnEffects` の
`if (ev.attackKind === 'bow') { ... }` のブロックを削除する。

- [ ] **Step 4: `draw.ts` から `attackLine` の描画を消す**

`drawEffects` の `case 'attackLine'` を削除し、import から `ATTACK_LINE_DURATION` を外す。
`_exhaustive` の網羅チェックが通ることを確認する。

- [ ] **Step 5: 飛翔体を描く**

`draw.ts` に足す。

```ts
/** 飛んでいる矢と魔法。位置はシムが持っているので、ここは見た目だけ */
function drawProjectiles(ctx: CanvasRenderingContext2D, state: BattleState): void {
  for (const pj of state.projectiles) {
    const p = mapToLogical(pj.pos);
    if (pj.kind === 'bow') {
      const from = mapToLogical(pj.source.pos);
      const dx = p.x - from.x;
      const dy = p.y - from.y;
      const len = Math.hypot(dx, dy) || 1;
      ctx.strokeStyle = '#e8e2d0';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(p.x - (dx / len) * 12, p.y - (dy / len) * 12);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
    } else {
      ctx.fillStyle = '#c07ae0';
      ctx.beginPath();
      ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(192, 122, 224, 0.5)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 9, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
}
```

`drawBattle` の `drawUnits(...)` の次、`drawEscortMarks(...)` の前に `drawProjectiles(ctx, state);` を足す。

- [ ] **Step 6: 型チェックとテストを通す**

Run: `npx tsc --noEmit && npm test`
Expected: どちらも PASS

- [ ] **Step 7: ブラウザで見る**

Task 6 の手順でステージ1を始め、イネスが敵を撃ったときに**矢が飛んでいき、届いた瞬間にダメージ数字が出る**ことを確かめる。

- [ ] **Step 8: コミット**

```bash
git add src/render/draw.ts src/render/effects.ts src/render/effects.test.ts
git commit -m "feat: ひしょうたいを えがき、ゆみの せんの えんしゅつを やめる"
```

---

## Task 17: ミストに魔法攻撃を持たせる

**Files:**
- Modify: `src/engine/schema.ts`, `src/core/combat.ts`, `assets/units/mist.json`
- Test: `src/core/combat.test.ts`, `src/engine/schema.test.ts`

**Interfaces:**
- Consumes: `PROJECTILE_SPEED`（Task 15、`magic` の速さを既に持っている）
- Produces: `AttackKind` に `'magic'`

- [ ] **Step 1: 失敗するテストを書く**

`src/core/combat.test.ts` に足す。

```ts
  it('まほうには bowDamageCap が きかない', () => {
    expect(computeDamage({
      power: 10, guard: 1, attackKind: 'magic', bowDamageCap: 2,
      bondBonus: 0, neraiuchi: false, targetFunbaru: false,
    })).toBe(9);
  });

  it('まほうも きんせつされると こうげきかんかくが ばいに なる', () => {
    expect(effectiveInterval(2.4, 'magic', true)).toBeCloseTo(4.8);
    expect(effectiveInterval(2.4, 'magic', false)).toBeCloseTo(2.4);
  });
```

`src/engine/schema.test.ts` に足す。

```ts
  it('attack に magic を かける', () => {
    const r = validateUnitDef('assets/units/mist.json', { ...UNIT, attack: 'magic' });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.attack).toBe('magic');
  });
```

- [ ] **Step 2: テストが落ちることを確かめる**

Run: `npx vitest run src/core/combat.test.ts src/engine/schema.test.ts`
Expected: FAIL

- [ ] **Step 3: `schema.ts` に `magic` を足す**

```ts
export type AttackKind = 'melee' | 'bow' | 'magic';

export const ATTACK_KINDS: readonly AttackKind[] = ['melee', 'bow', 'magic'];
```

- [ ] **Step 4: `effectiveInterval` を遠距離全般に広げる**

```ts
/** 遠距離職は接近されると弱い、という一貫したルールにする */
export function effectiveInterval(
  base: number,
  attackKind: AttackKind,
  meleeThreat: boolean,
): number {
  return attackKind !== 'melee' && meleeThreat ? base * 2 : base;
}
```

- [ ] **Step 5: テストが通ることを確かめる**

Run: `npx vitest run src/core/combat.test.ts src/engine/schema.test.ts`
Expected: PASS

- [ ] **Step 6: `assets/units/mist.json` を書き換える**

```json
{
  "id": "mist", "name": "ミスト", "role": "まほう",
  "combat": true,
  "maxHp": 22, "power": 5, "guard": 3,
  "attack": "magic", "range": 140,
  "attackInterval": 2.4, "speed": 60,
  "skillId": "omajinai",
  "color": "#c86fb0",
  "sprites": { "role": null, "face": null, "map": null }
}
```

おまじない（回復）はスキルのまま残す。

- [ ] **Step 7: 型チェックとテストを通す**

Run: `npx tsc --noEmit && npm test`
Expected: どちらも PASS

- [ ] **Step 8: ブラウザで見る**

ステージ1で、ミストが離れた位置から紫の魔法を飛ばすこと、下パネルのクラスが「まほう」になっていることを確かめる。

- [ ] **Step 9: コミット**

```bash
git add src/engine/schema.ts src/engine/schema.test.ts src/core/combat.ts src/core/combat.test.ts assets/units/mist.json
git commit -m "feat: ミストに えんきょりの まほうこうげきを もたせる"
```

---

## Task 18: ステージに `outro` を書けるようにする

**Files:**
- Modify: `src/engine/schema.ts`, `src/engine/registry.ts`, `src/core/dialogue.ts`
- Test: `src/engine/schema.test.ts`, `src/core/dialogue.test.ts`

**Interfaces:**
- Consumes: `IntroLine`, `readIntroLine`（既存）
- Produces: `StageDef.outro?: IntroLine[]`、`pickStageOutro(reg, stage): TalkLine[]`

- [ ] **Step 1: 失敗するテストを書く**

`src/engine/schema.test.ts` の `validateStageDef` の describe に足す。`STAGE` は既存のフィクスチャ。

```ts
  it('outro を かける', () => {
    const r = validateStageDef('assets/stages/stage1.json', { ...STAGE, outro: [{ text: 'おわり' }] });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.outro).toEqual([{ speaker: null, text: 'おわり', lineId: null }]);
  });

  it('outro でも text と lineId の りょうほうは かけない', () => {
    const r = validateStageDef('assets/stages/stage1.json', {
      ...STAGE, outro: [{ text: 'あ', lineId: 'い' }],
    });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.errors.some((e) => e.path === 'outro[0]')).toBe(true);
  });
```

`src/core/dialogue.test.ts` に足す。

```ts
describe('pickStageOutro', () => {
  it('outro を じゅんばんどおり かえす', () => {
    const reg = testRegistry();
    const stage = { ...reg.stages[0]!, outro: [
      { speaker: null, text: 'ちのぶん', lineId: null },
      { speaker: 'roran', text: 'やったね', lineId: null },
    ] };
    expect(pickStageOutro(reg, stage)).toEqual([
      { speaker: null, text: 'ちのぶん' },
      { speaker: 'roran', text: 'やったね' },
    ]);
  });

  it('outro が なければ からの はいれつ', () => {
    const reg = testRegistry();
    expect(pickStageOutro(reg, { ...reg.stages[0]!, outro: undefined })).toEqual([]);
  });
});
```

- [ ] **Step 2: テストが落ちることを確かめる**

Run: `npx vitest run src/engine/schema.test.ts src/core/dialogue.test.ts`
Expected: FAIL

- [ ] **Step 3: `schema.ts` に `outro` を足す**

`StageDef` に `outro?: IntroLine[];` を足し、`validateStageDef` の `intro` の直後に足す。

```ts
  if (o.outro !== undefined) {
    const outroRaw = requireArray(ctx, 'outro', o.outro) ?? [];
    stage.outro = outroRaw.map((item, i) => readIntroLine(ctx, `outro[${i}]`, item));
  }
```

- [ ] **Step 4: `dialogue.ts` を書き換える**

`pickStageIntro` の中身を共通化し、`pickStageOutro` を足す。

```ts
/** intro / outro の共通部分。片方だけ直して食い違うことがないように1本にする */
function pickTalk(reg: Registry, lines: IntroLine[] | undefined): TalkLine[] {
  const out: TalkLine[] = [];
  for (const line of lines ?? []) {
    // 検証で片方だけが埋まることは保証済み。lines に無い lineId も検証で弾かれている
    const text = line.text ?? (line.lineId === null ? undefined : reg.lines.get(line.lineId));
    if (text === undefined) continue;
    out.push({ speaker: line.speaker, text });
  }
  return out;
}

/** ステージ開始時の会話 */
export function pickStageIntro(reg: Registry, stage: StageDef): TalkLine[] {
  return pickTalk(reg, stage.intro);
}

/** 敵の本拠地に到達したときの会話 */
export function pickStageOutro(reg: Registry, stage: StageDef): TalkLine[] {
  return pickTalk(reg, stage.outro);
}
```

import に `import type { IntroLine } from '../engine/schema';` を足す。

- [ ] **Step 5: `registry.ts` の相互参照検証を intro / outro の両方に効かせる**

`stage.intro?.forEach(...)` のブロックを次に置き換える。

```ts
    const checkTalk = (kind: 'intro' | 'outro', lines: IntroLine[] | undefined): void => {
      lines?.forEach((line, i) => {
        if (line.speaker !== null && lookupDef(reg, line.speaker) === null) {
          errors.push({ file, path: `${kind}[${i}].speaker`, reason: `しらない はなして: ${line.speaker}` });
        }
        if (line.lineId !== null && !reg.lines.has(line.lineId)) {
          errors.push({ file, path: `${kind}[${i}].lineId`, reason: `lines に ない id: ${line.lineId}` });
        }
      });
    };
    checkTalk('intro', stage.intro);
    checkTalk('outro', stage.outro);
```

import に `IntroLine` を型として足す。

- [ ] **Step 6: テストが通ることを確かめる**

Run: `npx tsc --noEmit && npm test`
Expected: どちらも PASS

- [ ] **Step 7: コミット**

```bash
git add src/engine/schema.ts src/engine/schema.test.ts src/engine/registry.ts src/core/dialogue.ts src/core/dialogue.test.ts
git commit -m "feat: ステージに とうたつじの かいわ outro を かけるように する"
```

---

## Task 19: 本拠地に到達したときの会話を出す

**Files:**
- Modify: `src/main.ts`
- Modify: `assets/stages/stage1.json`, `assets/stages/stage2.json`, `assets/stages/stage3.json`

**Interfaces:**
- Consumes: `pickStageOutro`（Task 18）、`makeTalkState` / `advanceTalk` / `skipTalk` / `tickTalk`（既存）
- Produces: なし

**セーブ形式は変えない。**「とばす」は `save.clearedStageIds` を見る。`applyStageClear` は会話の後なので、初回は出ず2周目から出る。

**このタスクにユニットテストは書かない。** 変更するのは `main.ts` の配線だけで、`window` / `document` を掴んでいるためテストから読めない。「会話のあとにクリアが記録される」ことは Step 8 のブラウザ確認で担保する（`applyStageClear` 自体は `src/ui/flow.test.ts` で既にテストされている）。

- [ ] **Step 1: `Phase` に `'outro'` を足す**

```ts
type Phase = 'title' | 'select' | 'talk' | 'placement' | 'battle' | 'outro' | 'result' | 'defeat';
```

- [ ] **Step 2: 勝利の後始末を1本にまとめる**

`update()` の中に散らばらせず、関数にする。`endTalk` の下に置く。

```ts
/** 勝利の後始末。会話があってもなくても、必ずここを1度だけ通す */
function finishStage(state: BattleState): void {
  const r = applyStageClear(registry, save, stageId, state);
  save = r.save;
  hasSave = writeSave(window.localStorage, save) || hasSave;
  result = { gains: r.gains, newTitles: r.newTitles };
  phase = 'result';
}
```

- [ ] **Step 3: `update()` を書き換える**

会話中の分岐に `'outro'` を足す。

```ts
  if ((phase === 'talk' || phase === 'outro') && talk) {
    tickTalk(talk, dt);
    return;
  }
```

勝利の分岐を書き換える。

```ts
  } else if (battle.phase === 'victory') {
    clearBubbles(bubbles);   // 会話の邪魔になるので消す。時間は止まっている
    talk = makeTalkState(
      pickStageOutro(registry, battle.stage), talkMeasure, talkMaxWidth, TALK_MAX_LINES,
    );
    if (talk.done) finishStage(battle);
    else phase = 'outro';
  }
```

import に `pickStageOutro` を足す。

- [ ] **Step 4: `onPointerDown` に `case 'outro'` を足す**

`case 'talk'` の直後に置く。

```ts
    case 'outro': {
      if (!talk || !battle) return;
      // クリア済みのステージ（2周目以降）だけ「とばす」を出す
      if (save.clearedStageIds.includes(stageId) && hitRect(BTN.skip, p)) skipTalk(talk);
      else advanceTalk(talk, talkMeasure, talkMaxWidth, TALK_MAX_LINES);
      if (talk.done) finishStage(battle);
      return;
    }
```

- [ ] **Step 5: `render()` に `case 'outro'` を足す**

```ts
    case 'outro':
      if (battle && talk) {
        drawBattle(ctx, registry, battle, null, effects, escorts, images);
        drawTalk(ctx, registry, talk, save.clearedStageIds.includes(stageId), images);
      }
      break;
```

- [ ] **Step 6: 3本のステージに `outro` を書く**

`assets/stages/stage1.json` の `intro` の次に足す。

```json
  "outro": [
    { "text": "けむりは もう みえない。" },
    { "speaker": "roran", "text": "ここまで これた。\nつぎへ いこう" }
  ]
```

`assets/stages/stage2.json`（`intro` が無いので `defeat` の次に足す）。

```json
  "outro": [
    { "speaker": "gau", "text": "とりでを ぬけたぞ！" },
    { "speaker": "ines", "text": "みはりは もう いない。\nさきを いそぎましょう" }
  ]
```

`assets/stages/stage3.json`。

```json
  "outro": [
    { "speaker": "garum", "text": "……まさか、\nきみたちに やぶれるとは" },
    { "speaker": "roran", "text": "もう だれのことも\nおびやかさないで" },
    { "text": "とりでに あさひが さした。" }
  ]
```

- [ ] **Step 7: 型チェックとテストを通す**

Run: `npx tsc --noEmit && npm test`
Expected: どちらも PASS

- [ ] **Step 8: ブラウザで通しで確かめる**

Task 6 の手順でステージ1をクリアし、**本拠地に着いたら会話が出て、読み終えるとリザルトに進む**ことを確かめる。もう一度同じステージをクリアして「とばす」が出ることも確かめる。

- [ ] **Step 9: コミット**

```bash
git add src/main.ts assets/stages
git commit -m "feat: てきの ほんきょちに とうたつしたときの かいわを だす"
```

---

## Task 20: README を更新する

**Files:**
- Modify: `README.md`

**Interfaces:**
- Consumes: Task 1〜19 のすべて
- Produces: なし

**方針:** `docs/superpowers/` の下は作成時点のログなので遡って直さない。最新の状態を表す正典は `README.md`。

- [ ] **Step 1: 「そうさ」の節を直す**

- 必殺技ボタンが**下パネルの固定位置**にあること、選択していないとき・クールダウン中も出ていて理由が読めることを書く
- 配置フェーズの「はじめる」が同じ場所に出ることを書く
- 「移動先は 4 人ぶんが常に表示される」の段落から**「交戦中は足が止まるためマーカーが薄くなり」を削除**し、**指示した移動は交戦しても最後まで進む**ことに書き換える
- 戦闘中の吹き出しは**タップで消える（ドラッグは移動指示として通る）**ことを書く
- 会話は**ステージ開始時と、本拠地に到達したとき**の2回あることを書く

- [ ] **Step 2: 「構成」の表に新しいファイルを足す**

| ディレクトリ / ファイル | 責務 |
|---|---|
| `assets/images/` | ユニットの絵（PNG）。`sprites` から名前で参照する |
| `src/core/damage.ts` | 命中1回ぶんの解決。近接も飛翔体の着弾も通る |
| `src/core/projectiles.ts` | 飛翔体の生成・移動・命中 |
| `src/render/images.ts` | 画像の読み込みとキャッシュ |
| `src/render/sprites.ts` | 画像とプレースホルダを1本にまとめた描画 |
| `src/ui/skillbutton.ts` | 必殺技ボタンの表示状態 |

- [ ] **Step 3: 「コンテンツの足しかた」を直す**

コードを書き換えずに足せるものに追記する。

- **ステージ** — マップは **16列 × 23行、`cell` は 32**。`placementZone` は最下段、`victory.pos` は最上段に置く（下から上へ攻める）
- **本拠地に到達したときの会話** — ステージの `outro` に書く。書き方は `intro` と同じ
- **ユニットの絵** — `assets/images/` に正方形の PNG を置き、`assets/units/<id>.json` の `sprites` にファイル名を書く。`role` はクラスアイコン、`face` は顔（下パネル・ステージ選択・会話・リザルト）、`map` はフィールド上の姿。`null` のあいだは色つきの丸とクラス名の文字が出る。推奨サイズは `face` 128×128、`map` / `role` 64×64
- **攻撃の種別** — `attack` は `melee` / `bow` / `magic`。`bow` と `magic` は飛翔体として飛び、届いた瞬間にダメージが出る。`bowDamageCap` が効くのは `bow` だけ

- [ ] **Step 4: 「描画と入力をブラウザで確認する」を直す**

- `--window-size` を **540,945** にする
- 論理座標を **540×945** に書き換える
- マップ領域の論理 y を **50〜786** に書き換える
- 「確認しにくいもの」の段落から、**交戦中は動けないという記述を削除**する（指示した移動は止まらなくなった）。代わりに、飛翔体は着弾までの数フレームしか映らないので `Page.captureScreenshot` の連写で捉える必要があることを書く

- [ ] **Step 5: 冒頭のリンクに今回の設計と計画を足す**

```markdown
- 設計: `docs/superpowers/specs/2026-09-06-vertical-pivot-design.md`
- 実装計画: `docs/superpowers/plans/2026-09-06-vertical-pivot.md`
```

- [ ] **Step 6: すべて通す**

Run: `npm test && npm run build`
Expected: どちらも PASS

- [ ] **Step 7: コミット**

```bash
git add README.md
git commit -m "docs: たてがた・ひしょうたい・がぞうアセットを README に はんえいする"
```

---

## 完了の条件

- [ ] `npm test` と `npm run build` が両方通る
- [ ] 縦 540×945 で3ステージとも下から上へ攻めて クリアできる
- [ ] 必殺技ボタンが下パネルにあり、押せないときも理由が読める
- [ ] 吹き出しの上から始めたドラッグが移動指示になる
- [ ] 指示した移動が交戦しても止まらず、歩きながら撃つ
- [ ] 弓と魔法が飛んでいき、届いた瞬間にダメージ数字が出る
- [ ] ミストが遠距離から魔法を撃ち、下パネルに「まほう」が出る
- [ ] 本拠地に到達すると会話が出てからリザルトへ進む
- [ ] `assets/images/` に PNG を置き `sprites` に名前を書くと、コードを触らずに絵が差し替わる
- [ ] README が上記すべてを反映している
