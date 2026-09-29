# `unit` ロランの20コマを新しい立ち絵に揃える 実装計画

作成: 2026-09-26。**このファイルは作成時点のログ**。運用の最新は `README.md` と `CLAUDE.md` と
`types/unit/SPEC.md` を見ること。実行中に変わった判断は正典側に反映し、この計画書は遡って更新しない。

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ロランの `base` 以外の20コマ（4方向 × `breathe` / `walk_a` / `walk_b` / `atk_wind` / `atk_hit`）を、
PR #4 で確定した立ち絵の規約に揃え、`right_*` 5コマを本体グリッドにする。

**Architecture:** 絵はすべて `assets/unit/roran/*.txt` のグリッドを手で描く（ツールは変えない）。
`breathe` はその場限りのスクリプトで頭の列だけを1行下げた下書きを作ってから手で仕上げ、`walk` は `base` の
脚の3行を差し替える。攻撃2種は手で描く。状態ごとに4方向をまとめて描き、状態ごとに依頼者のゲートを置く。

**Tech Stack:** Python 3 + Pillow（既存の依存だけ）、`unittest`。

**Spec:** `docs/2026-09-26-unit-animation-frames-spec.md`

## Global Constraints

すべてのタスクの要件にこの節が暗黙に含まれる。

- **立ち絵の規約をすべて引き継ぐ**（`types/unit/SPEC.md` の「立ち絵4方向の規約」）: 右手に剣・左手に盾、
  4方向の手前／奥の表、奥の物は体に重なる部分を隠す、色は手前も奥も同じ、横顔は平らで目は1px、
  顔の内部に目以外の `outline` を使わない、`# light: upper-left`、`bg: transparent`
- **`right_*` も本体グリッドにする。** `left_*` を反転して描き始めない。`# from:` / `# transform:` を残さない
- **盾はどのコマでも `base` の位置から動かさない。** 動かすのは剣を持つ腕と脚だけ
- **足元は y=30。`atk_*` 以外は中心 15.5±1・背丈26**
- **攻撃は振り下ろし。** `atk_wind` は拳を頭の高さまで上げて刃を真上に立てる。**攻撃コマに限り切っ先は
  頭頂（y=5）より上に出てよい**（y=0 まで）。`atk_hit` は拳を体の前の胸〜腰に下ろし、刃を前下がりの斜めにする
- **`*_base` 4枚と `types/unit/base/` には触らない。** `sheets/roran.txt` も変えない
- **ツールを変えない。新しい機械チェックを足さない。** 計画中の確認コマンドはその場限り
- **縮小表示は考慮しない。ゲーム内での確認はしない**（依頼者の指定）
- **`tests/` から `assets/` の現役アートを参照しない**
- コミットは Conventional Commits + 日本語の要約。Python は必ず `.venv/bin/python` で動かす
- **heredoc（`python - <<'EOF'`）は安全フックに止められる。** スクリプトは `python -c "..." 引数` の形で流す。
  `gridfile.parse()` は `Path` を要求する
- ブランチは `feat/unit-animation-frames`（作成済み。現在のチェックアウトで作業する）

## Review Focus

どのテストも踏まないが、いちばん起こりやすい失敗。上から順に起こりやすい。

1. **`right_*` を `left_*` の反転で描き始め、光源が右上に移る**
   → 各タスクの確認コマンドで `from False` を見る。`atk_*` は Task 3・4 の光源の目安コマンドで `_hi` の平均 x < `_shadow` の平均 x を見る
2. **`breathe` / `walk` で剣が `base` からずれる**（コマを切り替えると剣が震える）
   → 確認コマンドの `blade_same True`（`left_breathe` だけは列 x=20 の差し替えがあるので `False` が正しい。Task 1 Step 3 で個別に確かめる）
3. **盾が動く**（左腕まで描き直してしまう）
   → 確認コマンドの `shield_diff 0`。`up_atk_hit` だけは剣が盾に重なる可能性があり、そのときは差分の位置を目で見る
4. **`walk` の脚の差し替えで、旧コマにあった剣の切っ先の残骸（y=28 の `oo`）まで持ち込む**
   → Task 2 の行は残骸を除いた形で書いてある。確認コマンドの `blade_same True` で検出できる
