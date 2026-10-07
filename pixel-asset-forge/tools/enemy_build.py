#!/usr/bin/env python3
"""味方の完成したコマを色替えして、敵のシートを作る。

    tools/enemy_build.py enemy/dagger-bandit.json
    tools/enemy_build.py --all

レシピ（enemy/<id>.json）の形と、設計の経緯は
docs/superpowers/specs/2026-10-06-enemy-variants-design.md と
docs/superpowers/plans/2026-10-06-enemy-variants.md を参照。
"""
from __future__ import annotations

import argparse
import json
import re
import shutil
import sys
from dataclasses import dataclass
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import sheet  # noqa: E402
from gridfile import BACKGROUND, REPO_ROOT, GridError, display, load_palette, parse  # noqa: E402

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
BUILD_ROOT = REPO_ROOT / "build" / "enemy"
SHEET_DIR = REPO_ROOT / "build" / "sheets"
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


def _sheet_rows(sheet_def: Path) -> list[list[str | None]]:
    """シート定義を読み、`# frames:` の宣言と合うか確かめる（sheet.py の関数は SystemExit で止まるので、EnemyError にする）。"""
    try:
        rows = sheet.read_sheet(sheet_def)
        declared = sheet.read_frames_declaration(sheet_def)
    except SystemExit as exc:
        raise EnemyError(str(exc)) from None
    if declared is not None:
        problems = sheet.check_columns(rows, declared)
        if problems:
            raise EnemyError(f"{display(sheet_def)}: " + " / ".join(problems))
    return rows


def _frame_names(rows: list[list[str | None]]) -> list[str]:
    return sorted({name for row in rows for name in row if name})


def _used(frames) -> set[str]:
    return {c for frame in frames for row in frame for c in row if c is not None}


def source_colours(source_dir: Path, sheet_def: Path) -> set[str]:
    names = _frame_names(_sheet_rows(sheet_def))
    return _used(read_frame(source_dir / f"{name}.txt") for name in names)


def build(recipe: Recipe, source_dir: Path, sheet_def: Path, palette: dict,
          build_root: Path = BUILD_ROOT, sheet_dir: Path = SHEET_DIR) -> Path:
    rows = _sheet_rows(sheet_def)
    names = _frame_names(rows)
    frames = {name: read_frame(source_dir / f"{name}.txt") for name in names}

    used = _used(frames.values())
    unused = sorted(set(recipe.recolor) - used)
    if unused:
        raise EnemyError(
            f"{recipe.id}: recolor の {', '.join(unused)} は、{display(source_dir)} のどのコマでも使われていない（綴りの間違い？）"
        )
    after = {recipe.recolor.get(c, c) for c in used}
    if len(after) < len(used):
        print(f"warning: {recipe.id}: 色替えで {len(used)} 色が {len(after)} 色に減った（別々の色が同じ色になっている）",
              file=sys.stderr)

    out = build_root / recipe.id
    shutil.rmtree(out, ignore_errors=True)
    out.mkdir(parents=True)
    for name, frame in frames.items():
        note = f"{name} は enemy_build.py が {recipe.id} のレシピで作った（手で編集しない）"
        (out / f"{name}.txt").write_text(serialize_frame(recolor_frame(frame, recipe.recolor), note), encoding="utf-8")

    loaded = sheet.load_frames(rows, palette, out)
    canvas = sheet.compose_sheet(rows, loaded)
    sheet_dir.mkdir(parents=True, exist_ok=True)
    png = sheet_dir / f"{recipe.id}.png"
    canvas.save(png)
    sheet.preview(canvas, sheet.frame_size(loaded)).save(sheet_dir / f"{recipe.id}_preview.png")
    return png


def _print_colours(archetype: str) -> int:
    if archetype not in ARCHETYPES:
        raise EnemyError(f"archetype は {', '.join(ARCHETYPES)} のどれか（{archetype!r} だった）")
    sheet_def = REPO_ROOT / ARCHETYPES[archetype]
    sets = {body: source_colours(REPO_ROOT / SOURCES[(archetype, body)], sheet_def) for body in BODIES}
    for body, colours in sets.items():
        print(f"{body}: {len(colours)} 色")
        print("  " + " ".join(sorted(colours)))
    only_male = sorted(sets["male"] - sets["female"])
    only_female = sorted(sets["female"] - sets["male"])
    print(f"男性だけ: {' '.join(only_male) or 'なし'}")
    print(f"女性だけ: {' '.join(only_female) or 'なし'}")
    return 0


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("recipes", nargs="*", type=Path, help="enemy/<id>.json")
    parser.add_argument("--all", action="store_true", help="enemy/ のレシピをすべて作る")
    parser.add_argument("--colours", metavar="ARCHETYPE",
                        help="男女の元のコマが使う色の一覧と差（女性の色が男性とそろっているか）")
    args = parser.parse_args(argv)
    try:
        if args.colours:
            return _print_colours(args.colours)
        if args.all and args.recipes:
            raise EnemyError("--all とレシピのパスは同時に指定できない")
        paths = sorted(ENEMY_DIR.glob("*.json")) if args.all else args.recipes
        if not paths:
            raise EnemyError("作るレシピが無い（enemy/<id>.json を渡すか --all）")
        palette = load_palette()
        recipes = [load_recipe(path, palette) for path in paths]
        seen: dict[str, Path] = {}
        for recipe in recipes:
            if recipe.id in seen:
                raise EnemyError(f"id {recipe.id!r} が重複している（{seen[recipe.id]} と {recipe.path}）")
            seen[recipe.id] = recipe.path
        for recipe in recipes:
            source_dir, sheet_def = source_paths(recipe)
            png = build(recipe, source_dir, sheet_def, palette)
            print(f"ok   {display(png)}  {recipe.name}")
    except (EnemyError, GridError) as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 2
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
