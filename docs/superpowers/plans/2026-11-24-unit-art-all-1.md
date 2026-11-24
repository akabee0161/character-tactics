# 全員分のユニットのドット絵（耳・全身絵・槍の 2 人）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 素体に耳を足し、仲間 10 人の全身絵を Modal で作って取り込み、槍の 2 人（リュカ ally07・ミラ ally15）のマップの絵を部品で組む本番の絵にする。

**Architecture:** 素体の横向き 4 枚に耳の 2x2 を描き足す。全身絵は illust-asset-forge の Modal の道（`cloud generate` → 依頼者が番号で選ぶ → `adopt` → `install`）で作り、道具は直さない。ドット絵は pixel-asset-forge の「描く手順」CP0〜CP4 で 1 体ずつ描き、確認ポイントごとに止まって依頼者の承認を受ける。

**Tech Stack:** Python 3.14（pixel-asset-forge の `.venv`）、illust-asset-forge の `.venv`（Modal T4）、TypeScript のゲーム（`npm test`・`npm run build`）。

**Spec:** `docs/superpowers/specs/2026-11-24-unit-art-all-design.md`（この計画は工程 1・2 と PR 2 の分。PR 3〜6 は後で別の計画にする）

## Global Constraints

- 確認ポイント（CP0〜CP4、耳・全身絵の承認）では必ず止まって依頼者に見せる。承認前にコミット・書き出しへ進まない
- 絵は HTML のページにして Artifact で見せる。ユニットのアニメは `tools/anim-page.py` の再生ページ（状態 × 4 方向）で見せる。赤枠で示すときは印なしの絵も並べる
- 確認の道具で落ちたら、道具に従って絵を直す（途中で聞かない）。例外（`exceptions`・`open_chars`）で落ちた絵を通さない。`pixel-asset-forge/ISSUES.md` に記録済みの原因なら絵を変えずに記録する
- 承認された重なり順を変えない。部品は単品として完全に描く。体＋拳だけで描き、腕の部品は作らない
- 生成は Modal の T4 だけ。背景除去のモデルはこのサーバーで動かさない。テストから本物の Modal を呼ばない。`illust-asset-forge/src/` と `UPSTREAM.md` は変えない（並行作業とぶつかるため）
- ヘッドレスブラウザは自分のポート（9333）で、`systemd-run --user --scope -p MemoryMax=…` を付けて起動する。127.0.0.1:9222 には触らない
- コミットは Conventional Commits + 日本語。push と PR は依頼者が頼んだときだけ
- 進捗台帳は `.superpowers/sdd/2026-11-24-unit-art-all-1/progress.md`。依頼者の判断は `Ruling:` 行。計画を終えたら `docs/superpowers/ledgers/2026-11-24-unit-art-all-1.md` に写す
- PR は 2 本: PR 1 = Task 1〜3（耳と全身絵、ブランチ `feat/unit-art-all`）、PR 2 = Task 4〜5（槍の 2 人、Task 3 の後に `feat/unit-art-all` から切る `feat/unit-art-spear`）。依頼者が頼んだら develop 向けに作る

## Review Focus

1. 全身絵だけを採用して `install` すると、`local/selected/<id>/` に今の顔と違う `face.png` があった場合、`source/face.png` が古い顔に替わる（または消える）。Task 2・3 で install の前に SHA-256 を比べ、install の出力の「消した」に `face.png` が無いことを確かめる
2. 素体に耳を足すと、素体を下敷きにする道具（`unit_picker.py` の素体の層）とテストが素体の画素を前提にしていないか。Task 1 で forge の unittest 全体を流す
3. 全身絵の候補で持ち物（槍・斧など）を持たない絵や、顔と髪の色が違う絵がある。選ぶのは依頼者で、Claude は選り分けない。食い違いは CP0 の前に一覧にして聞く
4. 槍は敵の部品（`equip/spear/male`・`female`）を使う。敵の肌の色の拳は使えないので、仲間の拳は肌の色を替えた写しを作る（ボルグの `fist/borg/` と同じ）
5. 説得の相手はセラ・ノエルで、この計画の範囲（リュカ・ミラ）では絵が替わらない。`sprites.json` の書き出しで、ほかのユニットの PNG が 1 バイトも変わらないことを確かめる

---

### Task 1: 素体に耳を足す

**Files:**
- Modify: `pixel-asset-forge/types/unit/base/male_left.txt`・`male_right.txt`・`female_left.txt`・`female_right.txt`（と同名の `.png`・`_x8.png`）
- Modify: `pixel-asset-forge/types/unit/SPEC.md`（「ファイル配置」の素体の行）、`pixel-asset-forge/ISSUES.md`（「素体（芯）に耳が無い」の行）

**Interfaces:**
- Produces: 横向きの素体の row 10〜11・x15〜16 が `c`（`skin_fair_shadow`）。Task 4・5 の芯はこの素体の複製

