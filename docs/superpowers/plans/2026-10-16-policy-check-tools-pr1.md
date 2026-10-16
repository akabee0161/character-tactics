# 方針を確かめる道具 PR 1（スマホ用の画像・ユニット以外の確認） Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** スマホ用の画像の道具 `tools/phone_sheet.py` と、ユニット以外の確認（7 item の対称・8 unit に mirror を使わない・10 レイアウトに無いタイル・11 テストが assets を読む）を forge に足し、既存の絵に掛けた結果を依頼者に決めてもらう。

**Architecture:** どれも1本1役の小さな道具か、既存の道具への小さな追加。7 は新しい `tools/item_check.py`、8 は `tools/gridfile.py` の `check()`（`validate.py` が使う）、10 は `tools/tilemap.py` の `--unplaced`、11 はテストを1件ずつ走らせて開いたファイルを数えるテスト `tests/test_no_live_assets.py`。スマホ用の画像は作業フォルダの3本を `tools/phone_sheet.py` の3つの種類（`order`・`diff`・`cmp`）にまとめる。

**Tech Stack:** Python 3.14（`pixel-asset-forge/.venv`）、Pillow、unittest。

**Spec:** `docs/superpowers/specs/2026-10-16-policy-check-tools-design.md`（この計画は PR 1。PR 2 のユニットの確認は別の計画）

## Global Constraints

- コマンドは `pixel-asset-forge/` で実行する。Python は `.venv/bin/python`。テストは `.venv/bin/python -m unittest discover -s tests`
- ブランチは `chore/phone-sheet-tool`（character-tactics のリポジトリ。forge はその中の `pixel-asset-forge/`）。ISSUES の12件（0e50356）と設計書（84f7ff9）はコミット済み
- **絵はこの作業では直さない**（`assets/**/*.txt` を書き換えない）。依頼者が「直す」と決めた絵は ISSUES に1行立てる
- 道具ごとに、既存の絵の全件に掛けて落ちたものを数え、一覧を依頼者に見せて1件ずつ決めてもらう（例外にする・絵を直す＝ISSUES に立てる・道具の判定を直す・道具にしない）。**決まるまで、その道具のコミットへ進まない**
- テストの絵は一時フォルダか `tests/fixtures/` に置き、`assets/` の絵を読ませない（forge CLAUDE.md「回帰テストに現役のアートを参照させない」）。一時フォルダは `tempfile.TemporaryDirectory` と `addCleanup` で必ず消す（`NamedTemporaryFile(delete=False)` を使わない。ISSUES「テストが一時ファイルを /tmp に残す」）
- 依頼者はスマホで見る。一覧の画像は PNG を作り、Read で開いて見せる。画像を出すときは、どれを見ればいいかを最初に1行で言う
- コミットは Conventional Commits ＋ 日本語の要約。`git add` はファイルを指定する。push と PR は依頼者の指示があったときだけ
- 進捗台帳は `.superpowers/sdd/2026-10-16-policy-check-tools-pr1/progress.md`（character-tactics の直下）。依頼者の判断と計画からの変更は `Ruling:` 行で書く
- `rm -rf` はこの環境で拒否される。一時の出力は `/tmp` に新しいフォルダを作って置く

## Review Focus

- `phone_sheet.py diff`・`cmp` で、案の置き場に今の絵と同じ名前のコマが無い → 黙って飛ばさず、終了コード 2 と無いファイルの名前（Task 1 のテスト `test_diff_missing_candidate_frame_is_an_error`）
- `phone_sheet.py cmp` の案の指定の書き間違い（`=` が無い、`@` の向きが4方向に無い）→ 終了コード 2（Task 1 の `test_cmp_rejects_a_malformed_candidate`）
- 部品を `dx`・`dy` でずらしてコマの外へ出た画素 → 画像を作るときに落ちない（Task 1 の `test_order_tolerates_pixels_shifted_off_the_frame`）
- 8 の検査が、`from` の無い `# transform:` だけを書いた unit を見逃す → 落とす（Task 2 の `test_unit_with_transform_but_no_from_fails`）
- 11 の検査が、`Path.read_text`（`io.open` を通る）と `open()`・`Image.open`（`builtins.open` を通る）のどちらかを見逃す → 両方を数える（Task 5 の `test_records_both_open_and_read_text`）

---

### Task 1: スマホ用の画像の道具 `tools/phone_sheet.py`

**Files:**
- Create: `pixel-asset-forge/tools/phone_sheet.py`
- Test: `pixel-asset-forge/tests/test_phone_sheet.py`

**Interfaces:**
- Consumes: `compose.load_config(path) -> (unit, specs)`・`compose.ComposeError`、`compose_page.analyse_frame(spec, against, name) -> dict`（`items` の各要素に `file`・`pixels`、ほかに `name`・`size`・`composed`）・`compose_page.GROUND`・`compose_page.RED`・`compose_page._pixels(grid) -> {(x,y): 色名}`、`gridfile.parse`・`load_palette`・`GridError`・`REPO_ROOT`
- Produces: `main(argv) -> int`（0 書いた、2 入力の誤り）、`PhoneSheetError`、定数 `SCALE = 6`・`PAD = 8`・`LABEL = 16`

- [ ] **Step 1: 失敗するテストを書く**

`pixel-asset-forge/tests/test_phone_sheet.py`:

```python
"""Checks for tools/phone_sheet.py (スマホで見る確認の画像)."""
from __future__ import annotations

import contextlib
import io
import json
import sys
import unittest
from pathlib import Path

from PIL import Image

REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT / "tools"))
sys.path.insert(0, str(Path(__file__).resolve().parent))

from compose_page import RED  # noqa: E402
from phone_sheet import LABEL, PAD, SCALE, main  # noqa: E402
from test_compose import BODY_MAP, PART_MAP, Workspace, grid_text  # noqa: E402

CELL = 32 * SCALE


def sheet_size(cols: int, rows: int) -> tuple[int, int]:
    return PAD + cols * (CELL + PAD), PAD + rows * (CELL + LABEL * 2 + PAD)


def cell_origin(col: int, row: int) -> tuple[int, int]:
    return PAD + col * (CELL + PAD), PAD + row * (CELL + LABEL * 2 + PAD) + LABEL


class PhoneSheetTest(unittest.TestCase):
    def setUp(self):
        self.ws = Workspace()
        self.addCleanup(self.ws.close)
        for name in ("down_base", "down_idle2", "up_base"):
            self.ws.write(f"now/{name}.txt", grid_text({(10, 10): "b"}, BODY_MAP))
            self.ws.write(f"cand/{name}.txt", grid_text({(10, 10): "b"}, BODY_MAP))
        # 案の down_idle2 だけ (11,10) が今と違う
        self.ws.write("cand/down_idle2.txt", grid_text({(10, 10): "b", (11, 10): "b"}, BODY_MAP))
        self.root = self.ws.root

    def run_main(self, *argv) -> tuple[int, str, str]:
        out, err = io.StringIO(), io.StringIO()
        with contextlib.redirect_stdout(out), contextlib.redirect_stderr(err):
            code = main([str(a) for a in argv])
        return code, out.getvalue(), err.getvalue()

    # diff
    def test_diff_lays_out_now_candidate_and_marked_candidate(self):
        out = self.root / "diff.png"
        code, stdout, _ = self.run_main("diff", self.root / "now", self.root / "cand", "down", out)
        self.assertEqual(code, 0)
        image = Image.open(out)
        self.assertEqual(image.size, sheet_size(3, 2))
        x0, y0 = cell_origin(2, 1)  # 3列目（赤枠）・2行目（down_idle2）
        self.assertEqual(image.getpixel((x0 + 11 * SCALE, y0 + 10 * SCALE))[:3], RED[:3])
        x1, y1 = cell_origin(1, 1)  # 2列目（印なし）には赤枠が無い
        self.assertNotEqual(image.getpixel((x1 + 11 * SCALE, y1 + 10 * SCALE))[:3], RED[:3])
        self.assertLess(stdout.index("down_base"), stdout.index("down_idle2"))
        self.assertIn("down_idle2 diff 1 px", stdout)

    def test_diff_states_narrow_the_rows(self):
        out = self.root / "diff.png"
        code, _, _ = self.run_main("diff", self.root / "now", self.root / "cand", "down", out, "--states", "idle2")
        self.assertEqual(code, 0)
        self.assertEqual(Image.open(out).size, sheet_size(3, 1))

    def test_diff_missing_candidate_frame_is_an_error(self):
        (self.root / "cand" / "down_base.txt").unlink()
        code, _, err = self.run_main("diff", self.root / "now", self.root / "cand", "down", self.root / "x.png")
        self.assertEqual(code, 2)
        self.assertIn("down_base.txt", err)

    def test_diff_direction_without_frames_is_an_error(self):
        code, _, err = self.run_main("diff", self.root / "now", self.root / "cand", "left", self.root / "x.png")
        self.assertEqual(code, 2)
        self.assertIn("left", err)

    # cmp
    def test_cmp_puts_each_candidate_in_its_own_column(self):
        out = self.root / "cmp.png"
        code, _, _ = self.run_main("cmp", self.root / "now", "down", out,
                                   f"A={self.root / 'cand'}", f"B={self.root / 'cand'}@up", "--states", "base")
        self.assertEqual(code, 0)
        self.assertEqual(Image.open(out).size, sheet_size(3, 1))

    def test_cmp_rejects_a_malformed_candidate(self):
        for spec in ("A", f"={self.root / 'cand'}", f"A={self.root / 'cand'}@side"):
            with self.subTest(spec):
                code, _, _ = self.run_main("cmp", self.root / "now", "down", self.root / "x.png", spec)
                self.assertEqual(code, 2)

    # order
    def order_config(self, part_pixels: dict, dx: int = 0) -> Path:
        self.ws.write("body.txt", grid_text({(10, 10): "b"}, BODY_MAP))
        self.ws.write("part.txt", grid_text(part_pixels, PART_MAP))
        layer = {"part": str(self.root / "part.txt"), "z": "front", "dx": dx}
        config = {"unit": "t", "frames": {"down_base": {"body": str(self.root / "body.txt"), "layers": [layer]}}}
        return self.ws.write("compose/t.json", json.dumps(config))

    def test_order_writes_one_sheet_per_direction(self):
        config = self.order_config({(11, 10): "h"})
        code, stdout, _ = self.run_main("order", config, self.root / "out", "--against", self.root / "now")
        self.assertEqual(code, 0)
        written = self.root / "out" / "t_down_order.png"
        self.assertTrue(written.is_file())
        self.assertEqual(Image.open(written).size, sheet_size(3, 1))  # 芯・部品・組んだ絵
        self.assertFalse((self.root / "out" / "t_up_order.png").exists())  # 設定に up のコマが無い
        self.assertIn("t_down_order.png", stdout)

    def test_order_unknown_state_is_an_error(self):
        config = self.order_config({(11, 10): "h"})
        code, _, err = self.run_main("order", config, self.root / "out", "--states", "idle2")
        self.assertEqual(code, 2)
        self.assertIn("down_idle2", err)

    def test_order_tolerates_pixels_shifted_off_the_frame(self):
        config = self.order_config({(31, 10): "h"}, dx=2)
        code, _, _ = self.run_main("order", config, self.root / "out", "--against", self.root / "now")
        self.assertEqual(code, 0)


if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 2: テストが落ちることを確かめる**

Run: `.venv/bin/python -m unittest tests.test_phone_sheet -v 2>&1 | tail -5`
Expected: `ModuleNotFoundError: No module named 'phone_sheet'`

- [ ] **Step 3: 道具を書く**

`pixel-asset-forge/tools/phone_sheet.py`:

```python
#!/usr/bin/env python3
"""スマホで見るための確認の画像（PNG）を作る（2026-10-16）。

依頼者はスマホで見るので、HTML のページ（compose_page.py・anim_compare.py）の代わりに使う。

    tools/phone_sheet.py order compose/gau.json build/phone [--dirs down,up] [--states base,idle2] [--against DIR]
    tools/phone_sheet.py diff assets/unit/gau build/gau_cand down build/phone/gau_down_diff.png [--states ...]
    tools/phone_sheet.py cmp assets/unit/gau down build/phone/gau_down_cmp.png A=build/candA B=build/candB@right [--states ...]

- order: 向きごとに1枚（OUTDIR/<ユニット>_<向き>_order.png）。各行が1コマで、部品を奥→手前に並べ、最後に組んだ絵。
  --against は今の絵の置き場（省くと assets/unit/<ユニット>/。今の絵が無くても作る）
- diff : コマごとに「今の絵／案／案に今と違う画素の赤枠」を並べる（赤枠の絵は印なしの絵と並べる決まり）
- cmp  : コマごとに今の絵と案をいくつも並べる。案は ラベル=置き場。別の向きのコマと比べるときは ラベル=置き場@向き

--states を省くと、order は設定にあるその向きのコマすべて、diff・cmp は今の絵の置き場にあるその向きのコマすべて
（並びは base・idle2・walk_a・walk_b・atk_wind・atk_draw・atk_hit・atk_release、ほかは名前順で後ろ）。
ガウの描き直し（2026-10-15）で作業フォルダに作った phone_png・phone_diff・phone_cmp を1本にまとめた。
"""
from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

from PIL import Image, ImageDraw

sys.path.insert(0, str(Path(__file__).resolve().parent))

from compose import ComposeError, load_config  # noqa: E402
from compose_page import GROUND, RED, _pixels, analyse_frame  # noqa: E402
from gridfile import REPO_ROOT, GridError, load_palette, parse  # noqa: E402

