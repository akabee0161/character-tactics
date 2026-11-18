# 戦闘の演出 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 村での会話（戦闘を止める）・仲間が倒れたときの余韻（ゆっくり・帯・点滅）・11 個の技の見た目を、戦闘の計算を変えずに足す。

**Architecture:** 計算（`src/core/`）は結果を変えず、出来事（`SimEvent`）に描くための値を足すだけ。演出は画面の側（`src/render/`・`src/ui/`・`main.ts`）で持つ。技の見た目は技ごとの描き方の表（`src/render/skill-fx.ts`）、倒れたときは純ロジック（`src/ui/fallen.ts`）、村人は新しい定義（`assets/npcs/`）。

**Tech Stack:** TypeScript・Canvas2D・Vite・Vitest。見本のページは esbuild（`node_modules/.bin/esbuild`、Vite に同梱）で 1 枚の HTML にまとめる。

**Spec:** `docs/superpowers/specs/2026-11-17-battle-direction-design.md`

## Global Constraints

- 戦闘の計算の結果を変えない。最後に `npm run balance -- --check` が終了コード 0（約 4 分。バックグラウンドで流す）
- 描画にはユニットテストを書かない（CLAUDE.md）。見た目は README の CDP 手順で撮り、Artifact（PNG を data URI で埋め込んだ HTML）で依頼者に見せ、承認を得てから次へ進む。スクリーンショットを撮らないと描画が進まないので、タップの前後に撮る
- 画面の文字は漢字仮名交じり（常用漢字中心、ルビなし）。低学年でも読める語
- 新しい ID は名前と関係ない `npcNN`。名前が出てよいのは JSON の `name` と本文だけ
- コミットは Conventional Commits + 日本語の要約
- 作業用の道具（見本のページの生成器など）は最後に片付ける（`rm -r` と `rm`。`rm -rf` は拒否される）
- 設計の数字: 倒れたときのゆっくり 0.3 倍・1 人約 1.5 秒（実時間）、点滅 2.5 秒（画面の時間）、駆け抜ける・急降下の滑り 0.6 秒前後（画面の時間）。どれも見本で依頼者と合わせて変えてよい

## Review Focus

1. **演出の後に技が勝手に出る**: 村の会話・倒れたときの帯の後に、前のタップで構えた技（`pendingSkill`）が出ない → Task 8 で会話に入るとき今の加入の会話と同じく片付ける。Task 5 のゆっくりでは操作を止めない（帯は自動で消える）ので片付けない
2. **同じ tick に村とレベルアップ**: 経験値の村（stage8）で、会話 → カードの順に出て、どちらも欠けない → Task 8 の手順で CDP で確かめる。順の判定は `nextInterrupt` のテスト（Task 8）
3. **遊び直しで受け取り済みの村**: 会話を出さず、セリフ欄に「村の 人が 手を ふっている」だけ → Task 1 の `fresh: false` のテストと Task 7 の `pickVillageTalk` が null を返すテスト
4. **2 人が続けて倒れる**: 帯が 1 人ずつ出て、ゆっくりが延びる → Task 4 のテスト
5. **滑っている途中のユニットへ移動の指示**: 見た目が計算の位置へ飛んで続き、止まらない・消えない → Task 2 の `cancelDash` のテスト

---

## ファイルの地図

