# 全員分のユニットのドット絵（斧の 2 人）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 斧の 2 人（バルド ally09・オルト ally13）のマップの絵を、新しい顔と全身絵から部品で組む本番の絵にする。先に、ブランチを PR の区切りで 3 本に分ける。

**Architecture:** リュカ（ally07）・ミラ（ally15）と同じ作り方。素体の複製の芯に、髪・服・斧・拳の部品を重ねる。斧と拳の形・位置・重なり順は敵の斧（`compose/axe-bandit.json`・`checks/axe-bandit.json`）のまま、色だけを替える。1 体ずつ CP0〜CP4 を進める。

**Tech Stack:** Python 3.14（`pixel-asset-forge/.venv`）、TypeScript のゲーム（`npm test`・`npm run build`）。

**Spec:** `docs/superpowers/specs/2026-11-24-unit-art-all-design.md`（設計書の PR 3。前の計画は `docs/superpowers/plans/2026-11-24-unit-art-all-1.md`）

## Global Constraints

- 部品・設定の名前にキャラクターの名前を使わず、ゲームの ID（`ally09`・`ally13`）を使う（`pixel-asset-forge/CLAUDE.md`）
- 絵のイメージを変える直しは、描く前に、変える場所を赤枠で囲んだ絵（今の絵・赤枠・印なしを並べる）で Artifact に見せ、依頼者の指示を受けてから描く。描く前に確認の道具・書き出し・テストを流さない。描いた後は前後と差分を赤枠で見せ、変えた画素数を書く。「戻して」は `git revert`
- 新しいユニットを最初に描くところ（CP0〜CP4）は、依頼者の追加指示（2026-11-25「確認せずに進められるところを一気に進めてください。確認は、判断で進めた結果の提示で十分」）に従い、止まらずに進めて結果を Artifact で見せる。見せた後の直しは、上の赤枠の決まりに従う
- 確認の道具で落ちたら、道具に従って絵を直す（途中で聞かない）。例外（`exceptions`・`open_chars`）で落ちた絵を通さない。`pixel-asset-forge/ISSUES.md` に記録済みの原因なら絵を変えずに記録する。承認された重なり順は、依頼者が頼まない限り変えない
- 部品は完全な単品で描く。体＋拳だけで描き、腕の部品は作らない。髪の前の部品（頭の髪）と後ろの部品（体の奥）は分ける
- 新しい色見本は描く前に `tools/probe_colors.py` で輪郭・肌・服・互いに対して測る。新しい素体と背丈の例外は作らない（芯は男性の素体の複製、背丈 24px）
- 道具の判定が変わる決めごとは自分で決めない。`illust-asset-forge/src/` と `UPSTREAM.md` は変えない
- ヘッドレスブラウザは自分のポート（9333）で、`systemd-run --user --scope -p MemoryMax=…` を付けて起動する。127.0.0.1:9222 には触らない。このサーバーは 2 コア・メモリ 1.9GB で、`npm test` は普段 5 分（負荷が高いと 25 分。遅いのは `balance.test.ts`）
- コミットは Conventional Commits + 日本語。push と PR は依頼者が頼んだときだけ。PR は develop 向けで `.github/pull_request_template.md` の 5 項目。PR の前に CodeRabbit の対象（`.coderabbit.yaml` のフィルタ後）が 100 ファイル以下か数える
- 進捗台帳は `.superpowers/sdd/2026-11-25-unit-art-all-2/progress.md`（依頼者の判断は `Ruling:` 行）。計画を終えたら `docs/superpowers/ledgers/2026-11-25-unit-art-all-2.md` に写す。push の前と区切りごとに HANDOVER.md の `## 進捗` を今の状態に直す
- PR の区切り（依頼者 2026-11-25）: PR A = 全身絵（`feat/unit-art-fullbody`）、PR B = 槍の 2 人（`feat/unit-art-spear`）、PR C = 斧の 2 人（`feat/unit-art-axe`）

## 範囲外

