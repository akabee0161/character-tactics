# `unit` 型スプライトシート 実装計画

作成: 2026-09-20。**このファイルは作成時点のログ**。運用の最新は `README.md` と `CLAUDE.md` を見ること。
実行中に変わった判断は正典側に反映してあり、この計画書は遡って更新しない。
**とくにシート定義の置き場所は、実行中に `sheets/<unit>.txt` へ変わった**
（`assets/` 以下に置くと `validate.py` と `render.py` がグリッドとして読んで落ちるため）。
経緯は README の「`unit` 型」節にある。

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ロラン1体ぶんの 128×384 スプライトシートを本リポジトリの資産から生成し、character-tactics の仮絵と差し替えて、この仕組みの限界を実測する。

**Architecture:** 32x32 の `unit` 型グリッドを手で描き、`layouts/*.txt` と同じ流儀のシート定義（12行 × 4列）で並び順を宣言し、新ツール `tools/sheet.py` が 12行 × 最大コマ数の透明PNGに組み立てる。右向きは既存の `# from:` + `# transform: mirror_x` の派生ファイルで作る。部分差分の仕組みは**作らない**。

**Tech Stack:** Python 3 + Pillow（既存依存のみ。`requirements.txt` は `Pillow>=10.0` のまま変えない）、`unittest`。差し替え先の character-tactics は TypeScript + Vitest。

**Spec:** `docs/2026-09-20-unit-sprite-sheet-spec.md`

## Global Constraints

すべてのタスクの要件にこの節が暗黙に含まれる。

- **シート実寸は 128 × 384 px ちょうど。** character-tactics の `src/engine/sheet-size.test.ts` が
  `w === frame × max(idle,walk,attack のコマ数)` と `h === frame × 12` を厳密比較する
- **`frame = 32`、12行 = 3状態 × 4方向。** 行 0-3 `idle` / 4-7 `walk` / 8-11 `attack`、
  各ブロック内は `down`, `up`, `left`, `right`。行番号 = 状態index × 4 + 方向index
- **コマ数は `idle` 2 / `walk` 4 / `attack` 3。** 列数は最大コマ数の 4 に揃え、余りは透明のまま
- **`down` は手前向き（顔が見える）**
- **フレーム内の構図: 足元 y = 30、左右中央、背丈 24〜26px**
- **`bg: transparent`、`# light: upper-left`**
- **色は `palette/master.json` の52色から選ぶ。** 足すなら描く前に
  `tools/probe_colors.py` で隣り合う予定の色に対して測る
- **`face` の流儀を持ち込まない。** 全周に1pxの輪郭を回さない、髪を4階調で塗らない。
  輪郭はシルエットの外周にだけ使う
- **部分差分（オーバーレイ、`shift_band`）の仕組みを作らない。** 18枚を描いてから差分の実寸を
  測り、必要かを判断するのは今回のスコープ外
- **新しい機械チェックは助言に留める。** 非ゼロ終了させない。実装したら全コマに掛けて
  偽陽性を数え、数えた結果を README に書く
- **`tests/` から `assets/` の現役アートを参照しない。** 比較対象は `tests/fixtures/` に固定する
- **コミットは Conventional Commits + 日本語の要約**
- Python は必ず `.venv/bin/python` で動かす
- ブランチ: pixel-asset-forge は `feat/unit-sprite-sheet`（作成済み）、
  character-tactics は **main から** `feat/roran-map-sprite`

## File Structure

| ファイル | 責務 |
|---|---|
| `tools/sheet.py` | シート定義の読み込み・組み立て・プレビュー・アンカー実測。新規 |
| `tests/test_sheet.py` | 上記のユニットテスト。新規 |
| `tests/fixtures/sheet_dot.txt` 他3点 | テスト用の極小グリッド。現役アートを参照しないため。新規 |
| `assets/unit/roran/*.txt` | 手描き18枚 + ミラー派生6枚。新規 |
| `assets/unit/roran/roran.sheet.txt` | シート定義。新規 |
| `types/unit/reference/roran*` | 1体目が通ったら昇格。Task 10 |
| `README.md` / `CLAUDE.md` | 実測結果と `unit` 型の規約。Task 10 で更新 |
| character-tactics `assets/images/roran-map.png` | 差し替え先。Task 9 |

**タスク順は「未知の大きいものを先に潰す」順にしてある。** ツールを3タスクぶん作ってから
「そもそも32pxで全身が描けなかった」と分かるのが最悪なので、Task 1 で1枚だけ描いて先に測る。
`render.py` が既に `_x8.png` を出すので、そこに新しいツールは要らない。

---

### Task 1: `down_base` を1枚描く（最大の未知を先に潰す）

**Files:**
- Create: `assets/unit/roran/down_base.txt`

**Interfaces:**
- Consumes: なし
- Produces: `assets/unit/roran/down_base.txt` — `# type: unit` / `# size: 32x32` の
  32行グリッド。以降のすべてのコマがこれを起点にコピーされる

- [ ] **Step 1: ディレクトリとヘッダを作る**

`assets/unit/roran/down_base.txt` を作り、ヘッダを**この通りに**書く。文字の割り当てはここで固定し、
以降の17枚も同じ割り当てを使う（コマ間で文字の意味が変わると差分が読めなくなる）。

```
# type: unit
# size: 32x32
# light: upper-left
# bg: transparent
# map: o=outline a=skin_hi b=skin_base c=skin_shadow
# map: e=hair_hi f=hair_base g=hair_shadow h=hair_dark
# map: p=cloth_hi q=cloth_base r=cloth_shadow
# map: m=metal_hi n=metal_base s=metal_shadow
# map: w=wood_base x=wood_shadow
```

- [ ] **Step 2: 32行を描く**

制約は Global Constraints のとおり。この1枚で守るべきことを具体化すると:

- 32行ちょうど、各行32文字ちょうど。背景は `.`
- **足元（不透明ピクセルの最下行）を y = 30 に置く。** 行0が y=0、行31が y=31
- **背丈 24〜26px。** つまり頭頂は y = 4〜6 のあたり
- 左右中央。不透明ピクセルの水平中点が x = 15.5 ± 1 に入る
- 手前向き。顔が見える。顔に使えるのは 3〜4px 四方しかないので、目は各1px、口は描かないか1px
- ロランは盾役。**盾を左腕（画面左）に、剣を右手（画面右）に持つ。**
  盾は `metal_*`、剣は `metal_*` + 柄に `wood_*`
