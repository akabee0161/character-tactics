"""Checks for tools/eye_check.py (12 目)."""
from __future__ import annotations

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "tools"))
sys.path.insert(0, str(Path(__file__).resolve().parent))

from eye_check import main  # noqa: E402
from unit_fixture import UnitFixture  # noqa: E402


def face(core: dict, eyes: list[int], top: int = 10) -> dict:
    """芯の y=top〜top+1 の x=13〜18 を顔の肌 b にし、eyes の列に目（輪郭）を2行描く。
    顔の左右（x=12・19）は髪の代わりに服の色 c にする（顔の縁の輪郭を目とみなさないように）。"""
    for y in (top, top + 1):
        core[(12, y)] = core[(19, y)] = "c"
        for x in range(13, 19):
            core[(x, y)] = "o" if x in eyes else "b"
    return core


class EyeCheckTest(unittest.TestCase):
    def setUp(self):
        self.fx = UnitFixture()
        self.addCleanup(self.fx.close)
        self.fx.checks["colours"]["face"] = ["skin_base"]
        self.fx.checks["eyes"]["down"] = [10, 11]
        for name, layers in self.fx.frames.items():
            if name.startswith("down_"):
                face(layers["core"], [14, 17])

    def test_eyes_between_face_skin_pass(self):
        code, out = self.fx.run(main)
        self.assertEqual(code, 0, out)
        self.assertIn("目: ok", out)

    def test_an_eye_touching_something_else_fails(self):
        self.fx.frames["down_base"]["core"][(18, 10)] = "c"  # 右目の右が服
        code, out = self.fx.run(main)
        self.assertEqual(code, 1)
        self.assertIn("FAIL down_base: 目の左右の片方が顔の肌でない 1 件: (17,10)", out)

    def test_no_eye_in_a_direction_with_eyes_fails(self):
        face(self.fx.frames["down_idle2"]["core"], [])
        code, out = self.fx.run(main)
        self.assertEqual(code, 1)
        self.assertIn("FAIL down_idle2: 目が見つからない（y=10〜11）", out)

    def test_eye_top_rows_must_match_across_directions(self):
        self.fx.checks["eyes"]["up"] = [10, 12]
        for name, layers in self.fx.frames.items():
            if name.startswith("up_"):
                face(layers["core"], [14, 17], top=11)
        code, out = self.fx.run(main)
        self.assertEqual(code, 1)
        self.assertIn("FAIL base: 目の上端の行が向きでそろわない: down=10 up=11", out)

    def test_directions_without_eyes_are_skipped(self):
        self.fx.checks["eyes"]["down"] = None
        self.fx.frames["down_base"]["core"][(18, 10)] = "c"
        code, out = self.fx.run(main)
        self.assertEqual(code, 0, out)


if __name__ == "__main__":
    unittest.main()
