"""Checks for tools/compose_page.py (部品の確認ページ)."""
from __future__ import annotations

import contextlib
import io
import json
import sys
import unittest
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT / "tools"))
sys.path.insert(0, str(Path(__file__).resolve().parent))

from compose_page import main  # noqa: E402
from test_compose import BODY_MAP, PART_MAP, Workspace, grid_text  # noqa: E402


class ComposePageTest(unittest.TestCase):
    def setUp(self):
        self.ws = Workspace()
        root = self.ws.root
        self.ws.write("body.txt", grid_text({(10, 10): "b"}, BODY_MAP))
        self.ws.write("part.txt", grid_text({(11, 10): "h", (10, 10): "h"}, PART_MAP))
        # 組み立てた絵は (10,10)=素体の色、(11,10)=部品の色。今の絵は (11,10) だけ違う
        self.ws.write("against/down_base.txt", grid_text({(10, 10): "b", (11, 10): "b"}, "b=skin_base h=leaf_base"))
        self.out = root / "page.html"

    def tearDown(self):
        self.ws.close()

    def config(self, layer: dict, **top) -> Path:
        root = self.ws.root
        config = {"unit": "t", **top, "frames": {"down_base": {"body": str(root / "body.txt"), "layers": [layer]}}}
        return self.ws.write("compose/t.json", json.dumps(config))

    def run_main(self, path: Path, *extra: str) -> tuple[int, str]:
        out = io.StringIO()
        with contextlib.redirect_stdout(out), contextlib.redirect_stderr(io.StringIO()):
            code = main([str(path), str(self.out), "--against", str(self.ws.root / "against"), *extra])
        return code, out.getvalue()

    def test_page_lists_the_frame_hidden_pixels_and_the_difference(self):
        path = self.config({"part": str(self.ws.root / "part.txt"), "z": "back"})
        code, _ = self.run_main(path)
        self.assertEqual(code, 0)
        page = self.out.read_text(encoding="utf-8")
        self.assertIn("down_base", page)
        self.assertIn("隠れている画素 1", page)       # 部品の (10,10) は素体の手前に出られない
        self.assertIn("今の絵と違う画素 1", page)
        self.assertIn("(11,10)", page)

    def test_open_hand_part_still_makes_the_page(self):
        part = self.ws.write("open.txt", grid_text({(10, 12): "b"}, BODY_MAP))
        path = self.config({"part": str(part), "z": "front", "hand": True}, hand_colours=["skin_base"])
        code, _ = self.run_main(path)
        self.assertEqual(code, 0)
        page = self.out.read_text(encoding="utf-8")
        self.assertIn("閉じていない拳 1", page)
        self.assertIn("(10,12)", page)

    def test_dirs_filter_without_a_match_is_an_error(self):
        path = self.config({"part": str(self.ws.root / "part.txt"), "z": "back"})
        code, _ = self.run_main(path, "--dirs", "up")
        self.assertEqual(code, 2)

    def test_missing_current_frame_is_shown_as_such(self):
        path = self.config({"part": str(self.ws.root / "part.txt"), "z": "back"})
        (self.ws.root / "against" / "down_base.txt").unlink()
        code, _ = self.run_main(path)
        self.assertEqual(code, 0)
        self.assertIn("今の絵なし", self.out.read_text(encoding="utf-8"))


if __name__ == "__main__":
    unittest.main()


class GroundTest(unittest.TestCase):
    def test_ground_stands_apart_from_every_palette_colour(self):
        # 地が薄い灰色だと、白に近い弦（stone_hi）が地に溶けて見えなかった（2026-10-12 依頼者の指摘）
        from compose_page import GROUND
        from gridfile import load_palette

        for name, colour in load_palette().items():
            gap = sum(abs(a - b) for a, b in zip(GROUND[:3], colour[:3]))
            self.assertGreaterEqual(gap, 50, f"{name} が地の色に近い（差 {gap}）")
