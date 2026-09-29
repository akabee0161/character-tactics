# issue #6 の forge 側の対応（待機アニメ・村/岩/木の 32px セット） 実装計画

作成: 2026-09-28。**このファイルは作成時点のログ**。運用の最新は `README.md` と `CLAUDE.md` と
`types/*/SPEC.md` を見ること。実行中に変わった判断は正典側に反映し、この計画書は遡って更新しない。

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 16px の部品を組んで 32px の物（村・岩・木）を出す道具 `tools/sets.py` を作り、3つのセットを描き、
ロランの待機の2コマ目を「剣を持つ拳を剣ごと1px上げる」絵に描き直して、character-tactics に入れる。

**Architecture:** 部品は普通の `tile`（16×16）として `assets/tile/<物>_{nw,ne,sw,se}.txt` に置き、
組み方を `sets/<物>.txt` に書く。`tools/sets.py` は `tilemap.py` の `read_layout` と `compose`（scale=1）で
組み、部品の検査だけを足す。絵は 32×32 の下書きを `/tmp` で描いて4つに切る（その場限りのスクリプト）。
待機は `*_base` から剣の範囲を1行上げた下書きを作り、腕を手で描き足す。

**Tech Stack:** Python 3.12 + Pillow（既存の依存だけ）、`unittest`。character-tactics は Node 24・Vitest、
ヘッドレス Chromium を CDP で駆動。

**Spec:** `docs/2026-09-28-issue6-forge-assets-spec.md`

## Global Constraints

すべてのタスクの要件にこの節が暗黙に含まれる。

- forge のブランチは `docs/issue6-asset-policy`（現在のチェックアウト）。character-tactics のブランチは
  `feat/foot-box-and-tile-size`（現在のチェックアウト）。新しいブランチを切らない
- git の author は `akabee0161`（確認済み、2026-09-28）。コミットは Conventional Commits + 日本語の要約
- **push しない。PR を作らない**（全タスクが終わったら報告して止まる）
- Python は必ず `.venv/bin/python` で動かす。**その場限りのスクリプトは `/tmp/forge/` に Write で置いて
  ファイルとして実行する。** `python - <<'EOF'` と、`python -c "..."` の中にシェル変数を展開する形は安全フックに止められる
- グリッドのヘッダで、**コロンを含む `#` 行は正しいヘッダでなければ失敗する。** コメントにコロンを書かない
- `tile` の部品は `# light: upper-left`、`# bg` を書かない（全セルを塗る）。ミラーの派生にしない（光と影の向きがあるため）
- 物のシルエットにだけ `outline` を回す。地面に落ちる影は物の右下に `grass_shadow`
- 色は今のパレットの中だけで描く。**足す必要が出たら描く前に止めて依頼者に相談する**
- 今の 16px の `village` `rock` `tree`、城（`castle_*`）、`forest`、`layouts/field.txt` には触らない
- `*_base` 4枚、`types/unit/base/`、`sheets/roran.txt` には触らない
- `tests/` から `assets/` の現役アートを参照しない（部品は `tests/fixtures/` に固定する）
- forge の CLAUDE.md の「ゲーム側で倍率を直す予定」という記述は触らない
- **計画に不備を見つけたら、直さずに止めて依頼者に報告する**
- 作った絵は Read で依頼者に見せる。**各絵のタスクの最後で依頼者の承認を待つ**

## Review Focus

どのテストも踏まないが、いちばん起こりやすい失敗。上から順に起こりやすい。

1. **character-tactics へ `build/tile/village.png`（今の 16px の絵）をコピーしてしまう。** 16px も 32px も
   `npm test` を通るので、間違えても落ちない
   → Task 6 Step 2 で、コピー後の3枚の実寸が 32×32 であることを確かめる
2. **セットの外周の草が `plain` とつながらない**（ゲームでは周りに `plain` の 16px タイルが敷かれる）
   → 下書きを `plain` の 2×2 から始める（Task 2 Step 1）。`layouts/objects.txt` で `plain` に囲んで見る
3. **`breathe` で頭・胴・盾まで動く**（剣の範囲を上げるときに、頭の輪郭と共有している列まで動かす）
   → Task 5 Step 3 の差分スクリプトで、差分のセルが剣と腕の範囲だけにあることを確かめる
4. **セットの定義の打ち間違い**（`village_nw` を `vilage_nw` と書く、`.` を置く、16px でない部品を置く）
   → Task 1 のテストで、どの部品が何でだめかを名指しして失敗することを確かめる
5. **部品が `# from:` の派生のとき組めない** → Task 1 のテストで派生の部品を組む

---

## File Structure

| ファイル | 責務 | タスク |
|---|---|---|
| `tools/tilemap.py` | `load_tile` と `compose` に `tile_dir` を足す（既定は今と同じ `assets/tile`） | 1 |
| `tools/sets.py`（新規） | 定義を読み、部品を検査して組み、`build/sets/` に出す | 1 |
| `tests/test_sets.py`（新規） | `sets.py` のテスト | 1 |
| `tests/fixtures/set_part_*.txt`（新規） | テスト用の部品 | 1 |
| `sets/{village,rock,tree}.txt`（新規） | 組み方の定義 | 2・3・4 |
| `assets/tile/{village,rock,tree}_{nw,ne,sw,se}.txt`（新規12枚） | 部品 | 2・3・4 |
| `layouts/objects.txt`（新規） | 3つのセットと森を `plain` に置いた確認用マップ | 2・3・4 |
| `assets/unit/roran/{down,up,left,right}_breathe.txt` | 待機の2コマ目 | 5 |
| `types/tile/SPEC.md`・`types/unit/SPEC.md`・`README.md`・`CLAUDE.md`・`ISSUES.md` | 正典 | 1・5・7 |
| character-tactics `assets/images/{roran-map,tile-village,tile-rock,tile-tree}.png` | ゲームの絵 | 6 |
| character-tactics `README.md`・`HANDOVER.md` | 正典・引き継ぎ | 6 |

---

### Task 1: 部品を組む道具 `tools/sets.py`

**Files:**
- Modify: `tools/tilemap.py:43-65`（`load_tile` と `compose`）
- Create: `tools/sets.py`
- Create: `tests/test_sets.py`
- Create: `tests/fixtures/set_part_a.txt`, `set_part_b.txt`, `set_part_b_mirror.txt`, `set_part_small.txt`, `set_part_broken.txt`
- Modify: `README.md`（2章のツアー・まとめの図・3章のファイルの地図）、`CLAUDE.md`（コマンド）

**Interfaces:**
- Produces:
  - `tilemap.load_tile(name: str | Path, palette, tile_dir: Path = TILE_DIR) -> Image.Image`
  - `tilemap.compose(layout, palette, scale: int, tile_dir: Path = TILE_DIR) -> Image.Image`
  - `sets.check_parts(layout: list[list[str | None]], palette, tile_dir: Path) -> None`（だめなら `GridError`）
  - `sets.assemble(layout, palette, tile_dir: Path = TILE_DIR) -> Image.Image`（RGBA、不透明）
  - `sets.main(argv: list[str] | None = None) -> int`
  - CLI: `.venv/bin/python tools/sets.py [定義...] [--scale 8] [-o build/sets] [--tiledir assets/tile]`

- [ ] **Step 1: テスト用の部品を置く**

`tests/fixtures/set_part_a.txt`（16×16、全部 `g`）:

