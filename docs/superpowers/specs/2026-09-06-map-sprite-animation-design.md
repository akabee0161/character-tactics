# フィールド上のユニットをアニメーションさせる

作成日: 2026-09-06

## 1. 目的

`feat/vertical-pivot`（PR #9）で作った画像アセットの受け口は、1ユニット1枚の静止画までだった。
本書はそこを**スプライトシート**へ広げ、待機・歩行・攻撃の3状態と4方向をフィールド上で表示できる
ようにする。あわせて**仮アセットを生成器で作って同梱**し、絵が入った状態の見た目・当たり位置・
差し替え手順を実地で確かめられるようにする。

前提として、このゲームは下から上へ攻める。画面に一番長く出るのは `up`（背中）で、本番の絵を描く
ときの優先順位もそちらになる。

## 2. スコープ

### やること

1. `sprites.map` を「ファイル名の文字列」から**シート定義オブジェクト**へ変える
2. シートの実寸と JSON の突き合わせを vitest で検証する
3. `core` に `attack` イベントを足す（純粋な追加。既存の挙動は変えない）
4. アニメーションの状態計算を `src/render/anim.ts` に新設する（DOM に触らない純粋関数＋テスト）
5. フィールド描画をシート対応にし、HPバー・はた・選択リングなどのオフセットを実描画サイズ基準へ直す
6. 仮アセット生成器 `tools/gen-placeholder-sprites.mjs` を書き、生成した PNG をコミットする
7. README の「ユニットの絵」をシート規約に書き換える

### やらないこと

- **本番の絵の制作。** 本書で置くのは仮アセットまで。差し替えは PNG の上書きで済む
- **必殺技の専用モーション。** 攻撃モーションは通常攻撃だけに紐づける。スキルには既に `skill`
  イベントと `skillCast` 演出がある
- **被弾・死亡・退却のモーション。** 既存のノックバック・エフェクトのまま
- **8方向、斜め、左右反転による方向合成。** 4方向を素直に4行持つ
- **縦長フレーム**（32×48 など）。足元アンカーの規約が別途必要になるため、正方形に固定する
- **単体 PNG（旧 `map: "foo.png"`）との互換。** 実アセットがまだ無く、互換を残す相手がいない
- **補間描画。** 今も無く、シムが止まればアニメも止まるのが正しい
- **背景・立ち絵・BGM・SE**、およびセーブ形式の変更

## 3. シート形式

### 3.1 並びの規約

1ユニット1枚の PNG。列 = フレーム、行 = 12（3状態 × 4方向）。

```
行 0-3   idle   : down, up, left, right
行 4-7   walk   : down, up, left, right
行 8-11  attack : down, up, left, right
```

行番号 = `状態index × 4 + 方向index`。列数はシート全体で「最大フレーム数」に揃え、フレーム数が
少ない状態の余った右側は透明のまま置く（読まない）。フレームは正方形。

`idle=2 / walk=4 / attack=3 / frame=32` なら 128 × 384 px の PNG が1枚。ユニット4体・敵3体で7枚。

`down` は手前向き（顔が見える）。

### 3.2 スキーマ（`src/engine/schema.ts`）

```ts
export type MapAnim = { frames: number; fps: number };

export type MapSheet = {
  /** assets/images 内のファイル名 */
  sheet: string;
  /** 1フレームの一辺。正方形 */
  frame: number;
  idle: MapAnim;
  walk: MapAnim;
  attack: MapAnim;
};

/** role と face は静止画のまま。動かす対象ではない */
export type Sprites = { role: string | null; face: string | null; map: MapSheet | null };
```

`map` は `null` か `MapSheet` のどちらか。`null` のあいだは今までどおり色つきの丸に落ちる。

JSON はこうなる。

```json
"sprites": {
  "role": "role-tate.png",
  "face": "roran-face.png",
  "map": {
    "sheet": "roran-map.png", "frame": 32,
    "idle":   { "frames": 2, "fps": 4 },
    "walk":   { "frames": 4, "fps": 8 },
    "attack": { "frames": 3, "fps": 12 }
  }
}
```

