import re
from pathlib import Path

import pytest

from artgen.config import (
    ClearColor,
    ConfigError,
    FaceCrop,
    load_character,
    load_default_style,
    load_style,
    load_template,
)

CHARACTER_YAML = """\
name: 騎士
style: color-anime
subject: [1boy, solo]
appearance: [brown hair]
outfit: [armor]
default_expression: normal
expressions:
  normal: [serious]
  hurt: [pain]
inpaint_box: null
"""

TEMPLATE_YAML = """\
width: 1024
height: 1024
prompt: [portrait]
negative: [full body]
export_size: 256
"""


def write(root: Path, rel: str, text: str) -> None:
    path = root / rel
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8")


def write_character(root: Path, text: str = CHARACTER_YAML, char_id: str = "c1") -> None:
    write(root, f"characters/{char_id}/character.yaml", text)


def test_load_character_reads_all_fields(tmp_path):
    write_character(tmp_path)
    c = load_character(tmp_path, "c1")
    assert c.id == "c1"
    assert c.name == "騎士"
    assert c.style == "color-anime"
    assert c.subject == ["1boy", "solo"]
    assert c.appearance == ["brown hair"]
    assert c.outfit == ["armor"]
    assert c.default_expression == "normal"
    assert c.expressions["hurt"] == ["pain"]
    assert c.inpaint_box is None
    assert c.items == []
    assert c.negative == []


def test_load_character_reads_inpaint_box(tmp_path):
    write_character(tmp_path, CHARACTER_YAML.replace("inpaint_box: null", "inpaint_box: [1, 2, 30, 40]"))
    assert load_character(tmp_path, "c1").inpaint_box == (1, 2, 30, 40)


def test_load_template_defaults(tmp_path):
    write(tmp_path, "templates/face.yaml", TEMPLATE_YAML)
    t = load_template(tmp_path, "face")
    assert t.width == 1024 and t.height == 1024
    assert t.export_size == 256
    assert t.steps == 28
    assert t.guidance == 5
    assert t.use_items is False
    assert t.inpaint_strength is None
    assert t.inpaint_feather is None


def test_load_template_inpaint_and_null_export(tmp_path):
    write(
        tmp_path,
        "templates/face.yaml",
        TEMPLATE_YAML.replace("export_size: 256", "export_size: null")
        + "inpaint: {strength: 0.6, feather: 24}\nuse_items: true\n",
    )
    t = load_template(tmp_path, "face")
    assert t.export_size is None
    assert t.inpaint_strength == 0.6
    assert t.inpaint_feather == 24
    assert t.use_items is True


def test_load_style(tmp_path):
    write(tmp_path, "styles/s.yaml", "prompt: [masterpiece]\nnegative: [lowres]\n")
    s = load_style(tmp_path, "s")
    assert s.name == "s"
    assert s.prompt == ["masterpiece"]
    assert s.negative == ["lowres"]


def test_missing_file_names_path(tmp_path):
    with pytest.raises(ConfigError) as e:
        load_character(tmp_path, "nobody")
    assert "characters/nobody/character.yaml" in str(e.value)


def test_tags_must_be_list_of_strings(tmp_path):
    write_character(tmp_path, CHARACTER_YAML.replace("hurt: [pain]", 'hurt: "pain"'))
    with pytest.raises(ConfigError) as e:
        load_character(tmp_path, "c1")
    assert "expressions.hurt" in str(e.value)
    assert "characters/c1/character.yaml" in str(e.value)


def test_default_expression_must_exist(tmp_path):
    write_character(tmp_path, CHARACTER_YAML.replace("default_expression: normal", "default_expression: smile"))
    with pytest.raises(ConfigError) as e:
        load_character(tmp_path, "c1")
    msg = str(e.value)
    assert "default_expression" in msg
    assert "normal" in msg and "hurt" in msg


@pytest.mark.parametrize("box", ["[10, 10, 5, 20]", "[1, 2, 3]"])
def test_inpaint_box_shape(tmp_path, box):
    write_character(tmp_path, CHARACTER_YAML.replace("inpaint_box: null", f"inpaint_box: {box}"))
    with pytest.raises(ConfigError) as e:
        load_character(tmp_path, "c1")
    assert "inpaint_box" in str(e.value)


def test_missing_required_key(tmp_path):
    write_character(tmp_path, CHARACTER_YAML.replace("name: 騎士\n", ""))
    with pytest.raises(ConfigError) as e:
        load_character(tmp_path, "c1")
    assert "characters/c1/character.yaml: name: " in str(e.value)


NO_STYLE_YAML = CHARACTER_YAML.replace("style: color-anime\n", "")


def test_character_without_style_uses_default(tmp_path):
    write(tmp_path, "defaults.yaml", "style: flat\n")
    write_character(tmp_path, NO_STYLE_YAML)
    assert load_character(tmp_path, "c1").style == "flat"
    assert load_default_style(tmp_path) == "flat"


