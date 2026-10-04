# ユニットのドット絵を描く標準のワークフロー（ガウで試す） Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 依頼者の判断を減らしてユニットのドット絵を描くワークフローを forge に整え、ガウを1体描いて、判断の回数と品質をロラン・イネスと比べる。

**Architecture:** 道具は先に2本（`unit_check.py` = 自己チェック①、`compose.py` = 部品の重ね合わせ）を TDD で forge の `tools/` に入れ、CP0 の直前に案を並べる道具と顔を戻す道具を移す。手順は forge の `types/unit/SPEC.md` に「描く手順」として書き、その手順どおりにガウを CP0〜CP4 で止まりながら描く。絵の判断は依頼者、組み合わせと自己チェックは Claude。

**Tech Stack:** Python 3.14（`pixel-asset-forge/.venv`）、Pillow、unittest。ゲーム側は TypeScript（Vite・Vitest）だが、この計画ではゲームのコードを変えない。

**Spec:** `docs/superpowers/specs/2026-10-04-unit-drawing-workflow-design.md`

## Global Constraints

- forge のコマンドは `pixel-asset-forge/` で実行する。Python は `.venv/bin/python`（3.14）。`tools/` を触ったら `.venv/bin/python -m unittest discover -s tests` を通す
- テストは `assets/` の生きている絵を読まない（forge の CLAUDE.md「回帰テストに現役のアートを参照させない」）。テストのグリッドはテストの中で作るか `tests/fixtures/` に置く
- グリッドの `#` 行に半角コロン `:` を入れると、正しいヘッダでなければ `GridError` になる。コメント行には半角コロンを書かない
- 部品は `# type: unit`・`# size: 32x32` のグリッドで、32×32 のコマの上のユニットに載る位置に描く。ユニットだけの部品は `assets/unit/<ユニット>/parts/`、使い回す武器は `assets/part/`
- 組み立ての設定ファイルは `pixel-asset-forge/compose/<ユニット>.json`（`assets/` の下に置くと `validate.py` がグリッドとして読んで落ちる）
- コミットは Conventional Commits（`feat:` / `fix:` / `docs:` / `test:` など）＋日本語の要約
- **絵を変えたら、見せる前にコミットや次の段階へ進まない。** 確認ポイント（CP0〜CP4）では必ず止まる
- 確認ポイントで見せた絵を自己チェックのために1〜2画素だけ直すときは、事後の報告でよい（台帳に「事後報告」と書く）
- 計画の不備が見つかったら、直す前に止めて依頼者に報告する
- PR は依頼者の指示で作る
- 進捗台帳は `.superpowers/sdd/2026-10-04-unit-workflow-gau/progress.md`（git 管理外）。作業スクリプトも同じフォルダに置く

## Review Focus

1. 部品をずらしてコマの外へはみ出す設定 → 黙って切り落とさず、部品の名前と画素の位置を出して止まる（Task 2 のテスト `test_shift_out_of_frame_is_an_error`）
2. 体と部品で同じ文字が別の色に割り当てられている → 黙ってどちらかを採らず止まる（Task 2 `test_letter_mapped_to_two_colours_is_an_error`）
3. `compose.py --check` で、まだ書き出していないコマがある → 落ちずに「差あり」と数える（Task 2 `test_check_reports_missing_output`）
4. `base` の無い向きのコマがある → 比べる相手が無いことを名前付きで出す（Task 1 `test_frame_without_base_is_an_error`）
5. 脚の画素が無いコマ（作りかけ・部品だけのもの）→ `min()` の例外でなく、コマの名前付きで出す（Task 1 `test_frame_without_legs_is_an_error`）

---

### Task 1: 自己チェック① `unit_check.py`

**Files:**
- Create: `pixel-asset-forge/tools/unit_check.py`
- Create: `pixel-asset-forge/tests/test_unit_check.py`
- Modify: `pixel-asset-forge/CLAUDE.md`（「コマンド」の一覧）
- Modify: `pixel-asset-forge/README.md`（2.7 キャラのスプライトシート の末尾）

**Interfaces:**
- Consumes: `gridfile.parse(path) -> Grid`（`Grid.rows: list[str]`）、`gridfile.BACKGROUND`、`gridfile.GridError`
- Produces:
  - `class UnitCheckError(Exception)`
  - `leg_center(rows: list[str], items: set[str]) -> float`
  - `open_edges(rows: list[str]) -> set[tuple[int, int]]`
  - `load_frames(directory: Path) -> dict[str, list[str]]`
  - `check_legs(frames: dict[str, list[str]], items: set[str]) -> list[str]`（失敗の文。空なら ok）
  - `new_edges(frames: dict[str, list[str]]) -> dict[str, list[tuple[int, int]]]`
  - `main(argv: list[str] | None = None) -> int`（0 ok / 1 脚の中心がそろわない / 2 入力の誤り）
  - コマンド: `tools/unit_check.py DIR [--items CHARS]`

- [ ] **Step 1: 失敗するテストを書く**

`pixel-asset-forge/tests/test_unit_check.py`:

