"""Checks for tools/blade_height.py (2 切っ先の高さ)."""
from __future__ import annotations

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "tools"))
sys.path.insert(0, str(Path(__file__).resolve().parent))

from blade_height import main  # noqa: E402
from unit_fixture import UnitFixture, mirror, sword  # noqa: E402


class BladeHeightTest(unittest.TestCase):
    def setUp(self):
        self.fx = UnitFixture()
        self.addCleanup(self.fx.close)

    def test_blade_at_y5_and_idle2_at_y3_pass(self):
        self.fx.frames["down_base"]["sword"] = sword(-1)   # 刃の上端 y=5（その上の輪郭 y=4 は刃でない）
        self.fx.frames["down_idle2"]["sword"] = sword(-3)  # 刃の上端 y=3
        code, out = self.fx.run(main)
        self.assertEqual(code, 0, out)
        self.assertIn("切っ先の高さ: ok", out)

    def test_blade_above_y5_fails(self):
        self.fx.frames["down_base"]["sword"] = sword(-2)  # 刃の上端 y=4
        code, out = self.fx.run(main)
        self.assertEqual(code, 1)
        self.assertIn("FAIL down_base: sword の切っ先が y=4（y=5 より上に出さない）", out)

    def test_idle2_above_y3_fails(self):
        self.fx.frames["up_idle2"]["sword"] = mirror(sword(-4))  # 刃の上端 y=2
        code, out = self.fx.run(main)
        self.assertEqual(code, 1)
        self.assertIn("FAIL up_idle2: sword の切っ先が y=2（y=3 より上に出さない）", out)

    def test_attack_frames_are_not_checked(self):
        self.fx.frames["down_atk_hit"]["sword"] = sword(-5)  # 刃の上端 y=1
        code, out = self.fx.run(main)
        self.assertEqual(code, 0, out)


if __name__ == "__main__":
    unittest.main()
