"""Checks for tools/eye_check.py (12 目)."""
from __future__ import annotations

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "tools"))
sys.path.insert(0, str(Path(__file__).resolve().parent))

from eye_check import main  # noqa: E402
from unit_fixture import UnitFixture  # noqa: E402

CORE_MAP = "o=outline b=skin_base c=cloak_dark_base u=pupil"


def face(core: dict, eyes: list[int], top: int = 10) -> dict:
    """芯の y=top〜top+1 の x=13〜18 を顔の肌 b にし、eyes の列に目（輪郭）を2行描く。"""
    for y in (top, top + 1):
        for x in range(13, 19):
            core[(x, y)] = "o" if x in eyes else "b"
    return core


class EyeCheckTest(unittest.TestCase):
    def setUp(self):
        self.fx = UnitFixture()
        self.addCleanup(self.fx.close)
        self.fx.maps["core"] = CORE_MAP
        self.fx.checks["eyes"]["down"] = {"x": [14, 17], "y": [10, 11]}
        for name, layers in self.fx.frames.items():
            if name.startswith("down_"):
                face(layers["core"], [14, 17])

    def test_eyes_beside_tellable_colours_pass(self):
        code, out = self.fx.run(main)
        self.assertEqual(code, 0, out)
        self.assertIn("目: ok", out)

    def test_dark_hair_beside_the_eye_passes_when_it_can_be_told_apart(self):
        # 髪・かぶり物でも、輪郭と見分けられる色なら目は読める（2026-10-16 依頼者。ロランの目の横の髪）
        self.fx.frames["down_base"]["core"][(18, 10)] = "c"
        code, out = self.fx.run(main)
        self.assertEqual(code, 0, out)

    def test_an_eye_beside_the_outline_colour_fails(self):
        self.fx.frames["down_base"]["core"][(18, 10)] = "o"
        code, out = self.fx.run(main)
        self.assertEqual(code, 1)
        self.assertIn("FAIL down_base: 目の左右の隣が目と見分けられない色 1 件: (18,10)", out)

    def test_a_colour_as_dark_as_the_outline_fails(self):
        self.fx.frames["down_base"]["core"][(13, 11)] = "u"  # pupil は outline と同じ #1a1228
        code, out = self.fx.run(main)
        self.assertEqual(code, 1)
        self.assertIn("(13,11)", out)

    def test_outline_above_and_below_the_eye_is_fine(self):
        # 真上が前髪や頭巾の縁の輪郭なのはよい（SPEC「自己チェック」②）
        self.fx.frames["down_base"]["core"].update({(14, 9): "o", (17, 12): "o"})
        code, out = self.fx.run(main)
        self.assertEqual(code, 0, out)

    def test_an_eye_pixel_that_is_not_outline_fails(self):
        face(self.fx.frames["down_idle2"]["core"], [14])  # 右の目が無い（設定の目の位置と絵が合わない）
        code, out = self.fx.run(main)
        self.assertEqual(code, 1)
        self.assertIn("FAIL down_idle2: 目の画素が輪郭の色でない 2 件: (17,10) (17,11)", out)

    def test_eye_top_rows_must_match_across_directions(self):
        self.fx.checks["eyes"]["up"] = {"x": [14, 17], "y": [11, 12]}
        for name, layers in self.fx.frames.items():
            if name.startswith("up_"):
                face(layers["core"], [14, 17], top=11)
        code, out = self.fx.run(main)
        self.assertEqual(code, 1)
        self.assertIn("FAIL base: 目の上端の行が向きでそろわない: down=10 up=11", out)

    def test_directions_without_eyes_are_skipped(self):
        self.fx.checks["eyes"]["down"] = None
        self.fx.frames["down_base"]["core"][(18, 10)] = "o"
        code, out = self.fx.run(main)
        self.assertEqual(code, 0, out)


if __name__ == "__main__":
    unittest.main()
