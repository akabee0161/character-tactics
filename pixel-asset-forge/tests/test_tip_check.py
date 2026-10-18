"""Checks for tools/tip_check.py (6 刃・鏃の先端を輪郭に囲まれた1画素で描かない)."""
from __future__ import annotations

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "tools"))
sys.path.insert(0, str(Path(__file__).resolve().parent))

from tip_check import main  # noqa: E402
from unit_fixture import UnitFixture  # noqa: E402

# 刃の上の蓋（y=5）を外し、刃の先 (22,4) を1画素だけ出して上下左右を輪郭で囲む
TIP = {(21, 5): "o", (22, 5): "i", (23, 5): "o", (21, 4): "o", (22, 4): "i", (23, 4): "o", (22, 3): "o"}


class TipCheckTest(unittest.TestCase):
    def setUp(self):
        self.fx = UnitFixture()
        self.addCleanup(self.fx.close)

    def test_the_default_unit_passes(self):
        code, out = self.fx.run(main)
        self.assertEqual(code, 0, out)
        self.assertIn("1画素の先端: ok", out)

    def test_a_blade_pixel_with_outline_on_all_four_sides_fails(self):
        self.fx.frames["down_base"]["sword"].update(TIP | {(22, 5): "o"})
        code, out = self.fx.run(main)
        self.assertEqual(code, 1)
        self.assertIn("FAIL sword_down_base: sword の刃の先が輪郭に囲まれた1画素 1 件: (22,4)", out)

    def test_other_pixels_with_outline_on_all_four_sides_pass(self):
        # 盾（刃の文字でない）の1画素は見ない。鍔の端・斜めの矢・足先と同じ形（2026-10-16 依頼者）
        self.fx.frames["down_base"]["shield"].update(
            {(8, 16): "m", (8, 15): "o", (7, 16): "o", (9, 16): "o", (8, 17): "o"})
        code, out = self.fx.run(main)
        self.assertEqual(code, 0, out)

    def test_a_blade_of_a_part_that_is_not_a_weapon_is_checked(self):
        # 矢の鏃のように、weapon でない部品も blade を書けば見る
        self.fx.frames["down_base"]["sword"].update(TIP | {(22, 5): "o"})
        self.fx.checks["parts"]["sword"]["weapon"] = False
        code, out = self.fx.run(main)
        self.assertEqual(code, 1)
        self.assertIn("(22,4)", out)

    def test_a_blade_pixel_hidden_by_a_nearer_part_is_still_checked(self):
        # 部品ごとの形で判断する（2026-10-17 依頼者）。隠れていても、部品の先端が1画素なら落とす
        self.fx.frames["down_base"]["sword"].update(TIP | {(22, 5): "o"})
        self.fx.frames["down_base"]["shield"][(22, 4)] = "m"  # 手前の盾が刃の先を隠す
        code, out = self.fx.run(main)
        self.assertEqual(code, 1)
        self.assertIn("(22,4)", out)

    def test_a_tip_that_looks_one_pixel_only_because_it_is_hidden_passes(self):
        # 部品では2画素の先端が、手前の部品の輪郭に半分隠れて1画素に見えるのはよい
        # （イネスの up の待機2で、矢を引くと鏃の半分が弓に隠れる。2026-10-17 依頼者）
        self.fx.frames["down_base"]["sword"].update(TIP)
        self.fx.frames["down_base"]["shield"][(22, 5)] = "o"
        code, out = self.fx.run(main)
        self.assertEqual(code, 0, out)


if __name__ == "__main__":
    unittest.main()
