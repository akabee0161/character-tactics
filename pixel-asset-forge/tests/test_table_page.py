"""Checks for cand/gen/table_page.py (重なり順の表を、層の絵を並べて確かめるページ)."""
from __future__ import annotations

import os
import sys
import unittest
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT / "tools"))
sys.path.insert(0, str(REPO_ROOT / "cand" / "gen"))
os.chdir(REPO_ROOT)

import table_page as tp  # noqa: E402
from layers import Layer, blank  # noqa: E402


class ShownStatesTest(unittest.TestCase):
    def test_base_always_then_only_changed_states(self):
        diffs = {"base": 0, "idle2": 0, "walk_a": 3, "walk_b": 0, "atk_wind": 0, "atk_hit": 7}
        self.assertEqual(tp.shown_states(diffs), ["base", "walk_a", "atk_hit"])


class VisibleLayersTest(unittest.TestCase):
    def test_empty_layers_are_left_out_in_order(self):
        """無い部品（長い髪の無い敵の髪など）は並べない。並びは表の順（奥→手前）。"""
        full = blank()
        full[3][3] = "outline"
        layers = {"a": Layer(blank()), "b": Layer(full), "c": Layer([row[:] for row in full])}
        self.assertEqual(tp.visible_layers(layers, ["c", "a", "b"]), ["c", "b"])


if __name__ == "__main__":
    unittest.main()
