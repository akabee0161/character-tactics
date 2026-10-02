# 顔グラを入力にしてロランのユニットに特徴を反映する（issue #23 の2番目）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** フリー素材のロランの顔（`assets/images/roran-face.png`）から、髪の色と形・肌の色・目・服をロランのユニット（24コマ）に移す。

**Architecture:** 色は `feat/roran-face` のパレットを取り込み、24コマの `# map:` 行の書き換えで一括して置き換える。形は `down_base` で案を並べて依頼者が選び、残り3方向の `base` に描き、アニメの20コマへは「旧 base と同じ画素だけを新 base に置き換える」使い捨ての道具で写してから、剣と重なるところを手で直す。最後にゲームへ書き出して画面で確かめる。

**Tech Stack:** pixel-asset-forge（Python 3.14、`pixel-asset-forge/.venv`、Pillow）、テキストのグリッド、Vitest（`npm test`）、Vite（`npm run build`）、headless Chromium（CDP）

**Spec:** `docs/superpowers/specs/2026-10-01-roran-unit-from-face-design.md`

## Global Constraints

- ユニットは 32x32、`bg: transparent`、`# light: upper-left`、足元 y=30、左右中央、背丈 24〜26px（頭頂は y=5。待機の2コマ目と攻撃コマの切っ先の例外は `types/unit/SPEC.md` のとおり）
- シートの並び・コマ数は変えない（`sheets/roran.txt` と `assets/units/roran.json` は変えない）
- `unit` に mirror を使わない。持ち物（剣・盾）の形は変えない
- 色は `feat/roran-face` の `pixel-asset-forge/palette/master.json` を1字違わず取り込み、その色だけで描く。**足りなくなったら描く前に止めて依頼者に確認する**
- 髪と服が接するところには `outline` の1pxを挟む（`hair_slate_base`/`cloak_dark_base` は ΔE 4.6、`hair_slate_dark`/`cloak_dark_shadow` は ΔE 2.9）
- 目の上端の行は4方向でそろえる
- 絵は段階ごとに Read で見せて止まる。案は何案か並べ、8倍の拡大と等倍を添え、左端に 24px に戻した元絵を置く。「一旦進めましょう」は次へ進んでよいという意味で、合格ではない
- 質問は1回に1つ、どの点に答えればよいかを明示する
- **計画に不備が見つかったら、直す前に止めて報告する**
- `feat/roran-face` には触れない（`git show` で読むのはよい）。push と PR は依頼者の指示があるまでしない
- 使い捨ての道具と途中の画像は `.superpowers/sdd/2026-10-01-roran-unit-from-face/`（以下 `$SDD`。git 管理外）に置く
- コミットは Conventional Commits ＋日本語の要約。author は akabee0161
- `pixel-asset-forge/tools/` は触らない（触ったら forge の unittest と `UPSTREAM.md` が要る）
- 具体的な不都合を言えない自分の気付きは確認事項に混ぜず、`HANDOVER.md` の「Claude の気付き（具体的な不都合は未確認）」に書く

## Review Focus

- コマの間で足元（y=30）や体の中心が1pxずれてアニメがガタつく → Task 6 の `sheet.py` のプレビューと実測表で確かめる
- 髪と服が同じ色の塊に見える（輪郭を挟み忘れたところ） → Task 1 と Task 6 で `check_colors.py`、Task 5 で4方向を並べて見る
- 広げた髪が `breathe`・攻撃のコマで剣の刃や柄に重なり、剣が欠ける・髪が剣の上に出る → Task 6 の写す道具が「衝突」として一覧に出す。全件を手で直す
- 目の行が方向によってずれる（振り向いたときに目が上下する） → Task 5 で4方向を並べ、行番号を表に書いて確かめる
- 頭頂が y=5 より上に出る（背丈の規約違反） → Task 2・5・6 で外接矩形の上端を測る（`sheet.py` の実測表）

---

### Task 1: 色を置き換える（段階1）

