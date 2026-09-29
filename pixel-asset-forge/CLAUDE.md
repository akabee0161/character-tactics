# pixel-asset-forge

ドット絵アセットを、テキストグリッドから決定的に生成するリポジトリ。

## 原則

- **グリッドが正、PNG は生成物。** アセットの絵を変えるときに編集するのは
  `assets/**/*.txt` だけ。`build/` 以下の PNG はいつ消してもよく、PNG を直接編集しない。
  **これは絵の入力をグリッドに一本化する規則であって、`tools/` `tests/` `sheets/` `docs/` の
  変更を禁じるものではない**（`tools/` を触ったら下記の unittest を通すこと）。
- **新規アセットを書く前に、必ず `types/<type>/SPEC.md` と `types/<type>/reference/` を読む。**
  絵柄は散文ではなく reference で揃える。
  `unit` は `reference/` を持たない。手本は `assets/unit/roran/`、複製の土台は `types/unit/base/` の素体。
- **目視の前に `tools/validate.py` を通す。** 行長・未定義文字・パレット外参照は
  機械で落とす。目視はそれを通ってからにする。
- **パレットに色を足すなら、描く前に `tools/probe_colors.py` で測る。**
  隣り合わせる**予定**のペアを先に当てて、`has_lightness_edge` か ΔE のどちらかを
  超える色を選んでから描く。描いた後に `check_colors.py` を通しても（実測どおり）
  ほとんど何も拾わないが、描く前に使うと設計の道具になる。草原セットでは樹冠の
  初案が `grass_base` と ΔE 5.9 で、描く前に却下できた。

  ```sh
  tools/probe_colors.py --candidate '#2e8055' --against grass_base grass_hi grass_shadow
  ```
  色を足した後も `tools/check_colors.py` は通すこと。ただし**目視の代替にはならない**
  （実測で、目視が見つけた11件のうちこのチェックが拾えたものは0件）。
- **`tile` 型は1枚の目視では終わらない。`tools/tilemap.py` で3通り見る。**
  どれも `validate.py` と `check_colors.py` を通過する欠陥で、機械チェックは無い。
  1. `--repeat` で継ぎ目（川の初版は境界に暗い帯が出た）
  2. `--repeat` で**反復が格子に見えないか**（`plain` は房が整列して壁紙になった）
  3. `--layout` で組んだマップで**別の物に見えないか**（切り株が木箱、井戸が手提げ桶、
     道標が台に見えた。拡大画像1枚では、自分が何を描いたか知っているので気付けない）
  **目視の締めは必ず `--layout` のマップにすること。**
- **`unit` 型も1枚の目視では終わらない。`tools/sheet.py` のプレビューと、ゲームで動かすこと。**
  1. プレビューの**赤い足元ライン(y=30)**。コマ間で足元や中心が1pxずれるとアニメがガタつくが、
     1コマの拡大画像では絶対に分からない
  2. **ゲームに入れて動かす。** character-tactics は canvas を 0.796倍で描いた実績があり、
     **1〜2pxの線は丸ごと消える**（振りかぶりの剣が消えた）。整数倍で表示される保証は無い。
     **ただし 0.796倍は経過的な課題。** ゲーム側で倍率が掛からないよう修正する予定で、いずれ
     縮小されなくなる。縮小で消えることを理由に絵を変えず、ドット絵単体の品質で描くこと
- **完成したら `tools/contact_sheet.py` を更新する。** 型をまたいだ絵柄のズレはここで見つかる。

## コマンド

```sh
.venv/bin/python tools/validate.py            # 構造の検査（異常時は非ゼロ終了）
.venv/bin/python tools/check_colors.py        # 隣接色の分離度（助言。hard failure のみ非ゼロ）
.venv/bin/python tools/probe_colors.py a b    # 2色が区別できるか（描く前に使う）
.venv/bin/python tools/render.py              # txt -> png（等倍と x8）
.venv/bin/python tools/tilemap.py             # tile を 3x3 で並べる（継ぎ目の確認）
.venv/bin/python tools/sheet.py sheets/roran.txt  # unit のシートとプレビューを出す
.venv/bin/python tools/sets.py                # 16px の部品を組んで物を出す（build/sets/）
.venv/bin/python tools/contact_sheet.py       # build/contact_sheet.png
.venv/bin/python -m unittest discover -s tests  # tools/ を触ったとき
```

