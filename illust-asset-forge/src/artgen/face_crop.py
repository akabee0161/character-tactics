"""顔の元画像の切り出しと、外につながる背景の透明化。

切り出した範囲の四辺の画素から塗りつぶしを始め、つながっている「白」と
`clear_colors` に当たる画素だけを透明にする。範囲の内側にあって外につながらない白
（白目・服の白など）は残る。範囲の辺で服が切れていると服の白も透明になるので、
確認図（透明にした画素を赤で塗った絵）を必ず見る。
"""

from __future__ import annotations

from collections import deque
from collections.abc import Sequence

from PIL import Image

from artgen.config import ClearColor

WHITE_MIN = 240
_RED = (255, 0, 0)


def _clearable(pixel: tuple[int, int, int], colors: Sequence[ClearColor]) -> bool:
    r, g, b = pixel
    lo = min(pixel)
    if lo >= WHITE_MIN:
        return True
    return any(
        lo >= c.min and r - g <= c.max_rg and g - b <= c.max_gb and (c.min_rg is None or r - g >= c.min_rg)
        for c in colors
    )


def clear_background(
    image: Image.Image, colors: Sequence[ClearColor]
) -> tuple[Image.Image, Image.Image]:
    """RGB の絵の外につながる背景を透明にする。（透明化した RGBA、確認図の RGB）を返す。"""
    rgb = image.convert("RGB")
    w, h = rgb.size
    src = rgb.load()
    cleared = bytearray(w * h)
    queue: deque[tuple[int, int]] = deque()

    def push(x: int, y: int) -> None:
        if not cleared[y * w + x] and _clearable(src[x, y], colors):
            cleared[y * w + x] = 1
            queue.append((x, y))

    for x in range(w):
        push(x, 0)
        push(x, h - 1)
    for y in range(h):
        push(0, y)
        push(w - 1, y)
    while queue:
        x, y = queue.popleft()
        if x > 0:
            push(x - 1, y)
        if x < w - 1:
            push(x + 1, y)
        if y > 0:
            push(x, y - 1)
        if y < h - 1:
            push(x, y + 1)

    out = rgb.convert("RGBA")
    check = rgb.copy()
    dst, chk = out.load(), check.load()
    for y in range(h):
        for x in range(w):
            if cleared[y * w + x]:
                dst[x, y] = (*src[x, y], 0)
                chk[x, y] = _RED
    return out, check


def render_face_matte(
    source: Image.Image,
    mask: Image.Image,
    box: tuple[int, int, int, int],
    size: int,
) -> tuple[Image.Image, Image.Image]:
    """box を切り出し、マスク（L。255＝キャラクター）をそのままアルファにして size 角に縮める。
    （縮めた RGBA、縮める前の確認図）。確認図はアルファが半分未満の画素を赤で塗る。"""
    cropped = source.convert("RGB").crop(box)
    alpha = mask.convert("L").crop(box)
    out = cropped.convert("RGBA")
    out.putalpha(alpha)
    check = cropped.copy()
    check.paste(Image.new("RGB", check.size, _RED), mask=alpha.point(lambda v: 255 if v < 128 else 0))
    small = out.convert("RGBa").resize((size, size), Image.LANCZOS).convert("RGBA")
    return small, check


def render_face(
    source: Image.Image,
    box: tuple[int, int, int, int],
    size: int,
    colors: Sequence[ClearColor],
) -> tuple[Image.Image, Image.Image]:
    """box を切り出し、背景を透明にして size 角に縮める。（縮めた RGBA、縮める前の確認図）。"""
    cropped = source.convert("RGB").crop(box)
    cleared, check = clear_background(cropped, colors)
    # アルファを掛けた形で縮め、透明の縁が黒ずむのを防ぐ
    small = cleared.convert("RGBa").resize((size, size), Image.LANCZOS).convert("RGBA")
    return small, check
