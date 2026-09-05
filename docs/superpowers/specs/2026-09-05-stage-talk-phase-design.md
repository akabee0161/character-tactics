# ステージ開始時の会話フェーズと、戦闘中の吹き出しの作り替え

作成日: 2026-09-05

## 1. 目的

ステージの開始時に、読み物として成立する会話を置けるようにする。あわせて、戦闘中の吹き出しが
プレイヤーの操作を妨げている問題を、表示方式ごと作り替えて解消する。

現状の `intro`（`assets/stages/*.json`）は、戦闘開始と同時に画面中央の吹き出しとして出て、
タップで送る。会話としては最小限のもので、話者は必須、本文は `assets/lines/common.json` の
参照でしか書けず、文字送りもない。

同時に、この吹き出しの実装（キュー + `isBlocking`）が戦闘中の入力を壊している。3節に詳述する。

## 2. スコープ

### ① ステージ開始時の会話フェーズ

1. 配置フェーズの前に会話フェーズを新設する
2. 本文を stage JSON に直書きできるようにする
3. 話者のいない地の文を書けるようにする
4. 文字送り（タイプライタ）とページ送りを入れる
5. 既読のステージでは「とばす」を出せるようにする

### ② 戦闘中の吹き出しの作り替え

6. 画面中央の1つずつ送る吹き出しを、各キャラ頭上の寿命つき吹き出しに変える
7. 時間停止とタップ横取りを廃止する

### ③ ステージ順の明示

8. ファイルパスの辞書順への依存をやめ、`order` フィールドで順序を決める

### 非スコープ

- 背景画像・立ち絵・BGM・SE。素材が存在せず、コードより先に素材が要る
- バックログ、オート送り、文字送り速度の設定画面
- 会話の途中でのセーブとリプレイ復元。会話フェーズは中断できない単位として扱う
- 台本ファイル（`.wn` のようなテキスト形式）。ローダが JSON 固定であり、
  今の会話量（2ステージ × 2行）に見合わない
- 会話中の分岐・変数
- イベントトリガ（地点到達で会話、HP 半減で台詞）。会話フェーズの次に来る話だが今回は作らない
- 勝利条件の追加、AI パターンの追加

## 3. 現状のバグ（作り替えの動機）

移動指示が通らないことがある、という症状の原因を特定した。**選択状態は解除されていない。**

`main.ts:101`:

```ts
function onPointerDown(ev) {
  const p = toLogical(ev);
  if (isBlocking(bubbles)) { advanceBubble(bubbles); return; }   // ← 原因
```

吹き出しが出ている間、`pointerdown` は必ず吹き出し送りに食われて `return` する。その結果
`pointerStart` が立たず `setPointerCapture` も呼ばれないため、後続の `pointermove`
（`main.ts:200`）と `pointerup`（`main.ts:205`）が先頭の早期 return で捨てられる。
**ジェスチャそのものが始まっていない。** ドラッグしても線が出ず、離しても移動指示にならない。

副次的な問題がもう1つある。ドラッグの途中で吹き出しが出た場合は `pointerStart` が生きている
ので指示自体は成立するが、`isBlocking` 中は `update` が `step` を回さない（`main.ts:245`）
ため、コマンドはキューに溜まったまま吹き出しを消すまで実行されない。指示が通ったのに反応がない、
という別の症状になる。

新しい表示方式では、この2箇所がどちらも消える。

## 4. フェーズ機械

```
title → select → talk → placement → battle → result / defeat
                  ↑                              ↓
                  └──────── もういちど ───────────┘
```

`Phase` に `'talk'` を追加し、`select` と `placement` の間に置く。

- `beginStage` は `phase = 'talk'` で始める
- `intro` が空、または「とばす」が押されたら即座に `placement` へ移る。
  会話のないステージ（今の stage2）の挙動は現状と変わらない
- 敗北後の「もういちど」（`main.ts:164`）も `beginStage` を通るので会話フェーズに戻るが、
  既読なら「とばす」が出る