```
# type: tile
# size: 16x16
# light: upper-left
# A flat part for tests/test_sets.py. Fixed here so redrawing a live tile never breaks the test.
# map: g=grass_base
gggggggggggggggg
gggggggggggggggg
gggggggggggggggg
gggggggggggggggg
gggggggggggggggg
gggggggggggggggg
gggggggggggggggg
gggggggggggggggg
gggggggggggggggg
gggggggggggggggg
gggggggggggggggg
gggggggggggggggg
gggggggggggggggg
gggggggggggggggg
gggggggggggggggg
gggggggggggggggg
```

`tests/fixtures/set_part_b.txt`（16×16、左上1セルだけ `g`、残りは `o`。ミラーの向きを確かめるため）:

```
# type: tile
# size: 16x16
# light: upper-left
# map: o=outline g=grass_base
gooooooooooooooo
oooooooooooooooo
oooooooooooooooo
oooooooooooooooo
oooooooooooooooo
oooooooooooooooo
oooooooooooooooo
oooooooooooooooo
oooooooooooooooo
oooooooooooooooo
oooooooooooooooo
oooooooooooooooo
oooooooooooooooo
oooooooooooooooo
oooooooooooooooo
oooooooooooooooo
```

`tests/fixtures/set_part_b_mirror.txt`:

```
# from: set_part_b.txt
# transform: mirror_x
```

`tests/fixtures/set_part_small.txt`（8×8）:

```
# type: tile
# size: 8x8
# map: g=grass_base
gggggggg
gggggggg
gggggggg
gggggggg
gggggggg
gggggggg
gggggggg
gggggggg
```

`tests/fixtures/set_part_broken.txt`（`z` が map に無い。16行とも16文字）:

```
# type: tile
# size: 16x16
# map: g=grass_base
zggggggggggggggg
gggggggggggggggg
gggggggggggggggg
gggggggggggggggg
gggggggggggggggg
gggggggggggggggg
gggggggggggggggg
gggggggggggggggg
gggggggggggggggg
gggggggggggggggg
gggggggggggggggg
gggggggggggggggg
gggggggggggggggg
gggggggggggggggg
gggggggggggggggg
gggggggggggggggg
```

- [ ] **Step 2: 落ちるテストを書く**

`tests/test_sets.py`:

```python
"""Checks for the set tool.

    .venv/bin/python -m unittest discover -s tests
"""
from __future__ import annotations

import sys
import tempfile
import unittest
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT / "tools"))

from PIL import Image  # noqa: E402

import sets  # noqa: E402
from gridfile import GridError, load_palette  # noqa: E402

FIXTURES = REPO_ROOT / "tests" / "fixtures"
A, B = "set_part_a", "set_part_b"


class AssembleTest(unittest.TestCase):
    def setUp(self):
        self.palette = load_palette()

    def test_two_by_two_parts_make_one_32px_image(self):
        image = sets.assemble([[A, B], [B, A]], self.palette, FIXTURES)
        self.assertEqual(image.size, (32, 32))
        self.assertEqual(image.getpixel((0, 0))[:3], self.palette["grass_base"])
        self.assertEqual(image.getpixel((17, 1))[:3], self.palette["outline"])
        self.assertEqual(image.getpixel((1, 17))[:3], self.palette["outline"])
        self.assertEqual(image.getpixel((31, 31))[:3], self.palette["grass_base"])

    def test_every_pixel_is_opaque(self):
        image = sets.assemble([[A, B], [B, A]], self.palette, FIXTURES)
        self.assertEqual(image.getchannel("A").getextrema(), (255, 255))

    def test_other_shapes_are_allowed(self):
        image = sets.assemble([[A, B, A], [B, A, B]], self.palette, FIXTURES)
        self.assertEqual(image.size, (48, 32))

    def test_a_derived_part_assembles_like_any_other(self):
        image = sets.assemble([["set_part_b_mirror"]], self.palette, FIXTURES)
        self.assertEqual(image.size, (16, 16))
        self.assertEqual(image.getpixel((15, 0))[:3], self.palette["grass_base"])

    def test_an_empty_cell_is_rejected(self):
        with self.assertRaisesRegex(GridError, r"row 0 column 1 is '\.'"):
            sets.assemble([[A, None], [A, A]], self.palette, FIXTURES)

    def test_a_missing_part_is_named(self):
        with self.assertRaisesRegex(GridError, "set_part_nope"):
            sets.assemble([[A, "set_part_nope"]], self.palette, FIXTURES)

    def test_a_part_that_is_not_16px_is_rejected(self):
        with self.assertRaisesRegex(GridError, "set_part_small.*8x8"):
            sets.assemble([[A, "set_part_small"]], self.palette, FIXTURES)

    def test_a_part_that_fails_validation_is_rejected(self):
        with self.assertRaisesRegex(GridError, "set_part_broken"):
            sets.assemble([[A, "set_part_broken"]], self.palette, FIXTURES)


class MainTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.dir = Path(self.tmp.name)

    def tearDown(self):
        self.tmp.cleanup()

    def definition(self, name: str, text: str) -> Path:
        path = self.dir / f"{name}.txt"
        path.write_text(text, encoding="utf-8")
        return path

    def run_main(self, *definitions: Path) -> int:
        out = self.dir / "out"
        return sets.main([*map(str, definitions), "-o", str(out), "--tiledir", str(FIXTURES)])

    def test_writes_the_image_and_the_review_copy(self):
        good = self.definition("thing", f"# a set\n{A} {B}\n{B} {A}\n")
        self.assertEqual(self.run_main(good), 0)
        self.assertEqual(Image.open(self.dir / "out" / "thing.png").size, (32, 32))
        self.assertEqual(Image.open(self.dir / "out" / "thing_x8.png").size, (256, 256))

    def test_a_bad_definition_fails_the_run_but_the_others_are_written(self):
        bad = self.definition("bad", f"{A} .\n{A} {A}\n")
        good = self.definition("good", f"{A} {A}\n{A} {A}\n")
        self.assertEqual(self.run_main(bad, good), 1)
        self.assertFalse((self.dir / "out" / "bad.png").exists())
        self.assertTrue((self.dir / "out" / "good.png").exists())


if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 3: 落ちることを確かめる**

Run: `.venv/bin/python -m unittest tests.test_sets -v`
Expected: `ModuleNotFoundError: No module named 'sets'` で ERROR

- [ ] **Step 4: `tilemap.py` に `tile_dir` を足す**

`tools/tilemap.py` の `load_tile` と `compose` を次に置き換える（ほかは変えない）:

```python
def load_tile(name: str | Path, palette, tile_dir: Path = TILE_DIR) -> Image.Image:
    path = name if isinstance(name, Path) else tile_dir / f"{name}.txt"
    grid = parse(path)
    errors = check(grid, palette)
    if errors:
        raise GridError(f"{display(path)}: {errors[0]}")
    return to_image(grid, palette)


def compose(
    layout: list[list[str | None]], palette, scale: int, tile_dir: Path = TILE_DIR
) -> Image.Image:
    images = {name: load_tile(name, palette, tile_dir) for row in layout for name in row if name}
    if not images:
        raise GridError("layout has no tiles in it")
    cell_w = max(image.width for image in images.values())
    cell_h = max(image.height for image in images.values())
    canvas = Image.new("RGBA", (len(layout[0]) * cell_w, len(layout) * cell_h))
    for y, row in enumerate(layout):
        for x, name in enumerate(row):
            if name:
                canvas.paste(images[name], (x * cell_w, y * cell_h))
    if scale != 1:
        canvas = canvas.resize((canvas.width * scale, canvas.height * scale), Image.NEAREST)
    return canvas