```python
"""Checks for tools/unit_check.py (自己チェック①)."""
from __future__ import annotations

import contextlib
import io
import sys
import tempfile
import unittest
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT / "tools"))

from unit_check import (  # noqa: E402
    UnitCheckError,
    check_legs,
    leg_center,
    load_frames,
    main,
    new_edges,
    open_edges,
)


def body(x0: int, y0: int, x1: int, y1: int, fill: str = "b") -> dict[tuple[int, int], str]:
    """Filled rectangle with a 1px outline, both corners inclusive."""
    pixels = {}
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            edge = x in (x0, x1) or y in (y0, y1)
            pixels[(x, y)] = "o" if edge else fill
    return pixels


def rows_of(pixels: dict[tuple[int, int], str], size: int = 32) -> list[str]:
    grid = [["."] * size for _ in range(size)]
    for (x, y), ch in pixels.items():
        grid[y][x] = ch
    return ["".join(r) for r in grid]


def grid_text(pixels: dict[tuple[int, int], str], maps: str = "o=outline b=skin_base k=wood_base") -> str:
    header = "# type: unit\n# size: 32x32\n# light: upper-left\n# bg: transparent\n"
    return header + f"# map: {maps}\n" + "\n".join(rows_of(pixels)) + "\n"


class LegCenterTest(unittest.TestCase):
    def test_center_of_leg_pixels(self):
        rows = rows_of(body(12, 20, 19, 30))
        self.assertEqual(leg_center(rows, set()), 15.5)

    def test_items_are_left_out(self):
        pixels = body(12, 20, 19, 30)
        pixels.update({(24, 26): "k", (25, 26): "k"})
        self.assertEqual(leg_center(rows_of(pixels), {"k"}), 15.5)

    def test_frame_without_legs_is_an_error(self):
        rows = rows_of(body(12, 4, 19, 20))
        with self.assertRaises(UnitCheckError):
            leg_center(rows, set())


class OpenEdgesTest(unittest.TestCase):
    def test_outlined_body_has_no_open_edge(self):
        self.assertEqual(open_edges(rows_of(body(12, 20, 19, 30))), set())

    def test_pixel_touching_transparency_is_open(self):
        pixels = body(12, 20, 19, 30)
        pixels[(19, 25)] = "b"
        self.assertEqual(open_edges(rows_of(pixels)), {(19, 25)})

    def test_pixel_on_frame_border_is_open(self):
        self.assertEqual(open_edges(rows_of({(0, 5): "b"})), {(0, 5)})


class CheckLegsTest(unittest.TestCase):
    def test_aligned_frames_pass(self):
        frames = {"down_base": rows_of(body(12, 20, 19, 30)),
                  "down_walk_a": rows_of(body(12, 20, 19, 30))}
        self.assertEqual(check_legs(frames, set()), [])

    def test_shifted_frame_fails_with_names(self):
        frames = {"down_base": rows_of(body(12, 20, 19, 30)),
                  "down_walk_a": rows_of(body(13, 20, 20, 30)),
                  "left_base": rows_of(body(10, 20, 17, 30))}
        failures = check_legs(frames, set())
        self.assertEqual(len(failures), 1)
        self.assertIn("down", failures[0])
        self.assertIn("down_walk_a=16.5", failures[0])

    def test_error_names_the_frame_without_legs(self):
        frames = {"down_base": rows_of(body(12, 4, 19, 20))}
        with self.assertRaisesRegex(UnitCheckError, "down_base"):
            check_legs(frames, set())


class NewEdgesTest(unittest.TestCase):
    def test_only_edges_missing_from_base_are_reported(self):
        base = body(12, 20, 19, 30)
        base[(12, 30)] = "b"  # an open edge the base already has
        frame = dict(base)
        frame[(19, 25)] = "b"
        result = new_edges({"down_base": rows_of(base), "down_walk_a": rows_of(frame)})
        self.assertEqual(result, {"down_walk_a": [(19, 25)]})

    def test_frame_without_base_is_an_error(self):
        with self.assertRaisesRegex(UnitCheckError, "up_base"):
            new_edges({"up_walk_a": rows_of(body(12, 20, 19, 30))})


class LoadFramesTest(unittest.TestCase):
    def test_reads_direction_frames_only(self):
        with tempfile.TemporaryDirectory() as tmp:
            d = Path(tmp)
            (d / "down_base.txt").write_text(grid_text(body(12, 20, 19, 30)), encoding="utf-8")
            (d / "notes.txt").write_text(grid_text({}), encoding="utf-8")
            (d / "parts").mkdir()
            (d / "parts" / "down_hood.txt").write_text(grid_text({}), encoding="utf-8")
            self.assertEqual(list(load_frames(d)), ["down_base"])

    def test_empty_directory_is_an_error(self):
        with tempfile.TemporaryDirectory() as tmp:
            with self.assertRaises(UnitCheckError):
                load_frames(Path(tmp))


class MainTest(unittest.TestCase):
    def run_main(self, argv: list[str]) -> tuple[int, str, str]:
        out, err = io.StringIO(), io.StringIO()
        with contextlib.redirect_stdout(out), contextlib.redirect_stderr(err):
            code = main(argv)
        return code, out.getvalue(), err.getvalue()

    def write_unit(self, d: Path, walk: dict[tuple[int, int], str]) -> None:
        (d / "down_base.txt").write_text(grid_text(body(12, 20, 19, 30)), encoding="utf-8")
        (d / "down_walk_a.txt").write_text(grid_text(walk), encoding="utf-8")

    def test_aligned_unit_exits_zero_even_with_new_edges(self):
        with tempfile.TemporaryDirectory() as tmp:
            walk = body(12, 20, 19, 30)
            walk[(19, 22)] = "b"  # 脚より上（y<24）なので脚の中心は変わらない
            self.write_unit(Path(tmp), walk)
            code, out, _ = self.run_main([tmp])
            self.assertEqual(code, 0)
            self.assertIn("(19,22)", out)

    def test_misaligned_unit_exits_one(self):
        with tempfile.TemporaryDirectory() as tmp:
            self.write_unit(Path(tmp), body(13, 20, 20, 30))
            code, _, err = self.run_main([tmp])
            self.assertEqual(code, 1)
            self.assertIn("FAIL", err)

    def test_missing_directory_exits_two(self):
        code, _, err = self.run_main(["/nonexistent/unit"])
        self.assertEqual(code, 2)
        self.assertIn("error", err)


if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 2: テストが落ちることを確かめる**

Run: `cd pixel-asset-forge && .venv/bin/python -m unittest tests.test_unit_check -v`
Expected: FAIL（`ModuleNotFoundError: No module named 'unit_check'`）

- [ ] **Step 3: 実装する**

`pixel-asset-forge/tools/unit_check.py`:

```python
#!/usr/bin/env python3
"""ユニットのコマを、見せる前に機械で確かめる（自己チェック①）。

    tools/unit_check.py assets/unit/ines --items klmstuw
    tools/unit_check.py assets/unit/roran --items GHJRkmns

1. 脚の中心: 向きごとに、全コマの脚（y>=24 の画素から、輪郭 `o` と --items の文字を除く）の
   左右の中心がそろっているか。そろっていなければ失敗（終了コード 1）。
   持ち物が体の横へはみ出すユニット（弓）では `sheet.py` の中心の判定が使えないので、こちらで確かめる。
2. 増えた輪郭の切れ目: 輪郭でない画素で、上下左右のどれかが透明かコマの外のもののうち、
   同じ向きの `<向き>_base` に無いもの。報告だけで、終了コードには影響しない。
   歩きの足先のようにわざと切れているものもあるので、1件ずつ目で確かめる。

完成済みのロラン・イネスで測った偽陽性（2026-10-04）: 脚の中心 0件、増えた切れ目 7件
（歩きの足先5、攻撃2）。輪郭の切れ目をそのまま数えると 140か所、孤立した1画素は 824か所で、
どちらも検査に使えなかった（docs/superpowers/specs/2026-10-04-unit-drawing-workflow-design.md）。

DIR の直下の `<向き>_<名前>.txt` だけを読む（`parts/` などの下は読まない）。
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from gridfile import BACKGROUND, GridError, parse  # noqa: E402

DIRECTIONS = ("down", "up", "left", "right")
OUTLINE = "o"
LEG_TOP = 24
NEIGHBOURS = ((1, 0), (-1, 0), (0, 1), (0, -1))


class UnitCheckError(Exception):
    """入力がこの検査の前提に合わない。"""


def _direction(name: str) -> str:
    return name.split("_", 1)[0]


def leg_center(rows: list[str], items: set[str]) -> float:
    xs = [
        x
        for y, row in enumerate(rows)
        if y >= LEG_TOP
        for x, ch in enumerate(row)
        if ch not in items and ch not in (BACKGROUND, OUTLINE)
    ]
    if not xs:
        raise UnitCheckError(f"脚の画素が無い（y>={LEG_TOP} に輪郭と持ち物以外の画素が無い）")
    return (min(xs) + max(xs)) / 2


def open_edges(rows: list[str]) -> set[tuple[int, int]]:
    height = len(rows)
    found: set[tuple[int, int]] = set()
    for y, row in enumerate(rows):
        for x, ch in enumerate(row):
            if ch in (BACKGROUND, OUTLINE):
                continue
            for dx, dy in NEIGHBOURS:
                nx, ny = x + dx, y + dy
                if not (0 <= ny < height and 0 <= nx < len(rows[ny])) or rows[ny][nx] == BACKGROUND:
                    found.add((x, y))
                    break
    return found


def load_frames(directory: Path) -> dict[str, list[str]]:
    frames: dict[str, list[str]] = {}
    for path in sorted(directory.glob("*.txt")):
        if _direction(path.stem) not in DIRECTIONS:
            continue
        frames[path.stem] = parse(path).rows
    if not frames:
        raise UnitCheckError(f"{directory}: <向き>_<名前>.txt が1つも無い")
    return frames


def check_legs(frames: dict[str, list[str]], items: set[str]) -> list[str]:
    by_direction: dict[str, dict[str, float]] = {}
    for name, rows in frames.items():
        try:
            center = leg_center(rows, items)
        except UnitCheckError as exc:
            raise UnitCheckError(f"{name}: {exc}") from None
        by_direction.setdefault(_direction(name), {})[name] = center

    failures = []
    for direction in DIRECTIONS:
        centers = by_direction.get(direction)
        if centers and len(set(centers.values())) > 1:
            detail = " ".join(f"{name}={center:g}" for name, center in sorted(centers.items()))
            failures.append(f"{direction}: 脚の中心がそろっていない: {detail}")
    return failures


def new_edges(frames: dict[str, list[str]]) -> dict[str, list[tuple[int, int]]]:
    result: dict[str, list[tuple[int, int]]] = {}
    for name, rows in frames.items():
        base = f"{_direction(name)}_base"
        if name == base:
            continue
        if base not in frames:
            raise UnitCheckError(f"{name}: 比べる {base} が無い")
        extra = open_edges(rows) - open_edges(frames[base])
        if extra:
            result[name] = sorted(extra, key=lambda p: (p[1], p[0]))
    return result


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("directory", type=Path, help="assets/unit/<ユニット>")
    parser.add_argument("--items", default="", help="持ち物の文字。脚の中心から除く（例: klmstuw）")
    args = parser.parse_args(argv)

    if not args.directory.is_dir():
        print(f"error: ディレクトリが無い: {args.directory}", file=sys.stderr)
        return 2
    try:
        frames = load_frames(args.directory)
        failures = check_legs(frames, set(args.items))
        edges = new_edges(frames)
    except (GridError, UnitCheckError) as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 2

    for name, points in edges.items():
        print(f"切れ目（{name}、base から増えた分）: " + " ".join(f"({x},{y})" for x, y in points))
    total = sum(len(points) for points in edges.values())
    print(f"増えた切れ目: {total} 件（報告だけ。1件ずつ目で確かめる）")

    for failure in failures:
        print(f"FAIL {failure}", file=sys.stderr)
    if failures:
        return 1
    print("脚の中心: ok")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
```

- [ ] **Step 4: テストが通ることを確かめる**

Run: `cd pixel-asset-forge && .venv/bin/python -m unittest tests.test_unit_check -v`
Expected: すべて PASS

- [ ] **Step 5: 既存のユニットに掛けて偽陽性を確かめる**

Run:
```bash
cd pixel-asset-forge
.venv/bin/python tools/unit_check.py assets/unit/roran --items GHJRkmns; echo "exit $?"
.venv/bin/python tools/unit_check.py assets/unit/ines --items klmstuw; echo "exit $?"
```
Expected: どちらも `脚の中心: ok`・`exit 0`。増えた切れ目はロラン5件（`down_atk_hit` (10,16)、`left_walk_a` (11,28)、`right_walk_a` (20,28)、`up_atk_hit` (21,16)、`up_atk_wind` (21,16)）、イネス2件（`left_walk_a` (12,28)、`right_walk_a` (19,28)）。
数が違ったら、直す前に止めて依頼者に報告する（spec に書いた偽陽性の数が変わるため）。
ロランの `--items` に刃の `i`・`j`（`stone_hi`・`stone_base`）を足すと、`down` の脚の中心が 15.0 と 15.5 に分かれる（計画を書くときに測った）。持ち物の文字はユニットごとに測って決め、SPEC に書く。

- [ ] **Step 6: forge の CLAUDE.md と README に道具を書く**

`pixel-asset-forge/CLAUDE.md` の「コマンド」のコードブロックで、`sheet_gif.py` の行の次に足す:

```sh
.venv/bin/python tools/unit_check.py assets/unit/ines --items klmstuw  # unit の脚の中心と増えた切れ目（自己チェック①）
```

`pixel-asset-forge/README.md` の「### 2.7 キャラのスプライトシート」の節の末尾（次の `### 2.8` の見出しの直前）に足す:

````markdown
見せる前に、`tools/unit_check.py` で機械的に確かめられることを確かめる。

```sh
.venv/bin/python tools/unit_check.py assets/unit/ines --items klmstuw
```

- **脚の中心**: 向きごとに、全コマの脚（y=24 から下。輪郭と `--items` の持ち物の文字を除く）の中心がそろっているか。そろっていなければ終了コード 1
- **増えた切れ目**: 同じ向きの `base` に無かった輪郭の切れ目を並べる。歩きの足先のようにわざと切れているものもあるので、報告だけ（終了コードは変わらない）
````

- [ ] **Step 7: forge のテストを全部流す**

Run: `cd pixel-asset-forge && .venv/bin/python -m unittest discover -s tests`
Expected: `OK`

- [ ] **Step 8: コミット**

```bash
git add pixel-asset-forge/tools/unit_check.py pixel-asset-forge/tests/test_unit_check.py pixel-asset-forge/CLAUDE.md pixel-asset-forge/README.md
git commit -m "feat: unit の脚の中心と増えた輪郭の切れ目を確かめる unit_check.py を足す"
```

---

### Task 2: 部品の重ね合わせ `compose.py`

**Files:**
- Create: `pixel-asset-forge/tools/compose.py`
- Create: `pixel-asset-forge/tests/test_compose.py`
- Modify: `pixel-asset-forge/CLAUDE.md`（「コマンド」の一覧）
- Modify: `pixel-asset-forge/README.md`（2.7 の末尾、Task 1 で足した段落の後）

**Interfaces:**
- Consumes: `gridfile.parse`、`gridfile.Grid`（`rows`・`charmap`・`width`・`height`・`headers`・`path`）、`gridfile.BACKGROUND`、`gridfile.GridError`、`gridfile.REPO_ROOT`
- Produces:
  - `class ComposeError(Exception)`
  - `@dataclass Layer(part: Path, z: str, dx: int = 0, dy: int = 0)`（`z` は `"front"` か `"back"`）
  - `@dataclass FrameSpec(body: Path, layers: list[Layer])`
  - `load_config(path: Path, root: Path = REPO_ROOT) -> tuple[str, dict[str, FrameSpec]]`（ユニット名とコマごとの組み立て方）
  - `compose_frame(body: Grid, layers: list[tuple[Grid, Layer]]) -> tuple[list[str], list[list[tuple[str, str]]]]`（行と、`# map:` 行ごとの (文字, 色) の組）
  - `render_text(body: Grid, rows: list[str], groups: list[list[tuple[str, str]]], note: str) -> str`
  - `main(argv: list[str] | None = None) -> int`（0 ok / 1 `--check` で差あり / 2 入力の誤り）
  - コマンド: `tools/compose.py compose/<ユニット>.json [--frames NAME ...] [--out DIR] [--check]`
  - 設定ファイルの形:
    ```json
    {
      "unit": "gau",
      "frames": {
        "down_base": {
          "body": "types/unit/base/female_down.txt",
          "layers": [
            {"part": "assets/unit/gau/parts/hood_down.txt", "z": "front"},
            {"part": "assets/part/dagger/dagger_down.txt", "z": "back", "dx": 1, "dy": 0}
          ]
        }
      }
    }
    ```
    パスは forge の直下からの相対。部品は書いた順に重ねる。`front` は部品の透明でない画素をすべて上に描く。`back` は、その時点で透明な画素にだけ描く（体や先に描いた部品に隠れる）

- [ ] **Step 1: 失敗するテストを書く**

`pixel-asset-forge/tests/test_compose.py`:

```python
"""Checks for tools/compose.py (部品の重ね合わせ)."""
from __future__ import annotations

import contextlib
import io
import json
import sys
import tempfile
import unittest
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT / "tools"))

from compose import ComposeError, Layer, compose_frame, load_config, main, render_text  # noqa: E402
from gridfile import parse  # noqa: E402


def grid_text(pixels: dict[tuple[int, int], str], maps: str, size: int = 32) -> str:
    rows = [["."] * size for _ in range(size)]
    for (x, y), ch in pixels.items():
        rows[y][x] = ch
    header = f"# type: unit\n# size: {size}x{size}\n# light: upper-left\n# bg: transparent\n"
    return header + f"# map: {maps}\n" + "\n".join("".join(r) for r in rows) + "\n"


class Workspace:
    """A throwaway forge root with grids written into it."""

    def __init__(self) -> None:
        self._tmp = tempfile.TemporaryDirectory()
        self.root = Path(self._tmp.name)

    def write(self, rel: str, text: str) -> Path:
        path = self.root / rel
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(text, encoding="utf-8")
        return path

    def grid(self, rel: str, pixels: dict[tuple[int, int], str], maps: str, size: int = 32):
        return parse(self.write(rel, grid_text(pixels, maps, size)))

    def close(self) -> None:
        self._tmp.cleanup()


BODY_MAP = "o=outline b=skin_base"
PART_MAP = "o=outline h=leaf_base"


class ComposeFrameTest(unittest.TestCase):
    def setUp(self):
        self.ws = Workspace()
        self.body = self.ws.grid("body.txt", {(10, 10): "b", (11, 10): "b", (10, 11): "o"}, BODY_MAP)

    def tearDown(self):
        self.ws.close()

    def test_front_layer_paints_over_the_body(self):
        part = self.ws.grid("part.txt", {(10, 10): "h", (12, 10): "h"}, PART_MAP)
        rows, _ = compose_frame(self.body, [(part, Layer(part.path, "front"))])
        self.assertEqual(rows[10][10:13], "hbh")

    def test_back_layer_paints_only_transparent_pixels(self):
        part = self.ws.grid("part.txt", {(10, 10): "h", (12, 10): "h"}, PART_MAP)
        rows, _ = compose_frame(self.body, [(part, Layer(part.path, "back"))])
        self.assertEqual(rows[10][10:13], "bbh")

    def test_back_layer_is_hidden_by_an_earlier_front_part(self):
        front = self.ws.grid("front.txt", {(12, 10): "h"}, PART_MAP)
        back = self.ws.grid("back.txt", {(12, 10): "k"}, "k=wood_base")
        rows, _ = compose_frame(self.body, [(front, Layer(front.path, "front")),
                                            (back, Layer(back.path, "back"))])
        self.assertEqual(rows[10][12], "h")

    def test_shift_moves_the_part(self):
        part = self.ws.grid("part.txt", {(5, 5): "h"}, PART_MAP)
        rows, _ = compose_frame(self.body, [(part, Layer(part.path, "front", dx=2, dy=-1))])
        self.assertEqual(rows[4][7], "h")
        self.assertEqual(rows[5][5], ".")

    def test_shift_out_of_frame_is_an_error(self):
        part = self.ws.grid("part.txt", {(31, 5): "h"}, PART_MAP)
        with self.assertRaisesRegex(ComposeError, r"part\.txt.*\(31,5\).*\(32,5\)"):
            compose_frame(self.body, [(part, Layer(part.path, "front", dx=1))])

    def test_letter_mapped_to_two_colours_is_an_error(self):
        part = self.ws.grid("part.txt", {(5, 5): "b"}, "b=leaf_base")
        with self.assertRaisesRegex(ComposeError, "'b'"):
            compose_frame(self.body, [(part, Layer(part.path, "front"))])

    def test_size_mismatch_is_an_error(self):
        part = self.ws.grid("part.txt", {(1, 1): "h"}, PART_MAP, size=16)
        with self.assertRaisesRegex(ComposeError, "16x16"):
            compose_frame(self.body, [(part, Layer(part.path, "front"))])

    def test_map_groups_keep_only_used_letters_in_source_order(self):
        part = self.ws.grid("part.txt", {(20, 20): "h"}, "o=outline h=leaf_base u=water_base")
        _, groups = compose_frame(self.body, [(part, Layer(part.path, "front"))])
        self.assertEqual(groups, [[("o", "outline"), ("b", "skin_base")], [("h", "leaf_base")]])


class RenderTextTest(unittest.TestCase):
    def test_output_parses_back_to_the_same_grid(self):
        ws = Workspace()
        try:
            body = ws.grid("body.txt", {(10, 10): "b"}, BODY_MAP)
            part = ws.grid("part.txt", {(11, 10): "h"}, PART_MAP)
            rows, groups = compose_frame(body, [(part, Layer(part.path, "front"))])
            text = render_text(body, rows, groups, "gau.json の down_base から compose.py で組み立てた")
            again = parse(ws.write("out.txt", text))
            self.assertEqual(again.rows, rows)
            self.assertEqual(again.charmap, {"b": "skin_base", "h": "leaf_base"})  # 使っていない o は落ちる
            self.assertEqual(again.type, "unit")
        finally:
            ws.close()

    def test_note_with_a_colon_is_rejected(self):
        ws = Workspace()
        try:
            body = ws.grid("body.txt", {(10, 10): "b"}, BODY_MAP)
            with self.assertRaises(ComposeError):
                render_text(body, body.rows, [[("b", "skin_base")]], "note: bad")
        finally:
            ws.close()


class LoadConfigTest(unittest.TestCase):
    def setUp(self):
        self.ws = Workspace()

    def tearDown(self):
        self.ws.close()

    def config(self, data) -> Path:
        return self.ws.write("compose/gau.json", json.dumps(data))

    def test_reads_frames_with_defaults(self):
        path = self.config({"unit": "gau", "frames": {"down_base": {
            "body": "b.txt", "layers": [{"part": "p.txt", "z": "back", "dx": 1}]}}})
        unit, frames = load_config(path, root=self.ws.root)
        self.assertEqual(unit, "gau")
        spec = frames["down_base"]
        self.assertEqual(spec.body, self.ws.root / "b.txt")
        self.assertEqual(spec.layers, [Layer(self.ws.root / "p.txt", "back", 1, 0)])

    def test_unknown_z_is_an_error(self):
        path = self.config({"unit": "gau", "frames": {"down_base": {
            "body": "b.txt", "layers": [{"part": "p.txt", "z": "middle"}]}}})
        with self.assertRaisesRegex(ComposeError, "middle"):
            load_config(path, root=self.ws.root)

    def test_missing_body_is_an_error(self):
        path = self.config({"unit": "gau", "frames": {"down_base": {"layers": []}}})
        with self.assertRaisesRegex(ComposeError, "body"):
            load_config(path, root=self.ws.root)

    def test_unknown_key_is_an_error(self):
        path = self.config({"unit": "gau", "frames": {"down_base": {"body": "b.txt", "lyers": []}}})
        with self.assertRaisesRegex(ComposeError, "lyers"):
            load_config(path, root=self.ws.root)

    def test_broken_json_is_an_error(self):
        path = self.ws.write("compose/gau.json", "{not json")
        with self.assertRaises(ComposeError):
            load_config(path, root=self.ws.root)


class MainTest(unittest.TestCase):
    def setUp(self):
        self.ws = Workspace()
        self.ws.write("b.txt", grid_text({(10, 10): "b"}, BODY_MAP))
        self.ws.write("p.txt", grid_text({(11, 10): "h"}, PART_MAP))
        self.cfg = self.ws.write("compose/gau.json", json.dumps({"unit": "gau", "frames": {
            "down_base": {"body": str(self.ws.root / "b.txt"),
                          "layers": [{"part": str(self.ws.root / "p.txt"), "z": "front"}]}}}))
        self.out = self.ws.root / "out"

    def tearDown(self):
        self.ws.close()

    def run_main(self, argv: list[str]) -> tuple[int, str, str]:
        out, err = io.StringIO(), io.StringIO()
        with contextlib.redirect_stdout(out), contextlib.redirect_stderr(err):
            code = main(argv)
        return code, out.getvalue(), err.getvalue()

    def test_writes_frames_to_out(self):
        code, _, _ = self.run_main([str(self.cfg), "--out", str(self.out)])
        self.assertEqual(code, 0)
        self.assertEqual(parse(self.out / "down_base.txt").rows[10][10:12], "bh")

    def test_check_reports_missing_output(self):
        code, out, _ = self.run_main([str(self.cfg), "--out", str(self.out), "--check"])
        self.assertEqual(code, 1)
        self.assertIn("down_base", out)

    def test_check_passes_after_writing(self):
        self.run_main([str(self.cfg), "--out", str(self.out)])
        code, _, _ = self.run_main([str(self.cfg), "--out", str(self.out), "--check"])
        self.assertEqual(code, 0)

    def test_unknown_frame_name_exits_two(self):
        code, _, err = self.run_main([str(self.cfg), "--out", str(self.out), "--frames", "up_base"])
        self.assertEqual(code, 2)
        self.assertIn("up_base", err)


if __name__ == "__main__":
    unittest.main()
```

`MainTest` は設定ファイルに絶対パスを書いている。`load_config` は `root / パス` で解決するので、絶対パスはそのまま使われる（`Path` の `/` は右辺が絶対パスなら右辺を返す）。

- [ ] **Step 2: テストが落ちることを確かめる**

Run: `cd pixel-asset-forge && .venv/bin/python -m unittest tests.test_compose -v`
Expected: FAIL（`ModuleNotFoundError: No module named 'compose'`）

- [ ] **Step 3: 実装する**

`pixel-asset-forge/tools/compose.py`:

```python
#!/usr/bin/env python3
"""素体と部品（髪・かぶり物・武器）を重ねて、unit のコマを組み立てる。

    tools/compose.py compose/gau.json                     # assets/unit/gau/ に書く
    tools/compose.py compose/gau.json --frames down_base --out /tmp/cand
    tools/compose.py compose/gau.json --check             # 書いてあるコマと同じか

