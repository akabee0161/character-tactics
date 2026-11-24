import io
import json

import pytest
from PIL import Image

from artgen.export import ExportError
from artgen.matte import MODEL_SHA256, load_matte, save_mattes
from test_export import CROPPED_YAML, cropped_repo, put, repo, write  # noqa: F401


def png_bytes(image):
    buf = io.BytesIO()
    image.save(buf, format="PNG")
    return buf.getvalue()


def test_save_and_load_roundtrip(cropped_repo):
    mask = Image.new("L", (1024, 1024), 200)
    save_mattes(cropped_repo, "c1", {"face.png": png_bytes(mask)}, MODEL_SHA256)
    assert (cropped_repo / "characters/c1/matte/face.png").is_file()
    record = json.loads((cropped_repo / "characters/c1/matte/matte.json").read_text(encoding="utf-8"))
    assert record["model_sha256"] == MODEL_SHA256 and list(record["sources"]) == ["face.png"]
    loaded = load_matte(cropped_repo, "c1", "face.png")
    assert loaded.mode == "L" and loaded.size == (1024, 1024) and loaded.getpixel((5, 5)) == 200


def test_load_missing_matte_stops(cropped_repo):
    with pytest.raises(ExportError, match="cloud matte c1"):
        load_matte(cropped_repo, "c1", "face.png")


def test_load_stale_matte_stops(cropped_repo):
    save_mattes(cropped_repo, "c1", {"face.png": png_bytes(Image.new("L", (1024, 1024), 255))}, MODEL_SHA256)
    put(cropped_repo, "face.png", (1024, 1024), "face", seed=99)  # 元画像を入れ替えた
    with pytest.raises(ExportError, match="古い"):
        load_matte(cropped_repo, "c1", "face.png")


def test_save_rejects_other_model(cropped_repo):
    with pytest.raises(ExportError, match="モデル"):
        save_mattes(cropped_repo, "c1", {"face.png": png_bytes(Image.new("L", (1024, 1024)))}, "0" * 64)


def test_save_rejects_mask_of_wrong_size(cropped_repo):
    with pytest.raises(ExportError, match="大きさ"):
        save_mattes(cropped_repo, "c1", {"face.png": png_bytes(Image.new("L", (512, 512)))}, MODEL_SHA256)
    assert not (cropped_repo / "characters/c1/matte").exists()
