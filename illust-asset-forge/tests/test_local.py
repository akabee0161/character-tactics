import re
import subprocess

import pytest

from artgen.config import ConfigError
from artgen.local import local_commit, local_dirs, save_outputs


def test_local_dirs(tmp_path):
    d = local_dirs(tmp_path)
    assert d.runs == tmp_path / "local" / "runs"
    assert d.selected == tmp_path / "local" / "selected"
    assert d.packs == tmp_path / "local" / "packs"
    assert d.rounds == tmp_path / "local" / "rounds"
    assert not (tmp_path / "local").exists()  # 作るのは書く側


def _git(root, *args):
    subprocess.run(
        ["git", "-C", str(root), "-c", "user.name=t", "-c", "user.email=t@example.com", *args],
        check=True, capture_output=True,
    )


def test_local_commit_clean_and_dirty(tmp_path):
    _git(tmp_path, "init", "-q")
    (tmp_path / "x.txt").write_text("a")
    _git(tmp_path, "add", ".")
    _git(tmp_path, "commit", "-q", "-m", "init")
    assert re.fullmatch(r"[0-9a-f]{7,}", local_commit(tmp_path))
    (tmp_path / "x.txt").write_text("changed")
    clean = local_commit(tmp_path)
    assert re.fullmatch(r"[0-9a-f]{7,}\+dirty", clean)


def test_local_commit_ignores_changes_outside_root(tmp_path):
    _git(tmp_path, "init", "-q")
    sub = tmp_path / "forge"
    sub.mkdir()
    (sub / "a.txt").write_text("a")
    (tmp_path / "other.txt").write_text("o")
    _git(tmp_path, "add", ".")
    _git(tmp_path, "commit", "-q", "-m", "init")
    (tmp_path / "other.txt").write_text("changed")
    assert not local_commit(sub).endswith("+dirty")
    (sub / "a.txt").write_text("changed")
    assert local_commit(sub).endswith("+dirty")


def test_local_commit_without_git(tmp_path):
    assert local_commit(tmp_path) == "unknown"


def test_save_outputs_writes_relative(tmp_path):
    paths = save_outputs(tmp_path, [("c1/face/20261123_120000/c1_face_1.png", b"png")])
    assert paths == [tmp_path / "c1/face/20261123_120000/c1_face_1.png"]
    assert paths[0].read_bytes() == b"png"


@pytest.mark.parametrize("bad", ["/etc/x.png", "../x.png", "c1/../../x.png"])
def test_save_outputs_rejects_escape(tmp_path, bad):
    with pytest.raises(ConfigError):
        save_outputs(tmp_path / "runs", [("ok/a.png", b"1"), (bad, b"2")])
    assert not (tmp_path / "runs").exists()  # 1 つでも悪ければ何も書かない
