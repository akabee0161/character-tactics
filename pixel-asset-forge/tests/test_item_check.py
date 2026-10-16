"""Checks for tools/item_check.py (item の長い持ち物の左右対称)."""
from __future__ import annotations

import contextlib
import io
import sys
import tempfile
import unittest
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT / "tools"))

from gridfile import parse  # noqa: E402
from item_check import asymmetric, main  # noqa: E402


def item_text(pixels: set[tuple[int, int]], kind: str = "item", size: str = "16x16") -> str:
    width, height = (int(n) for n in size.split("x"))
    rows = [["."] * width for _ in range(height)]
    for x, y in pixels:
        rows[y][x] = "o"
    return (f"# type: {kind}\n# size: {size}\n# light: upper-left\n# bg: transparent\n# map: o=outline\n"
            + "\n".join("".join(r) for r in rows) + "\n")


# 軸 x+y=15 の線（右上へ向けた斜め置きの芯）と、軸について対になる2画素
SYMMETRIC = {(x, 15 - x) for x in range(2, 14)} | {(5, 9), (6, 10)}


class ItemCheckTest(unittest.TestCase):
    def setUp(self):
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        self.dir = Path(tmp.name)

    def write(self, name: str, text: str) -> Path:
        path = self.dir / name
        path.write_text(text, encoding="utf-8")
        return path

    def run_main(self, *paths: Path) -> tuple[int, str]:
        out = io.StringIO()
        with contextlib.redirect_stdout(out), contextlib.redirect_stderr(out):
            code = main([str(p) for p in paths])
        return code, out.getvalue()

    def test_symmetric_shape_passes(self):
        self.assertEqual(asymmetric(parse(self.write("a.txt", item_text(SYMMETRIC)))), [])

    def test_extra_pixel_on_one_side_is_reported(self):
        grid = parse(self.write("a.txt", item_text(SYMMETRIC | {(4, 4)})))
        self.assertEqual(asymmetric(grid), [(4, 4)])

    def test_main_exit_codes(self):
        good = self.write("good.txt", item_text(SYMMETRIC))
        bad = self.write("bad.txt", item_text(SYMMETRIC | {(4, 4)}))
        self.assertEqual(self.run_main(good)[0], 0)
        code, out = self.run_main(good, bad)
        self.assertEqual(code, 1)
        self.assertIn("(4,4)", out)

    def test_non_square_is_an_input_error(self):
        path = self.write("a.txt", item_text(set(), size="16x8"))
        self.assertEqual(self.run_main(path)[0], 2)

    def test_an_input_error_does_not_hide_the_other_reports(self):
        broken = self.write("broken.txt", item_text(SYMMETRIC, kind="tile"))
        bad = self.write("bad.txt", item_text(SYMMETRIC | {(4, 4)}))
        code, out = self.run_main(broken, bad)
        self.assertEqual(code, 2)
        self.assertIn("FAIL bad.txt", out)

    def test_square_but_not_16_is_an_input_error(self):
        path = self.write("a.txt", item_text(set(), size="8x8"))  # 軸 x+y=15 は 16x16 の対角線
        self.assertEqual(self.run_main(path)[0], 2)

    def test_undecodable_file_is_an_input_error_and_the_rest_is_still_checked(self):
        undecodable = self.dir / "undecodable.txt"
        undecodable.write_bytes(b"\xff\xfe\n")
        bad = self.write("bad.txt", item_text(SYMMETRIC | {(4, 4)}))
        code, out = self.run_main(undecodable, bad)
        self.assertEqual(code, 2)
        self.assertIn("undecodable.txt", out)
        self.assertIn("FAIL bad.txt", out)

    def test_non_item_is_an_input_error(self):
        path = self.write("a.txt", item_text(SYMMETRIC, kind="tile"))
        self.assertEqual(self.run_main(path)[0], 2)


if __name__ == "__main__":
    unittest.main()
