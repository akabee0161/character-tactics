"""Checks for the colour probe.

    .venv/bin/python -m unittest discover -s tests
"""
from __future__ import annotations

import contextlib
import io
import sys
import tempfile
import unittest
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT / "tools"))

import probe_colors  # noqa: E402
from gridfile import GridError, load_palette  # noqa: E402


def write(text: str) -> Path:
    handle = tempfile.NamedTemporaryFile("w", suffix=".txt", delete=False, encoding="utf-8")
    handle.write(text)
    handle.close()
    return Path(handle.name)


class ResolveTest(unittest.TestCase):
    def setUp(self):
        self.palette = load_palette()

    def test_a_palette_name_resolves(self):
        self.assertEqual(
            probe_colors.resolve("grass_base", self.palette), self.palette["grass_base"]
        )

    def test_a_literal_resolves_without_being_in_the_palette(self):
        self.assertEqual(probe_colors.resolve("#3f8a3c", self.palette), (0x3F, 0x8A, 0x3C))

    def test_an_unknown_name_is_rejected(self):
        with self.assertRaises(GridError):
            probe_colors.resolve("chartreuse", self.palette)


class VerdictTest(unittest.TestCase):
    """The cases that made this tool worth keeping."""

    def setUp(self):
        self.palette = load_palette()

    def test_the_rejected_leaf_colour_is_a_hard_failure(self):
        label, distance = probe_colors.verdict("#3f8a3c", "grass_base", self.palette)
        self.assertEqual(label, "HARD")
        self.assertLess(distance, 6.0)

    def test_the_colour_that_was_adopted_instead_passes(self):
        label, _ = probe_colors.verdict("leaf_hi", "grass_base", self.palette)
        self.assertTrue(label.startswith("OK"))

    def test_a_lightness_edge_alone_is_enough(self):
        label, _ = probe_colors.verdict("stone_hi", "stone_dark", self.palette)
        self.assertEqual(label, "OK(lightness)")

    def test_outline_is_held_to_a_higher_floor(self):
        """The same distance passes for an ordinary pair and fails for an outline.

        outline/pupil are the same colour in the palette, so this also pins the
        one hard failure the repo is knowingly carrying.
        """
        label, distance = probe_colors.verdict("outline", "pupil", self.palette)
        self.assertEqual(label, "HARD")
        self.assertEqual(distance, 0.0)


class ReadPairsTest(unittest.TestCase):
    def test_it_reads_pairs_and_skips_comments_and_blanks(self):
        path = write("# a note\n\ngrass_base leaf_hi\nstone_hi stone_dark\n")
        self.assertEqual(
            probe_colors.read_pairs(path),
            [("grass_base", "leaf_hi"), ("stone_hi", "stone_dark")],
        )

    def test_a_line_that_is_not_a_pair_is_rejected(self):
        path = write("grass_base\n")
        with self.assertRaises(GridError):
            probe_colors.read_pairs(path)


class MainTest(unittest.TestCase):
    """The tool prints; a test run should not. Everything here is captured."""

    def run_tool(self, argv: list[str]) -> tuple[int, str]:
        out = io.StringIO()
        with contextlib.redirect_stdout(out), contextlib.redirect_stderr(io.StringIO()):
            code = probe_colors.main(argv)
        return code, out.getvalue()

    def expect_exit(self, argv: list[str]) -> None:
        with contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(io.StringIO()):
            with self.assertRaises(SystemExit):
                probe_colors.main(argv)

    def test_a_clean_pair_exits_zero(self):
        code, _ = self.run_tool(["grass_base", "leaf_hi"])
        self.assertEqual(code, 0)

    def test_a_flagged_pair_exits_non_zero_and_says_so(self):
        code, printed = self.run_tool(["#3f8a3c", "grass_base"])
        self.assertEqual(code, 1)
        self.assertIn("HARD", printed)

    def test_a_candidate_is_measured_against_every_colour_given(self):
        code, printed = self.run_tool(
            ["--candidate", "#3f8a3c", "--against", "grass_base", "grass_hi"]
        )
        self.assertEqual(code, 1)
        self.assertIn("2 pair(s)", printed)

    def test_quiet_prints_only_the_flagged_pair(self):
        _, printed = self.run_tool(
            ["--candidate", "#3f8a3c", "--against", "grass_base", "grass_hi", "--quiet"]
        )
        self.assertIn("grass_base", printed)
        self.assertNotIn("grass_hi", printed)

    def test_a_candidate_without_anything_to_compare_is_rejected(self):
        self.expect_exit(["--candidate", "#3f8a3c"])

    def test_no_arguments_at_all_is_rejected(self):
        self.expect_exit([])


if __name__ == "__main__":
    unittest.main()
