#!/usr/bin/env python3
"""Rewrite the ``# map:`` names of grid files from old colour names to use names.

    palette_migrate.py MAPPING.json [--write] [targets ...]

MAPPING.json::

    {"rules":  [{"glob": "assets/part/equip/dagger/*.txt", "from": "stone_hi", "to": "weapon_blade_hi"}, ...],
     "pixels": [{"file": "assets/part/body/gau/core_down_base.txt", "points": [[x, y], ...], "to": "hair_gau_base"}]}

``glob`` and ``file`` are paths relative to the forge root (the directory that
holds ``tools/``). The first rule whose glob matches and whose ``from`` equals
the name is used. ``pixels`` gives individual pixels (``[x, y]``) a different
use than their character's rule would: they get a fresh character, and
``<char>=<to>`` is added to ``map``. The fresh character is one no target file
uses, and the same ``to`` gets the same character in every file (compose.py
needs a character to mean one name across the parts it stacks).

Without ``--write`` nothing is changed: it prints how many names each file
would rewrite and the names that have no rule (exit code 1 if there are any).
Everything but the ``map`` lines and the overridden pixels stays byte for byte.
"""
from __future__ import annotations

import argparse
import fnmatch
import json
import re
import string
import sys
from dataclasses import dataclass, field
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from gridfile import BACKGROUND, HEADER_RE, MAP_ENTRY_RE, REPO_ROOT, display  # noqa: E402
from validate import collect, default_targets  # noqa: E402

PAIRS_PER_LINE = 4
NEW_CHARS = string.ascii_lowercase + string.ascii_uppercase + string.digits
MAP_LINE_RE = re.compile(r"^(#\s*map\s*:\s*)(.*?)\s*$")


class MigrateError(Exception):
    """A file cannot be migrated. ``names`` lists names that have no rule."""

    def __init__(self, message: str, names: tuple[str, ...] = ()):
        super().__init__(message)
        self.names = names


@dataclass
class Result:
    text: str
    renamed: int = 0
    matched_rules: set[int] = field(default_factory=set)


def _split_eol(line: str) -> tuple[str, str]:
    body = line.rstrip("\r\n")
    return body, line[len(body):]


def _find_rule(path: str, name: str, rules: list[dict]) -> tuple[str, int] | None:
    for k, rule in enumerate(rules):
        if rule["from"] == name and fnmatch.fnmatchcase(path, rule["glob"]):
            return rule["to"], k
    return None


def used_chars(text: str) -> set[str]:
    """Every character a grid text uses: ``map`` keys and pixel characters."""
    used: set[str] = set()
    for line in text.splitlines():
        body = line.rstrip()
        if body.startswith("#"):
            header = HEADER_RE.match(body)
            if header and header.group(1) == "map":
                used |= {t.split("=", 1)[0] for t in header.group(2).split() if "=" in t}
        elif body:
            used |= set(body) - {BACKGROUND}
    return used


