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
import palette as palette_mod  # noqa: E402
from gridfile import load_colours  # noqa: E402

PALETTE = palette_mod.load()
COLOURS = load_colours()


def blank() -> list[list[str | None]]:
    return [[None] * 32 for _ in range(32)]


class RecolorTest(unittest.TestCase):
    def test_swap_is_simultaneous(self):
        frame = [["clothes_blue_base", "skin_fair_base", None]]
        swapped = recolor_frame(frame, {"clothes_blue_base": "skin_fair_base", "skin_fair_base": "clothes_blue_base"})
        self.assertEqual(swapped, [["skin_fair_base", "clothes_blue_base", None]])

    def test_unmapped_colours_and_transparent_stay(self):
        frame = [["contour", "clothes_blue_base", None]]
        self.assertEqual(recolor_frame(frame, {"clothes_blue_base": "orchid_base"}), [["contour", "orchid_base", None]])

    def test_input_is_not_modified(self):
        frame = [["clothes_blue_base"]]
        recolor_frame(frame, {"clothes_blue_base": "orchid_base"})
        self.assertEqual(frame, [["clothes_blue_base"]])


class SerializeTest(unittest.TestCase):
    def test_round_trip_keeps_every_pixel(self):
        frame = blank()
        frame[30][10] = "contour"
        frame[30][11] = "clothes_blue_base"
        frame[29][11] = "skin_fair_base"
        frame[29][12] = "clothes_blue_base"
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "f.txt"
            path.write_text(serialize_frame(frame, "テストのコマ"), encoding="utf-8")
            self.assertEqual(read_frame(path), frame)

    def test_outline_uses_the_letter_o(self):
        frame = blank()
        frame[0][0] = "clothes_blue_base"
        frame[0][1] = "contour"
        self.assertIn("o=contour", serialize_frame(frame, "x"))

    def test_same_frame_gives_same_text(self):
        frame = blank()
        frame[5][5] = "skin_fair_base"
        frame[5][6] = "clothes_blue_base"
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
                "recolor": {"clothes_blue_base": "orchid_base"}}
        data.update(change)
        return data

    def test_valid_recipe_is_read(self):
        recipe = load_recipe(self.write(self.good()), PALETTE)
        self.assertEqual((recipe.id, recipe.archetype, recipe.body), ("dagger-test-m", "dagger", "male"))
        self.assertEqual(recipe.recolor, {"clothes_blue_base": "orchid_base"})

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
        with self.assertRaisesRegex(EnemyError, "色見本に無い.*no_such_colour"):
            load_recipe(self.write(self.good(recolor={"clothes_blue_base": "no_such_colour"})), PALETTE)
        with self.assertRaisesRegex(EnemyError, "用途の色に無い.*typo_colour"):
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
    "# map: o=contour b=clothes_blue_base c=skin_fair_base\n"
    + "\n".join(
        "".join({(10, 30): "b", (11, 30): "c", (10, 29): "o"}.get((x, y), ".") for x in range(32))
        for y in range(32)
    )
    + "\n"
)


class Fixture:
    """12コマ・1列の小さな元のコマと、そのシート定義。"""

    def __init__(self, frame_text: str = FRAME_TEXT) -> None:
        self._tmp = tempfile.TemporaryDirectory()
        self.root = Path(self._tmp.name)
        self.src = self.root / "src"
        self.src.mkdir()
        for name in NAMES:
            (self.src / f"{name}.txt").write_text(frame_text, encoding="utf-8")
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
        png = self.fx.build(self.fx.recipe(recolor={"clothes_blue_base": "orchid_base"}))
        image = Image.open(png).convert("RGBA")
        self.assertEqual(image.size, (32, 32 * 12))
        self.assertEqual(image.getpixel((10, 30))[:3], COLOURS["orchid_base"])
        self.assertEqual(image.getpixel((11, 30))[:3], COLOURS["skin_fair_base"])

    def test_without_recolour_the_colours_are_unchanged(self):
        png = self.fx.build(self.fx.recipe())
        self.assertEqual(Image.open(png).convert("RGBA").getpixel((10, 30))[:3], COLOURS["clothes_blue_base"])

    def test_same_recipe_gives_the_same_png(self):
        recipe = self.fx.recipe(recolor={"clothes_blue_base": "orchid_base"})
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
        with self.assertRaisesRegex(EnemyError, "clothes_blue_hi"):
            self.fx.build(self.fx.recipe(recolor={"clothes_blue_hi": "orchid_hi"}))

    def test_merging_two_colours_warns_but_builds(self):
        err = io.StringIO()
        with contextlib.redirect_stderr(err):
            png = self.fx.build(self.fx.recipe(recolor={"clothes_blue_base": "skin_base"}))
        self.assertTrue(png.exists())
        self.assertIn("色に減った", err.getvalue())

    def test_source_colours_lists_every_colour_the_sheet_uses(self):
        self.assertEqual(source_colours(self.fx.src, self.fx.sheet_def), {"contour", "clothes_blue_base", "skin_fair_base"})

    def test_source_colours_names_a_missing_source_directory(self):
        with self.assertRaisesRegex(EnemyError, "no-such-src.*元のコマの置き場が無い"):
            source_colours(self.fx.root / "no-such-src", self.fx.sheet_def)

    def test_a_sheet_definition_that_disagrees_with_its_declaration_is_refused(self):
        self.fx.sheet_def.write_text(SHEET_DEF.replace("idle=1", "idle=2"), encoding="utf-8")
        with self.assertRaisesRegex(EnemyError, "idle"):
            self.fx.build(self.fx.recipe())


