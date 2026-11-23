"""生成のジョブ。ファイルの読み込み（このサーバー）と、Forge に流す実行（Modal の上）。

Modal も torch も import しない。ジョブのファイルの誤りは、Modal を起動する前に止める。
"""

from __future__ import annotations

import json
from dataclasses import dataclass, fields
from pathlib import Path

from artgen.config import ConfigError, load_character, load_template
from artgen.forge import Forge
from artgen.prompt import Overrides

REQUIRED_GPU = "Tesla T4"

_TEXT_KEYS = ("extra", "remove", "extra_negative", "remove_negative")


@dataclass(frozen=True)
class GenerateJob:
    char: str
    template: str
    n: int | None = None
    seeds: list[int] | None = None
    extra: str = ""
    remove: str = ""
    extra_negative: str = ""
    remove_negative: str = ""
    guidance: float | None = None
    steps: int | None = None


def load_jobs(path: Path, root: Path) -> list[GenerateJob]:
    """ジョブの JSON（配列）を読む。誤りは `<ファイル名>: [<番号>].<キー>: <理由>` の ConfigError。"""
    path = Path(path)
    try:
        raw = json.loads(path.read_text(encoding="utf-8"))
    except OSError as e:
        raise ConfigError(f"{path.name}: 読めない: {e}") from e
    except json.JSONDecodeError as e:
        raise ConfigError(f"{path.name}: JSON として読めない: {e}") from e
    if not isinstance(raw, list) or not raw:
        raise ConfigError(f"{path.name}: ジョブの配列（1 件以上）でない")
    known = {f.name for f in fields(GenerateJob)}
    jobs = []
    for i, entry in enumerate(raw):
        def fail(key: str, why: str) -> ConfigError:
            return ConfigError(f"{path.name}: [{i}].{key}: {why}")

        if not isinstance(entry, dict):
            raise ConfigError(f"{path.name}: [{i}]: 組（オブジェクト）でない")
        for key in entry:
            if key not in known:
                raise fail(key, f"知らないキー（使えるのは {', '.join(sorted(known))}）")
        for key in ("char", "template", *_TEXT_KEYS):
            if key in entry and not isinstance(entry[key], str):
                raise fail(key, f"文字列でない: {entry[key]!r}")
        for key in ("char", "template"):
            if key not in entry:
                raise fail(key, "必須のキーが無い")
        if (entry.get("n") is None) == (entry.get("seeds") is None):
            raise fail("n", "n と seeds のちょうど一方を書く")
        try:
            load_character(root, entry["char"])
        except ConfigError as e:
            raise fail("char", str(e)) from e
        try:
            load_template(root, entry["template"])
        except ConfigError as e:
            raise fail("template", str(e)) from e
        try:
            Forge._seeds(entry.get("n"), entry.get("seeds"))
        except ConfigError as e:
            raise fail("seeds" if entry.get("seeds") is not None else "n", str(e)) from e
        seeds = entry.get("seeds")
        if seeds is not None and len(set(seeds)) != len(seeds):
            # 同じシードは同じ名前の絵を 2 回書き、Modal の上で止まって 1 回り分が失われる
            raise fail("seeds", f"同じシードが重複している: {seeds}")
        try:
            Overrides.from_args(*(entry.get(k, "") for k in _TEXT_KEYS))
        except ConfigError as e:
            raise fail("extra", str(e)) from e
        try:
            Forge._check_sampling(entry.get("guidance", 1), entry.get("steps", 1))
        except ConfigError as e:
            raise fail("guidance" if str(e).startswith("guidance") else "steps", str(e)) from e
        jobs.append(GenerateJob(**entry))
    return jobs


def collect_faces(selected_dir: Path, jobs: list[GenerateJob]) -> dict[str, bytes]:
    """顔以外のジョブのキャラクターについて、採用済みの顔（selected/<char>/face.png）を集める。
    全身絵などは採用した顔の画風を引き継ぐので、Modal の上にも顔を置く。"""
    faces: dict[str, bytes] = {}
    for job in jobs:
        if job.template == "face" or job.char in faces:
            continue
        face = Path(selected_dir) / job.char / "face.png"
        if face.is_file():
            faces[job.char] = face.read_bytes()
    return faces


def run_jobs(
    forge: Forge, jobs: list[GenerateJob], commit: str, faces: dict[str, bytes],
) -> list[tuple[str, bytes]]:
    """ジョブを順に生成し、(forge.out_dir からの相対パス, PNG のバイト) を返す。T4 でなければ何も生成しない。"""
    gpu = forge.env.get("gpu")
    if gpu != REQUIRED_GPU:
        raise RuntimeError(f"GPU が {REQUIRED_GPU} でない（{gpu!r}）。同じシードでも絵が変わるので生成しない")
    forge.env["commit"] = commit
    for char, data in faces.items():
        face = forge.selected.face_path(char)
        face.parent.mkdir(parents=True, exist_ok=True)
        face.write_bytes(data)
    outputs: list[tuple[str, bytes]] = []
    seen: set[str] = set()
    for job in jobs:
        paths = forge.generate(
            [job.char], job.template, n=job.n, seeds=job.seeds,
            extra=job.extra, remove=job.remove,
            extra_negative=job.extra_negative, remove_negative=job.remove_negative,
            guidance=job.guidance, steps=job.steps,
        )
        for p in paths:
            rel = p.relative_to(forge.out_dir).as_posix()
            if rel in seen:
                raise RuntimeError(f"同じ名前の絵が 2 回できた（上書きされる）: {rel}")
            seen.add(rel)
            outputs.append((rel, p.read_bytes()))
    return outputs
