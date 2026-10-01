# ロランの候補のコマ

採用はまだ決まっていないが、ゲームで見比べるために残しているコマ。`assets/` の外に置いているので、
`validate.py` や `export.py` の対象にはならない（ゲームには入らない）。

| ファイル | 中身 | 比べる相手 |
|---|---|---|
| `down_atk_hit_t2.txt` | 正面の振り下ろしで、刃を斜めにして切っ先を体の中心へ 2px 寄せた案 | `assets/unit/roran/down_atk_hit.txt`（刃を真下に向けた案、今の採用） |

## ゲームで試す

リポジトリのルートで:

```sh
cp pixel-asset-forge/assets/unit/roran/down_atk_hit.txt /tmp/down_atk_hit.u1.txt   # 今の採用を退避
cp pixel-asset-forge/candidates/roran/down_atk_hit_t2.txt pixel-asset-forge/assets/unit/roran/down_atk_hit.txt
pixel-asset-forge/.venv/bin/python pixel-asset-forge/tools/export.py sprites.json assets/images
npm run dev
```

戻すときは `git checkout -- pixel-asset-forge/assets/unit/roran/down_atk_hit.txt assets/images/roran-map.png`。
