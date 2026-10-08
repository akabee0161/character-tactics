# 女性の敵（部品＋斧・槍）実装計画（2026-10-07・親計画 2026-10-06-enemy-variants.md の T6〜T8 の置き換え）

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 女性の素体に、男性の4体と同じ部品（頭・目・服）と斧・槍を重ねて、女性の敵の24コマとレシピを作り、依頼者に見せる。

**Architecture:** 男性の4体と同じ作り方にそろえる。`cand/gen/mkframes.py`（素体＋部品）と `cand/gen/mkweapons.py`（武器と拳のパッチ）に「素体の男女」を足し、女性用の体（拳を上げた体・腕のない体・歩きの脚）と服の部品を `cand/enemy/` に描き足す。武器のパッチは、武器を持つ手の男女の差だけずらしてから、コマごとに手で仕上げる。できたコマは `cand/enemy-frames/<id>/` に置き、レシピの `frames` で `enemy_build.py` が読む。

**Tech Stack:** Python 3.14（`.venv/bin/python`）、Pillow、標準の `unittest`。検査は `tools/validate.py` `tools/unit_check.py` `tools/weapon_check.py`。

**Spec:** `docs/superpowers/specs/2026-10-06-enemy-variants-design.md`。方針の変更は `docs/superpowers/plans/2026-10-06-enemy-parts.md`（部品で差し替え）と `docs/superpowers/plans/2026-10-07-enemy-weapons-followup.md`（斧・槍）。

## この計画を書いた理由（2026-10-07）

親計画の T6 は、ガウの頭巾・髪・短剣を女性の素体に重ねる手順だった。その後の決定（色替えだけだとガウに見えるので部品で差し替える、武器は斧と槍で短剣は使わない、ガウの色違いは不要）と食い違うので、依頼者に確認し「今の作り方で作る」と決まった（2026-10-07）。親計画の T6〜T8 はこの計画に置き換える。T9（ゲームへの書き出し）と段階2・3は、この計画の後に依頼者に決めてもらう。

## 調べて分かったこと（2026-10-07）

- 女性の素体 `types/unit/base/female_<dir>.txt` は、頭（y=5〜14）が男性と同じ画素。違うのは胴と脚（肩幅が狭い、胴が細い、脚が x=13〜18 で男性は x=12〜19）
- 武器を持つ手の位置は、男性から次だけずれる（素体の `base` で測った）: `down` +2px（男性 x=7〜9 → 女性 x=9〜11、y=18〜19）、`up` −2px（男性 x=21〜23 → 女性 x=19〜21）、`left` −1px（奥の手 男性 x=21 → 女性 x=20）、`right` +1px（男性 x=9〜12 → 女性 x=10〜13）。高さはどの向きも同じ
- 男性の4体は、`mkframes.py` が次を重ねて作っている: 素体（`base` と歩き）、ガウ用の「拳を上げた体」`assets/unit/gau/parts/body_idle2_<dir>.txt`（待機2コマ目）、「腕のない体」`assets/unit/gau/parts/body_noarm_<dir>.txt`（攻撃）、歩きの脚はガウの完成コマ `assets/unit/gau/<dir>_walk_{a,b}.txt` の y=28〜30。**女性用のこの3つは無い**
- 服の部品（`belt` `tatter`）は `cand/gen/mkparts.py` の関数で、男性の胴の幅に合わせて描かれている。頭（`head_*`）と目（`eye_*`）の部品は、頭が同じなので女性にもそのまま重なる
- `cand/gen/mkparts.py` は import するだけで `cand/enemy/*.txt` を書き出す（ISSUES.md、最終レビュー M-5）。女性の部品を手で直しても、`mkframes.py`・`mkweapons.py` を走らせるたびに男性の部品は作り直される。女性の部品を `mkparts.py` の外に置くか、先に M-5 を直す必要がある

## Global Constraints

