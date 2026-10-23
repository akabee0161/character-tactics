"""刃・鏃の先端が決まり1〜5に合うかを、1枚のグリッドで判定する（2026-10-22）。

決まりは docs/superpowers/specs/2026-10-22-tip-drawing-rule-design.md（character-tactics）と types/item/SPEC.md。
刃・鏃は色でなく文字（blade）で見分ける。グリッドの外は背景とみなす。

1. 刃の文字の画素を8近傍でまとまりに分ける
2. 根元 = 8近傍に刃の文字でも輪郭でも背景でもない画素（柄・矢の軸など）がある画素。無ければ対象外
3. 向き = 根元の重心からまとまりの重心への向きを8方位に丸める（10° を超えてずれたら対象外）
4. 先端が上（縦横）か右上（斜め）を向くように回し・反転して判定し、位置は元の座標で返す
   縦（上向き）: 決まり1〜4と対称。斜め（右上向き）: 決まり5
"""
from __future__ import annotations

import math
from dataclasses import dataclass

Point = tuple[int, int]

# 向き → (先端を上・右上へ向ける座標の変換, 判定の種類)
TRANSFORMS = {
    "up": (lambda x, y: (x, y), "axis"),
    "down": (lambda x, y: (-x, -y), "axis"),
    "left": (lambda x, y: (-y, x), "axis"),
    "right": (lambda x, y: (y, -x), "axis"),
    "up_right": (lambda x, y: (x, y), "diagonal"),
    "up_left": (lambda x, y: (-x, y), "diagonal"),
    "down_right": (lambda x, y: (x, -y), "diagonal"),
    "down_left": (lambda x, y: (-x, -y), "diagonal"),
}
# 画面の座標（y は下向き）での8方位の角度（右 = 0°、反時計回り）
ANGLES = {"right": 0, "up_right": 45, "up": 90, "up_left": 135, "left": 180, "down_left": 225, "down": 270,
          "down_right": 315}
MAX_ANGLE_OFF = 10
MAX_WIDTH = 4


@dataclass(frozen=True)
class Tip:
    point: Point                # 刃の色の一番先の画素（元のグリッドの座標）。縦横は行 T の刃の色の左端、斜めは (X, Y)
    direction: str              # "up" "down" "left" "right" "up_right" "up_left" "down_right" "down_left"
    width: int                  # 中身の幅（向きをそろえた後の、刃の色の一番広い横の1行の画素数）
    problems: tuple[str, ...]   # 破った決まり。各要素は "決まり1: …" の形（対称は "対称: …"）。空なら合格
    skipped: str | None = None  # 対象外の理由。None なら判定した


def _clusters(blade_pixels: set[Point]) -> list[set[Point]]:
    left, out = set(blade_pixels), []
    while left:
        stack, group = [left.pop()], set()
        while stack:
            x, y = stack.pop()
            group.add((x, y))
            for dx in (-1, 0, 1):
                for dy in (-1, 0, 1):
                    q = (x + dx, y + dy)
                    if q in left:
                        left.remove(q)
                        stack.append(q)
        out.append(group)
    return out


def _direction(group: set[Point], root: set[Point]) -> str | None:
    rx = sum(x for x, _ in root) / len(root)
    ry = sum(y for _, y in root) / len(root)
    cx = sum(x for x, _ in group) / len(group)
    cy = sum(y for _, y in group) / len(group)
    dx, dy = cx - rx, cy - ry
    if math.hypot(dx, dy) < 1e-9:
        return None
    angle = math.degrees(math.atan2(-dy, dx)) % 360
    name = min(ANGLES, key=lambda k: min(abs(angle - ANGLES[k]), 360 - abs(angle - ANGLES[k])))
    off = min(abs(angle - ANGLES[name]), 360 - abs(angle - ANGLES[name]))
    return name if off <= MAX_ANGLE_OFF else None


def _run(xs: list[int]) -> bool:
    return xs == list(range(xs[0], xs[0] + len(xs)))


