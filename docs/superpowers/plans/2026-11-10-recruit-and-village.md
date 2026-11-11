# 仲間が増えるイベントと村の訪問 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 新しい仲間 4 人（仮の絵）を、開始時・説得・村の 3 通りで加え、村の訪問で 6 種類のことが起き、戦闘中の下の段に 8 人が並ぶようにする。

**Architecture:** ステージの JSON に `joins`（開始時の加入）・`persuasions`（説得の相手）・`villages`（村）を足し、`src/engine/schema.ts` で検証、`src/engine/registry.ts` で相互参照を見る。戦闘中の判定は新しい `src/core/events.ts` に置き、`step()` から呼ぶ。加わる会話の間は `BattleState.pendingRecruit` が立ってシムが止まり、`src/main.ts` の新しいフェーズ `event` が会話を出す。加入・一度きりのごほうび・能力値はクリアしたときだけ `applyStageClear` がセーブへ書く。

**Tech Stack:** TypeScript、Vite、Vitest、Canvas2D（描画にはユニットテストを書かない。README の CDP 手順で目で確かめる）

**Spec:** `docs/superpowers/specs/2026-11-10-recruit-and-village-design.md`

## Global Constraints

- 仲間は最大 8 人（`MAX_PARTY = 8`）
- 新しい 4 人の ID は `ally05`〜`ally08`、説得の相手の敵の ID は `ally06-foe`・`ally08-foe`。ID を使う場所（JSON のファイル名、`assets/images/` の名前、セリフのキー、セーブのキー）に名前を入れない。名前が入るのはユニットの JSON の `name` と本文だけ
- 本文で仲間の名前を書くときは `{<ユニットID>}` と書き、読み込み時に名前へ置き換える（新しい 4 人では必ず使う。今の 4 人には使ってもよい）
- 今の 4 人（`roran` `ines` `mist` `gau`）の ID・ファイルは変えない
- 戦闘中に加わった仲間・村の経験値・能力値・一度きりのごほうびの印は、クリアしたときだけセーブに残る。負けたら残らない
- 説得の相手は普通の敵と同じに扱う（仲間は攻撃し、相手も攻撃する）。決められた仲間が 2 マス（64px）以内に入ったときだけ説得が始まる
- 加わる会話の間は戦闘を止める。それ以外の村（会話だけ・回復・攻撃力・経験値・能力値）は止めず、セリフ欄に出す
- 回復は仲間全員、攻撃力アップ・経験値・能力値は訪れた 1 人。攻撃力アップはそのステージの間だけ。能力値はその後も残る
- ゲーム内の文字は漢字仮名交じり（CLAUDE.md）。検証のエラー文は既存に合わせてひらがな中心でよい
- コミットは Conventional Commits ＋日本語の要約
- `node tools/gen-placeholder-sprites.mjs` を引数なしで動かさない（今の本番の絵 `roran-map.png` などを仮の絵で上書きしてしまう）

## Review Focus

1. **加わった直後の仲間がすぐ倒れる・すぐ勝つ**: 加入と同じ tick に勝敗が決まっても、加入の会話を出してから勝利・敗北へ進む → Task 8 のテスト `勝利の条件を満たしても、加入の会話が先に出る`
2. **説得の相手を倒した tick に説得の距離に入った**: 倒れた相手は説得されない → Task 8 のテスト `倒れた相手は説得されない`
3. **同じ村に複数の仲間が同時に着いた**: 訪れた人は 1 人（`state.units` の並びで先の人）、効果は 1 回 → Task 7 のテスト `2 人が同時に着いても効果は 1 回`
4. **8 人を超える**: セーブに仲間が多く入っていても（古いデータ・手で書いたデータ）出撃は 8 人まで、開始時の加入は 8 人を超えるなら加えない → Task 6 のテスト `出撃は 8 人まで`
5. **レベルが上がったときに能力値の上乗せが消える**: 村で上げた HP・攻撃・守り・速さは、戦闘中のレベルアップでも残る → Task 2 のテスト `レベルアップしても上乗せが残る`

---

## File Structure

| ファイル | 役割 |
|---|---|
| `src/core/names.ts`（新） | `{id}` を名前に置き換える |
| `src/core/party.ts`（新） | 加入しうる仲間の一覧・今の仲間の一覧 |
| `src/core/events.ts`（新） | 村の訪問・説得の判定と、加入の実行 |
| `src/core/skills.ts` | 新しい必殺技 4 つ |
| `src/core/state.ts` | 能力値の上乗せ・出撃メンバー・開始位置 |
| `src/core/types.ts` | `Unit`・`BattleState`・`CharProgress`・`SimEvent` の追加 |
| `src/core/sim.ts` | `pendingRecruit` で止める・events の呼び出し・攻撃力の足し算・引きつける |
| `src/core/dialogue.ts` | 村のセリフ |
| `src/engine/schema.ts`・`registry.ts` | 新しいステージの項目の検証・相互参照・名前の置き換え |
| `src/save/save.ts` | `members`・`claimed`・`bonus` |
| `src/ui/flow.ts` | クリア時の書き戻し |
| `src/ui/layout.ts`・`screens.ts`・`src/render/draw.ts`・`src/main.ts` | 1 段×8・2 列の一覧・村の暗さ・説得の目印・`event` フェーズ |
| `tools/gen-placeholder-sprites.mjs` | 引数で作るものを絞る・槍と旗 |
| `assets/` | 新しい仲間・敵・必殺技・セリフ・ステージ |

