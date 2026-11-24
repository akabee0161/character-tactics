"""Claude がこのサーバーで叩く CLI。Modal で候補を作り、`local/` から採用・取り込みする。

    python -m artgen.cloud generate --jobs FILE
    python -m artgen.cloud page ROUND_JSON
    python -m artgen.cloud merge ROUND_JSON ROUND_JSON [...]
    python -m artgen.cloud matte CHAR [CHAR ...]
    python -m artgen.cloud adopt ROUND_JSON NUMBER [--flip]
    python -m artgen.cloud install CHAR [CHAR ...]

forge のフォルダ（`illust-asset-forge/`）で実行する（`--root` で変えられる）。
Modal は `generate` の中でだけ import する（ほかのコマンドとテストは Modal が無くても動く）。
"""

from __future__ import annotations

import argparse
import shutil
import tempfile
from dataclasses import asdict
from datetime import datetime
from pathlib import Path

from artgen.config import ConfigError
from artgen.export import ExportError
from artgen.intake import install_selection, print_reports
from artgen.jobs import collect_faces, load_jobs
from artgen.local import local_commit, local_dirs, save_outputs
from artgen.matte import ensure_candidate_mattes, save_mattes
from artgen.pnginfo import MissingParamsError
from artgen.review_page import build_page
from artgen.rounds import new_round, read_round, unused_run_id
from artgen.selection import SelectionStore

_STOPS = (ConfigError, ExportError, MissingParamsError, OSError, RuntimeError)


def _page_path(round_json: Path) -> Path:
    return round_json.with_suffix(".html")


def _build(round_json: Path, root: Path, matte: bool) -> Path:
    """候補のページを作る。matte なら、まだマスクの無い候補の背景を先に Modal で消す
    （選んだ後に背景が消えないと分かると選び直しになるため、選ぶ前に見せる）。"""
    round_ = read_round(round_json)
    if matte:
        from artgen import modal_app  # Modal はここでだけ import する

        sent = ensure_candidate_mattes([c.path for c in round_.candidates], modal_app.run_matte)
        print(f"背景を消した: {sent} 枚（済んでいた {len(round_.candidates) - sent} 枚は送っていない）")
    return build_page(round_, _page_path(round_json), root=root)


def _build_or_explain(round_json: Path, root: Path, matte: bool) -> Path:
    """_build と同じ。背景消しが落ちたら、作った絵と記録は残っていて page でやり直せると言って止まる。"""
    try:
        return _build(round_json, root, matte)
    except _STOPS as e:
        raise RuntimeError(
            f"{e}（絵と回りの記録は残っている。python -m artgen.cloud page {round_json} でやり直せる）"
        ) from e


def cmd_generate(args: argparse.Namespace) -> None:
    root = args.root.resolve()
    dirs = local_dirs(root)
    jobs = load_jobs(args.jobs, root)  # Modal を起動する前に、ジョブの誤りを止める
    faces = collect_faces(dirs.selected, jobs)
    from artgen import modal_app  # Modal はここでだけ import する

    outputs = modal_app.run(jobs, local_commit(root), faces)
    paths = save_outputs(dirs.runs, outputs)
    run_id = unused_run_id(dirs.rounds, datetime.now().strftime("%Y%m%d_%H%M%S"))
    round_json = new_round(dirs.rounds, run_id, paths)
    del outputs  # 絵の bytes（100MB を超える）を、背景消しで送る前に手放す
    print(f"{len(paths)} 枚できた")
    print(f"回りの記録: {round_json}")  # 背景消しが落ちても、記録の場所が分かるように先に出す
    page = _build_or_explain(round_json, root, not args.no_matte)
    print(f"候補のページ: {page}")


def cmd_page(args: argparse.Namespace) -> None:
    page = _build(args.round_json, args.root.resolve(), not args.no_matte)
    print(f"候補のページ: {page}")


def cmd_merge(args: argparse.Namespace) -> None:
    """何回かに分けて作った回りを 1 つの記録とページにまとめる。番号は通しで振り直し、元の記録は変えない。"""
    if len(args.rounds) < 2:
        raise ConfigError("merge: 回りの記録を 2 つ以上渡す")
    root = args.root.resolve()
    dirs = local_dirs(root)
    paths = [c.path for r in args.rounds for c in sorted(read_round(r).candidates, key=lambda c: c.number)]
    run_id = unused_run_id(dirs.rounds, "merged_" + datetime.now().strftime("%Y%m%d_%H%M%S"))
    round_json = new_round(dirs.rounds, run_id, paths)
    print(f"{len(paths)} 枚をまとめた")
    print(f"回りの記録: {round_json}")
    page = _build_or_explain(round_json, root, not args.no_matte)
    print(f"候補のページ: {page}")


