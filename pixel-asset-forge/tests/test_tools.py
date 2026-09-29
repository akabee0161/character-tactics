"""Checks for the grid parser, the machine checks, and the renderer.

    .venv/bin/python -m unittest discover -s tests
"""
from __future__ import annotations

import contextlib
import sys
import tempfile
import unittest
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT / "tools"))

from gridfile import TRANSFORMS, GridError, check, load_palette, parse, parse_background  # noqa: E402
from render import output_dir, to_image  # noqa: E402
from validate import collect, default_targets  # noqa: E402

PALETTE = {"outline": (10, 20, 30), "skin_base": (200, 150, 100)}

GOOD = """\
# type: face
# size: 4x3
# light: upper-left
# map: o=outline b=skin_base
oooo
obbo
oooo
"""


def write(text: str) -> Path:
    handle = tempfile.NamedTemporaryFile("w", suffix=".txt", delete=False, encoding="utf-8")
    handle.write(text)
    handle.close()
    return Path(handle.name)


class ParseTest(unittest.TestCase):
    def test_reads_headers_and_rows(self):
        grid = parse(write(GOOD))
        self.assertEqual(grid.type, "face")
        self.assertEqual((grid.width, grid.height), (4, 3))
        self.assertEqual(grid.charmap, {"o": "outline", "b": "skin_base"})
        self.assertEqual(grid.headers["light"], "upper-left")
        self.assertEqual(len(grid.rows), 3)

    def test_map_may_span_several_lines(self):
        grid = parse(write(GOOD.replace("# map: o=outline b=skin_base", "# map: o=outline\n# map: b=skin_base")))
        self.assertEqual(grid.charmap, {"o": "outline", "b": "skin_base"})

    def test_blank_lines_are_ignored(self):
        grid = parse(write(GOOD.replace("# map:", "\n# map:")))
        self.assertEqual(len(grid.rows), 3)

    def test_missing_required_header(self):
        with self.assertRaisesRegex(GridError, "missing required header"):
            parse(write(GOOD.replace("# size: 4x3\n", "")))

    def test_header_after_rows(self):
        with self.assertRaisesRegex(GridError, "header line after grid rows"):
            parse(write(GOOD + "# light: upper-left\n"))

    def test_background_cannot_be_mapped(self):
        with self.assertRaisesRegex(GridError, "background and cannot be mapped"):
            parse(write(GOOD.replace("o=outline", ".=outline")))

    def test_conflicting_map_entry(self):
        with self.assertRaisesRegex(GridError, "mapped twice"):
            parse(write(GOOD.replace("b=skin_base", "b=skin_base o=skin_base")))

    def test_bad_size(self):
        with self.assertRaisesRegex(GridError, "is not 'WxH'"):
            parse(write(GOOD.replace("4x3", "four")))

    def test_no_rows(self):
        with self.assertRaisesRegex(GridError, "no grid rows"):
            parse(write("# type: face\n# size: 4x3\n# map: o=outline\n"))


class CheckTest(unittest.TestCase):
    def test_clean_grid_has_no_errors(self):
        self.assertEqual(check(parse(write(GOOD)), PALETTE), [])

    def test_row_length(self):
        errors = check(parse(write(GOOD.replace("obbo", "obbbo"))), PALETTE)
        self.assertIn("row 1: length 5, expected 4", errors)

    def test_row_count(self):
        errors = check(parse(write(GOOD + "oooo\n")), PALETTE)
        self.assertIn("height 4, expected 3", errors)

    def test_unknown_character(self):
        errors = check(parse(write(GOOD.replace("obbo", "oxbo"))), PALETTE)
        self.assertIn("row 1: character 'x' is not bound by 'map'", errors)

    def test_colour_outside_master_palette(self):
        errors = check(parse(write(GOOD.replace("b=skin_base", "b=not_a_colour"))), PALETTE)
        self.assertIn("map references 'not_a_colour', which is not in the master palette", errors)

    def test_reports_every_problem_at_once(self):
        broken = GOOD.replace("obbo", "oxbbo")
        self.assertEqual(len(check(parse(write(broken)), PALETTE)), 2)

    def test_max_colors_respected(self):
        self.assertEqual(check(parse(write(GOOD.replace("# map:", "# max_colors: 2\n# map:"))), PALETTE), [])
        errors = check(parse(write(GOOD.replace("# map:", "# max_colors: 1\n# map:"))), PALETTE)
        self.assertIn("uses 2 colours, over the declared max_colors 1", errors)

    def test_max_colors_counts_distinct_rgb_not_entries(self):
        palette = dict(PALETTE, skin_base=PALETTE["outline"])
        grid = parse(write(GOOD.replace("# map:", "# max_colors: 1\n# map:")))
        self.assertEqual(check(grid, palette), [])