| ファイル | 責務 | Task |
|---|---|---|
| `src/core/types.ts` | `skill` の出来事に `aim`・`affected`、`villageVisited` に `fresh`、`PendingRecruit` に `village` | 1 |
| `src/core/skills.ts` | 効果が `aim`・`affected` を書く場所（`SkillContext.out`） | 1 |
| `src/core/events.ts` | `fresh` と `PendingRecruit.village` を出す | 1 |
| `src/render/effects.ts` | 滑り（`dash`）・数字を出す時刻のずらし（`wait`）・点滅（`fallen`）・技の演出の寿命 | 2・4 |
| `src/render/skill-fx.ts`（新） | 技ごとの描き方の表 `SKILL_FX` と長さ `SKILL_FX_DURATION` | 2 |
| `src/render/draw.ts` | `skillCast` を `SKILL_FX` へ委ねる。見た目の位置で描く。点滅中の仲間を描く | 2・4 |
| `tools/fx-page/`（新・最後に消す） | 技と倒れたときの見本のページ | 3 |
| `src/ui/fallen.ts`（新） | 倒れたときの帯の順番とゆっくりの時間（純ロジック） | 4 |
| `src/ui/screens.ts` | 倒れたときの帯 `drawFallenBanner`、会話の顔を `lookupSpeaker` で引く | 5・6 |
| `src/core/dialogue.ts` | 倒れたときのセリフをセリフ欄に出さない。新しい村の会話はセリフ欄に出さない。`pickVillageTalk` | 5・7 |
| `src/main.ts` | ゆっくり・帯・村の会話で止める・止める順 | 5・8 |
| `src/engine/schema.ts`・`registry.ts` | 村人の定義、村の `npc`・`talk`、`$visitor`、`lookupSpeaker` | 6・7 |
| `assets/npcs/npc01〜06.json`・`assets/images/npc0N-face.png`（新） | 村人 6 人と仮の顔 | 6 |
| `tools/gen-placeholder-sprites.mjs` | 村人の顔を書けるようにする | 6 |
| `src/ui/interrupts.ts`（新） | 同じ tick に起きた止める理由の順番（純ロジック） | 8 |
| `assets/stages/stage1・4・5・6・8・10.json` | 村の会話の文 | 9 |
| `README.md`・`CLAUDE.md` | 正典の更新 | 11 |

---

### Task 1: 出来事に描くための値を足す

**Files:**
- Modify: `src/core/types.ts`（`SimEvent` の `skill`・`villageVisited`、`PendingRecruit`）
- Modify: `src/core/skills.ts`（`SkillContext`、`SKILL_EFFECTS` の各効果、出来事を積む所）
- Modify: `src/core/events.ts`（`applyVillage`）
- Test: `src/core/skills.test.ts`、`src/core/events.test.ts`

**Interfaces:**
- Produces:
  - `SimEvent` の `skill`: `{ ...今の項目, aim: Vec2 | null; affected: Vec2[] }`。`aim` は火の雨の指した所・突きの槍の先（`to`）・たたき割りの相手の位置・駆け抜ける／急降下の行き先、ほかは `null`。`affected` は効果が及んだ相手の位置（ダメージ技は当てた敵、おまじないは回復した仲間、引きつけるは範囲の敵、はげます・結界は範囲の仲間、踏ん張る・狙い撃ちは空）
  - `SimEvent` の `villageVisited`: `{ ...今の項目, fresh: boolean }`
  - `PendingRecruit`: `{ ...今の項目, village: { villageId: string; visitorDefId: string } | null }`（説得は `null`）
  - `SkillContext`: `{ state; self; dest?; out: { aim: Vec2 | null; affected: Vec2[] } }`

- [ ] **Step 1: 失敗するテストを書く**（`skills.test.ts`。今あるテストの盤面の作り方に合わせる）
  - `it('火の雨の skill 出来事は aim に指した所、affected に当てた敵の位置を持つ')` — 敵 2 体（範囲内 1・範囲外 1）、`dest` を指して出し、`aim` が `dest`、`affected` が範囲内の敵の位置 1 つ
  - `it('突きの skill 出来事の aim は槍の先（長さ 80 の点）')` — 自分 (100,100)、敵 (100,60) で `aim` が `{ x: 100, y: 20 }`
  - `it('踏ん張るの skill 出来事は aim が null、affected が空')`
  - `it('はげますの affected は範囲の仲間の位置（自分を含む）')`
- [ ] **Step 2: 失敗するテストを書く**（`events.test.ts`）
  - `it('初めての talk の村は fresh が true')`
  - `it('受け取り済みの xp の村は fresh が false で text は VILLAGE_DONE_TEXT')`（今の 151 行目のテストの盤面を使う）
  - `it('すでに仲間の recruit の村は fresh が false')`
  - `it('recruit の村の pendingRecruit は village に村の id と訪れた仲間の defId を持つ')`
  - `it('説得の pendingRecruit の village は null')`
- [ ] **Step 3: 走らせて落ちるのを見る** — Run: `npx vitest run src/core/skills.test.ts src/core/events.test.ts` / Expected: 上のテストが FAIL
- [ ] **Step 4: 実装する** — `applySkill` が `out = { aim: null, affected: [] }` を作って効果に渡し、出来事に載せる。各効果は当てた・効かせた相手の位置を `out.affected` に積む（`skillHit` の呼び出しと同じ所）。値を書くだけで、ダメージ・回復・位置の計算は変えない。`villageVisited` は `VILLAGE_DONE_TEXT` を出す枝と「すでに仲間」の枝で `fresh: false`、ほかは `true`。今ある出来事を作るテストのオブジェクトに新しい項目を足す
- [ ] **Step 5: 走らせて通るのを見る** — Run: `npm test` / Expected: 全部 PASS
- [ ] **Step 6: コミット** — `feat: 技と村の出来事に描くための値を足す`

