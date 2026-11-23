import os
import shutil
import zipfile
from datetime import datetime

import pytest
from PIL import Image

from artgen.config import ConfigError
from artgen.pnginfo import MissingParamsError, read_params, save_png
from artgen.selection import (
    SelectionStore,
    find_candidate,
    run_dir,
    run_ids,
    run_kind,
    run_paths,
    selected_name,
)


def _half_red() -> Image.Image:
    im = Image.new("RGB", (16, 16), (0, 0, 255))
    for x in range(8):
        for y in range(16):
            im.putpixel((x, y), (255, 0, 0))
    return im


def _make(path, params, image=None):
    save_png(image or Image.new("RGB", (16, 16)), path, params)
    return path


FACE = {"template": "face", "expression": "normal", "character": "c1", "seed": 7, "style": "s"}


@pytest.fixture
def store(tmp_path):
    return SelectionStore(tmp_path / "selected", tmp_path / "packs")


@pytest.fixture
def candidate(tmp_path):
    return _make(tmp_path / "cand" / "c1_face_7.png", dict(FACE))


@pytest.fixture
def half_red_candidate(tmp_path):
    return _make(tmp_path / "cand" / "c1_face_9.png", {**FACE, "seed": 9}, _half_red())


@pytest.fixture
def expression_candidate(tmp_path):
    p = {**FACE, "expression": "hurt", "source": "face.png", "seed": 3}
    return _make(tmp_path / "cand" / "c1_face_hurt_3.png", p)


@pytest.fixture
def fullbody_candidate(tmp_path):
    p = {"template": "fullbody", "character": "c1", "seed": 4, "style": "s"}
    return _make(tmp_path / "cand" / "c1_fullbody_4.png", p)


def _run(runs, run_id, files):
    for name, seed in files:
        _make(runs / run_id / name, {**FACE, "character": name.split("_")[0], "seed": seed})


@pytest.fixture
def runs(tmp_path):
    r = tmp_path / "runs"
    _run(r, "20261120_090000", [("c1_face_1.png", 1)])
    _run(r, "20261121_090000", [("c1_face_7.png", 7), ("c2_face_8.png", 8)])
    return r


def _run_new(runs, char, kind, run_id, files):
    for name, seed in files:
        _make(runs / char / kind / run_id / name, {**FACE, "character": char, "seed": seed})


@pytest.fixture
def runs_new(tmp_path):
    # c1/face/20261120_090000/c1_face_1.png, c1/face/20261121_090000/c1_face_7.png,
    # c2/face/20261121_090000/c2_face_8.png, c1/fullbody/20261121_100000/c1_fullbody_5.png
    r = tmp_path / "runs"
    _run_new(r, "c1", "face", "20261120_090000", [("c1_face_1.png", 1)])
    _run_new(r, "c1", "face", "20261121_090000", [("c1_face_7.png", 7)])
    _run_new(r, "c2", "face", "20261121_090000", [("c2_face_8.png", 8)])
    _run_new(r, "c1", "fullbody", "20261121_100000", [("c1_fullbody_5.png", 5)])
    return r


@pytest.fixture
def runs_same_seed(tmp_path):
    r = tmp_path / "runs"
    _run(r, "20261121_090000", [("c1_face_7.png", 7), ("c2_face_7.png", 7)])
    return r


def test_selected_name_from_params():
    assert selected_name({"template": "face", "expression": "normal"}) == "face.png"
    assert selected_name({"template": "face", "expression": "hurt", "source": "face.png"}) == "face_hurt.png"
    assert selected_name({"template": "fullbody"}) == "fullbody.png"
    with pytest.raises(ConfigError):
        selected_name({"template": "other"})


def test_adopt_copies_with_params_and_flipped_false(store, candidate):
    dest = store.adopt(candidate)
    assert dest == store.selected_dir / "c1" / "face.png"
    assert read_params(dest)["seed"] == 7
    assert read_params(dest)["flipped"] is False


def test_adopt_flip_mirrors_and_records(store, half_red_candidate):
    dest = store.adopt(half_red_candidate, flip=True)
    with Image.open(dest) as im:
        assert im.convert("RGB").getpixel((0, 0)) == (0, 0, 255)
    assert read_params(dest)["flipped"] is True
    assert read_params(half_red_candidate).get("flipped") is None


