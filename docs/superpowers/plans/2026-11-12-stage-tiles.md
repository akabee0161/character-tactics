# 各ステージのタイル（工程 4）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 全 10 ステージを、セリフが言っている場所に見えるタイルとマップの形にし、stage7・stage9 を暗くして明かりのまわりだけ明るく見せる。

**Architecture:** マップの形を先に決めて依頼者の承認を取り、その形が要るタイルを forge（`pixel-asset-forge/`）で描いて `sprites.json` でゲームへ書き出す。ゲームには、ステージの `darkness` と `legend` の `light` から明かりを求める純粋な関数と、暗い膜を重ねる描画を足す。最後にステージ JSON を書き換え、勝率を測って記録する。

**Tech Stack:** TypeScript（Vite・Vitest・Canvas2D）、Python 3.14（`pixel-asset-forge/.venv/bin/python`）

**Spec:** `docs/superpowers/specs/2026-11-12-stage-tiles-design.md`

## Global Constraints

- マップは 16 列 × 23 行、`cell` は 32。外周、`placement.minY`（528）、`victory.pos`（最上段 `{x:240,y:48}`、`radius` 40）は変えない
- `legend` のキーは 1 文字。タイル画像は 16×16 か 32×32 だけ。地面（16px）は `tile/<名前>.png`、1 マスの物（32px）は `sets/<名前>.png` を `sprites.json` に書き、`tile-<名前>.png` として書き出す
- 2 マス以上を占める物（大きな門など）は、ゲームに仕組みを足さず、1 マスずつの 32px セットに分けて `legend` の別の文字で並べる（作り手の判断として計画で決めた）
- forge の tile の規約（`pixel-asset-forge/types/tile/SPEC.md`）: 16×16、光源は左上、全周に輪郭を回さない、シームレス、物は地面を背景に含める、1 マスを 1 つの大きな物で埋めない。新しいセットは全点を置いたレイアウトを `layouts/` に足し、`tilemap.py --unplaced` が 0 で終わる
- 暗さは描画で出す。夜用・暗い用の色でタイルを描き分けない。たき火・ランプ・燭台の絵は止まった 1 枚。揺らすのは明かりの輪の大きさと明るさだけ
- セリフ・敵の種類と強さ・勝利条件・時間湧きの設定・村の効果・移動と視線のルールは変えない。歩けないマスは視線も遮る（川も）
- 勝率は測って記録するだけで、直さない
- 絵とマップは依頼者に見せて承認を得てから次へ進む。見せ方は PNG を data URI で埋め込んだ HTML を Artifact に公開してリンクを渡す（この手順はコントローラーが行う。サブエージェントは見せる材料を作って止まる）
- forge の確認の道具（`validate.py`・`check_colors.py`）で落ちたら、道具に従って絵を直す。依頼者に途中で聞かない
- 書き出しは README の 3 段（`export.build()` → `enemy_build.py --all` → `export.export()`）を `&&` でつなぐ。`export.py sprites.json assets/images` だけで流さない
- `node tools/gen-placeholder-sprites.mjs` を引数なしで動かさない。安全フックが変数展開・for ループ・標準入力の heredoc を止めるので、スクリプトは Write でファイルに書きリテラルのパスで呼ぶ
- 作業用の一時ファイルと進捗台帳は `.superpowers/sdd/2026-11-12-stage-tiles/`（git 管理外）。コミットは Conventional Commits + 日本語
- ゲーム内の文字列とスキーマのエラー文は、既存の書き方（`schema.ts` はひらがな中心の分かち書き）に合わせる

## Review Focus

1. 暗いステージで、HP バー・選択の輪・目的地の線・警戒の印・村の訪問済みの暗さが読めること（膜は地形とユニットの体にかけ、印と UI は膜の上に描く）→ Task 4 の描画順と Task 7 の画面確認
2. 明かりの輪がマップの端・壁際にあっても、膜がマップの外（上下のバー）にかからないこと → Task 4（膜はマップの範囲だけに描く）、Task 7 の画面確認
3. `darkness` の無いステージに `light` を書いたとき、黙って無視せず起動時エラーにする → Task 3 のテスト
4. 形を変えたステージで、敵・開始位置・時間湧き・見張りの持ち場・説得の相手・村が新しい歩けないマスにかからず、勝利地点へ歩いて着けること → Task 1 で `legend` に従う判定に直したテストと、Task 6 の `npm test`
5. 明かりの膜を毎フレーム作り直して重くならないこと（オフスクリーンの canvas は 1 枚を使い回す）→ Task 4