- 会話フェーズ中はステージ選択に戻れない。中断の導線は置かない
  （配置フェーズにも戻る導線がないため、そこと揃える。`BTN.back` は現在も未使用）

## 5. データ定義

`intro` という名前は据え置く。意味は今も「導入」で正しく、改名する利益がない。

```json
{
  "id": "stage1",
  "order": 10,
  "intro": [
    { "text": "みちの さきに、けむりが みえる。" },
    { "speaker": "roran", "text": "みんな、いくよ。\nまえに すすもう" },
    { "speaker": "gau", "lineId": "stage:stage1:gau" }
  ]
}
```

### 5.1 `intro` の要素

```ts
export type IntroLine = {
  /** 省略したら地の文。ネームプレートと顔の丸を出さない */
  speaker?: string;
  /** text と lineId は排他。どちらか一方が必須 */
  text?: string;
  lineId?: string;
};
```

- `speaker` は省略可。指定する場合は `units` か `enemies` に実在すること（現行の検証を踏襲）。
  JSON では省略、内部の `TalkLine` では `null` に正規化する（6節）
- `text` と `lineId` は**排他**。両方あればエラー、どちらも無ければエラー。
  片方を優先する暗黙のルールを作ると、直したつもりが効いていない事故が起きる
- 既存の `{ speaker, lineId }` はそのまま有効。**stage1 / stage3 は無変更で動く**

### 5.2 `order`

`StageDef` に `order: number`（正の整数）を**必須**で追加する。

現状の順序は `Object.keys(files).sort()` の辞書順（`registry.ts:41`）で、`stage10.json` は
`stage1` と `stage2` の間に入る。`order` の昇順に並べ替え、辞書順への依存を捨てる。

- **必須にする。** 任意にすると「order のあるファイルとないファイル」で順序規則が二重になり、
  辞書順のバグが残り続ける
- **欠番は許容し、重複だけエラー。** 10, 20, 30 と空けて書けば、後からステージを間に挟むときに
  既存ファイルを触らずに済む
- 既存3ファイルに1行足す（stage1: 10 / stage2: 20 / stage3: 30）

ステージ ID は変えないので、**公開済みプレイヤーのセーブは無傷**である
（`clearedStageIds` は ID で持っている、`save.ts:14`）。`isStageUnlocked` は
「並んだ配列の1つ前がクリア済みか」を見ているだけなので、ロジックは変わらない。

## 6. 会話フェーズの進行（`src/ui/talk.ts`・新規）

`bubbles.ts` の隣に置く純ロジック。DOM にも Canvas にも触らない。

```ts
export const TALK_CHARS_PER_SEC = 30;

export type TalkLine = { speaker: string | null; text: string };

export type TalkState = {
  lines: TalkLine[];
  index: number;      // 今どの行か
  pages: string[][];  // 今の行を「ページ × 表示行」に割ったもの
  page: number;       // 今どのページか
  shown: number;      // そのページの先頭から何文字表示したか
  done: boolean;
};
```

公開する関数は4つ。

| 関数 | 役割 |
|---|---|
| `makeTalkState(lines, measure, maxWidth, maxLines)` | 初期化。1行目のページ分割まで済ませる |
| `tickTalk(state, dt)` | `shown` を `TALK_CHARS_PER_SEC × dt` だけ増やす。ページ末で止まる |
| `advanceTalk(state, measure, maxWidth, maxLines)` | タップ1回ぶん進める。行をまたぐときに割り直すので測定が要る |
| `skipTalk(state)` | 「とばす」。`done = true` にする |

`advanceTalk` の分岐が仕様の本体:

1. 文字送りの途中なら → **そのページを全文表示**（送りを打ち切る）
2. 表示済みで、まだページが残っていれば → 次のページへ（`shown = 0`）
3. 最終ページなら → 次の行へ（ページを割り直し、`shown = 0`）
4. 最終行なら → `done = true`

### 6.1 ページ分割

