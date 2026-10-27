"""Checks for tools/weapon_mirror.py（left と right の武器の位置、2026-10-27）."""
from __future__ import annotations

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "tools"))
sys.path.insert(0, str(Path(__file__).resolve().parent))

from unit_fixture import UnitFixture, box, default_frames, mirror, sword  # noqa: E402
from weapon_mirror import main  # noqa: E402


def sword_shifted(dx: int, dy: int = 0) -> dict:
    return {(x + dx, y): ch for (x, y), ch in sword(dy).items()}


def left_right_frames() -> dict[str, dict]:
    """既定の down の4コマを left、その左右反転を right にする。"""
    down = {name: layers for name, layers in default_frames().items() if name.startswith("down_")}
    left = {name.replace("down_", "left_"): layers for name, layers in down.items()}
    right = {name.replace("down_", "right_"): {key: mirror(pixels) for key, pixels in layers.items()}
             for name, layers in down.items()}
    return {**left, **right}


class WeaponMirrorTest(unittest.TestCase):
    def setUp(self):
        self.fx = UnitFixture()
        self.addCleanup(self.fx.close)
        self.fx.frames = left_right_frames()
        order = self.fx.checks["orders"]["down"]
        self.fx.checks["orders"] = {"left": list(order), "right": list(order)}
        self.fx.checks["eyes"] = {"left": None, "right": None}

    def test_mirrored_parts_pass(self):
        code, out = self.fx.run(main)
        self.assertEqual(code, 0, out)
        self.assertIn("武器の位置（left と right）: ok", out)

    def test_a_one_pixel_shift_fails_with_the_positions(self):
        self.fx.frames["left_base"]["sword"] = sword_shifted(-1)
        code, out = self.fx.run(main)
        self.assertEqual(code, 1)
        self.assertIn("FAIL left_base: sword の位置が right の反転と合わない", out)
        self.assertIn("left だけ (21,5) (20,6) (20,7)", out)
        self.assertIn("right 反転だけ (22,5) (23,6) (23,7)", out)

    def test_an_empty_part_on_one_side_fails(self):
        self.fx.frames["left_atk_hit"]["sword"] = {}
        code, out = self.fx.run(main)
        self.assertEqual(code, 1)
        self.assertIn("FAIL left_atk_hit: sword が left では空", out)

    def test_an_empty_part_on_the_right_fails(self):
        self.fx.frames["right_atk_hit"]["sword"] = {}
        code, out = self.fx.run(main)
        self.assertEqual(code, 1)
        self.assertIn("FAIL left_atk_hit: sword が right では空", out)

    def test_both_empty_pass(self):
        for name in ("left_atk_hit", "right_atk_hit"):
            self.fx.frames[name]["sword"] = {}
            self.fx.frames[name]["sword_hand"] = {}
        code, out = self.fx.run(main)
        self.assertEqual(code, 0, out)

    def test_a_part_missing_on_one_side_fails(self):
        del self.fx.frames["right_base"]["sword"]
        code, out = self.fx.run(main)
        self.assertEqual(code, 1)
        self.assertIn("FAIL left_base: sword が right_base に無い", out)

    def test_a_state_only_on_one_side_fails(self):
        del self.fx.frames["right_idle2"]
        del self.fx.frames["left_walk_a"]
        code, out = self.fx.run(main)
        self.assertEqual(code, 1)
        self.assertIn("FAIL left_idle2: 組になる right_idle2 が無い", out)
        self.assertIn("FAIL right_walk_a: 組になる left_walk_a が無い", out)

    def test_attack_frames_are_compared(self):
        self.fx.frames["left_atk_hit"]["sword"] = sword_shifted(-1, -4)
        code, out = self.fx.run(main)
        self.assertEqual(code, 1)
        self.assertIn("FAIL left_atk_hit: sword の位置が", out)

    def test_parts_not_gripped_are_not_compared(self):
        self.fx.frames["left_base"]["shield"] = box(6, 18, 9, 23, "m")  # 盾を1列左へ。盾を握る拳は無い
        code, out = self.fx.run(main)
        self.assertEqual(code, 0, out)

    def test_no_gripped_parts_passes(self):
        self.fx.checks["parts"]["sword_hand"].pop("grips")
        self.fx.frames["left_base"]["sword"] = sword_shifted(-1)
        code, out = self.fx.run(main)
        self.assertEqual(code, 0, out)

    def test_a_weapon_no_fist_grips_is_noted(self):
        # grips を書き忘れると何も比べずに ok になるので、weapon の部品で握られていないものを NOTE に出す（最終レビュー 2026-10-27）
        self.fx.checks["parts"]["sword_hand"].pop("grips")
        code, out = self.fx.run(main)
        self.assertEqual(code, 0, out)
        self.assertIn("NOTE sword: weapon だが、どの拳の grips にも無いので left と right を比べない", out)

    def test_gripped_weapons_are_not_noted(self):
        code, out = self.fx.run(main)
        self.assertNotIn("NOTE", out)

    def test_down_and_up_are_not_compared(self):
        down = {name: layers for name, layers in default_frames().items() if name.startswith("down_")}
        self.fx.frames.update(down)
        self.fx.frames.update({name.replace("down_", "up_"): layers for name, layers in down.items()})  # 反転しない
        order = self.fx.checks["orders"]["left"]
        self.fx.checks["orders"].update({"down": list(order), "up": list(order)})
        self.fx.checks["eyes"].update({"down": None, "up": None})
        code, out = self.fx.run(main)
        self.assertEqual(code, 0, out)
        self.assertNotIn("down_", out)

    def test_failure_line_starts_with_the_left_frame(self):
        self.fx.frames["left_base"]["sword"] = sword_shifted(-1)
        code, out = self.fx.run(main)
        line = next(line for line in out.splitlines() if line.startswith("FAIL "))
        self.assertEqual(line[len("FAIL "):].split(":", 1)[0], "left_base")


if __name__ == "__main__":
    unittest.main()
