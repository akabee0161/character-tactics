"""斧と槍の敵のコマを作る（候補）。mkframes の素体（武器なし）に、武器と拳のパッチを重ねる。

使い方（pixel-asset-forge で）: python cand/gen/mkweapons.py [敵のid ...]
パッチの文字: . = 触らない / _ = 消す / x = 空いているときだけ輪郭 / 他は色（下の COL）
"""
import math
import sys
from pathlib import Path

sys.path.insert(0, "tools")
sys.path.insert(0, "cand/gen")
import enemy_build as eb
import mkframes as mf
from hand_outline import close_hands

COL = {"o": "outline", "S": "stone_hi", "T": "stone_base", "L": "wood_hi", "M": "wood_base",
       "N": "wood_shadow", "a": "skin_rose_hi", "b": "skin_rose_base", "c": "skin_rose_shadow",
       "J": "cloak_dark_hi", "K": "cloak_dark_base", "H": "cloak_dark_shadow"}
SWAP = {"a": "c", "c": "a"}
DIRS = ["down", "up", "left", "right"]
OUT = Path("cand/enemy-frames")

# 見た目（目・頭・服）は承認済みの4体のまま、武器を短剣から替える（2026-10-07 依頼者決定）
for _new, _old, _weapon in (("axe-bandit", "dagger-bandit", "axe"), ("axe-horn", "dagger-horn", "axe"),
                            ("spear-knight", "dagger-knight", "spear"), ("spear-thug", "dagger-thug", "spear")):
    mf.ENEMIES[_new] = (*mf.ENEMIES[_old][:4], _weapon, "male")

# 女性の8体（2026-10-08 依頼者決定）: 見た目と武器は男性と同じ、長い髪 A・B・C を足す。フルフェイスの女性は作らない
for _male, _hairs in (("axe-bandit", "ABC"), ("axe-horn", "BC"), ("spear-thug", "ABC")):
    for _h in _hairs:
        _name, _eye, _head, _cloth, _weapon, _ = mf.ENEMIES[_male]
        mf.ENEMIES[f"{_male}-{_h.lower()}-f"] = (_name, _eye, None if _head == "bare" else _head, _cloth,
                                                  _weapon, "female", _h)

# 女性のコマで、男性の武器と拳のパッチを x にずらす量（状態, 向き）。女性は肩幅が狭く、武器を持つ手は
# 男性から down +2・up -2・left -1・right +1 にある（素体の base で測った）が、次の理由でそのままずらさない:
# - down: +2 だと柄が顔の縁の輪郭に乗り、柄と顔の肌が直に接する。+1 にして、体の手の右端を輪郭にする（FEMALE_FIX）
# - up: 立ちでは握る手は体の陰。長い髪が背中を x=22 まで覆うので、武器を髪の外へ出す（+1）。攻撃の拳は体の縁に付ける（-2）
# - 体の前へ出す手（down・left・right の当たり）は、手の位置でなく体の前の縁に合わせる
FEMALE_SHIFT = {
    "base": {"down": 1, "up": 1, "left": -1, "right": 1},
    "atk_wind": {"down": 1, "up": -2, "left": -1, "right": 1},
    "atk_hit": {"down": 0, "up": -2, "left": 1, "right": -1},
}


def P(x0, y0, rows, layer="front"):
    """文字のパッチ。パッチは (セル辞書, layer) のリスト（重なり順）。"""
    cells = {}
    for dy, row in enumerate(rows):
        for dx, ch in enumerate(row):
            if ch != ".":
                cells[(x0 + dx, y0 + dy)] = ch
    return [(cells, layer)]


def mirror(patch, k, swap=True):
    return [({(k - x, y): (SWAP.get(ch, ch) if swap else ch) for (x, y), ch in cells.items()}, layer)
            for cells, layer in patch]


def shift(patch, dx, dy=0):
    return [({(x + dx, y + dy): ch for (x, y), ch in cells.items()}, layer) for cells, layer in patch]


def merge(*patches):
    return [part for p in patches for part in p]


def relayer(patch, layer):
    return [(cells, layer) for cells, _ in patch]


def apply(canvas, patch, dy=0):
    for cells, layer in patch:
        for (x, y0), ch in cells.items():
            y = y0 + dy
            if not (0 <= x < 32 and 0 <= y < 32):
                continue
            if ch == "_":
                canvas[y][x] = None
            elif ch == "x":
                if canvas[y][x] is None:
                    canvas[y][x] = "outline"
            elif layer == "back" and canvas[y][x] is not None:
                continue
            else:
                canvas[y][x] = COL[ch]