部品は素体抜きで描いた 32x32 の unit グリッド（ユニットだけの部品は assets/unit/<ユニット>/parts/、
使い回す武器は assets/part/）。どこが隠れてどこが見えるかは、部品ごとの前後で決める:

- front: 部品の透明でない画素をすべて上に描く
- back : その時点で透明な画素にだけ描く（体や、先に描いた部品に隠れる）

部品は設定ファイルに書いた順に重ねる。部品が自分の輪郭を持っていれば、体に接するところも輪郭で閉じる。
設定ファイルの形は docs/superpowers/specs/2026-10-04-unit-drawing-workflow-design.md と
types/unit/SPEC.md の「描く手順」を参照。パスは forge の直下からの相対。

組み立てたコマを手で直したら、`--check` は差ありと出る。直したコマは組み立て直さない（上書きされる）。
"""
from __future__ import annotations

import argparse
import json
import sys
from dataclasses import dataclass, field
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from gridfile import BACKGROUND, REPO_ROOT, Grid, GridError, parse  # noqa: E402

Z_ORDERS = ("front", "back")
CONFIG_KEYS = {"unit", "frames"}
FRAME_KEYS = {"body", "layers"}
LAYER_KEYS = {"part", "z", "dx", "dy"}
COPIED_HEADERS = ("type", "size", "light", "bg")


class ComposeError(Exception):
    """設定や部品が組み立ての前提に合わない。"""


@dataclass
class Layer:
    part: Path
    z: str
    dx: int = 0
    dy: int = 0


@dataclass
class FrameSpec:
    body: Path
    layers: list[Layer] = field(default_factory=list)


def _int(value, where: str) -> int:
    if isinstance(value, bool) or not isinstance(value, int):
        raise ComposeError(f"{where}: 整数でない: {value!r}")
    return value


def _keys(data, allowed: set[str], where: str) -> None:
    if not isinstance(data, dict):
        raise ComposeError(f"{where}: オブジェクトでない")
    unknown = sorted(set(data) - allowed)
    if unknown:
        raise ComposeError(f"{where}: 知らないキー {', '.join(unknown)}（使えるのは {', '.join(sorted(allowed))}）")


def load_config(path: Path, root: Path = REPO_ROOT) -> tuple[str, dict[str, FrameSpec]]:
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except OSError as exc:
        raise ComposeError(f"{path}: 読めない: {exc}") from None
    except json.JSONDecodeError as exc:
        raise ComposeError(f"{path}: JSON として読めない: {exc}") from None

    _keys(data, CONFIG_KEYS, str(path))
    unit = data.get("unit")
    if not isinstance(unit, str) or not unit:
        raise ComposeError(f"{path}: unit（ユニット名）が無い")
    frames_data = data.get("frames")
    if not isinstance(frames_data, dict) or not frames_data:
        raise ComposeError(f"{path}: frames が無いか空")

    frames: dict[str, FrameSpec] = {}
    for name, spec in frames_data.items():
        where = f"{path.name} の {name}"
        _keys(spec, FRAME_KEYS, where)
        if not isinstance(spec.get("body"), str):
            raise ComposeError(f"{where}: body（素体のパス）が無い")
        layers_data = spec.get("layers", [])
        if not isinstance(layers_data, list):
            raise ComposeError(f"{where}: layers が配列でない")
        layers = []
        for i, layer in enumerate(layers_data):
            lwhere = f"{where} の layers[{i}]"
            _keys(layer, LAYER_KEYS, lwhere)
            if not isinstance(layer.get("part"), str):
                raise ComposeError(f"{lwhere}: part（部品のパス）が無い")
            z = layer.get("z")
            if z not in Z_ORDERS:
                raise ComposeError(f"{lwhere}: z は front か back（{z!r} だった）")
            layers.append(Layer(root / layer["part"], z,
                                _int(layer.get("dx", 0), lwhere), _int(layer.get("dy", 0), lwhere)))
        frames[name] = FrameSpec(root / spec["body"], layers)
    return unit, frames


def compose_frame(body: Grid, layers: list[tuple[Grid, Layer]]) -> tuple[list[str], list[list[tuple[str, str]]]]:
    canvas = [list(row) for row in body.rows]
    charmap = dict(body.charmap)
    groups: list[list[tuple[str, str]]] = [list(body.charmap.items())]

    for part, layer in layers:
        name = part.path.name
        if (part.width, part.height) != (body.width, body.height):
            raise ComposeError(
                f"{name}: 大きさ {part.width}x{part.height} が素体 {body.width}x{body.height} と違う"
            )
        added = []
        for ch, colour in part.charmap.items():
            if ch not in charmap:
                charmap[ch] = colour
                added.append((ch, colour))
            elif charmap[ch] != colour:
                raise ComposeError(f"{name}: 文字 {ch!r} が先に {charmap[ch]}、この部品では {colour} に割り当てられている")
        groups.append(added)

        for y, row in enumerate(part.rows):
            for x, ch in enumerate(row):
                if ch == BACKGROUND:
                    continue
                nx, ny = x + layer.dx, y + layer.dy
                if not (0 <= nx < body.width and 0 <= ny < body.height):
                    raise ComposeError(f"{name}: ({x},{y}) をずらすと ({nx},{ny}) でコマの外に出る")
                if layer.z == "front" or canvas[ny][nx] == BACKGROUND:
                    canvas[ny][nx] = ch

    rows = ["".join(row) for row in canvas]
    used = {ch for row in rows for ch in row} - {BACKGROUND}
    kept = [[(ch, colour) for ch, colour in group if ch in used] for group in groups]
    return rows, [group for group in kept if group]


def render_text(body: Grid, rows: list[str], groups: list[list[tuple[str, str]]], note: str) -> str:
    if ":" in note:
        raise ComposeError(f"注記に半角コロンは書けない（ヘッダと読まれる）: {note!r}")
    lines = [f"# {note}"]
    lines += [f"# {key}: {body.headers[key]}" for key in COPIED_HEADERS if key in body.headers]
    lines += ["# map: " + " ".join(f"{ch}={colour}" for ch, colour in group) for group in groups]
    lines += rows
    return "\n".join(lines) + "\n"


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("config", type=Path, help="compose/<ユニット>.json")
    parser.add_argument("--frames", nargs="+", help="組み立てるコマ（省略時はすべて）")
    parser.add_argument("--out", type=Path, help="書き出し先（省略時は assets/unit/<ユニット>/）")
    parser.add_argument("--check", action="store_true", help="書かずに、書いてあるコマと同じかだけ確かめる")
    args = parser.parse_args(argv)

    try:
        unit, frames = load_config(args.config)
        names = args.frames or list(frames)
        unknown = [name for name in names if name not in frames]
        if unknown:
            raise ComposeError(f"{args.config.name} に無いコマ: {', '.join(unknown)}")
        out = args.out or REPO_ROOT / "assets" / "unit" / unit
        differ = 0
        for name in names:
            spec = frames[name]
            body = parse(spec.body)
            parts = [(parse(layer.part), layer) for layer in spec.layers]
            rows, groups = compose_frame(body, parts)
            text = render_text(body, rows, groups, f"{args.config.name} の {name} から compose.py で組み立てた")
            target = out / f"{name}.txt"
            if args.check:
                current = target.read_text(encoding="utf-8") if target.exists() else None
                if current != text:
                    print(f"差あり {name}（{target}）")
                    differ += 1
            else:
                out.mkdir(parents=True, exist_ok=True)
                target.write_text(text, encoding="utf-8")
                print(f"書いた {target}")
    except (ComposeError, GridError) as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 2
    return 1 if differ else 0


if __name__ == "__main__":
    raise SystemExit(main())
```

- [ ] **Step 4: テストが通ることを確かめる**

Run: `cd pixel-asset-forge && .venv/bin/python -m unittest tests.test_compose -v`
Expected: すべて PASS

- [ ] **Step 5: forge の CLAUDE.md と README に道具を書く**

`pixel-asset-forge/CLAUDE.md` の「コマンド」のコードブロックで、Task 1 で足した `unit_check.py` の行の次に足す:

```sh
.venv/bin/python tools/compose.py compose/gau.json   # 素体と部品を重ねて unit のコマを組み立てる
```

`pixel-asset-forge/README.md` の 2.7 の末尾（Task 1 で足した段落の後、`### 2.8` の直前）に足す:

````markdown
髪・かぶり物・武器を素体抜きの部品として描いたユニットは、`tools/compose.py` で素体と重ねてコマにする。

```sh
.venv/bin/python tools/compose.py compose/gau.json --frames down_base --out /tmp/cand   # 案を作業フォルダへ
.venv/bin/python tools/compose.py compose/gau.json                                      # assets/unit/gau/ へ
```

組み立て方は `compose/<ユニット>.json` に書く（`assets/` の下に置くと `validate.py` がグリッドとして読んで落ちる）。
部品ごとに `front`（上に描く）か `back`（透明な画素にだけ描く。体に隠れる）を選び、`dx`・`dy` でずらす。
手順は `types/unit/SPEC.md` の「描く手順」。
````

- [ ] **Step 6: forge のテストを全部流す**

Run: `cd pixel-asset-forge && .venv/bin/python -m unittest discover -s tests`
Expected: `OK`

- [ ] **Step 7: コミット**

```bash
git add pixel-asset-forge/tools/compose.py pixel-asset-forge/tests/test_compose.py pixel-asset-forge/CLAUDE.md pixel-asset-forge/README.md
git commit -m "feat: 素体と部品を前後の順番で重ねて unit のコマを組み立てる compose.py を足す"
```

---

### Task 3: 案を並べる道具と顔を戻す道具を forge へ移す

CP0 の設定シートで顔を元の画素に戻し、CP0・CP1 で案を並べるために使う。どちらもロランとイネスで2回作った道具（spec「試行中に必要になった時点で移すもの」）。

**Files:**
- Create: `pixel-asset-forge/tools/present.py`
- Create: `pixel-asset-forge/tools/face_down.py`
- Create: `pixel-asset-forge/tests/test_present_face_down.py`
- Modify: `pixel-asset-forge/CLAUDE.md`（「コマンド」の一覧）

**Interfaces:**
- Consumes: `gridfile.parse`・`gridfile.load_palette`・`render.to_image(grid, palette, scale) -> Image`
- Produces:
  - `present.build_sheet(items: list[tuple[str, Image.Image]], grass: tuple[int, int, int], scale: int = 8) -> Image.Image`
  - `present.main(argv) -> int`、コマンド `tools/present.py OUT.png GRID.txt [GRID.txt ...] [--ref IMG] [--scale 8]`
  - `face_down.downsample(img: Image.Image, n: int) -> Image.Image`（升の中央の画素を取る）
  - `face_down.cluster(img: Image.Image, tolerance: int = 14) -> tuple[list[str], list[tuple[str, int]]]`（文字の行と、文字の順の (`#rrggbb`, 画素数)）
  - `face_down.main(argv) -> int`、コマンド `tools/face_down.py IMG N OUT_PREFIX`（`OUT_PREFIX_q.png` と `OUT_PREFIX_q_x8.png` を書き、色の一覧と文字のグリッドを出す）

- [ ] **Step 1: 失敗するテストを書く**

`pixel-asset-forge/tests/test_present_face_down.py`:

```python
"""Checks for tools/present.py and tools/face_down.py."""
from __future__ import annotations

import sys
import unittest
from pathlib import Path

from PIL import Image

REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT / "tools"))

from face_down import cluster, downsample  # noqa: E402
from present import LABEL, PAD, build_sheet  # noqa: E402

RED = (200, 40, 40, 255)
BLUE = (40, 40, 200, 255)


class BuildSheetTest(unittest.TestCase):
    def test_lays_items_out_left_to_right_enlarged(self):
        a = Image.new("RGBA", (2, 2), RED)
        b = Image.new("RGBA", (2, 2), BLUE)
        sheet = build_sheet([("a", a), ("b", b)], grass=(0, 128, 0), scale=4)
        self.assertEqual(sheet.width, PAD + (8 + PAD) * 2)
        self.assertEqual(sheet.getpixel((PAD, LABEL)), RED)
        self.assertEqual(sheet.getpixel((PAD + 8 + PAD, LABEL)), BLUE)

    def test_bottom_row_shows_actual_size_on_grass(self):
        a = Image.new("RGBA", (2, 2), RED)
        sheet = build_sheet([("a", a)], grass=(0, 128, 0), scale=4)
        self.assertEqual(sheet.getpixel((0, sheet.height - 1)), (0, 128, 0, 255))


def upscaled(cells: list[list[tuple[int, int, int, int]]], factor: int) -> Image.Image:
    n = len(cells)
    img = Image.new("RGBA", (n * factor, n * factor))
    for y in range(n * factor):
        for x in range(n * factor):
            img.putpixel((x, y), cells[y // factor][x // factor])
    return img


class FaceDownTest(unittest.TestCase):
    def test_downsample_takes_the_centre_of_each_cell(self):
        cells = [[RED, BLUE], [BLUE, RED]]
        small = downsample(upscaled(cells, 4), 2)
        self.assertEqual([small.getpixel((x, y)) for y in range(2) for x in range(2)], [RED, BLUE, BLUE, RED])

    def test_cluster_merges_close_colours_and_keeps_transparency(self):
        near_red = (210, 45, 35, 255)
        clear = (0, 0, 0, 0)
        img = Image.new("RGBA", (3, 1))
        for x, p in enumerate([RED, near_red, clear]):
            img.putpixel((x, 0), p)
        rows, colours = cluster(img)
        self.assertEqual(rows, ["00."])
        self.assertEqual(colours, [("#c82828", 2)])


if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 2: テストが落ちることを確かめる**

Run: `cd pixel-asset-forge && .venv/bin/python -m unittest tests.test_present_face_down -v`
Expected: FAIL（`ModuleNotFoundError: No module named 'face_down'`）

- [ ] **Step 3: `present.py` を実装する**

ロラン版とイネス版（`.superpowers/sdd/2026-10-01-roran-unit-from-face/present.py`・`2026-10-03-ines-unit-bow/present.py`）の違いは、左端に置く顔の画像のパスだけだった。それを `--ref` にした。

`pixel-asset-forge/tools/present.py`:

```python
#!/usr/bin/env python3
"""案を並べて見せる画像を作る。

    tools/present.py OUT.png cand/hood_A.txt cand/hood_B.txt --ref face32.png