def test_character_style_overrides_default(tmp_path):
    write(tmp_path, "defaults.yaml", "style: flat\n")
    write_character(tmp_path)
    assert load_character(tmp_path, "c1").style == "color-anime"


def test_character_without_style_and_no_defaults_fails(tmp_path):
    write_character(tmp_path, NO_STYLE_YAML)
    with pytest.raises(ConfigError) as e:
        load_character(tmp_path, "c1")
    assert "defaults.yaml" in str(e.value) and "ファイルが無い" in str(e.value)


@pytest.mark.parametrize("text", ['style: ""\n', "style: [a]\n", "other: x\n"])
def test_defaults_style_must_be_string(tmp_path, text):
    write(tmp_path, "defaults.yaml", text)
    write_character(tmp_path, NO_STYLE_YAML)
    with pytest.raises(ConfigError) as e:
        load_character(tmp_path, "c1")
    assert str(e.value).startswith("defaults.yaml: style: ")


def test_character_style_null_is_rejected(tmp_path):
    write(tmp_path, "defaults.yaml", "style: flat\n")
    write_character(tmp_path, CHARACTER_YAML.replace("style: color-anime", "style: null"))
    with pytest.raises(ConfigError) as e:
        load_character(tmp_path, "c1")
    assert "characters/c1/character.yaml: style: " in str(e.value)


def test_invalid_yaml_and_non_mapping(tmp_path):
    write_character(tmp_path, "- just\n- a list\n")
    with pytest.raises(ConfigError):
        load_character(tmp_path, "c1")
    write_character(tmp_path, "name: [unclosed\n")
    with pytest.raises(ConfigError):
        load_character(tmp_path, "c1")


def test_template_size_must_be_positive_int(tmp_path):
    write(tmp_path, "templates/face.yaml", TEMPLATE_YAML.replace("width: 1024", "width: wide"))
    with pytest.raises(ConfigError) as e:
        load_template(tmp_path, "face")
    assert "width" in str(e.value)


def test_unbalanced_parens_in_tag_is_rejected_with_quoting_hint(tmp_path):
    # YAML の flow list では、カンマを含む重み付きタグが黙って割れる
    write_character(tmp_path, CHARACTER_YAML.replace("appearance: [brown hair]", "appearance: [(a, b:1.1)]"))
    with pytest.raises(ConfigError) as e:
        load_character(tmp_path, "c1")
    assert "appearance" in str(e.value) and "カッコ" in str(e.value) and "引用符" in str(e.value)


def test_quoted_weighted_tag_with_comma_is_accepted(tmp_path):
    write_character(tmp_path, CHARACTER_YAML.replace("appearance: [brown hair]", 'appearance: ["(a, b:1.1)"]'))
    assert load_character(tmp_path, "c1").appearance == ["(a, b:1.1)"]


def test_template_reads_inpaint_box(tmp_path):
    write(tmp_path, "templates/face.yaml",
          "width: 1024\nheight: 1024\nprompt: [p]\nnegative: []\n"
          "inpaint: {strength: 0.6, feather: 24, box: [300, 200, 700, 600]}\n")
    assert load_template(tmp_path, "face").inpaint_box == (300, 200, 700, 600)


@pytest.mark.parametrize("box", ["[1, 2, 3]", "[5, 5, 5, 9]", "[-1, 0, 10, 10]", "[0, 0, 1.5, 9]"])
def test_template_rejects_bad_inpaint_box(tmp_path, box):
    write(tmp_path, "templates/face.yaml",
          f"width: 1024\nheight: 1024\nprompt: [p]\nnegative: []\n"
          f"inpaint: {{strength: 0.6, feather: 24, box: {box}}}\n")
    with pytest.raises(ConfigError, match=r"templates/face.yaml: inpaint.box: "):
        load_template(tmp_path, "face")


# --- その場の画風（inline_style） ---------------------------------------


def test_inline_style_builds_style():
    from artgen.config import Style, inline_style

    s = inline_style({"name": "my-style_2", "prompt": ["flat color"], "negative": []})
    assert s == Style(name="my-style_2", prompt=["flat color"], negative=[])


def test_inline_style_negative_defaults_to_empty():
    from artgen.config import inline_style

    assert inline_style({"name": "a", "prompt": ["x"]}).negative == []


