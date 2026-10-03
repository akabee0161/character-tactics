# イネスを forge のユニットとして描き、弓を持たせる（issue #23 の5番目）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 女性形の素体を作り、その上にイネスの顔グラの特徴（バンダナ・肌・目と眉・耳飾り・黄色い服）と、弓と矢を交差させた構えを描いて、イネスのユニット28枚をゲームへ書き出す。

**Architecture:** パレットにバンダナの4色を足し、`male_*` から女性形の素体 `female_*` を作る。イネスの `down_base` で形を案から選び（バンダナ → 目 → 服 → 弓の構え）、残り3方向の `base`、アニメ（待機・歩き）、攻撃の3コマ（`atk_wind`・`atk_hit`・`atk_release`）の順に描く。最後にシートを書き出し、anim-page とゲームで確かめ、SPEC・ISSUES・HANDOVER を直す。

**Tech Stack:** pixel-asset-forge（Python 3.14、`pixel-asset-forge/.venv`、Pillow）、テキストのグリッド、Vitest（`npm test`）、Vite（`npm run build`）、headless Chromium（CDP）、ゲーム側の `tools/anim-page.py`

**Spec:** `docs/superpowers/specs/2026-10-03-ines-unit-bow-design.md`

## Global Constraints

- ユニットは 32x32、`bg: transparent`、`# light: upper-left`、足元 y=30、左右中央、背丈 24〜26px（頭頂は y=5）。待機の2コマ目と攻撃コマの例外は `types/unit/SPEC.md` のとおり
- `unit` に mirror を使わない（`left` と `right` は別々に描く）
- 奥にあるものは体に重なる部分を描かず、色は手前と同じ階調にする
- 素体の体つきは `male_*` から b. 肩幅を狭く、c. 腰にくびれ、d. 脚を細く（脚の中身 2px → 1px。輪郭込みで1本 `o r r o` → `o r o`、足の行 y=29 は中身 3px → 2px）。背丈は26px のまま。`male_*` は変えない。これは今の時点の案で、依頼者が案を見て設計を見直すことがある（見直しになったら、続きを描く前に spec と計画を直す）
- 頭の桃紫（画面右で肩まで垂れる部分も含む）はすべてバンダナ。顔グラの画面左下の青は無視する
- 耳飾りは1〜2画素で表現できなければ省いてよい
- 弓は左手、右手で弦にかけた矢を弓と交差させて構える（待機では引き絞らない）
- 攻撃の3コマは `[atk_wind, atk_hit, atk_release]`: 弓を前に上げて構える → 引き絞りきる（矢あり）→ 放った後（矢なし、右手が後ろへ抜ける）
- 色: 足すのはバンダナの `orchid_hi`・`orchid_base`・`orchid_shadow`・`orchid_dark` だけ（`palette/master.json` の末尾）。肌 `skin_*`、服の黄 `metal_*`、耳飾り `flame_deep`/`flame_base`、目 `outline`、弓・矢の軸 `wood_*`、弦・鏃 `stone_*`、矢羽根 `water_*`。**ほかに色が要りそうになったら、描く前に止めて依頼者に確認する**
- 持ち物の部品と服の黄には専用の文字を割り当てる（`types/unit/SPEC.md`）
- `assets/units/ines.json`・ゲームのコード・ほかのユニット・役割アイコン・`pixel-asset-forge/tools/`・`feat/roran-face` は変えない（`feat/roran-face` は `git show` で読むのはよい）
- 絵は段階ごとに Read で見せて止まる。案を横に並べ、8倍の拡大と草の上の等倍を添え、左端に 32px に戻したイネスの顔を置く。案の差が小さいときは、どこが何画素違うかを書き添える。拡大の切り出しだけでなくコマ全体も見せる。「一旦進めましょう」は次へ進んでよいという意味で、合格ではない
- 質問は1回に1つ、どの点に答えればよいかを明示する。Yes/No で答えられる質問には、まず Yes/No だけを答える
- **計画に不備が見つかったら、直す前に止めて報告する**
- 使い捨ての道具と途中の画像は `.superpowers/sdd/2026-10-03-ines-unit-bow/`（以下 SDD。git 管理外）に置く。コマンドには `$SDD` のような変数を使わず、パスをそのまま書く（安全フックが変数入りのパスを止める）。標準入力の heredoc（`python3 - <<EOF`）も止められるので、スクリプトは Write でファイルにして実行する
- forge のコマンドは `pixel-asset-forge/` で `.venv/bin/python tools/...`。git コマンドはリポジトリの直下から流す
- コミットは Conventional Commits ＋日本語の要約。author は akabee0161
- 具体的な不都合を言えない気付きは確認事項に混ぜず、`HANDOVER.md` の「Claude の気付き（具体的な不都合は未確認）」（forge 側は `ISSUES.md`）に書く
- vite preview などを止めるときは、自分が立てたプロセス（PID）だけを止める。`pkill -f` は使わない
- push と PR は依頼者の指示があるまでしない

## Review Focus

- コマの間で足元（y=30）や体の中心が1pxずれてアニメがガタつく → Task 9・10 で `sheet.py` のプレビューと実測表で確かめる
- 輪郭の切れ目（輪郭以外の画素が透明に接する）。細い弓・矢・弦で起きやすい → 各タスクで `open_edges.py` を通す
- 持ち物の部品が服や盾と同じ文字で描かれ、`# map:` 行で片方だけ色を変えられない → Task 7 で文字の割り当て表を作り、Task 8〜10 で各コマの文字を数える
- `atk_release` に矢が残っている／`atk_hit` に矢が無い → Task 10 で矢の文字の数をコマごとに数える
- `sprites.json` に1行足したことで、ほかの PNG が書き換わる → Task 11 で `git status --short assets/images` を見て、`ines-map.png` 以外が変わったら止める

---

### Task 0: 作業フォルダと見せる道具

**Files:**
- Create: `.superpowers/sdd/2026-10-03-ines-unit-bow/face_down.py`（scratchpad の同名の道具を写す）
- Create: `.superpowers/sdd/2026-10-03-ines-unit-bow/shots/face32.png`
- Create: `.superpowers/sdd/2026-10-03-ines-unit-bow/present.py`
- Create: `.superpowers/sdd/2026-10-03-ines-unit-bow/open_edges.py`
- Create: `.superpowers/sdd/2026-10-03-ines-unit-bow/progress.md`（台帳）

**Interfaces:**
- Produces: `present.py OUT.png GRID.txt [GRID.txt ...]` … 左端に `shots/face32.png` を8倍、続けて各グリッドを8倍で並べ、下の段に同じ並びの等倍を `grass_base` の上に置く。各グリッドの上にファイル名（親フォルダ名/拡張子なし）を書く
- Produces: `open_edges.py DIR [DIR ...]` … 各 `*.txt` について、`o` 以外の不透明の画素で上下左右のどれかが `.` かコマの外のものを `name: (x,y) ...` で出し、最後に合計を出す。合計が 0 でなければ終了コード 1

- [ ] **Step 1: 作業フォルダを作り、顔の道具を写す**

```sh
cd /home/ubuntu/workspace/character-tactics
mkdir -p .superpowers/sdd/2026-10-03-ines-unit-bow/shots .superpowers/sdd/2026-10-03-ines-unit-bow/cand
cp /tmp/claude-1000/-home-ubuntu-workspace/8834a4fb-5619-54f9-ba4b-8ad239e92e34/scratchpad/face_down.py .superpowers/sdd/2026-10-03-ines-unit-bow/face_down.py
pixel-asset-forge/.venv/bin/python .superpowers/sdd/2026-10-03-ines-unit-bow/face_down.py assets/images/ines-face.png 32 .superpowers/sdd/2026-10-03-ines-unit-bow/shots/face32
mv .superpowers/sdd/2026-10-03-ines-unit-bow/shots/face32_q.png .superpowers/sdd/2026-10-03-ines-unit-bow/shots/face32.png
```

Expected: 「色数: 63」と 32 行のグリッドが出て、`shots/face32.png`（32×32）ができる。scratchpad の道具が無くなっていたら、spec の「升の中央を取ると 32px に戻る」のとおり、128px の顔の各 4px 升の中央 `(4x+2, 4y+2)` を取る道具を書き直す

- [ ] **Step 2: `present.py` を書く**

`.superpowers/sdd/2026-10-03-ines-unit-bow/present.py`:

```python
"""案を並べて見せる画像を作る（scratch helper）。
Usage: present.py OUT.png GRID.txt [GRID.txt ...]
上の段: イネスの顔（32px に戻したもの）と各グリッドを8倍。下の段: 同じ並びの等倍を草の色の上に置く。"""
import sys
from pathlib import Path
from PIL import Image, ImageDraw

SDD = Path(__file__).parent
FORGE = Path("/home/ubuntu/workspace/character-tactics/pixel-asset-forge")
sys.path.insert(0, str(FORGE / "tools"))
from gridfile import load_palette, parse  # noqa: E402
from render import to_image  # noqa: E402

S, PAD, LABEL = 8, 16, 18
out, paths = Path(sys.argv[1]), [Path(p) for p in sys.argv[2:]]
pal = load_palette()
face = Image.open(SDD / "shots/face32.png").convert("RGBA")
items = [("ines-face", face)] + [(f"{p.parent.name}/{p.stem}", to_image(parse(p), pal, 1)) for p in paths]
big = [(n, im.resize((im.width * S, im.height * S), Image.NEAREST)) for n, im in items]
W = PAD + sum(b.width + PAD for _, b in big)
top = max(b.height for _, b in big)
H = LABEL + top + PAD + 32 + PAD * 2
sheet = Image.new("RGBA", (W, H), (200, 200, 200, 255))
d = ImageDraw.Draw(sheet)
d.rectangle([0, LABEL + top + PAD, W, H], fill=(*pal["grass_base"], 255))
x = PAD
for (name, b), (_, small) in zip(big, items):
    d.text((x, 2), name, fill=(0, 0, 0, 255))
    sheet.alpha_composite(b, (x, LABEL))
    sheet.alpha_composite(small, (x, LABEL + top + PAD * 2))
    x += b.width + PAD
sheet.save(out)
print(out)
```

- [ ] **Step 3: `open_edges.py` を書く**

`.superpowers/sdd/2026-10-03-ines-unit-bow/open_edges.py`:

```python
"""輪郭の切れ目を探す（scratch helper）。
輪郭（o）以外の不透明の画素で、上下左右のどれかが透明（.）またはコマの外のものを出す。
Usage: open_edges.py DIR [DIR ...]   切れ目が1つでもあれば終了コード 1"""
import sys
from pathlib import Path

total = 0
for d in sys.argv[1:]:
    for p in sorted(Path(d).glob("*.txt")):
        g = [l for l in p.read_text().splitlines() if l and not l.startswith("#")]
        h, w = len(g), len(g[0])
        hits = []
        for y in range(h):
            for x in range(w):
                c = g[y][x]
                if c in ".o":
                    continue
                for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    nx, ny = x + dx, y + dy
                    if not (0 <= nx < w and 0 <= ny < h) or g[ny][nx] == ".":
                        hits.append((x, y))
                        break
        total += len(hits)
        if hits:
            print(f"{p.parent.name}/{p.stem}: " + " ".join(f"({x},{y})" for x, y in hits))
print(f"切れ目の合計: {total}")
sys.exit(1 if total else 0)
```

- [ ] **Step 4: 道具を確かめる**

```sh
cd /home/ubuntu/workspace/character-tactics
pixel-asset-forge/.venv/bin/python .superpowers/sdd/2026-10-03-ines-unit-bow/open_edges.py pixel-asset-forge/types/unit/base
pixel-asset-forge/.venv/bin/python .superpowers/sdd/2026-10-03-ines-unit-bow/present.py .superpowers/sdd/2026-10-03-ines-unit-bow/shots/t0_check.png pixel-asset-forge/types/unit/base/male_down.txt
```

Expected: `open_edges.py` の `male_*` の結果を控える（0 でなければ、それは今ある切れ目で、`female_*` を比べる基準になる）。`t0_check.png` を Read で開き、顔・素体・等倍が並んでいることを確かめる（依頼者には見せない）

- [ ] **Step 5: 台帳を作る**

`.superpowers/sdd/2026-10-03-ines-unit-bow/progress.md` に、計画のパス・ブランチ `feat/ines-unit-bow`・開始の commit を書く。以降、タスクの完了と依頼者の判断（`Ruling:` 行）をここに1行ずつ足す。コミットは無い（git 管理外）

---

### Task 1: バンダナの4色を足す（段階0）

**Files:**
- Modify: `pixel-asset-forge/palette/master.json`（末尾に4色）
- Create: `.superpowers/sdd/2026-10-03-ines-unit-bow/pairs.txt`
- Create: `.superpowers/sdd/2026-10-03-ines-unit-bow/swatch.py`

**Interfaces:**
- Produces: パレットのキー `orchid_hi`・`orchid_base`・`orchid_shadow`・`orchid_dark`

- [ ] **Step 1: 候補の値を測る**

顔の色を手がかりに、候補を次から始める: `orchid_hi` `#f492e4`、`orchid_base` `#c059c0`、`orchid_shadow` `#7f2783`、`orchid_dark` `#571562`。

```sh
cd /home/ubuntu/workspace/character-tactics/pixel-asset-forge
.venv/bin/python tools/probe_colors.py --candidate '#f492e4' --against skin_hi skin_base outline metal_hi grass_hi grass_base
.venv/bin/python tools/probe_colors.py --candidate '#c059c0' --against '#f492e4' skin_base skin_shadow outline metal_base grass_base grass_shadow dirt_base
.venv/bin/python tools/probe_colors.py --candidate '#7f2783' --against '#c059c0' skin_shadow outline metal_shadow grass_shadow dirt_shadow leaf_shadow
.venv/bin/python tools/probe_colors.py --candidate '#571562' --against '#7f2783' outline grass_shadow leaf_shadow floor_dark dirt_shadow
```

Expected: 全組が引っかからない（終了コード 0）。`orchid_dark` と `outline` が引っかかったら、`orchid_dark` を明るくした値で測り直す（例 `#64206e`）。4組とも隣どうし（hi/base/shadow/dark）が引っかからない値に決める。決めた値と測った ΔE を台帳に書く

- [ ] **Step 2: パレットに足す**

`pixel-asset-forge/palette/master.json` の最後の `"flame_deep": "#cf5028"` の行を次に置き換える（値は Step 1 で決めたもの）:

```json
  "flame_deep": "#cf5028",

  "orchid_hi": "#f492e4",
  "orchid_base": "#c059c0",
  "orchid_shadow": "#7f2783",
  "orchid_dark": "#571562"
```

- [ ] **Step 3: 足した色どうしと既存の色の組を一度に測る**

`.superpowers/sdd/2026-10-03-ines-unit-bow/pairs.txt`（1行に2色。名前だけを書く。`#` で始まる色リテラルは `--pairs` では捨てられる既知の不具合があるので書かない）:

```
orchid_hi orchid_base
orchid_base orchid_shadow
orchid_shadow orchid_dark
orchid_dark outline
orchid_hi skin_hi
orchid_base skin_base
orchid_shadow skin_shadow
orchid_base metal_base
orchid_shadow metal_shadow
orchid_base grass_base
orchid_shadow grass_shadow
orchid_dark leaf_shadow
orchid_dark floor_dark
```

```sh
.venv/bin/python tools/probe_colors.py --pairs ../.superpowers/sdd/2026-10-03-ines-unit-bow/pairs.txt
.venv/bin/python tools/validate.py
```

Expected: `probe_colors.py` は終了コード 0、13組の結果が出る（13組より少なければ、行が読み捨てられている。止めて報告する）。`validate.py` は 0

- [ ] **Step 4: 色見本を作って見せる**

`.superpowers/sdd/2026-10-03-ines-unit-bow/swatch.py`:

```python
"""バンダナの4色と、顔の桃紫6色を並べた色見本（scratch helper）。"""
import json
from pathlib import Path
from PIL import Image, ImageDraw

SDD = Path(__file__).parent
pal = json.loads(Path("/home/ubuntu/workspace/character-tactics/pixel-asset-forge/palette/master.json").read_text())
face = ["#f492e4", "#c059c0", "#a946ab", "#953ba0", "#7f2783", "#571562"]
ours = [pal[k] for k in ("orchid_hi", "orchid_base", "orchid_shadow", "orchid_dark")]
img = Image.new("RGB", (64 * 6 + 20, 200), (200, 200, 200))
d = ImageDraw.Draw(img)
d.text((10, 4), "face", fill=(0, 0, 0))
for i, c in enumerate(face):
    d.rectangle([10 + i * 64, 20, 10 + i * 64 + 60, 80], fill=c)
    d.text((10 + i * 64, 82), c, fill=(0, 0, 0))
d.text((10, 104), "orchid_hi / base / shadow / dark", fill=(0, 0, 0))
for i, c in enumerate(ours):
    d.rectangle([10 + i * 64, 120, 10 + i * 64 + 60, 180], fill=c)
    d.text((10 + i * 64, 182), c, fill=(0, 0, 0))
img.save(SDD / "shots/t1_swatch.png")
print(SDD / "shots/t1_swatch.png")
```

```sh
cd /home/ubuntu/workspace/character-tactics
pixel-asset-forge/.venv/bin/python .superpowers/sdd/2026-10-03-ines-unit-bow/swatch.py
```

`shots/t1_swatch.png` を Read で見せ、Step 3 の13組の ΔE の表を添える。**止まる。**

- [ ] **Step 5: コミット**（依頼者が次へ進んでよいと言った後）

