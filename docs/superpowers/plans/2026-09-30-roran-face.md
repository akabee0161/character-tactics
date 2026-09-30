# ロランの顔グラを forge で描く 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 今のフリー素材（128px）の水準のロランの顔グラを、pixel-asset-forge の 64×64 のグリッドで描き、ゲームの `roran-face.png` を差し替える。

**Architecture:** 元絵と並べて見るための道具 `tools/compare.py` を forge に足し、それを使ってシルエット → 色の塊 → 陰影 → 仕上げの4段階で `assets/face/roran.txt` を描く。段階ごとに依頼者に並べた画像を見せて止まる。合格したら手本（`types/face/reference/`）に置き、`sprites.json` と `export.py` でゲームへ書き出す。

**Tech Stack:** Python 3.14 + Pillow（forge）、unittest、TypeScript + Vite + Vitest（ゲーム、コードは変えない）、headless Chromium（CDP）

**Spec:** `docs/superpowers/specs/2026-09-30-roran-face-design.md`

## Global Constraints

- 顔グラの大きさは **64×64**（README「アセットの大きさの規約」）
- face 型のヘッダ: `# type: face`・`# size: 64x64`・`# light: upper-left`・`# bg: gradient:#1c1834->#323256`。輪郭（`outline`）は全周に1px
- 構成要素: 肌4段（`skin_hi`/`skin_base`/`skin_shadow`/`skin_deep`）、髪4段、目（白目・虹彩・瞳）、口、衣服3段（`types/face/SPEC.md`）
- 見た目は今のフリー素材のロランを引き継ぐ（紺がかった黒髪、暗い色の鎧）。**元絵を縮小・減色して下絵にしない**（見本として横に置くだけ）
- **グリッドが正、PNG は生成物。** 絵を変えるときに編集するのは `assets/**/*.txt` だけ
- パレットに色を足すときは、描く前に `tools/probe_colors.py` で隣り合わせる予定の色と測る。足した後は `tools/check_colors.py` を通す
- 既存のパレットの値は変えない（ロランのマップの絵 `assets/unit/roran/` も同じキーを使っている）。新しい色は新しいキーで足す
- `tools/` を触ったら forge の unittest を通す。テストは現役のアセットを読まない
- forge のコマンドはすべて `pixel-asset-forge/` の直下で `.venv/bin/python tools/<ツール>.py` の形で実行する
- ゲームのコードは変えない
- コミットは Conventional Commits + 日本語の要約（CLAUDE.md）
- 絵は Read で依頼者に見せる。**段階の終わりでは必ず止まり、依頼者の返事を待つ**
- 計画に不備が見つかったら、直す前に止めて報告する

## Review Focus

- 元絵の高さが、グリッドの拡大後の高さの約数でない（例: 100px の元絵）→ ぼやけた拡大で並べず、理由を書いた `FAIL` で止まる
- 元絵が透過 PNG（今のフリー素材は RGBA）→ 透明な部分がシートの背景色の上に描かれ、黒や白に化けない
- 元絵のパスが存在しない・画像でない → トレースバックではなく `FAIL` の1行で止まる
- グリッドが壊れている（行長違い・未定義文字）→ 並べずに `FAIL` で止まり、`validate.py` と同じ内容を出す
- `export.py` で書き出すと、`assets/images/roran-face.png`（元絵）は上書きされる → 比べる元絵は先に `build/face/roran_free.png` へ退避し、消えても `git show aeae90a:assets/images/roran-face.png` で戻せることを README に書く

---

## ファイルの構成

| ファイル | 役割 | タスク |
|---|---|---|
| `pixel-asset-forge/tools/compare.py`（新規） | グリッドと元絵を同じ高さに整数倍で拡大して横に並べる | 1 |
| `pixel-asset-forge/tests/test_compare.py`（新規） | compare.py のテスト | 1 |
| `pixel-asset-forge/README.md` | 2章に compare.py の節（2.11）を足す | 1 |
| `pixel-asset-forge/CLAUDE.md` | コマンド一覧に compare.py、face の解像度を 64x64 に | 1, 2 |
| `pixel-asset-forge/types/face/SPEC.md` | 寸法を 64x64 に | 2 |
| `pixel-asset-forge/UPSTREAM.md` | forge に戻す候補（face 64px・compare.py） | 2 |
| `pixel-asset-forge/assets/face/roran.txt`（新規） | ロランの顔（64×64） | 2〜5 |
| `pixel-asset-forge/palette/master.json` | ロランの髪・鎧などの色を新しいキーで足す | 3〜5 |
| `pixel-asset-forge/types/face/reference/roran.txt` ほか | 合格した顔を手本にする | 6 |
| `sprites.json` | `face/roran.png → roran-face.png` | 7 |
| `assets/images/roran-face.png` | 書き出した 64px の顔 | 7 |
| `README.md`・`assets/images/README.txt` | 「今ある顔は規約より大きい」をロランの分だけ直す | 7 |