def _judge_axis(light: set[Point], kind, n: int) -> tuple[list[str], Point]:
    """先端が上を向いた縦の刃。kind(p) は 'light'・'outline'・'background'・'other'。"""
    problems: list[str] = []
    top = min(y for _, y in light)
    rows: dict[int, list[int]] = {}
    for x, y in light:
        rows.setdefault(y, []).append(x)
    for xs in rows.values():
        xs.sort()
    first = rows[top]
    point = (first[0], top)

    def sil(y: int, xs: list[int]) -> tuple[int, int]:
        l, r = xs[0], xs[-1]
        while kind((l - 1, y)) == "outline":
            l -= 1
        while kind((r + 1, y)) == "outline":
            r += 1
        return l, r

    # 決まり3: 刃の色の先の黒は1画素の厚み
    if any(kind((x, top - 1)) != "outline" or kind((x, top - 2)) != "background" for x in first):
        problems.append("決まり3: 刃の色の先の黒が1画素の厚みでない")
        return problems, point
    cap_l, cap_r = first[0], first[-1]
    while kind((cap_l - 1, top - 1)) == "outline":
        cap_l -= 1
    while kind((cap_r + 1, top - 1)) == "outline":
        cap_r += 1
    # 決まり2: 刃の色をできるだけ細くして先端まで届かせる
    want = 1 if n % 2 else 2
    if len(first) != want:
        problems.append(f"決まり2: 先端の刃の色が {len(first)} 画素（中身 {n} なら {want}）")
    full = n + 2
    prev = (cap_l, cap_r)
    centre = cap_l + cap_r
    rule1 = rule4 = sym = False
    if cap_r - cap_l + 1 > n:
        rule1 = True
    prev_w = None
    y = top
    while y in rows:
        xs = rows[y]
        if not _run(xs):
            rule1 = True
            break
        cur = sil(y, xs)
        width = cur[1] - cur[0] + 1
        if prev[1] - prev[0] + 1 < full:
            if cur != (prev[0] - 1, prev[1] + 1):
                rule1 = True
        elif cur != prev:
            rule1 = True
        if prev_w is not None and width == full and prev_w < n and len(xs) != prev_w + 2:
            rule4 = True
        if xs[0] + xs[-1] != centre or cur[0] + cur[1] != centre:
            sym = True
        if len(xs) == n and width == full:
            break
        prev, prev_w = cur, len(xs)
        y += 1
    if rule1:
        problems.append("決まり1: 外形が1行につき左右1pxずつ細くなっていない")
    if rule4:
        problems.append("決まり4: 外形が刃の幅に届いた後、刃の色が毎行広がっていない")
    if sym:
        problems.append("対称: 外形か刃の色が中心線について左右対称でない")
    return problems, point


def _judge_diagonal(light: set[Point], kind) -> tuple[list[str], Point]:
    """先端が右上を向いた斜めの刃（決まり5）。"""
    X = max(x for x, _ in light)
    Y = min(y for _, y in light)
    point = (X, Y)
    bad = []
    row = sorted(x for x, y in light if y == Y)
    col = sorted(y for x, y in light if x == X)
    if (X, Y) not in light or not _run(row) or not _run(col) or row[-1] != X or col[0] != Y:
        bad.append("縦と横の線で切った形でない")
    elif any(kind((x, Y - 1)) != "outline" or kind((x, Y - 2)) != "background" for x in row) or \
            any(kind((X + 1, y)) != "outline" or kind((X + 2, y)) != "background" for y in col):
        bad.append("切り口の黒が1画素の厚みでない")
    if kind((X + 1, Y - 1)) != "outline":
        bad.append("角の1画素が黒でない")
    elif any(kind(p) != "background" for p in ((X + 2, Y - 1), (X + 1, Y - 2), (X + 2, Y - 2))):
        bad.append("角の黒が1画素の厚みでない")
    return [f"決まり5: {b}" for b in bad], point


def find_tips(rows: list[str], blade: frozenset[str], outline: frozenset[str],
              background: str = ".") -> list[Tip]:
    chars = {(x, y): c for y, r in enumerate(rows) for x, c in enumerate(r)}
    blade_pixels = {p for p, c in chars.items() if c in blade}

    def other(p: Point) -> bool:
        c = chars.get(p, background)
        return c not in blade and c not in outline and c != background

    tips = []
    for group in sorted(_clusters(blade_pixels), key=lambda g: min((y, x) for x, y in g)):
        root = {(x, y) for x, y in group
                if any(other((x + dx, y + dy)) for dx in (-1, 0, 1) for dy in (-1, 0, 1))}
        any_point = min(group, key=lambda p: (p[1], p[0]))
        if not root:
            tips.append(Tip(any_point, "", 0, (), "根元（柄・軸）が無い"))
            continue
        direction = _direction(group, root)
        if direction is None:
            tips.append(Tip(any_point, "", 0, (), "45°以外の斜め（向きが8方位から外れる）"))
            continue
        f, shape = TRANSFORMS[direction]
        back = {}
        moved = {}
        for p, c in chars.items():
            q = f(*p)
            moved[q] = c
            back[q] = p
        light = {f(*p) for p in group}

        def kind(q: Point) -> str:
            if q in light:
                return "light"
            c = moved.get(q, background)
            if c in outline:
                return "outline"
            if c == background:
                return "background"
            return "other"

        per_row: dict[int, int] = {}
        for _, y in light:
            per_row[y] = per_row.get(y, 0) + 1
        n = max(per_row.values())
        if n > MAX_WIDTH:
            tips.append(Tip(any_point, direction, n, (), f"中身{n}画素（中身5画素以上は決まりの外）"))
            continue
        if shape == "axis":
            problems, point = _judge_axis(light, kind, n)
        else:
            problems, point = _judge_diagonal(light, kind)
        tips.append(Tip(back[point], direction, n, tuple(problems)))
    return tips