```sh
cd /home/ubuntu/workspace/character-tactics
git add pixel-asset-forge/palette/master.json
git commit -m "feat: パレットにイネスのバンダナの桃紫4色（orchid_*）を足す"
```

---

### Task 2: 女性形の素体の正面（段階1a）

**Files:**
- Create: `.superpowers/sdd/2026-10-03-ines-unit-bow/cand/female_F1.txt` 〜 `female_F3.txt`
- Create: `pixel-asset-forge/types/unit/base/female_down.txt`

**Interfaces:**
- Consumes: `pixel-asset-forge/types/unit/base/male_down.txt`
- Produces: `female_down.txt`（ヘッダと `# map:` 行は `male_down.txt` と同じ。`o a b c p q r` だけを使う）

- [ ] **Step 1: 案を描く**

`male_down.txt` を `cand/female_F1.txt` 〜 `F3.txt` に写し、首から下（y=15〜30）だけを書き換える。頭（y=5〜14）は変えない。`male_down` の寸法（腕を含む最大幅 x=7〜23、胴 y=21〜24 で幅 x=10〜21。脚は y=25〜28 が `orroorro`（x=12〜19、1本は輪郭込み4px・中身2px、左右の脚の輪郭が x=15・16 で隣り合う）、足 y=29 は `orrroorrro`（x=11〜20、中身3px））から:
- b. 肩幅を狭く: 肩（y=15〜17）と胴の幅を左右合わせて2px 減らす（F1・F2）か、4px 減らす（F3）
- c. 腰のくびれ: 胴の下（y=21〜23）の幅を左右1px ずつ絞る。絞る行を案ごとに変える（F1 は y=22 だけ、F2・F3 は y=21〜22）
- d. 脚を細く: 脚の中身を1px にする（1本 `o r r o` → `o r o`）。足 y=29 は中身2px（`o r r o`）。左右の脚の間は、案ごとに輪郭どうしを隣り合わせるか（`o r o o r o`）、透明を1px 挟むか（`o r o . o r o`）を変える
- 拳（`a b c` の腕の先）は肩に合わせて内側へ寄せる
- 足元 y=30、背丈26px、左右中央（外接矩形の中心が x=15.5 に近いこと）を守る

- [ ] **Step 2: 検査**

```sh
cd /home/ubuntu/workspace/character-tactics/pixel-asset-forge
for f in ../.superpowers/sdd/2026-10-03-ines-unit-bow/cand/female_F*.txt; do .venv/bin/python tools/check_colors.py "$f"; done
cd .. && pixel-asset-forge/.venv/bin/python .superpowers/sdd/2026-10-03-ines-unit-bow/open_edges.py .superpowers/sdd/2026-10-03-ines-unit-bow/cand
```

Expected: `check_colors.py` は hard failure なし。`open_edges.py` の `female_F*` の切れ目は 0（`male_down` に切れ目があったなら、それより増えていない）

- [ ] **Step 3: 並べて見せる**

```sh
pixel-asset-forge/.venv/bin/python .superpowers/sdd/2026-10-03-ines-unit-bow/present.py .superpowers/sdd/2026-10-03-ines-unit-bow/shots/t2_female.png pixel-asset-forge/types/unit/base/male_down.txt .superpowers/sdd/2026-10-03-ines-unit-bow/cand/female_F1.txt .superpowers/sdd/2026-10-03-ines-unit-bow/cand/female_F2.txt .superpowers/sdd/2026-10-03-ines-unit-bow/cand/female_F3.txt
```

Read で見せ、案ごとに `male_down` との違い（肩・胴・腰・脚の幅を行ごとに何px）を表にして添える。質問は「どの案にするか」の1つ。**止まる。**

- [ ] **Step 4: 選ばれた案を書いてコミット**

```sh
cp .superpowers/sdd/2026-10-03-ines-unit-bow/cand/female_F<n>.txt pixel-asset-forge/types/unit/base/female_down.txt
cd pixel-asset-forge && .venv/bin/python tools/validate.py && cd ..
git add pixel-asset-forge/types/unit/base/female_down.txt
git commit -m "feat: 女性形の素体の正面を描く（肩幅・くびれ・細い脚、案 F<n>）"
```

`female_down.txt` の先頭のコメントは無い（`male_down.txt` と同じ）。`validate.py` は `types/unit/base/` を見ないので、`check_colors.py pixel-asset-forge/types/unit/base/female_down.txt` も通す

---

### Task 3: 女性形の素体の残り3方向（段階1b）

**Files:**
- Create: `pixel-asset-forge/types/unit/base/female_up.txt`・`female_left.txt`・`female_right.txt`

**Interfaces:**
- Consumes: Task 2 の `female_down.txt`、`male_{up,left,right}.txt`
- Produces: 4方向の `female_*`

- [ ] **Step 1: 3方向を描く**

各方向の `male_*` を写し、Task 2 で選ばれた案と同じ規則（肩・胴を何px、くびれの行、脚の中身2px）で首から下を書き換える。横向きは肩幅ではなく体の厚みが見えるので、胴の前後の幅は `male_left`/`male_right` のままにし、くびれ（背中側か腹側を1px）と脚だけを当てはめる。どう当てはめたかを方向ごとに1行で台帳に書く。`left` と `right` は別々に描く

- [ ] **Step 2: 検査と4方向の並び**

```sh
cd /home/ubuntu/workspace/character-tactics/pixel-asset-forge
for f in types/unit/base/female_*.txt; do .venv/bin/python tools/check_colors.py "$f"; done
.venv/bin/python tools/contact_sheet.py --columns 4 --scale 8 -o ../.superpowers/sdd/2026-10-03-ines-unit-bow/shots/t3_female4.png types/unit/base/female_down.txt types/unit/base/female_left.txt types/unit/base/female_right.txt types/unit/base/female_up.txt
.venv/bin/python tools/contact_sheet.py --columns 4 --scale 8 -o ../.superpowers/sdd/2026-10-03-ines-unit-bow/shots/t3_male4.png types/unit/base/male_down.txt types/unit/base/male_left.txt types/unit/base/male_right.txt types/unit/base/male_up.txt
cd .. && pixel-asset-forge/.venv/bin/python .superpowers/sdd/2026-10-03-ines-unit-bow/open_edges.py pixel-asset-forge/types/unit/base
```

Expected: hard failure なし。`female_*` の切れ目は `male_*` と同じ方向で同じか少ない

2枚を Read で見せる（女性形と男性形の4方向）。**止まる。**

- [ ] **Step 3: コミット**

```sh
git add pixel-asset-forge/types/unit/base/female_up.txt pixel-asset-forge/types/unit/base/female_left.txt pixel-asset-forge/types/unit/base/female_right.txt
git commit -m "feat: 女性形の素体の背面・横向きを描く"
```

`types/unit/base/` には `male_*.png`・`_x8.png` もコミットされている。`female_*` の PNG も同じく置くかは、`git log --stat -- pixel-asset-forge/types/unit/base/male_down.png` でどう作ったかを確かめ、同じ方法で作れるなら作ってこのコミットに含める（作り方が分からなければ置かずに台帳に書く）

---

### Task 4: バンダナの形（段階2a）

**Files:**
- Create: `.superpowers/sdd/2026-10-03-ines-unit-bow/cand/band_B1.txt` 〜 `band_B3.txt`
- Create: `pixel-asset-forge/assets/unit/ines/down_base.txt`

**Interfaces:**
- Consumes: `female_down.txt`、パレットの `orchid_*`
- Produces: `assets/unit/ines/down_base.txt`。`# map:` 行は次のとおり（以降のタスクで文字を足す）:

```
# type: unit
# size: 32x32
# light: upper-left
# bg: transparent
# map: o=outline a=skin_hi b=skin_base c=skin_shadow
# map: p=cloth_hi q=cloth_base r=cloth_shadow
# map: e=orchid_hi f=orchid_base g=orchid_shadow h=orchid_dark
```

（`p q r` は素体のままの仮の服の色。Task 6 で黄色に変える）

- [ ] **Step 1: 顔のバンダナを読む**

`shots/face32.png` と `face_down.py` のグリッド出力から、バンダナの外形（頭頂 y=4〜5、画面左の下端 y≈17、画面右の垂れ x=22〜31・y=19〜31）、額の縁の行（y=10 の輪郭）、明るい面（左上）を書き出す。顔の 32px とユニットの頭（約10px）の比は約3分の1

- [ ] **Step 2: 案を描く**

`female_down.txt` を写して `cand/band_B1.txt` 〜 `B3.txt` を作り、頭（y=5〜14）にバンダナを描く。守ること:
- 頭頂は y=5 より上に出さない。横は頭より左右1px 程度まで
- 額の縁は目（Task 5 で y=11 前後に描く）の2行以上上にする
- 光源は左上（左上側に `e`、右下側に `g`・`h`）
- バンダナと肌の間は輪郭 `o` で分ける
- 垂れは画面右（イネスの左側）の肩へ下ろす。案ごとに垂れの長さを変える（B1 は耳の高さまで、B2 は肩 y=17 まで、B3 は胸 y=20 まで）
- 体・脚は `female_down` のまま

