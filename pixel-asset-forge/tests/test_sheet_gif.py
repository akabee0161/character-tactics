"""Checks for the sheet-to-GIF tool.

    .venv/bin/python -m unittest discover -s tests
"""
from __future__ import annotations

import sys
import tempfile
import unittest
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT / "tools"))

from PIL import Image

import sheet  # noqa: E402
import sheet_gif  # noqa: E402

from gridfile import load_palette  # noqa: E402

FIXTURES = REPO_ROOT / "tests" / "fixtures"


def definition(rows: list[str]) -> Path:
    handle = tempfile.NamedTemporaryFile("w", suffix=".txt", delete=False, encoding="utf-8")
    handle.write("".join(f"{row}\n" for row in rows))
    handle.close()
    return Path(handle.name)


# idle は2コマ、walk は3コマ、attack は1コマ。方向ごとに違う絵を置いて、並びを確かめられるようにする
ROWS = (
    ["sheet_dot sheet_block . ."] * 4
    + ["sheet_block sheet_dot sheet_block ."] * 4
    + ["sheet_dot . . ."] * 4
)


class FpsTest(unittest.TestCase):
    def test_defaults_match_the_game(self):
        self.assertEqual(sheet_gif.parse_fps([]), {"idle": 4.0, "walk": 8.0, "attack": 6.0})

    def test_override_one_state(self):
        self.assertEqual(sheet_gif.parse_fps(["attack=12"])["attack"], 12.0)

    def test_unknown_state_is_rejected(self):
        with self.assertRaises(SystemExit):
            sheet_gif.parse_fps(["run=8"])

    def test_zero_or_garbage_is_rejected(self):
        for spec in ("idle=0", "idle=-1", "idle=fast", "idle"):
            with self.subTest(spec=spec), self.assertRaises(SystemExit):
                sheet_gif.parse_fps([spec])


class FramesTest(unittest.TestCase):
    def setUp(self):
        palette = load_palette()
        self.rows = sheet.read_sheet(definition(ROWS))
        self.frames = sheet.load_frames(self.rows, palette, FIXTURES)

    def test_one_gif_frame_per_column_the_state_uses(self):
        for state, count in (("idle", 2), ("walk", 3), ("attack", 1)):
            with self.subTest(state=state):
                images = sheet_gif.animation(self.rows, self.frames, state, scale=2)
                self.assertEqual(len(images), count)

    def test_duration_is_one_frame_of_the_fps_rounded_to_what_gif_can_store(self):
        # GIF は 1/100 秒単位。Pillow に 167 を渡すと切り捨てで 160 になるので、10ms 単位で四捨五入して渡す
        self.assertEqual(sheet_gif.duration_ms(6.0), 170)
        self.assertEqual(sheet_gif.duration_ms(8.0), 130)
        self.assertEqual(sheet_gif.duration_ms(4.0), 250)

    def test_four_directions_side_by_side_at_the_scale(self):
        frame = sheet.frame_size(self.frames)
        images = sheet_gif.animation(self.rows, self.frames, "idle", scale=3)
        cell = frame * 3
        # 4方向ぶんの幅と、拡大した段と等倍の段の高さがある
        self.assertGreaterEqual(images[0].width, 4 * cell)
        self.assertGreater(images[0].height, cell + frame)

    def test_each_step_shows_the_next_column(self):
        frame = sheet.frame_size(self.frames)
        images = sheet_gif.animation(self.rows, self.frames, "idle", scale=1)
        dot = self.frames["sheet_dot"].convert("RGBA")
        block = self.frames["sheet_block"].convert("RGBA")
        x, y = sheet_gif.cell_origin(0, scale=1)
        first = images[0].crop((x, y, x + frame, y + frame))
        second = images[1].crop((x, y, x + frame, y + frame))
        self.assertEqual(alpha_mask(first, sheet_gif.BACKDROP), alpha_mask_of(dot))
        self.assertEqual(alpha_mask(second, sheet_gif.BACKDROP), alpha_mask_of(block))


def alpha_mask_of(image: Image.Image) -> list[bool]:
    return [a > 0 for a in image.getchannel("A").get_flattened_data()]


def alpha_mask(image: Image.Image, backdrop: tuple[int, int, int, int]) -> list[bool]:
    """背景の色でない画素を True にする（GIF は透明を持たないので、背景の色で見分ける）"""
    return [p[:3] != backdrop[:3] for p in image.convert("RGBA").get_flattened_data()]


class MainTest(unittest.TestCase):
    def test_writes_one_gif_per_state_for_all(self):
        with tempfile.TemporaryDirectory() as out:
            path = definition(ROWS)
            code = sheet_gif.main([str(path), "--state", "all", "--unitdir", str(FIXTURES), "-o", out])
            self.assertEqual(code, 0)
            for state, count in (("idle", 2), ("walk", 3), ("attack", 1)):
                gif = Path(out) / f"{path.stem}_{state}.gif"
                self.assertTrue(gif.exists(), gif)
                with Image.open(gif) as im:
                    self.assertEqual(getattr(im, "n_frames", 1), count)
                    self.assertEqual(im.info["duration"], sheet_gif.duration_ms(sheet_gif.DEFAULT_FPS[state]))

    def test_one_state(self):
        with tempfile.TemporaryDirectory() as out:
            path = definition(ROWS)
            self.assertEqual(sheet_gif.main([str(path), "--state", "walk", "--unitdir", str(FIXTURES), "-o", out]), 0)
            self.assertEqual(sorted(p.name for p in Path(out).iterdir()), [f"{path.stem}_walk.gif"])

    def test_bad_scale_is_rejected(self):
        with self.assertRaises(SystemExit):
            sheet_gif.main([str(definition(ROWS)), "--scale", "0", "--unitdir", str(FIXTURES)])


if __name__ == "__main__":
    unittest.main()
