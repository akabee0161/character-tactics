"""Checks for tools/layers.py (層を重なり順の表で合成する)."""
from __future__ import annotations

import sys
import unittest
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT / "tools"))

from layers import Layer, LayerError, blank, compose, differences  # noqa: E402


def box(x0, y0, x1, y1, name):
    """x0..x1・y0..y1（両端を含む）を name で塗った層。"""
    f = blank()
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            f[y][x] = name
    return Layer(f)


class ComposeTest(unittest.TestCase):
    def test_front_layer_overwrites_and_labels(self):
        frame, labels = compose({"胴": box(10, 10, 15, 20, "cloth_base"), "拳": box(14, 14, 16, 15, "skin_base")},
                                ["胴", "拳"])
        self.assertEqual(frame[14][14], "skin_base")
        self.assertEqual(labels[14][14], "拳")
        self.assertEqual(frame[16][14], "cloth_base")
        self.assertEqual(labels[16][14], "胴")
        self.assertIsNone(labels[0][0])

    def test_far_layer_is_hidden_behind_nearer_layer(self):
        """奥の拳が髪の後ろに入る（試作の動機）: 重なる画素はすべて手前の層になる。"""
        frame, labels = compose({"奥の拳": box(20, 16, 21, 17, "skin_shadow"), "髪": box(18, 14, 21, 18, "hair")},
                                ["奥の拳", "髪"])
        self.assertTrue(all(labels[y][x] == "髪" for y in (16, 17) for x in (20, 21)))

    def test_order_must_match_layers(self):
        layers = {"a": box(0, 0, 1, 1, "x"), "b": box(0, 0, 1, 1, "y")}
        for order in (["a"], ["a", "b", "c"], ["a", "b", "a"]):
            with self.assertRaises(LayerError):
                compose(layers, order)

    def test_layer_must_be_32x32(self):
        with self.assertRaises(LayerError):
            compose({"a": Layer([[None] * 31 for _ in range(32)])}, ["a"])


class DifferencesTest(unittest.TestCase):
    def test_differences_lists_changed_pixels(self):
        a, b = blank(), blank()
        b[3][4] = "x"
        self.assertEqual(differences(a, b), [(4, 3)])


if __name__ == "__main__":
    unittest.main()
