# issue #13「修正事項-20260911」設計

対象 issue: [#13](https://github.com/akabee0161/character-tactics/issues/13)

4項目のうち3項目は既存挙動の修正、1項目（ステージ量産）はステージ選択画面と
物語構成に手を入れる。全体としては architectural として扱う。

## 1. 必殺技の発動可能表示

### 現状

`src/ui/screens.ts` の `drawBottomBar` は、クールダウンが明けたポートレートに
`#ffd479` の 2px 枠をすでに描いている。ただし枠が細く静止しているため、
戦闘中に視線が盤面へ向いていると気づけない。

### 変更

枠を 4px にし、明滅させる。明滅の透明度は `src/render/effects.ts` に純関数として置く。

```ts
/** 発動可能を示す枠の明滅。周期 1 秒の三角波で 0.45〜1.0 を往復する */
export const READY_GLOW_PERIOD = 1.0;
export function readyGlowAlpha(time: number): number;
```

描画コードにはユニットテストを書かない方針なので、明滅の計算だけを純関数として
切り出してテストする。`drawBottomBar` は `readyGlowAlpha(state.time)` を
`ctx.globalAlpha` に掛けて枠を描く。

発動可能の条件（`state.phase === 'battle' && remaining <= 0`）は変えない。
配置フェーズは全員 `time === 0` で発動可能に見えてしまうため戦闘フェーズ限定、
という既存の判断はそのまま残す。

## 2. 黄色い線より下に敵を初期配置しない

### 現状

`placement.minY` より下（`pos.y >= minY`）がプレイヤーの配置範囲だが、
敵の位置は検証されていない。`src/engine/schema.ts` が検証しているのは
`placement.starts` の位置だけ。実データにも違反がある。

| ステージ | 違反 |
|---|---|
| stage2 | `narazumono` (240, 560)、`narazumono` (400, 560) — minY 528 より下 |
| stage3 | `narazumono` (176, 528)、`narazumono` (368, 528) — 線上（`pos.y >= minY` なので配置可能側） |

### 変更

**データ**: 上記4体を線より上（`pos.y < 528`）へ動かす。ステージのねらい
（stage2 は砦の手前の見張り、stage3 は開幕の露払い）を保つよう、線のすぐ上に置く。

**検証**: `validateStageDef` に、`enemies[].pos.y` と `spawners[].pos.y` が
`placement.minY` **未満**であることの検査を足す。境界は「未満」であり「以下」ではない
（`pos.y === minY` はプレイヤーの配置可能側に入るため）。

エラーメッセージは既存の様式に揃え、どのファイルのどのフィールドがなぜ不正かを出す。
検証の順序上、`placement` を先に読んでから `enemies` / `spawners` を見る必要がある。

## 3. 「!」が敵発見時以外にも出る不具合

### 現状

`src/render/objectives-view.ts` の `alertMarks` は `ai.mode === 'chase'` の敵すべてに
印を出す。sentry と guard は対象を見失うまでずっと `chase` なので、交戦中も印が
出たままになる。「気づかれた」という一瞬の情報を伝えるはずが、「まだ追われている」の
常時表示になっている。

### 変更

**発見の瞬間から一定時間だけ出す**。

- `src/core/types.ts` の `AiState` に `spottedAt: number | null` を足す。初期値 `null`
- `src/core/sim.ts` の `updateAi` で、mode が `chase` 以外から `chase` に変わった tick に
  `spottedAt = state.time` を記録する。`chase` から抜けたときは `null` に戻す
  （見失って再発見したら、また印が出る）
- `alertMarks(units, time)` を時刻つきの署名に変え、
  `spottedAt !== null && time - spottedAt <= ALERT_MARK_DURATION` のものだけ返す
- `ALERT_MARK_DURATION` は 2.0 秒とし、`objectives-view.ts` に置く
- `aggressive` を除外する既存の判断はそのまま（開始時から追ってくるので、
  印が出ても「気づかれた」という意味を持たない）

`src/render/draw.ts` の呼び出し側に `state.time` を渡す。

## 4. ステージを10本まで量産する

### 現状の答え

ゲームプレイ部分は**コード変更なしで JSON だけで足せる**。`assets/stages/<id>.json` を
置けば `import.meta.glob` が拾い、`order` の昇順に並ぶ。地形・敵・AI・時間湧き・勝敗条件・
会話はすべて JSON で表現できる。

破綻するのは**ステージ選択画面のレイアウトだけ**。`stageSlot(index)` は
`y = 160 + row * 140`（h=120）の2列グリッドで、10本だと5行目が y=720〜840 に来る。
仲間一覧は `rosterSlot` で y=640 から始まるため重なる。

### 4-1. 選択画面を縦スクロールにする

`src/ui/scroll.ts` を新設し、純関数を置いてテストする。

```ts
/** 内容が収まりきらないぶんの高さ。収まるなら 0 */
export function maxScroll(contentH: number, viewH: number): number;
/** offset を 0〜max に収める */
export function clampScroll(offset: number, max: number): number;
/** タップとドラッグの境目。縦移動がこの値未満ならタップ */
export const TAP_SLOP = 8;
export function isTap(dy: number): boolean;
```

`src/ui/layout.ts` に足すもの:

- `STAGE_LIST_VIEW: Rect` — ステージ一覧の見える範囲（y=140〜620）
- `stageListContentH(count: number): number` — `stageSlot` の最終行の下端から出す

`drawStageSelect` は `ctx.save()` → `ctx.beginPath()` → `ctx.rect(STAGE_LIST_VIEW)` →
`ctx.clip()` → `ctx.translate(0, -offset)` の中で従来どおり枠を描く。
スクロールできることが分かるよう、見える範囲の右端に細い位置バーを出す
（`maxScroll` が 0 のときは出さない）。仲間一覧はクリップの外に描き、今まで通り下に固定する。

### 4-2. 入力を pointerdown から pointerup へ移す

`src/main.ts` のステージ選択はいま **pointerdown で即 `beginStage`** している。
このままではドラッグでスクロールできないので、次のように変える。

- pointerdown: 開始 y とスクロール開始時の offset を控える
- pointermove: `offset = clampScroll(startOffset + (startY - currentY), max)`
- pointerup: 縦移動が `isTap` ならその位置のステージを決定、そうでなければ何もしない

盤面のドラッグ（`pointerStart` / `dragMap`）とは別系統の状態として持つ。
両者を1つの状態に混ぜると、フェーズごとに意味の違う値が同じ変数に入って読めなくなる。

`phase` が `select` に入るたびにスクロール位置は 0 に戻す。

### 4-3. 遠距離の敵を2種足す

現在の敵は `narazumono` / `tatemochi` / `garum` の3種で全員 `melee`。
遠距離が入ると、遮蔽の取り方と接近の順序という判断が生まれ、地形の意味が変わる。

| id | 名前 | attack | ねらい |
|---|---|---|---|
| `yumihei` | 弓兵 | `bow` | 打たれ弱いが射程が長い。遮蔽を取らせる |
| `majinaishi` | まじない師 | `magic` | 攻撃間隔が長く一撃が重い。速攻を促す |

数値は既存の敵（`narazumono` maxHp 12 / power 5 / range 24、`tatemochi` maxHp 20 /
power 5）のあいだに収まるよう置く。

| | maxHp | power | guard | range | attackInterval | speed | xpReward |
|---|---|---|---|---|---|---|---|
| `yumihei` | 10 | 4 | 0 | 120 | 1.8 | 30 | 10 |
| `majinaishi` | 9 | 7 | 0 | 140 | 2.6 | 24 | 14 |

どちらも `skillId: null`、`bowDamageCap: null`、`fleeAtHpRatio: null`、`combat: true`。
`role` は `敵`。上の数値は実装中の手触りで動かしてよい（ステージ側の配置と
一緒に決まるため）が、「弓兵は数で押す・まじない師は放置すると痛い」という
役割分担は変えない。

絵は `tools/gen-placeholder-sprites.mjs` の `CHARS` に2件、`ROLES` に敵向けの
弓・杖のクラス印2件を足して再生成する。既存の仮アセットと同じ作りなので、
本番の絵が揃ったときの差し替え手順も変わらない。

### 4-4. ステージ7本と並び順

物語は stage3「ガルムの 最後」を最後尾へ移し、あいだに7本を挟む。

| order | id | 名前 | ねらい |
|---|---|---|---|
| 10 | stage1 | 始まりの 道 | 既存。移動と攻撃 |
| 20 | stage2 | 見張りの 砦 | 既存。sentry と索敵 |
| 30 | stage4 | 川原の 渡し | 弓兵の初登場。遮蔽を覚える |
| 40 | stage5 | 森の 細道 | sentry 多数。視線の通らない地形 |
| 50 | stage6 | 石切り場 | guard と盾持ち。正面を避けて迂回する |
| 60 | stage7 | まじない師の 塔 | まじない師の初登場 |
| 70 | stage8 | 関所 | 混成と時間湧き |
| 80 | stage9 | 夜の 野営地 | sentry 密集。気づかれない道を選ぶ |
| 90 | stage10 | ガルムの 門前 | 総力戦。決戦の直前 |
| 100 | stage3 | ガルムの 最後 | 既存。`order` だけ 30 → 100 |

各ステージの決まりは既存に揃える。マップは16列×23行、`cell` は 32、
`victory.pos` は最上段、`placement.minY` は 528、`defeat` は `roran` を含む。

7本すべてに `intro`（2〜3行）と `outro`（2行）を書く。文字列は
CLAUDE.md のとおり漢字仮名交じりで、低学年でも読める語を選ぶ。

**id と並び順が一致しない点について**: ガルム戦の id は `stage3` のまま最後尾に置くため、
`stage10.json` が9番目になる。id を並び順に振り直すほうが読みやすいが、
セーブデータの `clearedStageIds` は id 文字列で持っており、振り直すと既存プレイヤーの
クリア記録が一部消える。既存セーブを壊さないほうを優先した。
README の「コンテンツの足しかた」に、**並び順を決めるのは `order` であって id の数字ではない**
ことを明記して補う。

### 4-5. 成長曲線

現在の `maxLevel 12` / `xpPerLevel 12` では、Lv1 から Lv12 まで
`Σ(level × 12) = 12 × 66 = 792` xp が要る。10ステージを通しても届かない見込みで、
上限レベルが飾りになる。

`assets/growth.json` の数値だけを調整する（コード変更なし）。根拠は実機ではなく
テストで取る。各ステージの敵の `xpReward` 合計と `clearXp` から、4人で分け合った場合の
1ステージあたりの取得量を計算し、累積が **第9〜10ステージあたりで Lv12 に届く**
曲線になるよう `xpPerLevel` を決める。

このテストは「ちょうど Lv12 になる」ことではなく、
**全ステージ通過後に Lv12 へ到達する** ことと、**第5ステージ時点では上限に達していない**
ことの2点を確かめる。厳密な数値を固定すると、あとでステージの敵を1体足すたびに落ちる。

## テストと確認

**ユニットテスト**

- `readyGlowAlpha` の値域と周期
- 敵・時間湧きの位置が `placement.minY` 未満であることの検証（正常系と異常系）
- `spottedAt` の遷移（発見で記録、見失いで `null`、再発見で再記録）
- `alertMarks` の時間窓（発見直後は出る、`ALERT_MARK_DURATION` 経過後は出ない、
  `aggressive` は出ない）
- `maxScroll` / `clampScroll` / `isTap`
- `stageListContentH` が 10 本ぶんの高さを返す
- 成長曲線の到達点
- 新規ステージを含む全アセットが `buildRegistry` を通ること

**実機確認**（README の CDP 手順）

- 必殺技が使えるポートレートの枠が明滅する
- 配置フェーズで黄色い線より下に敵がいない
- 敵に気づかれた瞬間に「!」が出て、2秒で消える。交戦中は出ていない
- ステージ選択がスクロールでき、タップとの取り違えがない
- 新規ステージが最後まで遊べる

**通すもの**: `npm test`、`npm run build`

## 触るファイル

**新規**

- `src/ui/scroll.ts` と `src/ui/scroll.test.ts`
- `assets/enemies/yumihei.json`、`assets/enemies/majinaishi.json`
- `assets/stages/stage4.json` 〜 `assets/stages/stage10.json`
- `assets/images/` の生成物（弓兵・まじない師の map / face、敵向けクラス印2枚）

**変更**

- `src/render/effects.ts`（`readyGlowAlpha`）
- `src/ui/screens.ts`（枠の明滅、選択画面のクリップとスクロール）
- `src/ui/layout.ts`（`STAGE_LIST_VIEW`、`stageListContentH`）
- `src/main.ts`（選択画面の入力を pointerup へ）
- `src/engine/schema.ts`（敵・時間湧きの位置の検証）
- `src/core/types.ts`（`AiState.spottedAt`）
- `src/core/state.ts`（`spottedAt` の初期化）
- `src/core/sim.ts`（`spottedAt` の記録と解除）
- `src/render/objectives-view.ts`（`alertMarks` の時間窓）
- `src/render/draw.ts`（`alertMarks` へ時刻を渡す）
- `assets/stages/stage2.json`、`assets/stages/stage3.json`（敵の位置、`order`）
- `assets/growth.json`
- `tools/gen-placeholder-sprites.mjs`
- `README.md`（`order` と id の関係、新しい敵、選択画面のスクロール）

## やらないこと

- 敵の中ボス追加。遠距離2種で手応えの差が足りるかを先に見る
- ステージ選択の並べ替えや章分け。10本ならスクロールで足りる
- 既存3ステージの地形・会話の作り直し。`order` と敵の位置以外は触らない