**Files:**
- Modify: `pixel-asset-forge/palette/master.json`（`feat/roran-face` の中身に置き換える）
- Modify: `pixel-asset-forge/assets/unit/roran/*.txt`（24コマの `# map:` 行だけ）
- Create: `$SDD/present.py`（見せる画像を作る道具。以降のタスクでも使う）
- Create: `$SDD/look.py` は既にある（24px に戻した元絵 `$SDD/shots/face24q.png` を作る）

**Interfaces:**
- Produces: `present.py OUT.png GRID.txt [GRID.txt ...]` … 左端に元絵（`$SDD/shots/face24q.png`）を8倍、続けて各グリッドを8倍で並べ、下の段に同じ並びの等倍を草の色（`grass_base`）の上に置いた画像を書き出す。各グリッドの上にファイル名（拡張子なし）を書く

- [ ] **Step 1: 元絵を 24px に戻した画像を作る**

```sh
cd /home/ubuntu/workspace/character-tactics/pixel-asset-forge
.venv/bin/python ../.superpowers/sdd/2026-10-01-roran-unit-from-face/look.py ../.superpowers/sdd/2026-10-01-roran-unit-from-face/shots
```

Expected: 14色の一覧と 24 行のグリッドが出て、`$SDD/shots/face24q.png` ができる

- [ ] **Step 2: `present.py` を書く**

`$SDD/present.py`:

```python
"""案を並べて見せる画像を作る（scratch helper）。
Usage: present.py OUT.png GRID.txt [GRID.txt ...]
上の段: 元絵（24px に戻したもの）と各グリッドを8倍。下の段: 同じ並びの等倍を草の色の上に置く。"""
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
face = Image.open(SDD / "shots/face24q.png").convert("RGBA")
items = [("face24", face)] + [(p.stem, to_image(parse(p), pal, 1)) for p in paths]
big = [(n, im.resize((im.width * S, im.height * S), Image.NEAREST)) for n, im in items]
W = PAD + sum(b.width + PAD for _, b in big)
top = max(b.height for _, b in big)
H = LABEL + top + PAD + 32 + PAD * 2
sheet = Image.new("RGBA", (W, H), (200, 200, 200, 255))
d = ImageDraw.Draw(sheet)
grass = pal["grass_base"]
d.rectangle([0, LABEL + top + PAD, W, H], fill=(*grass, 255))
x = PAD
for (name, b), (_, small) in zip(big, items):
    d.text((x, 2), name, fill=(0, 0, 0, 255))
    sheet.alpha_composite(b, (x, LABEL))
    sheet.alpha_composite(small, (x, LABEL + top + PAD * 2))
    x += b.width + PAD
sheet.save(out)
print(out)
```

- [ ] **Step 3: パレットを取り込む**

```sh
cd /home/ubuntu/workspace/character-tactics
git show origin/feat/roran-face:pixel-asset-forge/palette/master.json > pixel-asset-forge/palette/master.json
git diff --stat
```

Expected: `master.json` だけが 17 行増える（`hair_slate_*` 4・`skin_rose_*` 4・`iris_slate` 2・`cloak_dark_*` 3 と空行）

- [ ] **Step 4: 24コマの `# map:` 行を書き換える**

```sh
cd /home/ubuntu/workspace/character-tactics/pixel-asset-forge/assets/unit/roran
sed -i \
  -e 's/^# map: o=outline a=skin_hi b=skin_base c=skin_shadow$/# map: o=outline a=skin_rose_hi b=skin_rose_base c=skin_rose_shadow/' \
  -e 's/^# map: e=hair_hi f=hair_base g=hair_shadow h=hair_dark$/# map: e=hair_slate_hi f=hair_slate_base g=hair_slate_shadow h=hair_slate_dark/' \
  -e 's/^# map: p=cloth_hi q=cloth_base r=cloth_shadow$/# map: p=cloak_dark_hi q=cloak_dark_base r=cloak_dark_shadow/' \
  *.txt
grep -c "skin_rose_hi\|hair_slate_hi\|cloak_dark_hi" *.txt | grep -v ":3$" ; git -C /home/ubuntu/workspace/character-tactics diff --stat | tail -1
```

Expected: `:3` でない行は出ない（24ファイルすべてで3行が置き換わった）。diff は 25 files changed（パレット＋24コマ）

