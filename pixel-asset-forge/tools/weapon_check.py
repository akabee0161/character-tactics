#!/usr/bin/env python3
"""ユニットの武器と、それを握る手を、見せる前に機械で確かめる（自己チェック①の道具の1つ）。

    tools/weapon_check.py cand/enemy-frames/spear-soldier \\
        --blade stone_hi,stone_base --weapon wood_base,wood_shadow \\
        --hand skin_rose_hi,skin_rose_base,skin_rose_shadow --hidden left_atk_hit,right_atk_hit

色はファイルごとの文字ではなく、パレットの色名で指定する。
- 刃（--blade）: 武器の先の色。「穂先」は、手から一番遠い刃の画素とする
- 武器（--weapon）: 刃以外の武器の色（柄など）。刃と柄が（刃と柄の間は斜めでも）つながった塊を武器とする。
  刃と同じ色の兜、柄と同じ色のベルトや靴を取り違えないため。体に隠されて切れた柄（刃の延長上にある
  1行か1列の線）も武器に含める
- 手（--hand）: 柄から 2px 以内にある肌の塊のうち、柄に一番近いもの（もう片方の手や、穂先の横の顔を拾わない）

確かめること（どれか1つでも落ちたら終了コード 1）:
1. 手と武器が消えない: 武器と、その近くの手がある（--hidden に挙げた、体に隠れるコマは除く）
2. 手の輪郭: 手の画素が、透明・コマの外と上下左右で直に接していない（柄を握るので柄とは接してよい）
3. 手の幅: 武器を握る手の塊が、縦横とも 2px 以上ある
4. 穂先の向き: 攻撃のコマ（--hit）で、手の中心（手が隠れるコマは体の中心）から見た穂先が、向いている側にある
5. 枠に収まる: 武器の画素がコマの端（x=0,31 / y=0,31）に無い
6. 握る位置: 向きごとに、--seq のコマ（攻撃 → 構え）で、手の中心から穂先までの距離が 1.5px 以内でそろう
7. 武器の長さ: 向きごとに、--seq のコマで、武器の画素どうしの最大距離が 2px 以内でそろう
   （向きが違うと、柄頭が手に隠れるかどうかなどで見える長さが変わるので、向きをまたいでは比べない）
8. 手が浮かない（--arm を指定したとき）: 握る手が、腕の色（袖・腕の肌）と、直にか輪郭1画素を挟んで（斜めも含む）つながる
6・7 は、--partial に挙げたコマ（武器の一部が体や頭に隠れ、見えている分だけでは測れない）と、--depth に挙げた向き（攻撃で武器を手前・奥へ向けて短く見せる。奥行きの表現）の --seq のコマを除く。

既存ユニットで測った結果（2026-10-07）: 上の取り違えを直した後、ガウ・ロランで引っかかったのは
left の立ち・歩きの 1px 幅の手（各4コマ、依頼者が欠陥と判断し ISSUES.md へ）だけ。
down の攻撃で武器が短くなるのは奥行きの表現（--depth down）、武器が体に隠れるコマは意図（--hidden）と依頼者が判断。
弓（イネス）は両手で持つので、握る位置・穂先の向きの考え方が合わず、対象外。
ユニットごとの指定は types/unit/SPEC.md の自己チェック①。

DIR の直下の `<向き>_<名前>.txt` だけを読む。
"""
from __future__ import annotations

import argparse
import math
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from enemy_build import read_frame  # noqa: E402
from gridfile import GridError  # noqa: E402

DIRECTIONS = ("down", "up", "left", "right")
FACING = {"down": (0, 1), "up": (0, -1), "left": (-1, 0), "right": (1, 0)}
SIZE = 32
N4 = ((1, 0), (-1, 0), (0, 1), (0, -1))
N8 = N4 + ((1, 1), (1, -1), (-1, 1), (-1, -1))
GRIP_TOLERANCE = 1.5
LENGTH_TOLERANCE = 2.0
HAND_REACH = 2

Point = tuple[int, int]


class WeaponCheckError(Exception):
    """入力がこの検査の前提に合わない。"""


def _direction(name: str) -> str:
    return name.split("_", 1)[0]


def _components(points: set[Point], steps=N4) -> list[set[Point]]:
    left = set(points)
    found = []
    while left:
        stack = [left.pop()]
        comp = set(stack)
        while stack:
            x, y = stack.pop()
            for dx, dy in steps:
                p = (x + dx, y + dy)
                if p in left:
                    left.remove(p)
                    comp.add(p)
                    stack.append(p)
        found.append(comp)
    return found


def _center(points: set[Point]) -> tuple[float, float]:
    return (sum(x for x, _ in points) / len(points), sum(y for _, y in points) / len(points))