5. **`breathe` で目の行が4方向で揃わない**
   → `breathe` では目が y=12 に下がる。`down` / `left` / `right` の3枚とも y=12 であること（`up` は目が無い）。Task 1 Step 4 で数える

---

## File Structure

| ファイル | 責務 | タスク |
|---|---|---|
| `assets/unit/roran/{down,up,left,right}_breathe.txt` | 呼吸コマ。`right_breathe` は派生から本体へ | 1 |
| `assets/unit/roran/{down,up,left,right}_walk_{a,b}.txt` | 歩行コマ。`right_walk_*` は派生から本体へ | 2 |
| `assets/unit/roran/{down,up,left,right}_atk_wind.txt` | 振りかぶり。`right_atk_wind` は派生から本体へ | 3 |
| `assets/unit/roran/{down,up,left,right}_atk_hit.txt` | 振り下ろし。`right_atk_hit` は派生から本体へ | 4 |
| `types/unit/SPEC.md` / `ISSUES.md` / `README.md` / `CLAUDE.md` | 規約と課題を合わせる | 5 |

**ヘッダ（20コマ共通）。** `*_base` と同じものを使う。`right_*` の2行ヘッダ（`# from:` / `# transform:`）は丸ごと置き換える。

```
# type: unit
# size: 32x32
# light: upper-left
# bg: transparent
# map: o=outline a=skin_hi b=skin_base c=skin_shadow
# map: e=hair_hi f=hair_base g=hair_shadow h=hair_dark
# map: p=cloth_hi q=cloth_base r=cloth_shadow
# map: m=metal_hi n=metal_base s=metal_shadow
# map: i=stone_hi j=stone_base k=stone_shadow
# map: w=wood_base x=wood_shadow
```

**確認コマンド**（全タスクで使う。引数にコマのファイルを並べる。`base` は同じ方向の `*_base.txt` を自動で読む）:

```sh
.venv/bin/python -c "
import sys; sys.path.insert(0, 'tools')
from pathlib import Path
from gridfile import parse
SHIELD = {'down': (20, 24), 'up': (7, 10), 'left': (9, 11), 'right': (20, 22)}
for p in map(Path, sys.argv[1:]):
    d = p.stem.split('_')[0]
    g, b = parse(p), parse(p.with_name(d + '_base.txt'))
    cells = [(x, y) for y, row in enumerate(g.rows) for x, c in enumerate(row) if c != '.']
    xs = [x for x, _ in cells]; ys = [y for _, y in cells]
    blade = lambda h: {(x, y) for y, row in enumerate(h.rows) for x, c in enumerate(row) if h.charmap.get(c, '').startswith('stone_')}
    x0, x1 = SHIELD[d]
    shield_diff = sum(g.rows[y][x] != b.rows[y][x] for y in range(17, 26) for x in range(x0, x1 + 1))
    has_from = any(l.startswith('# from:') for l in p.read_text().splitlines())
    print(p.name, 'foot', max(ys), 'center', (min(xs) + max(xs)) / 2, 'height', max(ys) - min(ys) + 1,
          'blade_same', blade(g) == blade(b), 'shield_diff', shield_diff, 'from', has_from)
" <files...>
```

`SHIELD` は各方向の `base` で盾（と、`up` / `left` では盾を握る手）が占める列の範囲。行は y=17〜25。

**並べて見るコマンド**（ゲートで使う。`contact_sheet.py` の並びはファイル名順になる）:

```sh
.venv/bin/python tools/contact_sheet.py <base 4枚> <対象コマ> --scale 8 --columns 4 -o build/unit/<名前>.png
```

---

### Task 1: `breathe` 4コマ

**Files:**
- Modify: `assets/unit/roran/down_breathe.txt` / `up_breathe.txt` / `left_breathe.txt`
- Modify: `assets/unit/roran/right_breathe.txt`（派生2行を本体に置き換える）

**Interfaces:**
- Consumes: `assets/unit/roran/*_base.txt`（PR #4 で確定）
- Produces: 呼吸コマ4枚。`idle` の2コマ目

