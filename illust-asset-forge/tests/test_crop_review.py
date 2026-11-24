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


def test_review_rejects_stale_export(exported_repo):
    # 範囲を直したのに export を忘れたとき、古い画像を承認用に出さない
    write(exported_repo, "characters/c1/character.yaml", CROPPED_YAML.replace("[0, 0, 600, 600]", "[0, 0, 500, 500]"))
    with pytest.raises(ExportError, match="export"):
        build_review(exported_repo, "c1")


def test_review_rejects_replaced_source(exported_repo):
    # 元画像を入れ替えたのに export を忘れたとき、古い書き出しを承認用に出さない
    put(exported_repo, "face.png", (1024, 1024), "face", seed=99)
    Image.new("RGB", (1024, 1024), (200, 10, 10)).save(exported_repo / "characters/c1/source/face.png")
    with pytest.raises(ExportError, match="export"):
        build_review(exported_repo, "c1")


def test_review_requires_export_record(exported_repo):
    (exported_repo / "characters/c1/params.json").unlink()
    with pytest.raises(ExportError, match="export"):
        build_review(exported_repo, "c1")


@pytest.fixture
def two_exported(cropped_repo):
    import shutil

    write(cropped_repo, "characters/c2/character.yaml", CROPPED_YAML.replace("name: C\n", "name: D\n"))
    (cropped_repo / "characters/c2/source").mkdir(parents=True)
    shutil.copy2(cropped_repo / "characters/c1/source/face.png", cropped_repo / "characters/c2/source/face.png")
    export_character(cropped_repo, "c1")
    export_character(cropped_repo, "c2")
    return cropped_repo


def test_reviews_one_section_per_character(two_exported):
    from artgen.crop_review import build_reviews

    out = build_reviews(two_exported, ["c1", "c2"], two_exported / "local/check/reviews/t.html")
    html = out.read_text(encoding="utf-8")
    assert html.count("<section") == 2 and "C（c1）" in html and "D（c2）" in html
    assert html.count("data:image/jpeg;base64,") == 8  # 1 人 4 枚（枠あり・枠なし・確認図 2）
    assert html.count("data:image/png;base64,") == 6  # 1 人 3 枚（64・40・32、書き出した PNG）
    assert html.count("[0, 0, 600, 600]") == 2  # 範囲の座標も節ごと


def test_reviews_default_path_is_under_check_reviews(two_exported):
    from artgen.crop_review import build_reviews

    out = build_reviews(two_exported, ["c1", "c2"])
    assert out.parent == two_exported / "local/check/reviews" and out.suffix == ".html"


def test_reviews_stop_if_any_export_is_stale(two_exported):
    from artgen.crop_review import build_reviews

    write(two_exported, "characters/c2/character.yaml", CROPPED_YAML.replace("[0, 0, 600, 600]", "[0, 0, 500, 500]"))
    with pytest.raises(ExportError, match="c2"):
        build_reviews(two_exported, ["c1", "c2"], two_exported / "local/check/reviews/t.html")
    assert not (two_exported / "local/check/reviews/t.html").exists()


def test_reviews_are_small_enough(two_exported):
    from artgen.crop_review import build_reviews

    noisy = Image.effect_noise((1024, 1024), 80).convert("RGB")  # 縮めにくい絵で大きさを見る
    for c in ("c1", "c2"):
        from artgen.pnginfo import read_params, save_png

        p = two_exported / f"characters/{c}/source/face.png"
        save_png(noisy, p, read_params(p))
        export_character(two_exported, c)
    out = build_reviews(two_exported, ["c1", "c2"], two_exported / "local/check/reviews/t.html")
    assert out.stat().st_size < 2 * 900_000  # 17 人で 16MB に収まる目安


def test_cli_single_id_keeps_old_page(exported_repo, capsys):
    from artgen.crop_review import main

    assert main(["c1", "--root", str(exported_repo)]) == 0
    assert (exported_repo / "local/check/c1/review.html").is_file()


def test_cli_many_ids_writes_one_page(two_exported, capsys):
    from artgen.crop_review import main

    out = two_exported / "local/check/reviews/x.html"
    assert main(["c1", "c2", "--root", str(two_exported), "--out", str(out)]) == 0
    assert out.is_file() and str(out) in capsys.readouterr().out


def test_review_rejects_export_older_than_matte(cropped_repo):
    import io

    from artgen.matte import MODEL_SHA256, save_mattes

    write(cropped_repo, "characters/c1/character.yaml", CROPPED_YAML + "  matte: true\n")

    def save(value):
        buf = io.BytesIO()
        Image.new("L", (1024, 1024), value).save(buf, format="PNG")
        save_mattes(cropped_repo, "c1", {"face.png": buf.getvalue()}, MODEL_SHA256)

    save(255)
    export_character(cropped_repo, "c1")
    build_review(cropped_repo, "c1")
    save(128)  # マスクを作り直したのに書き出していない
    with pytest.raises(ExportError, match="export"):
        build_review(cropped_repo, "c1")


def _matte_two(two_exported):
    import io

    from artgen.matte import MODEL_SHA256, save_mattes

    for c in ("c1", "c2"):
        write(two_exported, f"characters/{c}/character.yaml", CROPPED_YAML + "  matte: true\n")
        buf = io.BytesIO()
        Image.new("L", (1024, 1024), 255).save(buf, format="PNG")
        save_mattes(two_exported, c, {"face.png": buf.getvalue()}, MODEL_SHA256)
        export_character(two_exported, c)


def test_reviews_stop_if_only_erase_changed(two_exported):
    from artgen.crop_review import build_reviews

    _matte_two(two_exported)
    write(two_exported, "characters/c2/character.yaml",
          CROPPED_YAML + "  matte: true\n  erase:\n    - [[0, 0], [50, 0], [0, 50]]\n")
    out = two_exported / "local/check/reviews/t.html"
    with pytest.raises(ExportError, match="c2"):
        build_reviews(two_exported, ["c1", "c2"], out)
    assert not out.exists()


def test_reviews_stop_if_switched_to_matte_without_export(two_exported):
    import io

    from artgen.crop_review import build_reviews
    from artgen.matte import MODEL_SHA256, save_mattes

    buf = io.BytesIO()
    Image.new("L", (1024, 1024), 255).save(buf, format="PNG")
    save_mattes(two_exported, "c2", {"face.png": buf.getvalue()}, MODEL_SHA256)
    write(two_exported, "characters/c2/character.yaml", CROPPED_YAML + "  matte: true\n")
    out = two_exported / "local/check/reviews/t.html"
    with pytest.raises(ExportError, match="c2"):
        build_reviews(two_exported, ["c1", "c2"], out)
    assert not out.exists()
