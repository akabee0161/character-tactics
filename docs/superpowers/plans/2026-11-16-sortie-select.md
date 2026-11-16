# 出撃を選ぶ Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 配置の場面で出撃する仲間（8 人まで）を選べるようにし、選んだ内容を挑み直しと次のステージへ引き継ぐ。あわせてレベルアップのカードにセリフを出し、先送りの指摘（村の加入の判定・M3・M7）を直す。

**Architecture:** 誰を出すかの決め方は純粋な関数（`src/core/sortie.ts`）に集める。`createBattleState` は出撃の一覧を任意で受け取り、「決める」では一覧を渡して状態を作り直し、残した仲間の位置を写す（設計の作り方 1）。一覧の画面は工程 2 の重ねる仕組み（`Overlay`）に新しい種類 `sortie` を足す。

**Tech Stack:** TypeScript、Vite、Vitest、Canvas2D

**Spec:** `docs/superpowers/specs/2026-11-16-sortie-select-design.md`

## Global Constraints

- 場に出るのは `MAX_PARTY`（8）人まで。9 人以上を場に出さない
- 外せない仲間 = そのステージの `defeat` のうち `type: 'unitLost'` の `defIds`（重複を除く）。説得する役（`persuader`）は外せる仲間のまま、印も出さない
- 出撃を選ぶ画面を出すのは、そのステージの出撃の候補が 8 人を超えるときだけ
- 画面の文字は漢字仮名交じり、語の間に半角空白（既存の UI 文字列に合わせる）。固定の文字: ボタン「出撃を 選ぶ」「始める」「決める」、枠のボタン「強さ」、見出し「出撃する 仲間」、説明「押すと 入れる・外す。「強さ」で カード」、枠の印「出撃」「外せない」、断りの文「（名前）は 倒れたら 負けなので 外せない」「8 人まで。先に 誰かを 外す」
- 出撃を選び直しても、加入の記録・レベル・村のごほうびの記録は変わらない
- 描画にはユニットテストを書かない。純ロジックとレイアウト計算にテストを書き、見た目は README の CDP 手順で確かめる
- ボット（`npm run balance`）の出撃は今と同じ（セーブに前回の出撃が無いので自動の 8 人）。勝率の表が今と同じ値になること
- 「札」は「カード」と呼ぶ。README を言い換える。ログ（`docs/superpowers/` の既存の文書）は直さない。テストの説明文の「札」は、そのタスクで触るテストファイルだけ直す
- コミットは Conventional Commits ＋ 日本語の要約

## Review Focus

1. **開始時に加わる仲間を外して「決める」**: 加入の記録（`joined`・`benchedRecruits`）は残り、クリア後のセーブにその仲間が加わったときのレベルで入る → Task 2 のテスト `開始時の加入を外しても加入の記録は残る`
2. **加入済みの村の仲間を外して村へ行く（s4 の ally07）**: 加入の会話は起きず、「すでに仲間」の扱い → Task 2 のテスト `セーブで加入済みの仲間は、場にいなくても村で再加入しない`
3. **セーブの前回の出撃に、もう居ない ID・候補にいない ID・重複が入っている**: 読み込みで捨てる／候補にいない仲間は選ばれない → Task 1 と Task 3 のテスト
4. **「決める」で何も変えずに閉じる、または外して入れ直す**: 残った仲間の位置は変わらない → Task 2 のテスト `残した仲間は置いた場所のまま`
5. **カード（「強さ」）を開いて閉じたあと**: 一覧の選択中の内容が失われずに戻る → Task 5 のテスト `カードを閉じると、選択中の一覧に戻る`

---

## File Structure

