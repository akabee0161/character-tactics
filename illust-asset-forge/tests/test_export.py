import json

import pytest
from PIL import Image

from artgen.config import ConfigError
from artgen.export import ExportError, export_character, main
from artgen.pnginfo import MissingParamsError, read_params, save_png


def write(root, rel, text):
    path = root / rel
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8")


@pytest.fixture
def repo(tmp_path):
    write(tmp_path, "styles/s.yaml", "prompt: [masterpiece]\nnegative: [lowres]\n")
    write(tmp_path, "templates/face.yaml",
          "width: 1024\nheight: 1024\nprompt: [portrait]\nnegative: []\nexport_size: 256\n")
    write(tmp_path, "templates/fullbody.yaml",
          "width: 832\nheight: 1216\nprompt: [full body]\nnegative: []\nexport_size: null\n")
    write(tmp_path, "characters/c1/character.yaml",
          "name: C\nstyle: s\nsubject: [1boy]\nappearance: []\noutfit: []\n"
          "default_expression: normal\nexpressions: {normal: [serious], hurt: [pain]}\n")
    return tmp_path


def put(repo, name, size, template, seed=1, params=True):
    path = repo / "characters/c1/source" / name
    image = Image.new("RGB", size, (10, 20, 30))
    if params:
        save_png(image, path, {"seed": seed, "template": template, "prompt": "騎士"})
    else:
        path.parent.mkdir(parents=True, exist_ok=True)
        image.save(path)
    return path


def test_face_is_resized_to_256(repo):
    put(repo, "face.png", (1024, 1024), "face")
    export_character(repo, "c1")
    out = repo / "characters/c1/face.png"
    assert Image.open(out).size == (256, 256)
    with pytest.raises(MissingParamsError):
        read_params(out)


def test_expression_face_and_fullbody(repo):
    src = put(repo, "fullbody.png", (832, 1216), "fullbody")
    put(repo, "face_hurt.png", (1024, 1024), "face")
    export_character(repo, "c1")
    assert Image.open(repo / "characters/c1/face_hurt.png").size == (256, 256)
    out = repo / "characters/c1/fullbody.png"
    assert Image.open(out).size == (832, 1216)
    assert out.read_bytes() == src.read_bytes()


def test_params_json(repo):
    put(repo, "face.png", (1024, 1024), "face", seed=11)
    put(repo, "fullbody.png", (832, 1216), "fullbody")
    paths = export_character(repo, "c1")
    text = (repo / "characters/c1/params.json").read_text(encoding="utf-8")
    data = json.loads(text)
    assert list(data) == ["face.png", "fullbody.png"]
    assert data["face.png"]["seed"] == 11
    assert "騎士" in text and text.endswith("\n")
    assert repo / "characters/c1/params.json" in paths


def test_rejects_unknown_name(repo):
    put(repo, "face_laugh.png", (1024, 1024), "face")
    with pytest.raises(ExportError) as e:
        export_character(repo, "c1")
    assert "face_laugh.png" in str(e.value)
    assert "face_hurt.png" in str(e.value)


def test_rejects_non_square_face(repo):
    put(repo, "face.png", (1024, 1000), "face")
    with pytest.raises(ExportError):
        export_character(repo, "c1")


def test_missing_params(repo):
    put(repo, "face.png", (1024, 1024), "face", params=False)
    with pytest.raises(MissingParamsError):
        export_character(repo, "c1")


def test_missing_template_key_in_params(repo):
    path = repo / "characters/c1/source/face.png"
    save_png(Image.new("RGB", (1024, 1024)), path, {"seed": 1})
    with pytest.raises(ExportError) as e:
        export_character(repo, "c1")
    assert "template" in str(e.value)


def test_unknown_template_in_params(repo):
    put(repo, "face.png", (1024, 1024), "nonexistent")
    with pytest.raises(ConfigError):
        export_character(repo, "c1")


def test_nothing_written_when_any_file_is_bad(repo):
    put(repo, "face.png", (1024, 1024), "face")
    put(repo, "face_hurt.png", (1024, 1024), "face", params=False)
    with pytest.raises(MissingParamsError):
        export_character(repo, "c1")
    assert not (repo / "characters/c1/face.png").exists()
    assert not (repo / "characters/c1/params.json").exists()


