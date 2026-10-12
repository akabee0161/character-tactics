# 部品を完全な形で描いて組む（道具の整備とロラン）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ユニットを「完全な形で描いた部品を、重なり順どおりに重ねるだけ」で組めるように `tools/compose.py` を整え、ロランの4方向×6コマを部品から組み直す。

**Architecture:** 部品で組む道具は、既にある `tools/compose.py`（素体＝芯の上に部品を front/back で重ねる。ガウで 2026-10-04 に使った）を使い、(1) 重なりを「奥→手前の積み上げ」で計算して画素ごとの部品名も返す、(2) 拳の輪郭を握る武器の上には描かない（部品の `keep`）、(3) 拳の部品が四方とも輪郭で閉じているかを確かめる（部品の `hand`）、を足す。重ねた後に黒く塗る後処理は新しいユニットには使わない。ロランは、今の完成した絵から部品を切り出して書き出し（`cand/gen/roran_layers.py --export`）、隠れていた所を描き足して部品を完全にし、向きごとに依頼者の承認を取ってからコマを組み直す。

**Tech Stack:** Python 3.14（`pixel-asset-forge/.venv`）、Pillow、unittest。

**Spec:** `docs/superpowers/specs/2026-10-09-unit-layer-parts-design.md`（層と重なり順の表）、`docs/superpowers/specs/2026-10-04-unit-drawing-workflow-design.md`（`compose.py` と部品の置き場）。この計画で変えた方針は下の「決めたこと」（2026-10-10 依頼者と合意）。

## 全体の中の位置（2026-10-10 依頼者と整理）

親の計画（敵のバリエーション、ブランチ `feat/enemy-variants-dagger`）の残りを次の順で進める。**この計画は A。**

| 順 | 内容 |
|---|---|
| **A** | **部品で組む道具を整える＋ロランを完全な部品から組み直す（この計画）** |
| B | イネス（弓・8状態）を部品から組む |
| C | ガウを部品から組む（2026-10-04 の部品と、その後に手で直したコマに差がある） |
| D | 敵を部品から組む（男女の素体・武器・髪・かぶり物を部品にする）。`layers.finish` の後処理を外す |
| E | 最新の道具で全ユニットを再検証する。`weapon_check` の取りこぼし（明るい奥の拳、色名・コマ名）を先に直す |
| F | 決まりと手順を SPEC の「描く手順」「自己チェック」に入れる |
| G | 女性に短剣 → 女性に弓 → T9 書き出し・親計画の段階2・3 |

## 決めたこと（2026-10-10 依頼者と合意）

- 部品は完全な形で描く。拳の部品は四方とも黒枠で囲った形で描く。重ねると、手前の部品（盾など）に隠れる所が隠れるだけ。重ねた後に描き足す処理はしない
- 例外は1つ: 拳が柄を握る所では、拳の輪郭を柄の上に描かない（柄が途切れるため。2026-10-09 に依頼者が案1を選択）
- 検査は部品で行う: 「拳の部品が四方とも黒枠で閉じているか」を重ねる前に確かめる。`weapon_check` の重ねた後の絵で見る手の輪郭の検査と、`--front`・`--front-dirs` は外す
- ロラン・イネス・ガウ・敵のすべてを部品から組むようにする。この計画はロランまで。イネス・ガウ・敵は、この計画で整えた道具と手順で次の計画にする
- ロランの重なり順: `up` は盾が一番奥（2026-10-10 依頼者の指摘）。`left` は盾が一番手前で、手前の拳は盾に隠れる

## Global Constraints

- コマンドは `pixel-asset-forge/` で実行する。Python は `.venv/bin/python`。テストは `.venv/bin/python -m unittest discover -s tests`
- ロランの手の肌は `skin_rose_hi,skin_rose_base,skin_rose_shadow`（首の `skin_rose_deep` は手ではない）
- **ロランのコマ（`assets/unit/roran/*.txt`）は、その向きの部品の確認ページを依頼者が承認するまで書き換えない**。承認は向きごと（down・up・left・right）
- ロラン以外の絵（`assets/unit/gau`・`ines`、`cand/enemy-frames/`、`cand/layer-trial/`）は作り直さない。`mkweapons.py`・`mklayers.py` は実行しない
- 敵の試作（`cand/gen/mklayers.py`）が使う重ねた後の処理（`layers.finish`）は、敵の部品を描き直す計画まで残す（今の試作の出力を変えないため）
- 絵を見せるときは、印（赤枠）を付けた絵と印なしの絵を並べる。Artifact の HTML ページで渡す
- push と PR は依頼者の指示があったときだけ
- コミットは Conventional Commits ＋ 日本語の要約。`git add` はファイルを指定する

## Review Focus

