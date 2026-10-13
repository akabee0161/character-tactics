"""Checks for gen/enemy/mkparts.py の part_path（敵の部品の置き場）。"""
import sys
import unittest
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT / "tools"))
sys.path.insert(0, str(REPO_ROOT / "gen" / "enemy"))

from mkparts import part_path  # noqa: E402


class PartPathTest(unittest.TestCase):
    def test_kind_and_name_come_from_the_part_name(self):
        cases = {
            ("head_horn", "down"): "assets/part/head/horn/head_horn_down.txt",
            ("hair_A", "up"): "assets/part/hair/A/hair_A_up.txt",
            ("hair_A_back", "left"): "assets/part/hair/A/hair_A_back_left.txt",
            ("eye_E0", "right"): "assets/part/eye/E0/eye_E0_right.txt",
            ("cloth_belt_female", "down"): "assets/part/cloth/belt_female/cloth_belt_female_down.txt",
            ("cloth_none", "down"): "assets/part/cloth/none/cloth_none_down.txt",
            ("gau_body", "down"): "assets/part/body/gau/gau_body_down.txt",
            ("female_gau_body", "up"): "assets/part/body/female/female_gau_body_up.txt",
            ("female_walk_a", "left"): "assets/part/body/female/female_walk_a_left.txt",
            ("female_body_idle2", "down"): "assets/part/body/female/female_body_idle2_down.txt",
        }
        for (name, d), expected in cases.items():
            self.assertEqual(part_path(name, d).as_posix(), expected, name)

    def test_template_keeps_the_direction_placeholder(self):
        self.assertEqual(part_path("head_bare", "{dir}").as_posix(), "assets/part/head/bare/head_bare_{dir}.txt")

    def test_unknown_name_stops(self):
        for name in ("cape_red", "hair_", "head__back", "female_", ""):
            with self.assertRaisesRegex(ValueError, "置き場が決まらない"):
                part_path(name, "down")

    def test_every_enemy_part_of_the_2026_10_12_layout_is_where_part_path_says(self):
        # 現役のアートは読まない（CLAUDE.md「回帰テストに現役のアートを参照させない」）。
        # 置き場を整理したとき（2026-10-12）の敵の部品108件のパスを、tests/fixtures/ に固定して比べる
        paths = (REPO_ROOT / "tests" / "fixtures" / "enemy_part_paths.txt").read_text(encoding="utf-8").split()
        self.assertEqual(len(paths), 108)
        for rel in paths:
            stem, d = Path(rel).stem.rsplit("_", 1)
            self.assertEqual(part_path(stem, d).as_posix(), rel)


if __name__ == "__main__":
    unittest.main()
