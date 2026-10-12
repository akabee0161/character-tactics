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

    def test_unknown_direction_stops(self):
        with self.assertRaisesRegex(AnimError, "north"):
            build_page(self.dir / "now.png", self.dir / "cand.png", load_states(self.game(GAME)),
                       ["north"], "題", "", ["今", "案"])

    def test_main_writes_the_page_and_reports_errors(self):
        out = self.dir / "page.html"
        args = [str(self.dir / "now.png"), str(self.dir / "cand.png"), str(out)]
        self.assertEqual(main(args + ["--anim", str(self.game(GAME))]), 0)
        self.assertTrue(out.read_text(encoding="utf-8").startswith("<title>"))
        self.assertEqual(main(args + ["--anim", str(self.dir / "none.json")]), 2)
        self.assertEqual(main([str(self.dir / "none.png"), args[1], args[2], "--anim", str(self.game(GAME))]), 2)


if __name__ == "__main__":
    unittest.main()