`measure: (text: string) => number` を引数で受け取る。本番は `ctx.measureText(t).width`、
テストは「1文字 = 10px」のダミーを渡す。**これによりページ分割にテストが書ける。**

web-novel-engine は文字位置を二分探索している（`paginate.ts`）が、Canvas では折り返しを
自分で決められるので素直に組める。

1. `text` を明示的な `\n` で段落に割る（既存のセリフは全部 `\n` 入り）
2. 各段落を `measure` で測りながら `maxWidth` で貪欲に折り返し、表示行の配列にする
3. その配列を `maxLines` 行ずつ切ってページにする

**1文字が `maxWidth` を超える場合でも、必ず1文字は進める。** 進めないと無限ループする。

**行頭禁則だけ入れる。** 折り返した結果、行頭に `。、！？」` が来たら前の行に押し込む。
これを入れないと日本語として必ず目につく。それ以外の日本語組版（行末の約物処理、
英数字の単語分割）はやらない。全文ひらがなの短い台詞であり、投資に見合わない。

## 7. 会話フェーズの描画

論理解像度は 960×540（`viewport.ts`）。

| 要素 | 位置・値 |
|---|---|
| 会話ウィンドウ | `{ x: 40, y: 330, w: 880, h: 180 }` |
| 意匠 | 既存 `drawBubble` と同じ（`#f7f3e6` のパネル、左に話者の色つき丸、名前 20px、本文 26px） |
| 本文 | 3行 × 約29文字 / ページ |
| 「とばす」ボタン | `{ x: 780, y: 276, w: 140, h: 44 }`。**既読のときだけ**出す |
| ページ表示 | ページが複数あるときだけ、右下に `1 / 2` |

- **地の文**（`speaker === null`）は顔の丸と名前を出さず、本文を左端から描く
- **背景はステージのマップをそのまま描く。** `drawBattle` を呼んで暗幕を1枚かぶせ、
  その上にウィンドウを置く。この時点で味方は `placementZone` に初期配置済み
  （`state.ts:65`）なので、これから戦う場所と自分たちの並びを見ながら会話を読む。
  `placement` フェーズが既に同じことをしているので追加コストはほぼない

## 8. 戦闘中の吹き出しの作り替え（`src/ui/bubbles.ts`）

キュー + `isBlocking` を丸ごと置き換える。

```ts
export const BUBBLE_DURATION = 3.0;  // 秒

export type Bubble = { uid: string; text: string; ttl: number };
/** uid をキーにするので、同じキャラの発話は自動的に上書きになる */
export type BubbleState = { items: Map<string, Bubble> };
```

`effects.ts` と同じ寿命方式。`tickBubbles(state, dt)` を毎フレーム回し、`ttl` が尽きたら消える。

- `SimEvent` は喋る側の `uid` を全種類持っている（`types.ts:82`）ので、`DialogueRequest` に
  `uid` を1つ足すだけで頭上に紐付く
- **位置は保持しない。** 描画のたびにそのユニットの現在位置を引くので、喋りながら移動しても
  吹き出しが付いてくる
- `Map` のキーが `uid` なので**キャラごと1つ・同じキャラの連続発話は新しい方で上書き**
- 喋るのは味方だけ（`pickDialogue` は味方のイベントしか拾わない）なので、同時に出るのは最大4つ

### 8.1 タップで消す

矩形の計算を `layout.ts` に `bubbleRectAt(logicalPos, text)` として置き、
**描画と当たり判定で同じ関数を使う。** 別々に書くと必ずずれる。

`battle` フェーズの `onPointerDown` の判定順:

1. **スキルボタン**（`skillButtonAt`）
2. **吹き出し**（当たったらその1つを消して `return`）
3. マップ操作（選択・移動指示）

スキルボタンを先に見るのは、選択中のキャラが喋ると両方が頭上に出て重なりうるため。
**操作を優先し、吹き出しは装飾として譲る。** 描画も同じ順で、スキルボタンが上に乗る。