---

### Task 1: 本文の `{id}` を名前に置き換える

**Files:**
- Create: `src/core/names.ts`、`src/core/names.test.ts`
- Modify: `src/engine/registry.ts`（`buildRegistry` の最後）、`src/engine/registry.test.ts`

**Interfaces:**
- Produces: `fillNames(text: string, nameOf: (id: string) => string | null): { text: string; unknown: string[] }`
- Produces: `buildRegistry` は、検証が通ったあと、`reg.lines` の値・各ステージの `intro`/`outro` の `text`・敵の `name` の `{id}` を、`reg.units`（なければ `reg.enemies`）の `name` に置き換えた状態で返す。知らない ID があればエラー `しらない なまえの id: <id>`。Task 5 で足す `joins`/`persuasions`/`villages` の本文も、Task 5 がここに足す

- [ ] **Step 1: 失敗するテストを書く**（`src/core/names.test.ts`）

```ts
const nameOf = (id: string) => ({ ally06: 'セラ', mist: 'ミスト' } as Record<string, string>)[id] ?? null;
it('{id} を名前にする', () => {
  expect(fillNames('{ally06}と {mist}', nameOf)).toEqual({ text: 'セラと ミスト', unknown: [] });
});
it('知らない id はそのまま残し unknown に入れる', () => {
  expect(fillNames('{nobody}だ', nameOf)).toEqual({ text: '{nobody}だ', unknown: ['nobody'] });
});
it('波かっこが無ければ変えない', () => {
  expect(fillNames('ふつうの 文', nameOf).text).toBe('ふつうの 文');
});
```

`registry.test.ts` に、`assets/lines` 相当の入力に `"x": "{roran}が 来た"` を入れて `reg.lines.get('x') === 'ロランが 来た'`、`"{nobody}"` でエラー `しらない なまえの id: nobody` になるテストを足す（既存のテストの入力の組み方に合わせる）。

- [ ] **Step 2: `npx vitest run src/core/names.test.ts src/engine/registry.test.ts` で落ちることを確かめる**
- [ ] **Step 3: `fillNames` を実装し、`buildRegistry` の相互参照の後で置き換える**（ID に使える文字は `[A-Za-z0-9_-]`。正規表現 `/\{([A-Za-z0-9_-]+)\}/g`）
- [ ] **Step 4: `npm test` が通ることを確かめる**
- [ ] **Step 5: コミット** `feat: 本文の {id} を仲間の名前に置き換える`

---

### Task 2: 能力値の上乗せとステージ中だけの強化

**Files:**
- Modify: `src/core/types.ts`、`src/core/state.ts`、`src/core/growth.ts`、`src/core/progress.ts`、`src/core/sim.ts:349-352`
- Modify: `src/save/save.ts`
- Test: `src/core/state.test.ts`、`src/core/growth.test.ts`、`src/core/progress.test.ts`、`src/save/save.test.ts`、`src/core/sim-combat.test.ts`

**Interfaces:**
- Produces（`types.ts`）:
  - `export type StatKey = 'maxHp' | 'power' | 'guard' | 'speed'`
  - `export type StatBonus = Record<StatKey, number>`、`export const NO_BONUS: StatBonus`（全部 0）
  - `CharProgress = { level: number; xp: number; bonus?: StatBonus }`
  - `Unit` に `statBonus: StatBonus`（その後も残る上乗せ）、`stagePower: number`（攻撃力アップの村。ステージの間だけ）、`cheerUntil: number`・`cheerPower: number`（はげます）、`tauntUntil: number`（引きつける）、`persuasion: number | null`（説得の相手なら `stage.persuasions` の添字）を足す。初期値は `NO_BONUS` の写し・0・-1・0・-1・null
- Produces（`state.ts`）: `statsForLevel(def, level, growth, bonus: StatBonus = NO_BONUS): { maxHp: number; power: number; guard: number; speed: number }`。`makeUnit` は `progress.bonus` を `statBonus` に入れ、4 つの値をここから取る
- Produces（`sim.ts`）: `attackPower(u: Unit, time: number): number` = `u.power + u.stagePower + (time < u.cheerUntil ? u.cheerPower : 0)`。`HitSource.power` にこれを入れる
- Produces（`save.ts`）: `SaveData` に `members: string[]`（後から加わった仲間の ID。加わった順）、`claimed: string[]`（受け取った一度きりのごほうびの印）。`SAVE_VERSION` は 2 のまま（フィールドを足すだけ。既存の `readIntroStageIds` と同じ扱い）。`reconcile` は `bonus` の 4 つが 0 以上の整数のときだけ読み、ほかは捨てる。`members` は `reg.units` にある ID だけ、重複を除く。`claimed` は文字列だけ