- [ ] **Step 5: 検査を通す**

```sh
cd /home/ubuntu/workspace/character-tactics/pixel-asset-forge
.venv/bin/python tools/validate.py
.venv/bin/python tools/check_colors.py assets/unit/roran
```

Expected: `validate.py` は終了コード 0。`check_colors.py` の結果は全件を控え、髪と服（`hair_slate_*` と `cloak_dark_*`）の組が出たら座標を見せるときに伝える

- [ ] **Step 6: 4方向を並べた画像を作って見せる**

```sh
cd /home/ubuntu/workspace/character-tactics/pixel-asset-forge
.venv/bin/python ../.superpowers/sdd/2026-10-01-roran-unit-from-face/present.py ../.superpowers/sdd/2026-10-01-roran-unit-from-face/shots/t1_colors.png assets/unit/roran/{down,up,left,right}_base.txt
```

`$SDD/shots/t1_colors.png` を Read で見せる。段階1は途中の状態（服の明るい面が青緑のまま）であることを添える。**止まる。**

- [ ] **Step 7: コミット**（依頼者が次へ進んでよいと言った後）

```sh
cd /home/ubuntu/workspace/character-tactics
git add pixel-asset-forge/palette/master.json pixel-asset-forge/assets/unit/roran
git commit -m "feat: ロランのユニットの髪・肌・服を顔グラの色に置き換える（パレットは feat/roran-face と同じ）"
```

---

### Task 2: 髪の形を選ぶ（段階2a）

**Files:**
- Create: `$SDD/cand/hair_H1.txt` 〜 `hair_H4.txt`（`down_base` を写して髪だけ描き直した案。3〜4案）
- Modify: `pixel-asset-forge/assets/unit/roran/down_base.txt`（選ばれた案）

**Interfaces:**
- Consumes: `present.py`（Task 1）
- Produces: 新しい `down_base.txt`（髪の形が決まったもの）

- [ ] **Step 1: 元絵の髪を読む**

`$SDD/shots/face24q.png` と `look.py` のグリッド出力から、髪の外形（ぎざぎざの位置）・横の髪が覆う範囲（耳の位置）・前髪の下端（目の行との差）を行と列で書き出す。

- [ ] **Step 2: 案を描く**

`cp pixel-asset-forge/assets/unit/roran/down_base.txt $SDD/cand/hair_H1.txt` などで写し、y=5〜14 の髪（`e` `f` `g` `h`）と輪郭（`o`）だけを書き換える。守ること:
- 頭頂は y=5 より上に出さない
- 横は今の頭より左右1px程度まで
- 目（今は y=11 の輪郭色の点）は消さない（目の描き直しは Task 3）
- 髪と服が接するところに `o` を挟む
- 盾・剣・体・脚は変えない
- 案ごとに前髪の長さ（目の1行上まで／目の2行上まで）と外形の凹凸（大きい房2〜3つ／小さい凹凸を多く）を変える。前の案の座標を流用して「新しく描いた」と言わない

- [ ] **Step 3: 案の検査**

```sh
cd /home/ubuntu/workspace/character-tactics/pixel-asset-forge
for f in ../.superpowers/sdd/2026-10-01-roran-unit-from-face/cand/hair_H*.txt; do .venv/bin/python tools/check_colors.py "$f"; done
```

Expected: 終了コード 0（hard failure なし）。警告は控える

- [ ] **Step 4: 並べて見せる**

```sh
.venv/bin/python ../.superpowers/sdd/2026-10-01-roran-unit-from-face/present.py ../.superpowers/sdd/2026-10-01-roran-unit-from-face/shots/t2_hair.png assets/unit/roran/down_base.txt ../.superpowers/sdd/2026-10-01-roran-unit-from-face/cand/hair_H*.txt
```

Read で見せ、案ごとの違いを1行ずつ添える。質問は「どの案にするか」の1つ。**止まる。**

- [ ] **Step 5: 選ばれた案を `down_base.txt` に書き、検査してコミット**

