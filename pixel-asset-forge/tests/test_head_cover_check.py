"""Checks for tools/head_cover_check.py（被り物が頭を覆う高さで、髪が被り物の外に出ていない）."""
from __future__ import annotations

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "tools"))
sys.path.insert(0, str(Path(__file__).resolve().parent))

from head_cover_check import main  # noqa: E402
from unit_fixture import UnitFixture, box  # noqa: E402


def area(x0: int, y0: int, x1: int, y1: int, ch: str) -> dict[tuple[int, int], str]:
    return {(x, y): ch for y in range(y0, y1 + 1) for x in range(x0, x1 + 1)}


class HeadCoverCheckTest(unittest.TestCase):
    def setUp(self):
        self.fx = UnitFixture()
        self.addCleanup(self.fx.close)

    def add(self, key: str, pixels: dict, map_text: str):
        for layers in self.fx.frames.values():
            layers[key] = dict(pixels)
        self.fx.maps[key] = map_text
        self.fx.checks["parts"][key] = {"head": True}
        for d in ("down", "up"):
            self.fx.checks["orders"][d].append(key)

    def add_headgear(self):
        # 芯の頭（x=12〜19、y>=5）を、y=2〜8 で x=11〜20 の被り物が覆う。縁は y=8
        self.add("helm", box(11, 2, 20, 8, "h"), "o=contour h=helmet_steel_base")

    def test_hair_inside_the_headgear_and_wide_below_the_head_passes(self):
        hair = area(11, 3, 20, 14, "r")  # 頭の高さ（y<=14）は縁の幅（x=11〜20）の中
        hair.update(area(9, 15, 22, 18, "r"))  # 頭より下（肩）は広がってよい
        self.add("hair", hair, "r=hair_red_base")
        self.add_headgear()
        code, out = self.fx.run(main)
        self.assertEqual(code, 0, out)

    def test_hair_spreading_below_the_rim_within_the_head_fails(self):
        # 被り物の下から頭の高さで横へ広がる髪（背面で、被り物の下に髪が張り出して見えた。2026-11-04 依頼者）
        hair = area(11, 3, 20, 8, "r")
        hair.update(area(10, 9, 21, 14, "r"))
        self.add("hair", hair, "r=hair_red_base")
        self.add_headgear()
        code, out = self.fx.run(main)
        self.assertEqual(code, 1, out)
        self.assertIn("頭の高さ（y<=14）で、髪が被り物の外に出る 12 件", out)

    def test_hair_wider_than_the_headgear_above_the_rim_fails(self):
        self.add("hair", area(10, 3, 21, 12, "r"), "r=hair_red_base")
        self.add_headgear()
        code, out = self.fx.run(main)
        self.assertEqual(code, 1, out)
        self.assertIn("FAIL hair_down_base と helm_down_base: 頭の高さ（y<=14）で、髪が被り物の外に出る 20 件", out)

    def test_hair_above_the_top_of_the_headgear_fails(self):
        hair = area(14, 1, 17, 1, "r")  # 被り物の上端 y=2 より上
        hair.update(area(11, 3, 20, 8, "r"))
        self.add("hair", hair, "r=hair_red_base")
        self.add_headgear()
        code, out = self.fx.run(main)
        self.assertEqual(code, 1, out)
        self.assertIn("被り物の外に出る 4 件", out)

    def test_units_without_hair_and_headgear_pass(self):
        code, out = self.fx.run(main)
        self.assertEqual(code, 0, out)


if __name__ == "__main__":
    unittest.main()