SCALE, PAD, LABEL = 6, 8, 16
SHEET_BG = (187, 187, 187, 255)
TEXT = (0, 0, 0, 255)
DIRECTIONS = ("down", "up", "left", "right")
STATE_ORDER = ("base", "idle2", "walk_a", "walk_b", "atk_wind", "atk_draw", "atk_hit", "atk_release")


class PhoneSheetError(Exception):
    """入力が足りない・書き間違い。"""


def _state_key(state: str) -> tuple[int, str]:
    return (STATE_ORDER.index(state), "") if state in STATE_ORDER else (len(STATE_ORDER), state)


def tile(size: tuple[int, int], pixels: dict, palette, marks=()) -> Image.Image:
    image = Image.new("RGBA", size, GROUND)
    for (x, y), colour in pixels.items():
        if 0 <= x < size[0] and 0 <= y < size[1]:  # dx・dy でコマの外へ出た画素は描かない
            image.putpixel((x, y), tuple(palette[colour][:3]) + (255,))
    image = image.resize((size[0] * SCALE, size[1] * SCALE), Image.NEAREST)
    draw = ImageDraw.Draw(image)
    for x, y in marks:
        draw.rectangle([x * SCALE, y * SCALE, x * SCALE + SCALE - 1, y * SCALE + SCALE - 1], outline=RED, width=2)
    return image


def sheet(rows: list[tuple[str, list[tuple[str, Image.Image]]]]) -> Image.Image:
    """rows は (行の見出し, [(絵の下のラベル, 絵), ...]) の並び。"""
    cell_w = max(image.width for _, cells in rows for _, image in cells)
    cell_h = max(image.height for _, cells in rows for _, image in cells)
    cols = max(len(cells) for _, cells in rows)
    out = Image.new("RGBA", (PAD + cols * (cell_w + PAD), PAD + len(rows) * (cell_h + LABEL * 2 + PAD)), SHEET_BG)
    draw = ImageDraw.Draw(out)
    for i, (title, cells) in enumerate(rows):
        y = PAD + i * (cell_h + LABEL * 2 + PAD)
        draw.text((PAD, y), title, fill=TEXT)
        for j, (label, image) in enumerate(cells):
            x = PAD + j * (cell_w + PAD)
            out.paste(image, (x, y + LABEL))
            draw.text((x, y + LABEL + cell_h + 2), label, fill=TEXT)
    return out


def _states_in(folder: Path, direction: str) -> list[str]:
    states = [p.stem.split("_", 1)[1] for p in folder.glob(f"{direction}_*.txt")]
    if not states:
        raise PhoneSheetError(f"{folder} に向き {direction} のコマが無い")
    return sorted(states, key=_state_key)


def _frame(folder: Path, name: str):
    path = folder / f"{name}.txt"
    if not path.is_file():
        raise PhoneSheetError(f"{path} が無い")
    grid = parse(path)
    return (grid.width, grid.height), _pixels(grid)


def _split(text: str | None) -> list[str]:
    return [s.strip() for s in text.split(",") if s.strip()] if text else []


def run_order(config: Path, outdir: Path, dirs: list[str], states: list[str], against: Path | None) -> list[Path]:
    unit, specs = load_config(config)
    against = against or REPO_ROOT / "assets" / "unit" / unit
    palette = load_palette()
    outdir.mkdir(parents=True, exist_ok=True)
    written = []
    for d in dirs or DIRECTIONS:
        if states:
            names = [f"{d}_{s}" for s in states]
            missing = [n for n in names if n not in specs]
            if missing:
                raise PhoneSheetError(f"{config.name} に {', '.join(missing)} が無い")
        else:
            names = sorted((n for n in specs if n.startswith(f"{d}_")), key=lambda n: _state_key(n.split("_", 1)[1]))
        if not names:
            continue
        rows = []
        for name in names:
            frame = analyse_frame(specs[name], against, name)
            cells = [(re.sub(rf"_{d}(_.*)?$", "", Path(item["file"]).stem), tile(frame["size"], item["pixels"], palette))
                     for item in frame["items"]]
            cells.append(("COMPOSED", tile(frame["size"], frame["composed"], palette)))
            rows.append((f"{name}   (back -> front) -> composed", cells))
        path = outdir / f"{unit}_{d}_order.png"
        sheet(rows).save(path)
        written.append(path)
    if not written:
        raise PhoneSheetError(f"{config.name} に、向き {','.join(dirs)} のコマが無い")
    return written


def run_diff(now: Path, cand: Path, direction: str, out: Path, states: list[str]) -> list[str]:
    palette = load_palette()
    rows, lines = [], []
    for state in states or _states_in(now, direction):
        name = f"{direction}_{state}"
        size, before = _frame(now, name)
        _, after = _frame(cand, name)
        diff = sorted(p for p in set(before) | set(after) if before.get(p) != after.get(p))
        rows.append((f"{name}   diff {len(diff)} px", [("NOW", tile(size, before, palette)),
                                                       ("NEW", tile(size, after, palette)),
                                                       ("NEW + red = diff", tile(size, after, palette, diff))]))
        lines.append(f"{name} diff {len(diff)} px")
    out.parent.mkdir(parents=True, exist_ok=True)
    sheet(rows).save(out)
    return lines


def _candidate(spec: str, direction: str) -> tuple[str, Path, str]:
    label, sep, rest = spec.partition("=")
    if not sep or not label or not rest:
        raise PhoneSheetError(f"案の指定は ラベル=置き場[@向き]: {spec!r}")
    folder, at, other = rest.partition("@")
    if at and other not in DIRECTIONS:
        raise PhoneSheetError(f"案の向き {other!r} は {', '.join(DIRECTIONS)} のどれでもない: {spec!r}")
    return label, Path(folder), other if at else direction


