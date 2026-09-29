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

- `build/sheets/roran.png`（128×384）：**ゲームに渡す成果物**
- `build/sheets/roran_preview.png`：目視用。**赤い横線が足元 y=30**、青い縦線が左右中心。
  コマ間で足元が1pxずれるとアニメがガタつくが、1コマの拡大画像では分からない

最後に出る表は足元と中心の実測である。`atk_hit` と横向きの `atk_wind` の `off` は、剣が体の外に出て
外接矩形が広がるので中心がずれる、という仕様どおりの逸脱で、問題ではない。

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
sets.py ───────────── 部品を組んで物にする         ゲームに渡す成果物
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
types/<type>/reference/    合格済みのお手本。絵柄はここで揃える（`unit` は `assets/unit/roran/` が手本）
types/unit/base/           unit の素体（4方向）。新しい unit を複製して作る土台
assets/<type>/<name>.txt   アセットの元テキスト（これが正）
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
| `item`（小物） | 1点（`chest`） | 16x16 | まだ無い |
| `tile`（マップ） | 77点（草原57・城内20）。うち12点は物のセット3つ（村・岩・木）の部品 | 16x16（セットは 32x32） | [`types/tile/SPEC.md`](types/tile/SPEC.md) |
| `unit`（マップ上のキャラ） | 1体24コマ（ロラン）＋素体4方向 | 32x32 | [`types/unit/SPEC.md`](types/unit/SPEC.md) |

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

1. `types/<type>/SPEC.md` と `reference/` を読む（`unit` は `assets/unit/roran/` と `types/unit/base/`）
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