- 重なりの計算を積み上げに変えたことで、ガウの組み立て結果が変わる → Task 2 で、変える前と後の `compose.py compose/gau.json --out` の出力を全コマ比べる
- `keep` が、拳の輪郭以外（拳の肌、袖）まで握る武器の下に潜らせる、または握っていない部品の上でも効く → Task 3 のテスト（輪郭の画素だけ、`keep` の色が真下にあるときだけ）
- 拳がコマの端にあるとき、枠の外の隣を見て落ちる → Task 3 のテスト（枠の外は「閉じていない」と数える）
- 何も描いていない部品（剣が体に隠れる `up_atk_hit` など）のファイルが読めない → Task 6 のテスト（`map` に `o=outline` だけを書く）
- 部品どうしで同じ文字に違う色が割り当てられ、組み立てが止まる → Task 6 で、書き出す部品の文字をロランの今のコマの文字にそろえる

---

### Task 1: まだコミットしていない変更を整理してコミットする

**Files:**
- Modify: `pixel-asset-forge/tools/weapon_check.py`（手の輪郭の検査、`Analysis` の `front`・`keep_colours`、`load` の `front`・`front_dirs`、`--front`・`--front-dirs` を外す）
- Modify: `pixel-asset-forge/tests/test_weapon_check.py`（外した検査のテストを消す）
- Modify: `pixel-asset-forge/tools/hand_outline.py`（説明を「拳の部品のファイルの輪郭を閉じる」に替える）
- Modify: `pixel-asset-forge/cand/gen/layers.py`（`finish` の説明に、敵の試作だけが使うと書く）
- Modify: `pixel-asset-forge/CLAUDE.md`（`hand_outline.py` の例）
- Modify: `docs/superpowers/plans/2026-10-09-unit-tools-maintenance.md`（先頭に中止の1行）
- Create: `docs/superpowers/ledgers/2026-10-09-unit-tools-maintenance.md`（前の計画の台帳の写し）
- 残す（そのままコミット）: `tools/hand_outline.py` の `close_hands`（四方とも囲う。`keep`）、`cand/gen/cut_layers.py` の `torn`、`cand/gen/roran_layers.py`（`up` の表と破れの表示）、`tests/test_hand_outline.py`・`test_cut_layers.py`・`test_layers.py`、`cand/gen/mkweapons.py`・`mklayers.py`（`KEEP` を渡す形）

- [ ] **Step 1: `weapon_check.py` から外す**

  - docstring の「9. 拳を囲う」の3行を消す
  - `check_frame` の「すべての手（武器を持たない手も）が四方とも…」のコメントから `fails.append(...手の輪郭が閉じていない...)` までのブロックを消す
  - `Analysis.__init__` の `front` 引数と `self.keep_colours` の行を消す
  - `load` を `def load(directory: Path, blade, weapon, hand) -> dict[str, Analysis]:` に戻し、`Analysis(read_frame(path), blade, weapon, hand)` にする
  - `--front`・`--front-dirs` の `add_argument` と、`front_dirs` の検査（2つの `return 2`）を消し、`load(...)` の呼び出しを3引数に戻す
  - `close_hands` を使わなくなったら import から外す（`HAND_MAX` は残る）

- [ ] **Step 2: テストを合わせる**

`tests/test_weapon_check.py` から、`shield_beside_the_free_fist`、`test_sleeve_right_above_the_fist_fails`、`test_outline_check_runs_without_arm_colours`、`test_free_fist_beside_a_shield_needs_outline_without_front`、`test_front_colours_are_not_outlined_over`、`test_front_option_keeps_the_shield_only_in_the_front_dirs`、`test_front_needs_front_dirs` と、ほかに「手の輪郭が閉じていない」を期待するテスト（`grep -n "手の輪郭が閉じていない" tests/test_weapon_check.py`）を消す。`test_one_pixel_sleeve_turned_outline_does_not_float_the_hand` は残す（「手が体から浮いている」の検査は残る）。

Run: `.venv/bin/python -m unittest discover -s tests 2>&1 | tail -3`
Expected: OK（件数は 383 から消したテストの数だけ減る）

- [ ] **Step 3: 説明を替える**

`tools/hand_outline.py` の docstring を次の内容にする（盾・`--front` の2行を消す）:

```
拳の部品のファイル（assets/unit/<ユニット>/parts/ の拳）で、手の輪郭が切れている所を閉じる。

    tools/hand_outline.py assets/unit/roran/parts/sword_hand_down_base.txt \
        --hand skin_rose_hi,skin_rose_base,skin_rose_shadow           # 直す所を出すだけ
    tools/hand_outline.py ... --write                                # 書き換える

拳は部品として完全な形で描き、四方とも輪郭（黒）で囲う（2026-10-10 依頼者と決めた）。手（--hand の色の塊のうち、
HAND_MAX 画素以下の小さいもの）の上下左右の隣が、透明でも袖でも輪郭にする。--keep の色の上には描かない
（部品のファイルには普通いらない）。部品が閉じているかの検査は tools/compose.py（部品の "hand"）。
```