```sh
cp ../.superpowers/sdd/2026-10-01-roran-unit-from-face/cand/hair_H<n>.txt assets/unit/roran/down_base.txt
.venv/bin/python tools/validate.py
cd .. && git add pixel-asset-forge/assets/unit/roran/down_base.txt
git commit -m "feat: ロランのユニットの正面の髪を顔グラの形にする（案 H<n>）"
```

---

### Task 3: 目を選ぶ（段階2b）

**Files:**
- Create: `$SDD/cand/eye_E1.txt` 〜 `eye_E4.txt`（3〜4案）
- Modify: `pixel-asset-forge/assets/unit/roran/down_base.txt`
- Modify: `pixel-asset-forge/types/unit/SPEC.md`（「立ち絵4方向の規約」の「顔」の行）

**Interfaces:**
- Consumes: Task 2 の `down_base.txt`
- Produces: 目の形（上端の行・幅・高さ・色）。Task 5 で残りの方向にそろえる

- [ ] **Step 1: 案を描く**

Task 2 の `down_base.txt` を写し、目だけを描き直す。縦2pxを基本にし、案ごとに幅（1px／2px）と色を変える。使える色は `outline`・`iris_slate`・`iris_slate_dark`・`eye_white`。使う色を `# map:` 行に文字で足す（例 `# map: t=iris_slate u=iris_slate_dark v=eye_white`。今使っていない文字を選ぶ）。前髪と目の間が詰まりすぎるときは、その案の説明に書く（前髪を描き直すかは依頼者に聞く）

- [ ] **Step 2: 案の検査と並べて見せる**

```sh
cd /home/ubuntu/workspace/character-tactics/pixel-asset-forge
for f in ../.superpowers/sdd/2026-10-01-roran-unit-from-face/cand/eye_E*.txt; do .venv/bin/python tools/check_colors.py "$f"; done
.venv/bin/python ../.superpowers/sdd/2026-10-01-roran-unit-from-face/present.py ../.superpowers/sdd/2026-10-01-roran-unit-from-face/shots/t3_eyes.png assets/unit/roran/down_base.txt ../.superpowers/sdd/2026-10-01-roran-unit-from-face/cand/eye_E*.txt
```

Read で見せる。質問は「どの案にするか」の1つ。**止まる。**

- [ ] **Step 3: 選ばれた案を `down_base.txt` に書く**

```sh
cp ../.superpowers/sdd/2026-10-01-roran-unit-from-face/cand/eye_E<n>.txt assets/unit/roran/down_base.txt
.venv/bin/python tools/validate.py
```

- [ ] **Step 4: SPEC の目の規約を書き直す**

`pixel-asset-forge/types/unit/SPEC.md` の次の行を、選ばれた目の形に合わせて書き直す:

```
- **顔:** 顔の内部に `outline` を使わない（例外は目。正面は1pxの点2つ、横顔は1pxの点1つ）。
  横顔の前面は平らにし、鼻を出さない。口は描かない。目の行は4方向で揃える（ロランは y = 11）
```

書き方の例（E<n> が「縦2px・幅1px、上が `iris_slate_dark`、下が `iris_slate`」だった場合）:

```
- **顔:** 顔の内部に `outline` を使わない（例外は目）。目は縦長に描く。正面は2つ、横顔は1つ。
  ロランは縦2px・幅1pxで、上が `iris_slate_dark`、下が `iris_slate`（issue #23、2026-10-01 依頼者の判断）。
  横顔の前面は平らにし、鼻を出さない。口は描かない。目の上端の行は4方向で揃える（ロランは y = <行>）
```

- [ ] **Step 5: コミット**

```sh
cd .. && git add pixel-asset-forge/assets/unit/roran/down_base.txt pixel-asset-forge/types/unit/SPEC.md
git commit -m "feat: ロランのユニットの正面の目を大きく縦長にし、unit の目の規約を書き直す（案 E<n>）"
```

---

### Task 4: 服の模様を選ぶ（段階3）

**Files:**
- Create: `$SDD/cand/cloth_C1.txt` 〜 `cloth_C3.txt`（2〜3案）
- Modify: `pixel-asset-forge/assets/unit/roran/down_base.txt`