- [ ] **Step 1: 失敗するテストを書く**
  - `state.test.ts` `上乗せが能力値に入る`: `statsForLevel(def, 1, growth, { maxHp: 3, power: 1, guard: 2, speed: 5 })` が `def.maxHp + 3` など
  - `growth.test.ts` `レベルアップしても上乗せが残る`: `unit.statBonus = { maxHp: 3, power: 1, guard: 2, speed: 0 }` にして能力値も合わせ、`awardXp` でレベルを 1 上げたあと `unit.maxHp === statsForLevel(def, 2, growth, unit.statBonus).maxHp`、`unit.guard === def.guard + 2`
  - `progress.test.ts` `applyXp は bonus を残す`: `applyXp({ level: 1, xp: 0, bonus }, 100, growth).bonus` が `bonus` と等しい
  - `sim-combat.test.ts` `攻撃力アップとはげますがダメージに乗る`: `stagePower = 2` の味方の一撃が、`stagePower = 0` のときより 2 多い（`instantAttacks` を使い、`guard` の差が出ない相手で）。`cheerUntil` を過ぎたら乗らない
  - `save.test.ts`: `members`・`claimed`・`bonus` が往復する／壊れた `bonus`（負の数・小数）は捨てる／`members` の知らない ID は捨てる／フィールドの無い古いセーブは `[]` になる
- [ ] **Step 2: `npm test` で落ちることを確かめる**
- [ ] **Step 3: 実装する**（`awardXp` はレベルアップ時に `statsForLevel(def, level, growth, unit.statBonus)` の 4 つを入れ直す。`applyXp` は `{ ...p, level, xp }` を返す）
- [ ] **Step 4: `npm test` が通ることを確かめる**
- [ ] **Step 5: コミット** `feat: 能力値の上乗せとステージ中だけの攻撃力を持てるようにする`

---

### Task 3: 新しい必殺技 4 つ

**Files:**
- Modify: `src/core/skills.ts`、`src/core/sim.ts`（`updateAi` の後）、`assets/skills.json`
- Test: `src/core/skills.test.ts`、`src/core/sim.test.ts`

**Interfaces:**
- Consumes: Task 2 の `Unit.cheerUntil`・`cheerPower`・`tauntUntil`
- Produces（`assets/skills.json` に足す）:
  - `{ "id": "hikitsukeru", "label": "引きつける", "params": { "range": 96, "duration": 6, "cooldown": 16 } }`
  - `{ "id": "hinoame", "label": "火の雨", "params": { "radius": 48, "damage": 6, "needsDest": 1, "cooldown": 14 } }`
  - `{ "id": "tsuki", "label": "突き", "params": { "length": 80, "damage": 7, "cooldown": 9 } }`
  - `{ "id": "hagemasu", "label": "はげます", "params": { "range": 120, "power": 2, "duration": 8, "cooldown": 15 } }`
- Produces（`skills.ts`）: `skillHit(state, self, enemy, damage, fromPos): void`（`kakenukeru` の 1 体ぶんの処理を切り出したもの。`kakenukeru` もこれを使う）
- 効果:
  - `hikitsukeru`: `self.tauntUntil = time + duration`。戻り値は `range` 以内の敵の数
  - `hinoame`: `dest` が無ければ `null`。`dest` から `radius` 以内の敵すべてに `damage`。戻り値は当てた数
  - `tsuki`: 向きは交戦中の相手、いなければ `length` 以内で最寄りの敵へ。どちらもいなければ `null`。`self.pos` から向きに `length` の線分から `MELEE_RANGE / 2` 以内の敵すべてに `damage`
  - `hagemasu`: `range` 以内の生きている味方（自分を含む）に `cheerUntil = time + duration`、`cheerPower = power`（重ねがけせず上書き）。戻り値は人数
- Produces（`sim.ts`）: `updateAi` の後に `applyTaunts(state)`。敵 AI ごとに、`tauntUntil > time` で `hikitsukeru` の `range` 以内にいる最寄りの味方がいれば、`ai.mode = 'chase'`・`targetUid`・`goalPos` をその味方にする

- [ ] **Step 1: 失敗するテストを書く**（`skills.test.ts`。既存のテストと同じく、実ステージから `createBattleState` して味方の `skillId` を差し替え、`useSkill` を呼ぶ）
  - `火の雨は半径の内側の敵だけに当たる`（48px 以内の 2 体に 6 ずつ、60px の 1 体は無傷）／`火の雨は行き先が無いと出ない`
  - `突きは前の一直線の敵に当たる`（向きの線上 40px と 75px の 2 体に当たり、横に 30px ずれた 1 体には当たらない）／`突きは相手がいないと出ない`
  - `はげますは範囲の味方の攻撃力を上げ、時間で切れる`（`attackPower` が `+2`、`duration` 後は元どおり）
  - `sim.test.ts` `引きつけている味方を、範囲の敵が追う`（より近い別の味方がいても、`tauntUntil` 中は引きつけた味方を `targetUid` にする。切れたら元の選び方に戻る）
- [ ] **Step 2: `npm test` で落ちることを確かめる**
- [ ] **Step 3: 実装し、`assets/skills.json` に 4 つを足す**
- [ ] **Step 4: `npm test` が通ることを確かめる**
- [ ] **Step 5: コミット** `feat: 引きつける・火の雨・突き・はげますを足す`

---

### Task 4: 新しい仲間 4 人と説得の相手の定義・仮の絵

**Files:**
- Create: `assets/units/ally05.json`〜`ally08.json`、`assets/enemies/ally06-foe.json`・`ally08-foe.json`、`assets/lines/allies.json`
- Create（生成）: `assets/images/ally05-map.png`〜`ally08-map.png`、`ally05-face.png`〜`ally08-face.png`、`role-yari.png`、`role-ouen.png`
- Modify: `tools/gen-placeholder-sprites.mjs`

