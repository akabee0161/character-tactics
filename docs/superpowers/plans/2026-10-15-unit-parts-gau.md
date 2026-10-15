# ガウを「体＋拳」の部品から組み直す Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ガウの4方向×6状態（描く絵は 4×4 = 16 枚、歩き2枚は立ちの部品を使い回す）を、完全な単品の部品（芯・短剣・短剣の拳・空き手の拳）から `tools/compose.py` で組み直し、攻撃のコマの腕と袖を消して拳だけを残す。

**Architecture:** イネス（計画 B）で作った共通の道具 `tools/parts_export.py`（文字で切る）をそのまま使い、ガウの定義を `gen/gau/gau_layers.py` に置く。ガウは同じ色に別の文字がある（`f`・`p` が `cloak_dark_hi`、`s`・`v` が `stone_hi`、`n`・`y` が `wood_shadow`）ので、文字で切る道具が要る。書き出した部品で今の絵と同じに組めることを確かめ、重なり順の表を依頼者に承認してもらってから、向きごとに部品を完全に描き、承認を得てコマを組み直す。道具の新しいコードは書かない。

**Tech Stack:** Python 3.14（`pixel-asset-forge/.venv`）、Pillow、unittest。

**Spec:** `docs/superpowers/plans/2026-10-10-unit-parts-roran.md`（計画 A の「決めたこと」と全体の順。この計画は C）、`docs/superpowers/plans/2026-10-12-unit-parts-ines.md`（計画 B。手順の手本）、`pixel-asset-forge/types/unit/SPEC.md`（「立ち絵4方向の規約」の 体＋拳、「部品で組む規約」、「短剣の持ち方」）。

## 今のガウの絵で分かったこと（2026-10-15 に数えた）

- **立ち・待機・歩きには腕が無い。** 素体 `male_<向き>` の時点で袖は無く、拳が胴の輪郭に直に付いている。`down` の画面右の肩から下りる帯（x=19〜23、y=13〜19、`e` `f` `g` の色）は頭巾の垂れで、腕ではない（`assets/part/head/hood/hood_down.txt` に入っている）。`up`・`left`・`right` の同じ色の帯も頭巾。**頭巾の垂れは消さない**
- **腕が残っているのは攻撃のコマだけ。** `up_atk_wind` の脇の袖、`up_atk_hit` の脇からのぞく右の肘、`left_atk_hit`・`right_atk_hit` の前へ伸ばした袖（`q`・`p`）
- 歩きの2コマは脚だけが立ちと違う（短剣・拳は同じ）→ `shares` で立ちの部品を使い回せる
- 拳の位置（`tools/hand_mirror.py` の決まり）: `down` と `up` は今も左右反転で合っている。`left` と `right` は合っていない（短剣の拳が `left` は 2×2 で x=21〜22、`right` は 3×2 で x=10〜12。反転すると x=19〜21）

## 決めること（この計画の承認で依頼者と合意する）

- ガウもイネスと同じく、攻撃の腕・袖を消して拳を体から浮かせる（体＋拳の方針どおり）。立ちの拳も四方を輪郭で閉じ、胴の輪郭を拳の所でも閉じる
- **違和感が強すぎれば方針を変えることがある。** 最初の向き（down）の承認で「この見え方で残り3方向も進めてよいか」を必ず聞く（イネスと同じ）
- `left`・`right` の拳の大きさと位置の合わせ方は、`left`（Task 4）を描くときに案を見せて依頼者が決める

## Global Constraints

