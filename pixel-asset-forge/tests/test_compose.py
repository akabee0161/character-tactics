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

from compose import (  # noqa: E402
    ComposeError, Layer, compose_frame, compose_labels, load_config, main, open_hand_pixels, render_text,
    stack_order)
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


class StackTest(unittest.TestCase):
    def setUp(self):
        self.ws = Workspace()
        self.body = self.ws.grid("body.txt", {(10, 10): "b"}, BODY_MAP)

    def tearDown(self):
        self.ws.close()

    def test_back_layers_go_behind_everything_drawn_so_far(self):
        layers = [Layer(Path("a"), "front"), Layer(Path("b"), "back"), Layer(Path("c"), "back"), Layer(Path("d"), "front")]
        self.assertEqual(stack_order(layers), [2, 1, -1, 0, 3])

    def test_labels_name_the_visible_part(self):
        front = self.ws.grid("front.txt", {(10, 10): "h", (12, 10): "h"}, PART_MAP)
        back = self.ws.grid("back.txt", {(10, 10): "h", (13, 10): "h"}, PART_MAP)
        labels = compose_labels(self.body, [(front, Layer(front.path, "front")), (back, Layer(back.path, "back"))])
        self.assertEqual(labels[10][10], "front.txt")
        self.assertEqual(labels[10][12], "front.txt")
        self.assertEqual(labels[10][13], "back.txt")
        self.assertIsNone(labels[0][0])

    def test_labels_name_the_body_where_no_part_covers_it(self):
        part = self.ws.grid("part.txt", {(12, 10): "h"}, PART_MAP)
        labels = compose_labels(self.body, [(part, Layer(part.path, "front"))])
        self.assertEqual(labels[10][10], "body.txt")


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

    def test_refuses_to_overwrite_a_hand_edited_frame(self):
        self.run_main([str(self.cfg), "--out", str(self.out)])
        target = self.out / "down_base.txt"
        edited = target.read_text(encoding="utf-8").replace("bh", "hh")
        target.write_text(edited, encoding="utf-8")
        code, _, err = self.run_main([str(self.cfg), "--out", str(self.out)])
        self.assertEqual(code, 2)
        self.assertIn("down_base", err)
        self.assertIn("--force", err)
        self.assertEqual(target.read_text(encoding="utf-8"), edited)

    def test_force_overwrites_a_hand_edited_frame(self):
        self.run_main([str(self.cfg), "--out", str(self.out)])
        target = self.out / "down_base.txt"
        target.write_text(target.read_text(encoding="utf-8").replace("bh", "hh"), encoding="utf-8")
        code, _, _ = self.run_main([str(self.cfg), "--out", str(self.out), "--force"])
        self.assertEqual(code, 0)
        self.assertEqual(parse(target).rows[10][10:12], "bh")

    def test_rewriting_the_same_frame_is_allowed(self):
        self.run_main([str(self.cfg), "--out", str(self.out)])
        code, _, _ = self.run_main([str(self.cfg), "--out", str(self.out)])
        self.assertEqual(code, 0)

    def test_unknown_frame_name_exits_two(self):
        code, _, err = self.run_main([str(self.cfg), "--out", str(self.out), "--frames", "up_base"])
        self.assertEqual(code, 2)
        self.assertIn("up_base", err)


