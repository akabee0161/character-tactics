"""採用した絵の置き場（`selected/<id>/`）と、run の中の候補探し。GPU もウィジェットも使わない。"""

from __future__ import annotations

import hashlib
import json
import os
import re
import shutil
import zipfile
from collections.abc import Callable
from datetime import datetime
from pathlib import Path

from PIL import Image, ImageOps

from artgen.config import ConfigError
from artgen.pnginfo import MissingParamsError, read_params, save_png

BOX_FILE = "selection.json"
FACE_NAME = "face.png"
_STAMP = "%Y%m%d_%H%M%S"

Box = tuple[int, int, int, int]


def file_sha256(path: Path) -> str:
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def check_expression_source(expression_params: dict, face: Path, where: str) -> None:
    """表情が今の顔から作った物か確かめる。source_sha256 が無い古い PNG は止めない。"""
    expected = expression_params.get("source_sha256")
    if expected is None:
        return
    face = Path(face)
    if not face.is_file():
        raise ConfigError(f"{where}: 表情の元になった顔（{FACE_NAME}）が無い。顔を採用してから表情を作る")
    accepted = {file_sha256(face)}
    try:
        adopted_from = read_params(face).get("adopted_from_sha256")
    except (MissingParamsError, OSError):
        adopted_from = None
    if isinstance(adopted_from, str):
        accepted.add(adopted_from)  # 反転なしで採用した候補の元の絵
    if expected not in accepted:
        raise ConfigError(
            f"{where}: この表情は今の顔から作っていない（顔を採用し直したか、別の絵を source に渡したため）。"
            "今の顔で表情を作り直してから採用する"
        )


def selected_name(params: dict) -> str:
    template = params.get("template")
    if template == "fullbody":
        return "fullbody.png"
    if template == "face":
        if params.get("source"):
            expression = params.get("expression")
            if not isinstance(expression, str) or not expression:
                raise ConfigError("条件に source があるのに expression が無い（表情の名前が分からない）")
            _check_name_part(expression, "条件の expression")
            return f"face_{expression}.png"
        return FACE_NAME
    raise ConfigError(f"条件の template が face・fullbody のどちらでもない: {template!r}")


def _check_name_part(value: str, where: str) -> None:
    if value in {".", ".."} or ".." in value or "/" in value or "\\" in value:
        raise ConfigError(f"{where}: ファイル名に使えない値: {value!r}")


def _check_char_id(value: object, where: str) -> str:
    """character はディレクトリ名に使うので、パスとして安全な文字列だけ通す。"""
    if value is None or value == "":
        raise ConfigError(f"{where}: 条件に character が無い")
    if (
        not isinstance(value, str)
        or value in {".", ".."}
        or ".." in value
        or "/" in value
        or "\\" in value
    ):
        raise ConfigError(f"{where}: 条件の character が使えない値: {value!r}")
    return value


