import json
import zipfile

import pytest
from PIL import Image

from artgen.config import ConfigError
from artgen.intake import extract_pack, install_selection, main
from artgen.pnginfo import MissingParamsError, save_png


def write(root, rel, text):
    path = root / rel
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8")


def char_yaml(extra=""):
    return (
        "name: C\nstyle: s\nsubject: [1boy]\nappearance: []\noutfit: []\n"
        "default_expression: normal\nexpressions: {normal: [serious], hurt: [pain]}\n" + extra
    )


def write_png(path, template="face", character="c1", overrides=None, params=True):
    path.parent.mkdir(parents=True, exist_ok=True)
    image = Image.new("RGB", (8, 8), (10, 20, 30))
    if params:
        save_png(image, path, {
            "seed": 1, "template": template, "character": character,
            "overrides": overrides or {},
        })
    else:
        image.save(path)


@pytest.fixture
def repo(tmp_path):
    write(tmp_path, "styles/s.yaml", "prompt: [masterpiece]\nnegative: [lowres]\n")
    write(tmp_path, "characters/c1/character.yaml", char_yaml("inpaint_box: [1, 2, 30, 40]\n"))
    write(tmp_path, "characters/c2/character.yaml", char_yaml())
    write_png(tmp_path / "characters/c1/source/face.png")
    return tmp_path


@pytest.fixture
def selected(tmp_path):
    d = tmp_path / "selected"
    write_png(d / "c1/face.png", overrides={"extra": ["scar"], "style": "t"})
    write_png(d / "c1/face_hurt.png")
    (d / "c1/selection.json").write_text(json.dumps({"inpaint_box": [10, 20, 300, 400]}), encoding="utf-8")
    return d


@pytest.fixture
def selected_with_c2_png_in_c1(tmp_path):
    d = tmp_path / "selected"
    write_png(d / "c1/face.png", character="c2")
    return d


@pytest.fixture
def selected_plain_png(tmp_path):
    d = tmp_path / "selected"
    write_png(d / "c1/face.png", params=False)
    return d


@pytest.fixture
def pack_zip(tmp_path, selected):
    z = tmp_path / "pack.zip"
    with zipfile.ZipFile(z, "w") as f:
        for p in sorted(selected.glob("c1/*")):
            f.write(p, f"c1/{p.name}")
    return z


def test_install_replaces_source_and_reports(repo, selected):
    write_png(repo / "characters/c1/source/fullbody.png", template="fullbody")  # 古いもの
    [r] = install_selection(repo, selected)
    assert r.char_id == "c1"
    assert sorted(r.installed) == ["face.png", "face_hurt.png"]
    assert r.removed == ["fullbody.png"]
    assert sorted(p.name for p in (repo / "characters/c1/source").iterdir()) == ["face.png", "face_hurt.png"]


def test_report_lists_write_backs(repo, selected):
    [r] = install_selection(repo, selected)
    text = "\n".join(r.write_back)
    assert "face.png" in text and "scar" in text
    assert "style" in text and "t" in text
    assert "inpaint_box" in text and "[10, 20, 300, 400]" in text


def test_report_omits_unchanged_box_and_empty_overrides(repo, selected):
    (selected / "c1/selection.json").write_text(json.dumps({"inpaint_box": [1, 2, 30, 40]}), encoding="utf-8")
    write_png(selected / "c1/face.png")
    [r] = install_selection(repo, selected)
    assert r.write_back == []


def test_install_checks_everything_before_writing(repo, selected):
    (selected / "c1" / "face_shout2.png").write_bytes((selected / "c1" / "face.png").read_bytes())
    before = sorted((repo / "characters/c1/source").iterdir())
    with pytest.raises(ConfigError, match="face_shout2.png"):
        install_selection(repo, selected)
    assert sorted((repo / "characters/c1/source").iterdir()) == before


def test_install_rejects_png_of_other_character(repo, selected_with_c2_png_in_c1):
    with pytest.raises(ConfigError, match="c2"):
        install_selection(repo, selected_with_c2_png_in_c1)


def test_install_rejects_png_without_params(repo, selected_plain_png):
    with pytest.raises(MissingParamsError):
        install_selection(repo, selected_plain_png)


@pytest.mark.parametrize("name", ["../evil.png", "/abs/face.png", "c1/sub/face.png", "nope/face.png", "c1/face_x.png"])
def test_extract_rejects_unsafe_or_unknown_entries(repo, tmp_path, name):
    z = tmp_path / "p.zip"
    with zipfile.ZipFile(z, "w") as f:
        f.writestr(name, b"x")
    before = sorted((repo / "characters/c1/source").iterdir())
    assert main([str(z), "--root", str(repo)]) == 1
    assert sorted((repo / "characters/c1/source").iterdir()) == before
    assert not (tmp_path / "evil.png").exists()