- 髪は黒に近い濃紺（`hair_dark` / `hair_shadow` 主体）、装備は濃紺（`cloth_*`）。
  ゲーム内の顔絵の色に寄せる
- 輪郭 `o` はシルエットの外周にだけ。内部の境界は明度差で見せる

- [ ] **Step 3: 構造の検査を通す**

```sh
.venv/bin/python tools/validate.py assets/unit
```

Expected: `ok   assets/unit/roran/down_base.txt`。行長や未定義文字があればここで落ちる。

- [ ] **Step 4: 拡大PNGを出す**

```sh
.venv/bin/python tools/render.py assets/unit
```

Expected: `build/unit/roran/down_base.png` と `down_base_x8.png` が出る。

- [ ] **Step 5: 足元・中心・背丈を数える**

```sh
.venv/bin/python -c "
from PIL import Image
a = Image.open('build/unit/roran/down_base.png').getchannel('A')
l, t, r, b = a.getbbox()
print('foot_y =', b - 1, '(expected 30)')
print('center_x =', (l + r - 1) / 2, '(expected 15.5)')
print('height =', b - t, '(expected 24-26)')
"
```

Expected: 3行すべてが期待値の範囲内。外れていたら Step 2 に戻る。

- [ ] **Step 6: 依頼者に `down_base_x8.png` を見せて判断を仰ぐ**

これは人間のゲートで、機械では代替できない。**確認すること:**

- 32pxの全身として絵が成立しているか（成立しなければ「案1では回らない」が結論になる）
- 盾役の騎士に見えるか
- 手前向きだと分かるか

**差し戻された回数を数えて記録する。** README の「収束回数の実測」に Task 10 で書く。

- [ ] **Step 7: Commit**

```bash
git add assets/unit/roran/down_base.txt
git commit -m "feat: unit 型の1枚目としてロランの手前向きを描く"
```

---

### Task 2: 残り3方向（`up_base` / `left_base` / `right_base`）

**Files:**
- Create: `assets/unit/roran/up_base.txt`
- Create: `assets/unit/roran/left_base.txt`
- Create: `assets/unit/roran/right_base.txt`（派生。本体を持たない）

**Interfaces:**
- Consumes: `down_base.txt` の文字割り当てヘッダ（Task 1 Step 1）。コピーして使う
- Produces: 4方向の `*_base.txt`。以降の walk / attack / breathe はこの4枚から派生する

- [ ] **Step 1: `up_base.txt` を描く**

`down_base.txt` をコピーし、ヘッダはそのまま、グリッドを奥向きに描き直す。

- 顔は見えない。後頭部の髪で埋める（`hair_*` のみ、`skin_*` は首から下だけ）
- 盾と剣は肩の外側にわずかに覗く程度。**前後の区別は「顔の有無」で付ける**
- 足元 y=30、中心 x=15.5、背丈 24〜26px は同じ

- [ ] **Step 2: `left_base.txt` を描く**

- 横向き。**盾は手前（画面左＝進行方向）に構え、剣は体の奥側に持つ**
- 顔は横顔。目は1px
- 足元 y=30、中心 x=15.5、背丈 24〜26px は同じ

- [ ] **Step 3: `right_base.txt` を派生で作る**

ファイルの中身は**これだけ**。本体の行を持たせるとエラーになる（`gridfile._derive`）。

```
# from: left_base.txt
# transform: mirror_x
```

- [ ] **Step 4: 検査と描画**

```sh
.venv/bin/python tools/validate.py assets/unit && .venv/bin/python tools/render.py assets/unit
```

Expected: 4枚すべて `ok`。`right_base` も `_x8.png` が出る。

- [ ] **Step 5: 4方向のアンカーを数える**

```sh
.venv/bin/python -c "
from PIL import Image
for n in ['down_base', 'up_base', 'left_base', 'right_base']:
    l, t, r, b = Image.open(f'build/unit/roran/{n}.png').getchannel('A').getbbox()
    print(f'{n:<12} foot_y={b-1:<3} center_x={(l+r-1)/2:<6} height={b-t}')
"
```

Expected: 4枚とも `foot_y=30`、`center_x` が 15.5±1、`height` が 24〜26。

- [ ] **Step 6: 4枚を1枚に並べる**

```sh
.venv/bin/python -c "
from PIL import Image
names = ['down_base', 'up_base', 'left_base', 'right_base']
imgs = [Image.open(f'build/unit/roran/{n}_x8.png') for n in names]
out = Image.new('RGBA', (sum(i.width for i in imgs), imgs[0].height), (48, 48, 64, 255))
x = 0
for i in imgs:
    out.alpha_composite(i, (x, 0)); x += i.width
out.save('build/unit/roran/_four_directions.png')
print('build/unit/roran/_four_directions.png')
"
```

- [ ] **Step 7: 依頼者に `_four_directions.png` を見せて2点を判断してもらう**

**測ることの1つ目と2つ目がここで決まる。**

1. **`mirror_x` の右向きが許容できるか。** 光源が一緒に反転し、盾が反対の腕に移っている。
   却下されたら `right_base.txt` を本体として描き起こし、以降 `right_*` 6枚すべてが
   手描きになる（手描き18枚 → 24枚）。**この判断を spec 7節の表に記録する**
2. **前後左右が区別できるか。** 特に `up` と `down` が「顔の有無」だけで区別できているか

- [ ] **Step 8: Commit**

```bash
git add assets/unit/roran/up_base.txt assets/unit/roran/left_base.txt assets/unit/roran/right_base.txt
git commit -m "feat: ロランの4方向の立ち絵をそろえる"
```

---

### Task 3: `tools/sheet.py` — シート定義の読み込み

**Files:**
- Create: `tools/sheet.py`
- Create: `tests/test_sheet.py`
- Create: `tests/fixtures/sheet_dot.txt`, `sheet_block.txt`, `sheet_big.txt`, `sheet_opaque.txt`