吹き出しはキャラの丸（当たり判定は半径32、`hit.ts:12`）より上に出すので、
キャラ選択のタップとは重ならない。`skillButtonAt` と同様、画面端ではクランプする。

### 8.2 消えるもの

- `main.ts:101` のタップ横取り
- `main.ts:245` の時間停止
- `bubbles.ts` の `enqueue` / `currentBubble` / `advanceBubble` / `isBlocking`
- `screens.ts` の `drawBubble`（全画面の暗幕つき吹き出し）

`pickStageIntro`（`dialogue.ts:70`）は会話フェーズ側へ移るため、**`bubbles.ts` は戦闘中の
自動セリフ専用**になり、責務が1つ減る。

### 8.3 体感が変わる点

**戦闘中に時間が止まらなくなる。** 現在は敵と初遭遇するたびに画面が止まり、そこで状況を
確認できていた。それが無くなるので、ピンチの台詞などは見逃せるようになる。要望どおりの変更
だが体感は確実に変わるため、実装後に実機で確認する。長さが足りなければ `BUBBLE_DURATION`
の1つで調整する。

## 9. セーブ

`SaveData` に1フィールド追加する。

```ts
export type SaveData = {
  version: number;
  clearedStageIds: string[];
  /** 会話を最後まで読み終えたステージの id */
  readIntroStageIds: string[];
  units: Record<string, CharProgress>;
  counters: Record<string, number>;
  titles: string[];
};
```

**`SAVE_VERSION` は 2 のまま上げない。** `loadSave` は version 不一致の旧セーブを
マイグレーションせず読み捨てる（`save.ts:80`）ため、上げると公開済みプレイヤーの進行が消える。
`reconcile`（`save.ts:41`）は「レジストリに無い ID は無視し、セーブに無いフィールドは既定値で
補う」設計なので、**フィールドを1つ足すだけなら version を上げずに後方互換で足せる。**
旧セーブには `readIntroStageIds` が無い → `[]` で補われ、全ステージが未読として扱われる。

記録するタイミングは**会話を最後まで読み終えた時点**（`done` になった時点）。
クリア時点ではない。読んだのだから既読、という定義にする。「とばす」を押せるのは既読の
ステージだけなので、とばした結果として既読が立つ経路は存在しない。

`writeSave` の呼び出しは現在 `placement` → `battle` の遷移時にある（`main.ts:127`）。
既読を立てた時点でも書き出す必要があるため、`talk` → `placement` の遷移にも1本足す。

## 10. 触るファイル

| ファイル | 変更 |
|---|---|
| `src/ui/talk.ts` | **新規。** 会話の進行とページ分割 |
| `src/ui/talk.test.ts` | **新規。** |
| `src/ui/bubbles.ts` | **作り替え。** キュー → uid をキーにした寿命つき Map |
| `src/ui/bubbles.test.ts` | 作り替えに追随 |
| `src/engine/schema.ts` | `IntroLine` の拡張（`speaker` 省略可、`text`/`lineId` 排他）、`order` |
| `src/engine/registry.ts` | `order` で整列、`order` の重複検査、`intro` の相互参照検証を更新 |
| `src/core/dialogue.ts` | `pickStageIntro` が `text` 直書きに対応。`DialogueRequest` に `uid` |
| `src/ui/screens.ts` | `drawTalk` を追加、`drawBubble` を頭上の小さい吹き出しに作り替え |
| `src/ui/layout.ts` | `TALK_WINDOW`、`BTN.skip`、`bubbleRectAt` |
| `src/save/save.ts` | `readIntroStageIds` |
| `src/ui/flow.ts` | 既読の判定と記録 |
| `src/main.ts` | `talk` フェーズ、判定順の変更、`isBlocking` 依存の削除 |
| `assets/stages/*.json` | `order` を追加。stage1 の `intro` を新記法の見本にする |
| `README.md` | 「コンテンツの足しかた」に `order` と `intro` の新記法を反映 |

## 11. テスト方針

