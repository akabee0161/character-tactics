# 盾持ちとまじない師への対抗手段（工程 1）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 守備と魔法防御を分け、斧・守護・飛行を含む新しい仲間 7 人を足して仲間を 15 人にする。場に出るのは 8 人まで。

**Architecture:** ユニット定義に `resist`（必須）・`ignoresGuard`・`flying`（省略可）を足し、ダメージ計算と移動で読む。技は `SKILL_EFFECTS` に 3 つ足す。仲間の上限は「加わった仲間 15 人」と「場の 8 人」に分け、開始時の加入を優先して場に出す。新しい 7 人は仮の絵とデータだけで足す。

**Tech Stack:** TypeScript（Vite・Vitest・Canvas2D）、Node（`tools/gen-placeholder-sprites.mjs`）

**Spec:** `docs/superpowers/specs/2026-11-15-counter-allies-design.md`

## Global Constraints

- 今のユニットの守備は変えない。魔法防御は設計書の表の値（ロラン 2・イネス 3・ミスト 7・ガウ 3・ボルグ 2・セラ 7・リュカ 2・ノエル 5、ならず者 1・弓兵 1・盾持ち 0・まじない師 6・ガルム 3、ally06-foe 7・ally08-foe 5）。種類が同じ敵（`narazumono-*` など）は全部同じ値
- まじない師・盾持ちの攻撃力・HP・守備・`bowDamageCap` は変えない
- 技の固定ダメージ（`skillHit`）は守備も魔法防御も引かない
- 魔法防御はレベルで上がらない（守備と同じ）
- 場に出る人数 `MAX_PARTY = 8`、加わった仲間の上限 `MAX_MEMBERS = 15`
- 新しい 7 人の数値・名前・技・加わる時期は設計書の表のとおり
- 勝率は測って記録するだけで、直さない
- `node tools/gen-placeholder-sprites.mjs` を引数なしで動かさない（今の本番の絵を上書きする）
- ゲーム内の文字列は漢字仮名交じり。スキーマのエラー文は `schema.ts` の既存の書き方（ひらがな中心の分かち書き）に合わせる
- 作業用の一時ファイルと進捗台帳は `.superpowers/sdd/2026-11-15-counter-allies/`（git 管理外）。コミットは Conventional Commits + 日本語

## Review Focus

1. **旧セーブの読み込み**: `bonus` に `resist` が無い旧セーブを読んでも、村で上げた守備などのボーナスが消えない（今の `readBonus` は 1 つでも欠けると全体を null にする）。→ Task 1 のテスト
2. **飛行の仲間が歩けないマスの上にいるとき、敵の AI が落ちない**: 敵が飛行の仲間を追っていて、仲間が水の上にいる。敵は止まるか別の相手に向かい、例外を出さない。→ Task 4 のテスト
3. **場が 8 人のときの説得・村の加入**: 会話は流れ、仲間は記録され、次のステージでは加わったときのレベルで出撃の候補になる（レベル 1 に戻らない）。→ Task 5 のテスト
4. **飛行の移動先・急降下の行き先がマップの外**: マップの内側に寄せる。→ Task 4 のテスト
5. **結界と村の魔法防御の上乗せが重なる**: どちらも魔法のダメージにだけ効き、近接・弓のダメージは変わらない。→ Task 3 のテスト

---

### Task 1: 魔法防御（`resist`）

**Files:**
- Modify: `src/engine/schema.ts`（`StatKey`・`STAT_KEYS`・`UnitDef`・`readUnitFields`）
- Modify: `src/core/types.ts`（`NO_BONUS`・`Unit.resist`）
- Modify: `src/core/state.ts`（`statsForLevel`・`makeUnit`）
- Modify: `src/core/growth.ts`（`awardXp` で `unit.resist` も更新）
- Modify: `src/core/combat.ts`（`DamageParams.resist`・`computeDamage`）
- Modify: `src/core/damage.ts`（`applyDamage` が `target.resist` を渡す）
- Modify: `src/save/save.ts`（`readBonus`）
- Modify: `src/ui/flow.ts`（`hasBonus`）
- Modify: `assets/units/*.json`（8 体）・`assets/enemies/*.json`（全部）
- Test: `src/core/combat.test.ts`・`src/save/save.test.ts`・`src/engine/schema.test.ts`・`src/core/state.test.ts`