class SelectionStore:
    def __init__(self, selected_dir: Path, packs_dir: Path):
        self.selected_dir = Path(selected_dir)
        self.packs_dir = Path(packs_dir)
        # 直近の adopt で replaced/ へ移したファイル名と、移した先のフォルダ名（画面に出す用）
        self.last_moved: list[str] = []
        self.last_replaced: str | None = None
        self._moves: list[tuple[Path, Path]] = []  # (元の場所, replaced/ の中)
        self._created_dirs: list[Path] = []

    def face_path(self, char_id: str) -> Path:
        return self.selected_dir / char_id / FACE_NAME

    def face_style(self, char_id: str) -> str | None:
        path = self.face_path(char_id)
        if not path.is_file():
            return None
        return read_params(path).get("style")

    def face_style_definition(self, char_id: str) -> dict | None:
        """採用した顔の条件に、その場の画風の定義（overrides.style_definition）があれば返す。"""
        path = self.face_path(char_id)
        if not path.is_file():
            return None
        overrides = read_params(path).get("overrides")
        if not isinstance(overrides, dict):
            return None
        return overrides.get("style_definition")

    def adopt(
        self,
        candidate: Path,
        flip: bool = False,
        *,
        now: Callable[[], datetime] = datetime.now,
    ) -> Path:
        candidate = Path(candidate)
        self.last_moved, self.last_replaced = [], None
        self._moves, self._created_dirs = [], []
        # 何も書く前に検査する
        params = read_params(candidate)
        name = selected_name(params)
        char_id = _check_char_id(params.get("character"), candidate.name)
        if flip and name != FACE_NAME:
            raise ConfigError(f"{candidate.name}: 左右反転は顔（{FACE_NAME}）だけに使える")
        if name not in (FACE_NAME, "fullbody.png"):
            check_expression_source(params, self.face_path(char_id), candidate.name)
        with Image.open(candidate) as im:
            image = im.copy()
        if flip:
            image = ImageOps.mirror(image)

        char_dir = self.selected_dir / char_id
        # 先に新しい絵を一時ファイルへ保存する。失敗しても前の採用は動かさない
        tmp = char_dir / f".{name}.new"
        dest = char_dir / name
        backup: Path | None = None  # この試行が作った前の絵の控え。公開後に失敗しても戻せるように取っておく
        try:
            saved = {k: v for k, v in params.items() if k != "adopted_from_sha256"}
            saved["flipped"] = bool(flip)
            if name == FACE_NAME and not flip:
                # 候補から作った表情を、その候補を採用した顔にも認めるための記録
                saved["adopted_from_sha256"] = file_sha256(candidate)
            save_png(image, tmp, saved)
            if name == FACE_NAME:
                self._move_aside(char_dir, now())
            if dest.is_file():
                # 戻せず残った前回の控えを上書き・復元しないよう、試行ごとの名前にする
                n = 0
                while (attempt_backup := char_dir / f".{name}.old.{n}").exists():
                    n += 1
                try:
                    shutil.copy2(dest, attempt_backup)
                except BaseException:
                    attempt_backup.unlink(missing_ok=True)  # 途中のコピーで前の絵を壊さない
                    raise
                backup = attempt_backup
            os.replace(tmp, dest)
        except BaseException as e:
            # 途中で失敗したら、前の絵・表情・範囲の組み合わせに戻す。
            # 戻す側の失敗で元の例外を隠さない（残った .old は手で戻せる）
            try:
                if backup is not None and backup.exists():
                    if dest.is_file() and file_sha256(dest) == file_sha256(backup):
                        backup.unlink()  # まだ公開前（前の絵のまま）
                    else:
                        os.replace(backup, dest)
                self._restore_aside()
            except Exception as restore_error:
                e.add_note(f"前の採用へ戻せなかった: {restore_error}")
            raise
        finally:
            tmp.unlink(missing_ok=True)
        if backup is not None:
            backup.unlink(missing_ok=True)
        return dest

    def _move_aside(self, char_dir: Path, when: datetime) -> None:
        targets = sorted(char_dir.glob("face_*.png")) + [
            p for p in [char_dir / BOX_FILE] if p.is_file()
        ]
        if not targets:
            return
        base = char_dir / "replaced"
        stamp = when.strftime(_STAMP)
        dest = base / stamp
        n = 1
        while dest.exists():  # 同じ秒の再採用で上書きしない
            n += 1
            dest = base / f"{stamp}_{n}"
        if not base.exists():
            self._created_dirs.append(base)
        dest.mkdir(parents=True)
        self._created_dirs.append(dest)
        self.last_replaced = dest.name
        for p in targets:
            self._moves.append((p, dest / p.name))
            shutil.move(str(p), dest / p.name)
            self.last_moved.append(p.name)
            print(f"{char_dir.name}/{p.name} を replaced/{dest.name}/ へ移した")

    def _restore_aside(self) -> None:
        """replaced/ へ移したファイルを元の場所へ戻し、作った空のフォルダを消す。"""
        for orig, moved in reversed(self._moves):
            if orig.exists():
                moved.unlink(missing_ok=True)  # 移しかけの残り
            elif moved.exists():
                shutil.move(str(moved), orig)
        for d in reversed(self._created_dirs):
            try:
                d.rmdir()
            except OSError:
                pass
        self._moves, self._created_dirs = [], []
        self.last_moved, self.last_replaced = [], None

    def read_box(self, char_id: str) -> Box | None:
        path = self.selected_dir / char_id / BOX_FILE
        if not path.is_file():
            return None
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError) as e:
            raise ConfigError(f"{char_id}/{BOX_FILE}: 読めない: {e}") from e
        box = data.get("inpaint_box") if isinstance(data, dict) else None
        if (
            not isinstance(box, list)
            or len(box) != 4
            or not all(isinstance(v, int) and not isinstance(v, bool) for v in box)
        ):
            raise ConfigError(f"{char_id}/{BOX_FILE}: inpaint_box: 整数 4 つの [x0, y0, x1, y1] でない")
        return (box[0], box[1], box[2], box[3])

    def save_box(self, char_id: str, box: Box) -> Path:
        path = self.selected_dir / char_id / BOX_FILE
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps({"inpaint_box": list(box)}), encoding="utf-8")
        return path

    def characters(self) -> list[str]:
        if not self.selected_dir.is_dir():
            return []
        return sorted(d.name for d in self.selected_dir.iterdir() if d.is_dir() and any(d.glob("*.png")))

    def pack(
        self,
        char_ids: list[str] | None = None,
        *,
        now: Callable[[], datetime] = datetime.now,
    ) -> Path:
        ids = self.characters() if char_ids is None else list(char_ids)
        if char_ids is not None:
            for cid in ids:
                d = self.selected_dir / cid
                if not d.is_dir() or not any(d.glob("*.png")):
                    raise ConfigError(f"{cid}: 採用した絵が無い")
        files: list[tuple[Path, str]] = []
        for cid in ids:
            d = self.selected_dir / cid
            for p in sorted(d.glob("*.png")) + [d / BOX_FILE]:
                if p.is_file():
                    files.append((p, f"{cid}/{p.name}"))
        if not files:
            raise ConfigError("採用した絵が無い")
        self.packs_dir.mkdir(parents=True, exist_ok=True)
        out = self.packs_dir / f"selected_{now().strftime(_STAMP)}.zip"
        with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as z:
            for p, arc in files:
                z.write(p, arc)
        return out