def migrate(path: str, text: str, rules: list[dict], pixels: list[dict],
            shared: dict[str, str] | None = None, reserved: set[str] | frozenset[str] = frozenset()) -> Result:
    """Rewrite one file. ``path`` is relative to the forge root, with ``/``.

    With ``shared`` (``to -> char``, filled in as it goes), every file gives the
    same override target the same character, chosen outside ``reserved`` (the
    characters any target uses). compose.py stacks parts and needs a character
    to mean the same name in every part of a frame.
    """
    lines = text.splitlines(keepends=True)
    map_idx: list[int] = []
    row_idx: list[int] = []
    for i, line in enumerate(lines):
        body = line.rstrip()
        if body.startswith("#"):
            header = HEADER_RE.match(body)
            if header and header.group(1) == "map":
                map_idx.append(i)
        elif body:
            row_idx.append(i)

    overrides = [p for p in pixels if p["file"] == path]
    if not map_idx:
        if overrides:
            raise MigrateError(f"{path}: pixels を指定されたが、map を持たないファイルです")
        return Result(text)

    # Rename entries in place, keeping each line's entries in their original order.
    entries_by_line: dict[int, list[tuple[str, str]]] = {}
    keys: set[str] = set()
    unmapped: list[str] = []
    renamed = 0
    matched: set[int] = set()
    for i in map_idx:
        m = MAP_LINE_RE.match(_split_eol(lines[i])[0])
        pairs = []
        for token in m.group(2).split():
            pair = MAP_ENTRY_RE.match(token)
            if not pair:
                raise MigrateError(f"{path}: map の組 {token!r} の形が不正です")
            ch, name = pair.groups()
            keys.add(ch)
            found = _find_rule(path, name, rules)
            if found is None:
                if name not in unmapped:
                    unmapped.append(name)
                new = name
            else:
                new, k = found
                matched.add(k)
                if new != name:
                    renamed += 1
            pairs.append((ch, new))
        entries_by_line[i] = pairs
    if unmapped:
        raise MigrateError(
            f"{path}: 対応表に規則の無い名前があります: {', '.join(unmapped)}", tuple(unmapped)
        )

    # Pixel overrides: each distinct "to" gets one unused character.
    rows = {i: list(_split_eol(lines[i])[0].rstrip()) for i in row_idx}  # trailing blanks are not pixels
    used = keys | {ch for chars in rows.values() for ch in chars}
    new_chars: dict[str, str] = {}
    seen_points: set[tuple[int, int]] = set()
    added: list[tuple[str, str]] = []
    for override in overrides:
        to = override["to"]
        for x, y in override["points"]:
            if not (0 <= y < len(row_idx)) or not (0 <= x < len(rows[row_idx[y]])):
                raise MigrateError(f"{path}: 点 [{x}, {y}] が絵の外です")
            chars = rows[row_idx[y]]
            if (x, y) in seen_points:
                raise MigrateError(f"{path}: 点 [{x}, {y}] が二重に指定されています")
            seen_points.add((x, y))
            if chars[x] == BACKGROUND:
                raise MigrateError(f"{path}: 点 [{x}, {y}] は背景（.）で、画素がありません")
            if to not in new_chars:
                if shared is not None and to in shared and shared[to] not in used:
                    free = shared[to]
                else:
                    taken = used | set(reserved) | (set(shared.values()) if shared is not None else set())
                    free = next((c for c in NEW_CHARS if c not in taken), None)
                if free is None:
                    raise MigrateError(f"{path}: {to} に割り当てる未使用の文字がありません")
                if shared is not None:
                    shared.setdefault(to, free)
                used.add(free)
                new_chars[to] = free
                added.append((free, to))
            chars[x] = new_chars[to]

    # Append the new entries to the last map line, 4 pairs per line.
    last = map_idx[-1]
    extra_lines: dict[int, list[list[tuple[str, str]]]] = {}
    if added:
        free_slots = PAIRS_PER_LINE - len(entries_by_line[last])
        if free_slots > 0:
            entries_by_line[last] = entries_by_line[last] + added[:free_slots]
            added = added[free_slots:]
        extra_lines[last] = [added[k : k + PAIRS_PER_LINE] for k in range(0, len(added), PAIRS_PER_LINE)]

    out: list[str] = []
    for i, line in enumerate(lines):
        if i in rows:
            body, eol = _split_eol(line)
            out.append("".join(rows[i]) + body[len(rows[i]):] + eol)
        elif i in entries_by_line:
            body, eol = _split_eol(line)
            prefix = MAP_LINE_RE.match(body).group(1)
            fmt = lambda pairs: " ".join(f"{c}={n}" for c, n in pairs)  # noqa: E731
            out.append(prefix + fmt(entries_by_line[i]) + (eol or "\n"))
            for group in extra_lines.get(i, []):
                out.append("# map: " + fmt(group) + (eol or "\n"))
        else:
            out.append(line)
    return Result("".join(out), renamed, matched)


def migrate_text(path: str, text: str, rules: list[dict], pixels: list[dict]) -> str:
    return migrate(path, text, rules, pixels).text


