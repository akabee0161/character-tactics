# 点数（クリアの速さ） Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** クリアの時間と金・銀・銅の評価を結果の画面・ステージ選択に出してセーブに残し、あわせて 1 人でゴールへ突っ込むと倒されるように、技の距離とゴール前の敵の配置を直す。

**Architecture:** 評価の判定と時間の書き方は純ロジック（`src/ui/clear-time.ts`）、記録はセーブ（`bestTimes`）と `applyStageClear`、目安の時間はステージの JSON（`parTimes`）。突っ込みの測り方は `src/core/balance.ts` に足し、`npm run balance -- --check` が見る。技の距離は `src/core/skills.ts` の 2 つの技だけを直す。

**Tech Stack:** TypeScript・Canvas2D・Vite・Vitest

**Spec:** `docs/superpowers/specs/2026-11-18-clear-score-design.md`

## Global Constraints

- 最後に `npm run balance -- --check`（40 シード、約 4 分、バックグラウンド）が終了コード 0。通しの帯 `TARGET_BANDS`・育てた場合の帯 `GROWN_BAND`・突っ込みの上限 `RUSH_MAX` のすべて
- 帯に戻すために動かしてよいのは、能力の数字・伸び・`enemyLevel`・加わったときのレベル・技の基本量・経験値・`bowDamageCap` と、ゴールの手前の敵の配置。地形（`mapRows`・`legend`）は変えない
- 1 ステージの敵は 16 体まで（`enemies` + `spawners` の `total`。`src/engine/stage-limits.test.ts`）。足すより今の敵を移すのを先に考える
- 決まりを全部同時に満たせないステージが出たら、決まりを緩めず、測った数字と案を添えて依頼者に戻す（作業を止めて報告する）
- 評価の線は自動で動かさない。目安の時間は依頼者が表で決めた値を JSON に書く
- 描画にはユニットテストを書かない（CLAUDE.md）。見た目は README の CDP 手順で撮り、PNG を data URI で埋め込んだ HTML を Artifact で依頼者に見せ、承認を得てからコミット・次のタスクへ進む
- 画面の文字は漢字仮名交じり（常用漢字中心、ルビなし）。低学年でも読める語。評価の文字は「金」「銀」「銅」
- 時間の書き方: 秒の端数を切り捨て、1 分未満は「48秒」、1 分以上は「2分14秒」（秒は 0 埋めしない: 「2分5秒」）
- 記録は勝ったときだけ。負けた回の時間は残さない。評価はセーブに書かない
- コミットは Conventional Commits + 日本語の要約
- 作業用の道具（撮影のスクリプトなど）は最後に片付ける（`rm -r` と `rm`。`rm -rf` は拒否される）

## 設計からの変更（Claude の判断）

- 設計書の「Claude が手で急いで遊んだ時間」は、ボットの「急ぎ」（出撃した全員がまっすぐゴールへ向かい、技もゴールの向きに使う）で測る。手で CDP から 10 ステージを急いで遊ぶのは、何度もやり直すと時間がかかりすぎるため。表には通しのボット（敵を全部倒す）と急ぎのボットの時間を並べる。依頼者に表を見せるときに、この変更を一言添える
- 設計書の「狙う所の表示（技を構えている間の線・丸）も上限で止めた所に出す」: 今のゲームには構えている間の表示が無い（顔を押した後、地面を押すとすぐ出る）。技の見た目（`out.aim`）は上限で止めた所に出るので、足すものは無い

## Review Focus

1. **今までのセーブ（`bestTimes` が無い）**: 読み込めて、どのステージも記録なし → Task 5 のテスト
2. **壊れた `bestTimes`**: 知らないステージ ID・負の数・0・NaN・文字列の項目だけ捨て、ほかの項目とセーブ全体は残る → Task 5 のテスト
3. **遊び直して前より遅く勝った**: 一番速い記録は変わらず、「記録更新」は出ない → Task 5 のテスト
4. **目安ちょうど・端数**: 画面に出す秒（切り捨て）で比べるので、60.9 秒は「1分0秒」で、金の目安 60 なら金 → Task 4 のテスト
5. **技を上限より近くに指した・自分の位置を指した**: 指した所がそのまま行き先（向きが決まらなくても壊れない）。上限で止めた所が壁なら「駆け抜ける」は出ない → Task 1 のテスト

