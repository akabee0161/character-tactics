# 全員分のユニットのドット絵（盾の 2 人）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 盾のガンツ（ally14・男・大柄・髭）とシオン（ally10・男・白と黄の法衣）のマップの絵を、新しい顔と全身絵から部品で組む本番の絵にする。

**Architecture:** 弓と杖の 2 人（`docs/superpowers/plans/2026-11-26-unit-art-all-3.md`）と同じ作り方。素体の複製の芯に、髪・服・盾・拳の部品を重ねる。盾の持ち方はボルグ（`compose/ally05.json`・`checks/ally05.json`）が手本で、盾の拳は base の位置のまま、攻撃は空き手の拳（オルトの `fist/ally13/free_hand_*` の形）が動く。ガンツで大きな盾を新しく描き、シオンはその形を複製して色を替える。1 体ずつ CP0〜CP4 を進め、ガンツを CP4 まで終えてからシオンに入る。

**Tech Stack:** Python 3.14（`pixel-asset-forge/.venv`）、TypeScript のゲーム（`npm test`・`npm run build`）。

**Spec:** `docs/superpowers/specs/2026-11-24-unit-art-all-design.md`（設計書の PR 5。前の計画は `docs/superpowers/plans/2026-11-26-unit-art-all-3.md`）

## Global Constraints

- 部品・設定の名前にキャラクターの名前を使わず、ゲームの ID（`ally14`・`ally10`）を使う（`pixel-asset-forge/CLAUDE.md`）。コメント 1 行目にもキャラクターの名前を書かない
- 部品は完全な単品で描く。体＋拳だけで描き、腕の部品は作らない。髪は隠れる所も含めた完全な形で 1 本描く。承認された重なり順（ボルグの `orders`）は、依頼者が頼まない限り変えない
- 絵のイメージを変える直しは、描く前に、変える場所を赤枠で囲んだ絵（今の絵・赤枠・印なしを並べる）で Artifact に見せ、依頼者の指示を受けてから描く。描く前に確認の道具・書き出し・テストを流さない。案は別の作業用コピー（`git worktree`）に作る
- 絵の直し方（依頼者 2026-11-27）: ①参考（全身絵・顔）と見比べて足す・変える所を短く書く ②部品を単体で描き、参考との合致・形・輪郭の決まり・色で評価する ③単体を Artifact で見せ、依頼者の OK をもらってから組んだ絵へ進む ④複数の直しは 1 つずつ
- 新しいユニットを最初に描く CP0〜CP4 は、依頼者の追加指示（2026-11-25「確認せずに進められるところを一気に進めてください。確認は、判断で進めた結果の提示で十分」）に従い止まらず進め、結果を Artifact で見せる。見せた後の直しは上の 2 つの決まりに従う（Claude の解釈。2026-11-27 の進め方がこの CP0〜CP4 にも及ぶかは依頼者に確かめていない）
- 確認の道具で落ちたら道具に従って絵を直す。例外（`exceptions`・`open_chars`）で通さない。`pixel-asset-forge/ISSUES.md` に記録済みの原因なら絵を変えずに記録する。道具の判定が変わる決めごとは自分で決めず依頼者に聞く
- 新しい色見本は描く前に `.venv/bin/python tools/probe_colors.py --candidate '#rrggbb' --against …` で輪郭・肌・隣の色・盾の色・ボルグの色と測り、HARD 0 件にする。用途の色の名前は色見本と同じにしない。新しい素体と背丈の例外は作らない（背丈は決まりの 24〜26px の中で CP0 に決める）
- 髪の左右対称（`feat/hair-mirror-check` の `hair_mirror.py`）が入る前提で、正面と背面の髪の外形（行ごとの左端・右端）をそろえて描く。検査は未マージなので、足すのは入った後
- `illust-asset-forge/src/` と `UPSTREAM.md` は変えない。`python -m artgen.export` は顔を書き換えうるので実行しない
- ヘッドレスブラウザは自分のポート（9333）で `systemd-run --user --scope -p MemoryMax=…` を付けて起動する。127.0.0.1:9222 には触らない。このサーバーは 2 コア・メモリ 1.9GB。`npm test` は背景で流し、結果はログの末尾で読む。開発中は `npm run balance -- --check` を流さない（依頼者 2026-11-26）
- 絵を直したら `assets/images` への書き出し（README の 3 段: `export.build()` → `enemy_build.py --all` → `export.export()`）まで。そのあと `git status assets/images` で、変わった PNG が対象のユニットだけであること
- コミットは Conventional Commits + 日本語。push と PR は依頼者が頼んだときだけ。マージは依頼者が行う。PR は develop 向けで `.github/pull_request_template.md` の 5 項目。PR の前に CodeRabbit の対象（`.coderabbit.yaml` のフィルタ後）が 100 ファイル以下か数える
- 進捗台帳は `.superpowers/sdd/2026-11-27-unit-art-all-4/progress.md`（依頼者の判断は `Ruling:` 行）。終えたら `docs/superpowers/ledgers/2026-11-27-unit-art-all-4.md` に写す。push の前と区切りごとに HANDOVER.md の `## 進捗` を今の状態に直す