# ---- 斧（2026-10-07 依頼者承認） ------------------------------------
# 見え方の約束（build/axe_views.html）: 斧は太い木の棒の一端に axe head。前を向くとき刃は木の前、
# 後ろを向くとき刃は木の後ろ。真後ろに axe head があれば棒に隠れる。刃を手前・奥へ向けた axe head は棒と同じ1px幅
# 刃を左に向けた縦の斧（刃先の辺が長い台形、案B1）。握りは (5, 9)〜(5, 10)
AXE_FULL = [
    "oo..xox.",
    "oSooxMx.",
    "oSTTTMx.",
    "oSTTTMx.",
    "oSTTTMx.",
    "oTTTTMx.",
    "oTooxMx.",
    "oo..xMx.",
    "....xMx.",
    "....xMx.",
    "....xMx.",
    "....xMx.",
    "....xNx.",
    ".....x..",
]
AXE_GRIP = (5, 9)


def axe_cells():
    return {(x - AXE_GRIP[0], y - AXE_GRIP[1]): ch
            for y, row in enumerate(AXE_FULL) for x, ch in enumerate(row) if ch != "."}


def flip(c):
    return {(-dx, dy): SWAP.get(ch, ch) for (dx, dy), ch in c.items()}


def place(c, gx, gy, layer="front"):
    """握りを (gx, gy) に置く。"""
    return [({(gx + dx, gy + dy): ch for (dx, dy), ch in c.items()}, layer)]


def fist_v(gx, gy):
    """縦の柄を握る拳（肌は gy, gy+1）。"""
    return P(gx - 2, gy - 1, [".ooo", "oabbx", "obbcx", ".ooo"])


def fist_sq(x0, y0):
    """2x2 の肌を、空いているところだけ輪郭で囲む。"""
    return P(x0 - 1, y0 - 1, ["xxxx", "xabx", "xbcx", "xxxx"])


def raster_axe(gx, gy, dx, dy):
    """斜めの斧を画素にする。握りの中心 (gx,gy)、柄が頭へ向かう向き (dx,dy)。刃は縦の柄で左になる側。
    形は案B1と同じ比（首の幅4・刃先の辺8・刃の深さ5、握りから頭まで2〜10）。"""
    n = math.hypot(dx, dy)
    ux, uy = dx / n, dy / n
    px, py = uy, -ux

    def inside(s, v):
        if not 0.4 <= v <= 5.6:
            return False
        t = (v - 0.4) / 5.2
        return 4.5 + (2.0 - 4.5) * t <= s <= 8.0 + (10.0 - 8.0) * t

    out = {}
    for y in range(32):
        for x in range(32):
            rx, ry = x + 0.5 - gx, y + 0.5 - gy
            s, v = rx * ux + ry * uy, rx * px + ry * py
            if inside(s, v):
                out[(x, y)] = "S" if v > 4.4 else "T"
            elif -3.5 <= s <= 10.5 and abs(v) <= 0.55:
                out[(x, y)] = "N" if s < -2.5 else "M"
    for (x, y) in list(out):
        for ex, ey in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            out.setdefault((x + ex, y + ey), "x")
    return [(out, "front")]


def ringed(c):
    """体の手前に描く斧の周りを、輪郭で一周閉じる（刃が同じ色の兜や顔に直に接しないように）。"""
    out = {p: ("o" if ch == "x" else ch) for p, ch in c.items()}
    for (x, y), ch in c.items():
        if ch in ("x", "o"):
            continue
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            out.setdefault((x + dx, y + dy), "o")
    return out


def stick(x, parts, top, layer="front"):
    """前か後ろから見た縦1列の斧（axe head は棒と同じ1px幅）。parts は上から (文字, 行数)。"""
    rows = ["xox"] + [f"o{ch}o" for ch, n in parts for _ in range(n)] + ["xox"]
    return P(x - 1, top, rows, layer)


AXE = axe_cells()
ARM_L = P(19, 14, [".oKKo", "oKKHo", "oKHo."])  # left の振りかぶりで体と拳をつなぐ袖
ARM_U = P(20, 13, [".oKKo", "oKKHo", "oKHo."])
SHAFT_L = P(21, 9, ["oMo", "oMo", "oMo"])  # 頭の後ろから拳までの柄をバンダナの上に見せる
HAND_CAPS = P(9, 17, ["o", ".", ".", "o"])
# 武器ごとの例外: 槍の down の当たりは拳が体の脇（斧は体の前）なので、手の位置の差だけずらす
FEMALE_SHIFT_WEAPON = {("spear", "atk_hit", "down"): 2}
FAR = {"left"}  # 武器を持つ手が体の奥にある向き（weapon_check --far）
HAND = {"skin_rose_hi", "skin_rose_base", "skin_rose_shadow"}  # 手の肌（hand_outline・weapon_check --hand）
ARM = {"cloak_dark_hi", "cloak_dark_base", "cloak_dark_shadow"}  # 服・袖（hand_outline・weapon_check --arm）
HAIR_COLOURS = {"hair_slate_hi", "hair_slate_base", "hair_slate_shadow"}  # 長い髪（weapon_check --cover）
FEMALE_FIX = {
    ("base", "down"): P(12, 18, ["o", "o"]),  # 拳の右（体の手の端 x=12）を輪郭にして3px幅にそろえる
    ("base", "up"): P(20, 17, ["oo", "..", "..", "oo"]),  # 後ろ姿の手（x=20〜21）の上下を閉じる（素体は開いている）
}