数値の範囲（`frame >= 1`、`frames >= 1`、`fps > 0`）は既存の `requireNumber` で見る。

`role` はクラス単位で共有する（`role-tate.png` / `role-yumi.png` / `role-mahou.png` /
`role-monomi.png` / `role-teki.png` の5枚）。`face` はユニット単位で7枚。敵の JSON には現在
`sprites` キー自体が無いので、3体ぶん追加する。

### 3.3 検証をどこでやるか

| 見るもの | どこで | なぜ |
|---|---|---|
| `sheet` のファイル名が `assets/images/` に実在するか | `registry.ts` の起動時検証（既存の `checkSprites` を拡張） | 名前の打ち間違いはその場で気づきたい |
| 数値の範囲 | `schema.ts` | 既存のヘルパで足りる |
| シートの実寸が `frame × 最大frames` × `frame × 12` と合っているか | vitest | 起動時には検証できない |

実寸を起動時に見られないのは、`images.ts` が方針として画像の読み込みを待たないから。起動時点では
幅も高さも分からない。代わりに `assets/images/*.png` の IHDR（先頭24バイト）を直接読み、対応する
JSON の `frame` / `frames` と突き合わせる単体テストを置く。PNG ヘッダの読み取りは依存ゼロで書ける。
行数を間違えたシートを置いたら `npm test` が落ちる、という形にする。起動時エラー画面よりも、
直す人にとって早い。

## 4. core の変更

`SimEvent`（`src/core/types.ts`）に1つ足す。

```ts
| { type: 'attack'; uid: string; defId: string; pos: Vec2; targetPos: Vec2 }
```

発火点は `src/core/sim.ts` の `resolveAttacks`、`u.attackCooldown = interval;` の直後。近接と
飛翔体の分岐より手前なので、両方が1回ずつ通る。純粋な追加で、既存の挙動は何も変わらない。

必殺技はこのイベントを出さない。

## 5. アニメーションの状態（`src/render/anim.ts` 新設）

DOM に触らない計算だけを置く。描画コードにはテストを書かない方針だが、ここはロジックなので
テストする。

```ts
export type Dir = 'down' | 'up' | 'left' | 'right';
export type AnimState = 'idle' | 'walk' | 'attack';

export type AnimStore = { byUid: Map<string, {
  dir: Dir; lastPos: Vec2; movingUntil: number; attackUntil: number; attackFrom: number;
}> };
```

| 関数 | すること |
|---|---|
| `noteAttacks(store, events, now, durationOf)` | `attack` イベントを受け、`dir` を `targetPos - pos` から決めて `attackUntil = now + duration` を立てる。`durationOf(defId)` は `attack.frames / attack.fps` を返す。シートが無い（`map: null`）ユニットには `null` を返し、その場合は向きだけ更新して攻撃状態にはしない |
| `updateMotion(store, units, now)` | 前フレームの `lastPos` との差分。動いていれば優勢な軸から `dir` を決め、`movingUntil = now + WALK_HOLD` を伸ばす |
| `frameOf(anim, sheet, now)` | `{ row, col }` を返す純粋関数 |
| `resetAnim(store)` | 戦闘の開始時に捨てる（`resetEffects` と同じ扱い） |

**時計は壁時計ではなく `battle.time`（シム時刻）を使う。** 補間描画は無く、シムが止まればアニメも
止まるのが正しい。テストも壁時計なしで書ける。

決めごとが3つある。

- **歩行判定にヒステリシスを入れる（`WALK_HOLD = 0.12` 秒）。** シムは `FIXED_DT = 1/60` の固定
  ステップ、描画は rAF。120Hz 端末では描画2回につきシム1回になり、差分ゼロのフレームが必ず出る。
  素直に差分だけで判定すると歩行と待機がちらつく
- **攻撃中は向きを攻撃方向に固定する。** このゲームは歩きながら撃つので、移動由来の向きと攻撃
  由来の向きが競合する。攻撃モーションは 3/12 = 0.25 秒、`attackInterval` は 1.4〜2.4 秒なので、
  固定されるのは時間の1〜2割
