"""Checks for tools/height_check.py (5 背丈 24〜26px)."""
from __future__ import annotations

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "tools"))
sys.path.insert(0, str(Path(__file__).resolve().parent))

from height_check import main  # noqa: E402
from unit_fixture import UnitFixture, core, core48  # noqa: E402


class HeightCheckTest(unittest.TestCase):
    def setUp(self):
        self.fx = UnitFixture()
        self.addCleanup(self.fx.close)

    def test_24_to_26_pass(self):
        for top in (5, 6, 7):  # 26・25・24px
            with self.subTest(top=top):
                self.fx.frames["down_base"]["core"] = core(top)
                code, out = self.fx.run(main)
                self.assertEqual(code, 0, out)

    def test_27_and_23_fail(self):
        for top, height in ((4, 27), (8, 23)):
            with self.subTest(top=top):
                self.fx.frames["down_walk_a"]["core"] = core(top)
                code, out = self.fx.run(main)
                self.assertEqual(code, 1)
                self.assertIn(f"FAIL down_walk_a: 背丈 {height}px（芯の上端 y={top}。24〜26px にする）", out)


class HeightCheck48Test(unittest.TestCase):
    def setUp(self):
        self.fx = UnitFixture(size=48)
        self.addCleanup(self.fx.close)

    def test_48_36_to_39_pass(self):
        for top in (8, 9, 10, 11):  # 39・38・37・36px
            with self.subTest(top=top):
                self.fx.frames["down_base"]["core"] = core48(top)
                code, out = self.fx.run(main)
                self.assertEqual(code, 0, out)

    def test_48_40_and_35_fail(self):
        for top, height in ((7, 40), (12, 35)):
            with self.subTest(top=top):
                self.fx.frames["down_walk_a"]["core"] = core48(top)
                code, out = self.fx.run(main)
                self.assertEqual(code, 1)
                self.assertIn(f"FAIL down_walk_a: 背丈 {height}px（芯の上端 y={top}。36〜39px にする）", out)


if __name__ == "__main__":
    unittest.main()