**Interfaces:**
- Produces: `UnitDef.resist: number`（必須、0 以上）、`Unit.resist: number`、`StatKey` に `'resist'`、`NO_BONUS.resist = 0`、`statsForLevel(...)` の戻り値に `resist`、`DamageParams.resist: number`

- [ ] **Step 1: 失敗するテストを書く**

`combat.test.ts` の `base` に `resist: 0` を足し、次を足す。

```ts
it('魔法の攻撃は守備でなく魔法防御を引く', () => {
  expect(computeDamage({ ...base, power: 16, guard: 5, resist: 2, attackKind: 'magic' })).toBe(14);
});
it('近接と弓の攻撃は魔法防御を見ない', () => {
  expect(computeDamage({ ...base, power: 8, guard: 3, resist: 9, attackKind: 'melee' })).toBe(5);
  expect(computeDamage({ ...base, power: 8, guard: 3, resist: 9, attackKind: 'bow' })).toBe(5);
});
```

`schema.test.ts`: `resist` が無いユニット定義はエラー、負の値はエラー。
`save.test.ts`: `bonus: { maxHp: 0, power: 0, guard: 1, speed: 0 }`（`resist` なし）の旧セーブを読むと `bonus` が `{ maxHp: 0, power: 0, guard: 1, speed: 0, resist: 0 }` になる。
`state.test.ts`: `makeUnit` でミストを作ると `resist === 7`、`bonus.resist = 2` を渡すと 9。レベル 5 でも 7。

- [ ] **Step 2: テストが落ちることを確かめる**

Run: `npx vitest run src/core/combat.test.ts src/save/save.test.ts src/engine/schema.test.ts src/core/state.test.ts`
Expected: FAIL

- [ ] **Step 3: 実装する**

- `computeDamage`: `const defense = p.attackKind === 'magic' ? p.resist : p.guard;` を `guard` の代わりに引く
- `readBonus`: `resist` だけは欠けていたら 0 にする。ほかのキーは今のまま必須
- 全ユニット・全敵の JSON に `"resist"` を `"guard"` の直後に足す（値は Global Constraints）

- [ ] **Step 4: テストを通す**

Run: `npm test`
Expected: PASS（勝率を数値で固定しているテストが落ちたら、そのテストは測り直した値に更新せず、どのテストかを台帳に書いて Task 7 で扱う）

- [ ] **Step 5: コミット**

```bash
git add src assets
git commit -m "feat: 守備と魔法防御を分ける"
```

### Task 2: 斧（守備を無視する・たたき割り）

**Files:**
- Modify: `src/engine/schema.ts`（`UnitDef.ignoresGuard?`）
- Modify: `src/core/types.ts`（`Unit.ignoresGuard`・`HitSource.ignoresGuard`）
- Modify: `src/core/state.ts`（`makeUnit`）・`src/core/sim.ts:379`（`HitSource` を作る所）
- Modify: `src/core/combat.ts`・`src/core/damage.ts`
- Modify: `src/core/skills.ts`・`assets/skills.json`
- Test: `src/core/combat.test.ts`・`src/core/skills.test.ts`・`src/engine/schema.test.ts`

**Interfaces:**
- Consumes: Task 1 の `DamageParams.resist`
- Produces: `UnitDef.ignoresGuard?: boolean`（省略時 false）、`Unit.ignoresGuard: boolean`、`HitSource.ignoresGuard: boolean`、`DamageParams.ignoresGuard: boolean`、技 `tatakiwari`（params `damage: 14, range: 32, cooldown: 12`）

- [ ] **Step 1: 失敗するテストを書く**