## 範囲外

- PR 6（旗と翼）、ロラン・イネス・ガウ・ミスト・ガルムの部品名・ID の付け替え（別の計画）
- セラの左向きの杖の見え方（`ISSUES.md` に記録済み。重ね順の変更なので依頼者が頼んだときだけ）
- `npm run balance`（依頼者の指示。develop→main の前に流す）。両者とも攻撃のコマ数は 3 のまま（`assets/units/ally14.json`・`ally10.json` は変えない）

## 決めてあること（Claude の判断。台帳に `Ruling:` で書く。依頼者が決めたのは「大きな盾はボルグの盾より一回り大きい」「攻撃は空き手の拳で盾は base のまま」（2026-11-25）だけ）

- 芯は男性の素体の複製（`body/ally13/` をひな形に色替え）。ガンツの背丈は設計書の目安 26px、シオンは 24〜26px で CP0 に決める。大柄は髪・肩当て・盾で出す
- 盾の拳は `fist/ally05/shield_hand_*` の形を肌の色だけ替えた写し（`fist/ally14/`・`fist/ally10/`）。空き手は `fist/ally13/free_hand_*`（攻撃のコマも持つ 2x2）の写し。盾は全コマ base のまま動かさない（`fixed: true`）
- ガンツの盾 `equip/shield/ally14/` は新しく描く。ボルグの盾（面 8〜10px 幅・高さ約 11px）より一回り大きく、CP1 で 3 つの大きさを単体で見せて Claude が選ぶ。シオンの盾 `equip/shield/ally10/` はガンツの盾の形の複製で、面を金・十字を白に替える（十字が 32px で読めなければ面の金だけにする）
- シオンの攻撃は魔法（`attack: magic`）だが、絵は空き手の拳が上がる 3 コマ（魔法の光や矢はゲーム側の演出）。法衣と外套は 1 つの `cloth/ally10/`（足元まで。形は `cloth/robe/` を手本）
- ガンツの鎧（胸当て・肩当て・籠手）は `cloth/ally14/` 1 つ。全身絵の肩当ての尖り（角）は、顔の外形を超えるので CP1 で入れるかを決める（`head_cover_check`・`part_outline` が落ちたら描かない）

## Review Focus

