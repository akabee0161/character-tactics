"""Checks for tools/unit_picker.py (部品の組み合わせを選ぶページ)."""
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

from unit_picker import (  # noqa: E402
    ALPHABET,
    PickerError,
    build_data,
    combinations,
    load_picker,
    main,
    write_html,
)

DIRS = ("down", "up", "left", "right")
BODY_MAP = "o=outline b=skin_base"
PART_MAP = "o=outline h=leaf_base"


def grid_text(pixels: dict[tuple[int, int], str], maps: str, size: int = 32) -> str:
    rows = [["."] * size for _ in range(size)]
    for (x, y), ch in pixels.items():
        rows[y][x] = ch
    header = f"# type: unit\n# size: {size}x{size}\n# light: upper-left\n# bg: transparent\n"
    return header + f"# map: {maps}\n" + "\n".join("".join(r) for r in rows) + "\n"


class Workspace:
    """A throwaway forge root: a body and parts for every direction, and a picker config."""

    def __init__(self) -> None:
        self._tmp = tempfile.TemporaryDirectory()
        self.root = Path(self._tmp.name)
        for d in DIRS:
            self.write(f"body_{d}.txt", grid_text({(10, 10): "b"}, BODY_MAP))
            # 頭の案 H1 は (11,10)、H2 は (12,10)。体の画素 (10,10) にも1画素重ねる
            self.write(f"head1_{d}.txt", grid_text({(11, 10): "h", (10, 10): "h"}, PART_MAP))
            self.write(f"head2_{d}.txt", grid_text({(12, 10): "h"}, PART_MAP))
            self.write(f"knife_{d}.txt", grid_text({(10, 10): "o", (5, 5): "o"}, "o=outline"))

    def write(self, rel: str, text: str) -> Path:
        path = self.root / rel
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(text, encoding="utf-8")
        return path

    def config(self, **overrides) -> Path:
        data = {
            "unit": "gau",
            "title": "ガウの組み合わせ",
            "body": "body_{dir}.txt",
            "elements": {
                "head": {"label": "頭", "variants": {
                    "H1": {"label": "丸い", "layers": [{"part": "head1_{dir}.txt", "z": "front"}]},
                    "H2": {"label": "高い", "layers": [{"part": "head2_{dir}.txt"}]},
                }},
                "weapon": {"label": "短剣", "variants": {
                    "D1": {"label": "4px", "layers": [{"part": "knife_{dir}.txt", "z": {"left": "back"}}]},
                    "D2": {"label": "なし", "layers": []},
                    "D3": {"label": "5px", "layers": [{"part": "knife_{dir}.txt", "z": "back"}]},
                }},
            },
            "refs": {"ロラン": "body_{dir}.txt"},
        }
        data.update(overrides)
        return self.write("picker.json", json.dumps(data, ensure_ascii=False))

    def close(self) -> None:
        self._tmp.cleanup()


def pixel(data: dict, key: str, x: int, y: int) -> str | None:
    ch = data["frames"][key][y * 32 + x]
    return None if ch == "." else data["colours"][ALPHABET.index(ch)]


class LoadPickerTest(unittest.TestCase):
    def setUp(self):
        self.ws = Workspace()

    def tearDown(self):
        self.ws.close()

    def test_reads_elements_in_order_with_defaults(self):
        picker = load_picker(self.ws.config(), root=self.ws.root)
        self.assertEqual(list(picker.elements), ["head", "weapon"])
        self.assertEqual(picker.directions, list(DIRS))
        self.assertEqual(picker.default, {"head": "H1", "weapon": "D1"})
        layer = picker.elements["head"].variants["H2"].layers[0]
        self.assertEqual(layer.z_for("left"), "front")

    def test_z_can_differ_by_direction(self):
        picker = load_picker(self.ws.config(), root=self.ws.root)
        layer = picker.elements["weapon"].variants["D1"].layers[0]
        self.assertEqual((layer.z_for("left"), layer.z_for("down")), ("back", "front"))

    def test_unknown_z_is_an_error(self):
        cfg = self.ws.config(elements={"head": {"label": "頭", "variants": {
            "H1": {"label": "x", "layers": [{"part": "head1_{dir}.txt", "z": "middle"}]}}}})
        with self.assertRaisesRegex(PickerError, "middle"):
            load_picker(cfg, root=self.ws.root)

    def test_unknown_key_is_an_error(self):
        cfg = self.ws.config(elemnts={})
        with self.assertRaisesRegex(PickerError, "elemnts"):
            load_picker(cfg, root=self.ws.root)

    def test_default_must_name_a_variant(self):
        cfg = self.ws.config(default={"head": "H9"})
        with self.assertRaisesRegex(PickerError, "H9"):
            load_picker(cfg, root=self.ws.root)

    def test_matrix_must_name_elements(self):
        cfg = self.ws.config(matrix={"rows": "head", "cols": "hair"})
        with self.assertRaisesRegex(PickerError, "hair"):
            load_picker(cfg, root=self.ws.root)

    def test_matrix_needs_both_rows_and_cols(self):
        cfg = self.ws.config(matrix={"rows": "head"})
        with self.assertRaisesRegex(PickerError, "cols"):
            load_picker(cfg, root=self.ws.root)

    def test_matrix_rows_and_cols_must_differ(self):
        cfg = self.ws.config(matrix={"rows": "head", "cols": "head"})
        with self.assertRaisesRegex(PickerError, "head"):
            load_picker(cfg, root=self.ws.root)

    def test_variant_ids_must_be_unique_across_elements(self):
        cfg = self.ws.config(elements={
            "head": {"label": "頭", "variants": {"A": {"label": "x", "layers": []}}},
            "weapon": {"label": "短剣", "variants": {"A": {"label": "y", "layers": []}}}})
        with self.assertRaisesRegex(PickerError, "'A'"):
            load_picker(cfg, root=self.ws.root)