**Interfaces:**
- Consumes: Task 3 の `down_base.txt`
- Produces: 服の模様（青緑の線の位置・首元の赤紫の範囲）。Task 5 で残りの方向に描く

- [ ] **Step 1: 案を描く**

Task 3 の `down_base.txt` を写す。服（`p` `q` `r`）の明るい面を `q`/`r` 中心に描き直し、青緑（`p` = `cloak_dark_hi`）は線として使う。首元に赤紫を置く（`# map:` 行に `d=skin_rose_deep` のように今使っていない文字で足す）。案ごとに青緑の線の位置を変える（C1 襟、C2 前の合わせ、C3 裾）。光源は左上。

- [ ] **Step 2: 案の検査と並べて見せる**

```sh
cd /home/ubuntu/workspace/character-tactics/pixel-asset-forge
for f in ../.superpowers/sdd/2026-10-01-roran-unit-from-face/cand/cloth_C*.txt; do .venv/bin/python tools/check_colors.py "$f"; done
.venv/bin/python ../.superpowers/sdd/2026-10-01-roran-unit-from-face/present.py ../.superpowers/sdd/2026-10-01-roran-unit-from-face/shots/t4_cloth.png assets/unit/roran/down_base.txt ../.superpowers/sdd/2026-10-01-roran-unit-from-face/cand/cloth_C*.txt
```

Read で見せる。質問は「どの案にするか」の1つ。**止まる。**

- [ ] **Step 3: 選ばれた案を書いてコミット**

```sh
cp ../.superpowers/sdd/2026-10-01-roran-unit-from-face/cand/cloth_C<n>.txt assets/unit/roran/down_base.txt
.venv/bin/python tools/validate.py
cd .. && git add pixel-asset-forge/assets/unit/roran/down_base.txt
git commit -m "feat: ロランのユニットの正面の服に青緑の線と首元の赤紫を描く（案 C<n>）"
```

---

### Task 5: 残りの3方向の base（段階4）

**Files:**
- Modify: `pixel-asset-forge/assets/unit/roran/up_base.txt`・`left_base.txt`・`right_base.txt`

**Interfaces:**
- Consumes: Task 2〜4 で決まった髪・目・服（`down_base.txt`）
- Produces: 4方向の新しい `base`。Task 6 で写す元になる

- [ ] **Step 1: 3方向を描く**

`down_base.txt` の髪・目・服を、向きに合わせて描く。`# map:` 行は `down_base.txt` と同じにする（Task 3・4 で足した文字も入れる）。守ること:
- `left` と `right` は別々に描く（mirror を使わない。手前と奥、光源が入れ替わる）
- 横顔の目は1つで、正面の目と同じ形。目の上端の行は正面と同じ
- 背面（`up`）には目を描かない。首元の赤紫は見える範囲だけ
- 髪と服が接するところに `o` を挟む
- 頭頂は y=5 より上に出さない。剣・盾・脚は変えない

- [ ] **Step 2: 検査**

```sh
cd /home/ubuntu/workspace/character-tactics/pixel-asset-forge
.venv/bin/python tools/validate.py
.venv/bin/python tools/check_colors.py assets/unit/roran
```

Expected: `validate.py` は 0。`check_colors.py` は hard failure なし

- [ ] **Step 3: 4方向を並べて見せる**

```sh
.venv/bin/python tools/contact_sheet.py --columns 4 --scale 8 -o ../.superpowers/sdd/2026-10-01-roran-unit-from-face/shots/t5_contact.png assets/unit/roran/down_base.txt assets/unit/roran/left_base.txt assets/unit/roran/right_base.txt assets/unit/roran/up_base.txt
.venv/bin/python ../.superpowers/sdd/2026-10-01-roran-unit-from-face/present.py ../.superpowers/sdd/2026-10-01-roran-unit-from-face/shots/t5_bases.png assets/unit/roran/{down,up,left,right}_base.txt
```

2枚を Read で見せる。各方向の目の上端の行と頭頂の行を表にして添える。**止まる。**

- [ ] **Step 4: コミット**

```sh
cd .. && git add pixel-asset-forge/assets/unit/roran/{up,left,right}_base.txt
git commit -m "feat: ロランのユニットの背面・横向きに顔グラの髪・目・服を描く"
```

