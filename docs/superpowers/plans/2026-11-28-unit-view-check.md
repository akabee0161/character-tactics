# ユニットの絵の確認コマンド（unit-view）実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** シートの中身を Vitest で確かめ、ゲームの描画関数で全ユニットを描いた画素をシートと照らし合わせる `npm run unit-view` を作る。

**Architecture:** 1 体ぶんの描画を `draw.ts` から切り出し、開発用の別ページ（`unit-view.html`、本番ビルドに入らない）がそれで全シートを升に並べて描く。照らし合わせはページの中の純関数が行い、`tools/unit-view.ts` が vite の開発サーバと Chromium（CDP）を起こして結果を読み、終了コードを返す。

**Tech Stack:** TypeScript、Vite 5、Vitest 2、vite-node、Node 24（組み込みの `WebSocket`・`node:zlib`）、headless Chromium（CDP）

**Spec:** `docs/superpowers/specs/2026-11-28-unit-view-check-design.md`

## Global Constraints

- 依存を増やさない（`package.json` の dependencies / devDependencies を変えない）
- 描画コード（Canvas2D）にはユニットテストを書かない。テストは純ロジックとレイアウト計算だけ（CLAUDE.md）
- `src/core/**` と `src/engine/**` は `window` / `document` / `localStorage` を参照しない
- 戦闘の見た目を変えない（Task 3 の前後で画素が一致すること）
- ゲーム本体（`index.html`・`src/main.ts`）と `pixel-asset-forge/` は変えない
- ページは論理 1px = 画面 1px。`devicePixelRatio` は 1。スマホの倍率の確認はしない
- Chromium の実行ファイルは環境変数 `CHROME`（パスをコードに書かない）、CDP のポートは環境変数 `CDP_PORT`（既定 9333）。127.0.0.1:9222 は使わない
- Chromium を起こす前に `free -m` で空きを見る。起こすときは `systemd-run --user --scope -p MemoryMax=900M` を付ける
- `npm test` は約 4 分。背景で流し、ログの末尾で結果を読む
- **コミット・push・PR は依頼者が頼んだときだけ。** 各タスクの終わりは `git diff --stat` で差分を確かめるまで。push の前には `HANDOVER.md` の `## 進捗` を今の状態に直す
- テスト名・コメントは既存に合わせて日本語

## Review Focus

1. **シートを共有する定義**（ally06・ally08 と `-foe`、敵の見た目違い）: シートのファイルごとに 1 回だけ描き・確かめる。味方の定義があれば味方として描く → Task 4 のテスト「シートを共有する定義は 1 区画にまとめ、味方を選ぶ」
2. **飛行の定義**（ally11）: 持ち上げた位置が正解、影は描かない → Task 5 のテスト「lift の分だけ上にずれた絵を一致とみなす」
3. **画像の読み込み失敗・時間切れ**: 丸のプレースホルダのまま照らし合わせて「全部違う」と出さず、終了コード 2 で原因を出す → Task 6 Step 3・Task 7 Step 4
4. **48px のシート**（ガルム）: 升・足元の計算が 32px 固定になっていない → Task 4 のテスト「48px のシートの升は 48 + 2 × 16」
5. **キャンバスの大きさ**: シートが増えても Chromium の上限を超えない → Task 4 のテスト「全体の高さと幅は 8192 以下」

---

### Task 1: PNG を読む関数（テスト専用）

**Files:**
- Create: `src/engine/png-node.ts`
- Test: `src/engine/png-node.test.ts`

**Interfaces:**
- Produces: `export type Rgba = { width: number; height: number; data: Uint8Array }`（RGBA 8bit を行優先で並べたもの）、`export function readPng(bytes: Uint8Array): Rgba`

対応する形式は、色の型 6（RGBA）・ビット深度 8・インターレースなしだけ（今の 38 枚はすべてこの形式）。フィルタは 0〜4 の全部を扱う（PIL は行ごとに選ぶ）。それ以外は `PNG の形式に対応していない: 色の型 N / 深度 N / インターレース N` で throw。ファイル先頭に「テスト専用。`node:zlib` を使うのでブラウザのコードから import しない」と書く。

