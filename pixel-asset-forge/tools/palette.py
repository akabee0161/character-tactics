"""Read the palette split into swatches, kinds and uses.

    palette/swatches.json   {"<name>": {"hex": "#rrggbb", "note": "..."}}
    palette/kinds.json      {"<kind>": {"note": "..."}}
    palette/uses/<type>.json  {"<name>": {"swatch": "...", "kind": "...", "note": "..."}}

``<type>`` is one of ``TYPES``. A *use* is the name a grid actually refers to;
it points at a swatch (the colour value) and carries a kind.
"""
from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path

from gridfile import HEX_RE, REPO_ROOT, GridError, hex_to_rgb

PALETTE_DIR = REPO_ROOT / "palette"
TYPES = ("common", "unit", "tile", "face", "item")


@dataclass(frozen=True)
class Use:
    name: str
    swatch: str
    kind: str
    note: str
    type: str


@dataclass(frozen=True)
class Palette:
    swatches: dict[str, tuple[int, int, int]]
    swatch_notes: dict[str, str]
    kinds: dict[str, str]
    uses: dict[str, Use]

    def rgb(self, name: str) -> tuple[int, int, int]:
        return self.swatches[self.uses[name].swatch]

    def kind_of(self, name: str) -> str:
        return self.uses[name].kind

    def names_of_kind(self, *kinds: str, type: str | None = None) -> frozenset[str]:
        return frozenset(
            n
            for n, u in self.uses.items()
            if u.kind in kinds and (type is None or u.type in (type, "common"))
        )

    def allowed(self, type: str) -> frozenset[str]:
        return frozenset(n for n, u in self.uses.items() if u.type in (type, "common"))


def _read_object(path: Path) -> dict:
    try:
        raw = json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError:
        raise GridError(f"{path.name}: ファイルが見つかりません ({path})") from None
    except json.JSONDecodeError as exc:
        raise GridError(f"{path.name}: JSON として読めません: {exc}") from None
    if not isinstance(raw, dict):
        raise GridError(f"{path.name}: 名前をキーにしたオブジェクトである必要があります")
    return raw


def _entry(path: Path, key: str, value, fields: tuple[str, ...]) -> dict:
    """Check ``value`` is an object whose ``fields`` are non-empty strings."""
    if not isinstance(value, dict):
        raise GridError(f"{path.name}: {key!r} はオブジェクトである必要があります")
    for f in fields:
        v = value.get(f)
        if not isinstance(v, str) or not v.strip():
            raise GridError(f"{path.name}: {key!r} に {f} がありません (空でない文字列が必要)")
    return value


def load(root: Path = PALETTE_DIR) -> Palette:
    swatches: dict[str, tuple[int, int, int]] = {}
    swatch_notes: dict[str, str] = {}
    path = root / "swatches.json"
    for key, value in _read_object(path).items():
        e = _entry(path, key, value, ("hex", "note"))
        if not HEX_RE.match(e["hex"]):
            raise GridError(f"{path.name}: {key!r} の hex が '#rrggbb' ではありません ({e['hex']!r})")
        swatches[key] = hex_to_rgb(e["hex"])
        swatch_notes[key] = e["note"]

    kinds: dict[str, str] = {}
    path = root / "kinds.json"
    for key, value in _read_object(path).items():
        kinds[key] = _entry(path, key, value, ("note",))["note"]

    uses: dict[str, Use] = {}
    uses_dir = root / "uses"
    files = sorted(uses_dir.glob("*.json")) if uses_dir.is_dir() else []
    for path in files:
        type_ = path.stem
        if type_ not in TYPES:
            raise GridError(
                f"{path.name}: 型 {type_!r} は未定義です (使える型: {', '.join(TYPES)})"
            )
        for key, value in _read_object(path).items():
            e = _entry(path, key, value, ("swatch", "kind", "note"))
            if e["swatch"] not in swatches:
                raise GridError(f"{path.name}: {key!r} の swatch {e['swatch']!r} は swatches.json にありません")
            if e["kind"] not in kinds:
                raise GridError(f"{path.name}: {key!r} の kind {e['kind']!r} は kinds.json にありません")
            if key in swatches:
                raise GridError(f"{path.name}: {key!r} は色見本と同じ名前です。用途の色は別の名前にしてください")
            if key in uses:
                raise GridError(
                    f"{path.name}: {key!r} は {uses[key].type}.json にも書かれています (重複)"
                )
            uses[key] = Use(key, e["swatch"], e["kind"], e["note"], type_)

    return Palette(swatches, swatch_notes, kinds, uses)