`CLAUDE.md` の `hand_outline.py` の行を `.venv/bin/python tools/hand_outline.py assets/unit/roran/parts/sword_hand_down_base.txt --hand skin_rose_hi,skin_rose_base,skin_rose_shadow  # 拳の部品の輪郭の切れ目を出す（--write で直す）` にする。`cand/gen/layers.py` の `finish` の docstring に「敵の試作（mklayers）だけが使う。部品を完全に描いたユニットには使わない（2026-10-10）」を足す。

- [ ] **Step 4: 前の計画を閉じる**

`docs/superpowers/plans/2026-10-09-unit-tools-maintenance.md` の1行目の下に `> 中止（2026-10-10）: 部品を完全な形で描いて重ねるだけにする方針に変えたため、docs/superpowers/plans/2026-10-10-unit-parts-roran.md に置き換えた。Task 1 の途中まで実施（台帳 docs/superpowers/ledgers/2026-10-09-unit-tools-maintenance.md）。` を足す。前の計画の台帳 `.superpowers/sdd/2026-10-09-unit-tools-maintenance/progress.md` を `docs/superpowers/ledgers/2026-10-09-unit-tools-maintenance.md` へ写す（`cp`）。

- [ ] **Step 5: Commit（2つに分ける）**

```bash
cd /home/ubuntu/workspace/character-tactics
git add pixel-asset-forge/cand/gen/cut_layers.py pixel-asset-forge/cand/gen/roran_layers.py pixel-asset-forge/tests/test_cut_layers.py
git commit -m "feat: 奥の層が手前の部品を破っている所を拾い、ロランの up の重なり順を盾が一番奥に直す"
git add pixel-asset-forge/tools/hand_outline.py pixel-asset-forge/tools/weapon_check.py pixel-asset-forge/cand/gen/layers.py pixel-asset-forge/cand/gen/mkweapons.py pixel-asset-forge/cand/gen/mklayers.py pixel-asset-forge/tests/test_hand_outline.py pixel-asset-forge/tests/test_weapon_check.py pixel-asset-forge/tests/test_layers.py pixel-asset-forge/CLAUDE.md docs/superpowers/plans/2026-10-09-unit-tools-maintenance.md docs/superpowers/plans/2026-10-10-unit-parts-roran.md docs/superpowers/ledgers/2026-10-09-unit-tools-maintenance.md
git status --short
git commit -m "refactor: 拳の囲いを重ねた後の絵ではなく部品で扱う（close_hands は四方とも囲い、weapon_check の手の輪郭の検査を外す）"
```

---

### Task 2: `compose.py` の重なりを奥→手前の積み上げで計算し、画素ごとの部品名を返す（出力は変えない）

**Files:**
- Modify: `pixel-asset-forge/tools/compose.py`（`compose_frame` の中身、`stack_order`・`compose_labels` を足す）
- Test: `pixel-asset-forge/tests/test_compose.py`

**Interfaces:**
- Produces:
  - `stack_order(layers: list[Layer]) -> list[int]` 奥→手前の並び。素体は `-1`。`front` は一番手前に積み、`back` は一番奥へ差し込む
  - `compose_labels(body: Grid, layers: list[tuple[Grid, Layer]]) -> list[list[str | None]]` 画素ごとに、見えている部品のファイル名（素体は素体のファイル名、透明は None）
  - `compose_frame(body, layers)` は今と同じ戻り値・同じ出力

- [ ] **Step 1: 今の出力を控える**

Run: `.venv/bin/python tools/compose.py compose/gau.json --out build/compose_check/gau_before`
Expected: 16 コマを書いた

- [ ] **Step 2: 失敗するテストを書く**

```python
from compose import compose_labels, stack_order  # 既存の import 行に足す


class StackTest(unittest.TestCase):
    def setUp(self):
        self.ws = Workspace()
        self.body = self.ws.grid("body.txt", {(10, 10): "b"}, BODY_MAP)

    def tearDown(self):
        self.ws.close()

    def test_back_layers_go_behind_everything_drawn_so_far(self):
        layers = [Layer(Path("a"), "front"), Layer(Path("b"), "back"), Layer(Path("c"), "back"), Layer(Path("d"), "front")]
        self.assertEqual(stack_order(layers), [2, 1, -1, 0, 3])

    def test_labels_name_the_visible_part(self):
        front = self.ws.grid("front.txt", {(10, 10): "h", (12, 10): "h"}, PART_MAP)
        back = self.ws.grid("back.txt", {(10, 10): "h", (13, 10): "h"}, PART_MAP)
        labels = compose_labels(self.body, [(front, Layer(front.path, "front")), (back, Layer(back.path, "back"))])
        self.assertEqual(labels[10][10], "front.txt")
        self.assertEqual(labels[10][12], "front.txt")
        self.assertEqual(labels[10][13], "back.txt")
        self.assertIsNone(labels[0][0])
```

