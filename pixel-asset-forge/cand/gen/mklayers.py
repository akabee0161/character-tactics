"""槍の女性 a（spear-thug-a-f）の left 6コマを、層と重なり順の表で組む（試作、2026-10-09）。

設計: character-tactics の docs/superpowers/specs/2026-10-09-unit-layer-parts-design.md
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
STATES = ["base", "idle2", "walk_a", "walk_b", "atk_wind", "atk_hit"]
# left の重なり順（奥→手前）。6コマとも同じ（設計書 3.3、2026-10-09 依頼者と合意。振りかぶりの拳も胴の後ろ）
ORDER_LEFT = ["武器", "奥の腕・拳", "長い髪（背中）", "芯", "長い髪（頭）", "かぶり物", "手前の腕・拳"]
WEAPONLESS = [n for n in ORDER_LEFT if n not in ("武器", "奥の腕・拳")]  # weapon_check --ref 用（武器を持たせる前）
CODES = {"武器": "W", "奥の腕・拳": "F", "長い髪（背中）": "B", "芯": "C", "長い髪（頭）": "H",
         "かぶり物": "K", "手前の腕・拳": "N", ADDED: "+"}
# 女性の素体の奥の手の位置（男性の座標の拳からのずれ）。手の位置は体の性質で、武器は拳の取り付け点に付く
# （今の mkweapons の FEMALE_SHIFT の left と同じ値。待機2は拳を2px上げる）
FAR_HAND = {"base": (-1, 0), "idle2": (-1, -2), "walk_a": (-1, 0), "walk_b": (-1, 0),
            "atk_wind": (-1, 0), "atk_hit": (1, 0)}
NEAR_BOX = (12, 19)  # left の手前の手: x≤12・y≥19（顔の肌を拾わない）


def patch_frame(patch):
    canvas = blank()
    mw.apply(canvas, patch)
    return canvas


def male_fist(st):
    """男性の座標の奥の拳。grip は拳の中で柄が通る点（今の mkweapons の配置と同じ所）。"""
    if st == "atk_wind":
        return Layer(patch_frame(mw.fist_h(18)), {"grip": (18, 17)})
    if st == "atk_hit":  # 体の向こうで握る（芯に隠れる。今の絵は拳を描いていない）
        return Layer(patch_frame(mw.fist_h(13)), {"grip": (13, 17)})
    return Layer(patch_frame(mw.FIST_FAR_L), {"grip": (21, 18)})  # 影の色、2px 幅


def male_spear(st):
    if st == "atk_wind":
        return Layer(patch_frame(mw.spear_horizontal(7, 30)), {"grip": (18, 17)})
    if st == "atk_hit":
        return Layer(patch_frame(mw.spear_hit_left), {"grip": (13, 17)})
    return Layer(patch_frame(mw.mirror(mw.spear_base_down, 30)), {"grip": (21, 18)})


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


def build_layers(st):
    base = mf.body("noarm", "left", "female")  # 奥の腕を外した女性の素体（6コマ共通）
    mf.mp.bodies["left"] = base  # 服の飾りは女性の素体に合わせる（mkframes と同じ）
    core = [row[:] for row in base]
    for part in (read(f"eye_{EYE}_left"), mf.mp.tatter("left")):
        mf.overlay(core, part)
    if st.startswith("walk"):  # 歩きは脚（y=28〜30）だけ差し替える（mkframes と同じ）
        w = eb.read_frame(Path(mf.WALK["female"].format(d="left", st=st)))
        for y in range(28, 31):
            core[y] = w[y][:]
    fist = shifted(male_fist(st), *FAR_HAND[st], "奥の腕・拳")
    return {
        "武器": attach(male_spear(st), fist, "grip", "武器"),
        "奥の腕・拳": fist,
        "長い髪（背中）": Layer(read(f"hair_{HAIR}_back_left")),
        "芯": Layer(core),
        "長い髪（頭）": Layer(read(f"hair_{HAIR}_left")),
        "かぶり物": Layer(blank()),
        "手前の腕・拳": near_hand(core),
    }


def compose_frame(st, weapon=True):
    layers = build_layers(st)
    order = ORDER_LEFT if weapon else WEAPONLESS
    # 武器を持たせる前は、武器と奥の腕・拳だけを名前で外す（表で絞ると、表に書き忘れた層が黙って消える）
    frame, labels = compose({k: v for k, v in layers.items() if weapon or k not in ("武器", "奥の腕・拳")}, order)
    return finish(frame, labels, mw.HAND, mw.ARM)


def write():
    (OUT / "noweapon").mkdir(parents=True, exist_ok=True)
    codes = {}
    for st in STATES:
        frame, labels = compose_frame(st)
        (OUT / f"left_{st}.txt").write_text(
            eb.serialize_frame(frame, f"{EID} left_{st}（層で組んだ試作）"), encoding="utf-8")
        (OUT / "noweapon" / f"left_{st}.txt").write_text(
            eb.serialize_frame(compose_frame(st, weapon=False)[0], f"{EID} left_{st} の武器を持たせる前（層で組んだ試作）"),
            encoding="utf-8")
        codes[f"left_{st}"] = ["".join(CODES[n] if n else "." for n in row) for row in labels]
    (OUT / "labels.json").write_text(json.dumps({"codes": CODES, "frames": codes}, ensure_ascii=False, indent=1),
                                     encoding="utf-8")
    print("ok", OUT)


def check(directory):
    fails = 0
    for st in STATES:
        path = directory / f"left_{st}.txt"
        if not path.is_file():
            print(f"FAIL {path}: ファイルが無い", file=sys.stderr)
            fails += 1
            continue
        diff = differences(compose_frame(st)[0], eb.read_frame(path))
        if diff:
            print(f"FAIL left_{st}: 表の順で合成し直した結果と違う画素 {' '.join(f'({x},{y})' for x, y in diff)}",
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