- 男性の4体（`cand/enemy-frames/{axe-bandit,axe-horn,spear-knight,spear-thug}`）と短剣の4体のコマは変えない。生成スクリプトを変えたら、男性8体を作り直して `git diff --stat cand/enemy-frames` が空であることを確かめる
- 色は `palette/master.json` の既存色だけ。女性のコマも男性と同じ色名を使う（同じ `recolor` が効くように）: 肌 `skin_rose_*`、服 `cloak_dark_*`、ズボン `wood_shadow`、刃 `stone_hi/base`、柄 `wood_base/shadow`
- 足元は y=30、左右の中央は 15.5。シートは `sheets/gau.txt`（idle 2 / walk 4 / attack 3、12行）
- 武器を描くときの決まりは `types/unit/SPEC.md` の「武器を描くときの決まり」に従う（握る手は 3px×2px、right は武器を体の手前、振りかぶりは体と手の間に袖、槍は長さ25px で握りは穂先から12px）
- **絵を変えたら、見せて承認を得るまでコミット・次の段階へ進まない。** 見せ方は再生ページ（`tools/enemy_gallery.py`、速さ 1/2・1/4、1コマ送り）。Artifact が無いセッションでは、サーバー上の HTML のパスを渡す
- `tests/` から `assets/` や `cand/` の現役の絵を読まない
- 依頼者への返答は日本語。コミットは Conventional Commits ＋ 日本語。push と PR は依頼者の指示があったときだけ
- 作業ディレクトリは `pixel-asset-forge/`（コマンドはここからの相対）。台帳は `.superpowers/sdd/2026-10-06-enemy-variants/progress.md` に続けて書く

## Review Focus

1. **生成スクリプトを変えて、男性のコマが黙って変わる。** 男女の切り替えを足したら、男性8体を作り直して差が無いこと（T1・T3）
2. **女性の部品が `mkparts.py` の書き出しで上書きされる。** M-5 を直して、import しても書かないこと（T1）
3. **武器のずらしで、拳が体や頭に食い込む・袖が体から離れる。** `weapon_check.py` の `--arm` と、目での確認（T3）
4. **女性のコマの色名が男性と違い、`recolor` が効かない。** 女性の元のコマが使う色名が、対応する男性の元のコマの色名に含まれること（T3 の Step で測る）
5. **歩きの脚で足元・中心がずれる。** `unit_check.py` の脚の中心と、`sheet.py` のプレビューの足元ライン（T2）

---

## ファイル構成

| ファイル | 作る/変える | 役割 |
|---|---|---|
| `cand/gen/mkparts.py` | 変える | import しただけでは書き出さない（`main()` の下へ）。服の部品の関数に素体の男女を足す |
| `cand/gen/mkframes.py` | 変える | `ENEMIES` に素体の男女を足し、女性は女性の体・脚・服を重ねる |
| `cand/gen/mkweapons.py` | 変える | 女性の敵を足す。武器と拳のパッチを向きごとにずらし、コマごとの直しを重ねる |
| `cand/enemy/female_body_{idle2,noarm}_<dir>.txt` | 作る | 女性の「拳を上げた体」「腕のない体」（8枚、手で描く） |
| `cand/enemy/female_walk_{a,b}_<dir>.txt` | 作る | 女性の歩きの脚（y=28〜30 だけ描いた8枚） |
| `cand/enemy-frames/<id>/*.txt` | 作る | 女性の敵のコマ（1体24コマ） |
| `enemy/<id>.json` | 作る | 女性の敵のレシピ |
| `README.md` `types/unit/SPEC.md`（forge） | 変える | 女性の敵の作り方と `weapon_check` の指定 |

---

### Task 1: 生成スクリプトの下ごしらえ（男性のコマは変えない）

**Files:**
- Modify: `cand/gen/mkparts.py`、`cand/gen/mkframes.py`
- Modify: `ISSUES.md`（M-5 の行を消す）

**Interfaces:**
- Produces: `mkparts.main()`（部品を書き出す。import では書かない）、`mkframes.ENEMIES[id] = (名前, 目, 頭, 服, 武器, 素体)`（素体は `"male"` か `"female"`。既存の項目は `"male"`）、`mkframes.body(kind, d, sex="male")`

- [ ] **Step 1: 今のコマを控える**

```bash
.venv/bin/python cand/gen/mkweapons.py && git diff --stat cand/enemy-frames cand/enemy
```
Expected: 差なし（今のスクリプトで今のコマが出ること。`mkframes.py` の短剣の4体は `/tmp/cand2` に頼るので走らせない）

- [ ] **Step 2: `mkparts.py` の最上位の書き出しを `main()` に移す**

`OUT.mkdir(...)` と、ファイル末尾の `emit(...)` の呼び出しをすべて `def main():` の中へ移し、末尾に

```python
if __name__ == "__main__":
    main()
```

を足す。関数（`belt` `tatter` など）は最上位のまま。