class BackgroundTest(unittest.TestCase):
    def test_transparent_is_the_default(self):
        self.assertTrue(parse(write(GOOD)).background.has_alpha)

    def test_solid(self):
        background = parse_background("#102030")
        self.assertEqual(background.color_at(0, 4), (16, 32, 48, 255))
        self.assertEqual(background.color_at(3, 4), (16, 32, 48, 255))

    def test_gradient_interpolates_top_to_bottom(self):
        background = parse_background("gradient:#000000->#0a0a0a")
        self.assertEqual(background.color_at(0, 11), (0, 0, 0, 255))
        self.assertEqual(background.color_at(5, 11), (5, 5, 5, 255))
        self.assertEqual(background.color_at(10, 11), (10, 10, 10, 255))

    def test_unsupported_spec(self):
        with self.assertRaisesRegex(GridError, "unsupported bg"):
            parse_background("rainbow")


class RenderTest(unittest.TestCase):
    def test_pixels_come_from_the_palette(self):
        image = to_image(parse(write(GOOD)), PALETTE)
        self.assertEqual(image.size, (4, 3))
        self.assertEqual(image.mode, "RGBA")
        self.assertEqual(image.getpixel((0, 0)), (*PALETTE["outline"], 255))
        self.assertEqual(image.getpixel((1, 1)), (*PALETTE["skin_base"], 255))

    def test_background_cells_are_transparent_by_default(self):
        image = to_image(parse(write(GOOD.replace("obbo", "o..o"))), PALETTE)
        self.assertEqual(image.getpixel((1, 1)), (0, 0, 0, 0))

    def test_opaque_background_drops_alpha(self):
        image = to_image(parse(write(GOOD.replace("# map:", "# bg: #102030\n# map:"))), PALETTE)
        self.assertEqual(image.mode, "RGB")

    def test_scale_is_nearest_neighbour(self):
        image = to_image(parse(write(GOOD)), PALETTE, scale=8)
        self.assertEqual(image.size, (32, 24))
        self.assertEqual(image.getpixel((8, 8)), (*PALETTE["skin_base"], 255))


class TargetPathTest(unittest.TestCase):
    """A relative target used to leak through as a relative output path."""

    REFERENCE = "types/face/reference/knight.txt"

    def test_relative_target_becomes_absolute(self):
        with contextlib.chdir(REPO_ROOT):
            grids = collect([Path(self.REFERENCE)])
        self.assertEqual(grids, [REPO_ROOT / self.REFERENCE])

    def test_target_outside_the_working_directory_resolves(self):
        with contextlib.chdir(REPO_ROOT / "tools"):
            grids = collect([Path("..") / self.REFERENCE])
        self.assertEqual(grids, [REPO_ROOT / self.REFERENCE])

    def test_missing_target_is_rejected(self):
        with self.assertRaises(SystemExit):
            collect([REPO_ROOT / "assets" / "nope.txt"])

    def test_assets_render_into_build(self):
        self.assertEqual(
            output_dir(REPO_ROOT / "assets" / "item" / "chest.txt", None),
            REPO_ROOT / "build" / "item",
        )

    def test_references_render_beside_the_grid(self):
        path = REPO_ROOT / self.REFERENCE
        self.assertEqual(output_dir(path, None), path.parent)

    def test_relative_override_is_resolved(self):
        with contextlib.chdir(REPO_ROOT / "tools"):
            self.assertEqual(output_dir(REPO_ROOT / "assets" / "a.txt", Path("out")), REPO_ROOT / "tools" / "out")


