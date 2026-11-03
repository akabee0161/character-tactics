# D 敵の組み直し 1回目（素体＋短剣の敵4体）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 素体を決まりに合わせて直し（頭 H1・拳を外す・男性の胴を筒に）、その複製の芯と描き直した頭・目・服の部品、ガウの短剣・拳で、短剣の敵4体を `compose/<敵>.json` から組み、`unit_rules.py` を例外0件で通す。

**Architecture:** 絵はグリッド（`types/unit/base/*.txt`・`assets/part/**`）だけを変え、`tools/compose.py` で `assets/unit/<敵>/` のコマを組む。色替えは今どおり `enemy/<敵>.json` のレシピと `tools/enemy_build.py`。確認は敵ごとの `checks/<敵>.json` を `tools/unit_rules.py` にかける。道具は、正しい絵が落ちたときだけ判定を直す（テストを先に書く）。

**Tech Stack:** Python 3.14（forge の `.venv`）、unittest、forge の `compose.py`・`unit_rules.py`・`render.py`・`enemy_build.py`・`enemy_gallery.py`・`anim_compare.py`。

**Spec:** `docs/superpowers/specs/2026-10-27-enemy-rebuild-design.md`（1回目）

コマンドは断りが無ければ `pixel-asset-forge/` で実行する。進捗台帳は `.superpowers/sdd/2026-10-27-enemy-rebuild-1/progress.md`（character-tactics の直下）。

## Global Constraints

- 対象は `dagger-bandit`（目 E5・bandana・belt＋tatter）、`dagger-knight`（E0・full・belt）、`dagger-horn`（E2・horn・tatter）、`dagger-thug`（E2・bare・tatter）。4体とも男性（`gen/enemy/mkframes.py` の `ENEMIES`）
- 素体の頭は案 H1（てっぺんと横を1px 削る）。画素は scratchpad の `head_drafts.py` の `H`・`Y11`（`/tmp/claude-1000/-home-ubuntu-workspace/60e7d539-c726-5131-8e67-ee5089f7db95/scratchpad/d1/{male,female}_*_H1.txt`）。頭は y=5〜10、横顔は y=11 も。顔の下半分と首（y=11〜14）は今のまま
- 頭身は変えない。素体に顔を描かない
- 男性の素体の胴は、ガウの芯（`assets/part/body/gau/core_down_base.txt` の y=15〜24、x=10〜21）と同じまっすぐな筒の外形。女性の素体の胴の外形は変えない
- 芯は素体の複製から作る。古い敵のコマや `gen/enemy/` から作らない。`gen/enemy/` は走らせない（ISSUES）
- 短剣と拳はガウの部品（`assets/part/equip/dagger/dagger_<dir>_<状態>`・`assets/part/fist/gau/{dagger_hand,free_hand}_<dir>_<状態>`）をそのまま使う。画素を変えない
- 武器と拳の重なり順はガウの `checks/gau.json` の `orders`。被り物・髪・目・服は今の敵の順（芯 → 目 → 服 → 頭）
- 部品は単品として完全に描く。形は今の部品の見た目を引き継ぐ（被り物を広げるかは Task 1 の依頼者の判断に従う）
- 敵の芯と部品の色は、今の敵のコマと同じ色名（肌 `skin_rose_*`、服 `cloak_dark_*`、ズボン y=25〜30 は `wood_shadow`。`mkframes.py` の `body()`・`MAPC`）。レシピの `recolor` がそのまま効くように
- 例外（`exceptions`）を足さない。正しい絵が落ちたら道具の判定を直す（テストを先に）。新しい機械チェックは作らない
- 絵を直したら、前と後を並べたページ（静止と動き）を Artifact で見せ、依頼者の承認を得てからコミットする。どれを見ればいいかを最初に1行で言う。承認待ちのタスクでは、承認が出るまで次のタスクへ進まない
- テストは `assets/` を読まない（`tests/test_no_live_assets.py`）
- push・PR は依頼者の指示があったときだけ。一時の出力は scratchpad か /tmp の新しいフォルダ（rm -rf は使えない）

## Review Focus

