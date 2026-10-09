"""Checks for tools/weapon_check.py (自己チェック①: 武器と、それを握る手)."""
from __future__ import annotations

import contextlib
import io
import sys
import tempfile
import unittest
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT / "tools"))

from enemy_build import serialize_frame  # noqa: E402
from weapon_check import Analysis, check_frame, check_unit, covered, main  # noqa: E402

BLADE = {"stone_hi", "stone_base"}
HANDLE = {"wood_base"}
SKIN = {"skin_base"}


def blank():
    return [[None] * 32 for _ in range(32)]


def put(f, x, y, name):
    if 0 <= x < 32 and 0 <= y < 32:
        f[y][x] = name


def spear_v(f, x, top, length, tip_down=False):
    """1px 幅の縦の槍（左右に輪郭）。穂先は3px。"""
    for i in range(length):
        y = top + i
        tip = i >= length - 3 if tip_down else i < 3
        put(f, x, y, "stone_hi" if tip else "wood_base")
        put(f, x - 1, y, "outline")
        put(f, x + 1, y, "outline")


def spear_h(f, y, left, length, tip_left=True):
    for i in range(length):
        x = left + i
        tip = i < 3 if tip_left else i >= length - 3
        put(f, x, y, "stone_hi" if tip else "wood_base")
        put(f, x, y - 1, "outline")
        put(f, x, y + 1, "outline")


def fist(f, x0, y0, w=2, h=2, ring=True):
    """肌の w x h の拳。ring なら周りを輪郭で囲む（柄の上に描く）。"""
    if ring:
        for y in range(y0 - 1, y0 + h + 1):
            for x in range(x0 - 1, x0 + w + 1):
                put(f, x, y, "outline")
    for y in range(y0, y0 + h):
        for x in range(x0, x0 + w):
            put(f, x, y, "skin_base")


def body(f, x0=14, y0=8, x1=22, y1=30):
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            put(f, x, y, "outline" if x in (x0, x1) or y in (y0, y1) else "cloak_dark_base")


def analyse(f):
    return Analysis(f, BLADE, HANDLE, SKIN)


def standing(grip_y=18, top=6):
    """体の左で縦の槍を握る。穂先が上。"""
    f = blank()
    body(f)
    spear_v(f, 9, top, 25)
    fist(f, 9, grip_y)
    return f


class HandTest(unittest.TestCase):
    def test_gripped_spear_passes(self):
        self.assertEqual(check_frame("down_base", analyse(standing()), set(), set()), [])

    def test_missing_hand_fails(self):
        f = blank()
        body(f)
        spear_v(f, 9, 6, 25)
        self.assertIn("手が無い", " ".join(check_frame("down_base", analyse(f), set(), set())))

    def test_missing_hand_is_allowed_when_listed_as_hidden(self):
        f = blank()
        body(f)
        spear_v(f, 9, 6, 25)
        self.assertEqual(check_frame("down_base", analyse(f), {"down_base"}, set()), [])

    def test_gap_in_hand_outline_fails(self):
        f = standing()
        put(f, 11, 18, None)  # 拳の右の輪郭が抜けて背景に接する
        fails = check_frame("down_base", analyse(f), set(), set())
        self.assertIn("手の輪郭が途切れている: (10,18)", " ".join(fails))

    def test_hand_may_touch_the_shaft(self):
        f = blank()
        body(f)
        spear_v(f, 9, 6, 25)
        fist(f, 9, 18, ring=False)
        for x, y in ((8, 17), (10, 17), (8, 18), (11, 18), (8, 19), (11, 19), (8, 20), (10, 20)):
            put(f, x, y, "outline")
        self.assertEqual(check_frame("down_base", analyse(f), set(), set()), [])

    def test_one_pixel_hand_fails(self):
        f = blank()
        body(f)
        spear_v(f, 9, 6, 25)
        fist(f, 9, 18, w=1)
        self.assertIn("手が細い（1x2px", " ".join(check_frame("down_base", analyse(f), set(), set())))

    def test_fist_on_the_shaft_beats_a_face_as_near_beside_it(self):
        # 肩幅の狭い体では、柄から顔までと、柄から拳までが同じ 2px になる（女性の敵の down）
        f = blank()
        spear_v(f, 10, 2, 17)  # y2〜18、穂先が上
        fist(f, 9, 18, w=3)  # 輪郭が y17 で柄を切る
        for x in range(12, 20):
            for y in (11, 12):
                put(f, x, y, "skin_base")
        a = analyse(f)
        self.assertIn((10, 18), a.hand)
        self.assertNotIn((12, 11), a.hand)

    def test_two_pixel_fist_on_the_shaft_is_centred_enough(self):
        fails = check_frame("down_base", analyse(standing()), set(), set())  # 肌 x9〜10、柄 x9
        self.assertFalse(any("真ん中" in s for s in fails), fails)

    def test_fist_off_the_middle_of_the_shaft_fails(self):
        f = blank()
        body(f)
        spear_v(f, 9, 6, 25)
        fist(f, 10, 18, w=3)  # 肌 x10〜12、真ん中 x11、柄 x9（斧の down の当たり）
        fails = check_frame("down_atk_hit", analyse(f), set(), set())
        self.assertTrue(any("拳が柄の真ん中に無い" in s for s in fails), fails)

    def test_fist_apart_from_the_weapon_fails(self):
        f = blank()
        body(f)
        spear_v(f, 9, 6, 25)
        fist(f, 11, 18)  # 肌 x11〜12、柄 x9 から離れている（女性の up の立ち）
        fails = check_frame("up_base", analyse(f), set(), set())
        self.assertTrue(any("拳が柄の真ん中に無い" in s for s in fails), fails)

    def test_face_beside_the_tip_is_not_the_hand(self):
        f = standing()
        fist(f, 12, 7)  # 穂先の横の顔（刃から 2px 以内、柄からは遠い）
        a = analyse(f)
        self.assertEqual(a.hand, {(9, 18), (10, 18), (9, 19), (10, 19)})


