"""採用した絵の zip を `characters/<id>/source/` に取り込む。GPU は要らない。

`install_selection` は zip・標準出力に依らない（Colab 側から直接呼べる）。
"""

from __future__ import annotations

import argparse
import json
import shutil
import tempfile
import zipfile
from dataclasses import dataclass
from pathlib import Path, PurePosixPath

from PIL import Image

from artgen.config import ConfigError, load_character, parse_box
from artgen.export import _accepted_names
from artgen.pnginfo import MissingParamsError, read_params
from artgen.selection import check_expression_source

BOX_FILE = "selection.json"
MAX_ENTRIES = 200
MAX_TOTAL_BYTES = 200 * 1024 * 1024


@dataclass
class CharacterReport:
    char_id: str
    installed: list[str]
    removed: list[str]
    write_back: list[str]


def _format_box(box) -> str:
    return "[" + ", ".join(str(v) for v in box) + "]"


def _read_box(selection: Path, rel: str) -> list[int] | None:
    try:
        data = json.loads(selection.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, UnicodeDecodeError, OSError) as e:
        raise ConfigError(f"{rel}: 読めない: {e}") from e
    if not isinstance(data, dict):
        raise ConfigError(f"{rel}: JSON のオブジェクトでない")
    box = data.get("inpaint_box")
    if box is None:
        return None
    return list(parse_box(rel, "inpaint_box", box))


def _visible_files(d: Path) -> list[Path]:
    return sorted(p for p in d.iterdir() if p.is_file() and not p.name.startswith("."))


def _swap_all(items: list[tuple[str, list[Path]]], root: Path) -> None:
    """全キャラクターの新しい source を作ってから、まとめて入れ替える。入れ替えに失敗したら元へ戻す。"""
    staged: list[tuple[Path, Path, Path]] = []  # (staging, source_dir, backup)
    try:
        for char_id, pngs in items:
            char_root = root / "characters" / char_id
            staging = char_root / ".source.new"
            shutil.rmtree(staging, ignore_errors=True)
            staging.mkdir()
            staged.append((staging, char_root / "source", char_root / ".source.old"))
            for p in pngs:
                shutil.copyfile(p, staging / p.name)
    except BaseException:
        for staging, _, _ in staged:
            shutil.rmtree(staging, ignore_errors=True)
        raise

    # 入れ替えに取りかかった順。途中で止まった 1 件も含め、失敗・中断時はここから元へ戻す
    started: list[tuple[Path, Path, bool]] = []  # (source_dir, backup, had_old)
    try:
        for staging, source_dir, backup in staged:
            shutil.rmtree(backup, ignore_errors=True)
            had_old = source_dir.exists()
            started.append((source_dir, backup, had_old))  # 退避の前に登録する
            if had_old:
                source_dir.rename(backup)
            staging.rename(source_dir)
    except BaseException:
        for source_dir, backup, had_old in reversed(started):
            if had_old:
                if backup.exists():  # 退避済み。新しい source を捨てて戻す
                    shutil.rmtree(source_dir, ignore_errors=True)
                    backup.rename(source_dir)
                # 退避前に止まったなら、元の source はそのまま残っている
            else:
                shutil.rmtree(source_dir, ignore_errors=True)
        for staging, _, _ in staged:
            shutil.rmtree(staging, ignore_errors=True)
        raise
    for _, _, backup in staged:
        shutil.rmtree(backup, ignore_errors=True)


def install_selection(root: Path, selected_dir: Path) -> list[CharacterReport]:
    """`selected_dir/<id>/` ごとに `characters/<id>/source/` を丸ごと置き換える。

    すべてのキャラクター・ファイルを検査し、新しい source をすべて作ってから入れ替える。
    入れ替えの途中で失敗したときは、入れ替え済みの分も元へ戻す。
    """
    root, selected_dir = Path(root), Path(selected_dir)
    char_dirs = sorted(p for p in selected_dir.iterdir() if p.is_dir() and not p.name.startswith("."))
    if not char_dirs:
        raise ConfigError(f"{selected_dir.name}: キャラクターのフォルダが無い")

    plans: list[tuple[str, list[Path], CharacterReport]] = []
    for char_dir in char_dirs:
        char_id = char_dir.name
        character = load_character(root, char_id)
        accepted = _accepted_names(list(character.expressions))
        pngs: list[Path] = []
        write_back: list[str] = []
        selection_box: list[int] | None = None
        used_boxes: list[list[int]] = []  # 表情の PNG が実際に使った範囲
        for p in _visible_files(char_dir):
            where = f"{char_id}/{p.name}"
            if p.name == BOX_FILE:
                selection_box = _read_box(p, where)
                continue
            if p.name not in accepted:
                raise ConfigError(f"{where}: 受け付けない名前（受け付ける名前: {', '.join(accepted)}）")
            params = read_params(p)  # 無ければ MissingParamsError のまま上げる
            owner = params.get("character")
            if owner != char_id:
                raise ConfigError(f"{where}: 条件の character が {owner!r}（{char_id!r} の絵でない）")
            pngs.append(p)
            used_raw = params.get("inpaint_box")
            if used_raw is not None:
                used = list(parse_box(where, "inpaint_box", used_raw))
                if used not in used_boxes:
                    used_boxes.append(used)
            if p.name not in ("face.png", "fullbody.png"):
                check_expression_source(params, char_dir / "face.png", where)
            overrides = params.get("overrides")
            if overrides:
                write_back.append(f"{p.name}: overrides: {json.dumps(overrides, ensure_ascii=False)}")
        if not pngs:
            raise ConfigError(f"{char_id}: 取り込む PNG が無い")
        # 表情を作ったときに使った範囲を優先する（後から範囲を動かしても、絵と合う方を戻す）
        candidates = used_boxes or ([selection_box] if selection_box is not None else [])
        current = list(character.inpaint_box or ())
        for box in candidates:
            if box != current:
                write_back.append(f"inpaint_box: {_format_box(box)} を character.yaml へ")

        source_dir = root / "characters" / char_id / "source"
        old = {p.name for p in _visible_files(source_dir)} if source_dir.is_dir() else set()
        new = {p.name for p in pngs}
        report = CharacterReport(
            char_id=char_id,
            installed=sorted(new),
            removed=sorted(old - new),
            write_back=write_back,
        )
        plans.append((char_id, pngs, report))

    _swap_all([(char_id, pngs) for char_id, pngs, _ in plans], root)
    return [report for _, _, report in plans]


