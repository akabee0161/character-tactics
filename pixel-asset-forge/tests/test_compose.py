"""Checks for tools/compose.py (部品の重ね合わせ)."""
from __future__ import annotations

import contextlib
import io
import json
import sys
import tempfile
import unittest
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT / "tools"))

from compose import ComposeError, Layer, compose_frame, load_config, main, render_text  # noqa: E402
from gridfile import parse  # noqa: E402


def grid_text(pixels: dict[tuple[int, int], str], maps: str, size: int = 32) -> str:
    rows = [["."] * size for _ in range(size)]
    for (x, y), ch in pixels.items():
        rows[y][x] = ch
    header = f"# type: unit\n# size: {size}x{size}\n# light: upper-left\n# bg: transparent\n"
    return header + f"# map: {maps}\n" + "\n".join("".join(r) for r in rows) + "\n"


class Workspace:
    """A throwaway forge root with grids written into it."""

    def __init__(self) -> None:
        self._tmp = tempfile.TemporaryDirectory()
        self.root = Path(self._tmp.name)

    def write(self, rel: str, text: str) -> Path:
        path = self.root / rel
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(text, encoding="utf-8")
        return path

    def grid(self, rel: str, pixels: dict[tuple[int, int], str], maps: str, size: int = 32):
        return parse(self.write(rel, grid_text(pixels, maps, size)))

    def close(self) -> None:
        self._tmp.cleanup()


BODY_MAP = "o=outline b=skin_base"
PART_MAP = "o=outline h=leaf_base"


class ComposeFrameTest(unittest.TestCase):
    def setUp(self):
        self.ws = Workspace()
        self.body = self.ws.grid("body.txt", {(10, 10): "b", (11, 10): "b", (10, 11): "o"}, BODY_MAP)

    def tearDown(self):
        self.ws.close()

    def test_front_layer_paints_over_the_body(self):
        part = self.ws.grid("part.txt", {(10, 10): "h", (12, 10): "h"}, PART_MAP)
        rows, _ = compose_frame(self.body, [(part, Layer(part.path, "front"))])
        self.assertEqual(rows[10][10:13], "hbh")

    def test_back_layer_paints_only_transparent_pixels(self):
        part = self.ws.grid("part.txt", {(10, 10): "h", (12, 10): "h"}, PART_MAP)
        rows, _ = compose_frame(self.body, [(part, Layer(part.path, "back"))])
        self.assertEqual(rows[10][10:13], "bbh")

    def test_back_layer_is_hidden_by_an_earlier_front_part(self):
        front = self.ws.grid("front.txt", {(12, 10): "h"}, PART_MAP)
        back = self.ws.grid("back.txt", {(12, 10): "k"}, "k=wood_base")
        rows, _ = compose_frame(self.body, [(front, Layer(front.path, "front")),
                                            (back, Layer(back.path, "back"))])
        self.assertEqual(rows[10][12], "h")

    def test_shift_moves_the_part(self):
        part = self.ws.grid("part.txt", {(5, 5): "h"}, PART_MAP)
        rows, _ = compose_frame(self.body, [(part, Layer(part.path, "front", dx=2, dy=-1))])
        self.assertEqual(rows[4][7], "h")
        self.assertEqual(rows[5][5], ".")

    def test_shift_out_of_frame_is_an_error(self):
        part = self.ws.grid("part.txt", {(31, 5): "h"}, PART_MAP)
        with self.assertRaisesRegex(ComposeError, r"part\.txt.*\(31,5\).*\(32,5\)"):
            compose_frame(self.body, [(part, Layer(part.path, "front", dx=1))])

    def test_letter_mapped_to_two_colours_is_an_error(self):
        part = self.ws.grid("part.txt", {(5, 5): "b"}, "b=leaf_base")
        with self.assertRaisesRegex(ComposeError, "'b'"):
            compose_frame(self.body, [(part, Layer(part.path, "front"))])

    def test_size_mismatch_is_an_error(self):
        part = self.ws.grid("part.txt", {(1, 1): "h"}, PART_MAP, size=16)
        with self.assertRaisesRegex(ComposeError, "16x16"):
            compose_frame(self.body, [(part, Layer(part.path, "front"))])

    def test_map_groups_keep_only_used_letters_in_source_order(self):
        part = self.ws.grid("part.txt", {(20, 20): "h"}, "o=outline h=leaf_base u=water_base")
        _, groups = compose_frame(self.body, [(part, Layer(part.path, "front"))])
        self.assertEqual(groups, [[("o", "outline"), ("b", "skin_base")], [("h", "leaf_base")]])


