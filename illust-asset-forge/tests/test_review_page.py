import re

from artgen.review_page import build_page
from artgen.rounds import new_round, read_round
from artgen.screen import REASON_HEAD_CUT
from cloud_helpers import make_candidates
from test_forge import forge, pipe, repo, write  # noqa: F401  (fixtures)


def make_round(repo):
    paths = make_candidates(repo)
    return read_round(new_round(repo / "local" / "rounds", "20261123_120000", paths))


def test_page_lists_kept_first_and_excluded_folded(repo, tmp_path):
    html = build_page(make_round(repo), tmp_path / "p.html").read_text(encoding="utf-8")
    assert html.index("1 番") < html.index("<details")
    assert html.index("3 番") < html.index("<details")
    assert html.index("2 番") > html.index("<details")
    assert REASON_HEAD_CUT in html


def test_page_shows_seed_and_tag_changes(repo, tmp_path):
    from cloud_helpers import make_forge

    forge_ = make_forge(repo)
    p = forge_.generate("c1", "face", seeds=[77], extra="upper body", remove="portrait")[0]
    r = read_round(new_round(repo / "local" / "rounds", "r2", [p]))
    html = build_page(r, tmp_path / "p.html").read_text(encoding="utf-8")
    assert "77" in html and "upper body" in html and "portrait" in html and p.name in html


def test_page_embeds_small_images_and_title(repo, tmp_path):
    out = build_page(make_round(repo), tmp_path / "p.html")
    html = out.read_text(encoding="utf-8")
    assert "<title>候補 c1 20261123_120000</title>" in html
    assert len(re.findall(r"data:image/png;base64,", html)) == 3
    assert out.stat().st_size < 2_000_000
    assert "prefers-color-scheme: dark" in html and 'name="viewport"' in html