**動き:** 頭の範囲の y=5〜13 を1行下げ、首の行（y=14）を消す（旧 `breathe` と同じ）。**剣と体は動かさない。**

- [ ] **Step 1: 頭の列だけを1行下げた下書きを作る**

方向ごとに、頭が占め剣が占めない列の範囲 `x0..x1` だけを動かす。

| 方向 | x0 | x1 | 理由 |
|---|---|---|---|
| `down` | 11 | 21 | 剣は x=7〜10。x=10 は剣と頭の共有の輪郭で、y=6〜16 がすべて `o` なので動かさなくてよい |
| `up` | 10 | 20 | 剣は x=21〜24。x=21 は共有の輪郭で、y=6〜15 がすべて `o` |
| `left` | 10 | 19 | 剣は x=20〜22 で、頭の後ろに隠れている。x=19・20 は Step 3 で手で直す |
| `right` | 13 | 21 | 手前の剣が x=9〜12 で頭に重なっている。剣は動かさない |

```sh
for spec in "down 11 21" "up 10 20" "left 10 19" "right 13 21"; do set -- $spec
.venv/bin/python -c "
import sys
src, dst, x0, x1 = sys.argv[1], sys.argv[2], int(sys.argv[3]), int(sys.argv[4])
lines = open(src).read().splitlines()
head = [l for l in lines if l.startswith('#')]
g = [list(l) for l in lines if not l.startswith('#')]
out = [r[:] for r in g]
for y in range(6, 15):
    out[y][x0:x1 + 1] = g[y - 1][x0:x1 + 1]
out[5][x0:x1 + 1] = ['.'] * (x1 - x0 + 1)
open(dst, 'w').write('\n'.join(head + [''.join(r) for r in out]) + '\n')
" assets/unit/roran/$1_base.txt assets/unit/roran/$1_breathe.txt $2 $3
done
```

新しい y=6〜14 には元の y=5〜13 が入る。元の y=14（首）は捨てられる。y=15 以下は `base` のまま。

- [ ] **Step 2: 構造の検査**

```sh
.venv/bin/python tools/validate.py assets/unit/roran/{down,up,left,right}_breathe.txt
```

Expected: 4件とも `ok`

- [ ] **Step 3: `left_breathe` の奥の剣を手で直す**

`left` の剣は頭の後ろにあり、頭が1行下がると隠れる位置が変わる。`left_breathe.txt` のグリッドの次のセルを書き換える
（y はグリッドの行番号。ヘッダを除いた0始まり）。

- y=6 の x=19 を `o`（刃の左の輪郭。元は頭の輪郭が兼ねていた）
- x=20 の y=6〜14 を上から `i i o o i o o i i`（`o` は下がった頭の輪郭、`i` は見えるようになった刃）

確かめる:

```sh
.venv/bin/python -c "
import sys; sys.path.insert(0, 'tools')
from pathlib import Path
from gridfile import parse
g, b = parse(Path(sys.argv[1])), parse(Path(sys.argv[2]))
for y in range(5, 17):
    print(y, g.rows[y][17:24], ' base', b.rows[y][17:24])
" assets/unit/roran/left_breathe.txt assets/unit/roran/left_base.txt
```

Expected: 刃（`i` / `j` の列）が y=6〜16 で途切れずに続き、頭の後ろの輪郭が1行下がっている

- [ ] **Step 4: 確認コマンドを流す**

```sh
<確認コマンド> assets/unit/roran/down_breathe.txt assets/unit/roran/up_breathe.txt assets/unit/roran/left_breathe.txt assets/unit/roran/right_breathe.txt
.venv/bin/python -c "
import sys; sys.path.insert(0, 'tools')
from pathlib import Path
from gridfile import parse
for p in sys.argv[1:]:
    g = parse(Path(p))
    rows = sorted({y for y, row in enumerate(g.rows) for x, c in enumerate(row) if c == 'o' and 0 < x < 31
                   and g.rows[y][x - 1] in 'abc' and g.rows[y][x + 1] in 'abc'})
    print(p, 'eye rows', rows)
" assets/unit/roran/down_breathe.txt assets/unit/roran/left_breathe.txt assets/unit/roran/right_breathe.txt
```