| ファイル | 役割 |
|---|---|
| `src/core/sortie.ts`（新規） | 出撃の候補・外せない仲間・最初の出撃・入れる/外すの判定・候補の進行（レベル） |
| `src/core/sortie.test.ts`（新規） | 上のテスト |
| `src/core/state.ts` | `createBattleState` が出撃の一覧を受け取る。`rebuildForSortie`（作り直して位置を写す）。`membersBefore` を状態に持たせる |
| `src/core/types.ts` | `BattleState.membersBefore` |
| `src/core/events.ts` | 村の加入の判定で `membersBefore` も見る |
| `src/render/objectives-view.ts` | `escortDefIds` を `lockedIds` に任せる（同じ規則を 2 か所に書かない） |
| `src/save/save.ts` | `SaveData.sortie`（前回の出撃）の読み書き |
| `src/ui/stat-card.ts`・`src/ui/levelup.ts`・`src/ui/card-view.ts` | カードの `line`（レベルアップのセリフ）。描画 |
| `src/ui/layout.ts` | 配置の場面の 2 つのボタン、出撃の一覧の矩形、`ENEMY_LIST_MAX_ROWS` |
| `src/ui/overlay.ts` | `Overlay` の種類 `sortie` と、その押した場所の判定 |
| `src/ui/card-view.ts` | 出撃の一覧の描画 `drawSortieList` |
| `src/ui/screens.ts` | `drawPlacement` のボタンを 1 つ／2 つに |
| `src/main.ts` | つなぎ込み、挑み直しの記憶、「始める」でセーブ、M7 |
| `README.md`・`HANDOVER.md` | 文書 |

---

### Task 1: 出撃の決め方（純ロジック）

**Files:**
- Create: `src/core/sortie.ts`
- Create: `src/core/sortie.test.ts`
- Modify: `src/render/objectives-view.ts:5-14`

**Interfaces:**
- Produces（`src/core/sortie.ts`）:
  - `lockedIds(stage: StageDef): string[]` — `defeat` の `unitLost` の `defIds`。出てきた順、重複なし
  - `sortieCandidates(reg: Registry, stage: StageDef, members: readonly string[]): string[]` — そのステージで場に出られる全員。並びは `createBattleState` の今の `inOrder` と同じ（`stage.roster` → `partyIds(reg, members)` のうち `members` にいるもの → `stage.joins` のうち前の 2 つに無いもの）、重複なし
  - `sortieProgress(stage: StageDef, party: PartyProgress, defId: string): CharProgress` — 開始時の加入（`joins` にいて、`members`・`roster` にいない）は `{ level: join.level, xp: 0 }`、それ以外は `party.units[defId] ?? { level: 1, xp: 0 }`（`bonus` もそのまま）
  - `initialSortie(reg: Registry, stage: StageDef, members: readonly string[], previous: readonly string[]): string[]` — 選ぶ優先: `lockedIds` → `joins` → `previous` → 自動の順（`joins` → `roster` → `members` の並び）。候補にいない ID は飛ばし、重複を除き、`MAX_PARTY` 人で切る。**返す並びは `sortieCandidates` の並び**（優先の順ではない）
  - `toggleSortie(stage: StageDef, chosen: readonly string[], id: string, candidates: readonly string[]): { chosen: string[]; refusal: 'locked' | 'full' | null }` — 入っていて外せる → 外す。入っていて外せない → `locked`。入っていない・8 人 → `full`。入っていない・8 人未満 → 入れる。返す `chosen` は `candidates` の並び。候補にいない `id` は何もしない（`refusal: null`、`chosen` はそのまま）
  - `canChooseSortie(candidates: readonly string[]): boolean` — `candidates.length > MAX_PARTY`

- [ ] **Step 1: テストを書く**（`src/core/sortie.test.ts`。`testRegistry()` の本物のステージを使う）