def test_adopt_flip_only_for_face(store, expression_candidate, fullbody_candidate):
    for c in (expression_candidate, fullbody_candidate):
        with pytest.raises(ConfigError, match="左右反転は顔"):
            store.adopt(c, flip=True)


def test_readopting_face_moves_expressions_and_box(store, candidate, expression_candidate):
    store.adopt(candidate)
    store.adopt(expression_candidate)
    store.save_box("c1", (1, 2, 300, 400))
    store.adopt(candidate, now=lambda: datetime(2026, 11, 22, 10, 0, 0))
    moved = store.selected_dir / "c1" / "replaced" / "20261122_100000"
    assert (moved / "face_hurt.png").is_file() and (moved / "selection.json").is_file()
    assert not (store.selected_dir / "c1" / "face_hurt.png").exists()
    assert store.read_box("c1") is None


def test_adopt_without_params_writes_nothing(store, tmp_path):
    plain = tmp_path / "plain.png"
    Image.new("RGB", (8, 8)).save(plain)
    with pytest.raises(MissingParamsError):
        store.adopt(plain)
    assert not store.selected_dir.exists() or not any(store.selected_dir.rglob("*.png"))


def test_box_roundtrip_and_face_style(store, candidate):
    assert store.face_style("c1") is None
    store.adopt(candidate)
    assert store.face_style("c1") == "s"
    store.save_box("c1", (10, 20, 300, 400))
    assert store.read_box("c1") == (10, 20, 300, 400)


def test_read_box_broken_file_is_config_error(store):
    d = store.selected_dir / "c1"
    d.mkdir(parents=True)
    (d / "selection.json").write_text("{broken", encoding="utf-8")
    with pytest.raises(ConfigError, match="selection.json"):
        store.read_box("c1")
    (d / "selection.json").write_text('{"inpaint_box": [1, 2]}', encoding="utf-8")
    with pytest.raises(ConfigError, match="inpaint_box"):
        store.read_box("c1")


def test_pack_zips_without_replaced(store, candidate, expression_candidate):
    store.adopt(candidate)
    store.adopt(expression_candidate)
    store.adopt(candidate)
    z = store.pack(now=lambda: datetime(2026, 11, 22, 10, 0, 0))
    assert z == store.packs_dir / "selected_20261122_100000.zip"
    assert sorted(zipfile.ZipFile(z).namelist()) == ["c1/face.png"]


def test_pack_with_nothing_selected_says_so(store):
    with pytest.raises(ConfigError, match="採用した絵が無い"):
        store.pack()


def test_find_candidate_by_name_and_seed(runs):
    assert find_candidate(runs, "c1_face_7.png").name == "c1_face_7.png"
    assert find_candidate(runs, 8).name == "c2_face_8.png"
    with pytest.raises(ConfigError, match="見つからない"):
        find_candidate(runs, 999)


def test_find_candidate_ambiguous_seed_lists_names(runs_same_seed):
    with pytest.raises(ConfigError, match=r"c1_face_7\.png.*c2_face_7\.png"):
        find_candidate(runs_same_seed, 7)


def test_run_paths_latest_and_named(runs):
    assert run_ids(runs) == sorted(run_ids(runs))
    assert run_paths(runs) == run_paths(runs, run_ids(runs)[-1])
    with pytest.raises(ConfigError, match="run が無い"):
        run_paths(runs, "19990101_000000")


def test_adopt_save_failure_keeps_previous_state(store, candidate, expression_candidate, monkeypatch):
    store.adopt(candidate)
    store.adopt(expression_candidate)
    store.save_box("c1", (1, 2, 300, 400))

    def boom(*a, **k):
        raise OSError("disk full")

    monkeypatch.setattr("artgen.selection.save_png", boom)
    with pytest.raises(OSError):
        store.adopt(candidate)
    d = store.selected_dir / "c1"
    assert (d / "face_hurt.png").is_file() and (d / "selection.json").is_file()
    assert not (d / "replaced").exists()


