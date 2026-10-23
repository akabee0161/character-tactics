"""Checks for tools/tip_rule.py（刃・鏃の先端の決まり1〜5。docs/superpowers/specs/2026-10-22-tip-drawing-rule-design.md）."""
from __future__ import annotations

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "tools"))

from tip_rule import find_tips  # noqa: E402

BLADE = frozenset("ijk")
OUTLINE = frozenset("o")
LIGHT = {1: "j", 2: "ij", 3: "ijk", 4: "ijjk", 5: "ijjjk"}


def vertical(top: list[str], n: int, body: int = 4, root: bool = True) -> list[str]:
    """上向きの縦の刃。top は先端の行（外形の幅 n+2 で中央そろえ）、その下に体の幅の行を body 行、根元に柄 h。"""
    full = n + 2
    rows = [r.center(full, ".") for r in top] + ["o" + LIGHT[n] + "o"] * body
    if root:
        rows.append("o" + "h" * n + "o")
    rows = ["." * full] * 2 + rows + ["." * full] * 2
    return [".." + r + ".." for r in rows]


def diagonal(n: int, p: int, fill: bool = True) -> list[str]:
    """右上向き45°の刃（16x16）。刃の色を縦の線 x<=13 と横の線 y>=2 で切り、上下左右に輪郭 o を回し、
    fill なら角 (14,1) も o。行 y の刃の色は x = 13-p+2-y+k（k=0..n-1, x<=13）。一番下の行の左下に柄 h。"""
    a = 13 - p + 2
    last = 11
    light = {}
    for y in range(2, last + 1):
        for k in range(n):
            x = a - y + k
            if x <= 13:
                light[(x, y)] = LIGHT[n][k]
    rows = [["."] * 16 for _ in range(16)]
    for (x, y) in light:
        for dx, dy in ((0, -1), (0, 1), (-1, 0), (1, 0)):
            q = (x + dx, y + dy)
            if q not in light and 0 <= q[0] < 16 and 0 <= q[1] < 16:
                rows[q[1]][q[0]] = "o"
    if fill:
        rows[1][14] = "o"
    for (x, y), c in light.items():
        rows[y][x] = c
    rows[last + 1][a - last - 1] = "h"
    return ["".join(r) for r in rows]


def rotate(rows: list[str], turns: int) -> list[str]:
    """時計回りに 90°×turns。"""
    for _ in range(turns % 4):
        rows = ["".join(rows[len(rows) - 1 - r][c] for r in range(len(rows))) for c in range(len(rows[0]))]
    return rows


def mirror(rows: list[str]) -> list[str]:
    return [r[::-1] for r in rows]


def side_by_side(a: list[str], b: list[str]) -> list[str]:
    h = max(len(a), len(b))
    a = ["." * len(a[0])] * (h - len(a)) + a
    b = ["." * len(b[0])] * (h - len(b)) + b
    return [x + "...." + y for x, y in zip(a, b)]


def tips(rows):
    return find_tips(rows, BLADE, OUTLINE)