class CombinationsTest(unittest.TestCase):
    def setUp(self):
        self.ws = Workspace()

    def tearDown(self):
        self.ws.close()

    def test_every_combination_once(self):
        picks = combinations(load_picker(self.ws.config(), root=self.ws.root))
        self.assertEqual(len(picks), 6)
        self.assertIn({"head": "H2", "weapon": "D3"}, picks)

    def test_too_many_combinations_is_an_error(self):
        variants = {f"V{i}": {"label": str(i), "layers": []} for i in range(30)}
        cfg = self.ws.config(elements={
            "a": {"label": "a", "variants": variants},
            "b": {"label": "b", "variants": {f"W{i}": {"label": str(i), "layers": []} for i in range(30)}}})
        with self.assertRaisesRegex(PickerError, "900"):
            combinations(load_picker(cfg, root=self.ws.root))


class BuildDataTest(unittest.TestCase):
    def setUp(self):
        self.ws = Workspace()
        self.data = build_data(load_picker(self.ws.config(), root=self.ws.root))

    def tearDown(self):
        self.ws.close()

    def test_front_part_paints_over_the_body(self):
        self.assertEqual(pixel(self.data, "H1-D2|down", 10, 10), "#1f5c40")  # leaf_base
        self.assertEqual(pixel(self.data, "H1-D2|down", 11, 10), "#1f5c40")

    def test_back_part_is_hidden_by_the_body(self):
        self.assertEqual(pixel(self.data, "H2-D3|down", 10, 10), "#f0c49a")  # skin_base
        self.assertEqual(pixel(self.data, "H2-D3|down", 5, 5), "#1a1228")    # outline, where the body is clear

    def test_z_by_direction_is_used(self):
        self.assertEqual(pixel(self.data, "H2-D1|down", 10, 10), "#1a1228")  # front in down
        self.assertEqual(pixel(self.data, "H2-D1|left", 10, 10), "#f0c49a")  # back in left

    def test_every_combination_and_direction_has_a_frame(self):
        self.assertEqual(len(self.data["frames"]), 6 * 4)
        self.assertTrue(all(len(f) == 32 * 32 for f in self.data["frames"].values()))

    def test_parts_are_also_shown_alone(self):
        self.assertEqual(pixel({"frames": self.data["parts"], "colours": self.data["colours"]},
                               "H1|down", 11, 10), "#1f5c40")
        self.assertIsNone(pixel({"frames": self.data["parts"], "colours": self.data["colours"]},
                                "H2|down", 10, 10))

    def test_refs_are_rendered_per_direction(self):
        self.assertIn("ロラン|up", self.data["refs"])

    def test_letter_clash_names_the_combination(self):
        self.ws.write("knife_down.txt", grid_text({(5, 5): "b"}, "b=leaf_base"))
        with self.assertRaisesRegex(PickerError, r"H1-D1.*down"):
            build_data(load_picker(self.ws.config(), root=self.ws.root))


class WriteHtmlTest(unittest.TestCase):
    def test_page_embeds_the_data(self):
        ws = Workspace()
        try:
            out = write_html(load_picker(ws.config(title="ガウ </script> の組み合わせ"), root=ws.root),
                             ws.root / "build" / "gau.html")
            text = out.read_text(encoding="utf-8")
            self.assertNotIn("__DATA__", text)
            self.assertNotIn("</script> の", text)
            self.assertIn('"H1-D2|down"', text)
        finally:
            ws.close()


class MainTest(unittest.TestCase):
    def run_main(self, argv: list[str]) -> tuple[int, str, str]:
        out, err = io.StringIO(), io.StringIO()
        with contextlib.redirect_stdout(out), contextlib.redirect_stderr(err):
            code = main(argv)
        return code, out.getvalue(), err.getvalue()

    def test_writes_the_page(self):
        ws = Workspace()
        try:
            target = ws.root / "out.html"
            code, out, _ = self.run_main([str(ws.config()), "--root", str(ws.root), "--out", str(target)])
            self.assertEqual(code, 0)
            self.assertTrue(target.exists())
            self.assertIn("6", out)
        finally:
            ws.close()

    def test_missing_config_exits_two(self):
        code, _, err = self.run_main(["/nonexistent/picker.json", "--out", "/tmp/x.html"])
        self.assertEqual(code, 2)
        self.assertIn("error", err)


if __name__ == "__main__":
    unittest.main()