---

### Task 6: アニメの20コマ（段階5）

**Files:**
- Create: `$SDD/propagate.py`（使い捨て）
- Modify: `pixel-asset-forge/assets/unit/roran/` の `*_breathe.txt`・`*_walk_a.txt`・`*_walk_b.txt`・`*_atk_wind.txt`・`*_atk_hit.txt`（20コマ）

**Interfaces:**
- Consumes: Task 5 の4方向の `base`。旧 base と旧コマは `origin/main` のグリッド（Task 1 は `# map:` 行しか変えていないので、行の中身は main と同じ）
- Produces: `propagate.py` … 各コマの各画素について、「旧コマ＝旧 base」なら新 base の画素に、そうでなければ旧コマの画素のままにする。「旧コマ≠旧 base」かつ「新 base≠旧 base」の画素を**衝突**として一覧に出す。`# map:` 行は新 base のものにする

- [ ] **Step 1: `propagate.py` を書く**

`$SDD/propagate.py`:

```python
"""新しい base の変更を、アニメのコマへ写す（scratch helper）。
旧コマの画素が旧 base と同じなら新 base の画素にし、違えば（剣・腕・脚が動いたところ）旧コマのまま残す。
旧 base と新 base が違う画素で、旧コマも旧 base と違うものは「衝突」として出す。手で直すこと。
旧 base と旧コマは origin/main から読む。
Usage: propagate.py [--dry-run]"""
import subprocess
import sys
from pathlib import Path

ROOT = Path("/home/ubuntu/workspace/character-tactics")
UNIT = ROOT / "pixel-asset-forge/assets/unit/roran"
REL = "pixel-asset-forge/assets/unit/roran"
FRAMES = ("breathe", "walk_a", "walk_b", "atk_wind", "atk_hit")
dry = "--dry-run" in sys.argv


def split(text: str) -> tuple[list[str], list[str]]:
    lines = text.splitlines()
    head = [l for l in lines if l.startswith("#")]
    rows = [l for l in lines if l and not l.startswith("#")]
    assert len(rows) == 32 and all(len(r) == 32 for r in rows), "32x32 ではない"
    return head, rows


def old(name: str) -> list[str]:
    text = subprocess.run(["git", "-C", str(ROOT), "show", f"origin/main:{REL}/{name}.txt"],
                          check=True, capture_output=True, text=True).stdout
    return split(text)[1]


total = 0
for d in ("down", "up", "left", "right"):
    old_base = old(f"{d}_base")
    new_head, new_base = split((UNIT / f"{d}_base.txt").read_text())
    for f in FRAMES:
        name = f"{d}_{f}"
        old_rows = old(name)
        out, clashes = [], []
        for y in range(32):
            row = []
            for x in range(32):
                ob, nb, of = old_base[y][x], new_base[y][x], old_rows[y][x]
                if of == ob:
                    row.append(nb)
                else:
                    row.append(of)
                    if nb != ob:
                        clashes.append((x, y, of, ob, nb))
            out.append("".join(row))
        total += len(clashes)
        print(f"{name}: 衝突 {len(clashes)}")
        for x, y, of, ob, nb in clashes:
            print(f"  x={x} y={y} 旧コマ={of!r} 旧base={ob!r} 新base={nb!r}")
        if not dry:
            (UNIT / f"{name}.txt").write_text("\n".join(new_head + out) + "\n")
print(f"衝突の合計: {total}")
```

- [ ] **Step 2: 書き込まずに衝突を数える**

```sh
cd /home/ubuntu/workspace/character-tactics
pixel-asset-forge/.venv/bin/python .superpowers/sdd/2026-10-01-roran-unit-from-face/propagate.py --dry-run | tee .superpowers/sdd/2026-10-01-roran-unit-from-face/shots/t6_clashes.txt
```

Expected: `walk_a`・`walk_b` の衝突は脚（y=28〜30）の行だけで、新 base が脚を変えていなければ 0。`breathe`・攻撃のコマは剣と髪・服が重なるところに衝突が出る。walk に脚以外の衝突が出たら、**止めて報告する**（計画の前提「walk は上半身が base のまま」が崩れている）