---

### Task 1: 技の届く距離

**Files:**
- Modify: `src/core/skills.ts`（`kakenukeru`・`kyuukouka`、新しい `limitReach`）
- Modify: `assets/skills.json`（2 つの技の `params` と `summary`）
- Test: `src/core/skills.test.ts`

**Interfaces:**
- Produces: `export function limitReach(from: Vec2, dest: Vec2, max: number): Vec2`（`src/core/skills.ts`）。`assets/skills.json` の `kakenukeru`・`kyuukouka` の `params.maxCells`（マス数）

- [ ] **Step 1: 失敗するテストを書く**

`src/core/skills.test.ts` に `describe('limitReach')` と、2 つの技の距離のテストを足す。

```ts
describe('limitReach', () => {
  it('上限より近ければそのまま', () => {
    expect(limitReach({ x: 0, y: 0 }, { x: 30, y: 40 }, 128)).toEqual({ x: 30, y: 40 });
  });
  it('上限より遠ければ、向きを保って上限の距離で止める', () => {
    const p = limitReach({ x: 0, y: 0 }, { x: 300, y: 400 }, 128);
    expect(p.x).toBeCloseTo(76.8, 6);
    expect(p.y).toBeCloseTo(102.4, 6);
  });
  it('自分の位置を指してもそのまま', () => {
    expect(limitReach({ x: 5, y: 5 }, { x: 5, y: 5 }, 128)).toEqual({ x: 5, y: 5 });
  });
});
```

技のテスト（既存の `kakenukeru`・`kyuukouka` のテストのそばに、同じ組み立て方で）:
- `駆け抜けるは maxCells マスより遠くを指すと、その向きの maxCells × cell の所で止まる`: 開けたマスでガウを置き、8 マス先を指す → `gau.pos` との距離が `skillParam(reg, 'kakenukeru', 'maxCells', 0) * cell`（誤差 0.5 以内。`fitInCell` の寄せがあるため）
- `駆け抜けるは止めた所が壁なら出ない`: 止めた所が通れないマスになる配置 → 技の結果が null、`pos` は元のまま
- `急降下は maxCells マスより遠くを指すと、その向きの maxCells × cell の所に降りる`: 同様に距離を見る
- `assets/skills.json の駆け抜ける・急降下の maxCells は 4`

- [ ] **Step 2: 落ちることを確かめる**

Run: `npx vitest run src/core/skills.test.ts`
Expected: FAIL（`limitReach` が無い、`maxCells` が 0）

- [ ] **Step 3: 実装する**

- `limitReach`: `from` から `dest` までの距離が `max` 以下（0 を含む）ならそのまま、超えたら向きを保って `max` の所
- `kakenukeru`: `fitInCell` の前に `limitReach(self.pos, dest, maxCells * state.grid.cell)` をかける。あとは今のまま（壁なら null）
- `kyuukouka`: `clampToMap` の前に同じくかける
- `assets/skills.json`: 2 つの `params` に `"maxCells": 4`。`summary` は「{maxCells}マス 先までの 指した 所へ 走り抜け、通り道の 敵に {damage} ダメージ」「{maxCells}マス 先までの 指した 所へ 飛び、まわりの 敵に {damage} ダメージ」

- [ ] **Step 4: 通ることを確かめる**

Run: `npm test`
Expected: PASS（技の一言のテストが文言を見ていれば、新しい文言に直す）

- [ ] **Step 5: コミット**

```bash
git add src/core/skills.ts src/core/skills.test.ts assets/skills.json
git commit -m "feat: 駆け抜ける・急降下の届く距離を 4 マスまでにする"
```

---

### Task 2: 突っ込みと急ぎの測り方

**Files:**
- Modify: `src/core/balance.ts`
- Modify: `tools/balance.ts`
- Test: `src/core/balance.test.ts`

