"""Checks for the tile layout tool.

    .venv/bin/python -m unittest discover -s tests
"""
from __future__ import annotations

import sys
import tempfile
import unittest
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT / "tools"))

import tilemap  # noqa: E402
from gridfile import GridError, load_palette  # noqa: E402


def write_layout(text: str) -> Path:
    handle = tempfile.NamedTemporaryFile("w", suffix=".txt", delete=False, encoding="utf-8")
    handle.write(text)
    handle.close()
    return Path(handle.name)


class LayoutTest(unittest.TestCase):
    def test_names_become_a_grid(self):
        layout = tilemap.read_layout(write_layout("plain plain\nplain plain\n"))
        self.assertEqual(layout, [["plain", "plain"], ["plain", "plain"]])

    def test_dot_is_an_empty_cell(self):
        layout = tilemap.read_layout(write_layout("plain .\n. plain\n"))
        self.assertEqual(layout, [["plain", None], [None, "plain"]])

    def test_comments_and_blank_lines_are_skipped(self):
        layout = tilemap.read_layout(write_layout("# a map\n\nplain plain\n\n# end\n"))
        self.assertEqual(layout, [["plain", "plain"]])

    def test_ragged_rows_are_rejected(self):
        with self.assertRaises(SystemExit):
            tilemap.read_layout(write_layout("plain plain\nplain\n"))

    def test_an_empty_file_is_rejected(self):
        with self.assertRaises(SystemExit):
            tilemap.read_layout(write_layout("# nothing here\n"))

    def test_the_shipped_example_parses(self):
        layout = tilemap.read_layout(REPO_ROOT / "layouts" / "example.txt")
        self.assertEqual(len(layout), 6)
        self.assertTrue(all(len(row) == 8 for row in layout))


class ComposeTest(unittest.TestCase):
    def setUp(self):
        self.palette = load_palette()

    def test_size_is_tiles_times_grid_times_scale(self):
        sheet = tilemap.compose([["plain"] * 3] * 2, self.palette, scale=4)
        self.assertEqual(sheet.size, (3 * 16 * 4, 2 * 16 * 4))

    def test_empty_cells_stay_transparent(self):
        sheet = tilemap.compose([["plain", None]], self.palette, scale=1)
        self.assertEqual(sheet.size, (32, 16))
        self.assertEqual(sheet.getpixel((24, 8))[3], 0)
        self.assertNotEqual(sheet.getpixel((8, 8))[3], 0)

    def test_a_derived_tile_composes_like_any_other(self):
        sheet = tilemap.compose([["river_nw"]], self.palette, scale=1)
        self.assertEqual(sheet.size, (16, 16))

    def test_an_empty_layout_is_rejected(self):
        with self.assertRaises(GridError):
            tilemap.compose([[None, None]], self.palette, scale=1)


class SeamFixtureTest(unittest.TestCase):
    """The bug that motivated this tool. It is here so the fixture cannot be
    deleted by accident, and to pin the fact that the cheap checks miss it."""

    FIXTURE = REPO_ROOT / "tests" / "fixtures" / "river_v_seam_bug.txt"
    FIXED = REPO_ROOT / "tests" / "fixtures" / "river_v_first_version.txt"

    def test_the_broken_tile_still_passes_the_cheap_checks(self):
        from check_colors import inspect
        from gridfile import check, parse

        palette = load_palette()
        grid = parse(self.FIXTURE)
        self.assertEqual(check(grid, palette), [])
        self.assertEqual(inspect(grid, palette), ([], []))

    def test_it_differs_from_the_fixed_tile_only_at_the_edges(self):
        """Both sides are fixtures on purpose.

        This used to compare the broken tile against the live assets/tile/river_v.txt.
        That tile was redrawn when the grassland set gave the river a two-pixel dirt
        bank, and every row started differing - which said nothing about the seam bug.
        """
        from gridfile import parse

        broken = parse(self.FIXTURE).rows
        fixed = parse(self.FIXED).rows
        differing = [y for y, (a, b) in enumerate(zip(broken, fixed)) if a != b]
        self.assertEqual(differing, [0, 15])


if __name__ == "__main__":
    unittest.main()