**Interfaces:**
- Produces（ユニット。`sprites` は `{ "role": <下>, "face": "<id>-face.png", "map": { "sheet": "<id>-map.png", "frame": 32, "idle": { "frames": 2, "fps": 4 }, "walk": { "frames": 4, "fps": 8 }, "attack": { "frames": 3, "fps": 6 } } }`、`combat: true`）:

| id | name | role | maxHp | power | guard | attack | range | attackInterval | speed | skillId | color | role の絵 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| ally05 | ボルグ | 盾 | 36 | 5 | 6 | melee | 24 | 1.8 | 45 | hikitsukeru | #7a8a9a | role-tate.png |
| ally06 | セラ | 魔法 | 18 | 8 | 1 | magic | 140 | 2.6 | 55 | hinoame | #8a5ac8 | role-mahou.png |
| ally07 | リュカ | 槍 | 24 | 7 | 3 | melee | 36 | 1.7 | 60 | tsuki | #c85a5a | role-yari.png |
| ally08 | ノエル | 応援 | 20 | 4 | 2 | melee | 24 | 1.6 | 65 | hagemasu | #5ab0b8 | role-ouen.png |

- Produces（説得の相手の敵。`name` は `{ally06}`・`{ally08}`、`role: "敵"`、`xpReward: 0`、`bowDamageCap: null`、`fleeAtHpRatio: null`、`skillId: null`、絵は仲間と同じ `ally06-face.png`・`ally06-map.png` などを指し、role の絵は `role-teki-mahou.png`・`role-teki.png`）:
  - `ally06-foe`: maxHp 16、power 6、guard 1、magic、range 140、attackInterval 2.6、speed 24、color #8a5ac8
  - `ally08-foe`: maxHp 18、power 4、guard 2、melee、range 24、attackInterval 1.6、speed 34、color #5ab0b8
- Produces（`assets/lines/allies.json`）: 4 人それぞれの `skill:<id>`・`levelup:<id>`・`pinch:<id>`・`retire:<id>`。本文で自分や仲間の名前を出すときは `{id}` を使う。例 `"skill:ally05": "こっちだ！\n俺が 相手だ！"`
- Produces（生成器）: 引数に ID を並べると、その ID の絵だけを書く。引数が無ければ何も書かずに使い方を出して 1 で終わる（全部を書き直す使い方をやめる。今の本番の絵を上書きしないため）。`WEAPON` に `spear`（w 0.06, h 0.40, STEEL）と `flag`（w 0.18, h 0.22, [220, 200, 90]）、`CHARS` に 4 人（武器 shield / staff / spear / flag）、`ROLES` に `['role-yari', 'spear', '#c85a5a']`・`['role-ouen', 'flag', '#5ab0b8']`

- [ ] **Step 1: 生成器を直し、`node tools/gen-placeholder-sprites.mjs` が何も書かずに 1 で終わることを確かめる**
- [ ] **Step 2: `node tools/gen-placeholder-sprites.mjs ally05 ally06 ally07 ally08 role-yari role-ouen` を動かし、`git status --short assets/images` に新しい 10 ファイルだけが出ることを確かめる**（既存の PNG が変わっていたら `git checkout -- assets/images` で戻してやり直す）
- [ ] **Step 3: JSON を書く**
- [ ] **Step 4: `npm test` が通ることを確かめる**（`sheet-size.test.ts` がシートの実寸を、`registry` が絵と必殺技の参照を見る）
- [ ] **Step 5: コミット** `feat: 新しい仲間 4 人と説得の相手を仮の絵で足す`

この時点では、新しい 4 人がステージ選択の一覧に出てしまう。Task 6・10 で直す。

---

### Task 5: ステージの `joins`・`persuasions`・`villages` の検証

**Files:**
- Modify: `src/engine/schema.ts`、`src/engine/registry.ts`
- Create: `src/core/party.ts`、`src/core/party.test.ts`
- Modify: `src/core/constants.ts`（`MAX_PARTY = 8`、`PERSUADE_RANGE = 64`、`VISIT_MARGIN = 10`）
- Test: `src/engine/schema.test.ts`、`src/engine/registry.test.ts`

**Interfaces:**
- Produces（`schema.ts`）:

```ts
export type RecruitDef = { unitId: string; level: number; talk: IntroLine[] };
export type PersuasionDef = RecruitDef & { foeId: string; pos: Vec2; ai: AiDef; persuader: string };
export type VillageEffect =
  | { type: 'talk' } | { type: 'heal' }
  | { type: 'powerUp'; amount: number } | { type: 'xp'; amount: number }
  | { type: 'stat'; stat: StatKey; amount: number }
  | { type: 'recruit'; recruit: RecruitDef };
export type VillageDef = { id: string; col: number; row: number; text: string | null; effect: VillageEffect };
// StageDef に joins: RecruitDef[]、persuasions: PersuasionDef[]、villages: VillageDef[] を足す（省略時 []）
```

  JSON の形: `"joins": [{ "unitId": "ally05", "level": 2, "talk": [<intro と同じ行>] }]`、`"persuasions": [{ "unitId": ..., "level": ..., "talk": [...], "foeId": "ally06-foe", "pos": {...}, "ai": {...}, "persuader": "mist" }]`、`"villages": [{ "id": "v1", "col": 3, "row": 8, "text": "…", "effect": { "type": "heal" } }]`（`recruit` の村は `"effect": { "type": "recruit", "unitId": ..., "level": ..., "talk": [...] }` で、`text` は書かない）