**Interfaces:**
- Consumes: Task 1 の技の距離（ボットの技の行き先も上限で止まる）
- Produces（すべて `src/core/balance.ts`）:
  - `export type RushKind = 'walker' | 'flyer' | 'gau' | 'all'`
  - `export function pickRushers(state: BattleState, kind: RushKind): Unit[]`（`walker` = 飛行でない生きている仲間で speed が一番高い 1 人（同じなら先に並んだ方）、`flyer` = `flying` の仲間の先頭 1 人、`gau` = defId `gau` の 1 人、`all` = 生きている全員。いなければ空）
  - `export function rushCommands(state: BattleState, rushers: Set<string>, tick: number, memory: MoveMemory): SimCommand[]`（今は非公開の `type MoveMemory` を `export type` にする）
  - `export function runRush(reg: Registry, stage: StageDef, party: PartyProgress, seed: number, kind: RushKind): BattleOutcome | null`（走らせる仲間がいなければ null）
  - `export const RUSH_SEEDS = 10`、`export const RUSH_MAX = 10`（％）
  - `StageRun` に `seconds: number`（1 回目で勝ったときのその秒。勝てなかったら 0）と `rush: Partial<Record<RushKind, { won: boolean; seconds: number }>>`（シードが `RUSH_SEEDS` 以下のときだけ入る。走らせる仲間がいない種類は入らない）
  - `StageStat` に `medianSeconds: number`（1 回目の勝ちの秒の中央値。無ければ 0）、`rushRates: Partial<Record<RushKind, number>>`（測った回数に対する勝った割合 ％）、`fastMedianSeconds: number`（`all` で勝った回の秒の中央値。無ければ 0）
  - `export function isOutOfBandRush(s: StageStat): boolean`（`walker`・`flyer`・`gau` のどれかが `RUSH_MAX` を超える。`all` は見ない）。`isOutOfBand` はこれも含める

- [ ] **Step 1: 失敗するテストを書く**

`src/core/balance.test.ts` に足す:
- `pickRushers` の 4 通り: ステージ 1 の初期状態で `walker` が飛行でない仲間の speed 最大、`flyer` は ally11 がいなければ空、`all` は生きている全員
- `rushCommands は走らせる仲間にだけゴールへの move を出し、ほかには何も出さない`: ステージ 1、`rushers` = ロラン 1 人 → コマンドの uid がすべてロラン、move の dest が `victory.pos`
- `rushCommands は needsDest の技を、ゴールへの向きに出す`: ガウを走らせ、技が使える状態で → skill コマンドの dest がガウからゴールへの線分上（`distanceToSegment(dest, gau.pos, victory.pos) < 1`）
- `runRush は走らせる仲間がいなければ null`: ステージ 1 で `flyer`
- `runRush は同じ引数なら同じ結果`
- `isOutOfBandRush は RUSH_MAX ちょうどを含まず、超えたら真。all は見ない`
- `formatTable に突っ込み・急ぎの列が出る`（見出しに「突っ込み(歩き)」「突っ込み(飛行)」「突っ込み(ガウ)」「急ぎ(秒)」「クリア(秒)」）
- `playThrough のシード ≤ RUSH_SEEDS は rush が入り、それより上は空`（シード 1 とシード `RUSH_SEEDS + 1`。重いのでステージを 2 つに絞った registry で）

- [ ] **Step 2: 落ちることを確かめる**

Run: `npx vitest run src/core/balance.test.ts`
Expected: FAIL（新しい名前が無い）

- [ ] **Step 3: 実装する**