- [ ] **Step 3: 検査と並べて見せる**

```sh
cd /home/ubuntu/workspace/character-tactics/pixel-asset-forge
for f in ../.superpowers/sdd/2026-10-03-ines-unit-bow/cand/band_B*.txt; do .venv/bin/python tools/check_colors.py "$f"; done
cd .. && pixel-asset-forge/.venv/bin/python .superpowers/sdd/2026-10-03-ines-unit-bow/open_edges.py .superpowers/sdd/2026-10-03-ines-unit-bow/cand
pixel-asset-forge/.venv/bin/python .superpowers/sdd/2026-10-03-ines-unit-bow/present.py .superpowers/sdd/2026-10-03-ines-unit-bow/shots/t4_band.png pixel-asset-forge/types/unit/base/female_down.txt .superpowers/sdd/2026-10-03-ines-unit-bow/cand/band_B1.txt .superpowers/sdd/2026-10-03-ines-unit-bow/cand/band_B2.txt .superpowers/sdd/2026-10-03-ines-unit-bow/cand/band_B3.txt
```

Expected: hard failure なし、`band_B*` の切れ目 0。Read で見せ、案ごとの違いを1行ずつ添える。質問は「どの案にするか」の1つ。**止まる。**

- [ ] **Step 4: 選ばれた案を書いてコミット**

```sh
mkdir -p pixel-asset-forge/assets/unit/ines
cp .superpowers/sdd/2026-10-03-ines-unit-bow/cand/band_B<n>.txt pixel-asset-forge/assets/unit/ines/down_base.txt
cd pixel-asset-forge && .venv/bin/python tools/validate.py && cd ..
git add pixel-asset-forge/assets/unit/ines/down_base.txt
git commit -m "feat: イネスのユニットの正面にバンダナを描く（案 B<n>）"
```

---

### Task 5: 目・眉・耳飾り（段階2b）

**Files:**
- Create: `.superpowers/sdd/2026-10-03-ines-unit-bow/cand/eye_E1.txt` 〜 `eye_E3.txt`
- Modify: `pixel-asset-forge/assets/unit/ines/down_base.txt`

**Interfaces:**
- Consumes: Task 4 の `down_base.txt`
- Produces: 目の上端の行（Task 8 で4方向を揃える）。耳飾りを描くなら `# map: i=flame_deep j=flame_base` を足す

- [ ] **Step 1: 案を描く**

`down_base.txt` を写す。目は SPEC の顔の規約どおり `outline` の縦長（ロランは縦2px・幅1px、上端 y=11）。顔の内部に `outline` を使ってよいのは目だけなので、**眉は `outline` で描けない**。案:
- E1: 目だけ（ロランと同じ形）。眉と耳飾りは描かない
- E2: E1 に、眉の代わりにバンダナの額の縁を目の真上の行まで下げて、太い眉の暗さを表す。耳飾りは耳の位置に `i`（`flame_deep`）1画素
- E3: E1 に、眉を `skin_shadow`（`c`）の1行で描く。耳飾りは `i`・`j` の縦2画素

耳飾りが顔の輪郭や髪の陰と区別できないときは、その案の説明に書く（省くかは依頼者が決める）

- [ ] **Step 2: 色を測る**（耳飾りを描いた案があるとき）

```sh
cd /home/ubuntu/workspace/character-tactics/pixel-asset-forge
.venv/bin/python tools/probe_colors.py flame_deep skin_base
.venv/bin/python tools/probe_colors.py flame_deep skin_shadow
.venv/bin/python tools/probe_colors.py flame_deep outline
.venv/bin/python tools/probe_colors.py flame_base skin_base
.venv/bin/python tools/probe_colors.py flame_deep orchid_shadow
```

Expected: 結果を控え、見せるときに添える（引っかかった組がある案は、その旨を書く）

- [ ] **Step 3: 検査と並べて見せる**

```sh
for f in ../.superpowers/sdd/2026-10-03-ines-unit-bow/cand/eye_E*.txt; do .venv/bin/python tools/check_colors.py "$f"; done
cd .. && pixel-asset-forge/.venv/bin/python .superpowers/sdd/2026-10-03-ines-unit-bow/present.py .superpowers/sdd/2026-10-03-ines-unit-bow/shots/t5_eyes.png pixel-asset-forge/assets/unit/ines/down_base.txt .superpowers/sdd/2026-10-03-ines-unit-bow/cand/eye_E1.txt .superpowers/sdd/2026-10-03-ines-unit-bow/cand/eye_E2.txt .superpowers/sdd/2026-10-03-ines-unit-bow/cand/eye_E3.txt
```

Read で見せる。質問は「どの案にするか」の1つ。**止まる。**

- [ ] **Step 4: 選ばれた案を書いてコミット**

```sh
cp .superpowers/sdd/2026-10-03-ines-unit-bow/cand/eye_E<n>.txt pixel-asset-forge/assets/unit/ines/down_base.txt
cd pixel-asset-forge && .venv/bin/python tools/validate.py && cd ..
git add pixel-asset-forge/assets/unit/ines/down_base.txt
git commit -m "feat: イネスのユニットの正面に目と眉（・耳飾り）を描く（案 E<n>）"
```

コミットの要約は、耳飾りを省いた案なら「目と眉を描く」にする

---

### Task 6: 黄色い服（段階2c）

**Files:**
- Create: `.superpowers/sdd/2026-10-03-ines-unit-bow/cand/cloth_C1.txt` 〜 `cloth_C3.txt`
- Modify: `pixel-asset-forge/assets/unit/ines/down_base.txt`

**Interfaces:**
- Consumes: Task 5 の `down_base.txt`
- Produces: 服の文字の割り当て。`# map: p=cloth_hi q=cloth_base r=cloth_shadow` を `# map: p=metal_hi q=metal_base r=metal_shadow` に置き換える（`p q r` は服の専用の文字。持ち物には使わない）

- [ ] **Step 1: 色を測る**

```sh
cd /home/ubuntu/workspace/character-tactics/pixel-asset-forge
.venv/bin/python tools/probe_colors.py metal_hi skin_hi
.venv/bin/python tools/probe_colors.py metal_base skin_base
.venv/bin/python tools/probe_colors.py metal_shadow skin_shadow
.venv/bin/python tools/probe_colors.py metal_base orchid_base
.venv/bin/python tools/probe_colors.py metal_shadow orchid_shadow
.venv/bin/python tools/probe_colors.py metal_base grass_base
```

Expected: 結果を控える。服と肌の組が引っかかったら、その境目に輪郭 `o` を挟む

- [ ] **Step 2: 案を描く**

`down_base.txt` を写し、`# map:` 行を上のとおり黄色にしてから、服の明暗の置き方を案ごとに変える:
- C1: 素体の明暗のまま（左上 `p`、中 `q`、右下 `r`）
- C2: `q` を地にして、`p` は肩の縁の1行だけ、`r` は右の脇と裾
- C3: 顔グラの見え方（襟元が開いて胸元の肌が見える）に寄せ、首元 y=15〜16 の中央2〜4px を肌にする。明暗は C2 と同じ

バンダナの垂れが服の上に重なるところは、垂れを手前にし、境目に `o` を挟む

- [ ] **Step 3: 検査と並べて見せる**

```sh
for f in ../.superpowers/sdd/2026-10-03-ines-unit-bow/cand/cloth_C*.txt; do .venv/bin/python tools/check_colors.py "$f"; done
cd .. && pixel-asset-forge/.venv/bin/python .superpowers/sdd/2026-10-03-ines-unit-bow/present.py .superpowers/sdd/2026-10-03-ines-unit-bow/shots/t6_cloth.png pixel-asset-forge/assets/unit/ines/down_base.txt .superpowers/sdd/2026-10-03-ines-unit-bow/cand/cloth_C1.txt .superpowers/sdd/2026-10-03-ines-unit-bow/cand/cloth_C2.txt .superpowers/sdd/2026-10-03-ines-unit-bow/cand/cloth_C3.txt
```

Read で見せる。質問は「どの案にするか」の1つ。**止まる。**

- [ ] **Step 4: 選ばれた案を書いてコミット**

```sh
cp .superpowers/sdd/2026-10-03-ines-unit-bow/cand/cloth_C<n>.txt pixel-asset-forge/assets/unit/ines/down_base.txt
cd pixel-asset-forge && .venv/bin/python tools/validate.py && cd ..
git add pixel-asset-forge/assets/unit/ines/down_base.txt
git commit -m "feat: イネスのユニットの正面の服を黄色にする（案 C<n>）"
```

---

### Task 7: 弓の構え（段階3）