- ロラン・イネス・ガウ・ミスト・ガルムの部品名を ID に付け替える作業（依頼者は「付け替える」と決めた。ただし、付け替え先の ID が決まっておらず、ゲームの ID・セーブ・テストに及ぶので、別の計画にする）
- PR 4〜6（弓と杖・盾・旗と翼）

## Review Focus

1. オルトの全身絵は黒い手袋・籠手だが、顔には手が写らない。拳の部品は肌の種類の色でないと閉じ検査（`compose.py` の hand）と `fist_check` が落ちる。→ 肌の色の拳にし、手袋は描かない（Task 3 の Step 1 で決め、台帳に書く）
2. バルドの髭が下顎の行（頭の下端 y=14）に掛かり、`part_outline`（髪の部品の肌の画素が輪郭で閉じていない）や `head_cover_check` が落ちる。→ Task 2 の CP1 で髭の置き場（髪の部品に含めるか、別の部品か）を、両方の道具が通る側に決める
3. 斧の刃が体の手前で隠れる、または攻撃のコマで刃が拳から離れる（`weapon_check` が落ちる）。敵の斧の例外（`weapon_check.partial` の `left_atk_hit`・`left_atk_wind`）を写して通し、それ以外のコマは例外を増やさない（Task 2・3 の Step 5）
4. 赤髪のオルト・赤い上着のリュカ・橙の髪のミラは色が近く、マップで見分けにくい。→ Task 3 の CP0 で、オルトの髪・服をリュカ・ミラの色見本と `probe_colors.py` で測り、3 人を並べたページで見せる
5. 書き出しで、ほかのユニットの PNG が 1 バイトでも変わる。→ Task 2・3 の Step 6 で `git status assets/images` が `ally09-map.png`（`ally13-map.png`）だけであること

---

### Task 1: ブランチを PR の区切りで分ける

**Files:** なし（ブランチだけ）

**Interfaces:**
- Produces: ローカルのブランチ 3 本。`feat/unit-art-fullbody` は 4e25e12（全身絵とその決定の記録まで）、`feat/unit-art-spear` は 78d58f2（槍の 2 人まで。`feat/unit-art-all` の今の先頭）、`feat/unit-art-axe` は今の先頭（この計画を足したコミット。`feat/unit-art-spear` の次）から切る。Task 2 以降は `feat/unit-art-axe` で作業する

- [ ] **Step 1:** `git status --short` が空であることと、`git log --oneline -2` が「この計画を足したコミット」と 78d58f2 であることを確かめる
- [ ] **Step 2:** `git branch feat/unit-art-fullbody 4e25e12` と `git branch feat/unit-art-spear 78d58f2`。`git log --oneline develop..feat/unit-art-fullbody | head -3` の先頭が `4e25e12 docs: ピコの翼は移動のときに動かす決定を書く` であること。46f0644（最終レビューの修正）は、ピコ・ユナの全身絵の直しと槍の 2 人の直しが 1 つのコミットなので、PR B に入る（分けない。台帳に書く）
- [ ] **Step 3:** `git switch -c feat/unit-art-axe`（今の先頭から）。台帳 `.superpowers/sdd/2026-11-25-unit-art-all-2/progress.md` に `Ruling: PR は 3 本に分ける` と、各ブランチの先頭のコミットを書く（台帳は git 管理外）
- [ ] **Step 4:** HANDOVER.md の `## 進捗` を、工程 3（斧の 2 人）の実装に進めて直す（作業の名前は同じ「全員分のユニットのドット絵を作る」。`次にやること` に「ロラン等 5 人の部品名の付け替え先の ID を決める」を足す）。コミット `docs: PR の区切りと斧の 2 人の計画を引き継ぎに書く`

### Task 2: バルド（ally09、斧・男・髭）のマップの絵