---

### Task 1: 元絵と並べて見る道具 `compare.py`

**Files:**
- Create: `pixel-asset-forge/tools/compare.py`
- Create: `pixel-asset-forge/tests/test_compare.py`
- Modify: `pixel-asset-forge/README.md`（2.9 の後に節を足す）
- Modify: `pixel-asset-forge/CLAUDE.md`（「コマンド」のコードブロック）

**Interfaces:**
- Consumes: `gridfile.parse(path) -> Grid`、`gridfile.check(grid, palette) -> list[str]`、`gridfile.load_palette()`、`gridfile.display(path)`、`gridfile.REPO_ROOT`、`gridfile.GridError`、`render.to_image(grid, palette, scale) -> Image`
- Produces: `compare.enlarge_to(image: Image.Image, height: int) -> Image.Image`、`compare.side_by_side(left: Image.Image, right: Image.Image, gap: int = GAP) -> Image.Image`（RGB）、`compare.CompareError`、`compare.main(argv) -> int`（0 成功 / 1 グリッドの検査で失敗 / 2 読めない）。既定の出力先は `build/compare/<グリッド名>.png`

- [ ] **Step 0: 環境を用意する（依頼者の承認が要る）**

この端末には uv も forge の `.venv` も無い。依頼者に「uv を `~/.local/bin` に入れ、Python 3.14 の venv を作ってよいか」を確認し、承認を得てから実行する。

```bash
curl -LsSf https://astral.sh/uv/install.sh | sh
cd pixel-asset-forge
~/.local/bin/uv python install 3.14
~/.local/bin/uv venv --python 3.14 .venv
~/.local/bin/uv pip install --python .venv/bin/python -r requirements.txt
.venv/bin/python -m unittest discover -s tests
```

Expected: 既存のテストがすべて OK。

- [ ] **Step 1: 失敗するテストを書く**

`pixel-asset-forge/tests/test_compare.py`:

```python
"""Checks for the side-by-side comparison tool.

    .venv/bin/python -m unittest discover -s tests
"""
from __future__ import annotations

import contextlib
import io
import sys
import tempfile
import unittest
from pathlib import Path

from PIL import Image

REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT / "tools"))

import compare  # noqa: E402

GRID = """\
# type: face
# size: 2x2
# bg: transparent
# map: o=outline
o.
.o
"""

BROKEN_GRID = """\
# type: face
# size: 2x2
# map: o=outline
o.
.oo
"""


class EnlargeTest(unittest.TestCase):
    def test_enlarges_by_a_whole_number(self):
        image = Image.new("RGBA", (4, 4), (255, 0, 0, 255))
        self.assertEqual(compare.enlarge_to(image, 16).size, (16, 16))

    def test_keeps_hard_pixel_edges(self):
        image = Image.new("RGB", (2, 1), (0, 0, 0))
        image.putpixel((1, 0), (255, 255, 255))
        large = compare.enlarge_to(image, 4)
        self.assertEqual(large.getpixel((3, 0)), (255, 255, 255))
        self.assertEqual(large.getpixel((4, 0)), (255, 255, 255))
        self.assertEqual(large.getpixel((3, 3)), (0, 0, 0))

    def test_rejects_a_height_that_is_not_a_multiple(self):
        image = Image.new("RGB", (100, 100))
        with self.assertRaisesRegex(compare.CompareError, "100px"):
            compare.enlarge_to(image, 512)

    def test_rejects_shrinking(self):
        image = Image.new("RGB", (128, 128))
        with self.assertRaises(compare.CompareError):
            compare.enlarge_to(image, 64)


class SideBySideTest(unittest.TestCase):
    def test_width_is_both_plus_the_gap(self):
        left = Image.new("RGB", (10, 10))
        right = Image.new("RGB", (6, 10))
        self.assertEqual(compare.side_by_side(left, right, gap=4).size, (20, 10))

    def test_transparent_pixels_show_the_sheet_background(self):
        left = Image.new("RGBA", (2, 2), (0, 0, 0, 0))
        right = Image.new("RGBA", (2, 2), (0, 0, 0, 0))
        sheet = compare.side_by_side(left, right, gap=0)
        self.assertEqual(sheet.mode, "RGB")
        self.assertEqual(sheet.getpixel((0, 0)), compare.SHEET_BG)
        self.assertEqual(sheet.getpixel((3, 1)), compare.SHEET_BG)

    def test_opaque_pixels_are_kept(self):
        left = Image.new("RGBA", (2, 2), (10, 20, 30, 255))
        right = Image.new("RGB", (2, 2), (40, 50, 60))
        sheet = compare.side_by_side(left, right, gap=0)
        self.assertEqual(sheet.getpixel((1, 1)), (10, 20, 30))
        self.assertEqual(sheet.getpixel((2, 0)), (40, 50, 60))


class MainTest(unittest.TestCase):
    def setUp(self):
        self.dir = Path(tempfile.mkdtemp())

    def write(self, name: str, text: str) -> Path:
        path = self.dir / name
        path.write_text(text, encoding="utf-8")
        return path

    def run_main(self, *argv: str) -> tuple[int, str]:
        err = io.StringIO()
        with contextlib.redirect_stderr(err), contextlib.redirect_stdout(io.StringIO()):
            code = compare.main(list(argv))
        return code, err.getvalue()

    def test_writes_the_sheet(self):
        grid = self.write("tiny.txt", GRID)
        reference = self.dir / "ref.png"
        Image.new("RGBA", (4, 4), (200, 0, 0, 255)).save(reference)
        out = self.dir / "out.png"
        code, _ = self.run_main(str(grid), str(reference), "--scale", "4", "-o", str(out))
        self.assertEqual(code, 0)
        with Image.open(out) as sheet:
            self.assertEqual(sheet.size, (8 + compare.GAP + 8, 8))

    def test_a_missing_reference_fails_with_a_message(self):
        grid = self.write("tiny.txt", GRID)
        code, err = self.run_main(str(grid), str(self.dir / "nope.png"), "-o", str(self.dir / "out.png"))
        self.assertEqual(code, 2)
        self.assertIn("FAIL", err)

    def test_a_file_that_is_not_an_image_fails_with_a_message(self):
        grid = self.write("tiny.txt", GRID)
        reference = self.write("ref.png", "not a png")
        code, err = self.run_main(str(grid), str(reference), "-o", str(self.dir / "out.png"))
        self.assertEqual(code, 2)
        self.assertIn("FAIL", err)

    def test_a_reference_of_the_wrong_height_fails_with_a_message(self):
        grid = self.write("tiny.txt", GRID)
        reference = self.dir / "ref.png"
        Image.new("RGB", (3, 3)).save(reference)
        code, err = self.run_main(str(grid), str(reference), "--scale", "8", "-o", str(self.dir / "out.png"))
        self.assertEqual(code, 2)
        self.assertIn("3px", err)

    def test_a_broken_grid_is_not_compared(self):
        grid = self.write("broken.txt", BROKEN_GRID)
        reference = self.dir / "ref.png"
        Image.new("RGB", (4, 4)).save(reference)
        out = self.dir / "out.png"
        code, err = self.run_main(str(grid), str(reference), "-o", str(out))
        self.assertEqual(code, 1)
        self.assertIn("FAIL", err)
        self.assertFalse(out.exists())


if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 2: テストが落ちることを確かめる**

Run: `cd pixel-asset-forge && .venv/bin/python -m unittest tests.test_compare -v`
Expected: `ModuleNotFoundError: No module named 'compare'`

- [ ] **Step 3: `compare.py` を書く**

`pixel-asset-forge/tools/compare.py`:

```python
#!/usr/bin/env python3
"""Put a grid next to the picture it is meant to match.

    tools/compare.py assets/face/roran.txt build/face/roran_free.png

The grid is enlarged by --scale (default 8) and the reference by whatever whole
number makes it the same height, so a 64px face at x8 sits beside a 128px
picture at x4. Both keep hard pixel edges; a reference whose height does not
divide evenly is refused rather than blurred. Writes build/compare/<name>.png
unless -o is given.
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

from PIL import Image, UnidentifiedImageError

sys.path.insert(0, str(Path(__file__).resolve().parent))

from gridfile import REPO_ROOT, GridError, check, display, load_palette, parse
from render import to_image

GAP = 16
SHEET_BG = (32, 32, 38)


class CompareError(Exception):
    """The two pictures cannot be put side by side at whole-number scales."""


def enlarge_to(image: Image.Image, height: int) -> Image.Image:
    """Enlarge ``image`` by the whole number that makes it ``height`` tall."""
    if height < image.height or height % image.height:
        raise CompareError(
            f"reference is {image.height}px tall; {height}px is not a whole multiple of it"
        )
    factor = height // image.height
    return image.resize((image.width * factor, image.height * factor), Image.NEAREST)


def side_by_side(left: Image.Image, right: Image.Image, gap: int = GAP) -> Image.Image:
    """Paste both onto one RGB sheet; transparent pixels show SHEET_BG."""
    sheet = Image.new("RGB", (left.width + gap + right.width, max(left.height, right.height)), SHEET_BG)
    for x, image in ((0, left), (left.width + gap, right)):
        rgba = image.convert("RGBA")
        sheet.paste(rgba, (x, 0), rgba)
    return sheet


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("grid", type=Path, help="grid file to draw on the left")
    parser.add_argument("reference", type=Path, help="PNG to draw on the right")
    parser.add_argument("--scale", type=int, default=8, help="enlargement factor for the grid (default: 8)")
    parser.add_argument("-o", "--output", type=Path, default=None, help="default: build/compare/<grid name>.png")
    args = parser.parse_args(argv)

    if args.scale < 1:
        raise SystemExit("error: --scale must be 1 or greater")

    try:
        palette = load_palette()
        grid = parse(args.grid)
    except GridError as exc:
        print(f"FAIL {exc}", file=sys.stderr)
        return 2

    errors = check(grid, palette)
    if errors:
        print(f"FAIL {display(args.grid)} (not compared; fix these first)", file=sys.stderr)
        for error in errors:
            print(f"       {error}", file=sys.stderr)
        return 1

    try:
        with Image.open(args.reference) as opened:
            reference = opened.convert("RGBA")
        left = to_image(grid, palette, args.scale)
        right = enlarge_to(reference, left.height)
    except (OSError, UnidentifiedImageError, CompareError) as exc:
        print(f"FAIL {args.reference}: {exc}", file=sys.stderr)
        return 2

    output = args.output or REPO_ROOT / "build" / "compare" / f"{grid.name}.png"
    output.parent.mkdir(parents=True, exist_ok=True)
    side_by_side(left, right).save(output)
    print(f"ok   {display(args.grid)} + {args.reference} -> {display(output)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
```

`chmod +x pixel-asset-forge/tools/compare.py` で実行権を付ける（ほかの tools と同じ）。

- [ ] **Step 4: テストが通ることを確かめる**

Run: `cd pixel-asset-forge && .venv/bin/python -m unittest tests.test_compare -v`
Expected: 12 件すべて OK

Run: `.venv/bin/python -m unittest discover -s tests`
Expected: すべて OK（`display()` は `REPO_ROOT` の外のパスをそのまま返すので、一時フォルダでも落ちない）

- [ ] **Step 5: README と CLAUDE.md に書く**

`pixel-asset-forge/README.md` の「### 2.10 ゲームへ書き出す」の節の後、「### まとめ」の前に次を足す（既存の節番号は振り直さない。`CLAUDE.md`・`UPSTREAM.md` と forge 本体が「README 2.10」を export の節として参照しているため）:

````markdown
### 2.11 元絵と並べて見る

見本にしている絵がある場合（顔グラをフリー素材の水準に揃えるときなど）、グリッドと元絵を同じ高さに並べて比べる。
グリッドは `--scale`（既定 8）倍、元絵は同じ高さになる整数倍で拡大する。整数倍にならない元絵は、ぼかして並べずに止まる。

```sh
.venv/bin/python tools/compare.py assets/face/roran.txt build/face/roran_free.png
```

`build/compare/roran.png` に出る。
````

`pixel-asset-forge/CLAUDE.md` の「## コマンド」のコードブロックの `contact_sheet.py` の行の後に足す:

```sh
.venv/bin/python tools/compare.py GRID REF    # グリッドと元絵を同じ高さに並べる（build/compare/）
```

- [ ] **Step 6: コミット**

```bash
git add pixel-asset-forge/tools/compare.py pixel-asset-forge/tests/test_compare.py pixel-asset-forge/README.md pixel-asset-forge/CLAUDE.md
git commit -m "feat: グリッドと元絵を同じ高さに並べる compare.py を forge に足す"
```

---

### Task 2: face 型を 64px にし、シルエットを描く（段階1）

**Files:**
- Modify: `pixel-asset-forge/types/face/SPEC.md`
- Modify: `pixel-asset-forge/CLAUDE.md`（「確定済み: 解像度は `face` = 32x32」）
- Modify: `pixel-asset-forge/UPSTREAM.md`（「forge に戻す候補」）
- Create: `pixel-asset-forge/assets/face/roran.txt`

**Interfaces:**
- Consumes: `tools/compare.py`（Task 1）
- Produces: `assets/face/roran.txt`（64×64、`outline` だけで外形を描いたもの）。退避した元絵 `pixel-asset-forge/build/face/roran_free.png`

- [ ] **Step 1: 規約を 64px に直す**

`types/face/SPEC.md` の表の寸法の行を次にする:

```markdown
| 寸法 | `64x64`（README の「アセットの大きさの規約」。旧規約の 32x32 の手本が `reference/knight.txt`） |
```

`pixel-asset-forge/CLAUDE.md` の「**確定済み:** 解像度は `face` = 32x32」を `face` = 64x64 に直す。

`pixel-asset-forge/UPSTREAM.md` の「forge に戻す候補」の表（または箇条書き。既存の書式に合わせる）に2件足す:
- face 型の寸法を 64x64 にした（ゲームの規約。`types/face/SPEC.md`・`CLAUDE.md`）
- 元絵と並べて見る `tools/compare.py`（テスト `tests/test_compare.py`、README 2.11）

- [ ] **Step 2: 元絵を退避する**

```bash
mkdir -p pixel-asset-forge/build/face
cp assets/images/roran-face.png pixel-asset-forge/build/face/roran_free.png
```

`build/` は git に入らない。消えたら `git show aeae90a:assets/images/roran-face.png > pixel-asset-forge/build/face/roran_free.png` で戻せる。

- [ ] **Step 3: 元絵をよく見る**

`build/face/roran_free.png` を Read で見て、描く前に次を書き出す（作業メモ。コミットしない）:
- 頭の向き（正面か斜めか）、頭頂・あご・肩の位置を 64px の座標でおおよそ（元絵の座標 ÷ 2）
- 髪の房の数と流れ、前髪が目にかかる位置
- 鎧の襟・肩当ての形

- [ ] **Step 4: シルエットを描く**

`pixel-asset-forge/assets/face/roran.txt` を作る。この段階では `outline` だけで、頭・髪・首・肩の外形と、目・眉・口の位置の目安の線を描く。内側は `.`（背景）のまま:

```
# type: face
# size: 64x64
# light: upper-left
# bg: gradient:#1c1834->#323256
# map: o=outline
（64行 × 64文字）
```

形の条件（SPEC の knight の弱点を解消する）:
- 頭頂は丸く、髪の外形に房の切れ込みがある（ヘルメット状にしない）
- 輪郭は頬からあごへ細くなる（長方形にしない）
- 首は顔の幅より十分細く、肩当て・襟との境目が線で分かる

- [ ] **Step 5: 検査して並べる**

```bash
cd pixel-asset-forge
.venv/bin/python tools/validate.py assets/face/roran.txt
.venv/bin/python tools/compare.py assets/face/roran.txt build/face/roran_free.png
```

Expected: どちらも `ok`。`build/compare/roran.png` ができる。

- [ ] **Step 6: 依頼者に見せて止まる**

`build/compare/roran.png` を Read で見せ、直す点を聞く。**返事があるまで次の段階に進まない。** 直す点があればグリッドを直して Step 5 からやり直す。依頼者が「このシルエットで進めてよい」と言ったら Step 7 へ。

- [ ] **Step 7: コミット**

```bash
git add pixel-asset-forge/types/face/SPEC.md pixel-asset-forge/CLAUDE.md pixel-asset-forge/UPSTREAM.md pixel-asset-forge/assets/face/roran.txt
git commit -m "feat: face 型を 64px にし、ロランの顔のシルエットを描く"
```

---

### Task 3: 色の塊を塗る（段階2）

**Files:**
- Modify: `pixel-asset-forge/assets/face/roran.txt`
- Modify: `pixel-asset-forge/palette/master.json`

**Interfaces:**
- Consumes: Task 2 の `roran.txt`
- Produces: 基本色で塗った `roran.txt`。パレットの新しいキー（下の命名に従う）

- [ ] **Step 1: 要る色を決める**

元絵から、髪・肌・目・鎧の基本色を1色ずつ選ぶ。既存のキー（`hair_base`・`skin_base`・`iris`・`cloth_base`・`metal_*` など）で合うものはそのまま使う。合わない色だけ新しいキーにする。**既存のキーの値は変えない**（`assets/unit/roran/` も使っている）。

新しいキーの名前は `<部位>_<色の名前>_<段>` にする（例: `hair_navy_base`、`armor_dark_base`）。段は `hi`・`base`・`shadow`・`dark`（または `deep`）。

- [ ] **Step 2: 描く前に色を測る**

新しい色ごとに、隣り合わせる予定の色と測る:

```bash
.venv/bin/python tools/probe_colors.py --candidate '#rrggbb' --against outline skin_base <隣の色のキー>
```

`has_lightness_edge` か ΔE のどちらかを超えない組み合わせは、色を選び直す。選んだ色と測った結果を作業メモに残す。

- [ ] **Step 3: パレットに足し、塗る**

`palette/master.json` に新しいキーを足す（同じ部位の既存のキーのまとまりの後に、空行で区切って置く）。`roran.txt` の `# map:` に文字を足し、シルエットの内側を基本色で塗る。陰影はまだ入れない。目は白目・虹彩・瞳の位置だけ置く。

- [ ] **Step 4: 検査して並べる**

```bash
.venv/bin/python tools/validate.py assets/face/roran.txt
.venv/bin/python tools/check_colors.py -q
.venv/bin/python tools/compare.py assets/face/roran.txt build/face/roran_free.png
```

Expected: `validate.py` と `compare.py` が `ok`。`check_colors.py` が hard failure で非ゼロにならない（助言は作業メモに残す）。

- [ ] **Step 5: 依頼者に見せて止まる**

`build/compare/roran.png` を Read で見せる。**返事があるまで進まない。** 直す点があれば Step 3 からやり直す。

- [ ] **Step 6: コミット**

```bash
git add pixel-asset-forge/assets/face/roran.txt pixel-asset-forge/palette/master.json
git commit -m "feat: ロランの顔を基本色で塗る"
```

---

### Task 4: 陰影を入れる（段階3）

**Files:**
- Modify: `pixel-asset-forge/assets/face/roran.txt`
- Modify: `pixel-asset-forge/palette/master.json`（段の色を足すとき）

**Interfaces:**
- Consumes: Task 3 の `roran.txt` とパレット
- Produces: 陰影の入った `roran.txt`

- [ ] **Step 1: 段の色を決めて測る**

Task 3 で足した基本色ごとに、明るい色と影の色（髪は4段、鎧は3段以上）を決める。Task 3 の Step 2 と同じく、足す前に `probe_colors.py` で、同じ部位の隣の段・`outline`・隣の部位の色と測る。

- [ ] **Step 2: 陰影を置く**

光は左上から。条件:
- 肌: 頬と顎下に影、あごの下の首に `skin_deep`
- 髪: 左上が明るく右下へ落ちる。房ごとに明るい筋と影を置き、毛束と流れが見えるようにする
- 鎧: 縁に明るい線、面の右下に影

- [ ] **Step 3: 検査して並べる**

```bash
.venv/bin/python tools/validate.py assets/face/roran.txt
.venv/bin/python tools/check_colors.py -q
.venv/bin/python tools/compare.py assets/face/roran.txt build/face/roran_free.png
```

- [ ] **Step 4: 依頼者に見せて止まる**

`build/compare/roran.png` を Read で見せる。**返事があるまで進まない。** 直す点があれば Step 2 からやり直す。

- [ ] **Step 5: コミット**

```bash
git add pixel-asset-forge/assets/face/roran.txt pixel-asset-forge/palette/master.json
git commit -m "feat: ロランの顔に陰影を入れる"
```

---

### Task 5: 仕上げと合格の判定（段階4）

**Files:**
- Modify: `pixel-asset-forge/assets/face/roran.txt`
- Modify: `pixel-asset-forge/palette/master.json`（要るとき）
- Modify: `pixel-asset-forge/ISSUES.md`（直さずに残す点があるとき）

**Interfaces:**
- Consumes: Task 4 の `roran.txt`
- Produces: 依頼者が合格と判断した `roran.txt`

- [ ] **Step 1: 仕上げる**

- 目: 眉と上まつげを分ける（黒い横棒にしない）。虹彩に光を1点入れるかは元絵に合わせる
- 口: 元絵の表情に合わせる
- 鎧の縁の光、髪の先の抜けなど細部

- [ ] **Step 2: 検査して並べる**

```bash
.venv/bin/python tools/validate.py assets/face/roran.txt
.venv/bin/python tools/check_colors.py -q
.venv/bin/python tools/compare.py assets/face/roran.txt build/face/roran_free.png
```

- [ ] **Step 3: 合格かどうかを依頼者に聞いて止まる**

`build/compare/roran.png` を Read で見せ、「描き込みの質（形・陰影・表情）で元絵に見劣りしないか」を聞く。**返事があるまで進まない。**
- 直す点がある → 直して Step 2 から
- 合格 → Step 4 へ
- 直しても届かないと依頼者が判断した → ここで止めて報告し、SD（または中間の案）を検討するかを依頼者に決めてもらう。Task 6 以降には進まない

- [ ] **Step 4: 残す点を記録してコミット**

直さずに残す点があれば `pixel-asset-forge/ISSUES.md` に1行ずつ足す。

```bash
git add pixel-asset-forge/assets/face/roran.txt pixel-asset-forge/palette/master.json pixel-asset-forge/ISSUES.md
git commit -m "feat: ロランの顔を仕上げる"
```

---

### Task 6: 手本にし、forge 全体を確かめる

**Files:**
- Create: `pixel-asset-forge/types/face/reference/roran.txt`・`roran.png`・`roran_x8.png`
- Modify または Delete: `pixel-asset-forge/types/face/reference/knight*`（依頼者の判断）
- Modify: `pixel-asset-forge/types/face/SPEC.md`
- Modify: `pixel-asset-forge/CLAUDE.md`（knight を手本として名指ししている箇所があれば）

**Interfaces:**
- Consumes: Task 5 の `assets/face/roran.txt`
- Produces: `types/face/reference/roran.txt`（手本）

- [ ] **Step 1: knight をどうするか依頼者に聞いて止まる**

「今の 32px の `reference/knight` を、旧規約の手本として残しますか、消しますか？」と聞く。**返事があるまで進まない。**

- [ ] **Step 2: 手本を置く**

```bash
cd pixel-asset-forge
cp assets/face/roran.txt types/face/reference/roran.txt
.venv/bin/python tools/render.py types/face/reference/roran.txt
```

`types/` のグリッドは横に PNG が出てコミットされる（render.py の docstring）。`assets/face/roran.txt` はゲームへ書き出す元として残す。

`types/face/SPEC.md` を直す:
- 1行目の説明の「`reference/` で揃えること」はそのまま
- 「構成要素」の「reference が満たしている要素」を、`reference/roran` が満たしている要素に合わせて直す（髪の段の数・色のキーなど、実際に描いたもの）
- 「未確定」の「アセットあたりの色数上限」の「reference は14色」を、roran の実測の色数に直す（`validate.py` の出力か `Grid.used_colors` で数える）
- 「reference の既知の弱点」を knight のものから外し、roran について依頼者が残すと決めた点があれば書く。無ければ「なし」

knight を残すなら、SPEC に「`reference/knight` は旧規約（32x32）の手本。新しい顔は `reference/roran` に揃える」と1行書く。消すなら `git rm types/face/reference/knight*` し、`grep -rn knight pixel-asset-forge --include=*.md --include=*.py` で残った参照を直す（`tools/validate.py` の docstring の例 `assets/face/knight.txt` も roran に直す）。

- [ ] **Step 3: forge 全体を確かめる**

```bash
.venv/bin/python tools/validate.py
.venv/bin/python tools/check_colors.py -q
.venv/bin/python -m unittest discover -s tests
.venv/bin/python tools/contact_sheet.py
```

Expected: `validate.py` がすべて ok、unittest がすべて OK。`build/contact_sheet.png` を Read で見て、顔の光源がほかの型とずれていないか確かめる。

- [ ] **Step 4: コミット**

```bash
git add -A pixel-asset-forge/types/face pixel-asset-forge/CLAUDE.md pixel-asset-forge/tools/validate.py
git commit -m "docs: ロランの顔を face 型の手本にする"
```

（`git status` で意図しないファイルが入っていないか確かめてからコミットする）

---

### Task 7: ゲームへ書き出して確かめる

**Files:**
- Modify: `sprites.json`
- Modify: `assets/images/roran-face.png`（書き出しで上書き）
- Modify: `README.md`（「アセットの大きさの規約」の「顔（128px）と役割アイコン（32px）の画像は規約より大きく、縮小して描いている」の段落）
- Modify: `assets/images/README.txt`（「今ある face と role の PNG は規約より大きく、縮小して描いている」）

**Interfaces:**
- Consumes: `pixel-asset-forge/build/face/roran.png`（`render.py` が `assets/face/roran.txt` から出す）
- Produces: 64×64 の `assets/images/roran-face.png`

- [ ] **Step 1: 対応表に足して書き出す**

`sprites.json` の最後の項目の後に足す（JSON のカンマに注意）:

```json
  "face/roran.png": "roran-face.png"
```

```bash
cd pixel-asset-forge
.venv/bin/python tools/export.py ../sprites.json ../assets/images
cd ..
file assets/images/roran-face.png
```

Expected: `export.py` が成功し、`file` が `64 x 64` と出す。ほかの6枚は変わらない（`git status` で `roran-face.png` と `sprites.json` だけが変わっていることを確かめる）。

- [ ] **Step 2: 記録を直す**

`README.md` の該当段落を、ロランの顔は 64px で forge から書き出していること、ほかのユニットの顔（128px）と役割アイコン（32px）はまだ規約より大きく縮小して描いていることが分かる文に直す。`assets/images/README.txt` も同じく直し、15行目の「tile-*.png と roran-map.png は pixel-asset-forge/ から書き出している」に `roran-face.png` を足す。README「ドット絵の作りかた」の節に、元絵が消えたときの戻し方（`git show aeae90a:assets/images/roran-face.png`）を1行足す。

- [ ] **Step 3: テストとビルド**

```bash
npm test
npm run build
```

Expected: どちらも成功。

- [ ] **Step 4: 画面で確かめる**

README「描画と入力をブラウザで確認する」の CDP の手順で、`npx vite preview` を立ち上げ（`localhost` で繋ぐ）、headless Chromium（`~/.cache/ms-playwright` の Chromium）に `Emulation.setDeviceMetricsOverride`（540×945・倍率1）をかけてから、ロランの顔が出る次の画面を撮る:
- 64px の枠: 会話（ステージ開始時の会話フェーズ）・セリフ欄
- 32px の枠: 仲間一覧（ステージ選択）・下のバー（戦闘中）

撮った画像を Read で依頼者に見せ、返事を待つ。64px の枠で絵がぼけていないこと（等倍）、32px の枠で線が欠けていないことを依頼者と一緒に確かめる。

- [ ] **Step 5: コミット**

```bash
git add sprites.json assets/images/roran-face.png README.md assets/images/README.txt
git commit -m "feat: ロランの顔を forge で描いた 64px の絵に差し替える"
```

- [ ] **Step 6: HANDOVER を直す**

`HANDOVER.md` の「Current State」「What Remains」を、issue #23 の1番目が終わったこと、次は2番目（顔からユニットへの反映・目の修正）であることに直してコミットする。PR は作らない（依頼者の指示を待つ）。

```bash
git add HANDOVER.md
git commit -m "docs: HANDOVER に issue #23 の1番目の完了を書く"
```
