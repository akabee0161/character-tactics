# `unit` 立ち絵4方向 実装計画

作成: 2026-09-25。**このファイルは作成時点のログ**。運用の最新は `README.md` と `CLAUDE.md` を見ること。
実行中に変わった判断は正典側に反映し、この計画書は遡って更新しない。

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ロランの立ち絵4枚（`{down,up,left,right}_base`）を「右手に剣・左手に盾、奥にあるものは隠す」規約で描き直し、そこから装備を持たない素体4方向を抽出して、他の unit に適用できる規約と実例1体を残す。

**Architecture:** 絵はすべて `assets/**/*.txt` のグリッドを手で描き、`validate.py` → `render.py` → 目視の順で詰める。ツールの変更は、素体の置き場所 `types/*/base` を既定の検査対象に加える1点だけ。4方向の整合は `contact_sheet.py` にファイルを4つ渡して横に並べて見る（新しいツールは作らない）。

**Tech Stack:** Python 3 + Pillow（既存の依存だけ）、`unittest`。

**Spec:** `docs/2026-09-25-unit-standing-pose-spec.md`

## Global Constraints

すべてのタスクの要件にこの節が暗黙に含まれる。

- **絵柄（パレット・頭身・服装）は変えない。** 直すのは体の向きと物の持ち方だけ
- **右手に剣、左手に盾。**
- **4方向の幾何:**

  | 方向 | 右手（剣） | 左手（盾） |
  |---|---|---|
  | `down` | 画面**左**・手前・全体が見える | 画面**右**・手前・全体が見える |
  | `up` | 画面**右**・奥 | 画面**左**・奥 |
  | `left` | **奥**（体の向こう） | **手前**（カメラ側） |
  | `right` | **手前**（カメラ側） | **奥**（体の向こう） |

- **奥にあるものは、体に重なる部分を描かない。** 輪郭からはみ出す部分だけを `*_shadow` 系で描く。
  「全体を見せて暗くする」は不可
- **横向き（`left` / `right`）では盾・剣とも幅を大きく削る。** 盾は薄い板の側面、剣は刃の側面
- **縮小表示での見え方は考慮しない**（依頼者の指定）。幅はドット絵単体としての品質で決める
- **`unit` に mirror を使わない。** `right_base` は本体グリッドにする
- **顔の造作:**
  - 顔の内部に `outline` を使わない。例外は目だけ（正面は1pxの点2つ、横顔は1pxの点1つ）
  - 横顔の鼻は1行だけ、1px。その行だけ顔の前端を輪郭より1px出す。上下の行は輪郭と揃える
  - 横顔の目は `outline` 色の1pxの点1つ。両目を描かない
  - 口は描かない
  - 顔の縦位置は4方向で揃える。**目の行は y = 11**（現行の `down_base` と同じ）
- **構図: 足元 y = 30、左右中央、背丈 26px（y = 5〜30、輪郭込み）**。`# light: upper-left`、`bg: transparent`
- **`base` 以外の20コマ（4方向 × `breathe` / `walk_a` / `walk_b` / `atk_wind` / `atk_hit`）には触らない**
- **新しい機械チェックを足さない。** 計画中の確認コマンドは、その場限りの確認に使う
- **ゲーム内での確認は今回しない**（依頼者の指定）
- **`tests/` から `assets/` の現役アートを参照しない**
- **コミットは Conventional Commits + 日本語の要約**
- Python は必ず `.venv/bin/python` で動かす
- ブランチは `feat/unit-standing-pose`（作成済み。現在のチェックアウトで作業する）

## Review Focus

どのテストも踏まないが、使う人がいちばん踏みそうな失敗。上から順に起こりやすい。

1. **`down` と `up` で剣と盾の画面上の左右を取り違える**
   → `down` では剣が画面左、`up` では画面右になる。Task 2・3 の Step「剣の位置を数える」で確認する
2. **`right_base` が mirror 派生のまま残るか、光源が反転したまま描かれる**
   → `# from:` が無く、ハイライトが左上に寄っていること。Task 5 の Step「光源の向きを数える」で確認する
3. **4方向で足元・中心・背丈がずれる**
   → 4枚とも足元 y=30、中心 15.5±1、背丈26。各描画タスクの Step「足元・中心・背丈を数える」で確認する
4. **素体に髪・装備・ベルト・ブーツの色が残る**
   → 素体の色は `outline` と `skin_*` 3色と `cloth_*` 3色だけ。Task 6 の Step「素体の色を数える」で確認する
5. **`default_targets()` の単体テストは通るのに、実際のリポジトリで素体が拾われない**
   → 引数なしの `validate.py` の出力に `types/unit/base/` の4行が出ること。Task 6 で確認する

---

## File Structure

| ファイル | 責務 | タスク |
|---|---|---|
| `tools/validate.py` | `default_targets()` に `types/*/base` を加える（`root` 引数を足してテスト可能にする） | 1 |
| `tools/render.py` / `tools/check_colors.py` / `tools/contact_sheet.py` | docstring と `--help` の既定対象の説明だけを直す | 1 |
| `tests/test_tools.py` | `DefaultTargetsTest` を足す | 1 |
| `assets/unit/roran/down_base.txt` | 描き直す | 2 |
| `assets/unit/roran/up_base.txt` | 描き直す | 3 |
| `assets/unit/roran/left_base.txt` | 描き直す | 4 |
| `assets/unit/roran/right_base.txt` | mirror 派生から本体グリッドに置き換える | 5 |
| `types/unit/base/male_{down,up,left,right}.txt` と PNG | 素体。新規 | 6 |
| `types/unit/reference/` | 12ファイルとも削除 | 7 |
| `types/unit/SPEC.md` / `CLAUDE.md` / `README.md` / `ISSUES.md` | 規約と文言を合わせる | 1, 7 |