- [ ] **Step 3: `mkframes.py` に素体の男女を足す**

`ENEMIES` の値を `(名前, 目, 頭, 服, 武器, 素体)` の6つにする（既存4体は `"dagger", "male"`）。`mkweapons.py` の差し替え（25行目付近）も `(*mf.ENEMIES[_old][:4], _weapon, "male")` にする。`RAW` を男女で引けるようにする:

```python
RAW = {
    "male": {"base": "types/unit/base/male_{d}.txt",
             "idle2": "assets/unit/gau/parts/body_idle2_{d}.txt",
             "noarm": "assets/unit/gau/parts/body_noarm_{d}.txt"},
    "female": {"base": "types/unit/base/female_{d}.txt",
               "idle2": "cand/enemy/female_body_idle2_{d}.txt",
               "noarm": "cand/enemy/female_body_noarm_{d}.txt"},
}


def body(kind, d, sex="male"):
    f = eb.read_frame(Path(RAW[sex][kind].format(d=d)))
    ...（以下は今のまま）
```

`frame()` は `ENEMIES[eid][5]` を素体として `body(kind, d, sex)` に渡す。歩きの脚は、男性は今のまま（ガウの完成コマの y=28〜30）、女性は `cand/enemy/female_walk_{a,b}_{d}.txt` の y=28〜30。

- [ ] **Step 4: 男性のコマが変わらないことを確かめる**

```bash
.venv/bin/python -c "import sys; sys.path[:0]=['tools','cand/gen']; import mkparts" && git status --short cand/enemy
.venv/bin/python cand/gen/mkweapons.py && git diff --stat cand/enemy-frames
```
Expected: 1行目は何も書かず `git status` も空（import で書かない）。2行目の差も空

- [ ] **Step 5: ISSUES.md の M-5 の行（`cand/gen/mkparts.py` が import するだけでファイルを書く）を消してコミット**

```bash
git add cand/gen/mkparts.py cand/gen/mkframes.py cand/gen/mkweapons.py ISSUES.md
git commit -m "refactor: 敵の生成スクリプトに素体の男女を足し、mkparts を import で書き出さないようにする"
```

---

### Task 2: 女性の体と服（確認ポイント F1）

**Files:**
- Create: `cand/enemy/female_body_idle2_<dir>.txt`、`cand/enemy/female_body_noarm_<dir>.txt`、`cand/enemy/female_walk_{a,b}_<dir>.txt`（計16枚）
- Modify: `cand/gen/mkparts.py`（`belt(d, sex="male")`、`tatter(d, sex="male")`）
- Create: `cand/enemy/PICKER_female.json`

**Interfaces:**
- Consumes: T1 の `mkframes.body(kind, d, sex)`
- Produces: 女性の体8枚・脚8枚、女性の胴に合う `belt`・`tatter`

- [ ] **Step 1: 男性で、ガウの体の部品が素体から何を変えたかを測る**

```bash
for d in down up left right; do for k in idle2 noarm; do echo "== $k $d"; diff <(grep -v '^#' types/unit/base/male_$d.txt) <(grep -v '^#' assets/unit/gau/parts/body_${k}_$d.txt); done; done
```
（`# map:` の文字が違うときは、`tools/enemy_build.py` の `read_frame` で色名にしてから比べる。）この差（拳を2px上げる・武器の腕を消す）を、女性の素体の同じ腕に当てはめる。

- [ ] **Step 2: 女性の「拳を上げた体」「腕のない体」を描く**

`types/unit/base/female_<dir>.txt` を写し、Step 1 で測った変化を、女性の武器を持つ手（down x=9〜11、up x=19〜21、left x=20、right x=10〜13。高さは男性と同じ）に当てはめて描く。色名は素体のまま（`cloth_*` `skin_*`。`mkframes.body` が `cloak_dark_*` `skin_rose_*` に替える）。

- [ ] **Step 3: 女性の歩きの脚を描く**

ガウの `assets/unit/gau/<dir>_walk_{a,b}.txt` の y=28〜30 の脚の振り（どちらの足が前か）を、女性の脚の幅（x=13〜18）に合わせて描く。y=0〜27 は空のままでよい（`mkframes` が y=28〜30 だけを使う）。

- [ ] **Step 4: 服の部品を女性の胴に合わせる**

`mkparts.belt(d, sex)`・`mkparts.tatter(d, sex)` に女性の形を足す。ベルトの行（男性と同じ高さ）を女性の胴の幅に縮め、ぼろ布の裾の切れ込みも同じ幅に合わせる。

