import re

from artgen.review_page import build_page
from artgen.rounds import new_round, read_round
from cloud_helpers import make_candidates, make_forge
from test_forge import forge, pipe, repo, write  # noqa: F401  (fixtures)


def make_round(repo):
    paths = make_candidates(repo)
    return read_round(new_round(repo / "local" / "rounds", "20261123_120000", paths))


def test_page_lists_every_candidate_in_number_order_without_folding(repo, tmp_path):
    html = build_page(make_round(repo), tmp_path / "p.html").read_text(encoding="utf-8")
    assert "<details" not in html
    assert html.index("1 番") < html.index("2 番") < html.index("3 番")


def test_page_shows_seed_and_tag_changes(repo, tmp_path):
    p = make_forge(repo).generate("c1", "face", seeds=[77], extra="upper body", remove="portrait")[0]
    r = read_round(new_round(repo / "local" / "rounds", "r2", [p]))
    html = build_page(r, tmp_path / "p.html").read_text(encoding="utf-8")
    assert "77" in html and "upper body" in html and "portrait" in html and p.name in html


def test_page_embeds_small_images_and_title(repo, tmp_path):
    out = build_page(make_round(repo), tmp_path / "p.html")
    html = out.read_text(encoding="utf-8")
    assert "<title>候補 c1 20261123_120000</title>" in html
    assert len(re.findall(r"data:image/jpeg;base64,", html)) == 3
    assert out.stat().st_size < 2_000_000
    assert "prefers-color-scheme: dark" in html and 'name="viewport"' in html


def test_page_groups_candidates_by_character_with_name(repo, tmp_path):
    forge = make_forge(repo)
    c1 = forge.generate("c1", "face", seeds=[1, 2])
    c2 = forge.generate("c2", "face", seeds=[3])
    r = read_round(new_round(repo / "local" / "rounds", "r3", [*c1, *c2]))
    html = build_page(r, tmp_path / "p.html", root=repo).read_text(encoding="utf-8")
    assert html.count("<h2") == 2
    assert "C（c1）" in html and "C（c2）" in html
    assert html.index("（c1）") < html.index("1 番") < html.index("2 番") < html.index("（c2）") < html.index("3 番")
    assert "<details" not in html


def test_page_thumbnails_are_jpeg_and_small(repo, tmp_path):
    html = build_page(make_round(repo), tmp_path / "p.html").read_text(encoding="utf-8")
    assert len(re.findall(r"data:image/jpeg;base64,", html)) == 3
    assert "data:image/png" not in html
    for uri in re.findall(r'src="(data:image/jpeg;base64,[^"]+)"', html):
        assert len(uri) < 80_000


def test_page_heading_falls_back_to_id_without_root(repo, tmp_path):
    html = build_page(make_round(repo), tmp_path / "p.html").read_text(encoding="utf-8")
    assert "<h2>c1</h2>" in html


def test_page_shows_matted_thumbnail_next_to_each_candidate(repo, tmp_path):
    from PIL import Image

    from artgen.matte import candidate_matte_path

    r = make_round(repo)
    for c in r.candidates:
        Image.new("L", Image.open(c.path).size, 0).save(candidate_matte_path(c.path))  # 全部背景
    html = build_page(r, tmp_path / "p.html").read_text(encoding="utf-8")
    uris = re.findall(r'src="(data:image/jpeg;base64,[^"]+)"', html)
    assert len(uris) == 6  # 候補そのものと、背景を消した絵
    assert html.count('class="cut"') == 3
    assert "背景を消した" in html
    for uri in uris:
        assert len(uri) < 50_000  # 2 枚ずつでも 200 枚で 16MB に収まる大きさ


def test_page_without_mattes_is_unchanged(repo, tmp_path):
    html = build_page(make_round(repo), tmp_path / "p.html").read_text(encoding="utf-8")
    assert 'class="cut"' not in html