---

### Task 1: ステージのテストを legend に従って判定する

形を描き直す前に、`.` 以外の歩ける文字・`#` 以外の歩けない文字でもテストが正しく判定できるようにする。

**Files:**
- Modify: `src/engine/loader.test.ts`（43 行目の `stage.mapRows[cy]?.[cx] === '.'`、97・108・119 行目の `makeGrid(s.cell, s.mapRows)`）

**Interfaces:**
- Consumes: `makeGrid(cell: number, rows: string[], legend?: Legend): Grid`（`src/core/field.ts`）、`DEFAULT_LEGEND`（`src/engine/schema.ts`）
- Produces: なし

- [ ] **Step 1: 判定を legend に従う形に直す**

43 行目の `walkable` を `(stage.legend ?? DEFAULT_LEGEND)[ch]?.walkable === true` に、3 か所の `makeGrid(s.cell, s.mapRows)` を `makeGrid(s.cell, s.mapRows, s.legend)` にする。

- [ ] **Step 2: 直した判定が効くことを確かめる**

一時的に stage4 の `legend` に `"W": { "tile": null, "walkable": false }` を足し、敵が 1 体立つマスを `W` に変えて `npx vitest run src/engine/loader.test.ts` を走らせる。
Expected: 起動時の検査（schema）か「配置地点・敵・勝利地点が 歩ける マスに ある」が FAIL。確かめたら stage4 を元に戻す（`git diff assets/stages` が空）。

- [ ] **Step 3: 全テスト**

Run: `npm test`
Expected: 全件 PASS（件数は main と同じ 941 前後）

- [ ] **Step 4: Commit**

```bash
git add src/engine/loader.test.ts
git commit -m "test: ステージの歩けるマスの判定を legend に従わせる"
```

---

### Task 2: 10 ステージの形を決めて見せる（チェックポイント 1）

タイルを描く前に、各ステージの形（歩ける・歩けないと、何の場所か）を決めて依頼者の承認を得る。ここで決めた地形の種類が、Task 3 以降で描くタイルの一覧になる。

**Files:**
- Create: `.superpowers/sdd/2026-11-12-stage-tiles/shapes/stage{1..10}.txt`（git 管理外。下の形式）
- Create: `.superpowers/sdd/2026-11-12-stage-tiles/shape_page.py`（形のファイルから確認ページを作る使い捨てのスクリプト）

**Interfaces:**
- Produces: 形のファイル。1 行目から 23 行が 16 文字の `mapRows` の案、その後に `# <文字> <地形の名前> walkable|blocked [speed=<値>] [light=<px>]` の行。Task 6 はこれを `mapRows` と `legend` に写す

- [ ] **Step 1: 形の案を 10 本書く**

設計書の表の「残す骨組み」を守る。今の敵・開始位置・村の位置は、形に合わせて Task 6 で置き直すので、ここでは縛られない。ただし次は守る:
- stage1: 森（遅くなる）と村 v1 を残す。木の 1 マスを 18 行目・13 列目（0 始まり）に残す（`src/core/state.test.ts:147` が前提にしている）
- stage4: 川を渡れる場所は 1 か所。向こう岸（上側）に弓兵が立てる場所がある。川は歩けない（視線も遮る）ので、弓兵が渡り口を撃てる配置にする
- stage6: 正面（中央）が岩で通れず、左右に回り込む
- stage10: 閉じた大きな門が中央をふさぎ、脇から回り込んで最上段の勝利地点へ着ける。門は歩けない
- stage7・stage9: 明かりになる物（燭台・たき火・ランプ）の位置を形に含める（`light=` を付けた文字）
- 各ステージで、配置範囲（`y >= 528` の行 = 16 行目以降）に開始位置を置ける歩けるマスを十分残す