**描く順は `down` → `up` → `left` → `right`。** `down` は持ち手を左右入れ替えるだけで、未知が最も少ない。
`up` で「奥は隠す」を初めて試し、`left` で横向きの薄い装備と横顔を試し、最も手間のかかる `right`
（光源は据え置いたまま、装備の前後を反転させる）を最後にする。**各描画タスクの終わりは依頼者のゲート**で、
差し戻しがあればそのタスクの中で直す。

**グリッドのヘッダ（全4枚共通）。** 文字の割り当ては現行のものを引き継ぐ。奥の剣に使う `stone_shadow` を
`k` として1つ足す。

```
# type: unit
# size: 32x32
# light: upper-left
# bg: transparent
# map: o=outline a=skin_hi b=skin_base c=skin_shadow
# map: e=hair_hi f=hair_base g=hair_shadow h=hair_dark
# map: p=cloth_hi q=cloth_base r=cloth_shadow
# map: m=metal_hi n=metal_base s=metal_shadow
# map: i=stone_hi j=stone_base k=stone_shadow
# map: w=wood_base x=wood_shadow
```

`validate.py` も `check_colors.py` も使われていない map 項目を問題にしないので、`k` を使わない絵（`down`）に
書いておいても害は無い（使用色数は実際に使った文字だけから数える）。

**4方向を並べて見るコマンド**（Task 2〜5 で使う。まだ描き直していない方向も並べて、差を見る）:

```sh
.venv/bin/python tools/contact_sheet.py \
  assets/unit/roran/down_base.txt assets/unit/roran/up_base.txt \
  assets/unit/roran/left_base.txt assets/unit/roran/right_base.txt \
  --scale 8 --columns 4 -o build/unit/roran_base4.png
```

**足元・中心・背丈を数えるコマンド**（Task 2〜6 で使う。`<png>` を差し替える）:

```sh
.venv/bin/python -c "
import sys
from PIL import Image
for p in sys.argv[1:]:
    a = Image.open(p).getchannel('A')
    l, t, r, b = a.getbbox()
    print(p, 'foot_y =', b - 1, '(30)', ' center_x =', (l + r - 1) / 2, '(15.5±1)', ' height =', b - t, '(26)')
" <png> ...
```

---

### Task 1: `default_targets()` に `types/*/base` を加える

**Files:**
- Modify: `tools/validate.py:1-24`（docstring と `default_targets`）、`tools/validate.py:47`（`--help`）
- Modify: `tools/render.py:4`・`tools/render.py:11-12`・`tools/render.py:58`（説明文だけ）
- Modify: `tools/check_colors.py:4`・`tools/check_colors.py:139`（説明文だけ）
- Modify: `tools/contact_sheet.py:47`（説明文だけ）
- Modify: `README.md:112`・`README.md:123-124`
- Test: `tests/test_tools.py`

**Interfaces:**
- Consumes: なし
- Produces: `default_targets(root: Path = REPO_ROOT) -> list[Path]`。返り値の順序は
  `root/assets` → `sorted(root/types/*/reference)` → `sorted(root/types/*/base)`。存在しないものは除く。
  既存の呼び出し元（`validate` / `render` / `check_colors` / `contact_sheet` の `main`）は引数なしで呼ぶので、変更は要らない

- [ ] **Step 1: 失敗するテストを書く**

`tests/test_tools.py` の import を次のように変える。

```python
from validate import collect, default_targets  # noqa: E402
```

`TargetPathTest` の直後に、次のクラスを足す。

```python
class DefaultTargetsTest(unittest.TestCase):
    """Unit bodies live in types/unit/base; every tool used to skip them."""

    def make_tree(self, *dirs: str) -> Path:
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        root = Path(tmp.name)
        for d in dirs:
            (root / d).mkdir(parents=True)
        return root

    def test_bases_follow_references(self):
        root = self.make_tree("assets", "types/face/reference", "types/unit/reference", "types/unit/base")
        self.assertEqual(
            default_targets(root),
            [
                root / "assets",
                root / "types/face/reference",
                root / "types/unit/reference",
                root / "types/unit/base",
            ],
        )

    def test_a_type_with_only_a_base_is_included(self):
        root = self.make_tree("assets", "types/unit/base")
        self.assertEqual(default_targets(root), [root / "assets", root / "types/unit/base"])

    def test_missing_directories_are_left_out(self):
        root = self.make_tree("types/tile")
        self.assertEqual(default_targets(root), [])
```

- [ ] **Step 2: 失敗を確かめる**

```sh
.venv/bin/python -m unittest tests.test_tools.DefaultTargetsTest -v
```

Expected: 3件とも ERROR。`TypeError: default_targets() takes 0 positional arguments but 1 was given`

- [ ] **Step 3: 実装する**

`tools/validate.py` の `default_targets` を置き換える。

