#!/usr/bin/env python3
"""芯（と髪・かぶり物の部品）の目が、左右の隣の色に溶けて見分けられなくなっていないかを確かめる（2026-10-16。方針の確認 12）。

    .venv/bin/python tools/eye_check.py checks/gau.json

目と輪郭は同じ outline の色なので、設定ファイルの eyes に向きごとの目の画素（x の列と [上の行, 下の行]、目の無い向きは null）を書く。
目の部品（設定の parts で eye。assets/part/eye/）があるユニットは eyes を書かず、コマごとに目の部品の背景でない画素を目として読む
（2026-10-30。斜めの目のように列と行の四角で書けない形も読める）。目の部品の中でも、種類が被り物・装飾品の色の 2x2 の塊（E5 の眼帯）は
目として読まない（2026-11-03。眼帯の隣の目は、眼帯が輪郭と同じ色なので見分けられない色として落ちる。塊にならない装飾品の色の画素は
目のまま調べるので、目を眼帯の色で塗り間違えた絵は「目の画素が輪郭の色でない」で落ちる）。目の部品より手前に積んだ部品のうち、head の部品の画素か、
種類が被り物・装飾品（headgear・ornament）の色の画素が目の画素に重なれば「覆われた」とする。目の画素がすべて覆われたコマは
目なしとして通し（knight のバイザー、メガネなど）、一部だけ覆われたコマは「目の一部が被り物に隠れている」で落とす。
覆われていないコマに下の判定を掛ける。目の上端の行は同じ状態のコマの向きどうしで比べ、目がすべて隠れた向きを除く。

- 目の画素の左右の隣（目の画素どうしは除く）が、probe_colors.py の判定で目（outline）と見分けられない色
  （WARN・HARD。check_colors.py と同じ基準）のもの
- 設定の目の画素が outline でないもの（絵の目を動かしたのに設定を直し忘れた）
- 設定の目の上端の行が、目のある向きの間でそろわないもの（types/unit/SPEC.md「立ち絵4方向の規約」の顔。名前は eyes で1回だけ出す。
  絵の目が設定とずれたことは、上の「目の画素が outline でない」で分かる）

を落とす。見る画素は、芯に髪・かぶり物の部品（設定の parts で head）を重ね順どおりに重ねたもの（2026-10-18。ミストから
髪・かぶり物を芯と分けるので、目の横の髪も見る）。武器・拳・盾は重ねない（部品を単品として見る。弓を顔の前に構えるような、
動きの中で目の横を物が通るのは目の描き方の問題ではない。tip_check.py が部品の形で見るのと同じ考え）。
上下と斜めは見ない（「真上が前髪や頭巾の縁の輪郭なのはよい」、SPEC「自己チェック」②）。
左右の隣が髪・かぶり物でも、輪郭と見分けられる色なら目は読めるので通す（2026-10-16 依頼者の判断。
設計の「顔の肌でない隣を落とす」は顔の縁の輪郭を目と取り違え、ロランの目の横の髪のように問題ない絵も落とした）。
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import palette  # noqa: E402
from gridfile import load_palette  # noqa: E402
from probe_colors import verdict  # noqa: E402
from unit_config import CORE, DIRECTIONS, OUTLINE, Frame, UnitConfig, kind_of_use, points, run_check  # noqa: E402


COVER_KINDS = ("headgear", "ornament")  # head でない部品も、この種類の色の画素なら目を覆う（メガネなど）


def head_pixels(cfg: UnitConfig, frame: Frame) -> dict[tuple[int, int], str]:
    """芯に、髪・かぶり物の部品（parts の head）と目の部品（parts の eye）だけを重ね順どおりに重ねた画素。"""
    pixels: dict[tuple[int, int], str] = {}
    for key in frame.order:  # 奥→手前。手前の部品が上書きする
        if key == CORE:
            pixels.update(frame.core_pixels())
        elif cfg.role(key, "head") or cfg.role(key, "eye"):
            pixels.update(frame.parts[key].pixels())
    return pixels


def patch_blocks(cover: set) -> set:
    """被り物・装飾品の色の画素のうち、2x2 の塊に入るもの（E5 の眼帯）。