class RenderTextTest(unittest.TestCase):
    def test_output_parses_back_to_the_same_grid(self):
        ws = Workspace()
        try:
            body = ws.grid("body.txt", {(10, 10): "b"}, BODY_MAP)
            part = ws.grid("part.txt", {(11, 10): "h"}, PART_MAP)
            rows, groups = compose_frame(body, [(part, Layer(part.path, "front"))])
            text = render_text(body, rows, groups, "gau.json の down_base から compose.py で組み立てた")
            again = parse(ws.write("out.txt", text))
            self.assertEqual(again.rows, rows)
            self.assertEqual(again.charmap, {"b": "skin_base", "h": "leaf_base"})  # 使っていない o は落ちる
            self.assertEqual(again.type, "unit")
        finally:
            ws.close()

    def test_note_with_a_colon_is_rejected(self):
        ws = Workspace()
        try:
            body = ws.grid("body.txt", {(10, 10): "b"}, BODY_MAP)
            with self.assertRaises(ComposeError):
                render_text(body, body.rows, [[("b", "skin_base")]], "note: bad")
        finally:
            ws.close()


class LoadConfigTest(unittest.TestCase):
    def setUp(self):
        self.ws = Workspace()

    def tearDown(self):
        self.ws.close()

    def config(self, data) -> Path:
        return self.ws.write("compose/gau.json", json.dumps(data))

    def test_reads_frames_with_defaults(self):
        path = self.config({"unit": "gau", "frames": {"down_base": {
            "body": "b.txt", "layers": [{"part": "p.txt", "z": "back", "dx": 1}]}}})
        unit, frames = load_config(path, root=self.ws.root)
        self.assertEqual(unit, "gau")
        spec = frames["down_base"]
        self.assertEqual(spec.body, self.ws.root / "b.txt")
        self.assertEqual(spec.layers, [Layer(self.ws.root / "p.txt", "back", 1, 0)])

    def test_unknown_z_is_an_error(self):
        path = self.config({"unit": "gau", "frames": {"down_base": {
            "body": "b.txt", "layers": [{"part": "p.txt", "z": "middle"}]}}})
        with self.assertRaisesRegex(ComposeError, "middle"):
            load_config(path, root=self.ws.root)

    def test_missing_body_is_an_error(self):
        path = self.config({"unit": "gau", "frames": {"down_base": {"layers": []}}})
        with self.assertRaisesRegex(ComposeError, "body"):
            load_config(path, root=self.ws.root)

    def test_unknown_key_is_an_error(self):
        path = self.config({"unit": "gau", "frames": {"down_base": {"body": "b.txt", "lyers": []}}})
        with self.assertRaisesRegex(ComposeError, "lyers"):
            load_config(path, root=self.ws.root)

    def test_broken_json_is_an_error(self):
        path = self.ws.write("compose/gau.json", "{not json")
        with self.assertRaises(ComposeError):
            load_config(path, root=self.ws.root)


class MainTest(unittest.TestCase):
    def setUp(self):
        self.ws = Workspace()
        self.ws.write("b.txt", grid_text({(10, 10): "b"}, BODY_MAP))
        self.ws.write("p.txt", grid_text({(11, 10): "h"}, PART_MAP))
        self.cfg = self.ws.write("compose/gau.json", json.dumps({"unit": "gau", "frames": {
            "down_base": {"body": str(self.ws.root / "b.txt"),
                          "layers": [{"part": str(self.ws.root / "p.txt"), "z": "front"}]}}}))
        self.out = self.ws.root / "out"

    def tearDown(self):
        self.ws.close()

    def run_main(self, argv: list[str]) -> tuple[int, str, str]:
        out, err = io.StringIO(), io.StringIO()
        with contextlib.redirect_stdout(out), contextlib.redirect_stderr(err):
            code = main(argv)
        return code, out.getvalue(), err.getvalue()

    def test_writes_frames_to_out(self):
        code, _, _ = self.run_main([str(self.cfg), "--out", str(self.out)])
        self.assertEqual(code, 0)
        self.assertEqual(parse(self.out / "down_base.txt").rows[10][10:12], "bh")

    def test_check_reports_missing_output(self):
        code, out, _ = self.run_main([str(self.cfg), "--out", str(self.out), "--check"])
        self.assertEqual(code, 1)
        self.assertIn("down_base", out)

    def test_check_passes_after_writing(self):
        self.run_main([str(self.cfg), "--out", str(self.out)])
        code, _, _ = self.run_main([str(self.cfg), "--out", str(self.out), "--check"])
        self.assertEqual(code, 0)

    def test_unknown_frame_name_exits_two(self):
        code, _, err = self.run_main([str(self.cfg), "--out", str(self.out), "--frames", "up_base"])
        self.assertEqual(code, 2)
        self.assertIn("up_base", err)


if __name__ == "__main__":
    unittest.main()