class GripAndHandTest(unittest.TestCase):
    def setUp(self):
        self.ws = Workspace()
        self.body = self.ws.grid("body.txt", {(0, 0): "o"}, BODY_MAP)
        # 縦の柄（w）を、輪郭（o）で囲った拳（b）が握る
        self.shaft = self.ws.grid("shaft.txt", {(10, y): "w" for y in range(5, 15)}, "o=outline w=wood_base")
        fist = {(10, 9): "b", (10, 10): "b"}
        fist.update({p: "o" for p in [(10, 8), (10, 11), (9, 9), (9, 10), (11, 9), (11, 10)]})
        self.fist = self.ws.grid("fist.txt", fist, BODY_MAP)

    def tearDown(self):
        self.ws.close()

    def rows(self, keep):
        layers = [(self.shaft, Layer(self.shaft.path, "front")),
                  (self.fist, Layer(self.fist.path, "front", keep=frozenset(keep)))]
        return compose_frame(self.body, layers)[0]

    def test_fist_outline_is_not_drawn_over_the_gripped_shaft(self):
        rows = self.rows({"wood_base"})
        self.assertEqual(rows[8][10], "w")
        self.assertEqual(rows[11][10], "w")
        self.assertEqual(rows[9][10], "b")   # 拳の肌は柄の上に描く
        self.assertEqual(rows[9][9], "o")    # 柄の無い所の輪郭は描く

    def test_without_keep_the_outline_covers_the_shaft(self):
        self.assertEqual(self.rows(set())[8][10], "o")

    def test_keep_only_looks_at_the_colour_right_below(self):
        rows = self.rows({"leaf_base"})
        self.assertEqual(rows[8][10], "o")

    def test_labels_follow_keep(self):
        layers = [(self.shaft, Layer(self.shaft.path, "front")),
                  (self.fist, Layer(self.fist.path, "front", keep=frozenset({"wood_base"})))]
        labels = compose_labels(self.body, layers)
        self.assertEqual(labels[8][10], "shaft.txt")
        self.assertEqual(labels[9][9], "fist.txt")

    def test_open_hand_pixels_finds_a_fist_touching_a_sleeve_or_nothing(self):
        part = self.ws.grid("open.txt", {(10, 10): "b", (11, 10): "b", (9, 10): "q", (10, 9): "o"},
                            "o=outline b=skin_base q=cloak_dark_base")
        self.assertEqual(open_hand_pixels(part, {"skin_base"}), [(10, 10), (11, 10)])

    def test_closed_fist_passes(self):
        self.assertEqual(open_hand_pixels(self.fist, {"skin_base"}), [])

    def test_fist_at_the_frame_edge_is_open(self):
        part = self.ws.grid("edge.txt", {(0, 5): "b", (1, 5): "o", (0, 4): "o", (0, 6): "o"}, BODY_MAP)
        self.assertEqual(open_hand_pixels(part, {"skin_base"}), [(0, 5)])

    def config(self, layer: dict, **top) -> Path:
        self.ws.write("body2.txt", grid_text({(0, 0): "o"}, BODY_MAP))
        config = {"unit": "t", **top,
                  "frames": {"down_base": {"body": str(self.ws.root / "body2.txt"), "layers": [layer]}}}
        return self.ws.write("compose/t.json", json.dumps(config))

    def run_main(self, path: Path) -> tuple[int, str]:
        err = io.StringIO()
        with contextlib.redirect_stderr(err), contextlib.redirect_stdout(io.StringIO()):
            code = main([str(path), "--out", str(self.ws.root / "out")])
        return code, err.getvalue()

    def test_main_stops_on_an_open_hand_part(self):
        part = self.ws.write("open.txt", grid_text({(10, 10): "b"}, BODY_MAP))
        path = self.config({"part": str(part), "z": "front", "hand": True}, hand_colours=["skin_base"])
        code, err = self.run_main(path)
        self.assertEqual(code, 2)
        self.assertIn("open.txt: 拳が四方とも輪郭で閉じていない", err)
        self.assertIn("(10,10)", err)
        self.assertFalse((self.ws.root / "out").exists())

    def test_main_composes_a_closed_hand_part(self):
        part = self.ws.write("closed.txt", self.fist.path.read_text(encoding="utf-8"))
        path = self.config({"part": str(part), "z": "front", "hand": True}, hand_colours=["skin_base"])
        self.assertEqual(self.run_main(path)[0], 0)

    def test_hand_without_hand_colours_is_an_error(self):
        path = self.config({"part": "p.txt", "z": "front", "hand": True})
        with self.assertRaisesRegex(ComposeError, "hand_colours"):
            load_config(path, self.ws.root)

    def test_keep_and_hand_are_read(self):
        path = self.config({"part": "p.txt", "z": "front", "hand": True, "keep": ["wood_base"]},
                           hand_colours=["skin_base"])
        _, frames = load_config(path, self.ws.root)
        layer = frames["down_base"].layers[0]
        self.assertEqual((layer.keep, layer.hand), (frozenset({"wood_base"}), True))
        self.assertEqual(frames["down_base"].hand_colours, frozenset({"skin_base"}))

    def test_keep_must_be_a_list_of_strings(self):
        path = self.config({"part": "p.txt", "z": "front", "keep": "wood_base"})
        with self.assertRaisesRegex(ComposeError, "keep"):
            load_config(path, self.ws.root)


if __name__ == "__main__":
    unittest.main()
