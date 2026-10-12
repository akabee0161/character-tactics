"""Checks for cand/gen/mklayers.py (敵を層で組む。試作)."""
from __future__ import annotations

import os
import sys
import unittest
from pathlib import Path
from unittest import mock

REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT / "tools"))
sys.path.insert(0, str(REPO_ROOT / "cand" / "gen"))
os.chdir(REPO_ROOT)  # mklayers は pixel-asset-forge からの相対パスで import する

import mklayers as ml  # noqa: E402
from layers import Layer, LayerError, blank  # noqa: E402

EID = "spear-thug-a-f"


def fake_layers(d, extra=(), dot=None):
    """部品のファイルを読まない、その向きの表どおりの空の層（＋ extra の名前の層）。
    dot に層の名前を並べると、その層すべての (5,5) を塗る（どれが手前に来るかを見る）。"""
    layers = {n: Layer(blank()) for n in list(ml.ORDERS[d]) + list(extra)}
    for n in dot or ():
        layers[n].frame[5][5] = "outline"
    return layers


def front_of(d, a, b):
    """向き d で a と b が同じ画素にあるとき、手前に来る層の名前。"""
    with mock.patch.object(ml, "build_layers", return_value=fake_layers(d, dot=[a, b])):
        return ml.compose_frame(EID, d, "base")[1][5][5]


class ComposeFrameTest(unittest.TestCase):
    def test_layer_missing_from_order_raises(self):
        """層を足して表に書き忘れたら、黙って合成から消さずに止める。"""
        for d in ml.DIRS:
            with mock.patch.object(ml, "build_layers", return_value=fake_layers(d, ["表に無い層"])):
                for weapon in (True, False):
                    with self.assertRaises(LayerError):
                        ml.compose_frame(EID, d, "base", weapon=weapon)

    def test_weaponless_drops_only_weapon_and_its_hand(self):
        for d in ml.DIRS:
            with mock.patch.object(ml, "build_layers", return_value=fake_layers(d)):
                ml.compose_frame(EID, d, "base", weapon=False)

    def test_back_hair_is_nearest_from_behind_and_farthest_otherwise(self):
        """後ろ姿（up）は背中の髪が一番手前、正面・横は芯の後ろ（2026-10-09 依頼者と決めた表）。"""
        self.assertEqual(front_of("up", "芯", "長い髪（背中）"), "長い髪（背中）")
        for d in ("down", "left", "right"):
            self.assertEqual(front_of(d, "芯", "長い髪（背中）"), "芯")

    def test_weapon_is_behind_hair_only_in_up_and_left(self):
        self.assertEqual(front_of("up", "武器", "長い髪（頭）"), "長い髪（頭）")
        self.assertEqual(front_of("left", "武器", "長い髪（頭）"), "長い髪（頭）")
        for d in ("down", "right"):
            self.assertEqual(front_of(d, "武器", "長い髪（頭）"), "武器")

    def test_weapon_is_behind_headgear_only_in_up_and_left(self):
        """axe-horn の表（2026-10-09 依頼者承認）: down・right は武器が兜の手前、up・left は後ろ。"""
        for d, front in (("down", "武器"), ("right", "武器"), ("up", "かぶり物"), ("left", "かぶり物")):
            self.assertEqual(front_of(d, "武器", "かぶり物"), front)


class GripOutlineTest(unittest.TestCase):
    def test_fist_outline_does_not_cut_the_held_weapon(self):
        """拳のまわりの「空いている所にだけ描く」輪郭は、握る武器の上には描かない（柄を途切れさせない）。
        体など、ほかの層の上には描く（2026-10-09 依頼者が案1を選んだ）。"""
        layers = fake_layers("right")
        layers["武器"].frame[5][5] = "wood_base"
        layers["武器を持つ腕・拳"].frame[5][5] = "outline"   # 柄の上の拳の輪郭（空いている所にだけ描く印）
        layers["芯"].frame[6][6] = "cloak_dark_base"
        layers["武器を持つ腕・拳"].frame[6][6] = "outline"   # 体の上の拳の輪郭
        with mock.patch.object(ml, "build_layers", return_value=layers), \
                mock.patch.object(ml, "grip_outline", return_value={(5, 5), (6, 6)}):
            frame, labels = ml.compose_frame(EID, "right", "base")
        self.assertEqual((frame[5][5], labels[5][5]), ("wood_base", "武器"))
        self.assertEqual((frame[6][6], labels[6][6]), ("outline", "武器を持つ腕・拳"))


class FarShadeTest(unittest.TestCase):
    def test_far_hand_skin_becomes_shadow_and_the_rest_stays(self):
        """奥の手は影の色で描く（振りかぶりで頭の横に出た拳も。2026-10-09 依頼者の指摘）。輪郭と袖は変えない。"""
        layer = Layer(blank())
        layer.frame[1][1], layer.frame[1][2], layer.frame[1][3] = "skin_rose_hi", "skin_rose_base", "skin_rose_shadow"
        layer.frame[2][1], layer.frame[2][2] = "outline", "cloak_dark_base"
        out = ml.far_shade(layer)
        self.assertEqual(out.frame[1][1:4], ["skin_rose_shadow"] * 3)
        self.assertEqual(out.frame[2][1:3], ["outline", "cloak_dark_base"])


class HandShiftTest(unittest.TestCase):
    def test_female_hand_follows_the_female_body(self):
        self.assertEqual(ml.hand_shift(EID, "left", "base"), (-1, 0))
        self.assertEqual(ml.hand_shift(EID, "down", "atk_hit"), (2, 0))  # 槍の down の当たりの例外

    def test_male_hand_is_where_the_patch_is(self):
        """男性の素体は武器のパッチと同じ座標なので、手をずらさない（待機2は2px上げる）。"""
        self.assertEqual(ml.hand_shift("axe-horn", "left", "base"), (0, 0))
        self.assertEqual(ml.hand_shift("axe-horn", "right", "idle2"), (0, -2))


class UnitsTest(unittest.TestCase):
    def test_trial_units_have_weapon_parts_for_every_frame(self):
        for eid in ml.UNITS:
            weapon = ml.unit(eid)["weapon"]
            for d in ml.DIRS:
                for key in ("base", "atk_wind", "atk_hit"):
                    self.assertIn((d, key), ml.WEAPON_PARTS[weapon], f"{eid} {d} {key}")

    def test_unit_reads_the_enemy_definition(self):
        u = ml.unit("axe-horn")
        self.assertEqual((u["sex"], u["head"], u["hair"], u["weapon"]), ("male", "horn", None, "axe"))
        u = ml.unit(EID)
        self.assertEqual((u["sex"], u["head"], u["hair"], u["weapon"]), ("female", None, "A", "spear"))


if __name__ == "__main__":
    unittest.main()