def run_cmp(now: Path, direction: str, out: Path, specs: list[str], states: list[str]) -> None:
    candidates = [("NOW", now, direction)] + [_candidate(s, direction) for s in specs]
    palette = load_palette()
    rows = []
    for state in states or _states_in(now, direction):
        cells = []
        for label, folder, d in candidates:
            size, pixels = _frame(folder, f"{d}_{state}")
            cells.append((f"{label} ({d}_{state})", tile(size, pixels, palette)))
        rows.append((f"{direction}_{state}", cells))
    out.parent.mkdir(parents=True, exist_ok=True)
    sheet(rows).save(out)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = parser.add_subparsers(dest="kind", required=True)
    order = sub.add_parser("order", help="部品を奥→手前に並べる（向きごとに1枚）")
    order.add_argument("config", type=Path, help="compose/<ユニット>.json")
    order.add_argument("outdir", type=Path)
    order.add_argument("--dirs", help="向き（カンマ区切り。省くと4方向）")
    order.add_argument("--states", help="状態（カンマ区切り。省くと設定にあるコマすべて）")
    order.add_argument("--against", type=Path, help="今の絵の置き場（省くと assets/unit/<ユニット>/）")
    diff = sub.add_parser("diff", help="今の絵／案／違う画素の赤枠")
    diff.add_argument("now", type=Path, help="今の絵の置き場")
    diff.add_argument("cand", type=Path, help="案の置き場")
    diff.add_argument("direction", choices=DIRECTIONS)
    diff.add_argument("out", type=Path)
    diff.add_argument("--states", help="状態（カンマ区切り）")
    cmp_ = sub.add_parser("cmp", help="今の絵と案をいくつも並べる")
    cmp_.add_argument("now", type=Path, help="今の絵の置き場")
    cmp_.add_argument("direction", choices=DIRECTIONS)
    cmp_.add_argument("out", type=Path)
    cmp_.add_argument("candidates", nargs="+", help="ラベル=置き場[@向き]")
    cmp_.add_argument("--states", help="状態（カンマ区切り）")
    args = parser.parse_args(argv)

    try:
        if args.kind == "order":
            for path in run_order(args.config, args.outdir, _split(args.dirs), _split(args.states), args.against):
                print(f"書いた {path}")
        elif args.kind == "diff":
            for line in run_diff(args.now, args.cand, args.direction, args.out, _split(args.states)):
                print(line)
            print(f"書いた {args.out}")
        else:
            run_cmp(args.now, args.direction, args.out, args.candidates, _split(args.states))
            print(f"書いた {args.out}")
    except (PhoneSheetError, ComposeError, GridError) as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 2
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
```

- [ ] **Step 4: テストが通ることを確かめる**

Run: `.venv/bin/python -m unittest tests.test_phone_sheet -v 2>&1 | tail -5`
Expected: `OK`（9 件）

- [ ] **Step 5: 今の絵で動かして、作業フォルダの道具と同じ見え方か確かめる**

```bash
mkdir -p /tmp/phone1
.venv/bin/python tools/phone_sheet.py order compose/gau.json /tmp/phone1 --dirs down --states base,idle2,atk_wind,atk_hit
.venv/bin/python tools/phone_sheet.py diff assets/unit/gau assets/unit/gau down /tmp/phone1/gau_down_diff.png
.venv/bin/python tools/phone_sheet.py cmp assets/unit/gau down /tmp/phone1/gau_down_cmp.png ROR=assets/unit/roran INES=assets/unit/ines --states base,idle2
```

Expected: 3枚書く。`diff` は全コマ `diff 0 px`。Read で `/tmp/phone1/gau_down_order.png` を開き、部品が奥→手前に並び、ラベルが `core`・`dagger`・`dagger_hand`・`free_hand`・`COMPOSED` になっていることを確かめる（依頼者には見せなくてよい）。

- [ ] **Step 6: Commit**

```bash
cd /home/ubuntu/workspace/character-tactics
git add pixel-asset-forge/tools/phone_sheet.py pixel-asset-forge/tests/test_phone_sheet.py
git commit -m "feat: スマホで見る確認の画像を作る phone_sheet.py を足す（作業フォルダの3本をまとめる）"
```

---

### Task 2: 8 `unit` に mirror を使わない（`gridfile.check`）

**Files:**
- Modify: `pixel-asset-forge/tools/gridfile.py`（`check()` の末尾の前）
- Test: `pixel-asset-forge/tests/test_tools.py`（`CheckTest` の後に新しいクラス）

**Interfaces:**
- Consumes: `gridfile.parse`・`check(grid, palette) -> list[str]`・`Grid.type`・`Grid.headers`（派生のファイルは自分の `from`・`transform` を `headers` に持つ。`_derive` が由来元の分だけを消す）
- Produces: `check()` が unit の派生に `"unit must not be derived ..."` を返す

- [ ] **Step 1: 失敗するテストを書く**

`tests/test_tools.py` の `CheckTest` の後に足す:

```python
UNIT = """# type: unit
# size: 2x2
# light: upper-left
# bg: transparent
# map: o=outline b=skin_base
ob
bo
"""


class UnitMirrorTest(unittest.TestCase):
    """unit に mirror を使わない（types/unit/SPEC.md。left と right で手前と奥が入れ替わり、光源も反転する）。"""

    def setUp(self):
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        self.dir = Path(tmp.name)
        (self.dir / "right_base.txt").write_text(UNIT, encoding="utf-8")

    def errors(self, text: str) -> list[str]:
        path = self.dir / "left_base.txt"
        path.write_text(text, encoding="utf-8")
        return check(parse(path), PALETTE)

    def test_derived_unit_fails(self):
        errors = self.errors("# from: right_base.txt\n# transform: mirror_x\n")
        self.assertTrue(any(e.startswith("unit must not be derived") for e in errors), errors)

    def test_unit_with_transform_but_no_from_fails(self):
        errors = self.errors(UNIT.replace("# bg: transparent\n", "# bg: transparent\n# transform: mirror_x\n"))
        self.assertTrue(any(e.startswith("unit must not be derived") for e in errors), errors)

    def test_plain_unit_passes(self):
        self.assertEqual(self.errors(UNIT), [])

    def test_derived_tile_still_passes(self):
        (self.dir / "right_base.txt").write_text(UNIT.replace("type: unit", "type: tile"), encoding="utf-8")
        self.assertEqual(self.errors("# from: right_base.txt\n# transform: mirror_x\n"), [])
```

`tempfile` と `Path` が `test_tools.py` で import 済みか確かめ、無ければ先頭の import に足す。

- [ ] **Step 2: テストが落ちることを確かめる**

Run: `.venv/bin/python -m unittest tests.test_tools.UnitMirrorTest -v 2>&1 | tail -5`
Expected: `test_derived_unit_fails` と `test_unit_with_transform_but_no_from_fails` が FAIL

- [ ] **Step 3: 検査を足す**

`tools/gridfile.py` の `check()` で、`if grid.max_colors is not None and not errors:` の直前に足す:

```python
    if grid.type == "unit" and ("from" in grid.headers or "transform" in grid.headers):
        # left と right は手前と奥が入れ替わり、反転すると光源も動く（types/unit/SPEC.md「unit に mirror を使わない」）
        errors.append("unit must not be derived with 'from'/'transform' (types/unit/SPEC.md: no mirror for unit)")
```

- [ ] **Step 4: テストが通ることを確かめる**

Run: `.venv/bin/python -m unittest tests.test_tools -v 2>&1 | tail -3`
Expected: `OK`

- [ ] **Step 5: 既存の絵に掛けて数える**

Run: `.venv/bin/python tools/validate.py -q; echo "exit $?"`
Expected: 新しい文言 `unit must not be derived` の失敗は 0 件（`grep -rl "^# from:" assets/unit types/unit` も空のはず）。ほかの失敗があれば、今回の変更の前からあるものかを `git stash` で確かめて台帳に書く。
0 件なら依頼者への一覧は「0件」と報告するだけでよい（決めてもらうものが無い）。

- [ ] **Step 6: Commit**

```bash
cd /home/ubuntu/workspace/character-tactics
git add pixel-asset-forge/tools/gridfile.py pixel-asset-forge/tests/test_tools.py
git commit -m "feat: validate で unit の mirror（from・transform）を落とす"
```

---

### Task 3: 7 item の長い持ち物の左右対称 `tools/item_check.py`

**Files:**
- Create: `pixel-asset-forge/tools/item_check.py`
- Test: `pixel-asset-forge/tests/test_item_check.py`

**Interfaces:**
- Consumes: `gridfile.parse`・`find_grids`・`GridError`・`REPO_ROOT`・`BACKGROUND`
- Produces: `asymmetric(grid) -> list[tuple[int, int]]`、`main(argv) -> int`（0 ok、1 対称でない、2 入力の誤り）、`FRONT_FACING = {"chest"}`

- [ ] **Step 1: 失敗するテストを書く**

`pixel-asset-forge/tests/test_item_check.py`:

```python
"""Checks for tools/item_check.py (item の長い持ち物の左右対称)."""
from __future__ import annotations

