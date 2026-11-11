# ステージの難易度の調整 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ボットで全ステージを通しで遊ばせて勝率を測る道具を作り、その数字が設計書の帯に入るまで `assets/` の数値だけを調整する。

**Architecture:** 純ロジック（ボット・1 戦・通し・集計）は `src/core/balance.ts` に置き、vitest で試す。`tools/balance.ts` は引数を読んで表を出すだけの薄い入口（`tools/` は `tsc` の対象外なので、ロジックを置かない）。調整は 3 つの Task に分け、各 Task の終わりに全ステージを測り直して表を残す。

**Tech Stack:** TypeScript、Vitest、vite-node（`node_modules/.bin/vite-node`。vitest の推移依存で `package.json` には無い。`npm run balance` から呼ぶので devDependencies に `vite-node` を足す）

**Spec:** `docs/superpowers/specs/2026-11-11-difficulty-tuning-design.md`

## Global Constraints

- 調整してよいのは `assets/` の JSON だけ。順は ①ステージの `enemies`・`spawners` ②`assets/units/ally05〜08.json` と `assets/skills.json` の新しい 4 つ（`hikitsukeru` `hinoame` `tsuki` `hagemasu`） ③`assets/enemies/*.json` ④説得の相手 `ally06-foe` `ally08-foe`
- 変えない: `roran` `ines` `mist` `gau` の JSON、`assets/growth.json`、ステージの `id`・ファイル名・`order`、コードの決まり（ダメージ式・AI・勝敗条件）、一度きりのごほうび・加入の決まり、`joins` `persuasions` `villages` の `unitId`・`persuader`・`effect.type`
- 1 ステージの敵は、`enemies` と `spawners` の `total` の合計で 16 体まで
- 敵・時間湧きは `placement.minY` より上に置く。足元が通れること（起動時の検証が `npm test` で落ちる）
- ゲーム内の文字は漢字仮名交じり。コミットは Conventional Commits + 日本語
- 目標の勝率（ボットの 1 回目、％）: s1 90〜100 / s2 85〜100 / s4 80〜95 / s5 75〜95 / s6 70〜90 / s7 60〜85 / s8 55〜80 / s9 50〜75 / s10 45〜70 / s3（ガルム）30〜55
- ボットは人より下手。数字は人が遊ぶより厳しめに出る前提で、帯に合わせる
- `node tools/gen-placeholder-sprites.mjs` を引数なしで動かさない

## Claude の判断（この計画で決めたこと。設計書の「作る人に任せること」の具体化）

- **ボットの動き**: 配置は `placement.starts` のまま（`startPositions`）。`beginBattle` 後、毎 tick 次を出す。
  1. 生きている全員に、ゴール（`victory.pos`）への `move`（目的地が同じなら、すでに向かっているので毎 tick は出さず、60 tick ごとに出し直す）
  2. 必殺技は `canUseSkill` が真のとき、`needsDest` が 1 のものは最寄りの生きている敵の位置を `dest` にして、それ以外は `dest` なしで `useSkill`。敵が見えない（いない）ときは出さない
  3. `recruit` の村があり、まだ仲間にいない `unitId` なら、最も `speed` の高い生きている仲間 1 人を、村へ寄らせてからゴールへ向かわせる（村のマスの中心から 18px 外に着けば訪れたことになる。村は通れないマスなので、`move` の目的地は村の中心にして、歩けないときの置き換え（`resolveMoveDest`）に任せる）。村を訪れた tick に `pendingRecruit` が立つので、次の項で進める
  4. `state.pendingRecruit !== null` なら `completeRecruit(state)` を呼んでから進める（本物のゲームは会話のあとにこれを呼ぶ）
  5. 1 戦の上限は戦闘時間 300 秒。超えたら負け扱い