### Task 2: 技の描き方の表と、駆け抜ける・急降下の滑り

**Files:**
- Create: `src/render/skill-fx.ts`
- Modify: `src/render/effects.ts`、`src/render/draw.ts`
- Test: `src/render/effects.test.ts`

**Interfaces:**
- Consumes: Task 1 の `skill` 出来事の `aim`・`affected`
- Produces:
  - `skill-fx.ts`: `export const SKILL_FX_DURATION: Record<string, number>`（技 ID → 演出の秒数。11 個すべて）、`export const DASH_DURATION: Record<string, number> = { kakenukeru: 0.6, kyuukouka: 0.6 }`、`export type SkillFxDraw = (ctx: CanvasRenderingContext2D, fx: SkillFx, t: number) => void`（`t` は 0→1 の進み）、`export const SKILL_FX: Record<string, SkillFxDraw>`。座標は論理座標（`draw.ts` の `atBody` を通した後の値）で受ける
  - `effects.ts`: `Effect` に `{ kind: 'skillFx'; skillId: string; from: Vec2; to: Vec2; aim: Vec2 | null; affected: Vec2[]; ttl: number; duration: number }` を足し、今の `skillCast`・`trail` は消す。全部の `Effect` に `wait?: number`（0 より大きい間は描かず、寿命も減らさない）。`EffectState` に `dash: Map<string, { from: Vec2; to: Vec2; elapsed: number; duration: number }>`
  - `export function displayPos(state: EffectState, uid: string, pos: Vec2): Vec2` — 滑り中は `from`→`to` を `elapsed / duration` で線形に補間、それ以外は `pos`
  - `export function cancelDash(state: EffectState, uid: string): void`
  - `export type SkillFx = Extract<Effect, { kind: 'skillFx' }>`

- [ ] **Step 1: 失敗するテストを書く**（`effects.test.ts`）
  - `it('skill 出来事から skillFx を 1 つ足し、長さは SKILL_FX_DURATION')` — 11 個の技 ID すべてで `ttl === SKILL_FX_DURATION[id]`（`it.each`）
  - `it('駆け抜けるは dash を始め、displayPos は半分の時刻で中点')` — from (0,0)・to (100,0)、`tickEffects(state, 0.3)` 後に `displayPos` が `{ x: 50, y: 0 }`、0.6 秒後は `dash` が消えて `pos` をそのまま返す
  - `it('駆け抜けるの通り道の敵の hit と数字は、見た目がその敵を通る時刻まで wait する')` — 同じ出来事の束に skill（from (0,0)・to (100,0)）と hit（sourceUid が同じ、targetPos (25,10)）。hit と damageText の `wait` が `0.6 * 0.25`
  - `it('急降下の hit は着く時刻まで wait する')` — `wait` が `DASH_DURATION.kyuukouka`
  - `it('wait の間は ttl が減らない')`
  - `it('cancelDash の後は displayPos が計算の位置を返す')`（Review Focus 5）
  - `it('SKILL_FX は SKILL_FX_DURATION と同じ 11 個の技を持つ')` — キーの集合が `assets/skills.json` の id の集合と同じ
- [ ] **Step 2: 走らせて落ちるのを見る** — Run: `npx vitest run src/render/effects.test.ts` / Expected: FAIL
- [ ] **Step 3: 実装する** — `spawnEffects` は出来事の束を 2 回見る（1 回目で `dash` を持つ技の `uid` を集め、2 回目で同じ `sourceUid` の hit に `wait` を付ける）。駆け抜けるの `wait` は、hit の `targetPos` を from→to の線分へ射影した割合（0〜1 に丸める）× 長さ。描き方は設計書の「技ごとの案」の表どおりに 11 個書く。駆け抜けるの残像は、`dash` 中の見た目の位置の後ろに薄い本体の丸を 3 つ、通り道の敵の火花は `wait` が明けた `hit` に重ねる。急降下は弧（中点を 40px 持ち上げた 2 次の曲線）で、着いた所に土煙の輪
- [ ] **Step 4: `draw.ts` を直す** — `drawUnits` の足元を `displayPos(effects, unit.uid, unit.pos)` から取る（HP バー・旗・選択の輪も付いてくる）。`drawEffects` は `wait > 0` を飛ばし、`skillFx` は `SKILL_FX[skillId]` に `t = 1 - ttl / duration` と `atBody` を通した座標で渡す。`main.ts` で移動の指示（`commands` に `move` を積む所）を出すとき、その uid に `cancelDash` をかける
- [ ] **Step 5: 走らせて通るのを見る** — Run: `npm test && npm run build` / Expected: PASS・ビルド成功
- [ ] **Step 6: コミット** — `feat: 技ごとの見た目と、駆け抜ける・急降下の滑り`