SWATCHES = {
    "outline": "#101018",
    "cloak_dark_base": "#40404c",
    "floor_shadow": "#5a4a3a",
    "skin_base": "#e0a080",
}
USES = {
    "contour": ("outline", "outline"),
    "cloth_main_base": ("cloak_dark_base", "cloth"),
    "cloth_trim": ("cloak_dark_base", "cloth"),
    "skin_main": ("skin_base", "skin"),
}
SWATCH_FRAME_TEXT = (
    "# type: unit\n# size: 32x32\n# light: upper-left\n# bg: transparent\n"
    "# map: o=contour b=cloth_main_base t=cloth_trim c=skin_main\n"
    + "\n".join(
        "".join({(10, 30): "b", (11, 30): "c", (12, 30): "t", (10, 29): "o"}.get((x, y), ".") for x in range(32))
        for y in range(32)
    )
    + "\n"
)


def write_palette(root: Path) -> None:
    """用途の色 → 色見本 の小さなパレット（palette.load で読める形）。"""
    (root / "uses").mkdir(parents=True)
    (root / "swatches.json").write_text(
        json.dumps({k: {"hex": v, "note": k} for k, v in SWATCHES.items()}), encoding="utf-8")
    (root / "kinds.json").write_text(
        json.dumps({k: {"note": k} for k in ("outline", "cloth", "skin")}), encoding="utf-8")
    (root / "uses" / "unit.json").write_text(
        json.dumps({k: {"swatch": s, "kind": kind, "note": k} for k, (s, kind) in USES.items()}), encoding="utf-8")


def hex_rgb(value: str) -> tuple[int, int, int]:
    return tuple(int(value[i:i + 2], 16) for i in (1, 3, 5))


class SwatchRecolorTest(unittest.TestCase):
    """recolor は「用途の色 → 色見本」。シートは色見本の値で描く（2026-10-30 パレットの分割）。"""

    def setUp(self):
        self.fx = Fixture(SWATCH_FRAME_TEXT)
        write_palette(self.fx.root / "palette")
        self.pal = palette_mod.load(self.fx.root / "palette")

    def tearDown(self):
        self.fx.close()

    def recipe_file(self, recolor) -> Path:
        path = self.fx.root / "dagger-t-m.json"
        path.write_text(json.dumps({"id": "dagger-t-m", "name": "t", "archetype": "dagger", "body": "male",
                                    "recolor": recolor}), encoding="utf-8")
        return path

    def build(self, recolor) -> Path:
        recipe = load_recipe(self.recipe_file(recolor), self.pal)
        return build(recipe, self.fx.src, self.fx.sheet_def, self.pal, self.fx.build_root, self.fx.sheet_dir)

    def test_recolor_to_swatch(self):
        png = self.build({"cloth_main_base": "floor_shadow"})
        image = Image.open(png).convert("RGBA")
        self.assertEqual(image.getpixel((10, 30))[:3], hex_rgb(SWATCHES["floor_shadow"]))
        self.assertEqual(image.getpixel((11, 30))[:3], hex_rgb(SWATCHES["skin_base"]))
        self.assertEqual(image.getpixel((10, 29))[:3], hex_rgb(SWATCHES["outline"]))

    def test_recolor_value_must_be_a_swatch(self):
        # 用途の色の名前は色見本ではない
        with self.assertRaisesRegex(EnemyError, "色見本に無い.*skin_main"):
            load_recipe(self.recipe_file({"cloth_main_base": "skin_main"}), self.pal)
        with self.assertRaisesRegex(EnemyError, "色見本に無い.*no_such_swatch"):
            load_recipe(self.recipe_file({"cloth_main_base": "no_such_swatch"}), self.pal)

    def test_recolor_key_must_be_a_use(self):
        # 色見本の名前は用途の色ではない
        with self.assertRaisesRegex(EnemyError, "用途の色に無い.*cloak_dark_base"):
            load_recipe(self.recipe_file({"cloak_dark_base": "floor_shadow"}), self.pal)

    def test_recolor_merge_warning_counts_values(self):
        # 同じ色見本を指す2つの用途の色を同じ色見本へ替えても、色の値の数は減らない → 警告しない
        err = io.StringIO()
        with contextlib.redirect_stderr(err):
            self.build({"cloth_main_base": "floor_shadow", "cloth_trim": "floor_shadow"})
        self.assertNotIn("色に減った", err.getvalue())
        # 名前は別でも、行き先の値が肌と同じなら色の値は減る → 警告する
        err = io.StringIO()
        with contextlib.redirect_stderr(err):
            self.build({"cloth_main_base": "skin_base", "cloth_trim": "skin_base"})
        self.assertIn("3 色が 2 色に減った", err.getvalue())


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