class FloatingHandTest(unittest.TestCase):
    ARM = {"cloak_dark_base"}

    def raised(self, sleeve):
        """体の右上で縦の斧を握る。sleeve なら拳の下から体まで袖がある。"""
        f = blank()
        body(f, 10, 14, 19, 30)
        spear_v(f, 23, 2, 14)
        fist(f, 23, 10)
        if sleeve:
            for y in (13, 14):
                for x in range(20, 25):
                    put(f, x, y, "cloak_dark_base")
        return f

    def test_hand_without_arm_fails(self):
        fails = check_frame("left_atk_wind", analyse(self.raised(False)), set(), set(), self.ARM)
        self.assertIn("手が体から浮いている", " ".join(fails))

    def test_hand_with_sleeve_passes(self):
        self.assertEqual(check_frame("left_atk_wind", analyse(self.raised(True)), set(), set(), self.ARM), [])

    def test_arm_connected_diagonally_passes(self):
        f = self.raised(False)
        put(f, 22, 12, "outline")
        put(f, 21, 13, "cloak_dark_base")  # 拳の左下に、斜めに袖が接する
        self.assertEqual(check_frame("left_atk_wind", analyse(f), set(), set(), self.ARM), [])

    def test_fist_touching_the_body_sideways_without_outline_fails(self):
        f = standing()  # 体 x14〜22、縦の槍 x9、拳の肌 x9〜10・y18〜19
        for x in (11, 12):  # 拳の右の輪郭が無く、体の服に直に接する（男性の down の斧）
            put(f, x, 18, "cloak_dark_base")
            put(f, x, 19, "cloak_dark_base")
        fails = check_frame("down_base", analyse(f), set(), set(), self.ARM)
        self.assertTrue(any("手の輪郭が閉じていない" in s for s in fails), fails)

    def test_sleeve_right_above_the_fist_passes(self):
        f = standing()  # 体 x14〜22、縦の槍 x9、拳の肌 x9〜10・y18〜19
        put(f, 9, 17, "cloak_dark_base")  # 袖口から手が出る（上下で接するのはよい）
        fails = check_frame("down_base", analyse(f), set(), set(), self.ARM)
        self.assertFalse(any("手の輪郭が閉じていない" in s for s in fails), fails)

    def test_check_is_skipped_without_arm_colours(self):
        self.assertEqual(check_frame("left_atk_wind", analyse(self.raised(False)), set(), set()), [])