```python
def default_targets(root: Path = REPO_ROOT) -> list[Path]:
    targets = [root / "assets"]
    targets += sorted((root / "types").glob("*/reference"))
    targets += sorted((root / "types").glob("*/base"))
    return [t for t in targets if t.exists()]
```

- [ ] **Step 4: 通ることを確かめる**

```sh
.venv/bin/python -m unittest tests.test_tools.DefaultTargetsTest -v
```

Expected: 3件とも ok

- [ ] **Step 5: 説明文を合わせる**

既定対象を説明している箇所を、次のとおり書き換える。挙動は Step 3 で変わっているので、文言だけを追従させる。

| 場所 | 旧 | 新 |
|---|---|---|
| `tools/validate.py:4`、`tools/render.py:4`、`tools/check_colors.py:4` | `# assets/ and every types/*/reference/` | `# assets/, every types/*/reference/ and types/*/base/` |
| 4ツールの `--help`（`targets` 引数） | `(default: assets/ and references)` | `(default: assets/, references and bases)` |
| `tools/render.py:11-12` | `because reference PNGs are committed.` | `because reference and base PNGs are committed.` |
| `README.md:112` | `` `assets/` と `types/*/reference/` の全件を検査する `` | `` `assets/` と `types/*/reference/` と `types/*/base/` の全件を検査する `` |
| `README.md:123` | `` `types/*/reference/` の PNG は git 管理下に置くため `` | `` `types/` 以下（`reference/` と `base/`）の PNG は git 管理下に置くため `` |

- [ ] **Step 6: 全体のテストと、既定の検査が変わっていないことを確かめる**

```sh
.venv/bin/python -m unittest discover -s tests
.venv/bin/python tools/validate.py -q; echo "exit=$?"
```

Expected: `Ran 116 tests ... OK`（既存113件 + 3件）。`validate.py` は `exit=0`（`types/*/base` はまだ無いので、対象は変わらない）

- [ ] **Step 7: Commit**

```bash
git add tools/validate.py tools/render.py tools/check_colors.py tools/contact_sheet.py tests/test_tools.py README.md
git commit -m "feat: 既定の検査対象に types/*/base を加える"
```

---

### Task 2: `down_base` を描き直す（剣と盾の左右を入れ替える）

**Files:**
- Modify: `assets/unit/roran/down_base.txt`

**Interfaces:**
- Consumes: なし
- Produces: 右手に剣を持つ `down_base`。Task 6 の素体抽出の元になる

- [ ] **Step 1: ヘッダを File Structure の共通ヘッダに置き換える**

変わるのは `# map: i=stone_hi j=stone_base k=stone_shadow` の1行だけ。

- [ ] **Step 2: 剣と盾を入れ替えて描く**

現行の絵は、盾が画面左（x = 7〜11、y = 17〜25）、剣が画面右（x = 21〜24、y = 18〜28）にある。これを逆にする。

- **剣を画面左、盾を画面右に置く。** 正面向きなので、両方とも手前で全体が見える
- **グリッドを左右反転してはいけない。** 光源が右上に移る。体・頭・顔の行は現行のまま残し、
  装備と、装備を持つ腕・手だけを描き替える
- 盾は画面右、つまり影側に来る。盾の中の階調は光源 upper-left のまま付ける
  （`metal_hi` を盾の左上、`metal_shadow` を右下）
- 盾で隠れていた画面左の腕と、剣で隠れていた画面右の腕は、入れ替えに合わせて描き直す
- 顔は現行のまま（仕様6節の規約を既に満たしている）。目は y = 11

- [ ] **Step 3: 構造の検査と描画**

```sh
.venv/bin/python tools/validate.py assets/unit/roran/down_base.txt
.venv/bin/python tools/render.py assets/unit/roran/down_base.txt
```

Expected: `ok   assets/unit/roran/down_base.txt`。`build/unit/roran/down_base_x8.png` が出る

- [ ] **Step 4: 足元・中心・背丈を数える**

File Structure の計測コマンドを `build/unit/roran/down_base.png` に対して流す。

Expected: `foot_y = 30`、`center_x` が 14.5〜16.5、`height = 26`。外れたら Step 2 に戻る

- [ ] **Step 5: 剣の位置を数える**（Review Focus 1）

```sh
.venv/bin/python -c "
import sys; sys.path.insert(0, 'tools')
from pathlib import Path
from gridfile import parse
for p in sys.argv[1:]:
    g = parse(Path(p))
    xs = [x for row in g.rows for x, c in enumerate(row) if g.charmap.get(c, '').startswith('stone_')]
    print(p, 'sword mean x =', round(sum(xs) / len(xs), 1) if xs else 'none')
" assets/unit/roran/down_base.txt
```

Expected: 15.5 未満（剣が画面左）。計画作成時の現行の絵では 22.5（画面右）

**注意:** `python - <<'EOF'` のような heredoc 形式は、このリポジトリの環境では安全フックに止められる。
計画中のスクリプトはすべて `python -c "..." 引数` の形で流すこと。`gridfile.parse()` は `Path` を要求する（`str` を渡すと `AttributeError`）

- [ ] **Step 6: 自分で目視し、4方向を並べる**

