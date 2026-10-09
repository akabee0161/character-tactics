"""槍の女性 a（spear-thug-a-f）の4方向×6コマを、層と重なり順の表で組む（試作、2026-10-09）。

設計: character-tactics の docs/superpowers/specs/2026-10-09-unit-layer-parts-design.md
（left で試し、依頼者と決めた表で down・up・right へ広げた。台帳 2026-10-09「層の試作を広げる」）
使い方（pixel-asset-forge で）:
    .venv/bin/python cand/gen/mklayers.py                  # cand/layer-trial/spear-thug-a-f/ に書く
    .venv/bin/python cand/gen/mklayers.py --check          # 書いてあるコマが、表の順で合成し直した結果と同じか
    .venv/bin/python cand/gen/mklayers.py --check --dir D  # D のコマと比べる（検査が差を拾うかの確認用）
"""
import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, "tools")
sys.path.insert(0, str(Path(__file__).resolve().parent))
import enemy_build as eb  # noqa: E402
import mkweapons as mw  # noqa: E402
from layers import ADDED, Layer, attach, blank, compose, differences, finish, shifted  # noqa: E402

mf = mw.mf
EID = "spear-thug-a-f"
HAIR, EYE = "A", "E2"  # 素の髪のごろつき（目 E2・ぼろ）、長い髪 A、かぶり物なし
OUT = Path("cand/layer-trial") / EID
DIRS = ["down", "up", "left", "right"]
STATES = ["base", "idle2", "walk_a", "walk_b", "atk_wind", "atk_hit"]
# 重なり順（奥→手前）。向きごとに6コマとも同じ（2026-10-09 依頼者と決めた）
# - left: 武器を持つ手が体の奥。振りかぶりの拳も胴の後ろ（設計書 3.3）
# - down・right: 武器と拳は髪の手前（今の絵と同じ。right は握る手が体の手前側）
# - up: 後ろ姿では背中の髪が一番手前。槍と拳は芯と髪の後ろ（攻撃も「後ろに槍を引いている」）
ORDER_LEFT = ["武器", "奥の腕・拳", "長い髪（背中）", "芯", "長い髪（頭）", "かぶり物", "手前の腕・拳"]
ORDERS = {
    "down": ["長い髪（背中）", "芯", "長い髪（頭）", "かぶり物", "武器", "武器を持つ腕・拳"],
    "up": ["武器", "芯", "武器を持つ腕・拳", "長い髪（頭）", "かぶり物", "長い髪（背中）"],
    "left": ORDER_LEFT,
    "right": ["長い髪（背中）", "芯", "長い髪（頭）", "かぶり物", "武器", "武器を持つ腕・拳"],
}
HELD = {d: "奥の腕・拳" if d == "left" else "武器を持つ腕・拳" for d in DIRS}  # 武器を握る手の層
CODES = {"武器": "W", "奥の腕・拳": "F", "武器を持つ腕・拳": "A", "長い髪（背中）": "B", "芯": "C",
         "長い髪（頭）": "H", "かぶり物": "K", "手前の腕・拳": "N", ADDED: "+"}
NEAR_BOX = (12, 19)  # left の手前の手: x≤12・y≥19（顔の肌を拾わない）
# 男性の座標の (槍, 拳, 握る点)。今の mkweapons.WEAPONS["spear"] と同じパッチを、槍と拳に分けて持つ
SPEAR_PARTS = {
    ("down", "base"): (mw.spear_base_down, mw.fist_at(18), (9, 18)),
    ("up", "base"): (mw.mirror(mw.spear_base_down, 31), mw.mirror(mw.HAND_CAPS_D, 31), (22, 18)),
    ("left", "base"): (mw.mirror(mw.spear_base_down, 30), mw.FIST_FAR_L, (21, 18)),  # 影の色、2px 幅
    ("right", "base"): (mw.shift(mw.spear_base_down, 2), mw.shift(mw.fist_at(18), 2), (11, 18)),
    ("down", "atk_wind"): (mw.spear_grip(14, tip_down=True), mw.fist_at(14), (9, 14)),
    ("up", "atk_wind"): (mw.mirror(mw.spear_grip(19), 31), mw.mirror(mw.fist_at(19), 31), (22, 19)),
    ("left", "atk_wind"): (mw.spear_horizontal(7, 30), mw.fist_h(18), (18, 17)),
    ("right", "atk_wind"): (mw.mirror(mw.spear_horizontal(7, 30), 31), mw.mirror(mw.fist_h(18), 31), (13, 17)),
    ("down", "atk_hit"): (mw.spear_grip(18, tip_down=True), mw.fist_at(18), (9, 18)),
    ("up", "atk_hit"): (mw.mirror(mw.spear_grip(14), 31), mw.mirror(mw.fist_at(14), 31), (22, 14)),
    # 体の向こうで握る（芯に隠れる。今の絵は拳を描いていない）
    ("left", "atk_hit"): (mw.spear_hit_left, mw.fist_h(13), (13, 17)),
    ("right", "atk_hit"): (mw.mirror(mw.spear_hit_left, 30), mw.fist_h(16, flip_light=True), (17, 17)),
}


def key_of(st):
    return "base" if st in ("base", "idle2", "walk_a", "walk_b") else st


def hand_shift(d, st):
    """女性の素体の武器を持つ手の位置（男性の座標の拳からのずれ）。手の位置は体の性質で、武器は拳の握る点に付く。
    値は今の mkweapons の FEMALE_SHIFT（と槍の例外）と同じ。待機2は拳を2px上げる。"""
    key = key_of(st)
    dx = mw.FEMALE_SHIFT_WEAPON.get(("spear", key, d), mw.FEMALE_SHIFT[key][d])
    return dx, -2 if st == "idle2" else 0