- [ ] **Step 1:** 4 枚の row 10・11（0 始まり、ヘッダを除いたグリッドの行）の x15・16 を `c` にする。手本はボルグの `assets/part/body/borg/core_left_base.txt`・`core_right_base.txt` の同じ画素（左右とも x15〜16。反転しない）
- [ ] **Step 2:** `cd pixel-asset-forge && .venv/bin/python tools/validate.py types/unit/base` → 終了コード 0。`.venv/bin/python tools/render.py` で PNG を描き直す
- [ ] **Step 3:** `.venv/bin/python -m unittest discover -s tests` → 全件 OK
- [ ] **Step 4:** 耳なし（`git show HEAD:…` から描いた PNG）と耳ありの横向き 4 枚を 8 倍で並べたページを作り、Artifact で見せる。**止まって承認を受ける**（台帳に `Ruling:`）
- [ ] **Step 5:** SPEC の素体の行に「横向き（left・right）は耳（`skin_fair_shadow` の 2x2、row 10〜11・x15〜16）を描く。耳は素体（芯）に描く（2026-11-23 依頼者）」を足す。ISSUES の行は「素体と SPEC は 2026-11-24 に済ませた。残りは既存のユニット（ロラン・イネス・ガウ・ミスト・ガルム・敵）の芯」に書き換える
- [ ] **Step 6:** コミット `feat: 素体の横向きに耳を足す`

### Task 2: 全身絵をリュカで試す

**Files:**
- Create（git に入れない）: `illust-asset-forge/local/jobs/2026-11-24-fullbody-trial.json`
- Modify: `illust-asset-forge/characters/ally07/source/fullbody.png`（新規）、必要なら `characters/ally07/character.yaml`

**Interfaces:**
- Produces: 全身絵の作り方（タグを足すか）の結論を台帳に書く。Task 3 のジョブはそれに従う

- [ ] **Step 1:** ジョブ `[{"char": "ally07", "template": "fullbody", "n": 4}]` を書き、`cd illust-asset-forge && .venv/bin/python -m artgen.cloud generate --jobs local/jobs/2026-11-24-fullbody-trial.json` → `local/rounds/<日時>.html` ができる
- [ ] **Step 2:** 候補のページを Artifact で見せる（全部を並べる）。**止まって番号を受ける**。どれも駄目なら、依頼者と足すタグ（例 `spear in right hand`）を決めて Step 1 をやり直す
- [ ] **Step 3:** `.venv/bin/python -m artgen.cloud adopt local/rounds/<日時>.json <番号>`（`--flip` なし）
- [ ] **Step 4:** `sha256sum local/selected/ally07/face.png characters/ally07/source/face.png` が一致することを確かめる。違えば `characters/ally07/source/face.png` を `local/selected/ally07/face.png` に写してから進む（台帳に書く）
- [ ] **Step 5:** `.venv/bin/python -m artgen.cloud install ally07` → 出力の「消した」に `face.png` が無く、`source/` に `face.png`・`fullbody.png` がある。書き戻しの一覧があれば `character.yaml` に戻す。`git diff --stat characters/ally07` で `face.png` が変わっていないこと
- [ ] **Step 6:** `.venv/bin/pytest` → 全件 OK（設定を直したとき）
- [ ] **Step 7:** タグを足すかの結論と、全身が収まった・持ち物を持った割合を台帳に書く。コミット `feat: リュカの全身絵を Modal で作って取り込む`

### Task 3: 残り 9 人の全身絵

**Files:**
- Create（git に入れない）: `illust-asset-forge/local/jobs/2026-11-24-fullbody-9.json`
- Modify: `illust-asset-forge/characters/{ally06,ally08,ally09,ally10,ally11,ally12,ally13,ally14,ally15}/source/fullbody.png`、必要なら各 `character.yaml`

- [ ] **Step 1:** 9 人 × 8 枚（72 枚、120 枚以下なので 1 回）のジョブを書く。Task 2 の結論でタグを足すときは、人ごとの `extra` に書く。`cloud generate` を流す
- [ ] **Step 2:** 候補のページを Artifact で見せる。**止まって 9 人分の番号を受ける**。選び直す人はその人だけ作り直す
- [ ] **Step 3:** 人ごとに `adopt` し、Task 2 の Step 4 と同じく `face.png` の SHA-256 を比べてから、`cloud install ally06 ally08 … ally15` で取り込む。「消した」に `face.png` が無いこと、`git diff --stat` で `face.png` が 1 つも変わっていないこと
- [ ] **Step 4:** 10 人の顔（大きい顔）と全身絵を並べたページを作り、Claude が見たままの食い違い（顔と全身絵の髪型・色・持ち物）と、似た色の仲間を書き添えて Artifact で見せる。**止まって承認を受ける**（まとまりの組み替えがあればここで決める。設計書「工程と PR の区切り」）
- [ ] **Step 5:** コミット `feat: 仲間 9 人の全身絵を Modal で作って取り込む`。HANDOVER の `## 進捗` を工程 3 に進める（コミットに含める）
- [ ] **Step 6:** 依頼者が頼んだら PR 1 を作る（develop 向け、5 項目、CodeRabbit の対象のファイル数を数える）