def test_extract_writes_nothing_when_any_entry_is_bad(repo, tmp_path, pack_zip):
    with zipfile.ZipFile(pack_zip, "a") as f:
        f.writestr("../evil.png", b"x")
    dest = tmp_path / "out"
    with pytest.raises(ConfigError):
        extract_pack(pack_zip, dest, root=repo)
    assert not dest.exists() or not any(dest.rglob("*"))


def test_main_rejects_bad_zip(repo, tmp_path):
    z = tmp_path / "bad.zip"
    z.write_bytes(b"not a zip")
    assert main([str(z), "--root", str(repo)]) == 1


def test_main_end_to_end(repo, pack_zip, capsys):
    assert main([str(pack_zip), "--root", str(repo)]) == 0
    out = capsys.readouterr().out
    assert "c1" in out and "書き戻す" in out


def _fail_staging_rename(monkeypatch, char_id):
    from pathlib import Path

    real = Path.rename

    def rename(self, target):
        if self.name == ".source.new" and self.parent.name == char_id:
            raise OSError("rename failed")
        return real(self, target)

    monkeypatch.setattr(Path, "rename", rename)


def test_install_rollback_keeps_source_when_swap_fails(repo, selected, monkeypatch):
    before = {p.name: p.read_bytes() for p in (repo / "characters/c1/source").iterdir()}
    _fail_staging_rename(monkeypatch, "c1")
    with pytest.raises(OSError):
        install_selection(repo, selected)
    assert {p.name: p.read_bytes() for p in (repo / "characters/c1/source").iterdir()} == before
    assert not (repo / "characters/c1/.source.new").exists()


def test_install_rollback_covers_already_swapped_characters(repo, selected, monkeypatch):
    write_png(repo / "characters/c2/source/face.png", character="c2")
    write_png(selected / "c2/face.png", character="c2")
    before = {
        c: {p.name: p.read_bytes() for p in (repo / f"characters/{c}/source").iterdir()} for c in ("c1", "c2")
    }
    _fail_staging_rename(monkeypatch, "c2")
    with pytest.raises(OSError):
        install_selection(repo, selected)
    after = {
        c: {p.name: p.read_bytes() for p in (repo / f"characters/{c}/source").iterdir()} for c in ("c1", "c2")
    }
    assert after == before
    for c in ("c1", "c2"):
        assert not (repo / f"characters/{c}/.source.new").exists()
        assert not (repo / f"characters/{c}/.source.old").exists()


def test_install_multiple_characters(repo, selected):
    write_png(selected / "c2/face.png", character="c2")
    reports = install_selection(repo, selected)
    assert [r.char_id for r in reports] == ["c1", "c2"]
    assert (repo / "characters/c2/source/face.png").is_file()


def test_install_validates_second_character_before_touching_first(repo, selected):
    write_png(selected / "c2/face.png", character="c1")  # c2 のフォルダに c1 の絵
    before = sorted((repo / "characters/c1/source").iterdir())
    with pytest.raises(ConfigError, match="c2/face.png"):
        install_selection(repo, selected)
    assert sorted((repo / "characters/c1/source").iterdir()) == before


def test_install_rejects_folder_without_png(repo, tmp_path):
    d = tmp_path / "selected"
    (d / "c1").mkdir(parents=True)
    (d / "c1/selection.json").write_text(json.dumps({"inpaint_box": [1, 2, 3, 4]}), encoding="utf-8")
    with pytest.raises(ConfigError, match="取り込む PNG が無い"):
        install_selection(repo, d)


@pytest.mark.parametrize("content", [b"[1, 2]", b"\xff\xfe\x00bad", b"null"])
def test_install_rejects_odd_selection_json(repo, selected, content):
    (selected / "c1/selection.json").write_bytes(content)
    with pytest.raises(ConfigError, match="selection.json"):
        install_selection(repo, selected)


def test_main_reports_odd_selection_json(repo, tmp_path, selected, capsys):
    (selected / "c1/selection.json").write_bytes(b"\xff\xfe\x00bad")
    z = tmp_path / "p.zip"
    with zipfile.ZipFile(z, "w") as f:
        for p in sorted(selected.glob("c1/*")):
            f.write(p, f"c1/{p.name}")
    assert main([str(z), "--root", str(repo)]) == 1
    assert "取り込めない" in capsys.readouterr().out


