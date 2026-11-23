import pytest
from PIL import Image

from artgen.config import ConfigError
from artgen.mask import overlay_box
from artgen.picker import edit_box, pick, show_styles
from artgen.pnginfo import read_params

from test_forge import ENV, FakePipe, forge, pipe, repo, write  # noqa: F401  (fixtures)


class _Widget:
    def __init__(self, **kw):
        self.__dict__.update(kw)


class Button(_Widget):
    def on_click(self, f):
        self._handler = f

    def click(self):
        self._handler(self)


class IntSlider(_Widget):
    def observe(self, f, names=None):
        self.__dict__["_observer"] = f

    def __setattr__(self, name, value):
        super().__setattr__(name, value)
        if name == "value" and "_observer" in self.__dict__:
            self._observer({"name": "value", "new": value})


class Image_(_Widget):
    pass


class Label(_Widget):
    pass


class HTML(_Widget):
    pass


class VBox(_Widget):
    pass


class HBox(_Widget):
    pass


class FakeWidgets:
    def __init__(self):
        self._made = []

    def created(self, name):
        return [w for n, w in self._made if n == name]

    def _factory(self, name, cls):
        def make(*a, **kw):
            if a:
                kw["children"] = a[0]
            w = cls(**kw)
            self._made.append((name, w))
            return w
        return make

    def __getattr__(self, name):
        classes = {"Button": Button, "IntSlider": IntSlider, "Image": Image_, "Label": Label,
                   "HTML": HTML, "VBox": VBox, "HBox": HBox}
        if name not in classes:
            raise AttributeError(name)
        return self._factory(name, classes[name])


@pytest.fixture
def fake_widgets():
    return FakeWidgets()


def noop(*a, **k):
    return None


def test_overlay_box_still_importable():
    im = Image.new("RGB", (10, 10), (255, 255, 255))
    assert overlay_box(im, (1, 1, 5, 5), width=1).size == (10, 10)


def test_pick_adopt_button_adopts(forge, fake_widgets):
    paths = forge.generate("c1", "face", seeds=[1, 2])
    pick(forge, paths, widgets=fake_widgets, display=noop)
    buttons = fake_widgets.created("Button")
    assert [b.description for b in buttons] == ["採用", "左右反転して採用"] * 2
    buttons[1].click()
    assert read_params(forge.selected.face_path("c1"))["flipped"] is True
    assert any(h.value.startswith("採用: ") for h in fake_widgets.created("HTML"))


def test_pick_defaults_to_latest_run(forge, fake_widgets):
    forge.generate("c1", "face", seeds=[1])
    pick(forge, widgets=fake_widgets, display=noop)
    assert len(fake_widgets.created("Button")) == 2


def test_pick_has_no_flip_for_expressions(forge, fake_widgets):
    forge.adopt(forge.generate("c1", "face", seeds=[1])[0])
    paths = forge.inpaint("c1", "hurt", seeds=[3])
    pick(forge, paths, widgets=fake_widgets, display=noop)
    assert [b.description for b in fake_widgets.created("Button")] == ["採用"]


def test_pick_shows_error_text_instead_of_raising(forge, fake_widgets):
    p = forge.generate("c1", "face", seeds=[1])[0]
    pick(forge, [p], widgets=fake_widgets, display=noop)
    p.unlink()
    fake_widgets.created("Button")[0].click()
    assert "採用できない: " in fake_widgets.created("HTML")[-1].value


def test_edit_box_saves_selection(forge, fake_widgets):
    forge.adopt(forge.generate("c1", "face", seeds=[1])[0])
    edit_box(forge, "c1", widgets=fake_widgets, display=noop)
    x0, y0, x1, y1 = fake_widgets.created("IntSlider")
    assert (x0.value, y0.value, x1.value, y1.value) == (100, 100, 400, 300)
    x1.value = 600
    fake_widgets.created("Button")[0].click()
    assert forge.selected.read_box("c1") == (100, 100, 600, 300)
    assert fake_widgets.created("Button")[0].description == "この範囲で決める"