- 検証（`schema.ts`。エラー文は既存に合わせる）:
  - `level` は 1 以上の整数、`amount` は 1 以上の整数、`stat` は 4 つのどれか、`effect.type` は 6 つのどれか
  - `recruit` 以外の村は `text` が必須、`recruit` の村は `text` を書かない
  - 村の `col`・`row` はマップの内側で、そのマスの文字が `walkable: false` であること（`村は とおれない マスに おく`）。同じステージで `id` の重複・同じマスの重複は不可
  - `persuasions[].pos` は敵と同じく、足元が通れること・`placement.minY` より上
- 相互参照（`registry.ts`）:
  - `unitId` は `reg.units` にあり、どのステージの `roster` にも無く、全ステージを通して 1 か所でしか加わらない
  - `foeId` は `reg.enemies`、`persuader` は `reg.units` にある
  - `talk` の `speaker`・`lineId` は intro と同じ検査。`text` と村の `text` は Task 1 の名前の置き換えの対象に足す
  - `roster` に入る仲間の数（全ステージの `roster` の和集合）＋加入しうる仲間の数が `MAX_PARTY` 以下
- Produces（`party.ts`）:
  - `recruitUnitIds(reg: Registry): Set<string>`（全ステージの joins・persuasions・recruit の村の `unitId`）
  - `partyIds(reg: Registry, members: readonly string[]): string[]`（`reg.units` の並びのうち加入しうる仲間でないもの、続けて `members` のうち `reg.units` にあるものを並び順のまま。重複を除き、`MAX_PARTY` で切る）

- [ ] **Step 1: 失敗するテストを書く**
  - `schema.test.ts`: 正しい 3 項目が読める／省略すると `[]`／歩けるマスに村を置くとエラー／`recruit` の村に `text` を書くとエラー／`stat` の `stat` が `luck` だとエラー／`persuasions` の `pos` が線より下だとエラー
  - `registry.test.ts`: 同じ `unitId` を 2 か所で加えるとエラー／`roster` にいる仲間を加えるとエラー／知らない `foeId`・`persuader` がエラー／村の `text` の `{id}` が名前になる
  - `party.test.ts` `加入しうる仲間は一覧から外れ、加わった順に後ろへ並ぶ`・`8 人で切る`
- [ ] **Step 2: `npm test` で落ちることを確かめる**
- [ ] **Step 3: 実装する**
- [ ] **Step 4: `npm test` が通ることを確かめる**
- [ ] **Step 5: コミット** `feat: ステージに開始時の加入・説得・村を書けるようにする`

---

### Task 6: 出撃メンバー・開始位置・クリア時の書き戻し

**Files:**
- Modify: `src/core/state.ts`、`src/core/types.ts`、`src/ui/flow.ts`、`src/main.ts:168`
- Test: `src/core/state.test.ts`、`src/ui/flow.test.ts`

**Interfaces:**
- Consumes: Task 2 の `SaveData`・`CharProgress.bonus`、Task 5 の `StageDef` の 3 項目・`partyIds`・`MAX_PARTY`
- Produces（`types.ts`）: `export type PartyProgress = { units: Record<string, CharProgress>; members: string[]; claimed: string[] }`（`SaveData` はこれを満たす）。`BattleState` に `joined: string[]`（このステージで加わった ID）、`claimed: string[]`（このステージで受け取った印）、`visited: string[]`（訪れた村の id）、`pendingRecruit: PendingRecruit | null`、`nextPlayerUid: number`、`claimedBefore: ReadonlySet<string>`（開始時点のセーブの `claimed`）。`export type PendingRecruit = { recruit: RecruitDef; pos: Vec2; foeUid: string | null }`
- Produces（`state.ts`）:
  - `createBattleState(reg, stage, party: PartyProgress, seed)`（第 3 引数を変える。呼び出しは `main.ts` とテスト）
  - 味方の並び: `stage.roster`、続けて `partyIds(reg, party.members)` のうち `roster` に無いもの、続けて `stage.joins` のうち `members` に無いもの（`level` は `join.level`、`xp` 0、`bonus` なし）。合わせて `MAX_PARTY` で切る。`joins` で入れた ID は `joined` に入れる
  - 説得の相手: `stage.persuasions` のうち `unitId` が `members` に無いものだけ、`foeId` の敵を `pos`・`ai` で置き、`persuasion` に添字を入れる
  - `startPositions(stage: StageDef, grid: Grid, count: number): Vec2[]`。先頭から `placement.starts` を使い、足りない分は、`y >= placement.minY` で `fitsAt` が真のマスの中心を `starts[0]` に近い順に見て、すでに選んだ位置から 32px 以上離れたものを足す。足りなければ `starts` を繰り返す
- Produces（`flow.ts`）: `applyStageClear` が、`battle.joined` を `members` の後ろへ（重複なし）、`battle.claimed` を `claimed` へ足し、各味方の進行に `bonus: u.statBonus` を入れる。`XpGain` に `joined: boolean` を足し、`battle.joined` にいる仲間は `true`（リザルトで「仲間に 加わった！」と出すため）

