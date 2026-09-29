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

from PIL import Image

import sheet  # noqa: E402

from gridfile import GridError, load_palette  # noqa: E402

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
