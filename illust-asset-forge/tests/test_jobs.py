import json
import re
from pathlib import Path

import pytest
from PIL import Image

from artgen.config import ConfigError
from artgen.forge import Forge
from artgen.jobs import GenerateJob, collect_faces, load_jobs, run_jobs
from artgen.pnginfo import read_params, save_png
from test_forge import ENV, FakePipe, forge, pipe, repo, write  # noqa: F401  (fixtures)

T4_ENV = {**ENV, "gpu": "Tesla T4"}


def write_jobs(tmp_path, entries):
    path = tmp_path / "jobs.json"
    path.write_text(json.dumps(entries), encoding="utf-8")
    return path


def read_params_bytes(data, tmp_path):
    path = tmp_path / "from_bytes.png"
    path.write_bytes(data)
    return read_params(path)


def test_load_jobs_reads_all_fields(repo, tmp_path):
    f = write_jobs(tmp_path, [{
        "char": "c1", "template": "face", "seeds": [1, 2], "extra": "upper body",
        "remove": "portrait", "remove_negative": "upper body",
    }])
    assert load_jobs(f, repo) == [GenerateJob(
        "c1", "face", seeds=[1, 2], extra="upper body", remove="portrait", remove_negative="upper body",
    )]


@pytest.mark.parametrize("entry, where", [
    ({"char": "nope", "template": "face", "n": 1}, "[0].char"),
    ({"char": "c1", "template": "face"}, "[0].n"),
    ({"char": "c1", "template": "face", "n": 1, "seeds": [1]}, "[0].n"),
    ({"char": "c1", "template": "face", "n": 1, "style": "s"}, "[0].style"),
    ({"char": "c1", "template": "nope", "n": 1}, "[0].template"),
])
def test_load_jobs_errors_name_the_key(repo, tmp_path, entry, where):
    with pytest.raises(ConfigError, match=re.escape(where)):
        load_jobs(write_jobs(tmp_path, [entry]), repo)


def test_load_jobs_error_names_the_file_and_job_index(repo, tmp_path):
    ok = {"char": "c1", "template": "face", "n": 1}
    with pytest.raises(ConfigError, match=r"jobs\.json: \[1\]\.char"):
        load_jobs(write_jobs(tmp_path, [ok, {"char": "nope", "template": "face", "n": 1}]), repo)


def test_load_jobs_rejects_non_array_and_bad_json(repo, tmp_path):
    with pytest.raises(ConfigError, match="jobs.json"):
        load_jobs(write_jobs(tmp_path, {"char": "c1"}), repo)
    bad = tmp_path / "bad.json"
    bad.write_text("{", encoding="utf-8")
    with pytest.raises(ConfigError, match="bad.json"):
        load_jobs(bad, repo)


def test_collect_faces_only_for_non_face_jobs(tmp_path):
    for c in ("c1", "c2"):
        (tmp_path / c).mkdir()
        (tmp_path / c / "face.png").write_bytes(b"face-" + c.encode())
    jobs = [GenerateJob("c1", "fullbody", n=1), GenerateJob("c2", "face", n=1), GenerateJob("c3", "fullbody", n=1)]
    assert collect_faces(tmp_path, jobs) == {"c1": b"face-c1"}


def test_run_jobs_returns_relative_pngs_with_commit(repo, tmp_path):
    forge = Forge(FakePipe(), repo, tmp_path / "runs", make_generator=lambda s: s, env=dict(T4_ENV))
    out = run_jobs(
        forge,
        [GenerateJob("c1", "face", seeds=[7]), GenerateJob("c1", "face", seeds=[8], extra="upper body")],
        "abc1234+dirty", {},
    )
    assert [Path(p).name for p, _ in out] == ["c1_face_7.png", "c1_face_8.png"]
    assert not Path(out[0][0]).is_absolute()
    assert (tmp_path / "runs" / out[0][0]).is_file()
    params = read_params_bytes(out[1][1], tmp_path)
    assert params["commit"] == "abc1234+dirty"
    assert params["overrides"]["extra"] == ["upper body"]


def test_run_jobs_refuses_other_gpu(repo, tmp_path):
    pipe = FakePipe()
    forge = Forge(pipe, repo, tmp_path / "runs", make_generator=lambda s: s, env={**ENV, "gpu": "NVIDIA L4"})
    with pytest.raises(RuntimeError, match="Tesla T4"):
        run_jobs(forge, [GenerateJob("c1", "face", n=1)], "abc", {})
    assert pipe.calls == []


def test_run_jobs_places_faces_for_style_inheritance(repo, tmp_path):
    face = tmp_path / "t_face.png"
    save_png(Image.new("RGB", (8, 8)), face, {"style": "t", "character": "c1", "template": "face"})
    forge = Forge(FakePipe(), repo, tmp_path / "runs", make_generator=lambda s: s, env=dict(T4_ENV))
    out = run_jobs(forge, [GenerateJob("c1", "fullbody", seeds=[3])], "abc", {"c1": face.read_bytes()})
    assert read_params_bytes(out[0][1], tmp_path)["style"] == "t"