```

- [ ] **Step 5: `tools/sets.py` を書く**

```python
#!/usr/bin/env python3
"""Assemble an object from 16x16 part tiles.

    tools/sets.py                     # every sets/*.txt
    tools/sets.py sets/village.txt

A set definition is whitespace-separated part names, one row of parts per
line - the same shape as a `layouts/*.txt` file, and outside `assets/` for the
same reason (`validate.py` and `render.py` would read it as a grid). The parts
are ordinary `tile` grids in `assets/tile/`.

    village_nw  village_ne
    village_sw  village_se

`build/sets/<name>.png` is what the game receives: character-tactics draws a
32x32 tile as one map cell, unscaled. The parts stay 16x16 so that
`tilemap.py --layout` can still place them beside every other tile.
`<name>_x8.png` is the copy to look at.

Unlike a layout, a set has no empty cells. The object is drawn on its own
grass, so a `.` would leave a hole in the ground.
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent))

from gridfile import REPO_ROOT, GridError, check, display, load_palette, parse

from tilemap import TILE_DIR, compose, read_layout

SET_DIR = REPO_ROOT / "sets"
OUTPUT_DIR = REPO_ROOT / "build" / "sets"

# The ground tile size. A set is whole tiles of it, so it lines up with the
# 16px tiles laid around it.
PART = 16


def check_parts(layout: list[list[str | None]], palette, tile_dir: Path) -> None:
    """Raise :class:`GridError` naming the first cell or part that cannot go into a set."""
    for y, row in enumerate(layout):
        for x, name in enumerate(row):
            if name is None:
                raise GridError(f"row {y} column {x} is '.', but a set has no empty cells")
    for name in dict.fromkeys(name for row in layout for name in row):
        path = tile_dir / f"{name}.txt"
        if not path.is_file():
            raise GridError(f"{name}: no such part ({display(path)})")
        grid = parse(path)
        errors = check(grid, palette)
        if errors:
            raise GridError(f"{display(path)}: {errors[0]}")
        if (grid.width, grid.height) != (PART, PART):
            raise GridError(f"{display(path)}: {grid.width}x{grid.height}, a part must be {PART}x{PART}")


def assemble(layout: list[list[str | None]], palette, tile_dir: Path = TILE_DIR) -> Image.Image:
    check_parts(layout, palette, tile_dir)
    return compose(layout, palette, scale=1, tile_dir=tile_dir)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("definitions", nargs="*", type=Path, help="set definition files (default: sets/*.txt)")
    parser.add_argument("--scale", type=int, default=8, help="enlargement factor for the review copy (default: 8)")
    parser.add_argument("-o", "--outdir", type=Path, default=OUTPUT_DIR)
    parser.add_argument("--tiledir", type=Path, default=TILE_DIR, help="where the part grids are (default: assets/tile)")
    args = parser.parse_args(argv)

    if args.scale < 1:
        raise SystemExit("error: --scale must be 1 or greater")

    try:
        palette = load_palette()
    except GridError as exc:
        print(f"FAIL {exc}", file=sys.stderr)
        return 2

    definitions = args.definitions or sorted(SET_DIR.glob("*.txt"))
    if not definitions:
        print("no set definitions found", file=sys.stderr)
        return 0

    args.outdir.mkdir(parents=True, exist_ok=True)
    failed = 0
    for path in definitions:
        try:
            image = assemble(read_layout(path), palette, args.tiledir)
        except GridError as exc:
            print(f"FAIL {display(path)}\n       {exc}", file=sys.stderr)
            failed += 1
            continue
        destination = args.outdir / f"{path.stem}.png"
        image.save(destination)
        if args.scale != 1:
            large = args.outdir / f"{path.stem}_x{args.scale}.png"
            image.resize((image.width * args.scale, image.height * args.scale), Image.NEAREST).save(large)
        print(f"ok   {display(path)} -> {display(destination)}  {image.width}x{image.height}")

    if failed:
        print(f"\n{failed} of {len(definitions)} set(s) failed", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
```

`chmod +x tools/sets.py`（ほかのツールと同じく実行ビットを付ける。`ls -l tools/` で揃っているか確かめる）。

- [ ] **Step 6: テストが通ることを確かめる**

Run: `.venv/bin/python -m unittest tests.test_sets -v`
Expected: 10 tests OK

Run: `.venv/bin/python -m unittest discover -s tests`
Expected: 126 tests OK（既存116 + 10。`tilemap` のテストも通ること）

- [ ] **Step 7: README と CLAUDE.md にコマンドを足す**

`CLAUDE.md` の「コマンド」のコードブロックで、`tools/sheet.py` の行の下に1行足す:

```sh
.venv/bin/python tools/sets.py                # 16px の部品を組んで物を出す（build/sets/）
```

`README.md`:
- 2章の「2.7 キャラのスプライトシート」の後ろに次の節を足し、今の「2.8 全アセットの一覧」を「2.9」にする

  ````markdown
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
  ````

- 2章の「まとめ」の図で、`sheet.py` の行の下に1行足す:

  ```
  sets.py ───────────── 部品を組んで物にする         ゲームに渡す成果物
  ```

- 3章のファイルの地図で、`sheets/<unit>.txt` の行の下に1行足す:

  ```
  sets/<物>.txt              物のセットの定義（16px の部品をどう組むか）
  ```

- [ ] **Step 8: コミット**

```bash
git add tools/tilemap.py tools/sets.py tests/test_sets.py tests/fixtures/set_part_*.txt README.md CLAUDE.md
git commit -m "feat: 16px の部品を組んで物の PNG を出す tools/sets.py を足す"
```

---

### Task 2: 村のセット

**Files:**
- Create: `/tmp/forge/draft.py`（その場限り。コミットしない）
- Create: `assets/tile/village_{nw,ne,sw,se}.txt`、`sets/village.txt`、`layouts/objects.txt`

**Interfaces:**
- Consumes: `tools/sets.py`（Task 1）
- Produces: `build/sets/village.png`（32×32）、`/tmp/forge/draft.py`（Task 3・4 でも使う）

- [ ] **Step 1: 下書きの道具を置く**

`/tmp/forge/draft.py`:

```python
"""Throwaway helper for drawing a 32x32 set as one grid and cutting it into 16px parts.

    draft.py init  <name>   /tmp/forge/<name>_32.txt from plain.txt laid 2x2 (header to fill in)
    draft.py split <name>   cut /tmp/forge/<name>_32.txt into assets/tile/<name>_{nw,ne,sw,se}.txt
    draft.py join  <name>   rebuild /tmp/forge/<name>_32.txt from the four parts