- **女性の素体**: H1 と拳を外す直しを女性にも当てる。胴の外形は変えない → Task 1 Step 4 で `body_check.py --no-protrusion` が女性4枚を通る
- **素体の PNG**: `types/unit/base/*.png`・`*_x8.png` はコミット物。書き出し忘れると古い絵が残る → Task 1 Step 6 で `git status` に8枚×2の PNG が出る
- **レシピの色替え**: 芯・部品の色名がレシピの `recolor` の元と違うと、色替えが黙って効かない → Task 4 Step 6 で `enemy_build.py --all` の後、4体のシートに `cloak_dark_*` が残っていないことを確かめる
- **奥の向きの頭**: `up`・`left` では短剣と拳が芯の奥（`back`）。頭・目・服は芯の手前に積むので、奥の拳が頭の部品の上に出ない → Task 4 Step 4 の `order_check.py` と、Task 5 の動きのページの目視
- **古い `noweapon`**: `assets/unit/<敵>/noweapon/` は `gen/enemy/mkweapons.py` だけが書いた古いコマ。組み直した後に残すと古い絵が混ざる → Task 4 Step 5 で4体の `noweapon/` を `git rm` する

---

### Task 1: 素体を直す（依頼者の承認で止まる）

**Files:**
- Modify: `types/unit/base/{male,female}_{down,up,left,right}.txt`、同じ名前の `.png`・`_x8.png`（書き出し）
- Modify: `types/unit/SPEC.md`（素体の説明・「部品で組む規約」の分け方）
- Modify: `ISSUES.md`（「素体は『一旦これで良い』の暫定」の行、「男性の素体の left で、奥の手が 1px 幅」の行）

**Interfaces:**
- Produces: 新しい素体8枚。Task 2 の芯はこれを複製する

- [ ] **Step 1: 頭を H1 にする。** 8枚の y=5〜10（横顔は y=11 も）を Global Constraints の H1 の画素で置き換える
- [ ] **Step 2: 拳を外す。** `down` の (7〜10, 18〜20)・(21〜23, 20〜22) など、胴の外にある肌の塊（拳）と、それだけを囲む輪郭を消す。拳が重なっていた胴の縁は、輪郭で閉じた単品になるように描き足す（全向き・男女とも）
- [ ] **Step 3: 男性の胴を筒にする。** 男性4枚の胴（y=15〜24）の外形を、ガウの芯と同じ外形にそろえる（`down`・`up` の y=16 の肩の段 (9,16)・(22,16) を無くす。横向きはガウの `core_left_base`・`core_right_base` の外形）
- [ ] **Step 4: 道具で確かめる。** 写しを `core_<dir>_base.txt` の名前で新しいフォルダに置いて走らせる
  - Run: `.venv/bin/python tools/body_check.py <男性の写し>` → Expected: 終了コード 0
  - Run: `.venv/bin/python tools/body_check.py <女性の写し> --no-protrusion` → Expected: 終了コード 0
  - Run: `.venv/bin/python tools/validate.py` → Expected: 終了コード 0
- [ ] **Step 5: 前と後のページを Artifact で見せて止まる。** 男女×4方向で、今の素体と新しい素体を並べる。あわせて、新しい男性の素体に **今の** 被り物（`assets/part/head/{bandana,horn,full,bare}/head_<名前>_<dir>.txt`）と目を重ねた絵を、今の敵（`assets/unit/dagger-*/<dir>_base.txt`）と並べる。依頼者に聞く: ①素体の承認、②被り物の下の顔が左右1px 細く見えるのを、被り物を広げて直すか、そのままにするか。答えを台帳に書く
- [ ] **Step 6: 書き出す。** Run: `.venv/bin/python tools/render.py types/unit/base` → `git status` に8枚の `.txt` と16枚の PNG の変更が出る
- [ ] **Step 7: SPEC と ISSUES を直す。** SPEC: 素体の説明（`types/unit/base/<body>_<dir>.txt` の行の近く）に「頭は地肌の形（2026-10-27）・拳は持たない・男性の胴は筒」を足す。「部品で組む規約」の分け方の行に「目」「服」を足す（依頼者の判断、2026-10-27）。ISSUES: 素体の行の ① を消す（依頼者）。② ③ と頭身も片付いたので行ごと消す。「男性の素体の left で、奥の手が 1px 幅」の行は、素体から拳が無くなったことを確かめて消す
- [ ] **Step 8: コミット**

```bash
git add types/unit/base types/unit/SPEC.md ISSUES.md
git commit -m "feat: 素体の頭を地肌の形にし、拳を外して男性の胴を筒にそろえる"
```

---

### Task 2: 敵の男性の芯

**Files:**
- Create: `assets/part/body/enemy_male/core_<dir>_<状態>.txt`（4方向 × `base`・`idle2`・`walk_a`・`walk_b`・`atk_wind`・`atk_hit` = 24枚）