```ts
it('守備を無視する攻撃は守備を 0 として計算する', () => {
  expect(computeDamage({ ...base, power: 10, guard: 3, ignoresGuard: true, attackKind: 'melee' })).toBe(10);
});
it('守備を無視しても魔法防御には関係しない', () => {
  expect(computeDamage({ ...base, power: 10, resist: 4, ignoresGuard: true, attackKind: 'magic' })).toBe(6);
});
```

`skills.test.ts`（`describe('tatakiwari')`）: 射程 32 以内の一番近い敵に 14 のダメージ、hits 1。32 より遠い敵しかいなければ `useSkill` が false で待ち時間も消費しない。
`schema.test.ts`: `ignoresGuard` が真偽値でなければエラー、省略すれば false。

- [ ] **Step 2: テストが落ちることを確かめる**

Run: `npx vitest run src/core/combat.test.ts src/core/skills.test.ts src/engine/schema.test.ts`
Expected: FAIL

- [ ] **Step 3: 実装する**

`tatakiwari` は `nearestWithin(self.pos, hostilesOf(state, self), range)` の 1 体に `skillHit`。`skills.json` に `{ "id": "tatakiwari", "label": "たたき割り", "params": { "damage": 14, "range": 32, "cooldown": 12 } }`。

- [ ] **Step 4: テストを通す**

Run: `npm test`
Expected: PASS

- [ ] **Step 5: コミット**

```bash
git add src assets/skills.json
git commit -m "feat: 守備を無視する攻撃とたたき割りを足す"
```

### Task 3: 結界

**Files:**
- Modify: `src/core/types.ts`（`Unit.wardUntil`・`Unit.wardResist`）・`src/core/state.ts`（`makeUnit` で -1 と 0）
- Modify: `src/core/damage.ts`（魔法防御に結界ぶんを足して渡す）
- Modify: `src/core/skills.ts`・`assets/skills.json`
- Test: `src/core/skills.test.ts`・`src/core/sim-combat.test.ts`

**Interfaces:**
- Produces: `effectiveResist(u: Unit, time: number): number`（`src/core/damage.ts` から export。`u.resist + (time < u.wardUntil ? u.wardResist : 0)`）、技 `kekkai`（params `range: 120, resist: 6, duration: 8, cooldown: 16`）

- [ ] **Step 1: 失敗するテストを書く**

`skills.test.ts`（`describe('kekkai')`）: はげますのテスト（`skills.test.ts:405` 付近）と同じ形で、範囲 120 内の生きている味方（自分を含む）の `effectiveResist` が +6、範囲外と退場した味方は変わらない、8 秒後に戻る、重ねがけせず上書き、hits は掛けた人数。
`sim-combat.test.ts`: 結界中の味方への魔法の命中は 6 減り、近接の命中は変わらない。

- [ ] **Step 2: テストが落ちることを確かめる**

Run: `npx vitest run src/core/skills.test.ts src/core/sim-combat.test.ts`
Expected: FAIL

- [ ] **Step 3: 実装する**

`skills.json` に `{ "id": "kekkai", "label": "結界", "params": { "range": 120, "resist": 6, "duration": 8, "cooldown": 16 } }`。

- [ ] **Step 4: テストを通す**

Run: `npm test`
Expected: PASS

- [ ] **Step 5: コミット**

```bash
git add src assets/skills.json
git commit -m "feat: 魔法防御を上げる結界を足す"
```

### Task 4: 飛行（移動・急降下・影）

**Files:**
- Modify: `src/engine/schema.ts`（`UnitDef.flying?`）・`src/core/types.ts`（`Unit.flying`）・`src/core/state.ts`
- Modify: `src/core/field.ts`（`clampToMap` を足す）
- Modify: `src/core/sim.ts`（`applyCommands`・`moveTowardGoal`・`stepTo`・`closeIn`）
- Modify: `src/core/skills.ts`・`assets/skills.json`
- Modify: `src/render/effects.ts`（急降下も `trail`）・`src/render/draw.ts`（飛行のユニットに影）
- Test: `src/core/field.test.ts`・`src/core/sim.test.ts`・`src/core/skills.test.ts`・`src/core/ai.test.ts`

