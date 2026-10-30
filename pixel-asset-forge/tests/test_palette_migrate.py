"""Checks for palette_migrate.py (name rewriting of grid ``map`` lines).

    .venv/bin/python -m unittest tests.test_palette_migrate -v
"""
from __future__ import annotations

import contextlib
import io
import json
import string
import sys
import tempfile
import unittest
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT / "tools"))

from palette_migrate import MigrateError, main, migrate_text  # noqa: E402

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


    def test_point_on_trailing_whitespace_is_not_a_pixel(self) -> None:
        text = grid("# map: b=skin_base\n", ["bbb. ", "...."])
        pixels = [{"file": EQUIP, "points": [[4, 0]], "to": "hair_x"}]
        with self.assertRaises(MigrateError):
            migrate_text(EQUIP, text, RULES, pixels)

    def test_double_override_is_an_error(self) -> None:
        text = grid("# map: b=skin_base\n", ["bbb.", "...."])
        pixels = [
            {"file": EQUIP, "points": [[0, 0]], "to": "hair_x"},
            {"file": EQUIP, "points": [[0, 0]], "to": "hair_y"},
        ]
        with self.assertRaises(MigrateError):
            migrate_text(EQUIP, text, RULES, pixels)


class MainTest(unittest.TestCase):
    def setUp(self) -> None:
        self._tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self._tmp.cleanup)
        self.root = Path(self._tmp.name)
        self.grid = self.root / "a.txt"
        self.src = grid("# map: o=outline b=skin_base\n", ["ob..", "...."])
        self.grid.write_text(self.src, encoding="utf-8")

    def run_main(self, rules: list[dict], pixels: list[dict] | None = None, *flags: str) -> tuple[int, str]:
        mapping = self.root / "m.json"
        mapping.write_text(json.dumps({"rules": rules, "pixels": pixels or []}), encoding="utf-8")
        out = io.StringIO()
        with contextlib.redirect_stdout(out):
            code = main([str(mapping), *flags, str(self.grid)])
        return code, out.getvalue()

    ALL = [{"glob": "*", "from": "outline", "to": "line"}, {"glob": "*", "from": "skin_base", "to": "skin_use"}]

    def test_dry_run_writes_nothing(self) -> None:
        code, out = self.run_main(self.ALL)
        self.assertEqual(code, 0)
        self.assertEqual(self.grid.read_text(encoding="utf-8"), self.src)
        self.assertNotIn("WRITE", out)

    def test_write_rewrites_and_reports_only_changed(self) -> None:
        code, out = self.run_main(self.ALL, None, "--write")
        self.assertEqual(code, 0)
        self.assertIn("o=line b=skin_use", self.grid.read_text(encoding="utf-8"))
        self.assertIn("WRITE", out)

    def test_unmapped_name_exits_1_and_writes_nothing(self) -> None:
        code, out = self.run_main(self.ALL[:1], None, "--write")
        self.assertEqual(code, 1)
        self.assertEqual(self.grid.read_text(encoding="utf-8"), self.src)
        self.assertNotIn("WRITE", out)
        self.assertIn("skin_base (1)", out)

    def test_pixels_file_matching_no_target_exits_1(self) -> None:
        pixels = [{"file": "assets/typo.txt", "points": [[0, 0]], "to": "hair_x"}]
        code, out = self.run_main(self.ALL, pixels, "--write")
        self.assertEqual(code, 1)
        self.assertEqual(self.grid.read_text(encoding="utf-8"), self.src)
        self.assertIn("typo.txt", out)

    def test_double_override_exits_1(self) -> None:
        path = self.grid.resolve().as_posix()
        pixels = [
            {"file": path, "points": [[1, 0]], "to": "hair_x"},
            {"file": path, "points": [[1, 0]], "to": "hair_y"},
        ]
        code, _ = self.run_main(self.ALL, pixels, "--write")
        self.assertEqual(code, 1)
        self.assertEqual(self.grid.read_text(encoding="utf-8"), self.src)

    def test_unused_rule_is_reported_but_not_a_failure(self) -> None:
        rules = self.ALL + [{"glob": "*", "from": "nothing", "to": "x"}]
        code, out = self.run_main(rules)
        self.assertEqual(code, 0)
        self.assertIn("当たらなかった規則", out)

    def test_unreadable_file_is_reported(self) -> None:
        self.grid.write_bytes(b"\xff\xfe# map")
        code, out = self.run_main(self.ALL)
        self.assertEqual(code, 1)
        self.assertIn("a.txt", out)


if __name__ == "__main__":
    unittest.main()