```ts
const reg = testRegistry();
const stage = (id: string) => reg.stages.find((s) => s.id === id)!;
// s9 の時点で加わっている 8 人（並びは加わった順の例）
const M9 = ['ally05', 'ally07', 'ally09', 'ally12', 'ally10', 'ally06', 'ally11', 'ally13'];

it('外せない仲間は負けの条件の unitLost の仲間', () => {
  expect(lockedIds(stage('stage9'))).toEqual(['roran']);
  expect(reg.stages.some((s) => lockedIds(s).join() === 'roran,mist')).toBe(true);
});
it('候補は roster → 加わった順 → 開始時の加入', () => {
  expect(sortieCandidates(reg, stage('stage9'), M9)).toEqual(
    ['roran', 'ines', 'mist', 'gau', ...M9, 'ally14']);
});
it('前回の出撃が無いときは今の自動の 8 人（並びは候補の順）', () => {
  expect(initialSortie(reg, stage('stage9'), M9, [])).toEqual(
    ['roran', 'ines', 'mist', 'gau', 'ally05', 'ally07', 'ally09', 'ally14']);
});
it('前回の出撃を引き継ぎ、外せない仲間と開始時の加入を先に入れ、あふれた分は前回の後ろから外れる', () => {
  const prev = ['roran', 'ally12', 'ally10', 'ally06', 'ally11', 'ally13', 'ines', 'mist'];
  expect(initialSortie(reg, stage('stage9'), M9, prev)).toEqual(
    ['roran', 'ines', 'ally12', 'ally10', 'ally06', 'ally11', 'ally13', 'ally14']);
});
it('前回の出撃のうち候補にいない ID・重複は飛ばし、足りない分を自動の順で埋める', () => {
  expect(initialSortie(reg, stage('stage9'), M9, ['ghost', 'ally13', 'ally13', 'ally08'])).toEqual(
    ['roran', 'ines', 'mist', 'gau', 'ally05', 'ally07', 'ally13', 'ally14']);
});
it('入れる・外す・外せない・8 人', () => {
  const s = stage('stage9');
  const c = sortieCandidates(reg, s, M9);
  const full = initialSortie(reg, s, M9, []);
  expect(toggleSortie(s, full, 'roran', c)).toEqual({ chosen: full, refusal: 'locked' });
  expect(toggleSortie(s, full, 'ally12', c)).toEqual({ chosen: full, refusal: 'full' });
  const seven = toggleSortie(s, full, 'gau', c);
  expect(seven).toEqual({ chosen: full.filter((id) => id !== 'gau'), refusal: null });
  expect(toggleSortie(s, seven.chosen, 'ally12', c).chosen).toEqual(
    ['roran', 'ines', 'mist', 'ally05', 'ally07', 'ally09', 'ally12', 'ally14']);
  expect(toggleSortie(s, full, 'ghost', c)).toEqual({ chosen: full, refusal: null });
});
it('候補が 8 人を超えるときだけ選べる', () => {
  expect(canChooseSortie(sortieCandidates(reg, stage('stage1'), []))).toBe(false);
  expect(canChooseSortie(sortieCandidates(reg, stage('stage9'), M9))).toBe(true);
});
it('開始時の加入の進行は加わるときのレベル、それ以外はセーブの値', () => {
  const party = { units: { ines: { level: 6, xp: 3 } }, members: M9, claimed: [] };
  expect(sortieProgress(stage('stage9'), party, 'ally14')).toEqual({ level: stage('stage9').joins[0]!.level, xp: 0 });
  expect(sortieProgress(stage('stage9'), party, 'ines')).toEqual({ level: 6, xp: 3 });
});
```

- [ ] **Step 2: 走らせて落ちることを確かめる** — `npx vitest run src/core/sortie.test.ts` → モジュールが無くて FAIL
- [ ] **Step 3: `src/core/sortie.ts` を実装する**（上の Interfaces のとおり）。`escortDefIds` は `lockedIds(stage)` を返すだけにする（`render` から `core` を読むのは既存の向き）
- [ ] **Step 4: 通ることを確かめる** — `npx vitest run src/core/sortie.test.ts src/render` → PASS
- [ ] **Step 5: コミット** — `git commit -m "feat: 出撃の候補と最初の出撃を決める関数"`

---

### Task 2: 出撃の一覧で戦いの状態を作る・作り直す、村の加入の判定

**Files:**
- Modify: `src/core/state.ts:119-215`（`createBattleState`）
- Modify: `src/core/types.ts`（`BattleState` に `membersBefore`）
- Modify: `src/core/events.ts:58`
- Test: `src/core/state.test.ts`、`src/core/events.test.ts`

**Interfaces:**
- Consumes: Task 1 の `sortieCandidates`・`sortieProgress`・`initialSortie`
- Produces:
  - `createBattleState(reg, stage, party, seed, sortie?: readonly string[]): BattleState` — `sortie` を渡さないときは `initialSortie(reg, stage, party.members, [])`。場に出すのは `sortieCandidates` の並びのうち `sortie` に含まれるもの、先頭から `MAX_PARTY` 人。`uid` は今どおり `p1`… を場の並びで振る。進行は `sortieProgress`。`joined`・`benchedRecruits` は今と同じ意味（開始時の加入は場に出なくても `joined` に入り、場に出なければ `benchedRecruits`）
  - `rebuildForSortie(reg, stage, party, seed, sortie: readonly string[], kept: ReadonlyMap<string, Vec2>): BattleState` — `createBattleState(reg, stage, party, seed, sortie)` を作り、`kept` にある defId の仲間はその位置に置く。それ以外の仲間は、`startPositions(stage, grid, MAX_PARTY * 2)` を先頭から見て、すでに置いた仲間のどれとも 32px（`START_SPACING`）以上離れている位置に順に置く
  - `BattleState.membersBefore: ReadonlySet<string>` — `new Set(party.members)`
