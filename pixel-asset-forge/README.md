# pixel-asset-forge

ゲーム用ドット絵アセットを、テキストグリッドから決定的に生成するリポジトリ。
対象は Ankardo（子供向けゲーム）と [character-tactics](https://github.com/akabee0161/character-tactics)。

PNG を直接描かず、**1文字＝1ピクセルの文字グリッド**を git で管理し、ツールが PNG に変換する。

- git の差分が「1行＝1ピクセル行」になり、どこを直したか追える
- 再生成が決定的（同じテキストからは常に同じ PNG）
- 色は名前で参照するので、パレットを1か所直せば全アセットに効く

絵を描くのは主に Claude Code で、人間は依頼とレビューを担当する。
この README は**人間向けの手引き**である。Claude が守る作業規約は [`CLAUDE.md`](CLAUDE.md) にある。

**目次**

1. [セットアップ](#1-セットアップ)
2. [ツアー：コマンドを実行して仕組みを知る](#2-ツアーコマンドを実行して仕組みを知る)
3. [ファイルの地図](#3-ファイルの地図)
4. [Claude に新しいドット絵を描かせる](#4-claude-に新しいドット絵を描かせる)
5. [自分でグリッドを直す](#5-自分でグリッドを直す)
6. [確定していること / していないこと](#6-確定していること--していないこと)
7. [もっと知りたいとき](#7-もっと知りたいとき)

---

## 1. セットアップ

Python は 3.14 を使う（3.10 では `contextlib.chdir` を使うテストが落ちる）。venv は [uv](https://docs.astral.sh/uv/) で作る。

```sh
uv python install 3.14
uv venv --python 3.14 .venv
uv pip install --python .venv/bin/python -r requirements.txt
```

以降のコマンドは、すべてリポジトリの直下で `.venv/bin/python tools/<ツール>.py` の形で実行する。
ゲームリポジトリにコピーした forge では、「リポジトリの直下」は `pixel-asset-forge/` のこと。セットアップも含め、`cd pixel-asset-forge` してから実行する（ゲームのルートから書き出す手順は、ゲームの README にある）。
どのツールも `--help` で詳細が出る。

PNG は `build/` に出る。`build/` は git 管理外で、いつ消してもよい。
WSL なら `explorer.exe build` で Windows のエクスプローラーから画像を開ける。

---

## 2. ツアー：コマンドを実行して仕組みを知る

上から順に実行すると、テキストが PNG になり、検査され、並べて確かめられるまでの流れが一通り分かる。
所要10〜15分。どのコマンドもリポジトリの中身を変えない（`build/` に書くだけ）。

### 2.1 グリッドファイルを読む

いちばん小さいアセット、宝箱（16x16）の元テキストを見る。

```sh
cat assets/item/chest.txt
```

```
# type: item
# size: 16x16
# light: upper-left
# bg: transparent
# map: o=outline h=wood_hi w=wood_base s=wood_shadow
# map: d=wood_dark l=metal_hi n=metal_base v=metal_shadow
................
....oooooooo....
...ohhhhhwwwo...
..onhhhwwwwsno..
（16行続く）
```

**ヘッダ（`#` の行）**

| 行 | 意味 |
|---|---|
| `# type: item` | アセットの種類（`face` / `item` / `tile` / `unit`） |
| `# size: 16x16` | 幅×高さ。この後に16文字×16行が続く約束 |
| `# light: upper-left` | 光源の向き。**ツールは使わない。描き手への約束**で、明るい色を左上に置く |
| `# bg: transparent` | `.` の塗り方。`transparent` / `#rrggbb` / `gradient:#rrggbb->#rrggbb` |
| `# map: o=outline ...` | **文字 → 色名**の対応。複数行に分けてよい |

コロンを含まない `#` 行はコメントになる。コロンを含む行は正しいヘッダでなければエラーになる
（`# 説明: ...` のようなコメントは書けない）。

**色は2段階で決まる。**

```
グリッドの文字 'h'  →  map で色名 "wood_hi"  →  palette/master.json で "#c08b52"
```

ファイルに RGB を直接書かないので、`palette/master.json` を直せばその色を使う全アセットが変わる。
色を増やしたいときは `master.json` に足す（[2.6](#26-色を検査する) の手順で測ってから）。

**グリッド本体**は、そのまま絵として読める。`h`（明るい木）が左、`s`（影の木）が右に寄っているのは
左上から光が当たっているからで、両端の `n` の縦列が金具の帯である。

### 2.2 検査する

```sh
.venv/bin/python tools/validate.py assets/item/chest.txt
```

```
ok   assets/item/chest.txt  16x16  8 colours
```

`validate.py` が見るのは**形式だけ**である。

- 行数と各行の長さが `size` と一致するか
- グリッドの文字がすべて `map` で色名に割り当てられているか
- `map` の色名が `palette/master.json` にあるか
- `# max_colors: N` を書いた場合、使用色数がそれ以下か

**絵として正しいかは判定しない。** 目視の前に、数え間違いのような安い誤りを落とすための関門である。
引数なしで実行すると `assets/` と `types/*/reference/` と `types/*/base/` の全件を検査する。異常があれば終了コードが非ゼロになる。

### 2.3 PNG にして見る

```sh
.venv/bin/python tools/render.py assets/item/chest.txt
```

`build/item/chest.png`（等倍）と `build/item/chest_x8.png`（8倍）が出る。
**見るのは `_x8.png` の方。** 等倍は小さすぎて目視できない。

引数なしなら全アセットを描画する。`types/` 以下（`reference/` と `base/`）の PNG は git 管理下に置くため、
`build/` ではなくグリッドの隣に出る。

### 2.4 派生ファイル（反転・回転）

```sh
cat assets/tile/river_nw.txt
```

```
# from: river_ne.txt
# transform: mirror_x
```

グリッドを持たず、「`river_ne` を左右反転したもの」と宣言しているだけのファイルである。
ツールからは普通のファイルと区別がつかない。

- 変形は `mirror_x`（左右）/ `mirror_y`（上下）/ `rotate_180` / `rotate_cw`（時計回り）/ `rotate_ccw`（反時計回り）
- 書かなかったヘッダは元のファイルから引き継ぐ。回転なら `size` の幅と高さは自動で入れ替わる

**変形すると光の向きも一緒に動く。** 左上から光が当たった絵を左右反転すると、光は右上からになる。
だから川や道のような平らなものには使えるが、陰影のある顔や城の角には使えない。キャラ（`unit`）にも使わない。左右で装備の手前と奥が入れ替わるため。
この判断は機械では検査していない。

### 2.5 タイルを並べる

タイルは1枚で見ても分からない欠陥があるので、並べて確かめる。`tools/tilemap.py` は**検証用**で、
出力（`build/tilemap/`）はゲームに渡す成果物ではない。

**マップに組む：**

```sh
.venv/bin/python tools/tilemap.py --layout layouts/field.txt
```

`layouts/field.txt` はタイル名を空白区切りで並べたテキストで、1行がマップの1行になる
（`.` は空白、`#` はコメント）。`build/tilemap/field_tiled.png` を開くと草原のマップが見える。

**1枚を敷き詰める：**

```sh
.venv/bin/python tools/tilemap.py --repeat plain --grid 4x4
```

`build/tilemap/plain_tiled.png` で、16px ごとの境目が見えないこと、
同じ模様の繰り返しが格子や壁紙に見えないことを確かめる。

tile の目視は次の3通りで行う。**どれも機械チェックが無い**ので、人間と Claude の目が頼りである。

| 見方 | 何を見るか | 実際にあった欠陥 |
|---|---|---|
| `--repeat` | 継ぎ目が繋がるか | 川の初版は、並べると境界に暗い帯が出た |
| `--repeat` | 反復が格子に見えないか | `plain` の初版は草の房が整列して壁紙になった |
| `--layout` | マップに置いて別の物に見えないか | 切り株が木箱に、井戸が手提げ桶に見えた |

引数なしで実行すると、全タイルの 3x3 画像を一括で出す。

### 2.6 色を検査する

**描き終わった絵の検査：**

```sh
.venv/bin/python tools/check_colors.py -q
```

隣り合う2色が見分けられるかを測る。明度の差が十分なら合格、無ければ色の距離 ΔE（0 なら同じ色）で判定する。
現在は `knight` の瞳孔と輪郭が同じ色だという指摘が1件出る（[`ISSUES.md`](ISSUES.md) にある既知の課題）。

**描く前に色の候補を測る：**

```sh
.venv/bin/python tools/probe_colors.py --candidate '#3f8a3c' --against grass_base grass_hi grass_shadow
.venv/bin/python tools/probe_colors.py --candidate '#2e8055' --against grass_base grass_hi grass_shadow
```

1つ目は `grass_base` と `HARD`（ΔE 5.9、ほぼ同じ色）になり、2つ目は3つとも `OK` になる。
木の葉の色を決めたときの実例で、地面の緑をそのまま木に使うと地面に沈むことが描く前に分かった。
候補は `master.json` に足さなくても `#rrggbb` のまま測れる。

計算で分かるのは「2色が見分けられるか」だけで、色が合っているか・絵柄に合うかは判断できない。
実測では、目視で見つかった欠陥11件のうち `check_colors.py` が拾えたものは0件である。
**描く前に `probe_colors.py` で測るのが効く使い方**である。

### 2.7 キャラのスプライトシート

```sh
cat sheets/roran.txt
.venv/bin/python tools/sheet.py sheets/roran.txt
```

`sheets/roran.txt` は、`assets/unit/roran/` のどのコマをシートのどこに置くかの定義である
（形式は `layouts/` と同じ）。12行 = 3状態（idle / walk / attack）× 4方向（down / up / left / right）で、
同じコマを何度使ってもよい（歩行は `[base, walk_a, base, walk_b]`）。
定義に `# frames: idle=2 walk=4 attack=3` の行を書くと、`sheet.py` が各状態の列数とシートの横幅を
この宣言と照らし合わせ、食い違えば止まる。数はゲームの JSON の `sprites.map` と同じにする。

- `build/sheets/roran.png`（128×384）：**ゲームに渡す成果物**
- `build/sheets/roran_preview.png`：目視用。**赤い横線が足元 y=30**、青い縦線が左右中心。
  コマ間で足元が1pxずれるとアニメがガタつくが、1コマの拡大画像では分からない

最後に出る表は足元と中心の実測である。横向きの `atk_wind` と `atk_hit` の `off` は、剣が体の外に出て
外接矩形が広がるので中心がずれる、という仕様どおりの逸脱で、問題ではない。

動きを見るには、同じ定義から状態ごとの GIF を作る。

```sh
.venv/bin/python tools/sheet_gif.py sheets/roran.txt                 # idle / walk / attack の3本
.venv/bin/python tools/sheet_gif.py sheets/roran.txt --state attack  # 1本だけ
.venv/bin/python tools/sheet_gif.py sheets/roran.txt --fps attack=12 --scale 6
.venv/bin/python tools/anim_compare.py NOW.png CAND.png OUT.html --anim ../assets/units/ines.json --dirs down   # 今と案のシートを並べて再生する確認ページ
.venv/bin/python tools/reorder.py compose/ines.json OUT.json left bow,arrow,arrow_hand,CORE,bow_hand          # ある向きの重なり順だけを変えた設定の写し
```

- `build/sheets/roran_<状態>.gif`：4方向（down / up / left / right）を横に並べ、上の段は拡大、下の段は草の上に等倍（ゲームで描かれる大きさ）
- 速さの既定はゲームのロランと同じ（idle 4fps・walk 8fps・attack 6fps）。ほかのユニットで違うときは `--fps 状態=fps` で指定する（ゲームの JSON は読まない）
- GIF は表示時間を 1/100 秒単位でしか持てないので、10ms 単位に丸める（6fps の 167ms は 170ms）

静止画のシートでは良く見えた剣が、3コマを続けて動かすと不自然に見えることがある（ロランの攻撃の描き直しで実際にあった）。

見せる前に、`tools/unit_rules.py` で機械的に確かめられることをまとめて確かめる（`types/unit/SPEC.md` の自己チェック①）。

```sh
.venv/bin/python tools/unit_rules.py checks/gau.json
```

- 設定ファイル `checks/<ユニット>.json` に、素体の型（男性・女性）・芯に描いた髪とかぶり物の文字・承認された重なり順・部品の役割（武器と刃の文字・拳・動いてよい部品・動かない盾）・目の位置・`weapon_check.py` の指定・例外を書く（形は `tools/unit_config.py` の docstring）
- 今ある道具（`validate.py`・`compose.py --check`・`body_check.py`・`hand_mirror.py`・`unit_check.py`・`weapon_check.py`）と、方針の確認（重なり順・切っ先の高さ・動かない所と盾・背丈・刃と鏃の先端（決まり1〜5）・部品の文字・目・部品が閉じている・拳の大きさと握り）を順に走らせ、確認ごとに1行「ok／NG」を出す
- 例外に書いていない失敗が1つでもあれば終了コード 1、設定の誤り（知らないキー・無い部品・無いコマ・パレットに無い色名）は 2。例外は基本的に作らず、正しい絵が落ちたら道具の判定を直す
- `unit_check.py` の「増えた切れ目」は報告だけ（歩きの足先のようにわざと切れているものもあるので、1件ずつ目で確かめる）。`weapon_check.py` の `--arm` は使わない（体＋拳の方針、2026-10-16）
- 確認はそれぞれ単独でも走らせられる（`tools/order_check.py checks/gau.json` など）

髪・かぶり物・武器を素体抜きの部品として描いたユニットは、`tools/compose.py` で素体と重ねてコマにする。

```sh
.venv/bin/python tools/compose.py compose/gau.json --frames down_base --out /tmp/cand   # 案を作業フォルダへ
.venv/bin/python tools/compose.py compose/gau.json --check                              # assets/unit/gau/ と同じかを確かめる
```

組み立て方は `compose/<ユニット>.json` に書く（`assets/` の下に置くと `validate.py` がグリッドとして読んで落ちる）。
部品ごとに `front`（上に描く）か `back`（透明な画素にだけ描く。体に隠れる）を選び、`dx`・`dy` でずらす。
`front` は積んだ時点の一番手前へ、`back` は一番奥へ入る（`back` は体に近いものから先に書く）。拳の部品には `hand: true` を付けると、四方を輪郭で閉じているかを `--check` が確かめる。
ロランは全向きを、完全な単品の部品（体・剣・剣の拳・盾・盾の拳）で組んでいる（`compose/roran.json`。決まりは `types/unit/SPEC.md`「部品で組む規約」）。
イネスも全32コマを、芯・弓（弦を含む）・矢・弓の拳・矢の拳で組んでいる（`compose/ines.json`、部品は `assets/part/` の `body/ines/`・`equip/bow/`・`equip/arrow/`・`fist/ines/`）。
ガウも全24コマを、芯・短剣・短剣の拳・空き手の拳で組んでいる（`compose/gau.json`、部品は `assets/part/` の `body/gau/core_*`・`equip/dagger/dagger_<向き>_<状態>`・`fist/gau/`）。

```sh
.venv/bin/python tools/compose.py compose/ines.json --check     # 全32コマが部品から再現できる
.venv/bin/python tools/hand_mirror.py compose/ines.json         # 攻撃以外のコマで、down と up・left と right の拳の位置が左右反転で合っているか
.venv/bin/python tools/compose_page.py compose/ines.json build/ines_parts.html --dirs down   # 部品を奥→手前に並べた確認ページ
```

部品を持たない完成した絵を部品に分けるときは、`tools/parts_export.py` を使う（文字で切るので、同じ色の別の物も分けられる）。
ユニットごとの切り方（部品の文字・拳の箱・重なり順）は `gen/<ユニット>/<ユニット>_layers.py` に書く（イネスは `gen/ines/ines_layers.py`、ガウは `gen/gau/gau_layers.py`。書き出すのは部品と設定だけで、コマは書かない）。
書き出しは描き直す前に一度だけ使う。部品を描き直した後に走らせると上書きするので、イネス・ガウでは実行しない。
手順は `types/unit/SPEC.md` の「描く手順」。
組み立てた後に手で直したコマは組み立て結果と違うので、`compose.py` は上書きせずに止まる（`--force` を付けたときだけ上書きする）。

部品の案を一括で作ったら、`tools/unit_picker.py` で組み合わせを選ぶページを書き出して依頼者に渡す（必須。依頼者が頭の中で組み合わせを試さずに済むように）。

```sh
.venv/bin/python tools/unit_picker.py PICKER.json --out build/picker/gau.html
```

- 設定ファイルには、素体・要素（頭・短剣など）ごとの案と部品のパス・前後（`z`）・見本のユニットを書く。形は `tools/unit_picker.py` の先頭の説明
- 組み合わせは全部この道具が `compose.py` と同じ規則で組み立てておく（512 通りまで）。ページは4方向を同時に4倍とゲームの大きさで見せ、部品だけの絵、見本との比較、2つの要素の一覧を出す
- 選んだ組み合わせは `HA-KA-DB` のような記号で返してもらう

### 2.8 物のセット（16px の部品を組む）

```sh
cat sets/village.txt
.venv/bin/python tools/sets.py
```

村・岩・木のように1マス（32px）を占める物は、16px の部品4枚（`assets/tile/<物>_{nw,ne,sw,se}.txt`）で持ち、
組み方を `sets/<物>.txt` に書く（形式は `layouts/` と同じ。`.` は置けない）。

- `build/sets/<物>.png`（32×32）：**ゲームに渡す成果物**
- `build/sets/<物>_x8.png`：目視用

部品は普通のタイルなので、`tilemap.py --layout` で周りのタイルと並べて確かめられる（`layouts/objects.txt`）。

### 2.9 全アセットの一覧

```sh
.venv/bin/python tools/contact_sheet.py
```

`build/contact_sheet.png` に全アセットを型ごとに並べる。光の向き・輪郭・色味が
**型をまたいでずれていないか**を見るためのもの（1枚ずつ見ていると気付けない）。

### 2.10 ゲームへ書き出す（ゲームリポジトリにコピーしたとき）

forge をゲームリポジトリへコピーして使うときは、ゲームで使う生成物を対応表（JSON）に書き、
`tools/export.py` でゲームが PNG を読むフォルダへ書き出す。

```sh
.venv/bin/python tools/export.py ../sprites.json ../assets/images
```

対応表は `build/` からの相対パスを、書き出し先のファイル名に対応させる
（`{"tile/forest.png": "tile-forest.png", "sets/village.png": "tile-village.png"}`）。
`export.py` は `build/` を空にして全アセットを描き直してから、対応表どおりにコピーする。
対応表が誤っていれば（生成物が無い、名前が重なる など）何もコピーせずに止まる。
**このコマンドはリポジトリの外（書き出し先）を書き換える。** ツアーの他のコマンドと違うので注意。

### 2.11 敵のバリエーション（元のコマを色替えしてシートにする）

元のコマ（味方の完成コマ、または部品で組んだ敵のコマ）の色名を置き換えて、敵のシートを機械的に作る。画素は変えない。
経緯は `docs/superpowers/specs/2026-10-06-enemy-variants-design.md`（character-tactics）。

```sh
.venv/bin/python tools/enemy_build.py enemy/dagger-bandit.json   # build/sheets/<id>.png（と _preview.png）
.venv/bin/python tools/enemy_build.py --all                     # enemy/ の全レシピ
.venv/bin/python tools/enemy_build.py --colours dagger          # 男女の元のコマが使う色の差（女性の元のコマができるまで使えない）
```

- レシピは `enemy/<id>.json`（キー: `id` `name` `archetype` `body` `recolor` `frames`）。`id` はファイル名と同じ
- `archetype` は `dagger` `axe` `spear`（シート定義はどれも `sheets/gau.txt`）。`body` は `male` か `female`
- `frames` は元のコマの置き場（リポジトリからの相対パス）。今の16体（男性8・女性8）は `assets/unit/<id>`
  （部品で組んだコマ）を指す。`axe` `spear` では必須。
  書かなければ `dagger` の `male` は `assets/unit/gau/`、`female` は `assets/unit/dagger-female/`
  （`--colours` が比べるのもこの2つ。短剣の女性の元のコマはまだ無いので、今は置き場が無いと言って止まる）
- 部品で組んだコマの生成（cwd は forge の直下）: `gen/enemy/mkparts.py`（頭・目・服・長い髪の部品を `assets/part/` に、選ぶページの設定を `gen/enemy/PICKER*.json` に）→
  `gen/enemy/mkweapons.py`（斧・槍の男女の敵。敵の一覧は `gen/enemy/mkframes.py` の `ENEMIES`、女性の8体は
  `mkweapons.py` で足す）。女性の id は `<男性の id>-<髪 a・b・c>-f`（a 前髪ありのロング・b 前髪なしのロング・c ポニーテール）。
  今走らせると、コマはコミット済みのものと違う（`ISSUES.md`「敵の生成スクリプトの出力が、コミット済みのコマと違う」）
- `recolor` は「元のコマが使うパレット名 → 置き換え後のパレット名」。元のコマが使わない名前は止める
- 元のコマの絵を直したら `enemy_build.py --all` で作り直す。`build/` は生成物

### まとめ

```
palette/master.json（色名 → RGB）
        ↓ 参照
assets/**/*.txt（文字グリッド。# from: なら反転・回転で派生）
        ↓
validate.py ─────── 形式の検査
check_colors.py ─── 隣り合う色が見分けられるか（助言）
        ↓
render.py ────────── 1枚ずつ PNG（等倍 + x8）      目視の基本
tilemap.py ───────── タイルを並べる                 検証用
sheet.py ──────────── unit をシートに組む           ゲームに渡す成果物
sheet_gif.py ──────── unit の動きを GIF にする       目視用
sets.py ───────────── 部品を組んで物にする         ゲームに渡す成果物
export.py ─────────── 対応表どおりにゲームへ書き出す  ゲームにコピーしたとき
contact_sheet.py ─── 全点の一覧                     型をまたいだ比較

probe_colors.py ──── 描く前に色の候補を測る
```

---

## 3. ファイルの地図

```
README.md                  この手引き（人間向け）
CLAUDE.md                  Claude が守る作業規約（AI 向け）
ISSUES.md                  見つかっていて直していない課題
palette/master.json        色名 -> RGB。色は必ずここ経由で参照する
types/<type>/SPEC.md       型ごとの機械的な規約（寸法・構成・並び方）
types/<type>/reference/    合格済みのお手本。絵柄はここで揃える（`unit` は `reference/` を持たない。手本は `assets/unit/roran/`（剣と盾）・`assets/unit/ines/`（弓）・`assets/unit/gau/`（短剣）、土台は `types/unit/base/` の素体）
types/unit/base/           unit の素体（4方向）。新しい unit を複製して作る土台
assets/<type>/<name>.txt   アセットの元テキスト（これが正）
assets/unit/<unit>/        unit のコマ。味方3体と、部品で組んだ敵16体（`assets/unit/<敵の id>/`）
assets/part/<種類>/<名前>/  unit の部品。種類は equip・fist・body・head・hair・eye・cloth（`types/unit/SPEC.md`）
compose/<unit>.json        部品の組み立て方（tools/compose.py が読む）
enemy/<id>.json            敵のレシピ（tools/enemy_build.py が読む）
gen/<unit>/                1体（または敵だけ）のためのスクリプト（敵は gen/enemy）。汎用の道具は tools/
sheets/<unit>.txt          unit のシート定義
sets/<物>.txt              物のセットの定義（16px の部品をどう組むか）
layouts/<map>.txt          tilemap.py --layout に渡すマップ
tools/                     ツール一式（2章）
tests/                     tools/ のテストとフィクスチャ
build/                     PNG 出力（git 管理外）
docs/                      設計の経緯と実測記録（書いた時点のログ）
seed/face32.py             リポジトリ化前の原型。もう使っていない
```

今あるアセット：

| 型 | 点数 | 寸法 | 規約 |
|---|---|---|---|
| `face`（顔グラ） | reference 1点（`knight`） | 32x32 | [`types/face/SPEC.md`](types/face/SPEC.md) |
| `item`（小物） | 3点（`chest`・`sword`・`bow`） | 16x16 | [`types/item/SPEC.md`](types/item/SPEC.md) |
| `tile`（マップ） | 77点（草原57・城内20）。うち12点は物のセット3つ（村・岩・木）の部品 | 16x16（セットは 32x32） | [`types/tile/SPEC.md`](types/tile/SPEC.md) |
| `unit`（マップ上のキャラ） | 3体（ロラン・ガウ 24コマ、イネス 32コマ）＋素体 `male_*`・`female_*` 4方向ずつ。ほかに敵16体（24コマずつ。部品で生成し、`enemy_build.py` で色替えする） | 32x32 | [`types/unit/SPEC.md`](types/unit/SPEC.md) |

**「正」はテキストで、PNG は生成物。** 絵を変えるときに編集するのは `assets/**/*.txt` だけで、
PNG を直接編集しない。

---

## 4. Claude に新しいドット絵を描かせる

Claude Code をこのリポジトリで起動して依頼する。Claude は `CLAUDE.md` の規約に従って、
お手本を読み、描き、検査し、自分で目視してから提出する。人間の仕事は**依頼を具体的にすること**と
**Claude が見落とすものをレビューで拾うこと**である。

### 4.1 依頼の前に決めること

- **型**：`face` / `item` / `tile` / `unit` のどれか。これ以外の型は未定義で、
  寸法から決める必要がある（Claude は勝手に決めず、確認してくる）
- **何を描くか**：名前と、見た目の要点（素材、色、状態）
- **どこで使うか**：どのタイルの上・隣に置くか、どのマップに入るか。見え方の判断に効く
- **未確定の事項に触れるか**：[6章](#6-確定していること--していないこと) の「未確定」に触れる依頼なら、
  自分で決めて依頼に書く（例：新しい型の解像度、色数の上限）

### 4.2 依頼文の例

```
item 型で、回復薬の小瓶を1つ。ガラス瓶に赤い液体、コルク栓。
chest の隣に並べて違和感がない絵柄で。
```

```
tile 型で、草原セットに花畑の縁タイルを足したい。grass_flowers と plain の境目に使う。
全点を置いたレイアウトも layouts/ に足して。
```

```
unit 型で、敵の兵士を1体。ロランと同じ規約・同じシート構成で。
色は赤系の鎧。地面の草・道・床と区別できる色にして。
```

### 4.3 Claude が行うこと

依頼すると、Claude はおおむね次の順で進める（`CLAUDE.md` に書いてある手順）。

1. `types/<type>/SPEC.md` と `reference/` を読む（`unit` は手本の3体と `types/unit/base/`。描く順番は `types/unit/SPEC.md` の「描く手順」）
2. 新しい色が要るなら、`probe_colors.py` で隣り合う色と測ってから `master.json` に足す
3. `assets/<type>/<name>.txt` を書く
4. `validate.py` → `render.py` → `_x8.png` を自分で目視して直す
5. 型ごとの追加確認
   - `tile`：`tilemap.py` の `--repeat` と `--layout` で並べて見る。物のセットなら `sets.py` で組み、`layouts/objects.txt` で見る
   - `unit`：`sheet.py` のプレビューで足元と中心を見る
6. `check_colors.py` と `contact_sheet.py` を通す
7. 画像を示して提出する

### 4.4 レビューする

Claude は自分が何を描いたか知っているので、そう見えてしまう。**「何を描いたか知らない目」で
見るのが人間の役割**である。見る画像は型によって違う。

| 型 | 見る画像 | 見るところ |
|---|---|---|
| 全部 | `build/<type>/<name>_x8.png` | 何に見えるか。光が左上から当たっているか |
| `tile` | `build/tilemap/<map>_tiled.png`（`--layout`） | **マップの中で**別の物に見えないか。継ぎ目・格子が見えないか |
| `unit` | `build/sheets/<unit>_preview.png` | 足元が赤線に揃っているか。コマ間で体がずれないか |
| `unit` | ゲーム内（character-tactics） | 縮小表示で細部が消えないか（1〜2px の剣が消えた実績あり。ただし 0.796倍の縮小はゲーム側で修正予定の経過的な課題で、いずれ縮小されなくなる） |
| 全部 | `build/contact_sheet.png` | 既存のアセットと並べて浮いていないか |

**差し戻すときは、部位と症状を具体的に言う。** 行と文字で直せる粒度になる。

- 良い例：「蓋の金具が目立ちすぎる」「マップに置くと切り株が木箱に見える」「歩行の2コマ目だけ頭が1px高い」
- 悪い例：「もう少しかっこよく」「なんか違う」

過去の実測では、宝箱は5周、城は4周で収束している。周回の大半は目視による差し戻しで、
機械チェックが絵の誤りを見つけたことはほとんどない。

### 4.5 完成の条件

- [ ] `validate.py` が通る
- [ ] `check_colors.py` で新しい FAIL が出ていない
- [ ] `tile` なら `layouts/` のマップに置いて見た（新しいセットなら全点を置いたレイアウトを足した）
- [ ] `unit` ならプレビューとゲーム内で見た
- [ ] `contact_sheet.py` を更新して、既存のアセットから浮いていない
- [ ] 直さずに残したことを [`ISSUES.md`](ISSUES.md) に書いた
- [ ] コミットした（`build/` の PNG はコミットしない）

---

## 5. 自分でグリッドを直す

小さな修正なら、人間が直接テキストを直してもよい。

1. `assets/<type>/<name>.txt` を**等幅フォント**のエディタで開く（文字の列がピクセルの列になる）
2. 直したい文字を置き換える。行の長さを変えないこと
3. `.venv/bin/python tools/validate.py assets/<type>/<name>.txt`
4. `.venv/bin/python tools/render.py assets/<type>/<name>.txt` して `_x8.png` を見る

`# from:` の派生ファイルは元のファイルを直す。派生ファイルにグリッドを書くとエラーになる。

`tools/` を変更したら、ツールのテストを実行する。

```sh
.venv/bin/python -m unittest discover -s tests
```

---

## 6. 確定していること / していないこと

大元の整理は `docs/HANDOFF.md` の 3 節にある。ただしあれは作成時点のログなので、
現在の状態はこちらを見ること。

| | |
|---|---|
| **確定** | 解像度 `face` = 32x32、`item` = 16x16、`tile` = 16x16、`unit` = 32x32 |
| **確定** | `tile` はシームレス。全周に輪郭を回さない |
| **確定** | `unit` は足元 y=30・左右中央・背丈24〜26px。シート定義は `sheets/` に置く（`assets/` 不可） |
| **未確定** | 目指す絵柄（「SFC世代相当」以上の指定はない） |
| **未確定** | アセットあたりの色数上限。`# max_colors:` は実装済みだがどのアセットでも未使用 |
| **未確定** | マスターパレットの具体的な色 |
| **未確定** | `face` / `item` / `tile` / `unit` 以外の型と、その解像度 |
| **未確定** | `unit` で許す最小の線幅（0.796倍表示で1pxの刃が消えた。[実測](docs/2026-09-23-findings.md#ゲームに入れて分かったこと)。0.796倍はゲーム側で修正予定の経過的な課題で、いずれ縮小されなくなる） |
| **未確定** | `tile` をゲームへどう渡すか（1枚ずつの PNG / タイルセット / マップの完成品）。`tilemap.py` は検証用 |

未確定の項目は、Claude も勝手に決めない。決めたら依頼時に伝え、この表を更新する。

---

## 7. もっと知りたいとき

| 知りたいこと | 読むもの |
|---|---|
| 直していない課題 | [`ISSUES.md`](ISSUES.md) |
| 型ごとの細かい規約 | `types/<type>/SPEC.md` |
| Claude が守る作業規約 | [`CLAUDE.md`](CLAUDE.md) |
| なぜこの設計にしたか | [`docs/HANDOFF.md`](docs/HANDOFF.md) |
| 収束回数・試して落としたチェック・先行例などの実測記録 | [`docs/2026-09-23-findings.md`](docs/2026-09-23-findings.md) |
| ツールごとの設計経緯 | `docs/2026-09-*-spec.md` と `-plan.md` |

`docs/` 以下は書いた時点のログで、後から更新しない。現在の状態と食い違う場合は、
README・CLAUDE.md・ISSUES.md・`types/*/SPEC.md` の方が正しい。