def extract_pack(zip_path: Path, dest: Path, *, root: Path) -> Path:
    """zip を `dest` に安全に展開し、`selected/` と同じ形のフォルダ（`dest`）を返す。

    すべてのエントリ（`<id>/<名前>` の 2 段・`..` や絶対パスが無い・既知の ID・受け付ける名前）を
    確かめてから、1 つずつ書く。
    """
    zip_path, dest, root = Path(zip_path), Path(dest), Path(root)
    expressions: dict[str, list[str]] = {}
    with zipfile.ZipFile(zip_path) as z:
        members: list[tuple[zipfile.ZipInfo, str, str]] = []
        infos = z.infolist()
        if len(infos) > MAX_ENTRIES:
            raise ConfigError(f"{zip_path.name}: エントリが多すぎる（{len(infos)} 個、上限 {MAX_ENTRIES}）")
        total = sum(i.file_size for i in infos)
        if total > MAX_TOTAL_BYTES:
            raise ConfigError(
                f"{zip_path.name}: 展開後の大きさが大きすぎる（{total // (1024 * 1024)} MB、"
                f"上限 {MAX_TOTAL_BYTES // (1024 * 1024)} MB）"
            )
        seen: set[tuple[str, str]] = set()
        for info in infos:
            raw = info.filename
            where = f"{zip_path.name}: {raw}"
            if "\\" in raw or raw.startswith("/") or (len(raw) > 1 and raw[1] == ":"):
                raise ConfigError(f"{where}: 絶対パス・不正な区切りは受け付けない")
            parts = PurePosixPath(raw).parts
            if ".." in parts or "." in parts:
                raise ConfigError(f"{where}: '..' を含むパスは受け付けない")
            if info.is_dir():
                if len(parts) != 1:
                    raise ConfigError(f"{where}: <id>/<名前> の 2 段でない")
                continue
            if len(parts) != 2:
                raise ConfigError(f"{where}: <id>/<名前> の 2 段でない")
            char_id, name = parts
            if name.startswith("."):
                continue
            if not (root / "characters" / char_id / "character.yaml").is_file():
                raise ConfigError(f"{where}: 知らないキャラクター {char_id!r}（characters/{char_id}/character.yaml が無い）")
            if char_id not in expressions:
                expressions[char_id] = list(load_character(root, char_id).expressions)
            accepted = _accepted_names(expressions[char_id])
            if name != BOX_FILE and name not in accepted:
                raise ConfigError(f"{where}: 受け付けない名前（受け付ける名前: {', '.join(accepted)}）")
            if (char_id, name) in seen:
                raise ConfigError(f"{where}: 同じ名前のエントリが複数ある")
            seen.add((char_id, name))
            members.append((info, char_id, name))

        dest.mkdir(parents=True, exist_ok=True)
        for info, char_id, name in members:
            target = dest / char_id / name
            target.parent.mkdir(parents=True, exist_ok=True)
            with z.open(info) as src, open(target, "wb") as out:
                shutil.copyfileobj(src, out)
    return dest


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="python -m artgen.intake", description="採用した絵の zip を取り込む")
    parser.add_argument("zip", type=Path)
    parser.add_argument("--root", type=Path, default=Path("."))
    args = parser.parse_args(argv)
    try:
        with tempfile.TemporaryDirectory() as tmp:
            selected = extract_pack(args.zip, Path(tmp) / "selected", root=args.root)
            reports = install_selection(args.root, selected)
    except (
        ConfigError, MissingParamsError, zipfile.BadZipFile, UnicodeDecodeError, RuntimeError, OSError,
        Image.DecompressionBombError,
    ) as e:
        print(f"取り込めない: {e}")
        return 1
    for r in reports:
        print(f"{r.char_id}: 取り込んだ: {', '.join(r.installed)}")
        if r.removed:
            print(f"{r.char_id}: 消した: {', '.join(r.removed)}")
        for line in r.write_back:
            print(f"  書き戻し: {line}")
    print("次: 上の一覧を character.yaml に書き戻す。そのあと、キャラクターごとに")
    for r in reports:
        print(f"  python -m artgen.export {r.char_id}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