- 既存の呼び出し（`balance.ts`・テスト）は 4 引数のまま動く

- [ ] **Step 1: テストを書く**（`state.test.ts`）

```ts
it('出撃の一覧を渡すと、その仲間だけが候補の並びで場に出る', () => {
  const s = createBattleState(reg, stage('stage9'), party(M9), 1,
    ['ally13', 'roran', 'ally12', 'ines', 'ally06', 'ally11', 'ally10', 'mist']);
  expect(playerDefIds(s)).toEqual(['roran', 'ines', 'mist', 'ally12', 'ally10', 'ally06', 'ally11', 'ally13']);
});
it('一覧の 9 人目以降・候補にいない ID は場に出ない', () => { /* 10 人と 'ghost' を渡して 8 人・ghost なし */ });
it('一覧を渡さないときは今の自動の 8 人', () => {
  expect(playerDefIds(createBattleState(reg, stage('stage9'), party(M9), 1)))
    .toEqual(initialSortie(reg, stage('stage9'), M9, []));
});
it('開始時の加入を外しても加入の記録は残る', () => {
  const s = createBattleState(reg, stage('stage9'), party(M9), 1, ['roran', 'ines', 'mist', 'gau', 'ally05', 'ally07', 'ally09', 'ally12']);
  expect(s.joined).toContain('ally14');
  expect(s.benchedRecruits).toEqual([{ defId: 'ally14', level: stage('stage9').joins[0]!.level }]);
});
it('残した仲間は置いた場所のまま、入れた仲間は空いた開始位置に重ならずに出る', () => {
  const kept = new Map([['roran', { x: 100, y: 600 }], ['ines', { x: 140, y: 600 }]]);
  const s = rebuildForSortie(reg, stage('stage9'), party(M9), 1, initialSortie(reg, stage('stage9'), M9, []), kept);
  expect(posOf(s, 'roran')).toEqual({ x: 100, y: 600 });
  expect(posOf(s, 'ines')).toEqual({ x: 140, y: 600 });
  // ほかの 6 人は配置できる位置で、どの 2 人も 32px 以上離れている
  for (const u of players(s)) expect(canPlaceAt(s.stage, s.grid, u.pos)).toBe(true);
  expect(minPairDistance(players(s))).toBeGreaterThanOrEqual(32);
});
```

（`party`・`playerDefIds`・`posOf`・`players`・`minPairDistance` はテストファイル内の小さな補助。`kept` の座標は stage9 で配置できる位置を選ぶこと。ずれていたら `canPlaceAt` が true になる座標に直す）

`events.test.ts` に:

```ts
it('セーブで加入済みの仲間は、場にいなくても村で再加入しない', () => {
  // fresh(...) と同じ作りで、party.members に 'ghost' を入れ、場には出さない
  // recruit('ghost') の村を訪れても pendingRecruit は null のまま
});
```

（`fresh` に `members` を渡せるよう補助の引数を足す）

- [ ] **Step 2: 落ちることを確かめる** — `npx vitest run src/core/state.test.ts src/core/events.test.ts` → FAIL
- [ ] **Step 3: 実装する** — `createBattleState` の場の決め方を Task 1 の関数に置き換え、`membersBefore` を足し、`events.ts` の `present` に `state.membersBefore.has(id)` を足す。`rebuildForSortie` を足す
- [ ] **Step 4: 通ることを確かめる** — `npm test` → 全部 PASS（既存の state・balance・events のテストを含む）
- [ ] **Step 5: 勝率が変わらないことを確かめる** — `npm run balance` → 台帳 2026-11-15-show-strength の Task 7 の値（s4 92.5 / s5 97.5 / s6 97.5 / s7 47.5 / s8 89.7 / s9 43.6 / s10 22.2 / s3 37.5）と同じ
- [ ] **Step 6: コミット** — `git commit -m "feat: 出撃の一覧で戦いの状態を作り、村の加入はセーブの仲間も見る"`

---

### Task 3: 前回の出撃をセーブに残す

**Files:**
- Modify: `src/save/save.ts`
- Test: `src/save/save.test.ts`

**Interfaces:**
- Produces: `SaveData.sortie: string[]`（前回「始める」を押したときの出撃。並びのまま）。`newSave` は `[]`。`SAVE_VERSION` は上げない（`members` と同じく、フィールドが無い旧セーブは `[]`）

