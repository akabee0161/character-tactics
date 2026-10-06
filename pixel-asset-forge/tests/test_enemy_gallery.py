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


if __name__ == "__main__":
    unittest.main()