- [ ] **Step 2: 確認ページを作る**

`shape_page.py` は形のファイルを読み、地形の種類ごとの色で塗った 16×23 の格子（1 マス 20px 程度）と凡例、ステージ名、設計書の「場所」と「残す骨組み」をステージごとに並べた 1 枚の HTML を `.superpowers/sdd/2026-11-12-stage-tiles/shapes.html` に書く。今の形も横に並べる（`assets/stages/*.json` の `mapRows`）。

- [ ] **Step 3: コントローラーが依頼者に見せる**

`shapes.html` を Artifact で公開してリンクを渡し、承認を得る。差し戻しは形のファイルを直して出し直す。承認された地形の種類の一覧（ステージごと）を進捗台帳に `Ruling:` で書く。

---

### Task 3: スキーマに暗さと明かりを足す

**Files:**
- Modify: `src/engine/schema.ts`（`LegendEntry`・`StageDef`・`readLegend`・`validateStageDef`）
- Create: `src/render/lighting.ts`
- Test: `src/engine/schema.test.ts`、`src/render/lighting.test.ts`

**Interfaces:**
- Produces:
  - `LegendEntry = { tile: string | null; walkable: boolean; speed?: number; light?: number }` — `light` は明かりの輪の半径（px、整数、`MIN_LIGHT_RADIUS = 8` 以上 `MAX_LIGHT_RADIUS = 160` 以下）。歩けないマスにも書ける
  - `StageDef.darkness?: number` — 膜の濃さ（0 より大きく `MAX_DARKNESS = 0.9` 以下）。書かないステージは今までどおり
  - `type LightSource = { x: number; y: number; radius: number }`（マップ座標、マスの中心）
  - `lightSources(stage: StageDef): LightSource[]` — `mapRows` を左上から走査し、`legend` に `light` のある文字のマスごとに 1 つ
  - `flicker(radius: number, nowMs: number, seed: number): { radius: number; alpha: number }` — `radius` は元の ±6%、`alpha`（明かりの中心の抜け具合、0〜1）は 0.85〜1 の範囲でゆっくり揺れる。周期は 1.2〜1.8 秒。`seed`（マスの番号 `y * cols + x`）で明かりごとに位相をずらす

- [ ] **Step 1: スキーマの失敗するテストを書く**

`schema.test.ts` に（既存の `validateStageDef` のテストの最小のステージを土台に）:
- `darkness: 0.7` と `legend` の `light: 72` を読み、`stage.darkness === 0.7`、`stage.legend['C'].light === 72`
- `darkness: 0`・`0.95`・`"0.5"` はそれぞれ失敗（パス `darkness`）
- `light: 4`・`200`・`72.5` は失敗（パス `legend.C.light`）
- `darkness` の無いステージの `legend` に `light` があると失敗（パス `legend.C.light`、理由に `darkness` を含む）
- `darkness`・`light` を書かないステージは今までどおり読め、`stage.darkness === undefined`

- [ ] **Step 2: 失敗を確かめる**

Run: `npx vitest run src/engine/schema.test.ts`
Expected: 足したテストが FAIL

- [ ] **Step 3: `readLegend` と `validateStageDef` に読み込みを足す**

`light` は `requireNumber(..., { min: MIN_LIGHT_RADIUS, max: MAX_LIGHT_RADIUS, int: true })`。`darkness` は `validateStageDef` で読み、0 は `fail`。`darkness` が無いのに `light` がある検査は、両方を読んだ後に行う。定数 3 つは `schema.ts` から export する。

- [ ] **Step 4: スキーマのテストを通す**

Run: `npx vitest run src/engine/schema.test.ts`
Expected: PASS

- [ ] **Step 5: 明かりの関数の失敗するテストを書く**

`lighting.test.ts`:
- 3×2 のマップ `["a.C", "C.a"]`、`legend` の `C` だけ `light: 40` → `lightSources` が `[{x:80,y:16,radius:40},{x:16,y:48,radius:40}]`（cell 32）
- `darkness` はあっても `light` のある文字が無ければ `[]`
- `flicker(72, t, s)` を `t` = 0〜10000ms の 100ms おきで、`radius` が常に `72*0.94` 以上 `72*1.06` 以下、`alpha` が 0.85 以上 1 以下
- 同じ引数なら同じ値（決定的）。`seed` が違うと `t=0` の `radius` が違う