**Interfaces:**
- Produces: `UnitDef.flying?: boolean`（省略時 false）、`Unit.flying: boolean`、`clampToMap(grid: Grid, pos: Vec2): Vec2`（x を `[cell/2, cols*cell - cell/2]`、y を `[cell/2, rows*cell - cell/2]` に収める）、技 `kyuukouka`（params `radius: 32, damage: 8, needsDest: 1, cooldown: 10`）

飛行のユニットの移動の決まり:
- 移動の指示: 目的地は `clampToMap` だけで決め、`resolveMoveDest`・フローフィールドを使わない（`goalField = null`）
- 進み方: いつも目的地へ直進。マスの速さの倍率（森の 0.5）を掛けない
- 1 歩: `separatedStep`（敵との押し合い）は今のまま、`slideStep`（壁ですべる）の代わりに `clampToMap`
- 詰め寄り（`closeIn`）も同じ 1 歩で動く

- [ ] **Step 1: 失敗するテストを書く**

- `field.test.ts`: `clampToMap` がマップの外の点を内側へ寄せ、内側の点はそのまま返す
- `sim.test.ts`: 歩けないマスの帯（壁）の向こうへ移動を指示すると、飛行のユニットは帯の上を通って一直線に着く（途中のどの tick でも `x` が出発点と目的地を結ぶ線から離れない）。地上のユニットは同じ指示で帯を越えない。マップの外への指示はマップの内側で止まる。森のマスでも速さが落ちない
- `skills.test.ts`（`describe('kyuukouka')`）: 行き先が壁の向こうでも移動し、行き先の半径 32 内の敵に 8、hits は当てた数。行き先がマップの外なら内側に寄せる。行き先なしなら false
- `ai.test.ts`: 敵（`aggressive`）が狙う飛行の仲間が歩けないマスの上にいても、数秒分 `step` しても例外を出さない

- [ ] **Step 2: テストが落ちることを確かめる**

Run: `npx vitest run src/core/field.test.ts src/core/sim.test.ts src/core/skills.test.ts src/core/ai.test.ts`
Expected: FAIL

- [ ] **Step 3: 実装する**

`skills.json` に `{ "id": "kyuukouka", "label": "急降下", "params": { "radius": 32, "damage": 8, "needsDest": 1, "cooldown": 10 } }`。`effects.ts` は `ev.skillId === 'kakenukeru' || ev.skillId === 'kyuukouka'` で `trail`。影は足元に半透明の黒い楕円を描き、絵を数 px 上にずらす（描画なのでテストは書かず、Task 7 で目で確かめる）。

- [ ] **Step 4: テストを通す**

Run: `npm test`
Expected: PASS

- [ ] **Step 5: コミット**

```bash
git add src assets/skills.json
git commit -m "feat: 歩けないマスを越える飛行と急降下を足す"
```

### Task 5: 加わった仲間 15 人・場は 8 人

**Files:**
- Modify: `src/engine/limits.ts`（`MAX_MEMBERS = 15`）・`src/core/constants.ts`（再 export）
- Modify: `src/engine/registry.ts:258`（合計の検証を `MAX_MEMBERS` で）
- Modify: `src/core/party.ts`（`partyIds` は切らずに全員を返す）
- Modify: `src/core/state.ts`（`createBattleState` の並び）
- Modify: `src/core/events.ts`（`updatePersuasions`・`completeRecruit`）
- Modify: `src/core/types.ts`（`BattleState.benchedRecruits`）
- Modify: `src/ui/flow.ts`（`applyStageClear`）
- Modify: `src/ui/screens.ts:140`（仲間一覧は `partyIds(...).slice(0, MAX_PARTY)`。表示は今のまま 8 人）
- Test: `src/core/state.test.ts`・`src/core/events.test.ts`・`src/ui/flow.test.ts`・`src/engine/registry.test.ts`・`src/core/party.test.ts`