**Interfaces:**
- Consumes: `tilemap.read_layout(path) -> list[list[str | None]]`（空白区切り、`.` は `None`、
  `#` 行と空行は飛ばす、行の長さが揃っていなければ `SystemExit`）
- Produces:
  - `sheet.ROWS = 12`、`sheet.FOOT_Y = 30`
  - `sheet.read_sheet(path: Path) -> list[list[str | None]]` — 12行を強制する

- [ ] **Step 1: テスト用の極小グリッドを4点作る**

現役アートを参照しないため。`tests/fixtures/sheet_dot.txt`:

```
# type: unit
# size: 4x4
# bg: transparent
# map: o=outline
....
....
.o..
....
```

`tests/fixtures/sheet_block.txt`:

```
# type: unit
# size: 4x4
# bg: transparent
# map: o=outline
oooo
oooo
oooo
oooo
```

`tests/fixtures/sheet_big.txt`（サイズ混在の検出用）:

```
# type: unit
# size: 8x8
# bg: transparent
# map: o=outline
oooooooo
oooooooo
oooooooo
oooooooo
oooooooo
oooooooo
oooooooo
oooooooo
```

`tests/fixtures/sheet_opaque.txt`（透明でない背景の検出用）:

```
# type: unit
# size: 4x4
# bg: #000000
# map: o=outline
....
.o..
.o..
....
```

- [ ] **Step 2: 失敗するテストを書く**

`tests/test_sheet.py`:

```python
"""Checks for the unit sheet tool.

    .venv/bin/python -m unittest discover -s tests
"""
from __future__ import annotations

import sys
import tempfile
import unittest
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT / "tools"))

import sheet  # noqa: E402

FIXTURES = REPO_ROOT / "tests" / "fixtures"


def write_sheet(text: str) -> Path:
    handle = tempfile.NamedTemporaryFile("w", suffix=".txt", delete=False, encoding="utf-8")
    handle.write(text)
    handle.close()
    return Path(handle.name)


def definition(rows: list[str]) -> Path:
    return write_sheet("".join(f"{row}\n" for row in rows))


TWELVE = ["sheet_dot sheet_block . ."] * 12


class ReadSheetTest(unittest.TestCase):
    def test_twelve_rows_are_accepted(self):
        rows = sheet.read_sheet(definition(TWELVE))
        self.assertEqual(len(rows), 12)
        self.assertEqual(rows[0], ["sheet_dot", "sheet_block", None, None])

    def test_eleven_rows_are_rejected(self):
        with self.assertRaises(SystemExit):
            sheet.read_sheet(definition(TWELVE[:11]))

    def test_thirteen_rows_are_rejected(self):
        with self.assertRaises(SystemExit):
            sheet.read_sheet(definition(TWELVE + ["sheet_dot . . ."]))

    def test_comments_and_blank_lines_do_not_count_as_rows(self):
        rows = sheet.read_sheet(definition(["# a sheet", ""] + TWELVE))
        self.assertEqual(len(rows), 12)
```

- [ ] **Step 3: テストを走らせて失敗を確認する**

```sh
.venv/bin/python -m unittest tests.test_sheet -v
```

Expected: FAIL. `ModuleNotFoundError: No module named 'sheet'`。

- [ ] **Step 4: `tools/sheet.py` を最小で書く**

