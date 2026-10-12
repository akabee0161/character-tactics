import json
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "tools"))

from compose import compose_frame, load_config  # noqa: E402
from cut_layers import CORE, Part  # noqa: E402
from gridfile import parse  # noqa: E402
from parts_export import NONE, ExportError, PartDef, UnitDef, cut_chars, export, grid_text, unit_charmap  # noqa: E402

MAP = {"o": "outline", "b": "skin_base", "m": "wood_shadow", "w": "wood_shadow", "q": "metal_base"}
HEAD = "# type: unit\n# size: 32x32\n# light: upper-left\n# bg: transparent\n# map: " + \
       " ".join(f"{k}={v}" for k, v in MAP.items()) + "\n"


def frame(pixels: dict[tuple[int, int], str]) -> str:
    rows = [["."] * 32 for _ in range(32)]
    for (x, y), ch in pixels.items():
        rows[y][x] = ch
    return HEAD + "\n".join("".join(r) for r in rows) + "\n"


def grids(spec):
    """compose.py の main と同じやり方で、コマの設定から (素体, [(部品, Layer)]) を読む。"""
    return parse(spec.body), [(parse(layer.part), layer) for layer in spec.layers]


# 体（q）・弓（m）・矢（w）・拳（b、輪郭 o）。弓と矢は同じ wood_shadow
BODY = {(x, y): "q" for x in range(12, 15) for y in range(12, 20)}
BOW = {(20, y): "m" for y in range(10, 20)}
ARROW = {(x, 15): "w" for x in range(16, 20)}
FIST = {(21, 15): "b", (21, 16): "b", (22, 15): "o", (22, 16): "o", (21, 14): "o", (21, 17): "o"}


class PartsExportTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name)
        self.src = self.root / "assets/unit/t"
        self.src.mkdir(parents=True)
        for st in ("base", "walk_a", "idle2"):
            (self.src / f"down_{st}.txt").write_text(frame({**BODY, **BOW, **ARROW, **FIST}), encoding="utf-8")
        self.unit = UnitDef(
            unit="t", src=self.src, dirs=("down",), states=("base", "walk_a"), shares={"walk_a": "base"},
            parts=(PartDef("弓", "bow", frozenset("m")),
                   PartDef("矢", "arrow", frozenset("w")),
                   PartDef("弓の拳", "bow_hand", frozenset("b"), {("down", "base"): (21, 15, 21, 16)},
                           hand=True, keep=("wood_shadow",)),
                   PartDef("矢の拳", "arrow_hand", frozenset("b"), {("down", "base"): NONE}, hand=True)),
            orders={"down": ("矢の拳", "弓", CORE, "矢", "弓の拳")},
            hand_colours=("skin_base",))

    def tearDown(self):
        self.tmp.cleanup()

    def run_export(self, unit=None):
        export(unit or self.unit, self.root / "assets/unit/t/parts", self.root / "compose/t.json", self.root)
        return json.loads((self.root / "compose/t.json").read_text(encoding="utf-8"))

    def test_same_colour_different_chars_stay_apart(self):
        grid = parse(self.src / "down_base.txt")
        layers = cut_chars(grid.rows, grid.charmap,
                           [Part("弓", (0, 0, 31, 31), {"m"}), Part("矢", (0, 0, 31, 31), {"w"})])
        self.assertEqual(layers["弓"][15][20], "m")
        self.assertEqual(layers["矢"][15][17], "w")
        self.assertEqual(layers["弓"][15][17], ".")
        self.assertEqual(layers[CORE][15][17], ".")

    def test_composed_parts_reproduce_every_frame(self):
        self.run_export()
        _unit, specs = load_config(self.root / "compose/t.json", self.root)
        self.assertEqual(set(specs), {"down_base", "down_walk_a"})
        for name, spec in specs.items():
            rows = compose_frame(*grids(spec))[0]
            self.assertEqual(rows, parse(self.src / f"{name}.txt").rows, name)

    def test_walk_reuses_the_base_part_files_but_not_the_core(self):
        config = self.run_export()
        base, walk = config["frames"]["down_base"], config["frames"]["down_walk_a"]
        self.assertEqual([entry["part"] for entry in base["layers"]], [entry["part"] for entry in walk["layers"]])
        self.assertNotEqual(base["body"], walk["body"])

    def test_back_parts_are_listed_nearest_the_core_first(self):
        config = self.run_export()
        layers = config["frames"]["down_base"]["layers"]
        self.assertEqual([Path(entry["part"]).name for entry in layers],
                         ["bow_down_base.txt", "arrow_hand_down_base.txt", "arrow_down_base.txt", "bow_hand_down_base.txt"])
        self.assertEqual([entry["z"] for entry in layers], ["back", "back", "front", "front"])

    def test_hand_parts_carry_hand_and_keep(self):
        config = self.run_export()
        self.assertEqual(config["hand_colours"], ["skin_base"])
        by_name = {Path(entry["part"]).name: entry for entry in config["frames"]["down_base"]["layers"]}
        self.assertEqual(by_name["bow_hand_down_base.txt"], {"part": "assets/unit/t/parts/bow_hand_down_base.txt",
                                                            "z": "front", "hand": True, "keep": ["wood_shadow"]})
        self.assertNotIn("keep", by_name["arrow_hand_down_base.txt"])

    def test_empty_part_is_written_with_the_outline_map(self):
        self.run_export()
        grid = parse(self.root / "assets/unit/t/parts/arrow_hand_down_base.txt")
        self.assertEqual(grid.charmap, {"o": "outline"})
        self.assertTrue(all(set(row) == {"."} for row in grid.rows))

    def test_missing_box_for_a_state_stops(self):
        unit = UnitDef(**{**self.unit.__dict__, "states": ("base", "idle2")})
        with self.assertRaisesRegex(ExportError, "down_idle2 の箱が無い"):
            self.run_export(unit)

    def stops_without_writing(self, unit, message):
        """書き出しが message で止まり、前からある部品・芯・設定を1つも変えず、新しいファイルも作らない。"""
        parts = self.root / "assets/unit/t/parts"
        parts.mkdir(parents=True)
        kept = {parts / "core_down_base.txt": "前からある芯\n", parts / "bow_down_base.txt": "前からある弓\n",
                self.root / "compose/t.json": "前からある設定\n"}
        for path, text in kept.items():
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(text, encoding="utf-8")
        with self.assertRaisesRegex(ExportError, message):
            self.run_export(unit)
        for path, text in kept.items():
            self.assertEqual(path.read_text(encoding="utf-8"), text, path.name)
        self.assertEqual(sorted(p.name for p in parts.iterdir()), ["bow_down_base.txt", "core_down_base.txt"])

    def test_missing_box_in_a_later_state_writes_nothing(self):
        # 後ろの状態（idle2）で箱が無くても、前の状態（base）の部品を書いてから止まらない（PR #32 の CodeRabbit の指摘）
        self.stops_without_writing(UnitDef(**{**self.unit.__dict__, "states": ("base", "idle2")}),
                                   "down_idle2 の箱が無い")

    def test_order_without_the_core_writes_nothing(self):
        orders = {"down": ("矢の拳", "弓", "矢", "弓の拳")}
        self.stops_without_writing(UnitDef(**{**self.unit.__dict__, "orders": orders}), "芯")

    def test_order_naming_an_unknown_part_writes_nothing(self):
        orders = {"down": ("矢の拳", "弓", CORE, "矢", "弓の拳", "盾")}
        self.stops_without_writing(UnitDef(**{**self.unit.__dict__, "orders": orders}), "盾")

    def test_part_missing_from_the_order_writes_nothing(self):
        orders = {"down": ("弓", CORE, "矢", "弓の拳")}
        self.stops_without_writing(UnitDef(**{**self.unit.__dict__, "orders": orders}), "矢の拳")

    def test_direction_without_an_order_writes_nothing(self):
        self.stops_without_writing(UnitDef(**{**self.unit.__dict__, "orders": {}}), "down")

    def test_unreadable_frame_in_a_later_state_writes_nothing(self):
        (self.src / "down_walk_a.txt").write_text("# type: unit\n# size: 32x32\nこわれた行\n", encoding="utf-8")
        parts = self.root / "assets/unit/t/parts"
        parts.mkdir(parents=True)
        (parts / "core_down_base.txt").write_text("前からある芯\n", encoding="utf-8")
        with self.assertRaises(Exception):
            self.run_export()
        self.assertEqual((parts / "core_down_base.txt").read_text(encoding="utf-8"), "前からある芯\n")
        self.assertEqual([p.name for p in parts.iterdir()], ["core_down_base.txt"])
        self.assertFalse((self.root / "compose/t.json").exists())

    def test_conflicting_charmaps_stop(self):
        bad = self.root / "bad.txt"
        bad.write_text(frame({}).replace("m=wood_shadow", "m=wood_base"), encoding="utf-8")
        with self.assertRaisesRegex(ExportError, "'m'"):
            unit_charmap([self.src / "down_base.txt", bad])

    def test_grid_text_lists_only_used_chars_outline_first(self):
        rows = ["." * 32] * 31 + ["bo" + "." * 30]
        text = grid_text(rows, MAP, "note")
        self.assertIn("# map: o=outline b=skin_base\n", text)
        self.assertTrue(text.startswith("# note\n"))


if __name__ == "__main__":
    unittest.main()
