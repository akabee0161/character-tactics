#!/usr/bin/env python3
"""ユニットの方針の確認をまとめて走らせる入口（2026-10-16。types/unit/SPEC.md「自己チェック①」）。

    .venv/bin/python tools/unit_rules.py checks/gau.json

設定ファイル checks/<ユニット>.json（tools/unit_config.py）から引数を組み立て、次の順に各道具の main(argv) を呼ぶ:

1. validate.py（コマ・芯・部品のグリッド）  2. compose.py --check（部品から再現できるか）
3. body_check.py（芯）・hand_mirror.py・unit_check.py・weapon_check.py（設定の weapon_check が null なら走らせない）
4. order_check・blade_height・still_check・height_check・tip_check・part_chars・eye_check・part_outline・fist_check

確認ごとに1行「ok／NG 落ちた件数（例外で通した件数）」を出し、例外で通らなかった失敗の行を続ける。
失敗の行は、道具が出す「FAIL 」（compose.py は「差あり 」）で始まる行。設定ファイルの exceptions の1件は、
check が同じで、行の「:」より前の部分に frames のどれかの名前があり、行に what を含むとき、その行を通す
（what を長く書くほど狭く通す）。使われなかった例外は「使われなかった例外」と出す（終了コードは変えない）。

終了コード: 0 すべて ok か例外で通した、1 例外で通らない失敗がある、2 設定の誤りか、道具が入力の誤りで止まった。
"""
from __future__ import annotations

import argparse
import contextlib
import importlib
import io
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from gridfile import REPO_ROOT  # noqa: E402
from unit_config import UnitConfig, UnitConfigError, load_unit_config  # noqa: E402

NEW_CHECKS = ("order_check", "blade_height", "still_check", "height_check", "tip_check", "part_chars",
              "eye_check", "part_outline", "fist_check")
NAME_RE = re.compile(r"[A-Za-z0-9_]+")


def plan(cfg: UnitConfig, config: Path, root: Path) -> list[tuple[str, list[str] | None]]:
    """(確認の名前 = 道具のモジュール名, main に渡す引数。None なら走らせない) の並び。"""
    grids = sorted({str(frame.core.path) for frame in cfg.frames.values()}
                   | {str(part.grid.path) for frame in cfg.frames.values() for part in frame.parts.values()})
    cores = {frame.core.path.parent for frame in cfg.frames.values()}
    if len(cores) != 1:
        raise UnitConfigError(f"芯の部品の置き場が1つでない: {', '.join(sorted(map(str, cores)))}")
    core_dir = str(cores.pop())
    body_check = [core_dir]
    if cfg.head_chars:
        body_check += ["--hanging", "".join(sorted(cfg.head_chars))]
    if cfg.body == "female":  # 「はみ出し」は胴がまっすぐな男性の体だけ（2026-10-17 依頼者）
        body_check.append("--no-protrusion")
    steps: list[tuple[str, list[str] | None]] = [
        ("validate", ["-q", str(cfg.unit_dir), *grids]),
        ("compose", [str(cfg.compose), "--check", "--out", str(cfg.unit_dir)]),
        ("body_check", body_check),
        ("hand_mirror", [str(cfg.compose), "--root", str(root)]),
        ("unit_check", [str(cfg.unit_dir), "--items", cfg.items, "--core", core_dir]),  # 脚の中心は芯で測る
    ]
    wc = cfg.weapon_check
    if wc is None:
        steps.append(("weapon_check", None))
    else:
        args = [str(cfg.unit_dir)]
        for key in ("blade", "weapon", "hand", "hidden", "depth", "partial"):
            if wc.get(key):
                args += [f"--{key}", ",".join(wc[key])]
        steps.append(("weapon_check", args))
    steps += [(name, [str(config), "--root", str(root)]) for name in NEW_CHECKS]
    return steps


def failure_lines(name: str, text: str) -> list[str]:
    prefix = "差あり " if name == "compose" else "FAIL "
    return [line for line in text.splitlines() if line.startswith(prefix)]


def covered_by(line: str, exception: dict) -> bool:
    head = line.split(":", 1)[0]
    return bool(set(NAME_RE.findall(head)) & set(exception["frames"])) and exception["what"] in line


def run(name: str, argv: list[str]) -> tuple[int, str]:
    module = importlib.import_module(name)
    out = io.StringIO()
    with contextlib.redirect_stdout(out), contextlib.redirect_stderr(out):
        try:
            code = module.main(argv)
        except SystemExit as exc:  # argparse の誤りや、validate の「ファイルが無い」
            code = exc.code if isinstance(exc.code, int) else 2
    return code, out.getvalue()


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("config", type=Path, help="checks/<ユニット>.json")
    parser.add_argument("--root", type=Path, default=REPO_ROOT, help="設定のパスの基準（既定はリポジトリの直下）")
    args = parser.parse_args(argv)
    try:
        cfg = load_unit_config(args.config, args.root)
        steps = plan(cfg, args.config, args.root)
    except UnitConfigError as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 2

    used = [0] * len(cfg.exceptions)
    worst = 0
    for name, tool_argv in steps:
        if tool_argv is None:
            print(f"--   {name}: 設定に無いので走らせない")
            continue
        code, text = run(name, tool_argv)
        if code not in (0, 1):
            print(f"error {name}: 終了コード {code}\n{text.rstrip()}", file=sys.stderr)
            worst = 2
            continue
        lines = failure_lines(name, text)
        if code == 1 and not lines:
            lines = [f"（{name} が終了コード 1 を返したが、失敗の行が無い）"]
        left, passed = [], 0
        for line in lines:
            hit = [i for i, e in enumerate(cfg.exceptions) if e["check"] == name and covered_by(line, e)]
            for i in hit:
                used[i] += 1
            if hit:
                passed += 1
            else:
                left.append(line)
        note = f"（例外で通した {passed} 件）" if passed else ""
        if left:
            print(f"NG   {name}: 落ちた {len(left)} 件{note}")
            for line in left:
                print(f"       {line}")
            worst = max(worst, 1)
        else:
            print(f"ok   {name}{note}")
    for i, exception in enumerate(cfg.exceptions):
        if not used[i]:
            print(f"使われなかった例外: {exception['check']} {','.join(exception['frames'])} 「{exception['what']}」")
    return worst


if __name__ == "__main__":
    raise SystemExit(main())
