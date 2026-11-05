"""Checks for tools/far_fist_check.py（体の奥で武器・盾を握る拳は、影の肌の色だけで描く）."""
from __future__ import annotations

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "tools"))
sys.path.insert(0, str(Path(__file__).resolve().parent))

from far_fist_check import main  # noqa: E402
from unit_fixture import UnitFixture  # noqa: E402


class FarFistCheckTest(unittest.TestCase):
    def setUp(self):
        self.fx = UnitFixture()
        self.addCleanup(self.fx.close)

    def test_fists_in_front_of_the_body_pass(self):
        code, out = self.fx.run(main)
        self.assertEqual(code, 0, out)

    def test_bright_fist_behind_the_body_fails(self):
        self.fx.back.add("sword_hand")  # 剣の拳を芯の奥に置く（明るい肌 skin_fair_hi のまま）
        code, out = self.fx.run(main)
        self.assertEqual(code, 1, out)
        self.assertIn("FAIL sword_hand_down_base: 体の奥の拳に明るい肌の色 skin_fair_hi", out)

    def test_shadow_fist_behind_the_body_passes(self):
        self.fx.back.add("sword_hand")
        self.fx.maps["sword_hand"] = "o=contour a=skin_fair_shadow"
        code, out = self.fx.run(main)
        self.assertEqual(code, 0, out)

    def test_back_view_is_not_checked(self):
        # 背面は拳がみな体の向こう。奥の手の色の決まりは横向きなどの奥の手のもの
        self.fx.back.add("sword_hand")
        code, out = self.fx.run(main)
        self.assertNotIn("sword_hand_up", out)


if __name__ == "__main__":
    unittest.main()