### Task 3: 技の見本のページ（依頼者の確認 1）

**Files:**
- Create: `tools/fx-page/fx-page.ts`、`tools/fx-page/build.mjs`（どちらも Task 11 で消す）

**Interfaces:**
- Consumes: Task 2 の `SKILL_FX`・`SKILL_FX_DURATION`・`DASH_DURATION`、`assets/images/` の草のタイルと仲間・敵の待機のコマ

- [ ] **Step 1: ページを作る** — `fx-page.ts` は、`SKILL_FX` を import し、技ごとに 1 枚の canvas（論理 160×160 を 2 倍表示、草のタイルを敷く）で、使い手と敵 3 体（まじない師・盾持ち・ならず者の待機の 1 コマ目）を置いて技を繰り返し再生する。各 canvas の上に技の名前と使い手の名前。上に「速さ 1 倍・1/4」と「止める」。駆け抜ける・急降下は、本体の丸と HP バーが滑り、数字が通る時刻に出る。`build.mjs` は esbuild で `fx-page.ts` を IIFE にまとめ、PNG を data URI にして 1 枚の HTML（`out/fx/fx-page.html`）に埋め込む
- [ ] **Step 2: 書き出して開けるのを確かめる** — Run: `node tools/fx-page/build.mjs && ls -la out/fx/fx-page.html` / Expected: 1 ファイルができる。headless Chromium で開いてスクリーンショットを 1 枚撮り、11 枚の canvas が描かれているのを自分で見る
- [ ] **Step 3: Artifact で依頼者に見せる** — 依頼者に見てもらう点: 11 個の見た目、駆け抜ける・急降下の滑りの長さ（0.6 秒）、滑っている間に行き先で殴り合いや白い輪が先に出るずれ（設計書「滑らせ方の決まり」）
- [ ] **Step 4: 直しを入れて出し直す** — 指摘を `skill-fx.ts` の数字・描き方に入れ、同じ URL に出し直す。承認されるまで繰り返す。承認の内容と変えた数字を台帳に `Ruling:` で残す
- [ ] **Step 5: コミット** — `fix: 技の見た目を見本の指摘に合わせる`（道具はコミットしない。`out/` は git 管理外）

### Task 4: 倒れたときの順番とゆっくり、点滅

**Files:**
- Create: `src/ui/fallen.ts`
- Test: `src/ui/fallen.test.ts`
- Modify: `src/render/effects.ts`（点滅）、`src/render/draw.ts`（点滅中の仲間を描く）
- Test: `src/render/effects.test.ts`

**Interfaces:**
- Produces:
  - `fallen.ts`: `export const SLOW_SCALE = 0.3`、`export const SLOW_PER_UNIT = 1.5`（実時間の秒）、`export type FallenBanner = { uid: string; defId: string; text: string | null }`、`export type FallenState = { queue: FallenBanner[]; remaining: number }`、`export function makeFallenState(): FallenState`、`export function noteFallen(state: FallenState, reg: Registry, events: SimEvent[]): void`（`unitRetired` ごとに `retire:<defId>` の文を引いて queue に積み、`remaining` に `SLOW_PER_UNIT` を足す）、`export function tickFallen(state: FallenState, realDt: number): void`、`export function currentBanner(state: FallenState): FallenBanner | null`（先頭。先頭の持ち時間 `SLOW_PER_UNIT` を使い切ったら次へ）、`export function timeScale(state: FallenState): number`（`remaining > 0` なら `SLOW_SCALE`、それ以外 1）、`export function clearFallen(state: FallenState): void`
  - `effects.ts`: `export const FALLEN_BLINK_DURATION = 2.5`、`EffectState` に `fallen: Map<string, number>`（uid → 残りの秒）、`unitRetired` で積む。`export function isBlinkVisible(remaining: number): boolean`（0.15 秒ごとに見える・見えないを切り替える）

