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


def definition(rows: list[str], test: unittest.TestCase) -> Path:
    """シート定義を一時ファイルに書く。テストが失敗しても消えるよう、後始末を test に登録する"""
    handle = tempfile.NamedTemporaryFile("w", suffix=".txt", delete=False, encoding="utf-8")
    handle.write("".join(f"{row}\n" for row in rows))
    handle.close()
    path = Path(handle.name)
    test.addCleanup(path.unlink, missing_ok=True)
    return path


# idle は2コマ、walk は3コマ、attack は1コマ。idle は方向ごとに違う組み合わせにして、方向の並びを確かめられるようにする
IDLE = (
    ("sheet_dot", "sheet_block"),     # down
    ("sheet_block", "sheet_dot"),     # up
    ("sheet_dot", "sheet_dot"),       # left
    ("sheet_block", "sheet_block"),   # right
)
ROWS = (
    [f"{a} {b} . ." for a, b in IDLE]
    + ["sheet_block sheet_dot sheet_block ."] * 4
    + ["sheet_dot . . ."] * 4
)


class DefinitionHelperTest(unittest.TestCase):
    def test_temporary_definition_is_removed_after_the_test(self):
        path = definition(ROWS, self)
        self.assertTrue(path.exists())
        self.doCleanups()
        self.assertFalse(path.exists())


class FpsTest(unittest.TestCase):
    def test_defaults_match_the_game(self):
        self.assertEqual(sheet_gif.parse_fps([]), {"idle": 4.0, "walk": 8.0, "attack": 6.0})

    def test_override_one_state(self):
        self.assertEqual(sheet_gif.parse_fps(["attack=12"])["attack"], 12.0)

    def test_unknown_state_is_rejected(self):
        with self.assertRaises(SystemExit):
            sheet_gif.parse_fps(["run=8"])

    def test_zero_or_garbage_is_rejected(self):
        # nan は表示時間の計算で ValueError、inf と 200fps を超える値は 0ms になるので受け付けない
        # 遅すぎる値は GIF の1コマの上限（65535 x 1/100秒）を超えて Pillow が struct.error で止まり、
        # 1e-308 は表示時間の計算で OverflowError になる
        for spec in ("idle=0", "idle=-1", "idle=fast", "idle", "idle=nan", "idle=inf", "idle=201",
                     "idle=0.0015", "idle=1e-308"):
            with self.subTest(spec=spec), self.assertRaises(SystemExit):
                sheet_gif.parse_fps([spec])

    def test_fastest_fps_that_still_has_a_frame_time(self):
        # 200fps は 10ms で表せる
        self.assertEqual(sheet_gif.parse_fps(["idle=200"])["idle"], 200.0)
        self.assertEqual(sheet_gif.duration_ms(200.0), 10)

    def test_slowest_fps_that_fits_in_a_gif_frame(self):
        # 0.0016fps は 625,000ms で、GIF の上限 655,350ms に収まる
        self.assertEqual(sheet_gif.parse_fps(["idle=0.0016"])["idle"], 0.0016)
        self.assertLessEqual(sheet_gif.duration_ms(0.0016), sheet_gif.MAX_DURATION_MS)


class FramesTest(unittest.TestCase):
    def setUp(self):
        palette = load_palette()
        self.rows = sheet.read_sheet(definition(ROWS, self))
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
        x, y = sheet_gif.cell_origin(0, scale=1, frame=frame)
        first = images[0].crop((x, y, x + frame, y + frame))
        second = images[1].crop((x, y, x + frame, y + frame))
        self.assertEqual(alpha_mask(first, sheet_gif.BACKDROP), alpha_mask_of(dot))
        self.assertEqual(alpha_mask(second, sheet_gif.BACKDROP), alpha_mask_of(block))

    def test_each_direction_uses_its_definition_row(self):
        frame = sheet.frame_size(self.frames)
        images = sheet_gif.animation(self.rows, self.frames, "idle", scale=1)
        for direction, names in enumerate(IDLE):
            x, y = sheet_gif.cell_origin(direction, scale=1, frame=frame)
            for step, (image, name) in enumerate(zip(images, names)):
                with self.subTest(direction=direction, step=step):
                    actual = image.crop((x, y, x + frame, y + frame))
                    self.assertEqual(
                        alpha_mask(actual, sheet_gif.BACKDROP),
                        alpha_mask_of(self.frames[name].convert("RGBA")),
                    )

    def test_cell_origin_needs_the_frame_size(self):
        # frame を省くと、どの方向も方向0の位置になっていた（省略できないようにした）
        with self.assertRaises(TypeError):
            sheet_gif.cell_origin(1, scale=1)


def alpha_mask_of(image: Image.Image) -> list[bool]:
    return [a > 0 for a in image.getchannel("A").get_flattened_data()]


def alpha_mask(image: Image.Image, backdrop: tuple[int, int, int, int]) -> list[bool]:
    """背景の色でない画素を True にする（GIF は透明を持たないので、背景の色で見分ける）"""
    return [p[:3] != backdrop[:3] for p in image.convert("RGBA").get_flattened_data()]


class MainTest(unittest.TestCase):
    def test_writes_one_gif_per_state_for_all(self):
        with tempfile.TemporaryDirectory() as out:
            path = definition(ROWS, self)
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
            path = definition(ROWS, self)
            self.assertEqual(sheet_gif.main([str(path), "--state", "walk", "--unitdir", str(FIXTURES), "-o", out]), 0)
            self.assertEqual(sorted(p.name for p in Path(out).iterdir()), [f"{path.stem}_walk.gif"])

    def test_bad_scale_is_rejected(self):
        with self.assertRaises(SystemExit):
            sheet_gif.main([str(definition(ROWS, self)), "--scale", "0", "--unitdir", str(FIXTURES)])


if __name__ == "__main__":
    unittest.main()