1. ガンツ（紺の鎧に金・盾）がボルグ（青灰の鎧に金の縁・盾）と並んで見分けにくい。→ Task 2 Step 1 で `probe_colors.py` を、鎧・金・盾の面・髪の組でボルグの色と測り、Step 4 の `contact_sheet.py` でボルグ・オルトと並べて見せる。黒い髪と髭・肩当ての大きさ・盾の形で見分けがつくこと
2. 大きな盾が、横向きで顔・目の行（x14・x17 の row 11〜12）を覆う、上向きで体を隠す、盾の拳が盾の外に出る。→ `eye_check`・`part_outline`・`order_check` が通ること（`checks/ally14.json` の `orders` は `checks/ally05.json` のまま）
3. シオンの法衣は足元までで、歩き 4 コマで足元が動いて見えない。→ ミスト・セラのローブと並べた再生ページで、歩きの足元が止まって見えないことを確かめる（見えないとき、直し方はミストと同じ扱いか依頼者に聞く）
4. シオンの魔法の攻撃が、空き手の拳だけの動きで攻撃に見えない。→ `atk_wind`・`atk_hit` の画素の差を数えて台帳に書き、再生ページで見せる。小さすぎるときの直し方（拳の動きを大きくする・盾を動かす）は盾 base の決めに触れるので依頼者に聞く
5. 共有する部品が 1 バイトでも変わる（ボルグの `equip/shield/ally05`・`fist/ally05`、オルトの `fist/ally13`、ガルムの盾）。→ Step 6 で `git diff --stat -- pixel-asset-forge/assets/part/equip/shield/ally05 pixel-asset-forge/assets/part/equip/shield/shield_garum_* pixel-asset-forge/assets/part/fist/ally05 pixel-asset-forge/assets/part/fist/ally13` が 0 件、`git status assets/images` が対象の 1 枚だけ

---

### Task 1: ブランチを切って準備する

**Files:** HANDOVER.md（進捗だけ）

**Interfaces:**
- Produces: ブランチ `feat/unit-art-shield`。台帳 `.superpowers/sdd/2026-11-27-unit-art-all-4/progress.md`

- [ ] **Step 1:** `git status --short` が空であることを確かめる。ブランチの元は、PR #72 がマージ済みなら develop。未マージなら（`gh pr view 72`）、積むか待つかを依頼者に 1 つ聞く（`sprites.json`・`palette/`・SPEC・CLAUDE.md が #72 と同じファイルなので、develop から切ると衝突する）。台帳を作り、`Ruling:` に実行方法（依頼者の選択）と「今のチェックアウトで作業」「マージは依頼者の合図を待つ」を書く
- [ ] **Step 2:** この計画のコミット `docs: 盾の 2 人の計画を書く`。HANDOVER の `## 進捗` を PR 5 の実装に進めて直す

### Task 2: ガンツ（ally14、盾・男・大柄・髭・紺の鎧）のマップの絵

**Files:**
- Create: `pixel-asset-forge/assets/part/body/ally14/`（`body/ally13/` の 24 コマの複製を色替え）、`hair/ally14/`（黒の短髪と髭。髭は髪の部品に入れる。バルドの節の髭の位置の決まりに従う）、`cloth/ally14/`（紺の胸当て・肩当て・籠手・金の飾り。1 つの部品）、`equip/shield/ally14/`（`shield_<dir>_base.txt` の 4 枚）、`fist/ally14/`（`shield_hand_<dir>_base.txt` の 4 枚と `free_hand_<dir>_{base,idle2,atk_wind,atk_hit}.txt` の 16 枚）、`compose/ally14.json`、`checks/ally14.json`、`sheets/ally14.txt`、`assets/unit/ally14/`（24 コマ）
- Modify: `sprites.json`（`"sheets/ally14.png": "ally14-map.png"`）、`assets/images/ally14-map.png`、`palette/`（色見本と用途の色）、`types/unit/SPEC.md`（ガンツの節。セラの節の次）、`CLAUDE.md`（コマンド一覧に `compose.py compose/ally14.json --check`）
- 手本: 構成・重なり順・盾の拳は `compose/ally05.json`・`checks/ally05.json`（剣と剣の拳を外し、空き手を足す）、髪と髭・拳の写し方は `checks/ally09.json`・`checks/ally13.json`、色の測り方は SPEC のバルド・オルトの節

