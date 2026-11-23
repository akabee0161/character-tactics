import json

from artgen.rounds import new_round, read_round
from artgen.screen import REASON_HEAD_CUT
from cloud_helpers import make_candidates
from test_forge import forge, pipe, repo, write  # noqa: F401  (fixtures)


def test_new_round_numbers_in_order_and_screens_faces(repo):
    paths = make_candidates(repo)
    rounds = repo / "local" / "rounds"
    r = read_round(new_round(rounds, "20261123_120000", paths))
    assert r.run_id == "20261123_120000"
    assert [c.number for c in r.candidates] == [1, 2, 3]
    assert [c.path for c in r.candidates] == paths
    assert r.candidates[0].reasons == []
    assert r.candidates[1].reasons == [REASON_HEAD_CUT]
    assert r.candidates[2].reasons == []  # 全身は外さない


def test_round_json_keeps_paths_relative_to_local(repo):
    paths = make_candidates(repo)
    path = new_round(repo / "local" / "rounds", "r1", paths)
    data = json.loads(path.read_text(encoding="utf-8"))
    assert not data["candidates"][0]["path"].startswith("/")
    assert data["candidates"][0]["path"].startswith("runs/c1/face/")
