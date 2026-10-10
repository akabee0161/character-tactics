"""完成した絵（部品を持たないユニット。ロランなど）から層を切り出す（2026-10-09 に試作し、2026-10-10 に tools/ へ移した）。

部品ごとに、箱（x0, y0, x1, y1、両端を含む）の中のその部品の色の画素を取る。輪郭は、斜めも含めて接している
色の画素の層すべてに入れる（部品と体が分け合う輪郭は両方に入る）。どの部品にも取られなかった画素が「芯」。
部品の画素は芯では穴になる（隠れて絵に無い所は、まだ描いていない）。
分け合う輪郭は両方とも同じ輪郭なので、切り出した層をどの順で重ねても元の絵に戻る。
設計: character-tactics の docs/superpowers/specs/2026-10-09-unit-layer-parts-design.md
"""
from __future__ import annotations

from dataclasses import dataclass, field

from layers import SIZE, Frame, Layer, LayerError, blank

CORE = "芯"
N8 = [(dx, dy) for dy in (-1, 0, 1) for dx in (-1, 0, 1) if (dx, dy) != (0, 0)]
N4 = ((1, 0), (-1, 0), (0, 1), (0, -1))


@dataclass
class Part:
    name: str
    box: tuple[int, int, int, int]
    colors: set[str] = field(default_factory=set)


def cut(frame: Frame, parts: list[Part]) -> dict[str, Layer]:
    owner: dict[tuple[int, int], str] = {}  # 色の画素（輪郭以外）→ 層の名前
    for part in parts:
        x0, y0, x1, y1 = part.box
        if not (0 <= x0 <= x1 < SIZE and 0 <= y0 <= y1 < SIZE):
            raise LayerError(f"{part.name}: 箱 {part.box} が枠の外")
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1):
                if frame[y][x] in part.colors and (x, y) not in owner:
                    owner[(x, y)] = part.name
    for y in range(SIZE):
        for x in range(SIZE):
            n = frame[y][x]
            if n is not None and n != "outline" and (x, y) not in owner:
                owner[(x, y)] = CORE
    layers = {name: Layer(blank()) for name in [p.name for p in parts] + [CORE]}
    for (x, y), name in owner.items():
        layers[name].frame[y][x] = frame[y][x]
    for y in range(SIZE):
        for x in range(SIZE):
            if frame[y][x] != "outline":
                continue
            touching = {owner[(x + dx, y + dy)] for dx, dy in N8 if (x + dx, y + dy) in owner}
            for name in touching or {CORE}:
                layers[name].frame[y][x] = "outline"
    return layers


def torn(layers: dict[str, Layer], labels: Frame, parts: list[Part], order: list[str]) -> list[tuple[tuple[int, int], str, str]]:
    """((x, y), 奥の層, 部品) のならび。部品の箱の中で、部品より奥の層が見えていて、次のどちらかに当たる所
    （奥の層が部品の輪郭や面を破っている。2026-10-10 依頼者の指摘）。
    - 部品の画素に上下か左右から挟まれ、挟まれた所が奥の1つの層だけでできている（ロランの left の拳が盾の
      輪郭の上に描かれていた）。複数の層が混ざって見えるのは、柄が拳を通る所などなので数えない
    - 奥の層の色（輪郭以外）が、部品の面（輪郭以外）に上下左右で直に接している（ロランの up の盾の金属が拳に接していた）"""
    rank = {n: i for i, n in enumerate(order)}
    found = []
    for part in parts:
        own = layers[part.name].frame
        x0, y0, x1, y1 = part.box
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1):
                back = labels[y][x]
                if own[y][x] is not None or back not in rank or rank[back] >= rank[part.name]:
                    continue
                if layers[back].frame[y][x] != "outline" and any(
                        0 <= x + dx < SIZE and 0 <= y + dy < SIZE and own[y + dy][x + dx] not in (None, "outline")
                        for dx, dy in N4):
                    found.append(((x, y), back, part.name))
                    continue
                for dx, dy in ((1, 0), (0, 1)):
                    if all(_reaches_part(own, labels, part.box, back, x, y, dx * s, dy * s) for s in (1, -1)):
                        found.append(((x, y), back, part.name))
                        break
    return found


def _reaches_part(own: Frame, labels: Frame, box, back: str, x: int, y: int, dx: int, dy: int) -> bool:
    x0, y0, x1, y1 = box
    while True:
        x, y = x + dx, y + dy
        if not (x0 <= x <= x1 and y0 <= y <= y1):
            return False
        if own[y][x] is not None:
            return True
        if labels[y][x] != back:
            return False
