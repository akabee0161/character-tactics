#!/usr/bin/env python3
"""left と right の同じ状態のコマで、拳が握る部品の位置が左右反転で合っているかを確かめる（2026-10-27）。

    .venv/bin/python tools/weapon_mirror.py checks/roran.json

比べる部品は、設定ファイルの parts で fist の部品の grips に書かれた部品（剣・盾・短剣・弓・矢）。
髪・かぶり物や役割の無い部品は比べない。部品の空でない画素の位置（dx・dy を足したコマの上の位置）を、
right を x → 31 − x で反転して集合として比べる。色は比べない（光源が左上に固定なので、反転した部品は陰の付き方が変わる）。
体や手前の物に隠れる画素も比べる。両方の部品が空なら合っているとみなす。down と up は比べない（2026-10-25 依頼者）。

拳の位置は hand_mirror.py が攻撃以外のコマで比べる（2026-10-12「攻撃は動きの表現で位置がずれることが多い」）。
武器は攻撃のコマも比べる。今の絵で武器のずれた3件が、どれも直すべきずれだったため（2026-10-27 依頼者）。
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from unit_config import UnitConfig, points, run_check  # noqa: E402


def _positions(found) -> str:
    return points(found) if found else "なし"


def check(cfg: UnitConfig) -> list[tuple[str, str]]:
    gripped = sorted({role["grips"] for role in cfg.parts.values() if role.get("fist") and role.get("grips")})
    states = {"left": {}, "right": {}}
    for frame in cfg.frames.values():
        if frame.direction in states:
            states[frame.direction][frame.state] = frame
    failures = []
    for state in sorted(set(states["left"]) | set(states["right"])):
        left, right = states["left"].get(state), states["right"].get(state)
        if left is None or right is None:
            mine, theirs = ("right", "left") if left is None else ("left", "right")
            failures.append((f"{mine}_{state}", f"組になる {theirs}_{state} が無い"))
            continue
        for key in gripped:
            if key not in left.parts and key not in right.parts:
                continue
            if key not in left.parts or key not in right.parts:
                missing = right.name if key in left.parts else left.name
                failures.append((left.name, f"{key} が {missing} に無い"))
                continue
            mine = set(left.parts[key].pixels())
            theirs = {(31 - x, y) for x, y in right.parts[key].pixels()}
            if mine == theirs:
                continue
            if not mine or not theirs:
                failures.append((left.name, f"{key} が {'left' if not mine else 'right'} では空"))
                continue
            failures.append((left.name, f"{key} の位置が right の反転と合わない"
                                        f"（left だけ {_positions(mine - theirs)}、right 反転だけ {_positions(theirs - mine)}）"))
    return failures


def notes(cfg: UnitConfig) -> list[tuple[str, str]]:
    """weapon の部品で、どの拳の grips にも無いもの（grips の書き忘れで、何も比べずに ok になるのを見えるように）。"""
    gripped = {role.get("grips") for role in cfg.parts.values() if role.get("fist")}
    return [(key, "weapon だが、どの拳の grips にも無いので left と right を比べない")
            for key, role in sorted(cfg.parts.items()) if role.get("weapon") and key not in gripped]


def main(argv: list[str] | None = None) -> int:
    return run_check(argv, __doc__, check, "武器の位置（left と right）: ok", notes)


if __name__ == "__main__":
    raise SystemExit(main())
