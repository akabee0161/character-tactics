"""背景のマスク（キャラクターの形）。`cloud matte` が Modal で作り、`characters/<id>/matte/` に置く。

マスクは元画像と同じ大きさの L（255＝キャラクター、0＝背景）。アニメ絵用の背景除去モデル
anime-seg（skytnt/anime-seg の isnetis.onnx）で作る。色とつながりではなく形で判定するので、
背景の飾り・髪に囲まれた白・範囲の辺で切れた白い服を、まとめて扱える。

`matte.json` に、使ったモデルの SHA-256 と、作ったときの元画像の SHA-256 を記録する。
元画像を入れ替えたのにマスクを作り直していないときは、書き出しを止める。
onnxruntime・numpy は `isnet_mask` の中でだけ import する（Modal の中でだけ動く。このサーバーでは動かさない）。
"""

from __future__ import annotations

import hashlib
import io
import json
from pathlib import Path

from PIL import Image

MODEL_REPO = "skytnt/anime-seg"
MODEL_FILE = "isnetis.onnx"
MODEL_SHA256 = "f15622d853e8260172812b657053460e20806f04b9e05147d49af7bed31a6e99"
MODEL_INPUT = 1024
CANDIDATE_BATCH = 40  # 候補のマスクを Modal に 1 回で送る枚数（約 40MB。1 回 2 分ほど）


# モデルが迷った所（中間の値）をそのまま透明度にすると、背景の白が半透明のもやで残る（2026-11-24）。
# HARD_LOW 以下は透明、HARD_HIGH 以上は不透明にし、その間だけをなだらかにして輪郭のぎざぎざを防ぐ
HARD_LOW = 128
HARD_HIGH = 200


def harden(mask: Image.Image) -> Image.Image:
    span = HARD_HIGH - HARD_LOW
    return mask.convert("L").point(
        lambda v: 0 if v <= HARD_LOW else 255 if v >= HARD_HIGH else round((v - HARD_LOW) * 255 / span)
    )


def _error(message: str) -> Exception:
    from artgen.export import ExportError  # export がこのモジュールを読むので、ここで読む

    return ExportError(message)


def _sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def matte_dir(root: Path, char_id: str) -> Path:
    return Path(root) / "characters" / char_id / "matte"