**Files:**
- Create: `pixel-asset-forge/assets/part/body/ally09/`（`assets/part/body/enemy_male/` の複製を、服・ズボン・靴の色だけ替えた芯。耳は描かない）、`hair/ally09/`（髪と髭）、`cloth/ally09/`（ベストと肩のひも）、`equip/axe/ally09/`（`equip/axe/male/` の形と位置の複製。色だけ替える）、`fist/ally09/`（`fist/enemy_male/axe_hand_*` と `fist/gau/free_hand_*` を `skin_fair_*` に替えた写し）、`compose/ally09.json`、`checks/ally09.json`、`sheets/ally09.txt`、`assets/unit/ally09/`
- Modify: `sprites.json`（`"sheets/ally09.png": "ally09-map.png"`）、`assets/images/ally09-map.png`、`pixel-asset-forge/palette/`（新しい色見本と用途の色）、`pixel-asset-forge/types/unit/SPEC.md`（バルドの節。リュカの節の次）、`pixel-asset-forge/CLAUDE.md`（コマンドの一覧に `compose.py compose/ally09.json --check`）
- 手本: 構成・重なり順・動きは `compose/axe-bandit.json`・`checks/axe-bandit.json`、作り方の流れと色の測り方は `compose/ally07.json`・`checks/ally07.json`・SPEC のリュカの節

**Interfaces:**
- Produces: `compose/ally09.json`・`checks/ally09.json` の重なり順（`checks/axe-bandit.json` の `orders` と同じ。目・服・髪の部品名を `eye_E0`・`cloth_ally09`・`hair_ally09` にしたもの）。Task 3 がこれを写す

- [ ] **Step 1（CP0）:** 顔（`illust-asset-forge/characters/ally09/source/face.png`）と全身絵（`source/fullbody.png`）の食い違いを、顔を正にして決め、台帳に `Ruling:` で書く。分かっている食い違い: 顔は 3/4 の横顔で短い髪を後ろへ流す（全身絵は前髪が立つ）、顔のベストは赤みの茶で全身絵は茶。設定シートの HTML（入力・決めたこと・部品の分解・色と測った相手・CP1 の軸・動きの方針）を作り、Artifact で見せる。新しい色見本（髪・髭・ベスト・シャツ・ズボン・斧の柄と刃）は描く前に `.venv/bin/python tools/probe_colors.py --candidate '#rrggbb' --against …` で輪郭・肌・隣の色と測り、HARD が 0 件になる値にする（`palette/uses/unit.json` に用途の色、`palette/kinds.json` に種類を足す。名前は `hair_<色>_{hi,base,shadow}` の形）
- [ ] **Step 2（CP1）:** 髪（前髪の形）と髭の部品の案を単品で 4 方向描き、`tools/unit_picker.py` の組み合わせを選ぶページで見せる。髭の置き場は Review Focus 2 のとおり。選ぶのは Claude の判断で、台帳に書く
- [ ] **Step 3（CP2）:** `compose/ally09.json` と `checks/ally09.json` を `axe-bandit` から写して作り、`.venv/bin/python tools/compose.py compose/ally09.json --frames down_base --out /tmp/cand` で正面を組む。`.venv/bin/python tools/unit_rules.py checks/ally09.json` が終了コード 0 になってから Artifact で見せる
- [ ] **Step 4（CP3）:** 残り 3 方向を組み、`.venv/bin/python tools/contact_sheet.py` で既存のユニットと並べて見せる
- [ ] **Step 5（CP4）:** 待機・歩き・攻撃の 24 コマを組む。次が全部通ること
  - `.venv/bin/python tools/validate.py` → 終了コード 0
  - `.venv/bin/python tools/check_colors.py` → hard failure は ISSUES 記録済みの杖の敵 2 体だけ
  - `.venv/bin/python tools/unit_rules.py checks/ally09.json` → 終了コード 0（`weapon_check.partial` は `axe-bandit` と同じ 2 コマだけ）
  - `.venv/bin/python tools/compose.py compose/ally09.json --check` → 終了コード 0
  - `.venv/bin/python tools/sheet.py sheets/ally09.txt` → 足元 y=30 がそろう

  通ったら、README の 3 段（`export.build()` → `enemy_build.py --all` → `export.export()`。`pixel-asset-forge/README.md` の書き出しの節）で `../assets/images` へ書き出し、リポジトリ直下（`character-tactics/`）で `python3 tools/anim-page.py assets/units/ally09.json out/anim/ally09.html` を流し、その HTML を Artifact で見せる