Run: `.venv/bin/python -m unittest tests.test_compose -v`
Expected: ImportError（`stack_order` が無い）

- [ ] **Step 3: 実装する**

`compose.py` に足す。`compose_frame` は、部品ごとにずらした文字の面を作り、`stack_order` の手前から順に最初の透明でない文字を取る形に書き換える（文字の割り当ての検査・大きさの検査・枠の外の検査は今のまま）。

```python
def stack_order(layers: list[Layer]) -> list[int]:
    """奥→手前の並び（素体は -1）。front はその時点の一番手前に、back はその時点の一番奥に置く
    （back は「その時点で透明な画素にだけ描く」なので、先に描いたすべての後ろに入る）。"""
    order = [-1]
    for i, layer in enumerate(layers):
        if layer.z == "front":
            order.append(i)
        else:
            order.insert(0, i)
    return order
```

内部に `_compose(body, layers) -> (rows, groups, labels)` を作り、`compose_frame` は `rows, groups` を、`compose_labels` は `labels` を返す。

- [ ] **Step 4: 通ることと、出力が変わらないことを確かめる**

Run: `.venv/bin/python -m unittest tests.test_compose -v`
Expected: PASS（既存の 22 件も）

Run: `.venv/bin/python tools/compose.py compose/gau.json --out build/compose_check/gau_after && diff -r build/compose_check/gau_before build/compose_check/gau_after`
Expected: diff の出力なし

- [ ] **Step 5: Commit**

```bash
git add pixel-asset-forge/tools/compose.py pixel-asset-forge/tests/test_compose.py
git commit -m "refactor: compose.py の重なりを奥→手前の積み上げで計算し、画素ごとの部品名を返す"
```

---

### Task 3: `compose.py` に、握る武器の上に拳の輪郭を描かない（`keep`）と、拳の部品が閉じているかの検査（`hand`）を足す

**Files:**
- Modify: `pixel-asset-forge/tools/compose.py`（`Layer` に `keep`・`hand`、設定の最上位に `hand_colours`、`open_hand_pixels`）
- Test: `pixel-asset-forge/tests/test_compose.py`

**Interfaces:**
- Consumes: Task 2 の `_compose`・`stack_order`
- Produces:
  - 設定ファイル: 最上位に `"hand_colours": ["skin_rose_hi", ...]`。部品に `"keep": ["wood_base", ...]`（この部品の **輪郭の画素** は、その下の一番近い透明でない画素が `keep` の色なら、そちらを見せる）と `"hand": true`（拳の部品）
  - `open_hand_pixels(part: Grid, hand_colours: set[str]) -> list[tuple[int, int]]` 手の色の画素のうち、上下左右の隣が、手の色・`outline` 以外（透明・袖など）か、コマの外であるもの（部品の座標。ずらす前）
  - `main` は、`hand` の部品に閉じていない所があれば、組み立てる前に `error: <部品>: 拳が四方とも輪郭で閉じていない: (x,y) ...` で終了 2

- [ ] **Step 1: 失敗するテストを書く**

