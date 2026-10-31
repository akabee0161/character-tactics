"""Checks for validate.palette_rules and validate.unused (temp palette and grids only).

    .venv/bin/python -m unittest tests.test_validate -v
"""
from __future__ import annotations

import json
import sys
import tempfile
import unittest
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT / "tools"))

import palette  # noqa: E402
from gridfile import parse  # noqa: E402
from validate import palette_rules, unused  # noqa: E402


def _write(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8")


def _json(root: Path, rel: str, data) -> None:
    _write(root / rel, json.dumps(data))


class PaletteRulesTest(unittest.TestCase):
    def setUp(self) -> None:
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        self.root = Path(tmp.name)
        sw = {n: {"hex": h, "note": "n"} for n, h in [
            ("ink", "#101018"), ("steel", "#dfe3ea"), ("wood", "#805020"),
            ("red", "#c02020"), ("unused_sw", "#123456"), ("grass", "#20a020"),
        ]}
        _json(self.root, "pal/swatches.json", sw)
        _json(self.root, "pal/kinds.json", {k: {"note": "n"} for k in
              ("outline", "blade", "weapon", "shield", "headgear", "terrain")})

        def use(swatch, kind):
            return {"swatch": swatch, "kind": kind, "note": "n"}

        _json(self.root, "pal/uses/common.json", {"contour": use("ink", "outline")})
        _json(self.root, "pal/uses/unit.json", {
            "blade_hi": use("steel", "blade"), "haft": use("wood", "weapon"),
            "plate": use("steel", "shield"), "helm": use("red", "headgear"),
        })
        _json(self.root, "pal/uses/tile.json", {"lawn": use("grass", "terrain")})
        self.pal = palette.load(self.root / "pal")

    def grid(self, rel: str, names: list[str], type_: str = "unit") -> tuple[Path, object]:
        path = self.root / rel
        chars = "abcdef"
        mp = "\n".join(f"# map: {chars[i]}={n}" for i, n in enumerate(names))
        _write(path, f"# type: {type_}\n# size: {len(names)}x1\n{mp}\n{chars[:len(names)]}\n")
        return Path(rel), parse(path)

    def rules(self, rel: str, names: list[str], type_: str = "unit") -> list[str]:
        rel_path, grid = self.grid(rel, names, type_)
        return palette_rules(rel_path, grid, self.pal)

    def test_name_from_other_type_fails(self) -> None:
        out = self.rules("assets/tile/a.txt", ["contour", "helm"], "tile")
        self.assertEqual(len(out), 1)
        self.assertIn("helm", out[0])

    def test_name_from_own_type_and_common_passes(self) -> None:
        self.assertEqual(self.rules("assets/tile/a.txt", ["contour", "lawn"], "tile"), [])

    def test_weapon_part_with_headgear_colour_fails(self) -> None:
        out = self.rules("assets/part/equip/sword/a.txt", ["contour", "blade_hi", "haft", "helm"])
        self.assertEqual(len(out), 1)
        self.assertIn("helm", out[0])

    def test_weapon_part_with_shield_colour_fails(self) -> None:
        self.assertEqual(len(self.rules("assets/part/equip/bow/a.txt", ["plate"])), 1)

    def test_shield_part_with_blade_colour_fails(self) -> None:
        out = self.rules("assets/part/equip/shield/a.txt", ["contour", "plate", "blade_hi"])
        self.assertEqual(len(out), 1)
        self.assertIn("blade_hi", out[0])

    def test_shield_part_ok(self) -> None:
        self.assertEqual(self.rules("assets/part/equip/shield/a.txt", ["contour", "plate"]), [])

    def test_head_part_with_blade_colour_fails(self) -> None:
        out = self.rules("assets/part/head/a.txt", ["contour", "helm", "blade_hi"])
        self.assertEqual(len(out), 1)
        self.assertIn("blade_hi", out[0])

    def test_unit_base_with_shield_colour_fails(self) -> None:
        self.assertEqual(len(self.rules("types/unit/base/a.txt", ["plate"])), 1)

    def test_composed_unit_frame_may_use_weapon(self) -> None:
        self.assertEqual(
            self.rules("assets/unit/roran/a.txt", ["contour", "blade_hi", "haft", "plate", "helm"]), [])

    def test_unused_are_reported(self) -> None:
        uses, swatches = unused(self.pal, {"contour", "blade_hi"})
        self.assertEqual(uses, {"haft", "plate", "helm", "lawn"})
        self.assertEqual(swatches, {"unused_sw"})  # no use points at it

    def test_derived_file_takes_type_from_origin(self) -> None:
        origin, _ = self.grid("assets/tile/o.txt", ["contour", "lawn"], "tile")
        d = self.root / "assets/tile/d.txt"
        _write(d, "# from: o.txt\n# transform: mirror_x\n")
        grid = parse(d)
        self.assertEqual(palette_rules(Path("assets/tile/d.txt"), grid, self.pal), [])


if __name__ == "__main__":
    unittest.main()
