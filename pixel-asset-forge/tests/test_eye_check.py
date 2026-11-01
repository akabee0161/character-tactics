"""Checks for tools/eye_check.py (12 目)."""
from __future__ import annotations

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "tools"))
sys.path.insert(0, str(Path(__file__).resolve().parent))

from eye_check import main  # noqa: E402
from unit_fixture import UnitFixture  # noqa: E402

CORE_MAP = "o=contour b=skin_fair_base c=clothes_dark_base u=face_pupil"


def face(core: dict, eyes: list[int], top: int = 10) -> dict:
    """芯の y=top〜top+1 の x=13〜18 を顔の肌 b にし、eyes の列に目（輪郭）を2行描く。"""
    for y in (top, top + 1):
        for x in range(13, 19):
            core[(x, y)] = "o" if x in eyes else "b"
    return core


class EyeCheckTest(unittest.TestCase):
    def setUp(self):
        self.fx = UnitFixture()
        self.addCleanup(self.fx.close)
        self.fx.maps["core"] = CORE_MAP
        self.fx.checks["eyes"]["down"] = {"x": [14, 17], "y": [10, 11]}
        for name, layers in self.fx.frames.items():
            if name.startswith("down_"):
                face(layers["core"], [14, 17])

    def test_eyes_beside_tellable_colours_pass(self):
        code, out = self.fx.run(main)
        self.assertEqual(code, 0, out)
        self.assertIn("目: ok", out)

    def test_dark_hair_beside_the_eye_passes_when_it_can_be_told_apart(self):
        # 髪・かぶり物でも、輪郭と見分けられる色なら目は読める（2026-10-16 依頼者。ロランの目の横の髪）
        self.fx.frames["down_base"]["core"][(18, 10)] = "c"
        code, out = self.fx.run(main)
        self.assertEqual(code, 0, out)

    def test_an_eye_beside_the_outline_colour_fails(self):
        self.fx.frames["down_base"]["core"][(18, 10)] = "o"
        code, out = self.fx.run(main)
        self.assertEqual(code, 1)
        self.assertIn("FAIL down_base: 目の左右の隣が目と見分けられない色 1 件: (18,10)", out)

    def test_a_colour_as_dark_as_the_outline_fails(self):
        self.fx.frames["down_base"]["core"][(13, 11)] = "u"  # face_pupil は contour と同じ #1a1228
        code, out = self.fx.run(main)
        self.assertEqual(code, 1)
        self.assertIn("(13,11)", out)

    def test_outline_above_and_below_the_eye_is_fine(self):
        # 真上が前髪や頭巾の縁の輪郭なのはよい（SPEC「自己チェック」②）
        self.fx.frames["down_base"]["core"].update({(14, 9): "o", (17, 12): "o"})
        code, out = self.fx.run(main)
        self.assertEqual(code, 0, out)

    def test_an_eye_pixel_that_is_not_outline_fails(self):
        face(self.fx.frames["down_idle2"]["core"], [14])  # 右の目が無い（設定の目の位置と絵が合わない）
        code, out = self.fx.run(main)
        self.assertEqual(code, 1)
        self.assertIn("FAIL down_idle2: 目の画素が輪郭の色でない 2 件: (17,10) (17,11)", out)

    def test_eye_top_rows_must_match_across_directions(self):
        self.fx.checks["eyes"]["up"] = {"x": [14, 17], "y": [11, 12]}
        for name, layers in self.fx.frames.items():
            if name.startswith("up_"):
                face(layers["core"], [14, 17], top=11)
        code, out = self.fx.run(main)
        self.assertEqual(code, 1)
        # 目の位置は設定に書くので、設定どうしを1回だけ比べる（状態の数だけ同じ行を出さない。最終レビュー 2026-10-17）
        self.assertIn("FAIL eyes: 目の上端の行が向きでそろわない: down=10 up=11", out)
        self.assertEqual(out.count("目の上端の行"), 1)

    def add_hair(self, pixels: dict, head: bool = True) -> None:
        """down_base に髪の部品を芯の手前に重ねる（ミストから髪・かぶり物を別の部品にする。2026-10-16）。"""
        self.fx.maps["hair"] = "o=contour h=face_hair_base"
        self.fx.frames["down_base"]["hair"] = pixels
        self.fx.checks["parts"]["hair"] = {"head": True} if head else {}
        self.fx.checks["orders"]["down"] = self.fx.checks["orders"]["down"] + ["hair"]

    def test_a_hair_part_beside_the_eye_is_seen(self):
        # 目は芯と髪・かぶり物の部品を重ねて見る（2026-10-18。武器や拳は重ねない）
        self.add_hair({(18, 10): "o"})
        code, out = self.fx.run(main)
        self.assertEqual(code, 1)
        self.assertIn("FAIL down_base: 目の左右の隣が目と見分けられない色 1 件: (18,10)", out)

    def test_a_hair_part_over_the_eye_is_seen(self):
        self.add_hair({(14, 10): "h"})
        code, out = self.fx.run(main)
        self.assertEqual(code, 1)
        self.assertIn("FAIL down_base: 目の画素が輪郭の色でない 1 件: (14,10)", out)

    def test_parts_that_are_not_hair_or_headwear_are_not_seen(self):
        self.add_hair({(18, 10): "o"}, head=False)
        code, out = self.fx.run(main)
        self.assertEqual(code, 0, out)

    def test_a_hair_part_behind_the_core_does_not_cover_it(self):
        self.add_hair({(14, 10): "h"})
        self.fx.checks["orders"]["down"] = ["hair"] + self.fx.checks["orders"]["down"][:-1]
        self.fx.back = {"hair"}
        code, out = self.fx.run(main)
        self.assertEqual(code, 0, out)

    def test_directions_without_eyes_are_skipped(self):
        self.fx.checks["eyes"]["down"] = None
        self.fx.frames["down_base"]["core"][(18, 10)] = "o"
        code, out = self.fx.run(main)
        self.assertEqual(code, 0, out)