`tilemap.py --layout layouts/{example,field,castle_interior,objects}.txt` でマップを組む。
新しいセットを作ったら、その全点を置いたレイアウトを `layouts/` に足すこと。

初回のみ（Python 3.14 を uv で）: `uv python install 3.14 && uv venv --python 3.14 .venv && uv pip install --python .venv/bin/python -r requirements.txt`

等倍 PNG は目視には小さすぎる。見るのは `_x8.png` の方。

## グリッドファイル形式

```
# type: face
# size: 32x32
# light: upper-left
# bg: gradient:#1c1834->#323256
# map: o=outline e=hair_hi f=hair_base g=hair_shadow
................................
（size で宣言した行数ぶん続く）
```

- `map` の値は `palette/master.json` のキー。色は必ずここ経由で参照する。
- `.` は背景。`bg` は `transparent` / `#rrggbb` / `gradient:#rrggbb->#rrggbb`。
- `# max_colors: N` を書くと使用色数の上限が検査される（任意）。
- コロンを含まない `#` 行はコメント。コロンを含む行は正しいヘッダでなければ失敗する。

## ミラーで作れるものをコピーで持たない

反転や回転で作れるアセットは、本体を持たない派生ファイルにする（HANDOFF 2.4）。

```
# from: river_ne.txt
# transform: mirror_x
```

変形は `mirror_x` / `mirror_y` / `rotate_180` / `rotate_cw` / `rotate_ccw`。
書かなかったヘッダは由来元から継承する。

**変形は光源を一緒に動かす。** 陰影が変形軸について対称なものにしか使えない。
川は使えるが、顔グラや城には使えない。`unit` にも使わない（`left` と `right` で装備の手前と奥が
入れ替わる。`types/unit/SPEC.md`）。機械では検査していない。

## 新しい機械チェックを思いついたら、まず偽陽性を数える

案の段階で良さそうに見えたチェックが、**3回とも実測して初めて撤回か下方修正に
なっている**。孤立ピクセル検査と継ぎ目チェックは撤回、`check_colors.py` は
しきい値を ΔE 22 から 10 へ。実装したら必ず既存アセット全件に掛けて
偽陽性を数えること。経緯は `docs/2026-09-23-findings.md` の「深いチェックを試して2回落としている」。

## 回帰テストに現役のアートを参照させない

`tests/` から `assets/` の生きているタイルを読むと、そのタイルを描き直したときに
テストが落ちる。実際に `river_v` の作り直しで落ちた。比較したい相手は
`tests/fixtures/` に固定する。

## 残っている課題は ISSUES.md にある

作業中に見つけて直していないものは `ISSUES.md` にまとめてある。
**新しく見つけたらそこに足すこと。** 報告して終わりにしない。直したら行ごと消す。
README は「リポジトリの使い方」を書く場所なので、課題を書かない。
（将来は GitHub Issues に移す予定。今は件数が多いのでローカルで管理している）

## 勝手に決めないこと

`docs/HANDOFF.md` の「3. 未確定のこと」を参照。

**確定済み:** 解像度は `face` = 32x32、`item` = 16x16、`tile` = 16x16、`unit` = 32x32。
`tile` はシームレス（全周に輪郭を回さない）。
`unit` は足元 y=30・左右中央・背丈24〜26px で、シート定義は `sheets/` に置く
（`assets/` の下に置くと `validate.py` / `render.py` がグリッドとして読んで落ちる）。

**未確定:** 目指す絵柄、アセットあたりの色数上限（`# max_colors:` は実装済みだが
どのアセットでも未使用）、マスターパレットの具体的な色、
`face` / `item` / `tile` / `unit` 以外の型の一覧、未定義の型の解像度、
`unit` で許す最小の線幅、`tile` をゲームへどう渡すか。必要になったら確認を取る。