- [ ] **Step 1: 失敗するテストを書く**（実ステージを `{ ...reg.stages[0], joins: [...], persuasions: [...] }` に広げて使う）
  - `state.test.ts`: `加わった仲間が roster の後ろに並ぶ`／`開始時の加入は加入済みなら入らない`／`出撃は 8 人まで`（`members` に 6 人入れても 8 人）／`加入済みの説得の相手は出てこない`／`開始位置が重ならない`（8 人の位置がどの 2 つも 24px 以上離れ、すべて `canPlaceAt`）
  - `flow.test.ts`: `クリアで加入と印と上乗せが残る`／`2 回クリアしても members が重ならない`
- [ ] **Step 2: `npm test` で落ちることを確かめる**
- [ ] **Step 3: 実装し、`main.ts` の `createBattleState(registry, stage, save, seed)` に直す**
- [ ] **Step 4: `npm test` と `npm run build` が通ることを確かめる**
- [ ] **Step 5: コミット** `feat: 加わった仲間を出撃させ、クリアしたときに残す`

---

### Task 7: 村の訪問

**Files:**
- Create: `src/core/events.ts`、`src/core/events.test.ts`
- Modify: `src/core/sim.ts`（`step`）、`src/core/types.ts`（`SimEvent`）、`src/core/dialogue.ts`
- Test: `src/core/dialogue.test.ts`

**Interfaces:**
- Consumes: Task 2 の `stagePower`・`statBonus`・`awardXp`、Task 6 の `visited`・`claimed`・`claimedBefore`・`pendingRecruit`
- Produces（`types.ts`）: `SimEvent` に `{ type: 'villageVisited'; uid: string; defId: string; villageId: string; text: string }`
- Produces（`events.ts`）:
  - `isVisiting(cell: number, pos: Vec2, v: VillageDef): boolean`（村のマスの四角を `VISIT_MARGIN` 広げた中に `pos` があるか）
  - `rewardKey(stageId: string, villageId: string): string` = `` `${stageId}/${villageId}` ``
  - `updateVillages(state: BattleState): void`。生きている味方を `state.units` の順に見て、まだ訪れていない村に着いたら、`visited` に入れて効果を出す（1 つの村に 1 人）:
    - `talk`: 何もしない
    - `heal`: 生きている味方全員の `hp = maxHp`
    - `powerUp`: 訪れた人の `stagePower += amount`
    - `xp`: 印が `claimedBefore` にも `claimed` にも無ければ `awardXp(state, u, amount)` して `claimed` に入れる
    - `stat`: 同じく印が無ければ `statBonus[stat] += amount` と能力値（`maxHp` なら `hp` も）を上げ、`claimed` に入れる
    - `recruit`: `unitId` が出撃中でも加入済みでもなければ、`pendingRecruit = { recruit, pos: <訪れた人の隣>, foeUid: null }`。隣は `resolveMoveDest(grid, u.pos, { x: u.pos.x + 24, y: u.pos.y })`、`null` なら `u.pos`
    - `recruit` 以外は `villageVisited` を出す。`text` は村の `text`。ただし `xp`・`stat` で印がすでにあったとき、`recruit` で加入済みのときは `VILLAGE_DONE_TEXT = '村の 人が 手を ふっている'`（`recruit` のときもこの文で `villageVisited` を出す）
- Produces（`sim.ts`）: `step` の先頭（`state.events = []` の直後）で `if (state.pendingRecruit !== null) return;`。`resolveRemoval` の後に `updateVillages(state)`
- Produces（`dialogue.ts`）: `PRIORITY` の先頭に `'village'`。`villageVisited` は `{ uid, speaker: ally(defId), lineId: 'village:' + villageId, text }`

- [ ] **Step 1: 失敗するテストを書く**（`events.test.ts`。`legend` に `V`（通れない）を足し、`mapRows` の 1 マスを `V` にした実ステージの写しを使う）
  - `村の隣に着くと訪れる`・`離れていると訪れない`
  - `回復は全員に効く`／`攻撃力アップは訪れた人だけ`
  - `経験値は一度きり`（1 回目は `xp` が増え `claimed` に印、`claimedBefore` に印があると増えず、文が `VILLAGE_DONE_TEXT`）
  - `能力値の村で守りが上がり statBonus に残る`
  - `2 人が同時に着いても効果は 1 回`
  - `仲間の村は pendingRecruit を立て、シムが止まる`（次の `step` で `time` が進まない）
  - `dialogue.test.ts` `村のセリフは一番先に出る`
- [ ] **Step 2: `npm test` で落ちることを確かめる**
- [ ] **Step 3: 実装する**
- [ ] **Step 4: `npm test` が通ることを確かめる**
- [ ] **Step 5: コミット** `feat: 村を訪れると回復・攻撃力・経験値・能力値・会話が起きる`

---

### Task 8: 説得と加入の実行

**Files:**
- Modify: `src/core/events.ts`、`src/core/sim.ts`
- Test: `src/core/events.test.ts`