def test_adopt_interrupt_after_publish_restores_whole_previous_state(
    store, candidate, half_red_candidate, expression_candidate, monkeypatch
):
    store.adopt(candidate)
    store.adopt(expression_candidate)
    store.save_box("c1", (1, 2, 300, 400))
    d = store.selected_dir / "c1"
    before = {p.name: p.read_bytes() for p in d.iterdir()}
    real_replace = os.replace

    def replace_then_interrupt(src, dst, *a, **k):
        real_replace(src, dst, *a, **k)
        if os.path.basename(dst) == "face.png" and os.path.basename(src) == ".face.png.new":
            raise KeyboardInterrupt

    monkeypatch.setattr("artgen.selection.os.replace", replace_then_interrupt)
    with pytest.raises(KeyboardInterrupt):
        store.adopt(half_red_candidate)
    monkeypatch.undo()
    assert {p.name: p.read_bytes() for p in d.iterdir()} == before


def test_adopt_does_not_restore_stale_backup_from_earlier_failed_restore(
    store, candidate, half_red_candidate, expression_candidate, monkeypatch
):
    store.adopt(candidate)
    d = store.selected_dir / "c1"
    real_replace = os.replace

    def publish_then_interrupt_and_break_restore(src, dst, *a, **k):
        if os.path.basename(src).startswith(".face.png.old"):
            raise OSError("restore failed")
        real_replace(src, dst, *a, **k)
        if os.path.basename(dst) == "face.png" and os.path.basename(src) == ".face.png.new":
            raise KeyboardInterrupt

    with monkeypatch.context() as m:
        m.setattr("artgen.selection.os.replace", publish_then_interrupt_and_break_restore)
        with pytest.raises(KeyboardInterrupt) as info:
            store.adopt(half_red_candidate)
    assert any("戻せなかった" in n for n in info.value.__notes__)
    stale = [p for p in d.iterdir() if p.name.startswith(".face.png.old")]
    assert len(stale) == 1
    stale_bytes = stale[0].read_bytes()

    # 現在の状態（顔・表情・範囲）を作り直してから、保存で失敗する採用を行う
    store.adopt(candidate)
    store.adopt(expression_candidate)
    store.save_box("c1", (1, 2, 300, 400))
    before = {p.name: p.read_bytes() for p in d.iterdir() if p != stale[0]}

    def boom(*a, **k):
        raise OSError("disk full")

    with monkeypatch.context() as m:
        m.setattr("artgen.selection.save_png", boom)
        with pytest.raises(OSError, match="disk full"):
            store.adopt(half_red_candidate)
    assert {p.name: p.read_bytes() for p in d.iterdir() if p != stale[0]} == before
    assert stale[0].read_bytes() == stale_bytes


def test_adopt_success_leaves_no_backup_file(store, candidate, half_red_candidate):
    store.adopt(candidate)
    store.adopt(half_red_candidate)
    assert sorted(p.name for p in (store.selected_dir / "c1").iterdir()) == ["face.png"]


def test_adopt_leaves_no_temp_file(store, candidate):
    store.adopt(candidate)
    assert sorted(p.name for p in (store.selected_dir / "c1").iterdir()) == ["face.png"]


def test_adopt_same_second_does_not_overwrite_replaced(store, candidate, expression_candidate):
    when = lambda: datetime(2026, 11, 22, 10, 0, 0)  # noqa: E731
    store.adopt(candidate)
    store.adopt(expression_candidate)
    store.adopt(candidate, now=when)
    store.adopt(expression_candidate)
    store.adopt(candidate, now=when)
    replaced = store.selected_dir / "c1" / "replaced"
    assert (replaced / "20261122_100000" / "face_hurt.png").is_file()
    assert (replaced / "20261122_100000_2" / "face_hurt.png").is_file()


def test_adopt_missing_character(store, tmp_path):
    p = {k: v for k, v in FACE.items() if k != "character"}
    c = _make(tmp_path / "x.png", p)
    with pytest.raises(ConfigError, match="character が無い"):
        store.adopt(c)


@pytest.mark.parametrize("bad", ["", "../evil", "a/b", "a\\b", "..", 5, ["c1"]])
def test_adopt_bad_character(store, tmp_path, bad):
    c = _make(tmp_path / "x.png", {**FACE, "character": bad})
    with pytest.raises(ConfigError, match="character"):
        store.adopt(c)
    assert not store.selected_dir.exists()
    assert not (tmp_path / "evil").exists()