def load_mapping(path: Path) -> tuple[list[dict], list[dict]]:
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise SystemExit(f"error: 対応表 {path} を読めません: {exc}")
    if not isinstance(data, dict):
        raise SystemExit(f"error: {path}: 最上位は rules / pixels を持つオブジェクトにしてください")
    rules, pixels = data.get("rules", []), data.get("pixels", [])
    for k, rule in enumerate(rules):
        if not all(isinstance(rule.get(key), str) for key in ("glob", "from", "to")):
            raise SystemExit(f"error: {path}: rules[{k}] には文字列の glob / from / to が要ります")
    for k, entry in enumerate(pixels):
        ok = isinstance(entry.get("file"), str) and isinstance(entry.get("to"), str)
        ok = ok and isinstance(entry.get("points"), list) and all(
            isinstance(p, list) and len(p) == 2 and all(isinstance(v, int) for v in p) for p in entry["points"]
        )
        if not ok:
            raise SystemExit(f"error: {path}: pixels[{k}] には file / to と [x, y] の points が要ります")
    return rules, pixels


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("mapping", type=Path, help="対応表の JSON")
    parser.add_argument("targets", nargs="*", type=Path, help="grid files or directories (default: validate.py と同じ + tests/fixtures/)")
    parser.add_argument("--write", action="store_true", help="書き換える（無ければ数えるだけ）")
    args = parser.parse_args(argv)

    rules, pixels = load_mapping(args.mapping)
    targets = args.targets or default_targets() + [REPO_ROOT / "tests" / "fixtures"]
    grids = collect([t for t in targets if t.exists()] if not args.targets else targets)

    failed = False
    changes: list[tuple[Path, str, str, int]] = []
    seen: set[str] = set()
    matched: set[int] = set()
    unmapped: dict[str, set[str]] = {}
    texts: dict[Path, str | Exception] = {}
    for grid in grids:
        try:
            with open(grid, encoding="utf-8", newline="") as fh:
                texts[grid] = fh.read()
        except (OSError, UnicodeDecodeError) as exc:
            texts[grid] = exc
    reserved = set().union(*(used_chars(t) for t in texts.values() if isinstance(t, str)))
    shared: dict[str, str] = {}
    for grid in grids:
        rel = display(grid).as_posix()
        seen.add(rel)
        try:
            text = texts[grid]
            if isinstance(text, Exception):
                raise text
            result = migrate(rel, text, rules, pixels, shared, reserved)
        except MigrateError as exc:
            failed = True
            print(f"NG   {exc}")
            for name in exc.names:
                unmapped.setdefault(name, set()).add(rel)
            continue
        except (OSError, UnicodeDecodeError) as exc:
            failed = True
            print(f"NG   {grid}: 読めません: {exc}")
            continue
        matched |= result.matched_rules
        if result.text != text:
            changes.append((grid, rel, result.text, result.renamed))
        print(f"ok   {rel}: 書き換える名前 {result.renamed}")

    for entry in pixels:
        if entry["file"] not in seen:
            failed = True
            print(f"NG   pixels の file が対象の中にありません: {entry['file']}")
    for k, rule in enumerate(rules):
        if k not in matched:
            print(f"注意 どのファイルにも当たらなかった規則: rules[{k}] {rule['glob']} {rule['from']} -> {rule['to']}")
    if unmapped:
        print("規則の無い名前（ファイル数）:")
        for name in sorted(unmapped):
            print(f"  {name} ({len(unmapped[name])})")

    if failed:
        if args.write:
            print("失敗があるため、何も書き換えませんでした")
        return 1
    if args.write:
        for grid, rel, new_text, renamed in changes:
            try:
                with open(grid, "w", encoding="utf-8", newline="") as fh:
                    fh.write(new_text)
            except OSError as exc:
                print(f"NG   {grid}: 書けません: {exc}")
                return 1
            print(f"WRITE {rel}: 書き換えた名前 {renamed}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