- [ ] **Step 1: 失敗するテストを書く**（`fallen.test.ts`）
  - `it('仲間が倒れると帯に最期の言葉が出て、ゆっくりになる')` — `retire:roran` の文、`timeScale` が 0.3
  - `it('1.5 秒たつと帯が消え、速さが 1 に戻る')`
  - `it('2 人が同じ tick に倒れると、帯は 1 人ずつ 1.5 秒ずつ出て、ゆっくりは 3 秒')`（Review Focus 4）
  - `it('1 人目の帯の途中で 2 人目が倒れると、2 人目の帯は 1 人目の後に出る')`
  - `it('最期の言葉が無い仲間は text が null で、帯は出る')`
  - `it('敵の unitDefeated では何もしない')`
- [ ] **Step 2: 失敗するテストを書く**（`effects.test.ts`）
  - `it('unitRetired で点滅を 2.5 秒始め、時間がたつと消える')`
  - `it('isBlinkVisible は 0.15 秒ごとに切り替わる')`
  - `it('resetEffects は点滅も空にする')`
- [ ] **Step 3: 走らせて落ちるのを見る** — Run: `npx vitest run src/ui/fallen.test.ts src/render/effects.test.ts` / Expected: FAIL
- [ ] **Step 4: 実装する** — `drawUnits` は `retired` の仲間のうち `effects.fallen` にある uid だけを、`isBlinkVisible` が真のときに描く（HP バー・旗・印は描かない）。コマは今の `frameFor` のまま
- [ ] **Step 5: 走らせて通るのを見る** — Run: `npm test` / Expected: PASS
- [ ] **Step 6: コミット** — `feat: 仲間が倒れたときの順番・ゆっくり・点滅`

### Task 5: 倒れたときの帯を画面に出す（依頼者の確認 2）

**Files:**
- Modify: `src/main.ts`、`src/ui/screens.ts`、`src/core/dialogue.ts`
- Test: `src/core/dialogue.test.ts`

**Interfaces:**
- Consumes: Task 4 の `fallen.ts` 全部、`FALLEN_BLINK_DURATION`
- Produces: `screens.ts`: `export function drawFallenBanner(ctx: CanvasRenderingContext2D, reg: Registry, banner: FallenBanner, images: ImageCache): void`

- [ ] **Step 1: 失敗するテストを書く**（`dialogue.test.ts`）— `it('仲間が倒れたときのセリフはセリフ欄に出さない（帯で出す）')`: `unitRetired` だけの束で `pickDialogue` が空。今の 54 行目・94 行目の `retire:` を期待するテストは、このテストに置き換える
- [ ] **Step 2: 走らせて落ちるのを見る** — Run: `npx vitest run src/core/dialogue.test.ts` / Expected: FAIL
- [ ] **Step 3: 実装する** — `pickDialogue` から `unitRetired` の枝と `PRIORITY` の `retire` を消す。`main.ts` の `update` は、戦闘中だけ `dt = realDt * timeScale(fallen)`（`?debug` の `simDt` を通した後に掛ける）で `tickEffects`・`syncDisplayedHp`・`accumulator` を進め、`tickFallen(fallen, realDt)` は実時間で進める。`step` の後に `noteFallen`。ステージに入るとき・挑み直すときに `clearFallen`。描画は戦闘中に `currentBanner` があれば `drawFallenBanner`（マップの上、帯の位置は見本で決める。最初は論理 y 300 前後、横いっぱいの半透明の黒の帯に、顔 64px・名前・最期の言葉）
- [ ] **Step 4: 負けになる倒れ方の扱いを依頼者に決めてもらう** — CDP で、仲間が倒れる場面（ステージ 1 を `?debug` で開き、ロランを敵の群れへ歩かせる）を、倒れた瞬間・0.5 秒後・1.5 秒後・2.5 秒後で撮る。護衛対象が倒れて負けになる場面も今のまま（すぐ負けの画面）で撮る。Artifact で見せ、帯の位置・大きさ・ゆっくりの長さと、「負けのときもゆっくりと帯を見せてから負けの画面へ進むか」を聞く
- [ ] **Step 5: 決まった扱いを入れる** — 「見せてから進む」なら、`battle.phase === 'defeat'` でも `currentBanner(fallen) !== null` の間は `phase = 'defeat'` にせず、帯が終わってから移る（その間 `step` は呼ばない）。「すぐ進む」なら何もしない。依頼者の答えを台帳に `Ruling:` で残す。直した画面を撮って見せ、承認を得る
- [ ] **Step 6: 走らせて通るのを見る** — Run: `npm test && npm run build` / Expected: PASS
- [ ] **Step 7: コミット** — `feat: 仲間が倒れたら画面をゆっくりにして最期の言葉の帯を出す`