`build/unit/roran/down_base_x8.png` を見て、右手（画面左）に剣、左手（画面右）に盾を持っているかを確かめる。
次に File Structure の並べるコマンドで `build/unit/roran_base4.png` を出す（`down` 以外はまだ現行の絵）。

- [ ] **Step 7: 依頼者に `down_base_x8.png` を見せて判断を仰ぐ**

人間のゲート。**確認すること:** 剣と盾の持ち方が自然か、入れ替えで体の印象が変わっていないか。
差し戻されたら Step 2 に戻る。差し戻しの回数を控えておく（Task 7 の報告に使う）。

- [ ] **Step 8: Commit**

```bash
git add assets/unit/roran/down_base.txt
git commit -m "fix: ロランの正面立ち絵を右手に剣・左手に盾へ持ち替える"
```

---

### Task 3: `up_base` を描き直す（奥の装備を隠す）

**Files:**
- Modify: `assets/unit/roran/up_base.txt`

**Interfaces:**
- Consumes: Task 2 の `down_base.txt`（体の幅・腕の位置を揃える相手）
- Produces: 背面の `up_base`

- [ ] **Step 1: 奥に使う色の組を測る**

CLAUDE.md の規約どおり、描く前に測る。次の内容を scratchpad などに `pairs.txt` として書き、流す。

```
stone_shadow outline
stone_shadow cloth_shadow
stone_shadow cloth_base
stone_shadow cloth_hi
stone_shadow skin_shadow
metal_shadow outline
metal_shadow cloth_shadow
metal_shadow cloth_base
metal_shadow cloth_hi
metal_shadow skin_shadow
wood_shadow outline
wood_shadow cloth_shadow
wood_shadow cloth_base
```

```sh
.venv/bin/python tools/probe_colors.py --pairs pairs.txt; echo "exit=$?"
```

Expected: `13 pair(s): 0 would be flagged`、`exit=0`（計画作成時の実測でも全件 OK）。
flag が出たら、その組を隣り合わせない描き方にするか、依頼者に色の相談をする（パレットを勝手に変えない）

- [ ] **Step 2: ヘッダを共通ヘッダに置き換える**

- [ ] **Step 3: 背面を描く**

現行の絵は、剣が画面左に全体、盾が画面右に全体見えている。これを次のようにする。

- **剣（右手）は画面右・奥、盾（左手）は画面左・奥。** どちらも体の向こうにある
- **体に重なる部分は描かない。** 体の輪郭からはみ出す部分だけを描く。色は奥用の暗い側を使う
  （剣の刃は `stone_shadow`、柄は `wood_shadow`、盾は `metal_shadow` 主体。はみ出しの外周は `outline`）
- 例: 下げた剣の切っ先が腰の下で画面右にはみ出す、盾の縁が肩や腕の外に画面左ではみ出す、など。
  はみ出しの量は、`down` で見えている装備の大きさと矛盾しないように決める
- 結果として `down` と `up` のシルエットが違って見えること（仕様・背景7）
- 顔は描かない（背面）。髪の行は現行のまま

- [ ] **Step 4: 構造の検査と描画**

```sh
.venv/bin/python tools/validate.py assets/unit/roran/up_base.txt
.venv/bin/python tools/render.py assets/unit/roran/up_base.txt
```

Expected: `ok   assets/unit/roran/up_base.txt`

- [ ] **Step 5: 足元・中心・背丈を数える**

計測コマンドを `build/unit/roran/down_base.png build/unit/roran/up_base.png` に対して流す。

Expected: 両方とも `foot_y = 30`、`center_x` が 14.5〜16.5、`height = 26`

- [ ] **Step 6: 剣の位置を数える**（Review Focus 1）

Task 2 Step 5 のスクリプトを、引数を `assets/unit/roran/up_base.txt` にして流す。

Expected: sword mean x が 15.5 より大きい（剣が画面右）。計画作成時の現行の絵では 8.5（画面左）。
剣が完全に隠れて `stone_*` が0件だと `none` と出る。そのときは、切っ先を少しもはみ出させない構図で
よいかを Step 8 で依頼者に聞く

- [ ] **Step 7: 自分で目視し、4方向を並べる**

`up_base_x8.png` で、装備が体を貫通して見えていないか、はみ出しが輪郭の一部に見えて潰れていないかを見る。
並べるコマンドで `down` と `up` のシルエットの違いを見る。

- [ ] **Step 8: 依頼者に `up_base_x8.png` と `roran_base4.png` を見せて判断を仰ぐ**

**確認すること:** 背面だと分かるか、装備が体の向こうにあると読めるか、`down` と見分けられるか。
差し戻されたら Step 3 に戻る。

- [ ] **Step 9: Commit**

```bash
git add assets/unit/roran/up_base.txt
git commit -m "fix: ロランの背面立ち絵で体の向こうの剣と盾を隠す"
```

---

### Task 4: `left_base` を描き直す（横向きの装備と横顔）

**Files:**
- Modify: `assets/unit/roran/left_base.txt`

**Interfaces:**
- Consumes: Task 2・3 の `down_base` / `up_base`（背丈・顔の縦位置を揃える相手）
- Produces: 左向きの `left_base`。**Task 5 の `right_base` はこれを反転して作らない**

- [ ] **Step 1: ヘッダを共通ヘッダに置き換える**

- [ ] **Step 2: 体と装備を描く**

左向き（顔が画面左）。キャラクターの左手が手前、右手が奥になる。

