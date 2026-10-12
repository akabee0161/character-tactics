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
    EnemyError, Recipe, build, load_recipe, main, read_frame, recolor_frame, serialize_frame,
    source_colours, source_paths,
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
        self.assertEqual(source, Path("/forge/assets/unit/dagger-female"))
        self.assertEqual(sheet_def, Path("/forge/sheets/gau.txt"))

    def test_frames_names_the_source_directory(self):
        (self.dir / "frames" / "axe-x").mkdir(parents=True)
        recipe = load_recipe(self.write(self.good(archetype="axe", frames="frames/axe-x")), PALETTE)
        self.assertEqual(recipe.frames, "frames/axe-x")
        source, sheet_def = source_paths(recipe, self.dir)
        self.assertEqual(source, self.dir / "frames" / "axe-x")
        self.assertEqual(sheet_def, self.dir / "sheets" / "gau.txt")

    def test_frames_overrides_the_default_source_of_dagger(self):
        (self.dir / "frames").mkdir()
        recipe = load_recipe(self.write(self.good(frames="frames")), PALETTE)
        self.assertEqual(source_paths(recipe, self.dir)[0], self.dir / "frames")

    def test_axe_and_spear_need_frames(self):
        for archetype in ("axe", "spear"):
            with self.assertRaisesRegex(EnemyError, "frames で置き場を指す"):
                load_recipe(self.write(self.good(archetype=archetype)), PALETTE)

    def test_frames_must_stay_inside_the_repository(self):
        for bad in ("/tmp/x", "../x", "cand/../../x", ""):
            with self.assertRaisesRegex(EnemyError, "frames.*相対パス"):
                load_recipe(self.write(self.good(frames=bad)), PALETTE)
        with self.assertRaisesRegex(EnemyError, "frames.*相対パス"):
            load_recipe(self.write(self.good(frames=3)), PALETTE)

    def test_missing_frames_directory_is_named(self):
        recipe = load_recipe(self.write(self.good(frames="no/such/dir")), PALETTE)
        with self.assertRaisesRegex(EnemyError, "no/such/dir"):
            source_paths(recipe, self.dir)


STATES = ("base", "walk", "atk")
DIRS = ("down", "up", "left", "right")
NAMES = [f"{d}_{s}" for s in STATES for d in DIRS]
SHEET_DEF = "\n".join(["# frames: idle=1 walk=1 attack=1"] + NAMES) + "\n"
FRAME_TEXT = (
    "# type: unit\n# size: 32x32\n# light: upper-left\n# bg: transparent\n"
    "# map: o=outline b=cloth_base c=skin_base\n"
    + "\n".join(
        "".join({(10, 30): "b", (11, 30): "c", (10, 29): "o"}.get((x, y), ".") for x in range(32))
        for y in range(32)
    )
    + "\n"
)


class Fixture:
    """12コマ・1列の小さな元のコマと、そのシート定義。"""

    def __init__(self) -> None:
        self._tmp = tempfile.TemporaryDirectory()
        self.root = Path(self._tmp.name)
        self.src = self.root / "src"
        self.src.mkdir()
        for name in NAMES:
            (self.src / f"{name}.txt").write_text(FRAME_TEXT, encoding="utf-8")
        self.sheet_def = self.root / "def.txt"
        self.sheet_def.write_text(SHEET_DEF, encoding="utf-8")
        self.build_root = self.root / "build"
        self.sheet_dir = self.root / "sheets"

    def recipe(self, **change) -> enemy_build.Recipe:
        data = {"id": "t-a", "name": "テスト", "archetype": "dagger", "body": "male", "recolor": {}}
        data.update(change)
        return enemy_build.Recipe(**data)

    def build(self, recipe) -> Path:
        return build(recipe, self.src, self.sheet_def, PALETTE, self.build_root, self.sheet_dir)

    def close(self) -> None:
        self._tmp.cleanup()


class BuildTest(unittest.TestCase):
    def setUp(self):
        self.fx = Fixture()

    def tearDown(self):
        self.fx.close()

    def test_recolour_reaches_the_sheet(self):
        png = self.fx.build(self.fx.recipe(recolor={"cloth_base": "orchid_base"}))
        image = Image.open(png).convert("RGBA")
        self.assertEqual(image.size, (32, 32 * 12))
        self.assertEqual(image.getpixel((10, 30))[:3], PALETTE["orchid_base"])
        self.assertEqual(image.getpixel((11, 30))[:3], PALETTE["skin_base"])

    def test_without_recolour_the_colours_are_unchanged(self):
        png = self.fx.build(self.fx.recipe())
        self.assertEqual(Image.open(png).convert("RGBA").getpixel((10, 30))[:3], PALETTE["cloth_base"])

    def test_same_recipe_gives_the_same_png(self):
        recipe = self.fx.recipe(recolor={"cloth_base": "orchid_base"})
        first = self.fx.build(recipe).read_bytes()
        second = self.fx.build(recipe).read_bytes()
        self.assertEqual(first, second)

    def test_stale_frames_from_an_older_build_are_removed(self):
        recipe = self.fx.recipe()
        self.fx.build(recipe)
        stale = self.fx.build_root / "t-a" / "old_frame.txt"
        stale.write_text("stale", encoding="utf-8")
        self.fx.build(recipe)
        self.assertFalse(stale.exists())
        self.assertTrue((self.fx.build_root / "t-a" / "down_base.txt").exists())

    def test_recolor_key_that_no_frame_uses_is_refused_by_name(self):
        with self.assertRaisesRegex(EnemyError, "cloth_hi"):
            self.fx.build(self.fx.recipe(recolor={"cloth_hi": "orchid_hi"}))

    def test_merging_two_colours_warns_but_builds(self):
        err = io.StringIO()
        with contextlib.redirect_stderr(err):
            png = self.fx.build(self.fx.recipe(recolor={"cloth_base": "skin_base"}))
        self.assertTrue(png.exists())
        self.assertIn("色に減った", err.getvalue())

    def test_source_colours_lists_every_colour_the_sheet_uses(self):
        self.assertEqual(source_colours(self.fx.src, self.fx.sheet_def), {"outline", "cloth_base", "skin_base"})

    def test_source_colours_names_a_missing_source_directory(self):
        with self.assertRaisesRegex(EnemyError, "no-such-src.*元のコマの置き場が無い"):
            source_colours(self.fx.root / "no-such-src", self.fx.sheet_def)

    def test_a_sheet_definition_that_disagrees_with_its_declaration_is_refused(self):
        self.fx.sheet_def.write_text(SHEET_DEF.replace("idle=1", "idle=2"), encoding="utf-8")
        with self.assertRaisesRegex(EnemyError, "idle"):
            self.fx.build(self.fx.recipe())


class MainTest(unittest.TestCase):
    def test_the_same_id_in_two_files_is_refused_before_building(self):
        with tempfile.TemporaryDirectory() as tmp:
            paths = []
            for sub in ("a", "b"):
                path = Path(tmp) / sub / "dagger-dup-m.json"
                path.parent.mkdir()
                path.write_text(json.dumps({"id": "dagger-dup-m", "name": "x", "archetype": "dagger", "body": "male"}),
                                encoding="utf-8")
                paths.append(str(path))
            err = io.StringIO()
            with contextlib.redirect_stderr(err):
                code = main(paths)
        self.assertEqual(code, 2)
        self.assertIn("重複", err.getvalue())

    def test_no_recipe_given_is_an_error(self):
        err = io.StringIO()
        with contextlib.redirect_stderr(err):
            self.assertEqual(main([]), 2)


if __name__ == "__main__":
    unittest.main()