**Files:**
- Create: `.superpowers/sdd/2026-10-03-ines-unit-bow/cand/bow_W1.txt` 〜 `bow_W3.txt`
- Create: `.superpowers/sdd/2026-10-03-ines-unit-bow/letters.md`（文字の割り当て表）
- Create: `.superpowers/sdd/2026-10-03-ines-unit-bow/zoom.py`
- Modify: `pixel-asset-forge/assets/unit/ines/down_base.txt`

**Interfaces:**
- Consumes: Task 6 の `down_base.txt`、`pixel-asset-forge/assets/item/bow.txt`（形と色の特徴だけ。画素は写さない）
- Produces: 持ち物の専用の文字の割り当て。以降の全コマで同じ `# map:` 行を使う:

```
# map: k=wood_hi l=wood_base m=wood_shadow
# map: s=stone_hi t=stone_base
# map: u=water_base
# map: w=wood_shadow
```

割り当て（`letters.md` に同じ表を書く）:

| 文字 | 部品 | 色 |
|---|---|---|
| `k` `l` `m` | 弓の本体（明・中・暗） | `wood_hi` / `wood_base` / `wood_shadow` |
| `s` | 弦 | `stone_hi` |
| `t` | 鏃 | `stone_base` |
| `w` | 矢の軸 | `wood_shadow` |
| `u` | 矢羽根 | `water_base` |

矢の軸 `w` と弓の暗い面 `m` は同じ色だが、別の部品なので別の文字にする（攻撃のコマで矢だけを消し、数えるため）。案で使わない文字は `# map:` 行から外さない（全コマで同じ行にする）。部品が細すぎて色を分けられないときは、その旨を案の説明に書く

- Produces: `zoom.py OUT.png X0 Y0 X1 Y1 GRID.txt [...]` … 各グリッドの矩形 `(X0,Y0)-(X1,Y1)` を16倍で横に並べる

- [ ] **Step 1: アイコンの弓を読む**

`pixel-asset-forge/assets/item/bow.txt` と `types/item/SPEC.md` の弓の規約から、ユニットへ移す特徴を書き出す: 弓は弧（鏃の側へ膨らむ）で木、弦は弓の両端を結ぶ直線で白銀、矢は弓と交差し、弧の頂点は矢の木の部分と交わる（鏃に重ねない）、矢羽根は弦の外側で青、鏃は白銀

- [ ] **Step 2: 案を描く**

`down_base.txt` を写して `cand/bow_W1.txt` 〜 `W3.txt` を作る。正面（`down`）は左手が画面右・手前、右手が画面左・手前（SPEC の表）。守ること:
- 弓は左手（画面右）で握る。弓は縦長の弧で、背丈26px の範囲に収め、頭頂 y=5 より上に出さない
- 矢は右手（画面左）で弦にかけ、弓と交差させる。引き絞らない
- 弓を握る拳と矢を持つ拳を描く（SPEC「持ち物を持つ手を描く」）
- 案ごとに交差の角度を変える: W1 は矢を水平に近く（体の前で横に渡す）、W2 は矢を45°（右上へ向ける。アイコンの構図に近い）、W3 は弓を体の前で斜めに傾け、矢をその反対の斜めにする
- 細い部品も輪郭で囲む（`open_edges.py` の切れ目 0）
- 体・脚・バンダナ・服は Task 6 のまま。拳の位置を動かすために腕を描き直すのはよい

- [ ] **Step 3: 拡大の道具を書く**

`.superpowers/sdd/2026-10-03-ines-unit-bow/zoom.py`:

```python
"""グリッドの一部を16倍で横に並べる（scratch helper）。
Usage: zoom.py OUT.png X0 Y0 X1 Y1 GRID.txt [GRID.txt ...]   矩形は両端を含む"""
import sys
from pathlib import Path
from PIL import Image, ImageDraw

FORGE = Path("/home/ubuntu/workspace/character-tactics/pixel-asset-forge")
sys.path.insert(0, str(FORGE / "tools"))
from gridfile import load_palette, parse  # noqa: E402
from render import to_image  # noqa: E402

K, PAD, LABEL = 16, 12, 16
out = Path(sys.argv[1])
x0, y0, x1, y1 = map(int, sys.argv[2:6])
paths = [Path(p) for p in sys.argv[6:]]
pal = load_palette()
crops = [(p.stem, to_image(parse(p), pal, 1).crop((x0, y0, x1 + 1, y1 + 1))) for p in paths]
w, h = (x1 - x0 + 1) * K, (y1 - y0 + 1) * K
img = Image.new("RGBA", (PAD + len(crops) * (w + PAD), LABEL + h + PAD), (200, 200, 200, 255))
d = ImageDraw.Draw(img)
for i, (name, c) in enumerate(crops):
    x = PAD + i * (w + PAD)
    d.text((x, 2), f"{name} ({x0},{y0})-({x1},{y1})", fill=(0, 0, 0, 255))
    img.alpha_composite(c.resize((w, h), Image.NEAREST), (x, LABEL))
img.save(out)
print(out)
```

- [ ] **Step 4: 検査と並べて見せる**

```sh
cd /home/ubuntu/workspace/character-tactics/pixel-asset-forge
for f in ../.superpowers/sdd/2026-10-03-ines-unit-bow/cand/bow_W*.txt; do .venv/bin/python tools/check_colors.py "$f"; done
cd .. && pixel-asset-forge/.venv/bin/python .superpowers/sdd/2026-10-03-ines-unit-bow/open_edges.py .superpowers/sdd/2026-10-03-ines-unit-bow/cand
pixel-asset-forge/.venv/bin/python .superpowers/sdd/2026-10-03-ines-unit-bow/present.py .superpowers/sdd/2026-10-03-ines-unit-bow/shots/t7_bow.png pixel-asset-forge/assets/unit/ines/down_base.txt .superpowers/sdd/2026-10-03-ines-unit-bow/cand/bow_W1.txt .superpowers/sdd/2026-10-03-ines-unit-bow/cand/bow_W2.txt .superpowers/sdd/2026-10-03-ines-unit-bow/cand/bow_W3.txt
pixel-asset-forge/.venv/bin/python .superpowers/sdd/2026-10-03-ines-unit-bow/zoom.py .superpowers/sdd/2026-10-03-ines-unit-bow/shots/t7_bow_zoom.png 4 8 29 30 .superpowers/sdd/2026-10-03-ines-unit-bow/cand/bow_W1.txt .superpowers/sdd/2026-10-03-ines-unit-bow/cand/bow_W2.txt .superpowers/sdd/2026-10-03-ines-unit-bow/cand/bow_W3.txt
```

Expected: hard failure なし、`bow_W*` の切れ目 0。2枚（コマ全体と弓の部分の拡大）を Read で見せ、案ごとに交差の角度・矢の長さ・弓の高さを1行ずつ添える。質問は「どの案にするか」の1つ。**止まる。**

- [ ] **Step 5: 選ばれた案を書いてコミット**

```sh
cp .superpowers/sdd/2026-10-03-ines-unit-bow/cand/bow_W<n>.txt pixel-asset-forge/assets/unit/ines/down_base.txt
cd pixel-asset-forge && .venv/bin/python tools/validate.py && cd ..
git add pixel-asset-forge/assets/unit/ines/down_base.txt
git commit -m "feat: イネスのユニットの正面に弓と矢を交差させた構えを描く（案 W<n>）"
```

---

### Task 8: base の残り3方向と、弓の持ち方の規約（段階4）

**Files:**
- Create: `pixel-asset-forge/assets/unit/ines/up_base.txt`・`left_base.txt`・`right_base.txt`
- Modify: `pixel-asset-forge/types/unit/SPEC.md`（「弓の持ち方」の節を足す）
- Create: `.superpowers/sdd/2026-10-03-ines-unit-bow/count.py`

**Interfaces:**
- Consumes: Task 7 の `down_base.txt`（`# map:` 行も同じものを使う）、`female_{up,left,right}.txt`
- Produces: 4方向の `base`。`count.py DIR LETTERS` … `DIR` の各 `*.txt` で、`LETTERS` の各文字の画素数を表にして出す

- [ ] **Step 1: 3方向を描く**

`female_{up,left,right}.txt` を写し、`down_base.txt` のヘッダ（`# map:` 行すべて）に置き換えてから、バンダナ・目・眉・耳飾り・服・弓の構えを向きに合わせて描く。SPEC の手前と奥の表のとおり:

| 方向 | 右手（矢） | 左手（弓） |
|---|---|---|
| `down` | 画面左・手前 | 画面右・手前 |
| `up` | 画面右・奥 | 画面左・奥 |
| `left` | 奥 | 手前 |
| `right` | 手前 | 奥 |