- **盾（左手）は手前。** 腕に着けた板を横から見るので、**薄い板の側面**になる。現行の幅4px（輪郭込み）から
  大きく削る。色は `metal_*` の通常の階調（手前なので暗くしない）
- **剣（右手）は奥。** ほとんど体に隠れる。体の輪郭からはみ出す部分だけを `stone_shadow` / `wood_shadow` で描く
- 足の手前と奥の描き分け（手前 `cloth_base`、奥 `cloth_shadow`）は現行のまま。腕も同じ考え方で、
  手前の腕は明るく、奥の腕は見える部分だけを暗く描く
- 装備の幅は縮小を考慮せず、ドット絵単体として板・刃に見える幅で決める

- [ ] **Step 3: 横顔を描く**

現行の横顔は、顔の突出が y = 10〜11 の2行にわたり、顔の内部に `outline` が入っている。これを規約に合わせる。

- **目は y = 11 に `outline` の1pxを1つだけ。**
- **鼻は1行だけ、1px。** その行だけ顔の前端（画面左端）を上下の行より1px出す。目の直下の行（y = 12）を目安にする
- **顔の内部に目以外の `outline` を置かない。** 造作は `skin_hi` / `skin_base` / `skin_shadow` だけで示す
- 口は描かない
- 顔は光源側（左）を向くので、顔の前面は `skin_hi` / `skin_base` 主体でよい

- [ ] **Step 4: 構造の検査と描画**

```sh
.venv/bin/python tools/validate.py assets/unit/roran/left_base.txt
.venv/bin/python tools/render.py assets/unit/roran/left_base.txt
```

Expected: `ok   assets/unit/roran/left_base.txt`

- [ ] **Step 5: 足元・中心・背丈を数える**

計測コマンドを `build/unit/roran/{down,up,left}_base.png` に対して流す。

Expected: 3枚とも `foot_y = 30`、`center_x` が 14.5〜16.5、`height = 26`

- [ ] **Step 6: 自分で目視し、4方向を並べる**

`left_base_x8.png` で次を見る。

- 盾が手前の薄い板に、剣が体の向こうにあるように読めるか
- 横顔が「鼻の長い顔」に見えないか（依頼者の指摘1）
- 目の高さが `down` と同じか

並べるコマンドで `roran_base4.png` を出す。この時点で `right` は、新しい `left` の mirror 派生になっている
（光源と装備の前後が誤った状態）。Task 5 で置き換えるので、ここでは無視してよい。

- [ ] **Step 7: 依頼者に `left_base_x8.png` と `roran_base4.png` を見せて判断を仰ぐ**

**確認すること:** 横向きで盾が手前、剣が奥に見えるか。横顔が自然か。差し戻されたら Step 2 に戻る。

- [ ] **Step 8: Commit**

```bash
git add assets/unit/roran/left_base.txt
git commit -m "fix: ロランの左向き立ち絵で装備に奥行きを付け、横顔を直す"
```

---

### Task 5: `right_base` を本体グリッドにする

**Files:**
- Modify: `assets/unit/roran/right_base.txt`（`# from:` / `# transform:` の2行ヘッダを、共通ヘッダ + 32行に丸ごと置き換える）

**Interfaces:**
- Consumes: Task 4 の `left_base`（体の形・横顔の造作の参考。**反転コピーではない**）
- Produces: 右向きの `right_base`。4方向がそろう

- [ ] **Step 1: ファイルを共通ヘッダで書き直す**

`# from: left_base.txt` と `# transform: mirror_x` を削除し、共通ヘッダを書く。**`# from:` を残したまま
グリッドを足すと `validate.py` が落ちる。**

- [ ] **Step 2: 32行を描く**

右向き（顔が画面右）。キャラクターの右手が手前、左手が奥になる。`left` とは装備の前後が逆になる。

- **剣（右手）は手前。** 下げた剣の刃の側面が見える。色は `stone_*` / `wood_*` の通常の階調
- **盾（左手）は奥。** ほとんど体に隠れる。縁のはみ出しだけを `metal_shadow` で描く
- **光源は upper-left のまま。** `left_base` を反転して描き始めると光源も反転する。
  頭の後ろ側（画面左）が光を受け、顔（画面右）は影側になる。顔の前面は `skin_base` / `skin_shadow` 主体にする。
  体・腕・剣の階調もすべて左上を明るくする
- 横顔の規約は Task 4 Step 3 と同じ（目は y = 11 の `outline` 1px、鼻は y = 12 の1行1px、
  目以外の `outline` を顔に置かない、口なし）。鼻は画面右に1px出す
- 背丈・足の位置・胴の幅は `left_base` と揃える

- [ ] **Step 3: 構造の検査と描画**

```sh
.venv/bin/python tools/validate.py assets/unit/roran/right_base.txt
.venv/bin/python tools/render.py assets/unit/roran/right_base.txt
grep -c '^# from:' assets/unit/roran/right_base.txt
```

Expected: `ok   assets/unit/roran/right_base.txt`。`grep -c` は `0`（Review Focus 2）

- [ ] **Step 4: 光源の向きを数える**（Review Focus 2）