class TipRuleTest(unittest.TestCase):
    def assert_one_pass(self, rows, direction, width):
        found = tips(rows)
        self.assertEqual(len(found), 1, found)
        tip = found[0]
        self.assertEqual(tip.problems, (), "\n".join(rows))
        self.assertIsNone(tip.skipped)
        self.assertEqual(tip.direction, direction)
        self.assertEqual(tip.width, width)
        return tip

    def assert_rule(self, rows, rule):
        found = tips(rows)
        self.assertEqual(len(found), 1, found)
        self.assertTrue(any(p.startswith(rule) for p in found[0].problems), (found[0].problems, "\n".join(rows)))

    def test_approved_vertical_shapes_pass(self):
        for top, n in [([".o."], 1), ([".oo."], 2), (["..o..", ".ojo."], 3), ([".ooo.", "oojoo"], 3),
                       (["..oo..", ".oijo."], 4), ([".oooo.", "ooijoo"], 4)]:
            with self.subTest(top=top):
                self.assert_one_pass(vertical(top, n), "up", n)

    def test_rejected_vertical_shapes_fail_with_their_rule(self):
        for top, rule in [([".ooo."], "決まり2"), ([".ooo.", ".ojo."], "決まり1"),
                          (["..o..", ".ooo.", ".ojo."], "決まり3"), (["..o..", ".ooo.", "oojoo"], "決まり3"),
                          (["..o..", ".ojo.", "oojoo"], "決まり4"), ([".ooo.", "ojooo"], "対称")]:
            with self.subTest(top=top):
                self.assert_rule(vertical(top, 3), rule)

    def test_rotated_tips_are_judged_in_their_direction(self):
        base = vertical(["..o..", ".ojo."], 3)
        for turns, direction in [(1, "right"), (2, "down"), (3, "left")]:
            with self.subTest(direction=direction):
                rows = rotate(base, turns)
                tip = self.assert_one_pass(rows, direction, 3)
                light = [(x, y) for y, r in enumerate(rows) for x, c in enumerate(r) if c in BLADE]
                key = {"right": lambda p: p[0], "down": lambda p: p[1], "left": lambda p: -p[0]}[direction]
                self.assertEqual(tip.point, max(light, key=key))

    def test_approved_diagonal_shapes_pass(self):
        for n, p in [(1, 0), (2, 0), (2, 1), (3, 0), (3, 1), (3, 2), (4, 1), (4, 2)]:
            with self.subTest(n=n, p=p):
                tip = self.assert_one_pass(diagonal(n, p), "up_right", n)
                self.assertEqual(tip.point, (13, 2))
        tip = self.assert_one_pass(mirror(diagonal(1, 0)), "up_left", 1)
        self.assertEqual(tip.point, (2, 2))

    def test_diagonal_without_the_corner_fails_rule5(self):
        self.assert_rule(diagonal(3, 1, fill=False), "決まり5")

    def test_old_sword_icon_fails_rule5(self):
        # A（0d3fd29 の前のアイコンの剣）の上から鍔までの9行。刃が短いと向きが決まらないので鍔まで写す
        rows = ["................",
                ".............o..",
                "...........ooio.",
                "..........oijo..",
                ".........oijko..",
                "........oijko...",
                "....o..oijko....",
                "...ohooijko.....",
                "...ohhijko......",
                "................"]
        self.assert_rule(rows, "決まり5")

    def test_wide_blades_are_skipped(self):
        found = tips(vertical(["...o...", "..ojo.."], 5))
        self.assertEqual(len(found), 1)
        self.assertIn("中身5画素", found[0].skipped or "")
        self.assertEqual(found[0].problems, ())

    def test_a_cluster_without_a_root_is_skipped(self):
        found = tips(vertical(["..o..", ".ojo."], 3, root=False))
        self.assertEqual(len(found), 1)
        self.assertIn("根元", found[0].skipped or "")

    def test_the_root_end_is_not_judged(self):
        self.assertEqual(len(tips(vertical([".oo."], 2))), 1)

    def test_each_blade_cluster_is_judged(self):
        found = tips(side_by_side(vertical([".o."], 1), vertical([".ooo.", ".ojo."], 3)))
        self.assertEqual(len(found), 2)
        self.assertEqual(sorted(any(p.startswith("決まり1") for p in t.problems) for t in found), [False, True])

    def test_tip_at_the_grid_edge_needs_a_cap(self):
        rows = vertical([".oo."], 2)
        self.assert_one_pass(rows[2:], "up", 2)  # 蓋の黒が y=0、グリッドの外は背景
        self.assert_rule(rows[3:], "決まり3")  # 刃の色が y=0 で、蓋が無い

    def test_non_blade_characters_are_ignored(self):
        self.assertEqual(tips(["...", ".o.", "oho", "oho", "..."]), [])


if __name__ == "__main__":
    unittest.main()
