"""Checks for tools/grip_centre_check.py（拳が柄の真ん中を握っているかを、武器と拳の部品だけで見る。2026-11-07 依頼者）."""
from __future__ import annotations

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "tools"))
sys.path.insert(0, str(Path(__file__).resolve().parent))

from grip_centre_check import main  # noqa: E402
from unit_fixture import UnitFixture, box, mirror  # noqa: E402


def long_sword() -> dict:
    """刃 x22・y6〜12、柄 x22・y13〜22（拳の上下へ伸びる）。"""
    pixels = box(21, 5, 23, 23, "k")
    for y in range(6, 13):
        pixels[(22, y)] = "i"
    del pixels[(21, 5)], pixels[(23, 5)]
    return pixels


def hand(x0: int) -> dict:
    return box(x0, 15, x0 + 4, 18, "a")  # 手の肌は x0+1〜x0+3・y16〜17 の 3x2


class GripCentreCheckTest(unittest.TestCase):
    def setUp(self):
        self.fx = UnitFixture()
        self.addCleanup(self.fx.close)
        for name in self.fx.frames:
            sword, fist = long_sword(), hand(20)
            if name.startswith("up_"):
                sword, fist = mirror(sword), mirror(fist)
            self.fx.frames[name]["sword"] = sword
            self.fx.frames[name]["sword_hand"] = fist

    def test_a_centred_fist_passes(self):
        code, out = self.fx.run(main)
        self.assertEqual(code, 0, out)
        self.assertIn("拳が柄の真ん中: ok", out)

    def test_an_off_centre_fist_fails(self):
        self.fx.frames["down_base"]["sword_hand"] = hand(21)  # 肌 x22〜24、真ん中 x23、柄 x22
        code, out = self.fx.run(main)
        self.assertEqual(code, 1, out)
        self.assertIn("FAIL down_base: sword_hand: 拳が柄の真ん中に無い（左右に 1.0px ずれる。柄から離れている）", out)

    def test_the_body_hiding_the_fist_does_not_matter(self):
        # 体が拳の左を隠しても、部品の上で拳が柄の真ん中なら通す（組んだ絵の見えている所では測らない）
        self.fx.back = {"sword", "sword_hand"}
        for name in self.fx.frames:
            if name.startswith("down_"):
                self.fx.frames[name]["core"] = box(12, 5, 22, 30, "c")
        code, out = self.fx.run(main, )
        self.assertEqual(code, 0, out)

    def test_fists_without_a_weapon_are_not_checked(self):
        self.fx.checks["parts"]["sword"]["weapon"] = False
        del self.fx.checks["parts"]["sword"]["blade"]
        code, out = self.fx.run(main)
        self.assertEqual(code, 0, out)


if __name__ == "__main__":
    unittest.main()