def test_edit_box_rejects_bad_box(forge, fake_widgets):
    forge.adopt(forge.generate("c1", "face", seeds=[1])[0])
    edit_box(forge, "c1", widgets=fake_widgets, display=noop)
    x0, y0, x1, y1 = fake_widgets.created("IntSlider")
    x1.value = x0.value + 16  # feather 24 の 2 倍より狭い
    fake_widgets.created("Button")[0].click()
    assert forge.selected.read_box("c1") is None
    assert "決められない: " in fake_widgets.created("HTML")[-1].value


def test_edit_box_without_face_says_what_to_do(forge, fake_widgets):
    with pytest.raises(ConfigError, match="顔を採用"):
        edit_box(forge, "c1", widgets=fake_widgets, display=noop)
    assert fake_widgets._made == []


def test_show_styles_one_composite_and_row_labels(forge, fake_widgets):
    import io

    paths = forge.compare_styles("c1", "face", styles=["s", "t"], seeds=[1, 2])
    show_styles(paths, display=noop, widgets=fake_widgets, thumb=32)
    images = fake_widgets.created("Image")
    assert len(images) == 1
    with Image.open(io.BytesIO(images[0].value)) as im:
        assert im.size == (64, 64)  # 2 列 x 2 行
    labels = [h.value for h in fake_widgets.created("HTML")]
    assert any("<b>s</b>" in v for v in labels) and any("<b>t</b>" in v for v in labels)


def test_edit_box_slider_max_follows_face_size(forge, fake_widgets):
    from artgen.pnginfo import save_png

    face = forge.adopt(forge.generate("c1", "face", seeds=[1])[0])
    params = read_params(face)
    save_png(Image.new("RGB", (512, 640)), face, params)
    edit_box(forge, "c1", widgets=fake_widgets, display=noop)
    x0, y0, x1, y1 = fake_widgets.created("IntSlider")
    assert (x0.max, y0.max, x1.max, y1.max) == (512, 640, 512, 640)


def test_edit_box_rejects_box_sticking_out_of_image(forge, fake_widgets):
    forge.adopt(forge.generate("c1", "face", seeds=[1])[0])
    edit_box(forge, "c1", widgets=fake_widgets, display=noop)
    x1 = fake_widgets.created("IntSlider")[2]
    x1.value = 2000  # スライダーの上限を越えた値（描画側が通しても保存で止まる）
    fake_widgets.created("Button")[0].click()
    assert forge.selected.read_box("c1") is None
    assert "決められない: " in fake_widgets.created("HTML")[-1].value


def test_edit_box_redraw_clears_stale_result(forge, fake_widgets):
    forge.adopt(forge.generate("c1", "face", seeds=[1])[0])
    edit_box(forge, "c1", widgets=fake_widgets, display=noop)
    x1 = fake_widgets.created("IntSlider")[2]
    fake_widgets.created("Button")[0].click()
    label = fake_widgets.created("HTML")[-1]
    assert label.value.startswith("決めた")
    x1.value = 500
    assert label.value == ""


def test_show_styles_unreadable_params_names_the_file(forge, fake_widgets, tmp_path):
    plain = tmp_path / "plain_one.png"
    Image.new("RGB", (8, 8)).save(plain)
    with pytest.raises(ConfigError, match="plain_one.png"):
        show_styles([plain], display=noop, widgets=fake_widgets, thumb=32)


def test_show_styles_tolerates_missing_style_and_seed(fake_widgets, tmp_path):
    from artgen.pnginfo import save_png

    p = tmp_path / "x.png"
    save_png(Image.new("RGB", (8, 8)), p, {"template": "face"})
    show_styles([p], display=noop, widgets=fake_widgets, thumb=32)
    labels = [h.value for h in fake_widgets.created("HTML")]
    assert any("画風不明" in v for v in labels) and any("シード不明" in v for v in labels)


def test_pick_reports_moved_expressions_on_readopt(forge, fake_widgets):
    forge.adopt(forge.generate("c1", "face", seeds=[1])[0])
    forge.adopt(forge.inpaint("c1", "hurt", seeds=[3])[0])
    forge.selected.save_box("c1", (10, 10, 500, 500))
    new_face = forge.generate("c1", "face", seeds=[2])[0]
    pick(forge, [new_face], widgets=fake_widgets, display=noop)
    fake_widgets.created("Button")[0].click()
    text = fake_widgets.created("HTML")[-1].value
    assert "face_hurt.png" in text and "selection.json" in text and "replaced/" in text


