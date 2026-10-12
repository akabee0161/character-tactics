"""完成した unit のコマを、文字で切って部品のファイルにし、tools/compose.py の設定を書く（2026-10-12）。

ロランの書き出し（gen/roran/roran_layers.py --export）は色名で切ったが、イネスは弓の暗い面・矢の軸・ズボンが
同じ wood_shadow なので、専用の文字（SPEC「持ち物の部品には専用の文字を割り当てる」）で切る。
部品の取り方は tools/cut_layers.cut と同じ（箱の中の、その部品の文字。輪郭は接するすべての層に入る）。
ユニットごとの定義（UnitDef）は gen/<ユニット>/<ユニット>_layers.py に置く。書くのは部品と設定だけで、コマは書かない。
部品は assets/part/<種類>/<名前>/ に書く（芯は body/<ユニット>/、ほかは PartDef.dir。2026-10-12 依頼者と決めた置き場）。
"""
from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path

from cut_layers import CORE, Part, cut
from gridfile import parse

Box = tuple[int, int, int, int]
NONE: Box = (0, 0, 0, 0)  # 部品が見えないコマの箱（左上の1画素。どのコマでも空いている）
WHOLE: Box = (0, 0, 31, 31)
MAP_PER_LINE = 6


class ExportError(Exception):
    """書き出しの前提（文字の割り当て・箱）が合わない。"""


@dataclass(frozen=True)
class PartDef:
    name: str
    file: str
    chars: frozenset[str]
    boxes: dict[tuple[str, str], Box] | None = None  # (向き, 部品の状態) → 箱。None は枠全体
    hand: bool = False
    keep: tuple[str, ...] = ()  # 色名
    dir: str = ""  # 置き場（assets/part/ からの相対。例 equip/bow・fist/ines）


@dataclass(frozen=True)
class UnitDef:
    unit: str
    src: Path
    dirs: tuple[str, ...]
    states: tuple[str, ...]
    shares: dict[str, str]  # 状態 → 部品を使い回す状態（芯は使い回さない）
    parts: tuple[PartDef, ...]
    orders: dict[str, tuple[str, ...]]  # 向き → 奥→手前の層の名前（CORE を1つ含む）
    hand_colours: tuple[str, ...]


def unit_charmap(paths: list[Path]) -> dict[str, str]:
    """全コマで共通の 文字→色名。同じ文字に違う色が割り当てられていたら止める。"""
    out: dict[str, str] = {}
    for path in paths:
        for ch, colour in parse(path).charmap.items():
            if out.setdefault(ch, colour) != colour:
                raise ExportError(f"{path.name}: 文字 {ch!r} が {colour} だが、ほかのコマでは {out[ch]}")
    return out


def _outline_char(charmap: dict[str, str]) -> str:
    chars = sorted(ch for ch, colour in charmap.items() if colour == "outline")
    if not chars:
        raise ExportError("outline の文字が無い")
    return chars[0]


def cut_chars(rows: list[str], charmap: dict[str, str], parts: list[Part]) -> dict[str, list[str]]:
    """層の名前 → 32行の文字列（透明は "."）。Part.colors には文字を入れる。"""
    outline = {ch for ch, colour in charmap.items() if colour == "outline"}
    frame = [[None if ch == "." else "outline" if ch in outline else ch for ch in row] for row in rows]
    out_ch = _outline_char(charmap)
    return {name: ["".join("." if v is None else out_ch if v == "outline" else v for v in row) for row in layer.frame]
            for name, layer in cut(frame, parts).items()}


def grid_text(rows: list[str], charmap: dict[str, str], note: str) -> str:
    used = {ch for row in rows for ch in row if ch != "."}
    chars = sorted(used, key=lambda ch: (charmap[ch] != "outline", ch)) or [_outline_char(charmap)]
    entries = [f"{ch}={charmap[ch]}" for ch in chars]
    lines = [f"# {note}", "# type: unit", "# size: 32x32", "# light: upper-left", "# bg: transparent"]
    lines += ["# map: " + " ".join(entries[i:i + MAP_PER_LINE]) for i in range(0, len(entries), MAP_PER_LINE)]
    return "\n".join(lines + rows) + "\n"


def _box(part: PartDef, d: str, key: str) -> Box:
    if part.boxes is None:
        return WHOLE
    if (d, key) not in part.boxes:
        raise ExportError(f"{part.name}: {d}_{key} の箱が無い")
    return part.boxes[(d, key)]