- [ ] **Step 6: `src/render/lighting.ts` を実装して通す**

Run: `npx vitest run src/render/lighting.test.ts && npm test`
Expected: 全件 PASS

- [ ] **Step 7: Commit**

```bash
git add src/engine/schema.ts src/engine/schema.test.ts src/render/lighting.ts src/render/lighting.test.ts
git commit -m "feat: ステージの暗さと legend の明かりを読む"
```

---

### Task 4: 暗い膜と明かりを描く

描画にはユニットテストを書かない（CLAUDE.md）。確認は画面で行う。

**Files:**
- Modify: `src/render/draw.ts`（`drawBattle` に `drawLighting` を足す）

**Interfaces:**
- Consumes: `lightSources`・`flicker`（Task 3）、`mapToLogical`（`src/render/viewport.ts`）
- Produces: `drawLighting(ctx: CanvasRenderingContext2D, state: BattleState, nowMs: number): void`（`draw.ts` 内）

- [ ] **Step 1: 描画を足す**

- `state.stage.darkness` が無ければ何もしない
- 描く順: `drawUnits` の直後（地形・訪問済みの村の暗さ・ユニットの体に膜がかかる）。ただし HP バー・選択の輪・目的地の線・警戒と説得の印・飛び道具・エフェクト・上のバーは膜の上に見えること。`drawUnits` の中で描いている HP バーと選択の輪は、膜の後に描くように分けるか、膜を `drawUnits` の前（地形の後）に置いてユニットの体だけ別に暗くするかを選ぶ。どちらでも、Review Focus 1 を満たすこと
- 膜はマップの範囲（16×23 マス）だけ。オフスクリーンの canvas を 1 枚モジュールに持って使い回し、毎フレーム `rgba(0,0,0,darkness)` で塗り、明かりごとに `destination-out` の放射グラデーション（中心の不透明度 = `flicker().alpha`、外周 0）で抜いてから重ねる。明かりに暖色をうっすら足すか（`lighter` の橙のグラデーション）は見た目で決めてよい
- `nowMs` は `performance.now()`（配置中も揺れるように、戦闘の時計 `state.time` は使わない）

- [ ] **Step 2: 画面で確かめる**

stage9 に一時的に `"darkness": 0.72` と、今の `#` のマスの一部へ `light` を持つ文字を足し、README の CDP の手順で配置画面と戦闘中を撮る。Review Focus 1・2 を見る。2 枚以上を 0.3 秒ずらして撮り、輪の大きさが変わっていることを画素で確かめる。

- [ ] **Step 3: 戻して全テスト**

stage9 を元に戻す（`git diff assets/stages` が空）。
Run: `npm test && npm run build`
Expected: 全件 PASS、build 成功

- [ ] **Step 4: Commit**

```bash
git add src/render/draw.ts
git commit -m "feat: 暗いステージに膜を重ね、明かりのまわりを揺らしながら明るく抜く"
```

---

### Task 5: 新しいタイルを forge で描く（地形の種類ごとに見せる。チェックポイント 2）

Task 2 で承認された地形の種類のうち、既存のタイルで描けないものを描く。描く単位（セットの家族）は次のとおりで、家族ごとに 5a〜5f の手順を繰り返し、家族ごとに依頼者に見せる。Task 2 の承認で要らなくなった家族は飛ばし、増えた家族は同じ手順で足す。

