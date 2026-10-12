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

from body_check import band_center, centre_failures, holes, main, open_edges, protrusions  # noqa: E402

BANDS = {"head": (0, 3), "trunk": (4, 7), "legs": (8, 9)}
CHARMAP = {"o": "outline", "b": "cloak_dark_base"}


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


def write_core(directory: Path, name: str, pixels: dict[tuple[int, int], str]) -> Path:
    path = directory / name
    rows = rows_of(pixels)
    header = ["# type: unit", "# size: 12x12", "# light: upper-left", "# bg: transparent", "# map: o=outline b=cloak_dark_base"]
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
