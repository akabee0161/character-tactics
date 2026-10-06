"""Checks for tools/enemy_build.py (味方の完成コマの色替えで敵のシートを作る)."""
from __future__ import annotations

import contextlib
import io
import json
import sys
import tempfile
import unittest
from pathlib import Path

from PIL import Image

REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT / "tools"))

import enemy_build  # noqa: E402
from enemy_build import (  # noqa: E402
    EnemyError, Recipe, load_recipe, read_frame, recolor_frame, serialize_frame, source_paths,
)
from gridfile import load_palette  # noqa: E402

PALETTE = load_palette()


def blank() -> list[list[str | None]]:
    return [[None] * 32 for _ in range(32)]


class RecolorTest(unittest.TestCase):
    def test_swap_is_simultaneous(self):
        frame = [["cloth_base", "skin_base", None]]
        swapped = recolor_frame(frame, {"cloth_base": "skin_base", "skin_base": "cloth_base"})
        self.assertEqual(swapped, [["skin_base", "cloth_base", None]])

    def test_unmapped_colours_and_transparent_stay(self):
        frame = [["outline", "cloth_base", None]]
        self.assertEqual(recolor_frame(frame, {"cloth_base": "orchid_base"}), [["outline", "orchid_base", None]])

    def test_input_is_not_modified(self):
        frame = [["cloth_base"]]
        recolor_frame(frame, {"cloth_base": "orchid_base"})
        self.assertEqual(frame, [["cloth_base"]])


class SerializeTest(unittest.TestCase):
    def test_round_trip_keeps_every_pixel(self):
        frame = blank()
        frame[30][10] = "outline"
        frame[30][11] = "cloth_base"
        frame[29][11] = "skin_base"
        frame[29][12] = "cloth_base"
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "f.txt"
            path.write_text(serialize_frame(frame, "テストのコマ"), encoding="utf-8")
            self.assertEqual(read_frame(path), frame)

    def test_outline_uses_the_letter_o(self):
        frame = blank()
        frame[0][0] = "cloth_base"
        frame[0][1] = "outline"
        self.assertIn("o=outline", serialize_frame(frame, "x"))

    def test_same_frame_gives_same_text(self):
        frame = blank()
        frame[5][5] = "skin_base"
        frame[5][6] = "cloth_base"
        self.assertEqual(serialize_frame(frame, "x"), serialize_frame(frame, "x"))

    def test_colon_in_note_is_refused(self):
        with self.assertRaises(EnemyError):
            serialize_frame(blank(), "a: b")


class RecipeTest(unittest.TestCase):
    def setUp(self):
        self._tmp = tempfile.TemporaryDirectory()
        self.dir = Path(self._tmp.name)

    def tearDown(self):
        self._tmp.cleanup()

    def write(self, data, name="dagger-test-m.json") -> Path:
        path = self.dir / name
        path.write_text(data if isinstance(data, str) else json.dumps(data), encoding="utf-8")
        return path

    def good(self, **change):
        data = {"id": "dagger-test-m", "name": "テスト", "archetype": "dagger", "body": "male",
                "recolor": {"cloth_base": "orchid_base"}}
        data.update(change)
        return data

    def test_valid_recipe_is_read(self):
        recipe = load_recipe(self.write(self.good()), PALETTE)
        self.assertEqual((recipe.id, recipe.archetype, recipe.body), ("dagger-test-m", "dagger", "male"))
        self.assertEqual(recipe.recolor, {"cloth_base": "orchid_base"})

    def test_recolor_is_optional(self):
        data = self.good()
        del data["recolor"]
        self.assertEqual(load_recipe(self.write(data), PALETTE).recolor, {})

    def test_unknown_key_is_refused_with_the_allowed_ones(self):
        with self.assertRaisesRegex(EnemyError, "知らないキー head"):
            load_recipe(self.write(self.good(head="cap")), PALETTE)

    def test_missing_required_key(self):
        data = self.good()
        del data["name"]
        with self.assertRaisesRegex(EnemyError, "name"):
            load_recipe(self.write(data), PALETTE)

    def test_id_must_match_the_file_name(self):
        with self.assertRaisesRegex(EnemyError, "ファイル名"):
            load_recipe(self.write(self.good(id="dagger-other-m")), PALETTE)

    def test_id_with_path_characters_is_refused(self):
        path = self.write(self.good(id="../x"), name="x.json")
        with self.assertRaisesRegex(EnemyError, "id は"):
            load_recipe(path, PALETTE)

    def test_uppercase_id_is_refused(self):
        path = self.write(self.good(id="Dagger"), name="Dagger.json")
        with self.assertRaisesRegex(EnemyError, "id は"):
            load_recipe(path, PALETTE)

    def test_unknown_archetype_and_body(self):
        with self.assertRaisesRegex(EnemyError, "archetype"):
            load_recipe(self.write(self.good(archetype="staff")), PALETTE)
        with self.assertRaisesRegex(EnemyError, "body"):
            load_recipe(self.write(self.good(body="other")), PALETTE)

    def test_colour_not_in_palette(self):
        with self.assertRaisesRegex(EnemyError, "パレットに無い.*no_such_colour"):
            load_recipe(self.write(self.good(recolor={"cloth_base": "no_such_colour"})), PALETTE)
        with self.assertRaisesRegex(EnemyError, "パレットに無い.*typo_colour"):
            load_recipe(self.write(self.good(recolor={"typo_colour": "orchid_base"})), PALETTE)

    def test_not_json(self):
        with self.assertRaisesRegex(EnemyError, "JSON として読めない"):
            load_recipe(self.write("{not json"), PALETTE)

    def test_source_paths_follow_archetype_and_body(self):
        recipe = Recipe("a", "A", "dagger", "female", {})
        source, sheet_def = source_paths(recipe, Path("/forge"))
        self.assertEqual(source, Path("/forge/assets/unit/enemy-src/dagger-female"))
        self.assertEqual(sheet_def, Path("/forge/sheets/gau.txt"))


if __name__ == "__main__":
    unittest.main()