| 家族 | 使うステージ | 中身（見立て。Task 2 の結果で決める） | レイアウト |
|---|---|---|---|
| 川原 | stage4 | 砂利の川原、浅瀬（歩ける）、1 マス幅の川の 32px セット（直線・曲がり） | `layouts/riverside.txt` |
| 石切り場 | stage6 | 切り出した石の塊（1 マスの物）、岩壁（崖） | `layouts/quarry.txt` |
| 城壁 | stage2・stage10 | 外から見た石壁（天面と正面）、閉じた大きな門（1 マスずつのセット）、見張り台 | `layouts/fortress.txt` |
| 関所 | stage8 | 関所の門（木）、番小屋 | `layouts/checkpoint.txt` |
| 野営地 | stage9 | テント、たき火、ランプ（明かりの物）、踏み固めた地面 | `layouts/camp.txt` |
| 塔 | stage7 | 塔らしい物（魔法陣・水晶など）。床と壁は城内セットを使う | `layouts/tower.txt` |

**Files（家族ごと）:**
- Create: `pixel-asset-forge/assets/tile/<名前>.txt`、1 マスの物は `pixel-asset-forge/sets/<物>.txt`
- Create: `pixel-asset-forge/layouts/<家族>.txt`
- Modify: `pixel-asset-forge/types/tile/SPEC.md`（「セット構成」に家族を足し、決めごとがあれば節を足す）
- Modify（色を足すときだけ）: `pixel-asset-forge/palette/` の該当ファイル

- [ ] **Step 5a: 規約と手本を読む**

`pixel-asset-forge/CLAUDE.md`、`types/tile/SPEC.md`、手本の `layouts/field.txt`・`layouts/castle_interior.txt`・`layouts/objects.txt` と、その中のタイルのテキスト。

- [ ] **Step 5b: 色を足すなら先に測る**

隣り合う予定の色の組を `tools/probe_colors.py --candidate ... --against ...` で測り、通る色を選んでから描く。

- [ ] **Step 5c: タイルとセットを描き、構造の検査を通す**

Run（`pixel-asset-forge/` で）: `.venv/bin/python tools/validate.py && .venv/bin/python tools/check_colors.py && .venv/bin/python tools/sets.py && .venv/bin/python tools/render.py`
Expected: すべて 0 で終わる

- [ ] **Step 5d: 3 通りの目視**

`tools/tilemap.py --repeat` で継ぎ目と反復、`--layout layouts/<家族>.txt` で別の物に見えないか。ユニット（`build/sheets/roran.png` など）と並べて見劣りしないか。締めは `--layout`。
Run: `.venv/bin/python tools/tilemap.py --unplaced`
Expected: 0 で終わる（置き忘れのタイルが無い）

- [ ] **Step 5e: forge のテスト**

Run: `.venv/bin/python -m unittest discover -s tests`
Expected: OK

- [ ] **Step 5f: 見せる材料を作って止まる**

`--layout` の画像と、各タイル・セットの拡大画像を data URI で埋め込んだ HTML を `.superpowers/sdd/2026-11-12-stage-tiles/tiles-<家族>.html` に作る。コントローラーが Artifact で依頼者に見せ、承認を得てからコミットする。

- [ ] **Step 5g: Commit（家族ごと）**

```bash
git add pixel-asset-forge/assets/tile pixel-asset-forge/sets pixel-asset-forge/layouts pixel-asset-forge/types/tile/SPEC.md
git commit -m "feat: <家族> のタイルを forge に追加"
```

全家族が終わったら、`pixel-asset-forge/UPSTREAM.md` の「forge に戻す候補」に 1 行（足した家族と SPEC の節）を足してコミットする。

---

### Task 6: 10 ステージを描き直す

**Files:**
- Modify: `sprites.json`（Task 5 と既存のタイルのうち、ステージで使うものの書き出し）
- Create: `assets/images/tile-*.png`（書き出しの結果）
- Modify: `assets/stages/stage{1..10}.json`（`mapRows`・`legend`・`darkness`、敵・開始位置・時間湧き・見張りの持ち場・説得の相手・村の位置）
- Modify（stage1 の木を動かした場合だけ）: `src/core/state.test.ts:147`

**Interfaces:**
- Consumes: Task 2 の形のファイル、Task 3 の `darkness`・`light`、Task 5 のタイル

- [ ] **Step 1: 書き出す**

`sprites.json` に使うタイルを足し、README の 3 段（`pixel-asset-forge/` で）を `&&` でつないで流す。
Expected: 0 で終わり、`git status assets/images` に新しい `tile-*.png` だけが増える（敵・味方のシートは変わらない）。