### Task 4: リュカ（ally07、槍・男）のマップの絵

**Files（ユニット名は `ryuka`。Claude の判断）:**
- Create: `pixel-asset-forge/assets/part/body/ryuka/`（男性の素体の複製の芯）、`hair/ryuka/`、`cloth/ryuka/`（要るとき）、`fist/ryuka/`（槍の拳を仲間の肌の色に替えた写し。要る拳は `compose/spear-thug.json` が使う拳と同じ）、`compose/ryuka.json`、`checks/ryuka.json`、`sheets/ryuka.txt`、`assets/unit/ryuka/`
- Modify: `sprites.json`（`"sheets/ryuka.png": "ally07-map.png"`）、`assets/images/ally07-map.png`、`pixel-asset-forge/palette/`（新しい色見本・用途の色が要るとき）、`pixel-asset-forge/types/unit/SPEC.md`（リュカの節）、`pixel-asset-forge/CLAUDE.md`（コマンドの一覧に `compose.py compose/ryuka.json --check`）
- 手本: 槍の持ち方と動きは敵の槍（`compose/spear-thug.json`・`checks/spear-thug.json`）、流れと設定シートはボルグ（`compose/borg.json`・`checks/borg.json`、SPEC のボルグの節）

- [ ] **Step 1（CP0）:** 顔（`illust-asset-forge/characters/ally07/source/face.png`）と全身絵の食い違いを一覧にして依頼者に一度に聞く（**止まる**）。答えを入れて設定シートの HTML（入力・決めたこと・部品の分解・色と測った相手・見えない側・CP1 の軸・動きの方針と手本の動きのページ）を作り、Artifact で見せる。**止まって承認を受ける**。新しい色見本は描く前に `probe_colors.py` で輪郭・肌・服・刃・槍の柄と測る
- [ ] **Step 2（CP1）:** 髪・服などの部品の案を単品で 4 方向描き、`tools/unit_picker.py` の組み合わせを選ぶページで見せる。**止まって組み合わせを受ける**
- [ ] **Step 3（CP2）:** `compose.py compose/ryuka.json` で正面を組み、`unit_rules.py checks/ryuka.json` が終了コード 0 になってから見せる。**止まって承認**
- [ ] **Step 4（CP3）:** 残り 3 方向を組み、`contact_sheet.py` で既存のユニットと並べて見せる。**止まって承認**
- [ ] **Step 5（CP4）:** 待機・歩き・攻撃を組み、次がすべて通ってから、`tools/anim-page.py assets/units/ally07.json out/anim/ally07.html` を Artifact で見せる（書き出しは確認用の一時の書き出しで、承認まではコミットしない）。**止まって承認**
  - `.venv/bin/python tools/validate.py` → 0
  - `.venv/bin/python tools/check_colors.py` → hard failure は ISSUES 記録済みの杖の敵 2 体だけ
  - `.venv/bin/python tools/unit_rules.py checks/ryuka.json` → 0
  - `.venv/bin/python tools/compose.py compose/ryuka.json --check` → 0
  - `.venv/bin/python tools/sheet.py sheets/ryuka.txt` → 足元 y=30 がそろう
- [ ] **Step 6:** README の 3 段で `assets/images/` に書き出す。`git status assets/images` で変わったのが `ally07-map.png` だけであること
- [ ] **Step 7:** `npm test`・`npm run build` が通る。ヘッドレスブラウザ（9333）で、配置の画面か戦闘でリュカが新しい絵で出ることを確かめる
- [ ] **Step 8:** SPEC にリュカの節（部品・重なり順・色・決めたこと）を足し、CLAUDE.md のコマンドに 1 行足す。コミット `feat: リュカのマップの絵を部品で組む`

### Task 5: ミラ（ally15、槍・女）のマップの絵

**Files（ユニット名は `mira`）:** Task 4 と同じ形（芯は女性の素体の複製、槍は `equip/spear/female`、拳は Task 4 の拳を肌の色だけ替えた写しか同じもの）。`sprites.json` は `"sheets/mira.png": "ally15-map.png"`

**Interfaces:**
- Consumes: Task 4 の `compose/ryuka.json`・`checks/ryuka.json` の重なり順と動き（承認済み。女性の槍の敵 `compose/spear-thug-a-f.json` と食い違うときは依頼者に聞く）

- [ ] **Step 1〜8:** Task 4 の Step 1〜8 と同じ（`ryuka` を `mira`、`ally07` を `ally15` に読み替える）。Step 6 で変わる PNG は `ally15-map.png` だけ
- [ ] **Step 9:** HANDOVER の `## 進捗` を直し（工程 3 の槍の 2 人が済んだ）、台帳を `docs/superpowers/ledgers/2026-11-24-unit-art-all-1.md` に写してコミット `docs: 槍の 2 人を終えた引き継ぎと台帳`
- [ ] **Step 10:** ブランチ全体を最終レビューに出し、Minor も PR 前に直す（絵が変わるものは見せてから）。依頼者が頼んだら PR 2 を作る
