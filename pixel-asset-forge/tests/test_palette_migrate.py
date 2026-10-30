"""Checks for palette_migrate.py (name rewriting of grid ``map`` lines).

    .venv/bin/python -m unittest tests.test_palette_migrate -v
"""
from __future__ import annotations

import string
import sys
import unittest
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT / "tools"))

from palette_migrate import MigrateError, migrate_text  # noqa: E402

EQUIP = "assets/part/equip/dagger/a.txt"
RULES = [
    {"glob": "assets/part/equip/dagger/*.txt", "from": "stone_hi", "to": "weapon_blade_hi"},
    {"glob": "assets/*", "from": "stone_hi", "to": "other_hi"},
    {"glob": "assets/*", "from": "outline", "to": "line"},
    {"glob": "assets/*", "from": "skin_base", "to": "skin_use"},
]


def grid(map_lines: str, rows: list[str]) -> str:
    return "# type: unit\n# size: 4x2\n" + map_lines + "\n".join(rows) + "\n"


class MigrateTextTest(unittest.TestCase):
    def test_rewrites_map_by_first_matching_rule(self) -> None:
        text = grid("# map: o=outline s=stone_hi\n", ["os..", "..so"])
        out = migrate_text(EQUIP, text, RULES, [])
        self.assertEqual(out, grid("# map: o=line s=weapon_blade_hi\n", ["os..", "..so"]))
        out2 = migrate_text("assets/x/b.txt", text, RULES, [])
        self.assertIn("s=other_hi", out2)

    def test_unmapped_name_is_reported(self) -> None:
        text = grid("# map: o=outline z=mystery\n", ["oz..", "...."])
        with self.assertRaises(MigrateError) as cm:
            migrate_text(EQUIP, text, RULES, [])
        self.assertIn(EQUIP, str(cm.exception))
        self.assertIn("mystery", str(cm.exception))
        self.assertEqual(cm.exception.names, ("mystery",))

    def test_pixel_override_takes_unused_char(self) -> None:
        text = grid("# map: o=outline b=skin_base\n", ["bbb.", "bo.."])
        pixels = [{"file": EQUIP, "points": [[0, 0], [0, 1]], "to": "hair_x"}]
        out = migrate_text(EQUIP, text, RULES, pixels)
        # 'a' is the first lowercase char the file does not use
        self.assertEqual(out, grid("# map: o=line b=skin_use a=hair_x\n", ["abb.", "ao.."]))

    def test_pixel_override_for_other_file_is_ignored(self) -> None:
        text = grid("# map: b=skin_base\n", ["bbb.", "...."])
        pixels = [{"file": "assets/other.txt", "points": [[0, 0]], "to": "hair_x"}]
        out = migrate_text(EQUIP, text, RULES, pixels)
        self.assertEqual(out, grid("# map: b=skin_use\n", ["bbb.", "...."]))

    def test_new_pairs_wrap_at_four_per_line(self) -> None:
        text = grid("# map: b=skin_base c=skin_base d=skin_base e=skin_base\n", ["bcde", "...."])
        pixels = [{"file": EQUIP, "points": [[0, 0]], "to": "hair_x"}]
        out = migrate_text(EQUIP, text, RULES, pixels)
        self.assertIn("e=skin_use\n# map: a=hair_x\n", out)

    def test_pixel_override_runs_out_of_chars(self) -> None:
        letters = string.ascii_lowercase + string.ascii_uppercase + string.digits
        # every usable char appears in a row except none free; 'b' is among them
        rows = [letters[:31] + "." * 1, letters[31:] + "." * (32 - len(letters[31:]))]
        text = "# type: unit\n# size: 32x2\n# map: b=skin_base\n" + "\n".join(rows) + "\n"
        pixels = [{"file": EQUIP, "points": [[1, 0]], "to": "hair_x"}]
        with self.assertRaises(MigrateError):
            migrate_text(EQUIP, text, RULES, pixels)

    def test_pixel_override_point_must_hit_a_pixel(self) -> None:
        text = grid("# map: b=skin_base\n", ["bbb.", "...."])
        pixels = [{"file": EQUIP, "points": [[3, 0]], "to": "hair_x"}]
        with self.assertRaises(MigrateError):
            migrate_text(EQUIP, text, RULES, pixels)

    def test_pixel_override_point_outside_grid(self) -> None:
        text = grid("# map: b=skin_base\n", ["bbb.", "...."])
        pixels = [{"file": EQUIP, "points": [[9, 0]], "to": "hair_x"}]
        with self.assertRaises(MigrateError):
            migrate_text(EQUIP, text, RULES, pixels)

    def test_derived_file_without_map_is_left_alone(self) -> None:
        text = "# from: a.txt\n# transform: mirror_x\n"
        self.assertEqual(migrate_text(EQUIP, text, RULES, []), text)


if __name__ == "__main__":
    unittest.main()