- [ ] **Step 2: ステージ JSON を書き換える**

形のファイルを `mapRows` と `legend` に写す。stage7・stage9 に `darkness`（初めの値は stage9 が 0.72、stage7 が 0.55）と、明かりの文字に `light`（初めの値はたき火 72・ランプ 40・燭台 48）を書く。値は Task 7 の画面で見て変えてよい。
敵・開始位置・時間湧き・見張りの持ち場・説得の相手・村を、新しい形の歩けるマスへ置き直す。数・種類・AI・`defId` は変えない。置き直しは今の位置に最も近い歩けるマスを基本にし、骨組み（stage4 の向こう岸の弓兵、stage6 の盾持ちの待ち伏せなど）が崩れないように置く。村の `col`・`row` は村のタイルの文字のマスに合わせる。

- [ ] **Step 3: 全テストと build**

Run: `npm test && npm run build`
Expected: 全件 PASS、build 成功。落ちたら位置を直す（テストは変えない。stage1 の木を動かしたときの `state.test.ts:147` だけは例外で、新しい木の位置に合わせる）

- [ ] **Step 4: Commit**

```bash
git add sprites.json assets/images assets/stages src/core/state.test.ts
git commit -m "feat: 10 ステージのマップを場所らしい形とタイルに描き直す"
```

---

### Task 7: 全ステージを画面で見せる（チェックポイント 3）

- [ ] **Step 1: 撮る**

README の CDP の手順（`Emulation.setDeviceMetricsOverride` で 540×945・倍率 1 を接続のたびにかける）で、10 ステージの配置画面と戦闘中を 1 枚ずつ撮る。stage7・stage9 は Review Focus 1・2 を見る。

- [ ] **Step 2: 見せる材料を作って止まる**

撮った画面を遊ぶ順に並べ、各ステージの場所（設計書の表）を添えた HTML を `.superpowers/sdd/2026-11-12-stage-tiles/stages.html` に作る。コントローラーが Artifact で依頼者に見せる。差し戻しは Task 5・6 に戻って直し、撮り直す。

---

### Task 8: 勝率を測って記録し、文書を直す

**Files:**
- Create: `docs/superpowers/specs/2026-11-12-stage-tiles-results.md`
- Modify: `README.md`（「コンテンツの足しかた」の `legend` の説明に `light`、ステージに `darkness`）、`HANDOVER.md`（`## 進捗`）
- Create: `docs/superpowers/ledgers/2026-11-12-stage-tiles.md`（進捗台帳の写し）

- [ ] **Step 1: 測る**

Run: `npm run balance`
結果の表を、工程 2 の結果（`docs/superpowers/specs/2026-11-11-difficulty-tuning-results.md`）の勝率と並べて results に書く。帯から外れたステージを書くだけで、直さない。

- [ ] **Step 2: README を直す**

`legend` の説明に `light`（明かりの輪の半径 px、8〜160 の整数、`darkness` のあるステージだけ）を、ステージの説明に `darkness`（0 より大きく 0.9 以下、膜の濃さ）を足す。

- [ ] **Step 3: 台帳を写し、進捗を直す**

`.superpowers/sdd/2026-11-12-stage-tiles/progress.md` を `docs/superpowers/ledgers/2026-11-12-stage-tiles.md` に写す。HANDOVER.md の `## 進捗` を、工程 4 を `（完了）`、`← 今ここ` を工程 5 に、`段階:` を `実装（8 タスク中 8）` に、`次にやること:` を工程 5（依頼者の人手のレビュー）に直す（書式は `~/.claude/rules/progress.md`）。

- [ ] **Step 4: 最終確認**

Run: `npm test && npm run build`、`pixel-asset-forge/` で `.venv/bin/python tools/validate.py && .venv/bin/python tools/tilemap.py --unplaced && .venv/bin/python -m unittest discover -s tests`
Expected: すべて成功

- [ ] **Step 5: Commit**

```bash
git add docs README.md HANDOVER.md
git commit -m "docs: 工程 4 の勝率の記録と、暗さ・明かりの書き方を追加"
```
