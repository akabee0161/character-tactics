import pytest
from PIL import Image

from artgen.pnginfo import MissingParamsError, main, read_params, save_png


def test_roundtrip(tmp_path):
    p = tmp_path / "out" / "a.png"
    params = {"seed": 1, "prompt": "騎士, 1boy"}
    save_png(Image.new("RGB", (8, 8)), p, params)
    assert read_params(p) == params


def test_missing_params_raises(tmp_path):
    p = tmp_path / "plain.png"
    Image.new("RGB", (8, 8)).save(p)
    with pytest.raises(MissingParamsError) as e:
        read_params(p)
    assert "plain.png" in str(e.value)
    assert "生成の条件が無い" in str(e.value)


def test_non_json_params_raises(tmp_path):
    from PIL import PngImagePlugin

    p = tmp_path / "bad.png"
    info = PngImagePlugin.PngInfo()
    info.add_text("parameters", "not json")
    Image.new("RGB", (8, 8)).save(p, pnginfo=info)
    with pytest.raises(MissingParamsError):
        read_params(p)


def test_cli_reports_missing(tmp_path, capsys):
    bad = tmp_path / "plain.png"
    Image.new("RGB", (8, 8)).save(bad)
    good = tmp_path / "good.png"
    save_png(Image.new("RGB", (8, 8)), good, {"seed": 42})

    assert main([str(bad)]) == 1
    assert "plain.png" in capsys.readouterr().out

    assert main([str(good)]) == 0
    assert "seed" in capsys.readouterr().out


def test_cli_shows_overrides_first(tmp_path, capsys):
    p = tmp_path / "o.png"
    save_png(Image.new("RGB", (8, 8)), p, {"seed": 1, "overrides": {"extra": ["scar"]}})
    main([str(p)])
    out = capsys.readouterr().out
    assert out.index("overrides") < out.index("seed")