```python
class GripAndHandTest(unittest.TestCase):
    def setUp(self):
        self.ws = Workspace()
        self.body = self.ws.grid("body.txt", {(0, 0): "o"}, BODY_MAP)
        # 縦の柄（w）を、輪郭（o）で囲った拳（b）が握る
        self.shaft = self.ws.grid("shaft.txt", {(10, y): "w" for y in range(5, 15)}, "o=outline w=wood_base")
        fist = {(10, 9): "b", (10, 10): "b"}
        fist.update({p: "o" for p in [(10, 8), (10, 11), (9, 9), (9, 10), (11, 9), (11, 10)]})
        self.fist = self.ws.grid("fist.txt", fist, BODY_MAP)

    def tearDown(self):
        self.ws.close()

    def labels_rows(self, keep):
        layers = [(self.shaft, Layer(self.shaft.path, "front")),
                  (self.fist, Layer(self.fist.path, "front", keep=frozenset(keep)))]
        return compose_frame(self.body, layers)[0]

    def test_fist_outline_is_not_drawn_over_the_gripped_shaft(self):
        rows = self.labels_rows({"wood_base"})
        self.assertEqual(rows[8][10], "w")
        self.assertEqual(rows[11][10], "w")
        self.assertEqual(rows[9][10], "b")   # 拳の肌は柄の上に描く
        self.assertEqual(rows[9][9], "o")    # 柄の無い所の輪郭は描く

    def test_without_keep_the_outline_covers_the_shaft(self):
        rows = self.labels_rows(set())
        self.assertEqual(rows[8][10], "o")

    def test_open_hand_pixels_finds_a_fist_touching_a_sleeve_or_nothing(self):
        part = self.ws.grid("open.txt", {(10, 10): "b", (11, 10): "b", (9, 10): "q", (10, 9): "o"},
                            "o=outline b=skin_base q=cloak_dark_base")
        self.assertEqual(open_hand_pixels(part, {"skin_base"}), [(10, 10), (11, 10)])

    def test_closed_fist_passes(self):
        self.assertEqual(open_hand_pixels(self.fist, {"skin_base"}), [])

    def test_fist_at_the_frame_edge_is_open(self):
        part = self.ws.grid("edge.txt", {(0, 5): "b", (1, 5): "o", (0, 4): "o", (0, 6): "o"}, BODY_MAP)
        self.assertEqual(open_hand_pixels(part, {"skin_base"}), [(0, 5)])

    def test_main_stops_on_an_open_hand_part(self):
        self.ws.write("parts/open.txt", grid_text({(10, 10): "b"}, BODY_MAP))
        self.ws.write("body2.txt", grid_text({(0, 0): "o"}, BODY_MAP))
        config = {"unit": "t", "hand_colours": ["skin_base"],
                  "frames": {"down_base": {"body": "body2.txt",
                                           "layers": [{"part": "parts/open.txt", "z": "front", "hand": True}]}}}
        path = self.ws.write("compose/t.json", json.dumps(config))
        err = io.StringIO()
        with contextlib.redirect_stderr(err), contextlib.redirect_stdout(io.StringIO()):
            code = main_in(self.ws.root, [str(path), "--out", str(self.ws.root / "out")])
        self.assertEqual(code, 2)
        self.assertIn("拳が四方とも輪郭で閉じていない", err.getvalue())

    def test_hand_without_hand_colours_is_an_error(self):
        config = {"unit": "t", "frames": {"down_base": {"body": "b.txt",
                                                        "layers": [{"part": "p.txt", "z": "front", "hand": True}]}}}
        path = self.ws.write("compose/t.json", json.dumps(config))
        with self.assertRaisesRegex(ComposeError, "hand_colours"):
            load_config(path, self.ws.root)
```

`main_in(root, argv)` は、既存のテストが `main` を一時ディレクトリの root で呼んでいるやり方（`grep -n "def test_.*main\|REPO_ROOT\|root=" tests/test_compose.py`）に合わせてテストの中に用意する。既存のやり方が無ければ、`main(argv, root=REPO_ROOT)` の引数を `compose.py` に足す（`load_config` は既に `root` を取る）。`load_config` の戻り値に `hand_colours` を加える場合は、既存の呼び出しとテストを合わせて直す。

Run: `.venv/bin/python -m unittest tests.test_compose -v`
Expected: 新しいテストが FAIL / ERROR

- [ ] **Step 2: 実装する**

- `CONFIG_KEYS` に `hand_colours`、`LAYER_KEYS` に `keep`・`hand` を足す。`keep` は文字列の配列、`hand` は真偽値でなければ `ComposeError`。`hand: true` の部品があって `hand_colours` が無ければ `ComposeError("... hand_colours（手の肌の色名）が無い")`
- `Layer` に `keep: frozenset[str] = frozenset()` と `hand: bool = False`
- `_compose` で、手前から見て最初の透明でない画素が、`keep` を持つ部品の `outline` で、その奥で次に透明でない画素の色名が `keep` にあれば、その画素（文字と部品名）を使う
- `open_hand_pixels` を足す（手の色は `part.charmap` で文字→色名にして判定する。枠の外の隣は閉じていないと数える）
- `main` は組み立ての前に、`hand` の部品ごとに `open_hand_pixels` を呼び、あれば `ComposeError`
- docstring に `keep`・`hand`・`hand_colours` の説明と、決めた日（2026-10-10、柄の例外は 2026-10-09）を書く

- [ ] **Step 3: 通ることを確かめる**

Run: `.venv/bin/python -m unittest discover -s tests 2>&1 | tail -3`
Expected: OK。Task 2 Step 4 の `diff -r`（ガウの出力）も、もう一度出力なし

- [ ] **Step 4: Commit**

```bash
git add pixel-asset-forge/tools/compose.py pixel-asset-forge/tests/test_compose.py
git commit -m "feat: compose.py で拳の輪郭を握る武器の上に描かず、拳の部品が閉じているかを確かめる"
```