import contextlib
import io
import sys
import tempfile
import unittest
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT / "tools"))

from gridfile import parse  # noqa: E402
from item_check import asymmetric, main  # noqa: E402


def item_text(pixels: set[tuple[int, int]], kind: str = "item", size: str = "16x16") -> str:
    width, height = (int(n) for n in size.split("x"))
    rows = [["."] * width for _ in range(height)]
    for x, y in pixels:
        rows[y][x] = "o"
    return (f"# type: {kind}\n# size: {size}\n# light: upper-left\n# bg: transparent\n# map: o=outline\n"
            + "\n".join("".join(r) for r in rows) + "\n")


# 軸 x+y=15 の線（右上へ向けた斜め置きの芯）と、軸について対になる2画素
SYMMETRIC = {(x, 15 - x) for x in range(2, 14)} | {(5, 9), (6, 10)}


class ItemCheckTest(unittest.TestCase):
    def setUp(self):
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        self.dir = Path(tmp.name)

    def write(self, name: str, text: str) -> Path:
        path = self.dir / name
        path.write_text(text, encoding="utf-8")
        return path

    def run_main(self, *paths: Path) -> tuple[int, str]:
        out = io.StringIO()
        with contextlib.redirect_stdout(out), contextlib.redirect_stderr(out):
            code = main([str(p) for p in paths])
        return code, out.getvalue()

    def test_symmetric_shape_passes(self):
        self.assertEqual(asymmetric(parse(self.write("a.txt", item_text(SYMMETRIC)))), [])

    def test_extra_pixel_on_one_side_is_reported(self):
        grid = parse(self.write("a.txt", item_text(SYMMETRIC | {(4, 4)})))
        self.assertEqual(asymmetric(grid), [(4, 4)])

    def test_main_exit_codes(self):
        good = self.write("good.txt", item_text(SYMMETRIC))
        bad = self.write("bad.txt", item_text(SYMMETRIC | {(4, 4)}))
        self.assertEqual(self.run_main(good)[0], 0)
        code, out = self.run_main(good, bad)
        self.assertEqual(code, 1)
        self.assertIn("(4,4)", out)

    def test_non_square_is_an_input_error(self):
        path = self.write("a.txt", item_text(set(), size="16x8"))
        self.assertEqual(self.run_main(path)[0], 2)

    def test_non_item_is_an_input_error(self):
        path = self.write("a.txt", item_text(SYMMETRIC, kind="tile"))
        self.assertEqual(self.run_main(path)[0], 2)


if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 2: テストが落ちることを確かめる**

Run: `.venv/bin/python -m unittest tests.test_item_check -v 2>&1 | tail -5`
Expected: `ModuleNotFoundError: No module named 'item_check'`

- [ ] **Step 3: 道具を書く**

`pixel-asset-forge/tools/item_check.py`:

```python
#!/usr/bin/env python3
"""item の長い持ち物の形が、軸 x+y=15 について左右対称かを確かめる（2026-10-16）。

    tools/item_check.py                        # assets/item のすべて（正面向きの物を除く）
    tools/item_check.py assets/item/sword.txt  # 指定したファイル（正面向きの物も見る）

types/item/SPEC.md「形は軸について左右対称にする。軸 x+y=15 で折り返して形（不透明な画素）が重なること」。
色は光源に従うので比べない（左上側が *_hi、右下側が *_shadow）。不透明かどうかだけを比べる。
16x16 なら画素 (x, y) を (15-y, 15-x) へ折り返す。折り返した先が透明な画素を出す。
正面向きの物（FRONT_FACING）は斜め置きでないので、既定の対象から外す（SPEC「未確定」: 長くない小物の向き）。
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from gridfile import BACKGROUND, REPO_ROOT, GridError, find_grids, parse  # noqa: E402

ITEM_DIR = REPO_ROOT / "assets" / "item"
FRONT_FACING = {"chest"}


class ItemCheckError(Exception):
    """この検査の前提（正方形の item）に合わない。"""


def asymmetric(grid) -> list[tuple[int, int]]:
    if grid.type != "item":
        raise ItemCheckError(f"{grid.path.name}: type が item でない（{grid.type}）")
    if grid.width != grid.height:
        raise ItemCheckError(f"{grid.path.name}: 正方形でない（{grid.width}x{grid.height}）")
    n = grid.width
    opaque = {(x, y) for y, row in enumerate(grid.rows) for x, ch in enumerate(row) if ch != BACKGROUND}
    return sorted(((x, y) for x, y in opaque if (n - 1 - y, n - 1 - x) not in opaque), key=lambda p: (p[1], p[0]))


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("paths", nargs="*", type=Path, help="item のファイル（省くと assets/item の正面向き以外すべて）")
    args = parser.parse_args(argv)
    paths = args.paths or [p for p in find_grids(ITEM_DIR) if p.stem not in FRONT_FACING]

    bad = 0
    for path in paths:
        try:
            found = asymmetric(parse(path))
        except (GridError, ItemCheckError) as exc:
            print(f"error: {exc}", file=sys.stderr)
            return 2
        if found:
            bad += 1
            print(f"FAIL {path.name}: 軸 x+y=15 で折り返した先が透明な画素 {len(found)}: "
                  + " ".join(f"({x},{y})" for x, y in found))
        else:
            print(f"ok   {path.name}")
    return 1 if bad else 0


if __name__ == "__main__":
    raise SystemExit(main())
```

- [ ] **Step 4: テストが通ることを確かめる**

Run: `.venv/bin/python -m unittest tests.test_item_check -v 2>&1 | tail -3`
Expected: `OK`（5 件）

- [ ] **Step 5: 既存の絵に掛けて数え、依頼者に見せて止まる**

Run: `.venv/bin/python tools/item_check.py; echo "exit $?"`