- コマンドは `pixel-asset-forge/` で実行する。Python は `.venv/bin/python`。テストは `.venv/bin/python -m unittest discover -s tests`
- ガウの手の肌は `skin_rose_hi,skin_rose_base,skin_rose_shadow`（文字 `a` `b` `c`）。顔・首も同じ色なので、拳は箱で切る（`down` の首 x=15〜16、y=15 を拳に入れない）
- ガウの専用の文字: 刃 `s` `t`、鍔と柄頭 `l` `m` `n`（SPEC「短剣の持ち方」）。服は `p` `q` `r`、頭巾は `e` `f` `g` `h`、襟 `v`、ズボン `y`
- **ガウのコマ（`assets/unit/gau/*.txt`）は、その向きの部品の確認ページを依頼者が承認するまで書き換えない**。承認は重なり順の表（1回）と向きごと（down・up・left・right の4回）
- **ガウの古い部品は消さない・書き換えない。** `assets/part/body/gau/{body_idle2,body_noarm,gau_body}_*`・`assets/part/head/hood/`・`assets/part/hair/gau/`・`assets/part/equip/dagger/dagger_<向き>.txt` は敵（`gen/enemy/`）が使っている。新しい部品は別の名前（`core_*`・`dagger_<向き>_<状態>`・`fist/gau/`）で書く
- `compose/gau.json` は書き出しで上書きする（今のファイルは組み立ての出発点の記録で、今の絵を再現しない。README に書いてある）
- ガウ以外の絵（`assets/unit/roran`・`ines`、敵）は作り直さない
- ゲームへの書き出し（`tools/export.py`、character-tactics の `assets/images/gau-map.png`）はしない（E 以降で全ユニットまとめて行う）
- 絵を見せるときは、印（赤枠）を付けた絵と印なしの絵を並べる。HTML ページで渡す。動きは再生できるページで見せる
- 回帰テストに `assets/` の生きている絵を読ませない（`pixel-asset-forge/CLAUDE.md`）
- push と PR は依頼者の指示があったときだけ
- コミットは Conventional Commits ＋ 日本語の要約。`git add` はファイルを指定する
- 進捗台帳は `.superpowers/sdd/2026-10-15-unit-parts-gau/progress.md`。依頼者の判断と計画からの変更は `Ruling:` 行で書く

## Review Focus

- 拳の `keep`（短剣の色）に `stone_hi`・`wood_shadow` が入るので、拳の輪郭の下にある襟 `v`（`stone_hi`）・ズボン `y`（`wood_shadow`）まで見せてしまう → Task 1 Step 3 で、組んだ24コマが今の絵と画素まで同じことを確かめる。描き直した後は Task 2〜5 の Step 2 で「今の絵と違う画素」に拳の下の輪郭が出ていないかを見る
- 拳の箱に首・顔の肌が入る（`down` の首は y=15、拳の箱は y=16 から）→ Task 1 Step 4
- 新しい部品の名前が、敵が使う古い部品（`dagger_<向き>.txt`）と重なる → `parts_export.py` の「他の設定が使っている部品は書かない」検査で止まる。止まったら名前を変える（古い部品を上書きしない）
- 体に隠れて見えない拳（`right` の空き手、`up_atk_hit` の短剣の拳、`left_atk_wind` の短剣）を空のままにする → Task 2〜5 の Step 1 で、隠れる位置に描く（「両手の拳の層を必ず持つ」）

---

### Task 1: ガウの部品を書き出し、重なり順の表を承認してもらう

**Files:**
- Create: `pixel-asset-forge/gen/gau/gau_layers.py`
- Create: `pixel-asset-forge/assets/part/body/gau/core_*.txt`（24）、`assets/part/equip/dagger/dagger_<向き>_<状態>.txt`、`assets/part/fist/gau/*.txt`
- Modify: `pixel-asset-forge/compose/gau.json`（書き出しで上書き）

**Interfaces:**
- Consumes: `tools/parts_export.py` の `NONE`・`PartDef`（`dir` は `assets/part/` からの相対）・`UnitDef`・`export(unit, part_root, config_path, root)`、`tools/cut_layers.py` の `CORE`、`tools/compose_page.py`（`compose/<ユニット>.json OUT.html [--dirs ...]`）

部品:

| 部品 | ファイル | 文字 | 箱 |
|---|---|---|---|
| 芯（体・頭・頭巾・脚・攻撃の腕と袖） | `body/gau/core_<向き>_<状態>.txt` | 残り | |
| 短剣（刃・鍔・柄頭） | `equip/dagger/dagger_<向き>_<状態>.txt` | `s` `t` `l` `m` `n` | 枠全体 |
| 短剣の拳（右手） | `fist/gau/dagger_hand_<向き>_<状態>.txt`、`hand`、`keep`: `stone_hi,stone_base,wood_hi,wood_base,wood_shadow` | `a` `b` `c` | 下の表 |
| 空き手の拳（左手） | `fist/gau/free_hand_<向き>_<状態>.txt`、`hand`、`keep`: 同じ | `a` `b` `c` | 下の表 |

拳の箱（x0, y0, x1, y1。今の絵の y≥15 の肌の塊を 2026-10-15 に数えたもの。歩きは立ちを使い回す）:

| 向き | 状態 | 短剣の拳 | 空き手の拳 |
|---|---|---|---|
| down | base / idle2 / atk_wind / atk_hit | (8,18,10,19) / (8,16,10,17) / (8,18,9,19) / (8,18,10,19) | すべて (21,20,22,21) |
| up | base / idle2 / atk_wind / atk_hit | (21,18,23,19) / (21,16,23,17) / (21,17,23,18) / NONE（体に隠れる） | すべて (9,20,10,21) |
| left | base / idle2 / atk_wind / atk_hit | (21,18,22,19) / (21,16,22,17) / (21,16,21,17) / (8,17,9,18) | すべて (11,20,12,21) |
| right | base / idle2 / atk_wind / atk_hit | (10,18,12,19) / (10,16,12,17) / (10,17,12,18) / (21,17,22,18) | すべて NONE（奥の手が体に隠れる） |

短剣が見えないコマ: `up_atk_wind`・`up_atk_hit`・`left_atk_wind`（短剣の部品は空になる）。

重なり順の初めの案（奥→手前。SPEC から: 拳は握る物より手前、奥の手は体より奥。`down` は両手が手前、`up` は両手が奥、`left` は短剣の手が奥、`right` は空き手が奥）:

```python
ORDERS = {
    "down": (CORE, "短剣", "短剣の拳", "空き手の拳"),
    "up": ("短剣", "短剣の拳", "空き手の拳", CORE),
    "left": ("短剣", "短剣の拳", CORE, "空き手の拳"),
    "right": ("空き手の拳", CORE, "短剣", "短剣の拳"),
}
```

- [ ] **Step 1: 定義を書く**

`gen/gau/gau_layers.py` を `gen/ines/ines_layers.py` と同じ形で書く: 上の表どおりの `UnitDef`（`unit="gau"`、`src=Path("assets/unit/gau")`、`dirs=("down","up","left","right")`、`states=("base","idle2","walk_a","walk_b","atk_wind","atk_hit")`、`shares={"walk_a":"base","walk_b":"base"}`、`hand_colours=("skin_rose_hi","skin_rose_base","skin_rose_shadow")`、短剣は `dir="equip/dagger"`、拳は `dir="fist/gau"`）と、`--export` で `export(GAU, Path("assets/part"), Path("compose/gau.json"), Path("."))` を呼ぶ `main`。docstring に「ガウの今のコマを部品に書き出す（2026-10-15。描き直す前に一度だけ使う）」と、拳の箱を数えた日を書く。

- [ ] **Step 2: 書き出して、構造を検査する**

Run: `.venv/bin/python gen/gau/gau_layers.py --export && .venv/bin/python tools/validate.py assets/part/body/gau assets/part/fist/gau assets/part/equip/dagger`
Expected: 書き出した（芯 24・部品 3×4×4 = 48、計 72 ファイル）。validate が ok。`parts_export.py` が「他の設定が使っている」で止まったら、Review Focus のとおり名前を変える

- [ ] **Step 3: 今の絵と同じに組めることを確かめる**

Run: `.venv/bin/python tools/compose_page.py compose/gau.json build/gau_parts.html`
Expected: 24コマすべて「今の絵と違う画素 0」。閉じていない拳の一覧が出る（Task 2〜5 で描き足す所）

