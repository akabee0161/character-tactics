"""Checks for tools/phone_sheet.py (スマホで見る確認の画像)."""
from __future__ import annotations

import contextlib
import io
import json
import sys
import unittest
from pathlib import Path

from PIL import Image

REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT / "tools"))
sys.path.insert(0, str(Path(__file__).resolve().parent))

from compose_page import RED  # noqa: E402
from phone_sheet import LABEL, PAD, SCALE, main  # noqa: E402
from test_compose import BODY_MAP, PART_MAP, Workspace, grid_text  # noqa: E402

CELL = 32 * SCALE


def sheet_size(cols: int, rows: int) -> tuple[int, int]:
    return PAD + cols * (CELL + PAD), PAD + rows * (CELL + LABEL * 2 + PAD)


def cell_origin(col: int, row: int) -> tuple[int, int]:
    return PAD + col * (CELL + PAD), PAD + row * (CELL + LABEL * 2 + PAD) + LABEL


class PhoneSheetTest(unittest.TestCase):
    def setUp(self):
        self.ws = Workspace()
        self.addCleanup(self.ws.close)
        for name in ("down_base", "down_idle2", "up_base"):
            self.ws.write(f"now/{name}.txt", grid_text({(10, 10): "b"}, BODY_MAP))
            self.ws.write(f"cand/{name}.txt", grid_text({(10, 10): "b"}, BODY_MAP))
        # 案の down_idle2 だけ (11,10) が今と違う
        self.ws.write("cand/down_idle2.txt", grid_text({(10, 10): "b", (11, 10): "b"}, BODY_MAP))
        self.root = self.ws.root

    def run_main(self, *argv) -> tuple[int, str, str]:
        out, err = io.StringIO(), io.StringIO()
        with contextlib.redirect_stdout(out), contextlib.redirect_stderr(err):
            code = main([str(a) for a in argv])
        return code, out.getvalue(), err.getvalue()

    # diff
    def test_diff_lays_out_now_candidate_and_marked_candidate(self):
        out = self.root / "diff.png"
        code, stdout, _ = self.run_main("diff", self.root / "now", self.root / "cand", "down", out)
        self.assertEqual(code, 0)
        image = Image.open(out)
        self.assertEqual(image.size, sheet_size(3, 2))
        x0, y0 = cell_origin(2, 1)  # 3列目（赤枠）・2行目（down_idle2）
        self.assertEqual(image.getpixel((x0 + 11 * SCALE, y0 + 10 * SCALE))[:3], RED[:3])
        x1, y1 = cell_origin(1, 1)  # 2列目（印なし）には赤枠が無い
        self.assertNotEqual(image.getpixel((x1 + 11 * SCALE, y1 + 10 * SCALE))[:3], RED[:3])
        self.assertLess(stdout.index("down_base"), stdout.index("down_idle2"))
        self.assertIn("down_idle2 diff 1 px", stdout)

    def test_diff_states_narrow_the_rows(self):
        out = self.root / "diff.png"
        code, _, _ = self.run_main("diff", self.root / "now", self.root / "cand", "down", out, "--states", "idle2")
        self.assertEqual(code, 0)
        self.assertEqual(Image.open(out).size, sheet_size(3, 1))

    def test_diff_missing_candidate_frame_is_an_error(self):
        (self.root / "cand" / "down_base.txt").unlink()
        code, _, err = self.run_main("diff", self.root / "now", self.root / "cand", "down", self.root / "x.png")
        self.assertEqual(code, 2)
        self.assertIn("down_base.txt", err)

    def test_diff_direction_without_frames_is_an_error(self):
        code, _, err = self.run_main("diff", self.root / "now", self.root / "cand", "left", self.root / "x.png")
        self.assertEqual(code, 2)
        self.assertIn("left", err)

    # cmp
    def test_cmp_puts_each_candidate_in_its_own_column(self):
        out = self.root / "cmp.png"
        code, _, _ = self.run_main("cmp", self.root / "now", "down", out,
                                   f"A={self.root / 'cand'}", f"B={self.root / 'cand'}@up", "--states", "base")
        self.assertEqual(code, 0)
        self.assertEqual(Image.open(out).size, sheet_size(3, 1))

    def test_cmp_rejects_a_malformed_candidate(self):
        for spec in ("A", f"={self.root / 'cand'}", f"A={self.root / 'cand'}@side"):
            with self.subTest(spec):
                code, _, _ = self.run_main("cmp", self.root / "now", "down", self.root / "x.png", spec)
                self.assertEqual(code, 2)

    # order
    def order_config(self, part_pixels: dict, dx: int = 0) -> Path:
        self.ws.write("body.txt", grid_text({(10, 10): "b"}, BODY_MAP))
        self.ws.write("part.txt", grid_text(part_pixels, PART_MAP))
        layer = {"part": str(self.root / "part.txt"), "z": "front", "dx": dx}
        config = {"unit": "t", "frames": {"down_base": {"body": str(self.root / "body.txt"), "layers": [layer]}}}
        return self.ws.write("compose/t.json", json.dumps(config))

    def test_order_writes_one_sheet_per_direction(self):
        config = self.order_config({(11, 10): "h"})
        code, stdout, _ = self.run_main("order", config, self.root / "out", "--against", self.root / "now")
        self.assertEqual(code, 0)
        written = self.root / "out" / "t_down_order.png"
        self.assertTrue(written.is_file())
        self.assertEqual(Image.open(written).size, sheet_size(3, 1))  # 芯・部品・組んだ絵
        self.assertFalse((self.root / "out" / "t_up_order.png").exists())  # 設定に up のコマが無い
        self.assertIn("t_down_order.png", stdout)

    def test_order_unknown_state_is_an_error(self):
        config = self.order_config({(11, 10): "h"})
        code, _, err = self.run_main("order", config, self.root / "out", "--states", "idle2")
        self.assertEqual(code, 2)
        self.assertIn("down_idle2", err)

    def test_order_reports_pixels_shifted_off_the_frame(self):
        config = self.order_config({(31, 10): "h"}, dx=2)  # compose.py がコマの外に出る部品を止める
        code, _, err = self.run_main("order", config, self.root / "out", "--against", self.root / "now")
        self.assertEqual(code, 2)
        self.assertIn("コマの外", err)


if __name__ == "__main__":
    unittest.main()