```python
#!/usr/bin/env python3
"""Assemble a unit sprite sheet from grid files.

    tools/sheet.py assets/unit/roran/roran.sheet.txt

A sheet definition is whitespace-separated frame names, one sheet row per line,
exactly 12 rows (3 states x 4 directions). `.` leaves a cell transparent. It is
the same shape as a `layouts/*.txt` file on purpose.

    down_base  down_breathe  .  .
    up_base    up_breathe    .  .

Rows 0-3 are idle, 4-7 walk, 8-11 attack; within each block the order is
down, up, left, right. The consumer (character-tactics) reads the sheet by
`row = state_index * 4 + direction_index`, so the order is not ours to change.
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

from PIL import Image, ImageDraw

sys.path.insert(0, str(Path(__file__).resolve().parent))

from gridfile import REPO_ROOT, GridError, check, display, load_palette, parse

from render import to_image
from tilemap import read_layout

OUTPUT_DIR = REPO_ROOT / "build" / "sheets"

ROWS = 12
STATES = ("idle", "walk", "attack")
DIRECTIONS = ("down", "up", "left", "right")

# The frame row the feet are supposed to sit on. Declared in
# docs/2026-09-20-unit-sprite-sheet-spec.md section 3.
FOOT_Y = 30


def read_sheet(path: Path) -> list[list[str | None]]:
    rows = read_layout(path)
    if len(rows) != ROWS:
        raise SystemExit(
            f"error: {path}: {len(rows)} rows, expected {ROWS} "
            f"({len(STATES)} states x {len(DIRECTIONS)} directions)"
        )
    return rows
```

- [ ] **Step 5: テストが通ることを確認する**

```sh
.venv/bin/python -m unittest tests.test_sheet -v
```

Expected: PASS（4件）。

- [ ] **Step 6: Commit**

```bash
git add tools/sheet.py tests/test_sheet.py tests/fixtures/sheet_dot.txt tests/fixtures/sheet_block.txt tests/fixtures/sheet_big.txt tests/fixtures/sheet_opaque.txt
git commit -m "feat: シート定義を読む tools/sheet.py を追加する"
```

---

### Task 4: 組み立てて 128×384 のPNGを出す

**Files:**
- Modify: `tools/sheet.py`（`load_frame` / `compose_sheet` / `columns_per_state` / `main` を追加）
- Modify: `tests/test_sheet.py`（`ComposeTest` を追加）

**Interfaces:**
- Consumes: `read_sheet`、`render.to_image(grid, palette, scale=1)`、
  `gridfile.parse(path)`、`gridfile.check(grid, palette) -> list[str]`
- Produces:
  - `sheet.load_frame(path: Path, palette) -> Image.Image` — 正方形かつ透明背景を強制
  - `sheet.load_frames(rows, palette, unit_dir: Path) -> dict[str, Image.Image]` —
    読み込みと検査。サイズ混在と空定義を落とす
  - `sheet.compose_sheet(rows, frames: dict[str, Image.Image]) -> Image.Image` — 並べるだけ
  - `sheet.columns_per_state(rows) -> dict[str, int]` — 状態ごとの実コマ数
  - `sheet.main(argv) -> int`

**読み込みと並べるのを分けてある理由:** Task 5 のアンカー実測が1コマずつの画像を必要とする。
一体にしておくと `main` が同じグリッドを2回読むことになる。

- [ ] **Step 1: 失敗するテストを書く**

`tests/test_sheet.py` に追記:

```python
from gridfile import GridError, load_palette  # noqa: E402


class ComposeTest(unittest.TestCase):
    def setUp(self):
        self.palette = load_palette()

    def rows(self, first: list[str | None]) -> list[list[str | None]]:
        return [list(first)] + [[None] * len(first) for _ in range(11)]

    def frames(self, rows: list[list[str | None]]) -> dict:
        return sheet.load_frames(rows, self.palette, FIXTURES)

    def test_size_is_columns_by_twelve_frames(self):
        rows = self.rows(["sheet_dot", "sheet_block", None, None])
        canvas = sheet.compose_sheet(rows, self.frames(rows))
        self.assertEqual(canvas.size, (4 * 4, 12 * 4))

    def test_empty_cells_stay_transparent(self):
        rows = self.rows(["sheet_block", None])
        canvas = sheet.compose_sheet(rows, self.frames(rows))
        self.assertEqual(canvas.getpixel((1, 1))[3], 255)
        self.assertEqual(canvas.getpixel((6, 1))[3], 0)

    def test_mixed_frame_sizes_are_rejected(self):
        with self.assertRaises(GridError):
            self.frames(self.rows(["sheet_dot", "sheet_big"]))

    def test_an_opaque_background_is_rejected(self):
        with self.assertRaises(GridError):
            self.frames(self.rows(["sheet_opaque"]))

    def test_an_empty_definition_is_rejected(self):
        with self.assertRaises(GridError):
            self.frames(self.rows([None, None]))

    def test_columns_per_state_counts_used_columns(self):
        rows = [["a", "b", None, None]] * 4 + [["a", "b", "c", "d"]] * 4 + [["a", "b", "c", None]] * 4
        self.assertEqual(
            sheet.columns_per_state(rows), {"idle": 2, "walk": 4, "attack": 3}
        )
```

- [ ] **Step 2: テストを走らせて失敗を確認する**

```sh
.venv/bin/python -m unittest tests.test_sheet -v
```

Expected: FAIL。`AttributeError: module 'sheet' has no attribute 'compose_sheet'`。

- [ ] **Step 3: 実装を書く**

`tools/sheet.py` に追記:

```python
def load_frame(path: Path, palette: dict[str, tuple[int, int, int]]) -> Image.Image:
    grid = parse(path)
    errors = check(grid, palette)
    if errors:
        raise GridError(f"{display(path)}: {errors[0]}")
    if grid.width != grid.height:
        raise GridError(f"{display(path)}: {grid.width}x{grid.height} is not square")
    if not grid.background.has_alpha:
        raise GridError(f"{display(path)}: a sheet frame needs 'bg: transparent'")
    return to_image(grid, palette)


def load_frames(
    rows: list[list[str | None]],
    palette: dict[str, tuple[int, int, int]],
    unit_dir: Path,
) -> dict[str, Image.Image]:
    """Every distinct frame the definition names, read once and checked."""
    frames = {
        name: load_frame(unit_dir / f"{name}.txt", palette)
        for row in rows
        for name in row
        if name
    }
    if not frames:
        raise GridError("the sheet definition has no frames in it")
    sizes = {image.size for image in frames.values()}
    if len(sizes) != 1:
        raise GridError(f"frames have mixed sizes: {sorted(sizes)}")
    return frames


def frame_size(frames: dict[str, Image.Image]) -> int:
    return next(iter(frames.values())).width


def compose_sheet(
    rows: list[list[str | None]], frames: dict[str, Image.Image]
) -> Image.Image:
    if not frames:
        raise GridError("the sheet definition has no frames in it")
    frame = frame_size(frames)
    canvas = Image.new("RGBA", (len(rows[0]) * frame, len(rows) * frame))
    for y, row in enumerate(rows):
        for x, name in enumerate(row):
            if name:
                canvas.paste(frames[name], (x * frame, y * frame))
    return canvas


def columns_per_state(rows: list[list[str | None]]) -> dict[str, int]:
    """How many columns each state actually uses, for eyeballing against the
    consumer's JSON. This tool deliberately does not read that JSON."""
    counts: dict[str, int] = {}
    for index, state in enumerate(STATES):
        block = rows[index * len(DIRECTIONS) : (index + 1) * len(DIRECTIONS)]
        used = [x for x in range(len(rows[0])) if any(row[x] for row in block)]
        counts[state] = max(used) + 1 if used else 0
    return counts
```

そして `main`:

```python
def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    parser.add_argument("definition", type=Path, help="sheet definition file")
    parser.add_argument("--scale", type=int, default=4, help="preview enlargement (default: 4)")
    parser.add_argument("-o", "--outdir", type=Path, default=OUTPUT_DIR)
    args = parser.parse_args(argv)

    if args.scale < 1:
        raise SystemExit("error: --scale must be 1 or greater")

    try:
        palette = load_palette()
    except GridError as exc:
        print(f"FAIL {exc}", file=sys.stderr)
        return 2

    rows = read_sheet(args.definition)
    try:
        frames = load_frames(rows, palette, args.definition.parent)
    except GridError as exc:
        print(f"FAIL {exc}", file=sys.stderr)
        return 1
    canvas = compose_sheet(rows, frames)

    args.outdir.mkdir(parents=True, exist_ok=True)
    name = args.definition.stem.removesuffix(".sheet")
    destination = args.outdir / f"{name}.png"
    canvas.save(destination)
    print(f"ok   {display(destination)}  {canvas.width}x{canvas.height}")
    for state, count in columns_per_state(rows).items():
        print(f"     {state:<7} {count} frame(s)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
```

- [ ] **Step 4: テストが通ることを確認する**

```sh
.venv/bin/python -m unittest tests.test_sheet -v
```

Expected: PASS（10件）。

- [ ] **Step 5: 既存のテストが壊れていないことを確認する**

```sh
.venv/bin/python -m unittest discover -s tests
```

Expected: OK。`tilemap` から `read_layout` を import したので、こちらも通ることを確かめる。

- [ ] **Step 6: Commit**

```bash
git add tools/sheet.py tests/test_sheet.py
git commit -m "feat: シート定義から 12行のPNGを組み立てる"
```

---

### Task 5: プレビューと足元・中心の実測

**Files:**
- Modify: `tools/sheet.py`（`measure` / `preview` を追加、`main` に `--preview` の出力を足す）
- Modify: `tests/test_sheet.py`（`MeasureTest` / `PreviewTest` を追加）

**Interfaces:**
- Consumes: `compose_sheet` の返す `Image`
- Produces:
  - `sheet.measure(image: Image.Image) -> tuple[int | None, float | None]` —
    （不透明ピクセルの最下行, 水平中点）。全部透明なら `(None, None)`
  - `sheet.preview(canvas: Image.Image, frame: int, scale: int) -> Image.Image`
  - `sheet.report(frames: dict[str, Image.Image], frame: int) -> None` —
    表を印字するだけ。**終了コードに影響しない**

- [ ] **Step 1: 失敗するテストを書く**

```python
class MeasureTest(unittest.TestCase):
    def setUp(self):
        self.palette = load_palette()

    def test_a_single_pixel_reports_its_row_and_column(self):
        image = sheet.load_frame(FIXTURES / "sheet_dot.txt", self.palette)
        self.assertEqual(sheet.measure(image), (2, 1.0))

    def test_a_full_block_reports_the_bottom_row_and_the_middle(self):
        image = sheet.load_frame(FIXTURES / "sheet_block.txt", self.palette)
        self.assertEqual(sheet.measure(image), (3, 1.5))

    def test_an_empty_frame_reports_nothing(self):
        self.assertEqual(sheet.measure(Image.new("RGBA", (4, 4))), (None, None))


class PreviewTest(unittest.TestCase):
    def setUp(self):
        self.palette = load_palette()

    def test_the_preview_is_scaled_and_opaque(self):
        rows = [["sheet_block"] + [None] * 3] + [[None] * 4 for _ in range(11)]
        canvas = sheet.compose_sheet(rows, sheet.load_frames(rows, self.palette, FIXTURES))
        out = sheet.preview(canvas, frame=4, scale=4)
        self.assertEqual(out.size, (canvas.width * 4, canvas.height * 4))
        # 背景を敷くので、透明だった領域も不透明になる
        self.assertEqual(out.getpixel((out.width - 2, out.height - 2))[3], 255)
```

`Image` の import が必要なのでテスト冒頭に `from PIL import Image` を足す。

- [ ] **Step 2: テストを走らせて失敗を確認する**

```sh
.venv/bin/python -m unittest tests.test_sheet -v
```

Expected: FAIL。`AttributeError: module 'sheet' has no attribute 'measure'`。

- [ ] **Step 3: 実装を書く**

```python
BACKDROP = (48, 48, 64, 255)
BORDER = (255, 255, 255, 60)
FOOT_LINE = (255, 90, 90, 150)
CENTER_LINE = (90, 170, 255, 110)


def measure(image: Image.Image) -> tuple[int | None, float | None]:
    """The lowest opaque row and the horizontal midpoint of the opaque pixels."""
    box = image.getchannel("A").getbbox()
    if box is None:
        return None, None
    left, _, right, bottom = box
    return bottom - 1, (left + right - 1) / 2


def preview(canvas: Image.Image, frame: int, scale: int = 4) -> Image.Image:
    """The sheet on a flat backdrop with cell borders, the foot line and the
    centre line drawn over it.

    The defect this is for is a frame whose feet or centre sit a pixel off its
    neighbours', which makes the animation jitter. Looking at one enlarged frame
    cannot show it - the same way one tile cannot show a seam.
    """
    base = Image.new("RGBA", canvas.size, BACKDROP)
    base.alpha_composite(canvas)
    out = base.resize((canvas.width * scale, canvas.height * scale), Image.NEAREST)

    overlay = Image.new("RGBA", out.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    for x in range(0, canvas.width + 1, frame):
        draw.line([(x * scale, 0), (x * scale, out.height)], fill=BORDER)
    for y in range(0, canvas.height + 1, frame):
        draw.line([(0, y * scale), (out.width, y * scale)], fill=BORDER)
    for top in range(0, canvas.height, frame):
        y = (top + FOOT_Y) * scale
        draw.line([(0, y), (out.width, y)], fill=FOOT_LINE)
    for left in range(0, canvas.width, frame):
        x = int((left + (frame - 1) / 2) * scale)
        draw.line([(x, 0), (x, out.height)], fill=CENTER_LINE)
    return Image.alpha_composite(out, overlay)


def report(frames: dict[str, Image.Image], frame: int) -> None:
    """Print where the feet and the centre actually are.

    Advice only - this never changes the exit code. `attack` frames step
    forward, so the feet are supposed to move there. Three earlier machine
    checks in this repo were withdrawn or downgraded once they were measured
    against every existing asset; see README.
    """
    expected_center = (frame - 1) / 2
    print(f"     {'frame':<18}{'foot_y':>7}{'center_x':>10}   "
          f"(expected foot_y={FOOT_Y}, center_x={expected_center})")
    for name in sorted(frames):
        foot, center = measure(frames[name])
        flag = ""
        if foot != FOOT_Y or center is None or abs(center - expected_center) > 1:
            flag = "  <-- off"
        print(f"     {name:<18}{str(foot):>7}{str(center):>10}{flag}")
```

`main` は `frames` を既に持っている（Task 4 で `load_frames` を分けたのはこのため）。
`main` の末尾、`columns_per_state` を印字した直後から `return 0` までを次に差し替える:

```python
    frame = frame_size(frames)
    if args.scale != 1:
        large = args.outdir / f"{name}_preview.png"
        preview(canvas, frame, args.scale).save(large)
        print(f"ok   {display(large)}")
    report(frames, frame)
    return 0
```

- [ ] **Step 4: テストが通ることを確認する**

```sh
.venv/bin/python -m unittest discover -s tests
```

Expected: OK（既存も含めて全件）。

- [ ] **Step 5: Commit**

```bash
git add tools/sheet.py tests/test_sheet.py
git commit -m "feat: シートのプレビューと足元・中心の実測を出す"
```

---

### Task 6: idle を完成させ、シート定義を置く

**Files:**
- Create: `assets/unit/roran/roran.sheet.txt`
- Create: `assets/unit/roran/down_breathe.txt`, `up_breathe.txt`, `left_breathe.txt`
- Create: `assets/unit/roran/right_breathe.txt`（派生）

**Interfaces:**
- Consumes: `tools/sheet.py`（Task 3-5）、`*_base.txt` 4枚（Task 2）
- Produces: `build/sheets/roran.png`（128×384、idle 2列ぶんだけ埋まっている）と
  `build/sheets/roran_preview.png`

- [ ] **Step 1: シート定義を置く**

`assets/unit/roran/roran.sheet.txt` を**この内容で**作る。walk と attack の行はまだ
ファイルが無いので `.` で埋め、Task 7 と Task 8 で置き換える。

```
# ロランのシート定義。tools/sheet.py が読む。
# 12行 = 3状態 × 4方向。空白区切り、`.` は透明のまま。
# 行 0-3 idle / 4-7 walk / 8-11 attack、各ブロック内は down, up, left, right
# コマ数は character-tactics 側の JSON に合わせる: idle 2 / walk 4 / attack 3

down_base   down_breathe   .  .
up_base     up_breathe     .  .
left_base   left_breathe   .  .
right_base  right_breathe  .  .
.  .  .  .
.  .  .  .
.  .  .  .
.  .  .  .
.  .  .  .
.  .  .  .
.  .  .  .
.  .  .  .
```

- [ ] **Step 2: `down_breathe` / `up_breathe` / `left_breathe` を描く**

各 `*_base.txt` をコピーし、**呼吸1コマ**にする。守ること:

- **足元 y=30 は動かさない**（呼吸で足は動かない）
- 胸から上を 1px 下げる。頭の最上段が1行ぶん消え、肩のあたりに1行増える形になる
- 左右中心は動かさない
- 差分は数ピクセルに収める。大きく動かすと idle が「跳ねる」

`right_breathe.txt` は派生:

```
# from: left_breathe.txt
# transform: mirror_x
```

- [ ] **Step 3: 構造の検査と描画**

```sh
.venv/bin/python tools/validate.py assets/unit && .venv/bin/python tools/render.py assets/unit
```

Expected: 8枚すべて `ok`。

- [ ] **Step 4: シートを組む**

```sh
.venv/bin/python tools/sheet.py assets/unit/roran/roran.sheet.txt
```

Expected:
```
ok   build/sheets/roran.png  128x384
     idle    2 frame(s)
     walk    0 frame(s)
     attack  0 frame(s)
ok   build/sheets/roran_preview.png
     frame               foot_y  center_x   (expected foot_y=30, center_x=15.5)
     ...（8枚ぶん、すべて foot_y=30）
```

**128x384 でなければここで止まる。** 列数は定義ファイルの列数（4）で決まるので、
`.` の行も4セル必要なことに注意。

- [ ] **Step 5: プレビューを目視する**

`build/sheets/roran_preview.png` を見て確認する。

- 赤い足元ラインの上に、8枚すべての足が乗っているか
- 青い中心ラインに対して体の中心が揃っているか
- **base と breathe を見比べて、呼吸が「跳ねて」見えないか**

- [ ] **Step 6: 依頼者に見せて判断を仰ぐ**

**ここで測ることの4つ目が決まる:** アンカー表が何件の「off」を出したか、そのうち
本当に直すべきだったものは何件か（＝偽陽性の数）。数を記録する。

- [ ] **Step 7: Commit**

```bash
git add assets/unit/roran/
git commit -m "feat: ロランの idle 2コマとシート定義をそろえる"
```

---

### Task 7: walk 4コマ

**Files:**
- Create: `assets/unit/roran/down_walk_a.txt`, `down_walk_b.txt`, `up_walk_a.txt`,
  `up_walk_b.txt`, `left_walk_a.txt`, `left_walk_b.txt`
- Create: `assets/unit/roran/right_walk_a.txt`, `right_walk_b.txt`（派生）
- Modify: `assets/unit/roran/roran.sheet.txt`（行4-7）

**Interfaces:**
- Consumes: `*_base.txt` 4枚、`tools/sheet.py`
- Produces: `walk` 行が埋まった `build/sheets/roran.png`

- [ ] **Step 1: 6枚を描く**

`walk` は `[base, walk_a, base, walk_b]` の4コマ構成にする（中間コマは `base` の流用）。
`walk_a` は左足前、`walk_b` は右足前。守ること:

- **足元 y=30 は動かさない。** 前に出した足の接地点も y=30 に置く
- 脚は下から6行（y=25〜30）の範囲で入れ替える。胴は動かさない
- 横向き（`left_*`）は脚の前後が入れ替わるので、`walk_a` と `walk_b` は
  **`mirror_x` では作れない**。2枚とも描く
- 左右中心は動かさない

`right_walk_a.txt`:

```
# from: left_walk_a.txt
# transform: mirror_x
```

`right_walk_b.txt`:

```
# from: left_walk_b.txt
# transform: mirror_x
```

- [ ] **Step 2: シート定義の行4-7を置き換える**

```
down_base   down_walk_a   down_base   down_walk_b
up_base     up_walk_a     up_base     up_walk_b
left_base   left_walk_a   left_base   left_walk_b
right_base  right_walk_a  right_base  right_walk_b
```

- [ ] **Step 3: 検査・描画・組み立て**

```sh
.venv/bin/python tools/validate.py assets/unit \
  && .venv/bin/python tools/render.py assets/unit \
  && .venv/bin/python tools/sheet.py assets/unit/roran/roran.sheet.txt
```

Expected: `128x384`、`walk 4 frame(s)`、アンカー表に `walk` の8枚が並び `foot_y=30`。

- [ ] **Step 4: プレビューを目視する**

`walk` の4行を左から右に見て、**コマ間で胴と頭が上下にガタついていないか**。
足だけが動いて体が静止しているのが正しい。

- [ ] **Step 5: `base` と歩行コマの差分の実寸を測る**

**測ることの6つ目。** 差分の仕組みを足すべきかの判断材料になる。

```sh
.venv/bin/python -c "
import sys; sys.path.insert(0, 'tools')
from pathlib import Path
from gridfile import parse
base = parse(Path('assets/unit/roran/left_base.txt')).rows
for name in ['left_breathe', 'left_walk_a', 'left_walk_b']:
    rows = parse(Path(f'assets/unit/roran/{name}.txt')).rows
    diff_rows = [y for y, (a, b) in enumerate(zip(base, rows)) if a != b]
    px = sum(sum(1 for c, d in zip(a, b) if c != d) for a, b in zip(base, rows))
    print(f'{name:<14} 差分行={len(diff_rows):<3} 差分ピクセル={px:<4} 行={diff_rows}')
"
```

結果を記録する。差分が数十ピクセルなら「コピーで持つのは無駄」、
数百ピクセルなら「実質別の絵なので本体で持つのが正しい」という判断材料になる。

- [ ] **Step 6: Commit**

```bash
git add assets/unit/roran/
git commit -m "feat: ロランの歩行4コマをそろえる"
```

---

### Task 8: attack 3コマ

**Files:**
- Create: `assets/unit/roran/down_atk_wind.txt`, `down_atk_hit.txt`, `up_atk_wind.txt`,
  `up_atk_hit.txt`, `left_atk_wind.txt`, `left_atk_hit.txt`
- Create: `assets/unit/roran/right_atk_wind.txt`, `right_atk_hit.txt`（派生）
- Modify: `assets/unit/roran/roran.sheet.txt`（行8-11）

**Interfaces:**
- Consumes: `*_base.txt` 4枚、`tools/sheet.py`
- Produces: 36コマぶんすべてが埋まった `build/sheets/roran.png`（128×384）

- [ ] **Step 1: 6枚を描く**

`attack` は `[atk_wind, atk_hit, base]` の3コマ（戻りは `base` の流用）。守ること:

- `atk_wind` は剣を引く。`atk_hit` は剣を突き出す
- **`attack` は踏み込みで足元が y=30 から動いてよい。** アンカー表が「off」を出すのは正常。
  ただし `atk_hit` の接地足はどこかで y=30 に残す（両足が浮くと絵が飛ぶ）
- 剣は `metal_*`、柄は `wood_*`。突き出したときフレーム外に出ないこと（x が 0〜31 に収まる）
- `down` は手前に、`up` は奥に突き出す。奥行きは1〜2px しか取れないので、
  **剣の長さではなく体のひねりで見せる**

`right_atk_wind.txt` / `right_atk_hit.txt` は `left_*` からの `mirror_x` 派生:

```
# from: left_atk_wind.txt
# transform: mirror_x
```

- [ ] **Step 2: シート定義の行8-11を置き換える**

```
down_atk_wind   down_atk_hit   down_base   .
up_atk_wind     up_atk_hit     up_base     .
left_atk_wind   left_atk_hit   left_base   .
right_atk_wind  right_atk_hit  right_base  .
```

- [ ] **Step 3: 検査・描画・組み立て**

```sh
.venv/bin/python tools/validate.py assets/unit \
  && .venv/bin/python tools/check_colors.py assets/unit \
  && .venv/bin/python tools/render.py assets/unit \
  && .venv/bin/python tools/sheet.py assets/unit/roran/roran.sheet.txt
```

Expected: `128x384`、`idle 2 / walk 4 / attack 3 frame(s)`。
これが character-tactics の JSON（`idle.frames=2` / `walk.frames=4` / `attack.frames=3`）と一致する。

`check_colors.py` が hard failure を出したら止める。助言なら記録して進む。

- [ ] **Step 4: シルエットが地面から分離するか測る**

キャラは将来タイルの上に立つので、装備の色が地面と同化していないかを確かめる。
**色を足すわけではないので却下されても描き直しではなく、記録して Task 10 で課題にする。**

```sh
.venv/bin/python tools/probe_colors.py cloth_base grass_base
.venv/bin/python tools/probe_colors.py cloth_base dirt_base
.venv/bin/python tools/probe_colors.py metal_base stone_base
```

- [ ] **Step 5: プレビューを目視する**

`build/sheets/roran_preview.png` の12行すべてを見る。36コマが揃った状態で初めて
「シート全体として絵柄が揃っているか」が見える。

- [ ] **Step 6: Commit**

```bash
git add assets/unit/roran/
git commit -m "feat: ロランの攻撃3コマをそろえ、シートを完成させる"
```

---

### Task 9: character-tactics に差し込んでブラウザで動かす

**Files:**
- Modify: character-tactics `assets/images/roran-map.png`（上書き1ファイル）

**Interfaces:**
- Consumes: `build/sheets/roran.png`（128×384）
- Produces: character-tactics ブランチ `feat/roran-map-sprite` のコミット1本

- [ ] **Step 1: main からブランチを切る**

現在のブランチ `feat/issue13-stages` は未完の別作業なので、その上には乗せない。

```bash
cd /home/ubuntu/workspace/character-tactics
git switch main
git switch -c feat/roran-map-sprite
```

- [ ] **Step 2: PNGを差し替える**

```bash
cp /home/ubuntu/workspace/pixel-asset-forge/build/sheets/roran.png assets/images/roran-map.png
```

- [ ] **Step 3: 実寸テストを走らせる**

```bash
npm test -- sheet-size
```

Expected: PASS。`roran-map.png` が 128×384 でなければここで落ちる
（`src/engine/sheet-size.test.ts` が `frame × cols` と `frame × 12` を厳密比較する）。

- [ ] **Step 4: 全テストとビルドを通す**

```bash
npm test && npm run build
```

Expected: 既存の全件 PASS、`out/play/character-tactics/` が出る。

- [ ] **Step 5: ブラウザで動かす**

README「描画と入力をブラウザで確認する」の手順に従う。Playwright パッケージは不要で、
`~/.cache/ms-playwright/` の Chromium を CDP で駆動する。

```bash
# 配信（out/ を静的に配る。別の端末かバックグラウンドで）
cd out && python3 -m http.server 8080

# 起動（Chromium は Playwright が落としたバイナリを使う。パッケージは要らない）
/home/ubuntu/.cache/ms-playwright/chromium-1140/chrome-linux/chrome \
  --headless=new --no-sandbox --disable-gpu \
  --remote-debugging-port=9222 --window-size=540,945 \
  http://127.0.0.1:8080/play/character-tactics/
```

バージョン番号は環境で変わるので、無ければ
`ls -d ~/.cache/ms-playwright/chromium*/chrome-linux/chrome` で実体を探す。

`http://127.0.0.1:9222/json/list` から WebSocket に繋ぎ、`Runtime.evaluate` で
`document.getElementById('game')` に `PointerEvent` を dispatch し、
`Page.captureScreenshot` で撮る。`Input.dispatchMouseEvent` は使わない。