- [ ] **Step 5: 検査する**

```bash
.venv/bin/python tools/validate.py cand/enemy
```
Expected: 異常なし

- [ ] **Step 6: 選ぶページを作る**

`cand/enemy/PICKER.json`（男性の CP-A のページ）を写して `PICKER_female.json` にし、素体を女性の `base` にする。頭4・目6・服3を選べるようにする。

```bash
.venv/bin/python tools/unit_picker.py cand/enemy/PICKER_female.json --out build/picker/enemy-parts-female.html
```

- [ ] **Step 7: ここで止まる（確認ポイント F1）**

依頼者に見せるもの: 女性の素体に頭・目・服を重ねた選ぶページ（男性の承認済み4体を比較に添える）と、女性の体（拳を上げた体・腕のない体・歩きの脚）を並べた画像。決めてもらうこと（1つずつ聞く）:
1. 女性の敵を何体作るか、どの頭・目・服の組み合わせにするか
2. それぞれの武器（斧か槍）
3. 女性らしさのために髪（長い髪など）の頭の部品が要るか。要るなら、頭の部品を先に描いて見せる（部品は完全な単品で見せる。`types/unit/SPEC.md` の描く手順 CP1）

承認をもらうまで T3 に進まない。承認後にコミットする:

```bash
git add cand/enemy/ cand/gen/mkparts.py
git commit -m "feat: 女性の敵の体・歩きの脚・服の部品を作る"
```

**F1 の結果（2026-10-08 追記）:** 1 は男性と同じ4体の見た目、2 は武器も男性と同じ（バンダナ・角付きの兜＝斧、フルフェイス・ごろつき＝槍）、3 は長い髪を採用（フルフェイスは、できれば違いを出す）。
最初に作った長い髪の2案（L1 肩まで・L2 ポニーテール、頭の部品の下にのぞく所だけを描いたもの）は、依頼者が「全部だめ」と判断した。
依頼者の指示で、被り物のない長い髪の基本パーツを先に作り、そのあとで被り物と組み合わせる（Task 2b）。T2 のコミットは Task 2b の F1c の承認と一緒にする。

---

### Task 2b: 長い髪の基本パーツと、被り物との組み合わせ（確認ポイント F1b・F1c）

依頼者「まず被り物のない状態で長い髪の基本パーツを作り、その後、それと被り物を組み合わせるほうが良さそう」（2026-10-08）。
物の形を先に合わせてから組み合わせる（`types/unit/SPEC.md` の描く手順 CP1「形の確認には、体に隠れる部分も含めた完全な単品を見せる」）。

**Files:**
- Modify: `cand/gen/mkparts.py`（長い髪の基本パーツ。最初の2案 `long_hair`・`pony_tail` は置き換える）
- Modify: `cand/gen/mkframes.py`（被り物と組み合わせるときの重ね方）
- Create: `cand/enemy/hair_<名前>_<dir>.txt`

- [ ] **Step 1: 被り物のない長い髪の基本パーツを、完全な単品で描く**

頭頂から毛先まで、髪全体を1つの部品として4方向で描く（短い髪 `head_bare` の上に足すのではなく、頭の部品として単独で成り立つ形）。
女性の素体の頭（男性と同じ画素。顔は x=10〜21・y=5〜14）にかぶせる。案は2〜3通り（長さ・毛先・前髪の違い）。
`right` は `left` の反転でよい（髪は左右の装備の手前・奥が無いので）。

- [ ] **Step 2: 検査して見せる（確認ポイント F1b）**

```bash
.venv/bin/python tools/validate.py cand/enemy
```

見せるもの: 髪の部品だけの4方向と、女性の素体（服なし・目は E0）にかぶせた4方向を案ごとに並べたページ。比較に、素の髪のごろつき（短い髪）の女性を添える。
決めてもらうこと: 長い髪の形（案の選択と直し）。承認まで Step 3 に進まない。

- [ ] **Step 3: 被り物と組み合わせる**

承認された長い髪を、バンダナ・角付きの兜・フルフェイスと組み合わせる。被り物が頭を覆う所は髪を隠し、被り物の縁の下から出る髪（横の髪・後ろ髪・毛先）だけを見せる。
組み合わせ方（髪の上に被り物を重ねるだけで足りるか、被り物ごとに髪の出し方を描き分けるか）は、Step 2 で承認された形を重ねてみて決める。描き分けが要るなら、被り物ごとの髪の部品 `hair_<名前>_<被り物>_<dir>.txt` を作る。