落ちた item があれば、印なしの絵と、落ちた画素に赤枠を付けた絵を並べた PNG（`/tmp/policy1/item_<名前>.png`、16×16 を 16 倍。赤枠は `phone_sheet.tile` を使い、大きさ `(16,16)` で作ってよい）を作り、Read で開いて見せる。
1件ずつ、例外にする・絵を直す（ISSUES に立てる）・道具の判定を直す・道具にしない、を聞く。0件なら「0件」と報告するだけでよい。
判断を台帳に `Ruling:` で書く。例外にすると決まったものは、`FRONT_FACING` と同じく、理由と日付を書いた定数（例 `EXEMPT = {"bow": "弦は ... 2026-10-16 依頼者"}`）で既定の対象から外し、テストを足す。

- [ ] **Step 6: Commit**

```bash
cd /home/ubuntu/workspace/character-tactics
git add pixel-asset-forge/tools/item_check.py pixel-asset-forge/tests/test_item_check.py
git commit -m "feat: item の長い持ち物の形が軸 x+y=15 で左右対称かを確かめる item_check.py を足す"
```

---

### Task 4: 10 レイアウトに置かれていないタイル（`tilemap.py --unplaced`）

**Files:**
- Modify: `pixel-asset-forge/tools/tilemap.py`
- Test: `pixel-asset-forge/tests/test_tilemap.py`

**Interfaces:**
- Consumes: `tilemap.read_layout(path)`（不正なレイアウトは `SystemExit`。今の挙動のまま）、`gridfile.find_grids`
- Produces: `unplaced(tile_dir: Path = TILE_DIR, layout_dir: Path = LAYOUT_DIR) -> list[str]`、`main` の `--unplaced`（置かれていないタイルがあれば終了コード 1）

- [ ] **Step 1: 失敗するテストを書く**

`tests/test_tilemap.py` の末尾（`if __name__` の前）に足す:

```python
class UnplacedTest(unittest.TestCase):
    """新しいセットは全点をレイアウトに置く（CLAUDE.md）。どのレイアウトにも無いタイルを出す。"""

    def setUp(self):
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        root = Path(tmp.name)
        self.tiles, self.layouts = root / "tile", root / "layouts"
        (self.tiles / "set").mkdir(parents=True)
        self.layouts.mkdir()
        for name in ("plain", "river_v", "set/rock_nw"):
            (self.tiles / f"{name}.txt").write_text("# placeholder\n", encoding="utf-8")
        (self.layouts / "a.txt").write_text("# comment\nplain .\nplain plain\n", encoding="utf-8")

    def test_lists_tiles_in_no_layout(self):
        self.assertEqual(tilemap.unplaced(self.tiles, self.layouts), ["river_v", "rock_nw"])

    def test_a_tile_in_any_layout_counts_as_placed(self):
        (self.layouts / "b.txt").write_text("river_v rock_nw\n", encoding="utf-8")
        self.assertEqual(tilemap.unplaced(self.tiles, self.layouts), [])

    def test_unplaced_cannot_be_combined_with_layout(self):
        with self.assertRaises(SystemExit):
            tilemap.main(["--unplaced", "--layout", str(self.layouts / "a.txt")])
```

`test_tilemap.py` の先頭で `tempfile` を import していなければ足す（`tilemap` と `Path` は import 済み）。

- [ ] **Step 2: テストが落ちることを確かめる**

Run: `.venv/bin/python -m unittest tests.test_tilemap.UnplacedTest -v 2>&1 | tail -5`
Expected: `AttributeError: module 'tilemap' has no attribute 'unplaced'`

- [ ] **Step 3: 道具に足す**

`tools/tilemap.py`:

docstring の使い方に1行足す:

```
    tools/tilemap.py --unplaced               # どのレイアウトにも置かれていないタイル（CLAUDE.md: 全点をレイアウトに置く）
```

`OUTPUT_DIR` の下に定数と関数を足す:

```python
LAYOUT_DIR = REPO_ROOT / "layouts"


def unplaced(tile_dir: Path = TILE_DIR, layout_dir: Path = LAYOUT_DIR) -> list[str]:
    """どのレイアウト（layout_dir/*.txt）にも置かれていないタイルの名前（名前順）。"""
    placed = {cell for path in sorted(layout_dir.glob("*.txt")) for row in read_layout(path) for cell in row if cell}
    return sorted(p.stem for p in find_grids(tile_dir) if p.stem not in placed)
```

`main` の引数に足す:

```python
    parser.add_argument("--unplaced", action="store_true", help="どのレイアウトにも置かれていないタイルを出す（あれば終了コード 1）")
```

`if args.repeat and args.layout:` の直後に足す:

```python
    if args.unplaced:
        if args.repeat or args.layout:
            raise SystemExit("error: use --unplaced on its own")
        names = unplaced()
        for name in names:
            print(f"unplaced {name}")
        print(f"\n{len(names)} tile(s) in no layout under {display(LAYOUT_DIR)}" if names else "every tile is in a layout")
        return 1 if names else 0
```

- [ ] **Step 4: テストが通ることを確かめる**

Run: `.venv/bin/python -m unittest tests.test_tilemap -v 2>&1 | tail -3`
Expected: `OK`

- [ ] **Step 5: 既存の絵に掛けて数え、依頼者に見せて止まる**

Run: `.venv/bin/python tools/tilemap.py --unplaced; echo "exit $?"`
Expected: ISSUES「レイアウトに置かれていないタイルが11点」の11点（`bridge_v` `dirt` `fence_v` `mountain_{ne,nw,se,sw}` `path_sw` `path_t_{n,s,w}`）。違えば台帳に `Finding:` で書く。

一覧を依頼者に見せ、どうするかを聞く。選択肢: レイアウトに置く（ISSUES の既存の行のとおり、タイルの絵ではなくレイアウトの作業なので、この PR で `layouts/` に足してよいかも聞く）・置かない理由を書いて例外にする・今のまま ISSUES の行に任せる。
例外にすると決まったものは、`tilemap.py` に理由と日付を書いた定数 `UNPLACED_OK = {"名前": "理由 日付 依頼者"}` を作って `unplaced()` の結果から外し、テストを足す。判断を台帳に `Ruling:` で書く。

- [ ] **Step 6: Commit**

```bash
cd /home/ubuntu/workspace/character-tactics
git add pixel-asset-forge/tools/tilemap.py pixel-asset-forge/tests/test_tilemap.py
git commit -m "feat: どのレイアウトにも置かれていないタイルを出す tilemap.py --unplaced を足す"
```

（依頼者がレイアウトに置くと決めたら、`layouts/` の変更は別のコミットにする）

---

### Task 5: 11 テストが `assets/` を読んでいないか（＋川のテストの直し）

**Files:**
- Create: `pixel-asset-forge/tests/test_no_live_assets.py`
- Create: `pixel-asset-forge/tests/fixtures/river_ne.txt`（`assets/tile/river_ne.txt` の写し）・`river_nw.txt`・`river_se.txt`・`river_sw.txt`（`assets/tile/` の派生の宣言の写し）
- Modify: `pixel-asset-forge/tests/test_tools.py`（`RiverDerivationTest`）