def test_selected_name_source_without_expression():
    with pytest.raises(ConfigError, match="expression"):
        selected_name({"template": "face", "source": "face.png"})


def test_adopt_source_without_expression_writes_nothing(store, tmp_path):
    p = {k: v for k, v in FACE.items() if k != "expression"}
    c = _make(tmp_path / "x.png", {**p, "source": "face.png"})
    with pytest.raises(ConfigError, match="expression"):
        store.adopt(c)
    assert not store.selected_dir.exists()


def _expression_from(face_path, tmp_path, name="c1_face_hurt_5.png", with_hash=True):
    from artgen.selection import file_sha256

    p = {**FACE, "expression": "hurt", "source": "face.png", "seed": 5}
    if with_hash:
        p["source_sha256"] = file_sha256(face_path)
    return _make(tmp_path / "cand" / name, p)


def test_adopt_expression_made_from_current_face(store, candidate, tmp_path):
    face = store.adopt(candidate)
    expr = _expression_from(face, tmp_path)
    assert store.adopt(expr).name == "face_hurt.png"


def test_adopt_expression_from_old_face_is_rejected(store, candidate, half_red_candidate, tmp_path):
    old_face = store.adopt(candidate)
    expr = _expression_from(old_face, tmp_path)
    store.adopt(half_red_candidate)  # 顔を採用し直す
    with pytest.raises(ConfigError, match="今の顔から作っていない"):
        store.adopt(expr)
    assert not (store.selected_dir / "c1" / "face_hurt.png").exists()


def test_adopt_expression_without_face_is_rejected(store, candidate, tmp_path):
    face = store.adopt(candidate)
    expr = _expression_from(face, tmp_path)
    face.unlink()
    with pytest.raises(ConfigError, match="顔"):
        store.adopt(expr)


def test_adopt_expression_without_recorded_hash_is_not_blocked(store, candidate, tmp_path):
    """source_sha256 が無い古い PNG は、後方互換のため止めない。"""
    face = store.adopt(candidate)
    expr = _expression_from(face, tmp_path, with_hash=False)
    assert store.adopt(expr).name == "face_hurt.png"


def test_adopt_records_moved_files_and_resets(store, candidate, expression_candidate):
    store.adopt(candidate)
    store.adopt(expression_candidate)
    store.save_box("c1", (1, 2, 300, 400))
    assert store.last_moved == []
    store.adopt(candidate, now=lambda: datetime(2026, 11, 22, 10, 0, 0))
    assert sorted(store.last_moved) == ["face_hurt.png", "selection.json"]
    assert store.last_replaced == "20261122_100000"
    store.adopt(candidate)
    assert store.last_moved == [] and store.last_replaced is None


def test_find_candidate_by_name_searches_older_runs_newest_first(tmp_path):
    r = tmp_path / "runs"
    _run(r, "20261120_090000", [("c1_face_1.png", 1), ("c1_face_5.png", 5)])
    _run(r, "20261121_090000", [("c1_face_5.png", 5)])
    assert find_candidate(r, "c1_face_1.png").parent.name == "20261120_090000"
    assert find_candidate(r, "c1_face_5.png").parent.name == "20261121_090000"  # 新しい方
    assert find_candidate(r, "c1_face_5.png", run_id="20261120_090000").parent.name == "20261120_090000"
    with pytest.raises(ConfigError, match="見つからない"):
        find_candidate(r, "c1_face_1.png", run_id="20261121_090000")
    with pytest.raises(ConfigError, match="見つからない"):
        find_candidate(r, "nope.png")


def test_find_candidate_seed_still_searches_latest_run_only(runs):
    with pytest.raises(ConfigError, match="見つからない"):
        find_candidate(runs, 1)
    assert find_candidate(runs, 1, run_id="20261120_090000").name == "c1_face_1.png"


@pytest.mark.parametrize("bad", ["", "../x", "a/b", "a\\b", ".."])
def test_selected_name_rejects_unsafe_expression(bad):
    with pytest.raises(ConfigError):
        selected_name({"template": "face", "source": "face.png", "expression": bad})


def test_pack_explicit_id_without_adopted_pngs_is_an_error(store, candidate):
    store.adopt(candidate)
    with pytest.raises(ConfigError, match="c9"):
        store.pack(["c1", "c9"])
    assert store.pack(["c1"]).is_file()


