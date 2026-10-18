"""ユニットの確認の設定ファイル checks/<ユニット>.json を読む（2026-10-16）。

設定ファイルは確認の道具（tools/order_check.py ほか）と入口 tools/unit_rules.py が読む。形は
docs/superpowers/specs/2026-10-16-policy-check-tools-design.md の「ユニットごとの設定ファイル」。

    {
      "unit": "gau",
      "compose": "compose/gau.json",
      "body": "male",
      "head_chars": "efgh",
      "items": "stlmn",
      "parts": {"dagger": {"weapon": true, "blade": "st", "moves": true}, ...},
      "orders": {"down": ["CORE", "dagger", ...], ...},
      "eyes": {"down": {"x": [14, 17], "y": [11, 12]}, "up": null, ...},
      "weapon_check": {"blade": [...], "weapon": [...], "hand": [...], "hidden": [...], "depth": [...], "partial": [...]},
      "exceptions": [{"check": "...", "frames": [...], "what": "...", "why": "...", "approved": "2026-10-16 依頼者"}]
    }

手の肌の色は compose の設定の hand_colours を使う（同じ色を2か所に書かない）。
body は素体の型（male・female）。female の体には body_check.py の「はみ出し」を掛けない（2026-10-17 依頼者）。
head_chars は芯に描いた髪・かぶり物の文字（body_check.py が胴のはみ出しと中心から外す。芯に髪・かぶり物を
含めて組んだロラン・イネス・ガウのため。2026-10-16 から髪・かぶり物は別の部品にする）。色でなく文字で書くのは、
ガウの頭巾と胴の服が同じ cloak_dark_* で、文字だけが違う（頭巾 f g h、胴 p q r）ため。
eyes は向きごとの目の画素（x の列と、[上の行, 下の行]）。目の無い向きは null。
知らないキー・無い部品・compose にあるのに parts に無い部品・無いコマ・パレットに無い色名・部品のファイルに無い文字は
UnitConfigError（道具は終了コード 2）。parts の役割:

- weapon: 刃のある武器（blade に刃の文字）。2 切っ先の高さ
- fist: 拳。grips（握る部品）・fist_sizes（手の肌の外接矩形「横x縦」）は 81
- moves: 待機の2コマ目に base から動いてよい。fixed: どのコマでも動かない。3・4
- open_chars: 体の上で輪郭を付けない文字（弓の弦）。33
- head: 髪・かぶり物の部品（ミストから芯と分ける。2026-10-16）。eye_check.py が芯に重ねて目の隣を見る

部品の名前は、部品のファイル名の「_<向き>_」より前（dagger_hand_down_base.txt → dagger_hand）。芯は CORE。
exceptions の check は CHECKS の名前（道具のモジュール名）。
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from dataclasses import dataclass
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from compose import ComposeError, FrameSpec, Layer, load_config, stack_order  # noqa: E402
from gridfile import BACKGROUND, REPO_ROOT, Grid, GridError, load_palette, parse  # noqa: E402

CORE = "CORE"
OUTLINE = "outline"
DIRECTIONS = ("down", "up", "left", "right")
CHECKS = ("validate", "compose", "body_check", "hand_mirror", "unit_check", "weapon_check",
          "order_check", "blade_height", "still_check", "height_check", "tip_check", "part_chars", "eye_check",
          "part_outline", "fist_check")
CONFIG_KEYS = {"unit", "compose", "body", "head_chars", "items", "parts", "orders", "eyes", "weapon_check",
               "exceptions"}
BODIES = ("male", "female")
EYE_KEYS = {"x", "y"}
PART_KEYS = {"weapon", "blade", "fist", "grips", "fist_sizes", "moves", "fixed", "open_chars", "head"}
WEAPON_CHECK_KEYS = {"blade", "weapon", "hand", "hidden", "depth", "partial"}
EXCEPTION_KEYS = {"check", "frames", "what", "why", "approved"}
SIZE_RE = re.compile(r"^(\d+)x(\d+)$")

Point = tuple[int, int]


class UnitConfigError(Exception):
    """設定ファイルの誤り（終了コード 2）。"""


@dataclass
class Part:
    name: str
    layer: Layer
    grid: Grid

    def pixels(self) -> dict[Point, str]:
        """コマの上の位置（dx・dy でずらした後）→ 色名。"""
        return {(x + self.layer.dx, y + self.layer.dy): self.grid.charmap[ch]
                for y, row in enumerate(self.grid.rows) for x, ch in enumerate(row) if ch != BACKGROUND}

    def chars(self) -> dict[Point, str]:
        """コマの上の位置 → 文字。"""
        return {(x + self.layer.dx, y + self.layer.dy): ch
                for y, row in enumerate(self.grid.rows) for x, ch in enumerate(row) if ch != BACKGROUND}


@dataclass
class Frame:
    name: str
    direction: str
    state: str
    core: Grid
    parts: dict[str, Part]          # 部品の名前 → 部品（設定に書いた順）
    order: list[str]                # 奥→手前の部品の名前（芯は CORE）

    def core_pixels(self) -> dict[Point, str]:
        return {(x, y): self.core.charmap[ch] for y, row in enumerate(self.core.rows)
                for x, ch in enumerate(row) if ch != BACKGROUND}


@dataclass
class UnitConfig:
    path: Path
    unit: str
    compose: Path
    hand: frozenset[str]
    body: str  # 素体の型 male・female
    head_chars: frozenset[str]
    items: str
    parts: dict[str, dict]
    orders: dict[str, list[str]]
    eyes: dict[str, frozenset[Point] | None]  # 向き → 目の画素
    weapon_check: dict[str, list[str]] | None
    exceptions: list[dict]
    frames: dict[str, Frame]
    root: Path

    @property
    def unit_dir(self) -> Path:
        return self.root / "assets" / "unit" / self.unit

    def role(self, part: str, key: str):
        return self.parts.get(part, {}).get(key)


def part_name(path: Path, direction: str) -> str:
    marker = f"_{direction}_"
    if marker not in path.stem:
        raise UnitConfigError(f"{path.name}: ファイル名に「{marker}」が無いので部品の名前が分からない")
    return path.stem.split(marker)[0]


def _keys(data, allowed: set[str], where: str) -> None:
    if not isinstance(data, dict):
        raise UnitConfigError(f"{where}: オブジェクトでない")
    unknown = sorted(set(data) - allowed)
    if unknown:
        raise UnitConfigError(f"{where}: 知らないキー {', '.join(unknown)}（使えるのは {', '.join(sorted(allowed))}）")


def _names(value, where: str) -> list[str]:
    if not isinstance(value, list) or not all(isinstance(v, str) and v for v in value):
        raise UnitConfigError(f"{where}: 文字列の配列でない: {value!r}")
    return value


def _coord(value) -> bool:
    return isinstance(value, int) and not isinstance(value, bool) and 0 <= value < 32


def _colours(value, palette, where: str) -> frozenset[str]:
    names = _names(value, where)
    missing = [n for n in names if n not in palette]
    if missing:
        raise UnitConfigError(f"{where}: パレットに無い色名 {', '.join(missing)}")
    return frozenset(names)


def build_frame(name: str, spec: FrameSpec) -> Frame:
    direction, _, state = name.partition("_")
    if direction not in DIRECTIONS or not state:
        raise UnitConfigError(f"{name}: コマの名前が <向き>_<状態> でない")
    core = parse(spec.body)
    parts: dict[str, Part] = {}
    for layer in spec.layers:
        key = part_name(layer.part, direction)
        if key == CORE or key in parts:
            raise UnitConfigError(f"{name}: 部品の名前 {key} が2回ある（または CORE）")
        parts[key] = Part(key, layer, parse(layer.part))
    names = list(parts)
    order = [CORE if i < 0 else names[i] for i in stack_order(spec.layers)]
    return Frame(name, direction, state, core, parts, order)


def load_unit_config(path: Path, root: Path = REPO_ROOT) -> UnitConfig:
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except OSError as exc:
        raise UnitConfigError(f"{path}: 読めない: {exc}") from None
    except json.JSONDecodeError as exc:
        raise UnitConfigError(f"{path}: JSON として読めない: {exc}") from None
    _keys(data, CONFIG_KEYS, str(path))
    missing = sorted(CONFIG_KEYS - set(data))
    if missing:
        raise UnitConfigError(f"{path}: キーが無い {', '.join(missing)}")
    if not isinstance(data["unit"], str) or not isinstance(data["compose"], str):
        raise UnitConfigError(f"{path}: unit と compose は文字列")

    try:
        palette = load_palette()
        compose_path = root / data["compose"]
        unit, specs = load_config(compose_path, root)
        if unit != data["unit"]:
            raise UnitConfigError(f"{path}: unit {data['unit']!r} が {data['compose']} の {unit!r} と違う")
        frames = {name: build_frame(name, spec) for name, spec in specs.items()}
    except (ComposeError, GridError) as exc:
        raise UnitConfigError(str(exc)) from None
    hand = next(iter(specs.values())).hand_colours

    if data["body"] not in BODIES:
        raise UnitConfigError(f"{path.name} の body: male か female（{data['body']!r} だった）")
    if not isinstance(data["head_chars"], str):
        raise UnitConfigError(f"{path.name} の head_chars: 文字列でない")
    core_chars = set().union(*(frame.core.used_chars() for frame in frames.values()))
    absent = sorted(set(data["head_chars"]) - core_chars)
    if absent:
        raise UnitConfigError(f"{path.name} の head_chars: 芯のファイルに無い文字 {''.join(absent)}")
    head_chars = frozenset(data["head_chars"])
    if not isinstance(data["items"], str):
        raise UnitConfigError(f"{path.name} の items: 文字列でない")

    known = {key for frame in frames.values() for key in frame.parts}
    _keys(data["parts"], known, f"{path.name} の parts（部品の名前）")
    unlisted = sorted(known - set(data["parts"]))
    if unlisted:  # 書き忘れた部品が、どの確認にも掛からないまま通らないように
        raise UnitConfigError(f"{path.name} の parts: compose にある部品 {', '.join(unlisted)} が無い（役割が無ければ {{}}）")
    chars_of = {key: set() for key in known}
    for frame in frames.values():
        for key, part in frame.parts.items():
            chars_of[key] |= part.grid.used_chars()
    for key, role in data["parts"].items():
        where = f"{path.name} の parts.{key}"
        _keys(role, PART_KEYS, where)
        for flag in ("weapon", "fist", "moves", "fixed", "head"):
            if not isinstance(role.get(flag, False), bool):
                raise UnitConfigError(f"{where}.{flag}: true か false")
        for text_key in ("blade", "open_chars"):
            text = role.get(text_key, "")
            if not isinstance(text, str):
                raise UnitConfigError(f"{where}.{text_key}: 文字列でない")
            absent = sorted(set(text) - chars_of[key])
            if absent:
                raise UnitConfigError(f"{where}.{text_key}: 部品のファイルに無い文字 {''.join(absent)}")
        if role.get("weapon") and not role.get("blade"):
            raise UnitConfigError(f"{where}: weapon には blade（刃の文字）が要る")
        if "grips" in role and not isinstance(role["grips"], str):
            raise UnitConfigError(f"{where}.grips: 部品の名前（文字列）でない: {role['grips']!r}")
        if "grips" in role and role["grips"] not in known:
            raise UnitConfigError(f"{where}.grips: 無い部品 {role['grips']!r}")
        for size in _names(role.get("fist_sizes", []), f"{where}.fist_sizes"):
            if not SIZE_RE.match(size):
                raise UnitConfigError(f"{where}.fist_sizes: 3x2 の形でない: {size!r}")
        if ("grips" in role or "fist_sizes" in role) and not role.get("fist"):
            raise UnitConfigError(f"{where}: grips・fist_sizes は fist の部品にだけ書ける")
        if role.get("head") and (role.get("weapon") or role.get("fist")):
            raise UnitConfigError(f"{where}: head（髪・かぶり物）は weapon・fist と一緒に書けない")
        # eye_check は手前の部品で上書きして重ねるので、compose の keep（輪郭の下の色を見せる）を真似ない
        if role.get("head") and any(frame.parts[key].layer.keep for frame in frames.values() if key in frame.parts):
            raise UnitConfigError(f"{where}: head の部品に compose の keep は使えない（eye_check が組んだ絵と違う画素を見る）")

    directions = {frame.direction for frame in frames.values()}
    _keys(data["orders"], set(directions), f"{path.name} の orders")
    orders = {}
    for direction in sorted(directions):
        order = _names(data["orders"].get(direction), f"{path.name} の orders.{direction}")
        absent = sorted(set(order) - known - {CORE})
        if absent:
            raise UnitConfigError(f"{path.name} の orders.{direction}: 無い部品 {', '.join(absent)}")
        orders[direction] = order

    _keys(data["eyes"], set(directions), f"{path.name} の eyes")
    eyes = {}
    for direction in sorted(directions):
        if direction not in data["eyes"]:  # 書き忘れた向きの目を黙って見ないままにしない
            raise UnitConfigError(f"{path.name} の eyes.{direction} が無い（目の無い向きは null と書く）")
        value = data["eyes"][direction]
        if value is None:
            eyes[direction] = None
            continue
        where = f"{path.name} の eyes.{direction}"
        _keys(value, EYE_KEYS, where)
        xs, ys = value.get("x"), value.get("y")
        if not (isinstance(xs, list) and xs and all(_coord(v) for v in xs)):
            raise UnitConfigError(f"{where}.x: 目の列（0〜31 の整数の配列）でない: {xs!r}")
        if not (isinstance(ys, list) and len(ys) == 2 and all(_coord(v) for v in ys) and ys[0] <= ys[1]):
            raise UnitConfigError(f"{where}.y: [上の行, 下の行]（0〜31）でない: {ys!r}")
        eyes[direction] = frozenset((x, y) for x in xs for y in range(ys[0], ys[1] + 1))

    weapon_check = data["weapon_check"]
    if weapon_check is not None:
        where = f"{path.name} の weapon_check"
        _keys(weapon_check, WEAPON_CHECK_KEYS, where)
        weapon_check = {key: _names(value, f"{where}.{key}") for key, value in weapon_check.items()}
        for key in ("blade", "weapon", "hand"):
            _colours(weapon_check.get(key, []), palette, f"{where}.{key}")
        for key in ("blade", "hand"):
            if not weapon_check.get(key):
                raise UnitConfigError(f"{where}.{key}: 空にできない")
        for key in ("hidden", "partial"):
            absent = sorted(set(weapon_check.get(key, [])) - set(frames))
            if absent:
                raise UnitConfigError(f"{where}.{key}: 無いコマ {', '.join(absent)}")
        absent = sorted(set(weapon_check.get("depth", [])) - set(DIRECTIONS))
        if absent:
            raise UnitConfigError(f"{where}.depth: 向きでない {', '.join(absent)}")

    if not isinstance(data["exceptions"], list):
        raise UnitConfigError(f"{path.name} の exceptions: 配列でない")
    for i, exception in enumerate(data["exceptions"]):
        where = f"{path.name} の exceptions[{i}]"
        _keys(exception, EXCEPTION_KEYS, where)
        if sorted(EXCEPTION_KEYS - set(exception)):
            raise UnitConfigError(f"{where}: キーが無い {', '.join(sorted(EXCEPTION_KEYS - set(exception)))}")
        if exception["check"] not in CHECKS:
            raise UnitConfigError(f"{where}.check: 知らない確認 {exception['check']!r}（{', '.join(CHECKS)}）")
        _names(exception["frames"], f"{where}.frames")
        for key in ("what", "why", "approved"):
            if not isinstance(exception[key], str) or not exception[key]:
                raise UnitConfigError(f"{where}.{key}: 空でない文字列")

    return UnitConfig(path, data["unit"], compose_path, hand, data["body"], head_chars, data["items"], data["parts"], orders, eyes,
                      weapon_check, data["exceptions"], frames, root)


def run_check(argv: list[str] | None, description: str, check, ok_message: str) -> int:
    """確認の道具の共通の main。check(cfg) -> [(名前, 文言)]。FAIL を1行ずつ出し、あれば終了コード 1。"""
    parser =argparse.ArgumentParser(description=description, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("config", type=Path, help="checks/<ユニット>.json")
    parser.add_argument("--root", type=Path, default=REPO_ROOT, help="設定のパスの基準（既定はリポジトリの直下）")
    args = parser.parse_args(argv)
    try:
        cfg = load_unit_config(args.config, args.root)
        failures = check(cfg)
    except UnitConfigError as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 2
    for name, message in failures:
        print(f"FAIL {name}: {message}")
    if failures:
        return 1
    print(ok_message)
    return 0


def points(found) -> str:
    return " ".join(f"({x},{y})" for x, y in sorted(found, key=lambda p: (p[1], p[0])))
