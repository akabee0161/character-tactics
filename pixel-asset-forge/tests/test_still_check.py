"""Checks for tools/still_check.py (3 待機・歩きで動かない所、4 盾)."""
from __future__ import annotations

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "tools"))
sys.path.insert(0, str(Path(__file__).resolve().parent))

from still_check import main  # noqa: E402
from unit_fixture import UnitFixture, box, shield, sword_hand  # noqa: E402


class StillCheckTest(unittest.TestCase):
    def setUp(self):
        self.fx = UnitFixture()
        self.addCleanup(self.fx.close)

    def test_the_default_unit_passes(self):
        code, out = self.fx.run(main)
        self.assertEqual(code, 0, out)
        self.assertIn("動かない所: ok", out)

    def test_idle2_core_change_fails(self):
        self.fx.frames["down_idle2"]["core"][(15, 10)] = "b"
        code, out = self.fx.run(main)
        self.assertEqual(code, 1)
        self.assertIn("FAIL down_idle2: 芯が base と違う画素 1 件: (15,10)", out)

    def test_idle2_may_fill_where_the_base_fist_skin_was(self):
        # base の拳の手の肌（x=21〜23, y=14〜15）の位置は、拳がどいた胴を埋めてよい
        self.fx.frames["down_idle2"]["core"][(21, 14)] = "c"
        code, out = self.fx.run(main)
        self.assertEqual(code, 0, out)

    def test_idle2_part_that_does_not_move_fails(self):
        self.fx.checks["parts"]["sword_hand"]["moves"] = False
        code, out = self.fx.run(main)
        self.assertEqual(code, 1)
        self.assertIn("FAIL down_idle2: sword_hand が base と違う（このコマでは動かさない部品）", out)

    def test_walk_upper_body_change_fails_but_legs_pass(self):
        self.fx.frames["down_walk_a"]["core"][(13, 26)] = "b"
        code, out = self.fx.run(main)
        self.assertEqual(code, 1)
        self.assertIn("FAIL down_walk_a: 芯の y<27 が base と違う画素 1 件: (13,26)", out)
        self.assertNotIn("(13,29)", out)  # 既定の脚の動き

    def test_walk_may_change_y27_for_the_outline_over_a_raised_foot(self):
        # 細い脚で足を上げると、脚の幅からはみ出した足の上を閉じる輪郭が y=27 に来る（イネス。2026-10-17 依頼者）
        self.fx.frames["down_walk_a"]["core"][(13, 27)] = "b"
        code, out = self.fx.run(main)
        self.assertEqual(code, 0, out)

    def test_walk_part_change_fails(self):
        self.fx.frames["down_walk_a"]["sword_hand"] = sword_hand(-1)
        code, out = self.fx.run(main)
        self.assertEqual(code, 1)
        self.assertIn("FAIL down_walk_a: sword_hand が base と違う（このコマでは動かさない部品）", out)

    def test_fixed_part_moved_in_an_attack_fails(self):
        self.fx.frames["down_atk_hit"]["shield"] = box(7, 17, 10, 22, "m")
        code, out = self.fx.run(main)
        self.assertEqual(code, 1)
        self.assertIn("FAIL down_atk_hit: shield が base と違う（どのコマでも動かさない部品）", out)

    def test_attack_parts_that_are_not_fixed_may_move(self):
        self.fx.frames["down_atk_hit"]["shield"] = box(7, 17, 10, 22, "m")
        self.fx.checks["parts"]["shield"] = {}
        code, out = self.fx.run(main)
        self.assertEqual(code, 0, out)

    def test_a_direction_without_base_fails(self):
        for name in ("up_base", "up_idle2", "up_walk_a"):
            del self.fx.frames[name]
        self.fx.frames["up_atk_hit"]["shield"] = shield()
        code, out = self.fx.run(main)
        self.assertEqual(code, 1)
        self.assertIn("FAIL up_atk_hit: 比べる up_base が無い", out)


if __name__ == "__main__":
    unittest.main()
