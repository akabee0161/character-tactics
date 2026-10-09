"""敵の4方向×6コマを、層と重なり順の表で組む（試作、2026-10-09）。

設計: character-tactics の docs/superpowers/specs/2026-10-09-unit-layer-parts-design.md
（槍の女性 a の left で試し、依頼者と決めた表で4方向・axe-horn へ広げた。台帳 2026-10-09「層の試作を広げる」）
使い方（pixel-asset-forge で）:
    .venv/bin/python cand/gen/mklayers.py                      # 試作の敵をすべて cand/layer-trial/<id>/ に書く
    .venv/bin/python cand/gen/mklayers.py axe-horn             # 1体だけ書く
    .venv/bin/python cand/gen/mklayers.py --check              # 書いてあるコマが、表の順で合成し直した結果と同じか
    .venv/bin/python cand/gen/mklayers.py axe-horn --check --dir D  # D のコマと比べる（検査が差を拾うかの確認用）
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
UNITS = ["spear-thug-a-f", "axe-horn"]  # 試作する敵（目・頭・服・武器・素体・長い髪は mf.ENEMIES の定義）
OUT_ROOT = Path("cand/layer-trial")
DIRS = ["down", "up", "left", "right"]
STATES = ["base", "idle2", "walk_a", "walk_b", "atk_wind", "atk_hit"]
# 重なり順（奥→手前）。向きごとに6コマとも同じで、敵によらない（無い部品は空の層。2026-10-09 依頼者と決めた）
# - left: 武器を持つ手が体の奥。振りかぶりの拳も胴の後ろ（設計書 3.3）
# - down・right: 武器と拳は髪・かぶり物の手前（今の絵と同じ。right は握る手が体の手前側）
# - up: 後ろ姿では背中の髪が一番手前。武器と拳は芯と髪の後ろ（攻撃も「後ろに槍を引いている」）
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
_AXE_FRONT = mw.place(mw.ringed(mw.flip(mw.AXE)), 0, 0)[0][0]  # right の斧（刃を右へ、輪郭を一周閉じる）
# 男性の座標の (武器, 拳, 握る点)。今の mkweapons.WEAPONS と同じパッチを、武器と拳に分けて持つ
WEAPON_PARTS = {
    "spear": {
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
    },
    "axe": {
        ("down", "base"): (mw.place(mw.AXE, 9, 18), mw.fist_v(9, 18), (9, 18)),
        ("up", "base"): (mw.mirror(mw.place(mw.AXE, 9, 18), 31), mw.mirror(mw.HAND_CAPS, 31), (22, 18)),
        ("left", "base"): (mw.place(mw.AXE, 21, 18), mw.FIST_FAR_L, (21, 18)),
        ("right", "base"): (mw.place(_AXE_FRONT, 11, 18), mw.fist_v(11, 18), (11, 18)),
        ("down", "atk_wind"): (mw.stick(9, [("S", 8), ("M", 3), ("M", 2), ("N", 1)], 3), mw.fist_v(9, 13), (9, 13)),
        ("up", "atk_wind"): (mw.stick(22, [("M", 11), ("M", 2), ("N", 1)], 3), mw.fist_v(22, 13), (22, 13)),
        ("left", "atk_wind"): (mw.merge(mw.place(mw.AXE, 22, 12), mw.SHAFT_L),
                               mw.merge(mw.fist_v(22, 12), mw.ARM_L), (22, 12)),
        ("right", "atk_wind"): (mw.place(_AXE_FRONT, 8, 12), mw.mirror(mw.merge(mw.fist_v(22, 12), mw.ARM_L), 30),
                                (8, 12)),
        ("down", "atk_hit"): (mw.stick(12, [("N", 1), ("M", 1), ("M", 2), ("M", 6), ("S", 1)], 15),
                              mw.fist_v(12, 18), (12, 18)),
        ("up", "atk_hit"): ([], [], (0, 0)),  # 体の向こうに隠れる（今の絵も描いていない）
        ("left", "atk_hit"): (mw.raster_axe(12.0, 17.0, -1, -1), mw.fist_sq(11, 16), (11, 16)),
        ("right", "atk_hit"): (mw.mirror(mw.raster_axe(12.0, 17.0, -1, -1), 30), mw.mirror(mw.fist_sq(11, 16), 30),
                               (19, 16)),
    },
}


def unit(eid):
    """mf.ENEMIES の定義（名前, 目, 頭, 服, 武器, 素体[, 長い髪]）。"""
    name, eye, head, cloth, weapon, sex, *rest = mf.ENEMIES[eid]
    return {"name": name, "eye": eye, "head": head, "cloth": cloth, "weapon": weapon, "sex": sex,
            "hair": rest[0] if rest else None}


def out_dir(eid):
    return OUT_ROOT / eid


def key_of(st):
    return "base" if st in ("base", "idle2", "walk_a", "walk_b") else st


def hand_shift(eid, d, st):
    """武器を持つ手の位置（男性の座標の拳からのずれ）。手の位置は体の性質で、武器は拳の握る点に付く。
    女性の値は今の mkweapons の FEMALE_SHIFT（と武器ごとの例外）と同じ。待機2は拳を2px上げる。"""
    u, key = unit(eid), key_of(st)
    dx = 0 if u["sex"] == "male" else mw.FEMALE_SHIFT_WEAPON.get((u["weapon"], key, d), mw.FEMALE_SHIFT[key][d])
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


def far_shade(layer):
    """奥の手は影の色で描く（明るいと体の手前に浮いて見えた。2026-10-08 依頼者の指摘、振りかぶりも 2026-10-09）。"""
    return Layer([["skin_rose_shadow" if n in mw.HAND else n for n in row] for row in layer.frame], dict(layer.anchors))


def core_frame(eid, d, st):
    """頭・胴・脚・目・服の飾り。left は奥の腕を外した素体（6コマ共通）、他の向きは今の絵と同じ素体。"""
    u = unit(eid)
    kind = "noarm" if d == "left" else {"idle2": "idle2", "atk_wind": "noarm", "atk_hit": "noarm"}.get(st, "base")
    base = mf.body(kind, d, u["sex"])
    mf.mp.bodies[d] = base  # 服の飾りは素体に合わせる（mkframes と同じ）
    core = [row[:] for row in base]
    for part in [read(f"eye_{u['eye']}_{d}")] + [{"belt": mf.mp.belt, "tatter": mf.mp.tatter}[c](d) for c in u["cloth"]]:
        mf.overlay(core, part)
    if st.startswith("walk"):  # 歩きは脚（y=28〜30）だけ差し替える（mkframes と同じ）
        w = eb.read_frame(Path(mf.WALK[u["sex"]].format(d=d, st=st)))
        for y in range(28, 31):
            core[y] = w[y][:]
    return core


def build_layers(eid, d, st):
    u = unit(eid)
    weapon, fist, grip = WEAPON_PARTS[u["weapon"]][(d, key_of(st))]
    dx, dy = hand_shift(eid, d, st)
    hand = shifted(Layer(patch_frame(fist), {"grip": grip}), dx, dy, HELD[d])
    fix = mw.FEMALE_FIX.get((key_of(st), d)) if u["sex"] == "female" else None
    if fix:  # 女性の手の輪郭の直し（手の位置ではなく素体の座標。待機2は上げる）
        for y, row in enumerate(patch_frame(mw.shift(fix, 0, dy))):
            for x, n in enumerate(row):
                if n is not None:
                    hand.frame[y][x] = n
    if d == "left":  # left の武器を持つ手は奥の手
        hand = far_shade(hand)
    core = core_frame(eid, d, st)
    hair = u["hair"]
    layers = {
        "武器": attach(Layer(patch_frame(weapon), {"grip": grip}), hand, "grip", "武器"),
        HELD[d]: hand,
        "長い髪（背中）": Layer(read(f"hair_{hair}_back_{d}") if hair else blank()),
        "芯": Layer(core),
        "長い髪（頭）": Layer(read(f"hair_{hair}_{d}") if hair else blank()),
        "かぶり物": Layer(read(f"head_{u['head']}_{d}") if u["head"] else blank()),
    }
    if d == "left":
        layers["手前の腕・拳"] = near_hand(core)
    return layers


def grip_outline(eid, d, st):
    """拳のパッチで「空いている所にだけ描く」輪郭（x）だった画素（手の位置へずらした後）。
    女性の手の輪郭の直し（FEMALE_FIX）が必ず描く画素は除く。"""
    u, key = unit(eid), key_of(st)
    _weapon, fist, _grip = WEAPON_PARTS[u["weapon"]][(d, key)]
    dx, dy = hand_shift(eid, d, st)
    writer = {}  # mw.apply を空のコマに掛けたとき、最後にその画素を決めた文字
    for cells, _layer in fist:
        for p, ch in cells.items():
            if ch == "x":
                writer.setdefault(p, "x")
            elif ch == "_":
                writer.pop(p, None)
            else:
                writer[p] = ch
    fix = mw.FEMALE_FIX.get((key, d)) if u["sex"] == "female" else None
    fixed = {(x, y + dy) for cells, _ in (fix or []) for (x, y) in cells}
    return {(x + dx, y + dy) for (x, y), w in writer.items() if w == "x"} - fixed


def compose_frame(eid, d, st, weapon=True):
    layers = build_layers(eid, d, st)
    order = ORDERS[d] if weapon else [n for n in ORDERS[d] if n not in ("武器", HELD[d])]
    # 武器を持たせる前は、武器と握る手だけを名前で外す（表で絞ると、表に書き忘れた層が黙って消える）
    frame, labels = compose({k: v for k, v in layers.items() if weapon or k not in ("武器", HELD[d])}, order)
    if weapon:  # 拳の「空いている所にだけ描く」輪郭は、握る武器の上には描かない（柄を途切れさせない。依頼者が案1を選んだ）
        for x, y in grip_outline(eid, d, st):
            w = layers["武器"].frame[y][x] if 0 <= x < 32 and 0 <= y < 32 else None
            if w is not None and labels[y][x] == HELD[d]:
                frame[y][x], labels[y][x] = w, "武器"
    return finish(frame, labels, mw.HAND, mw.ARM)


def write(eid):
    out = out_dir(eid)
    (out / "noweapon").mkdir(parents=True, exist_ok=True)
    codes = {}
    for d in DIRS:
        for st in STATES:
            frame, labels = compose_frame(eid, d, st)
            (out / f"{d}_{st}.txt").write_text(
                eb.serialize_frame(frame, f"{eid} {d}_{st}（層で組んだ試作）"), encoding="utf-8")
            (out / "noweapon" / f"{d}_{st}.txt").write_text(
                eb.serialize_frame(compose_frame(eid, d, st, weapon=False)[0],
                                   f"{eid} {d}_{st} の武器を持たせる前（層で組んだ試作）"),
                encoding="utf-8")
            codes[f"{d}_{st}"] = ["".join(CODES[n] if n else "." for n in row) for row in labels]
    (out / "labels.json").write_text(json.dumps({"codes": CODES, "frames": codes}, ensure_ascii=False, indent=1),
                                     encoding="utf-8")
    print("ok", out)


def check(eid, directory):
    fails = 0
    for d in DIRS:
        for st in STATES:
            path = directory / f"{d}_{st}.txt"
            if not path.is_file():
                print(f"FAIL {path}: ファイルが無い", file=sys.stderr)
                fails += 1
                continue
            diff = differences(compose_frame(eid, d, st)[0], eb.read_frame(path))
            if diff:
                print(f"FAIL {eid} {d}_{st}: 表の順で合成し直した結果と違う画素 "
                      f"{' '.join(f'({x},{y})' for x, y in diff)}", file=sys.stderr)
                fails += 1
    if fails:
        return 1
    print(f"{eid} 重なり順: ok")
    return 0


def main(argv=None):
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("units", nargs="*", choices=UNITS + [[]], default=[])
    p.add_argument("--check", action="store_true")
    p.add_argument("--dir", type=Path, help="--check で比べるフォルダ（敵を1体だけ指定したとき）")
    args = p.parse_args(argv)
    units = args.units or UNITS
    if args.dir and len(units) != 1:
        p.error("--dir は敵を1体だけ指定したときに使う")
    if args.check:
        return max(check(eid, args.dir or out_dir(eid)) for eid in units)
    for eid in units:
        write(eid)
    return 0


if __name__ == "__main__":
    sys.exit(main())