- [ ] **Step 1: 失敗するテストを書く。** テストの中に、RGBA の画素とフィルタ番号の並びから PNG のバイト列を作る小さな関数（`zlib.deflateSync` と CRC32）を置き、次を確かめる
  - `2×2 の RGBA をフィルタ 0 で読める`（4 画素の値が一致）
  - `フィルタ 1〜4 で書いた 3×3 を読むと、フィルタ 0 と同じ画素になる`（行ごとにフィルタ 0,1,2,3,4 を混ぜる。Paeth を含む）
  - `IDAT が複数に分かれていても読める`
  - `色の型 2（RGB）は形式のエラーで止まる`（`/対応していない/`）
  - `PNG の署名が無ければ止まる`
  - `assets/images/roran-map.png を読むと、幅と高さが IHDR と一致し、data の長さが 幅×高さ×4`
- [ ] **Step 2:** `npx vitest run src/engine/png-node.test.ts` → FAIL（`readPng` が無い）
- [ ] **Step 3:** `readPng` を実装する（チャンクを走査し、IDAT を連結して `inflateSync`、行ごとにフィルタを戻す）
- [ ] **Step 4:** 同じコマンド → PASS
- [ ] **Step 5:** `git diff --stat` で 2 ファイルだけを確かめる

### Task 2: シートの中身のテスト

**Files:**
- Create: `src/engine/sheet-frames.test.ts`

**Interfaces:**
- Consumes: `readPng`（Task 1）、`FOOT_INSET`（`src/render/sprites.ts`）、`validateUnitDef` / `validateEnemyDef`（`src/engine/schema.ts`）。定義の読み方は `src/engine/sheet-size.test.ts` の `sheetsInDir` と同じものを、このファイルにも書く（テストファイルどうしの import はしない。十数行の重複を許す）

シートのファイル名で重複を除く。行 `r`（0〜11）の状態は `['idle','walk','attack'][Math.floor(r / 4)]`。

- [ ] **Step 1: テストを書く**（`it.each` をシートのファイルごとに）
  - `<sheet>: 各行の、コマ数より左の列には絵がある` — 行 r・列 c < `sheet[state].frames` のコマに、アルファ > 0 の画素が 1 つ以上
  - `<sheet>: 各行の、コマ数から右の列は空` — c ≥ frames のコマのアルファが全部 0
  - `<sheet>: 足元の行より下は空` — すべてのコマで、y > `frame - FOOT_INSET` の行のアルファが全部 0
  - 失敗のメッセージに、シート名・状態・方向（`['down','up','left','right'][r % 4]`）・列を入れる
- [ ] **Step 2:** `npx vitest run src/engine/sheet-frames.test.ts`。PASS を期待する。**落ちたら、テストの条件を変えず、落ちたシート・状態・方向・列を全部記録して作業を止め、依頼者に報告する**（承認済みの絵の扱いは依頼者が決める）
- [ ] **Step 3:** わざと壊して落ちることを確かめる: テストの中の `FOOT_INSET` を一時的に `FOOT_INSET + 1` にして流し、足元のテストが落ちることを見たら戻す
- [ ] **Step 4:** `git diff --stat`

### Task 3: CDP の道具と、1 体ぶんの描画の切り出し

切り出しの前に「前」を撮る必要があるので、CDP の道具を先に作り、それで前後を撮る。

**Files:**
- Create: `tools/cdp.ts`
- Modify: `src/render/draw.ts`（`drawUnits` 319〜421 行のループの中身、`FLYING_LIFT` 304 行）
- 一時（コミットしない・最後に消す）: `tmp-battle-shot.html`、`src/dev/tmp-battle-shot.ts`、スクラッチの撮影スクリプト

