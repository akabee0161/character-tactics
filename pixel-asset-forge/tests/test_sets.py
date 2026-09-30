"""Checks for the set tool.

    .venv/bin/python -m unittest discover -s tests
"""
from __future__ import annotations

import sys
import tempfile
import unittest
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT / "tools"))

from PIL import Image  # noqa: E402

import sets  # noqa: E402
from gridfile import GridError, load_palette  # noqa: E402

FIXTURES = REPO_ROOT / "tests" / "fixtures"
A, B = "set_part_a", "set_part_b"


class AssembleTest(unittest.TestCase):
    def setUp(self):
        self.palette = load_palette()

    def test_two_by_two_parts_make_one_32px_image(self):
        image = sets.assemble([[A, B], [B, A]], self.palette, FIXTURES)
        self.assertEqual(image.size, (32, 32))
        self.assertEqual(image.getpixel((0, 0))[:3], self.palette["grass_base"])
        self.assertEqual(image.getpixel((17, 1))[:3], self.palette["outline"])
        self.assertEqual(image.getpixel((1, 17))[:3], self.palette["outline"])
        self.assertEqual(image.getpixel((31, 31))[:3], self.palette["grass_base"])

    def test_every_pixel_is_opaque(self):
        image = sets.assemble([[A, B], [B, A]], self.palette, FIXTURES)
        self.assertEqual(image.getchannel("A").getextrema(), (255, 255))

    def test_other_shapes_are_allowed(self):
        image = sets.assemble([[A, B, A], [B, A, B]], self.palette, FIXTURES)
        self.assertEqual(image.size, (48, 32))

    def test_a_derived_part_assembles_like_any_other(self):
        image = sets.assemble([["set_part_b_mirror"]], self.palette, FIXTURES)
        self.assertEqual(image.size, (16, 16))
        self.assertEqual(image.getpixel((15, 0))[:3], self.palette["grass_base"])

    def test_an_empty_cell_is_rejected(self):
        with self.assertRaisesRegex(GridError, r"row 0 column 1 is '\.'"):
            sets.assemble([[A, None], [A, A]], self.palette, FIXTURES)

    def test_a_missing_part_is_named(self):
        with self.assertRaisesRegex(GridError, "set_part_nope"):
            sets.assemble([[A, "set_part_nope"]], self.palette, FIXTURES)

    def test_a_part_that_is_not_16px_is_rejected(self):
        with self.assertRaisesRegex(GridError, "set_part_small.*8x8"):
            sets.assemble([[A, "set_part_small"]], self.palette, FIXTURES)

    def test_a_part_that_fails_validation_is_rejected(self):
        with self.assertRaisesRegex(GridError, "set_part_broken"):
            sets.assemble([[A, "set_part_broken"]], self.palette, FIXTURES)

    def test_a_background_cell_in_a_part_is_rejected(self):
        # validate.py accepts '.', but in a set it would be a transparent hole in the ground
        with self.assertRaisesRegex(GridError, r"set_part_hole.*row 3 column 5 is '\.'"):
            sets.assemble([[A, "set_part_hole"]], self.palette, FIXTURES)


class MainTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.dir = Path(self.tmp.name)

    def tearDown(self):
        self.tmp.cleanup()

    def definition(self, name: str, text: str) -> Path:
        path = self.dir / f"{name}.txt"
        path.write_text(text, encoding="utf-8")
        return path

    def run_main(self, *definitions: Path) -> int:
        out = self.dir / "out"
        return sets.main([*map(str, definitions), "-o", str(out), "--tiledir", str(FIXTURES)])

    def test_writes_the_image_and_the_review_copy(self):
        good = self.definition("thing", f"# a set\n{A} {B}\n{B} {A}\n")
        self.assertEqual(self.run_main(good), 0)
        self.assertEqual(Image.open(self.dir / "out" / "thing.png").size, (32, 32))
        self.assertEqual(Image.open(self.dir / "out" / "thing_x8.png").size, (256, 256))

    def test_a_bad_definition_fails_the_run_but_the_others_are_written(self):
        bad = self.definition("bad", f"{A} .\n{A} {A}\n")
        good = self.definition("good", f"{A} {A}\n{A} {A}\n")
        self.assertEqual(self.run_main(bad, good), 1)
        self.assertFalse((self.dir / "out" / "bad.png").exists())
        self.assertTrue((self.dir / "out" / "good.png").exists())

    def test_a_definition_with_uneven_rows_does_not_stop_the_others(self):
        uneven = self.definition("uneven", f"{A}\n{A} {A}\n")
        good = self.definition("good", f"{A} {A}\n{A} {A}\n")
        self.assertEqual(self.run_main(uneven, good), 1)
        self.assertTrue((self.dir / "out" / "good.png").exists())

    def test_a_missing_definition_does_not_stop_the_others(self):
        good = self.definition("good", f"{A} {A}\n{A} {A}\n")
        self.assertEqual(self.run_main(self.dir / "nope.txt", good), 1)
        self.assertTrue((self.dir / "out" / "good.png").exists())


if __name__ == "__main__":
    unittest.main()