### Task 6: 村人の定義と仮の顔

**Files:**
- Modify: `src/engine/schema.ts`（`NpcDef`・`validateNpcDef`）、`src/engine/registry.ts`（`npcs`・`lookupSpeaker`・顔の画像の検査・名前の置き換えに村人を足す）
- Modify: `src/ui/screens.ts`（`drawTalk` の顔と名前を `lookupSpeaker` で引く）
- Modify: `tools/gen-placeholder-sprites.mjs`（`npc01`〜`npc06` の顔を書ける）
- Create: `assets/npcs/npc01.json`〜`npc06.json`、`assets/images/npc01-face.png`〜`npc06-face.png`
- Test: `src/engine/schema.test.ts`、`src/engine/registry.test.ts`

**Interfaces:**
- Produces:
  - `schema.ts`: `export type NpcDef = { id: string; name: string; color: string; sprites: { face: string | null } }`、`export function validateNpcDef(file: string, raw: unknown): Validated<NpcDef>`
  - `registry.ts`: `Registry` に `npcs: Map<string, NpcDef>`。`export function lookupSpeaker(reg: Registry, id: string): (SpriteDef & { name: string }) | null`（仲間 → 敵 → 村人の順に引く。村人は `{ name, color, role: '', sprites: { role: null, face, map: null } }` の形で返す）。会話の話し手の検証（`checkLines`）は `lookupSpeaker` を使う
  - 村人の JSON: `{ "id": "npc01", "name": "村の 人", "color": "#a08860", "sprites": { "face": "npc01-face.png" } }`（名前は 6 人とも仮で「村の 人」。Task 9 で村ごとに直してよい）

- [ ] **Step 1: 失敗するテストを書く**
  - `schema.test.ts`: `it('村人は id・name・color・sprites.face を持つ')`、`it('村人の sprites.face が文字列でも null でもないと不正')`
  - `registry.test.ts`: `it('assets/npcs/ の村人を読み込む')`、`it('村人の顔の画像が assets/images/ に無いと起動時エラー')`、`it('lookupSpeaker は村人の名前と顔を返す')`、`it('ステージの会話の話し手に村人を書ける')`、`it('村人の id が仲間・敵の id と重なると起動時エラー')`
- [ ] **Step 2: 走らせて落ちるのを見る** — Run: `npx vitest run src/engine` / Expected: FAIL
- [ ] **Step 3: 実装する** — `buildRegistry` の振り分けに `npcs` のディレクトリを足す。`gen-placeholder-sprites.mjs` は `npc01`〜`npc06` を知っている ID に足し、顔だけ（`<id>-face.png`、128px。今の `faceFor` を村人の色で）を書く
- [ ] **Step 4: 仮の顔を書いて 6 つの JSON を置く** — Run: `node tools/gen-placeholder-sprites.mjs npc01 npc02 npc03 npc04 npc05 npc06` / Expected: `npc0N-face.png` が 6 枚。6 枚とも同じ中身（`cmp` で確かめる）
- [ ] **Step 5: 走らせて通るのを見る** — Run: `npm test && npm run build` / Expected: PASS
- [ ] **Step 6: コミット** — `feat: 村人の定義と仮の顔`

### Task 7: 村の会話の書き方と組み立て

**Files:**
- Modify: `src/engine/schema.ts`（`VillageDef` に `npc`・`talk`）、`src/engine/registry.ts`（村の会話の検証と名前の置き換え）
- Modify: `src/core/dialogue.ts`（`pickVillageTalk`、新しい村の会話はセリフ欄に出さない）
- Test: `src/engine/schema.test.ts`、`src/engine/registry.test.ts`、`src/core/dialogue.test.ts`

