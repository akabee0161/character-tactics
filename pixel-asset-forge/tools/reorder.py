#!/usr/bin/env python3
"""compose の設定の、ある向きの重なり順だけを変えた写しを作る（2026-10-12、イネスの作業で使ったものを移した）。

    tools/reorder.py compose/ines.json build/ines_left.json left bow,arrow,arrow_hand,CORE,bow_hand

順は奥→手前で、部品のファイル名の前半（bow など）と芯（CORE）で書く。CORE より前は back（芯に近いものから並べ直す）、
後ろは front。その向きのコマの部品を、漏れなく1回ずつ書く（一部のコマにしか無い部品は、無いコマでは飛ばす）。写しを tools/compose.py --out や compose_page.py に渡して見比べる。
"""
from __future__ import annotations

import argparse
import copy
import json
import sys
from pathlib import Path

CORE = "CORE"


class ReorderError(Exception):
    """重なり順が、設定の部品と合わない。"""


def _key(part: str, direction: str) -> str:
    """部品のファイル名の前半。bow_left_base → bow。状態の付かない部品（ガウの hood_left）は hood。"""
    stem = Path(part).stem
    if f"_{direction}_" in stem:
        return stem.split(f"_{direction}_")[0]
    return stem.removesuffix(f"_{direction}")


def reorder(config: dict, direction: str, order: list[str]) -> dict:
    if order.count(CORE) != 1:
        raise ReorderError(f"順に芯（{CORE}）がちょうど1つ無い: {','.join(order)}")
    dup = sorted({n for n in order if order.count(n) > 1})
    if dup:
        raise ReorderError(f"順に同じ名前が2回ある: {', '.join(dup)}")
    core = order.index(CORE)
    back, front = order[:core], order[core + 1:]
    out = copy.deepcopy(config)
    names = [n for n in out.get("frames", {}) if n.startswith(direction + "_")]
    if not names:
        raise ReorderError(f"{direction} のコマが設定に無い")
    keys = {}
    for name in names:
        by_key = keys[name] = {}
        for layer in out["frames"][name]["layers"]:
            key = _key(layer["part"], direction)
            if key in by_key:  # 片方を黙って落とさない
                raise ReorderError(f"{name}: 名前が同じ {key} の部品が2つある（{by_key[key]['part']}・{layer['part']}）")
            by_key[key] = layer
    unknown = [k for k in order if k != CORE and not any(k in by_key for by_key in keys.values())]
    if unknown:
        raise ReorderError(f"{direction} のどのコマにも無い部品の名前: {', '.join(unknown)}")
    for name, by_key in keys.items():
        missing = [k for k in by_key if k not in order]
        if missing:
            raise ReorderError(f"{name}: 順に無い部品 {', '.join(missing)}")
        # 一部のコマにしか無い部品（体に隠れて層を持たないコマ）は、無いコマでは飛ばす
        out["frames"][name]["layers"] = [{**by_key[k], "z": "back" if k in back else "front"}
                                         for k in [*reversed(back), *front] if k in by_key]
    return out


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("config", type=Path)
    parser.add_argument("out", type=Path)
    parser.add_argument("direction")
    parser.add_argument("order", help="奥→手前、カンマ区切り（CORE を1つ含む）")
    args = parser.parse_args(argv)
    try:
        config = json.loads(args.config.read_text(encoding="utf-8"))
        out = reorder(config, args.direction, args.order.split(","))
    except (OSError, json.JSONDecodeError, ReorderError) as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 2
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(out, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print("書いた", args.out)
    return 0


if __name__ == "__main__":
    sys.exit(main())