- `rushCommands`: 走らせる仲間ごとに、`victory.pos` への move を、出していないとき・`MOVE_REISSUE_TICKS` ごとに出す（交戦中でも出す。止まらずに抜けようとするのが突っ込み）。技は `canUseSkill` が真なら出す。`needsDest` の技は、`limitReach(u.pos, victory.pos, maxCells * cell)` をそのまま dest にする（`maxCells` の無い技は `victory.pos`）。走らせない仲間には何も出さない（近接の自動の詰め寄りはゲームのとおり働く）。説得・村は扱わない（`pendingRecruit` は `runBattle` と同じく `completeRecruit` で進める）
- `runRush`: `runBattle` と同じ準備（割り当ての並べ替え・反応の遅れは入れない。遅れ 0）で、毎 tick `rushCommands` を渡す。時間の上限も同じ
- `playThrough(reg, seed)`: ステージに着いたときのセーブ（通しのセーブ。育てていない）で、シードが `RUSH_SEEDS` 以下なら 4 種類の `runRush` を `seed * 100 + 60 + i`（i は種類の順）で 1 回ずつ。通しの結果には入れない
- 冒頭のコメントに突っ込み・急ぎの動きを足す
- `formatTable` の列に「クリア(秒)」（`medianSeconds`）・「突っ込み(歩き/飛行/ガウ)(%)」（測っていない種類は `-`）・「急ぎ(%)」「急ぎ(秒)」、判定に「突っ込み」
- `tools/balance.ts` はそのまま（`isOutOfBand` が突っ込みも見る）

- [ ] **Step 4: 通ることを確かめる**

Run: `npm test`
Expected: PASS

- [ ] **Step 5: 今の突っ込みを測る（記録だけ）**

Run（バックグラウンド）: `npm run balance 2>&1 | tee <セッションのスクラッチの置き場>/balance-task2.txt`
Expected: 表が出る。突っ込みの列の多くが `RUSH_MAX` を超えて「突っ込み」の判定が出るのは、この時点では予定どおり。通し・育てたの列が工程 5 の値（stage10 60.0・stage3 47.5・育てた stage3 82.5）から動いていれば、Task 1 の技の距離の影響として台帳に書く

- [ ] **Step 6: コミット**

```bash
git add src/core/balance.ts src/core/balance.test.ts
git commit -m "feat: 難易度の測定に 1 人の突っ込みと全員の急ぎを足す"
```

---

### Task 3: ゴールの手前の敵の配置（依頼者に見せる 1）

**Files:**
- Modify: `assets/stages/*.json`（突っ込みが `RUSH_MAX` を超えるステージの `enemies`）
- Modify: README.md（「難易度を測る」の動かしてよいもの・突っ込みの列）

**Interfaces:**
- Consumes: Task 2 の `npm run balance` の突っ込みの列

- [ ] **Step 1: 配置を直す**

突っ込みが `RUSH_MAX` を超えるステージごとに、ゴール（`victory.pos`、最上段）の手前に `ai.kind: "guard"`（`post` はゴールの手前、`leash`・`sightRange` はゴールの円を覆う大きさ）の敵を置く。今の敵を移すのを先に考え、足すときも 16 体を超えない。飛行の仲間を止めるため、ゴールの手前に弓兵かまじない師を 1 体以上入れる。地形は変えない。置く位置の決まり（`placement.minY` より上・足元の箱が通れないマスにかからない）は `npm test` が見る

- [ ] **Step 2: 測る**

Run（バックグラウンド）: `npm run balance -- --check`
Expected: 終了コード 0。1 になったら表を見て、突っ込み・通し・育てたの帯に入るまで Step 1 と、Global Constraints の動かしてよい数字を直す。どれかを満たすと別のどれかが外れて両立しないステージが出たら、止めて依頼者に表と案を出す

- [ ] **Step 3: 変える前と後のマップを撮る**

README の CDP 手順で、直した各ステージの配置の場面（「始める」の前）を、変える前（`git stash` か develop の build）と後で撮る。PNG を data URI で埋め込んだ 1 枚の HTML に、ステージごとに前・後を並べ、動かした敵に印を付けた版と印なしの版を対で出す。表で、ステージごとの突っ込み（歩き・飛行・ガウ）・通し・育てたの勝率の前後、技の距離（4 マス）を添える。Artifact で公開し、依頼者の承認を待つ

- [ ] **Step 4: README を直す**

