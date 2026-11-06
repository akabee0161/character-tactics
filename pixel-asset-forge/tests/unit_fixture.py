"""ユニットの確認（tools/unit_config.py・unit_rules.py と各確認の道具）のテストで使う、小さなユニット。

既定のユニット t は down と up（up は down の左右反転）の4状態（base・idle2・walk_a・atk_hit）で、
芯（箱）・剣（刃と柄）・剣の拳（3x2）・盾を持ち、どの確認も通る。テストは frames や config を書き換えてから write() する。
グリッドは一時フォルダに置く（assets/ の絵を読まない。CLAUDE.md「回帰テストに現役のアートを参照させない」）。
"""
from __future__ import annotations

import contextlib
import io
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "tools"))
sys.path.insert(0, str(Path(__file__).resolve().parent))

from compose import main as compose_main  # noqa: E402
from test_compose import Workspace  # noqa: E402

MAPS = {
    "core": "o=contour b=skin_fair_base c=clothes_dark_base",
    "sword": "o=contour i=blade_hi k=weapon_shaft_base",
    "sword_hand": "o=contour a=skin_fair_hi",
    "shield": "o=contour m=shield_hi",
}


def box(x0: int, y0: int, x1: int, y1: int, fill: str) -> dict[tuple[int, int], str]:
    """輪郭 o で囲った箱。中を fill で塗る。"""
    return {(x, y): "o" if x in (x0, x1) or y in (y0, y1) else fill
            for y in range(y0, y1 + 1) for x in range(x0, x1 + 1)}


def core(top: int = 5) -> dict:
    return box(12, top, 19, 30, "c")


def sword(dy: int = 0) -> dict:
    pixels = box(21, 5 + dy, 23, 16 + dy, "k")
    for y in range(6 + dy, 13 + dy):
        pixels[(22, y)] = "i"  # 刃は y=6〜12、柄は y=13〜15
    del pixels[(21, 5 + dy)], pixels[(23, 5 + dy)]  # 先端は中身1の決まりの形（蓋の黒は1画素。tip_rule.py）
    return pixels


def sword_hand(dy: int = 0) -> dict:
    return box(20, 13 + dy, 24, 16 + dy, "a")  # 手の肌は x=21〜23・y=14〜15 の 3x2


def shield() -> dict:
    return box(7, 18, 10, 23, "m")


def core48(top: int = 8) -> dict:
    """48px のコマの芯（足元 y=46、既定は背丈 39px）。"""
    return box(20, top, 27, 46, "c")


SHIFT_48 = (8, 16)  # 48px の既定のコマは、32px の部品を右へ 8・下へ 16 ずらす（芯は core48）


def shifted(pixels: dict, dx: int = SHIFT_48[0], dy: int = SHIFT_48[1]) -> dict:
    return {(x + dx, y + dy): ch for (x, y), ch in pixels.items()}


def mirror(pixels: dict, size: int = 32) -> dict:
    return {(size - 1 - x, y): ch for (x, y), ch in pixels.items()}


def default_frames(size: int = 32) -> dict[str, dict]:
    """size=48 なら、部品を SHIFT_48 だけずらし、芯を core48 にする（どの確認も通る 48px のユニット）。"""
    if size == 48:
        body, move = core48, shifted
    else:
        body, move = core, (lambda pixels: pixels)
    walk = body()
    walk.update(move({(13, 29): "b"}))  # 脚だけ動かす
    down = {
        "down_base": {"core": body(), "sword": move(sword()), "sword_hand": move(sword_hand()), "shield": move(shield())},
        "down_idle2": {"core": body(), "sword": move(sword(-2)), "sword_hand": move(sword_hand(-2)),
                       "shield": move(shield())},
        "down_walk_a": {"core": walk, "sword": move(sword()), "sword_hand": move(sword_hand()), "shield": move(shield())},
        "down_atk_hit": {"core": body(), "sword": move(sword(-4)), "sword_hand": move(sword_hand(-4)),
                         "shield": move(shield())},
    }
    up = {name.replace("down_", "up_"): {key: mirror(pixels, size) for key, pixels in layers.items()}
          for name, layers in down.items()}
    return {**down, **up}


