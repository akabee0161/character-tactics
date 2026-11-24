import json
import sys
import types

import pytest

from artgen import cloud
from artgen.local import local_dirs
from artgen.rounds import new_round
from cloud_helpers import make_candidates, make_forge, paint_left_half_red
from test_forge import forge, pipe, repo, write  # noqa: F401  (fixtures)


@pytest.fixture
def cli_env(repo, monkeypatch):
    monkeypatch.chdir(repo)
    return repo


@pytest.fixture
def round_json(cli_env):
    return new_round(cli_env / "local" / "rounds", "20261123_120000", make_candidates(cli_env))


def test_adopt_by_number(cli_env, round_json, capsys):
    assert cloud.main(["adopt", str(round_json), "2"]) == 0
    out = capsys.readouterr().out
    assert out.startswith("採用した:") and "警告" not in out
    assert (cli_env / "local/selected/c1/face.png").is_file()


def test_adopt_flip_mirrors_the_face(cli_env, round_json):
    from PIL import Image, ImageChops

    original = next(local_dirs(cli_env).runs.glob("c1/face/*/c1_face_2.png"))
    paint_left_half_red(original)  # 左右が非対称の絵にする（単色だと、反転しなくても一致してしまう）
    assert cloud.main(["adopt", str(round_json), "2", "--flip"]) == 0
    adopted = Image.open(cli_env / "local/selected/c1/face.png").convert("RGB")
    source = Image.open(original).convert("RGB")
    mirrored = source.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
    assert ImageChops.difference(adopted, mirrored).getbbox() is None
    assert ImageChops.difference(adopted, source).getbbox() is not None  # 反転していない実装なら、ここで落ちる


def test_adopt_without_flip_keeps_the_original_orientation(cli_env, round_json):
    from PIL import Image, ImageChops

    original = next(local_dirs(cli_env).runs.glob("c1/face/*/c1_face_2.png"))
    paint_left_half_red(original)
    assert cloud.main(["adopt", str(round_json), "2"]) == 0
    adopted = Image.open(cli_env / "local/selected/c1/face.png").convert("RGB")
    assert ImageChops.difference(adopted, Image.open(original).convert("RGB")).getbbox() is None


@pytest.mark.parametrize("args, msg", [(["9"], "9"), (["3", "--flip"], "左右反転")])
def test_adopt_errors_are_one_line(cli_env, round_json, capsys, args, msg):
    assert cloud.main(["adopt", str(round_json), *args]) == 1
    out = capsys.readouterr().out
    assert out.startswith("止まった:") and msg in out and "Traceback" not in out
    assert not (cli_env / "local/selected").exists()


def test_install_only_named_characters(cli_env):
    forge_ = make_forge(cli_env)
    store = forge_.selected
    for char in ("c1", "c2"):
        store.adopt(forge_.generate(char, "face", seeds=[5])[0])
    assert cloud.main(["install", "c1"]) == 0
    assert (cli_env / "characters/c1/source/face.png").is_file()
    assert not (cli_env / "characters/c2/source").exists()


def test_install_missing_selection_is_one_line(cli_env, capsys):
    assert cloud.main(["install", "c1"]) == 1
    assert capsys.readouterr().out.startswith("止まった:")


def test_page_rebuilds_html(cli_env, round_json, capsys):
    assert cloud.main(["page", str(round_json), "--no-matte"]) == 0
    assert (cli_env / "local/rounds/20261123_120000.html").is_file()


def fake_modal(monkeypatch, outputs):
    calls = []
    module = types.ModuleType("artgen.modal_app")

    def run(jobs, commit, faces):
        calls.append((jobs, commit, faces))
        return outputs

    module.run = run
    monkeypatch.setitem(sys.modules, "artgen.modal_app", module)
    return calls


def test_generate_bad_job_file_stops_before_modal(cli_env, monkeypatch, capsys):
    calls = fake_modal(monkeypatch, [])
    jobs = cli_env / "jobs.json"
    jobs.write_text(json.dumps([{"char": "nope", "template": "face", "n": 1}]), encoding="utf-8")
    assert cloud.main(["generate", "--jobs", str(jobs)]) == 1
    out = capsys.readouterr().out
    assert out.startswith("止まった:") and "[0].char" in out
    assert calls == []


