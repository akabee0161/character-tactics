"""Checks for the swatches / kinds / uses palette loader.

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

from gridfile import GridError  # noqa: E402
from palette import load  # noqa: E402


def _write(root: Path, rel: str, data) -> None:
    path = root / rel
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data), encoding="utf-8")


class PaletteLoadTest(unittest.TestCase):
    def setUp(self) -> None:
        self._tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self._tmp.cleanup)
        self.root = Path(self._tmp.name)
        _write(self.root, "swatches.json", {
            "stone_hi": {"hex": "#dfe3ea", "note": "明るい石"},
            "ink": {"hex": "#101018", "note": "輪郭"},
        })
        _write(self.root, "kinds.json", {
            "blade": {"note": "刃"},
            "outline": {"note": "輪郭線"},
        })

    def use(self, swatch="stone_hi", kind="blade", note="n") -> dict:
        d = {"swatch": swatch, "kind": kind}
        if note is not None:
            d["note"] = note
        return d

    def test_loads_uses_with_swatch_values(self) -> None:
        _write(self.root, "uses/unit.json", {"weapon_blade_hi": self.use()})
        p = load(self.root)
        self.assertEqual(p.rgb("weapon_blade_hi"), (0xDF, 0xE3, 0xEA))
        self.assertEqual(p.kind_of("weapon_blade_hi"), "blade")
        with self.assertRaises(KeyError):
            p.rgb("nope")

    def test_names_of_kind_by_type(self) -> None:
        _write(self.root, "uses/common.json", {"outline": self.use("ink", "outline")})
        _write(self.root, "uses/unit.json", {"unit_blade": self.use()})
        _write(self.root, "uses/tile.json", {"tile_blade": self.use()})
        p = load(self.root)
        self.assertEqual(p.names_of_kind("blade", type="unit"), frozenset({"unit_blade"}))
        self.assertEqual(p.names_of_kind("blade"), frozenset({"unit_blade", "tile_blade"}))
        self.assertEqual(p.allowed("unit"), frozenset({"outline", "unit_blade"}))

    def assertRejects(self, *needles: str) -> None:
        with self.assertRaises(GridError) as cm:
            load(self.root)
        for n in needles:
            self.assertIn(n, str(cm.exception))

    def test_rejects_missing_note(self) -> None:
        _write(self.root, "uses/unit.json", {"a": self.use(note=None)})
        self.assertRejects("unit.json", "a", "note")

    def test_rejects_unknown_swatch(self) -> None:
        _write(self.root, "uses/unit.json", {"a": self.use(swatch="zzz")})
        self.assertRejects("unit.json", "a", "zzz")

    def test_rejects_unknown_kind(self) -> None:
        _write(self.root, "uses/unit.json", {"a": self.use(kind="zzz")})
        self.assertRejects("unit.json", "a", "zzz")

    def test_rejects_bad_hex(self) -> None:
        _write(self.root, "swatches.json", {"bad": {"hex": "red", "note": "n"}})
        _write(self.root, "uses/unit.json", {})
        self.assertRejects("swatches.json", "bad")

    def test_rejects_duplicate_use_across_files(self) -> None:
        _write(self.root, "uses/unit.json", {"dup": self.use()})
        _write(self.root, "uses/tile.json", {"dup": self.use()})
        self.assertRejects("tile.json", "dup")

    def test_rejects_use_named_like_swatch(self) -> None:
        _write(self.root, "uses/unit.json", {"stone_hi": self.use()})
        self.assertRejects("unit.json", "stone_hi")

    def test_rejects_unknown_type_file(self) -> None:
        _write(self.root, "uses/foo.json", {})
        self.assertRejects("foo.json")


if __name__ == "__main__":
    unittest.main()