Expected:
- 4行とも `foot 30`、`center` が 14.5〜16.5、`height 26`（剣の切っ先が y=5 に残るので26のまま）、`shield_diff 0`、`from False`
- `blade_same` は `down` / `up` / `right` が `True`、`left` が `False`（Step 3 の差し替えのため）
- 目の行は3枚とも `[12]`（Review Focus 5）

- [ ] **Step 5: 描画し、自分で目視する**

```sh
.venv/bin/python tools/render.py assets/unit/roran
.venv/bin/python tools/contact_sheet.py assets/unit/roran/{down,up,left,right}_base.txt assets/unit/roran/{down,up,left,right}_breathe.txt --scale 8 --columns 4 -o build/unit/breathe.png
```

見ること: 頭だけが1px下がり、剣と盾と体が `base` と同じ位置にあるか。`left` の刃が途切れていないか。

- [ ] **Step 6: 依頼者に `build/unit/breathe.png` を見せて判断を仰ぐ**

人間のゲート。**確認すること:** 呼吸に見えるか、4方向で揃っているか。差し戻されたら Step 1〜3 に戻る。差し戻し回数を控える。

- [ ] **Step 7: Commit**

```bash
git add assets/unit/roran/{down,up,left,right}_breathe.txt
git commit -m "fix: ロランの呼吸コマを新しい立ち絵に揃える"
```

---

### Task 2: `walk_a` / `walk_b` 8コマ

**Files:**
- Modify: `assets/unit/roran/{down,up,left}_walk_{a,b}.txt`
- Modify: `assets/unit/roran/right_walk_{a,b}.txt`（派生2行を本体に置き換える）

**Interfaces:**
- Consumes: `*_base.txt`
- Produces: 歩行コマ8枚。`walk` は `[base, walk_a, base, walk_b]`

**動き:** 上半身と剣は `base` のまま。**グリッドの y=28〜30 の3行だけ**を下の行に差し替える（片足のブーツを1行持ち上げる。
旧 `walk` と同じ形から、旧い剣の切っ先の残骸を除いた）。y=0〜27 と y=31 は `base` と同じ。

- [ ] **Step 1: 8枚を書く**

各ファイル = 共通ヘッダ + 同じ方向の `*_base.txt` のグリッドの y=0〜27 + 下の3行 + 32個の `.` の1行（y=31）。

`down_walk_a` と `up_walk_a`（同じ脚）:
```
...........oxxxoorro............
...........ooooooxxxo...........
................ooooo...........
```

`down_walk_b` と `up_walk_b`:
```
............orrooxxxo...........
...........oxxxoooooo...........
...........ooooo................
```

`left_walk_a`:
```
..........oxxxxorrro............
..........ooooooxxxo............
................oooo............
```

`left_walk_b`:
```
............oqqoxxxo............
..........oxxxxooooo............
..........oooooo................
```

`right_walk_a`（`left_walk_a` の脚を左右反転したもの。脚は手前・奥で塗り分けていて光源の影響を受けないので、脚だけは反転してよい。`right_base` の脚の塗り分けと一致する）:
```
............orrroxxxxo..........
............oxxxoooooo..........
............oooo................
```

`right_walk_b`:
```
............oxxxoqqo............
............oooooxxxxo..........
................oooooo..........
```

- [ ] **Step 2: 構造の検査と確認コマンド**

```sh
.venv/bin/python tools/validate.py assets/unit/roran/{down,up,left,right}_walk_{a,b}.txt
<確認コマンド> assets/unit/roran/{down,up,left,right}_walk_{a,b}.txt
```

Expected: `validate` は8件とも `ok`。確認コマンドは8行とも `foot 30`、`center` が 14.5〜16.5、`height 26`、
`blade_same True`、`shield_diff 0`、`from False`

- [ ] **Step 3: 描画し、自分で目視する**

```sh
.venv/bin/python tools/render.py assets/unit/roran
.venv/bin/python tools/contact_sheet.py assets/unit/roran/{down,up,left,right}_base.txt assets/unit/roran/{down,up,left,right}_walk_{a,b}.txt --scale 8 --columns 4 -o build/unit/walk.png
.venv/bin/python tools/sheet.py sheets/roran.txt
```