**撮って確認すること:**

1. 配置画面でロランのドラッグプレビュー
2. 戦闘開始後の歩行（4方向すべて）
3. 攻撃モーション（`attack` は数フレームなので連写が必要）
4. **HPバー・リング・旗がキャラのどこに出るか**（論理位置が腰に来る件の実害）
5. 仮絵の8体と並んだときの浮き具合

- [ ] **Step 6: 依頼者にスクリーンショットを見せて判断を仰ぐ**

**測ることの5つ目がここで決まる。** 「論理位置が腰であることの実害」が許容できるか、
できないなら `sprites.ts` の `drawMapUnit` を足元アンカーに直す判断になる
（今回のスコープ外。課題として記録する）。

- [ ] **Step 7: Commit**

```bash
git add assets/images/roran-map.png
git commit -m "feat: ロランのマップスプライトを本番の絵に差し替える"
```

---

### Task 10: 実測結果を正典に書き、reference に昇格させる

**Files:**
- Modify: `README.md`（`unit` 型の節、「収束回数の実測」、「残っている課題」）
- Modify: `CLAUDE.md`（`unit` 型の作業規約、確定/未確定の表）
- Create: `types/unit/reference/roran_down_base.txt` 他（昇格するコマ）

**Interfaces:**
- Consumes: Task 1〜9 で記録した数値と判断
- Produces: 次に別のキャラを作る人が読むべき正典