@pytest.mark.parametrize("name", ["c1\\face.png", "C:face.png", "C:/c1/face.png", "c1/..\\face.png"])
def test_extract_rejects_backslash_and_drive_prefix(repo, tmp_path, name):
    z = tmp_path / "p.zip"
    with zipfile.ZipFile(z, "w") as f:
        f.writestr(name, b"x")
    with pytest.raises(ConfigError, match="絶対パス・不正な区切り"):
        extract_pack(z, tmp_path / "out", root=repo)


def test_extract_rejects_duplicate_entries(repo, tmp_path):
    z = tmp_path / "p.zip"
    with pytest.warns(UserWarning):
        with zipfile.ZipFile(z, "w") as f:
            f.writestr("c1/face.png", b"a")
            f.writestr("c1/face.png", b"b")
    with pytest.raises(ConfigError, match="同じ名前"):
        extract_pack(z, tmp_path / "out", root=repo)
    assert not (tmp_path / "out").exists()


def test_extract_rejects_too_many_entries(repo, tmp_path, monkeypatch):
    monkeypatch.setattr("artgen.intake.MAX_ENTRIES", 1)
    z = tmp_path / "p.zip"
    with zipfile.ZipFile(z, "w") as f:
        f.writestr("c1/face.png", b"a")
        f.writestr("c1/face_hurt.png", b"b")
    with pytest.raises(ConfigError, match="エントリが多すぎる"):
        extract_pack(z, tmp_path / "out", root=repo)


def test_extract_rejects_too_large_total(repo, tmp_path, monkeypatch):
    monkeypatch.setattr("artgen.intake.MAX_TOTAL_BYTES", 10)
    z = tmp_path / "p.zip"
    with zipfile.ZipFile(z, "w") as f:
        f.writestr("c1/face.png", b"x" * 11)
    with pytest.raises(ConfigError, match="大きすぎる"):
        extract_pack(z, tmp_path / "out", root=repo)
    assert not (tmp_path / "out").exists()


def test_main_exits_1_for_encrypted_zip(repo, tmp_path, capsys, monkeypatch):
    z = tmp_path / "enc.zip"
    with zipfile.ZipFile(z, "w") as f:
        f.writestr("c1/face.png", b"x")
    real_open = zipfile.ZipFile.open

    def fake_open(self, *a, **k):
        raise RuntimeError("File 'c1/face.png' is encrypted, password required for extraction")

    monkeypatch.setattr(zipfile.ZipFile, "open", fake_open)
    assert main([str(z), "--root", str(repo)]) == 1
    assert "取り込めない" in capsys.readouterr().out
    monkeypatch.setattr(zipfile.ZipFile, "open", real_open)


def _expression_with_hash(path, face):
    from artgen.selection import file_sha256

    path.parent.mkdir(parents=True, exist_ok=True)
    save_png(Image.new("RGB", (8, 8)), path, {
        "seed": 1, "template": "face", "character": "c1", "overrides": {},
        "expression": "hurt", "source": "face.png", "source_sha256": file_sha256(face),
    })


def test_install_accepts_expression_made_from_packed_face(repo, selected):
    _expression_with_hash(selected / "c1/face_hurt.png", selected / "c1/face.png")
    [r] = install_selection(repo, selected)
    assert "face_hurt.png" in r.installed


def test_install_rejects_expression_made_from_other_face(repo, selected):
    _expression_with_hash(selected / "c1/face_hurt.png", selected / "c1/face.png")
    write_png(selected / "c1/face.png", overrides={"extra": ["other"]})  # 顔だけ差し替わった
    before = sorted((repo / "characters/c1/source").iterdir())
    with pytest.raises(ConfigError, match="今の顔から作っていない"):
        install_selection(repo, selected)
    assert sorted((repo / "characters/c1/source").iterdir()) == before


def test_install_rejects_hashed_expression_without_face(repo, selected):
    _expression_with_hash(selected / "c1/face_hurt.png", selected / "c1/face.png")
    (selected / "c1/face.png").unlink()
    with pytest.raises(ConfigError, match="顔"):
        install_selection(repo, selected)


def _expr_with_box(path, box):
    save_png(Image.new("RGB", (8, 8)), path, {
        "seed": 1, "template": "face", "character": "c1", "overrides": {},
        "expression": "hurt", "source": "face.png", "inpaint_box": box,
    })


def test_write_back_uses_box_the_expression_was_made_with(repo, selected):
    # 表情を作ったあとで範囲を動かした（selection.json は新しい範囲）
    _expr_with_box(selected / "c1/face_hurt.png", [5, 6, 70, 80])
    [r] = install_selection(repo, selected)
    boxes = [w for w in r.write_back if w.startswith("inpaint_box")]
    assert boxes == ["inpaint_box: [5, 6, 70, 80] を character.yaml へ"]


