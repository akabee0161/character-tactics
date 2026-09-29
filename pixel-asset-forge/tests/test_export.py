"""Checks for the export tool.

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

import export  # noqa: E402


class ExportTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        root = Path(self.tmp.name)
        self.build = root / "build"
        self.dest = root / "images"
        (self.build / "tile").mkdir(parents=True)
        (self.build / "sets").mkdir()
        self.dest.mkdir()
        (self.build / "tile" / "forest.png").write_bytes(b"forest")
        (self.build / "sets" / "village.png").write_bytes(b"village")
        self.mapping = root / "sprites.json"

    def tearDown(self):
        self.tmp.cleanup()

    def write_mapping(self, data) -> Path:
        self.mapping.write_text(json.dumps(data), encoding="utf-8")
        return self.mapping

    def run_export(self, data):
        return export.export(self.write_mapping(data), self.dest, self.build)

    def assert_nothing_copied(self):
        self.assertEqual(list(self.dest.iterdir()), [])

    def test_copies_each_entry_under_its_new_name(self):
        written = self.run_export({"tile/forest.png": "tile-forest.png", "sets/village.png": "tile-village.png"})
        self.assertEqual((self.dest / "tile-forest.png").read_bytes(), b"forest")
        self.assertEqual((self.dest / "tile-village.png").read_bytes(), b"village")
        self.assertEqual(sorted(p.name for p in written), ["tile-forest.png", "tile-village.png"])

    def test_overwrites_an_older_copy(self):
        (self.dest / "tile-forest.png").write_bytes(b"old")
        self.run_export({"tile/forest.png": "tile-forest.png"})
        self.assertEqual((self.dest / "tile-forest.png").read_bytes(), b"forest")

    def test_a_missing_build_output_stops_everything(self):
        with self.assertRaisesRegex(export.ExportError, "tile/nope.png"):
            self.run_export({"tile/forest.png": "tile-forest.png", "tile/nope.png": "tile-nope.png"})
        self.assert_nothing_copied()

    def test_a_source_outside_build_is_rejected(self):
        (self.build.parent / "secret.png").write_bytes(b"x")
        with self.assertRaisesRegex(export.ExportError, r"\.\./secret\.png.*outside build/"):
            self.run_export({"../secret.png": "secret.png"})
        self.assert_nothing_copied()

    def test_a_destination_with_a_path_is_rejected(self):
        for name in ("sub/tile-forest.png", "../tile-forest.png", "..", ""):
            with self.subTest(name=name):
                with self.assertRaisesRegex(export.ExportError, "not a plain file name"):
                    self.run_export({"tile/forest.png": name})
                self.assert_nothing_copied()

    def test_two_entries_with_the_same_destination_are_rejected(self):
        with self.assertRaisesRegex(export.ExportError, "tile-forest.png.*also"):
            self.run_export({"tile/forest.png": "tile-forest.png", "sets/village.png": "tile-forest.png"})
        self.assert_nothing_copied()

    def test_a_mapping_that_is_not_json_is_rejected(self):
        self.mapping.write_text("{", encoding="utf-8")
        with self.assertRaisesRegex(export.ExportError, "not valid JSON"):
            export.export(self.mapping, self.dest, self.build)

    def test_a_mapping_that_is_not_an_object_is_rejected(self):
        for data in ([], {}, "tile/forest.png"):
            with self.subTest(data=data):
                with self.assertRaisesRegex(export.ExportError, "non-empty JSON object"):
                    self.run_export(data)

    def test_a_destination_that_is_not_a_string_is_rejected(self):
        with self.assertRaisesRegex(export.ExportError, "tile/forest.png.*file name string"):
            self.run_export({"tile/forest.png": 3})

    def test_a_missing_mapping_file_is_named(self):
        with self.assertRaisesRegex(export.ExportError, "nope.json.*not found"):
            export.export(self.mapping.parent / "nope.json", self.dest, self.build)

    def test_a_missing_destination_folder_is_not_created(self):
        missing = self.dest.parent / "missing"
        with self.assertRaisesRegex(export.ExportError, "missing.*not a folder"):
            export.export(self.write_mapping({"tile/forest.png": "tile-forest.png"}), missing, self.build)
        self.assertFalse(missing.exists())


if __name__ == "__main__":
    unittest.main()
