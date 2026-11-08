"""unit の体の比率の値を、コマの大きさ（32px か 48px）から引く（2026-11-06）。

32px の値は、それまで各道具が定数で持っていた値そのまま。48px（ガルム）の値は、32px の値を1.5倍にする（2026-11-06 依頼者の判断）。
行の値は足元からの距離を1.5倍して移し、足元はゲームの FOOT_INSET = 2（コマの下から2px）を保った y=46（Claude の判断）。
端数は体を測る範囲が狭くならない側へ丸める。blade_top は foot − max_height + 1（背丈の上限の頭頂）、
idle2_blade_top は blade_top − 3（32px の2行 ×1.5）、walk_outline_row は walk_leg_top − 1。

| 名前 | 32px | 48px | 使う道具 |
|---|---|---|---|
| foot 足元の行 | 30 | 46 | height_check・sheet.py |
| min_height〜max_height 背丈 | 24〜26 | 36〜39 | height_check |
| leg_top 脚の中心を測る上端 | 24 | 37 | unit_check |
| walk_leg_top 歩きで動いてよい脚の上端 | 28 | 43 | still_check |
| walk_outline_row 上げた足の上の輪郭の行 | 27 | 42 | still_check |
| blade_top 待機・歩きの切っ先の上限 | 5 | 8 | blade_height |
| idle2_blade_top 待機2コマ目の上限 | 3 | 5 | blade_height |
| bands 頭・胴・脚の行 | (3,14) (15,24) (25,31) | (5,22) (23,37) (38,47) | body_check・head_cover_check |
| hand_max 手とみなす肌の塊の上限（画素） | 12 | 27（面積なので 1.5²倍） | weapon_check・hand_outline |

設計: character-tactics の docs/superpowers/specs/2026-11-06-garum-unit-design.md
"""
from __future__ import annotations

from dataclasses import dataclass


class ScaleError(Exception):
    """比率の表に無いコマの大きさ。"""


@dataclass(frozen=True)
class Scale:
    size: int
    foot: int
    min_height: int
    max_height: int
    leg_top: int
    walk_leg_top: int
    walk_outline_row: int
    blade_top: int
    idle2_blade_top: int
    bands: dict[str, tuple[int, int]]
    hand_max: int  # 手（拳の肌の塊）とみなす大きさの上限（画素の数）


SCALES = {
    32: Scale(32, foot=30, min_height=24, max_height=26, leg_top=24, walk_leg_top=28, walk_outline_row=27,
              blade_top=5, idle2_blade_top=3, bands={"head": (3, 14), "trunk": (15, 24), "legs": (25, 31)},
              hand_max=12),
    48: Scale(48, foot=46, min_height=36, max_height=39, leg_top=37, walk_leg_top=43, walk_outline_row=42,
              blade_top=8, idle2_blade_top=5, bands={"head": (5, 22), "trunk": (23, 37), "legs": (38, 47)},
              hand_max=27),
}
SIZES = tuple(SCALES)


def scale_for(size: int) -> Scale:
    try:
        return SCALES[size]
    except KeyError:
        raise ScaleError(f"コマの大きさ {size}px の比率の表が無い（unit のコマは 32 か 48。tools/unit_scale.py）") from None
