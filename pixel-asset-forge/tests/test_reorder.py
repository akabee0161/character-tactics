"""Checks for tools/reorder.py（compose の設定の、ある向きの重なり順だけを変えた写し）."""
import json
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "tools"))

from reorder import ReorderError, main, reorder  # noqa: E402


def layer(name, d, z):
    return {"part": f"assets/part/x/{name}_{d}_base.txt", "z": z}


CONFIG = {"unit": "t", "frames": {
    "left_base": {"body": "core.txt", "layers": [layer("bow", "left", "back"), layer("arrow", "left", "front"),
                                                 layer("bow_hand", "left", "front") | {"hand": True}]},
    "down_base": {"body": "core.txt", "layers": [layer("bow", "down", "front")]},
}}


class ReorderTest(unittest.TestCase):
    def test_back_is_listed_nearest_the_core_first_and_front_far_to_near(self):
        out = reorder(CONFIG, "left", ["arrow", "bow", "CORE", "bow_hand"])
        layers = out["frames"]["left_base"]["layers"]
        self.assertEqual([(Path(entry["part"]).stem, entry["z"]) for entry in layers],
                         [("bow_left_base", "back"), ("arrow_left_base", "back"), ("bow_hand_left_base", "front")])
        self.assertTrue(layers[2]["hand"])  # 部品のほかのキーは残す

    def test_other_directions_and_the_input_are_unchanged(self):
        before = json.dumps(CONFIG)
        out = reorder(CONFIG, "left", ["CORE", "bow", "arrow", "bow_hand"])
        self.assertEqual(out["frames"]["down_base"], CONFIG["frames"]["down_base"])
        self.assertEqual(json.dumps(CONFIG), before)

    def test_order_must_name_every_part_once_and_the_core_once(self):
        for order, word in ((["bow", "arrow", "bow_hand"], "CORE"),
                            (["bow", "CORE", "arrow"], "bow_hand"),
                            (["bow", "CORE", "arrow", "bow_hand", "shield"], "shield"),
                            (["bow", "CORE", "arrow", "bow_hand", "bow"], "bow")):
            with self.assertRaisesRegex(ReorderError, word):
                reorder(CONFIG, "left", order)

    def test_parts_without_a_state_in_the_name_are_named_by_their_first_half(self):
        # ガウの頭巾・髪・短剣は向きごとに1枚（hood_left.txt）で、状態の名前が付かない
        gau = {"unit": "gau", "frames": {"left_base": {"body": "core.txt", "layers": [
            {"part": "assets/part/head/hood/hood_left.txt", "z": "front"},
            {"part": "assets/part/equip/dagger/dagger_left.txt", "z": "back"}]}}}
        out = reorder(gau, "left", ["CORE", "dagger", "hood"])
        self.assertEqual([(Path(entry["part"]).stem, entry["z"]) for entry in out["frames"]["left_base"]["layers"]],
                         [("dagger_left", "front"), ("hood_left", "front")])

    def test_part_missing_from_some_frames_is_skipped_there(self):
        # ガウの left_atk_wind は短剣の層を持たない（体に隠れる）。ほかのコマにある部品は、無いコマでは飛ばす
        gau = {"unit": "gau", "frames": {
            "left_base": {"body": "core.txt", "layers": [{"part": "p/hood_left.txt", "z": "front"},
                                                          {"part": "p/dagger_left.txt", "z": "back"}]},
            "left_atk_wind": {"body": "core.txt", "layers": [{"part": "p/hood_left.txt", "z": "front"}]}}}
        out = reorder(gau, "left", ["dagger", "CORE", "hood"])
        self.assertEqual([Path(e["part"]).stem for e in out["frames"]["left_atk_wind"]["layers"]], ["hood_left"])
        self.assertEqual([(Path(e["part"]).stem, e["z"]) for e in out["frames"]["left_base"]["layers"]],
                         [("dagger_left", "back"), ("hood_left", "front")])
        with self.assertRaisesRegex(ReorderError, "shield"):  # どのコマにも無い名前は書き間違いとして止める
            reorder(gau, "left", ["dagger", "CORE", "hood", "shield"])

    def test_two_layers_with_the_same_name_in_a_frame_stop(self):
        # bow_left_base と bow_left_wind はどちらも bow。片方を黙って落とさない
        twice = {"unit": "t", "frames": {"left_base": {"body": "core.txt", "layers": [
            {"part": "p/bow_left_base.txt", "z": "front"}, {"part": "p/bow_left_wind.txt", "z": "front"}]}}}
        with self.assertRaisesRegex(ReorderError, "left_base.*bow"):
            reorder(twice, "left", ["CORE", "bow"])

    def test_direction_without_frames_stops(self):
        with self.assertRaisesRegex(ReorderError, "up"):
            reorder(CONFIG, "up", ["CORE"])

    def test_main_writes_the_copy_and_reports_errors(self):
        with tempfile.TemporaryDirectory() as tmp:
            src, out = Path(tmp) / "c.json", Path(tmp) / "o.json"
            src.write_text(json.dumps(CONFIG), encoding="utf-8")
            self.assertEqual(main([str(src), str(out), "left", "arrow,bow,CORE,bow_hand"]), 0)
            self.assertEqual(json.loads(out.read_text(encoding="utf-8"))["frames"]["left_base"]["layers"][0]["z"], "back")
            self.assertEqual(main([str(src), str(out), "left", "bow,CORE"]), 2)
            self.assertEqual(main([str(Path(tmp) / "none.json"), str(out), "left", "CORE"]), 2)


if __name__ == "__main__":
    unittest.main()
