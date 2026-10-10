"""Checks for tools/hand_outline.py (手の輪郭を閉じる)."""
from __future__ import annotations

import contextlib
import io
import sys
import tempfile
import unittest
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT / "tools"))

from hand_outline import HandOutlineError, close_hands, fix_file, main  # noqa: E402

HAND = {"skin_base", "skin_shadow"}


def blank():
    return [[None] * 32 for _ in range(32)]


def scene():
    """体（服 x12〜19・y15〜28）、顔（肌 x13〜18・y5〜12）、体の右に接する手（肌 x20〜21・y20〜21）。"""
    f = blank()
    for y in range(15, 29):
        for x in range(12, 20):
            f[y][x] = "cloth_base"
    for y in range(5, 13):
        for x in range(13, 19):
            f[y][x] = "skin_base"
    for y in (20, 21):
        for x in (20, 21):
            f[y][x] = "skin_base"
    f[22][20] = f[22][21] = f[19][21] = "outline"
    f[20][22] = f[21][22] = "outline"
    return f


class CloseHandsTest(unittest.TestCase):
    def test_side_touching_clothes_becomes_outline(self):
        fixed, changed = close_hands(scene(), HAND)
        self.assertEqual(fixed[20][19], "outline")
        self.assertEqual(fixed[21][19], "outline")
        self.assertIn((19, 20), changed)

    def test_gap_to_transparent_gets_outline(self):
        fixed, changed = close_hands(scene(), HAND)
        self.assertEqual(fixed[19][20], "outline")  # 手の上が透明だった（ガウの down の左手）
        self.assertIn((20, 19), changed)

    def test_sleeve_cuff_above_is_outlined_too(self):
        # 袖口（手の真上の服）も輪郭にする（依頼者 2026-10-09）
        f = scene()
        f[19][20] = "cloth_base"
        fixed, changed = close_hands(f, HAND)
        self.assertEqual(fixed[19][20], "outline")
        self.assertIn((20, 19), changed)

    def test_face_is_left_alone(self):
        fixed, _ = close_hands(scene(), HAND)
        self.assertEqual(fixed[15][12], "cloth_base")  # 顔（大きな肌の塊）の周りは触らない
        self.assertIsNone(fixed[8][12])

    def test_one_pixel_sleeve_becomes_outline(self):
        f = blank()
        f[17][11] = f[18][11] = "cloth_base"  # 横に伸びる 1px の袖
        f[17][12] = f[18][12] = "skin_base"  # 拳
        fixed, _ = close_hands(f, HAND)
        self.assertEqual(fixed[17][11], "outline")
        self.assertEqual(fixed[18][11], "outline")

    def test_keep_colours_are_not_overwritten(self):
        f = blank()
        for y in range(10, 20):
            f[y][15] = "wood_base"  # 縦の柄
        f[14][15] = f[15][15] = "skin_base"  # 柄の真ん中を握る拳
        fixed, _ = close_hands(f, HAND, keep={"wood_base"})
        self.assertEqual(fixed[13][15], "wood_base")
        self.assertEqual(fixed[16][15], "wood_base")

    def test_hand_at_frame_edge_does_not_crash(self):
        f = blank()
        f[0][0] = f[0][1] = "skin_base"
        f[31][31] = "skin_base"
        fixed, changed = close_hands(f, HAND)
        self.assertEqual(fixed[1][0], "outline")
        self.assertIn((2, 0), changed)

    def test_already_outlined_hand_is_left_alone(self):
        f = blank()
        f[10][10] = "skin_base"
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            f[10 + dy][10 + dx] = "outline"
        _, changed = close_hands(f, HAND)
        self.assertEqual(changed, [])

    def test_input_is_not_modified_and_closed_hands_are_unchanged(self):
        f = scene()
        once, _ = close_hands(f, HAND)
        self.assertIsNone(f[19][20])
        twice, changed = close_hands(once, HAND)
        self.assertEqual(changed, [])
        self.assertEqual(twice, once)


GRID_HEAD = (
    "# 手で描いたコマ（注記は残る）\n# type: unit\n# size: 32x32\n# light: upper-left\n# bg: transparent\n"
    "# map: o=outline b=skin_base c=skin_shadow q=cloth_base\n"
)


def grid_text(f, head=GRID_HEAD):
    letters = {None: ".", "outline": "o", "skin_base": "b", "skin_shadow": "c", "cloth_base": "q"}
    return head + "\n".join("".join(letters[n] for n in row) for row in f) + "\n"


class FixFileTest(unittest.TestCase):
    def test_only_the_changed_letters_are_rewritten(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "down_base.txt"
            path.write_text(grid_text(scene()), encoding="utf-8")
            changed = fix_file(path, HAND, frozenset(), write=True)
            text = path.read_text(encoding="utf-8")
            self.assertTrue(text.startswith(GRID_HEAD))
            rows = text.splitlines()[6:]
            self.assertEqual(rows[20][19], "o")
            self.assertEqual(rows[19][20], "o")
            self.assertEqual(len(changed), 3)  # 左の服 2 と上の透明 1

    def test_without_write_the_file_is_unchanged(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "down_base.txt"
            path.write_text(grid_text(scene()), encoding="utf-8")
            before = path.read_text(encoding="utf-8")
            self.assertEqual(len(fix_file(path, HAND, frozenset(), write=False)), 3)
            self.assertEqual(path.read_text(encoding="utf-8"), before)

    def test_file_without_an_outline_letter_is_refused(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "down_base.txt"
            head = GRID_HEAD.replace("o=outline ", "")
            f = scene()
            for y in range(32):
                f[y] = [None if n == "outline" else n for n in f[y]]
            path.write_text(grid_text(f, head), encoding="utf-8")
            with self.assertRaisesRegex(HandOutlineError, "outline"):
                fix_file(path, HAND, frozenset(), write=True)


class MainTest(unittest.TestCase):
    def test_reports_changes_and_writes_only_with_write(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "down_base.txt"
            path.write_text(grid_text(scene()), encoding="utf-8")
            out = io.StringIO()
            with contextlib.redirect_stdout(out):
                code = main([tmp, "--hand", "skin_base,skin_shadow"])
            self.assertEqual(code, 0)
            self.assertIn("down_base", out.getvalue())
            self.assertEqual(path.read_text(encoding="utf-8")[len(GRID_HEAD):].splitlines()[20][19], "q")
            with contextlib.redirect_stdout(io.StringIO()):
                main([tmp, "--hand", "skin_base,skin_shadow", "--write"])
            self.assertEqual(path.read_text(encoding="utf-8")[len(GRID_HEAD):].splitlines()[20][19], "o")


if __name__ == "__main__":
    unittest.main()
