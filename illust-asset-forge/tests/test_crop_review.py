import pytest
from PIL import Image

from artgen.crop_review import build_review
from artgen.export import ExportError, export_character
from test_export import CROPPED_YAML, cropped_repo, put, repo, write  # noqa: F401


@pytest.fixture
def exported_repo(cropped_repo):
    export_character(cropped_repo, "c1")
    return cropped_repo


def test_review_page_has_all_parts(exported_repo):
    path = build_review(exported_repo, "c1")
    assert path == exported_repo / "local/check/c1/review.html"
    html = path.read_text(encoding="utf-8")
    assert html.count("data:image/png;base64,") == 7  # 枠あり・枠なし・確認図 2・64・40・32
    assert 'width="64"' in html and 'width="40"' in html and 'width="32"' in html
    assert "#18222c" in html


def test_review_without_small_uses_large_for_small_frames(exported_repo):
    write(exported_repo, "characters/c1/character.yaml", CROPPED_YAML.replace("  small: [100, 100, 400, 400]\n", ""))
    export_character(exported_repo, "c1")
    html = build_review(exported_repo, "c1").read_text(encoding="utf-8")
    assert html.count("data:image/png;base64,") == 6  # 枠あり・枠なし・確認図・64・40・32
    assert 'width="40"' in html and 'width="32"' in html


def test_review_requires_face_crop(repo):
    put(repo, "face.png", (1024, 1024), "face")
    export_character(repo, "c1")
    with pytest.raises(ExportError, match="face_crop"):
        build_review(repo, "c1")


def test_review_requires_export(cropped_repo):
    with pytest.raises(ExportError, match="書き出し"):
        build_review(cropped_repo, "c1")