**Interfaces:**
- Produces: `compose/ally14.json`（24 コマ。コマ名は `compose/ally05.json` と同じ）、`checks/ally14.json`（部品名 `eye_E0`・`cloth_ally14`・`hair_ally14`・`shield`・`shield_hand`・`free_hand`・`CORE`）、`equip/shield/ally14/`（Task 3 が複製する盾）

- [ ] **Step 1（CP0）:** 顔（`illust-asset-forge/characters/ally14/source/face.png`）と全身絵（`source/fullbody.png`）の食い違いを、顔を正にして決め、台帳に `Ruling:` で書く。分かっている食い違い: 顔は横顔で黒髪をなでつけ、濃い黒髭、襟は白い詰め襟に青の鎧。全身絵は髪が立ち、鎧は青に金の渦の飾り・尖った肩当て・紺の手甲・茶の革ベルト・金の膝当て。顔に写る髪・髭・鎧の青は顔、ズボン・靴・ベルトは全身絵。盾は全身絵の金縁の大きな盾（先がとがり、面は青に金の渦）。設定シートの HTML（入力・決めたこと・部品の分解・色と測った相手・CP1 の軸・動きの方針）を Artifact で見せる。新しい色見本（髪と髭・鎧の青と影・金・盾の面・肌・ベルト）は描く前に `probe_colors.py` で測る（Review Focus 1。種類は髪 `hair`、鎧 `armor`、盾の面 `plate`、金 `metal`、ベルト `ornament`）
- [ ] **Step 2（CP1）:** 髪と髭、鎧の肩当て（角の有無）、盾の 3 つの大きさを、単体で 4 方向描く。単体を `tools/unit_picker.py` の組み合わせを選ぶページに並べて見せ、参考との合致・輪郭・色で評価した結果を添える。選ぶのは Claude の判断で台帳に書く
- [ ] **Step 3（CP2）:** `compose/ally14.json`・`checks/ally14.json` を先に作って落ちるのを見る。`.venv/bin/python tools/compose.py compose/ally14.json --frames down_base --out <scratchpad>/cand` で正面を組み、`.venv/bin/python tools/unit_rules.py checks/ally14.json` が終了コード 0 になってから Artifact で見せる
- [ ] **Step 4（CP3）:** 残り 3 方向を組み、`tools/contact_sheet.py` でボルグ・オルトと並べて見せる（Review Focus 1・2）
- [ ] **Step 5（CP4）:** 待機・歩き・攻撃の 24 コマを組む。`sheets/ally14.txt`（`sheets/ally05.txt` の写し）を直す。次が全部通ること
  - `.venv/bin/python tools/validate.py` → 終了コード 0
  - `.venv/bin/python tools/check_colors.py` → hard failure は ISSUES 記録済みの杖の敵 2 体だけ
  - `.venv/bin/python tools/unit_rules.py checks/ally14.json` → 終了コード 0（例外は無い）
  - `.venv/bin/python tools/compose.py compose/ally14.json --check` → 終了コード 0
  - `.venv/bin/python tools/sheet.py sheets/ally14.txt` → 足元がそろい、幅はボルグの `sheets/ally05.txt` と同じ

  通ったら README の 3 段で `../assets/images` へ書き出し、リポジトリ直下で `python3 tools/anim-page.py assets/units/ally14.json out/anim/ally14.html` を流し、その HTML を Artifact で見せる
- [ ] **Step 6:** Review Focus 5 のコマンドを流す。`git status --short assets/images` が `ally14-map.png` だけ
- [ ] **Step 7:** `npm run build`。`npm test` は背景で流して末尾を読む。ガンツが出る戦闘は再生ページで代える（ゲームの画面での確認は未実施として台帳に書く）
- [ ] **Step 8:** SPEC にガンツの節（部品・重なり順・色・決めたこと・盾の大きさ）を足し、CLAUDE.md のコマンドに 1 行足す。コミット `feat: ガンツのマップの絵を部品で組む`

### Task 3: シオン（ally10、盾・男・白と黄の法衣・短い金髪）のマップの絵