上の段: 参考の画像（--ref、任意）と各グリッドを --scale 倍（既定 8）で横に並べ、上に名前を書く。
下の段: 同じ並びの等倍を草の色（grass_base）の上に置く（ゲームでの大きさの見え方）。
ロランとイネスの作業で2回作った使い捨てを、参考の画像を引数にしてまとめた。
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

from PIL import Image, ImageDraw

sys.path.insert(0, str(Path(__file__).resolve().parent))

from gridfile import GridError, check, load_palette, parse  # noqa: E402
from render import to_image  # noqa: E402

PAD, LABEL = 16, 18
BACKDROP = (200, 200, 200, 255)


def build_sheet(items: list[tuple[str, Image.Image]], grass: tuple[int, int, int], scale: int = 8) -> Image.Image:
    small = [(name, image.convert("RGBA")) for name, image in items]
    big = [image.resize((image.width * scale, image.height * scale), Image.NEAREST) for _, image in small]
    width = PAD + sum(image.width + PAD for image in big)
    top = max(image.height for image in big)
    actual = max(image.height for _, image in small)
    height = LABEL + top + PAD + actual + PAD * 2
    sheet = Image.new("RGBA", (width, height), BACKDROP)
    draw = ImageDraw.Draw(sheet)
    draw.rectangle([0, LABEL + top + PAD, width, height], fill=(*grass, 255))
    x = PAD
    for (name, image), enlarged in zip(small, big):
        draw.text((x, 2), name, fill=(0, 0, 0, 255))
        sheet.alpha_composite(enlarged, (x, LABEL))
        sheet.alpha_composite(image, (x, LABEL + top + PAD * 2))
        x += enlarged.width + PAD
    return sheet


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("out", type=Path)
    parser.add_argument("grids", nargs="+", type=Path)
    parser.add_argument("--ref", type=Path, help="左端に置く参考の画像（顔を戻したものなど）")
    parser.add_argument("--scale", type=int, default=8)
    args = parser.parse_args(argv)

    palette = load_palette()
    items: list[tuple[str, Image.Image]] = []
    try:
        if args.ref:
            items.append((args.ref.stem, Image.open(args.ref)))
        for path in args.grids:
            grid = parse(path)
            errors = check(grid, palette)
            if errors:
                raise GridError(f"{path}: {errors[0]}")
            items.append((f"{path.parent.name}/{path.stem}", to_image(grid, palette, 1)))
    except (GridError, OSError) as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 2
    build_sheet(items, palette["grass_base"], args.scale).save(args.out)
    print(args.out)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