def test_generate_saves_outputs_and_builds_round_and_page(cli_env, monkeypatch, capsys):
    made = make_candidates(cli_env)
    outputs = [(p.relative_to(cli_env / "local/runs").as_posix(), p.read_bytes()) for p in made]
    for p in made:
        p.unlink()
    calls = fake_modal(monkeypatch, outputs)
    jobs = cli_env / "jobs.json"
    jobs.write_text(json.dumps([{"char": "c1", "template": "face", "n": 1}]), encoding="utf-8")
    assert cloud.main(["generate", "--jobs", str(jobs), "--no-matte"]) == 0
    assert len(calls) == 1 and calls[0][0][0].char == "c1" and calls[0][1]
    out = capsys.readouterr().out
    rounds = sorted((cli_env / "local/rounds").glob("*.json"))
    pages = sorted((cli_env / "local/rounds").glob("*.html"))
    assert len(rounds) == len(pages) == 1
    assert str(rounds[0]) in out or rounds[0].name in out
    assert all(p.is_file() for p in made)


def _write_source_fullbody(cli_env):
    forge_ = make_forge(cli_env)
    full = forge_.generate("c1", "fullbody", seeds=[9])[0]
    dest = cli_env / "characters/c1/source/fullbody.png"
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_bytes(full.read_bytes())
    return dest


def test_install_keeps_existing_fullbody_that_was_not_reselected(cli_env, capsys):
    forge_ = make_forge(cli_env)
    forge_.selected.adopt(forge_.generate("c1", "face", seeds=[5])[0])
    kept = _write_source_fullbody(cli_env)
    before = kept.read_bytes()
    assert cloud.main(["install", "c1"]) == 0
    assert (cli_env / "characters/c1/source/face.png").is_file()
    assert kept.read_bytes() == before
    assert "消した" not in capsys.readouterr().out


def test_install_replaces_fullbody_when_reselected(cli_env):
    forge_ = make_forge(cli_env)
    forge_.selected.adopt(forge_.generate("c1", "face", seeds=[5])[0])
    forge_.selected.adopt(forge_.generate("c1", "fullbody", seeds=[10])[0])
    old = _write_source_fullbody(cli_env)
    old_bytes = old.read_bytes()
    assert cloud.main(["install", "c1"]) == 0
    assert old.read_bytes() != old_bytes


def _two_rounds(cli_env):
    forge_ = make_forge(cli_env)
    rounds = cli_env / "local" / "rounds"
    a = [*forge_.generate("c1", "face", seeds=[1, 2, 3])]
    b = [*forge_.generate("c2", "face", seeds=[4, 5])]
    return new_round(rounds, "ra", a), new_round(rounds, "rb", b), a, b


def _merged(cli_env):
    found = sorted((cli_env / "local" / "rounds").glob("merged_*.json"))
    assert len(found) == 1
    return found[0]


def test_merge_renumbers_in_order_and_keeps_originals(cli_env, capsys):
    from artgen.rounds import read_round

    r1, r2, a, b = _two_rounds(cli_env)
    before = (r1.read_text(), r2.read_text())
    assert cloud.main(["merge", str(r1), str(r2), "--no-matte"]) == 0
    merged = _merged(cli_env)
    data = read_round(merged)
    assert [c.number for c in data.candidates] == [1, 2, 3, 4, 5]
    assert [c.path.resolve() for c in data.candidates] == [p.resolve() for p in [*a, *b]]
    assert merged.with_suffix(".html").is_file()
    assert (r1.read_text(), r2.read_text()) == before
    out = capsys.readouterr().out
    assert str(merged) in out and "候補のページ" in out


def test_merge_then_adopt_uses_merged_number(cli_env):
    r1, r2, _, b = _two_rounds(cli_env)
    assert cloud.main(["merge", str(r1), str(r2), "--no-matte"]) == 0
    assert cloud.main(["adopt", str(_merged(cli_env)), "4"]) == 0
    from artgen.pnginfo import read_params

    adopted = read_params(cli_env / "local/selected/c2/face.png")
    assert (adopted["character"], adopted["seed"]) == ("c2", 4)  # 2 つ目の記録の 1 番（b[0]）


def test_merge_missing_round_is_one_line(cli_env, capsys):
    assert cloud.main(["merge", "nope.json", "nope2.json"]) == 1
    out = capsys.readouterr().out
    assert out.startswith("止まった:") and out.count("\n") == 1


