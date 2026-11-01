"""Checks for tools/part_outline.py (33 拳以外の部品が輪郭で閉じている)."""
from __future__ import annotations

import contextlib
import io
import json
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "tools"))
sys.path.insert(0, str(Path(__file__).resolve().parent))

from part_outline import main  # noqa: E402
from unit_fixture import UnitFixture, box  # noqa: E402


class PartOutlineTest(unittest.TestCase):
    def setUp(self):
        self.fx = UnitFixture()
        self.addCleanup(self.fx.close)

    def test_closed_parts_pass(self):
        code, out = self.fx.run(main)
        self.assertEqual(code, 0, out)

    def test_an_open_pixel_fails_once_per_file(self):
        del self.fx.frames["down_base"]["shield"][(7, 20)]  # 盾の左の輪郭に穴: (8,20) が透明に接する
        code, out = self.fx.run(main)
        self.assertEqual(code, 1)
        self.assertIn("FAIL shield_down_base: 輪郭で閉じていない画素 1 件: (8,20)", out)
        self.assertEqual(out.count("FAIL"), 1)

    def test_the_frame_edge_counts_as_open(self):
        self.fx.frames["down_base"]["shield"][(0, 5)] = "m"
        code, out = self.fx.run(main)
        self.assertEqual(code, 1)
        self.assertIn("(0,5)", out)

    def test_open_chars_are_not_checked(self):
        del self.fx.frames["down_base"]["sword"][(23, 8)]  # 刃の右の輪郭を外す
        self.fx.checks["parts"]["sword"]["open_chars"] = "i"
        code, out = self.fx.run(main)
        self.assertEqual(code, 0, out)

    def test_fists_are_left_to_compose(self):
        self.fx.checks["parts"]["sword_hand"]["fist"] = True
        self.fx.frames["down_base"]["sword_hand"][(30, 30)] = "o"  # 拳は見ない（compose.py が見る）
        code, out = self.fx.run(main)
        self.assertEqual(code, 0, out)

    def add_edge_part(self, key: str, fill: str, map_text: str, role: dict | None = None, core_top: int = 5):
        """体の頭の上に載る部品: 輪郭の箱 (12,2)-(19,8) の下の行 y=8 だけ輪郭でなく fill。芯の上端は core_top。"""
        pixels = box(12, 2, 19, 8, fill)
        for x in range(13, 19):
            pixels[(x, 8)] = fill
        for layers in self.fx.frames.values():
            layers[key] = dict(pixels)
        self.fx.maps[key] = map_text
        self.fx.checks["parts"][key] = role or {}
        self.fx.checks["orders"]["down"].append(key)
        self.fx.checks["orders"]["up"].append(key)
        for name in ("down_base", "up_base"):
            self.fx.frames[name]["core"] = box(12, core_top, 19, 30, "c")

    def test_hair_edge_over_core_passes(self):
        self.add_edge_part("hair", "h", "o=contour h=hair_red_base")  # 下の縁 y=8 は芯 (y>=5) の上
        code, out = self.fx.run(main)
        self.assertEqual(code, 0, out)

    def test_hair_edge_outside_core_fails(self):
        self.add_edge_part("hair", "h", "o=contour h=hair_red_base", core_top=12)  # 縁の下 y=9 は芯の外
        code, out = self.fx.run(main)
        self.assertEqual(code, 1, out)
        self.assertIn("FAIL hair_down_base: 輪郭で閉じていない画素 6 件", out)

    def test_ornament_edge_over_core_passes(self):
        self.add_edge_part("pin", "p", "o=contour p=patch_base")
        code, out = self.fx.run(main)
        self.assertEqual(code, 0, out)

    def test_headgear_edge_over_core_fails(self):
        self.add_edge_part("helm", "h", "o=contour h=helmet_steel_base")  # 兜は体の上でも輪郭で閉じる
        code, out = self.fx.run(main)
        self.assertEqual(code, 1, out)
        self.assertIn("FAIL helm_down_base: 輪郭で閉じていない画素 6 件", out)

    def test_edge_over_core_in_only_some_frames_fails(self):
        self.add_edge_part("hair", "h", "o=contour h=hair_red_base")
        path = self.fx.write(build=False)
        compose_path = self.fx.root / "compose/t.json"
        data = json.loads(compose_path.read_text(encoding="utf-8"))
        shared = next(layer["part"] for layer in data["frames"]["down_base"]["layers"] if "hair_" in layer["part"])
        for layer in data["frames"]["down_walk_a"]["layers"]:
            if "hair_" in layer["part"]:
                layer["part"] = shared  # 歩きのコマも同じ髪の絵を使う
        compose_path.write_text(json.dumps(data), encoding="utf-8")
        walk = self.fx.root / "assets/part/body/t/core_down_walk_a.txt"
        lines = walk.read_text(encoding="utf-8").splitlines()
        rows = [l for l in lines if not l.startswith("#")]
        self.assertTrue(any("c" in l for l in rows), rows)  # 置き換えの前に、芯の文字 c が絵にあると確かめる
        walk.write_text("\n".join(l if l.startswith("#") else l.replace("c", ".") for l in lines) + "\n", encoding="utf-8")  # 歩きの芯は髪の下に無い
        out = io.StringIO()
        with contextlib.redirect_stdout(out), contextlib.redirect_stderr(out):
            code = main([str(path), "--root", str(self.fx.root)])
        self.assertEqual(code, 1, out.getvalue())
        self.assertIn("FAIL hair_down_base: 輪郭で閉じていない画素", out.getvalue())


    def test_a_colour_name_missing_from_the_palette_is_a_clear_error(self):
        self.add_edge_part("hair", "h", "o=contour h=no_such_colour")
        code, out = self.fx.run(main)
        self.assertEqual(code, 2, out)
        self.assertIn("パレットに無い色名 no_such_colour", out)
        self.assertIn("hair_down_base", out)


if __name__ == "__main__":
    unittest.main()