差が出たら、重なり順の案が今の絵と合っていない。差の出た画素で重なっている2つの部品の順を入れ替え、差が 0 になる順を探す。どの順でも 0 にならないときは、その画素を台帳に `Finding:` で書き、Step 5 で依頼者に見せる。順を変えたら台帳に `Ruling:` で書く。

- [ ] **Step 4: 拳の部品に拳以外が入っていないことを確かめる**

Run: `grep -c "[abc]" assets/part/fist/gau/*.txt | grep -v ":0$"` と、ページの拳の部品の絵
Expected: 拳の部品に顔・首の肌が入っていない（入っていたら箱を直して Step 2 から）。`up_atk_hit` の短剣の拳と、`right` の空き手の拳は空

- [ ] **Step 5: 依頼者に重なり順の表を見せて止まる**

`build/gau_parts.html`（4方向の全コマ。各行が部品を奥→手前に並べた絵＋組んだ絵＋今の絵）を渡し、向きごとの重なり順（奥→手前）を文で添える。**承認まで Task 2 へ進まない。** 指摘で順を変えたら `ORDERS` を直して Step 2 から。

- [ ] **Step 6: Commit**

```bash
cd /home/ubuntu/workspace/character-tactics
git add pixel-asset-forge/gen/gau/gau_layers.py pixel-asset-forge/assets/part/body/gau/core_*.txt pixel-asset-forge/assets/part/equip/dagger/dagger_*_*.txt pixel-asset-forge/assets/part/fist/gau pixel-asset-forge/compose/gau.json
git status --short
git commit -m "feat: ガウの24コマを部品のファイルに書き出す（描き足す前。組むと今の絵と同じ）"
```

---

### Task 2〜5: 部品を完全に描く（down → up → left → right、向きごとに承認）

向きごとに同じ手順を繰り返す（Task 2 = down、Task 3 = up、Task 4 = left、Task 5 = right）。

**Files:**
- Modify: `pixel-asset-forge/assets/part/body/gau/core_<向き>_*.txt`、`assets/part/equip/dagger/dagger_<向き>_*.txt`、`assets/part/fist/gau/*_<向き>_*.txt`
- Modify（承認後）: `pixel-asset-forge/assets/unit/gau/<向き>_*.txt`（6コマ）

その向きで描くもの（部品を単品で見て完全な形にする。「部品で組む規約」）:
- **芯:** 拳に隠れていた胴の輪郭と服を描き、胴の輪郭を閉じる。攻撃のコマは腕と袖（肩から先の `p` `q` `r` と輪郭）を消し、胴の外なら透明にして胴の輪郭を閉じる。袖の名残（1px の袖口）も残さない。頭巾の垂れは消さない
- **拳:** 四方とも輪郭で閉じる（`.venv/bin/python tools/hand_outline.py <拳の部品> --hand skin_rose_hi,skin_rose_base,skin_rose_shadow --write` で閉じ、形を目で直す）。隠れる拳は隠す物（体）の領域の内側に置く（境界にぴったり接しない）。空の拳（`up_atk_hit` の短剣の拳、`right` の空き手の拳）は体に完全に隠れる位置に描く
- **拳の位置:** 攻撃以外は `.venv/bin/python tools/hand_mirror.py compose/gau.json` で、down と up、left と right の組を左右反転で合わせる。横向きは奥行きの動きを画素に出さない（上下だけ動かす）
- **短剣:** 拳に隠れていた柄を描き、単品として全周を輪郭で閉じる。体に隠れるコマ（`up_atk_wind`・`up_atk_hit`・`left_atk_wind`）は、隠れる位置に描くか空のままにするかを、その向きの承認で依頼者に聞く
- 向きごとの注意:
  - down: 構え（`atk_wind`）は奥の小さな拳（2×2）、突き（`atk_hit`）は手前の大きな拳（3×2）で奥行きを表している（SPEC「短剣の持ち方」）。拳の上端と左端はそろえたまま。腕が元から無いので、見た目の変化は拳が胴から離れて閉じる所だけのはず
  - up: 構えの脇の袖と、突きの脇からのぞく右の肘を消す。突きは短剣も拳も体の向こうで見えなくなる（何も見えないコマになる）
  - left: 突きの前へ伸ばした袖（x=10〜11、y=16〜19 の `q` と輪郭）を消すと、拳と刃が顔の前に浮く。**短剣の拳の大きさと位置を right と合わせる案を、描く前に依頼者に見せて決めてもらう**（今は left 2×2・x=21〜22、right 3×2・x=10〜12）
  - right: 突きの前へ伸ばした袖（x=13〜19、y=16〜19 の `p` と輪郭）を消すと、拳と刃が体の右に浮く。空き手の拳は left の位置の反転（x=19〜20、y=20〜21 の付近）で体の内側に描く