def test_merge_needs_two_rounds(cli_env, capsys):
    r1, _, _, _ = _two_rounds(cli_env)
    assert cloud.main(["merge", str(r1)]) == 1
    out = capsys.readouterr().out
    assert out.startswith("止まった:") and "2 つ以上" in out


def _source_face(cli_env, char):
    from PIL import Image

    from artgen.pnginfo import save_png

    save_png(Image.new("RGB", (64, 64), (10, 20, 30)), cli_env / f"characters/{char}/source/face.png",
             {"seed": 1, "template": "face", "character": char})


def fake_matte(monkeypatch, model_sha=None, size=(64, 64)):
    import io

    from PIL import Image

    from artgen.matte import MODEL_SHA256

    calls = []
    module = types.ModuleType("artgen.modal_app")

    def run_matte(images):
        calls.append(sorted(images))
        buf = io.BytesIO()
        Image.new("L", size, 255).save(buf, format="PNG")
        return model_sha or MODEL_SHA256, {k: buf.getvalue() for k in images}

    module.run_matte = run_matte
    monkeypatch.setitem(sys.modules, "artgen.modal_app", module)
    return calls


def test_matte_sends_only_named_characters_and_saves_masks(cli_env, monkeypatch, capsys):
    _source_face(cli_env, "c1")
    _source_face(cli_env, "c2")
    calls = fake_matte(monkeypatch)
    assert cloud.main(["matte", "c1"]) == 0
    assert calls == [["c1/face.png"]]
    assert (cli_env / "characters/c1/matte/face.png").is_file()
    assert not (cli_env / "characters/c2/matte").exists()
    assert "c1" in capsys.readouterr().out


def test_matte_without_source_stops_before_modal(cli_env, monkeypatch, capsys):
    calls = fake_matte(monkeypatch)
    assert cloud.main(["matte", "c1"]) == 1
    assert capsys.readouterr().out.startswith("止まった:") and calls == []


def test_matte_from_other_model_writes_nothing(cli_env, monkeypatch, capsys):
    _source_face(cli_env, "c1")
    fake_matte(monkeypatch, model_sha="0" * 64)
    assert cloud.main(["matte", "c1"]) == 1
    assert capsys.readouterr().out.startswith("止まった:")
    assert not (cli_env / "characters/c1/matte").exists()


def test_page_makes_candidate_mattes_before_building(cli_env, round_json, monkeypatch, capsys):
    from artgen.matte import candidate_matte_path
    from artgen.rounds import read_round

    calls = fake_matte(monkeypatch, size=(1024, 1024))
    assert cloud.main(["page", str(round_json)]) == 0
    assert len(calls) == 1
    for c in read_round(round_json).candidates:
        assert candidate_matte_path(c.path).is_file()
    assert 'class="cut"' in (cli_env / "local/rounds/20261123_120000.html").read_text(encoding="utf-8")


def test_page_no_matte_skips_modal(cli_env, round_json, monkeypatch):
    calls = fake_matte(monkeypatch)
    assert cloud.main(["page", str(round_json), "--no-matte"]) == 0
    assert calls == []


def test_generate_makes_candidate_mattes_by_default(cli_env, monkeypatch, capsys):
    import io

    from PIL import Image

    from artgen.matte import MODEL_SHA256, candidate_matte_path

    made = make_candidates(cli_env)
    outputs = [(p.relative_to(cli_env / "local/runs").as_posix(), p.read_bytes()) for p in made]
    for p in made:
        p.unlink()
    fake_modal(monkeypatch, outputs)
    sent = []

    def run_matte(images):
        sent.append(len(images))
        buf = io.BytesIO()
        Image.new("L", (8, 8), 255).save(buf, format="PNG")
        return MODEL_SHA256, {k: buf.getvalue() for k in images}

    sys.modules["artgen.modal_app"].run_matte = run_matte
    jobs = cli_env / "jobs.json"
    jobs.write_text(json.dumps([{"char": "c1", "template": "face", "n": 1}]), encoding="utf-8")
    assert cloud.main(["generate", "--jobs", str(jobs)]) == 0
    assert sent == [3] and all(candidate_matte_path(p).is_file() for p in made)