「難易度を測る」: 動かしてよいものに「ゴールの手前の敵の配置」を足し、「地形・敵の配置・数は動かさない」を「地形は動かさない。敵の配置はゴールの手前だけ」にする。突っ込み・急ぎの測り方（`RUSH_SEEDS`・`RUSH_MAX`・4 種類・`--check` が見ること）と表の新しい列を書く。帯と測定の結果の置き場（下の Step 5 の文書）を書く

- [ ] **Step 5: 測定の結果を残してコミット**

`docs/superpowers/specs/2026-11-18-clear-score-results.md` に、Task 2 と Task 3 の表と、直したステージごとの変更を書く。

```bash
git add assets/stages README.md docs/superpowers/specs/2026-11-18-clear-score-results.md
git commit -m "feat: ゴールの手前に見張りを置き、1 人の突っ込みを止める"
```

---

### Task 4: 目安の時間と評価（依頼者に見せる 2）

**Files:**
- Create: `src/ui/clear-time.ts`
- Test: `src/ui/clear-time.test.ts`
- Modify: `src/engine/schema.ts`（`StageDef.parTimes` と読み込み）
- Modify: `assets/stages/*.json`（10 ファイルに `parTimes`）
- Test: `src/engine/schema.test.ts`（ステージの読み込みのテストがあるファイル。無ければ `stage-limits.test.ts` のそば）

**Interfaces:**
- Produces:
  - `export type ParTimes = { gold: number; silver: number; bronze: number }`（`src/engine/schema.ts`）、`StageDef.parTimes: ParTimes`（必須）
  - `export type Rank = 'gold' | 'silver' | 'bronze'`、`export function rankFor(seconds: number, par: ParTimes): Rank | null`、`export function formatClearTime(seconds: number): string`、`export const RANK_LABEL: Record<Rank, string>`（`{ gold: '金', silver: '銀', bronze: '銅' }`）、`export const RANK_COLOR: Record<Rank, string>`（`src/ui/clear-time.ts`）

- [ ] **Step 1: 失敗するテストを書く**

```ts
const par = { gold: 60, silver: 90, bronze: 120 };
it('formatClearTime は切り捨てて分と秒', () => {
  expect(formatClearTime(48.9)).toBe('48秒');
  expect(formatClearTime(60.9)).toBe('1分0秒');
  expect(formatClearTime(125)).toBe('2分5秒');
  expect(formatClearTime(134.2)).toBe('2分14秒');
});
it('rankFor は画面に出す秒（切り捨て）で比べ、目安ちょうどを含む', () => {
  expect(rankFor(60.9, par)).toBe('gold');
  expect(rankFor(61, par)).toBe('silver');
  expect(rankFor(120.5, par)).toBe('bronze');
  expect(rankFor(121, par)).toBeNull();
});
```

スキーマ: `parTimes` が無い・整数でない・1 未満・`gold < silver < bronze` でない（等しいも不可）ときにそのステージのファイルと `parTimes` の欄でエラー。全ステージの JSON が `parTimes` を持つ（`loadRegistry` が通る）

- [ ] **Step 2: 落ちることを確かめる**

Run: `npx vitest run src/ui/clear-time.test.ts src/engine`
Expected: FAIL

- [ ] **Step 3: 実装する**

- `clear-time.ts`: `rankFor` は `Math.floor(seconds)` を目安と比べる。`RANK_COLOR` は金 `#ffd479`・銀 `#d6dde4`・銅 `#d39a6a`（Claude の判断。Task 6 の見本で変えてよい）
- スキーマ: 既存の `requireNumber(..., { min: 1, int: true })` で 3 つを読み、順序を `fail` で見る
- 10 ステージの JSON: 仮の値を入れる。仮の値は、Task 3 の最後の表のステージごとの `fastMedianSeconds`（急ぎ）と `medianSeconds`（通し）から、金 = 急ぎの秒を 5 秒単位に切り上げ、銀 = 金と通しの間の真ん中、銅 = 通しの秒を 10 秒単位に切り上げ（急ぎが勝てていないステージは、金 = 通しの 0.6 倍）。この決め方は Claude の案で、Step 5 で依頼者が直す

- [ ] **Step 4: 通ることを確かめる**

Run: `npm test`
Expected: PASS