def save_mattes(
    root: Path, char_id: str, masks: dict[str, bytes], model_sha256: str, sent: dict[str, bytes] | None = None
) -> list[Path]:
    """masks（元画像の名前 → マスクの PNG）を検査してから置き、matte.json を書き直す。
    sent（Modal に送った元画像の bytes）があれば、記録する SHA-256 はそこから求め、今の元画像と違えば止める
    （Modal の応答を待つあいだに元画像を差し替えると、古い絵のマスクを新しい絵のものとして登録してしまう）。"""
    if model_sha256 != MODEL_SHA256:
        raise _error(f"{char_id}: マスクを作ったモデルが違う（{model_sha256[:12]}…。{MODEL_SHA256[:12]}… のはず）")
    source_dir = Path(root) / "characters" / char_id / "source"
    images = {}
    shas = {}
    for name, data in masks.items():
        src = source_dir / name
        if not src.is_file():
            raise _error(f"characters/{char_id}/source/{name}: 元画像が無い")
        shas[name] = _sha256(src)
        if sent is not None:
            sent_sha = hashlib.sha256(sent[name]).hexdigest()
            if sent_sha != shas[name]:
                raise _error(f"characters/{char_id}/source/{name}: マスクを作っているあいだに元画像が差し替わった。作り直す")
        with Image.open(io.BytesIO(data)) as m, Image.open(src) as s:
            if m.size != s.size:
                raise _error(f"{char_id}/{name}: マスクの大きさ {m.size} が元画像 {s.size} と違う")
            images[name] = m.convert("L")
    out_dir = matte_dir(root, char_id)
    out_dir.mkdir(parents=True, exist_ok=True)
    written = []
    for name, image in images.items():
        image.save(out_dir / name, format="PNG")
        written.append(out_dir / name)
    record = {"model_sha256": model_sha256, "sources": {n: shas[n] for n in sorted(images)}}
    (out_dir / "matte.json").write_text(json.dumps(record, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return written


def load_matte(root: Path, char_id: str, name: str) -> Image.Image:
    """元画像 name のマスクを読む。無い・元画像より古いときは止める。"""
    return load_matte_with_sha(root, char_id, name)[0]


def load_matte_with_sha(root: Path, char_id: str, name: str) -> tuple[Image.Image, str]:
    """load_matte と同じで、読んだ bytes の SHA-256 も返す（書き出しの記録を、描画に使ったマスクに合わせるため）。"""
    d = matte_dir(root, char_id)
    record_path = d / "matte.json"
    redo = f"python -m artgen.cloud matte {char_id} で作る"
    if not (d / name).is_file() or not record_path.is_file():
        raise _error(f"characters/{char_id}/matte/{name}: 背景のマスクが無い。{redo}")
    record = json.loads(record_path.read_text(encoding="utf-8"))
    src = Path(root) / "characters" / char_id / "source" / name
    if record.get("sources", {}).get(name) != _sha256(src):
        raise _error(f"characters/{char_id}/matte/{name}: 背景のマスクが元画像より古い。{redo}")
    data = (d / name).read_bytes()
    with Image.open(io.BytesIO(data)) as m:
        return m.convert("L"), hashlib.sha256(data).hexdigest()


def candidate_matte_path(candidate: Path) -> Path:
    """候補（local/runs/ の PNG）のマスクの置き場。候補の隣に `<名前>.matte.png` で置く。"""
    candidate = Path(candidate)
    return candidate.with_name(candidate.stem + ".matte.png")


def ensure_candidate_mattes(candidates: list[Path], run_matte) -> int:
    """マスクがまだ無い候補だけを run_matte（Modal）に送り、候補の隣に置く。送った枚数を返す。
    候補を選ぶ前に背景を消した絵を見られるようにするため（選んだ後に消えないと分かると手間）。"""
    todo = [Path(p) for p in candidates if not candidate_matte_path(p).is_file()]
    # 区切って送る。一度に送ると、このサーバー（メモリ 1.9GB）に絵の bytes が何百 MB も載り、
    # Modal の時間切れでその回のマスクが全部失われる。区切りごとに保存するので、落ちても済んだ分は残る
    for start in range(0, len(todo), CANDIDATE_BATCH):
        batch = {str(i): p for i, p in enumerate(todo[start:start + CANDIDATE_BATCH])}
        model_sha, masks = run_matte({k: p.read_bytes() for k, p in batch.items()})
        if model_sha != MODEL_SHA256:
            raise _error(f"候補のマスクを作ったモデルが違う（{model_sha[:12]}…。{MODEL_SHA256[:12]}… のはず）")
        for k, p in batch.items():
            with Image.open(io.BytesIO(masks[k])) as m:
                m.convert("L").save(candidate_matte_path(p), format="PNG")
    return len(todo)


def isnet_mask(session, image: Image.Image) -> Image.Image:
    """onnxruntime のセッションで、image と同じ大きさのマスク（L）を作る。Modal の中で呼ぶ。"""
    import numpy as np

    rgb = image.convert("RGB")
    x = np.asarray(rgb.resize((MODEL_INPUT, MODEL_INPUT), Image.Resampling.LANCZOS), dtype=np.float32)
    x = x.transpose(2, 0, 1)[None] / 255.0
    pred = session.run(None, {session.get_inputs()[0].name: x})[0][0][0]
    mask = Image.fromarray((np.clip(pred, 0.0, 1.0) * 255).round().astype(np.uint8), mode="L")
    return mask.resize(rgb.size, Image.Resampling.LANCZOS)