- [ ] **Step 4: 検査して見せる（確認ポイント F1c）**

```bash
.venv/bin/python tools/validate.py cand/enemy
.venv/bin/python cand/gen/mkweapons.py && git diff --stat cand/enemy-frames
```
Expected: 異常なし。男性8体の差なし。

見せるもの: 4体（バンダナ・角付きの兜・フルフェイス・長い髪のまま＝素の髪のごろつきの置き換え）の女性に、長い髪を組み合わせた立ちの4方向と、女性の体（待機2・歩き・腕のない体）。
決めてもらうこと: 4体それぞれの髪（フルフェイスで違いが出せないなら、髪なしでもよいか）と、女性の体の形。承認後に T2 と一緒にコミットする:

```bash
git add cand/enemy/ cand/gen/mkparts.py cand/gen/mkframes.py
git commit -m "feat: 女性の敵の体・歩きの脚・服・長い髪の部品を作る"
```

---

### Task 3: 女性の敵のコマ（確認ポイント F2）

**Files:**
- Modify: `cand/gen/mkframes.py`（F1 で決めた女性の敵を `ENEMIES` に足す）、`cand/gen/mkweapons.py`
- Create: `cand/enemy-frames/<id>/*.txt`（1体24コマ）

**Interfaces:**
- Consumes: T1 の `ENEMIES` の6つ組、T2 の女性の体・脚・服
- Produces: 女性の敵ごとの24コマ。id は `<武器>-<男性の同じ見た目の名前>-f`（例: 眼帯のバンダナで斧なら `axe-bandit-f`）。男性に無い組み合わせなら `<武器>-<頭>-<目>-f`（例: `spear-bare-e4-f`）

- [ ] **Step 1: 武器のパッチを男女の差だけずらす**

`mkweapons.py` に

```python
FEMALE_SHIFT = {"down": 2, "up": -2, "left": -1, "right": 1}  # 武器を持つ手の x の男女の差（素体の base で測った）
```

を足し、`build_frame` で素体が `"female"` のとき、その向きの武器と拳のパッチを `shift(patch, FEMALE_SHIFT[d])` してから重ねる。袖のパッチ（`ARM_L` `ARM_U` など、体とつなぐもの）もずらす。

- [ ] **Step 2: 女性の敵を作り、男性が変わらないことを確かめる**

```bash
.venv/bin/python cand/gen/mkweapons.py && git diff --stat cand/enemy-frames
```
Expected: 男性8体の差は無く、女性の敵のディレクトリだけが新しく増える

- [ ] **Step 3: 検査し、落ちたコマを直す**

```bash
.venv/bin/python tools/validate.py cand/enemy-frames
C="--blade stone_hi,stone_base --weapon wood_base,wood_shadow --hand skin_rose_hi,skin_rose_base,skin_rose_shadow --arm cloak_dark_hi,cloak_dark_base,cloak_dark_shadow"
# 斧の女性の敵ごとに
.venv/bin/python tools/weapon_check.py cand/enemy-frames/<id> $C --hidden up_atk_wind,up_atk_hit --depth down,up \
    --partial left_base,left_idle2,left_walk_a,left_walk_b,left_atk_wind
# 槍の女性の敵ごとに
.venv/bin/python tools/weapon_check.py cand/enemy-frames/<id> $C --hidden left_atk_hit
.venv/bin/python tools/unit_check.py cand/enemy-frames/<id> --items <その敵の持ち物の文字>
```
Expected: `validate` 異常なし、`weapon_check` は「武器と手: ok」、`unit_check` は脚の中心がそろう。ずらしだけで合わないコマ（拳が体に食い込む、袖が体から離れる、細い胴で武器が体に隠れすぎる）は、`mkweapons.py` に女性用のパッチを足して直す（コマのファイルを手で直さない。作り直すと消えるため）。`--items` の文字は、そのコマの `# map:` で武器と拳の色に当たる文字を見て決める（男性の4体と同じ測り方。`types/unit/SPEC.md` の自己チェック①）

- [ ] **Step 4: 色名がそろっているかを測る**