- [ ] **Step 5: 表を見せて決めてもらう**

ステージごとに、通しのボットの秒（中央値）・急ぎの秒（中央値）・急ぎの勝率・案の金・銀・銅を並べた表を Artifact で公開する。急ぎは手で遊ぶ代わりにボットで測ったことを一言添える。依頼者が決めた値を JSON に書き直す

- [ ] **Step 6: コミット**

```bash
git add src/ui/clear-time.ts src/ui/clear-time.test.ts src/engine assets/stages
git commit -m "feat: ステージごとの目安の時間と金・銀・銅の評価"
```

---

### Task 5: 一番速い記録をセーブに残す

**Files:**
- Modify: `src/save/save.ts`
- Modify: `src/ui/flow.ts`（`applyStageClear`・`StageResult`）
- Test: `src/save/save.test.ts`、`src/ui/flow.test.ts`

**Interfaces:**
- Consumes: なし（`BattleState.time`）
- Produces:
  - `SaveData.bestTimes: Record<string, number>`（ステージ ID → 一番速い秒。小数のまま）。`newSave` は `{}`。`SAVE_VERSION` は上げない（欄を足すだけ。今までの欄と同じ）
  - `export type ClearRecord = { seconds: number; best: number; prevBest: number | null; isRecord: boolean }`（`src/ui/flow.ts`。`best` は書き換えた後の一番速い秒、`isRecord` は `prevBest` が null か、`seconds < prevBest`）
  - `StageResult` に `clear: ClearRecord`

- [ ] **Step 1: 失敗するテストを書く**

`save.test.ts`:
- `今までのセーブ（bestTimes が無い）は記録なしで読める` → `bestTimes` が `{}`、ほかの欄はそのまま
- `bestTimes の壊れた項目だけ捨てる`: `{ stage1: 50.5, nope: 30, stage2: -1, stage4: 0, stage5: 'x', stage6: null }` → `{ stage1: 50.5 }`（NaN は JSON に書けないので、`Infinity` 相当は `1e999` を文字列で書いた JSON から読んで捨てる）
- `bestTimes が配列や数なら空にする`

`flow.test.ts`:
- `初めてのクリアは記録更新で、best が今回の秒`: `battle.time = 75.3` → `clear = { seconds: 75.3, best: 75.3, prevBest: null, isRecord: true }`、`save.bestTimes.stage1 === 75.3`
- `前より速ければ書き換えて記録更新`: `bestTimes.stage1 = 80` で `time = 70` → `best 70`・`prevBest 80`・`isRecord true`
- `前より遅ければ変えず、記録更新でない`: `bestTimes.stage1 = 60` で `time = 70` → `best 60`・`isRecord false`・セーブの値は 60
- `同じ秒は記録更新でない`

- [ ] **Step 2: 落ちることを確かめる**

Run: `npx vitest run src/save src/ui/flow.test.ts`
Expected: FAIL

- [ ] **Step 3: 実装する**

- `reconcile`: `raw.bestTimes` が素のオブジェクトなら、知っているステージ ID で、値が有限で 0 より大きい数の項目だけ写す
- `applyStageClear`: `battle.time` を `seconds` にし、`bestTimes` を書き換える。負けたときは呼ばれないので、勝ったときだけの記録になる
- ボットの `playThrough` も `applyStageClear` を使うが、`clear` は読まないので変えない

- [ ] **Step 4: 通ることを確かめる**

Run: `npm test`
Expected: PASS

- [ ] **Step 5: コミット**

```bash
git add src/save src/ui/flow.ts src/ui/flow.test.ts
git commit -m "feat: ステージごとの一番速いクリアの時間をセーブに残す"
```

---

### Task 6: 結果の画面とステージ選択に出す（依頼者に見せる 3）

**Files:**
- Modify: `src/ui/screens.ts`（`drawResult`・`drawStageSelect`）
- Modify: `src/ui/layout.ts`（必要なら結果の画面の見出しと時間の行の位置）
- Modify: `src/main.ts`（`finishStage` の `result` に `clear` を持たせ、`drawResult` に渡す）
- Modify: README.md