**Interfaces:**
- Produces（`tools/cdp.ts`）:
  - `export type Cdp = { send<T = unknown>(method: string, params?: Record<string, unknown>): Promise<T>; close(): void }`
  - `export function startDevServer(): Promise<{ url: string; close(): Promise<void> }>` — `vite` の `createServer({ server: { port: 5180, strictPort: false, host: '127.0.0.1' } })`、`url` は `resolvedUrls.local[0]`（base の `/play/character-tactics/` を含む）
  - `export function launchChrome(opts: { chrome: string; port: number }): Promise<{ cdp: Cdp; close(): Promise<void> }>` — `--headless=new --no-sandbox --disable-gpu --remote-debugging-port=<port> --user-data-dir=<一時ディレクトリ> about:blank`。`/json/list` が答えるまで最大 15 秒待ち、page の `webSocketDebuggerUrl` に組み込みの `WebSocket` で繋ぐ。起動に失敗したら `Chromium が起きない: <理由>` で throw
  - `export function openPage(cdp: Cdp, url: string, size: { width: number; height: number }, initScript?: string): Promise<void>` — `Emulation.setDeviceMetricsOverride`（deviceScaleFactor 1）、`initScript` があれば `Page.addScriptToEvaluateOnNewDocument`、`Page.navigate`、`Page.loadEventFired` を待つ
  - `export function evaluate<T>(cdp: Cdp, expression: string): Promise<T>` — `Runtime.evaluate`（`returnByValue: true, awaitPromise: true`）。例外は `ページの中で失敗: <text>` で throw
  - `export function waitFor<T>(cdp: Cdp, expression: string, timeoutMs: number): Promise<T>` — 値が null / undefined でなくなるまで 200ms ごとに評価。時間切れは `時間切れ: <expression>` で throw
  - `export function screenshot(cdp: Cdp, path: string): Promise<void>` — `Page.captureScreenshot`（png）を保存
- Produces（`src/render/draw.ts`）:
  - `export const FLYING_LIFT = 5`（値は変えない）
  - `export type FigureMarks = { isAlly: boolean; selected: boolean; funbaru: boolean; neraiuchi: boolean; bowCap: boolean; buffs: ActiveBuffs; hpRatio: number }`
  - `export function drawUnitFigure(ctx: CanvasRenderingContext2D, def: SpriteDef, p: Vec2, radius: number, images: ImageCache, frame: AnimFrame, marks: FigureMarks, phase: 'all' | 'bodies' | 'marks'): void` — 今のループの「`drawMapUnit` から `drawHpBar` まで」をそのまま移す。`p` は持ち上げ済みの絵の中心。影・跳ぶ技の持ち上げ・飛行の持ち上げ・ノックバック・倒れた仲間は `drawUnits` に残す

描画コードなのでユニットテストは無い。前後の画素の一致で確かめる。

- [ ] **Step 1: `tools/cdp.ts` を書く。** `npx tsc --noEmit` が通る
- [ ] **Step 2: 一時の撮影ページを作る。** `tmp-battle-shot.html` と `src/dev/tmp-battle-shot.ts`: `loadRegistry` → `newSave` → ステージを URL の `?stage=<index>` で選び、`createBattleState(registry, stage, save, 12345, initialSortie(registry, stage, save.members, save.sortie))`、画像を全部 `decode()` してから `drawBattle(ctx, registry, state, null, makeEffectState(), new Set(), images, makeAnimStore())` を 540×945 のキャンバスに 1 回描き、`window.__shot = true`。明るいステージは `stages[0]`、暗いステージは `darkness` を持つ最初のステージ
- [ ] **Step 3: 「前」を撮る。** スクラッチ（`/tmp/claude-1000/-home-ubuntu-workspace/0eb7f053-4449-50a4-9e5f-d68257bf5212/scratchpad/`）に撮影スクリプトを Write で作り、`tools/cdp.ts` を使って 2 ステージを撮る（`initScript` は `performance.now = () => 1000;`）。`npx vite-node <スクリプトのリテラルのパス>` で、`systemd-run --user --scope -p MemoryMax=900M` を付けて流す。PNG をスクラッチに `before-light.png`・`before-dark.png` で保存
- [ ] **Step 4: `drawUnitFigure` を切り出し、`drawUnits` から呼ぶ。** `FLYING_LIFT` を export。`npx tsc --noEmit` が通る
- [ ] **Step 5: 「後」を撮り、前と比べる。** 同じスクリプトで `after-*.png` を撮り、2 組がバイト単位で同じか（`cmp`）、違えばデコードして画素で比べる。一致を期待する。違えば Step 4 を直す
- [ ] **Step 6:** 一時のファイル（`tmp-battle-shot.html`・`src/dev/tmp-battle-shot.ts`）を消す。`git status` に残っていないことを確かめる
- [ ] **Step 7:** `git diff --stat`（`tools/cdp.ts` と `src/render/draw.ts` だけ）

### Task 4: 並べ方（純関数）

**Files:**
- Create: `src/dev/unit-view-layout.ts`
- Test: `src/dev/unit-view-layout.test.ts`

