"""テストが現役のアート（assets/）を読んでいないかを確かめる（2026-10-16）。

CLAUDE.md「回帰テストに現役のアートを参照させない」: tests/ から assets/ の生きている絵を読むと、
その絵を描き直したときにテストが落ちる。比べたい相手は tests/fixtures/ に固定する。

tests/ の他のテストを1件ずつ走らせ、その間に開かれたファイルのうち、リポジトリの assets/ の下にあるものを数える
（builtins.open と io.open を見張る。Path.read_text・Image.open もどちらかを通る）。
一時フォルダの中の assets/ はリポジトリの外なので数えない。他のテストの成否はここでは見ない。
わざと出荷物の構造を確かめるテストは ALLOWED に、理由と日付と一緒に挙げる。
"""
from __future__ import annotations

import builtins
import contextlib
import io
import os
import tempfile
import unittest
from pathlib import Path

TESTS = Path(__file__).resolve().parent
REPO_ROOT = TESTS.parent
ASSETS = REPO_ROOT / "assets"

ALLOWED: dict[str, str] = {
    "test_tools.RiverDerivationTest.test_the_derived_bends_carry_no_rows_of_their_own":
        "出荷する川の曲がりが、行を持たない派生の宣言であることを確かめる。絵を描き直しても落ちない（2026-10-16、ISSUES の行のとおり残す）",
}


def _cases(suite):
    for test in suite:
        if isinstance(test, unittest.TestSuite):
            yield from _cases(test)
        else:
            yield test


def record_reads(tests, assets_root: Path) -> dict[str, set[Path]]:
    """tests を1件ずつ走らせ、テストの id ごとに assets_root の下で開いたファイルを返す。"""
    root = assets_root.resolve()
    reads: dict[str, set[Path]] = {}
    current: list[str | None] = [None]
    real_builtin, real_io = builtins.open, io.open

    def spy(file, *args, **kwargs):
        if current[0] is not None and isinstance(file, (str, os.PathLike)):
            path = Path(file).resolve()
            if path.is_relative_to(root):
                reads.setdefault(current[0], set()).add(path)
        return real_io(file, *args, **kwargs)

    builtins.open = io.open = spy
    try:
        for test in tests:
            current[0] = test.id()
            with contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(io.StringIO()):
                test.run(unittest.TestResult())
            current[0] = None
    finally:
        builtins.open, io.open = real_builtin, real_io
    return reads


def suite_reads() -> dict[str, set[Path]]:
    suite = unittest.TestLoader().discover(str(TESTS), pattern="test*.py", top_level_dir=str(TESTS))
    tests = [t for t in _cases(suite) if not t.id().startswith(f"{__name__.rsplit('.', 1)[-1]}.")]
    return record_reads(tests, ASSETS)


class RecordReadsTest(unittest.TestCase):
    def setUp(self):
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        self.root = Path(tmp.name)
        (self.root / "assets").mkdir()
        (self.root / "assets" / "a.txt").write_text("a", encoding="utf-8")
        (self.root / "other.txt").write_text("b", encoding="utf-8")

    def test_records_both_open_and_read_text(self):
        root = self.root

        class Probe(unittest.TestCase):
            def test_read_text(self):
                (root / "assets" / "a.txt").read_text(encoding="utf-8")

            def test_open(self):
                with open(root / "assets" / "a.txt", encoding="utf-8") as handle:
                    handle.read()

            def test_outside(self):
                (root / "other.txt").read_text(encoding="utf-8")

        tests = list(_cases(unittest.TestLoader().loadTestsFromTestCase(Probe)))
        reads = record_reads(tests, root / "assets")
        self.assertEqual(sorted(k.rsplit(".", 1)[-1] for k in reads), ["test_open", "test_read_text"])
        self.assertEqual(builtins.open.__module__, "_io")  # 見張りを外して元に戻っている


class NoLiveAssetsTest(unittest.TestCase):
    def test_no_test_reads_live_assets(self):
        reads = suite_reads()
        unexpected = {test: sorted(str(p.relative_to(REPO_ROOT)) for p in paths)
                      for test, paths in reads.items() if test not in ALLOWED}
        self.assertEqual(unexpected, {}, "assets/ を読んでいるテスト（tests/fixtures/ に固定するか、理由を書いて ALLOWED へ）")

    def test_allowed_entries_still_read_assets(self):
        reads = suite_reads()
        self.assertEqual(sorted(t for t in ALLOWED if t not in reads), [], "もう assets/ を読んでいない（ALLOWED から消す）")


if __name__ == "__main__":
    unittest.main()