- [ ] **Step 3: 写す**

```sh
pixel-asset-forge/.venv/bin/python .superpowers/sdd/2026-10-01-roran-unit-from-face/propagate.py
git diff --stat
```

Expected: 20コマが変わる

- [ ] **Step 4: 衝突を手で直す**

Step 2 の一覧の画素を1つずつ見て直す。決め方:
- 手前の剣（`down` の右手、`right` の右手）は剣を残す。剣の縁と髪・服の間に `o` が無ければ足す
- 奥の剣（`up`・`left`）は、体に重なる部分を描かない（立ち絵の規約）。髪・服の側を新 base の画素にする
- 腕が服の上を動いたところ（攻撃の腕）は腕を残し、腕の周りの服を新 base の模様に合わせる
- 判断がつかない画素があれば、その画素の座標と両方の絵を見せて**止まる**

- [ ] **Step 5: 検査**

```sh
cd /home/ubuntu/workspace/character-tactics/pixel-asset-forge
.venv/bin/python tools/validate.py
.venv/bin/python tools/check_colors.py assets/unit/roran
.venv/bin/python tools/sheet.py sheets/roran.txt
```

Expected: `validate.py` は 0、`check_colors.py` は hard failure なし。`sheet.py` の実測表は `atk_hit` と横向きの `atk_wind` 以外がすべて `ok`（SPEC の「目視の手順」のとおり、この2つの `off` は仕様どおり）。頭頂の行が y=5 より上に出ていないこと（`breathe` の切っ先 y=3、攻撃の切っ先 y=0 は例外）

- [ ] **Step 6: プレビューを見せる**

`build/sheets/roran_preview.png` を Read で見せる。衝突の件数と直し方を添える。**止まる。**

- [ ] **Step 7: コミット**

```sh
cd .. && git add pixel-asset-forge/assets/unit/roran
git commit -m "feat: ロランのユニットのアニメの20コマに顔グラの髪・目・服を写す"
```

---

### Task 7: ゲームで確かめ、文書を直す（段階6）

**Files:**
- Modify: `assets/images/roran-map.png`（`export.py` で書き出す）
- Modify: `pixel-asset-forge/types/unit/SPEC.md`（「未確定」の色数の行）
- Modify: `HANDOVER.md`

**Interfaces:**
- Consumes: Task 6 までの24コマ
- Produces: ゲームで使うシート

- [ ] **Step 1: 書き出す**

```sh
cd /home/ubuntu/workspace/character-tactics
pixel-asset-forge/.venv/bin/python pixel-asset-forge/tools/export.py sprites.json assets/images
git status --short assets/images
```

Expected: `FAIL` が出ない。`assets/images/roran-map.png` だけが変わる（ほかの PNG が変わったら**止めて報告する**）

- [ ] **Step 2: テストとビルド**

```sh
npm test
npm run build
```

Expected: どちらも成功（`src/engine/sheet-size.test.ts` はシートの実寸と JSON の一致を見る）

- [ ] **Step 3: 画面を撮る**

```sh
npx vite preview --port 4178 &
node .superpowers/sdd/2026-09-30-roran-face/cdp.mjs "http://localhost:4178/play/character-tactics/?debug" .superpowers/sdd/2026-10-01-roran-unit-from-face/shots shot:title
```

`cdp.mjs` は `feat/roran-face` の作業で作った使い捨ての道具（git 管理外。手順 `shot:<名前>` `tap:<x>,<y>` `wait:<ミリ秒>` `key:<キー>`、論理座標）。撮った画面を見て、ステージ選択 → 会話を `とばす`／タップで送る → 配置 → `始める` の座標を1つずつ決め、配置の画面と戦闘中の画面（ロランが歩いているところ、`P` で止めて `.` で送り攻撃のコマ）を撮る。Read で見せる。**止まる。** 終わったら `vite preview` を止める

- [ ] **Step 4: 全アセットの並びを作り直す**

```sh
cd pixel-asset-forge && .venv/bin/python tools/contact_sheet.py
```

