"""Checks for tools/body_check.py (体の単品チェック)."""
from __future__ import annotations

import contextlib
import io
import sys
import tempfile
import unittest
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT / "tools"))

from body_check import (  # noqa: E402
    band_center, centre_failures, hanging_pixels, holes, main, open_edges, protrusions, without)

BANDS = {"head": (0, 3), "trunk": (4, 7), "legs": (8, 9)}
CHARMAP = {"o": "outline", "b": "cloak_dark_base"}
HAIR_MAP = {**CHARMAP, "h": "hair_slate_base"}


def box(x0: int, x1: int, y0: int, y1: int) -> dict[tuple[int, int], str]:
    return {
        (x, y): "o" if x in (x0, x1) or y in (y0, y1) else "b"
        for y in range(y0, y1 + 1)
        for x in range(x0, x1 + 1)
    }


def rows_of(pixels: dict[tuple[int, int], str], size: int = 12) -> list[str]:
    grid = [["."] * size for _ in range(size)]
    for (x, y), ch in pixels.items():
        grid[y][x] = ch
    return ["".join(r) for r in grid]


def whole_body() -> dict[tuple[int, int], str]:
    pixels = box(2, 9, 0, 3)
    pixels.update(box(2, 9, 4, 7))
    pixels.update(box(3, 8, 8, 9))
    return pixels


def hanging_hair() -> dict[tuple[int, int], str]:
    """頭の右（x=10）から胴の1行目（y=4）まで垂れた髪 h と、それを囲む輪郭。"""
    pixels = {(10, y): "h" for y in range(2, 5)}
    pixels.update({(11, y): "o" for y in range(1, 5)})
    pixels.update({(10, 1): "o", (10, 5): "o"})
    return pixels


def write_core(directory: Path, name: str, pixels: dict[tuple[int, int], str]) -> Path:
    path = directory / name
    rows = rows_of(pixels)
    header = ["# type: unit", "# size: 12x12", "# light: upper-left", "# bg: transparent", "# map: o=outline b=cloak_dark_base h=hair_slate_base"]
    path.write_text("\n".join(header + rows) + "\n", encoding="utf-8")
    return path


class BodyCheckTest(unittest.TestCase):
    def test_whole_body_has_no_findings(self):
        rows = rows_of(whole_body())
        self.assertEqual(centre_failures(rows, BANDS), [])
        self.assertEqual(protrusions(rows, BANDS["trunk"]), [])
        self.assertEqual(holes(rows), [])

    def test_off_centre_trunk_is_reported(self):
        pixels = whole_body()
        for y in range(4, 8):
            pixels.pop((9, y))
        self.assertEqual(band_center(rows_of(pixels), BANDS["trunk"]), 5.0)
        self.assertEqual(len(centre_failures(rows_of(pixels), BANDS)), 1)

    def test_sleeve_stub_is_a_protrusion(self):
        pixels = whole_body()
        pixels[(10, 5)] = "b"
        pixels[(11, 5)] = "o"
        self.assertEqual(protrusions(rows_of(pixels), BANDS["trunk"]), [(10, 5), (11, 5)])

    def test_open_edge_is_reported_for_non_outline_pixel(self):
        pixels = whole_body()
        pixels[(9, 5)] = "b"
        pixels[(10, 5)] = "b"
        self.assertIn((10, 5), open_edges(rows_of(pixels), CHARMAP))

    def test_hole_inside_row_is_reported(self):
        pixels = whole_body()
        del pixels[(5, 5)]
        self.assertEqual(holes(rows_of(pixels)), [(5, 5)])

    def test_a_gap_open_to_the_outside_is_not_a_hole(self):
        # 耳と頭の間のすき間のように、外とつながる透明は穴でない（2026-10-16 依頼者。ガウの up (21,12)）
        pixels = whole_body()
        pixels[(11, 1)] = "o"
        self.assertEqual(holes(rows_of(pixels)), [])

    def test_hanging_hair_is_left_out_of_the_trunk(self):
        # 肩より下へ垂れた髪・かぶり物（芯に含めて組んだユニット）は、はみ出しと中心から外す（2026-10-16 依頼者。ガウの頭巾）
        pixels = whole_body() | hanging_hair()
        rows = rows_of(pixels)
        self.assertNotEqual(protrusions(rows, BANDS["trunk"]), [])
        kept = without(rows, hanging_pixels(rows, HAIR_MAP, {"h"}, BANDS["trunk"][0]))
        self.assertEqual(protrusions(kept, BANDS["trunk"]), [])
        self.assertEqual(centre_failures(kept, BANDS), [])

    def test_hair_that_stays_on_the_head_is_kept(self):
        # 頭の上だけの髪は外さない（外すと頭の中心がずれる。ロランの正面）
        pixels = whole_body()
        pixels[(3, 1)] = "h"
        rows = rows_of(pixels)
        self.assertEqual(hanging_pixels(rows, HAIR_MAP, {"h"}, BANDS["trunk"][0]), set())

    def test_main_can_skip_protrusions_and_drop_hanging_hair(self):
        pixels = whole_body()
        pixels[(10, 5)] = pixels[(11, 5)] = "o"  # 袖の名残（輪郭だけなので切れ目にはならない）
        with tempfile.TemporaryDirectory() as tmp:
            write_core(Path(tmp), "core_left_base.txt", pixels)
            args = [tmp, "--head", "0-3", "--trunk", "4-7", "--legs", "8-9"]
            out = io.StringIO()
            with contextlib.redirect_stdout(out):
                self.assertEqual(main(args), 1)
            self.assertIn("胴からはみ出した画素", out.getvalue())
            out = io.StringIO()
            with contextlib.redirect_stdout(out):  # 女性の体には「はみ出し」を掛けない（2026-10-17 依頼者）
                self.assertEqual(main(args + ["--no-protrusion"]), 0, out.getvalue())

    def test_main_reads_hanging_chars(self):
        pixels = whole_body() | hanging_hair()
        with tempfile.TemporaryDirectory() as tmp:
            write_core(Path(tmp), "core_down_base.txt", pixels)
            args = [tmp, "--head", "0-3", "--trunk", "4-7", "--legs", "8-9"]
            with contextlib.redirect_stdout(io.StringIO()):
                self.assertEqual(main(args), 1)
                self.assertEqual(main(args + ["--hanging", "h"]), 0)

    def test_main_exit_codes(self):
        with tempfile.TemporaryDirectory() as tmp:
            directory = Path(tmp)
            write_core(directory, "core_down_base.txt", whole_body())
            args = [str(directory), "--head", "0-3", "--trunk", "4-7", "--legs", "8-9"]
            with contextlib.redirect_stdout(io.StringIO()):
                self.assertEqual(main(args), 0)
            broken = whole_body()
            del broken[(5, 5)]
            write_core(directory, "core_down_idle2.txt", broken)
            out = io.StringIO()
            with contextlib.redirect_stdout(out):
                self.assertEqual(main(args), 1)
            self.assertIn("FAIL core_down_idle2", out.getvalue())

    def test_missing_target_is_an_error(self):
        with contextlib.redirect_stderr(io.StringIO()):
            self.assertEqual(main(["/nonexistent/path"]), 2)


if __name__ == "__main__":
    unittest.main()