class DefaultTargetsTest(unittest.TestCase):
    """Unit bodies live in types/unit/base; every tool used to skip them."""

    def make_tree(self, *dirs: str) -> Path:
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        root = Path(tmp.name)
        for d in dirs:
            (root / d).mkdir(parents=True)
        return root

    def test_bases_follow_references(self):
        root = self.make_tree("assets", "types/face/reference", "types/unit/reference", "types/unit/base")
        self.assertEqual(
            default_targets(root),
            [
                root / "assets",
                root / "types/face/reference",
                root / "types/unit/reference",
                root / "types/unit/base",
            ],
        )

    def test_a_type_with_only_a_base_is_included(self):
        root = self.make_tree("assets", "types/unit/base")
        self.assertEqual(default_targets(root), [root / "assets", root / "types/unit/base"])

    def test_missing_directories_are_left_out(self):
        root = self.make_tree("types/tile")
        self.assertEqual(default_targets(root), [])


class TransformTest(unittest.TestCase):
    ROWS = ["ab", "cd", "ef"]  # 2 wide, 3 tall, so the rotations are visible

    def test_mirror_x(self):
        self.assertEqual(TRANSFORMS["mirror_x"](self.ROWS), ["ba", "dc", "fe"])

    def test_mirror_y(self):
        self.assertEqual(TRANSFORMS["mirror_y"](self.ROWS), ["ef", "cd", "ab"])

    def test_rotate_180_is_both_mirrors(self):
        both = TRANSFORMS["mirror_x"](TRANSFORMS["mirror_y"](self.ROWS))
        self.assertEqual(TRANSFORMS["rotate_180"](self.ROWS), both)
        self.assertEqual(TRANSFORMS["rotate_180"](self.ROWS), ["fe", "dc", "ba"])

    def test_rotate_cw_swaps_the_axes(self):
        self.assertEqual(TRANSFORMS["rotate_cw"](self.ROWS), ["eca", "fdb"])

    def test_rotate_ccw_swaps_the_axes(self):
        self.assertEqual(TRANSFORMS["rotate_ccw"](self.ROWS), ["bdf", "ace"])

    def test_four_quarter_turns_return_to_the_start(self):
        rows = self.ROWS
        for _ in range(4):
            rows = TRANSFORMS["rotate_cw"](rows)
        self.assertEqual(rows, self.ROWS)