**Interfaces:**
- Consumes: Task 4 の `rankFor`・`formatClearTime`・`RANK_LABEL`・`RANK_COLOR`・`StageDef.parTimes`、Task 5 の `ClearRecord`・`SaveData.bestTimes`
- Produces: `drawResult(ctx, reg, gains, clear: ClearRecord, par: ParTimes, images)`

- [ ] **Step 1: 結果の画面**

見出し「敵の 本拠地に 到達！」の下、仲間の行（`resultSlot(0)` の y=150）より上に、「クリア 2分14秒」と評価（色付きの「金」など。銅より遅いときは出さない）、「最高 1分58秒」を出す。`isRecord` なら「記録更新！」を金色で出す（初めてのクリアも記録更新）。仲間の行と「次へ」の位置は変えない（入らなければ見出しを上へ寄せる。`layout.ts` の値を直す）。`main.ts` の `result` を `{ gains, clear }` にし、`stageId` のステージの `parTimes` を渡す

- [ ] **Step 2: ステージ選択**

`bestTimes` に記録があるステージの枠に、一番速い時間と評価を出す。今の「クリア済み」（右上）と重ならないよう、左上に「金 1分58秒」の形（評価が無ければ時間だけ）。名前（y+46）と「敵を 見る」（y+72〜108）と重ならないこと

- [ ] **Step 3: ビルドとテスト**

Run: `npm test && npm run build`
Expected: PASS・ビルド成功

- [ ] **Step 4: 撮って見せる**

README の CDP 手順で撮る: 結果の画面（初めてのクリア＝記録更新・金／前より遅い＝記録更新なし・評価なし）、ステージ選択（記録のあるステージ・無いクリア済みのステージ・まだ行けないステージが並ぶ所）。セーブは `localStorage` に直接書いて状態を作ってよい。PNG を data URI で埋め込んだ HTML を Artifact で公開し、依頼者の承認を待つ。直したら撮り直して見せる

- [ ] **Step 5: README を直す**

「そうさ」の後ろあたりに「クリアの時間と評価」の節: 測り方（戦闘の時計。会話・カード・帯の間と配置の場面は数えない）、勝ったときだけ記録、評価の決め方（切り捨てた秒と `parTimes`。銅より遅いと評価なし）、結果の画面とステージ選択に出るもの、セーブの `bestTimes`。「コンテンツの足しかた」のステージに `parTimes`（必須・整数・金 < 銀 < 銅・直すと前の記録の評価も変わる）。「新しいスキル」の駆け抜ける・急降下に `maxCells`（届く距離のマス数）

- [ ] **Step 6: コミット**

```bash
git add src/ui/screens.ts src/ui/layout.ts src/main.ts README.md
git commit -m "feat: 結果の画面とステージ選択にクリアの時間と評価を出す"
```

---

### Task 7: 仕上げ

**Files:**
- Modify: HANDOVER.md（「## 進捗」と「工程 6 の結果」）
- Modify: `docs/superpowers/specs/2026-11-18-clear-score-results.md`（最後の表）

- [ ] **Step 1: 最後の測定**

Run（バックグラウンド）: `npm run balance -- --check`
Expected: 終了コード 0。表を結果の文書に足す

- [ ] **Step 2: 全部のテストとビルド**

Run: `npm test && npm run build`
Expected: PASS・ビルド成功

- [ ] **Step 3: HANDOVER を直す**

`~/.claude/rules/progress.md` の書式で「## 進捗」を今の状態に（工程 6 を完了、工程 7 ← 今ここ）。「工程 6 の結果」を工程 5 の結果の上に足す（決めたこと・勝率・ブラウザで確かめたこと・確かめていないこと・台帳の置き場）

- [ ] **Step 4: 片付けとコミット**

撮影用のスクリプトや一時ファイルを消す（`rm -r`・`rm`）。

```bash
git add HANDOVER.md docs/superpowers/specs/2026-11-18-clear-score-results.md
git commit -m "docs: 工程 6 の結果を引き継ぎに書く"
```