def _dist(a, b) -> float:
    return math.hypot(a[0] - b[0], a[1] - b[1])


def _orientation(points: set[Point]) -> str:
    xs = [x for x, _ in points]
    ys = [y for _, y in points]
    w, h = max(xs) - min(xs), max(ys) - min(ys)
    return "h" if w > h else "v" if h > w else "any"


def _shaft_piece(comp: set[Point], blade: set[Point], square_ok: bool = False,
                 shaft: set[Point] = frozenset(), skin: set[Point] = frozenset()) -> bool:
    """体に隠されて刃と切れた柄の一部か。1行か1列の線で、刃の延長上にあるもの。
    square_ok: 刃の塊が縦横同じ大きさ（向きが分からない）でも、線が刃の高さ・幅に入っていれば認める。
    1画素だけの切れ端（拳の先にのぞく柄の端）は、刃とつながった柄（shaft）と同じ列か行にあり、
    拳（skin）から 2px 以内にあるときだけ認める。"""
    xs = {x for x, _ in comp}
    if len(comp) < 2:
        x, y = p = next(iter(comp))
        orient = _orientation(blade)
        in_line = (orient == "v" and any(sx == x for sx, _ in shaft)) or \
                  (orient == "h" and any(sy == y for _, sy in shaft))
        return in_line and _near({p}, skin)
    ys = {y for _, y in comp}
    bx = [x for x, _ in blade]
    by = [y for _, y in blade]
    orient = _orientation(blade)
    if square_ok and orient == "any":
        orient = "h" if len(ys) == 1 else "v"
    if len(ys) == 1 and orient == "h":
        return min(by) - 1 <= next(iter(ys)) <= max(by) + 1
    if len(xs) == 1 and orient == "v":
        return min(bx) - 1 <= next(iter(xs)) <= max(bx) + 1
    return False


def _join_blade_to_handle(comps: list[set[Point]], blade: set[Point], handle: set[Point],
                          from_blade: bool = True) -> list[set[Point]]:
    """上下左右でつながった塊どうしを、刃と柄・柄と柄が斜めに接するところでだけつなぐ
    （斜めの柄は階段状の画素になる。刃と兜は斜めでもつながない）。from_blade=False なら柄と柄だけ。"""
    owner = {p: i for i, c in enumerate(comps) for p in c}
    parent = list(range(len(comps)))

    def root(i):
        while parent[i] != i:
            parent[i] = parent[parent[i]]
            i = parent[i]
        return i

    for p in (blade | handle) if from_blade else handle:
        for dx, dy in N8[4:]:
            q = (p[0] + dx, p[1] + dy)
            if q in handle and root(owner[p]) != root(owner[q]):
                parent[root(owner[p])] = root(owner[q])
    merged: dict[int, set[Point]] = {}
    for i, c in enumerate(comps):
        merged.setdefault(root(i), set()).update(c)
    return list(merged.values())


def _near(a: set[Point], b: set[Point], reach: int = HAND_REACH) -> bool:
    return any(max(abs(p[0] - q[0]), abs(p[1] - q[1])) <= reach for p in a for q in b)


def _across_fist(comps: list[set[Point]], blade: set[Point], skin: set[Point]) -> list[set[Point]]:
    """刃を手前・奥へ向けると、斧の頭が柄を隠し、拳が頭と柄の間に入る。同じ拳の近くにある刃の塊と柄の塊を1つの武器とする。"""
    blades = [c for c in comps if c & blade]
    handles = [c for c in comps if not c & blade]
    for fist in _components(skin):
        near_b = [c for c in blades if _near(fist, c)]
        near_h = [c for c in handles if _near(fist, c)]
        if near_b and near_h:
            return near_b + near_h
    return []