def grid(pixels: dict[tuple[int, int], str], maps: str, width: int, height: int) -> str:
    """幅と高さを別に書けるグリッド（test_compose.grid_text は正方形だけ）。"""
    rows = [["."] * width for _ in range(height)]
    for (x, y), ch in pixels.items():
        rows[y][x] = ch
    header = f"# type: unit\n# size: {width}x{height}\n# light: upper-left\n# bg: transparent\n"
    return header + f"# map: {maps}\n" + "\n".join("".join(r) for r in rows) + "\n"


def default_checks() -> dict:
    order = ["CORE", "sword", "sword_hand", "shield"]
    return {
        "unit": "t",
        "compose": "compose/t.json",
        "body": "male",
        "head_chars": "",
        "items": "ikm",
        "parts": {
            "sword": {"weapon": True, "blade": "i", "moves": True},
            "sword_hand": {"fist": True, "grips": "sword", "fist_sizes": ["3x2"], "moves": True},
            "shield": {"fixed": True},
        },
        "orders": {"down": list(order), "up": list(order)},
        "eyes": {"down": None, "up": None},
        "weapon_check": None,
        "exceptions": [],
    }


class UnitFixture:
    """frames: コマの名前 → {"core": 画素, 部品の名前: 画素}（部品は書いた順に front で重ねる。back に挙げた部品の名前は back）。"""

    def __init__(self, size: int = 32) -> None:
        self.ws = Workspace()
        self.root = self.ws.root
        self.size = size
        self.frame_size: dict[str, tuple[int, int]] = {}  # コマの名前 → (幅, 高さ)。無ければ (size, size)
        self.frames = default_frames(size)
        self.checks = default_checks()
        self.maps = dict(MAPS)
        self.back: set[str] = set()
        self.keep: dict[str, list[str]] = {}  # 部品の名前 → compose の keep（種類の並び）
        self.shift: dict[str, tuple[int, int]] = {}  # 部品の名前 → compose の (dx, dy)

    def close(self) -> None:
        self.ws.close()

    def write(self, build: bool = True) -> Path:
        """グリッド・compose/t.json・checks/t.json を書き、build なら assets/unit/t/ にコマを組む。設定のパスを返す。"""
        frames = {}
        for name, layers in self.frames.items():
            direction, state = name.split("_", 1)
            width, height = self.frame_size.get(name, (self.size, self.size))
            body = self.ws.write(f"assets/part/body/t/core_{name}.txt", grid(layers["core"], self.maps["core"], width, height))
            parts = []
            for key, pixels in layers.items():
                if key == "core":
                    continue
                path = self.ws.write(f"assets/part/x/{key}_{direction}_{state}.txt",
                                     grid(pixels, self.maps[key], width, height))
                layer = {"part": str(path), "z": "back" if key in self.back else "front"}
                if key in self.keep:
                    layer["keep"] = self.keep[key]
                if key in self.shift:
                    layer["dx"], layer["dy"] = self.shift[key]
                if key.endswith("_hand"):
                    layer["hand"] = True
                parts.append(layer)
            frames[name] = {"body": str(body), "layers": parts}
        compose_path = self.ws.write("compose/t.json", json.dumps(
            {"unit": "t", "frames": frames}))
        if build:
            with contextlib.redirect_stdout(io.StringIO()):
                code = compose_main([str(compose_path), "--out", str(self.root / "assets/unit/t"), "--force"])
            assert code == 0, "既定のユニットが組めない"
        return self.ws.write("checks/t.json", json.dumps(self.checks, ensure_ascii=False))

    def run(self, main, *extra: str) -> tuple[int, str]:
        """道具の main を設定のパスで呼び、(終了コード, stdout と stderr) を返す。"""
        path = self.write()
        out = io.StringIO()
        with contextlib.redirect_stdout(out), contextlib.redirect_stderr(out):
            code = main([str(path), "--root", str(self.root), *extra])
        return code, out.getvalue()