def test_write_back_lists_default_box_without_selection_json(repo, selected):
    (selected / "c1/selection.json").unlink()
    _expr_with_box(selected / "c1/face_hurt.png", [320, 260, 720, 660])  # 型の既定で作った
    [r] = install_selection(repo, selected)
    assert "inpaint_box: [320, 260, 720, 660] を character.yaml へ" in r.write_back


def test_write_back_omits_used_box_equal_to_yaml(repo, selected):
    _expr_with_box(selected / "c1/face_hurt.png", [1, 2, 30, 40])
    [r] = install_selection(repo, selected)
    assert not [w for w in r.write_back if w.startswith("inpaint_box")]


def test_main_reports_decompression_bomb(repo, pack_zip, capsys, monkeypatch):
    monkeypatch.setattr(Image, "MAX_IMAGE_PIXELS", 10)
    assert main([str(pack_zip), "--root", str(repo)]) == 1
    assert "取り込めない" in capsys.readouterr().out


def _face_adopted_from(selected, flip):
    from artgen.selection import file_sha256

    image = Image.new("RGB", (8, 8), (1, 2, 3))
    cand = selected.parent / "cand_face.png"
    save_png(image, cand, {"seed": 1, "template": "face", "character": "c1", "overrides": {}})
    params = {"seed": 1, "template": "face", "character": "c1", "overrides": {}, "flipped": flip}
    if not flip:
        params["adopted_from_sha256"] = file_sha256(cand)
    save_png(image, selected / "c1/face.png", params)
    return cand


def test_install_accepts_expression_made_from_adopted_candidate(repo, selected):
    cand = _face_adopted_from(selected, flip=False)
    _expression_with_hash(selected / "c1/face_hurt.png", cand)
    [r] = install_selection(repo, selected)
    assert "face_hurt.png" in r.installed


def test_install_rejects_expression_made_from_flipped_candidate(repo, selected):
    cand = _face_adopted_from(selected, flip=True)
    _expression_with_hash(selected / "c1/face_hurt.png", cand)
    with pytest.raises(ConfigError, match="今の顔から作っていない"):
        install_selection(repo, selected)


_BAD_BOXES = [[1, 2, 3], [-1, 0, 5, 5], [5, 0, 5, 9], [0, 9, 5, 3], [0, 0, 1.5, 4], [0, 0, True, 4], "x"]


@pytest.mark.parametrize("box", _BAD_BOXES)
def test_install_rejects_invalid_box_in_selection_json(repo, selected, box):
    (selected / "c1/selection.json").write_text(json.dumps({"inpaint_box": box}), encoding="utf-8")
    before = {p.name: p.read_bytes() for p in (repo / "characters/c1/source").iterdir()}
    with pytest.raises(ConfigError, match=r"c1/selection\.json: inpaint_box"):
        install_selection(repo, selected)
    assert {p.name: p.read_bytes() for p in (repo / "characters/c1/source").iterdir()} == before
    assert not (repo / "characters/c1/.source.new").exists()


@pytest.mark.parametrize("box", _BAD_BOXES)
def test_install_rejects_invalid_box_in_expression_png(repo, selected, box):
    _expr_with_box(selected / "c1/face_hurt.png", box)
    before = {p.name: p.read_bytes() for p in (repo / "characters/c1/source").iterdir()}
    with pytest.raises(ConfigError, match=r"c1/face_hurt\.png: inpaint_box"):
        install_selection(repo, selected)
    assert {p.name: p.read_bytes() for p in (repo / "characters/c1/source").iterdir()} == before
    assert not (repo / "characters/c1/.source.new").exists()


def test_install_restores_source_when_interrupted_right_after_backup(repo, selected, monkeypatch):
    from pathlib import Path

    before = {p.name: p.read_bytes() for p in (repo / "characters/c1/source").iterdir()}
    real = Path.rename

    def rename(self, target):
        result = real(self, target)
        if self.name == "source" and self.parent.name == "c1":
            raise KeyboardInterrupt  # 退避のすぐ後
        return result

    monkeypatch.setattr(Path, "rename", rename)
    with pytest.raises(KeyboardInterrupt):
        install_selection(repo, selected)
    assert {p.name: p.read_bytes() for p in (repo / "characters/c1/source").iterdir()} == before
    assert not (repo / "characters/c1/.source.new").exists()
    assert not (repo / "characters/c1/.source.old").exists()