**Interfaces:**
- Consumes: なし（unittest と標準ライブラリだけ）
- Produces: `record_reads(tests, assets_root: Path) -> dict[str, set[Path]]`（テストの id → そのテストが開いた `assets_root` の下のファイル）、`ALLOWED: dict[str, str]`（テストの id → 理由）

- [ ] **Step 1: 失敗するテストを書く**

`pixel-asset-forge/tests/test_no_live_assets.py`:

```python
"""テストが現役のアート（assets/）を読んでいないかを確かめる（2026-10-16）。

CLAUDE.md「回帰テストに現役のアートを参照させない」: tests/ から assets/ の生きている絵を読むと、
その絵を描き直したときにテストが落ちる。比べたい相手は tests/fixtures/ に固定する。

tests/ の他のテストを1件ずつ走らせ、その間に開かれたファイルのうち、リポジトリの assets/ の下にあるものを数える
（builtins.open と io.open を見張る。Path.read_text・Image.open もどちらかを通る）。
一時フォルダの中の assets/ はリポジトリの外なので数えない。他のテストの成否はここでは見ない。
わざと出荷物の構造を確かめるテストは ALLOWED に、理由と日付と一緒に挙げる。
"""
from __future__ import annotations

import builtins
import contextlib
import io
import os
import tempfile
import unittest
from pathlib import Path

TESTS = Path(__file__).resolve().parent
REPO_ROOT = TESTS.parent
ASSETS = REPO_ROOT / "assets"

ALLOWED: dict[str, str] = {}


def _cases(suite):
    for test in suite:
        if isinstance(test, unittest.TestSuite):
            yield from _cases(test)
        else:
            yield test


def record_reads(tests, assets_root: Path) -> dict[str, set[Path]]:
    """tests を1件ずつ走らせ、テストの id ごとに assets_root の下で開いたファイルを返す。"""
    root = assets_root.resolve()
    reads: dict[str, set[Path]] = {}
    current: list[str | None] = [None]
    real_builtin, real_io = builtins.open, io.open

    def spy(file, *args, **kwargs):
        if current[0] is not None and isinstance(file, (str, os.PathLike)):
            path = Path(file).resolve()
            if path.is_relative_to(root):
                reads.setdefault(current[0], set()).add(path)
        return real_io(file, *args, **kwargs)

    builtins.open = io.open = spy
    try:
        for test in tests:
            current[0] = test.id()
            with contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(io.StringIO()):
                test.run(unittest.TestResult())
            current[0] = None
    finally:
        builtins.open, io.open = real_builtin, real_io
    return reads


def suite_reads() -> dict[str, set[Path]]:
    suite = unittest.TestLoader().discover(str(TESTS), pattern="test*.py", top_level_dir=str(TESTS))
    tests = [t for t in _cases(suite) if not t.id().startswith(f"{__name__.rsplit('.', 1)[-1]}.")]
    return record_reads(tests, ASSETS)


class RecordReadsTest(unittest.TestCase):
    def setUp(self):
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        self.root = Path(tmp.name)
        (self.root / "assets").mkdir()
        (self.root / "assets" / "a.txt").write_text("a", encoding="utf-8")
        (self.root / "other.txt").write_text("b", encoding="utf-8")

    def test_records_both_open_and_read_text(self):
        root = self.root

        class Probe(unittest.TestCase):
            def test_read_text(self):
                (root / "assets" / "a.txt").read_text(encoding="utf-8")

            def test_open(self):
                with open(root / "assets" / "a.txt", encoding="utf-8") as handle:
                    handle.read()

            def test_outside(self):
                (root / "other.txt").read_text(encoding="utf-8")

        tests = list(_cases(unittest.TestLoader().loadTestsFromTestCase(Probe)))
        reads = record_reads(tests, root / "assets")
        self.assertEqual(sorted(k.rsplit(".", 1)[-1] for k in reads), ["test_open", "test_read_text"])
        self.assertEqual(builtins.open.__module__, "_io")  # 見張りを外して元に戻っている


class NoLiveAssetsTest(unittest.TestCase):
    def test_no_test_reads_live_assets(self):
        reads = suite_reads()
        unexpected = {test: sorted(str(p.relative_to(REPO_ROOT)) for p in paths)
                      for test, paths in reads.items() if test not in ALLOWED}
        self.assertEqual(unexpected, {}, "assets/ を読んでいるテスト（tests/fixtures/ に固定するか、理由を書いて ALLOWED へ）")

    def test_allowed_entries_still_read_assets(self):
        reads = suite_reads()
        self.assertEqual(sorted(t for t in ALLOWED if t not in reads), [], "もう assets/ を読んでいない（ALLOWED から消す）")


if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 2: テストが落ちることを確かめる**

Run: `.venv/bin/python -m unittest tests.test_no_live_assets -v 2>&1 | tail -15`
Expected: `RecordReadsTest` は OK。`test_no_test_reads_live_assets` が FAIL し、`assets/` を読んでいるテストの一覧が出る（少なくとも `test_tools.RiverDerivationTest` の4件と `test_check_colors.RepositoryTest.test_converged_assets_are_clean`）。一覧を台帳に `Finding:` で写す。

- [ ] **Step 3: 川のテストの入力を fixtures に固定する**

```bash
cp assets/tile/river_ne.txt assets/tile/river_nw.txt assets/tile/river_se.txt assets/tile/river_sw.txt tests/fixtures/
```

`tests/test_tools.py` の `RiverDerivationTest` を次にする（変形の3件は fixtures で確かめ、出荷する曲がりが派生の宣言であることは出荷物で確かめ続ける。ISSUES「`RiverDerivationTest` が現役の川のタイルを読んでいる」のとおり）:

```python
class RiverDerivationTest(unittest.TestCase):
    """The shipped bends are derived, so this pins the migration.

    変形の確かめは tests/fixtures/ の写し（2026-10-16 に assets/tile/ から写した）で行う。
    出荷する曲がりが行を持たない派生の宣言であることだけは、出荷物そのものを見る（tests/test_no_live_assets.py の ALLOWED）。
    """

    FIXTURES = REPO_ROOT / "tests" / "fixtures"
    TILES = REPO_ROOT / "assets" / "tile"

    def test_nw_is_ne_mirrored(self):
        source = parse(self.FIXTURES / "river_ne.txt")
        self.assertEqual(parse(self.FIXTURES / "river_nw.txt").rows, TRANSFORMS["mirror_x"](source.rows))

    def test_se_is_ne_flipped(self):
        source = parse(self.FIXTURES / "river_ne.txt")
        self.assertEqual(parse(self.FIXTURES / "river_se.txt").rows, TRANSFORMS["mirror_y"](source.rows))

    def test_sw_is_ne_turned_around(self):
        source = parse(self.FIXTURES / "river_ne.txt")
        self.assertEqual(parse(self.FIXTURES / "river_sw.txt").rows, TRANSFORMS["rotate_180"](source.rows))

    def test_the_derived_bends_carry_no_rows_of_their_own(self):
        for name in ("river_nw", "river_se", "river_sw"):
            with self.subTest(name):
                text = (self.TILES / f"{name}.txt").read_text(encoding="utf-8")
                self.assertTrue(all(line.startswith("#") or not line.strip() for line in text.splitlines()))
