"""Checks for the face parts compositor.

    .venv/bin/python -m unittest discover -s tests
"""
from __future__ import annotations

import json
import sys
import tempfile
import unittest
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT / "tools"))

import compose_face  # noqa: E402

# 4x4 base: outline ring around 2x2 skin
BASE = """\
# type: face
# size: 4x4
# bg: transparent
# map: o=outline b=skin_base
oooo
obbo
obbo
oooo
"""

DOT = """\
# type: face
# size: 1x1
# bg: transparent
# map: k=pupil
k
"""

WIDE = """\
# type: face
# size: 3x1
# bg: transparent
# map: k=pupil
kkk
"""

COVER = """\
# type: face
# size: 4x4
# bg: transparent
# map: h=hair_base
hhhh
h...
....
....
"""


def make_set(root: Path, eye_anchor=(1, 1), eye_file="dot.txt", clip=True) -> Path:
    (root / "base.txt").write_text(BASE)
    (root / "dot.txt").write_text(DOT)
    (root / "wide.txt").write_text(WIDE)
    (root / "cover.txt").write_text(COVER)
    spec = {
        "size": [4, 4],
        "base": "base.txt",
        "clip_keys": ["skin_base"],
        "order": ["eyes", "hair"],
        "default": {"eyes": "E1", "hair": "H1", "balance": "P1"},
        "balance": {
            "P1": {"label": "p1", "anchors": {"eye": list(eye_anchor)}},
            "P2": {"label": "p2", "anchors": {"eye": [2, 2]}},
        },
        "elements": {
            "eyes": {"label": "eyes", "clip": clip,
                     "variants": {"E1": {"label": "e1", "parts": {"eye": eye_file}}}},
            "hair": {"label": "hair", "clip": False,
                     "variants": {"H1": {"label": "h1", "parts": {"origin": "cover.txt"}},
                                  "H0": {"label": "none", "parts": {}}}},
        },
    }
    (root / "parts.json").write_text(json.dumps(spec))
    return root


class ComposeTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name)

    def tearDown(self):
        self.tmp.cleanup()

    def test_places_a_part_at_the_balance_anchor(self):
        parts = compose_face.load_set(make_set(self.root))
        pixels = parts.compose({"eyes": "E1", "hair": "H0", "balance": "P2"})
        self.assertEqual(pixels[(2, 2)], "pupil")
        self.assertEqual(pixels[(1, 1)], "skin_base")

    def test_later_layers_cover_earlier_ones_but_background_does_not(self):
        parts = compose_face.load_set(make_set(self.root))
        pixels = parts.compose({"eyes": "E1", "hair": "H1", "balance": "P1"})
        self.assertEqual(pixels[(1, 0)], "hair_base")  # hair over the base outline
        self.assertEqual(pixels[(1, 1)], "pupil")       # cover.txt has '.' here

    def test_clipped_parts_stay_on_the_skin(self):
        parts = compose_face.load_set(make_set(self.root, eye_file="wide.txt"))
        pixels = parts.compose({"eyes": "E1", "hair": "H0", "balance": "P1"})
        self.assertEqual(pixels[(1, 1)], "pupil")
        self.assertEqual(pixels[(2, 1)], "pupil")
        self.assertEqual(pixels[(3, 1)], "outline")  # third pixel fell on the outline

    def test_unclipped_part_off_the_canvas_is_an_error(self):
        parts = compose_face.load_set(make_set(self.root, eye_anchor=(3, 1), eye_file="wide.txt", clip=False))
        with self.assertRaisesRegex(compose_face.ComposeError, "outside"):
            parts.compose({"eyes": "E1", "hair": "H0", "balance": "P1"})

    def test_unknown_variant_is_named_in_the_error(self):
        parts = compose_face.load_set(make_set(self.root))
        with self.assertRaisesRegex(compose_face.ComposeError, "E9"):
            parts.compose({"eyes": "E9", "hair": "H0", "balance": "P1"})

    def test_missing_anchor_is_an_error_when_loading(self):
        root = make_set(self.root)
        spec = json.loads((root / "parts.json").read_text())
        del spec["balance"]["P2"]["anchors"]["eye"]
        (root / "parts.json").write_text(json.dumps(spec))
        with self.assertRaisesRegex(compose_face.ComposeError, "P2.*eye"):
            compose_face.load_set(root)

    def test_a_following_element_takes_the_variant_of_its_leader(self):
        root = make_set(self.root)
        spec = json.loads((root / "parts.json").read_text())
        (root / "shade.txt").write_text(DOT.replace("k=pupil", "k=skin_shadow"))
        spec["order"] = ["eyes", "shade", "hair"]
        spec["elements"]["shade"] = {"label": "shade", "clip": True, "follow": "hair", "variants": {
            "H1": {"label": "h1", "parts": {"eye": "shade.txt"}},
            "H0": {"label": "none", "parts": {}}}}
        (root / "parts.json").write_text(json.dumps(spec))
        parts = compose_face.load_set(root)
        self.assertEqual(parts.compose({"eyes": "E1", "hair": "H1", "balance": "P2"})[(2, 2)], "skin_shadow")
        self.assertEqual(parts.compose({"eyes": "E1", "hair": "H0", "balance": "P2"})[(2, 2)], "pupil")
        self.assertNotIn("shade", compose_face.export_json(parts, compose_face.load_palette())["elements"])

    def test_a_follower_needs_every_variant_of_its_leader(self):
        root = make_set(self.root)
        spec = json.loads((root / "parts.json").read_text())
        spec["order"] = ["shade", "eyes", "hair"]
        spec["elements"]["shade"] = {"label": "shade", "follow": "hair", "variants": {
            "H1": {"label": "h1", "parts": {}}}}
        (root / "parts.json").write_text(json.dumps(spec))
        with self.assertRaisesRegex(compose_face.ComposeError, "shade.*H0"):
            compose_face.load_set(root)

    def test_covered_counts_the_pixels_a_later_layer_hides(self):
        parts = compose_face.load_set(make_set(self.root, eye_anchor=(1, 1)))
        hidden = parts.covered("eyes", "E1", "hair", "H1", "P1")
        self.assertEqual(hidden, (0, 1))  # the dot at (1,1) is not under hair
        parts = compose_face.load_set(make_set(self.root, eye_anchor=(1, 1), eye_file="wide.txt"))
        self.assertEqual(parts.covered("eyes", "E1", "hair", "H1", "P1"), (0, 2))


if __name__ == "__main__":
    unittest.main()