**Files（Task 2 と同じ形で `ally14` を `ally10` に読み替える）:**
- Create: `assets/part/body/ally10/`（`body/ally14/` の複製を色替え。法衣が足元まで覆うので芯の服は見えにくい）、`hair/ally10/`（淡い金の短い髪。目に掛かる前髪とあごの高さの毛先。完全な形で 1 本）、`cloth/ally10/`（白い法衣・黄の縁・高い襟・肩の外套・胸の青い十字。1 つの部品。`cloth/robe/` の足元までの形を手本に色と襟を替える）、`equip/shield/ally10/`（`equip/shield/ally14/` の形の複製を金の面・白の十字に替える）、`fist/ally10/`（`fist/ally14/` の複製を肌の色だけ替える）、`compose/ally10.json`、`checks/ally10.json`、`sheets/ally10.txt`、`assets/unit/ally10/`（24 コマ）
- Modify: `sprites.json`、`assets/images/ally10-map.png`、`palette/`、SPEC（シオンの節）、CLAUDE.md（コマンド 1 行）
- 手本: Task 2 の `compose/ally14.json`・`checks/ally14.json`（部品名の読み替えだけ）、ローブの層と重なり順は `checks/ally06.json`（`cloth_ally06` を `cloth_ally10` に）

**Interfaces:**
- Consumes: Task 2 の `equip/shield/ally14/shield_<dir>_base.txt`（形の複製元）、`fist/ally14/`（肌の色替えの複製元）、台帳の書き方
- Produces: `checks/ally10.json`（部品名 `eye_E0`・`cloth_ally10`・`hair_ally10`・`shield`・`shield_hand`・`free_hand`・`CORE`）

- [ ] **Step 1（CP0）:** 顔と全身絵の食い違いを、顔を正にして決める。分かっている食い違い: 顔は淡い金髪（毛先が茶）・青い目・襟の内側に紺と金の十字、全身絵は白い法衣に黄の縁・青い十字の胸飾り・肩の黄色い襟の外套・白い靴。盾は全身絵の金の大きな盾に白の十字。顔に写る髪・襟・十字は顔、法衣・外套・靴は全身絵。セラ（白い肌・紫）・ミスト（黒のローブ）と並べたページを Artifact で見せる。新しい色見本は描く前に `probe_colors.py` で測る（白の法衣と輪郭・肌・淡い金髪の組に注意）
- [ ] **Step 2〜8:** Task 2 の Step 2〜8 と同じ（`ally14` を `ally10` に、CP1 の盾の大きさ選びはガンツの盾の複製の色替えの確認に置き換える。Step 3 の `orders` は `checks/ally14.json` の盾・拳の並びにローブの層を `checks/ally06.json` から足す。Step 4 はセラ・ミストと並べる。Step 5 の `sheets/ally10.txt` は `sheets/ally14.txt` の写し。Step 6 で変わる PNG は `ally10-map.png` だけ。Review Focus 3・4 を再生ページで見せ、結果を台帳に書く。コミット `feat: シオンのマップの絵を部品で組む`）

### Task 4: 引き継ぎ・台帳・最終レビュー

**Files:**
- Modify: `HANDOVER.md`
- Create: `docs/superpowers/ledgers/2026-11-27-unit-art-all-4.md`

- [ ] **Step 1:** HANDOVER の `## 進捗` を直す（盾の 2 人が済んだ。次は PR 6 の旗と翼の計画）。「工程 2・3 の結果」にガンツ・シオンの判断（食い違いの決め方・盾の大きさ・攻撃の形・Review Focus 3・4 の結果）を足す
- [ ] **Step 2:** 台帳を `docs/superpowers/ledgers/2026-11-27-unit-art-all-4.md` に写し、コミット `docs: 盾の 2 人を終えた引き継ぎと台帳`
- [ ] **Step 3:** ブランチ全体を最終レビューに出す。Minor も PR 前に直す（絵が変わるものは、単体→OK→組んだ絵の順で）。依頼者が頼んだら、develop 向けに PR を作って URL を伝えて止まる（マージは依頼者）
