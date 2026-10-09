"""Checks for cand/gen/cut_layers.py (完成した絵から層を切り出す。試作)."""
from __future__ import annotations

import sys
import unittest
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT / "tools"))
sys.path.insert(0, str(REPO_ROOT / "cand" / "gen"))

from cut_layers import Part, cut  # noqa: E402
from layers import LayerError, blank, compose  # noqa: E402


def grid(rows, key):
    """文字の行（32x32 に満たない分は空）を、key で色名にしたコマ。"""
    f = blank()
    for y, row in enumerate(rows):
        for x, ch in enumerate(row):
            if ch != ".":
                f[y][x] = key[ch]
    return f


KEY = {"o": "outline", "i": "stone_hi", "q": "cloak_dark_base", "b": "skin_rose_base", "w": "wood_base"}
# 剣（i）が体（q）の横にあり、輪郭 o を体と分け合う。拳（b）は剣の下。ベルト（w）は体の中で剣の鍔と同じ色
ART = grid([
    "oioqqo",
    "oioqqo",
    "obooqo",
    "owoowo",
    "ooo...",
], KEY)
PARTS = [
    Part("武器", box=(0, 0, 2, 4), colors={"stone_hi", "wood_base"}),
    Part("武器を持つ腕・拳", box=(0, 0, 2, 4), colors={"skin_rose_base"}),
]


class CutTest(unittest.TestCase):
    def test_parts_take_their_colours_inside_the_box_only(self):
        layers = cut(ART, PARTS)
        self.assertEqual(layers["武器"].frame[0][1], "stone_hi")
        self.assertEqual(layers["武器"].frame[3][1], "wood_base")  # 箱の中の鍔
        self.assertIsNone(layers["武器"].frame[3][4])               # 箱の外のベルトは芯
        self.assertEqual(layers["芯"].frame[3][4], "wood_base")
        self.assertEqual(layers["武器を持つ腕・拳"].frame[2][1], "skin_rose_base")

    def test_shared_outline_goes_to_every_layer_that_touches_it(self):
        layers = cut(ART, PARTS)
        self.assertEqual(layers["武器"].frame[0][2], "outline")  # 剣と体の間の輪郭
        self.assertEqual(layers["芯"].frame[0][2], "outline")
        self.assertIsNone(layers["芯"].frame[0][0])              # 剣だけに接する輪郭は芯に入れない

    def test_part_pixels_are_holes_in_the_core(self):
        layers = cut(ART, PARTS)
        self.assertIsNone(layers["芯"].frame[0][1])
        self.assertIsNone(layers["芯"].frame[2][1])

    def test_composing_the_cut_layers_gives_back_the_art_in_any_order(self):
        layers = cut(ART, PARTS)
        for order in (["芯", "武器", "武器を持つ腕・拳"], ["武器を持つ腕・拳", "武器", "芯"]):
            self.assertEqual(compose(layers, order)[0], ART)

    def test_box_outside_the_frame_raises(self):
        with self.assertRaises(LayerError):
            cut(ART, [Part("武器", box=(0, 0, 32, 4), colors={"stone_hi"})])


if __name__ == "__main__":
    unittest.main()
