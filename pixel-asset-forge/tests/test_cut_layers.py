"""Checks for tools/cut_layers.py (完成した絵から層を切り出す)."""
from __future__ import annotations

import sys
import unittest
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT / "tools"))
sys.path.insert(0, str(REPO_ROOT / "cand" / "gen"))

from cut_layers import Part, cut, torn  # noqa: E402
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


SHIELD_KEY = {"o": "outline", "m": "metal_hi", "b": "skin_rose_base", "q": "cloak_dark_base"}
# 縦の盾（m、左右に輪郭）の右の輪郭の上に拳（b）が描かれている（ロランの left、2026-10-10 依頼者の指摘）
SHIELD_ART = [
    "omo..",
    "omo..",
    "omo..",
    "ombbo",
    "ombbo",
    "omo..",
    "omo..",
    "ooo..",
]
SHIELD_PARTS = [
    Part("盾", box=(0, 0, 2, 7), colors={"metal_hi"}),
    Part("手前の腕・拳", box=(2, 3, 3, 4), colors={"skin_rose_base"}),
]


class TornTest(unittest.TestCase):
    def torn_of(self, rows, order):
        layers = cut(grid(rows, SHIELD_KEY), SHIELD_PARTS)
        _frame, labels = compose(layers, order)
        return torn(layers, labels, SHIELD_PARTS, order)

    def test_back_layer_cutting_through_a_front_part_is_found(self):
        found = self.torn_of(SHIELD_ART, ["芯", "手前の腕・拳", "盾"])
        self.assertEqual(found, [((2, 3), "手前の腕・拳", "盾"), ((2, 4), "手前の腕・拳", "盾")])

    def test_front_layer_over_a_back_part_is_fine(self):
        self.assertEqual(self.torn_of(SHIELD_ART, ["芯", "盾", "手前の腕・拳"]), [])

    def test_gap_made_of_two_back_layers_is_not_counted(self):
        # 剣の柄が拳を通る所（ロランの right の当たり）。柄に挟まれた所に体と拳が混ざって見えるのは破れではない
        key = dict(SHIELD_KEY, i="stone_hi")
        rows = ["oio..", "oio..", "oio..", "oobbo", "ooqqo", "oio..", "oio..", "ooo.."]
        parts = [Part("剣", box=(0, 0, 2, 7), colors={"stone_hi"}),
                 Part("拳", box=(2, 3, 3, 3), colors={"skin_rose_base"})]
        layers = cut(grid(rows, key), parts)
        order = ["芯", "拳", "剣"]
        self.assertEqual(torn(layers, compose(layers, order)[1], parts, order), [])

    def test_back_layer_touching_the_face_of_a_front_part_is_found(self):
        # 一番奥の盾の金属が、手前の拳の面に輪郭を挟まず接している（ロランの up、2026-10-10 依頼者の指摘）
        parts = [Part("盾", box=(0, 0, 1, 7), colors={"metal_hi"}),
                 Part("盾を持つ腕・拳", box=(1, 3, 3, 4), colors={"skin_rose_base"})]
        rows = ["omo..", "omo..", "omo..", "ombbo", "ombbo", "omo..", "omo..", "ooo.."]
        layers = cut(grid(rows, SHIELD_KEY), parts)
        order = ["盾", "芯", "盾を持つ腕・拳"]
        found = torn(layers, compose(layers, order)[1], parts, order)
        self.assertEqual(found, [((1, 3), "盾", "盾を持つ腕・拳"), ((1, 4), "盾", "盾を持つ腕・拳")])


if __name__ == "__main__":
    unittest.main()