守ること:
- 奥にあるものは体に重なる部分を描かない。色は手前と同じ階調
- 背面ではバンダナの結び目と垂れが見える。目は描かない
- 横顔の目は1つで正面と同じ形。目の上端の行は正面と同じ。横顔の前面は平ら、鼻と口は描かない
- 横向きの弓は、正面で選んだ交差の角度を横から見た形にする（弓が手前の `left` は弓の弧の側面、弓が奥の `right` は体からはみ出す部分だけ）
- 頭頂は y=5 より上に出さない

- [ ] **Step 2: 文字を数える道具を書く**

`.superpowers/sdd/2026-10-03-ines-unit-bow/count.py`:

```python
"""コマごとに文字の画素数を数える（scratch helper）。
Usage: count.py DIR LETTERS   例: count.py pixel-asset-forge/assets/unit/ines klmstuw"""
import sys
from pathlib import Path

d, letters = Path(sys.argv[1]), sys.argv[2]
print("frame".ljust(18) + "".join(c.rjust(4) for c in letters))
for p in sorted(d.glob("*.txt")):
    rows = [l for l in p.read_text().splitlines() if l and not l.startswith("#")]
    text = "".join(rows)
    print(p.stem.ljust(18) + "".join(str(text.count(c)).rjust(4) for c in letters))
```

- [ ] **Step 3: 検査と4方向の並び**

```sh
cd /home/ubuntu/workspace/character-tactics/pixel-asset-forge
.venv/bin/python tools/validate.py
.venv/bin/python tools/check_colors.py assets/unit/ines
.venv/bin/python tools/contact_sheet.py --columns 4 --scale 8 -o ../.superpowers/sdd/2026-10-03-ines-unit-bow/shots/t8_bases.png assets/unit/ines/down_base.txt assets/unit/ines/left_base.txt assets/unit/ines/right_base.txt assets/unit/ines/up_base.txt
cd .. && pixel-asset-forge/.venv/bin/python .superpowers/sdd/2026-10-03-ines-unit-bow/open_edges.py pixel-asset-forge/assets/unit/ines
pixel-asset-forge/.venv/bin/python .superpowers/sdd/2026-10-03-ines-unit-bow/count.py pixel-asset-forge/assets/unit/ines klmstuw
pixel-asset-forge/.venv/bin/python .superpowers/sdd/2026-10-03-ines-unit-bow/present.py .superpowers/sdd/2026-10-03-ines-unit-bow/shots/t8_bases_face.png pixel-asset-forge/assets/unit/ines/down_base.txt pixel-asset-forge/assets/unit/ines/up_base.txt pixel-asset-forge/assets/unit/ines/left_base.txt pixel-asset-forge/assets/unit/ines/right_base.txt
```

Expected: `validate.py` 0、hard failure なし、切れ目 0。`count.py` で4方向とも矢の軸 `w` と鏃 `t` が 1 以上（`up` で矢が体に隠れるなら 0 でよい。そのときは表に理由を書く）

2枚を Read で見せる。各方向の目の上端の行・頭頂の行・弓と矢の見え方を表にして添える。**止まる。**

- [ ] **Step 4: SPEC に弓の持ち方の節を書く**

`pixel-asset-forge/types/unit/SPEC.md` の「立ち絵4方向の規約」の最後（`- **持ち物の部品には専用の文字を割り当てる。** ...` の項目の後）に、次の節を足す。`<...>` は Step 1〜3 で描いた形の実測で埋める（座標・行・角度。埋めずに残さない）:

```markdown
### 弓の持ち方（イネス、issue #23 の5番目）

弓のユニットの標準。決めた経緯は character-tactics の `docs/superpowers/specs/2026-10-03-ines-unit-bow-design.md`。

- **左手で弓、右手で矢。** 待機では、右手で弦にかけた矢を弓と交差させ、今にも引ける構えで待つ（引き絞らない）。剣と盾のように別々に持たない
- 手の前後は上の表のとおり（左手の弓は `down` で画面右・手前）
- 交差の形: <正面で選んだ案の、弓の位置（列・行の範囲）と矢の角度・長さ>。横向きは <横向きの見え方>、背面は <背面の見え方>
- 色はアイコンの弓（`assets/item/bow.txt`）に揃える: 弓の本体は `wood_*`、弦は `stone_hi`、鏃は `stone_base`、矢の軸は `wood_shadow`、矢羽根は `water_base`。画素は写さない
- 専用の文字: 弓 `k` `l` `m`、弦 `s`、鏃 `t`、矢の軸 `w`、矢羽根 `u`（矢の軸と弓の暗い面は同じ色だが、攻撃のコマで矢だけを扱うために別の文字にする）
```

- [ ] **Step 5: コミット**

```sh
git add pixel-asset-forge/assets/unit/ines/up_base.txt pixel-asset-forge/assets/unit/ines/left_base.txt pixel-asset-forge/assets/unit/ines/right_base.txt pixel-asset-forge/types/unit/SPEC.md
git commit -m "feat: イネスのユニットの背面・横向きを描き、unit の SPEC に弓の持ち方を書く"
```

---

### Task 9: 待機の2コマ目と歩き（段階5）

**Files:**
- Create: `pixel-asset-forge/assets/unit/ines/{down,up,left,right}_breathe.txt`・`*_walk_a.txt`・`*_walk_b.txt`（12枚）
- Create: `pixel-asset-forge/sheets/ines.txt`
- Create: `.superpowers/sdd/2026-10-03-ines-unit-bow/cand/breathe_*.txt`

**Interfaces:**
- Consumes: Task 8 の4方向の `base`
- Produces: `sheets/ines.txt`（下の内容。攻撃の行は Task 10 のコマを指すので、Task 10 が終わるまで `sheet.py` は攻撃のコマが無くて失敗する。Task 9 では攻撃の3行を `base` に置き換えた仮の定義 `.superpowers/sdd/2026-10-03-ines-unit-bow/ines_t9.txt` でプレビューする）

`pixel-asset-forge/sheets/ines.txt`:

```
# イネスのシート定義。tools/sheet.py が読む。
# 12行 = 3状態 x 4方向。空白区切り、`.` は透明のまま。
# 行 0-3 idle / 4-7 walk / 8-11 attack、各ブロック内は down, up, left, right
# コマ数は character-tactics 側の JSON に合わせる。idle 2 / walk 4 / attack 3
# 攻撃の3コマ目は base ではなく atk_release（放った後）。ゲームは3コマ目が出た瞬間に矢を出す（windupOf）

down_base   down_breathe   .  .
up_base     up_breathe     .  .
left_base   left_breathe   .  .
right_base  right_breathe  .  .
down_base   down_walk_a   down_base   down_walk_b
up_base     up_walk_a     up_base     up_walk_b
left_base   left_walk_a   left_base   left_walk_b
right_base  right_walk_a  right_base  right_walk_b
down_atk_wind   down_atk_hit   down_atk_release   .
up_atk_wind     up_atk_hit     up_atk_release     .
left_atk_wind   left_atk_hit   left_atk_release   .
right_atk_wind  right_atk_hit  right_atk_release  .
```

`.superpowers/sdd/2026-10-03-ines-unit-bow/ines_t9.txt` は上の最後の4行を次にしたもの（ほかは同じ）:

```
down_atk_wind   down_atk_hit   down_atk_release   .
```
→
```
down_base   down_base   down_base   .
up_base     up_base     up_base     .
left_base   left_base   left_base   .
right_base  right_base  right_base  .
```

- [ ] **Step 1: 待機の2コマ目の案を描く**（正面だけ、2〜3案）

`down_base.txt` を写して `cand/breathe_A.txt` などを作る。ロランは剣を持つ拳を剣ごと2px上げる。弓のユニットで何を動かすかを案にする:
- A: 弓を持つ左手を弓ごと2px上げる（矢と右手は `base` のまま。交差の位置がずれる）
- B: 弓と矢を両手ごと2px上げる（構えを持ち上げる）
- C: 矢を持つ右手を矢ごと1〜2px 後ろへ引く（引き始めの気配）

頭・胴・脚は `base` のまま。上がって空いたところは腕と袖を描き足してつなげる

- [ ] **Step 2: 案を並べて見せる**

```sh
cd /home/ubuntu/workspace/character-tactics
pixel-asset-forge/.venv/bin/python .superpowers/sdd/2026-10-03-ines-unit-bow/open_edges.py .superpowers/sdd/2026-10-03-ines-unit-bow/cand
pixel-asset-forge/.venv/bin/python .superpowers/sdd/2026-10-03-ines-unit-bow/present.py .superpowers/sdd/2026-10-03-ines-unit-bow/shots/t9_breathe.png pixel-asset-forge/assets/unit/ines/down_base.txt .superpowers/sdd/2026-10-03-ines-unit-bow/cand/breathe_A.txt .superpowers/sdd/2026-10-03-ines-unit-bow/cand/breathe_B.txt .superpowers/sdd/2026-10-03-ines-unit-bow/cand/breathe_C.txt
```

Read で見せ、各案で `base` から何が何px 動いたかを添える。質問は「どの案にするか」の1つ。**止まる。**

