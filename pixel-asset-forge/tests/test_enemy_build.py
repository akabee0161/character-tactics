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
from enemy_build import EnemyError, read_frame, recolor_frame, serialize_frame  # noqa: E402
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


if __name__ == "__main__":
    unittest.main()
