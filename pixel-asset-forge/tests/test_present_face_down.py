"""Checks for tools/present.py and tools/face_down.py."""
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

from face_down import CHARS, cluster, downsample  # noqa: E402
from face_down import main as face_down_main  # noqa: E402
from present import LABEL, PAD, build_sheet  # noqa: E402
from present import main as present_main  # noqa: E402

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


class FaceDownShapeTest(unittest.TestCase):
    def test_a_wide_image_keeps_every_row(self):
        cells = [[RED, BLUE, RED], [BLUE, RED, BLUE]]  # 3升 × 2升
        img = Image.new("RGBA", (12, 8))
        for y in range(8):
            for x in range(12):
                img.putpixel((x, y), cells[y // 4][x // 4])
        small = downsample(img, 3)
        self.assertEqual(small.size, (3, 2))
        self.assertEqual(small.getpixel((0, 1)), BLUE)

    def test_a_tall_image_reads_to_the_bottom(self):
        cells = [[RED, BLUE], [BLUE, RED], [RED, RED]]  # 2升 × 3升
        img = Image.new("RGBA", (8, 12))
        for y in range(12):
            for x in range(8):
                img.putpixel((x, y), cells[y // 4][x // 4])
        small = downsample(img, 2)
        self.assertEqual(small.size, (2, 3))
        self.assertEqual([small.getpixel((x, 2)) for x in range(2)], [RED, RED])


def run(main, argv: list[str]) -> tuple[int, str]:
    err = io.StringIO()
    with contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(err):
        code = main(argv)
    return code, err.getvalue()


class MainErrorsTest(unittest.TestCase):
    def test_face_down_reports_too_many_colours(self):
        n = len(CHARS) + 1
        img = Image.new("RGBA", (n, 1))
        for x in range(n):
            # どの2色も、R か G のどちらかが 20 以上違う（cluster は各成分の差 14 以下をまとめる）
            img.putpixel((x, 0), (x % 13 * 20, x // 13 * 20, 0, 255))
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "many.png"
            img.save(path)
            code, err = run(face_down_main, [str(path), str(n), str(Path(tmp) / "out")])
        self.assertEqual(code, 2)
        self.assertIn("色が", err)

    def test_present_rejects_a_scale_below_one(self):
        with tempfile.TemporaryDirectory() as tmp:
            code, err = run(present_main, [str(Path(tmp) / "o.png"), "x.txt", "--scale", "0"])
        self.assertEqual(code, 2)
        self.assertIn("--scale", err)


if __name__ == "__main__":
    unittest.main()
