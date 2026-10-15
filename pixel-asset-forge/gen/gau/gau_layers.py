"""ガウの今のコマ（assets/unit/gau、部品を持たない完成した絵）を部品に書き出す（2026-10-15。描き直す前に一度だけ使う）。

描き直した後は走らせない。描き直した部品（assets/part/ の body/gau の core_*・equip/dagger の dagger_<向き>_<状態>・fist/gau）と
compose/gau.json を、切り出した部品で上書きしてしまう。

    .venv/bin/python gen/gau/gau_layers.py --export

文字で切る（tools/parts_export.py）。拳の箱は、今の絵の y>=15 の肌の塊を 2026-10-15 に数えて決めた（down の首 y=15 は入れない）。
歩きは立ち（base）の部品を使い回す。計画: character-tactics の docs/superpowers/plans/2026-10-15-unit-parts-gau.md
"""
import sys
from pathlib import Path

sys.path.insert(0, "tools")
from cut_layers import CORE  # noqa: E402
from parts_export import NONE, PartDef, UnitDef, export  # noqa: E402

DIRS = ("down", "up", "left", "right")
STATES = ("base", "idle2", "walk_a", "walk_b", "atk_wind", "atk_hit")
DRAWN = ("base", "idle2", "atk_wind", "atk_hit")  # 部品を持つ状態（歩きは base）
SKIN = frozenset("abc")
GRIPPED = ("stone_hi", "stone_base", "wood_hi", "wood_base", "wood_shadow")  # 短剣（拳の輪郭はこの上に描かない）

DAGGER_HAND = {
    ("down", "base"): (8, 18, 10, 19), ("down", "idle2"): (8, 16, 10, 17),
    ("down", "atk_wind"): (8, 18, 9, 19), ("down", "atk_hit"): (8, 18, 10, 19),
    ("up", "base"): (21, 18, 23, 19), ("up", "idle2"): (21, 16, 23, 17),
    ("up", "atk_wind"): (21, 17, 23, 18), ("up", "atk_hit"): NONE,  # 体に隠れる
    ("left", "base"): (21, 18, 22, 19), ("left", "idle2"): (21, 16, 22, 17),
    ("left", "atk_wind"): (21, 16, 21, 17), ("left", "atk_hit"): (8, 17, 9, 18),
    ("right", "base"): (10, 18, 12, 19), ("right", "idle2"): (10, 16, 12, 17),
    ("right", "atk_wind"): (10, 17, 12, 18), ("right", "atk_hit"): (21, 17, 22, 18),
}
FREE_HAND = {
    **{("down", st): (21, 20, 22, 21) for st in DRAWN},
    **{("up", st): (9, 20, 10, 21) for st in DRAWN},
    **{("left", st): (11, 20, 12, 21) for st in DRAWN},
    **{("right", st): NONE for st in DRAWN},  # 奥の手が体に隠れる
}

# 重なり順（奥→手前）。向きごとに6コマとも同じ
ORDERS = {
    "down": (CORE, "短剣", "短剣の拳", "空き手の拳"),
    "up": ("短剣", "短剣の拳", "空き手の拳", CORE),
    "left": ("短剣", "短剣の拳", CORE, "空き手の拳"),
    "right": ("空き手の拳", CORE, "短剣", "短剣の拳"),
}

GAU = UnitDef(
    unit="gau", src=Path("assets/unit/gau"), dirs=DIRS, states=STATES,
    shares={"walk_a": "base", "walk_b": "base"},
    parts=(PartDef("短剣", "dagger", frozenset("stlmn"), dir="equip/dagger"),
           PartDef("短剣の拳", "dagger_hand", SKIN, DAGGER_HAND, hand=True,
                   keep=GRIPPED, dir="fist/gau"),
           PartDef("空き手の拳", "free_hand", SKIN, FREE_HAND, hand=True,
                   dir="fist/gau")),  # 何も握らないので keep は無い（書き出した時は GRIPPED。2026-10-15 に compose/gau.json から外した）
    orders=ORDERS,
    hand_colours=("skin_rose_hi", "skin_rose_base", "skin_rose_shadow"),
)


def main(argv):
    if argv != ["--export"]:
        print(__doc__, file=sys.stderr)
        return 2
    export(GAU, Path("assets/part"), Path("compose/gau.json"), Path("."))
    print("書き出した assets/part/ の短剣・拳・芯と compose/gau.json")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