- **通し**: `reg.stages`（order 順）で、`newSave(reg)` から始める。勝ったら `applyStageClear` の `result.save` を持ち越す。負けたらセーブは変えず同じステージをやり直す。1 ステージ最大 5 回で、勝てなければその通しは打ち切り（以降のステージは「未到達」）
- **シード**: 通し 1 本ごとにシード `s`（1〜40）。`createBattleState` に渡すシードは `s * 100 + 試行番号`（0 始まり）
- **集計**: ステージごとに「1 回目の勝率 = 1 回目で勝った通しの数 ÷ そのステージに到達した通しの数」、到達数、勝ったときの生き残り人数の平均、出撃人数の平均
- 測った数字のうち、1 回目の勝率の帯外が残ったときは、原因を「ボットが苦手なだけ（人なら勝てる）」と「数値」に分けて書き残す

## Review Focus

- 戦闘が終わらない（ボットが誰も敵に近づけない・足止めされる）: 300 秒で打ち切って負けにし、通し全体が止まらない → Task 1 のテスト
- 加入の会話（`pendingRecruit`）を進め忘れて `step` が止まったまま 300 秒たつ: ボットが必ず `completeRecruit` を呼ぶ → Task 1 のテスト
- 同じシードで結果が変わる（測るたびに数字が揺れて調整の良し悪しが分からない）: 同じ引数なら同じ表 → Task 1 のテスト
- 説得の相手を倒してしまい、加入が起きなかった通しが後のステージで弱い: 表に出撃人数の平均を出し、設計の人数（s2:5 / s4:6 / s7:7 / s9:8）とずれたら気付ける → Task 1・2
- 調整で敵が増えて 16 体を超える、足元が通れない位置に置く: 上限のテストと起動時の検証（`npm test`）→ Task 3
- 新しい 4 人が加入してもレベル 1 のまま弱すぎる／強すぎる: 加入時のレベル（`joins` の `level`）は変えず、能力値と必殺技の数値で合わせる → Task 4・5

## File Structure

- Create: `src/core/balance.ts` — ボット・1 戦・通し・集計・表の文字列化（DOM に触らない）
- Create: `src/core/balance.test.ts`
- Create: `tools/balance.ts` — 引数（シード数・`--check`）を読み、`testRegistry` と同じく `loadRegistry(SKILL_EFFECT_IDS)` でレジストリを組んで表を出す入口
- Create: `src/engine/stage-limits.test.ts` — 敵の総数 16 体の上限
- Modify: `package.json`（`balance` スクリプトと `vite-node`）、`README.md`（測り方を「開発」に追記）
- Modify（調整）: `assets/stages/*.json`、`assets/units/ally05〜08.json`、`assets/skills.json`、`assets/enemies/*.json`
- Create: `docs/superpowers/specs/2026-11-11-difficulty-tuning-results.md` — 測定結果のログ（調整のたびの表と、最後の判断）

---

### Task 1: 測る道具の純ロジック（ボット・通し・集計）

**Files:**
- Create: `src/core/balance.ts`
- Test: `src/core/balance.test.ts`

**Interfaces:**
- Consumes: `createBattleState(reg, stage, party, seed)`・`beginBattle`・`placeUnit` は不要（`startPositions` は `createBattleState` がすでに使う）、`step(state, commands, dt)`（`src/core/sim.ts`）、`canUseSkill`・`useSkill`（`src/core/skills.ts`）、`completeRecruit`（`src/core/events.ts`）、`applyStageClear`（`src/ui/flow.ts`）、`newSave`（`src/save/save.ts`）、`skillParam`（`needsDest` を読む。`src/core/skills.ts` が使っているものと同じ）、`SimCommand`
- Produces（Task 2 が使う）:
  ```ts
  export const BATTLE_DT = 1 / 60;
  export const BATTLE_TIME_LIMIT = 300; // 秒
  export const MAX_ATTEMPTS = 5;

  export type BattleOutcome = {
    result: 'victory' | 'defeat' | 'timeout';
    seconds: number;
    deployed: number;      // 出撃した人数（会話で加わった人も含む。最終）
    survivors: number;     // 終了時に生きている味方の数
    state: BattleState;
  };
  export function runBattle(reg: Registry, stage: StageDef, party: PartyProgress, seed: number): BattleOutcome;

  export type StageRun = { stageId: string; firstTryWon: boolean; attempts: number; cleared: boolean; deployed: number; survivors: number };
  export function playThrough(reg: Registry, seed: number): StageRun[]; // 打ち切ったら、そこまでの StageRun で終わる（最後の要素は cleared:false）

  export type StageStat = { stageId: string; name: string; reached: number; firstTryRate: number; avgDeployed: number; avgSurvivors: number };
  export function measure(reg: Registry, seeds: number): StageStat[]; // reg.stages の順。seeds は 1 以上の整数
  export const TARGET_BANDS: Record<string, [number, number]>; // stageId → [下限%, 上限%]。stage1..stage10 すべて
  export function formatTable(stats: StageStat[]): string; // Markdown の表。帯の外の行の「判定」列に「帯の外」を出す
  ```

