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
        self.assertEqual(large.getpixel((3, 0)), (0, 0, 0))
        self.assertEqual(large.getpixel((4, 0)), (255, 255, 255))
        self.assertEqual(large.getpixel((7, 3)), (255, 255, 255))

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
