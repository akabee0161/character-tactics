"""Checks for tools/tip_check.py (6 輪郭に囲まれた1画素)."""
from __future__ import annotations

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "tools"))
sys.path.insert(0, str(Path(__file__).resolve().parent))

from tip_check import main  # noqa: E402
from unit_fixture import UnitFixture  # noqa: E402


class TipCheckTest(unittest.TestCase):
    def setUp(self):
        self.fx = UnitFixture()
        self.addCleanup(self.fx.close)

    def test_the_default_unit_passes(self):
        code, out = self.fx.run(main)
        self.assertEqual(code, 0, out)

    def test_a_pixel_with_outline_on_all_four_sides_fails(self):
        # 盾の上に1画素の先端: (8,16) の上下左右を輪郭にする
        self.fx.frames["down_base"]["shield"].update(
            {(8, 16): "m", (8, 15): "o", (7, 16): "o", (9, 16): "o", (8, 17): "o"})
        code, out = self.fx.run(main)
        self.assertEqual(code, 1)
        self.assertIn("FAIL down_base: 輪郭に囲まれた1画素 1 件: (8,16)", out)

    def test_the_frame_edge_is_not_outline(self):
        self.fx.frames["down_base"]["shield"].update({(0, 16): "m", (0, 15): "o", (1, 16): "o", (0, 17): "o"})
        code, out = self.fx.run(main)
        self.assertEqual(code, 0, out)

    def test_it_looks_at_the_composed_frame(self):
        # 部品の上では3方向だけ輪郭でも、手前の部品の輪郭で4方向目がふさがれば落ちる
        self.fx.frames["down_base"]["shield"].update({(8, 16): "m", (8, 15): "o", (7, 16): "o", (8, 17): "o"})
        self.fx.frames["down_base"]["sword_hand"][(9, 16)] = "o"
        code, out = self.fx.run(main)
        self.assertEqual(code, 1)
        self.assertIn("(8,16)", out)


if __name__ == "__main__":
    unittest.main()
