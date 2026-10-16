"""Checks for tools/order_check.py (1 承認された重なり順)."""
from __future__ import annotations

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "tools"))
sys.path.insert(0, str(Path(__file__).resolve().parent))

from order_check import main  # noqa: E402
from unit_fixture import UnitFixture  # noqa: E402


class OrderCheckTest(unittest.TestCase):
    def setUp(self):
        self.fx = UnitFixture()
        self.addCleanup(self.fx.close)

    def test_the_approved_order_passes(self):
        code, out = self.fx.run(main)
        self.assertEqual(code, 0, out)
        self.assertIn("重なり順: ok", out)

    def test_a_changed_order_fails_every_frame_of_that_direction(self):
        self.fx.checks["orders"]["up"] = ["CORE", "shield", "sword", "sword_hand"]
        code, out = self.fx.run(main)
        self.assertEqual(code, 1)
        self.assertEqual(out.count("FAIL up_"), 4)
        self.assertNotIn("FAIL down_", out)
        self.assertIn("FAIL up_base: 重なり順が承認と違う（今 CORE,sword,sword_hand,shield、"
                      "承認 CORE,shield,sword,sword_hand）", out)


if __name__ == "__main__":
    unittest.main()