class Analysis:
    """1コマの武器・刃・手・穂先。"""

    def __init__(self, frame, blade: set[str], weapon: set[str], hand: set[str]):
        pts = {(x, y): n for y, row in enumerate(frame) for x, n in enumerate(row) if n is not None}
        self.pixels = pts
        blade_px = {p for p, n in pts.items() if n in blade}
        other_px = {p for p, n in pts.items() if n in weapon}
        comps4 = _components(blade_px | other_px)
        # 刃と上下左右で（斜めの柄なら柄どうしは斜めでも）つながる柄。あれば手はこの柄の近くで探す
        # （刃に斜めに接しただけの靴やベルトに引っ張られない）
        core_comps = _join_blade_to_handle(comps4, blade_px, other_px, from_blade=False)
        core = set().union(*(c & other_px for c in core_comps if c & blade_px and c & other_px)) if comps4 else set()
        comps = _join_blade_to_handle(comps4, blade_px, other_px)
        # 刃と柄がつながった塊だけを武器とする（刃と同じ色の兜を拾わない）。柄の色が無い武器なら刃の塊
        # 柄が体に隠れて刃だけ見えるときは、刃の延長上に柄の切れ端がある刃の塊を使う
        touching = [c for c in comps if c & blade_px and (c & other_px or not other_px)]
        square_ok = False
        skin = {p for p, n in pts.items() if n in hand}
        if not touching:
            pieces = [c for c in comps if not c & blade_px]
            touching = [c for c in comps
                        if c & blade_px and any(_shaft_piece(p, c, square_ok=True) for p in pieces)]
            square_ok = True
        if not touching:
            touching = _across_fist(comps, blade_px, skin)
        self.weapon = set().union(*touching) if touching else set()
        self.tiny: set[Point] = set()  # 拳の先にのぞく1画素の柄頭。見えるかどうかがコマで変わるので長さに数えない
        blade_px &= self.weapon
        for c in comps:  # 柄の切れ端は柄の色だけでできている（刃の色の首巻きなどを拾わない）
            if blade_px and c <= other_px and not c & self.weapon and \
                    _shaft_piece(c, blade_px, square_ok, self.weapon & other_px, skin):
                self.weapon |= c
                if len(c) == 1:
                    self.tiny |= c
        self.hand = (self._hand(skin, core & self.weapon) if core & self.weapon else set()) \
            or self._hand(skin, (self.weapon - blade_px) or self.weapon)
        self.tip = None
        if blade_px:
            ref = _center(self.hand) if self.hand else self.body_center()
            self.tip = max(blade_px, key=lambda p: (_dist(p, ref), p))

    @staticmethod
    def _hand(skin: set[Point], grip: set[Point]) -> set[Point]:
        """柄（刃以外の武器。無ければ武器全体）に一番近い肌の塊。もう片方の手や、穂先の横の顔は拾わない。"""
        if not grip:
            return set()
        best, found = None, []
        for c in _components(skin):
            reach = min(max(abs(p[0] - w[0]), abs(p[1] - w[1])) for p in c for w in grip)
            if reach > HAND_REACH:
                continue
            d = min(_dist(p, w) for p in c for w in grip)  # 斜めは遠いとみなす（顔より拳を選ぶ）
            if best is None or d < best - 1e-9:
                best, found = d, [c]
            elif abs(d - best) < 1e-9:
                found.append(c)
        return set().union(*found)

    def body_center(self) -> tuple[float, float]:
        body = set(self.pixels) - self.weapon
        return _center(body) if body else (SIZE / 2, SIZE / 2)

    def grip(self) -> float | None:
        if not self.hand or self.tip is None:
            return None
        return _dist(_center(self.hand), self.tip)

    def length(self) -> float:
        w = sorted(self.weapon - self.tiny)
        return max((_dist(a, b) for i, a in enumerate(w) for b in w[i + 1:]), default=0.0)


def floating(a: Analysis, arm: set[str]) -> bool:
    """握る手が、腕（袖や腕の肌の色）と、直にか輪郭1画素を挟んで（斜めも含めて）つながっていないか。"""
    for x, y in a.hand:
        for dx, dy in N8:
            for k in (1, 2):
                q = (x + dx * k, y + dy * k)
                if q in a.hand:
                    break
                name = a.pixels.get(q)
                if name in arm:
                    return False
                if name != "outline":
                    break
    return True


def check_frame(name: str, a: Analysis, hidden: set[str], hit_states: set[str],
                arm: set[str] = frozenset()) -> list[str]:
    fails = []
    if not a.weapon:
        return [] if name in hidden else [f"{name}: 武器が見えない（刃と柄がつながった塊が無い）"]
    if not a.hand:
        if name not in hidden:
            fails.append(f"{name}: 手が無い（武器から {HAND_REACH}px 以内に肌が無い）")
    else:
        bad = sorted({p for p in a.hand for dx, dy in N4 if (p[0] + dx, p[1] + dy) not in a.pixels},
                     key=lambda p: (p[1], p[0]))
        if bad:
            fails.append(f"{name}: 手の輪郭が途切れている: " + " ".join(f"({x},{y})" for x, y in bad))
        for c in _components(a.hand):
            xs = [x for x, _ in c]
            ys = [y for _, y in c]
            w, h = max(xs) - min(xs) + 1, max(ys) - min(ys) + 1
            if min(w, h) < 2:
                fails.append(f"{name}: 手が細い（{w}x{h}px、(%d,%d) から）" % (min(xs), min(ys)))
        if arm and floating(a, arm):
            x, y = min(a.hand, key=lambda p: (p[1], p[0]))
            fails.append(f"{name}: 手が体から浮いている（({x},{y}) の手が腕の色とつながっていない）")
    state = name.split("_", 1)[1] if "_" in name else ""
    if state in hit_states and a.tip is not None:
        fx, fy = FACING[_direction(name)]
        cx, cy = _center(a.hand) if a.hand else a.body_center()
        vx, vy = a.tip[0] - cx, a.tip[1] - cy
        along, across = vx * fx + vy * fy, abs(vx * fy) + abs(vy * fx)
        if along <= 0 or along < across:
            ref = "手" if a.hand else "体"
            fails.append(f"{name}: 穂先が向いている側に無い（穂先 {a.tip}、{ref}の中心 ({cx:.1f},{cy:.1f})）")
    edge = sorted(p for p in a.weapon if p[0] in (0, SIZE - 1) or p[1] in (0, SIZE - 1))
    if edge:
        fails.append(f"{name}: 武器がコマの端で切れている: " + " ".join(f"({x},{y})" for x, y in edge))
    return fails