Run from the repository root.
"""
import sys
from pathlib import Path

TILE = Path("assets/tile")
DRAFT = Path("/tmp/forge")
QUADS = {"nw": (0, 0), "ne": (16, 0), "sw": (0, 16), "se": (16, 16)}


def split_file(path):
    lines = path.read_text(encoding="utf-8").splitlines()
    return [l for l in lines if l.startswith("#")], [l for l in lines if l and not l.startswith("#")]


def main():
    mode, name = sys.argv[1], sys.argv[2]
    draft = DRAFT / f"{name}_32.txt"
    if mode == "init":
        _, plain = split_file(TILE / "plain.txt")
        rows = [r + r for r in plain + plain]
        header = ["# type: tile", "# size: 32x32", "# light: upper-left",
                  "# map: g=grass_base a=grass_hi s=grass_shadow o=outline"]
        draft.write_text("\n".join(header + rows) + "\n", encoding="utf-8")
    elif mode == "split":
        header, rows = split_file(draft)
        if len(rows) != 32 or any(len(r) != 32 for r in rows):
            raise SystemExit(f"{draft}: need 32 rows of 32, got {len(rows)} rows of {sorted({len(r) for r in rows})}")
        header = ["# size: 16x16" if l.startswith("# size:") else l for l in header]
        for quad, (x0, y0) in QUADS.items():
            part = [r[x0:x0 + 16] for r in rows[y0:y0 + 16]]
            (TILE / f"{name}_{quad}.txt").write_text("\n".join(header + part) + "\n", encoding="utf-8")
    elif mode == "join":
        parts = {q: split_file(TILE / f"{name}_{q}.txt") for q in QUADS}
        header = ["# size: 32x32" if l.startswith("# size:") else l for l in parts["nw"][0]]
        top = [a + b for a, b in zip(parts["nw"][1], parts["ne"][1])]
        bottom = [a + b for a, b in zip(parts["sw"][1], parts["se"][1])]
        draft.write_text("\n".join(header + top + bottom) + "\n", encoding="utf-8")
    else:
        raise SystemExit(__doc__)


main()
```

Run: `mkdir -p /tmp/forge && .venv/bin/python /tmp/forge/draft.py init village`
Expected: `/tmp/forge/village_32.txt` に `plain` を 2×2 に並べた 32×32 ができる

- [ ] **Step 2: 手本を読む**

`types/tile/SPEC.md`、`assets/tile/village.txt`（今の家。屋根・壁・戸・窓の色の割り当て）、
`assets/tile/castle_nw.txt`（部品に分けた物の例）を読む。`build/tilemap/field_tiled.png` を見る
（無ければ `.venv/bin/python tools/tilemap.py --layout layouts/field.txt`）。

- [ ] **Step 3: 下書きに村を描く**

`/tmp/forge/village_32.txt` を編集する。

- ヘッダの map を今の `village.txt` と同じ割り当てにする:
  `# map: g=grass_base a=grass_hi s=grass_shadow o=outline` / `# map: r=roof_hi f=roof_base c=roof_shadow` /
  `# map: t=stone_hi n=stone_base` / `# map: w=wood_base b=wood_shadow x=wood_dark l=metal_hi`。
  説明のコメントを1〜3行足す（**コロンを書かない**）
- 小さな家を2〜3軒。1軒は幅12〜14px（今の家くらい）。奥の家を上、手前の家を下に置き、手前の家が奥の家の
  下端を隠してよい。屋根は `roof_*` で左上を明るく、壁は `stone_*`、戸は `wood_*`、窓は `metal_hi`
- 家の外は `plain` の草を残す。四辺の外周1〜2pxはできるだけ草のままにする（周りの `plain` とつなげるため）
- 各家の右下の草に `grass_shadow` の影を置く

Run: `.venv/bin/python tools/validate.py /tmp/forge/village_32.txt && .venv/bin/python tools/render.py /tmp/forge/village_32.txt -o /tmp/forge/png`
Expected: `ok`。`/tmp/forge/png/village_32_x8.png` を Read で見て直す

- [ ] **Step 4: 部品に切り、定義を書いて組む**

Run: `.venv/bin/python /tmp/forge/draft.py split village`

`sets/village.txt`:

```
# The village set. One map cell in character-tactics (32px), built from four 16px parts.
# tools/sets.py assembles it into build/sets/village.png.
village_nw  village_ne
village_sw  village_se
```

Run: `.venv/bin/python tools/validate.py assets/tile && .venv/bin/python tools/sets.py sets/village.txt`
Expected: 全部 `ok`、`build/sets/village.png  32x32`

- [ ] **Step 5: 確認用のマップを作って並べて見る**

`layouts/objects.txt`（村だけの版。Task 3・4 で行を足す）:

```
# The 32px object sets (tools/sets.py) on the grass they are laid on in character-tactics.
# Each set takes 2x2 of these 16px cells, which is one map cell in the game.
# The side-by-side pairs are there to check two sets next to each other.

plain      plain      plain      plain      plain      plain      plain      plain      plain      plain
plain      village_nw village_ne plain      plain      village_nw village_ne village_nw village_ne plain
plain      village_sw village_se plain      plain      village_sw village_se village_sw village_se plain
plain      plain      plain      plain      plain      plain      plain      plain      plain      plain
```

**行の長さは全部10列に揃える**（`read_layout` は長さの違う行で止まる）。

Run: `.venv/bin/python tools/tilemap.py --layout layouts/objects.txt`
Expected: `ok   objects -> build/tilemap/objects_tiled.png`。Read で見て、継ぎ目・別の物に見えないか・
2つ並べたときの見え方を確かめる

- [ ] **Step 6: ユニットと並べて見る**

`/tmp/forge/compare.py`:

```python
"""Throwaway: a 32px set next to Roran's standing frame, on plain, at 1x and 4x.

    compare.py <set name> [<set name> ...]   -> /tmp/forge/compare.png