def test_adopt_expression_made_from_adopted_candidate(store, candidate, tmp_path):
    """候補の顔を source に表情を作り、その候補を採用した場合は通す。"""
    expr = _expression_from(candidate, tmp_path)
    store.adopt(candidate)
    assert store.adopt(expr).name == "face_hurt.png"
    assert read_params(store.face_path("c1"))["adopted_from_sha256"]


def test_adopt_expression_made_from_candidate_rejected_when_flipped(store, candidate, tmp_path):
    expr = _expression_from(candidate, tmp_path)
    store.adopt(candidate, flip=True)
    assert "adopted_from_sha256" not in read_params(store.face_path("c1"))
    with pytest.raises(ConfigError, match="今の顔から作っていない"):
        store.adopt(expr)


def test_adopt_expression_made_from_older_candidate_is_rejected(
    store, candidate, half_red_candidate, tmp_path
):
    expr = _expression_from(candidate, tmp_path)
    store.adopt(candidate)
    store.adopt(half_red_candidate)
    with pytest.raises(ConfigError, match="今の顔から作っていない"):
        store.adopt(expr)


def _snapshot(d):
    return {str(p.relative_to(d)): p.read_bytes() for p in sorted(d.rglob("*")) if p.is_file()}, sorted(
        str(p.relative_to(d)) for p in d.rglob("*") if p.is_dir()
    )


def _adopted_state(store, candidate, expression_candidate):
    store.adopt(candidate)
    store.adopt(expression_candidate)
    store.save_box("c1", (1, 2, 300, 400))
    return store.selected_dir / "c1"


def test_adopt_restores_moved_files_when_final_replace_fails(
    store, candidate, half_red_candidate, expression_candidate, monkeypatch
):
    d = _adopted_state(store, candidate, expression_candidate)
    before = _snapshot(d)
    real = os.replace

    def boom(src, dst, *a, **k):
        if os.path.basename(dst) == "face.png":
            raise OSError("replace failed")
        return real(src, dst, *a, **k)

    monkeypatch.setattr("artgen.selection.os.replace", boom)
    with pytest.raises(OSError, match="replace failed"):
        store.adopt(half_red_candidate)
    assert _snapshot(d) == before
    assert store.last_moved == [] and store.last_replaced is None


def test_adopt_restores_moved_files_when_move_fails_partway(
    store, candidate, expression_candidate, monkeypatch
):
    d = _adopted_state(store, candidate, expression_candidate)
    before = _snapshot(d)
    real = shutil.move
    calls = []

    def boom(src, dst, *a, **k):
        calls.append(src)
        if len(calls) == 2:
            raise OSError("move failed")
        return real(src, dst, *a, **k)

    monkeypatch.setattr("artgen.selection.shutil.move", boom)
    with pytest.raises(OSError, match="move failed"):
        store.adopt(candidate)
    assert len(calls) >= 2  # 2 回目で失敗し、そのあと戻しでも呼ばれる
    assert _snapshot(d) == before
    assert store.last_moved == [] and store.last_replaced is None


def test_face_style_definition_read_from_adopted_face(store, candidate, tmp_path):
    assert store.face_style_definition("c1") is None
    store.adopt(candidate)
    assert store.face_style_definition("c1") is None  # 条件に定義が無い
    definition = {"prompt": ["a"], "negative": []}
    with_def = _make(
        tmp_path / "cand" / "c1_face_8.png",
        {**FACE, "seed": 8, "overrides": {"style": "s", "style_definition": definition}},
    )
    store.adopt(with_def)
    assert store.face_style_definition("c1") == definition


def test_run_kind_names():
    assert run_kind("face") == "face"
    assert run_kind("fullbody") == "fullbody"
    assert run_kind("face", "hurt") == "face-hurt"
    assert run_kind("face", compare=True) == "styles"
    assert run_kind("fullbody", compare=True) == "styles-fullbody"


@pytest.mark.parametrize("bad", ["../x", "a/b", "a\\b", ".."])
def test_run_kind_rejects_unsafe_names(bad):
    with pytest.raises(ConfigError, match="ファイル名に使えない"):
        run_kind("face", bad)


