"""Checks for cand/gen/mklayers.py (槍の女性 a の left を層で組む。試作)."""
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


def fake_layers(extra=()):
    """部品のファイルを読まない、表どおりの空の層（＋ extra の名前の層）。"""
    return {n: Layer(blank()) for n in list(ml.ORDER_LEFT) + list(extra)}


class ComposeFrameTest(unittest.TestCase):
    def test_layer_missing_from_order_raises(self):
        """層を足して表に書き忘れたら、黙って合成から消さずに止める。"""
        with mock.patch.object(ml, "build_layers", return_value=fake_layers(["表に無い層"])):
            for weapon in (True, False):
                with self.assertRaises(LayerError):
                    ml.compose_frame("base", weapon=weapon)

    def test_weaponless_drops_only_weapon_and_far_hand(self):
        with mock.patch.object(ml, "build_layers", return_value=fake_layers()):
            ml.compose_frame("base", weapon=False)


if __name__ == "__main__":
    unittest.main()