Run from the repository root after tools/sets.py.
"""
import sys
from pathlib import Path

sys.path.insert(0, "tools")
from PIL import Image
from gridfile import load_palette, parse
from render import to_image
from tilemap import compose

palette = load_palette()
ground = compose([["plain"] * 2] * 2, palette, scale=1)
roran = to_image(parse(Path("assets/unit/roran/down_base.txt")), palette).convert("RGBA")

cells = []
for name in sys.argv[1:]:
    cells.append(Image.open(f"build/sets/{name}.png").convert("RGBA"))
    stand = ground.copy()
    stand.alpha_composite(roran)
    cells.append(stand)

strip = Image.new("RGBA", (32 * len(cells), 32))
for i, cell in enumerate(cells):
    strip.paste(cell, (32 * i, 0))
out = Image.new("RGBA", (strip.width * 5 + 8, 32 * 4 + 32 + 8), (60, 60, 70, 255))
out.paste(strip, (0, 0))
out.paste(strip.resize((strip.width * 4, 128), Image.NEAREST), (0, 40))
out.save("/tmp/forge/compare.png")
```

Run: `.venv/bin/python /tmp/forge/compare.py village`
Expected: `/tmp/forge/compare.png`。上段が等倍、下段が4倍。Read で見て、家がユニットより小さく見えないか確かめる

- [ ] **Step 7: 依頼者に見せて承認を待つ**

`build/sets/village_x8.png`・`build/tilemap/objects_tiled.png`・`/tmp/forge/compare.png` を Read で見せる。
差し戻されたら Step 3 に戻る（部品を直接直したときは `draft.py join village` で下書きを作り直してから）。
**承認されるまで次へ進まない。**

- [ ] **Step 8: コミット**

```bash
git add assets/tile/village_nw.txt assets/tile/village_ne.txt assets/tile/village_sw.txt assets/tile/village_se.txt sets/village.txt layouts/objects.txt
git commit -m "feat: 村を 16px の部品 2x2 の 32px セットで描く"
```

---

### Task 3: 岩のセット

**Files:**
- Create: `assets/tile/rock_{nw,ne,sw,se}.txt`、`sets/rock.txt`
- Modify: `layouts/objects.txt`

**Interfaces:**
- Consumes: `/tmp/forge/draft.py`・`/tmp/forge/compare.py`（Task 2）、`tools/sets.py`
- Produces: `build/sets/rock.png`（32×32）

- [ ] **Step 1: 下書きを作り、手本を読む**

Run: `.venv/bin/python /tmp/forge/draft.py init rock`

`assets/tile/rock.txt`（今の岩。`stone_*` の3階調と影の置き方）を読む。

- [ ] **Step 2: 下書きに岩を描く**

- ヘッダの map: `# map: g=grass_base a=grass_hi s=grass_shadow o=outline` / `# map: n=stone_base t=stone_hi m=stone_shadow`
  （`stone_dark` を使うなら `k=stone_dark` を足す。パレットにある色）。説明のコメントを1〜3行（コロン無し）
- 大きな岩1つ。幅24〜28px・高さ20px前後。左上の面を `stone_hi`、右下へ `stone_base` → `stone_shadow`。
  岩肌の割れ目を `stone_shadow` か `stone_dark` で1〜2本入れてよい。小石を1〜2個添えてよい
- 右下の草に `grass_shadow` の影。四辺の外周はできるだけ草のまま

Run: `.venv/bin/python tools/validate.py /tmp/forge/rock_32.txt && .venv/bin/python tools/render.py /tmp/forge/rock_32.txt -o /tmp/forge/png`
Expected: `ok`。`/tmp/forge/png/rock_32_x8.png` を Read で見て直す

- [ ] **Step 3: 部品に切り、定義を書いて組む**

Run: `.venv/bin/python /tmp/forge/draft.py split rock`

`sets/rock.txt`:

```
# The rock set. One map cell in character-tactics (32px), built from four 16px parts.
rock_nw  rock_ne
rock_sw  rock_se
```

Run: `.venv/bin/python tools/validate.py assets/tile && .venv/bin/python tools/sets.py sets/rock.txt`
Expected: 全部 `ok`、`build/sets/rock.png  32x32`

- [ ] **Step 4: 確認用のマップに足して見る**

`layouts/objects.txt` の末尾に、岩の行を足す（ほかの行と同じ10列に揃える）:

```
plain      rock_nw    rock_ne    plain      plain      rock_nw    rock_ne    village_nw village_ne plain
plain      rock_sw    rock_se    plain      plain      rock_sw    rock_se    village_sw village_se plain
plain      plain      plain      plain      plain      plain      plain      plain      plain      plain
```

Run: `.venv/bin/python tools/tilemap.py --layout layouts/objects.txt && .venv/bin/python /tmp/forge/compare.py village rock`
Expected: `ok`。`build/tilemap/objects_tiled.png` と `/tmp/forge/compare.png` を Read で見る

- [ ] **Step 5: 依頼者に見せて承認を待つ**

`build/sets/rock_x8.png`・`build/tilemap/objects_tiled.png`・`/tmp/forge/compare.png` を Read で見せる。
**承認されるまで次へ進まない。**

- [ ] **Step 6: コミット**

```bash
git add assets/tile/rock_nw.txt assets/tile/rock_ne.txt assets/tile/rock_sw.txt assets/tile/rock_se.txt sets/rock.txt layouts/objects.txt
git commit -m "feat: 岩を 16px の部品 2x2 の 32px セットで描く"
```

---

### Task 4: 木のセット

**Files:**
- Create: `assets/tile/tree_{nw,ne,sw,se}.txt`、`sets/tree.txt`
- Modify: `layouts/objects.txt`

**Interfaces:**
- Consumes: `/tmp/forge/draft.py`・`/tmp/forge/compare.py`（Task 2）、`tools/sets.py`
- Produces: `build/sets/tree.png`（32×32）

- [ ] **Step 1: 下書きを作り、手本を読む**

Run: `.venv/bin/python /tmp/forge/draft.py init tree`

`assets/tile/tree.txt`（今の木。樹冠を `leaf_*` で塗り、`grass_*` を使わない理由がコメントにある）と
`assets/tile/forest.txt` を読む。

- [ ] **Step 2: 下書きに木を描く**

- ヘッダの map: `# map: g=grass_base a=grass_hi s=grass_shadow o=outline` / `# map: e=leaf_hi f=leaf_base j=leaf_shadow` /
  `# map: w=wood_base b=wood_shadow`。説明のコメントを1〜3行（コロン無し）
- 大きな広葉樹1本。高さ28〜30px。樹冠は幅24〜28pxで、左上を `leaf_hi`、右下へ `leaf_base` → `leaf_shadow`。
  樹冠の中に葉の塊を2〜4つ、`leaf_shadow` の切れ目で見せる（今の `forest` の樹冠の描き方を参考にする）
- 幹は `wood_*`、幅3〜4px、根元を少し広げる。樹冠の外周に `outline`
- 幹の根元の右下に `grass_shadow` の影。四辺の外周はできるだけ草のまま（樹冠が上端に近づく場合は1px以上空ける）

Run: `.venv/bin/python tools/validate.py /tmp/forge/tree_32.txt && .venv/bin/python tools/render.py /tmp/forge/tree_32.txt -o /tmp/forge/png`
Expected: `ok`。`/tmp/forge/png/tree_32_x8.png` を Read で見て直す

- [ ] **Step 3: 部品に切り、定義を書いて組む**

Run: `.venv/bin/python /tmp/forge/draft.py split tree`

`sets/tree.txt`:

```
# The tree set. One map cell in character-tactics (32px), built from four 16px parts.
tree_nw  tree_ne
tree_sw  tree_se
```

Run: `.venv/bin/python tools/validate.py assets/tile && .venv/bin/python tools/sets.py`
Expected: 全部 `ok`。`build/sets/` に village・rock・tree の3つ

- [ ] **Step 4: 確認用のマップを仕上げて見る**

`layouts/objects.txt` の末尾に、木と森の行を足す（10列に揃える）:

```
plain      tree_nw    tree_ne    plain      tree_nw    tree_ne    forest     forest     forest     forest
plain      tree_sw    tree_se    plain      tree_sw    tree_se    forest     forest     forest     forest
plain      plain      plain      plain      rock_nw    rock_ne    forest     forest     forest     forest
plain      plain      plain      plain      rock_sw    rock_se    forest     forest     forest     forest
plain      plain      plain      plain      plain      plain      plain      plain      plain      plain
```

Run: `.venv/bin/python tools/tilemap.py --layout layouts/objects.txt && .venv/bin/python /tmp/forge/compare.py village rock tree`
Expected: `ok`。Read で見て、木が森や草に沈まないか、別の物に見えないかを確かめる

- [ ] **Step 5: 色と一覧を通す**

Run: `.venv/bin/python tools/check_colors.py -q; .venv/bin/python tools/contact_sheet.py`
Expected: `check_colors` の hard failure は既知の `knight` の1件だけ（新しい FAIL が無い）。
`build/contact_sheet.png` を Read で見て、新しい部品が既存のタイルから浮いていないか確かめる

- [ ] **Step 6: 依頼者に見せて承認を待つ**

`build/sets/tree_x8.png`・`build/tilemap/objects_tiled.png`・`/tmp/forge/compare.png` を Read で見せる。
**承認されるまで次へ進まない。**

- [ ] **Step 7: コミット**

```bash
git add assets/tile/tree_nw.txt assets/tile/tree_ne.txt assets/tile/tree_sw.txt assets/tile/tree_se.txt sets/tree.txt layouts/objects.txt
git commit -m "feat: 木を 16px の部品 2x2 の 32px セットで描く"
```

---

### Task 5: 待機の2コマ目（`*_breathe` 4枚）を剣を上げる絵にする

**Files:**
- Create: `/tmp/forge/raise.py`・`/tmp/forge/diff.py`（その場限り）
- Modify: `assets/unit/roran/{down,up,left,right}_breathe.txt`
- Modify: `types/unit/SPEC.md`（「アニメの規約」の `breathe`、「攻撃コマに限り」の項）

**Interfaces:**
- Produces: `build/sheets/roran.png`（Task 6 でコピーする）

- [ ] **Step 1: 下書きの道具を置く**

`/tmp/forge/raise.py`:

```python
"""Throwaway: start <dir>_breathe from <dir>_base with a rectangle moved up by N rows.

    raise.py <dir> <x0> <x1> <y0> <y1> [N=1]