class DerivedGridTest(unittest.TestCase):
    SOURCE = "# type: tile\n# size: 2x3\n# light: upper-left\n# map: a=outline b=skin_base\n" "ab\nba\nab\n"

    def setUp(self):
        self.directory = Path(tempfile.mkdtemp())
        (self.directory / "source.txt").write_text(self.SOURCE, encoding="utf-8")

    def derived(self, body: str, name: str = "derived.txt") -> Path:
        path = self.directory / name
        path.write_text(body, encoding="utf-8")
        return path

    def test_transform_is_applied(self):
        grid = parse(self.derived("# from: source.txt\n# transform: mirror_x\n"))
        self.assertEqual(grid.rows, ["ba", "ab", "ba"])

    def test_headers_are_inherited(self):
        grid = parse(self.derived("# from: source.txt\n# transform: mirror_x\n"))
        self.assertEqual(grid.type, "tile")
        self.assertEqual((grid.width, grid.height), (2, 3))
        self.assertEqual(grid.charmap, {"a": "outline", "b": "skin_base"})
        self.assertEqual(grid.headers["light"], "upper-left")

    def test_a_stated_header_overrides_the_inherited_one(self):
        grid = parse(self.derived("# from: source.txt\n# transform: mirror_x\n# type: item\n"))
        self.assertEqual(grid.type, "item")

    def test_rotation_swaps_the_declared_size(self):
        grid = parse(self.derived("# from: source.txt\n# transform: rotate_cw\n"))
        self.assertEqual((grid.width, grid.height), (3, 2))
        self.assertEqual(grid.rows, ["aba", "bab"])

    def test_rows_of_its_own_are_rejected(self):
        with self.assertRaisesRegex(GridError, "must have no grid rows"):
            parse(self.derived("# from: source.txt\n# transform: mirror_x\nab\n"))

    def test_transform_is_required(self):
        with self.assertRaisesRegex(GridError, "needs a 'transform'"):
            parse(self.derived("# from: source.txt\n"))

    def test_unknown_transform(self):
        with self.assertRaisesRegex(GridError, "unknown transform"):
            parse(self.derived("# from: source.txt\n# transform: shear\n"))

    def test_missing_source(self):
        with self.assertRaises(GridError):
            parse(self.derived("# from: nope.txt\n# transform: mirror_x\n"))

    def test_self_reference(self):
        with self.assertRaisesRegex(GridError, "cycle"):
            parse(self.derived("# from: derived.txt\n# transform: mirror_x\n"))

    def test_two_file_cycle(self):
        self.derived("# from: pong.txt\n# transform: mirror_x\n", "ping.txt")
        self.derived("# from: ping.txt\n# transform: mirror_x\n", "pong.txt")
        with self.assertRaisesRegex(GridError, "cycle"):
            parse(self.directory / "ping.txt")

    def test_a_chain_of_derivations_resolves(self):
        self.derived("# from: source.txt\n# transform: mirror_x\n", "one.txt")
        grid = parse(self.derived("# from: one.txt\n# transform: mirror_x\n", "two.txt"))
        self.assertEqual(grid.rows, ["ab", "ba", "ab"])


class CommentTest(unittest.TestCase):
    def test_a_hash_line_without_a_colon_is_a_comment(self):
        grid = parse(write(GOOD.replace("# map:", "#\n# why this shape\n# map:")))
        self.assertEqual(len(grid.rows), 3)

    def test_a_hash_line_with_a_colon_must_still_parse(self):
        with self.assertRaisesRegex(GridError, "malformed header"):
            parse(write(GOOD.replace("# map:", "# NotAKey: x\n# map:")))


class RiverDerivationTest(unittest.TestCase):
    """The shipped bends are derived, so this pins the migration."""

    TILES = REPO_ROOT / "assets" / "tile"

    def test_nw_is_ne_mirrored(self):
        source = parse(self.TILES / "river_ne.txt")
        self.assertEqual(parse(self.TILES / "river_nw.txt").rows, TRANSFORMS["mirror_x"](source.rows))

    def test_se_is_ne_flipped(self):
        source = parse(self.TILES / "river_ne.txt")
        self.assertEqual(parse(self.TILES / "river_se.txt").rows, TRANSFORMS["mirror_y"](source.rows))

    def test_sw_is_ne_turned_around(self):
        source = parse(self.TILES / "river_ne.txt")
        self.assertEqual(parse(self.TILES / "river_sw.txt").rows, TRANSFORMS["rotate_180"](source.rows))

    def test_the_derived_bends_carry_no_rows_of_their_own(self):
        for name in ("river_nw", "river_se", "river_sw"):
            with self.subTest(name):
                text = (self.TILES / f"{name}.txt").read_text(encoding="utf-8")
                self.assertTrue(all(line.startswith("#") or not line.strip() for line in text.splitlines()))


class MasterPaletteTest(unittest.TestCase):
    def test_master_palette_loads(self):
        palette = load_palette()
        self.assertIn("outline", palette)
        self.assertTrue(all(len(rgb) == 3 for rgb in palette.values()))

    def test_face_reference_passes_its_own_checks(self):
        grid = parse(REPO_ROOT / "types" / "face" / "reference" / "knight.txt")
        self.assertEqual(check(grid, load_palette()), [])
        self.assertEqual((grid.width, grid.height), (32, 32))


if __name__ == "__main__":
    unittest.main()