眼帯の 2x2 に眼帯色の 1x2 の目が横に接すると、重なる 2x2 が検出されて 6 画素すべてが入り、目なしで通る（ISSUES.md）。
接していない 1x2 の目は入らない。"""
    blocks: set = set()
    for x, y in cover:
        square = {(x, y), (x + 1, y), (x, y + 1), (x + 1, y + 1)}
        if square <= cover:
            blocks |= square
    return blocks


def part_eyes(cfg: UnitConfig, frame: Frame, pal: palette.Palette) -> tuple[frozenset, frozenset]:
    """(目の画素, そのうち手前の被り物・装飾品に覆われた画素)。目の画素は目の部品の背景でない画素（dx・dy でずらした後）のうち、
    被り物・装飾品の色の 2x2 の塊を除いたもの（E5 の眼帯は目の部品の中に装飾品の色の 2x2 で描く。2026-11-03）。
    覆うのは、目の部品より手前に積んだ部品のうち、head の部品の画素か、種類が被り物・装飾品の色の画素。"""
    eyes: set = set()
    covered: set = set()
    for i, key in enumerate(frame.order):
        if key == CORE or not cfg.role(key, "eye"):
            continue
        part = frame.parts[key]
        pixels = part.pixels()
        mine = set(pixels) - patch_blocks({p for p, use in pixels.items()
                                           if kind_of_use(pal, use, part.layer.part) in COVER_KINDS})
        eyes |= mine
        for front in frame.order[i + 1:]:
            if front == CORE or cfg.role(front, "eye"):
                continue
            head = cfg.role(front, "head")
            covered |= {p for p, use in frame.parts[front].pixels().items()
                        if p in mine and (head or kind_of_use(pal, use, frame.parts[front].layer.part) in COVER_KINDS)}
    return frozenset(eyes), frozenset(covered)


def look(name: str, eyes: frozenset, pixels: dict, colours) -> list[tuple[str, str]]:
    """目の画素が輪郭の色か、左右の隣が目と見分けられるか。"""
    failures = []
    missing = {p for p in eyes if pixels.get(p) != OUTLINE}
    if missing:
        failures.append((name, f"目の画素が輪郭の色でない {len(missing)} 件: {points(missing)}"))
    blurred = {(x + dx, y) for x, y in eyes - missing for dx in (-1, 1)
               if (x + dx, y) not in eyes and (x + dx, y) in pixels
               and not verdict(OUTLINE, pixels[(x + dx, y)], colours)[0].startswith("OK")}
    if blurred:
        failures.append((name, f"目の左右の隣が目と見分けられない色 {len(blurred)} 件: {points(blurred)}"))
    return failures


def check_config_eyes(cfg: UnitConfig, colours) -> list[tuple[str, str]]:
    """目を芯に描いたユニット（ロラン・イネス・ガウ）。目の位置は設定の eyes に書く。"""
    failures = []
    # 目の位置は設定に書くので、上端の行は設定どうしを1回だけ比べる（名前は設定のキー eyes）
    tops = {d: min(y for _x, y in eyes) for d, eyes in cfg.eyes.items() if eyes}
    if len(set(tops.values())) > 1:
        detail = " ".join(f"{d}={y}" for d, y in tops.items())
        failures.append(("eyes", f"目の上端の行が向きでそろわない: {detail}"))
    for name, frame in cfg.frames.items():
        eyes = cfg.eyes[frame.direction]
        if eyes is not None:
            failures += look(name, eyes, head_pixels(cfg, frame), colours)
    return failures


def check_part_eyes(cfg: UnitConfig, colours) -> list[tuple[str, str]]:
    """目の部品があるユニット。目はコマごとに目の部品の画素から読む（2026-10-30）。"""
    pal = palette.load()
    failures = []
    tops: dict[str, dict[str, int]] = {}  # 状態 → 向き → 目の上端の行（目がすべて隠れた向きは除く）
    for name, frame in cfg.frames.items():
        eyes, covered = part_eyes(cfg, frame, pal)
        if not eyes or covered == eyes:  # 目の無い向き・被り物に目がすべて隠れた向き（バイザーなど）
            continue
        if covered:
            failures.append((name, f"目の一部が被り物に隠れている {len(covered)} 件: {points(covered)}"))
            continue
        tops.setdefault(frame.state, {})[frame.direction] = min(y for _x, y in eyes)
        failures += look(name, eyes, head_pixels(cfg, frame), colours)
    # 目の高さは同じ状態の向きどうしで比べる（歩きで頭が上下しても、向きの間ではそろう）。同じ食い違いは1回だけ出す
    uneven: dict[str, list[str]] = {}
    for state, by_direction in tops.items():
        if len(set(by_direction.values())) > 1:
            detail = " ".join(f"{d}={y}" for d, y in sorted(by_direction.items(), key=lambda i: DIRECTIONS.index(i[0])))
            uneven.setdefault(detail, []).append(state)
    rows = [("eyes", f"目の上端の行が向きでそろわない: {detail}"
                     + ("" if len(states) == len(tops) else f"（{' '.join(states)}）"))
            for detail, states in uneven.items()]
    return rows + failures


def check(cfg: UnitConfig) -> list[tuple[str, str]]:
    colours = load_palette()
    if cfg.eyes is None:
        return check_part_eyes(cfg, colours)
    return check_config_eyes(cfg, colours)


def main(argv: list[str] | None = None) -> int:
    return run_check(argv, __doc__, check, "目: ok")


if __name__ == "__main__":
    raise SystemExit(main())