- [ ] **Step 1: 失敗するテストを書く（`src/core/balance.test.ts`）**
  - `runBattle` はステージ 1 を `newSave(testRegistry())` から回すと、`result` が `'victory'|'defeat'|'timeout'` のどれかで `seconds <= BATTLE_TIME_LIMIT + BATTLE_DT`（打ち切りの確認）。`deployed === 4`、`survivors <= deployed`
  - 同じ引数で 2 回 `runBattle` した `result`・`seconds`・`survivors` が一致する（決定性）
  - 村の加入: ステージ 4 を、`members` を空にしたセーブで回し、`outcome.state.joined` に `'ally07'` が入る（ボットが村へ寄って加入の会話を進める。シードは 1〜5 を順に試し、少なくとも 1 つで入る。入らなければボットの村の動きの不具合）
  - 開始時の加入: ステージ 2 は `state.joined` に `'ally05'` が入り、`deployed === 5`
  - `playThrough(reg, 1)` の最初の要素の `stageId` が `reg.stages[0].id`、要素数 ≤ `reg.stages.length`、`attempts` は 1〜`MAX_ATTEMPTS`、`cleared` が偽の要素は最後の 1 つだけ
  - `playThrough` が 2 回で同じ結果（決定性）
  - `measure(reg, 2)` は `reg.stages` と同じ長さ・同じ順で、`firstTryRate` は 0〜100、`reached >= 0`、先頭ステージの `reached === 2`
  - `TARGET_BANDS` のキーが `reg.stages` の全 `id` と一致する（足し忘れの検出）
  - `formatTable`: `firstTryRate` が帯の外のときだけ「帯の外」を含み、帯の中の行には含まない（手で作った `StageStat` 2 行で確かめる）

- [ ] **Step 2: 落ちることを確かめる**
  Run: `npx vitest run src/core/balance.test.ts`
  Expected: FAIL（`./balance` が無い）

- [ ] **Step 3: `src/core/balance.ts` を実装する**
  上の Produces の署名どおり。ボットの動きは本計画の「Claude の判断」の 1〜5。`runBattle` の流れ: `createBattleState` → `beginBattle` → ループ（`pendingRecruit` なら `completeRecruit` → コマンドを組む → `useSkill` を試す → `step(state, commands, BATTLE_DT)`）→ `state.phase` が `'victory'`/`'defeat'` か、`state.time >= BATTLE_TIME_LIMIT` で終了。`useSkill` は `step` の前に呼ぶ（`step` が `events` を空にするので、スキルの `events` は次の `step` の `accumulate` に流れる。本物のゲームの `main.ts` の呼び順に合わせる。違えば `main.ts` を読んで揃える）。`measure` の平均は、到達した通しだけで取る。`deployed` は `state.units` の `side === 'player'` の数（`retired` も含めない: 説得で消える敵は `side === 'enemy'`）
  ボットの村の動き・必殺技の最寄りの敵の選び方など、細かい動かし方は、決定的（乱数を使わない。同じ状態なら同じコマンド）であれば実装役が選んでよい。選んだ動きを `balance.ts` の冒頭コメントに書く（のちに表の数字を読む人のため）

- [ ] **Step 4: 通ることを確かめる**
  Run: `npx vitest run src/core/balance.test.ts` → PASS。続けて `npm test`（全部通る）と `npm run build`（型検査が通る）
  実行時間: `measure(reg, 2)` を含むテストが 30 秒を超えるなら、そのテストだけ `seeds` を 1 にして、`vitest` のタイムアウトを引数で伸ばす

