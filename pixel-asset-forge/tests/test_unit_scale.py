"""Checks for tools/unit_scale.py (32px と 48px の体の比率の表)."""
from __future__ import annotations

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "tools"))

from unit_scale import SIZES, ScaleError, scale_for  # noqa: E402


def values(s):
    return (s.foot, s.min_height, s.max_height, s.leg_top, s.walk_leg_top, s.walk_outline_row,
            s.blade_top, s.idle2_blade_top)


class ScaleTest(unittest.TestCase):
    def test_32_is_the_current_constants(self):
        s = scale_for(32)
        self.assertEqual(s.size, 32)
        self.assertEqual(values(s), (30, 24, 26, 24, 28, 27, 5, 3))
        self.assertEqual(s.bands, {"head": (3, 14), "trunk": (15, 24), "legs": (25, 31)})

    def test_48_is_one_and_a_half_from_the_feet(self):
        s = scale_for(48)
        self.assertEqual(s.size, 48)
        self.assertEqual(values(s), (46, 36, 39, 37, 43, 42, 8, 5))
        self.assertEqual(s.bands, {"head": (5, 22), "trunk": (23, 37), "legs": (38, 47)})

    def test_hand_max_scales_by_area(self):
        self.assertEqual((scale_for(32).hand_max, scale_for(48).hand_max), (12, 27))

    def test_other_sizes_stop(self):
        with self.assertRaisesRegex(ScaleError, "40.*32 か 48"):
            scale_for(40)

    def test_sizes(self):
        self.assertEqual(SIZES, (32, 48))


if __name__ == "__main__":
    unittest.main()
