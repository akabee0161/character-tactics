import pytest
from PIL import Image

from artgen.config import ConfigError
from artgen.mask import check_box, feather_composite, make_mask


def test_check_box_rejects_outside_and_reversed():
    for box in [(0, 0, 101, 50), (50, 10, 40, 20), (10, 10, 10, 20), (-1, 0, 50, 50)]:
        with pytest.raises(ConfigError) as e:
            check_box(box, (100, 100))
        assert str(box) in str(e.value)
    check_box((10, 10, 90, 90), (100, 100))
    check_box((0, 0, 100, 100), (100, 100))


def test_make_mask_values():
    m = make_mask((100, 100), (10, 20, 30, 40))
    assert m.mode == "L"
    assert m.size == (100, 100)
    assert m.getpixel((15, 25)) == 255
    assert m.getpixel((5, 5)) == 0
    assert m.getpixel((30, 40)) == 0  # x1・y1 は含まない


def test_feather_composite_keeps_outside_and_replaces_center():
    red = Image.new("RGB", (200, 200), (200, 0, 0))
    blue = Image.new("RGB", (200, 200), (0, 0, 200))
    out = feather_composite(red, blue, (50, 50, 150, 150), 16)
    assert out.getpixel((100, 100)) == (0, 0, 200)
    assert out.getpixel((10, 10)) == (200, 0, 0)
    assert out.getpixel((49, 100)) == (200, 0, 0)
    r, _, b = out.getpixel((66, 100))
    assert r > 0 and b > 0


def test_feather_zero_is_hard_rectangle():
    red = Image.new("RGB", (100, 100), (200, 0, 0))
    blue = Image.new("RGB", (100, 100), (0, 0, 200))
    out = feather_composite(red, blue, (20, 20, 60, 60), 0)
    assert out.getpixel((20, 20)) == (0, 0, 200)
    assert out.getpixel((19, 20)) == (200, 0, 0)


def test_feather_larger_than_box_is_rejected():
    red = Image.new("RGB", (100, 100), (200, 0, 0))
    with pytest.raises(ConfigError):
        feather_composite(red, red.copy(), (20, 20, 40, 40), 10)


def test_feather_composite_size_mismatch():
    with pytest.raises(ValueError):
        feather_composite(Image.new("RGB", (10, 10)), Image.new("RGB", (20, 20)), (1, 1, 5, 5), 2)


def test_check_feather_rejects_too_large_for_box():
    from artgen.mask import check_feather

    check_feather((100, 100, 300, 300), 24)
    check_feather((0, 0, 10, 10), 0)
    for box in [(100, 100, 140, 300), (100, 100, 300, 140), (0, 0, 48, 48)]:
        with pytest.raises(ConfigError):
            check_feather(box, 24)


def test_overlay_box_draws_red_border_without_touching_original():
    from artgen.mask import overlay_box

    im = Image.new("RGB", (100, 100), (255, 255, 255))
    out = overlay_box(im, (10, 10, 50, 50), width=2)
    assert out.getpixel((10, 30)) == (255, 0, 0) and out.getpixel((30, 30)) == (255, 255, 255)
    assert im.getpixel((10, 30)) == (255, 255, 255)
