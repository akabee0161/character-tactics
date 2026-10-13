# pixel-asset-forge の置き場の整理（cand/ をなくし、部品を種類ごとに置く） 設計

作成: 2026-10-12

## 目的

`pixel-asset-forge/ISSUES.md` の2行を片付ける。

- 「`cand/` の中身と名前が合わず、コードとアセットの置き場が整理されていない」
- 「イネスの部品を描き直したスクリプトが作業フォルダにだけある」

時期は B（イネスの組み直し、PR #32）の後、C（ガウの組み直し）の前（2026-10-12 依頼者の判断）。
C・D で作る部品とスクリプトを、最初から整理後の置き場に置くため。

**絵は1画素も変えない。** 変えるのは置き場（パス）と、パスを書いているコード・設定・文書だけ。

## 今の状態（2026-10-12、main 86adaf4）

| 置き場 | 中身 | 使われ方 |
|---|---|---|
| `cand/enemy-frames/<id>/` | 敵16体のコマ（各24枚。斧・槍の12体は `noweapon/` も）672ファイル | `enemy/*.json` の `frames` が指す。`types/unit/SPEC.md` の `weapon_check.py` の例 |
| `cand/enemy/` | 敵の頭・目・服・髪・体の部品と、選ぶページの設定 `PICKER*.json`。110ファイル | `cand/gen/mkparts.py` が書き、`mkframes`・`mkweapons`・`mklayers`・`render_combos` が読む |
| `cand/gen/` | スクリプト10本 | 下の「スクリプト」を参照 |
| `cand/layer-trial/` | 層の試作の書き出し 98ファイル | `mklayers.py` だけ |
| `assets/part/dagger/` | 短剣（4方向） | `compose/gau.json`・`mkframes`・`mkparts` |
| `assets/unit/<名前>/parts/` | ロラン・イネス・ガウの部品 | `compose/<名前>.json`、`parts_export.py`（書き出し先） |

敵が `cand/` にあるのは、2026-10-06 に「選んでもらう候補」として作り、採用後も移さずに作り足したため（移さないと決めた記録は無い）。
`assets/part/` に短剣だけがあるのは、2026-10-04 にガウを描いたとき「ユニットをまたいで使い回す武器は `assets/part/`」と決めて置き、
後から切り出した剣・弓は「まだ1体しか使っていない」ので各ユニットの `parts/` に置いたため。この「何体が使うか」の切り口は時間で変わるので、やめる。

また、`tools/enemy_build.py`・README・テストが、女性の短剣の敵の元のコマの置き場として、まだ作っていない `assets/unit/enemy-src/dagger-female/` を指している
（`--colours dagger` は「置き場が無い（まだ作っていない？）」と言って止まる。予定の置き場として意図したもの）。整理後の決まりに合わせて `assets/unit/dagger-female/` にする。

もう一つ、敵の生成スクリプト（`mkparts`・`mkframes`・`mkweapons`）を今走らせると、部品（`cand/enemy/`）は今のファイルと同じになるが、
コマ（`cand/enemy-frames/`）は419ファイルが画素で変わる（2026-10-12 に確かめた）。コマは 2026-10-08 にコミットしたままで、
その後 2026-10-10 に手の輪郭の閉じ方（`hand_outline.py` の KEEP）を変えたため。今回は直さず、ISSUES.md に足す。

## 決めたこと（2026-10-12 依頼者）

1. 敵のコマ・部品・生成スクリプトは、D で置き換わる予定でも今回正式な置き場へ移す
2. 敵のコマは味方と同じ `assets/unit/<id>/`
3. 1体（または敵だけ）のためのスクリプトは `gen/<ユニット>/`。汎用の道具は今どおり `tools/`
4. 部品は「何の部品か」で `assets/part/<種類>/<名前>/` に置く。味方の部品も今回すべて移す。ファイル名は変えない
5. 試作と役目を終えたものは消す（下の一覧）

## 整理後の構成

```
pixel-asset-forge/
├── assets/
│   ├── unit/
│   │   ├── roran/ ines/ gau/                 組み上がったコマだけ（parts/ は無くなる）
│   │   └── axe-bandit/ … spear-thug-c-f/     敵16体（cand/enemy-frames/<id>/ から）
│   ├── part/                                 下の表
│   └── face/ item/ tile/                     変えない
├── gen/
│   ├── enemy/   mkparts.py mkframes.py mkweapons.py PICKER.json PICKER_female.json
│   ├── ines/    ines_layers.py
│   └── roran/   roran_layers.py
├── tools/                                    今あるもの + anim_compare.py reorder.py
├── compose/ sheets/                          場所は変えない（compose の部品のパスは書き換える）
└── enemy/*.json                              場所は変えない（frames を assets/unit/<id> に書き換える）
```