def test_empty_or_missing_source(repo):
    with pytest.raises(ExportError):
        export_character(repo, "c1")
    (repo / "characters/c1/source").mkdir()
    with pytest.raises(ExportError):
        export_character(repo, "c1")


def test_cli_exit_code(repo, capsys):
    put(repo, "face.png", (1024, 1024), "face")
    assert main(["c1", "--root", str(repo)]) == 0
    write(repo, "characters/c2/character.yaml",
          "name: D\nstyle: s\nsubject: []\nappearance: []\noutfit: []\n"
          "default_expression: normal\nexpressions: {normal: []}\n")
    assert main(["c2", "--root", str(repo)]) == 1
    assert "source" in capsys.readouterr().out
    assert main(["nobody", "--root", str(repo)]) == 1


def test_rejects_image_whose_template_does_not_match_name(repo):
    put(repo, "fullbody.png", (1024, 1024), "face")  # face の絵を fullbody と名付けた
    with pytest.raises(ExportError) as e:
        export_character(repo, "c1")
    assert "fullbody.png" in str(e.value) and "template" in str(e.value)


def put_full(repo, name, size, **params):
    save_png(Image.new("RGB", size), repo / "characters/c1/source" / name,
             {"template": "face", "seed": 1, **params})


def test_rejects_expression_mismatch(repo):
    put_full(repo, "face.png", (1024, 1024), expression="hurt")
    with pytest.raises(ExportError) as e:
        export_character(repo, "c1")
    assert "expression" in str(e.value)


def test_accepts_matching_expression(repo):
    put_full(repo, "face.png", (1024, 1024), expression="normal", character="c1")
    put_full(repo, "face_hurt.png", (1024, 1024), expression="hurt", character="c1")
    export_character(repo, "c1")


def test_rejects_character_mismatch(repo):
    put_full(repo, "face.png", (1024, 1024), character="someone-else")
    with pytest.raises(ExportError) as e:
        export_character(repo, "c1")
    assert "character" in str(e.value)


def test_rejects_downscaled_attachment(repo):
    put_full(repo, "face.png", (512, 512), width=1024, height=1024)
    with pytest.raises(ExportError) as e:
        export_character(repo, "c1")
    assert "縮め" in str(e.value)


@pytest.mark.parametrize("name", ["face.PNG", "face_hurt.jpg", "notes.txt"])
def test_rejects_non_png_or_odd_extension(repo, name):
    put(repo, "face.png", (1024, 1024), "face")
    (repo / "characters/c1/source" / name).write_bytes(b"x")
    with pytest.raises(ExportError) as e:
        export_character(repo, "c1")
    assert name in str(e.value)


def test_hidden_files_in_source_are_ignored(repo):
    put(repo, "face.png", (1024, 1024), "face")
    (repo / "characters/c1/source/.DS_Store").write_bytes(b"x")
    export_character(repo, "c1")


def test_stale_outputs_are_removed(repo):
    put(repo, "face.png", (1024, 1024), "face")
    stale = repo / "characters/c1/face_hurt.png"
    Image.new("RGB", (256, 256)).save(stale)
    export_character(repo, "c1")
    assert not stale.exists()
    assert list(json.loads((repo / "characters/c1/params.json").read_text(encoding="utf-8"))) == ["face.png"]


# --- face_crop ---

CROPPED_YAML = (
    "name: C\nstyle: s\nsubject: [1boy]\nappearance: []\noutfit: []\n"
    "default_expression: normal\nexpressions: {normal: [serious], hurt: [pain]}\n"
    "face_crop:\n  large: [0, 0, 600, 600]\n  small: [100, 100, 400, 400]\n"
)


@pytest.fixture
def cropped_repo(repo):
    write(repo, "characters/c1/character.yaml", CROPPED_YAML)
    put(repo, "face.png", (1024, 1024), "face")
    return repo


def test_cropped_face_and_small(cropped_repo):
    export_character(cropped_repo, "c1")
    large = Image.open(cropped_repo / "characters/c1/face.png")
    small = Image.open(cropped_repo / "characters/c1/face-small.png")
    assert large.size == (256, 256) and large.mode == "RGBA"
    assert small.size == (128, 128) and small.mode == "RGBA"


def test_cropped_expression_gets_small_too(cropped_repo):
    put(cropped_repo, "face_hurt.png", (1024, 1024), "face")
    export_character(cropped_repo, "c1")
    assert (cropped_repo / "characters/c1/face_hurt.png").is_file()
    assert (cropped_repo / "characters/c1/face_hurt-small.png").is_file()


