import sys
from pathlib import Path

sys.path.insert(0, "tools")
import enemy_build as eb
from gridfile import load_palette
from PIL import Image

pal = load_palette()
sheet_def = Path("sheets/gau.txt")
for eid in ["dagger-bandit", "dagger-knight", "dagger-horn", "dagger-thug"]:
    rec = eb.Recipe(eid, eid, "dagger", "male", {}, None)
    print(eb.build(rec, Path("cand/enemy-frames") / eid, sheet_def, pal))

# 確認用: 全コマを並べた PNG（行=敵×状態、列=4方向）
states = ["base", "idle2", "walk_a", "walk_b", "atk_wind", "atk_hit"]
S = 4
W = 4 * 32 * S
im = Image.new("RGBA", (W * len(states) // 2 * 1, 1), (0, 0, 0, 0))
ids = ["dagger-bandit", "dagger-knight", "dagger-horn", "dagger-thug"]
for st_group, out in ((states[:3], "/tmp/frames_a.png"), (states[3:], "/tmp/frames_b.png")):
    sh = Image.new("RGBA", (4 * 32 * S * len(st_group) // 1, 32 * S * len(ids)), (72, 72, 79, 255))
    for r, eid in enumerate(ids):
        for c, st in enumerate(st_group):
            for i, d in enumerate(["down", "up", "left", "right"]):
                f = eb.read_frame(Path(f"cand/enemy-frames/{eid}/{d}_{st}.txt"))
                t = Image.new("RGBA", (32, 32), (0, 0, 0, 0))
                for y in range(32):
                    for x in range(32):
                        n = f[y][x]
                        if n:
                            rr, g, b = pal[n][:3]
                            t.putpixel((x, y), (rr, g, b, 255))
                t = t.resize((32 * S, 32 * S), Image.NEAREST)
                sh.alpha_composite(t, ((c * 4 + i) * 32 * S, r * 32 * S))
    sh.save(out)
