"""層（パーツ）を重なり順の表で合成する（2026-10-09 に試作し、2026-10-10 に tools/ へ移した）。
敵の層の試作（mklayers、2026-10-09）で使った shifted・attach・finish は、試作を消したときに消した（2026-10-12）。

層は 32x32 のコマと、取り付け点（名前→座標）を持つ。重なり順の表（奥→手前の層の名前の並び）の順に、
手前の層の画素で上書きして合成する。どの画素がどの層から来たか（labels）も返す。層の数は決め打ちしない。
設計: character-tactics の docs/superpowers/specs/2026-10-09-unit-layer-parts-design.md
"""
from __future__ import annotations

from dataclasses import dataclass, field

Frame = list[list[str | None]]
Point = tuple[int, int]
SIZE = 32


class LayerError(Exception):
    """層や重なり順の表が合成の前提に合わない。"""


@dataclass
class Layer:
    frame: Frame
    anchors: dict[str, Point] = field(default_factory=dict)


def blank() -> Frame:
    return [[None] * SIZE for _ in range(SIZE)]


def _check_size(layer: Layer, name: str) -> None:
    if len(layer.frame) != SIZE or any(len(row) != SIZE for row in layer.frame):
        raise LayerError(f"{name}: 層の大きさが {SIZE}x{SIZE} でない")


def compose(layers: dict[str, Layer], order: list[str]) -> tuple[Frame, Frame]:
    """order（奥→手前）の順に重ねる。(絵, 画素ごとの層の名前)。"""
    missing = [n for n in order if n not in layers]
    extra = [n for n in layers if n not in order]
    dup = sorted({n for n in order if order.count(n) > 1})
    if missing or extra or dup:
        raise LayerError(f"重なり順の表と層が合わない: 表にあって層に無い {missing}、層にあって表に無い {extra}、重複 {dup}")
    frame, labels = blank(), blank()
    for name in order:
        _check_size(layers[name], name)
        for y, row in enumerate(layers[name].frame):
            for x, n in enumerate(row):
                if n is not None:
                    frame[y][x] = n
                    labels[y][x] = name
    return frame, labels


def differences(a: Frame, b: Frame) -> list[Point]:
    return [(x, y) for y in range(SIZE) for x in range(SIZE) if a[y][x] != b[y][x]]