# 立ち姿: 横から見た形。left は体の後ろ（刃は前で体に隠れる）、right は体の手前（刃は前）
axe_stance = {
    "down": merge(place(AXE, 9, 18), fist_v(9, 18)),
    "up": merge(relayer(mirror(place(AXE, 9, 18), 31), "back"), mirror(HAND_CAPS, 31)),
    "left": merge(place(AXE, 21, 18, "back"), P(20, 17, ["ooo.", "obbo", "obco", "ooo."])),
    "right": merge(place(ringed(flip(AXE)), 11, 18), fist_v(11, 18)),
}
# 振りかぶり: down＝刃が木の前で上8行が鋼、up＝木の棒だけ、left＝体の後ろで縦（刃は前）に袖を足す
axe_left_wind = merge(place(AXE, 22, 12, "back"), SHAFT_L, fist_v(22, 12), ARM_L)
axe_wind = {
    "down": merge(stick(9, [("S", 8), ("M", 3), ("M", 2), ("N", 1)], 3), fist_v(9, 13)),
    "up": merge(stick(22, [("M", 11), ("M", 2), ("N", 1)], 3, "back"), fist_v(22, 13)),
    "left": axe_left_wind,
    # right は握る手が体の手前側なので、斧も体の手前（刃が頭に重なるので輪郭を一周閉じる）
    "right": merge(place(ringed(flip(AXE)), 8, 12), mirror(merge(fist_v(22, 12), ARM_L), 30)),
}
# 当たり: down＝手を体の前へ（ロランの剣と同じ）、45度で木を6pxに、先端1pxだけ axe head。
# up＝剣と同じく体の向こうに隠れる。left＝斜め45度で刃が前下
axe_left_hit = merge(raster_axe(12.0, 17.0, -1, -1), fist_sq(11, 16))
axe_hit = {
    "down": merge(stick(11, [("N", 1), ("M", 1), ("M", 2), ("M", 6), ("S", 1)], 15), fist_v(12, 18)),
    "up": [],
    "left": axe_left_hit,
    "right": mirror(axe_left_hit, 30),
}


# ---- 槍 -------------------------------------------------------------
SPEAR_TIP = ["..o..", ".oSo.", "oSSTo", "oSTTo", ".oTo.", ".oNo."]


# 槍は長さ25px、握りは穂先から12px（真ん中）。どのコマでも握る位置を変えない
SPEAR_LEN = 25
GRIP = 12


def spear_grip(grip_y, tip_down=False):
    """握り（拳の肌の上の行）を grip_y に置いた縦の槍。"""
    top = grip_y - GRIP
    rows = list(SPEAR_TIP) + [".oMo."] * (SPEAR_LEN - len(SPEAR_TIP) - 2) + [".oNo.", "..o.."]
    patch = P(7, top, rows)
    if tip_down:  # 握りを軸に上下を返す
        k = 2 * grip_y + 1
        patch = [({(x, k - y): ch for (x, y), ch in cells.items()}, lay) for cells, lay in patch]
    return patch


def fist_at(grip_y):
    return P(7, grip_y - 1, [".ooo", "oabbx", "obbcx", ".ooo"])


spear_base_down = spear_grip(18)  # 拳は体の手（y18〜19）
HAND_CAPS_D = P(9, 17, ["o", ".", ".", "o"])  # 体の後ろに槍があるとき、手の上下の輪郭
FIST_BACK_L = P(20, 17, ["ooo.", "obbo", "obco", "ooo."])  # 左向き: 体の奥の手を2px幅で槍の上に


def spear_base():
    front = merge(spear_base_down, fist_at(18))
    return {
        "down": front,
        "right": shift(front, 2),
        "up": merge(relayer(mirror(spear_base_down, 31), "back"), mirror(HAND_CAPS_D, 31)),
        "left": merge(relayer(mirror(spear_base_down, 30), "back"), FIST_BACK_L),
    }
spear_wind_down = merge(spear_grip(14, tip_down=True), fist_at(14))
spear_hit_down = merge(spear_grip(18, tip_down=True), fist_at(18))
spear_wind_up = mirror(merge(spear_grip(19), fist_at(19)), 31)
spear_hit_up = mirror(merge(spear_grip(14), fist_at(14)), 31)


