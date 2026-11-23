import json

import pytest

from artgen.config import ConfigError
from artgen.rounds import new_round, read_round, unused_run_id
from cloud_helpers import make_candidates
from test_forge import forge, pipe, repo, write  # noqa: F401  (fixtures)


def test_new_round_numbers_in_order(repo):
    paths = make_candidates(repo)
    r = read_round(new_round(repo / "local" / "rounds", "20261123_120000", paths))
    assert r.run_id == "20261123_120000"
    assert [c.number for c in r.candidates] == [1, 2, 3]
    assert [c.path for c in r.candidates] == paths


def test_round_json_keeps_paths_relative_to_local_and_has_no_screening(repo):
    paths = make_candidates(repo)
    path = new_round(repo / "local" / "rounds", "r1", paths)
    data = json.loads(path.read_text(encoding="utf-8"))
    assert not data["candidates"][0]["path"].startswith("/")
    assert data["candidates"][0]["path"].startswith("runs/c1/face/")
    assert set(data["candidates"][0]) == {"number", "path"}  # 機械的に外さない（依頼者が全部見る）


def test_new_round_refuses_to_overwrite_an_existing_round(repo):
    paths = make_candidates(repo)
    rounds = repo / "local" / "rounds"
    first = new_round(rounds, "20261123_120000", paths)
    before = first.read_text(encoding="utf-8")
    with pytest.raises(ConfigError, match="20261123_120000"):
        new_round(rounds, "20261123_120000", paths[:1])
    assert first.read_text(encoding="utf-8") == before


def test_unused_run_id_adds_a_suffix_when_the_second_is_taken(repo):
    paths = make_candidates(repo)
    rounds = repo / "local" / "rounds"
    assert unused_run_id(rounds, "20261123_120000") == "20261123_120000"
    new_round(rounds, "20261123_120000", paths)
    assert unused_run_id(rounds, "20261123_120000") == "20261123_120000_2"
    new_round(rounds, "20261123_120000_2", paths)
    assert unused_run_id(rounds, "20261123_120000") == "20261123_120000_3"