**Interfaces:**
- Consumes: `Registry`（`src/engine/registry.ts`）、`MapSheet`、`Dir`・`AnimState`・`DIRS`・`STATES`（`src/render/anim.ts`）、`FOOT_INSET`
- Produces:
  - `export const CELL_PAD = 16`（升の、コマの四方の余白。旗は右に 7px、HP バーは飛行の持ち上げ込みで上に 14px はみ出すため）
  - `export const LABEL_H = 14`
  - `export const VIEW_BG = [255, 0, 255] as const`
  - `export type ViewEntry = { defId: string; isAlly: boolean; flying: boolean; bowCap: boolean; sheet: MapSheet }`
  - `export function pickViewEntries(reg: Registry): ViewEntry[]` — `sprites.map` を持つ定義を、仲間（`reg.units`、ID 順）→ 敵（`reg.enemies`、ID 順）の順に見て、シートのファイル名ごとに最初の 1 つだけ残す。`bowCap` は敵の `bowDamageCap !== null`
  - `export type ViewCell = { state: AnimState; dir: Dir; col: number; row: number; foot: { x: number; y: number }; box: { x: number; y: number; w: number; h: number } }`
  - `export type ViewSection = { entry: ViewEntry; label: { x: number; y: number }; cells: ViewCell[] }`
  - `export type ViewLayout = { width: number; height: number; sections: ViewSection[] }`
  - `export function layoutUnitView(entries: ViewEntry[], maxWidth: number): ViewLayout` — 区画は 12 行 × 最大のコマ数の升。升の一辺は `frame + 2 * CELL_PAD`。升の足元は `(box.x + box.w / 2, box.y + CELL_PAD + frame - FOOT_INSET)`（整数）。区画は左から右へ詰め、`maxWidth` を超えたら次の段へ。区画の上に `LABEL_H` の文字の帯

- [ ] **Step 1: 失敗するテストを書く**（Registry は `src/engine/loader.ts` を使わず、`Map` で小さく組む）
  - `シートを共有する定義は 1 区画にまとめ、味方を選ぶ`（味方 a と敵 a-foe が同じシート → 1 件、`isAlly: true`）
  - `シートを持たない定義は入れない`
  - `区画は 12 行 × 最大のコマ数の升を持つ`（idle 2・walk 4・attack 3 → 48 升、行 r の状態と方向が `STATES[floor(r/4)]`・`DIRS[r%4]`）
  - `48px のシートの升は 48 + 2 × 16`
  - `升どうしも、升と文字の帯も重ならない`（32px と 48px を混ぜた 40 件の偽の entries で。今のシートは約 30 枚なので、増えたときの余裕を見る）
  - `全部がキャンバスに収まり、全体の高さと幅は 8192 以下`（同じ 40 件、`maxWidth` 2048）
  - `足元は升の中で、コマの下端から FOOT_INSET 上`
- [ ] **Step 2:** `npx vitest run src/dev/unit-view-layout.test.ts` → FAIL
- [ ] **Step 3:** 実装する
- [ ] **Step 4:** 同じコマンド → PASS
- [ ] **Step 5:** `git diff --stat`

### Task 5: 照らし合わせ（純関数）

**Files:**
- Create: `src/dev/unit-view-compare.ts`
- Test: `src/dev/unit-view-compare.test.ts`

**Interfaces:**
- Produces:
  - `export type Pixels = { width: number; height: number; data: Uint8ClampedArray | Uint8Array }`
  - `export function expectedTopLeft(foot: { x: number; y: number }, frame: number, lift: number): { x: number; y: number }` — `{ x: foot.x - frame / 2, y: foot.y - (frame - FOOT_INSET) - lift }`。`bodyCenter` を使わない（独立の正解）
  - `export function compareCell(actual: Pixels, topLeft: { x: number; y: number }, sheet: Pixels, src: { x: number; y: number }, frame: number, bg: readonly [number, number, number]): number` — 違った画素の数。範囲はコマの正方形とその周り 1px。正方形の中: シートのアルファ > 0 なら RGB が一致、0 なら背景色。周り 1px: 背景色
  - `export function countCovered(bodyOnly: Pixels, withMarks: Pixels, topLeft: { x: number; y: number }, frame: number, bg: readonly [number, number, number]): number` — 正方形の中で、`bodyOnly` が背景色でなく、`withMarks` と RGB が違う画素の数