def _validate(unit: UnitDef) -> None:
    """書き始める前に、全部の向き・状態について重なり順と箱を確かめる（途中で止まって一部だけ上書きしないように。
    PR #32 の CodeRabbit の指摘、2026-10-12）。"""
    for part in unit.parts:
        where = Path(part.dir)
        if not where.parts or where.is_absolute() or ".." in where.parts:  # 空・"." は assets/part/ の直下になる
            raise ExportError(f"{part.name} の置き場（dir）が無いか、assets/part/ の中の相対パスでない: {part.dir!r}")
    names = [p.name for p in unit.parts]
    for d in unit.dirs:
        if d not in unit.orders:
            raise ExportError(f"{d} の重なり順（orders）が無い")
        order = unit.orders[d]
        if order.count(CORE) != 1:
            raise ExportError(f"{d} の重なり順に芯（{CORE}）がちょうど1つ無い: {order}")
        unknown = [n for n in order if n != CORE and n not in names]
        if unknown:
            raise ExportError(f"{d} の重なり順に、部品に無い名前がある: {', '.join(unknown)}")
        missing = [n for n in names if n not in order]
        if missing:
            raise ExportError(f"{d} の重なり順に、部品が入っていない（画素が芯の穴になる）: {', '.join(missing)}")
        for st in unit.states:
            for part in unit.parts:
                _box(part, d, unit.shares.get(st, st))


def _check_not_used_elsewhere(targets: set[str], config_path: Path, root: Path) -> None:
    """書き出し先の部品を、ほかのユニットの設定（root/compose/*.json）が使っていたら止める。
    部品の置き場は種類ごとで、ユニットをまたいで共有する（equip/sword など）ので、黙って上書きしないため（2026-10-12 最終レビュー）。"""
    for other in sorted((root / "compose").glob("*.json")):
        if other.resolve() == config_path.resolve():
            continue
        try:
            frames = json.loads(other.read_text(encoding="utf-8")).get("frames", {})
        except (OSError, json.JSONDecodeError, AttributeError) as exc:
            raise ExportError(f"{other}: ほかのユニットの設定を読めない（上書きの確かめができない）: {exc}") from None
        used = {spec.get("body") for spec in frames.values()}
        used |= {layer.get("part") for spec in frames.values() for layer in spec.get("layers", [])}
        clash = sorted(targets & used)
        if clash:
            raise ExportError(f"{other.name} が使っている部品を上書きする: {', '.join(clash[:3])}"
                              f"{' ほか' if len(clash) > 3 else ''}（ファイル名の前半か dir を変える）")


def export(unit: UnitDef, part_root: Path, config_path: Path, root: Path) -> None:
    """部品のファイルと compose の設定を書く（コマは書かない）。芯は part_root/body/<ユニット>/、部品は part_root/<dir>/。
    設定のパスは root からの相対。定義に誤りがあれば、何も書かずに ExportError で止める。"""
    _validate(unit)
    charmap = unit_charmap(sorted(unit.src.glob("*.txt")))
    by_name = {p.name: p for p in unit.parts}
    core_dir = part_root / "body" / unit.unit

    def rel(path: Path) -> str:
        return path.relative_to(root).as_posix()

    targets = {rel(core_dir / f"core_{d}_{st}.txt") for d in unit.dirs for st in unit.states}
    targets |= {rel(part_root / p.dir / f"{p.file}_{d}_{unit.shares.get(st, st)}.txt")
                for p in unit.parts for d in unit.dirs for st in unit.states}
    _check_not_used_elsewhere(targets, config_path, root)
    for folder in {core_dir, *(part_root / p.dir for p in unit.parts)}:
        folder.mkdir(parents=True, exist_ok=True)

    frames = {}
    for d in unit.dirs:
        order = unit.orders[d]
        core = order.index(CORE)
        back, front = order[:core], order[core + 1:]
        for st in unit.states:
            key = unit.shares.get(st, st)
            grid = parse(unit.src / f"{d}_{st}.txt")
            layers = cut_chars(grid.rows, charmap, [Part(p.name, _box(p, d, key), set(p.chars)) for p in unit.parts])
            core_path = core_dir / f"core_{d}_{st}.txt"
            core_path.write_text(grid_text(layers[CORE], charmap, f"{unit.unit} {d}_{st} の芯"), encoding="utf-8")
            entries = []
            for name in [*reversed(back), *front]:  # back は芯に近いものから（「部品で組む規約」）
                part = by_name[name]
                path = part_root / part.dir / f"{part.file}_{d}_{key}.txt"
                if st == key:
                    path.write_text(grid_text(layers[name], charmap, f"{unit.unit} {d}_{key} の{name}"),
                                    encoding="utf-8")
                entry = {"part": rel(path), "z": "back" if name in back else "front"}
                if part.hand:
                    entry["hand"] = True
                if part.keep:
                    entry["keep"] = sorted(part.keep)
                entries.append(entry)
            frames[f"{d}_{st}"] = {"body": rel(core_path), "layers": entries}
    config_path.parent.mkdir(parents=True, exist_ok=True)
    config_path.write_text(json.dumps({"unit": unit.unit, "hand_colours": list(unit.hand_colours), "frames": frames},
                                      ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