- [ ] **Step 1: テストを書く** — `sortie を書いて読むと同じ並び`、`知らない ID・文字列でない値・重複は捨てる`（`['roran', 'ghost', 3, 'roran', 'ines']` → `['roran', 'ines']`）、`sortie が無いセーブは []`
- [ ] **Step 2: 落ちることを確かめる** — `npx vitest run src/save` → FAIL
- [ ] **Step 3: 実装する** — `reconcile` に `members` と同じ形の読み取りを足す
- [ ] **Step 4: 通ることを確かめる** — `npm test` → PASS（`SaveData` を作っている既存のテストの fixture が型で落ちたら `sortie: []` を足す）
- [ ] **Step 5: コミット** — `git commit -m "feat: 前回の出撃をセーブに残す"`

---

### Task 4: レベルアップのカードにセリフ、敵の一覧の行の上限（M3）

**Files:**
- Modify: `src/ui/stat-card.ts`（`StatCard.line`、`baseCard` は `null`）
- Modify: `src/ui/levelup.ts`（`levelUpCard`）
- Modify: `src/ui/card-view.ts`（`drawStatCard` に `line` を描く）
- Modify: `src/ui/layout.ts`（`ENEMY_LIST_MAX_ROWS`）
- Test: `src/ui/levelup.test.ts`、`src/ui/stat-card.test.ts`

**Interfaces:**
- Produces:
  - `StatCard.line: string | null` — レベルアップのカードだけ。`reg.lines.get(\`levelup:${defId}\`) ?? null`
  - `ENEMY_LIST_MAX_ROWS: number` — `enemyListRow(i)` の下端が `ENEMY_LIST_CLOSE_BTN.y` 以下に収まる最大の行数（今の値で 6）。式で出す

- [ ] **Step 1: テストを書く**
  - `levelup.test.ts`: `レベルアップのカードにその仲間のセリフが入る`（roran → `'強く なった 気が する！'`）、`セリフが無い仲間は null`（lines に無い defId のイベントで）、`仲間・敵のカードの line は null`
  - `stat-card.test.ts`: `どのステージも敵の種類は一覧の行に収まる` — 全ステージで `stageEnemies(reg, s).length <= ENEMY_LIST_MAX_ROWS`。`enemyListRow(ENEMY_LIST_MAX_ROWS - 1)` の下端 ≤ `ENEMY_LIST_CLOSE_BTN.y` かつ `enemyListRow(ENEMY_LIST_MAX_ROWS)` の下端 > `ENEMY_LIST_CLOSE_BTN.y`
  - 触ったテストファイルの説明文の「札」を「カード」に直す
- [ ] **Step 2: 落ちることを確かめる** — `npx vitest run src/ui` → FAIL
- [ ] **Step 3: 実装する** — `drawStatCard` は `card.line` があれば、名前・役割の下、能力の棒の上に 1〜2 行で描く（`wrapText` で折る。金色ではなく `INK`、カギ括弧で囲む）。重なるなら棒の開始位置を `line` があるときだけ下げる
- [ ] **Step 4: 通ることを確かめる** — `npm test` → PASS
- [ ] **Step 5: ブラウザで確かめる** — README の CDP 手順で、戦闘中にレベルアップさせてカードを撮る（`?debug` と経験値の近い仲間で）。セリフが名前・棒・技の文と重ならないこと、長いセリフ（改行を含む ガウ「うおー！\nもっと 行ける！」）でも収まること。撮った画像は依頼者に Artifact で見せる
- [ ] **Step 6: コミット** — `git commit -m "feat: レベルアップのカードにセリフを出し、敵の一覧の行数を確かめる"`

---

### Task 5: 出撃の一覧の重ねる物と押した場所の判定

**Files:**
- Modify: `src/ui/layout.ts`
- Modify: `src/ui/overlay.ts`
- Test: `src/ui/overlay.test.ts`、`src/ui/layout.test.ts`