```sh
.venv/bin/python -c "
import sys; sys.path.insert(0, 'tools')
from pathlib import Path
from gridfile import parse
for p in sys.argv[1:]:
    g = parse(Path(p))
    def mean_x(suffix):
        xs = [x for row in g.rows for x, c in enumerate(row) if g.charmap.get(c, '').endswith(suffix)]
        return round(sum(xs) / len(xs), 1)
    print(p, ' _hi mean x =', mean_x('_hi'), ' _shadow mean x =', mean_x('_shadow'))
" assets/unit/roran/left_base.txt assets/unit/roran/right_base.txt
```

Expected: `right` でも `_hi` の平均 x が `_shadow` の平均 x より小さい（明るい側が左）。
計画作成時の現行の絵（mirror 派生）では `right` が 17.9 / 15.1 で逆転しており、このスクリプトで検出できる。
これは目安で、奥の装備の `*_shadow` が片側に寄ると差が縮む。逆転していたら、反転コピーになっていないかを見直す

- [ ] **Step 5: 足元・中心・背丈を数える**

計測コマンドを `build/unit/roran/{down,up,left,right}_base.png` の4枚に対して流す。

Expected: 4枚とも `foot_y = 30`、`center_x` が 14.5〜16.5、`height = 26`

- [ ] **Step 6: シートのプレビューが組めることを確かめる**

```sh
.venv/bin/python tools/sheet.py sheets/roran.txt
```

Expected: `build/sheets/roran.png` と `roran_preview.png` が出る。足元の実測表で、4方向の `base` が y=30 にある。
`breathe` / `walk` / `attack` は古い絵のまま（仕様11節で受け入れ済みの不整合）

- [ ] **Step 7: 自分で目視し、4方向を並べる**

並べるコマンドで `roran_base4.png` を出し、次を見る。

- `left` と `right` で装備の前後が逆になっているか（`left`: 盾が手前、`right`: 剣が手前）
- 4枚とも光が左上から当たっているか
- 4方向で奥行きの扱いが揃っているか（奥のものは隠れ、はみ出しだけが暗い）
- 目の高さが揃っているか

- [ ] **Step 8: 依頼者に `roran_base4.png` を見せて判断を仰ぐ**

**4方向の立ち絵を確定させるゲート。** **確認すること:** 背景の指摘1〜7がすべて解消しているか。
差し戻しが他の方向に及んだら、そのタスクに戻って直す。

- [ ] **Step 9: Commit**

```bash
git add assets/unit/roran/right_base.txt
git commit -m "fix: ロランの右向き立ち絵を mirror 派生から本体グリッドに置き換える"
```

---

### Task 6: 素体4方向を抽出する

**Files:**
- Create: `types/unit/base/male_down.txt` / `male_up.txt` / `male_left.txt` / `male_right.txt`
- Create: 同じ場所の `male_*.png` と `male_*_x8.png`（`render.py` がグリッドの隣に出す。reference と同じく git 管理する）

**Interfaces:**
- Consumes: Task 1 の `default_targets()`（`types/unit/base` を拾う）、Task 2〜5 で確定した4枚
- Produces: 装備・髪・顔の造作を持たない素体。次の unit を複製して作る土台

- [ ] **Step 1: 4枚をコピーし、ヘッダを素体用に変える**

```sh
mkdir -p types/unit/base
for d in down up left right; do cp assets/unit/roran/${d}_base.txt types/unit/base/male_${d}.txt; done
```

各ファイルの `# map:` を、次の3行だけにする（髪・装備・木・石の割り当てを消す）。

```
# map: o=outline a=skin_hi b=skin_base c=skin_shadow
# map: p=cloth_hi q=cloth_base r=cloth_shadow
```

この時点では、消した文字（`e f g h m n s i j k w x`）がグリッドに残っているので、`validate.py` は落ちる。
Step 2 で全部消せば通る。

- [ ] **Step 2: 装備・髪・顔の造作・服のデザインを取り除く**

**残すもの:** プロポーション（背丈26px、足元 y=30）、4方向のシルエット、腕と手の位置、光源 upper-left の基本の陰影、
足と腕の手前／奥の描き分け。

- **装備を消す。** 装備で隠れていた腕・手・胴は、見えるように描き足す（手は `skin_*`、腕は `cloth_*`）。
  装備のはみ出しだけだった部分は背景 `.` に戻す
- **髪を消す。** 頭の外形はロランの頭の輪郭をそのまま使い、内側を肌の3階調で塗る
  （光源 upper-left。左上を `skin_hi`、右下を `skin_shadow`）
- **顔の造作を消す。** 目・鼻の出っ張りを描かない。横向きは、鼻の1pxを輪郭に揃える
- **服のデザインを消す。** ベルト（`w`）は `cloth_base` に、ブーツ（`x`）は `cloth_shadow` にする。
  服は `cloth_hi` / `cloth_base` / `cloth_shadow` の3階調で、体の立体だけを示す

- [ ] **Step 3: 素体の色を数える**（Review Focus 4）

```sh
.venv/bin/python -c "
import sys; sys.path.insert(0, 'tools')
from pathlib import Path
from gridfile import parse
allowed = {'outline', 'skin_hi', 'skin_base', 'skin_shadow', 'cloth_hi', 'cloth_base', 'cloth_shadow'}
for p in sys.argv[1:]:
    g = parse(Path(p))
    used = {g.charmap.get(c, f'undefined {c!r}') for row in g.rows for c in row if c != '.'}
    print(p, 'extra:', sorted(used - allowed) or 'none')
" types/unit/base/male_down.txt types/unit/base/male_up.txt types/unit/base/male_left.txt types/unit/base/male_right.txt
```