見ること: 脚だけが動き、上げた足が `a` と `b` で入れ替わるか。横向きで手前の脚が明るいか。
`build/sheets/roran_preview.png` の `walk` 行で足元が赤線に乗っているか。

- [ ] **Step 4: 依頼者に `build/unit/walk.png` を見せて判断を仰ぐ**

**確認すること:** 歩いて見えるか、4方向で揃っているか。差し戻されたら Step 1 に戻る。

- [ ] **Step 5: Commit**

```bash
git add assets/unit/roran/{down,up,left,right}_walk_{a,b}.txt
git commit -m "fix: ロランの歩行コマを新しい立ち絵に揃える"
```

---

### Task 3: `atk_wind` 4コマ（振りかぶり）

**Files:**
- Modify: `assets/unit/roran/{down,up,left}_atk_wind.txt`
- Modify: `assets/unit/roran/right_atk_wind.txt`（派生2行を本体に置き換える）

**Interfaces:**
- Consumes: `*_base.txt`
- Produces: 振りかぶり4枚。`attack` は `[atk_wind, atk_hit, base]`。Task 4 の振り下ろしの起点

- [ ] **Step 1: 4枚を描く**

`*_base.txt` をコピーして始め、**剣と、剣を持つ拳・腕だけを描き替える。** 頭・胴・脚・盾・盾の手は `base` のまま。

- 拳を頭の高さ（y=8〜11 前後）まで上げ、刃を真上に立てる。切っ先は y=0〜4 に出てよい
- `down`: 拳は画面左、頭の横。刃は頭の左で上に伸びる。手前なので全体が見える
- `up`: 拳は画面右、頭の横。剣は奥だが頭の横に出るので、頭と重ならない部分は見える
- `left`: 拳は頭の後ろ側（画面右）に引く。剣は奥なので、頭に重なる部分は隠す
- `right`: 拳は頭の後ろ側（画面左）に引く。剣は手前なので全体を描く（頭に重なってよい）
- 下げた位置にあった拳・鍔・柄頭は消し、その下の胴・腕を `base` の隣接行と同じ階調で埋める
- 色・光源・顔の規約は Global Constraints のとおり

- [ ] **Step 2: 構造の検査と確認コマンド**

```sh
.venv/bin/python tools/validate.py assets/unit/roran/{down,up,left,right}_atk_wind.txt
<確認コマンド> assets/unit/roran/{down,up,left,right}_atk_wind.txt
```

Expected: `validate` は4件とも `ok`。確認コマンドは4行とも `foot 30`、`shield_diff 0`、`from False`。
`blade_same False`（剣を上げたので）。`height` は 26 より大きくてよい（切っ先が y=5 より上に出る）

- [ ] **Step 3: 光源の向きを数える**（Review Focus 1）

```sh
.venv/bin/python -c "
import sys; sys.path.insert(0, 'tools')
from pathlib import Path
from gridfile import parse
for p in sys.argv[1:]:
    g = parse(Path(p))
    def mean_x(suffix):
        xs = [x for row in g.rows for x, c in enumerate(row) if g.charmap.get(c, '').endswith(suffix)]
        return round(sum(xs) / len(xs), 1)
    print(p, ' _hi', mean_x('_hi'), ' _shadow', mean_x('_shadow'))
" assets/unit/roran/left_atk_wind.txt assets/unit/roran/right_atk_wind.txt
```

Expected: 2行とも `_hi` < `_shadow`（明るい側が左）。目安で、剣の位置で差が縮むことがある。逆転していたら反転コピーを疑う

- [ ] **Step 4: 描画し、自分で目視する**

```sh
.venv/bin/python tools/render.py assets/unit/roran
.venv/bin/python tools/contact_sheet.py assets/unit/roran/{down,up,left,right}_base.txt assets/unit/roran/{down,up,left,right}_atk_wind.txt --scale 8 --columns 4 -o build/unit/atk_wind.png
```

見ること: `base`（構え）から剣を振り上げたように見えるか。盾と体が動いていないか。

- [ ] **Step 5: 依頼者に `build/unit/atk_wind.png` を見せて判断を仰ぐ**

**確認すること:** 振りかぶりに見えるか、4方向で揃っているか。差し戻されたら Step 1 に戻る。

