#!/usr/bin/env python3
"""味方の完成したコマを色替えして、敵のシートを作る。

    tools/enemy_build.py enemy/dagger-red-m.json
    tools/enemy_build.py --all

レシピ（enemy/<id>.json）の形と、設計の経緯は
docs/superpowers/specs/2026-10-06-enemy-variants-design.md と
docs/superpowers/plans/2026-10-06-enemy-variants.md を参照。
"""
from __future__ import annotations

import json
import re
import sys
from dataclasses import dataclass
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from gridfile import BACKGROUND, REPO_ROOT, GridError, parse  # noqa: E402

Frame = list[list["str | None"]]

# 'o' は輪郭に使うので割り当てから外す
LETTERS = "abcdefghijklmnpqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ"
MAP_ENTRIES_PER_LINE = 4


class EnemyError(Exception):
    """レシピや元のコマが、組み立ての前提に合わない。"""


def read_frame(path: Path) -> Frame:
    grid = parse(path)
    frame: Frame = []
    for row in grid.rows:
        cells: list[str | None] = []
        for ch in row:
            if ch == BACKGROUND:
                cells.append(None)
            elif ch in grid.charmap:
                cells.append(grid.charmap[ch])
            else:
                raise EnemyError(f"{path.name}: 文字 {ch!r} に色が割り当てられていない")
        frame.append(cells)
    return frame


def recolor_frame(frame: Frame, mapping: dict[str, str]) -> Frame:
    """色名を同時に置き換える（A→B と B→A を同時に書いても入れ替わるだけ）。"""
    return [[mapping.get(c, c) if c is not None else None for c in row] for row in frame]


def serialize_frame(frame: Frame, note: str) -> str:
    if ":" in note:
        raise EnemyError(f"注記に半角コロンは書けない（ヘッダと読まれる）: {note!r}")
    names: list[str] = []
    for row in frame:
        for c in row:
            if c is not None and c not in names:
                names.append(c)
    letters = iter(LETTERS)
    chars = {name: "o" if name == "outline" else next(letters) for name in names}
    entries = [f"{chars[name]}={name}" for name in names]
    lines = [
        f"# {note}",
        "# type: unit",
        f"# size: {len(frame[0])}x{len(frame)}",
        "# light: upper-left",
        "# bg: transparent",
    ]
    for i in range(0, len(entries), MAP_ENTRIES_PER_LINE):
        lines.append("# map: " + " ".join(entries[i : i + MAP_ENTRIES_PER_LINE]))
    lines += ["".join(chars[c] if c is not None else BACKGROUND for c in row) for row in frame]
    return "\n".join(lines) + "\n"


ENEMY_DIR = REPO_ROOT / "enemy"
ARCHETYPES = {"dagger": "sheets/gau.txt"}
BODIES = ("male", "female")
SOURCES = {
    ("dagger", "male"): "assets/unit/gau",
    ("dagger", "female"): "assets/unit/enemy-src/dagger-female",
}
RECIPE_KEYS = {"id", "name", "archetype", "body", "recolor"}
ID_RE = re.compile(r"[a-z0-9]+(-[a-z0-9]+)*")


@dataclass(frozen=True)
class Recipe:
    id: str
    name: str
    archetype: str
    body: str
    recolor: dict[str, str]
    path: Path | None = None


def load_recipe(path: Path, palette: dict) -> Recipe:
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except OSError as exc:
        raise EnemyError(f"{path}: 読めない: {exc}") from None
    except json.JSONDecodeError as exc:
        raise EnemyError(f"{path}: JSON として読めない: {exc}") from None
    where = path.name
    if not isinstance(data, dict):
        raise EnemyError(f"{where}: オブジェクトでない")
    unknown = sorted(set(data) - RECIPE_KEYS)
    if unknown:
        raise EnemyError(f"{where}: 知らないキー {', '.join(unknown)}（使えるのは {', '.join(sorted(RECIPE_KEYS))}）")
    for key in ("id", "name", "archetype", "body"):
        if not isinstance(data.get(key), str) or not data[key]:
            raise EnemyError(f"{where}: {key} が無いか、文字列でない")
    if not ID_RE.fullmatch(data["id"]):
        raise EnemyError(f"{where}: id は小文字・数字・ハイフンだけ（{data['id']!r} だった）")
    if data["id"] != path.stem:
        raise EnemyError(f"{where}: id {data['id']!r} がファイル名 {path.stem!r} と違う（ファイル名は <id>.json）")
    if data["archetype"] not in ARCHETYPES:
        raise EnemyError(f"{where}: archetype は {', '.join(ARCHETYPES)} のどれか（{data['archetype']!r} だった）")
    if data["body"] not in BODIES:
        raise EnemyError(f"{where}: body は {', '.join(BODIES)} のどちらか（{data['body']!r} だった）")
    recolor = data.get("recolor", {})
    if not isinstance(recolor, dict) or not all(isinstance(k, str) and isinstance(v, str) for k, v in recolor.items()):
        raise EnemyError(f"{where}: recolor は 色名 → 色名 のオブジェクトにする")
    bad = sorted({name for pair in recolor.items() for name in pair if name not in palette})
    if bad:
        raise EnemyError(f"{where}: recolor にパレットに無い色名 {', '.join(bad)}")
    return Recipe(data["id"], data["name"], data["archetype"], data["body"], dict(recolor), path)


def source_paths(recipe: Recipe, root: Path = REPO_ROOT) -> tuple[Path, Path]:
    """(元のコマの置き場, シート定義)。"""
    return root / SOURCES[(recipe.archetype, recipe.body)], root / ARCHETYPES[recipe.archetype]
