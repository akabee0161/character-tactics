"""Checks for tools/part_chars.py (9 部品の文字が芯と重ならない)."""
from __future__ import annotations

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "tools"))
sys.path.insert(0, str(Path(__file__).resolve().parent))

from part_chars import main  # noqa: E402
from unit_fixture import UnitFixture  # noqa: E402


class PartCharsTest(unittest.TestCase):
    def setUp(self):
        self.fx = UnitFixture()
        self.addCleanup(self.fx.close)

    def test_the_default_unit_passes(self):
        code, out = self.fx.run(main)
        self.assertEqual(code, 0, out)

    def test_a_part_using_a_core_char_fails(self):
        # 芯のベルトと剣の柄が同じ文字 k（同じ wood_base）。ロランの鍔とベルトの H・J と同じ形
        self.fx.maps["core"] = "o=outline b=skin_base c=cloak_dark_base k=wood_base"
        for layers in self.fx.frames.values():
            layers["core"][(13, 24)] = "k"
        code, out = self.fx.run(main)
        self.assertEqual(code, 1)
        self.assertIn("FAIL down_base: sword が芯と同じ文字 k を使う", out)
        self.assertEqual(out.count("FAIL"), 8)

    def test_the_fist_skin_may_share_the_core_char(self):
        # 拳の手の肌（hand_colours）は芯の肌と同じ文字でよい
        self.fx.maps["core"] = "o=outline b=skin_base c=cloak_dark_base a=skin_hi"
        self.fx.frames["down_base"]["core"][(13, 20)] = "a"
        code, out = self.fx.run(main)
        self.assertEqual(code, 0, out)

    def test_the_fist_with_a_non_skin_core_char_fails(self):
        self.fx.maps["sword_hand"] = "o=outline a=skin_hi c=cloak_dark_base"
        self.fx.frames["down_base"]["sword_hand"][(26, 14)] = "c"  # 拳の外の袖の名残
        code, out = self.fx.run(main)
        self.assertEqual(code, 1)
        self.assertIn("FAIL down_base: sword_hand が芯と同じ文字 c を使う", out)


if __name__ == "__main__":
    unittest.main()
