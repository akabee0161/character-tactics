"""Checks for tools/fist_check.py (81 拳の大きさと握り)."""
from __future__ import annotations

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "tools"))
sys.path.insert(0, str(Path(__file__).resolve().parent))

from fist_check import main  # noqa: E402
from unit_fixture import UnitFixture, box  # noqa: E402


class FistCheckTest(unittest.TestCase):
    def setUp(self):
        self.fx = UnitFixture()
        self.addCleanup(self.fx.close)

    def test_the_default_unit_passes(self):
        code, out = self.fx.run(main)
        self.assertEqual(code, 0, out)
        self.assertIn("拳の大きさと握り: ok", out)

    def test_a_fist_of_another_size_fails(self):
        self.fx.frames["down_base"]["sword_hand"] = box(20, 13, 23, 16, "a")  # 2x2
        code, out = self.fx.run(main)
        self.assertEqual(code, 1)
        self.assertIn("FAIL down_base: sword_hand の大きさ 2x2（3x2 のどれでもない）", out)

    def test_any_listed_size_passes(self):
        self.fx.frames["down_base"]["sword_hand"] = box(20, 13, 23, 16, "a")
        self.fx.checks["parts"]["sword_hand"]["fist_sizes"] = ["3x2", "2x2"]
        code, out = self.fx.run(main)
        self.assertEqual(code, 0, out)

    def test_a_fist_away_from_what_it_grips_fails(self):
        self.fx.frames["down_base"]["sword_hand"] = box(24, 20, 28, 23, "a")  # 剣（x=21〜23）から1列あく
        code, out = self.fx.run(main)
        self.assertEqual(code, 1)
        self.assertIn("FAIL down_base: sword_hand が sword に接していない", out)

    def test_a_diagonal_touch_is_a_touch(self):
        self.fx.frames["down_base"]["sword_hand"] = box(24, 17, 28, 20, "a")  # (24,17) が剣の角 (23,16) の斜め
        code, out = self.fx.run(main)
        self.assertEqual(code, 0, out)

    def test_an_empty_fist_without_the_gripped_layer_is_not_checked(self):
        # 体に隠れて何も描かない拳のコマで、握る部品の層ごと無くても落とさない（最終レビュー 2026-10-17）
        del self.fx.frames["down_atk_hit"]["sword"]
        self.fx.frames["down_atk_hit"]["sword_hand"] = {}
        code, out = self.fx.run(main)
        self.assertNotIn("down_atk_hit", out)

    def test_an_empty_part_is_not_checked(self):
        self.fx.frames["down_atk_hit"]["sword"] = {}
        self.fx.frames["down_atk_hit"]["sword_hand"] = {}
        code, out = self.fx.run(main)
        self.assertEqual(code, 0, out)


if __name__ == "__main__":
    unittest.main()