- **攻撃はループさせない。** 列は経過時間から求め、最終フレームでクランプする

呼び出しは `src/main.ts` の `update()` 内。`noteAttacks` は `spawnEffects(effects, battle.events)`
の隣（固定ステップのループの中）、`updateMotion` はループを抜けたあと。

## 6. 描画の変更

### 6.1 `sprites.ts` の `drawMapUnit`

シートがあるときの描画サイズは `frame` から決まる（等倍）。呼び出し側の `radius` は丸フォール
バック専用として残す。つまり絵が入った瞬間、味方は直径 22px から 32px になる。

### 6.2 `UNIT_R` に張り付いているオフセット

HPバー（`p.y - UNIT_R - 9`）、はた（`p.x + UNIT_R`）、選択リング（`UNIT_R + 10`）、指示の矢印
（`p.y - UNIT_R - 14`）が定数 11 を直接見ている。32px のスプライトを描くと全部が絵に食い込む。
実際に描いた半分の大きさを返す `drawHalf(def)`（シートがあれば `frame / 2`、無ければ従来の
radius）を作り、これらの基準を差し替える。

### 6.3 敵の大小

`enemyRadius(maxHp)` は丸フォールバック専用として残す（`map: null` のときの既存挙動を壊さない）。
スプライトの大小は `frame` で表す。仮アセットではボスのガルムだけ `frame: 48` にして、大きさの
手がかりを保ちつつ、ユニットごとに違うフレームサイズが通ることを実地で確かめる。

### 6.4 ドラッグプレビュー（`draw.ts` の `drawDragPreview`）

現在は `{ ...def, color }` で色を差し替えているが、画像には効かない。残像はスプライトを alpha 0.5
で描き、配置不可のときは赤いリングを上に重ねる。破線は既に赤くなるので、赤の手がかりは二重に
残る。オフスクリーンでの色合成は、この情報量に対して割に合わない。

### 6.5 `imageSmoothingEnabled`

`ctx.imageSmoothingEnabled = false` を `src/main.ts` の `resize()` の中に置く。`canvas.width` への
代入は 2D コンテキストの状態を全部リセットするので、生成時に1回入れるだけでは端末の回転や
ウィンドウのリサイズで補間が復活する。

## 7. 仮アセット

生成器を `tools/gen-placeholder-sprites.mjs` に置く。Node 標準の `zlib` だけで PNG を書く
（依存の追加なし）。キャラごとに体色・かぶりもの・武器を数行で定義し、そこから 12行 × N列を
機械生成する。`face`（128）と `role`（64）も同じ定義から出す。生成した PNG はコミットする。

**品質の見込みは正直に書いておく。** チビ体のシルエットで、前後は顔の点の有無、左右は横向きの
武器位置で区別する。歩行は脚の左右振り、攻撃は武器の突き出し。デバッグの丸よりは確実に良いが、
本番の絵には遠い。生成器は本番アセットが揃った時点で削除する前提で `tools/` に置く。

## 8. テスト

追加は3本。

| テスト | 見るもの |
|---|---|
| `src/render/anim.test.ts` | 状態（idle/walk/attack）・向き・フレーム算出。`WALK_HOLD` のヒステリシス、攻撃中の向き固定、攻撃のクランプ |
| `src/engine/sheet-size.test.ts` | `assets/images/*.png` の IHDR と、対応する JSON の `frame` / `frames` の突き合わせ |
| `src/engine/registry.test.ts`（追記） | `sheet` のファイル名が実在しないときに検証エラーになること |

既存の 528 件と `npm run build` は当然通す。加えて既存の CDP 手順でブラウザ目視を1回
（配置 → 戦闘 → 攻撃モーション → ドラッグプレビュー）。

## 9. 差し替え手順

PNG を上書きするだけ。フレーム数を変えるなら JSON の数値だけ直す。README の「ユニットの絵」の
項をこのシート規約に書き換え、`assets/images/README.txt` も合わせる。