**Interfaces:**
- Consumes: Task 1 の男性の素体
- Produces: 芯24枚。Task 4 の `compose/<敵>.json` の `body`

- [ ] **Step 1: 状態ごとの差を測る。** ガウの芯 `assets/part/body/gau/core_<dir>_<状態>` を `core_<dir>_base` と比べ、変わる画素を一覧にする（builder check の読みでは、歩きの脚 y=25〜30 だけ）。一覧を台帳に書く
- [ ] **Step 2: 芯を作る。** 男性の素体を複製し、Global Constraints の敵の色名に置き換える（`mkframes.py` の `body()` と同じ: 服 `cloth_*` → `cloak_dark_*`、肌 → `skin_rose_*`、y=25〜30 の `cloth_shadow` → `wood_shadow`）。状態の差は Step 1 の一覧の形を、ガウと同じ行・列に当てる（色は芯の色）
- [ ] **Step 3: 道具で確かめる。** Run: `.venv/bin/python tools/body_check.py assets/part/body/enemy_male` → Expected: 終了コード 0。Run: `.venv/bin/python tools/validate.py` → 0
- [ ] **Step 4: コミット**（素体の複製と、ガウと同じ脚の動きだけなので、見せるのは Task 5 の組んだコマでまとめる）

```bash
git add assets/part/body/enemy_male
git commit -m "feat: 敵の男性の芯を素体の複製から作る"
```

---

### Task 3: 頭・目・服の部品を描き直す（依頼者の承認で止まる）

**Files:**
- Create: `assets/part/head/{bandana,full,horn,bare}/head_<名前>_<dir>_base.txt`、`assets/part/eye/{E0,E2,E5}/eye_<名前>_<dir>_base.txt`、`assets/part/cloth/{belt,tatter}/cloth_<名前>_<dir>_base.txt`（4方向ずつ、36枚）

今の `head_<名前>_<dir>.txt` などは消さない（2回目の女性の敵の描き直しまで残し、3回目の後始末で消す）。新しい名前に `_base` を付けるのは、`unit_config.part_name` がファイル名の「`_<向き>_`」で部品の名前を読むため。同じ部品をすべての状態で使う。

**Interfaces:**
- Consumes: Task 1 の素体（形を合わせる下敷き）、Task 1 Step 5 の被り物の答え
- Produces: 36枚の部品。Task 4 の層

- [ ] **Step 1: 描く。** 今の部品の見た目を引き継ぎ、新しい頭と筒の胴に合わせて、体に隠れる所も含めた完全な単品にする。被り物は Task 1 Step 5 の答えに従う。服（belt・tatter）は今 `mkparts.py` が体の形から切り出しているので、筒の胴の上で同じ見た目になるように単品で描く
- [ ] **Step 2: 前と後のページを Artifact で見せて止まる。** 部品だけを向きごとに（今と新しいのを並べて）、と、芯に重ねた絵。承認を台帳に書く
- [ ] **Step 3: 道具で確かめる。** Run: `.venv/bin/python tools/validate.py` → 0
- [ ] **Step 4: コミット**

```bash
git add assets/part/head assets/part/eye assets/part/cloth
git commit -m "feat: 短剣の敵の頭・目・服の部品を新しい素体に合わせて単品で描く"
```

---

### Task 4: 4体を部品から組み、確認を通す

**Files:**
- Create: `compose/dagger-{bandit,knight,horn,thug}.json`、`checks/dagger-{bandit,knight,horn,thug}.json`
- Modify: `assets/unit/dagger-*/<dir>_<状態>.txt`（24枚ずつ、組み直し）
- Delete: `assets/unit/dagger-*/noweapon/`
- Modify（落ちたときだけ）: `tools/<確認の道具>.py` と `tests/test_<道具>.py`

**Interfaces:**
- Consumes: Task 2 の芯、Task 3 の部品、ガウの短剣と拳
- Produces: 4体のコマ。Task 5 の見せるページとシート