- [ ] **Step 1: 描く**

部品のファイルを直接直す。直したら `.venv/bin/python tools/validate.py assets/part/body/gau assets/part/fist/gau assets/part/equip/dagger` と `.venv/bin/python tools/body_check.py assets/part/body/gau` を通す（body_check の報告は1件ずつ目で確かめ、腕を消した結果として正しいものは台帳に書く）。

- [ ] **Step 2: 確かめる**

Run: `.venv/bin/python tools/compose_page.py compose/gau.json build/gau_parts.html --dirs <向き>` と `.venv/bin/python tools/hand_mirror.py compose/gau.json`
Expected: その向きの拳がすべて閉じている。「今の絵と違う画素」は、腕・袖を消した所、拳と胴の輪郭が見えるようになった所、隠れていた所を描いた所だけ（それ以外の差は描き間違い。直してから進む）。hand_mirror は、描き終えた組（up の後は down・up、right の後は全部）で ok

組んだコマで動きのページを作る（コマはまだ書き換えないので、一時フォルダに組む）:

```bash
rm -rf build/gau_cand && cp -r assets/unit/gau build/gau_cand
.venv/bin/python tools/compose.py compose/gau.json --out build/gau_cand
```

`build/gau_cand` の6コマ（この向き）と、今の絵の残りの向きでシートを作り、動きを再生するページにする（イネスの計画 B の Task 3〜6 Step 2 と同じやり方。一時のシート・JSON はコミットしない、見せた後に消す）。今のガウのページも並べる。

- [ ] **Step 3: 依頼者に見せて止まる**

部品のページ（印あり・印なし）と動きのページ（今の絵と並べる）を渡し、変わった所（袖を消した所、拳の位置、隠れていた所）を文で添える。**承認まで次へ進まない。** 指摘があれば台帳に書き、Step 1 へ戻る。

**down（Task 2）のときだけ、「この見え方で、残りの3方向も進めてよいか」を1つの質問として聞く。** 方針を変えると言われたら、Task 3 以降へ進まず、台帳に `Ruling:` を書いて止まる（計画を書き直す）。

- [ ] **Step 4: 承認後、コマを組み直す**

Run: `.venv/bin/python tools/compose.py compose/gau.json --frames <向き>_base <向き>_idle2 <向き>_walk_a <向き>_walk_b <向き>_atk_wind <向き>_atk_hit --force`
Run: `.venv/bin/python tools/compose.py compose/gau.json --frames <同じ6コマ> --check`（終了 0）、`.venv/bin/python tools/validate.py assets/unit/gau`、`.venv/bin/python tools/unit_check.py assets/unit/gau --items stlmn`
Expected: 書いた。`--check` は差なし。validate は ok。unit_check の脚の中心は ok（増えた輪郭の切れ目の報告は1件ずつ目で確かめ、台帳に書く）

- [ ] **Step 5: Commit**

```bash
cd /home/ubuntu/workspace/character-tactics
git add pixel-asset-forge/assets/part/body/gau/core_<向き>_*.txt pixel-asset-forge/assets/part/equip/dagger/dagger_<向き>_*.txt pixel-asset-forge/assets/part/fist/gau pixel-asset-forge/assets/unit/gau/<向き>_*.txt
git commit -m "feat: ガウの <向き> を体＋拳の部品から組み直す（拳を閉じ、攻撃の袖を消す）"
```