**Interfaces:**
- Consumes: Task 1 の `toggleSortie`・`lockedIds`
- Produces:
  - `layout.ts`: `SORTIE_BTN: Rect = { x: 8, y: 788, w: 220, h: 68 }`、`START_BTN: Rect = { x: 236, y: 788, w: 296, h: 68 }`（2 つを合わせると `MESSAGE_BAR` の幅に収まる）、`SORTIE_SHEET: Rect = { x: 12, y: 120, w: 516, h: 640 }`、`sortieSlot(i): Rect`（3 列、`{ x: SORTIE_SHEET.x + 8 + (i % 3) * 168, y: SORTIE_SHEET.y + 90 + Math.floor(i / 3) * 80, w: 160, h: 74 }`）、`sortieStrengthBtn(slot: Rect): Rect`（枠の右下 `{ x: slot.x + slot.w - 58, y: slot.y + slot.h - 32, w: 52, h: 26 }`）、`SORTIE_DECIDE_BTN: Rect`（シートの下寄り中央、幅 200・高さ 56）、`SORTIE_MESSAGE_Y: number`（断りの文の行。15 枠の下と決めるボタンの間）
  - `overlay.ts`:
    - `Overlay` に `| { kind: 'sortie'; stage: StageDef; candidates: string[]; chosen: string[]; message: string | null }`。`export type SortieOverlay = Extract<Overlay, { kind: 'sortie' }>`
    - `OverlayTap` に `| { type: 'toggle'; id: string } | { type: 'strength'; id: string } | { type: 'decide' }`
    - `overlayTap` の `sortie`: 決めるボタン → `decide`（`chosen.length === 0` なら `none`）。枠 i の「強さ」→ `strength`、枠 i のそれ以外 → `toggle`。それ以外（一覧の外を含む）→ `none`
    - `applySortieToggle(o: SortieOverlay, id: string, nameOf: (id: string) => string): SortieOverlay` — `toggleSortie` を呼び、`refusal` に応じて `message` を `${nameOf(id)}は 倒れたら 負けなので 外せない` / `8 人まで。先に 誰かを 外す` / `null` にする
    - `closeOverlay` は今のまま（カードの `back` に `sortie` を入れれば、閉じると一覧に戻る）

- [ ] **Step 1: テストを書く**
  - `layout.test.ts`: `出撃の 15 枠と決めるボタンがシートに収まり、互いに重ならない`、`SORTIE_BTN と START_BTN が MESSAGE_BAR の中で重ならない`
  - `overlay.test.ts`: `枠を押すと toggle、強さを押すと strength`、`一覧の外を押しても閉じない`、`決めるで decide`、`8 人で入れようとすると断りの文`、`外せない仲間を外そうとすると名前入りの断りの文`、`入れ直すと断りの文が消える`、`カードを閉じると、選択中の一覧に戻る`（`{ kind: 'card', card, back: sortieOverlay }` を `closeOverlay` すると同じ `chosen` の `sortie`）
- [ ] **Step 2: 落ちることを確かめる** — `npx vitest run src/ui` → FAIL
- [ ] **Step 3: 実装する**
- [ ] **Step 4: 通ることを確かめる** — `npm test` → PASS
- [ ] **Step 5: コミット** — `git commit -m "feat: 出撃の一覧の重ねる物と押した場所の判定"`

---

### Task 6: 画面につなぐ（配置の場面・一覧の描画・挑み直し・セーブ・M7）

**Files:**
- Modify: `src/ui/screens.ts`（`drawPlacement`）
- Modify: `src/ui/card-view.ts`（`drawSortieList`）
- Modify: `src/main.ts`

**Interfaces:**
- Consumes: Task 1〜5 のすべて
- Produces（`main.ts` の中だけ）:
  - `stageSeed: number` — `beginStage` で決めた種。作り直しで使い直す
  - `retryStart: { stageId: string; sortie: string[]; positions: Map<string, Vec2> } | null` — 「始める」で記録。`beginStage(index, retry: boolean)` の `retry` が true で `stageId` が同じなら、`rebuildForSortie` でその出撃と位置から始める。そうでなければ `initialSortie(reg, stage, save.members, save.sortie)` で `createBattleState`
  - `openOverlay(o: Overlay): void` — `overlay` を入れ、進行中の `stageDrag`・`pointerStart`・`dragMap` を終える（M7）。重ねる物を開くところはすべてこれを通す
  - `drawPlacement(ctx, state, canChoose: boolean)` — `canChoose` なら `SORTIE_BTN`「出撃を 選ぶ」と `START_BTN`「始める」、でなければ今どおり `MESSAGE_BAR` 全体が「始める」
  - `drawSortieList(ctx, reg, o: SortieOverlay, levels: (id: string) => number, images)` — 見出し「出撃する 仲間」、右に `${chosen.length} / 8`、説明の 1 行、15 枠（顔・名前・`Lv`・役割、出撃は金色の縁と「出撃」、外せないは「外せない」、右下に「強さ」）、断りの文、「決める」。見本 https://claude.ai/artifact/Qz4xBbGEdrckcg5VTiuVG3 の案 1 の見た目に合わせる