```

- [ ] **Step 4: `face_down.py` を実装する**

イネス版（`.superpowers/sdd/2026-10-03-ines-unit-bow/face_down.py`）を関数に分けた。升の境目の確かめ（色の変わり目の多い位置）はそのまま出す。

`pixel-asset-forge/tools/face_down.py`:

```python
#!/usr/bin/env python3
"""拡大されたドット絵の顔を、升の中央の画素を取って元の大きさに戻す。

    tools/face_down.py ../assets/images/gau-face.png 32 /tmp/gau

N 升に戻し、各成分の差 14 以下の色をまとめて、色の一覧と文字のグリッドを出す。
OUT_PREFIX_q.png（N px）と OUT_PREFIX_q_x8.png（灰色の上に8倍）を書く。
N が合っているかは、出力の「変わり目の多い位置」が升の幅おきに並ぶかで確かめる
（ロランの顔は 24px の約5.33倍、イネスは 32px の4倍だった）。
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

from PIL import Image

CHARS = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ!@$%^&*+=?<>~"
EDGE_THRESHOLD = 60


def transition_positions(img: Image.Image, axis: str, count: int) -> list[int]:
    size = img.width if axis == "x" else img.height
    other = img.height if axis == "x" else img.width
    hits = [0] * size
    for a in range(1, size):
        for b in range(other):
            p = img.getpixel((a, b) if axis == "x" else (b, a))
            q = img.getpixel((a - 1, b) if axis == "x" else (b, a - 1))
            if sum(abs(p[i] - q[i]) for i in range(3)) > EDGE_THRESHOLD:
                hits[a] += 1
    return sorted(sorted(range(size), key=lambda i: -hits[i])[:count])


def downsample(img: Image.Image, n: int) -> Image.Image:
    img = img.convert("RGBA")
    step = img.width / n
    small = Image.new("RGBA", (n, n))
    for y in range(n):
        for x in range(n):
            small.putpixel((x, y), img.getpixel((int((x + 0.5) * step), int((y + 0.5) * step))))
    return small


def cluster(img: Image.Image, tolerance: int = 14) -> tuple[list[str], list[tuple[str, int]]]:
    reps: list[list] = []  # [代表色, 画素数]

    def find(p):
        if p[3] < 128:
            return None
        for rep in reps:
            if all(abs(rep[0][i] - p[i]) <= tolerance for i in range(3)):
                rep[1] += 1
                return rep
        rep = [p, 1]
        reps.append(rep)
        return rep

    cells = [[find(img.getpixel((x, y))) for x in range(img.width)] for y in range(img.height)]
    order = sorted(range(len(reps)), key=lambda i: -reps[i][1])
    if len(order) > len(CHARS):
        raise ValueError(f"色が {len(order)} あり、文字が足りない（{len(CHARS)} まで）")
    char_of = {id(reps[i]): CHARS[k] for k, i in enumerate(order)}
    rows = ["".join("." if c is None else char_of[id(c)] for c in row) for row in cells]
    colours = [("#{:02x}{:02x}{:02x}".format(*reps[i][0][:3]), reps[i][1]) for i in order]
    return rows, colours


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("image", type=Path)
    parser.add_argument("n", type=int, help="元の升の数（例: 32）")
    parser.add_argument("out_prefix")
    args = parser.parse_args(argv)
    if args.n < 1:
        print("error: N は1以上", file=sys.stderr)
        return 2
    try:
        img = Image.open(args.image).convert("RGBA")
    except OSError as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 2

    for axis in ("x", "y"):
        print(axis, "変わり目の多い位置:", transition_positions(img, axis, args.n + 4))
    small = downsample(img, args.n)
    rows, colours = cluster(small)
    print("色数:", len(colours))
    for ch, (hexcode, count) in zip(CHARS, colours):
        print(f"  {ch} {hexcode} n={count}")
    print("   " + "".join(str(x % 10) for x in range(args.n)))
    for y, row in enumerate(rows):
        print(f"{y:2d} {row}")

    small.save(f"{args.out_prefix}_q.png")
    backdrop = Image.new("RGBA", small.size, (200, 200, 200, 255))
    backdrop.alpha_composite(small)
    backdrop.resize((args.n * 8, args.n * 8), Image.NEAREST).save(f"{args.out_prefix}_q_x8.png")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
```

注: `cluster` の代表色は最初に出会った画素の色（イネス版と同じ）。テストの `("#c82828", 2)` は RED (200,40,40) が先に来るため。

- [ ] **Step 5: テストが通ることを確かめる**

Run: `cd pixel-asset-forge && .venv/bin/python -m unittest tests.test_present_face_down -v`
Expected: すべて PASS

- [ ] **Step 6: CLAUDE.md の「コマンド」に足す**（Task 2 で足した `compose.py` の行の次）

```sh
.venv/bin/python tools/face_down.py IMG N OUT_PREFIX  # 拡大されたドット絵の顔を N 升に戻す
.venv/bin/python tools/present.py OUT.png A.txt B.txt --ref face.png  # 案を並べて見せる画像
```

- [ ] **Step 7: forge のテストを全部流してコミット**

Run: `cd pixel-asset-forge && .venv/bin/python -m unittest discover -s tests`
Expected: `OK`

```bash
git add pixel-asset-forge/tools/present.py pixel-asset-forge/tools/face_down.py pixel-asset-forge/tests/test_present_face_down.py pixel-asset-forge/CLAUDE.md
git commit -m "feat: 案を並べる present.py と、拡大された顔を戻す face_down.py を forge の道具にする"
```

---

### Task 4: 標準の手順を `types/unit/SPEC.md` に書く

**Files:**
- Modify: `pixel-asset-forge/types/unit/SPEC.md`（「## 目視の手順」の直前に「## 描く手順」を足す。「## ファイル配置」に部品と設定ファイルを足す）
- Modify: `pixel-asset-forge/UPSTREAM.md`（「forge に戻す候補」に4本の道具）
- Modify: `pixel-asset-forge/CLAUDE.md`（原則の `unit` の手本の文に部品と手順を足す）

- [ ] **Step 1: 「## ファイル配置」のコードブロックに2行足す**（`types/unit/base/...` の行の後）

```
assets/unit/<unit>/parts/<部品>_<dir>.txt  ユニットだけの部品（髪・かぶり物）。素体抜き、32x32 のコマの上の位置に描く
assets/part/<武器>/<武器>_<dir>.txt        ユニットをまたいで使い回す武器の部品
compose/<unit>.json                       部品の組み立て方（tools/compose.py が読む。assets/ の下に置かない）
```

- [ ] **Step 2: 「## 目視の手順」の直前に節を足す**

```markdown
## 描く手順

新しいユニットはこの手順で描く（2026-10-04 に決めた。経緯は character-tactics の
`docs/superpowers/specs/2026-10-04-unit-drawing-workflow-design.md`）。確認ポイント（CP）では必ず止まって依頼者に見せる。

| 段階 | Claude が行うこと | 確認ポイント |
|---|---|---|
| 0. 設定シート | 顔の絵（`tools/face_down.py` で元の画素に戻す）とゲームの JSON から、部品の分解・色と解釈・使う素体・見えない側の部品・部品ごとに案を振る軸を一覧にする。規約で決まっていることは聞かない | CP0（動きの方針と一緒に承認） |
| 　動きの方針 | 待機の2コマ目で何が動くか、歩き、攻撃のコマ数と fps、方向ごとの攻撃の決めの姿勢を言葉で出す。ロラン・イネスの動きのページを手本に添える | CP0 |
| 1. 部品の単体スケッチ | 髪・かぶり物・武器を素体抜きの単体で4方向描く（素体の頭は下敷きにだけ使う）。武器は4方向の向きだけ | CP1 |
| 2. 正面の `base` | `tools/compose.py` で素体と部品を前後の順番で重ねる。自己チェックを通してから見せる | CP2 |
| 3. 4方向の `base` | 残り3方向を重ね、既存のユニットと `contact_sheet.py` で並べて比べる | CP3 |
| 4. アニメ | CP0 の方針どおりに待機・歩き・攻撃を描く | CP4（動きのページ） |
| 5. 仕上げ | 書き出し、この SPEC への追記 | PR は依頼者の指示で作る |

- 依頼者が確かめるのは**部品そのものの形**。体に重ねたときの隠れ方は Claude が前後の順番（`front` / `back`）で処理する
- CP0・CP1 で決めたことは 2. 以降の前提。前提から外れるとき・規約にないことを決めるときは止めて確認する
- 確認ポイントで見せた絵を自己チェックのために1〜2画素だけ直すときは、事後の報告でよい
- **絵を変えたら、見せる前にコミットや次の段階へ進まない**

### 自己チェック

**① 道具で測る（見せる前に毎回）**: `tools/unit_check.py assets/unit/<unit> --items <持ち物の文字>`。
脚の中心がそろわなければ失敗。増えた輪郭の切れ目は報告だけで、1件ずつ目で確かめる。色を足すときは `tools/probe_colors.py`。
持ち物の文字はユニットごとに測って決める: ロラン `GHJRkmns`、イネス `klmstuw`（2026-10-04 実測。ロランに刃の `i`・`j` を足すと `down` の脚の中心が分かれる）。

**② Claude が見て確かめる**

- 部品の画素が部品の文字で塗られているか（イネスで弓の1画素が脚の色だった）
- 奇数幅・偶数幅で左右対称が崩れていないか（コマの中心は x=15.5）
- 尖った先端を、輪郭に囲まれた1画素で表していないか
- 動くとき部品の長さが変わっていないか（矢が伸びて見えた）
- 奥の手・持ち物が体に重なる画素を描いていないか
- 武器の長さをコマの空きでなく武器そのもので決めているか
- 横向きの胴の厚みが、既存のユニットと並べてそろっているか

**③ 似た形を避ける例（依頼者に指摘された見え方）**: 頭頂の房の切れ目がハートに見えた（ロラン）、
後ろ髪が刈り上げに見えた（ロラン）、横向きの髪がもみあげに見えた（ロラン）、横向きの胴が太く見えた（イネス）。
```

- [ ] **Step 3: `UPSTREAM.md` の「forge に戻す候補」の表（または箇条書き）の末尾に足す**

まず `pixel-asset-forge/UPSTREAM.md` を読んで、既存の項目の書式（表か箇条書きか、列の順）に合わせる。足す中身:

- `tools/unit_check.py`・`tests/test_unit_check.py`: unit の脚の中心と増えた輪郭の切れ目（2026-10-04）
- `tools/compose.py`・`tests/test_compose.py`: 素体と部品を前後の順番で重ねる（2026-10-04）
- `tools/present.py`・`tools/face_down.py`・`tests/test_present_face_down.py`: 案を並べる、拡大された顔を戻す（2026-10-04）
- `types/unit/SPEC.md` の「描く手順」（2026-10-04）

- [ ] **Step 4: forge の `CLAUDE.md` の原則の文を直す**

次の文:

```
  `unit` は `reference/` を持たない。手本は `assets/unit/roran/`（剣と盾）と `assets/unit/ines/`（弓）、複製の土台は `types/unit/base/` の素体（`male_*`・`female_*`）。
```

を次に置き換える:

```
  `unit` は `reference/` を持たない。手本は `assets/unit/roran/`（剣と盾）と `assets/unit/ines/`（弓）、複製の土台は `types/unit/base/` の素体（`male_*`・`female_*`）。
  新しい `unit` は `types/unit/SPEC.md` の「描く手順」（確認ポイント CP0〜CP4）どおりに描く。
```

- [ ] **Step 5: 検査を流してコミット**

Run: `cd pixel-asset-forge && .venv/bin/python tools/validate.py -q && .venv/bin/python -m unittest discover -s tests`
Expected: `validate.py` は何も出さず終了コード 0、unittest は `OK`

```bash
git add pixel-asset-forge/types/unit/SPEC.md pixel-asset-forge/UPSTREAM.md pixel-asset-forge/CLAUDE.md
git commit -m "docs: unit の描く手順（確認ポイントと自己チェック）を SPEC に書く"
```

---

### Task 5: ガウの設定シートと動きの方針（CP0）

**Files:**
- Create（git 管理外）: `.superpowers/sdd/2026-10-04-unit-workflow-gau/progress.md`・`setting.md`・作業スクリプト
- 絵のファイルは作らない

- [ ] **Step 1: 台帳を作る**

`.superpowers/sdd/2026-10-04-unit-workflow-gau/progress.md` の冒頭に書く:

```markdown
# ガウ（標準のワークフローの試行）進捗台帳

- spec: docs/superpowers/specs/2026-10-04-unit-drawing-workflow-design.md
- plan: docs/superpowers/plans/2026-10-04-unit-drawing-workflow.md

## 確認ポイントの記録（評価に使う）

書式: `CPn: <承認|選択|差し戻し> [A|B|C] <内容>`（A 何を描くか / B 見た目の品質 / C Claude の進め方）
事後報告: `事後報告: <コマ> <直した画素> <理由>`
候補の枚数: 確認ポイントごとに、部品別に描いた候補の枚数を書く
```

- [ ] **Step 2: 顔を元の画素に戻す**

Run（`pixel-asset-forge/` で）:
```bash
.venv/bin/python tools/face_down.py ../assets/images/gau-face.png 32 ../.superpowers/sdd/2026-10-04-unit-workflow-gau/gau32
```
Expected: 「変わり目の多い位置」が 4px おきに並ぶ（128px の4倍なら）。並ばなければ N を 24・26 などで試し、升の幅に合う N を探す（ロランは 24）。
合う N が見つからなければ、止めて依頼者に報告する。

- [ ] **Step 3: 設定シートを書く**

`.superpowers/sdd/2026-10-04-unit-workflow-gau/setting.md` に、次の見出しで書く。中身は戻した顔（`gau32_q_x8.png`）とゲームの `assets/units/gau.json` から読む:

1. **部品の分解**: 頭（髪・かぶり物）、顔（目・眉・耳）、上着、首（スカーフ）、下、持ち物。部品ごとに顔のどの画素か（座標の範囲）と色（`#rrggbb`）
2. **解釈**: 緑の部分は頭巾かフードかバンダナか、首の布はスカーフか、無視する色はどれか、など。読み方ごとに「Claude の読み」と「依頼者に確かめたいこと」を分ける
3. **素体**: `male_*` か `female_*` か（候補と理由）
4. **持ち物**: ガウは物見・近接（`"attack": "melee"`）。武器の候補（短剣など）と、`role-monomi.png` から読めること
5. **見えない側**: かぶり物の後ろ・横、髪の後ろ、武器の持ち方で、顔の絵から読めないもの
6. **案を振る軸**: 部品ごとに、形・位置・大きさのどれを振るか
7. **色**: マスターパレットの既存色で足りるか。足す色の候補は `tools/probe_colors.py --candidate '#rrggbb' --against <隣り合う色>` で測った結果を添える
8. **聞かないこと**: `types/unit/SPEC.md` で決まっていて聞かないこと（目は縦2px・幅1px、足元 y=30、背丈24〜26px など）

- [ ] **Step 4: 動きの方針を書く**

同じ `setting.md` に「動きの方針」の見出しで書く。ロラン（`assets/units/roran.json`）とイネス（`assets/units/ines.json`）の状態ごとのコマ数・fps を並べ、ガウの案を言葉で書く:

- 待機（`idle` 2コマ・4fps）の2コマ目で何が動くか
- 歩き（`walk` 4コマ・8fps）は脚の行だけを替える型（イネスの `walk.py` と同じ）でよいか
- 攻撃（`attack` 今は3コマ・6fps）のコマ数と fps を変えるか。変えると `assets/units/gau.json` を直す
- 方向ごとの攻撃の決めの姿勢（正面・背面・左・右を1文ずつ）

- [ ] **Step 5: 依頼者に見せる**

顔を戻した絵（`gau32_q_x8.png`）を Read で見せ、設定シートと動きの方針を、案を並べたページ（Artifact）にする。
ページの道具はイネスの `.superpowers/sdd/2026-10-03-ines-unit-bow/review_page.py`・`review_template.html` を新しいフォルダへコピーして使う（標準化はまだしない）。

- [ ] **Step 6: CP0 で止まる**

依頼者の返答を台帳に `CP0:` の書式で書く。承認が出るまで Task 6 に進まない。差し戻しは直して見せ直す（そのたびに台帳に1行）。

---

### Task 6: 部品の単体スケッチ（CP1）

**Files:**
- Create: `pixel-asset-forge/assets/unit/gau/parts/<かぶり物>_{down,up,left,right}.txt`（と、CP0 で髪を別の部品にすると決めたら `<髪>_*.txt`）
- Create: `pixel-asset-forge/assets/part/<武器>/<武器>_{down,up,left,right}.txt`
- 部品の名前（`<かぶり物>`・`<武器>`）は CP0 で決めたものを使う

- [ ] **Step 1: 下敷きを作る**

CP0 で決めた素体の4方向（`types/unit/base/<素体>_<dir>.txt`）から、頭の輪郭だけを薄く出した下敷きの画像を作業フォルダに作る（作業スクリプト。絵のファイルには入れない）。

- [ ] **Step 2: かぶり物（と髪）を4方向描く**

CP0 で決めた案を振る軸で、方向ごとに2〜3案を作業フォルダ（`.superpowers/sdd/2026-10-04-unit-workflow-gau/cand_parts/`）に描く。形式は `# type: unit`・`# size: 32x32`・`# light: upper-left`・`# bg: transparent`、頭に載る位置に描き、部品自身の輪郭を持たせる。

- [ ] **Step 3: 武器を4方向描く**

向きだけ（形や傾きが変わる状態は描かない）。forge の `assets/item/` に同じ武器のアイコンがあれば、色と特徴をそろえる（画素は写さない。剣は `sword.txt`）。

- [ ] **Step 4: 自己チェック**

- `.venv/bin/python tools/validate.py ../.superpowers/sdd/2026-10-04-unit-workflow-gau/cand_parts`
- 自己チェック②（SPEC「描く手順」の自己チェック）の該当する項目（左右対称・尖った先端・似た形を避ける例）
落ちた案は見せずに直すか捨てる。

- [ ] **Step 5: 依頼者に見せる**

`tools/present.py` で、部品ごとに4方向×案を並べた画像を作り、下敷きの頭と並べて Read で見せる。レビューのページにも段を足す。

- [ ] **Step 6: CP1 で止まる**

台帳に `CP1:` と候補の枚数（部品別）を書く。承認が出たら、選ばれた案を `assets/unit/gau/parts/`・`assets/part/<武器>/` に置き、`validate.py` を通してコミットする:

```bash
git add pixel-asset-forge/assets/unit/gau/parts pixel-asset-forge/assets/part
git commit -m "feat: ガウのかぶり物と武器の部品を4方向描く（CP1）"
```

---

### Task 7: 正面の `base`（CP2）

**Files:**
- Create: `pixel-asset-forge/compose/gau.json`
- Create: `pixel-asset-forge/assets/unit/gau/down_base.txt`

- [ ] **Step 1: 組み立て方を書く**

`pixel-asset-forge/compose/gau.json`（パスと前後は CP0・CP1 で決めたものに合わせる）:

```json
{
  "unit": "gau",
  "frames": {
    "down_base": {
      "body": "types/unit/base/<素体>_down.txt",
      "layers": [
        {"part": "assets/unit/gau/parts/<かぶり物>_down.txt", "z": "front"},
        {"part": "assets/part/<武器>/<武器>_down.txt", "z": "front"}
      ]
    }
  }
}
```

`<素体>`・`<かぶり物>`・`<武器>` は CP0・CP1 で決めた名前に置き換える。かぶり物の後ろへ垂れる部分のように体に隠れるものは、別の部品に分けて `"z": "back"` にする。

- [ ] **Step 2: 作業フォルダへ組み立てる**

Run: `cd pixel-asset-forge && .venv/bin/python tools/compose.py compose/gau.json --frames down_base --out ../.superpowers/sdd/2026-10-04-unit-workflow-gau/cand_base`
Expected: `書いた .../cand_base/down_base.txt`

- [ ] **Step 3: 顔の造作・服の色・持ち手を描き足す**

組み立てたものを作業フォルダで直す: 目・眉（規約どおり）、服の色（CP0 の色）、武器を握る拳。直したものは組み立て直さない（上書きされる）。

- [ ] **Step 4: 自己チェック**

- `.venv/bin/python tools/validate.py ../.superpowers/sdd/2026-10-04-unit-workflow-gau/cand_base`
- 自己チェック②の全項目
- `tools/present.py` でロラン・イネスの `down_base` と並べる

- [ ] **Step 5: 依頼者に見せて CP2 で止まる**

`present.py` の画像を Read で見せ、レビューのページに段を足す。台帳に `CP2:` を書く。承認が出たら `assets/unit/gau/down_base.txt` に置いて `validate.py` を通し、コミット:

```bash
git add pixel-asset-forge/compose/gau.json pixel-asset-forge/assets/unit/gau/down_base.txt
git commit -m "feat: ガウの正面を素体と部品から組み立てる（CP2）"
```

---

### Task 8: 4方向の `base`（CP3）

**Files:**
- Modify: `pixel-asset-forge/compose/gau.json`（`up_base`・`left_base`・`right_base` を足す）
- Create: `pixel-asset-forge/assets/unit/gau/{up,left,right}_base.txt`

- [ ] **Step 1: 3方向の組み立て方を足す**

`compose/gau.json` の `frames` に `up_base`・`left_base`・`right_base` を足す。横向きは手前と奥で前後が入れ替わる（`left` と `right` は反転で作らない。SPEC「立ち絵4方向の規約」）。奥の手に持つ武器は `"z": "back"`。

- [ ] **Step 2: 組み立てて描き足す**

Run: `cd pixel-asset-forge && .venv/bin/python tools/compose.py compose/gau.json --frames up_base left_base right_base --out ../.superpowers/sdd/2026-10-04-unit-workflow-gau/cand_base`
組み立てたものに、Task 7 Step 3 と同じ描き足しをする。

- [ ] **Step 3: 自己チェック**

- `validate.py`、自己チェック②の全項目
- ロラン・イネス・ガウの4方向の `base` を並べる。横向きの胴の厚み・背丈・輪郭の太さを比べる:
  ```bash
  .venv/bin/python tools/contact_sheet.py assets/unit/roran/*_base.txt assets/unit/ines/*_base.txt ../.superpowers/sdd/2026-10-04-unit-workflow-gau/cand_base/*_base.txt --columns 4 -o ../.superpowers/sdd/2026-10-04-unit-workflow-gau/compare_base.png
  ```

- [ ] **Step 4: 依頼者に見せて CP3 で止まる**

並べた画像を Read で見せ、レビューのページに段を足す。台帳に `CP3:` を書く。承認が出たら `assets/unit/gau/` に置いてコミット:

```bash
git add pixel-asset-forge/compose/gau.json pixel-asset-forge/assets/unit/gau/up_base.txt pixel-asset-forge/assets/unit/gau/left_base.txt pixel-asset-forge/assets/unit/gau/right_base.txt
git commit -m "feat: ガウの背面と横向きを素体と部品から組み立てる（CP3）"
```

---

### Task 9: アニメ（CP4）

**Files:**
- Create: `pixel-asset-forge/assets/unit/gau/<dir>_{breathe,walk_a,walk_b,atk_*}.txt`（コマの名前は CP0 の方針に合わせる）
- Create: `pixel-asset-forge/sheets/gau.txt`
- Modify: `sprites.json`（`"sheets/gau.png": "gau-map.png"` を足す）
- Modify（CP0 で攻撃のコマ数・fps を変えたときだけ）: `assets/units/gau.json`
- Create（書き出しで上書き）: `assets/images/gau-map.png`

- [ ] **Step 1: コマを描く**

CP0 の動きの方針どおりに描く。歩きは `base` の脚の行（y=28〜30）だけを置き換える（イネスの `.superpowers/sdd/2026-10-03-ines-unit-bow/walk.py` を作業フォルダへコピーして使う）。
同じ向きの `base` から部品だけ動かすコマは、`compose/gau.json` に `dx`・`dy` を変えたコマとして足してよい。

- [ ] **Step 2: シート定義を書く**

`pixel-asset-forge/sheets/gau.txt` を `sheets/ines.txt` と同じ形（12行 = 3状態×4方向、各ブロックは down, up, left, right）で書く。行の列数はすべて同じにする。

- [ ] **Step 3: 自己チェック**

Run（`pixel-asset-forge/` で）:
```bash
.venv/bin/python tools/validate.py assets/unit/gau
.venv/bin/python tools/unit_check.py assets/unit/gau --items <武器の文字>
.venv/bin/python tools/sheet.py sheets/gau.txt
```
Expected: `validate.py` は ok、`unit_check.py` は `脚の中心: ok`（増えた切れ目は1件ずつ目で確かめて、わざとでないものは直す）、`sheet.py` の足元はすべて y=30。
自己チェック②の「動くとき部品の長さが変わっていないか」「奥の手・持ち物」を全コマで確かめる。

- [ ] **Step 4: ゲームへ書き出して動きのページを作る**

Run（リポジトリの直下で）:
```bash
pixel-asset-forge/.venv/bin/python pixel-asset-forge/tools/export.py sprites.json assets/images
python3 tools/anim-page.py assets/units/gau.json out/anim/gau.html
```
`export.py` は forge の全アセットを描き直し、1枚でも検査に通らなければ何も書き出さない（README「ドット絵の作りかた」）。
`out/anim/gau.html` を Artifact として公開し、URL を台帳に書く。CP0 で攻撃のコマ数・fps を変えたなら、先に `assets/units/gau.json` の `attack` を直す。

- [ ] **Step 5: ゲームのテストとビルド**

Run: `npm test && npm run build`
Expected: どちらも成功（ガウのシートの大きさが JSON のコマ数と食い違うと、テストかゲームの読み込みで分かる）

- [ ] **Step 6: 依頼者に見せて CP4 で止まる**

動きのページの URL を渡す。台帳に `CP4:` を書く。承認が出たらコミット:

```bash
git add pixel-asset-forge/assets/unit/gau pixel-asset-forge/sheets/gau.txt pixel-asset-forge/compose/gau.json sprites.json assets/images/gau-map.png assets/units/gau.json
git commit -m "feat: ガウの待機・歩き・攻撃を描き、シートを書き出す（CP4）"
```

---

### Task 10: 仕上げと評価

**Files:**
- Modify: `pixel-asset-forge/types/unit/SPEC.md`（ガウで決めたことの節、自己チェック②・③の追記）
- Modify: `pixel-asset-forge/ISSUES.md`（見つけて直していないもの）
- Modify: `HANDOVER.md`
- Create: `docs/superpowers/specs/2026-10-04-unit-drawing-workflow-results.md`（試行の結果。作成時点のログ）

- [ ] **Step 1: 評価をまとめる**

台帳から数えて `docs/superpowers/specs/2026-10-04-unit-drawing-workflow-results.md` に書く:

- 確認ポイントごとの依頼者の返答（承認・選択・差し戻し）と、差し戻しの種類 A・B・C の内訳
- イネスとの比較表（判断約12回、かぶり物の候補25枚、武器の候補53枚 → ガウの数）
- 事後報告の件数
- 依頼者の品質の判断（ロラン・イネス・ガウを並べた絵と動きのページで、「同じくらいか」）。依頼者に聞いて、その答えをそのまま書く
- 次の一体で減らせそうな確認ポイントと、その理由

- [ ] **Step 2: SPEC に追記する**

- 「立ち絵4方向の規約」にガウで決めたこと（かぶり物・武器の持ち方）の節を、イネスの「弓の持ち方」と同じ粒度で足す
- 新しく出た見え方の指摘を、「描く手順」の自己チェック②か③に足す

- [ ] **Step 3: contact_sheet・ISSUES・HANDOVER を直す**

- `.venv/bin/python tools/contact_sheet.py` を流し（引数なしで `assets/` の全部を並べる。forge の CLAUDE.md「完成したら contact_sheet.py を更新する」）、`build/contact_sheet.png` を Read で確かめる。ガウの部品（`parts/`・`assets/part/`）も並ぶのは仕様どおり
- 見つけて直していないものを `pixel-asset-forge/ISSUES.md` に1行ずつ足す
- `HANDOVER.md` の Current State と What Remains を、この作業の終わりの状態に書き直す（前回の issue #23 の記録は下へ残す）

- [ ] **Step 4: 検査を全部流す**

Run:
```bash
cd pixel-asset-forge && .venv/bin/python tools/validate.py -q && .venv/bin/python -m unittest discover -s tests && cd .. && npm test && npm run build
```
Expected: すべて成功

- [ ] **Step 5: コミットして依頼者に報告する**

```bash
git add pixel-asset-forge/types/unit/SPEC.md pixel-asset-forge/ISSUES.md HANDOVER.md docs/superpowers/specs/2026-10-04-unit-drawing-workflow-results.md
git commit -m "docs: ガウでの試行の結果と、SPEC・HANDOVER をまとめる"
```

push と PR は依頼者の指示を待つ。
