"""1 回りの候補の記録（`local/rounds/<run_id>.json`）。GPU も Modal も要らない。

候補に 1 から番号を振り、顔の絵には `screen_face` の「外す理由」を付ける。依頼者は番号で答える。
パスは `local/` からの相対で書く（`local/` を動かしても読める）。
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from pathlib import Path

from PIL import Image

from artgen.config import ConfigError
from artgen.pnginfo import read_params
from artgen.screen import screen_face


@dataclass
class Candidate:
    number: int
    path: Path
    reasons: list[str] = field(default_factory=list)


@dataclass
class Round:
    run_id: str
    candidates: list[Candidate]


def new_round(rounds_dir: Path, run_id: str, paths: list[Path]) -> Path:
    """paths（`rounds_dir` の隣の `local/` の下の絵）に番号を振り、`rounds_dir/<run_id>.json` に書く。"""
    rounds_dir = Path(rounds_dir)
    local = rounds_dir.parent
    entries = []
    for number, path in enumerate(paths, 1):
        path = Path(path)
        try:
            rel = path.resolve().relative_to(local.resolve()).as_posix()
        except ValueError as e:
            raise ConfigError(f"{path}: {local} の外にある絵は回りに入れられない") from e
        reasons: list[str] = []
        if read_params(path).get("template") == "face":
            with Image.open(path) as im:
                reasons = screen_face(im.convert("RGB"))
        entries.append({"number": number, "path": rel, "reasons": reasons})
    rounds_dir.mkdir(parents=True, exist_ok=True)
    out = rounds_dir / f"{run_id}.json"
    out.write_text(
        json.dumps({"run_id": run_id, "candidates": entries}, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    return out


def read_round(path: Path) -> Round:
    path = Path(path)
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        local = path.resolve().parent.parent
        return Round(
            run_id=str(data["run_id"]),
            candidates=[
                Candidate(int(c["number"]), local / c["path"], list(c["reasons"]))
                for c in data["candidates"]
            ],
        )
    except OSError as e:
        raise ConfigError(f"{path.name}: 読めない: {e}") from e
    except (json.JSONDecodeError, KeyError, TypeError, ValueError) as e:
        raise ConfigError(f"{path.name}: 回りの記録として読めない: {e!r}") from e
