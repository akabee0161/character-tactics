"""Checks for the colour separation report.

    .venv/bin/python -m unittest discover -s tests
"""
from __future__ import annotations

import sys
import tempfile
import unittest
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT / "tools"))

from check_colors import (  # noqa: E402
    adjacent_pairs,
    cell_name_grid,
    delta_e,
    has_lightness_edge,
    inspect,
    rgb_to_lab,
    swatch_view,
)
import palette as palette_mod  # noqa: E402
from gridfile import parse  # noqa: E402


def live_swatches():
    """現役のパレットを色見本の段で（check_colors.py の main と同じ）。"""
    return swatch_view(palette_mod.load())


def write(text: str) -> Path:
    handle = tempfile.NamedTemporaryFile("w", suffix=".txt", delete=False, encoding="utf-8")
    handle.write(text)
    handle.close()
    return Path(handle.name)


def grid_of(rows: list[str], mapping: str, size: str | None = None) -> object:
    header = f"# type: test\n# size: {size or f'{len(rows[0])}x{len(rows)}'}\n# map: {mapping}\n"
    return parse(write(header + "\n".join(rows) + "\n"))


class LabTest(unittest.TestCase):
    def test_black_and_white_anchor_the_scale(self):
        self.assertAlmostEqual(rgb_to_lab((0, 0, 0))[0], 0.0, places=4)
        self.assertAlmostEqual(rgb_to_lab((255, 255, 255))[0], 100.0, places=3)

    def test_mid_grey_is_perceptually_below_the_midpoint(self):
        # sRGB 128 sits near L* 53, not 50 - the curve is why we use Lab at all.
        self.assertAlmostEqual(rgb_to_lab((128, 128, 128))[0], 53.6, places=1)

    def test_identical_colours_have_zero_distance(self):
        self.assertEqual(delta_e(rgb_to_lab((10, 20, 30)), rgb_to_lab((10, 20, 30))), 0.0)


class LightnessEdgeTest(unittest.TestCase):
    def test_absolute_step_is_enough(self):
        # L* 20 vs L* 50: a 0.30 step, over the 0.22 threshold.
        self.assertTrue(has_lightness_edge((20.0, 0.0, 0.0), (50.0, 0.0, 0.0)))

    def test_ratio_is_enough_where_the_absolute_step_is_small(self):
        # L* 5 vs L* 12: only a 0.07 step, but a 2.4x ratio, which reads in shadow.
        self.assertTrue(has_lightness_edge((5.0, 0.0, 0.0), (12.0, 0.0, 0.0)))

    def test_neither_axis_clears(self):
        self.assertFalse(has_lightness_edge((50.0, 0.0, 0.0), (55.0, 0.0, 0.0)))


class AdjacencyTest(unittest.TestCase):
    MAPPING = "a=outline b=skin_base c=skin_hi"

    def test_only_differing_neighbours_form_a_pair(self):
        grid = grid_of(["ab", "ab"], self.MAPPING)
        pairs = adjacent_pairs(cell_name_grid(grid))
        self.assertEqual(set(pairs), {("outline", "skin_base")})

    def test_same_colour_touching_itself_is_not_a_pair(self):
        """This is exactly why the check cannot see a course that vanished into
        the wall shadow: the two regions were the same colour."""
        grid = grid_of(["aa", "aa"], self.MAPPING)
        self.assertEqual(adjacent_pairs(cell_name_grid(grid)), {})

    def test_pair_counts_every_touching_edge(self):
        grid = grid_of(["ab", "ab"], self.MAPPING)
        count, first = adjacent_pairs(cell_name_grid(grid))[("outline", "skin_base")]
        self.assertEqual(count, 2)
        self.assertEqual(first, (0, 0))

    def test_background_cells_are_skipped(self):
        grid = grid_of(["a.", ".b"], self.MAPPING)
        self.assertEqual(adjacent_pairs(cell_name_grid(grid)), {})