つなぎ方:
- 配置の場面で `canChooseSortie(sortieCandidates(...))` のとき、`SORTIE_BTN` を押すと `openOverlay({ kind: 'sortie', stage, candidates, chosen: 今の場の仲間の defId（並びのまま）, message: null })`。`START_BTN`（選べないときは `MESSAGE_BAR`）で今どおり開始
- 一覧の `toggle` → `applySortieToggle`。`strength` → `openOverlay({ kind: 'card', card: cardFromDef(reg, id, statsForLevel(def, p.level, reg.growth, p.bonus)) に level を入れたもの, back: 今の一覧 })`（`p = sortieProgress(stage, save, id)`）。`decide` → 場の仲間と `chosen` が同じなら閉じるだけ。違えば `battle = rebuildForSortie(reg, stage, save, stageSeed, chosen, 今の場の仲間の位置)` にし、`escorts` は今のまま、`selected = null`、閉じる
- 「始める」: `save = { ...save, sortie: 場の仲間の defId }` にしてから今の `writeSave`、`retryStart` を記録
- 負けの画面の「もう一度」は `beginStage(stageIndex, true)`、それ以外の呼び出しは `false`

- [ ] **Step 1: 実装する**（描画なのでユニットテストは書かない）
- [ ] **Step 2: 型とテスト** — `npm run build` と `npm test` → どちらも通る
- [ ] **Step 3: ブラウザで確かめる**（README の CDP 手順。セーブは `localStorage` の `character-tactics/save` に s1〜s8 をクリア済み・M9 の 8 人が加わった状態を書いて作る）
  - s9 の配置の場面: ボタンが 2 つ。一覧を開く → 8 / 8。ロランを押すと「ロランは 倒れたら 負けなので 外せない」。ユナを押すと「8 人まで。先に 誰かを 外す」。ガウを外してユナを入れる → 8 / 8。一覧の外を押しても閉じない。「強さ」でカード、閉じると一覧（選んだ内容のまま）
  - 「決める」の後: 動かしておいたロランの位置が変わらず、ユナが重ならずに出て、ガウが消え、下の段の並びが一覧の順
  - 「始める」→ わざと負ける → 「もう一度」: 同じ出撃と同じ位置
  - 勝って s10 へ: 前回の出撃が引き継がれ、開始時の加入（ミラ）が入っている
  - s1: 上段は「始める」だけ
  - M7: ステージ選択で、指 1（`pointerId: 1`）で一覧をドラッグしたまま、指 2 で仲間の枠を押してカードを開き、指 1 を動かす → 一覧が動かない
  - 撮った画像は依頼者に Artifact で見せる
- [ ] **Step 4: コミット** — `git commit -m "feat: 配置の場面で出撃を選ぶ"`

---

### Task 7: 文書

**Files:**
- Modify: `README.md`
- Modify: `HANDOVER.md`

- [ ] **Step 1: README を直す**
  - 「強さを見せる（札）」の節と操作の表・本文の「札」を「カード」に言い換える
  - 「村と説得」の段落の「今は出撃を選ぶ画面が無く、残りは出撃しない」を、出撃を選ぶ操作の説明に直す（候補が 8 人を超えると「出撃を 選ぶ」、枠で入れる・外す、「強さ」でカード、「決める」、外せない仲間、前回の出撃の引き継ぎ、挑み直し、説得の役は外せる）
  - 構成の表に `src/core/sortie.ts` の行を足す
  - レベルアップの項に「カードにその仲間のセリフ」を足す
- [ ] **Step 2: 確かめる** — `grep -n "札" README.md` → 0 件。`npm test`・`npm run build` → 通る
- [ ] **Step 3: HANDOVER の「## 進捗」を今の状態に直す**（`~/.claude/rules/progress.md` の書式。段階は `実装（7 タスク中 7）`、次にやることに依頼者の確認と PR）
- [ ] **Step 4: コミット** — `git commit -m "docs: 出撃を選ぶ操作を README に書き、札をカードと呼ぶ"`