def check_unit(frames: dict[str, Analysis], hidden: set[str], hit_states: set[str],
               seq: list[str], depth: set[str] = frozenset(),
               arm: set[str] = frozenset(), partial: set[str] = frozenset()) -> tuple[list[str], list[str]]:
    fails, notes = [], []
    for name, a in frames.items():
        fails += check_frame(name, a, hidden, hit_states, arm)
    for d in DIRECTIONS:
        if d in depth:
            continue
        grips = {f"{d}_{s}": frames[f"{d}_{s}"].grip() for s in seq
                 if f"{d}_{s}" in frames and f"{d}_{s}" not in partial}
        grips = {k: v for k, v in grips.items() if v is not None}
        if len(grips) >= 2:
            detail = " ".join(f"{k}={v:.1f}" for k, v in grips.items())
            notes.append(f"握る位置 {d}: {detail}")
            if max(grips.values()) - min(grips.values()) > GRIP_TOLERANCE:
                fails.append(f"{d}: 握る位置がずれる（手の中心から穂先まで）: {detail}")
        lengths = {f"{d}_{s}": frames[f"{d}_{s}"].length() for s in seq
                   if f"{d}_{s}" in frames and f"{d}_{s}" not in partial and frames[f"{d}_{s}"].weapon}
        if len(lengths) >= 2:
            detail = " ".join(f"{k}={v:.1f}" for k, v in lengths.items())
            notes.append(f"武器の長さ {d}: {detail}")
            if max(lengths.values()) - min(lengths.values()) > LENGTH_TOLERANCE:
                fails.append(f"{d}: 武器の長さがそろわない: {detail}")
    return fails, notes


def load(directory: Path, blade, weapon, hand) -> dict[str, Analysis]:
    frames = {}
    for path in sorted(directory.glob("*.txt")):
        if _direction(path.stem) in DIRECTIONS:
            frames[path.stem] = Analysis(read_frame(path), blade, weapon, hand)
    if not frames:
        raise WeaponCheckError(f"{directory}: <向き>_<名前>.txt が1つも無い")
    return frames


def _names(text: str) -> set[str]:
    return {s.strip() for s in text.split(",") if s.strip()}


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("directory", type=Path)
    parser.add_argument("--blade", required=True, help="刃の色名（カンマ区切り）")
    parser.add_argument("--weapon", default="", help="刃以外の武器の色名（柄など）")
    parser.add_argument("--hand", required=True, help="手の肌の色名")
    parser.add_argument("--arm", default="", help="腕の色名（袖・腕の肌）。握る手がこれとつながっているかを確かめる")
    parser.add_argument("--hidden", default="", help="手や武器が体に隠れるコマ（例: left_atk_hit）")
    parser.add_argument("--partial", default="", help="武器の一部が体や頭に隠れるコマ（例: left_base）。握る位置と長さの検査から外す")
    parser.add_argument("--depth", default="", help="攻撃で武器を手前・奥へ向け、短く見せる向き（例: down）。"
                        "その向きの --seq のコマは、握る位置と長さの検査から外す")
    parser.add_argument("--hit", default="atk_hit", help="穂先の向きを確かめる状態")
    parser.add_argument("--seq", default="atk_wind,atk_hit,base", help="握る位置をそろえる状態の並び")
    args = parser.parse_args(argv)

    if not args.directory.is_dir():
        print(f"error: ディレクトリが無い: {args.directory}", file=sys.stderr)
        return 2
    try:
        frames = load(args.directory, _names(args.blade), _names(args.weapon), _names(args.hand))
    except (GridError, WeaponCheckError) as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 2
    fails, notes = check_unit(frames, _names(args.hidden), _names(args.hit),
                              [s for s in args.seq.split(",") if s], _names(args.depth), _names(args.arm),
                              _names(args.partial))
    for n in notes:
        print(n)
    for f in fails:
        print(f"FAIL {f}", file=sys.stderr)
    if fails:
        return 1
    print("武器と手: ok")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
