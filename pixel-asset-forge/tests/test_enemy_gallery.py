"""Checks for tools/enemy_gallery.py (敵の確認ページ)."""
from __future__ import annotations

import sys
import tempfile
import unittest
from pathlib import Path

from PIL import Image

REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT / "tools"))

from enemy_gallery import render_gallery  # noqa: E402


class GalleryTest(unittest.TestCase):
    def setUp(self):
        self._tmp = tempfile.TemporaryDirectory()
        self.png = Path(self._tmp.name) / "sheet.png"
        Image.new("RGBA", (128, 384)).save(self.png)

    def tearDown(self):
        self._tmp.cleanup()

    def test_each_entry_becomes_a_card_with_its_sheet_inline(self):
        html = render_gallery([("dagger-red-m", "赤の盗賊", self.png), ("dagger-red-f", "赤の盗賊", self.png)])
        self.assertEqual(html.count('class="card"'), 2)
        self.assertIn("dagger-red-m", html)
        self.assertIn("dagger-red-f", html)
        self.assertIn("data:image/png;base64,", html)

    def test_names_are_escaped(self):
        html = render_gallery([("x", "<b>名前</b>", self.png)])
        self.assertNotIn("<b>名前</b>", html)
        self.assertIn("&lt;b&gt;名前&lt;/b&gt;", html)

    def test_the_page_offers_every_state_and_direction(self):
        html = render_gallery([("x", "名前", self.png)])
        for token in ("idle", "walk", "attack", "down", "up", "left", "right"):
            self.assertIn(f'data-{"state" if token in ("idle", "walk", "attack") else "dir"}', html)
            self.assertIn(token, html)


    def test_the_page_offers_slow_playback_and_frame_steps(self):
        html = render_gallery([("x", "名前", self.png)])
        for speed in ("1", "0.5", "0.25"):
            self.assertIn(f'data-speed="{speed}"', html)
        self.assertIn('id="pause"', html)
        self.assertIn('id="step"', html)
        self.assertIn('class="frame"', html)


class GalleryMainTest(unittest.TestCase):
    """main() がレシピを読んでページを書く（パレットの作り直しで load_recipe が Palette を受けるようになった。2026-11-03）。"""

    def setUp(self):
        import enemy_gallery

        self._tmp = tempfile.TemporaryDirectory()
        tmp = Path(self._tmp.name)
        (tmp / "enemy").mkdir()
        (tmp / "sheets").mkdir()
        (tmp / "enemy" / "test-enemy.json").write_text(
            '{"id": "test-enemy", "name": "テストの敵", "archetype": "dagger", "body": "male",'
            ' "recolor": {"clothes_dark_hi": "dirt_hi"}}', encoding="utf-8")
        Image.new("RGBA", (128, 384)).save(tmp / "sheets" / "test-enemy.png")
        self.out = tmp / "gallery.html"
        self.enemy_gallery = enemy_gallery
        saved = (enemy_gallery.ENEMY_DIR, enemy_gallery.SHEET_DIR)
        enemy_gallery.ENEMY_DIR, enemy_gallery.SHEET_DIR = tmp / "enemy", tmp / "sheets"
        self.addCleanup(setattr, enemy_gallery, "ENEMY_DIR", saved[0])
        self.addCleanup(setattr, enemy_gallery, "SHEET_DIR", saved[1])
        self.addCleanup(self._tmp.cleanup)

    def test_main_writes_the_page_from_the_recipes(self):
        code = self.enemy_gallery.main([str(self.out)])
        self.assertEqual(code, 0)
        self.assertIn("テストの敵", self.out.read_text(encoding="utf-8"))

    def test_first_moves_the_named_enemy_after_the_refs(self):
        tmp = Path(self._tmp.name)
        (tmp / "enemy" / "zz-enemy.json").write_text(
            '{"id": "zz-enemy", "name": "後ろの敵", "archetype": "dagger", "body": "male",'
            ' "recolor": {"clothes_dark_hi": "dirt_hi"}}', encoding="utf-8")
        Image.new("RGBA", (128, 384)).save(tmp / "sheets" / "zz-enemy.png")
        ref = tmp / "ref.png"
        Image.new("RGBA", (128, 384)).save(ref)
        code = self.enemy_gallery.main([str(self.out), "--ref", f"{ref}:味方", "--first", "zz-enemy"])
        self.assertEqual(code, 0)
        page = self.out.read_text(encoding="utf-8")
        self.assertLess(page.index("味方"), page.index("後ろの敵"))
        self.assertLess(page.index("後ろの敵"), page.index("テストの敵"))

    def test_first_does_not_accept_the_name_of_a_ref(self):
        ref = Path(self._tmp.name) / "ref-only.png"
        Image.new("RGBA", (128, 384)).save(ref)
        code = self.enemy_gallery.main([str(self.out), "--ref", f"{ref}:味方", "--first", "ref-only"])
        self.assertEqual(code, 2)

    def test_first_with_unknown_id_fails(self):
        self.assertEqual(self.enemy_gallery.main([str(self.out), "--first", "nope"]), 2)


if __name__ == "__main__":
    unittest.main()