def test_run_dir_layout(tmp_path):
    assert run_dir(tmp_path, "c1", "face-hurt", "20261122_010203") == tmp_path / "c1" / "face-hurt" / "20261122_010203"


def test_run_paths_filters_by_char_and_kind_on_new_layout(runs_new):
    assert [p.name for p in run_paths(runs_new, char="c1", kind="face")] == ["c1_face_7.png"]
    assert [p.name for p in run_paths(runs_new, run_id="20261121_090000")] == ["c1_face_7.png", "c2_face_8.png"]
    assert [p.name for p in run_paths(runs_new)] == ["c1_fullbody_5.png"]
    assert [p.name for p in run_paths(runs_new, char="c1", kind="face", run_id="20261120_090000")] == ["c1_face_1.png"]


def test_run_paths_error_lists_what_exists(runs_new):
    with pytest.raises(ConfigError, match=r"候補が無い.*c1.*c2"):
        run_paths(runs_new, char="c9")
    with pytest.raises(ConfigError, match=r"候補が無い.*face.*fullbody"):
        run_paths(runs_new, char="c1", kind="nope")


def test_legacy_layout_still_readable(runs):
    assert [p.name for p in run_paths(runs, run_id="20261121_090000")] == ["c1_face_7.png", "c2_face_8.png"]
    assert find_candidate(runs, "c1_face_1.png").name == "c1_face_1.png"
    with pytest.raises(ConfigError, match="候補が無い") as e:
        run_paths(runs, char="c1")
    assert 'run_id="<日時>"' in str(e.value)
    assert "古い日時: 20261121_090000・20261120_090000" in str(e.value)


def test_legacy_hint_lists_only_newest_three(tmp_path):
    for d in ("20261101_000000", "20261102_000000", "20261103_000000", "20261104_000000"):
        _run(tmp_path, d, [("c1_face_1.png", 1)])
    with pytest.raises(ConfigError, match="候補が無い") as e:
        run_paths(tmp_path, char="c1", kind="face")
    assert "古い日時: 20261104_000000・20261103_000000・20261102_000000）" in str(e.value)


def test_new_layout_only_has_no_legacy_hint(runs_new):
    with pytest.raises(ConfigError, match="候補が無い") as e:
        run_paths(runs_new, char="zz")
    assert "古い" not in str(e.value)


def test_missing_run_id_lists_existing_dates_newest_first(runs):
    with pytest.raises(ConfigError, match="run が無い: 20250101_000000") as e:
        run_paths(runs, run_id="20250101_000000")
    assert "ある日時: 20261121_090000・20261120_090000" in str(e.value)


def test_mixed_layouts_same_run_id_returns_both(runs_new):
    _run(runs_new, "20261121_090000", [("c3_face_9.png", 9)])
    assert {p.name for p in run_paths(runs_new, run_id="20261121_090000")} == {"c1_face_7.png", "c2_face_8.png", "c3_face_9.png"}


def test_mixed_layouts_seed_and_name_lookup_in_old_run(runs_new):
    _run(runs_new, "20261122_090000", [("c3_face_9.png", 9)])
    assert find_candidate(runs_new, 9, run_id="20261122_090000").name == "c3_face_9.png"
    assert find_candidate(runs_new, "c3_face_9.png").parent.name == "20261122_090000"
    assert find_candidate(runs_new, "c3_face_9.png", run_id="20261122_090000").name == "c3_face_9.png"


def test_stray_entries_under_runs_are_ignored(runs_new):
    (runs_new / ".ipynb_checkpoints").mkdir()
    (runs_new / "note.txt").write_text("x")
    (runs_new / "c1" / "face" / "not-a-run").mkdir()
    (runs_new / "c1" / "face" / "20261130_000000.txt").write_text("x")  # 日時風の名前のファイル
    (runs_new / "c1" / "fullbody" / "20261130_000000").write_text("x")  # 日時そのものの名前のファイル
    assert run_ids(runs_new) == ["20261120_090000", "20261121_090000", "20261121_100000"]
    assert [p.name for p in run_paths(runs_new)] == ["c1_fullbody_5.png"]