- [ ] **Step 1: 失敗するテストを書く**
  - `シートのコマをそのまま置いた画素は 0`
  - `1 画素ずれて置くと 0 でない`（右に 1、下に 1 の両方）
  - `色が 1 画素違えば 1`
  - `透明の所に色があれば数える`
  - `周り 1px にはみ出した色を数える`
  - `lift の分だけ上にずれた絵を一致とみなす`（`expectedTopLeft` に lift 5）
  - `expectedTopLeft は、足元の行（frame - FOOT_INSET）が foot.y に来る位置`（32 と 48）
  - `countCovered は、絵の上に塗った印の画素だけを数え、背景の上の印は数えない`
- [ ] **Step 2:** `npx vitest run src/dev/unit-view-compare.test.ts` → FAIL
- [ ] **Step 3:** 実装する
- [ ] **Step 4:** 同じコマンド → PASS
- [ ] **Step 5:** `git diff --stat`

### Task 6: 開発用のページ

**Files:**
- Create: `unit-view.html`（`index.html` と同じ形で、`<canvas id="view">` と `<script type="module" src="/src/dev/unit-view.ts">`。`<body>` の余白 0、背景は `VIEW_BG`）
- Create: `src/dev/unit-view.ts`

**Interfaces:**
- Consumes: `loadRegistry`・`imageUrls`（`src/engine/loader.ts`）、`SKILL_EFFECT_IDS`（`src/core/skills.ts`）、`makeImageCache`・`imageFor`、`drawUnitFigure`・`FLYING_LIFT`・`UNIT_R`（Task 3）、`bodyCenter`、`frameOf`、Task 4・5 の全部
- Produces: `window.__unitView: UnitViewResult`
  - `export type UnitViewResult = { error: string | null; width: number; height: number; sections: { sheet: string; defId: string; mismatched: { state: AnimState; dir: Dir; col: number; pixels: number }[]; maxCovered: number }[] }`

描画コードなのでユニットテストは無い（Task 7 のコマンドで確かめる）。

- [ ] **Step 1: ページを書く。** 流れ:
  1. `loadRegistry` が失敗したら `error` に入れて終わる
  2. 画像を全部 `img.decode()` で待つ。1 枚でも失敗したら `error: '画像を読めない: <名前>'`
  3. `layoutUnitView(pickViewEntries(registry), 2048)` の大きさで、見える canvas（印あり）と、見えない canvas（体だけ）を作る。両方を `VIEW_BG` で塗る
  4. 升ごとに `frame = frameOf(cell.state, cell.dir, sheet, 0)` ではなく `{ row: cell.row, col: cell.col }` を直接渡す（`frameOf` の検算にならないよう、行は Task 4 の `row`）。`lift = entry.flying ? FLYING_LIFT : 0`、`p = bodyCenter(cell.foot, def, UNIT_R)` から `p.y -= lift`。体だけの canvas に `phase: 'bodies'`、見える canvas に `'all'` で `drawUnitFigure`。marks は `{ isAlly, selected: false, funbaru: false, neraiuchi: false, bowCap, buffs: { cheer: false, ward: false }, hpRatio: 1 }`
  5. 見える canvas の区画の `label` に `シート名 定義ID` を 10px の monospace で書く（升の外）
  6. シートの画像を別の canvas に描いて `getImageData`。升ごとに `compareCell`（体だけの canvas）と `countCovered`
  7. `window.__unitView` に結果を置く。途中の例外は `error` に入れる
- [ ] **Step 2:** `npx tsc --noEmit` が通る
- [ ] **Step 3:** `npm run build` → `out/play/character-tactics/` の中に `unit-view` を名に含むファイルが無いことを `find out/play/character-tactics -iname '*unit-view*'` が空で確かめる。`index-*.js` の中に `__unitView` の文字が無いことを `grep -l __unitView -r out/play/character-tactics` が空で確かめる
- [ ] **Step 4:** `git diff --stat`

### Task 7: `npm run unit-view`

**Files:**
- Create: `tools/unit-view.ts`
- Modify: `package.json`（`scripts` に `"unit-view": "vite-node tools/unit-view.ts --"`。依存は変えない）