LEFT_DIAGONAL = {(14, 10): "o", (15, 11): "o"}    # E2 の斜めの目（列と行の四角では書けない形）
RIGHT_DIAGONAL = {(17, 10): "o", (16, 11): "o"}


class EyePartTest(unittest.TestCase):
    """目の部品（parts の eye）があるユニットは、目の部品の画素から目を読む（2026-10-30。設定に eyes を書かない）。"""

    def setUp(self):
        self.fx = UnitFixture()
        self.addCleanup(self.fx.close)
        self.fx.maps["core"] = CORE_MAP
        self.fx.maps["eye"] = "o=contour"
        self.fx.maps["helm"] = "o=contour h=helmet_steel_base"  # かぶり物
        self.fx.maps["glasses"] = "p=patch_base"  # 装飾品
        del self.fx.checks["eyes"]
        self.fx.checks["parts"]["eye"] = {"eye": True}
        for name, layers in self.fx.frames.items():
            if name.startswith("down_"):
                face(layers["core"], [])
                layers["eye"] = {**LEFT_DIAGONAL, **RIGHT_DIAGONAL}

    def add_part(self, key: str, pixels: dict, role: dict, frames=None) -> None:
        """目の部品より手前に部品を重ねる（書いた順に front で重なる）。"""
        self.fx.checks["parts"][key] = role
        for name, layers in self.fx.frames.items():
            if frames is None or name in frames:
                layers[key] = dict(pixels)

    def test_eyes_read_from_eye_part_diagonal(self):
        code, out = self.fx.run(main)
        self.assertEqual(code, 0, out)
        self.assertIn("目: ok", out)

    def test_eye_part_neighbours_are_still_checked(self):
        self.fx.frames["down_base"]["core"][(13, 10)] = "o"
        code, out = self.fx.run(main)
        self.assertEqual(code, 1)
        self.assertIn("FAIL down_base: 目の左右の隣が目と見分けられない色 1 件: (13,10)", out)

    def test_eye_next_to_face_edge_still_fails(self):
        # E5 の直す前の形: 目が顔の縁（芯の輪郭 x=12）の隣にある
        self.fx.frames["down_base"]["eye"] = {(13, 10): "o", (13, 11): "o", **RIGHT_DIAGONAL}
        code, out = self.fx.run(main)
        self.assertEqual(code, 1)
        self.assertIn("FAIL down_base: 目の左右の隣が目と見分けられない色 2 件: (12,10) (12,11)", out)

    def test_fully_hidden_eyes_pass(self):
        # knight のバイザー: 目の画素をすべて覆うかぶり物は、その向きを目なしとして通す。
        # 部品は dx・dy でずらした後の位置で見る（ずらす前の y=8・9 は目に掛からない）
        visor = {(x, y): "o" if y == 8 else "h" for x in range(13, 19) for y in (8, 9)}
        self.add_part("helm", visor, {"head": True})
        self.fx.shift["helm"] = (0, 2)
        self.fx.frames["down_base"]["core"][(13, 10)] = "o"  # 隠れた目の隣は見ない
        code, out = self.fx.run(main)
        self.assertEqual(code, 0, out)

    def test_glasses_that_are_not_a_head_part_cover_by_the_ornament_kind(self):
        # 設計「被り物・装飾品ですべて覆われているとき」。head でない部品も、装飾品の色の画素なら覆う
        glasses = {p: "p" for p in (*LEFT_DIAGONAL, *RIGHT_DIAGONAL)}
        self.add_part("glasses", glasses, {})
        self.fx.frames["down_base"]["core"][(13, 10)] = "o"  # 覆われなければ隣で落ちる形
        code, out = self.fx.run(main)
        self.assertEqual(code, 0, out)

    def test_a_colour_name_missing_from_the_palette_is_a_clear_error(self):
        self.fx.maps["glasses"] = "p=no_such_colour"
        glasses = {p: "p" for p in (*LEFT_DIAGONAL, *RIGHT_DIAGONAL)}
        self.add_part("glasses", glasses, {})
        code, out = self.fx.run(main)
        self.assertEqual(code, 2, out)
        self.assertIn("パレットに無い色名 no_such_colour", out)
        self.assertIn("glasses_down_base", out)

    def test_partly_hidden_eyes_fail(self):
        self.add_part("helm", {(14, 10): "h", (17, 10): "h"}, {"head": True}, frames={"down_base"})
        code, out = self.fx.run(main)
        self.assertEqual(code, 1)
        self.assertIn("FAIL down_base: 目の一部が被り物に隠れている 2 件: (14,10) (17,10)", out)

    def test_a_cover_behind_the_eye_part_does_not_hide_it(self):
        self.add_part("helm", {(14, 10): "h"}, {"head": True}, frames={"down_base"})
        self.fx.back = {"helm"}
        code, out = self.fx.run(main)
        self.assertEqual(code, 0, out)

    def test_a_weapon_in_front_of_the_eyes_is_not_a_cover(self):
        # 武器・拳は目の確認で重ねない（部品を単品として見る）。覆いにも数えない
        layers = self.fx.frames["down_base"]
        layers["sword"] = {**layers.pop("sword"), (14, 10): "k"}  # 目の部品より後に書く = 手前
        code, out = self.fx.run(main)
        self.assertEqual(code, 0, out)

    def add_up_eyes(self, top: int) -> None:
        for name, layers in self.fx.frames.items():
            if name.startswith("up_"):
                face(layers["core"], [], top=top)
                layers["eye"] = {(14, top): "o", (17, top): "o"}

    def test_top_rows_compare_directions(self):
        self.add_up_eyes(11)
        code, out = self.fx.run(main)
        self.assertEqual(code, 1)
        self.assertIn("FAIL eyes: 目の上端の行が向きでそろわない: down=10 up=11", out)
        self.assertEqual(out.count("目の上端の行"), 1)

    def test_top_row_ignores_hidden_direction(self):
        self.add_up_eyes(11)
        visor = {(x, 11): "h" for x in range(13, 19)}
        self.add_part("helm", visor, {"head": True}, frames={n for n in self.fx.frames if n.startswith("up_")})
        code, out = self.fx.run(main)
        self.assertEqual(code, 0, out)


if __name__ == "__main__":
    unittest.main()
