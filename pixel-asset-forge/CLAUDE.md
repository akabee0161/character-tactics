# pixel-asset-forge

ドット絵アセットを、テキストグリッドから決定的に生成するリポジトリ。

## 原則

- **グリッドが正、PNG は生成物。** アセットの絵を変えるときに編集するのは
  `assets/**/*.txt` だけ。`build/` 以下の PNG はいつ消してもよく、PNG を直接編集しない。
  **これは絵の入力をグリッドに一本化する規則であって、`tools/` `tests/` `sheets/` `docs/` の
  変更を禁じるものではない**（`tools/` を触ったら下記の unittest を通すこと）。
- **新規アセットを書く前に、必ず `types/<type>/SPEC.md` と `types/<type>/reference/` を読む。**
  絵柄は散文ではなく reference で揃える。
  `unit` は `reference/` を持たない。手本は `assets/unit/roran/`（剣と盾）と `assets/unit/ines/`（弓）と `assets/unit/gau/`（短剣）、複製の土台は `types/unit/base/` の素体（`male_*`・`female_*`）。
  新しい `unit` は `types/unit/SPEC.md` の「描く手順」（確認ポイント CP0〜CP4）どおりに描く。
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
.venv/bin/python tools/tilemap.py --unplaced  # どのレイアウトにも置かれていないタイル（あれば終了コード 1）
.venv/bin/python tools/item_check.py          # item の長い持ち物の形が軸 x+y=15 で左右対称か
.venv/bin/python tools/sheet.py sheets/roran.txt  # unit のシートとプレビューを出す
.venv/bin/python tools/sheet_gif.py sheets/roran.txt  # unit の動きを状態ごとの GIF にする（README 2.7）
.venv/bin/python tools/enemy_build.py enemy/dagger-bandit.json  # 敵のレシピから、元のコマ（frames）を色替えして敵のシートを作る（build/sheets/<id>.png）
.venv/bin/python tools/enemy_build.py --all                      # enemy/ の全レシピを作る
.venv/bin/python tools/enemy_build.py --colours dagger           # 男女の元のコマが使う色の差（女性の元のコマができるまで使えない）
.venv/bin/python tools/enemy_gallery.py build/enemy_gallery.html --ref build/sheets/gau.png:ガウ（味方）  # 敵を並べて動きを再生する確認ページ（依頼者へ渡す）
.venv/bin/python tools/unit_rules.py checks/gau.json  # unit の方針の確認をまとめて走らせる（自己チェック①。設定は checks/<ユニット>.json、例外に無い失敗で終了 1）
.venv/bin/python tools/order_check.py checks/gau.json  # 承認された重なり順（ほかに blade_height・still_check・height_check・tip_check・part_chars・eye_check・part_outline・fist_check。どれも同じ引数）
.venv/bin/python tools/tip_check.py --items checks/items.json  # item のアイコンの刃・鏃の先端が決まり1〜5（types/item/SPEC.md）に合うか。刃の文字は checks/items.json に書く
.venv/bin/python tools/unit_check.py assets/unit/ines --items klmstuw --core assets/part/body/ines  # unit の脚の中心（芯で測る）と増えた切れ目（unit_rules.py が設定ファイルから走らせる）
.venv/bin/python tools/weapon_check.py assets/unit/gau --blade stone_hi,stone_base --weapon wood_hi,wood_base,wood_shadow --hand skin_rose_hi,skin_rose_base,skin_rose_shadow --hidden left_atk_wind,up_atk_wind,up_atk_hit --depth down  # 武器と握る手（unit_rules.py が設定ファイルから走らせる。--arm は使わない）
.venv/bin/python tools/body_check.py assets/part/body/roran  # 体（core）の部品を単品で見た「当たり前」: 頭・胴・脚の中心、胴からのはみ出し、輪郭の切れ目、穴（--head/--trunk/--legs で行の範囲、--hanging で垂れた髪・かぶり物の文字、--no-protrusion で女性の体）
.venv/bin/python tools/hand_mirror.py compose/ines.json  # 攻撃以外のコマで、down と up・left と right の拳の位置が左右反転で合っているか
.venv/bin/python tools/hand_outline.py assets/part/fist/roran/sword_hand_down_base.txt --hand skin_rose_hi,skin_rose_base,skin_rose_shadow  # 拳の部品の輪郭の切れ目を出す（--write で直す）
.venv/bin/python tools/compose.py compose/gau.json --out /tmp/cand   # 素体と部品を重ねて unit のコマを組み立てる（手で直したコマは上書きせず止まる）
.venv/bin/python tools/compose.py compose/roran.json --check   # ロランは全24コマが部品から再現できる（拳が閉じていないと終了 2）
.venv/bin/python tools/compose.py compose/ines.json --check    # イネスは全32コマが部品から再現できる
.venv/bin/python tools/compose.py compose/gau.json --check     # ガウは全24コマが部品から再現できる
# gen/ines/ines_layers.py --export・gen/gau/gau_layers.py --export は描き直す前の書き出しに一度だけ使った。今走らせると描き直した部品を上書きするので実行しない（gen/roran/roran_layers.py --export も同じ理由で実行しない）（新しいユニットは tools/parts_export.py で同じ形の定義を書く）
.venv/bin/python tools/compose_page.py --help  # 部品と組んだ結果を層の順に並べる確認ページ（--dirs down,right のようにカンマ区切り）
.venv/bin/python tools/phone_sheet.py order compose/gau.json build/phone  # スマホで見る PNG（部品を奥→手前。今の絵と案を並べる diff・cmp もある。--help）
.venv/bin/python tools/anim_compare.py NOW.png CAND.png OUT.html --anim ../assets/units/ines.json --dirs down  # 今と案のシートを並べて再生する確認ページ（コマ数と fps はゲームのユニット設定から読む）
.venv/bin/python tools/reorder.py compose/ines.json OUT.json left bow,arrow,arrow_hand,CORE,bow_hand  # ある向きの重なり順だけを変えた compose の設定の写し
.venv/bin/python tools/face_down.py IMG N OUT_PREFIX  # 拡大されたドット絵の顔を N 升に戻す
.venv/bin/python tools/present.py OUT.png A.txt B.txt --ref face.png  # 案を並べて見せる画像
.venv/bin/python tools/unit_picker.py gen/enemy/PICKER.json --out build/picker/enemy.html  # unit の部品の案を組み合わせて選ぶページ（CP1 で必須）
.venv/bin/python tools/sets.py                # 16px の部品を組んで物を出す（build/sets/）
.venv/bin/python tools/contact_sheet.py       # build/contact_sheet.png
.venv/bin/python tools/export.py MAP DEST     # 対応表どおりにゲームへ書き出す（README 2.10）
.venv/bin/python -m unittest discover -s tests  # tools/ を触ったとき
```

`tilemap.py --layout layouts/{example,field,castle_interior,objects}.txt` でマップを組む。
新しいセットを作ったら、その全点を置いたレイアウトを `layouts/` に足すこと。`tilemap.py --unplaced` で確かめる。

初回のみ（Python 3.14 を uv で。uv が無ければ先に[インストール手順](https://docs.astral.sh/uv/getting-started/installation/)どおりに入れる）: `uv python install 3.14 && uv venv --python 3.14 .venv && uv pip install --python .venv/bin/python -r requirements.txt`

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
入れ替わる。`types/unit/SPEC.md`）。`unit` の派生は `validate.py` が落とす（2026-10-16）。顔グラや城は機械では検査していない。

## 新しい機械チェックを思いついたら、まず偽陽性を数える

案の段階で良さそうに見えたチェックが、**3回とも実測して初めて撤回か下方修正に
なっている**。孤立ピクセル検査と継ぎ目チェックは撤回、`check_colors.py` は
しきい値を ΔE 22 から 10 へ。実装したら必ず既存アセット全件に掛けて
偽陽性を数えること。経緯は `docs/2026-09-23-findings.md` の「深いチェックを試して2回落としている」。

## 回帰テストに現役のアートを参照させない

`tests/` から `assets/` の生きているタイルを読むと、そのタイルを描き直したときに
テストが落ちる。実際に `river_v` の作り直しで落ちた。比較したい相手は
`tests/fixtures/` に固定する。`tests/test_no_live_assets.py` が、テストが `assets/` を読むと落とす。
わざと出荷物を確かめるテストは、そのファイルの `ALLOWED` に理由を書く（2026-10-16）。

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
