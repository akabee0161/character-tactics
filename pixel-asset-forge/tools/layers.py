"""層（パーツ）を重なり順の表で合成する（2026-10-09 に試作し、2026-10-10 に tools/ へ移した）。

層は 32x32 のコマと、取り付け点（名前→座標）を持つ。重なり順の表（奥→手前の層の名前の並び）の順に、
手前の層の画素で上書きして合成する。どの画素がどの層から来たか（labels）も返す。層の数は決め打ちしない。
設計: character-tactics の docs/superpowers/specs/2026-10-09-unit-layer-parts-design.md
"""
from __future__ import annotations

from dataclasses import dataclass, field

from hand_outline import close_hands

Frame = list[list[str | None]]
Point = tuple[int, int]
SIZE = 32
ADDED = "後から足した輪郭"  # 合成の後に close_hands が足した輪郭の labels


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


def shifted(layer: Layer, dx: int, dy: int, name: str = "層") -> Layer:
    """層を (dx, dy) ずらす。枠の外へ出る画素があれば止める（黙って捨てない）。"""
    _check_size(layer, name)
    out = blank()
    for y, row in enumerate(layer.frame):
        for x, n in enumerate(row):
            if n is None:
                continue
            nx, ny = x + dx, y + dy
            if not (0 <= nx < SIZE and 0 <= ny < SIZE):
                raise LayerError(f"{name}: ({x},{y}) をずらすと枠の外 ({nx},{ny}) に出る")
            out[ny][nx] = n
    return Layer(out, {k: (x + dx, y + dy) for k, (x, y) in layer.anchors.items()})


def attach(item: Layer, holder: Layer, point: str, name: str = "層") -> Layer:
    """item の取り付け点 point を、holder の同じ名前の点に合わせて置く（武器を拳の握る点に付ける）。"""
    for who, layer in (("付ける側", item), ("持つ側", holder)):
        if point not in layer.anchors:
            raise LayerError(f"{name}: {who}に取り付け点 {point} が無い")
    (ix, iy), (hx, hy) = item.anchors[point], holder.anchors[point]
    return shifted(item, hx - ix, hy - iy, name)


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


def finish(frame: Frame, labels: Frame, hand: set[str], keep: set[str] = frozenset()) -> tuple[Frame, Frame]:
    """合成の後に手の輪郭を閉じる（tools/hand_outline.py）。足した画素の labels は ADDED。

    敵の試作（mklayers）だけが使う。部品を完全に描いたユニットには使わない（2026-10-10）。
    """
    out, changed = close_hands(frame, hand, keep)
    lab = [row[:] for row in labels]
    for x, y in changed:
        lab[y][x] = ADDED
    return out, lab


def differences(a: Frame, b: Frame) -> list[Point]:
    return [(x, y) for y in range(SIZE) for x in range(SIZE) if a[y][x] != b[y][x]]