- [ ] **Step 1: 昇格させるコマを `types/unit/reference/` にコピーする**

`face` と同じ扱い。reference は PNG もコミットする（`render.py` は `types/` 配下の
グリッドを**グリッドの隣に**出力する）。昇格させるのは4方向の `*_base` 4枚。

```bash
cd /home/ubuntu/workspace/pixel-asset-forge
mkdir -p types/unit/reference
for d in down up left right; do
  cp assets/unit/roran/${d}_base.txt types/unit/reference/roran_${d}_base.txt
done
.venv/bin/python tools/render.py types/unit/reference
```

`right_base.txt` は `# from: left_base.txt` の派生なので、コピーすると参照先が
`types/unit/reference/left_base.txt` になって壊れる。**`roran_right_base.txt` の
`# from:` を `roran_left_base.txt` に書き換える。**

**`types/unit/SPEC.md` は作らない**（spec 2節）。1点しか無い段階で散文の仕様を書くのは
「絵柄は散文ではなく reference で揃える」方針に反する。`tile` が65点あって未だに
SPEC.md を持たないのと同じ扱いにする。

- [ ] **Step 2: `README.md` に `unit` 型の節を足す**

書くこと（すべて Task 1〜9 で実測した数値。推測で埋めない）:

- `unit` 型は 32x32、`bg: transparent`、足元 y=30、背丈 24〜26px
- シート定義は `layouts/*.txt` と同じ流儀で12行。`tools/sheet.py` が組む
- **収束回数の実測**: 18枚それぞれの差し戻し回数（Task 1, 2, 6, 7, 8 のゲートで数えたもの）
- **`mirror_x` の判断**（Task 2 Step 7）: 許容できたか、できなかったか、その理由
- **アンカーチェックの偽陽性数**（Task 6 Step 6）: 「off」の件数と、うち本当に直したもの
- **`base` と派生コマの差分の実寸**（Task 7 Step 5）
- **論理位置が腰であることの実害**（Task 9 Step 6）