---

### Task 4: `layers.py`・`cut_layers.py` を `tools/` へ移す

**Files:**
- Move（`git mv`）: `cand/gen/layers.py` → `tools/layers.py`、`cand/gen/cut_layers.py` → `tools/cut_layers.py`
- Modify: `cand/gen/mklayers.py`・`roran_layers.py`・`table_page.py`・`layer_page.py` と `tests/test_layers.py`・`test_cut_layers.py`・`test_mklayers.py`・`test_layer_page.py` の import（`sys.path` に `tools` が入っていることを確かめる）
- 移さない: `table_page.py`・`layer_page.py`・`mklayers.py`・`roran_layers.py`（敵の試作とロランの切り出しの専用）

- [ ] **Step 1: 移す前を控える**

Run: `.venv/bin/python cand/gen/mklayers.py --check` と `.venv/bin/python -m unittest discover -s tests 2>&1 | tail -3`
Expected: 試作の2体が「重なり順: ok」、テストの件数を控える

- [ ] **Step 2: 移して import を直す**

`grep -rn "cut_layers\|from layers\|import layers" --include=*.py .` で参照を洗い出して直す。モジュールの docstring の「試作」「採用したら tools/ へ移す」は「tools/ へ移した（2026-10-10）」に書き換える。

- [ ] **Step 3: 同じであることを確かめる**

Run: Step 1 と同じ2つ
Expected: 同じ結果・同じ件数

- [ ] **Step 4: Commit**

```bash
git add -A pixel-asset-forge/tools/layers.py pixel-asset-forge/tools/cut_layers.py pixel-asset-forge/cand/gen pixel-asset-forge/tests
git status --short
git commit -m "refactor: layers と cut_layers を tools/ へ移す"
```

---

### Task 5: 部品の確認ページ `tools/compose_page.py`

**Files:**
- Create: `pixel-asset-forge/tools/compose_page.py`
- Test: `pixel-asset-forge/tests/test_compose_page.py`

**Interfaces:**
- Consumes: Task 2 の `stack_order`・`compose_labels`、Task 3 の `open_hand_pixels`・`load_config`
- Produces: `tools/compose_page.py compose/<ユニット>.json OUT.html [--dirs down,up] [--against DIR]`。`--against` を省くと `assets/unit/<ユニット>/` と比べる

ページの中身（向きごとに見出し、コマごとに2行）:
1. 1行目（印なし）: 部品を奥→手前に並べた絵（4倍、薄い灰色の地。部品のファイル名を下に）→ 組み立てた絵 → 今の絵
2. 2行目（印あり、1行目と同じ並び）: 各部品の「手前の部品に隠れている画素」に赤枠、拳の部品の閉じていない画素に赤枠、組み立てた絵の「今の絵と違う画素」に赤枠。図の下に件数と座標
3. ページの先頭に、全コマの「今の絵と違う画素の数」「閉じていない拳」の一覧

- [ ] **Step 1: 失敗するテストを書く**

`tests/test_compose.py` の `Workspace`・`grid_text` を import して、素体1枚・部品2枚・コマ1つの設定を作り、`compose_page.main([config, out, "--against", dir])` が 0 を返し、HTML に「down_base」「隠れている」「今の絵と違う画素 1」（今の絵を1画素変えておく）が入ることを確かめる。閉じていない拳の部品を入れた設定では、ページは作られ（終了 0）、「閉じていない拳」と座標が入ることも確かめる。

Run: `.venv/bin/python -m unittest tests.test_compose_page -v`
Expected: ImportError

- [ ] **Step 2: 実装する**

画像は `cand/gen/layer_page.py` の `png`・`uri` と同じ作り（Pillow、8倍で描いて縮める、赤枠は幅2）を `compose_page.py` の中に書く（`cand/gen/` を import しない）。色は `gridfile.load_palette()`。

- [ ] **Step 3: 通ることを確かめる**

Run: `.venv/bin/python -m unittest discover -s tests 2>&1 | tail -3`
Expected: OK

- [ ] **Step 4: Commit**

```bash
git add pixel-asset-forge/tools/compose_page.py pixel-asset-forge/tests/test_compose_page.py
git commit -m "feat: 部品を奥→手前に並べ、隠れている所と閉じていない拳を示す確認ページを足す"
```

---

### Task 6: ロランの部品を書き出す（今の絵と同じに組めることを確かめる）

**Files:**
- Modify: `pixel-asset-forge/cand/gen/roran_layers.py`（`--export` を足す）
- Create: `pixel-asset-forge/assets/unit/roran/parts/*.txt`、`pixel-asset-forge/compose/roran.json`
- Test: `pixel-asset-forge/tests/test_roran_export.py`

部品の名前と置き方:

| 部品 | ファイル | 重なり（`roran_layers.ORDERS`） |
|---|---|---|
| 芯 | `parts/core_<向き>_<状態>.txt`（素体＝`body`） | |
| 剣 | `parts/sword_<向き>_<状態>.txt` | |
| 盾 | `parts/shield_<向き>_<状態>.txt` | |
| 剣を持つ腕・拳（left は奥の腕・拳） | `parts/sword_hand_<向き>_<状態>.txt`、`"hand": true`、`"keep"`: 剣の色 | |
| 盾を持つ腕・拳（left は手前の腕・拳） | `parts/shield_hand_<向き>_<状態>.txt`、`"hand": true` | up と left だけ |

- 同じ向きで中身が同じ部品は、先の状態のファイルを使い回す（`walk_a`・`walk_b` は芯以外 `base` と同じはず）。使い回すと、後で描き足すときに1か所で済む
- 文字は、ロランの今のコマの文字（24コマで同じ。文字→色名は1通り）にそろえる。何も描かない部品は `# map: o=outline` だけを書く
- 重なりは `ORDERS[d]` から作る: 芯より奥の部品は芯に近い順に `"z": "back"`、芯より手前の部品は奥から順に `"z": "front"`
- `hand_colours`: `skin_rose_hi`・`skin_rose_base`・`skin_rose_shadow`

- [ ] **Step 1: 失敗するテストを書く**

`tests/test_roran_export.py`: 一時ディレクトリへ書き出し（`export(out_parts, out_config)` を関数で呼ぶ）、(1) 24コマのどれも、`compose.py` の `_compose` で組んだ画素（色名）がロランの今のコマと同じ、(2) 部品のファイルがすべて `gridfile.parse` で読める、(3) `walk_a` の剣のファイル名が `base` と同じ、(4) `up` の重なりが盾→剣→芯→剣を持つ腕・拳→盾を持つ腕・拳になる（`stack_order` で確かめる）。

注: これは `assets/` の生きている絵を読むテストになる（CLAUDE.md の「回帰テストに現役のアートを参照させない」）。書き出しはロランの絵を描き直す前に一度だけ使う道具なので、テストは Task 6 の確認に使った後、Task 7 の前に `tests/` から消す（消したことを台帳に Ruling として書く）。

Run: `.venv/bin/python -m unittest tests.test_roran_export -v`
Expected: ImportError（`export` が無い）

- [ ] **Step 2: 実装する**

`roran_layers.py` に `export(parts_dir: Path, config_path: Path)` と、`--export` の CLI（`.venv/bin/python cand/gen/roran_layers.py --export`）を足す。書くのは部品のファイルと `compose/roran.json` だけ。**`assets/unit/roran/*.txt`（コマ）は書かない。**

- [ ] **Step 3: 通ることを確かめ、書き出す**

Run: `.venv/bin/python -m unittest tests.test_roran_export -v` → PASS
Run: `.venv/bin/python cand/gen/roran_layers.py --export && .venv/bin/python tools/validate.py assets/unit/roran/parts`
Expected: 書き出した。validate が ok
Run: `.venv/bin/python tools/compose_page.py compose/roran.json build/roran_parts.html`
Expected: 全コマ「今の絵と違う画素 0」。閉じていない拳の一覧が出る（これが Task 7〜10 で描き足す所）。`compose.py compose/roran.json --check` は、拳が閉じていないので終了 2 になる（正しい）

- [ ] **Step 4: Commit**

`tests/test_roran_export.py` を消してから:

```bash
git add pixel-asset-forge/cand/gen/roran_layers.py pixel-asset-forge/assets/unit/roran/parts pixel-asset-forge/compose/roran.json
git status --short
git commit -m "feat: ロランの24コマを部品のファイルに書き出す（描き足す前。組むと今の絵と同じ）"
```

---

### Task 7〜10: ロランの部品を完全に描く（down → up → left → right、向きごとに承認）

向きごとに同じ手順を繰り返す。1つの向きを Task とする（Task 7 = down、Task 8 = up、Task 9 = left、Task 10 = right）。

**Files:**
- Modify: `pixel-asset-forge/assets/unit/roran/parts/*_<向き>_*.txt`
- Modify（承認後）: `pixel-asset-forge/assets/unit/roran/<向き>_*.txt`（6コマ）

その向きで描き足すもの（部品を単品で見て完全な形にする）:
- 拳: 四方とも黒枠で閉じる（`tools/hand_outline.py <拳の部品> --hand ... --write` で閉じ、形を目で直す）
- 芯: 盾・剣・腕に隠れていた体（穴。`roran_layers.holes`）を描く
- 盾・剣: 手前の部品に隠れていた所を描く
- 分かっている直し: up は盾を持つ拳の左・上・下の黒枠が見える（盾が一番奥）。left は手前の拳が盾に隠れる（盾の右の輪郭 x=11 が拳に破られていた）。right は鍔の右端（x12）に輪郭が無く体に接していた（base・idle2・歩き）