Expected: 4行とも `extra: none`。`undefined 'h'` のような行が出たら、map から消した文字がグリッドに残っているので Step 2 に戻る

- [ ] **Step 4: 引数なしの検査で素体が拾われることを確かめる**（Review Focus 5）

```sh
.venv/bin/python tools/validate.py | grep types/unit/base
.venv/bin/python tools/render.py types/unit/base
```

Expected: `ok   types/unit/base/male_{down,left,right,up}.txt` の4行。PNG が `types/unit/base/` に出る

- [ ] **Step 5: 足元・中心・背丈を数える**

計測コマンドを `types/unit/base/male_{down,up,left,right}.png` に対して流す。

Expected: 4枚とも `foot_y = 30`、`center_x` が 14.5〜16.5、`height = 26`（ロランと同じ値）

- [ ] **Step 6: ロランと並べて目視する**

```sh
.venv/bin/python tools/contact_sheet.py \
  types/unit/base/male_down.txt types/unit/base/male_up.txt \
  types/unit/base/male_left.txt types/unit/base/male_right.txt \
  assets/unit/roran/down_base.txt assets/unit/roran/up_base.txt \
  assets/unit/roran/left_base.txt assets/unit/roran/right_base.txt \
  --scale 8 --columns 4 -o build/unit/base_vs_roran.png
```

上段が素体、下段がロランになる。**見ること:** 同じ体に見えるか。装備を外した腕が不自然な位置に浮いていないか。
4方向の向きが素体だけで読めるか。

- [ ] **Step 7: 依頼者に `base_vs_roran.png` を見せて判断を仰ぐ**

**確認すること:** 素体の範囲（髪を剥いだ頭を肌で塗る、ベルト・ブーツを服の色に落とす）がこれでよいか。
素体の汎用性は2体目まで検証できない（仕様11節）ので、ここで判断するのは「ロランから正しく抜けているか」だけ。

- [ ] **Step 8: Commit**

```bash
git add types/unit/base
git commit -m "feat: ロランの立ち絵から unit の素体4方向を抽出する"
```

---

### Task 7: `reference/` を廃止し、正典を合わせる

**Files:**
- Delete: `types/unit/reference/`（12ファイル）
- Modify: `types/unit/SPEC.md`
- Modify: `CLAUDE.md:11-12`（手本の規則）、`CLAUDE.md` の「ミラーで作れるものをコピーで持たない」節
- Modify: `README.md`（2.4節の mirror の説明、`:261` 付近のディレクトリ構成、`:279` の型の表、`:322` の手順1）
- Modify: `ISSUES.md`

**Interfaces:**
- Consumes: Task 1〜6 の成果物すべて
- Produces: 正典（README / CLAUDE.md / SPEC.md / ISSUES.md）が新しい規約と一致した状態

- [ ] **Step 1: reference を消す**

```sh
git rm -r types/unit/reference
grep -rn "types/unit/reference\|roran_.*_base" --include=*.md --include=*.py . | grep -v "^./docs/" | grep -v "^./.venv/"
```

Expected: `grep` の出力が、この後の Step で直す `ISSUES.md` の1行だけ。`docs/` 以下はログなので直さない

- [ ] **Step 2: `types/unit/SPEC.md` を書き換える**

1. 冒頭「絵柄は本文ではなく `reference/` で揃えること」を「絵柄は本文ではなく手本（`assets/unit/roran/`）で揃えること」にする。
   経緯の行に `docs/2026-09-25-unit-standing-pose-spec.md` を足す
2. 「ファイル配置」のコードブロックに1行足す。
   ```
   types/unit/base/<body>_<dir>.txt  素体（装備・髪・顔の造作なし）。新しい unit を複製して作る土台
   ```
3. 「右向きは左向きからの `mirror_x` 派生にしてよい。…依頼者の判断で採用している（ロラン）。」の段落を削除し、
   次の新しい節に置き換える。
   ```markdown
   ## 立ち絵4方向の規約

   決めた経緯は `docs/2026-09-25-unit-standing-pose-spec.md`。

   - **持ち物の標準は右手に剣、左手に盾。**
   - 4方向で手の前後を次のとおりにする

     | 方向 | 右手 | 左手 |
     |---|---|---|
     | `down` | 画面左・手前 | 画面右・手前 |
     | `up` | 画面右・奥 | 画面左・奥 |
     | `left` | 奥 | 手前 |
     | `right` | 手前 | 奥 |

   - **奥にあるものは、体に重なる部分を描かない。** 輪郭からはみ出す部分だけを `*_shadow` 系で描く
   - **横向きでは盾・剣とも幅を大きく削る。** 盾は薄い板の側面、剣は刃の側面になる
   - **`unit` に mirror を使わない。** `left` と `right` は手前と奥が入れ替わるので、反転では作れない。
     経過措置として、ロランの `right_*` のうち `base` 以外の5枚は mirror 派生のまま残っている（`ISSUES.md`）
   - **顔:** 顔の内部に `outline` を使わない（例外は目。正面は1pxの点2つ、横顔は1pxの点1つ）。
     横顔の鼻は1行だけ1px出す。口は描かない。目の行は4方向で揃える（ロランは y = 11）
   - 奥の装備に新しい色を当てるときは、描く前に `probe_colors.py` で体の色と測る
   ```