- [ ] **Step 1: compose の設定を書く。** `compose/gau.json` を元に、`body` を `assets/part/body/enemy_male/core_<dir>_<状態>.txt` にし、芯の手前に 目 → 服 → 頭 の層（`z: front`）を足す。短剣と拳の層・`z`・`keep`・`hand` はガウと同じ。`unit` は敵の id
- [ ] **Step 2: checks の設定を書く。** `checks/gau.json` を元に、`head_chars` は `""`（芯に髪・被り物が無い）、`parts` に目・被り物を `{"head": true}`、服を `{}` で足す。`orders` はガウの順に 目・服・頭 を `CORE` の直後へ入れた並び。`eyes` は各敵の目の部品の画素から書く。`weapon_check` はガウと同じ（手の色は `skin_rose_*`）。`exceptions` は `[]`
- [ ] **Step 3: 組む。** Run: `.venv/bin/python tools/compose.py compose/dagger-bandit.json --force`（4体とも。古いコマを上書きするので `--force`）→ その後 `--check` が 0
- [ ] **Step 4: 確認を通す。** Run: `.venv/bin/python tools/unit_rules.py checks/dagger-bandit.json`（4体とも）→ Expected: 終了コード 0、例外0件。落ちたら、絵の誤りか判定の誤りかを組んだ絵と部品で確かめる。判定の誤りなら、落ちた形を `tests/fixtures/` に写した失敗するテストを先に書き、道具を直し、`.venv/bin/python -m unittest discover -s tests` を通す。`weapon_check.py` の「手の輪郭」は、ここで落ちた件数（偽陽性）を台帳に書く
- [ ] **Step 5: 古い `noweapon` を消す。** Run: `git rm -r assets/unit/dagger-{bandit,knight,horn,thug}/noweapon`
- [ ] **Step 6: シートを作る。** Run: `.venv/bin/python tools/enemy_build.py --all` → 16体とも `ok`。4体のシート `build/sheets/dagger-*.png` の色が、レシピの `recolor` どおり（`cloak_dark_*` の色が残っていない）か、`tools/probe_colors.py` か画素の読み出しで確かめる
- [ ] **Step 7: コミット**

```bash
git add compose checks assets/unit tools tests
git commit -m "feat: 短剣の敵4体を素体の芯と部品から組み直す"
```

---

### Task 5: 見せる・書き出し・片付け（依頼者の承認で止まる）

**Files:**
- Modify: `types/unit/SPEC.md`（短剣の持ち方の節に、敵4体がガウの部品を使い回すこと）、`ISSUES.md`（「敵を 体 + 拳 の方針で組み直す」の行の進み具合）、`README.md`・`CLAUDE.md`（compose・unit_rules のコマンド例に敵があれば）
- Create: `docs/superpowers/ledgers/2026-10-27-enemy-rebuild-1.md`（character-tactics の直下。台帳の写し）

- [ ] **Step 1: 前と後のページを Artifact で見せて止まる。** 4体の今（`main` のコマ）と組み直した後を、静止（4方向×状態）と動き（`tools/anim_compare.py` か `tools/enemy_gallery.py`）で並べる。承認を台帳に書く。直しが出たら Task 3・4 へ戻る
- [ ] **Step 2: 一覧と見本を更新する。** Run: `.venv/bin/python tools/enemy_gallery.py <scratchpad>/enemy_gallery.html --ref build/sheets/gau.png:ガウ（味方）` を Artifact に出す（今の16体のページ https://claude.ai/artifact/37JAEfycU1ZNCMbJJhQDdp と同じ URL）。Run: `.venv/bin/python tools/contact_sheet.py`
- [ ] **Step 3: 文書を直す。** SPEC・ISSUES・README・CLAUDE.md を上の Files のとおり
- [ ] **Step 4: 全部の確認を走らせる。**
  - `.venv/bin/python -m unittest discover -s tests` → OK
  - `.venv/bin/python tools/validate.py` → 0
  - `.venv/bin/python tools/unit_rules.py checks/<ユニット>.json`（ロラン・イネス・ガウ・短剣の4体）→ どれも 0
  - `.venv/bin/python tools/compose.py compose/<ユニット>.json --check`（同じ7体）→ どれも 0
  - character-tactics の直下で `npm test`・`npm run build` → 通る（ゲームのシートは変えていないことの確かめ）
- [ ] **Step 5: 台帳を写してコミット**

```bash
git add types/unit/SPEC.md ISSUES.md README.md CLAUDE.md ../docs/superpowers/ledgers/2026-10-27-enemy-rebuild-1.md
git commit -m "docs: 短剣の敵の組み直しを SPEC・ISSUES に書き、台帳を写す"
```

- [ ] **Step 6: Opus のサブエージェントで最終レビューをし、Minor まで直す。** その後、保留の課題を一覧にして直す時期を依頼者に聞く（PR の前）