class TipDirectionTest(unittest.TestCase):
    def test_tip_toward_facing_passes(self):
        self.assertEqual(check_frame("up_atk_hit", analyse(standing()), set(), {"atk_hit"}), [])

    def test_tip_away_from_facing_fails(self):
        f = blank()
        body(f)
        spear_v(f, 9, 6, 25, tip_down=True)
        fist(f, 9, 18)
        fails = check_frame("up_atk_hit", analyse(f), set(), {"atk_hit"})
        self.assertIn("穂先が向いている側に無い", " ".join(fails))

    def test_only_hit_frames_are_checked(self):
        f = blank()
        body(f)
        spear_v(f, 9, 6, 25, tip_down=True)
        fist(f, 9, 18)
        self.assertEqual(check_frame("up_atk_wind", analyse(f), set(), {"atk_hit"}), [])


class EdgeTest(unittest.TestCase):
    def test_weapon_on_frame_edge_fails(self):
        f = standing(grip_y=12, top=0)
        self.assertIn("コマの端で切れている", " ".join(check_frame("down_base", analyse(f), set(), set())))


class WeaponDetectionTest(unittest.TestCase):
    def test_helmet_in_blade_colour_is_not_the_weapon(self):
        f = standing()
        for x in range(15, 21):
            put(f, x, 3, "stone_base")  # 刃と同じ色の兜（柄とつながらない）
        a = analyse(f)
        self.assertNotIn((15, 3), a.weapon)

    def test_belt_in_handle_colour_is_not_the_weapon(self):
        f = standing()
        for x in range(15, 22):
            put(f, x, 22, "wood_base")
        self.assertNotIn((15, 22), analyse(f).weapon)

    def test_shaft_behind_the_body_is_part_of_the_weapon(self):
        f = blank()
        spear_h(f, 17, 1, 25)
        body(f, 8, 8, 18, 30)  # 体が柄の真ん中を隠す
        a = analyse(f)
        self.assertIn((20, 17), a.weapon)
        self.assertIn((2, 17), a.weapon)

    def test_diagonal_handle_is_part_of_the_weapon(self):
        f = blank()
        for x, y in ((6, 6), (7, 6), (6, 7), (7, 7)):
            put(f, x, y, "stone_hi")
        for i in range(5):  # 階段状の斜めの柄（画素どうしは斜めにだけ接する）
            put(f, 8 + i, 8 + i, "wood_base")
        fist(f, 13, 13, ring=False)
        a = analyse(f)
        self.assertIn((12, 12), a.weapon)
        self.assertTrue(a.hand)

    def test_head_and_handle_on_both_sides_of_the_fist_are_one_weapon(self):
        f = blank()
        for x in range(5, 8):  # 刃を手前に向けた axe head（拳の左）
            for y in range(14, 18):
                put(f, x, y, "stone_hi")
        fist(f, 8, 15, ring=False)
        for x in range(10, 19):  # 柄（拳の右）。刃とは接しない
            put(f, x, 16, "wood_base")
        a = analyse(f)
        self.assertIn((5, 14), a.weapon)
        self.assertIn((18, 16), a.weapon)

    def test_one_pixel_pommel_beyond_the_fist_is_tiny(self):
        f = blank()
        spear_v(f, 9, 6, 15)
        fist(f, 9, 18)  # 輪郭が y17〜20 の柄を覆う
        put(f, 9, 21, "wood_base")  # 拳の先にのぞく柄頭
        put(f, 9, 26, "wood_base")  # 拳から離れた同じ色の1画素（柄頭ではない）
        a = analyse(f)
        self.assertIn((9, 21), a.tiny)
        self.assertIn((9, 21), a.weapon)
        self.assertNotIn((9, 26), a.weapon)


def frames_of(**named):
    return {name: analyse(f) for name, f in named.items()}