このリポジトリの慣習どおり、**純ロジックにはテストを書き、描画コードには書かない**
（`screens.ts` に既存テストがないのと揃える）。

ただし `layout.ts` に足す `bubbleRectAt` は例外としてテストする。描画と当たり判定の両方が
これに依存し、画面端のクランプという壊れやすい分岐を持つため。
`hit.test.ts` に同種のテストが既にある。

`talk.test.ts`:

- ページ分割 — `\n` での改行、幅による折り返し、`maxLines` でのページ切り
- **1文字が `maxWidth` を超えても無限ループしない**
- 行頭禁則 — 行頭に `。` が来たら前の行に押し込む
- `tickTalk` — 文字数が増える、ページ末で止まる、`dt` が大きくても飛び越さない
- `advanceTalk` の4分岐 — 送り途中 / 次ページ / 次の行 / `done`
- `skipTalk` — 即座に `done`
- 地の文（`speaker: null`）が扱える

`bubbles.test.ts`（作り替え）:

- 同じ uid の発話が上書きされる
- 別の uid は同時に共存する
- `ttl` が尽きたら消える
- 空の状態を tick しても壊れない

`layout.test.ts`（新規）:

- `bubbleRectAt` が画面左右の端でクランプされる
- 文字数に応じて幅が変わる

`schema.test.ts` / `registry.test.ts`:

- `text` と `lineId` の両方があればエラー
- どちらも無ければエラー
- `speaker` 省略が通る
- `order` 欠落がエラー、重複がエラー、欠番は通る
- `order` の昇順に `reg.stages` が並ぶ

`save.test.ts`:

- `readIntroStageIds` の無い旧セーブが読め、`[]` で補われる
- 壊れた `readIntroStageIds` を捨てても他のフィールドが残る

## 12. 却下した案

**戦闘中の吹き出しと会話ウィンドウを同じ描画関数に寄せる。** 一度は採用したが、戦闘中を
キャラ頭上の小さい吹き出しに変える方針が決まった時点で、共通化する対象がなくなったため撤回した。

**`SAVE_VERSION` を上げて既読を入れる。** 旧セーブが読み捨てになり、公開済みプレイヤーの
進行が消える。9節のとおり version 据え置きで足せる。

**ステージ ID をゼロ埋めに改名（`stage1` → `stage01`）して辞書順を正す。** `reconcile` が
未知の ID を**エラーも出さずに黙って捨てる**ため、改名した瞬間にクリア済みステージの記録が
全消えする。`order` フィールドなら ID を据え置ける。

**`assets/stages/index.json` に順序の配列を置く。** 順序が1ファイルに集まるが、ステージ追加の
たびに2ファイル触ることになる。`order` フィールドなら1ファイルで完結する。

**会話の進行を `core/` に置く。** `core/` の既存の役割は「どのセリフを出すか選ぶ」だけで、
進行は `ui/` 側にある（`bubbles.ts`）。会話の送りは戦闘シミュレーションではないので、
この分担を崩す理由がない。

**ページ分割を `screens.ts` の描画時に直接やる。** `ctx.measureText` をその場で呼べて注入が
不要になるが、ページ分割がテストの外に出る。また描画は毎フレーム走るため、行が変わっていなくても
測り直さないよう自前でキャッシュを持つことになり、「状態を持たない」利点も実際には消える。

## 13. 実装の順序

1. `order` の追加（スキーマ・レジストリ・整列・既存3ファイル）— 独立していて先に潰せる
2. `intro` の拡張（`speaker` 省略可、`text` 直書き、排他検証）
3. `talk.ts` のページ分割と進行 + テスト — UI に繋ぐ前に単体で固める
4. `talk` フェーズを `main.ts` に組み込み、`drawTalk` を書く
5. 既読と「とばす」（`save.ts` / `flow.ts`）
6. `bubbles.ts` の作り替えと、`main.ts` の判定順の変更
7. `README.md` の更新

1〜5 と 6 は独立している。6 だけ先に入れてバグを止めることもできる。
