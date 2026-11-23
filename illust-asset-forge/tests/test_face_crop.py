from PIL import Image, ImageDraw

from artgen.config import ClearColor
from artgen.face_crop import clear_background, render_face

WHITE = (255, 255, 255)
GRAY = (90, 90, 90)
RED = (255, 0, 0)


def canvas(size=20, color=WHITE):
    return Image.new("RGB", (size, size), color)


def test_outer_white_becomes_transparent():
    im = canvas()
    ImageDraw.Draw(im).rectangle([5, 5, 14, 14], fill=GRAY)
    out, check = clear_background(im, ())
    assert out.mode == "RGBA" and check.mode == "RGB"
    for xy in [(0, 0), (19, 0), (0, 19), (19, 19)]:
        assert out.getpixel(xy)[3] == 0
        assert check.getpixel(xy) == RED
    assert out.getpixel((10, 10))[3] == 255


def test_inner_white_is_kept():
    im = canvas()
    d = ImageDraw.Draw(im)
    d.rectangle([3, 3, 16, 16], fill=GRAY)
    d.rectangle([8, 8, 11, 11], fill=WHITE)
    out, check = clear_background(im, ())
    assert out.getpixel((9, 9))[3] == 255
    assert check.getpixel((9, 9)) != RED


def test_edge_white_cloth_is_cleared_and_marked_red():
    im = canvas(color=GRAY)
    ImageDraw.Draw(im).rectangle([4, 15, 15, 19], fill=WHITE)  # 下の辺に接した白い服
    out, check = clear_background(im, ())
    assert out.getpixel((8, 18))[3] == 0
    assert check.getpixel((8, 18)) == RED
    assert out.getpixel((8, 5))[3] == 255


def test_clear_color_is_cleared_only_when_connected():
    cream = (236, 226, 218)
    cc = [ClearColor(214, 14, 16)]
    im = canvas()
    d = ImageDraw.Draw(im)
    d.rectangle([0, 0, 4, 19], fill=cream)  # 左の辺につながる
    d.rectangle([7, 7, 16, 16], fill=GRAY)
    d.rectangle([10, 10, 12, 12], fill=cream)  # 灰に囲まれる
    out, _ = clear_background(im, cc)
    assert out.getpixel((2, 10))[3] == 0
    assert out.getpixel((11, 11))[3] == 255


def test_skin_is_not_cream():
    im = canvas()
    ImageDraw.Draw(im).rectangle([0, 0, 4, 19], fill=(240, 200, 170))
    out, _ = clear_background(im, [ClearColor(214, 14, 16)])
    assert out.getpixel((2, 10))[3] == 255


def test_near_white_below_threshold_is_kept():
    im = canvas(color=(239, 255, 255))
    out, _ = clear_background(im, ())
    assert out.getpixel((0, 0))[3] == 255


def test_render_face_size_and_mode():
    im = Image.new("RGB", (1024, 1024), WHITE)
    out, check = render_face(im, (0, 0, 600, 600), 128, ())
    assert out.size == (128, 128) and out.mode == "RGBA"
    assert check.size == (600, 600)


def test_resize_does_not_darken_edges():
    im = canvas(64)
    ImageDraw.Draw(im).rectangle([20, 20, 43, 43], fill=(255, 0, 0))
    out, _ = render_face(im, (0, 0, 64, 64), 16, ())
    edge = [out.getpixel((x, y)) for x in range(16) for y in range(16) if 0 < out.getpixel((x, y))[3] < 255]
    assert edge and all(p[0] >= 200 for p in edge)
