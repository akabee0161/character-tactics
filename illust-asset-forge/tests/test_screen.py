from pathlib import Path

import pytest
from PIL import Image, ImageDraw

from artgen.screen import REASON_BACKGROUND, REASON_HEAD_CUT, is_background, screen_face

ROOT = Path(__file__).resolve().parents[1]
WHITE = (255, 255, 255)
DARK = (40, 30, 30)


def face_image(*, bg=WHITE, circle_top=100, band=None):
    """1024 角。bg の地に暗い円（頭）。circle_top は円の上端の y。band=(色, 高さ) で上の辺に帯を足す。"""
    im = Image.new("RGB", (1024, 1024), bg)
    d = ImageDraw.Draw(im)
    d.ellipse((312, circle_top, 712, circle_top + 400), fill=DARK)
    d.rectangle((312, circle_top + 300, 712, 1023), fill=DARK)  # 首から服
    if band:
        d.rectangle((0, 0, 1023, band[1] - 1), fill=band[0])
    return im


@pytest.mark.parametrize("rgb, expected", [
    ((255, 255, 255), True),
    ((240, 240, 240), True),
    ((200, 255, 255), False),   # 最小値 214 未満
    ((240, 228, 214), True),    # クリーム色
    ((213, 213, 213), False),   # 最小値 214 未満
    ((250, 200, 180), False),   # r-g が大きい（肌）
    ((128, 128, 128), False),
])
def test_is_background(rgb, expected):
    assert is_background(rgb) is expected


def test_cream_boundaries():
    assert is_background((228, 214, 214 + 0)) is True   # 最小値 214、r-g=14、g-b=0
    assert is_background((229, 214, 214)) is False      # r-g=15
    assert is_background((230, 230, 214)) is True       # g-b=16
    assert is_background((231, 231, 214)) is False      # g-b=17
    assert is_background((231, 231, 213)) is False      # 最小値 213


def test_white_background_head_inside_is_kept():
    assert screen_face(face_image(circle_top=100)) == []


def test_head_touching_top_is_cut():
    reasons = screen_face(face_image(circle_top=-60))
    assert REASON_HEAD_CUT in reasons
    assert REASON_BACKGROUND not in reasons


def test_cream_ornament_is_background():
    assert screen_face(face_image(band=((240, 228, 214), 40))) == []


def test_grey_background_is_rejected():
    assert REASON_BACKGROUND in screen_face(face_image(bg=(128, 128, 128)))


@pytest.mark.parametrize("char, cut", [
    ("ally05", True), ("knight", True), ("mage", True), ("schoolboy", True), ("schoolgirl", False),
])
def test_repo_faces(char, cut):
    with Image.open(ROOT / "characters" / char / "source" / "face.png") as im:
        reasons = screen_face(im.convert("RGB"))
    assert (REASON_HEAD_CUT in reasons) == cut
    assert REASON_BACKGROUND not in reasons


def test_ornament_on_side_edges_does_not_reject_background():
    im = face_image()
    ImageDraw.Draw(im).rectangle((0, 100, 30, 600), fill=DARK)  # 左の辺に飾り。上の角は白のまま
    assert screen_face(im) == []