class UnitTest(unittest.TestCase):
    def test_same_grip_passes(self):
        frames = frames_of(down_atk_wind=standing(grip_y=17, top=5), down_base=standing())
        fails, _ = check_unit(frames, set(), set(), ["atk_wind", "atk_hit", "base"])
        self.assertEqual(fails, [])

    def test_grip_sliding_along_the_weapon_fails(self):
        f = blank()
        body(f)
        spear_v(f, 9, 6, 25)
        fist(f, 9, 24)  # 槍は同じ位置のまま、手だけ下へずれる
        frames = frames_of(down_atk_wind=f, down_base=standing())
        fails, _ = check_unit(frames, set(), set(), ["atk_wind", "atk_hit", "base"])
        self.assertIn("握る位置がずれる", " ".join(fails))

    def test_length_change_fails(self):
        f = blank()
        body(f)
        spear_v(f, 9, 10, 17)
        fist(f, 9, 18)
        frames = frames_of(left_base=standing(), left_atk_wind=f)
        fails, _ = check_unit(frames, set(), set(), ["atk_wind", "atk_hit", "base"])
        self.assertIn("武器の長さがそろわない", " ".join(fails))

    def test_depth_direction_skips_grip_and_length(self):
        short = blank()
        body(short)
        spear_v(short, 9, 14, 10)
        fist(short, 9, 18)
        frames = frames_of(down_atk_wind=short, down_base=standing())
        seq = ["atk_wind", "atk_hit", "base"]
        self.assertTrue(check_unit(frames, set(), set(), seq)[0])
        self.assertEqual(check_unit(frames, set(), set(), seq, {"down"})[0], [])


class PartialTest(unittest.TestCase):
    def test_partly_hidden_frame_is_left_out_of_grip_and_length(self):
        short = blank()
        body(short)
        spear_v(short, 9, 14, 10)  # 体に隠れて短く見える
        fist(short, 9, 18)
        frames = frames_of(left_atk_wind=short, left_base=standing())
        seq = ["atk_wind", "atk_hit", "base"]
        self.assertTrue(check_unit(frames, set(), set(), seq)[0])
        self.assertEqual(check_unit(frames, set(), set(), seq, partial={"left_atk_wind"})[0], [])


class CoveredTest(unittest.TestCase):
    """奥の手・腕・武器が、武器を持たせる前のコマ（体・髪・頭）の手前に出ていないか。"""

    def ref(self):
        f = blank()
        body(f, 12, 8, 19, 30)
        for y in range(10, 18):  # 背中に垂れた髪
            for x in range(18, 22):
                put(f, x, y, "hair_slate_base")
        return f

    HAIR = {"hair_slate_base"}
    HAND = {"skin_base"}
    ARM = {"cloak_dark_base", "cloak_dark_hi"}

    def check(self, name, final, standing=True):
        return covered(name, final, self.ref(), self.HAIR, self.HAND, self.ARM, standing)

    def test_fist_drawn_over_the_hair_fails_in_every_state(self):
        final = self.ref()
        fist(final, 19, 15)
        for standing in (True, False):
            fails = self.check("left_base", final, standing)
            self.assertEqual(len(fails), 1)
            self.assertIn("left_base", fails[0])

    def test_fist_only_where_nothing_was_drawn_passes(self):
        final = self.ref()
        fist(final, 23, 20)
        self.assertEqual(self.check("left_base", final), [])

    def test_fist_over_the_body_fails_only_when_standing(self):
        final = self.ref()
        fist(final, 14, 22)  # 体の真ん中（髪は無い）
        self.assertEqual(len(self.check("left_base", final)), 1)
        self.assertEqual(self.check("left_atk_wind", final, standing=False), [])  # 攻撃は承認済みの例外が多い

    def test_redrawing_the_hand_and_joining_the_sleeve_pass(self):
        ref = self.ref()
        ref[20][20], ref[20][19], ref[20][21] = "skin_base", "outline", "outline"  # 素体の 1px の手
        final = [row[:] for row in ref]
        final[20][21], final[20][22] = "skin_base", "outline"  # 輪郭だった画素を肌に変えて 2px の拳に描き直す
        final[22][15] = "cloak_dark_hi"  # 体の服（cloak_dark_base）の上に同じ服の色の袖
        self.assertEqual(covered("left_base", final, ref, self.HAIR, self.HAND, self.ARM, True), [])


