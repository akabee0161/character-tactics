#!/usr/bin/env python3
"""刃・鏃の先端が決まり1〜5に合うかを、部品ごとの形で確かめる（2026-10-16。2026-10-22 に判定を決まり1〜5へ置き換えた。方針の確認 6）。

    .venv/bin/python tools/tip_check.py checks/ines.json
    .venv/bin/python tools/tip_check.py --items checks/items.json   # item のアイコン（刃の文字は items.json に書く）

設定ファイルの parts で blade（刃・鏃の文字）を書いた部品について、部品のファイルを単品で見て、
tools/tip_rule.py の find_tips() で先端を判定する（決まりは types/item/SPEC.md と
character-tactics の docs/superpowers/specs/2026-10-22-tip-drawing-rule-design.md）。
決まりに反する先端を FAIL で出す。中身5画素以上・45°以外の斜め・根元の無い刃は落とさず NOTE で出す。
同じ部品のファイルは1回だけ見る。名前は部品のファイル名（拡張子なし）で出す。

- 刃は色でなく文字で見分ける（2026-10-22 依頼者）。鍔の端・弓の端・斜めの矢や弦・足先など、刃の文字でない先端は見ない
  （2026-10-16 依頼者の判断）
- 組んだコマでなく部品で見る（隠れて細く見えるのは、部品の形ではないため。2026-10-17 依頼者の判断）
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from gridfile import REPO_ROOT, GridError, parse  # noqa: E402
from tip_rule import Tip, find_tips  # noqa: E402
from unit_config import OUTLINE, UnitConfig, run_check  # noqa: E402


def _tips(cfg: UnitConfig):
    """(部品のファイル名, 部品の役割, Tip) を、同じ部品のファイルは1回だけ並べる。"""
    seen = set()
    for frame in cfg.frames.values():
        for key, part in frame.parts.items():
            blade = cfg.role(key, "blade") or ""
            if not blade or part.layer.part in seen:
                continue
            seen.add(part.layer.part)
            grid = part.grid
            outline = frozenset(c for c, name in grid.charmap.items() if name == OUTLINE)
            for tip in find_tips(grid.rows, frozenset(blade), outline):
                yield part.layer.part.stem, key, tip


def describe(role: str, tip: Tip) -> str:
    x, y = tip.point
    if tip.skipped:
        return f"{role} の先端 ({x},{y}) は対象外: {tip.skipped}"
    return f"{role} の先端 {tip.direction} ({x},{y}): {'; '.join(tip.problems)}"


def check(cfg: UnitConfig) -> list[tuple[str, str]]:
    return [(name, describe(key, tip)) for name, key, tip in _tips(cfg) if tip.problems]


def skipped(cfg: UnitConfig) -> list[tuple[str, str]]:
    return [(name, describe(key, tip)) for name, key, tip in _tips(cfg) if tip.skipped]


ITEM_KEYS = {"blade"}


class ItemsConfigError(Exception):
    """checks/items.json の誤り（終了コード 2）。"""


def check_items(config: Path, root: Path) -> tuple[list[tuple[str, str]], list[tuple[str, str]]]:
    """checks/items.json に書いた item のアイコンを判定する。(FAIL, NOTE) を返す。
    形は {"items": {"assets/item/sword.txt": {"blade": "ijk"}, ...}}。パスは root から。"""
    try:
        data = json.loads(config.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise ItemsConfigError(f"{config}: 読めない（{exc}）") from exc
    if not isinstance(data, dict) or set(data) != {"items"} or not isinstance(data["items"], dict):
        raise ItemsConfigError(f"{config.name}: {{\"items\": {{...}}}} の形でない")
    failures, notes = [], []
    for rel, spec in data["items"].items():
        where = f"{config.name} の items[{rel!r}]"
        if not isinstance(spec, dict) or set(spec) != ITEM_KEYS:
            raise ItemsConfigError(f"{where}: キーは blade だけ")
        blade = spec["blade"]
        if not isinstance(blade, str) or not blade:
            raise ItemsConfigError(f"{where}.blade: 空でない文字列")
        try:
            grid = parse(root / rel)
        except (OSError, GridError) as exc:
            raise ItemsConfigError(f"{where}: 読めない（{exc}）") from exc
        missing = sorted(set(blade) - set(grid.charmap))
        if missing:
            raise ItemsConfigError(f"{where}.blade: ファイルに無い文字 {''.join(missing)}")
        outline = frozenset(c for c, name in grid.charmap.items() if name == OUTLINE)
        for tip in find_tips(grid.rows, frozenset(blade), outline):
            line = (Path(rel).stem, describe("刃", tip))
            if tip.problems:
                failures.append(line)
            elif tip.skipped:
                notes.append(line)
    return failures, notes


def main(argv: list[str] | None = None) -> int:
    args = sys.argv[1:] if argv is None else argv
    if not any(a == "--items" or a.startswith("--items=") for a in args):
        return run_check(argv, __doc__, check, "先端: ok", notes=skipped)
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--items", type=Path, required=True, help="checks/items.json（item のアイコンと刃の文字）")
    parser.add_argument("--root", type=Path, default=REPO_ROOT, help="設定のパスの基準（既定はリポジトリの直下）")
    opts = parser.parse_args(args)
    try:
        failures, notes = check_items(opts.items, opts.root)
    except ItemsConfigError as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 2
    for name, message in notes:
        print(f"NOTE {name}: {message}")
    for name, message in failures:
        print(f"FAIL {name}: {message}")
    if failures:
        return 1
    print("先端: ok")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
