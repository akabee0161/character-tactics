"""Checks for tools/unit_config.py (ユニットの確認の設定ファイル checks/<ユニット>.json)."""
from __future__ import annotations

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "tools"))
sys.path.insert(0, str(Path(__file__).resolve().parent))

from unit_config import UnitConfigError, load_unit_config, run_check  # noqa: E402
from unit_fixture import UnitFixture  # noqa: E402


class LoadTest(unittest.TestCase):
    def setUp(self):
        self.fx = UnitFixture()
        self.addCleanup(self.fx.close)

    def load(self):
        return load_unit_config(self.fx.write(build=False), self.fx.root)

    def assertConfigError(self, text: str):
        with self.assertRaises(UnitConfigError) as caught:
            self.load()
        self.assertIn(text, str(caught.exception))

    def test_the_default_unit_loads_frames_parts_and_orders(self):
        cfg = self.load()
        self.assertEqual(sorted(cfg.frames), ["down_atk_hit", "down_base", "down_idle2", "down_walk_a",
                                              "up_atk_hit", "up_base", "up_idle2", "up_walk_a"])
        frame = cfg.frames["down_idle2"]
        self.assertEqual((frame.direction, frame.state), ("down", "idle2"))
        self.assertEqual(list(frame.parts), ["sword", "sword_hand", "shield"])
        self.assertEqual(cfg.hand, frozenset({"skin_hi"}))  # compose の hand_colours
        self.assertEqual(cfg.unit_dir, self.fx.root / "assets" / "unit" / "t")

    def test_the_stack_order_names_parts_by_the_file_name_before_the_direction(self):
        cfg = self.load()
        self.assertEqual(cfg.frames["down_base"].order, ["CORE", "sword", "sword_hand", "shield"])

    def test_unknown_top_level_key(self):
        self.fx.checks["colour"] = {}
        self.assertConfigError("知らないキー colour")

    def test_missing_top_level_key(self):
        del self.fx.checks["eyes"]
        self.assertConfigError("キーが無い eyes")

    def test_unit_must_match_compose(self):
        self.fx.checks["unit"] = "u"
        self.assertConfigError("'u'")

    def test_unknown_part(self):
        self.fx.checks["parts"]["spear"] = {}
        self.assertConfigError("知らないキー spear")

    def test_a_part_in_compose_must_be_listed(self):
        del self.fx.checks["parts"]["shield"]
        self.assertConfigError("shield が無い")

    def test_unknown_role_key(self):
        self.fx.checks["parts"]["shield"] = {"fixd": True}
        self.assertConfigError("知らないキー fixd")

    def test_blade_char_not_in_the_part_files(self):
        self.fx.checks["parts"]["sword"]["blade"] = "iz"
        self.assertConfigError("部品のファイルに無い文字 z")

    def test_weapon_needs_a_blade(self):
        del self.fx.checks["parts"]["sword"]["blade"]
        self.assertConfigError("blade")

    def test_grips_must_name_a_part(self):
        self.fx.checks["parts"]["sword_hand"]["grips"] = "spear"
        self.assertConfigError("無い部品 'spear'")

    def test_fist_size_must_look_like_3x2(self):
        self.fx.checks["parts"]["sword_hand"]["fist_sizes"] = ["3*2"]
        self.assertConfigError("3x2 の形でない")

    def test_order_with_an_unknown_part(self):
        self.fx.checks["orders"]["down"] = ["CORE", "spear"]
        self.assertConfigError("無い部品 spear")

    def test_order_for_a_direction_without_frames(self):
        self.fx.checks["orders"]["left"] = ["CORE"]
        self.assertConfigError("知らないキー left")

    def test_order_missing_for_a_direction(self):
        del self.fx.checks["orders"]["up"]
        self.assertConfigError("orders.up")

    def test_colour_not_in_the_palette(self):
        self.fx.checks["colours"]["face"] = ["skin_bse"]
        self.assertConfigError("パレットに無い色名 skin_bse")

    def test_eyes_need_face_colours(self):
        self.fx.checks["eyes"]["down"] = [11, 12]
        self.assertConfigError("colours.face")

    def test_eyes_must_be_two_rows(self):
        self.fx.checks["colours"]["face"] = ["skin_base"]
        self.fx.checks["eyes"]["down"] = [12, 11]
        self.assertConfigError("eyes.down")

    def test_weapon_check_colour_and_frame_names_are_checked(self):
        base = {"blade": ["stone_hi"], "hand": ["skin_hi"]}
        for extra, text in (({"weapon": ["wood_bse"]}, "wood_bse"), ({"hidden": ["down_atk_wind"]}, "down_atk_wind"),
                            ({"depth": ["side"]}, "side")):
            with self.subTest(text):
                self.fx.checks["weapon_check"] = {**base, **extra}
                self.assertConfigError(text)

    def test_exception_with_an_unknown_check(self):
        self.fx.checks["exceptions"] = [{"check": "order", "frames": ["down_base"], "what": "x", "why": "y",
                                         "approved": "2026-10-16 依頼者"}]
        self.assertConfigError("知らない確認 'order'")

    def test_exception_needs_why_and_approved(self):
        self.fx.checks["exceptions"] = [{"check": "order_check", "frames": ["down_base"], "what": "x"}]
        self.assertConfigError("キーが無い")



class RunCheckTest(unittest.TestCase):
    """確認の道具の共通の main（run_check）。"""

    def setUp(self):
        self.fx = UnitFixture()
        self.addCleanup(self.fx.close)

    def run_check(self, check) -> tuple[int, str]:
        return self.fx.run(lambda argv: run_check(argv, "テスト", check, "テスト: ok"))

    def test_no_failures_exit_0(self):
        code, out = self.run_check(lambda cfg: [])
        self.assertEqual((code, out), (0, "テスト: ok\n"))

    def test_failures_are_printed_one_per_line_and_exit_1(self):
        code, out = self.run_check(lambda cfg: [("down_base", "a"), ("up_base", "b")])
        self.assertEqual((code, out), (1, "FAIL down_base: a\nFAIL up_base: b\n"))

    def test_a_config_error_exits_2(self):
        self.fx.checks["colour"] = {}
        code, out = self.run_check(lambda cfg: [])
        self.assertEqual(code, 2)
        self.assertIn("error: ", out)
        self.assertIn("知らないキー colour", out)


if __name__ == "__main__":
    unittest.main()
