"""1 回りの候補の記録（`local/rounds/<run_id>.json`）。GPU も Modal も要らない。

候補に 1 から番号を振る。依頼者が全部を目で見て、番号で答える（機械的には外さない）。
パスは `local/` からの相対で書く（`local/` を動かしても読める）。
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path

from artgen.config import ConfigError


@dataclass
class Candidate:
    number: int
    path: Path


@dataclass
class Round:
    run_id: str
    candidates: list[Candidate]


def unused_run_id(rounds_dir: Path, run_id: str) -> str:
    """回りの記録の名前が空いていれば run_id を、取られていれば `<run_id>_2`、`_3` … を返す。"""
    candidate, n = run_id, 1
    while (Path(rounds_dir) / f"{candidate}.json").exists():
        n += 1
        candidate = f"{run_id}_{n}"
    return candidate


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
        entries.append({"number": number, "path": rel})
    out = rounds_dir / f"{run_id}.json"
    if out.exists():
        # 上書きすると、先の回りの番号と絵の対応が失われ、その番号で別の絵を採用してしまう
        raise ConfigError(f"{out.name}: 同じ名前の回りの記録が既にある（{run_id}）。上書きしない")
    rounds_dir.mkdir(parents=True, exist_ok=True)
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
            candidates=[Candidate(int(c["number"]), local / c["path"]) for c in data["candidates"]],
        )
    except OSError as e:
        raise ConfigError(f"{path.name}: 読めない: {e}") from e
    except (json.JSONDecodeError, KeyError, TypeError, ValueError) as e:
        raise ConfigError(f"{path.name}: 回りの記録として読めない: {e!r}") from e
