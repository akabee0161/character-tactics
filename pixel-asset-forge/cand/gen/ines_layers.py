"""イネスの今のコマ（assets/unit/ines、部品を持たない完成した絵）を部品に書き出す（2026-10-12。描き直す前に一度だけ使う）。

    .venv/bin/python cand/gen/ines_layers.py --export

文字で切る（tools/parts_export.py）。拳の箱は、今の絵の肌の小さな塊を 2026-10-12 に数えて決めた。
歩きは立ち（base）の部品を使い回す。計画: character-tactics の docs/superpowers/plans/2026-10-12-unit-parts-ines.md
"""
import sys
from pathlib import Path

sys.path.insert(0, "tools")
from cut_layers import CORE  # noqa: E402
from parts_export import NONE, PartDef, UnitDef, export  # noqa: E402

DIRS = ("down", "up", "left", "right")
STATES = ("base", "idle2", "walk_a", "walk_b", "atk_wind", "atk_draw", "atk_hit", "atk_release")
DRAWN = ("base", "idle2", "atk_wind", "atk_draw", "atk_hit", "atk_release")  # 部品を持つ状態（歩きは base）
SKIN = frozenset("abc")
GRIPPED = ("wood_hi", "wood_base", "wood_shadow", "stone_hi", "stone_base", "water_base")  # 弓・弦・矢（拳の輪郭はこの上に描かない）
ATK = ("atk_wind", "atk_draw", "atk_hit", "atk_release")

BOW_HAND = {
    **{("down", st): (20, 20, 21, 21) for st in ("base", "idle2")},
    **{("down", st): (19, 20, 20, 21) for st in ATK},
    **{("up", st): (10, 20, 11, 21) for st in ("base", "idle2")},
    **{("up", st): (9, 16, 10, 17) for st in ATK},
    **{("left", st): (6, 19, 7, 20) for st in DRAWN},
    **{("right", st): (24, 19, 25, 20) for st in DRAWN},
}
ARROW_HAND = {
    ("down", "base"): (15, 19, 16, 20), ("down", "idle2"): (13, 19, 14, 20),
    ("down", "atk_wind"): (15, 19, 16, 20), ("down", "atk_draw"): (13, 17, 14, 18),
    ("down", "atk_hit"): (11, 15, 12, 16), ("down", "atk_release"): (10, 14, 11, 15),
    **{("up", st): NONE for st in DRAWN},  # 矢を持つ拳は見せない
    ("left", "base"): (10, 17, 11, 17), ("left", "idle2"): (12, 17, 13, 18), ("left", "atk_wind"): (11, 17, 11, 17),
    **{("left", st): NONE for st in ("atk_draw", "atk_hit", "atk_release")},  # 体に隠れる
    ("right", "base"): (20, 17, 21, 18), ("right", "idle2"): (18, 17, 19, 18),
    ("right", "atk_wind"): (19, 17, 20, 18), ("right", "atk_draw"): (17, 17, 18, 18),
    ("right", "atk_hit"): (15, 17, 16, 18), ("right", "atk_release"): (14, 17, 15, 18),
}

# 重なり順（奥→手前）。向きごとに8コマとも同じ
ORDERS = {
    "down": (CORE, "弓", "矢", "弓の拳", "矢の拳"),
    "up": ("矢", "矢の拳", "弓", "弓の拳", CORE),
    "left": ("弓", "矢", "矢の拳", CORE, "弓の拳"),  # 2026-10-12 依頼者が変更（部品を完全に描くと弦が胴に、奥の拳が弦の下に出たため）
    "right": ("弓", "弓の拳", CORE, "矢", "矢の拳"),
}

INES = UnitDef(
    unit="ines", src=Path("assets/unit/ines"), dirs=DIRS, states=STATES,
    shares={"walk_a": "base", "walk_b": "base"},
    parts=(PartDef("弓", "bow", frozenset("klms")),
           PartDef("矢", "arrow", frozenset("wtu")),
           PartDef("弓の拳", "bow_hand", SKIN, BOW_HAND, hand=True,
                   keep=GRIPPED),
           PartDef("矢の拳", "arrow_hand", SKIN, ARROW_HAND, hand=True,
                   keep=GRIPPED)),
    orders=ORDERS,
    hand_colours=("skin_hi", "skin_base", "skin_shadow"),
)


def main(argv):
    if argv != ["--export"]:
        print(__doc__, file=sys.stderr)
        return 2
    export(INES, Path("assets/unit/ines/parts"), Path("compose/ines.json"), Path("."))
    print("書き出した assets/unit/ines/parts と compose/ines.json")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