**Interfaces:**
- Consumes: `tools/cdp.ts`（Task 3）、`UnitViewResult`（Task 6。型だけ import）

- [ ] **Step 1: スクリプトを書く。**
  - 引数 `--out <dir>`（既定 `out/unit-view`）。`CHROME` が無ければ `環境変数 CHROME に Chromium の実行ファイルを入れてください` を出して終了コード 2
  - `startDevServer` → `launchChrome({ chrome, port: Number(process.env.CDP_PORT ?? 9333) })` → まず小さい窓で `<url>unit-view.html` を開き、`waitFor('window.__unitView ?? null', 60000)` で大きさを得る → `Emulation.setDeviceMetricsOverride` を結果の `width`×`height` にして `screenshot(<out>/unit-view.png)`、結果を `<out>/unit-view.json` にも書く
  - 表示: シートごとに `OK  roran-map.png (roran)  かぶり最大 12` / `NG  ...  違う升 3`、NG の升は `  attack left 2: 37 画素`
  - 終了コード: `error` が null で全部一致なら 0、違う升があれば 1、`error` あり・時間切れ・起動失敗は 2（理由を出す）
  - `finally` で Chromium と開発サーバを止める
- [ ] **Step 2: 今のアセットで流す。** `free -m` を見てから、`systemd-run --user --scope -p MemoryMax=900M env CHROME=$HOME/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome npm run unit-view` → 終了コード 0 を期待する。落ちたら、絵を変えず、テストも緩めず、落ちた升を記録して依頼者に報告する
- [ ] **Step 3: わざと壊して 1 になることを確かめる**（どちらも戻す）
  - `src/render/sprites.ts` の `bodyCenter` の `- FOOT_INSET` を一時的に `- FOOT_INSET + 1` → 全升が NG
  - `src/render/sprites.ts` の `drawMapUnit` の `frame.row * s` を一時的に `(frame.row ^ 1) * s`（行の並びの入れ替え）→ NG
  - 方向の決め方（`frameOf` の行の計算）はページが使わない（升の `row` を直接渡す）。その誤りは `src/render/anim.test.ts` が見る
- [ ] **Step 4: 起動の失敗を確かめる。** `CHROME=/nonexistent npm run unit-view` → 終了コード 2 と理由。`unit-view.ts` の待ち時間を一時的に 1ms にして時間切れ → 2（戻す）
- [ ] **Step 5:** 撮った `out/unit-view/unit-view.png` を Read で見て、区画と文字が読めることを確かめる
- [ ] **Step 6:** `git diff --stat`

### Task 8: 正典の更新と全体の確認

**Files:**
- Modify: `README.md`（「描画と入力をブラウザで確認する」の `?debug` の表の後に小節「ユニットの絵を確かめる（`npm run unit-view`）」、「構成」の表に `unit-view.html`・`src/dev/`・`tools/unit-view.ts`・`tools/cdp.ts`・`src/engine/png-node.ts`）
- Modify: `CLAUDE.md`（「開発コマンド」に `npm run unit-view   # ユニットの絵をゲームの描画で描き、シートと画素で照らし合わせる（CHROME が要る）`）

- [ ] **Step 1: README の小節を書く。** 中身: 何を確かめるか（体の画素がシートのコマと一致・足元の位置・飛行の持ち上げ）、何を確かめないか（スマホの倍率・地形や演出との重なり。理由は forge ISSUES.md の「ゲームが整数倍でない倍率で描く」）、印のかぶりは数だけ、`CHROME`・`CDP_PORT`・`--out`、メモリの注意（`free -m`、`systemd-run --user --scope -p MemoryMax=900M` の例）、終了コード 0/1/2、結果の PNG と JSON の場所、シートの中身は `npm test` の `sheet-frames.test.ts` が見ること
- [ ] **Step 2: CLAUDE.md に 1 行足す**
- [ ] **Step 3:** `npm test` を背景で流し、ログの末尾で全部 PASS を確かめる
- [ ] **Step 4:** `npm run build` が通る
- [ ] **Step 5:** `npm run unit-view` をもう一度流して 0
- [ ] **Step 6:** `git status` と `git diff --stat` で、一時のファイル（Task 3）が残っていないこと、変えたファイルが計画どおりであることを確かめ、依頼者に結果を報告する（コミットは頼まれてから）