- [ ] **Step 6:** `git status --short assets/images` が `ally09-map.png` と `sprites.json` だけであること（Review Focus 5）
- [ ] **Step 7:** `npm test`・`npm run build` が通る。ヘッドレスブラウザ（9333）で、バルドが出る戦闘（`assets/stages/stage5.json`）の画面か、出ないときは再生ページで代える（台帳に書く）
- [ ] **Step 8:** SPEC にバルドの節（部品・重なり順・色・決めたこと）を足し、CLAUDE.md のコマンドに 1 行足す。コミット `feat: バルドのマップの絵を部品で組む`

### Task 3: オルト（ally13、斧・男・大柄）のマップの絵

**Files（Task 2 と同じ形で `ally09` を `ally13` に読み替える）:**
- Create: `pixel-asset-forge/assets/part/body/ally13/`、`hair/ally13/`、`cloth/ally13/`（橙の上着・暗い肩当て・ベルト。1 つの部品。肩当ては横向きで拳と重ならない位置）、`equip/axe/ally13/`、`fist/ally13/`、`compose/ally13.json`、`checks/ally13.json`、`sheets/ally13.txt`、`assets/unit/ally13/`
- Modify: `sprites.json`（`"sheets/ally13.png": "ally13-map.png"`）、`assets/images/ally13-map.png`、`palette/`、SPEC（オルトの節）、CLAUDE.md（コマンド 1 行）

**Interfaces:**
- Consumes: Task 2 の `compose/ally09.json`・`checks/ally09.json`（重なり順。目・服・髪の部品名だけ読み替える）、`fist/ally09/` の拳の形

- [ ] **Step 1（CP0）:** 顔と全身絵の食い違いを、顔を正にして決める。分かっている食い違い: 顔の肩当ては青みの灰で全身絵は黒に近い灰（顔を正）、全身絵の黒い手袋・籠手は顔に写らない（Review Focus 1。肌の拳にし、手袋は描かない）、頬の傷は 32px では描かない（Claude の判断）。大柄は、背丈 24px の芯のまま、肩当ての幅で出す（新しい素体と背丈の例外は作らない）。赤髪・橙の上着を、リュカ・ミラの色見本と `probe_colors.py` で測り、3 人を並べたページを Artifact で見せる（Review Focus 4）
- [ ] **Step 2〜8:** Task 2 の Step 2〜8 と同じ（`ally09` を `ally13`、`stage5.json` を `stage8.json` に読み替える。Step 3 の部品名は Task 2 の Interfaces）。Step 6 で変わる PNG は `ally13-map.png` だけ

### Task 4: 引き継ぎ・台帳・最終レビュー

**Files:**
- Modify: `HANDOVER.md`
- Create: `docs/superpowers/ledgers/2026-11-25-unit-art-all-2.md`

- [ ] **Step 1:** HANDOVER の `## 進捗` を直す（工程 3 の斧の 2 人が済んだ。次は PR 4 の弓と杖）。「工程 2・3 の結果」に斧の 2 人の判断（食い違いの決め方・髭の置き場・手袋・色）を足す
- [ ] **Step 2:** 台帳を `docs/superpowers/ledgers/2026-11-25-unit-art-all-2.md` に写し、コミット `docs: 斧の 2 人を終えた引き継ぎと台帳`
- [ ] **Step 3:** ブランチ全体（`feat/unit-art-spear..feat/unit-art-axe`）を最終レビューに出す。Minor も PR 前に直す（絵が変わるものは、赤枠で見せてから）。依頼者が頼んだら、PR A → B → C の順に develop 向けで作る