```

`tests/test_no_live_assets.py` の `ALLOWED` に足す:

```python
ALLOWED: dict[str, str] = {
    "test_tools.RiverDerivationTest.test_the_derived_bends_carry_no_rows_of_their_own":
        "出荷する川の曲がりが、行を持たない派生の宣言であることを確かめる。絵を描き直しても落ちない（2026-10-16、ISSUES の行のとおり残す）",
}
```

Run: `.venv/bin/python -m unittest tests.test_tools -v 2>&1 | tail -3` → `OK`

- [ ] **Step 4: 残りを依頼者に見せて止まる**

Run: `.venv/bin/python -m unittest tests.test_no_live_assets -v 2>&1 | tail -15`

まだ出るテストの一覧（テストの名前・読んでいるファイル・何を確かめているテストか）を依頼者に見せ、1件ずつ、fixtures に固定する・理由を書いて ALLOWED に入れる・道具の判定を直す、を聞く。
`test_check_colors.RepositoryTest` は docstring に「Threshold regression」とあり、出荷物の色のしきい値を見張る意図のテストなので、その意図を添えて聞く。判断を台帳に `Ruling:` で書き、決まったとおりに直す。

Run: `.venv/bin/python -m unittest discover -s tests 2>&1 | tail -3` → `OK`

- [ ] **Step 5: Commit**

```bash
cd /home/ubuntu/workspace/character-tactics
git add pixel-asset-forge/tests/test_no_live_assets.py pixel-asset-forge/tests/test_tools.py pixel-asset-forge/tests/fixtures/river_ne.txt pixel-asset-forge/tests/fixtures/river_nw.txt pixel-asset-forge/tests/fixtures/river_se.txt pixel-asset-forge/tests/fixtures/river_sw.txt
git status --short
git commit -m "test: テストが assets/ を読んでいないかを確かめ、川のテストの入力を fixtures に固定する"
```

（Step 4 で直したテストのファイルも `git add` に足す）

---

### Task 6: 文書と台帳

**Files:**
- Modify: `pixel-asset-forge/CLAUDE.md`、`pixel-asset-forge/ISSUES.md`、`pixel-asset-forge/types/item/SPEC.md`（必要なら）
- Create: `docs/superpowers/ledgers/2026-10-16-policy-check-tools-pr1.md`（台帳の写し）

- [ ] **Step 1: CLAUDE.md**

- 「コマンド」の一覧に足す（`compose_page.py` の行の下と、`tilemap.py` の行の下）:

```sh
.venv/bin/python tools/phone_sheet.py order compose/gau.json build/phone   # スマホで見る PNG（部品を奥→手前。diff・cmp もある。--help）
.venv/bin/python tools/tilemap.py --unplaced  # どのレイアウトにも置かれていないタイル（あれば終了コード 1）
.venv/bin/python tools/item_check.py          # item の長い持ち物の形が軸 x+y=15 で左右対称か
```

- 「ミラーで作れるものをコピーで持たない」の「`unit` にも使わない（...）。機械では検査していない。」を「`unit` にも使わない（...）。`validate.py` が落とす（2026-10-16）。」にする
- 「新しいセットを作ったら、その全点を置いたレイアウトを `layouts/` に足すこと。」の後に「`tilemap.py --unplaced` で確かめる。」を足す
- 「回帰テストに現役のアートを参照させない」の節の末尾に「`tests/test_no_live_assets.py` が、テストが `assets/` を読むと落とす。わざと出荷物を確かめるテストは、そのファイルの `ALLOWED` に理由を書く（2026-10-16）。」を足す

- [ ] **Step 2: ISSUES.md**

行を消す（直したので）:
- 「スマホで見せる画像の道具が作業フォルダにだけある」
- 「方針を確かめる道具が無いもの」の節の「**`unit` に mirror を使っても落ちない**」「**item の長い持ち物の左右対称を確かめる道具が無い**」「**レイアウトに置かれていないタイルを一覧にする道具が無い**」「**テストが `assets/` を読んでも落ちない**」
- 「`RiverDerivationTest` が現役の川のタイルを読んでいる」
- Task 4・5 で依頼者が解消すると決めて直した行（例: レイアウトに置いた場合の「レイアウトに置かれていないタイルが11点」）

行を足す・直す: Task 2〜5 で依頼者が「絵を直す」「道具にしない」と決めたものを1行ずつ（日付と依頼者の判断を書く）。「方針を確かめる道具が無いもの」の節の前文の「拳以外の部品が閉じているか…」の文は、PR 2 で直すので残す。

- [ ] **Step 3: 全体を確かめる**

Run: `.venv/bin/python -m unittest discover -s tests 2>&1 | tail -3` → `OK`
Run: `.venv/bin/python tools/validate.py -q; echo $?` → Task 2 Step 5 と同じ結果
Run: `.venv/bin/python tools/item_check.py; echo $?`・`.venv/bin/python tools/tilemap.py --unplaced; echo $?` → 依頼者の判断どおりの結果（台帳に書いた値）

- [ ] **Step 4: 台帳を写して Commit**

```bash
cd /home/ubuntu/workspace/character-tactics
cp .superpowers/sdd/2026-10-16-policy-check-tools-pr1/progress.md docs/superpowers/ledgers/2026-10-16-policy-check-tools-pr1.md
git add pixel-asset-forge/CLAUDE.md pixel-asset-forge/ISSUES.md docs/superpowers/ledgers/2026-10-16-policy-check-tools-pr1.md
git status --short
git commit -m "docs: phone_sheet・item_check・tilemap --unplaced・テストの assets 読みの検査を CLAUDE.md と ISSUES に反映する"
```

---

## Self-Review

- 設計書との対応: スマホ用の画像→Task 1、8→Task 2、7→Task 3、10→Task 4、11 と川のテスト→Task 5、文書（CLAUDE.md・ISSUES）→Task 6。ユニットの確認・設定ファイル・入口・SPEC の書き換えは PR 2 の計画
- 「既存の絵に掛けて数え、依頼者に見せて決める」→ Task 2〜5 の「既存の絵に掛けて」の Step（Task 2 は 0 件の見込みで報告だけ）。「絵は直さない」→ Global Constraints と各 Step の選択肢
- 名前の整合: `phone_sheet` の `main`・`PAD`・`LABEL`・`SCALE`・`PhoneSheetError`、`compose_page` の `RED`・`GROUND`・`_pixels`・`analyse_frame`（今のコードにある）、`item_check.asymmetric`・`FRONT_FACING`、`tilemap.unplaced`・`LAYOUT_DIR`、`test_no_live_assets.record_reads`・`ALLOWED`
- Review Focus の5件は、それぞれ Task 1・2・5 のテストに入れた