@pytest.mark.parametrize(
    "value, match",
    [
        ("soft", "辞書"),
        ({"prompt": ["x"]}, "name"),
        ({"name": "", "prompt": ["x"]}, "name"),
        ({"name": 3, "prompt": ["x"]}, "name"),
        ({"name": "a/b", "prompt": ["x"]}, "name"),
        ({"name": "..", "prompt": ["x"]}, "name"),
        ({"name": ".hid", "prompt": ["x"]}, "name"),
        ({"name": "あ", "prompt": ["x"]}, "name"),
        ({"name": "a", "prompt": []}, "prompt"),
        ({"name": "a"}, "prompt"),
        ({"name": "a", "prompt": ["x", ""]}, "prompt"),
        ({"name": "a", "prompt": ["x", 1]}, "prompt"),
        ({"name": "a", "prompt": ["(x"]}, "カッコ"),
        ({"name": "a", "prompt": ["x"], "negative": "lowres"}, "negative"),
        ({"name": "a", "prompt": ["x"], "negative": ["(y"]}, "カッコ"),
        ({"name": "a", "prompt": ["x"], "extra": 1}, "extra"),
    ],
)
def test_inline_style_rejects_bad_input(value, match):
    from artgen.config import inline_style

    with pytest.raises(ConfigError, match=match):
        inline_style(value)


# --- face_crop ---

def test_face_crop_is_read(tmp_path):
    write_character(
        tmp_path,
        CHARACTER_YAML + "face_crop:\n  large: [0, 0, 600, 600]\n  small: [100, 100, 400, 400]\n"
        "  clear_colors:\n    - {min: 214, max_rg: 14, max_gb: 16}\n",
    )
    c = load_character(tmp_path, "c1")
    assert c.face_crop == FaceCrop((0, 0, 600, 600), (100, 100, 400, 400), (ClearColor(214, 14, 16),))


def test_face_crop_absent_is_none(tmp_path):
    write_character(tmp_path)
    assert load_character(tmp_path, "c1").face_crop is None


def test_face_crop_small_and_colors_optional(tmp_path):
    write_character(tmp_path, CHARACTER_YAML + "face_crop:\n  large: [0, 0, 600, 600]\n")
    assert load_character(tmp_path, "c1").face_crop == FaceCrop((0, 0, 600, 600), None, ())


@pytest.mark.parametrize(
    "yaml_text, where",
    [
        ("face_crop:\n  large: [0, 0, 600, 500]\n", "face_crop.large"),
        ("face_crop:\n  small: [0, 0, 100, 100]\n", "face_crop.large"),
        ("face_crop:\n  large: [0, 0, 6, 6]\n  small: [0, 0, 5, 4]\n", "face_crop.small"),
        ("face_crop:\n  large: [0, 0, 6, 6]\n  clear_colors: [{min: 300, max_rg: 1, max_gb: 1}]\n", "face_crop.clear_colors[0].min"),
        ("face_crop:\n  large: [0, 0, 6, 6]\n  clear_colors: [{min: 200}]\n", "face_crop.clear_colors[0]"),
        ("face_crop:\n  large: [0, 0, 6, 6]\n  sizes: 1\n", "face_crop"),
    ],
)
def test_face_crop_errors(tmp_path, yaml_text, where):
    write_character(tmp_path, CHARACTER_YAML + yaml_text)
    with pytest.raises(ConfigError, match=f"characters/c1/character.yaml: {re.escape(where)}"):
        load_character(tmp_path, "c1")


@pytest.mark.parametrize("value", ["false", "0", '""', "{}", "3"])
def test_face_crop_clear_colors_must_be_a_list(tmp_path, value):
    write_character(tmp_path, CHARACTER_YAML + f"face_crop:\n  large: [0, 0, 6, 6]\n  clear_colors: {value}\n")
    with pytest.raises(ConfigError, match=r"face_crop\.clear_colors"):
        load_character(tmp_path, "c1")


def test_face_crop_clear_colors_null_is_empty(tmp_path):
    write_character(tmp_path, CHARACTER_YAML + "face_crop:\n  large: [0, 0, 6, 6]\n  clear_colors:\n")
    assert load_character(tmp_path, "c1").face_crop.clear_colors == ()


def test_face_crop_clear_color_min_rg_is_read(tmp_path):
    write_character(
        tmp_path,
        CHARACTER_YAML + "face_crop:\n  large: [0, 0, 6, 6]\n  clear_colors:\n    - {min: 160, max_rg: 28, max_gb: 18, min_rg: 16}\n",
    )
    assert load_character(tmp_path, "c1").face_crop.clear_colors == (ClearColor(160, 28, 18, min_rg=16),)


@pytest.mark.parametrize("value", ["-1", "256", "30"])
def test_face_crop_clear_color_min_rg_must_be_in_range_and_not_above_max(tmp_path, value):
    write_character(
        tmp_path,
        CHARACTER_YAML + f"face_crop:\n  large: [0, 0, 6, 6]\n  clear_colors:\n    - {{min: 160, max_rg: 28, max_gb: 18, min_rg: {value}}}\n",
    )
    with pytest.raises(ConfigError, match=r"face_crop\.clear_colors\[0\]\.min_rg"):
        load_character(tmp_path, "c1")