def test_find_candidate_walks_new_layout(runs_new):
    assert find_candidate(runs_new, "c2_face_8.png").parent.parent.parent.name == "c2"
    assert find_candidate(runs_new, 5).name == "c1_fullbody_5.png"
    with pytest.raises(ConfigError, match="見つからない"):
        find_candidate(runs_new, "nope.png")


def test_first_adopt_interrupt_after_publish_removes_the_new_face(store, candidate, monkeypatch):
    # 採用前の状態は「顔が無い」。公開の直後に中断しても、新しい顔を残さない
    real_replace = os.replace

    def replace_then_interrupt(src, dst, *a, **k):
        real_replace(src, dst, *a, **k)
        if os.path.basename(dst) == "face.png":
            raise KeyboardInterrupt

    monkeypatch.setattr("artgen.selection.os.replace", replace_then_interrupt)
    with pytest.raises(KeyboardInterrupt):
        store.adopt(candidate)
    monkeypatch.undo()
    assert not (store.selected_dir / "c1" / "face.png").exists()
    assert [p.name for p in (store.selected_dir / "c1").iterdir()] == []


def test_adopt_succeeds_with_warning_when_only_backup_removal_fails(
    store, candidate, half_red_candidate, monkeypatch
):
    store.adopt(candidate)
    real_unlink = type(candidate).unlink

    def unlink(self, *a, **k):
        if self.name.startswith(".face.png.old"):
            raise OSError("busy")
        return real_unlink(self, *a, **k)

    monkeypatch.setattr(type(candidate), "unlink", unlink)
    dest = store.adopt(half_red_candidate)  # 採用はできている。例外にしない
    monkeypatch.undo()
    assert dest == store.selected_dir / "c1" / "face.png"
    assert read_params(dest)["seed"] == 9
    assert any(".face.png.old" in w and "busy" in w for w in store.last_warnings)
    # 次の採用では警告が残らない
    store.adopt(candidate)
    assert store.last_warnings == []


def test_pack_called_twice_in_the_same_second_keeps_both(store, candidate):
    store.adopt(candidate)
    now = lambda: datetime(2026, 11, 22, 10, 0, 0)  # noqa: E731
    first = store.pack(now=now)
    first_bytes = first.read_bytes()
    second = store.pack(now=now)
    assert first == store.packs_dir / "selected_20261122_100000.zip"
    assert second != first and second.is_file()
    assert first.read_bytes() == first_bytes
    assert sorted(p.name for p in store.packs_dir.iterdir()) == sorted([first.name, second.name])


def test_pack_failure_leaves_no_partial_zip(store, candidate, monkeypatch):
    store.adopt(candidate)
    now = lambda: datetime(2026, 11, 22, 10, 0, 0)  # noqa: E731
    first = store.pack(now=now)
    first_bytes = first.read_bytes()

    def boom(self, *a, **k):
        raise OSError("disk full")

    monkeypatch.setattr(zipfile.ZipFile, "write", boom)
    with pytest.raises(OSError, match="disk full"):
        store.pack(now=now)
    monkeypatch.undo()
    assert [p.name for p in store.packs_dir.iterdir()] == [first.name]
    assert first.read_bytes() == first_bytes


def test_first_adopt_interrupt_restores_box_even_when_removing_new_face_fails(store, candidate, monkeypatch):
    # 顔が未採用でも範囲（selection.json）はある。顔の削除が失敗しても、範囲は元の場所へ戻す
    store.save_box("c1", (1, 2, 300, 400))
    d = store.selected_dir / "c1"
    real_replace = os.replace
    real_unlink = type(candidate).unlink

    def replace_then_interrupt(src, dst, *a, **k):
        real_replace(src, dst, *a, **k)
        if os.path.basename(dst) == "face.png":
            raise KeyboardInterrupt

    def unlink(self, *a, **k):
        if self.name == "face.png":
            raise OSError("busy")
        return real_unlink(self, *a, **k)

    monkeypatch.setattr("artgen.selection.os.replace", replace_then_interrupt)
    monkeypatch.setattr(type(candidate), "unlink", unlink)
    with pytest.raises(KeyboardInterrupt) as info:
        store.adopt(candidate)
    monkeypatch.undo()
    assert (d / "selection.json").is_file()
    assert any("face.png" in n and "busy" in n for n in info.value.__notes__)