class InspectTest(unittest.TestCase):
    def test_duplicate_palette_entries_touching_is_a_hard_failure(self):
        palette = {"outline": (10, 10, 10), "left": (200, 100, 50), "right": (200, 100, 50)}
        grid = grid_of(["lr", "lr"], "l=left r=right")
        hard, warn = inspect(grid, palette)
        self.assertEqual(len(hard), 1)
        self.assertIn("left / right", hard[0])
        self.assertIn("dE 0.0", hard[0])
        self.assertEqual(warn, [])

    def test_a_shading_ramp_step_is_not_reported(self):
        swatches, swatch_of = live_swatches()
        grid = grid_of(["ab", "ab"], "a=skin_fair_base b=skin_fair_shadow")
        self.assertEqual(inspect(grid, swatches, swatch_of), ([], []))

    def test_two_uses_of_one_swatch_touching_are_not_a_pair(self):
        """用途の色が違っても色見本が同じなら同じ色（輪郭と眼帯など）。色見本の段で測る（2026-10-31）。"""
        swatches = {"outline": (26, 18, 40), "pupil": (26, 18, 40)}
        swatch_of = {"contour": "outline", "eyepatch": "outline", "face_pupil": "pupil"}
        self.assertEqual(inspect(grid_of(["ce", "ce"], "c=contour e=eyepatch"), swatches, swatch_of), ([], []))
        hard, _ = inspect(grid_of(["cp", "cp"], "c=contour p=face_pupil"), swatches, swatch_of)
        self.assertEqual(len(hard), 1)
        self.assertIn("outline / pupil", hard[0])

    def test_outline_gets_the_stricter_floor(self):
        """The identical dE passes between two fills and fails against an
        outline. `other` deliberately carries the same RGB as `outline`, so the
        only thing that differs between the two grids is the role."""
        palette = {"outline": (60, 60, 62), "fill": (60, 74, 62), "other": (60, 60, 62)}
        self.assertAlmostEqual(
            delta_e(rgb_to_lab(palette["outline"]), rgb_to_lab(palette["fill"])), 11.9, places=1
        )
        against_outline, _ = inspect(grid_of(["of", "of"], "o=outline f=fill"), palette)
        between_fills, _ = inspect(grid_of(["fx", "fx"], "f=fill x=other"), palette)
        self.assertEqual(len(against_outline), 1)
        self.assertEqual(between_fills, [])

    def test_a_lightness_edge_overrides_a_small_chroma_difference(self):
        palette = {"outline": (10, 10, 10), "dark": (20, 20, 20), "light": (200, 200, 200)}
        self.assertEqual(inspect(grid_of(["dl", "dl"], "d=dark l=light"), palette), ([], []))


class RepositoryTest(unittest.TestCase):
    """Threshold regression. If these start firing, the thresholds or the
    palette moved, and the spec in docs/ needs revisiting.

    入力は tests/fixtures/ の写し（2026-10-16 に assets/ から写した。絵を描き直しても、このテストは落ちない）。
    パレットは現役の palette/ を（色見本の段で）読むので、パレットが動いたら気付ける。"""

    def assert_report(self, relative: str, hard: int, warn: int):
        grid = parse(REPO_ROOT / relative)
        found_hard, found_warn = inspect(grid, *live_swatches())
        self.assertEqual(len(found_hard), hard, f"{relative} hard: {found_hard}")
        self.assertEqual(len(found_warn), warn, f"{relative} warn: {found_warn}")

    def test_converged_assets_are_clean(self):
        for relative in (
            "tests/fixtures/chest.txt",
            "tests/fixtures/plain.txt",
            "tests/fixtures/castle_nw.txt",
            "tests/fixtures/castle_ne.txt",
            "tests/fixtures/castle_sw.txt",
            "tests/fixtures/castle_se.txt",
        ):
            with self.subTest(relative):
                self.assert_report(relative, hard=0, warn=0)

    def test_knight_pupil_is_the_outline_swatch(self):
        """The pupil touches the eye outline on purpose. Since 2026-11-05 the
        use `face_pupil` points at the `outline` swatch (as unit eyes do), so the
        pair is one colour, not two to tell apart."""
        grid = parse(REPO_ROOT / "types/face/reference/knight.txt")
        hard, _ = inspect(grid, *live_swatches())
        self.assertEqual(hard, [])


if __name__ == "__main__":
    unittest.main()