- [ ] **Step 5: HANDOVER.md の `## 進捗` を直す**（`段階: 実装（5 タスク中 1）`、次にやることを Task 2 に）
- [ ] **Step 6: Commit**
  ```bash
  git add src/core/balance.ts src/core/balance.test.ts HANDOVER.md
  git commit -m "feat: ステージの難易度を測るボットと通しの実行を足す"
  ```

---

### Task 2: 入口の `npm run balance` と最初の測定

**Files:**
- Create: `tools/balance.ts`、`docs/superpowers/specs/2026-11-11-difficulty-tuning-results.md`
- Modify: `package.json`、`README.md`

**Interfaces:**
- Consumes: Task 1 の `measure`・`formatTable`・`TARGET_BANDS`、`loadRegistry`（`src/engine/loader`）と `SKILL_EFFECT_IDS`（`src/core/skills`。`testRegistry` と同じ組み方）
- Produces: コマンド `npm run balance [-- <シード数（既定 40）>] [--check]`。表を標準出力に出し、`--check` のときは帯の外が 1 つでもあれば終了コード 1

- [ ] **Step 1: `tools/balance.ts` を書く**。引数は「シード数（正の整数。不正ならメッセージを出して終了コード 2）」と `--check` だけ。レジストリの読み込みに失敗したら `testRegistry` と同じ形でエラーを全部出して終了コード 2。`package.json` の `scripts` に `"balance": "vite-node tools/balance.ts --"` を、`devDependencies` に `vite-node`（`node_modules/vite-node/package.json` の version に `^` を付けて）を足す
- [ ] **Step 2: 動かす**
  Run: `npm run balance -- 3`
  Expected: 10 ステージの表が出て終了コード 0。続けて `npm run balance -- 3 --check` の終了コードが（帯の外があるなら）1 になる
- [ ] **Step 3: 最初の測定（シード 40）**
  Run: `npm run balance` → 出た表を結果のログに「0. 調整前」として貼る。ボットが壊れていないかを次で判定する: ステージ 1 の 1 回目の勝率が 70% を下回る、または到達数が極端に減る（打ち切りが多い）なら、ボットの動き（Task 1）か通しの実装を疑って直す。直したら Task 1 のテストを足してから測り直す（敵の数値を触る前に、測る道具を信じられる状態にする）。出撃人数の平均が s2:5 / s4:6 / s7:7 / s9:8 から外れていれば、加入の動きを先に直す
- [ ] **Step 4: README.md の「開発」に `npm run balance` の説明を足す**（ボットの動き・指標・`--check`・数字は人より厳しめに出ること。正典なので、動きの細部は `src/core/balance.ts` の冒頭コメントを指す形にする）。構成の表にも `src/core/balance.ts` と `tools/balance.ts` を 1 行ずつ足す
- [ ] **Step 5: HANDOVER.md の `## 進捗` を直す**（`実装（5 タスク中 2）`）
- [ ] **Step 6: Commit**
  ```bash
  git add tools/balance.ts package.json package-lock.json README.md docs/superpowers/specs/2026-11-11-difficulty-tuning-results.md HANDOVER.md
  git commit -m "feat: npm run balance でステージごとの勝率を測れるようにする"
  ```

---

### Task 3: 敵の総数の上限のテストと、前半の調整（ステージ 1・2・4・5・6）

**Files:**
- Create: `src/engine/stage-limits.test.ts`
- Modify: `assets/stages/stage1.json` `stage2.json` `stage4.json` `stage5.json` `stage6.json`、必要なら `assets/units/ally05.json` `ally07.json`、`assets/skills.json`（`hikitsukeru` `tsuki`）、`assets/enemies/*.json`

**Interfaces:**
- Consumes: `testRegistry()`、`reg.stages`（各 `enemies`・`spawners`）
- Produces: 上限のテスト。前半 5 ステージが帯に入った `assets/`