def test_pick_shows_unexpected_exception_instead_of_vanishing(forge, fake_widgets, monkeypatch):
    p = forge.generate("c1", "face", seeds=[1])[0]
    pick(forge, [p], widgets=fake_widgets, display=noop)

    def boom(*a, **k):
        raise ValueError("想定外")

    monkeypatch.setattr(forge, "adopt", boom)
    fake_widgets.created("Button")[0].click()
    assert "採用できない: ValueError: 想定外" in fake_widgets.created("HTML")[-1].value


def test_result_text_is_html_escaped(forge, fake_widgets, monkeypatch):
    p = forge.generate("c1", "face", seeds=[1])[0]
    pick(forge, [p], widgets=fake_widgets, display=noop)
    monkeypatch.setattr(forge, "adopt", lambda *a, **k: (_ for _ in ()).throw(ValueError("<b>x</b>")))
    fake_widgets.created("Button")[0].click()
    assert "<b>" not in fake_widgets.created("HTML")[-1].value


def test_edit_box_refuses_to_save_after_face_readopted(forge, fake_widgets):
    cand = forge.generate("c1", "face", seeds=[1])[0]
    forge.adopt(cand)
    edit_box(forge, "c1", widgets=fake_widgets, display=noop)
    forge.adopt(cand, flip=True)  # 画面を開いたまま顔を採用し直した
    fake_widgets.created("Button")[0].click()
    assert forge.selected.read_box("c1") is None
    assert not (forge.selected.selected_dir / "c1" / "selection.json").exists()
    assert fake_widgets.created("HTML")[-1].value == "決められない: 顔を採用し直したので、この画面を開き直す"


def test_edit_box_refuses_to_save_when_face_removed(forge, fake_widgets):
    forge.adopt(forge.generate("c1", "face", seeds=[1])[0])
    edit_box(forge, "c1", widgets=fake_widgets, display=noop)
    forge.selected.face_path("c1").unlink()
    fake_widgets.created("Button")[0].click()
    assert not (forge.selected.selected_dir / "c1" / "selection.json").exists()
    assert "決められない: 顔を採用し直した" in fake_widgets.created("HTML")[-1].value


def test_show_styles_groups_inline_style_pngs(forge, fake_widgets):
    soft = {"name": "soft", "prompt": ["flat color"], "negative": []}
    paths = forge.compare_styles("c1", "face", styles=["s", soft], seeds=[1])
    show_styles(paths, display=noop, widgets=fake_widgets, thumb=32)
    labels = [h.value for h in fake_widgets.created("HTML")]
    assert any("<b>s</b>" in v for v in labels) and any("<b>soft</b>" in v for v in labels)


def test_pick_with_char_and_kind_opens_latest_matching_run(forge, fake_widgets):
    forge.generate(["c1", "c2"], "face", seeds=[1])
    forge.generate("c1", "fullbody", seeds=[2])
    pick(forge, char="c1", kind="face", widgets=fake_widgets, display=lambda *a: None)
    assert [b.description for b in fake_widgets.created("Button")] == ["採用", "左右反転して採用"]  # c1 の顔 1 枚


@pytest.mark.parametrize("extra", [{"char": "c1"}, {"kind": "face"}, {"run_id": "20261122_093000"}])
def test_pick_paths_with_char_kind_or_run_id_is_an_error(forge, fake_widgets, extra):
    p = forge.generate("c1", "face", seeds=[1])
    with pytest.raises(ConfigError, match="paths"):
        pick(forge, p, widgets=fake_widgets, display=lambda *a: None, **extra)


def test_pick_without_filters_opens_latest_run_across_characters(forge, fake_widgets):
    forge.generate(["c1", "c2"], "face", seeds=[1])
    pick(forge, widgets=fake_widgets, display=lambda *a: None)
    assert len(fake_widgets.created("Button")) == 4  # 2 人分（各 [採用]・[左右反転して採用]）


def test_pick_sets_display_size_so_the_image_is_not_stretched(forge, fake_widgets):
    import io

    p = forge.generate("c1", "face", seeds=[1])[0]
    pick(forge, [p], widgets=fake_widgets, display=noop, thumb=32)
    (image,) = fake_widgets.created("Image")
    with Image.open(io.BytesIO(image.value)) as shown:
        assert max(shown.size) == 32
        assert (int(image.width), int(image.height)) == shown.size