class MainTest(unittest.TestCase):
    def run_main(self, argv):
        out, err = io.StringIO(), io.StringIO()
        with contextlib.redirect_stdout(out), contextlib.redirect_stderr(err):
            code = main(argv)
        return code, out.getvalue(), err.getvalue()

    ARGS = ["--blade", "stone_hi", "--weapon", "wood_base", "--hand", "skin_base"]

    def write(self, d: Path, name: str, f) -> None:
        (d / f"{name}.txt").write_text(serialize_frame(f, "test"), encoding="utf-8")

    def test_good_unit_exits_zero(self):
        with tempfile.TemporaryDirectory() as tmp:
            self.write(Path(tmp), "down_base", standing())
            code, out, _ = self.run_main([tmp, *self.ARGS])
            self.assertEqual(code, 0)
            self.assertIn("ok", out)

    def test_bad_unit_exits_one(self):
        with tempfile.TemporaryDirectory() as tmp:
            f = blank()
            body(f)
            spear_v(f, 9, 6, 25)
            self.write(Path(tmp), "down_base", f)
            code, _, err = self.run_main([tmp, *self.ARGS])
            self.assertEqual(code, 1)
            self.assertIn("FAIL", err)

    def test_far_hand_over_the_reference_exits_one(self):
        with tempfile.TemporaryDirectory() as tmp, tempfile.TemporaryDirectory() as ref:
            plain = blank()
            body(plain)
            self.write(Path(ref), "left_base", plain)
            self.write(Path(ref), "down_base", plain)
            armed = standing()  # 槍と拳が体（x14〜22）に重ならない
            over = [row[:] for row in armed]
            fist(over, 15, 18)  # 拳が体の手前
            self.write(Path(tmp), "left_base", over)
            self.write(Path(tmp), "down_base", over)
            code, _, err = self.run_main([tmp, *self.ARGS, "--ref", ref, "--far", "left"])
            self.assertEqual(code, 1)
            self.assertIn("left_base: 奥の手", err)
            self.assertNotIn("down_base: 奥の手", err)  # down は奥の向きに挙げていない

    def test_far_hand_as_bright_as_the_near_hand_fails(self):
        with tempfile.TemporaryDirectory() as tmp, tempfile.TemporaryDirectory() as ref:
            plain = blank()
            body(plain)
            self.write(Path(ref), "left_base", plain)
            self.write(Path(ref), "left_atk_wind", plain)
            self.write(Path(tmp), "left_base", standing())  # 拳の肌は skin_base（明るい）
            self.write(Path(tmp), "left_atk_wind", standing())  # 攻撃のコマは見ない
            code, _, err = self.run_main([tmp, *self.ARGS, "--ref", ref, "--far", "left", "--far-shade", "skin_shadow"])
            self.assertEqual(code, 1)
            self.assertIn("left_base: 奥の手が影の色でない", err)
            self.assertNotIn("left_atk_wind: 奥の手が影の色でない", err)

    def test_far_without_ref_and_missing_ref_frame_exit_two(self):
        with tempfile.TemporaryDirectory() as tmp, tempfile.TemporaryDirectory() as ref:
            self.write(Path(tmp), "left_base", standing())
            code, _, err = self.run_main([tmp, *self.ARGS, "--far", "left"])
            self.assertEqual(code, 2)
            self.assertIn("--ref", err)
            code, _, err = self.run_main([tmp, *self.ARGS, "--ref", ref, "--far", "left"])
            self.assertEqual(code, 2)
            self.assertIn("left_base", err)

    def test_missing_directory_exits_two(self):
        code, _, err = self.run_main(["/nonexistent/unit", *self.ARGS])
        self.assertEqual(code, 2)
        self.assertIn("error", err)

    def test_letter_without_colour_exits_two_with_its_name(self):
        with tempfile.TemporaryDirectory() as tmp:
            text = serialize_frame(standing(), "test").splitlines()
            text[-2] = "x" + text[-2][1:]  # map に無い文字
            (Path(tmp) / "down_base.txt").write_text("\n".join(text) + "\n", encoding="utf-8")
            code, _, err = self.run_main([tmp, *self.ARGS])
            self.assertEqual(code, 2)
            self.assertIn("'x'", err)


if __name__ == "__main__":
    unittest.main()