def patch_frame(patch):
    canvas = blank()
    mw.apply(canvas, patch)
    return canvas


def read(name):
    return eb.read_frame(Path(f"cand/enemy/{name}.txt"))


def near_hand(core):
    """芯から手前の手（肌と、それに接する輪郭）を写す。芯からは消さない（上に同じ画素が重なる）。"""
    x_max, y_min = NEAR_BOX
    skin = {(x, y) for y in range(y_min, 32) for x in range(x_max + 1) if core[y][x] in mw.HAND}
    cells = set(skin)
    for x, y in skin:
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            qx, qy = x + dx, y + dy
            if 0 <= qx < 32 and 0 <= qy < 32 and core[qy][qx] == "outline":
                cells.add((qx, qy))
    f = blank()
    for x, y in cells:
        f[y][x] = core[y][x]
    return Layer(f)


def core_frame(d, st):
    """頭・胴・脚・目・ぼろ。left は奥の腕を外した素体（6コマ共通）、他の向きは今の絵と同じ素体。"""
    kind = "noarm" if d == "left" else {"idle2": "idle2", "atk_wind": "noarm", "atk_hit": "noarm"}.get(st, "base")
    base = mf.body(kind, d, "female")
    mf.mp.bodies[d] = base  # 服の飾りは女性の素体に合わせる（mkframes と同じ）
    core = [row[:] for row in base]
    for part in (read(f"eye_{EYE}_{d}"), mf.mp.tatter(d)):
        mf.overlay(core, part)
    if st.startswith("walk"):  # 歩きは脚（y=28〜30）だけ差し替える（mkframes と同じ）
        w = eb.read_frame(Path(mf.WALK["female"].format(d=d, st=st)))
        for y in range(28, 31):
            core[y] = w[y][:]
    return core


def build_layers(d, st):
    spear, fist, grip = SPEAR_PARTS[(d, key_of(st))]
    dx, dy = hand_shift(d, st)
    hand = shifted(Layer(patch_frame(fist), {"grip": grip}), dx, dy, HELD[d])
    fix = mw.FEMALE_FIX.get((key_of(st), d))  # 女性の手の輪郭の直し（手の位置ではなく素体の座標。待機2は上げる）
    if fix:
        for y, row in enumerate(patch_frame(mw.shift(fix, 0, dy))):
            for x, n in enumerate(row):
                if n is not None:
                    hand.frame[y][x] = n
    core = core_frame(d, st)
    layers = {
        "武器": attach(Layer(patch_frame(spear), {"grip": grip}), hand, "grip", "武器"),
        HELD[d]: hand,
        "長い髪（背中）": Layer(read(f"hair_{HAIR}_back_{d}")),
        "芯": Layer(core),
        "長い髪（頭）": Layer(read(f"hair_{HAIR}_{d}")),
        "かぶり物": Layer(blank()),
    }
    if d == "left":
        layers["手前の腕・拳"] = near_hand(core)
    return layers


def compose_frame(d, st, weapon=True):
    layers = build_layers(d, st)
    order = ORDERS[d] if weapon else [n for n in ORDERS[d] if n not in ("武器", HELD[d])]
    # 武器を持たせる前は、武器と握る手だけを名前で外す（表で絞ると、表に書き忘れた層が黙って消える）
    frame, labels = compose({k: v for k, v in layers.items() if weapon or k not in ("武器", HELD[d])}, order)
    return finish(frame, labels, mw.HAND, mw.ARM)


def write():
    (OUT / "noweapon").mkdir(parents=True, exist_ok=True)
    codes = {}
    for d in DIRS:
        for st in STATES:
            frame, labels = compose_frame(d, st)
            (OUT / f"{d}_{st}.txt").write_text(
                eb.serialize_frame(frame, f"{EID} {d}_{st}（層で組んだ試作）"), encoding="utf-8")
            (OUT / "noweapon" / f"{d}_{st}.txt").write_text(
                eb.serialize_frame(compose_frame(d, st, weapon=False)[0],
                                   f"{EID} {d}_{st} の武器を持たせる前（層で組んだ試作）"),
                encoding="utf-8")
            codes[f"{d}_{st}"] = ["".join(CODES[n] if n else "." for n in row) for row in labels]
    (OUT / "labels.json").write_text(json.dumps({"codes": CODES, "frames": codes}, ensure_ascii=False, indent=1),
                                     encoding="utf-8")
    print("ok", OUT)


def check(directory):
    fails = 0
    for d in DIRS:
        for st in STATES:
            path = directory / f"{d}_{st}.txt"
            if not path.is_file():
                print(f"FAIL {path}: ファイルが無い", file=sys.stderr)
                fails += 1
                continue
            diff = differences(compose_frame(d, st)[0], eb.read_frame(path))
            if diff:
                print(f"FAIL {d}_{st}: 表の順で合成し直した結果と違う画素 {' '.join(f'({x},{y})' for x, y in diff)}",
                      file=sys.stderr)
                fails += 1
    if fails:
        return 1
    print("重なり順: ok")
    return 0


def main(argv=None):
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--check", action="store_true")
    p.add_argument("--dir", type=Path, default=OUT)
    args = p.parse_args(argv)
    if args.check:
        return check(args.dir)
    write()
    return 0


if __name__ == "__main__":
    sys.exit(main())