`cand/` は無くなる。

### `assets/part/`

| 種類/名前 | ファイル | 元の場所 |
|---|---|---|
| `equip/dagger/` | `dagger_*` | `assets/part/dagger/` |
| `equip/sword/` | `sword_*` | `assets/unit/roran/parts/` |
| `equip/shield/` | `shield_*`（`shield_hand_*` は含めない） | 同上 |
| `equip/bow/` | `bow_*`（`bow_hand_*` は含めない） | `assets/unit/ines/parts/` |
| `equip/arrow/` | `arrow_*`（`arrow_hand_*` は含めない） | 同上 |
| `fist/roran/` | `sword_hand_*` `shield_hand_*` | `assets/unit/roran/parts/` |
| `fist/ines/` | `bow_hand_*` `arrow_hand_*` | `assets/unit/ines/parts/` |
| `body/roran/` | `core_*` | `assets/unit/roran/parts/` |
| `body/ines/` | `core_*` | `assets/unit/ines/parts/` |
| `body/gau/` | `body_idle2_*` `body_noarm_*`（ガウ）、`gau_body_*`（男性の敵） | `assets/unit/gau/parts/`、`cand/enemy/` |
| `body/female/` | `female_gau_body_*` `female_body_idle2_*` `female_body_noarm_*` `female_walk_a_*` `female_walk_b_*` | `cand/enemy/` |
| `head/hood/` | `hood_*` | `assets/unit/gau/parts/` |
| `head/bandana/` `bare/` `full/` `horn/` | `head_<名前>_*` | `cand/enemy/` |
| `hair/gau/` | `hair_*` | `assets/unit/gau/parts/` |
| `hair/A/` `B/` `C/` | `hair_<名前>_*`（後ろ髪 `hair_<名前>_back_*` も） | `cand/enemy/` |
| `eye/E0/` … `E5/` | `eye_<名前>_*` | `cand/enemy/` |
| `cloth/belt/` `belt_female/` `none/` `tatter/` `tatter_female/` | `cloth_<名前>_*` | `cand/enemy/` |

`equip` は武器と盾の種類名（持ち物のアイコン `assets/item/` と紛らわしくしないため `item` を避けた）。
1体だけの部品は、名前をユニット名にする。

**限界（承知の上で進める）:** 剣・盾・弓・矢・拳・芯は1コマ1枚で、そのユニットの手の位置に合わせて切ってある。
`equip/sword/` に置いても、他のユニットにそのまま使い回せる形にはならない。敵の斧・槍は `mkweapons.py` の中のパッチで、ファイルになっていない（今回は変えない）。

### スクリプト

| 今 | 整理後 | 理由 |
|---|---|---|
| `cand/gen/mkparts.py` `mkframes.py` `mkweapons.py` | `gen/enemy/` | 敵を作る（D まで使う） |
| `cand/gen/ines_layers.py` | `gen/ines/` | イネスの部品の書き出し定義。走らせない（部品を上書きする）が、`parts_export.py` の定義の例として README・SPEC が指す |
| `cand/gen/roran_layers.py` | `gen/roran/` | ロランの部品の書き出し定義と表のページ。`layer_page.py` から借りている `png`・`uri` は、`tools/compose_page.py` の `png_uri` に替える（または同じ働きの関数を持たせる） |
| イネスの作業フォルダの `anim_compare.py` | `tools/anim_compare.py` | シート2枚を並べて再生するページ。4回使った。コマ数と fps がイネスの値で固定なので、ゲームのユニット設定（`assets/units/<ユニット>.json` の `sprites.map`）から読むようにして、どのユニットにも使えるようにする |
| イネスの作業フォルダの `reorder.py` | `tools/reorder.py` | compose の設定の重なり順を変えた写しを作る。どのユニットにも使える |
| `cand/gen/mklayers.py` `layer_page.py` `table_page.py` と `tests/test_mklayers.py` `test_layer_page.py` `test_table_page.py` | 消す | 層の試作。D で部品から組み直す計画で置き換わる（ISSUES.md） |
| `cand/layer-trial/` | 消す | 同上の書き出し |
| `cand/gen/build_sheets.py` | 消す | レシピの `frames` ができて役目を終えた（ISSUES.md） |
| `cand/gen/render_combos.py` | 消す | 部品の組み合わせ候補の画像。選ぶ段階は終わった |
| `tools/layers.py` のうち `mklayers` だけが使う部分 | 消す | 実際に他から使われていないかを計画で確かめてから |