- [ ] **Step 3: `breathe` の名前を確認する**

ISSUES.md「`breathe` という名前と中身が合っていない」は「2体目を作るときに決める」となっている。質問は1つ:「イネスの待機の2コマ目のファイル名は、ロランと同じ `*_breathe` のままでよいですか？」（Yes/No）。No なら依頼者の言う名前にし、`sheets/ines.txt`・`ines_t9.txt` の `breathe` も直す。ロランの名前は変えない（範囲外）。**止まる。**

- [ ] **Step 4: 待機の2コマ目を4方向に描き、歩きを描く**

- 選ばれた案を `down_breathe.txt` にし、残り3方向にも同じ規則で描く（奥の持ち物は体に重なる部分を描かない）
- 歩き: `*_walk_a`・`*_walk_b` は `base` を写し、脚（y=28〜30）だけを動かす。動かし方は `female_*` の細い脚に合わせ、ロランの `walk_a`/`walk_b`（`pixel-asset-forge/assets/unit/roran/`）の足の運び（どちらの脚を何px 上げるか）を参考にする

- [ ] **Step 5: 検査とプレビュー**

```sh
cd /home/ubuntu/workspace/character-tactics/pixel-asset-forge
.venv/bin/python tools/validate.py
.venv/bin/python tools/check_colors.py assets/unit/ines
.venv/bin/python tools/sheet.py ../.superpowers/sdd/2026-10-03-ines-unit-bow/ines_t9.txt --unitdir assets/unit/ines -o ../.superpowers/sdd/2026-10-03-ines-unit-bow/shots
cd .. && pixel-asset-forge/.venv/bin/python .superpowers/sdd/2026-10-03-ines-unit-bow/open_edges.py pixel-asset-forge/assets/unit/ines
```

Expected: `validate.py` 0、hard failure なし、切れ目 0。`sheet.py` の実測表は idle・walk の行がすべて `ok`（足元 y=30、中心が揃う）。`ok` でない行があれば、そのコマを直す

`.superpowers/sdd/2026-10-03-ines-unit-bow/shots/ines_t9_preview.png`（`sheet.py` が出したプレビュー。名前が違えば出力を見て探す）を Read で見せる。**止まる。**

- [ ] **Step 6: コミット**

```sh
git add pixel-asset-forge/assets/unit/ines pixel-asset-forge/sheets/ines.txt
git commit -m "feat: イネスのユニットの待機の2コマ目と歩きを描き、シート定義を置く"
```

---

### Task 10: 攻撃の3コマ（段階6）

**Files:**
- Create: `pixel-asset-forge/assets/unit/ines/{down,up,left,right}_atk_wind.txt`・`*_atk_hit.txt`・`*_atk_release.txt`（12枚）
- Create: `.superpowers/sdd/2026-10-03-ines-unit-bow/cand/atk_*.txt`
- Modify: `pixel-asset-forge/types/unit/SPEC.md`（構成の例外、弓の攻撃の規約、弓の待機の2コマ目）

**Interfaces:**
- Consumes: Task 8 の `base`、Task 9 の `sheets/ines.txt`
- Produces: 28枚がそろう。`sheet.py sheets/ines.txt` が通る

- [ ] **Step 1: 正面の3コマの案を描く**（2案）

`down_base.txt` を写して `cand/atk_down_P1_{wind,hit,release}.txt`・`atk_down_P2_*.txt` を作る:
- `atk_wind`: 弓を前に上げて構える（弓を持つ左手を体の前へ、矢は弦にかけたまま）
- `atk_hit`: 引き絞りきる（右手が弦と矢の尾を顔の横まで引く）。矢あり
- `atk_release`: 放った後。**矢（`w` `t` `u`）を描かない**。弦は真っすぐに戻り、右手が後ろへ抜ける
- P1 は正面向きのまま弓を体の前で縦に立てる。P2 は弓を体の前で少し傾ける
- 頭・脚は `base` のまま

- [ ] **Step 2: 正面の案を並べて見せる**

```sh
cd /home/ubuntu/workspace/character-tactics
pixel-asset-forge/.venv/bin/python .superpowers/sdd/2026-10-03-ines-unit-bow/open_edges.py .superpowers/sdd/2026-10-03-ines-unit-bow/cand
pixel-asset-forge/.venv/bin/python .superpowers/sdd/2026-10-03-ines-unit-bow/present.py .superpowers/sdd/2026-10-03-ines-unit-bow/shots/t10_down.png pixel-asset-forge/assets/unit/ines/down_base.txt .superpowers/sdd/2026-10-03-ines-unit-bow/cand/atk_down_P1_wind.txt .superpowers/sdd/2026-10-03-ines-unit-bow/cand/atk_down_P1_hit.txt .superpowers/sdd/2026-10-03-ines-unit-bow/cand/atk_down_P1_release.txt .superpowers/sdd/2026-10-03-ines-unit-bow/cand/atk_down_P2_wind.txt .superpowers/sdd/2026-10-03-ines-unit-bow/cand/atk_down_P2_hit.txt .superpowers/sdd/2026-10-03-ines-unit-bow/cand/atk_down_P2_release.txt
```

Read で見せる。質問は「P1・P2 のどちらにするか」の1つ。**止まる。**

- [ ] **Step 3: 横向きの3コマの案を描いて見せる**（2案。左右は別々に描く）

`right_base.txt`・`left_base.txt` から作る。横向きは弓を前へ（向いている側へ）突き出し、矢は水平に向ける。案ごとに引き絞った右手の位置（顔の前／耳の後ろ）を変える。弓が奥になる `right` は、体に重なる部分を描かない。弓の先と矢の先はコマの端の輪郭の手前まで

```sh
pixel-asset-forge/.venv/bin/python .superpowers/sdd/2026-10-03-ines-unit-bow/present.py .superpowers/sdd/2026-10-03-ines-unit-bow/shots/t10_side.png pixel-asset-forge/assets/unit/ines/left_base.txt .superpowers/sdd/2026-10-03-ines-unit-bow/cand/atk_left_S1_wind.txt .superpowers/sdd/2026-10-03-ines-unit-bow/cand/atk_left_S1_hit.txt .superpowers/sdd/2026-10-03-ines-unit-bow/cand/atk_left_S1_release.txt .superpowers/sdd/2026-10-03-ines-unit-bow/cand/atk_left_S2_wind.txt .superpowers/sdd/2026-10-03-ines-unit-bow/cand/atk_left_S2_hit.txt .superpowers/sdd/2026-10-03-ines-unit-bow/cand/atk_left_S2_release.txt
```

左向きの案を Read で見せる（右向きは選ばれた案を描いてから Step 5 で見せる）。質問は「S1・S2 のどちらにするか」の1つ。**止まる。**

- [ ] **Step 4: 12枚を描く**

選ばれた正面・横向きの案を `assets/unit/ines/` に書き、右向きと背面の3コマを描く。背面は弓と矢が体に隠れる部分を描かず、肘と弓の端がのぞく程度にする（ロランの背面の `atk_hit` と同じ考え方）

- [ ] **Step 5: 検査とプレビュー**

```sh
cd /home/ubuntu/workspace/character-tactics/pixel-asset-forge
.venv/bin/python tools/validate.py
.venv/bin/python tools/check_colors.py assets/unit/ines
.venv/bin/python tools/sheet.py sheets/ines.txt
cd .. && pixel-asset-forge/.venv/bin/python .superpowers/sdd/2026-10-03-ines-unit-bow/open_edges.py pixel-asset-forge/assets/unit/ines
pixel-asset-forge/.venv/bin/python .superpowers/sdd/2026-10-03-ines-unit-bow/count.py pixel-asset-forge/assets/unit/ines klmstuw
ls pixel-asset-forge/assets/unit/ines | wc -l
```

Expected:
- `validate.py` 0、hard failure なし、切れ目 0
- ファイルは28枚
- `count.py`: `*_atk_release` の4枚は `w` `t` `u` がすべて 0（矢が残っていない）。`down`・`left`・`right` の `*_atk_hit` は `w` が 1 以上（背面で隠れるなら 0 でよい。理由を書く）
- `sheet.py` の実測表: idle・walk は `ok`。攻撃のコマの `off` は、弓や矢が体の外へ出たぶんの中心のずれなら仕様どおり（SPEC「目視の手順」）。足元はすべて y=30

`pixel-asset-forge/build/sheets/ines_preview.png` を Read で見せる。`count.py` の表を添える。**止まる。**

- [ ] **Step 6: SPEC を書く**

`pixel-asset-forge/types/unit/SPEC.md`:
- 「確定している規約」の表の `構成` の行の末尾に「弓のユニットは `attack` を `[atk_wind, atk_hit, atk_release]` にする（下の「弓の持ち方」）」を足す
- Task 8 で足した「弓の持ち方」の節の最後に次を足す（`<...>` は選ばれた形の実測で埋める）:

```markdown
- **攻撃は `[atk_wind, atk_hit, atk_release]`。** character-tactics は攻撃の3コマ目が出た瞬間に矢を出す（`windupOf` = (コマ数−1)/fps）ので、3コマ目に放った後の絵を置く。ロランのように `base` を流用すると、矢が飛ぶ瞬間に次の矢をつがえた絵になる
  - `atk_wind`: 弓を前に上げて構える。<正面・横向きの実測>
  - `atk_hit`: 引き絞りきる。矢あり。<右手の位置の実測>
  - `atk_release`: 放った後。矢（`w` `t` `u`）を描かない。弦は真っすぐに戻り、右手が後ろへ抜ける
- 待機の2コマ目: <Task 9 で選ばれた案の、何を何px 動かすか>
```

- [ ] **Step 7: コミット**

```sh
cd /home/ubuntu/workspace/character-tactics
git add pixel-asset-forge/assets/unit/ines pixel-asset-forge/types/unit/SPEC.md
git commit -m "feat: イネスのユニットの攻撃（構える・引き絞る・放った後）を描き、unit の SPEC に弓の攻撃を書く"
```

---

### Task 11: 書き出し・ゲームと anim-page での確認・文書（段階7）

**Files:**
- Modify: `sprites.json`（1行足す）
- Modify: `assets/images/ines-map.png`（`export.py` で書き出す）
- Modify: `pixel-asset-forge/types/unit/SPEC.md`（ファイル配置の表、未確定の色数）
- Modify: `pixel-asset-forge/ISSUES.md`
- Modify: `pixel-asset-forge/CLAUDE.md`
- Modify: `HANDOVER.md`

**Interfaces:**
- Consumes: Task 10 までの28枚と `sheets/ines.txt`
- Produces: ゲームで使うシート、anim-page の Artifact の URL

- [ ] **Step 1: `sprites.json` に足して書き出す**

`sprites.json` の `"sheets/roran.png": "roran-map.png"` の行を次の2行にする:

```json
  "sheets/roran.png": "roran-map.png",
  "sheets/ines.png": "ines-map.png"
```

```sh
cd /home/ubuntu/workspace/character-tactics
pixel-asset-forge/.venv/bin/python pixel-asset-forge/tools/export.py sprites.json assets/images
git status --short assets/images
```

Expected: `FAIL` が出ない。変わるのは `assets/images/ines-map.png` だけ（ほかの PNG が変わったら**止めて報告する**）

- [ ] **Step 2: テストとビルド**

```sh
npm test
npm run build
```

Expected: どちらも成功（`src/engine/sheet-size.test.ts` はシートの実寸と JSON の一致を見る。128×384 のままなので通る）

- [ ] **Step 3: anim-page を作って公開する**

```sh
python3 tools/anim-page.py assets/units/ines.json .superpowers/sdd/2026-10-03-ines-unit-bow/ines-anim.html
```

`.superpowers/sdd/2026-10-03-ines-unit-bow/ines-anim.html` を読み（Artifact は読んだ内容しか公開しない）、Artifact として公開する（新しい URL。`icon` は `animation` などの一般的な語）。タブ名がイネスになっていることを確かめる。URL を依頼者に伝え、台帳と HANDOVER に書く

- [ ] **Step 4: ゲームで撮る**

`vite preview` は Bash の `run_in_background` で立てる（`localhost` でだけ待ち受ける。4178 が使われていたら別のポートを使う）:

```sh
npx vite preview --port 4180
```

立った PID を控える。

```sh
node .superpowers/sdd/2026-09-30-roran-face/cdp.mjs "http://localhost:4180/play/character-tactics/?debug" .superpowers/sdd/2026-10-03-ines-unit-bow/shots shot:title
```

`cdp.mjs` は使い捨ての道具（git 管理外。手順 `shot:<名前>` `tap:<x>,<y>` `wait:<ミリ秒>` `key:<キー>`、論理座標）。撮った画面を見て、ステージ選択 → 会話を `とばす`／タップで送る → 配置 → `始める` の座標を1つずつ決め、配置の画面と戦闘中の画面（イネスが歩いているところ、`P` で止めて `.` で送り攻撃のコマと矢が出る瞬間）を撮る。`.` は1回ごとに1フレーム待つ（`wait:50` を挟む）。選択の輪・旗・`?debug` の文字が重なって読めない画面は使わない。Read で見せ、`atk_release` と矢が出る瞬間が同じフレームかを書き添える。**止まる。** 終わったら、控えた PID の `vite preview` だけを止める（`kill <PID>`）

- [ ] **Step 5: 全アセットの並びを見る**

```sh
cd pixel-asset-forge && .venv/bin/python tools/contact_sheet.py && cd ..
```

`pixel-asset-forge/build/contact_sheet.png` を Read で見て、ロランとイネスを並べて絵柄がずれていないか（輪郭の太さ・光源・頭の大きさ）を確かめ、見えたことを依頼者に伝える（`build/` は git 管理外）

- [ ] **Step 6: SPEC・ISSUES・CLAUDE.md を直す**

`pixel-asset-forge/types/unit/SPEC.md`:
- 「ファイル配置」の `types/unit/base/<body>_<dir>.txt` の行の説明を「素体（装備・髪・顔の造作なし）。`male_*`・`female_*`。新しい unit を複製して作る土台」にする
- 「未確定」の色数の行の末尾に、イネスの実測を足す。実測:

```sh
cd /home/ubuntu/workspace/character-tactics/pixel-asset-forge
.venv/bin/python ../.superpowers/sdd/2026-10-03-ines-unit-bow/count.py assets/unit/ines klmstuw
```

色数は文字の種類ではなく描いた色で数える（`m` と `w` は同じ `wood_shadow`）。各コマの使っている文字を `# map:` 行の色に引き当てて数える使い捨てのスクリプトを `.superpowers/sdd/2026-10-03-ines-unit-bow/colors.py` に書き、最小と最大を書く

`pixel-asset-forge/ISSUES.md`:
- 「剣が `stone_*`、盾が `metal_*`」の行の詳細の末尾に「イネスの黄色い服も `metal_*`（issue #23 の5番目、2026-10-03）」を足す
- 「手の描き方が持ち物で変わる」の行の詳細の末尾に「弓の持ち方は `types/unit/SPEC.md`「弓の持ち方」に文章と座標で書いた（テンプレートのグリッドは作っていない。issue #23 の5番目）」を足す
- 「`unit` が1体しか無い」の行を「`unit` が2体しか無い」にし、「残り7体（味方2・敵5）。イネスを issue #23 の5番目で描いた」に直す
- 「素体は『一旦これで良い』の暫定」の行の末尾に「女性形の素体 `female_*` を issue #23 の5番目で足した（`male_*` から肩幅・くびれ・脚を変えたもの。頭は `male_*` のまま）」を足す
- Task 9 Step 3 の判断を「`breathe` という名前と中身が合っていない」の行に反映する（名前を残したなら「2体目のイネスでも名前は残した（依頼者の判断、日付）」）

`pixel-asset-forge/CLAUDE.md` の原則の
`` `unit` は `reference/` を持たない。手本は `assets/unit/roran/`、複製の土台は `types/unit/base/` の素体。 ``
を
`` `unit` は `reference/` を持たない。手本は `assets/unit/roran/`（剣と盾）と `assets/unit/ines/`（弓）、複製の土台は `types/unit/base/` の素体（`male_*`・`female_*`）。 ``
にする

- [ ] **Step 7: マージでぶつかるかを確かめる**

```sh
cd /home/ubuntu/workspace/character-tactics
git merge-tree --write-tree HEAD origin/feat/roran-face; echo "exit=$?"
```

Expected: 結果を控える。ぶつかるファイル（`HANDOVER.md` は前からぶつかる）を一覧にして HANDOVER に書く。`palette/master.json` がぶつかるなら、その旨と理由を書く

- [ ] **Step 8: HANDOVER を直す**

`HANDOVER.md`:
- Current State: ブランチ `feat/ines-unit-bow`（main `9e7b421` から分岐、push・PR なし）。issue #23 の5番目。実装は済み、最終レビューの前
- 「issue #23 の5番目で決めたこと」の節を新しく作る: spec の「決めたこと」、各段階で選ばれた案（F・B・E・C・W・待機・P・S の番号と中身）、`orchid_*` の値、anim-page の URL、Step 7 の結果
- 作業中の気付きは「Claude の気付き（具体的な不都合は未確認）」に1行ずつ足す

- [ ] **Step 9: コミット**

```sh
git add sprites.json assets/images/ines-map.png pixel-asset-forge/types/unit/SPEC.md pixel-asset-forge/ISSUES.md pixel-asset-forge/CLAUDE.md HANDOVER.md
git commit -m "feat: イネスのシートを書き出し、SPEC・ISSUES・CLAUDE.md・HANDOVER を直す"
```