- [ ] **Step 1: 失敗するテストを書く**: `src/engine/stage-limits.test.ts` — 全ステージで `enemies.length + Σ spawners[].total <= 16`。（今のステージは全部 16 以下なので、書いた時点で通る。上限を守らせる網として置く）
- [ ] **Step 2: 通ることを確かめる**: `npx vitest run src/engine/stage-limits.test.ts` → PASS
- [ ] **Step 3: 調整の繰り返し（最大 8 回）**。1 回ごとに:
  1. `npm run balance`（40 通り）を回し、表を結果のログに「3-n」として貼る
  2. 前半（s1・s2・s4・s5・s6）で帯の外のステージのうち、**order の若い順に 1 つだけ**直す。簡単すぎる（勝率が帯の上）→ 敵を足す（`narazumono` → `tatemochi` の順）か位置を前に出す。難しすぎる（帯の下）→ 敵を減らすか、弱い種類に替える。前半に新しい仲間（`ally05`・`ally07`）が効いているなら、まず敵の数で合わせ、足りなければ `ally05`・`ally07` の能力値（HP・攻撃・守りを ±1〜3 刻み）と、`hikitsukeru`・`tsuki` の数値で合わせる
  3. 敵の能力値（`assets/enemies/*.json`）を変えるのは、ステージの敵の数・種類で合わせられないときだけ。変えたら後半のステージにも影響するので、必ず全ステージの表を見る
  4. `npm test`（検証が通る）→ コミットはまとめて最後に 1 回でよい
  上限は 8 回。そこで帯の外が残るステージは、結果のログに「帯の外・原因（ボットが苦手か数値か）」を書いて、次へ進む
- [ ] **Step 4: 後半のステージの表が大きく変わっていないか見る**（前半の調整で `ally05` `ally07` を変えたとき。次の Task 4 の出発点として表を結果のログに残す）
- [ ] **Step 5: 確かめる**: `npm test`・`npm run build`
- [ ] **Step 6: HANDOVER.md の `## 進捗` を直す**（`実装（5 タスク中 3）`）。結果のログに「3. 前半の調整後」の表と、変えた数値の一覧（ファイル・項目・前→後）を書く
- [ ] **Step 7: Commit**
  ```bash
  git add src/engine/stage-limits.test.ts assets docs/superpowers/specs/2026-11-11-difficulty-tuning-results.md HANDOVER.md
  git commit -m "feat: 前半のステージの敵と新しい仲間の数値を調整する"
  ```

---

### Task 4: 中盤の調整（ステージ 7・8・9）と新しい仲間 ally06・ally08

**Files:**
- Modify: `assets/stages/stage7.json` `stage8.json` `stage9.json`、必要なら `assets/units/ally06.json` `ally08.json`、`assets/skills.json`（`hinoame` `hagemasu`）、`assets/enemies/ally06-foe.json` `ally08-foe.json`、`assets/enemies/*.json`

**Interfaces:**
- Consumes: Task 3 までの `assets/`、`npm run balance`
- Produces: s7・s8・s9 が帯に入った `assets/`（s1〜s6 は帯に入ったまま）

- [ ] **Step 1〜2: Task 3 の Step 3 と同じ手順で、対象を s7・s8・s9 に替えて繰り返す（最大 8 回）**。加えて:
  - 説得の相手（`ally06-foe`・`ally08-foe`）は、説得できなかったとき（ボットが説得に失敗して倒したとき）に、ほかの敵と並べて強すぎず弱すぎない値にする。加入の起きる通しの割合（表の出撃人数の平均が s7:7 / s9:8 から外れていないか）も見る。外れるなら、`persuader` の仲間が相手に 64px まで近づけない配置か、相手が弱すぎて先に倒されていないかを疑い、まず相手の位置・HP を直す（`persuader`・`pos` の「通り道から外れた歩ける位置」の決まりは守る）
  - 前半（s1〜s6）の 1 回目の勝率が帯から外れたら、このタスクで変えた `ally06`・`ally08`・敵の能力値のせいなので、先にそちらを戻す
- [ ] **Step 3: 確かめる**: `npm test`・`npm run build`・`npm run balance`（40 通り）の表を結果のログに「4. 中盤の調整後」として貼る
- [ ] **Step 4: HANDOVER.md の `## 進捗` を直す**（`実装（5 タスク中 4）`）。変えた数値の一覧を結果のログに足す
- [ ] **Step 5: Commit**
  ```bash
  git add assets docs/superpowers/specs/2026-11-11-difficulty-tuning-results.md HANDOVER.md
  git commit -m "feat: 中盤のステージと説得の相手の数値を調整する"
  ```

