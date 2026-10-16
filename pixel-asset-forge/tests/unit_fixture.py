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
from test_compose import Workspace, grid_text  # noqa: E402

MAPS = {
    "core": "o=outline b=skin_base c=cloak_dark_base",
    "sword": "o=outline i=stone_hi k=wood_base",
    "sword_hand": "o=outline a=skin_hi",
    "shield": "o=outline m=metal_hi",
}
HAND_COLOURS = ["skin_hi"]


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
    return pixels


def sword_hand(dy: int = 0) -> dict:
    return box(20, 13 + dy, 24, 16 + dy, "a")  # 手の肌は x=21〜23・y=14〜15 の 3x2


def shield() -> dict:
    return box(7, 18, 10, 23, "m")


def mirror(pixels: dict) -> dict:
    return {(31 - x, y): ch for (x, y), ch in pixels.items()}


def default_frames() -> dict[str, dict]:
    walk = core()
    walk[(13, 29)] = "b"  # 脚だけ動かす
    down = {
        "down_base": {"core": core(), "sword": sword(), "sword_hand": sword_hand(), "shield": shield()},
        "down_idle2": {"core": core(), "sword": sword(-2), "sword_hand": sword_hand(-2), "shield": shield()},
        "down_walk_a": {"core": walk, "sword": sword(), "sword_hand": sword_hand(), "shield": shield()},
        "down_atk_hit": {"core": core(), "sword": sword(-4), "sword_hand": sword_hand(-4), "shield": shield()},
    }
    up = {name.replace("down_", "up_"): {key: mirror(pixels) for key, pixels in layers.items()}
          for name, layers in down.items()}
    return {**down, **up}


def default_checks() -> dict:
    order = ["CORE", "sword", "sword_hand", "shield"]
    return {
        "unit": "t",
        "compose": "compose/t.json",
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
    """frames: コマの名前 → {"core": 画素, 部品の名前: 画素}（部品は書いた順に front で重ねる）。"""

    def __init__(self) -> None:
        self.ws = Workspace()
        self.root = self.ws.root
        self.frames = default_frames()
        self.checks = default_checks()
        self.maps = dict(MAPS)

    def close(self) -> None:
        self.ws.close()

    def write(self, build: bool = True) -> Path:
        """グリッド・compose/t.json・checks/t.json を書き、build なら assets/unit/t/ にコマを組む。設定のパスを返す。"""
        frames = {}
        for name, layers in self.frames.items():
            direction, state = name.split("_", 1)
            body = self.ws.write(f"assets/part/body/t/core_{name}.txt", grid_text(layers["core"], self.maps["core"]))
            parts = []
            for key, pixels in layers.items():
                if key == "core":
                    continue
                path = self.ws.write(f"assets/part/x/{key}_{direction}_{state}.txt",
                                     grid_text(pixels, self.maps[key]))
                layer = {"part": str(path), "z": "front"}
                if key.endswith("_hand"):
                    layer["hand"] = True
                parts.append(layer)
            frames[name] = {"body": str(body), "layers": parts}
        compose_path = self.ws.write("compose/t.json", json.dumps(
            {"unit": "t", "hand_colours": HAND_COLOURS, "frames": frames}))
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