`build/contact_sheet.png` を見て、ロランだけが浮いていないかを確かめる（`build/` は git 管理外なのでコミットは無い）

- [ ] **Step 5: SPEC の色数の行を直す**

`pixel-asset-forge/types/unit/SPEC.md` の「未確定」の `- **アセットあたりの色数上限** — 未定。ロランは15〜17色` を、実測した色数に直す。実測:

```sh
for f in assets/unit/roran/*.txt; do echo "$f $(grep -v '^#' $f | grep -o '[^.]' | sort -u | wc -l)"; done | sort -k2 -n | sed -n '1p;$p'
```

- [ ] **Step 6: HANDOVER を直す**

`HANDOVER.md` に次を書く:
- Current State: ブランチ `feat/roran-unit-from-face`（main から分岐、push・PR なし）。issue #23 の2番目
- 決めたこと: spec の「決めたこと」と、Task 2〜4 で選ばれた案（H/E/C の番号と中身）、Task 6 の衝突の直し方
- issue #23 の進め方（1〜5）と、1番目は `feat/roran-face` で依頼者が手で直していること
- マージのとき: パレットは `feat/roran-face` と同じ中身。`HANDOVER.md` はぶつかるので両方を残して直す
- 「Claude の気付き（具体的な不都合は未確認）」の欄を作る（main にはまだ無い。説明は `git show origin/feat/roran-face:HANDOVER.md` の同じ欄の前書きに合わせる）。作業中の気付きはこの欄に1行ずつ書く。無ければ「なし」と書く

- [ ] **Step 7: コミット**

```sh
cd /home/ubuntu/workspace/character-tactics
git add assets/images/roran-map.png pixel-asset-forge/types/unit/SPEC.md HANDOVER.md
git commit -m "feat: ロランのユニットのシートを書き出し、SPEC と HANDOVER を直す"
```

---

## 追記: Task 6b 攻撃のコマを描き直す（2026-10-01）

spec の「追記: 攻撃のコマの振り方」を実装する。Task 7 の前に行う。

**Files:**
- Create: `$SDD/cand/atk_*.txt`（案）
- Modify: `pixel-asset-forge/assets/unit/roran/{down,up,left,right}_atk_hit.txt`
- Modify: `pixel-asset-forge/types/unit/SPEC.md`（「攻撃は振り下ろし」の `atk_hit` の規約）

- [ ] **Step 1: 正面の `atk_hit` の案**（2〜3案）を `$SDD/cand/` に描く。拳は体の前の中央、刃は真っすぐ下。体・脚・盾は今のコマのまま。輪郭の切れ目は `$SDD/open_edges.py` で main より増えていないことを確かめる。`present.py` で `down_atk_wind`・今の `down_atk_hit`・案を並べて見せる。**止まる**
- [ ] **Step 2: 背面の `atk_hit` の案**（1〜2案）。剣は隠す。同じく並べて見せる。**止まる**
- [ ] **Step 3: 横向きの `atk_hit` の案**（2〜3案）。左右は別々に描く。切っ先は左向き x=1・右向き x=30 まで。同じく並べて見せる。**止まる**
- [ ] **Step 4: 選ばれた案を assets に書き、検査する**

```sh
cd /home/ubuntu/workspace/character-tactics/pixel-asset-forge
.venv/bin/python tools/validate.py
.venv/bin/python tools/check_colors.py assets/unit/roran
.venv/bin/python tools/sheet.py sheets/roran.txt
```

Expected: `validate.py` 0、`check_colors.py` hard failure なし、足元はすべて y=30

- [ ] **Step 5: SPEC の `atk_hit` の規約を、選ばれた形に書き直す**
- [ ] **Step 6: プレビュー（`build/sheets/roran_preview.png`）と `$SDD/frames.py` の並びを見せる。**止まる**
- [ ] **Step 7: コミット**

```sh
cd /home/ubuntu/workspace/character-tactics
git add pixel-asset-forge/assets/unit/roran pixel-asset-forge/types/unit/SPEC.md
git commit -m "feat: ロランのユニットの攻撃を真っすぐ前へ振り下ろす形にし、unit の攻撃の規約を書き直す"
```
