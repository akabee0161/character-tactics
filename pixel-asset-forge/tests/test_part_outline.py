"""Checks for tools/part_outline.py (33 拳以外の部品が輪郭で閉じている)."""
from __future__ import annotations

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "tools"))
sys.path.insert(0, str(Path(__file__).resolve().parent))

from part_outline import main  # noqa: E402
from unit_fixture import UnitFixture  # noqa: E402


class PartOutlineTest(unittest.TestCase):
    def setUp(self):
        self.fx = UnitFixture()
        self.addCleanup(self.fx.close)

    def test_closed_parts_pass(self):
        code, out = self.fx.run(main)
        self.assertEqual(code, 0, out)

    def test_an_open_pixel_fails_once_per_file(self):
        del self.fx.frames["down_base"]["shield"][(7, 20)]  # 盾の左の輪郭に穴: (8,20) が透明に接する
        code, out = self.fx.run(main)
        self.assertEqual(code, 1)
        self.assertIn("FAIL shield_down_base: 輪郭で閉じていない画素 1 件: (8,20)", out)
        self.assertEqual(out.count("FAIL"), 1)

    def test_the_frame_edge_counts_as_open(self):
        self.fx.frames["down_base"]["shield"][(0, 5)] = "m"
        code, out = self.fx.run(main)
        self.assertEqual(code, 1)
        self.assertIn("(0,5)", out)

    def test_open_chars_are_not_checked(self):
        del self.fx.frames["down_base"]["sword"][(23, 8)]  # 刃の右の輪郭を外す
        self.fx.checks["parts"]["sword"]["open_chars"] = "i"
        code, out = self.fx.run(main)
        self.assertEqual(code, 0, out)

    def test_fists_are_left_to_compose(self):
        self.fx.checks["parts"]["sword_hand"]["fist"] = True
        self.fx.frames["down_base"]["sword_hand"][(30, 30)] = "o"  # 拳は見ない（compose.py が見る）
        code, out = self.fx.run(main)
        self.assertEqual(code, 0, out)


if __name__ == "__main__":
    unittest.main()
