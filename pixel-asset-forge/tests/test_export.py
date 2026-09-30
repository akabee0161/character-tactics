"""Checks for the export tool.

    .venv/bin/python -m unittest discover -s tests
"""
from __future__ import annotations

import contextlib
import io
import json
import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock

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

    def test_a_folder_in_the_way_of_a_destination_stops_everything(self):
        (self.dest / "tile-village.png").mkdir()
        with self.assertRaisesRegex(export.ExportError, "tile-village.png.*not a file"):
            self.run_export({"tile/forest.png": "tile-forest.png", "sets/village.png": "tile-village.png"})
        self.assertFalse((self.dest / "tile-forest.png").exists())

    def test_a_source_written_twice_is_rejected(self):
        self.mapping.write_text(
            '{"tile/forest.png": "tile-forest.png", "tile/forest.png": "tile-woods.png"}', encoding="utf-8"
        )
        with self.assertRaisesRegex(export.ExportError, "tile/forest.png.*more than once"):
            export.export(self.mapping, self.dest, self.build)
        self.assert_nothing_copied()

    def test_a_failed_copy_is_reported_as_an_export_error(self):
        # A full disk or a read-only file must end in one FAIL line, not a traceback.
        with mock.patch.object(export.shutil, "copyfile", side_effect=OSError("No space left on device")):
            with self.assertRaisesRegex(export.ExportError, "tile-forest.png.*No space left on device"):
                self.run_export({"tile/forest.png": "tile-forest.png"})

    def test_a_missing_destination_folder_is_not_created(self):
        missing = self.dest.parent / "missing"
        with self.assertRaisesRegex(export.ExportError, "missing.*not a folder"):
            export.export(self.write_mapping({"tile/forest.png": "tile-forest.png"}), missing, self.build)
        self.assertFalse(missing.exists())


class BuildTest(unittest.TestCase):
    # build() drives render/sets/sheet, which read the live art. The tests stub
    # them and point BUILD_DIR at a temporary folder, so they neither depend on
    # the current assets nor wipe the real build/ (CLAUDE.md: no live art in tests).
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        root = Path(self.tmp.name)
        self.build_dir = root / "build"
        sheet_dir = root / "sheets"
        sheet_dir.mkdir()
        (sheet_dir / "hero.txt").write_text("", encoding="utf-8")
        self.calls: list[str] = []
        self.render_code = 0
        patches = (
            mock.patch.object(export, "BUILD_DIR", self.build_dir),
            mock.patch.object(export, "SHEET_DIR", sheet_dir),
            mock.patch.object(export.render, "main", side_effect=self.fake_render),
            mock.patch.object(export.sets, "main", side_effect=lambda argv: self.record("sets")),
            mock.patch.object(export.sheet, "main", side_effect=lambda argv: self.record("sheet")),
        )
        for patch in patches:
            patch.start()
            self.addCleanup(patch.stop)

    def tearDown(self):
        self.tmp.cleanup()

    def record(self, name: str) -> int:
        self.calls.append(name)
        return 0

    def fake_render(self, argv) -> int:
        self.calls.append("render")
        (self.build_dir / "tile").mkdir(parents=True, exist_ok=True)
        (self.build_dir / "tile" / "current.png").write_bytes(b"new")
        return self.render_code

    def test_a_png_left_from_an_earlier_build_is_removed(self):
        # A grid renamed or deleted since the last build must not leave its old
        # PNG behind, or export() would copy it as if it were current.
        stale = self.build_dir / "tile" / "stale.png"
        stale.parent.mkdir(parents=True)
        stale.write_bytes(b"old")
        self.assertEqual(export.build(), 0)
        self.assertFalse(stale.exists())
        self.assertTrue((self.build_dir / "tile" / "current.png").is_file())

    def test_runs_render_then_sets_then_every_sheet(self):
        self.assertEqual(export.build(), 0)
        self.assertEqual(self.calls, ["render", "sets", "sheet"])

    def test_a_failing_step_stops_the_build_with_its_code(self):
        self.render_code = 2
        self.assertEqual(export.build(), 2)
        self.assertEqual(self.calls, ["render"])


class MainTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        root = Path(self.tmp.name)
        self.dest = root / "images"
        self.dest.mkdir()
        build_dir = root / "build"
        (build_dir / "tile").mkdir(parents=True)
        (build_dir / "tile" / "only_in_this_test.png").write_bytes(b"png")
        self.mapping = root / "sprites.json"
        self.mapping.write_text(json.dumps({"tile/only_in_this_test.png": "tile-test.png"}), encoding="utf-8")
        self.build_code = 0
        patches = (
            mock.patch.object(export, "BUILD_DIR", build_dir),
            mock.patch.object(export, "build", side_effect=lambda: self.build_code),
        )
        for patch in patches:
            patch.start()
            self.addCleanup(patch.stop)

    def tearDown(self):
        self.tmp.cleanup()

    def quiet_main(self, argv):
        with contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(io.StringIO()):
            return export.main(argv)

    def test_a_failed_build_copies_nothing_and_passes_its_code_on(self):
        self.build_code = 2
        self.assertEqual(self.quiet_main([str(self.mapping), str(self.dest)]), 2)
        self.assertEqual(list(self.dest.iterdir()), [])

    def test_a_bad_mapping_exits_1(self):
        self.mapping.write_text("{", encoding="utf-8")
        self.assertEqual(self.quiet_main([str(self.mapping), str(self.dest)]), 1)

    def test_a_good_run_exits_0_and_copies_from_build(self):
        self.assertEqual(self.quiet_main([str(self.mapping), str(self.dest)]), 0)
        self.assertEqual((self.dest / "tile-test.png").read_bytes(), b"png")


if __name__ == "__main__":
    unittest.main()
