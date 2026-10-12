"""Checks for tools/hand_mirror.py (向きの組で拳の位置が左右反転で合っているか)."""
from __future__ import annotations

import contextlib
import io
import json
import sys
import unittest
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT / "tools"))
sys.path.insert(0, str(Path(__file__).resolve().parent))

from hand_mirror import main  # noqa: E402
from test_compose import BODY_MAP, Workspace, grid_text  # noqa: E402

FIST_MAP = "o=outline b=skin_base"


def fist(x, y):
    return {(x, y): "b", (x + 1, y): "b", (x, y + 1): "b", (x + 1, y + 1): "b"}


class HandMirrorTest(unittest.TestCase):
    def setUp(self):
        self.ws = Workspace()
        self.ws.write("body.txt", grid_text({(15, 15): "b"}, BODY_MAP))
        self.frames = {}

    def tearDown(self):
        self.ws.close()

    def frame(self, name, hands):
        """hands: {部品の名前の前半: 拳の左上}。"""
        d, st = name.split("_", 1)
        layers = []
        for key, (x, y) in hands.items():
            rel = f"parts/{key}_{d}_{st}.txt"
            self.ws.write(rel, grid_text(fist(x, y), FIST_MAP))
            layers.append({"part": rel, "z": "front", "hand": True})
        self.frames[name] = {"body": "body.txt", "layers": layers}

    def run_check(self):
        path = self.ws.write("compose/t.json", json.dumps(
            {"unit": "t", "hand_colours": ["skin_base"], "frames": self.frames}))
        out = io.StringIO()
        with contextlib.redirect_stdout(out), contextlib.redirect_stderr(out):
            code = main([str(path), "--root", str(self.ws.root)])
        return code, out.getvalue()

    def test_mirrored_fists_pass(self):
        self.frame("down_base", {"bow_hand": (20, 20), "arrow_hand": (13, 19)})
        self.frame("up_base", {"bow_hand": (10, 20), "arrow_hand": (17, 19)})
        code, out = self.run_check()
        self.assertEqual(code, 0, out)
        self.assertIn("ok", out)

    def test_one_pixel_off_fails_and_names_the_frames_and_the_hand(self):
        self.frame("down_base", {"bow_hand": (20, 20)})
        self.frame("up_base", {"bow_hand": (10, 21)})
        code, out = self.run_check()
        self.assertEqual(code, 1)
        self.assertIn("down_base と up_base", out)
        self.assertIn("bow_hand", out)

    def test_attack_frames_are_not_checked(self):
        self.frame("down_atk_hit", {"bow_hand": (20, 20)})
        self.frame("up_atk_hit", {"bow_hand": (9, 16)})
        code, out = self.run_check()
        self.assertEqual(code, 0, out)

    def test_left_and_right_are_a_pair(self):
        self.frame("left_idle2", {"bow_hand": (6, 19)})
        self.frame("right_idle2", {"bow_hand": (23, 19)})
        code, out = self.run_check()
        self.assertEqual(code, 1)
        self.assertIn("left_idle2 と right_idle2", out)

    def test_a_hand_missing_in_the_partner_frame_fails(self):
        self.frame("down_walk_a", {"bow_hand": (20, 20), "arrow_hand": (13, 19)})
        self.frame("up_walk_a", {"bow_hand": (10, 20)})
        code, out = self.run_check()
        self.assertEqual(code, 1)
        self.assertIn("arrow_hand", out)

    def test_a_frame_without_its_partner_fails(self):
        self.frame("down_base", {"bow_hand": (20, 20)})
        code, out = self.run_check()
        self.assertEqual(code, 1)
        self.assertIn("up_base", out)

    def test_walk_frames_that_reuse_the_base_parts_are_matched_by_hand(self):
        self.frame("down_base", {"bow_hand": (20, 20)})
        self.frame("up_base", {"bow_hand": (10, 20)})
        for d in ("down", "up"):
            self.frames[f"{d}_walk_a"] = self.frames[f"{d}_base"]  # 歩きは立ちの部品のファイルを使い回す
        code, out = self.run_check()
        self.assertEqual(code, 0, out)


if __name__ == "__main__":
    unittest.main()