def cmd_matte(args: argparse.Namespace) -> None:
    """顔の元画像（source/face*.png）を Modal に送り、背景のマスクを characters/<id>/matte/ に置く。"""
    root = args.root.resolve()
    images: dict[str, bytes] = {}
    for char in args.chars:
        faces = sorted((root / "characters" / char / "source").glob("face*.png"))
        if not faces:
            raise ConfigError(f"characters/{char}/source: 顔の元画像（face*.png）が無い")
        for f in faces:
            images[f"{char}/{f.name}"] = f.read_bytes()
    from artgen import modal_app  # Modal はここでだけ import する

    model_sha, masks = modal_app.run_matte(images)
    for char in args.chars:
        mine = {k.split("/", 1)[1]: v for k, v in masks.items() if k.split("/", 1)[0] == char}
        sent = {name: images[f"{char}/{name}"] for name in mine}
        save_mattes(root, char, mine, model_sha, sent=sent)
        print(f"マスクを作った: {char}（{len(mine)} 枚）")


def cmd_adopt(args: argparse.Namespace) -> None:
    root = args.root.resolve()
    dirs = local_dirs(root)
    round_ = read_round(args.round_json)
    found = [c for c in round_.candidates if c.number == args.number]
    if not found:
        numbers = [c.number for c in round_.candidates]
        raise ConfigError(f"番号 {args.number} の候補が無い（{min(numbers)}〜{max(numbers)}）")
    candidate = found[0]
    dest = SelectionStore(dirs.selected, dirs.packs).adopt(candidate.path, flip=args.flip)
    print(f"採用した: {dest}")


def cmd_install(args: argparse.Namespace) -> None:
    root = args.root.resolve()
    dirs = local_dirs(root)
    with tempfile.TemporaryDirectory() as tmp:
        staged = Path(tmp) / "selected"
        for char in args.chars:
            src = dirs.selected / char
            if not src.is_dir():
                raise ConfigError(f"{char}: 採用した絵が無い（{src}）")
            (staged / char).mkdir(parents=True)
            for f in src.iterdir():  # 退避したフォルダ（replaced/）や一時ファイルは持ち込まない
                if f.is_file() and not f.name.startswith("."):
                    shutil.copy2(f, staged / char / f.name)
            # 取り込みは source/ を丸ごと置き換える。選び直していない全身絵（Colab の道で採った絵など）を
            # 消さないよう持ち越す。表情（face_*.png）は、顔が変わると検査で落ちるので持ち越さない
            kept = root / "characters" / char / "source" / "fullbody.png"
            if kept.is_file() and not (staged / char / "fullbody.png").exists():
                shutil.copy2(kept, staged / char / "fullbody.png")
        reports = install_selection(root, staged)
    print_reports(reports)


_NO_MATTE = "候補の背景を消さずにページを作る（既定では Modal で消して、隣に並べる）"


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="python -m artgen.cloud", description="Modal で作った候補を扱う")
    parser.add_argument("--root", type=Path, default=Path("."))
    sub = parser.add_subparsers(dest="command", required=True)
    p = sub.add_parser("generate", help="ジョブのファイルから Modal で生成する")
    p.add_argument("--jobs", type=Path, required=True)
    p.add_argument("--no-matte", action="store_true", help=_NO_MATTE)
    p.set_defaults(func=cmd_generate)
    p = sub.add_parser("page", help="候補のページを作り直す")
    p.add_argument("round_json", type=Path)
    p.add_argument("--no-matte", action="store_true", help=_NO_MATTE)
    p.set_defaults(func=cmd_page)
    p = sub.add_parser("merge", help="回りの記録をまとめ、通し番号の記録とページを作る")
    p.add_argument("rounds", nargs="+", type=Path)
    p.add_argument("--no-matte", action="store_true", help=_NO_MATTE)
    p.set_defaults(func=cmd_merge)
    p = sub.add_parser("matte", help="顔の元画像の背景のマスクを Modal で作る")
    p.add_argument("chars", nargs="+")
    p.set_defaults(func=cmd_matte)
    p = sub.add_parser("adopt", help="番号の候補を採用する")
    p.add_argument("round_json", type=Path)
    p.add_argument("number", type=int)
    p.add_argument("--flip", action="store_true", help="顔を左右反転して採用する")
    p.set_defaults(func=cmd_adopt)
    p = sub.add_parser("install", help="採用した絵を characters/<id>/source/ に取り込む")
    p.add_argument("chars", nargs="+")
    p.set_defaults(func=cmd_install)
    return parser


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    try:
        args.func(args)
    except _STOPS as e:
        print(f"止まった: {e}")
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