`tools/` へ移す2本は、`tools/` のほかの道具と同じく、テストを足す。

**移さないもの:**

- イネスの作業フォルダの `build_dir.py`・`data_*.py`: 作業フォルダの `orig/` を前提にしたイネス専用の描き直しで、今走らせるとイネスの部品を上書きする。作業フォルダに残す（消さない）。C で同じ処理が要ったら、汎用にして `tools/` へ移す
- ガウの作業フォルダのスクリプト17本（ISSUES.md の「組み立てた後の描き足しが forge の道具になっていない」）: 決まりどおり C のときに判断する

## 書き換えるもの

- コード: `gen/enemy/*.py` の読み書きのパス（`mkparts.py` は部品を種類ごとのフォルダへ書く）、`tools/enemy_build.py`（`SOURCES` の `enemy-src`）、
  `tools/parts_export.py`（部品の書き出し先。部品の定義 `PartDef` に置き場 `dir`（`assets/part/` からの相対、例 `equip/bow`）を持たせ、芯は `body/<ユニット>/` に書く）、`tools/` の説明文のパス（`weapon_check`・`unit_picker`・`present`・`hand_outline`・`body_check`・`compose`・`compose_page`）
- 設定: `compose/{roran,ines,gau}.json` の部品のパス、`enemy/*.json` の `frames`、`gen/enemy/PICKER*.json`
- テスト: パスを書いているもの（`test_enemy_build`・`test_parts_export` など）
- 文書: forge の README・CLAUDE.md・`types/unit/SPEC.md`・ISSUES.md、character-tactics の `.coderabbit.yaml`・HANDOVER.md（パスを書いている所だけ）
- `.coderabbit.yaml`: `cand/` の除外3行を消す。`gen/` はレビュー対象のまま。`assets/**` の除外は今のまま

`docs/superpowers/` の過去の spec・plan・台帳は作成時点のログなので書き換えない。

### ISSUES.md

- 消す行: 「`cand/` の中身と名前が合わず…」「イネスの部品を描き直したスクリプトが作業フォルダにだけある」「`cand/gen/build_sheets.py` が色替え済みのシートを上書きする」「`mklayers --check` が試作の書き出し済みコマで FAIL 23件」「`weapon_check.py` の docstring の例が無いディレクトリを指す」（説明文を直すので）
- 書き換える行: パスが変わる行（`weapon_check.py --far-shade`、短剣の敵4体の作り直し、レシピが読む元のコマが `validate.py` の範囲に無い、など）。
  「レシピが読む元のコマが `validate.py` の既定の範囲に無い」は、敵のコマが `assets/` に入って既定で検査されるようになるので消す
- 足す行: 作業中に見つけたもの

## 確かめ方（絵が変わっていないこと）

作業前に次を取っておき、作業後に同じであることを確かめる。

1. `tools/enemy_build.py --all` で作る敵16体のシートの PNG（ハッシュを比べる）
2. `tools/compose.py compose/<名前>.json --check`: ロラン・イネスは差なし、ガウは今と同じ16コマが差あり（手で描き足したコマ。ISSUES.md 既出）
3. 部品・コマのファイルの中身: 移す前後で、ファイルの中身のハッシュの集合が同じ（`git mv` なので名前以外は変わらない）
4. `gen/enemy/` の3本を走らせた結果が、移す前に `cand/gen/` の3本を走らせた結果（作業用フォルダに控えた）と、ファイルごとに同じ。
   コミット済みのコマとは比べない（上の「もう一つ」のとおり、移す前から違う）。比べた後、走らせて変わったファイルは元に戻す
5. `tools/validate.py`（既定）: 今の405枚に、敵のコマと部品が加わって通る
6. `python -m unittest discover -s tests`: 全部通る（今は425件。消すテスト3本の分だけ減り、足すテストの分だけ増える）
7. `gen/roran/roran_layers.py <out.html>` が動く（`--export` は走らせない）。`gen/ines/ines_layers.py` は走らせない
8. character-tactics 側: `npm test` と `npm run build` が通る（ゲームは forge のパスを直接読まないが、念のため）
9. `grep -rn "cand/"` と `assets/unit/<名前>/parts`・`assets/part/dagger` が、`docs/` 以外に残っていない

## 範囲外

- 部品を他のユニットに使い回せる形にすること（剣を1コマ1枚でなく向きごとにする、斧・槍をファイルにする）
- 短剣の敵4体の作り直し、`/tmp/cand2` への依存（ISSUES.md 既出）
- ガウの作業フォルダのスクリプト
- ロランの拳の位置の見直し、C ガウの組み直し（この後の作業）