---

### Task 6: 文書と台帳

**Files:**
- Modify: `pixel-asset-forge/types/unit/SPEC.md`
  - 「立ち絵4方向の規約」の体＋拳の項: ロラン・イネス・ガウは組み直した、敵は未対応
  - 「短剣の持ち方」: 腕の記述（構えの「拳と肘を体の後ろへ引き」、`right`・`left` の「腕を前へ伸ばし」、`down` の「肘が体の横に来る位置」、`up` の「右の肘が脇からのぞく」）を、体＋拳で組んだ今の絵に合わせて書き直す（2026-10-15 以降に変えたと書く）。ガウは部品から組む（`compose/gau.json`）。待機の2コマ目の「拳を上げた素体 `body_idle2_<dir>`」の記述を、部品（`core_*`・`dagger_hand_*`）に合わせる
  - 「部品で組む規約」の書き出しの項に、ガウの定義 `gen/gau/gau_layers.py`（描き直す前に一度だけ使った）を足す
- Modify: `pixel-asset-forge/README.md`（`compose/gau.json` は今の絵を再現しない、の記述を直す）、`pixel-asset-forge/CLAUDE.md`（書き出しの注意にガウを足し、`compose.py compose/gau.json --check`・`hand_mirror.py compose/gau.json` を足す）
- Modify: `pixel-asset-forge/ISSUES.md`
  - 「ガウ・敵を 体 + 拳 の方針で組み直す」: ガウは済み（日付）・残りは敵（D）。SPEC の「1px の袖口は残す」と `weapon_check.py` の「手の輪郭」「`--arm`」の見直しは残す
  - 「組み立てた後の描き足しが forge の道具になっていない」: ガウのコマは部品から組めるようになったので、ガウについては解消（敵の生成が古い部品を使う件は残る）
  - 「男性の素体の left で、奥の手が 1px 幅」: ガウのコマは部品で直った。素体のままの件は残る
  - 作業中に見つけて直していないものを1行ずつ足す
- Create: `docs/superpowers/ledgers/2026-10-15-unit-parts-gau.md`（台帳の写し）

- [ ] **Step 1: 更新し、全体テスト**

Run: `.venv/bin/python -m unittest discover -s tests 2>&1 | tail -3` → OK
Run: `.venv/bin/python tools/compose.py compose/gau.json --check` → 終了 0（24コマすべて部品から再現できる）
Run: `.venv/bin/python tools/hand_mirror.py compose/gau.json` → ok

- [ ] **Step 2: Commit**

```bash
cd /home/ubuntu/workspace/character-tactics
git add pixel-asset-forge/types/unit/SPEC.md pixel-asset-forge/README.md pixel-asset-forge/CLAUDE.md pixel-asset-forge/ISSUES.md docs/superpowers/ledgers/2026-10-15-unit-parts-gau.md
git commit -m "docs: ガウを体＋拳の部品から組んだことを SPEC・README・ISSUES に反映する"
```

---

## Self-Review

- 計画 B との違い: 道具は作らない（`parts_export.py` を使う）。ガウは立ちに腕が無く、腕が残るのは攻撃だけ。頭巾の垂れは腕ではないので消さない。敵が古い部品を使うので、新しい部品は別の名前で書く
- 決めることとの対応: 体＋拳→Task 2〜5、違和感で方針を変える余地→Task 2 Step 3 の質問、left・right の拳の合わせ方→Task 4 の描く前の案
- 型の整合: `PartDef`・`UnitDef`・`NONE`・`export` は `tools/parts_export.py` の今の形（`PartDef.dir` あり、`export` の第2引数は `assets/part`）
- 承認の止まりどころ: 計画の承認、Task 1 Step 5（重なり順）、Task 2〜5 の Step 3（4回）。down では方針の確認も。left では描く前の拳の案も