**Interfaces:**
- Consumes: Task 6 の `PendingRecruit`・`nextPlayerUid`・`joined`、Task 7 の `step` の止め方
- Produces（`events.ts`）:
  - `updatePersuasions(state: BattleState): void`。`persuasion !== null` で生きている（`!retired && hp > 0`）敵ごとに、`defId === persuasion.persuader` の生きている味方が `PERSUADE_RANGE` 以内にいれば `pendingRecruit = { recruit: <その説得>, pos: 敵の位置, foeUid: 敵の uid }`。1 tick に 1 つまで。`pendingRecruit` がすでにあれば何もしない
  - `completeRecruit(state: BattleState): Unit | null`。`pendingRecruit` を消し、`foeUid` があればその敵を `retired = true`（`unitDefeated` も経験値も出さない。交戦の解除は `resolveRemoval` と同じ後始末）、`p${nextPlayerUid++}` の味方を `pos`・`recruit.level`・体力満タンで `state.units` に足し、`joined` に入れて返す。すでに `MAX_PARTY` 人いれば足さずに `null`
- Produces（`sim.ts`）: `updatePersuasions` は `resolveRemoval` の後・`updateVillages` の前。`updateObjectives` は `pendingRecruit` が立った tick には呼ばない（勝敗は加入の会話の後の tick で決める）

- [ ] **Step 1: 失敗するテストを書く**
  - `決められた仲間が 64px 以内に入ると説得が始まる`／`ほかの仲間では始まらない`
  - `倒れた相手は説得されない`（同じ tick に `hp` が 0 になった相手）
  - `加入すると敵が消え、同じ位置に味方が現れる`（`unitDefeated` が出ず、経験値も入らない。`joined` に入る）
  - `勝利の条件を満たしても、加入の会話が先に出る`（`victory` の位置に味方を置いたまま説得が始まった tick では `phase === 'battle'`、`completeRecruit` 後の `step` で `victory`）
- [ ] **Step 2: `npm test` で落ちることを確かめる**
- [ ] **Step 3: 実装する**
- [ ] **Step 4: `npm test` が通ることを確かめる**
- [ ] **Step 5: コミット** `feat: 決められた仲間が近づくと敵を説得して仲間にする`

---

### Task 9: 加入の会話の画面・村の暗さ・説得の目印

**Files:**
- Modify: `src/main.ts`、`src/core/dialogue.ts`、`src/render/draw.ts`、`src/ui/screens.ts`（`drawResult` の「仲間に 加わった！」）
- Test: `src/core/dialogue.test.ts`

**Interfaces:**
- Consumes: Task 6〜8
- Produces（`dialogue.ts`）: `pickRecruitTalk(reg: Registry, recruit: RecruitDef): TalkLine[]`（`pickTalk` を通す）。`pickStageIntro(reg, stage, members: readonly string[])` は、`stage.intro` の後に、`members` に無い `stage.joins` の `talk` を続ける
- Produces（`main.ts`）:
  - `Phase` に `'event'`。`update` の `step` のループで `battle.pendingRecruit` が立ったらループを抜け、`talk = makeTalkState(pickRecruitTalk(...))`、`phase = 'event'`（行が無ければすぐ `completeRecruit`）。`event` 中のタップは `advanceTalk`、終わったら `completeRecruit(battle)` して `phase = 'battle'`。「飛ばす」は出さない
  - `render` の `event` は `drawBattle` ＋ `drawTalk(..., false, images)`
- Produces（`draw.ts`）: 訪れた村のマスに `rgba(0, 0, 0, 0.45)` を重ねる。`persuasion !== null` の敵の頭の上（絵の上端の 4px 上）に、黄色（`#ffd479`）の吹き出し（12×10px、中に黒い点 3 つ）を出す
- Produces（`screens.ts`）: `drawResult` で `joined` の仲間は Lv の行の代わりに `仲間に 加わった！`（色 `#ffd479`）

- [ ] **Step 1: 失敗するテストを書く**（`dialogue.test.ts`: `開始時の加入の会話が intro の後に続く`／`加入済みなら続かない`／`加入の会話の {id} が名前になっている`）
- [ ] **Step 2: `npm test` で落ちることを確かめる**
- [ ] **Step 3: 実装する**
- [ ] **Step 4: `npm test` と `npm run build` が通ることを確かめる**
- [ ] **Step 5: コミット** `feat: 加わる会話の間は戦闘を止め、訪れた村と説得の相手を見分けられるようにする`

---

### Task 10: 下の段を 1 段×8 にし、一覧を 2 列にする

**Files:**
- Modify: `src/ui/layout.ts`、`src/ui/screens.ts`、`src/main.ts:280-295`
- Test: `src/ui/layout.test.ts`

**Interfaces:**
- Consumes: Task 5 の `MAX_PARTY`・`partyIds`、Task 6 の `XpGain.joined`
- Produces（`layout.ts`）:
  - `portraitSlot(i) = { x: 4 + i * 66, y: 858, w: 64, h: 80 }`
  - `roleBadgeIn(slot) = { x: slot.x + slot.w - 20, y: slot.y + 6, w: 16, h: 16 }`
  - `hpBarIn(slot) = { x: slot.x + 6, y: slot.y + 56, w: slot.w - 12, h: 7 }`、技のゲージは `hpBarIn` の 1px 下に高さ 5
  - 顔は `(slot.x + 4, slot.y + 6)` から 40px 角（`FACE_PX` に `panel: 40` を足す）。名前と Lv は出さない。「倒れた」は 12px の文字で枠の下端
  - `rosterSlot(i) = { x: 20 + (i % 2) * 254, y: 640 + Math.floor(i / 2) * 72, w: 246, h: 64 }`
  - `resultSlot(i) = { x: 20 + (i % 2) * 260, y: 150 + Math.floor(i / 2) * 64, w: 240, h: 56 }`。称号の行は y 450