- [ ] **Step 3: `README.md` の「残っている課題」に足す**

`CLAUDE.md` は「新しく見つけたらそこに足すこと。報告して終わりにしない」と決めている。
少なくとも次の2件は Task 9 の時点で確定している課題として立てる。

| 課題 | 直し方の見当 |
|---|---|
| **足元アンカーが無い** | character-tactics の `drawMapUnit` は `center - frame/2` で貼るので論理位置がキャラの腰に来る。将来16pxタイルを敷くとほぼ1タイル下に立って見える。`src/render/sprites.ts` の1行 |
| **`unit` は1体しか無い** | 残り8体（味方3・敵5）。garum は `frame=48` なので規約の再検討が要る |

Task 8 Step 4 の `probe_colors.py` が弱い分離を出していたら、それも1行立てる。

- [ ] **Step 4: `CLAUDE.md` を更新する**

- 「確定済み」の解像度に `unit` = 32x32 を足す
- 「未確定」から「`face`/`item`/`tile` 以外の型の一覧」の記述を、`unit` が確定した分だけ直す
- `unit` 型の目視手順を足す（`tile` の3通りに相当するもの。
  **`sheet.py` のプレビューと、ゲームに入れて動かすこと**）

- [ ] **Step 5: 全テストを通す**

```sh
.venv/bin/python -m unittest discover -s tests \
  && .venv/bin/python tools/validate.py \
  && .venv/bin/python tools/check_colors.py
```

Expected: すべて OK。`validate.py` は `types/*/reference` も見るので、
昇格させたコマの `# from:` の書き換え漏れはここで落ちる。

- [ ] **Step 6: Commit**

```bash
git add README.md CLAUDE.md types/unit/
git commit -m "docs: unit 型の実測結果と規約を正典に書く"
```

---

## 完了後

- pixel-asset-forge `feat/unit-sprite-sheet` と character-tactics `feat/roran-map-sprite` の
  2本が残る。マージするかは依頼者の判断（1体だけ本番絵になるので、画面上は絵柄が混ざる）
- **この計画の成果は絵1枚ではなく、README に書いた6つの実測値である。**
  そのうち「18枚が32pxの手描き限界を超えていたか」は Task 1 Step 6 の時点で
  早期に判明する可能性がある。判明したら計画を止めて報告する
