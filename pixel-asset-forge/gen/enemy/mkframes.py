import json
import sys
from pathlib import Path

sys.path.insert(0, "tools")
sys.path.insert(0, str(Path(__file__).resolve().parent))  # 同じ gen/enemy の mkparts を読む（/tmp の古い写しを読まない）
import enemy_build as eb
import mkparts as mp

DIRS = ["down", "up", "left", "right"]
OUT = Path("cand/enemy-frames")
MAPC = {"cloth_hi": "cloak_dark_hi", "cloth_base": "cloak_dark_base", "cloth_shadow": "cloak_dark_shadow",
        "skin_hi": "skin_rose_hi", "skin_base": "skin_rose_base", "skin_shadow": "skin_rose_shadow"}
RAW = {
    "male": {"base": "types/unit/base/male_{d}.txt",
             "idle2": "assets/unit/gau/parts/body_idle2_{d}.txt",
             "noarm": "assets/unit/gau/parts/body_noarm_{d}.txt"},
    "female": {"base": "types/unit/base/female_{d}.txt",
               "idle2": "cand/enemy/female_body_idle2_{d}.txt",
               "noarm": "cand/enemy/female_body_noarm_{d}.txt"},
}
# 歩きの脚（y=28〜30 だけを使う）。男性はガウの完成コマ、女性は女性の細い脚
WALK = {"male": "assets/unit/gau/{d}_{st}.txt", "female": "cand/enemy/female_{st}_{d}.txt"}

ENEMIES = {  # id: (名前, 目, 頭, 服, 武器, 素体[, 長い髪])。長い髪は cand/enemy/hair_<名前>_<dir>.txt（頭の部品の下に重ねる）
    "dagger-bandit": ("眼帯のバンダナ", "E5", "bandana", ["belt", "tatter"], "dagger", "male"),
    "dagger-knight": ("フルフェイス", "E0", "full", ["belt"], "dagger", "male"),
    "dagger-horn": ("角付きの兜", "E2", "horn", ["tatter"], "dagger", "male"),
    "dagger-thug": ("素の髪のごろつき", "E2", "bare", ["tatter"], "dagger", "male"),
}


def body(kind, d, sex="male"):
    f = eb.read_frame(Path(RAW[sex][kind].format(d=d)))
    for y in range(25, 31):
        f[y] = ["wood_shadow" if n == "cloth_shadow" else n for n in f[y]]
    return eb.recolor_frame(f, MAPC)


def overlay(canvas, part, z="front", dy=0):
    for y in range(32):
        for x in range(32):
            n = part[y][x]
            if n is None:
                continue
            ny = y + dy
            if not 0 <= ny < 32:
                continue
            if z == "front" or canvas[ny][x] is None:
                canvas[ny][x] = n


def extras(d, st):
    fin = eb.read_frame(Path(f"assets/unit/gau/{d}_{st}.txt"))
    cmp_ = eb.read_frame(Path(f"/tmp/cand2/{d}_{st}.txt"))
    add, rem = [], []
    for y in range(32):
        for x in range(32):
            if fin[y][x] is not None and cmp_[y][x] is None:
                add.append((y, x, fin[y][x]))
            elif fin[y][x] is None and cmp_[y][x] is not None and y >= 15:
                rem.append((y, x))
    return add, rem


def frame(eid, d, st, weapon="dagger", hair_back=True):
    _, eye, head, cloth, _w, sex = ENEMIES[eid][:6]
    hair = ENEMIES[eid][6] if len(ENEMIES[eid]) > 6 else None
    kind = {"base": "base", "walk_a": "base", "walk_b": "base", "idle2": "idle2",
            "atk_wind": "noarm", "atk_hit": "noarm"}[st]
    b = body(kind, d, sex)
    mp.bodies[d] = b
    canvas = [row[:] for row in b]
    if st.startswith("atk") and weapon == "dagger":
        add, rem = extras(d, st)
        for y, x in rem:
            canvas[y][x] = None
        for y, x, n in add:
            canvas[y][x] = n
    # 重ねる順: 目 → 服 → 長い髪（背中や肩の服に掛かる）→ 頭（髪の上にかぶる）
    layers = [mp.eb.read_frame(Path(f"cand/enemy/eye_{eye}_{d}.txt"))]
    for c in cloth:
        layers.append({"belt": mp.belt, "tatter": mp.tatter}[c](d))
    if hair:
        layers.append(mp.eb.read_frame(Path(f"cand/enemy/hair_{hair}_{d}.txt")))
    if head:  # None は被り物なし（長い髪だけ）
        layers.append(mp.eb.read_frame(Path(f"cand/enemy/head_{head}_{d}.txt")))
    for g in layers:
        overlay(canvas, g)
    if hair and hair_back:  # 肩より下の髪は体の後ろ（空いている画素だけ）。武器を重ねるときは武器の後で（mkweapons）
        overlay(canvas, mp.eb.read_frame(Path(f"cand/enemy/hair_{hair}_back_{d}.txt")), "back")
    if weapon == "dagger" and st in ("base", "walk_a", "walk_b", "idle2"):
        dag = eb.read_frame(Path(f"assets/part/dagger/dagger_{d}.txt"))
        overlay(canvas, dag, "back" if d in ("up", "left") else "front", -2 if st == "idle2" else 0)
    if st.startswith("walk"):
        w = eb.read_frame(Path(WALK[sex].format(d=d, st=st)))
        for y in range(28, 31):
            canvas[y] = w[y][:]
    return canvas


def main():
    for eid, (name, *_r) in ENEMIES.items():
        out = OUT / eid
        out.mkdir(parents=True, exist_ok=True)
        for d in DIRS:
            for st in ("base", "idle2", "walk_a", "walk_b", "atk_wind", "atk_hit"):
                f = frame(eid, d, st)
                (out / f"{d}_{st}.txt").write_text(
                    eb.serialize_frame(f, f"{eid} {d}_{st}（部品で組んだ）"), encoding="utf-8")
        rec = {"id": eid, "name": name, "archetype": "dagger", "body": "male", "recolor": {}}
        Path(f"/tmp/rec_{eid}.json").write_text(json.dumps(rec, ensure_ascii=False), encoding="utf-8")
    print("frames ok")


if __name__ == "__main__":
    main()
