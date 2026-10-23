"""Checks for tools/tip_check.py（6 刃・鏃の先端の決まり1〜5。判定は tools/tip_rule.py）."""
from __future__ import annotations

import contextlib
import io
import json
import shutil
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "tools"))
sys.path.insert(0, str(Path(__file__).resolve().parent))

from tip_check import main  # noqa: E402
from unit_fixture import UnitFixture  # noqa: E402

# 既定の剣（中身1、刃 x=22・y=6〜12）の蓋を3画素にする。中身1の蓋は1画素なので決まり1に反する
WIDE_CAP = {(21, 5): "o", (22, 5): "o", (23, 5): "o"}


class TipCheckTest(unittest.TestCase):
    def setUp(self):
        self.fx = UnitFixture()
        self.addCleanup(self.fx.close)

    def test_the_default_unit_passes(self):
        code, out = self.fx.run(main)
        self.assertEqual(code, 0, out)
        self.assertIn("先端: ok", out)

    def test_a_blade_tip_that_breaks_a_rule_fails(self):
        self.fx.frames["down_base"]["sword"].update(WIDE_CAP)
        code, out = self.fx.run(main)
        self.assertEqual(code, 1)
        self.assertIn("FAIL sword_down_base: sword の先端 up (22,6): 決まり1", out)

    def test_other_parts_are_not_judged(self):
        # 盾（刃の文字でない）の輪郭に囲まれた1画素は見ない。鍔の端・斜めの矢・足先と同じ形（2026-10-16 依頼者）
        self.fx.frames["down_base"]["shield"].update(
            {(8, 16): "m", (8, 15): "o", (7, 16): "o", (9, 16): "o", (8, 17): "o"})
        code, out = self.fx.run(main)
        self.assertEqual(code, 0, out)

    def test_a_blade_hidden_by_a_nearer_part_is_still_judged(self):
        # 部品ごとの形で判断する（2026-10-17 依頼者）。手前の盾で隠れていても、部品の先端が決まりに反すれば落とす
        self.fx.frames["down_base"]["sword"].update(WIDE_CAP)
        self.fx.frames["down_base"]["shield"].update({(21, 5): "m", (22, 5): "m", (23, 5): "m"})
        code, out = self.fx.run(main)
        self.assertEqual(code, 1)
        self.assertIn("(22,6)", out)

    def test_an_empty_blade_part_passes(self):
        # 剣ごと体に隠れるコマの空の部品（刃の文字が無い）は何も出さない
        self.fx.frames["down_atk_hit"]["sword"] = {}
        code, out = self.fx.run(main)
        self.assertEqual(code, 0, out)

    def test_a_part_file_used_by_several_frames_is_reported_once(self):
        # 同じ部品のファイルを2つのコマで使っても、FAIL は1行だけ（最終レビュー Minor 2）
        self.fx.frames["down_base"]["sword"].update(WIDE_CAP)
        path = self.fx.write()
        compose_path = self.fx.root / "compose/t.json"
        spec = json.loads(compose_path.read_text(encoding="utf-8"))
        base = next(l["part"] for l in spec["frames"]["down_base"]["layers"] if "sword_down_base" in l["part"])
        for layer in spec["frames"]["down_walk_a"]["layers"]:
            if "sword_down_walk_a" in layer["part"]:
                layer["part"] = base
        compose_path.write_text(json.dumps(spec), encoding="utf-8")
        out = io.StringIO()
        with contextlib.redirect_stdout(out), contextlib.redirect_stderr(out):
            code = main([str(path), "--root", str(self.fx.root)])
        self.assertEqual(code, 1, out.getvalue())
        self.assertEqual(out.getvalue().count("FAIL sword_down_base:"), 1, out.getvalue())

    def test_skipped_tips_are_noted_but_pass(self):
        # 中身5画素以上は決まりの外。落とさず NOTE で出す
        sword = self.fx.frames["down_base"]["sword"]
        for y in range(6, 13):
            for x in range(20, 25):
                sword[(x, y)] = "i"
            sword[(19, y)] = sword[(25, y)] = "o"
        code, out = self.fx.run(main)
        self.assertEqual(code, 0, out)
        self.assertIn("NOTE sword_down_base: sword の先端", out)
        self.assertIn("対象外", out)


FIXTURES = Path(__file__).resolve().parent / "fixtures"


class ItemTipCheckTest(unittest.TestCase):
    """--items checks/items.json: item のアイコンを、設定に書いた刃の文字で判定する。"""

    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        for name in ("tip_item_ok", "tip_item_no_corner"):
            shutil.copy(FIXTURES / f"{name}.txt", self.root / f"{name}.txt")

    def run_items(self, items: dict) -> tuple[int, str]:
        config = self.root / "items.json"
        config.write_text(json.dumps({"items": items}), encoding="utf-8")
        out, err = io.StringIO(), io.StringIO()
        with contextlib.redirect_stdout(out), contextlib.redirect_stderr(err):
            code = main(["--items", str(config), "--root", str(self.root)])
        return code, out.getvalue() + err.getvalue()

    def test_items_that_follow_the_rule_pass(self):
        code, out = self.run_items({"tip_item_ok.txt": {"blade": "ijk"}})
        self.assertEqual(code, 0, out)
        self.assertIn("先端: ok", out)

    def test_an_item_without_the_corner_fails(self):
        code, out = self.run_items({"tip_item_no_corner.txt": {"blade": "ijk"}})
        self.assertEqual(code, 1, out)
        self.assertIn("FAIL tip_item_no_corner: 刃 の先端 up_right (13,2): 決まり5", out)

    def test_characters_not_listed_as_blade_are_ignored(self):
        code, out = self.run_items({"tip_item_no_corner.txt": {"blade": "h"}})
        self.assertEqual(code, 0, out)

    def test_the_items_option_can_be_written_with_an_equals_sign(self):
        config = self.root / "items.json"
        config.write_text(json.dumps({"items": {"tip_item_ok.txt": {"blade": "ijk"}}}), encoding="utf-8")
        out = io.StringIO()
        with contextlib.redirect_stdout(out), contextlib.redirect_stderr(out):
            code = main([f"--items={config}", "--root", str(self.root)])
        self.assertEqual(code, 0, out.getvalue())

    def test_an_unknown_character_is_a_config_error(self):
        code, out = self.run_items({"tip_item_ok.txt": {"blade": "Z"}})
        self.assertEqual(code, 2, out)
        self.assertIn("error:", out)


if __name__ == "__main__":
    unittest.main()
