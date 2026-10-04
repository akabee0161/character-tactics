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
