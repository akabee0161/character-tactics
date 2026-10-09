"""Checks for cand/gen/layer_page.py (層で組んだ試作の比較ページ)."""
from __future__ import annotations

import os
import sys
import unittest
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT / "tools"))
sys.path.insert(0, str(REPO_ROOT / "cand" / "gen"))
os.chdir(REPO_ROOT)  # layer_page・mklayers は pixel-asset-forge からの相対パスで import する

import layer_page as lp  # noqa: E402
import mklayers as ml  # noqa: E402
from layers import ADDED  # noqa: E402


class StackOrderTest(unittest.TestCase):
    def test_stack_follows_each_directions_order(self):
        """「層で重ねたもの」は、その向きの表の順（奥→手前）に重ね、最後に後から足した輪郭。
        全向きで同じ順に重ねると、up で槍が髪の手前に出た（2026-10-09 依頼者の指摘）。"""
        for d in ml.DIRS:
            self.assertEqual(lp.stack_order(d), ml.ORDERS[d] + [ADDED])


if __name__ == "__main__":
    unittest.main()