4. 「目視の手順」の1の前に、次の手順を足して番号を振り直す。
   ```markdown
   1. 4方向の `base` を `contact_sheet.py` に渡して横に並べる（`--columns 4`）。
      奥行きの扱いのずれは、4方向を並べないと見えない
   ```

- [ ] **Step 3: `CLAUDE.md` を書き換える**

1. 「新規アセットを書く前に、必ず `types/<type>/SPEC.md` と `types/<type>/reference/` を読む。」の項目の末尾に足す。
   ```markdown
   `unit` は `reference/` を持たない。手本は `assets/unit/roran/`、複製の土台は `types/unit/base/` の素体。
   ```
2. 「ミラーで作れるものをコピーで持たない」節の「川は使えるが、顔グラや城には使えない。」を次にする。
   ```markdown
   川は使えるが、顔グラや城には使えない。`unit` にも使わない（`left` と `right` で装備の手前と奥が
   入れ替わる。`types/unit/SPEC.md`）。
   ```

- [ ] **Step 4: `README.md` を書き換える**

| 場所 | 変更 |
|---|---|
| 2.4節「だから川や道のような平らなものには使えるが、陰影のある顔や城の角には使えない。」 | 末尾に「キャラ（`unit`）にも使わない。左右で装備の手前と奥が入れ替わるため。」を足す |
| ディレクトリ構成（`types/<type>/reference/` の行の下） | `types/unit/base/          unit の素体（4方向）。新しい unit を複製して作る土台` を足す。reference の行の説明を「合格済みのお手本。絵柄はここで揃える（`unit` は `assets/unit/roran/` が手本）」にする |
| 型の表の `unit` 行 | 点数を「1体24コマ（ロラン）＋素体4方向」にする |
| 4.3節の手順1「`types/<type>/SPEC.md` と `reference/` を読む」 | 末尾に「（`unit` は `assets/unit/roran/` と `types/unit/base/`）」を足す |

- [ ] **Step 5: `ISSUES.md` を更新する**

1. 「アセット・構成」節の「**`unit` の reference が本体のコピー**」の行を削除する（解消）
2. 同じ節の表の末尾に足す。
   ```markdown
   | **ロランの右向き5コマが mirror 派生のまま** | `right_breathe` / `right_walk_a` / `right_walk_b` / `right_atk_wind` / `right_atk_hit` は `left_*` の `mirror_x` 派生で、光源と装備の前後が反転している。`unit` に mirror を使わない規約（`types/unit/SPEC.md`）の経過措置として残している。下の「`base` 以外の20コマ」と一緒に本体グリッドにする | 中（20コマの描き直しと同時） | 2026-09-25 |
   ```
3. 「絵」節の表の末尾に足す。
   ```markdown
   | **ロランの `base` 以外の20コマが新しい立ち絵と合っていない** | 2026-09-25 に立ち絵4枚だけを新しい規約（右手に剣・左手に盾、奥のものは隠す）で描き直した。`idle` は `[base, breathe]`、`walk` / `attack` も `base` を挟むので、シート上では新旧の絵が交互に出る。4方向 × `breathe` / `walk_a` / `walk_b` / `atk_wind` / `atk_hit` を同じ規約で描き直す | 大（20コマ） | 2026-09-25 |
   ```

- [ ] **Step 6: 全体を検証する**

```sh
.venv/bin/python -m unittest discover -s tests
.venv/bin/python tools/validate.py -q; echo "validate exit=$?"
.venv/bin/python tools/check_colors.py 2>&1 | tail -3
.venv/bin/python tools/render.py > /dev/null
.venv/bin/python tools/sheet.py sheets/roran.txt
.venv/bin/python tools/contact_sheet.py
```

Expected:
- unittest: `Ran 116 tests ... OK`
- validate: `validate exit=0`
- check_colors: `95 grid(s): 1 failed, 0 with warnings`（失敗は既知の `knight` の1件だけ。reference 4枚が抜けて素体4枚が入るので、件数は計画作成時と同じ95）
- sheet / contact_sheet: エラーなく PNG が出る。`contact_sheet.png` の unit 群は、ロラン24コマと素体4枚の28点になる（重複ではなくなる）

- [ ] **Step 7: 差分を通して読み、Commit**

```sh
git diff --stat HEAD
git diff HEAD -- CLAUDE.md README.md ISSUES.md types/unit/SPEC.md
```

正典4ファイルの文言が、仕様と Task 1〜6 の実物に一致しているかを読む。

```bash
git add -A types/unit CLAUDE.md README.md ISSUES.md
git commit -m "docs: unit の reference を廃止し、立ち絵4方向の規約を正典に反映する"
```

---

## 完了後

- 依頼者への報告に含めること: 各描画タスクの差し戻し回数、Review Focus の5項目の確認結果、
  Task 6 で決めた素体の範囲（髪を剥いだ頭を肌で塗る、ベルト・ブーツを服の色に落とす）
- 次の作業は `ISSUES.md` の「`base` 以外の20コマ」。本仕様の規約をそのまま `breathe` / `walk` / `attack` に適用する