- [ ] **Step 6: Commit**

```bash
git add assets/unit/roran/{down,up,left,right}_atk_wind.txt
git commit -m "fix: ロランの振りかぶりコマを剣を頭上に上げる形にする"
```

---

### Task 4: `atk_hit` 4コマ（振り下ろし）

**Files:**
- Modify: `assets/unit/roran/{down,up,left}_atk_hit.txt`
- Modify: `assets/unit/roran/right_atk_hit.txt`（派生2行を本体に置き換える）

**Interfaces:**
- Consumes: `*_base.txt`、Task 3 の `*_atk_wind.txt`（振り下ろしの起点。拳の位置の連続性を見る相手）
- Produces: 振り下ろし4枚

- [ ] **Step 1: 4枚を描く**

`*_base.txt` をコピーして始め、**剣と、剣を持つ拳・腕だけを描き替える。**

- 拳を体の前の胸〜腰の高さ（y=17〜21 前後）に下ろし、刃を前下がりの斜め（45°の階段）にする
- `left` / `right`: 進行方向（`left` は画面左、`right` は画面右）へ斜めに下ろす。`left` は剣が奥なので体に重なる部分を隠す。
  `right` は手前なので全体を描く
- `down`: 刃が体の前を斜めに横切る（拳は胴の中央付近、切っ先は画面左下へ）。手前なので胴に重ねて描く
- `up`: 剣は体の向こう。体に重ならない切っ先側だけを描く。**剣がほとんど見えず攻撃に見えない場合は、
  Step 5 のゲートで依頼者に相談する**（隠す規約を崩すかどうかは依頼者が決める）
- 下げた位置にあった拳・鍔・柄頭は消し、その下の胴・腕を `base` の隣接行と同じ階調で埋める
- 中心がずれるのは許容する

- [ ] **Step 2: 構造の検査と確認コマンド**

```sh
.venv/bin/python tools/validate.py assets/unit/roran/{down,up,left,right}_atk_hit.txt
<確認コマンド> assets/unit/roran/{down,up,left,right}_atk_hit.txt
```

Expected: `validate` は4件とも `ok`。確認コマンドは4行とも `foot 30`、`from False`、`blade_same False`。
`shield_diff 0`。**`up` だけは剣が盾に重なると0でなくなる**ので、そのときは Step 4 の画像で重なり方を見る（Review Focus 3）

- [ ] **Step 3: 光源の向きを数える**

Task 3 Step 3 のコマンドを `left_atk_hit.txt right_atk_hit.txt` に対して流す。

Expected: 2行とも `_hi` < `_shadow`

- [ ] **Step 4: 描画し、自分で目視する**

```sh
.venv/bin/python tools/render.py assets/unit/roran
.venv/bin/python tools/contact_sheet.py assets/unit/roran/{down,up,left,right}_atk_wind.txt assets/unit/roran/{down,up,left,right}_atk_hit.txt --scale 8 --columns 4 -o build/unit/atk_hit.png
.venv/bin/python tools/sheet.py sheets/roran.txt
```

見ること: `atk_wind` から振り下ろしたように見えるか。`atk_hit` → `base` の戻りで剣が不自然に飛ばないか
（`build/sheets/roran_preview.png` の `attack` 行）。

- [ ] **Step 5: 依頼者に `build/unit/atk_hit.png` と `build/sheets/roran_preview.png` を見せて判断を仰ぐ**

**確認すること:** 振り下ろしに見えるか、4方向で揃っているか、`up` が攻撃に見えるか。差し戻されたら Step 1 に戻る。

- [ ] **Step 6: Commit**

```bash
git add assets/unit/roran/{down,up,left,right}_atk_hit.txt
git commit -m "fix: ロランの攻撃コマを振り下ろしにする"
```

---

### Task 5: 正典を合わせ、全体を検証する

**Files:**
- Modify: `types/unit/SPEC.md`
- Modify: `ISSUES.md`
- Modify: `README.md` / `CLAUDE.md`（Step 1 の grep で食い違いが出た場合だけ）

**Interfaces:**
- Consumes: Task 1〜4 の20コマ
- Produces: 正典が20コマの実物と一致した状態