- `drawBottomBar`・`beginMapPointer` の `slice(0, 4)` とループの 4 を `MAX_PARTY` に。`drawRoster` は `partyIds(reg, save.members)`

- [ ] **Step 1: `layout.test.ts` を直す**: `8 枠とも画面に収まり重ならない`／`役割の絵と HP が枠の内側`／`仲間の一覧 8 人が画面に収まる`／`リザルトの 8 行が次へのボタン（BTN.next）にかからない`
- [ ] **Step 2: `npm test` で落ちることを確かめる**
- [ ] **Step 3: 実装する**
- [ ] **Step 4: `npm test` と `npm run build` が通ることを確かめる**
- [ ] **Step 5: コミット** `feat: 下の段に 8 人を並べ、仲間の一覧を 2 列にする`

---

### Task 11: ステージに加入と村を置く

**Files:**
- Modify: `assets/stages/stage1.json`・`stage2.json`・`stage4.json`・`stage5.json`・`stage6.json`・`stage7.json`・`stage8.json`・`stage9.json`・`stage10.json`

**Interfaces:**
- Consumes: Task 4 の ID、Task 5 の JSON の形

置くもの（村は、通り道から 2〜4 マス外れた、まわりに歩けるマスがあるところ。`legend` の無いステージには `{ ".": { "tile": null, "walkable": true }, "#": { "tile": null, "walkable": false }, "V": { "tile": "tile-village.png", "walkable": false } }` を足す。`#` を使っていないステージでは `#` を書かない）:

| ステージ | 置くもの |
|---|---|
| stage1 始まりの道 | 村 `talk`: 「村の 人が 『ガルムの 砦は 北だよ』と 教えてくれた」（今ある `V` のどれか 1 つ） |
| stage2 見張りの砦 | `joins` ally05 Lv2。会話: ally05「砦の 見張りに 追い出されて 困っていたんだ。\n俺も 連れて いってくれ！」／ roran「心強いよ。よろしく、{ally05}！」／地の文「{ally05}が 仲間に 加わった！」 |
| stage4 川原の渡し | 村 `recruit` ally07 Lv3。会話: ally07「村まで 来てくれて ありがとう。\nこの 槍で 力を 貸すよ」／地の文「{ally07}が 仲間に 加わった！」 |
| stage5 森の細道 | 村 `heal`: 「村の 人が けがの 手当てを してくれた！」 |
| stage6 石切り場 | 村 `powerUp` 2: 「村の 鍛冶屋が 武器を といでくれた！ 攻撃力が 上がった」 |
| stage7 魔導士の塔 | `persuasions` ally06（foe `ally06-foe`、persuader `mist`、Lv4、ai は近くのまじない師と同じ）。intro の最後に mist「塔に いる 魔法使いの 女の子……\n昔の 友だちかも しれません」。会話: mist「{ally06}、私です。{mist}です」／ ally06「{mist}……？ 私、だまされて いたのね。\n一緒に 戦わせて！」／地の文「{ally06}が 仲間に 加わった！」 |
| stage8 関所 | 村 `xp` 10: 「村の 長老に 戦い方を 教わった！」 |
| stage9 夜の野営地 | `persuasions` ally08（foe `ally08-foe`、persuader `gau`、Lv5、ai は `sentry`）。intro の最後に gau「野営地に 昔 世話に なった やつが いるらしい」。会話: gau「{ally08}！ こんな ところで 何してるんだ」／ ally08「{gau}……！ もう ガルムの 手下は やめる。\n力を 貸すよ！」／地の文「{ally08}が 仲間に 加わった！」 |
| stage10 ガルムの 門前 | 村 `stat` guard 1: 「村の 人が 丈夫な 服を くれた！ 守りが 1 上がった」 |

- [ ] **Step 1: JSON を書く**
- [ ] **Step 2: `npm test` が通ることを確かめる**（起動時の検証が全ステージを読む）
- [ ] **Step 3: `npm run dev` で、各ステージの村が通り道から外れ、隣に歩いて行けることを `?debug` なしで目で確かめる**（README の CDP 手順でステージごとに 1 枚撮る）
- [ ] **Step 4: コミット** `feat: ステージに仲間の加入と村を置く`

---

### Task 12: 正典の更新とブラウザでの確認

**Files:**
- Modify: `README.md`（「そうさ」に村と説得、「コンテンツの足しかた」に `joins`・`persuasions`・`villages`・`{id}`・新しい仲間の ID の決まり、「構成」に `events.ts`・`party.ts`・`names.ts`、生成器の使い方を引数つきに）、`HANDOVER.md`（`## 進捗`）

- [ ] **Step 1: README を直す**
- [ ] **Step 2: README の CDP 手順で、次を撮って目で確かめる**: 8 人の下の段（stage10 まで加入済みのセーブを `localStorage` に入れて）／stage2 の加入の会話／stage7 の説得の目印と会話（戦闘が止まっていること）／stage5 の村の回復のセリフと暗くなった村／リザルトの「仲間に 加わった！」／ステージ選択の 2 列の一覧
- [ ] **Step 3: `npm test` と `npm run build` が通ることを確かめる**
- [ ] **Step 4: コミット** `docs: 仲間の加入と村の決まりを README に書く`