**Interfaces:**
- Produces: `MAX_MEMBERS = 15`、`BattleState.benchedRecruits: { defId: string; level: number }[]`（戦闘の途中で加わったが場に出なかった仲間）

決まり:
- 場の並び: ①そのステージの `joins`（まだ仲間でないもの）→ ②`roster` → ③`members`（加わった順）。重複を除き `MAX_PARTY` で切る
- `joins` は場に出なくても必ず `joined` に入れる（`MAX_PARTY` を超える `joins` は今のステージ定義には無い）
- `updatePersuasions` は場の人数で止めない
- `completeRecruit` は、場が `MAX_PARTY` 人なら説得の相手を取り除き、`joined` と `benchedRecruits` に入れて null を返す。8 人未満なら今のまま場に足す
- `applyStageClear` は、`benchedRecruits` の仲間に `save.units` の記録が無ければ `{ level, xp: 0 }` を書く

- [ ] **Step 1: 失敗するテストを書く**

`state.test.ts:243` 付近の「MAX_PARTY を超える」テストを、上の決まりに合わせて書き直す:
- 場の 8 人が埋まっていても `joins` の仲間は場に出て `joined` に入り、はみ出たのは `members` の最後
- `players(s).length === MAX_PARTY`

`events.test.ts:298`・`:344` を書き直す:
- 味方が 8 人いても説得の会話が始まる
- 8 人いるとき `completeRecruit` は null を返し、相手は退場し、`joined` と `benchedRecruits` に `{ defId, level }` が入る

`flow.test.ts`: `benchedRecruits` に `{ defId: 'ally06', level: 4 }` がある戦闘をクリアすると、`save.members` に ally06、`save.units.ally06` が `{ level: 4, xp: 0 }`。
`registry.test.ts:529`: 合計が `MAX_MEMBERS` を超えるとエラー、8 人を超えても 15 人以内ならエラーにならない。

- [ ] **Step 2: テストが落ちることを確かめる**

Run: `npx vitest run src/core/state.test.ts src/core/events.test.ts src/ui/flow.test.ts src/engine/registry.test.ts src/core/party.test.ts`
Expected: FAIL

- [ ] **Step 3: 実装する**

- [ ] **Step 4: テストを通す**

Run: `npm test`
Expected: PASS

- [ ] **Step 5: コミット**

```bash
git add src
git commit -m "feat: 加わった仲間は 15 人まで記録し、場は 8 人までにする"
```

### Task 6: 新しい 7 人

**Files:**
- Create: `assets/units/ally09.json` 〜 `ally15.json`
- Modify: `tools/gen-placeholder-sprites.mjs`（`WEAPON` に `axe`・`wing`、`CHARS` に 7 人、`ROLES` に `role-ono`・`role-shugo`・`role-hikou`）
- Create: `assets/images/ally09-face.png` 〜 `ally15-*.png`・`role-ono.png`・`role-shugo.png`・`role-hikou.png`（道具で書き出す）
- Modify: `assets/lines/allies.json`（7 人ぶんの `skill:` `levelup:` `pinch:` `retire:`）
- Modify: `assets/stages/stage5.json`〜`stage10.json`（`joins`）
- Modify: `assets/images/README.txt`（仮の絵の一覧に 7 人）
- Test: `src/engine/registry.test.ts`

**Interfaces:**
- Consumes: Task 1〜5 の `resist`・`ignoresGuard`・`flying`・`tatakiwari`・`kekkai`・`kyuukouka`・`MAX_MEMBERS`

7 人の定義（設計書の表のとおり。`combat: true`、`sprites` は ally07 と同じ形で `frame: 32`）:

| id | name | role | maxHp | power | guard | resist | attack | range | attackInterval | speed | 追加 | skillId | role の絵 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| ally09 | バルド | 斧 | 30 | 10 | 4 | 1 | melee | 24 | 2.6 | 50 | `ignoresGuard: true` | tatakiwari | role-ono |
| ally10 | シオン | 守護 | 26 | 5 | 2 | 10 | melee | 24 | 1.8 | 55 | — | kekkai | role-shugo |
| ally11 | ピコ | 飛行 | 20 | 7 | 2 | 6 | melee | 28 | 1.5 | 95 | `flying: true` | kyuukouka | role-hikou |
| ally12 | ユナ | 弓 | 20 | 8 | 2 | 3 | bow | 160 | 2.2 | 60 | — | neraiuchi | role-yumi |
| ally13 | オルト | 斧 | 28 | 9 | 4 | 1 | melee | 24 | 2.6 | 50 | `ignoresGuard: true` | tatakiwari | role-ono |
| ally14 | ガンツ | 盾 | 34 | 5 | 6 | 2 | melee | 24 | 1.6 | 55 | — | funbaru | role-tate |
| ally15 | ミラ | 槍 | 24 | 7 | 3 | 2 | melee | 36 | 1.7 | 60 | — | tsuki | role-yari |

加わる時期（各ステージの `joins` に足す。`talk` は stage2 の ally05 と同じ 3 行の形で、文は実装する人が書く）:

| stage | unitId | level |
|---|---|---|
| stage5 | ally09 | 3 |
| stage6 | ally12 | 4 |
| stage7 | ally10 | 4 |
| stage8 | ally11 | 5 |
| stage8 | ally13 | 5 |
| stage9 | ally14 | 6 |
| stage10 | ally15 | 7 |

- [ ] **Step 1: 失敗するテストを書く**

`registry.test.ts`: 実際の assets を読み、units が 15 人、上の表の各 stage の `joins` に該当の unitId と level がある、ally09・ally13 は `ignoresGuard`、ally11 は `flying`。

- [ ] **Step 2: テストが落ちることを確かめる**

Run: `npx vitest run src/engine/registry.test.ts`
Expected: FAIL

- [ ] **Step 3: 定義・台詞・joins を書き、仮の絵を書き出す**

Run: `node tools/gen-placeholder-sprites.mjs ally09 ally10 ally11 ally12 ally13 ally14 ally15 role-ono role-shugo role-hikou`
Expected: 10 行の書き出しの表示。`git status` で既存の PNG が変わっていないこと

- [ ] **Step 4: テストを通す**

Run: `npm test`
Expected: PASS

- [ ] **Step 5: コミット**

```bash
git add assets tools/gen-placeholder-sprites.mjs src
git commit -m "feat: 新しい仲間 7 人を仮の絵で足す"
```

### Task 7: 確かめと記録

**Files:**
- Create: `docs/superpowers/specs/2026-11-15-counter-allies-results.md`
- Modify: `README.md`（ユニット定義の `resist`・`ignoresGuard`・`flying`、技 3 つ、仲間 15 人・場 8 人）・`CLAUDE.md`（変わった制約があれば）・`HANDOVER.md`（`## 進捗` と残課題: 7 人の本番の絵、出撃しない仲間がいること）

- [ ] **Step 1: 型チェックとビルド**

Run: `npm run build`
Expected: エラーなしで終わる

- [ ] **Step 2: 勝率を測る**

Run: `npm run balance`
Expected: 全ステージが最後まで動き、表が出る。表を結果の文書に貼る（前回 `2026-11-12-stage-tiles-results.md` との差も並べる）。Task 1 で落ちた勝率のテストがあれば、測った値に合わせて更新し、結果の文書にどれを変えたかを書く

- [ ] **Step 3: ブラウザで確かめる**

README の CDP の手順で、ステージ 5〜10 の開始時に 7 人が加わる会話が出ること、ピコが stage8 の柵（`P`）や家（`H`・`w`）を越えて飛ぶこと・影が出ること、急降下の線が出ることを撮って確かめる。撮った絵は結果の文書に書いたパスに置く（コミットしない）

- [ ] **Step 4: 正典を直してコミット**

```bash
git add README.md CLAUDE.md HANDOVER.md docs/superpowers/specs/2026-11-15-counter-allies-results.md src
git commit -m "docs: 対抗手段の結果と正典を更新する"
```