Cells x0..x1, y0..y1 of the base move to y0-N..y1-N. The N rows left at the
bottom of the rectangle keep the base's pixels and have to be painted by hand
(that is where the arm joins the raised fist). Writes assets/unit/roran/<dir>_breathe.txt
with the base's header.
"""
import sys
from pathlib import Path

d, x0, x1, y0, y1 = sys.argv[1], *map(int, sys.argv[2:6])
n = int(sys.argv[6]) if len(sys.argv) > 6 else 1
base = Path(f"assets/unit/roran/{d}_base.txt").read_text(encoding="utf-8").splitlines()
header = [l for l in base if l.startswith("#")]
rows = [list(l) for l in base if l and not l.startswith("#")]
src = [r[:] for r in rows]
for y in range(y0 - n, y1 - n + 1):
    for x in range(x0, x1 + 1):
        rows[y][x] = src[y + n][x]
Path(f"assets/unit/roran/{d}_breathe.txt").write_text(
    "\n".join(header + ["".join(r) for r in rows]) + "\n", encoding="utf-8")
```

`/tmp/forge/diff.py`:

```python
"""Throwaway: which cells of <dir>_breathe differ from <dir>_base.

    diff.py <dir>
Prints each differing row as `y: x..x` and the tip row (the highest non-transparent row).
"""
import sys
from pathlib import Path

def rows(name):
    lines = Path(f"assets/unit/roran/{name}.txt").read_text(encoding="utf-8").splitlines()
    return [l for l in lines if l and not l.startswith("#")]

d = sys.argv[1]
a, b = rows(f"{d}_base"), rows(f"{d}_breathe")
for y, (ra, rb) in enumerate(zip(a, b)):
    xs = [x for x, (p, q) in enumerate(zip(ra, rb)) if p != q]
    if xs:
        print(f"{y:2}: {xs}")
print("top row base", next(y for y, r in enumerate(a) if r.strip(".")),
      "breathe", next(y for y, r in enumerate(b) if r.strip(".")))
```

- [ ] **Step 2: 4方向の下書きを作る**

剣（切っ先 y=5 から柄頭 y=20 まで）の範囲だけを1行上げる。**頭の輪郭と共有している列は範囲に入れない。**
範囲は `*_base.txt` を行番号付きで見て確かめる（`grep -v '^#' assets/unit/roran/down_base.txt | cat -n`）。
2026-09-28 に読んだ時点の目安:

| 方向 | 剣の列 | 備考 |
|---|---|---|
| `down` | x=6〜10 | 刃 x=7〜10、鍔 y=17 x=6〜10、拳 y=18〜19、柄頭 y=20 x=8〜10 |
| `right` | x=8〜11 | x=12 は刃と髪の境の輪郭。範囲に入れず、手で直す |
| `up` | x=21〜25 | 剣は体の奥。拳 y=18〜19 は体に半分隠れている |
| `left` | x=20〜22 | x=19 は刃と髪の境の輪郭。範囲に入れず、手で直す |

Run（1方向ずつ）: `.venv/bin/python /tmp/forge/raise.py down 6 10 5 20`（ほかの方向も上の表の列で）

**表の列で頭・胴・盾のセルまで動くと分かったら、直さずに止めて依頼者に報告する。**

- [ ] **Step 3: 手で仕上げる**

各 `*_breathe.txt` を編集する。

- 範囲の下端の1行（y=20）は `base` の柄頭が残っている。袖と腕（`cloth_*`・`skin_*`・`outline`）を描き足して、
  上がった拳と体をつなげる
- 範囲の外で、刃と髪の境の輪郭（`right` の x=12、`left` の x=19）は、刃が1行上がったぶんの形に合わせて直す。
  頭の中の画素は変えない
- `up` と `left` は剣が奥にある。体に重なる部分は描かない
- 刃の長さは11pxのまま。切っ先は y=4（頭頂より1px上）

Run: `.venv/bin/python tools/validate.py assets/unit/roran && for d in down up left right; do .venv/bin/python /tmp/forge/diff.py $d; done`
Expected: `validate` は全部 `ok`。差分のセルは剣と腕の範囲（と `right` / `left` の境の輪郭）だけ。
`top row base 5 breathe 4`

- [ ] **Step 4: シートとプレビューで見る**

Run: `.venv/bin/python tools/sheet.py sheets/roran.txt && .venv/bin/python tools/contact_sheet.py --help`

`contact_sheet.py` の引数の形を `--help` で確かめてから、4方向の `breathe` を `--columns 4` で並べる。
Expected: `sheet.py` の表で `*_breathe` の `foot_y` が 30、`center_x` が `base` と同じ（`off` が付かない）。
`build/sheets/roran_preview.png` を Read で見て、idle の2列で剣だけが1px上がっていることを確かめる

- [ ] **Step 5: 規約を書き換える**

`types/unit/SPEC.md` の「アニメの規約」で、`breathe` の項（「`breathe`: 頭を1px下げて首を1行潰す。…」から
「…輪郭なしでよい）」まで）を次に置き換える:

```markdown
- `breathe`（待機の2コマ目）: 頭・胴・脚・盾は `base` のまま、剣を持つ拳を剣ごと（刃・鍔・柄頭）1px上げる。
  拳が上がって空いたところは袖と腕を描き足してつなげる。刃の長さは変えない。
  `up` と `left` の剣は奥にあるので、体に重なる部分は描かない（立ち絵の規約）。
  頭を動かさないのは、依頼者の指摘「顔が動いているだけ。顔よりも手足を動かしたい」（GitHub #6）による
- **待機の2コマ目に限り、切っ先は頭頂（y=5）より1px上（y=4）に出てよい**
```

同じ節の「**攻撃コマに限り、切っ先は頭頂（y=5）より上に出てよい**（y=0 まで）」は残す。
冒頭の「決めた経緯は」の行に `docs/2026-09-28-issue6-forge-assets-spec.md` を足す。

- [ ] **Step 6: 依頼者に見せて承認を待つ**

`build/sheets/roran_preview.png` と、4方向の `breathe` を並べた contact sheet を Read で見せる。
1px と 2px の判断はここではせず、Task 6 でゲームで見てから行う。**承認されるまで次へ進まない。**

- [ ] **Step 7: コミット**

```bash
git add assets/unit/roran/down_breathe.txt assets/unit/roran/up_breathe.txt assets/unit/roran/left_breathe.txt assets/unit/roran/right_breathe.txt types/unit/SPEC.md
git commit -m "feat: ロランの待機の2コマ目を、頭ではなく剣を持つ拳を1px上げる絵にする"
```

---

### Task 6: character-tactics に入れて、ゲームで見る

作業ディレクトリは `/home/ubuntu/workspace/character-tactics`。

**Files:**
- Modify: `assets/images/roran-map.png`・`tile-village.png`・`tile-rock.png`・`tile-tree.png`
- Modify: `README.md`（「アセットの大きさの規約」の「まだ規約に追いついていないもの」）、`HANDOVER.md`
- Create: `/tmp/forge/cdp.mjs`（その場限り）

**Interfaces:**
- Consumes: forge の `build/sheets/roran.png`、`build/sets/{village,rock,tree}.png`

- [ ] **Step 1: ブランチを確かめる**

Run: `git status -sb | head -1`
Expected: `## feat/foot-box-and-tile-size...origin/feat/foot-box-and-tile-size`、作業ツリーはきれい

- [ ] **Step 2: コピーして実寸を確かめる**

```bash
F=/home/ubuntu/workspace/pixel-asset-forge/build
cp $F/sheets/roran.png assets/images/roran-map.png
cp $F/sets/village.png assets/images/tile-village.png
cp $F/sets/rock.png assets/images/tile-rock.png
cp $F/sets/tree.png assets/images/tile-tree.png
file assets/images/roran-map.png assets/images/tile-village.png assets/images/tile-rock.png assets/images/tile-tree.png
```

Expected: `roran-map.png` は `128 x 384`、tile の3枚は **`32 x 32`**（16 x 16 なら `build/tile/` を写している。止めて直す）

- [ ] **Step 3: テストを通す**

Run: `npm test`
Expected: 全部 PASS（`src/engine/sheet-size.test.ts` のタイルの実寸とシートの寸法を含む）

- [ ] **Step 4: ビルドしてブラウザを立てる**

```bash
npm run build
npx vite preview --port 4173 --strictPort
```

（`vite preview` はバックグラウンドで動かす。配信先は `http://127.0.0.1:4173/play/character-tactics/`）

```bash
~/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome --headless=new --no-sandbox --disable-gpu \
  --remote-debugging-port=9222 --window-size=540,945 --force-device-scale-factor=1 \
  'http://127.0.0.1:4173/play/character-tactics/?debug'
```

（これもバックグラウンドで動かす）

- [ ] **Step 5: CDP の道具を置く**

`/tmp/forge/cdp.mjs`:

```js
// Throwaway CDP driver for character-tactics (README "描画と入力をブラウザで確認する").
//   node cdp.mjs shot <out.png>        screenshot
//   node cdp.mjs tap <lx> <ly>         tap at logical coordinates (540x945)
//   node cdp.mjs key <key> [times]     keydown on window (?debug: P pause, . step, S slow)
import { writeFileSync } from 'node:fs';

const [cmd, ...args] = process.argv.slice(2);
const list = await (await fetch('http://127.0.0.1:9222/json/list')).json();
const page = list.find((t) => t.type === 'page');
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener('open', r, { once: true }));
let id = 0;
function send(method, params = {}) {
  const my = ++id;
  ws.send(JSON.stringify({ id: my, method, params }));
  return new Promise((resolve, reject) => {
    const on = (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id !== my) return;
      ws.removeEventListener('message', on);
      msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result);
    };
    ws.addEventListener('message', on);
  });
}
const evaluate = (expression) => send('Runtime.evaluate', { expression, awaitPromise: true });

if (cmd === 'shot') {
  const { data } = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(args[0], Buffer.from(data, 'base64'));
} else if (cmd === 'tap') {
  const [lx, ly] = args.map(Number);
  await evaluate(`(async () => {
    const c = document.getElementById('game');
    const r = c.getBoundingClientRect();
    const x = r.left + ${lx} * r.width / 540, y = r.top + ${ly} * r.height / 945;
    const o = { clientX: x, clientY: y, pointerId: 1, pointerType: 'touch', isPrimary: true, bubbles: true };
    c.dispatchEvent(new PointerEvent('pointerdown', o));
    await new Promise((r) => setTimeout(r, 50));
    c.dispatchEvent(new PointerEvent('pointerup', o));
  })()`);
} else if (cmd === 'key') {
  const times = Number(args[1] ?? 1);
  await evaluate(`for (let i = 0; i < ${times}; i++) window.dispatchEvent(new KeyboardEvent('keydown', { key: ${JSON.stringify(args[0])} }))`);
} else {
  throw new Error('usage: shot <file> | tap <lx> <ly> | key <key> [times]');
}
ws.close();
```

Run: `node /tmp/forge/cdp.mjs shot /tmp/forge/g0.png`
Expected: `/tmp/forge/g0.png` ができる。Read で見る

Step 6 の切り出しは「論理座標の1px＝スクリーンショットの1px」を前提にしている。`g0.png` が 540×945 で、
canvas が画面いっぱい（左上 0,0）に出ていることを Read で確かめる。ずれていたら、止めて依頼者に報告する。

- [ ] **Step 6: stage1 の戦闘まで進めて撮る**

`shot` → Read → 押す場所の論理座標を読む → `tap`、をくり返して、ステージ選択 → stage1 → 会話 → 配置 → 戦闘開始まで進む。
戦闘が始まったら `node /tmp/forge/cdp.mjs key P` で一時停止して `shot /tmp/forge/map.png`。

村（マス 3,4）・岩（11,9）・木（2,11 と 13,18）のまわりを切り出して4倍にする。`/tmp/forge/crop.py`:

```python
"""Throwaway: crop logical rectangles out of a screenshot and enlarge them 4x.

    crop.py <in.png> <out.png> <x0> <y0> <x1> <y1> [<x0> <y0> <x1> <y1> ...]