_RUN_ID = re.compile(r"\d{8}_\d{6}")


def run_kind(template: str, expression: str | None = None, *, compare: bool = False) -> str:
    """runs/<キャラクター>/<種類>/ の「種類」の名前。"""
    _check_name_part(template, "template")
    if compare:
        return "styles" if template == "face" else f"styles-{template}"
    if expression:
        _check_name_part(expression, "expression")
        return f"face-{expression}"
    return template


def run_dir(runs_dir: Path, char_id: str, kind: str, run_id: str) -> Path:
    _check_name_part(char_id, "character")
    _check_name_part(kind, "kind")
    _check_name_part(run_id, "run_id")
    return Path(runs_dir) / char_id / kind / run_id


def _subdirs(path: Path) -> list[Path]:
    return sorted(d for d in path.iterdir() if d.is_dir()) if path.is_dir() else []


def _iter_runs(runs_dir: Path) -> list[tuple[str, str | None, str | None, Path]]:
    """(日時, キャラクター | None, 種類 | None, フォルダ)。古い階層 runs/<日時>/ は char・kind が None。"""
    found: list[tuple[str, str | None, str | None, Path]] = []
    for top in _subdirs(Path(runs_dir)):
        if _RUN_ID.fullmatch(top.name):
            found.append((top.name, None, None, top))
            continue
        for kind_dir in _subdirs(top):
            for run in _subdirs(kind_dir):
                if _RUN_ID.fullmatch(run.name):
                    found.append((run.name, top.name, kind_dir.name, run))
    return found


def run_ids(runs_dir: Path) -> list[str]:
    return sorted({rid for rid, *_ in _iter_runs(runs_dir)})


def run_paths(
    runs_dir: Path,
    run_id: str | None = None,
    *,
    char: str | None = None,
    kind: str | None = None,
) -> list[Path]:
    entries = _iter_runs(runs_dir)
    if not entries:
        raise ConfigError(f"{runs_dir}: run が無い")
    filtered = char is not None or kind is not None
    if filtered:
        entries = [e for e in entries if (char is None or e[1] == char) and (kind is None or e[2] == kind)]
        if not entries:
            raise ConfigError(_no_candidate(runs_dir, char, kind))
    ids = sorted({e[0] for e in entries})
    if run_id is None:
        run_id = ids[-1]
    elif run_id not in ids:
        if filtered:
            raise ConfigError(_no_candidate(runs_dir, char, kind, run_id))
        raise ConfigError(f"{runs_dir}: run が無い: {run_id}（ある日時: {_recent_ids(ids)}）")
    paths: list[Path] = []
    for rid, _c, _k, d in entries:
        if rid == run_id:
            paths.extend(d.glob("*.png"))
    return sorted(paths)


def _recent_ids(ids: list[str], limit: int = 3) -> str:
    """日時を新しい順に limit 個、「・」でつなぐ。"""
    return "・".join(sorted(ids, reverse=True)[:limit])


def _no_candidate(runs_dir: Path, char: str | None, kind: str | None, run_id: str | None = None) -> str:
    entries = [e for e in _iter_runs(runs_dir) if e[1] is not None]
    chars = sorted({e[1] for e in entries})
    kinds = sorted({e[2] for e in entries if char is None or e[1] == char})
    cond = f"char={char}, kind={kind}" + (f", run_id={run_id}" if run_id else "")
    detail = f"あるキャラクター: {'・'.join(chars) or 'なし'}"
    if char in chars or (char is None and kind is not None):
        detail += f"、{'そのキャラクターの' if char else ''}種類: {'・'.join(kinds) or 'なし'}"
    message = f"{runs_dir}: 候補が無い: {cond}（{detail}）"
    legacy = sorted({e[0] for e in _iter_runs(runs_dir) if e[1] is None})
    if legacy:
        message += (
            "。古い runs/<日時>/ は char・kind では絞れない。"
            f'P.pick(forge, run_id="<日時>") で開く（古い日時: {_recent_ids(legacy)}）'
        )
    return message


def find_candidate(runs_dir: Path, key: str | int, run_id: str | None = None) -> Path:
    """ファイル名（str）は全 run から新しい順に探す（run_id 指定ならその run だけ）。シード（int）は最新の run から探す。"""
    if isinstance(key, str) and run_id is None:
        for _rid, _c, _k, d in sorted(_iter_runs(runs_dir), key=lambda e: e[0], reverse=True):
            hit = d / key
            if hit.is_file():
                return hit
        raise ConfigError(f"候補が見つからない: {key}")
    paths = run_paths(runs_dir, run_id)
    if isinstance(key, str):
        found = [p for p in paths if p.name == key]
    else:
        found = []
        for p in paths:
            try:
                if read_params(p).get("seed") == key:
                    found.append(p)
            except MissingParamsError:
                continue
    if not found:
        raise ConfigError(f"候補が見つからない: {key}")
    if len(found) > 1:
        names = "・".join(p.name for p in found)
        raise ConfigError(f"シード {key} の候補が複数ある（{names}）。ファイル名で指定する")
    return found[0]
