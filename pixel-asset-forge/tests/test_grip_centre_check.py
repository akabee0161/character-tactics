"""Checks for tools/grip_centre_check.py（拳が柄の真ん中を握っているかを、武器と拳の部品だけで見る。2026-11-07 依頼者）."""
from __future__ import annotations

import sys
import types
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "tools"))
sys.path.insert(0, str(Path(__file__).resolve().parent))

from grip_centre_check import grip_frame, main  # noqa: E402
from gridfile import parse  # noqa: E402
from unit_fixture import UnitFixture, box, mirror  # noqa: E402
from weapon_check import Analysis, grip_off_centre  # noqa: E402

BLADE = {"blade_hi"}
WEAPON = {"weapon_shaft_base"}
HAND = {"skin_fair_hi", "skin_fair_base"}


def composed_frame(path: Path) -> list[list[str | None]]:
    """組んだコマのグリッドを色名の行に（透明は None）。"""
    g = parse(path)
    return [[None if ch == "." else g.charmap[ch] for ch in row] for row in g.rows]


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

    def test_a_part_hiding_the_fist_does_not_matter(self):
        # 手前の盾が拳の右を隠すと、組んだコマで見える拳は柄の真ん中から外れて見える（weapon_check の計算で落ちる）。
        # 部品の上では拳が柄の真ん中なので、この道具は通す（組んだ絵の見えている所では測らない）
        for name in self.fx.frames:
            if name.startswith("down_"):
                self.fx.frames[name]["shield"] = box(22, 16, 23, 17, "m")  # 肌 x22〜23 を覆う。柄は拳の上下で見える
        code, out = self.fx.run(main)
        self.assertEqual(code, 0, out)
        composed = composed_frame(self.fx.root / "assets/unit/t/down_base.txt")
        a = Analysis(composed, BLADE, WEAPON, HAND)
        self.assertIn("拳が柄の真ん中に無い", grip_off_centre(a) or "")

    def test_fists_without_a_weapon_are_not_checked(self):
        self.fx.checks["parts"]["sword"]["weapon"] = False
        del self.fx.checks["parts"]["sword"]["blade"]
        code, out = self.fx.run(main)
        self.assertEqual(code, 0, out)


class GripFrameTest(unittest.TestCase):
    """grip_frame: 武器の部品の上に拳の部品を重ねる。keep の種類の上には拳の輪郭を描かない（compose の keep と同じ）。"""

    KINDS = {"weapon_shaft_base": "weapon", "blade_hi": "blade", "skin_fair_hi": "skin", "contour": "outline"}

    def frame(self, keep):
        weapon = StubPart({(2, y): "weapon_shaft_base" for y in range(5)} | {(2, 0): "blade_hi"})
        fist = StubPart({(1, 2): "contour", (2, 2): "contour", (3, 2): "skin_fair_hi"}, keep)
        return grip_frame(weapon, fist, 6, self.KINDS.__getitem__)

    def test_without_keep_the_fist_outline_covers_the_handle(self):
        f = self.frame(None)
        self.assertEqual((f[2][1], f[2][2], f[2][3]), ("contour", "contour", "skin_fair_hi"))

    def test_with_keep_the_handle_stays_under_the_fist_outline(self):
        f = self.frame(["weapon"])
        self.assertEqual((f[2][1], f[2][2], f[2][3]), ("contour", "weapon_shaft_base", "skin_fair_hi"))

    def test_keep_does_not_protect_other_kinds(self):
        f = self.frame(["blade"])
        self.assertEqual(f[2][2], "contour")


class StubPart:
    """grip_frame が読む所だけを持つ部品（pixels() と layer.keep）。"""

    def __init__(self, pixels, keep=None):
        self._pixels = pixels
        self.layer = types.SimpleNamespace(keep=keep)

    def pixels(self):
        return dict(self._pixels)


if __name__ == "__main__":
    unittest.main()