- [ ] **Step 1: 派生と旧い記述が残っていないか探す**

```sh
grep -ln '^# from:' assets/unit/roran/*.txt
grep -n "mirror\|経過措置\|20コマ\|下げ" types/unit/SPEC.md README.md CLAUDE.md ISSUES.md
```

Expected: 1行目の `grep` は何も出さない（`right_*` がすべて本体になった）。2行目の出力のうち、ロランの `right_*` が
mirror 派生だという記述と、剣を下げているという記述を Step 2〜3 で直す

- [ ] **Step 2: `types/unit/SPEC.md` を書き換える**

1. 「立ち絵4方向の規約」の mirror の項目から、次の一文を消す:
   `経過措置として、ロランの \`right_*\` のうち \`base\` 以外の5枚は mirror 派生のまま残っている（\`ISSUES.md\`）`
2. 「立ち絵4方向の規約」の直後に次の節を足す:

   ```markdown
   ## アニメの規約

   決めた経緯は `docs/2026-09-26-unit-animation-frames-spec.md`。

   - 立ち絵の規約をすべてのコマに適用する。`right_*` も本体グリッドにする
   - **盾はどのコマでも `base` の位置から動かさない。** 動かすのは剣を持つ腕と脚だけ
   - `breathe`: 頭を1px下げて首を1行潰す。剣は拳ごと固定し、刃を縮めない
   - `walk`: 上半身と剣は `base` のまま、脚（y=28〜30）だけを動かす
   - **攻撃は振り下ろし。** `atk_wind` は拳を頭の高さまで上げて刃を真上に立てる。`atk_hit` は拳を体の前の
     胸〜腰に下ろし、刃を前下がりの斜めにする
   - **攻撃コマに限り、切っ先は頭頂（y=5）より上に出てよい**（y=0 まで）。構えの「頭頂より上に出さない」は立ち絵の規約
   ```

3. Task 1〜4 のゲートで依頼者の判断により変わった点があれば、この節に反映する（台帳の `Ruling:` 行を見る）

- [ ] **Step 3: `ISSUES.md` を更新する**

次の2行を消す（解消）:
- 「**ロランの右向き5コマが mirror 派生のまま**」
- 「**ロランの `base` 以外の20コマが新しい立ち絵と合っていない**」

作業中に見つけて直していないものがあれば、該当する節に足す。

- [ ] **Step 4: 全体を検証する**

```sh
.venv/bin/python -m unittest discover -s tests
.venv/bin/python tools/validate.py -q; echo "validate exit=$?"
.venv/bin/python tools/check_colors.py 2>&1 | tail -1
.venv/bin/python tools/render.py > /dev/null; echo "render exit=$?"
.venv/bin/python tools/sheet.py sheets/roran.txt
.venv/bin/python tools/contact_sheet.py
<確認コマンド> assets/unit/roran/*_{breathe,walk_a,walk_b,atk_wind,atk_hit}.txt
```

Expected:
- unittest: `Ran 116 tests ... OK`
- validate: `validate exit=0`
- check_colors: `95 grid(s): 1 failed, 0 with warnings`（失敗は既知の `knight` の1件だけ）
- render / sheet / contact_sheet: エラーなし。`sheet.py` の表で全コマの足元が30
- 確認コマンド: 20行とも `foot 30`、`from False`。`breathe` / `walk` は `center` 14.5〜16.5・`height 26`

- [ ] **Step 5: 差分を通して読み、Commit**

```sh
git diff --stat HEAD
git diff HEAD -- types/unit/SPEC.md ISSUES.md README.md CLAUDE.md
```

正典の文言が、仕様と Task 1〜4 の実物に一致しているかを読む。

```bash
git add types/unit/SPEC.md ISSUES.md README.md CLAUDE.md
git commit -m "docs: unit のアニメの規約を正典に反映し、20コマの課題を閉じる"
```

---

## 完了後

- 依頼者への報告に含めること: 各ゲートの差し戻し回数、Review Focus の5項目の確認結果、`up_atk_hit` の扱い
- `ISSUES.md` の素体の項目（頭身の調整の可能性）は残る。頭身を変えるときは24コマすべてが対象になる