**Interfaces:**
- Consumes: Task 1 の `fresh`・`PendingRecruit.village`、Task 6 の `lookupSpeaker`・`npcs`
- Produces:
  - `VillageDef`: `{ ...今の項目, npc: string | null; talk: IntroLine[] }`（どちらも省略できる。省略は `null`・`[]`）
  - `export const VISITOR_SPEAKER = '$visitor'`（`schema.ts`）。`talk` の `speaker` にだけ書ける
  - 本文の `{visitor}` は読み込みでは置き換えず残し、知らない ID としても数えない（村の `talk` と `text` だけ）
  - `dialogue.ts`: `export function pickVillageTalk(reg: Registry, stage: StageDef, villageId: string, visitorDefId: string): TalkLine[]` — 村の `talk` の行（`$visitor` → `visitorDefId`、本文の `{visitor}` → 訪れた仲間の名前）の後に、`recruit` 以外は `text`（`{visitor}` を置き換え、地の文）を 1 行。`recruit` の村は `talk` の行の後に `pickRecruitTalk` の行
  - `export function villageStops(ev: Extract<SimEvent, { type: 'villageVisited' }>): boolean` — `ev.fresh`

- [ ] **Step 1: 失敗するテストを書く**
  - `schema.test.ts`: `it('村は npc と talk を書ける')`、`it('talk の話し手に $visitor を書ける')`、`it('intro の話し手に $visitor は書けない')`
  - `registry.test.ts`: `it('村の npc が村人に無いと起動時エラー')`、`it('村の talk と text の {visitor} は知らない名前にならない')`、`it('intro の {visitor} は知らない名前のエラーになる')`
  - `dialogue.test.ts`: `it('pickVillageTalk は村人の行・訪れた仲間の行・何が起きたかの行の順')`（訪れた仲間が gau のとき、`$visitor` の行の話し手が `gau`、最後の行の `{visitor}` がガウ）、`it('recruit の村は村人の行の後に加入の会話')`、`it('fresh な村の出来事はセリフ欄に出さない')`、`it('fresh でない村の出来事はセリフ欄に出す')`（Review Focus 3）
- [ ] **Step 2: 走らせて落ちるのを見る** — Run: `npx vitest run src/engine src/core/dialogue.test.ts` / Expected: FAIL
- [ ] **Step 3: 実装する** — `readVillages` で `npc`・`talk` を読む（`readTalk` を使い、`$visitor` を許す引数を足す）。`registry.ts` の名前の置き換えは、村の `talk`・`text` のときだけ `visitor` を `{visitor}` のまま返す。`pickDialogue` の `villageVisited` の枝は `fresh` のとき積まない
- [ ] **Step 4: 走らせて通るのを見る** — Run: `npm test` / Expected: PASS
- [ ] **Step 5: コミット** — `feat: 村の会話の書き方と組み立て`

### Task 8: 村に着いたら戦闘を止めて会話を出す

**Files:**
- Create: `src/ui/interrupts.ts`
- Test: `src/ui/interrupts.test.ts`
- Modify: `src/main.ts`

**Interfaces:**
- Consumes: Task 7 の `pickVillageTalk`・`villageStops`、Task 1 の `PendingRecruit.village`
- Produces: `interrupts.ts`: `export type Interrupt = { kind: 'village'; villageId: string; visitorDefId: string } | { kind: 'recruit' } | { kind: 'levelUp' }`、`export function nextInterrupt(events: SimEvent[], levelUps: readonly LevelUpEvent[], pendingRecruit: PendingRecruit | null): Interrupt | null` — 順は村（`fresh` の `villageVisited` の最初の 1 つ）→ 加入 → レベルアップ（設計書「重なったときの決まり」）

- [ ] **Step 1: 失敗するテストを書く**（`interrupts.test.ts`）
  - `it('fresh な村の出来事があれば村を返す')`、`it('fresh でない村だけなら止めない')`、`it('村とレベルアップが同じ束なら村が先')`（Review Focus 2）、`it('加入とレベルアップなら加入が先')`、`it('何もなければ null')`
