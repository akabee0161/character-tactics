"""Checks for tools/unit_rules.py (ユニットの方針の確認をまとめて走らせる入口)."""
from __future__ import annotations

import contextlib
import io
import sys
import unittest
from pathlib import Path
from unittest import mock

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "tools"))
sys.path.insert(0, str(Path(__file__).resolve().parent))

import unit_rules  # noqa: E402
from unit_config import load_unit_config  # noqa: E402
from unit_fixture import UnitFixture, core  # noqa: E402
from unit_rules import covered_by, main, plan  # noqa: E402

TALL = 4  # 芯の上端 y=4 → 背丈 27px（height_check が全コマで落ちる）


def exception(check="height_check", frames=("down_base",), what="背丈 27px"):
    return {"check": check, "frames": list(frames), "what": what, "why": "テスト", "approved": "2026-10-16 依頼者"}


class UnitRulesTest(unittest.TestCase):
    def setUp(self):
        self.fx = UnitFixture()
        self.addCleanup(self.fx.close)

    def make_tall(self):
        for layers in self.fx.frames.values():  # 脚（y>=28）は今のまま、上端だけ y=4 へ
            layers["core"] = core(TALL) | {p: ch for p, ch in layers["core"].items() if p[1] >= 28}

    def run_written(self, cfg_path: Path) -> tuple[int, str]:
        out = io.StringIO()
        with contextlib.redirect_stdout(out), contextlib.redirect_stderr(out):
            code = main([str(cfg_path), "--root", str(self.fx.root)])
        return code, out.getvalue()

    def test_the_default_unit_passes_every_check(self):
        code, out = self.fx.run(main)
        self.assertEqual(code, 0, out)
        for name in ("validate", "compose", "body_check", "hand_mirror", "unit_check", "order_check",
                     "blade_height", "still_check", "height_check", "tip_check", "part_chars", "eye_check",
                     "part_outline", "fist_check"):
            self.assertIn(f"ok   {name}", out)
        self.assertIn("--   weapon_check: 設定に無いので走らせない", out)

    def test_failures_not_in_exceptions_exit_1_and_are_listed(self):
        self.make_tall()
        code, out = self.fx.run(main)
        self.assertEqual(code, 1)
        self.assertIn("NG   height_check: 落ちた 8 件", out)
        self.assertIn("       FAIL down_base: 背丈 27px", out)

    def test_exceptions_pass_matching_lines_and_are_counted(self):
        self.make_tall()
        self.fx.checks["exceptions"] = [exception(frames=[n for n in self.fx.frames])]
        code, out = self.fx.run(main)
        self.assertEqual(code, 0, out)
        self.assertIn("ok   height_check（例外で通した 8 件）", out)

    def test_a_partial_exception_leaves_the_rest(self):
        self.make_tall()
        self.fx.checks["exceptions"] = [exception(frames=["down_base", "up_base"])]
        code, out = self.fx.run(main)
        self.assertEqual(code, 1)
        self.assertIn("NG   height_check: 落ちた 6 件（例外で通した 2 件）", out)

    def test_an_exception_for_another_check_does_not_apply(self):
        self.make_tall()
        self.fx.checks["exceptions"] = [exception(check="tip_check", frames=list(self.fx.frames))]
        code, out = self.fx.run(main)
        self.assertEqual(code, 1)
        self.assertIn("使われなかった例外: tip_check", out)

    def test_an_unused_exception_is_reported_but_does_not_fail(self):
        self.fx.checks["exceptions"] = [exception()]
        code, out = self.fx.run(main)
        self.assertEqual(code, 0, out)
        self.assertIn("使われなかった例外: height_check down_base 「背丈 27px」", out)

    def test_compose_differences_count_as_failures(self):
        self.fx.write()
        frame = self.fx.root / "assets/unit/t/down_base.txt"
        frame.write_text(frame.read_text(encoding="utf-8").replace("# map:", "# 手で直した\n# map:", 1),
                         encoding="utf-8")
        code, out = self.run_written(self.fx.root / "checks/t.json")
        self.assertEqual(code, 1)
        self.assertIn("NG   compose: 落ちた 1 件", out)
        self.assertIn("差あり down_base", out)

    def test_exit_1_without_failure_lines_still_fails(self):
        real = unit_rules.run

        def fake(name, argv):
            return (1, "何かがおかしい\n") if name == "tip_check" else real(name, argv)

        with mock.patch.object(unit_rules, "run", fake):
            code, out = self.fx.run(main)
        self.assertEqual(code, 1)
        self.assertIn("（tip_check が終了コード 1 を返したが、失敗の行が無い）", out)

    def test_a_tool_stopping_on_bad_input_exits_2(self):
        with mock.patch.object(unit_rules, "run", lambda name, argv: (2, "error: 読めない\n")):
            code, out = self.fx.run(main)
        self.assertEqual(code, 2)
        self.assertIn("error validate: 終了コード 2", out)

    def test_a_config_error_exits_2(self):
        self.fx.checks["parts"]["spear"] = {}
        code, out = self.fx.run(main)
        self.assertEqual(code, 2)
        self.assertIn("知らないキー spear", out)

    def test_weapon_check_arguments_come_from_the_config(self):
        self.fx.checks["weapon_check"] = {"blade": ["stone_hi"], "weapon": ["wood_base"], "hand": ["skin_hi"],
                                          "hidden": ["down_atk_hit", "up_atk_hit"], "depth": ["down"]}
        path = self.fx.write()
        steps = dict(plan(load_unit_config(path, self.fx.root), path, self.fx.root))
        self.assertEqual(steps["weapon_check"], [
            str(self.fx.root / "assets/unit/t"), "--blade", "stone_hi", "--weapon", "wood_base", "--hand", "skin_hi",
            "--hidden", "down_atk_hit,up_atk_hit", "--depth", "down"])


    def steps(self) -> dict:
        path = self.fx.write(build=False)
        return dict(plan(load_unit_config(path, self.fx.root), path, self.fx.root))

    def test_body_check_gets_the_hanging_chars_and_skips_protrusion_for_a_female_body(self):
        core = str(self.fx.root / "assets/part/body/t")
        self.assertEqual(self.steps()["body_check"], [core])
        self.fx.checks["head_chars"] = "c"
        self.fx.checks["body"] = "female"  # 女性の体には「はみ出し」を掛けない（2026-10-17 依頼者）
        self.assertEqual(self.steps()["body_check"], [core, "--hanging", "c", "--no-protrusion"])

    def test_unit_check_measures_the_legs_on_the_core(self):
        steps = self.steps()
        self.assertEqual(steps["unit_check"], [str(self.fx.root / "assets/unit/t"), "--items", "ikm",
                                               "--core", str(self.fx.root / "assets/part/body/t")])


class CoveredByTest(unittest.TestCase):
    def test_the_frame_name_must_be_before_the_colon(self):
        e = exception(check="weapon_check", frames=["left_base"], what="手が細い")
        self.assertTrue(covered_by("FAIL left_base: 手が細い（1x2px、(21,18) から）", e))
        self.assertFalse(covered_by("FAIL left_idle2: 手が細い（1x2px、(21,16) から）", e))
        self.assertFalse(covered_by("FAIL down: 握る位置がずれる: left_base=3.0", e))

    def test_the_what_must_be_in_the_line(self):
        e = exception(check="weapon_check", frames=["left_base"], what="手が細い（1x2px")
        self.assertFalse(covered_by("FAIL left_base: 手が細い（1x3px、(21,18) から）", e))

    def test_lines_without_a_colon_use_the_whole_line(self):
        e = exception(check="compose", frames=["down_base"], what="差あり")
        self.assertTrue(covered_by("差あり down_base（/x/assets/unit/t/down_base.txt）", e))


if __name__ == "__main__":
    unittest.main()
