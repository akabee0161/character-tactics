# 縦画面化と、戦闘フィードバックの作り直し

作成日: 2026-09-06

対応する Issue: [#8](https://github.com/akabee0161/character-tactics/issues/8)

## 1. 目的

Issue #8 に挙がった6件の要望に応える。中心にあるのは**画面を縦にすること**で、これが残り5件の
レイアウト前提をすべて変える。あわせて、画像アセットへ差し替えられる下地を作る（アセット自体は
後から置く）。

要望の内訳:

| # | 要望 | 本書の節 |
|---|---|---|
| 1 | 移動中に吹き出しが出ると移動が止まる | 5 |
| 2 | 必殺技の表示が邪魔。下のパネルに出せないか | 4 |
| 3 | 魔法使いは魔法攻撃も可能にする | 7 |
| 4 | 弓のエフェクト、飛翔物が飛んで、当たった瞬間にダメージ | 6 |
| 5 | 縦にする。下から上に攻める。表示サイズは sea-defence を参考に | 3 |
| 6 | 敵の本拠地に到達した際の会話を追加 | 8 |
| 追 | ユニットクラスをパネルに表示。画像アセットで差し替えられるように | 9 |
| 追 | パネルとステージ上のキャラも画像アセットに置き換えられるように | 9 |

## 2. スコープ

### やること

1. 論理解像度を 960×540 横から **540×945 縦**へ変える。マップは下から上へ攻める向きに作り直す
2. 必殺技ボタンをキャラの頭上から下パネルへ移す
3. プレイヤーが指示した移動は、交戦しても足を止めない（歩きながら撃つ）
4. 弓と魔法をシミュレーション上の飛翔体にし、着弾した瞬間にダメージを出す
5. ミストに遠距離の魔法攻撃を持たせる（新しい攻撃種別 `magic`）
6. 敵の本拠地に到達したときの会話（`outro`）を足す
7. ユニットの絵（クラスアイコン・顔・フィールド上の姿）を画像アセットで差し替えられるようにする。
   画像が無いあいだは現状の見た目（色つきの丸・クラス名の文字）がプレースホルダとして出る

### やらないこと

- **画像アセットそのものの制作。** 本書で作るのは差し替えの受け口までで、初期状態は全ユニットが
  プレースホルダ表示になる
- **アニメーション**（歩行・攻撃のコマ送り）と**向き**（左右反転・8方向）。1ユニット1枚の静止画だけ
- **背景画像・立ち絵・BGM・SE**
- **マップのスクロール**。画面に収まるサイズのマップだけを扱う（sea-defence と同じ）
- 新しいステージ・敵・スキルの追加。既存3ステージを縦向きに作り直すだけ
- セーブ形式の変更
- 勝利条件・AI パターンの追加

## 3. 縦画面（要望 5）

### 3.1 論理解像度とレイアウト

sea-defence（`akabee0161/sea-defence`）は論理キャンバス 400×700（tile 50 × 8列13行 + 上部 HUD 50）、
CSS は `max-width: 400px` / `aspect-ratio: 400/700`。この比を保ったまま 1.35 倍した
**540×945** を論理解像度にする。既存の 26px フォントやボタン寸法をおおむね流用できる。

| 領域 | y | 中身 |
|---|---|---|
| 情報バー | 0–50 | ステージ名・目的 |
| マップ | 50–786 | cell 32 × **16列 × 23行** = 512×736。左右に 14px の余白 |
| 下パネル | 786–945 | 上段: 必殺技ボタン / 下段: ポートレート4枚 |

```
viewport.ts
  LOGICAL_W = 540
  LOGICAL_H = 945
  MAP_ORIGIN = { x: 14, y: 50 }
```

`MAP_ORIGIN` はすでに定数化され `mapToLogical` / `logicalToMap` を全員が通っているので、
マップ座標を扱う描画と入力は追随するだけでよい。

### 3.2 下パネル

```
layout.ts
  BOTTOM_PANEL_Y  = 786
  SKILL_BUTTON    = { x:   8, y: 794, w: 524, h: 56 }
  portraitSlot(i) = { x: 6 + i * 133, y: 858, w: 129, h: 80 }
```

必殺技ボタンの矩形は**配置フェーズの「はじめる」と共用する**。配置中は必殺技を使えず、戦闘中は
「はじめる」が要らないため、同じ場所を時間で使い分けられる。ボタンが画面のどこに出るかが
フェーズによって動かないほうが、押す場所を覚えやすい。

### 3.3 そのほかの画面

540 幅に収まらないものを組み直す。

| 対象 | 変更 |
|---|---|
| `stageSlot(i)` | 3列 → **2列**。`{ x: 20 + col*260, y: 160 + row*140, w: 240, h: 120 }` |
| `drawRoster`（ステージ選択の下部） | `portraitSlot` の流用をやめ、専用の**1列リスト**にする。`rosterSlot(i) = { x: 20, y: 640 + i*72, w: 500, h: 64 }`。129px 幅には「名前 Lv1」と称号が入らないため |
| `TALK_WINDOW` | `{ x: 20, y: 645, w: 500, h: 260 }`。`TALK_MAX_LINES` は 3 のまま |
| `BTN.skip` | `{ x: 380, y: 585, w: 140, h: 44 }`（会話ウィンドウの上） |
| `BTN.titleNew` / `titleContinue` | `{ x: 120, y: 520 / 620, w: 300, h: 76 }` |
| `BTN.retry` / `toSelect` | `{ x: 60 / 280, y: 700, w: 200, h: 72 }` |
| `BTN.next` | `{ x: 120, y: 700, w: 300, h: 76 }` |
| `bubbleRectAt` の `960` 直書き | `LOGICAL_W` を参照する。定数はあるのに直書きされている（`skillButtonAt` は 4 節で廃止するので、そちらの直書きも一緒に消える） |

`index.html` / CSS は sea-defence に倣い `aspect-ratio: 540/945`、`max-width: 540px`、
`env(safe-area-inset-*)` 対応、`touch-action: none` を入れる。

### 3.4 ステージの作り直し

既存3ステージは 30列×14行（960×448）で、そのまま転置すると 30行 = 960px となり縦 736px に
収まらない。**16列×23行で作り直す**。各ステージの狙いは保つ。

| ステージ | 狙い | 縦での作り |
|---|---|---|
| stage1 はじまりの みち | 障害物なしの導入 | 一本道。敵3体を下から上へ段階配置 |
| stage2 みはりの とりで | 見張り（sentry）の視界を避けて進む | 通路を左右に振る壁を2段。sentry の視界円が重ならない隙間を残す |
| stage3 ガルムの さいご | 門番（guard）を抜けてボスへ | 壁で3層に分け、最上段にガルム |

共通の作り:

- `placementZone` は**最下段**（`y` が大きい側）
- `victory.pos` は**最上段**（`y` が小さい側）。`radius` は 40 のまま
- 外周1セルは `#`（壁）

## 4. 必殺技ボタンを下パネルへ（要望 2）

`skillButtonAt(logicalPos)`（選択中キャラの頭上に浮く）を廃止し、`SKILL_BUTTON` 固定矩形にする。

表示は3状態:

| 状態 | 表示 |
|---|---|
| 未選択 | 「なかまを えらぶ」。押せない見た目 |
| クールダウン中 | スキル名 + 残り秒数。押せない見た目 |
| 使用可 | スキル名 |

クールダウン中に**ボタンごと消える**のが現状の挙動で、「なぜ押せないのか」が画面から分からない。
出しっぱなしにして状態で描き分ける。

副産物として、マップ上の当たり判定から必殺技が消えるので、`main.ts` の
「吹き出しとスキルボタンの重なりを避ける」分岐（`overUnit` の判定を含む）が不要になる。

## 5. 移動しながら攻撃する（要望 1）

### 5.1 症状の正体

「移動中に吹き出しが出ると移動が止まる」の原因は吹き出しではなく**交戦**である。

`core/sim.ts` の `moveUnits` は `engagedWith !== null` のユニットを移動から除外する。
移動コマンドは `applyCommands` で一度 `engagedWith` を `null` にするが、次の tick で
`updateEngagements` が射程内の敵に再交戦させるため、すぐまた足が止まる。吹き出しは `engage`
イベントで出るので、同時に見えているだけで因果はない。

### 5.2 変更

`moveUnits` の除外条件を変える。

```
交戦中でも、プレイヤーが指示した移動（controller === 'player' && goalPos !== null）が
残っているあいだは足を止めない
```

- 攻撃は今までどおり射程内の交戦相手に対して続く → **歩きながら撃つ**
- 目的地に着くと `goalPos` が `null` になり、以後は従来どおり交戦で足が止まる
- 走り抜けると `updateEngagements` の距離判定（`distance > u.range`）で対象が自動的に外れ、
  次の相手へ切り替わる
- **敵 AI の挙動は変えない**。近づいて止まって殴る。プレイヤーの指示という概念が敵にはない

### 5.3 あわせて直す入力バグ

`main.ts` の吹き出しタップ判定は `pointerdown` の時点で `return` するため、吹き出しの上から
始めたドラッグを丸ごと食う。これが要望1の「吹き出しが移動を邪魔する」のもう半分である。

判定を `pointerup` 側へ移す。`PointerStart` に「押し始めた位置にあった吹き出しの uid」を持たせ、
`pointerup` でタップ（移動量が `TAP_SLOP` 以下）だったときにだけ消す。ドラッグなら通常の
ジェスチャとして処理する。

## 6. 飛翔体（要望 4）

### 6.1 データ

`BattleState` に `projectiles` を足し、生成・更新・命中判定を新規 `src/core/projectiles.ts` に置く
（`sim.ts` はすでに 267 行あり、これ以上足すと読みづらい）。

```ts
export type Projectile = {
  id: string;
  kind: Exclude<AttackKind, 'melee'>;   // 'bow' | 'magic'
  sourceUid: string;
  sourceDefId: string;
  targetUid: string;
  pos: Vec2;
  /** 発射時に固定した攻撃側の値 */
  power: number;
  bondBonus: number;
  neraiuchi: boolean;
};
```

**攻撃側の値（`power` / なかよし支援 / ねらいうち）は発射時に固定し、防御側の値
（`guard` / ふんばり / `bowDamageCap`）は着弾時に評価する。** 撃った瞬間の腕前と、
当たった瞬間の守りで決まる、という読み方ができる。

### 6.2 挙動

- **追尾する。** 目標を追いかけて必ず当たる。外れる弾を子ども向けの操作感に持ち込まない
- 目標が退場（`retired`）したら不発として消える
- 速度は攻撃種別ごとの定数（`constants.ts`）。弓 480 px/s、魔法 360 px/s。
  ユニット定義には持たせない（今のところ種別で決まれば足りる）
- `step` の順序: `resolveAttacks`（発射） → `updateProjectiles`（移動・命中） → `resolveRemoval`

### 6.3 イベントと演出

- `hit` イベントを**着弾時**に出す。ダメージ数字・ノックバック・HP バーの追従・称号カウンタ・
  撃破処理はすべて `hit` を経由しているので、これだけで表示タイミングが揃う
- 描画は `state.projectiles` を毎フレーム直接描く。シムは 1/60 固定なので位置は滑らかに出る
- 既存の `attackLine` エフェクト（弓の一瞬の線）は**廃止**する

## 7. ミストの魔法攻撃（要望 3）

- `AttackKind` に `'magic'` を足す（`schema.ts` の `ATTACK_KINDS`）
- `assets/units/mist.json`: `attack: "magic"`, `range: 140`, `attackInterval: 2.4`, `power: 5`,
  `role: "まほう"`。おまじない（回復）はスキルのまま残す
- `bowDamageCap` は `'bow'` にだけ効く（現状維持）。たてもちには魔法が通る、というアクセントになる
- `effectiveInterval` の「近接されると攻撃間隔が倍」を `kind !== 'melee'` に広げる。
  遠距離職は接近されると弱い、という一貫したルールにする
- 魔法も 6 節の飛翔体を通る。見た目は弓と別の色

## 8. 本拠地に到達したときの会話（要望 6）

- `StageDef` に `outro?: IntroLine[]` を足す。`intro` と同じ型・同じ検証関数を使い回す
- `main.ts` の `Phase` に `'outro'` を足す。`battle.phase === 'victory'` になった時点で
  `outro` があれば会話へ入り、読み終えてから `applyStageClear` → リザルトへ進む
- 会話中は `drawBattle` を静止画として描き、その上に `drawTalk` を重ねる。
  `battle.phase` はすでに `victory` なので `step` は何もしない
- 「とばす」は `save.clearedStageIds` にそのステージが入っていれば出す。`applyStageClear` は
  会話のあとなので、初回は出ず2周目から出る。**セーブ形式は変えない**

## 9. 画像アセットへの差し替え（追加要望）

### 9.1 現状

`assets/` は JSON だけで、画像は1枚もない。キャラは全部 Canvas の図形で描いている。

| 場所 | 現在の描画 |
|---|---|
| フィールド上のユニット | 色つきの丸（`draw.ts` の `drawUnits`、半径 `UNIT_R = 11`。敵は `maxHp >= 40` で 14） |
| ドラッグ中のプレビュー | 同じ丸（`draw.ts` の `drawDragPreview`） |
| 下パネルのポートレート | 色つきの丸（`screens.ts` の `drawBottomBar`、半径 15） |
| ステージ選択のロスター | 色つきの丸（`screens.ts` の `drawRoster`、半径 16） |
| 会話フェーズの話者 | 色つきの丸（`screens.ts` の `drawTalk`、半径 30） |
| リザルトの一覧 | 色つきの丸（`screens.ts` の `drawResult`、半径 14） |
| クラス（役割） | **表示なし**。`UnitDef.role` はあるが描いていない |

### 9.2 定義

`UnitDef` に `sprites` を足す。値は `assets/images/` 配下のファイル名だけを書く。

```json
{
  "id": "ines", "name": "イネス", "role": "ゆみ",
  "sprites": { "role": null, "face": null, "map": null }
}
```

| キー | 使う場所 | 画像が無いときのプレースホルダ |
|---|---|---|
| `role` | 下パネルのポートレート | `role` の文字（14px） |
| `face` | 下パネル / ステージ選択 / 会話の話者 / リザルト | 今の色つきの丸 |
| `map` | フィールド上のユニット / ドラッグプレビュー | 今の色つきの丸 |

- 初期状態は**全ユニット・全キーが `null`**。つまり見た目は現状のまま（クラスだけ文字が増える）
- あとで `assets/images/yumi.png` を置き、`"role": "yumi.png"` と書き換えれば画像に切り替わる。
  **コードは触らない**
- ファイル名を直接書く形にするので、複数ユニットで同じ画像を共有できる（クラスアイコンは共有される）。
  ロール名からファイル名を導く対応表をコードに持つ案は、新しいロールのたびにコード変更が要るので採らない
- 指定したファイルが `assets/images/` に無ければ**起動時エラー**。他のアセットと同じ方針。
  `null` は正常（＝プレースホルダ）
- `EnemyDef` は `UnitDef` を継承しているので、敵も同じ仕組みで絵を持てる
- 期待する形式: PNG・正方形。推奨サイズは `face` 128×128、`map` / `role` 64×64

> ファイル名を書かず「`<ユニットid>.png` があれば自動で使う」規約方式も検討したが、
> ファイル名を打ち間違えても黙ってプレースホルダのままになるため採らない。

### 9.3 読み込み

`engine/loader.ts` の `assetFiles()` の隣に置く。

```ts
export function imageUrls(): Record<string, string> {
  return import.meta.glob('/assets/images/*.png', { eager: true, query: '?url', import: 'default' });
}
```

- JSON と同じくビルド時に解決され、`base: '/play/character-tactics/'` 込みの URL になる。
  Cloudflare Workers Static Assets 上でもパスが壊れない
- 存在検証はファイル名の一覧を `buildRegistry` に渡して engine 側で行う。engine が持つのは
  文字列だけで、画像の読み込みも描画も知らない
- **ローディング画面は作らない。** `loader.ts` に書かれている「非同期ロードとローディング画面を
  作らずに済む」方針を保つ。`new Image()` に `src` を入れて放置し、
  `complete && naturalWidth > 0` になったフレームから描き始める。読み込み中の数フレームは
  プレースホルダが出るだけで、遊べなくなる瞬間はない

新規 `src/render/images.ts`:

```ts
export type ImageCache = { byName: Map<string, HTMLImageElement> };
export function makeImageCache(urls: Record<string, string>): ImageCache;
/** 読み終わっていなければ null を返す。呼び出し側はプレースホルダへ落ちる */
export function imageFor(cache: ImageCache, name: string | null): CanvasImageSource | null;
```

`ImageCache` は `EffectState` と同じように**引数で引き回す**。描画のモジュール変数にしない。

### 9.4 描画

画像とプレースホルダの分岐を**呼び出し側に散らさない**。散らすと、片方だけ位置がずれる。
それぞれ1本の関数に通す。

```ts
// render/sprites.ts
drawFace(ctx, center: Vec2, radius: number, def, images): void
drawMapUnit(ctx, center: Vec2, radius: number, def, images): void
// ui/screens.ts
drawRoleBadge(ctx, rect: Rect, def, images): void
```

- `drawFace` / `drawMapUnit` は、画像があれば直径 `2 * radius` の正方形に収めて描き、
  無ければ今までどおり `def.color` の丸を描く。**占める場所は同じ**
- 画像を丸くクリップはしない。丸く見せたいならアセット側でそう描く
- HP バー・選択中のリング・ふんばり／ねらいうちのリング・護衛の印・味方のはた・
  たてもちの盾は、画像の有無にかかわらず**今までどおり上に重ねる**。
  これらは絵ではなく状態の表示なので、絵に置き換わってはいけない

ポートレート1枚（129×80）の中身:

```
┌───────────────┐
│ ●  ロラン      │  顔 r13 + 名前 18px
│    [26×26]     │  クラス（画像 or role の文字）
│ ▬▬▬▬▬▬▬▬▬▬ │  HP バー
│ ▬▬▬▬▬▬▬▬▬▬ │  必殺技クールダウンバー
└───────────────┘
```

クラスの矩形は `layout.ts` の `roleBadgeIn(slot): Rect`（26高 × 84幅）が唯一の定義とし、
画像・文字・テストの3者が同じ値を見る。

## 10. 影響範囲

| ファイル | 変更 |
|---|---|
| `src/render/viewport.ts` | 論理解像度と `MAP_ORIGIN` |
| `src/ui/layout.ts` | ほぼ全面。ボタン・ポートレート・会話ウィンドウ・`roleBadgeIn` |
| `src/ui/screens.ts` | 下パネル、必殺技ボタン、ロスター、会話、リザルト |
| `src/render/draw.ts` | ユニット描画を `drawMapUnit` 経由に、飛翔体の描画、`attackLine` 削除 |
| `src/render/effects.ts` | `attackLine` 削除 |
| `src/render/images.ts` | 新規 |
| `src/render/sprites.ts` | 新規 |
| `src/core/sim.ts` | `moveUnits` の条件、飛翔体の呼び出し |
| `src/core/projectiles.ts` | 新規 |
| `src/core/combat.ts` | `effectiveInterval` を `magic` にも効かせる |
| `src/core/types.ts` | `Projectile`、`BattleState.projectiles` |
| `src/core/dialogue.ts` | `pickStageOutro` |
| `src/engine/schema.ts` | `magic`、`sprites`、`outro` |
| `src/engine/registry.ts` | 画像ファイルの存在検証 |
| `src/engine/loader.ts` | `imageUrls()` |
| `src/main.ts` | 入力の作り替え、`outro` フェーズ、画像キャッシュの生成 |
| `src/ui/input.ts` | `PointerStart` に吹き出しの uid |
| `assets/stages/*.json` | 3本とも縦向きに作り直し、`outro` を追加 |
| `assets/units/*.json` | `sprites`、ミストの `attack` / `range` / `role` |
| `assets/lines/common.json` | 本拠地会話の台詞 |
| `index.html` / CSS | 縦向きの表示設定 |
| `README.md` | 操作・構成・コンテンツの足しかた・ブラウザ確認手順 |

## 11. テスト

描画にはユニットテストを書かない方針を保つ。純ロジックとレイアウト計算に寄せる。

| 対象 | 見るもの |
|---|---|
| `core/sim.test.ts` | プレイヤー指示の移動中は交戦しても止まらない／到着後は従来どおり止まる／敵 AI は止まる |
| `core/projectiles.test.ts`（新規） | 追尾して命中する／目標が退場したら不発／攻撃側の値は発射時、防御側の値は着弾時に評価される |
| `core/combat.test.ts` | `magic` に `bowDamageCap` が効かない／近接されると `magic` も攻撃間隔が倍になる |
| `engine/schema.test.ts` | `magic` 種別／`sprites` の形／`outro` の検証（`intro` と同じ規則） |
| `engine/registry.test.ts` | 存在しない画像ファイル名で起動時エラー／`null` は正常 |
| `ui/layout.test.ts` | 新レイアウトが 540×945 に収まる／ポートレートが重ならない／`roleBadgeIn` がスロット内で HP バーと重ならない／`bubbleRectAt` のクランプ |
| `ui/input.test.ts` | 吹き出しの上から始めたドラッグが移動指示になる／タップなら吹き出しが消える |
| `ui/flow.test.ts` | `outro` 後にステージクリアが記録される |

ブラウザでの目視は README の CDP 手順を `--window-size=540,945` に読み替えて行う。
画像の差し替えはダミー PNG を1枚置いて確認する。

## 12. 実装の順番

縦化を先にやらないと、他のすべてが二度手間になる。

1. **縦画面の土台** — viewport / layout / index.html / ステージ3本 / 各画面の描画。
   ここまでで一度、縦のまま遊べる状態にする
2. **下パネル** — 必殺技ボタンの移動、クラス表示、吹き出しタップの `pointerup` 移行
3. **画像アセットの受け口** — `sprites` / `imageUrls` / `images.ts` / `sprites.ts`。
   プレースホルダのまま見た目は変わらないことを確認する
4. **移動しながら攻撃**
5. **飛翔体**（弓・魔法の共通基盤）
6. **ミストの魔法攻撃**
7. **本拠地に到達したときの会話**
8. README の更新