The screenshot is taken at 540x945 with device scale 1, so a logical pixel is a screen pixel.
"""
import sys
from PIL import Image

src = Image.open(sys.argv[1]).convert("RGB")
boxes = [tuple(map(int, sys.argv[i:i + 4])) for i in range(3, len(sys.argv), 4)]
crops = [src.crop(b).resize(((b[2] - b[0]) * 4, (b[3] - b[1]) * 4), Image.NEAREST) for b in boxes]
out = Image.new("RGB", (sum(c.width for c in crops) + 8 * len(crops), max(c.height for c in crops)), (60, 60, 70))
x = 0
for c in crops:
    out.paste(c, (x, 0))
    x += c.width + 8
out.save(sys.argv[2])
```

マス (cx, cy) の論理座標は `x = 14 + 32*cx`、`y = 50 + 32*cy`（`MAP_ORIGIN`）。1マスの周りを1マスずつ広げて切る。

Run: `/home/ubuntu/workspace/pixel-asset-forge/.venv/bin/python /tmp/forge/crop.py /tmp/forge/map.png /tmp/forge/map_objects.png 78 146 174 242 334 306 430 402 46 370 142 466`
Expected: 村・岩・木を4倍にした画像。Read で見る

- [ ] **Step 7: 待機の2コマを撮る**

一時停止のまま、動いていない味方の近くを切り出せるように、`map.png` でロランの位置を読む（`?debug` で足元の下に
`idle 0` / `idle 1` が出る）。

```bash
node /tmp/forge/cdp.mjs shot /tmp/forge/idle_a.png
node /tmp/forge/cdp.mjs key . 15
node /tmp/forge/cdp.mjs shot /tmp/forge/idle_b.png
```

（`.` 1回で 1/60 秒。idle は 4fps なので15回で次のコマ）`idle_a` と `idle_b` でロランのコマ番号が違うことを
確かめ、ロランの周り（64×64 くらい）を両方から `crop.py` で切って並べる。

- [ ] **Step 8: 依頼者に見せて、1px のままか 2px にするかを決めてもらう**

`/tmp/forge/map.png`・`/tmp/forge/map_objects.png`・待機の2コマを並べた画像を Read で見せる。
**2px にすると決まったら、Task 7 に進む前に Task 5 を2pxでやり直す**（`raise.py` の最後の引数に 2、
規約の「1px」を「2px」・切っ先を「y=3」に。Step 2〜8 をもう一度）。

- [ ] **Step 9: README と HANDOVER を直す**

`README.md` の「アセットの大きさの規約」の「**まだ規約に追いついていないもの:**」の段落から、次の文を消す:

```
物は今のところ16pxの1枚で、1マスに2×2で敷かれて4つ並んで見える
（ゲームは32pxの画像を1マスに1枚で描けるので、forge で32pxのセットに描き直して差し替える）。
```

残る文（複数マスの物・顔と役割アイコン・forge との関係）は変えない。

`HANDOVER.md` の「issue #6 への対応の順番」の4を次にする:

```
4. forge 側: 待機アニメで剣を持つ腕を動かす、村・岩・木を 16px×2×2 のセットで描き直す、森の絵 → **済み**（forge のブランチ `docs/issue6-asset-policy`、PNG はこのブランチ `feat/foot-box-and-tile-size` にコピー済み。森は今の `forest` をそのまま使い、⑤でコピーする）
```

「5. ゲーム側: 森で移動が遅くなる」の頭に「**← 次はここ**」を移す。

- [ ] **Step 10: 片付けとコミット**

`vite preview` と chrome を止める。

```bash
git add assets/images/roran-map.png assets/images/tile-village.png assets/images/tile-rock.png assets/images/tile-tree.png README.md HANDOVER.md
git commit -m "feat: 村・岩・木を 32px の絵に、ロランの待機を剣を上げる動きに差し替える"
```

---

### Task 7: forge の正典を合わせて、全体を検証する

作業ディレクトリは `/home/ubuntu/workspace/pixel-asset-forge`。

**Files:**
- Modify: `types/tile/SPEC.md`、`README.md`、`CLAUDE.md`、`ISSUES.md`

- [ ] **Step 1: `types/tile/SPEC.md` に物のセットの節を足す**

「セット構成」の「草原（45点）」の見出しを「草原（57点）」にし、「木と岩」の行の下に1行足す:

```markdown
- 物のセットの部品（下記）`village_{nw,ne,sw,se}` `rock_{nw,ne,sw,se}` `tree_{nw,ne,sw,se}`
```

「城内セットの決めごと」の前に、次の節を足す:

```markdown
## 物のセット（32px）

character-tactics の1マス（32px）を占める物は、16px の部品4枚を 2×2 に組んだセットで作る
（character-tactics の README「アセットの大きさの規約」）。今あるのは村・岩・木の3つ。
決めた経緯は `docs/2026-09-28-issue6-forge-assets-spec.md`。

- 部品は `assets/tile/<物>_{nw,ne,sw,se}.txt`。普通の16×16のタイルで、この節以外の規約はそのまま効く
- 組み方は `sets/<物>.txt` に書き、`tools/sets.py` で `build/sets/<物>.png` に組む。ゲームに渡すのはこちら
- **物は地面（草）を背景に含めて描く。** 外周の草は `plain` と同じ色・同じ密度にして、四辺は `plain` と
  隣り合っても継ぎ目が見えないようにする。ゲームでは周りに `plain` が敷かれる
- 部品は光と影の向きがあるので、ミラーの派生にしない
- 1マスより大きい物（城の2×2マス＝64pxなど）も同じ形で作れる（定義の行と列を増やす）
- 16pxの1枚ものの `village` `rock` `tree` は残してある（依頼者の判断、2026-09-28）。ゲームで使うのはセットの方
- 目視は `tilemap.py --layout layouts/objects.txt`（3つのセットと森を `plain` に置いたマップ）で締める
```

「目視の手順」の3の後ろに1行足す:

```markdown
4. 物のセットは、ユニット（背丈24〜26px）と並べて見劣りしないかも見る
```

- [ ] **Step 2: README と CLAUDE.md の残りを直す**

`README.md`:
- 3章の「今あるアセット」の表の `tile` の行を `| \`tile\`（マップ） | 77点（草原57・城内20）。うち12点は物のセット3つ（村・岩・木）の部品 | 16x16（セットは 32x32） | ... |` にする（規約の列はそのまま）
- 4章の 4.3 の5「型ごとの追加確認」の `tile` の行に「物のセットなら `sets.py` で組み、`layouts/objects.txt` で見る」を足す

`CLAUDE.md`:
- 「コマンド」の下の文「`tilemap.py --layout layouts/{example,field,castle_interior}.txt` でマップを組む。」を
  `layouts/{example,field,castle_interior,objects}.txt` にする

- [ ] **Step 3: ISSUES.md を直す**

- 実行中に見つけて直さなかったことを、該当する表に1行ずつ足す（出どころは `2026-09-28`）
- 「決めてもらう必要があるもの」の「ゲームリポジトリごとのアセット作成の方針と手順が無い」の詳細に、
  「村・岩・木は 2026-09-28 に 32px のセットに描き直した（`types/tile/SPEC.md`「物のセット（32px）」）」を足す

- [ ] **Step 4: 全体を検証する**

```bash
.venv/bin/python -m unittest discover -s tests
.venv/bin/python tools/validate.py
.venv/bin/python tools/check_colors.py -q
.venv/bin/python tools/render.py > /dev/null
.venv/bin/python tools/sets.py
.venv/bin/python tools/sheet.py sheets/roran.txt
.venv/bin/python tools/tilemap.py --layout layouts/objects.txt
.venv/bin/python tools/contact_sheet.py
```

Expected: unittest は 126 tests OK。`validate` は非ゼロで終わらない。`check_colors` の hard failure は既知の
`knight` の1件だけ。ほかはすべて `ok`

- [ ] **Step 5: コミット**

```bash
git add types/tile/SPEC.md README.md CLAUDE.md ISSUES.md
git commit -m "docs: 物のセット（32px）の規約と使い方を正典に書く"
```

- [ ] **Step 6: 報告して止まる**

forge と character-tactics のそれぞれで `git log --oneline` と `git status` を見せ、次を報告する。
push と PR はしない。

- 作ったもの（セット3つ・待機4コマ・`tools/sets.py`）と、依頼者が承認した画像
- 実行したチェックとその結果
- ISSUES.md に足した課題
- 残っていること（push・PR・#19→#20 のマージ順）

---

## 完了後

依頼者の指示を待つ。PR は forge の `docs/issue6-asset-policy`（ISSUES.md の2コミット＋この作業）と、
character-tactics の #19 → #20 の順になる。