---

### Task 5: 終盤の調整（ステージ 10・3 ガルム）と仕上げ

**Files:**
- Modify: `assets/stages/stage10.json` `stage3.json`、必要なら `assets/enemies/garum.json`、`assets/units/ally08.json`、`assets/enemies/*.json`、`README.md`、`HANDOVER.md`
- Modify: `docs/superpowers/specs/2026-11-11-difficulty-tuning-results.md`

**Interfaces:**
- Consumes: Task 4 までの `assets/`
- Produces: 全 10 ステージが帯に入った（入らないものは理由つきで記録した）`assets/`、最終の表

- [ ] **Step 1: Task 3 の Step 3 と同じ手順で、対象を s10・s3 にして繰り返す（最大 8 回）**。s3 は `defeat` が `roran` と `mist` の両方（どちらかが倒れたら負け）。ボットの動きでは `mist` が最前線に出て倒れやすいので、帯に届かないときは「ボットが `mist` を守らないため」を原因に書き、敵を減らし過ぎない（人が遊ぶ前提の帯の下限 30% をボットが取れるかを見る）。s3 の敵は `garum` と、時間湧きの `narazumono` を軸に、s10 より強く保つ（最後のステージが一番難しいこと）
- [ ] **Step 2: 通しの難しさの流れを確かめる**: 表の 1 回目の勝率が、order の順（s1,s2,s4,…,s10,s3）におおむね下がっている（隣り合うステージの差が 15 ポイントを超えて逆転しない）。逆転があれば、直せるなら直し、直さないなら結果のログに理由を書く
- [ ] **Step 3: 最終の測定と確認**: `npm test`・`npm run build`・`npm run balance`（40 通り）。表を結果のログに「5. 最終」として貼り、各ステージの帯の内外を書く。前半・中盤の帯が崩れていないこと
- [ ] **Step 4: ドキュメント**: README.md の「コンテンツの足しかた」の敵・ステージの説明に「1 ステージの敵は時間湧きを含めて 16 体まで（`npm test` が見る）」を足し、「開発」の `npm run balance` の記述に、帯の表（設計書の表）の置き場として結果のログを指す 1 行を足す。結果のログの末尾に「依頼者が見るところ」（ボットと人の差が出そうなステージ・帯の外が残ったステージ・加入のずれ）を書く
- [ ] **Step 5: HANDOVER.md の `## 進捗` を直す**（`段階: 完了`、次にやること: 依頼者のフィードバックを受けて調整する、push と PR は依頼者の指示を待つ）
- [ ] **Step 6: Commit**
  ```bash
  git add assets README.md docs/superpowers/specs/2026-11-11-difficulty-tuning-results.md HANDOVER.md
  git commit -m "feat: 終盤のステージの数値を調整し、結果をまとめる"
  ```

---

## 自己レビュー

- 設計書との対応: 測る道具（Task 1・2）、目標の勝率の帯（Task 3〜5 の各ステージ）、調整してよいもの・変えないもの（Global Constraints）、制約の 16 体（Task 3 のテスト）、「作る人に任せること」の 3 つ（ボット＝「Claude の判断」と Task 1、数値の調整＝Task 3〜5、帯に入らない原因の整理＝各 Task の上限の記述と最終のログ）に対応。
- 設計書に書かなかった判断（ボットが村へ寄る・通しの打ち切り・1 戦の上限・集計の分母）は、この計画の「Claude の判断」にまとめた。設計書のボットの動きの「村は訪れない」は、`recruit` の村だけ訪れる形に変える（`ally07` が加わらないと s4 以降の人数が設計とずれるため）。最終の報告に変更点として書く。
- 型の一貫: `runBattle`・`playThrough`・`measure`・`formatTable`・`TARGET_BANDS`・`StageStat` の名前は Task 1 の Produces で定義し、Task 2 以降はそれだけを使う。
