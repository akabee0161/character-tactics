from pathlib import Path

import pytest
import yaml

from artgen.config import load_character, load_default_style, load_style, load_template
from artgen.mask import check_box, check_feather
from artgen.prompt import build_prompt

ROOT = Path(__file__).resolve().parent.parent
CHARACTER_IDS = sorted(p.parent.name for p in (ROOT / "characters").glob("*/character.yaml"))


def test_there_is_at_least_one_character():
    assert CHARACTER_IDS


@pytest.mark.parametrize("char_id", CHARACTER_IDS)
def test_all_characters_build_for_every_template_and_expression(char_id):
    character = load_character(ROOT, char_id)
    style = load_style(ROOT, character.style)
    for template_name in ("face", "fullbody"):
        template = load_template(ROOT, template_name)
        for expression in character.expressions:
            prompt = build_prompt(style, template, character, expression=expression)
            assert prompt.positive
            assert prompt.negative


def test_face_template_matches_spec():
    face = load_template(ROOT, "face")
    assert (face.width, face.height) == (1024, 1024)
    assert face.export_size == 256
    assert face.inpaint_strength is not None and face.inpaint_feather is not None
    fullbody = load_template(ROOT, "fullbody")
    assert (fullbody.width, fullbody.height) == (832, 1216)
    assert fullbody.export_size is None
    assert fullbody.use_items is True


def test_face_template_is_upper_body_bust():
    face = load_template(ROOT, "face")
    assert "upper body" in face.prompt and "portrait" not in face.prompt
    assert "upper body" not in face.negative and "cropped head" in face.negative
    assert "looking to the side" in face.prompt
    assert face.inpaint_box is not None
    check_box(face.inpaint_box, (face.width, face.height))
    check_feather(face.inpaint_box, face.inpaint_feather)


def test_default_style_exists():
    assert load_default_style(ROOT) == "thick-line-flat"
    load_style(ROOT, load_default_style(ROOT))


@pytest.mark.parametrize("char_id", CHARACTER_IDS)
def test_characters_follow_default_style(char_id):
    data = yaml.safe_load((ROOT / "characters" / char_id / "character.yaml").read_text(encoding="utf-8"))
    assert "style" not in data


def test_style_candidates_exist():
    names = sorted(p.stem for p in (ROOT / "styles").glob("*.yaml"))
    assert names == ["color-anime", "retro-anime", "soft-cel", "soft-painterly", "thick-line-flat", "watercolor"]
    for name in names:
        load_style(ROOT, name)


SAMPLE_IDS = ["knight", "mage", "schoolboy", "schoolgirl"]


def test_sample_characters_are_included():
    # このゲーム専用のコピーなので、見本 4 人のほかにゲームのキャラクターがいてよい
    assert set(SAMPLE_IDS) <= set(CHARACTER_IDS)


def test_no_trial_style_names():
    styles = sorted(p.stem for p in (ROOT / "styles").glob("*.yaml"))
    assert not [s for s in styles if s.startswith("tlf-")]


@pytest.mark.parametrize("char_id", SAMPLE_IDS)  # 見本だけ。コピーした先で足す作品のキャラクターには当てはめない
def test_samples_have_no_style_or_inpaint_box(char_id):
    data = yaml.safe_load((ROOT / "characters" / char_id / "character.yaml").read_text(encoding="utf-8"))
    assert "style" not in data and "inpaint_box" not in data
    assert set(data["expressions"]) == {"normal", "hurt", "shout"}


def test_matte_image_installs_pinned_dependencies():
    text = (ROOT / "src/artgen/modal_app.py").read_text(encoding="utf-8")
    block = text[text.index("matte_image"):text.index("@app.function(image=matte_image")]
    for pin in ("PyYAML==", "Pillow==", "huggingface_hub==", "onnxruntime==", "numpy=="):
        assert pin in block, pin