def test_check_images_written(cropped_repo):
    export_character(cropped_repo, "c1")
    assert Image.open(cropped_repo / "local/check/c1/face-large.png").size == (600, 600)
    assert Image.open(cropped_repo / "local/check/c1/face-small.png").size == (300, 300)


def test_params_json_records_face_crop(cropped_repo):
    export_character(cropped_repo, "c1")
    data = json.loads((cropped_repo / "characters/c1/params.json").read_text(encoding="utf-8"))
    face_crop = data["face_crop"]
    assert face_crop["large"] == [0, 0, 600, 600] and face_crop["small"] == [100, 100, 400, 400]
    assert face_crop["clear_colors"] == []
    assert list(face_crop["source_sha256"]) == ["face.png"] and len(face_crop["source_sha256"]["face.png"]) == 64
    assert "face.png" in data


def test_without_face_crop_output_is_unchanged(repo):
    put(repo, "face.png", (1024, 1024), "face")
    export_character(repo, "c1")
    assert Image.open(repo / "characters/c1/face.png").mode == "RGB"
    assert not (repo / "characters/c1/face-small.png").exists()
    assert "face_crop" not in json.loads((repo / "characters/c1/params.json").read_text(encoding="utf-8"))


def test_large_only_writes_no_small(cropped_repo):
    write(cropped_repo, "characters/c1/character.yaml", CROPPED_YAML.replace("  small: [100, 100, 400, 400]\n", ""))
    export_character(cropped_repo, "c1")
    assert not (cropped_repo / "characters/c1/face-small.png").exists()


def test_small_output_removed_when_small_crop_dropped(cropped_repo):
    export_character(cropped_repo, "c1")
    assert (cropped_repo / "characters/c1/face-small.png").is_file()
    write(cropped_repo, "characters/c1/character.yaml", CROPPED_YAML.replace("  small: [100, 100, 400, 400]\n", ""))
    export_character(cropped_repo, "c1")
    assert not (cropped_repo / "characters/c1/face-small.png").exists()
    assert not (cropped_repo / "local/check/c1/face-small.png").exists()
    assert (cropped_repo / "local/check/c1/face-large.png").exists()


def test_small_output_removed_when_face_crop_dropped(cropped_repo):
    export_character(cropped_repo, "c1")
    write(cropped_repo, "characters/c1/character.yaml", CROPPED_YAML.split("face_crop:")[0])
    export_character(cropped_repo, "c1")
    assert not (cropped_repo / "characters/c1/face-small.png").exists()
    assert not (cropped_repo / "local/check/c1/face-large.png").exists()
    assert Image.open(cropped_repo / "characters/c1/face.png").mode == "RGB"


def test_crop_outside_image_is_rejected(cropped_repo):
    write(cropped_repo, "characters/c1/character.yaml",
          CROPPED_YAML.replace("[0, 0, 600, 600]", "[500, 500, 1100, 1100]"))
    with pytest.raises(ConfigError, match="face_crop.large"):
        export_character(cropped_repo, "c1")
    assert not (cropped_repo / "characters/c1/face.png").exists()
    assert not (cropped_repo / "characters/c1/params.json").exists()


def test_fullbody_is_not_cropped(cropped_repo):
    src = put(cropped_repo, "fullbody.png", (832, 1216), "fullbody")
    export_character(cropped_repo, "c1")
    assert (cropped_repo / "characters/c1/fullbody.png").read_bytes() == src.read_bytes()


def test_colliding_output_names_stop_before_writing(repo):
    # 表情 normal の小さい顔と、表情 normal-small の大きい顔が同じ face_normal-small.png になる
    yaml_text = CROPPED_YAML.replace(
        "expressions: {normal: [serious], hurt: [pain]}", "expressions: {normal: [serious], normal-small: [pain]}"
    )
    write(repo, "characters/c1/character.yaml", yaml_text)
    put(repo, "face_normal.png", (1024, 1024), "face")
    put(repo, "face_normal-small.png", (1024, 1024), "face", seed=2)
    with pytest.raises(ExportError, match="face_normal-small.png"):
        export_character(repo, "c1")
    assert not (repo / "characters/c1/face.png").exists()
    assert not (repo / "characters/c1/params.json").exists()