- [ ] **Step 1: 描き足す**

部品のファイルを直接直す（`tools/validate.py assets/unit/roran/parts` を通す）。

- [ ] **Step 2: 確かめる**

Run: `.venv/bin/python tools/compose_page.py compose/roran.json build/roran_parts.html --dirs <向き>`
Expected: その向きの拳がすべて閉じている。「今の絵と違う画素」は、上の「分かっている直し」と、拳の黒枠が見えるようになった所だけ（それ以外の差は描き足しの誤り。直してから進む）

- [ ] **Step 3: 依頼者に見せて止まる**

ページを Artifact で公開し、変わった画素の一覧（印ありと印なしを並べたもの）と、描き足した所（各部品の「隠れている所」）を見てもらう。**承認まで次へ進まない。** 指摘があれば台帳に書き、Step 1 へ戻る。

- [ ] **Step 4: 承認後、コマを組み直す**

Run: `.venv/bin/python tools/compose.py compose/roran.json --frames <向き>_base <向き>_idle2 <向き>_walk_a <向き>_walk_b <向き>_atk_wind <向き>_atk_hit --force`
Run: `.venv/bin/python tools/compose.py compose/roran.json --frames <同じ6コマ> --check`（終了 0）、`.venv/bin/python tools/validate.py assets/unit/roran`、`types/unit/SPEC.md` のロランの `unit_check.py`・`weapon_check.py` の指定
Expected: 書いた。--check は差なし。validate・unit_check・weapon_check は、承認した変更のせいで新しく落ちる所が無い（落ちたら台帳に書いて依頼者に見せる）

- [ ] **Step 5: Commit**

```bash
git add pixel-asset-forge/assets/unit/roran/parts pixel-asset-forge/assets/unit/roran/<向き>_*.txt
git commit -m "feat: ロランの <向き> を完全な部品から組み直す"
```

---

### Task 11: 文書と台帳

**Files:**
- Modify: `pixel-asset-forge/README.md`（`compose.py` の `keep`・`hand`・`hand_colours`、`compose_page.py`、部品の置き場）、`pixel-asset-forge/types/unit/SPEC.md`（拳の決まり: 部品として四方とも囲う・柄の例外・検査は部品で。ロランは部品から組む。`hand_outline.py` は拳の部品に使う）、`pixel-asset-forge/CLAUDE.md`（`compose_page.py` のコマンド）、`pixel-asset-forge/ISSUES.md`（「拳を四方とも輪郭で囲う決まりに変える（全ユニット）」を、ロランは済み・ほかは次の計画と書き換える。先送りした前の計画の Task 2〜4 の項目を1行ずつ足す: `weapon_check --far-shade` が振りかぶりの明るい奥の拳を拾わない、色名・コマ名を検査しない、`attach` の大きさ・取り付け点の検査、`mklayers --check` が noweapon と labels.json を見ない、`build_layers` が素体を書き換える、芯に手前の手が残る）
- Create: `docs/superpowers/ledgers/2026-10-10-unit-parts-roran.md`（この計画の台帳の写し）

- [ ] **Step 1: 更新し、全体テスト → Commit**

Run: `.venv/bin/python -m unittest discover -s tests 2>&1 | tail -3` → OK

```bash
git add pixel-asset-forge/README.md pixel-asset-forge/types/unit/SPEC.md pixel-asset-forge/CLAUDE.md pixel-asset-forge/ISSUES.md docs/superpowers/ledgers/2026-10-10-unit-parts-roran.md
git commit -m "docs: 部品を完全に描いて組む決まりと、ロランの組み直しを README・SPEC・ISSUES に反映する"
```

---

## Self-Review

- 決めたこととの対応: 部品を完全に描く→Task 7〜10、重ねるだけ→Task 2・3（後処理を使わない）、柄の例外→Task 3 の `keep`、部品で検査→Task 3 の `hand`・Task 5、`weapon_check` の検査と `--front` を外す→Task 1、ロランの up の表→Task 1、層の道具を tools/ へ→Task 4
- 前の計画の Task 2（`weapon_check` の取りこぼし）と Task 4（minor 4件）は、依頼者と合意した「ツール整備は小さくする」に入っていないので、この計画では行わず ISSUES.md に残す（Task 11）
- 型の整合: `stack_order`・`compose_labels`・`open_hand_pixels`・`Layer(keep, hand)` を Task 2・3・5・6 で同じ名前で使う
- 承認の止まりどころ: Task 7〜10 の Step 3（4回）