def spear_horizontal(tip_x, shaft_end):
    tip = ["..oo...", ".oSSooo", "oSSTTNM", ".oTTooo", "..oo..."]
    cells = dict(P(tip_x, 15, tip, "back")[0][0])
    for x in range(tip_x + 7, shaft_end + 1):
        cells[(x, 16)] = "o"
        cells[(x, 17)] = "M"
        cells[(x, 18)] = "o"
    if shaft_end < 31:
        cells[(shaft_end + 1, 17)] = "o"
    return [(cells, "back")]


spear_hit_left = spear_horizontal(1, 24)  # 拳は真ん中（x13）で体に隠れる
def fist_h(x0, flip_light=False):
    """横の柄（y17）を握る拳。縦の柄の拳と同じく、柄をまたいで3px（上下に1pxずつはみ出す）× 柄に沿って2px。"""
    rows = [".oo.", "oabo", "obbo", "obco", ".oo."]
    if flip_light:
        rows = [r[::-1].translate(str.maketrans("ac", "ca")) for r in rows]
    return P(x0 - 1, 15, rows)


spear_wind_left = merge(spear_horizontal(7, 30), fist_h(18))


WEAPONS = {
    "axe": {"base": axe_stance, "atk_wind": axe_wind, "atk_hit": axe_hit},
    "spear": {
        "base": spear_base(),
        # right は握る手が体の手前側なので、槍も体の手前。当たりでは手も見える（握りは穂先から12px）
        "atk_wind": {"down": spear_wind_down, "up": spear_wind_up,
                     "left": spear_wind_left, "right": relayer(mirror(spear_wind_left, 31), "front")},
        "atk_hit": {"down": spear_hit_down, "up": spear_hit_up,
                    "left": spear_hit_left,
                    "right": merge(relayer(mirror(spear_hit_left, 30), "front"),
                                   fist_h(16, flip_light=True))},
    },
}
def build_frame(eid, d, st):
    weapon = mf.ENEMIES[eid][4]
    canvas = mf.frame(eid, d, st, weapon="none", hair_back=False)
    key = "base" if st in ("base", "idle2", "walk_a", "walk_b") else st
    patch = WEAPONS[weapon][key][d]
    if mf.ENEMIES[eid][5] == "female":
        dx = FEMALE_SHIFT_WEAPON.get((weapon, key, d), FEMALE_SHIFT[key][d])
        patch = merge(shift(patch, dx), FEMALE_FIX.get((key, d), []))
    apply(canvas, patch, dy=-2 if st == "idle2" else 0)
    hair = mf.ENEMIES[eid][6] if len(mf.ENEMIES[eid]) > 6 else None
    if hair:  # 肩より下の髪は、体の後ろに置いた武器のさらに後ろ（空いている画素だけ）
        mf.overlay(canvas, eb.read_frame(Path(f"cand/enemy/hair_{hair}_back_{d}.txt")), "back")
    if hair and d in FAR:  # 奥の手・腕・武器は髪の後ろ。武器を持たせる前に髪（輪郭を含む）だった画素を戻す（2026-10-08 依頼者の指摘）
        plain = mf.frame(eid, d, st, weapon="none")
        parts = [eb.read_frame(Path(f"cand/enemy/hair_{hair}{s}_{d}.txt")) for s in ("", "_back")]
        for y in range(32):
            for x in range(32):
                drawn = [p[y][x] for p in parts if p[y][x] is not None]
                if plain[y][x] in HAIR_COLOURS or (drawn and plain[y][x] in drawn):  # 頭の部品に隠れた所は戻さない
                    canvas[y][x] = plain[y][x]
    return canvas


def main(ids=None):
    for eid, spec in mf.ENEMIES.items():
        if len(spec) < 5 or spec[4] == "dagger" or (ids and eid not in ids):
            continue
        out = OUT / eid
        ref = out / "noweapon"  # 武器を持たせる前のコマ（weapon_check --ref。奥の手が体や髪の手前に出ていないかを比べる）
        ref.mkdir(parents=True, exist_ok=True)
        for d in DIRS:
            for st in ("base", "idle2", "walk_a", "walk_b", "atk_wind", "atk_hit"):
                f = close_hands(build_frame(eid, d, st), HAND, ARM)[0]  # 手の輪郭を閉じる（2026-10-08）
                (out / f"{d}_{st}.txt").write_text(
                    eb.serialize_frame(f, f"{eid} {d}_{st}（部品で組んだ）"), encoding="utf-8")
                (ref / f"{d}_{st}.txt").write_text(
                    eb.serialize_frame(close_hands(mf.frame(eid, d, st, weapon="none"), HAND, ARM)[0],
                                      f"{eid} {d}_{st} の武器を持たせる前"),
                    encoding="utf-8")
        print("ok", eid)


if __name__ == "__main__":
    main(sys.argv[1:] or None)
