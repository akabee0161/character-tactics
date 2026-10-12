"""Checks for tools/anim_compare.py（今のシートと案のシートを並べて再生するページ）."""
import json
import sys
import tempfile
import unittest
from pathlib import Path

from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "tools"))

from anim_compare import AnimError, build_page, load_states, main  # noqa: E402

GAME = {"id": "t", "sprites": {"map": {"sheet": "t.png", "frame": 32,
                                       "idle": {"frames": 2, "fps": 4}, "walk": {"frames": 4, "fps": 8},
                                       "attack": {"frames": 3, "fps": 6}}}}


class AnimCompareTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.dir = Path(self.tmp.name)
        for name in ("now.png", "cand.png"):
            Image.new("RGBA", (32 * 6, 32 * 12)).save(self.dir / name)

    def tearDown(self):
        self.tmp.cleanup()

    def game(self, data):
        path = self.dir / "game.json"
        path.write_text(json.dumps(data) if not isinstance(data, str) else data, encoding="utf-8")
        return path

    def test_states_come_from_the_game_unit(self):
        self.assertEqual(load_states(self.game(GAME)),
                         [("idle", "待機", 2, 4), ("walk", "歩き", 4, 8), ("attack", "攻撃", 3, 6)])

    def test_broken_game_unit_stops_with_a_message(self):
        no_attack = json.loads(json.dumps(GAME))
        del no_attack["sprites"]["map"]["attack"]
        zero = json.loads(json.dumps(GAME))
        zero["sprites"]["map"]["walk"]["frames"] = 0
        for data, word in ((no_attack, "attack"), (zero, "walk"), ({"id": "t"}, "sprites.map"), ("{not json", "JSON")):
            with self.assertRaisesRegex(AnimError, word):
                load_states(self.game(data))
        with self.assertRaisesRegex(AnimError, "読めない"):
            load_states(self.dir / "none.json")

    def test_page_has_a_cell_per_state_direction_and_sheet(self):
        page = build_page(self.dir / "now.png", self.dir / "cand.png", load_states(self.game(GAME)),
                          ["down", "left"], "題", "", ["今", "案"])
        self.assertEqual(page.count("<canvas"), 3 * 2 * 2)
        # シートの行は 状態の番号×4 + 向きの番号（down=0, up=1, left=2, right=3）
        self.assertIn('data-row="8" data-frames="3" data-fps="6"', page)   # 攻撃の down
        self.assertIn('data-row="6" data-frames="4" data-fps="8"', page)   # 歩きの left
        self.assertIn("<title>題</title>", page)

    def test_page_declares_html5_and_utf8(self):
        page = build_page(self.dir / "now.png", self.dir / "cand.png", load_states(self.game(GAME)),
                          ["down"], "題", "", ["今", "案"])
        self.assertTrue(page.lower().startswith("<!doctype html>"))
        self.assertIn('<meta charset="utf-8">', page)

    def test_labels_must_be_two(self):
        for labels in (["今"], ["今", "案", "別"]):
            with self.assertRaisesRegex(AnimError, "見出し"):
                build_page(self.dir / "now.png", self.dir / "cand.png", load_states(self.game(GAME)),
                           ["down"], "題", "", labels)

    def test_sheet_too_small_for_the_game_unit_stops(self):
        Image.new("RGBA", (32 * 3, 32 * 12)).save(self.dir / "narrow.png")  # 歩きの4コマが入らない
        Image.new("RGBA", (32 * 6, 32 * 8)).save(self.dir / "short.png")  # 攻撃の4行が無い
        for name in ("narrow.png", "short.png"):
            with self.assertRaisesRegex(AnimError, name):
                build_page(self.dir / "now.png", self.dir / name, load_states(self.game(GAME)),
                           ["down"], "題", "", ["今", "案"])

    def test_sheet_with_broken_pixel_data_stops(self):
        # 寸法（ヘッダー）は読めても画素が壊れた PNG は、ページの片側が読み込めず、両方とも再生されない
        good = (self.dir / "cand.png").read_bytes()
        (self.dir / "broken.png").write_bytes(good[:60])
        with self.assertRaisesRegex(AnimError, "broken.png.*読めない"):
            build_page(self.dir / "now.png", self.dir / "broken.png", load_states(self.game(GAME)),
                       ["down"], "題", "", ["今", "案"])

    def test_unknown_direction_stops(self):
        with self.assertRaisesRegex(AnimError, "north"):
            build_page(self.dir / "now.png", self.dir / "cand.png", load_states(self.game(GAME)),
                       ["north"], "題", "", ["今", "案"])

    def test_main_writes_the_page_and_reports_errors(self):
        out = self.dir / "page.html"
        args = [str(self.dir / "now.png"), str(self.dir / "cand.png"), str(out)]
        self.assertEqual(main(args + ["--anim", str(self.game(GAME))]), 0)
        self.assertTrue(out.read_text(encoding="utf-8").lower().startswith("<!doctype html>"))
        self.assertEqual(main(args + ["--anim", str(self.dir / "none.json")]), 2)
        self.assertEqual(main([str(self.dir / "none.png"), args[1], args[2], "--anim", str(self.game(GAME))]), 2)


if __name__ == "__main__":
    unittest.main()