```bash
.venv/bin/python -c "
import sys; sys.path.insert(0,'tools')
from pathlib import Path
from enemy_build import read_frame
def used(d): return {c for p in Path(d).glob('*.txt') for r in read_frame(p) for c in r if c}
print(sorted(used('cand/enemy-frames/<女性の id>') - used('cand/enemy-frames/<対応する男性の id>')))"
```
Expected: `[]`（女性だけの色名が無い。あれば男性と同じ色名に直す）

- [ ] **Step 5: 再生ページで男女を並べる**

T4 のレシピの前なので、確認用のシートは `/tmp` の一時スクリプトで作る（`enemy_build.build(Recipe(...), Path("cand/enemy-frames/<id>"), Path("sheets/gau.txt"), palette, build_root=Path("/tmp/wk/female/enemy"), sheet_dir=Path("/tmp/wk/female/sheets"))`）。`render_gallery` に、対応する男性・女性の順で並べて `build/enemy_female_gallery.html` に書く。

- [ ] **Step 6: ここで止まる（確認ポイント F2）**

依頼者に見せるもの: 再生ページ（男女を並べる。速さ 1/2・1/4、1コマ送り）。承認をもらうまでコミット・T4 へ進まない。直しが出たら `mkweapons.py`（またはT2の体）を直して Step 2 からやり直す。承認後:

```bash
git add cand/gen/ cand/enemy-frames/
git commit -m "feat: 女性の敵のコマを作る（部品＋斧・槍）"
```

---

### Task 4: 女性の敵のレシピと正典

**Files:**
- Create: `enemy/<id>.json`（女性の敵ごと）
- Modify: `README.md`（2.11 敵のバリエーション）、`types/unit/SPEC.md`（自己チェック①の指定）

**Interfaces:**
- Consumes: T3 の `cand/enemy-frames/<id>/`、`tools/enemy_build.py` の `frames` キー

- [ ] **Step 1: レシピを書く**

```json
{
  "id": "axe-bandit-f",
  "name": "眼帯のバンダナ（斧・女）",
  "archetype": "axe",
  "body": "female",
  "frames": "cand/enemy-frames/axe-bandit-f",
  "recolor": {
    "cloak_dark_hi": "dirt_hi",
    "cloak_dark_base": "dirt_base",
    "cloak_dark_shadow": "dirt_shadow"
  }
}
```

（例。`recolor` は対応する男性のレシピ（`enemy/axe-bandit.json` など）と同じ。男性に無い組み合わせは F1 で依頼者と色を決める。）

- [ ] **Step 2: 作って確かめる**

```bash
.venv/bin/python tools/enemy_build.py --all
.venv/bin/python -m unittest discover -s tests
.venv/bin/python tools/enemy_gallery.py build/enemy_gallery.html --ref build/sheets/gau.png:ガウ（味方）
```
Expected: 全レシピ `ok`、テスト `OK`、ページに女性の敵が並ぶ（絵は F2 で承認済みなので、ここでは色が付いていることだけを目で確かめる）

- [ ] **Step 3: 正典を直す**

- `README.md` の 2.11: 「今の8体」を今の体数にし、女性の敵の元のコマも `cand/enemy-frames/<id>`（生成は `cand/gen/mkweapons.py`、素体は `mkframes.ENEMIES` の6つ目）と書く
- `types/unit/SPEC.md` の自己チェック①: 女性の敵の `weapon_check` の指定が男性と同じならその旨を1行、違えば指定を書く

- [ ] **Step 4: コミット**

```bash
git add enemy/ README.md types/unit/SPEC.md
git commit -m "feat: 女性の敵のレシピを足す"
```

- [ ] **Step 5: ここで止まる（親計画の段階1の確認）**

依頼者に決めてもらうこと（1つずつ聞く）:
1. T9（ゲームへの書き出し）に進むか。ガウ・ロランの手の修正もこのときに書き出す（2026-10-07 依頼者「一連の修正が全て終わってから」）。正典のレシピが `cand/` を指している件（最終レビューの未決）も、書き出しの前に決める
2. 段階2（剣盾）・段階3（弓）をどうするか

## 自己レビュー（2026-10-07）

- 仕様の「男女の素体で敵を作る」は T2〜T4 で満たす。「色替えはレシピで」は T4。武器は斧・槍（依頼者の決定）で、仕様の短剣からは変えている
- 依頼者が決めることは F1（組み合わせ・武器・髪の部品）と段階1の確認に集め、それまで作らない
- 男性のコマを変えないことを、T1・T3 で `git diff --stat` で確かめる