- [ ] **Step 2: 走らせて落ちるのを見る** — Run: `npx vitest run src/ui/interrupts.test.ts` / Expected: FAIL
- [ ] **Step 3: 実装する**（`main.ts`）— `update` の `step` の後の判定を `nextInterrupt` 1 本にまとめる。`village` のときは、今の加入の会話と同じ片付け（`accumulator = 0`・`pendingSkill = null`・`clearSpeech`・`resetAnim`）をして、`pickVillageTalk` で `talk` を作り `phase = 'event'`。会話の終わり（`case 'event'` の `talk.done`）は、加入でなければ `talk = null` で、残っているレベルアップがあれば `phase = 'levelup'`、なければ `'battle'`。加入の会話は、`pendingRecruit.village` があれば `pickVillageTalk` で、無ければ今の `pickRecruitTalk` で作る。ゆっくりの最中に止まったときは、`fallen` を進めない（`update` が会話の枝で抜けるので、会話の間は帯もゆっくりも止まり、戻った後に残りが続く）
- [ ] **Step 4: 走らせて通るのを見る** — Run: `npm test && npm run build` / Expected: PASS
- [ ] **Step 5: コミット** — `feat: 村に着いたら戦闘を止めて会話を出す`

### Task 9: 6 つの村の会話の文（依頼者の確認 3）

**Files:**
- Modify: `assets/stages/stage1.json`・`stage4.json`・`stage5.json`・`stage6.json`・`stage8.json`・`stage10.json`（村の `npc`・`talk`、必要なら `text` を `{visitor}` を使う文に）
- Modify: `assets/npcs/npc01〜06.json`（村ごとの名前にするなら）

- [ ] **Step 1: 下書きを書く** — 村ごとに、村人 2〜3 行と訪れた仲間 1 行（`$visitor`。どの仲間が言っても不自然でない文）と、何が起きたかの 1 行（今の `text` を元に `{visitor}` を使う）。ステージの導入の文と食い違わないこと（stage1 は「ガルムの 砦は 北」など今の文を生かす）。村人は `npc01`〜`npc06` を村の順に割り当てる
- [ ] **Step 2: 依頼者に読んでもらう** — 6 つの村の会話を、ステージ名・村の種類つきの表にして Artifact で見せる。直しを入れ、承認を得る
- [ ] **Step 3: JSON に入れて通るのを見る** — Run: `npm test && npm run build` / Expected: PASS
- [ ] **Step 4: コミット** — `feat: 6 つの村の会話`

### Task 10: ゲームの画面で村の会話を確かめる（依頼者の確認 4）

- [ ] **Step 1: CDP で撮る** — stage1（`talk`）で仲間を村へ歩かせ、着く前・会話の 1 行目・訪れた仲間の行・最後の行・戦闘に戻った後を撮る。stage8（`xp`）で会話の後にレベルアップのカードが出る場合を撮る（出なければ、出なかったことを書く）。stage4（`recruit`）で村人の行の後に加入の会話が続くのを撮る。受け取り済みの村（stage8 をクリアしたセーブで遊び直す）でセリフ欄に 1 行だけ出て止まらないのを撮る
- [ ] **Step 2: Artifact で依頼者に見せ、承認を得る** — 指摘があれば直して撮り直す
- [ ] **Step 3: コミット**（直しがあれば）— `fix: 村の会話の見え方を直す`

### Task 11: 正典・片付け・勝率

**Files:**
- Modify: `README.md`（「村と説得」の表と文、「コンテンツの足しかた」に村人の定義・村の `npc`・`talk`・`$visitor`・`{visitor}`、「新しいスキル」に `SKILL_FX` に描き方を足すこと、構成の表に `skill-fx.ts`・`fallen.ts`・`interrupts.ts`・`assets/npcs/`、「仮の絵の作り直し」に村人の顔、倒れたときの演出の説明）
- Modify: `CLAUDE.md`（変える所が無ければ変えない）
- Delete: `tools/fx-page/`

- [ ] **Step 1: README を直す**
- [ ] **Step 2: 道具を消す** — Run: `rm -r tools/fx-page out/fx` / Expected: `git status` に `tools/fx-page` が出ない
- [ ] **Step 3: 全部を確かめる** — Run: `npm test && npm run build` / Expected: PASS。続けて `npm run balance -- --check` をバックグラウンドで流し、終了コード 0 を確かめる（工程 4 と同じ表になるはず。違えば止めて報告する）
- [ ] **Step 4: HANDOVER.md を直す** — 「## 進捗」を今の状態に、「工程 5 の結果」を足す（確かめたこと・確かめていないこと・依頼者の判断）
- [ ] **Step 5: コミット** — `docs: 戦闘の演出の正典と引き継ぎ`
- [ ] **Step 6: 台帳を写す** — `.superpowers/sdd/2026-11-18-battle-direction/progress.md` を `docs/superpowers/ledgers/2026-11-18-battle-direction.md` に写してコミット（`docs: 戦闘の演出の台帳を写す`）
