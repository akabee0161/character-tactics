"""Checks for cand/gen/mklayers.py (槍の女性 a を層で組む。試作)."""
from __future__ import annotations

import os
import sys
import unittest
from pathlib import Path
from unittest import mock

REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT / "tools"))
sys.path.insert(0, str(REPO_ROOT / "cand" / "gen"))
os.chdir(REPO_ROOT)  # mklayers は pixel-asset-forge からの相対パスで import する

import mklayers as ml  # noqa: E402
from layers import Layer, LayerError, blank  # noqa: E402


def fake_layers(d, extra=(), dot=None):
    """部品のファイルを読まない、その向きの表どおりの空の層（＋ extra の名前の層）。
    dot に層の名前を並べると、その層すべての (5,5) を塗る（どれが手前に来るかを見る）。"""
    layers = {n: Layer(blank()) for n in list(ml.ORDERS[d]) + list(extra)}
    for n in dot or ():
        layers[n].frame[5][5] = "outline"
    return layers


def front_of(d, a, b):
    """向き d で a と b が同じ画素にあるとき、手前に来る層の名前。"""
    with mock.patch.object(ml, "build_layers", return_value=fake_layers(d, dot=[a, b])):
        return ml.compose_frame(d, "base")[1][5][5]


class ComposeFrameTest(unittest.TestCase):
    def test_layer_missing_from_order_raises(self):
        """層を足して表に書き忘れたら、黙って合成から消さずに止める。"""
        for d in ml.DIRS:
            with mock.patch.object(ml, "build_layers", return_value=fake_layers(d, ["表に無い層"])):
                for weapon in (True, False):
                    with self.assertRaises(LayerError):
                        ml.compose_frame(d, "base", weapon=weapon)

    def test_weaponless_drops_only_weapon_and_its_hand(self):
        for d in ml.DIRS:
            with mock.patch.object(ml, "build_layers", return_value=fake_layers(d)):
                ml.compose_frame(d, "base", weapon=False)

    def test_back_hair_is_nearest_from_behind_and_farthest_otherwise(self):
        """後ろ姿（up）は背中の髪が一番手前、正面・横は芯の後ろ（2026-10-09 依頼者と決めた表）。"""
        self.assertEqual(front_of("up", "芯", "長い髪（背中）"), "長い髪（背中）")
        for d in ("down", "left", "right"):
            self.assertEqual(front_of(d, "芯", "長い髪（背中）"), "芯")

    def test_weapon_is_behind_hair_only_in_up_and_left(self):
        self.assertEqual(front_of("up", "武器", "長い髪（頭）"), "長い髪（頭）")
        self.assertEqual(front_of("left", "武器", "長い髪（頭）"), "長い髪（頭）")
        for d in ("down", "right"):
            self.assertEqual(front_of(d, "武器", "長い髪（頭）"), "武器")


if __name__ == "__main__":
    unittest.main()
