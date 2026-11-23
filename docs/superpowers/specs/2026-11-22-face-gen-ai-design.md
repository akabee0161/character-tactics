# 顔グラを生成 AI で作る（設計）

2026-11-22 依頼者と相談して決めた。

## 意図

character-tactics の顔グラは、ドット絵で描く方法が保留になっていた。ボルグ（ally05）で、illust-asset-forge（以下 forge）が生成したイラストを顔に使う試しがうまくいき、画風も thick-line-flat に決まった。そこで、顔グラをすべて forge で作る。

forge は、web-novel-engine の作品の立ち絵などにも使いたい。ただ、完全な汎用化は難しく、作品ごとの作り込みも要る。そこで pixel-asset-forge と同じく、forge には汎用の部品だけを置き、各作品のリポジトリへ丸ごとコピーして使う方式（取り込み方式）にする。

## 工程

| 工程 | 中身 |
|---|---|
| 1. 取り込み方式にする | この設計書の対象。計画は `docs/superpowers/plans/2026-11-22-face-gen-ai-step1.md` |
| 2. ボルグを新しい画風で作り直す | character-tactics のコピーから Colab で作る。コピーから Colab が動くことの確認を兼ねる |
| 3. 表示の大きさと顔の構図を決める | 作り直したボルグで、64px・32px の欄の見え方を試して決める。構図を変えるなら、ボルグをもう一度作り直す |
| 4. 残りの顔グラ 26 枚を作る | 仲間・敵・村人。何回かに分ける |

工程 2〜4 の中身は、前の工程の結果で変わるため、その都度相談して決める。この設計書は工程 1 だけを決める。

ノベルの立ち絵の種類を forge に足すことは、具体的な作品の計画が無いので、この作業に入れない（依頼者）。

## 目標・目標でないこと

目標:

- forge に、作品ごとのもの（キャラクター）を持たず、汎用の部品と見本だけを置く
- forge のノートブックを、コピーした先のリポジトリから動かせるようにする
- character-tactics に forge のコピーを置き、以後の顔グラの作業をそこで行えるようにする

目標でないこと:

- 立ち絵などの新しい絵の種類（上記）
- forge の改善をコピーへ自動で届ける仕組み（pixel-asset-forge と同じく、手で持ってくる）
- ゲームに出ている顔（`assets/images/ally05-face.png` など）の差し替え（工程 2 以降）
- Colab での動作の確認（サーバーに GPU が無い。工程 2 の最初に依頼者が確かめる）

失敗とみなすこと:

- コピーした先のノートブックが、forge 本体（`akabee0161/illust-asset-forge`）を取ってきてしまう、または forge 本体と同じ Drive の置き場に候補を書く。作品の候補と forge の見本が混ざる
- 汎用の forge に、ゲームの ID（`ally05` など）や、見比べのときの仮の画風の名前（`tlf-r2-b` など）が残る。設定にも、見本の PNG の条件にも残さない（依頼者）

## 進め方の案（Approaches）

| 案 | 中身 | 採否 |
|---|---|---|
| A. 取り込み方式 | forge を各作品のリポジトリへ丸ごとコピーし、コピー元の commit と「forge に戻す候補」を `UPSTREAM.md` に書く。pixel-asset-forge と同じ | **採用**（依頼者の提案） |
| B. 完全な汎用化 | forge を 1 か所に置いたまま、作品ごとの設定を外から渡して使う | 不採用。作品ごとの作り込み（テンプレート・画風・道具の直し）が forge 本体を汚すか、設定の仕組みが重くなる |
| C. forge の中で作品ごとにフォルダを分ける | `characters/<作品>/<id>/` のようにする | 不採用。作品ごとの作り込みができず、ゲームの事情を forge に持ち込むことになる |

A の弱点: 1 つのコピーで画風や道具を直しても、ほかのコピーには届かない。直したら `UPSTREAM.md` の「forge に戻す候補」に 1 行書き、必要なときに手で forge へ戻す。

## 工程 1 の設計

### forge 側（illust-asset-forge に PR を 1 つ）

進め方: Claude が設定を直してブランチを push する → 依頼者がそのブランチから Colab で見本を作る → Claude が見本を取り込んで書き出す → PR → マージ。

1. **ノートブックの取得先と置き場を変数にする**
   - 今のノートブック（`notebooks/run.ipynb`）の準備のセルは、`https://github.com/akabee0161/illust-asset-forge.git` を `/content/illust-asset-forge` に clone し、そこを forge の根にしている。Drive の置き場は `forge.attach()` の既定 `/content/drive/MyDrive/illust-asset-forge` を使っている（`attach()` は `base_dir` を引数で受け取れる）
   - 準備のセルの先頭に、次の 4 つの変数を置く。既定値は forge 本体のもの
     - `REPO_URL`: clone するリポジトリ（既定 `https://github.com/akabee0161/illust-asset-forge.git`）
     - `REPO_BRANCH`: 取るブランチ（既定 `main`）。依頼者が push 前の main でなく作業ブランチから見本を作るため、また character-tactics で develop から使えるようにするため
     - `SUBDIR`: そのリポジトリの中の forge の根（既定 `""` = リポジトリの根）
     - `DRIVE_DIR`: Drive の置き場（既定 `/content/drive/MyDrive/illust-asset-forge`）
   - clone 先は今と同じ 1 か所（`/content/<リポジトリ名>` など。builder の判断）、forge の根は `<clone 先>/<SUBDIR>`。`os.chdir`・`sys.path`・`pip install` はその根に対して行う
   - 2 回目以降に準備のセルを実行し直したときは、`REPO_BRANCH` に切り替えてから pull する（ブランチを変えて実行し直したときに古いブランチのままにならないように）
   - `F.attach(pipe, ".", base_dir=DRIVE_DIR)` にする（モデルの読み込みのセルも同じ）
   - 既に clone 済みで、clone 先が別のリポジトリなら止める（`REPO_URL` を変えたのに古い clone を使い続けないように）。止め方は builder の判断
   - `tests/test_notebook.py` に、4 つの変数があり既定値が forge 本体のものであること、`attach` に `DRIVE_DIR` を渡していることのテストを足す
   - README のノートブックの手順と、コピーして使うときの説明（4 つの変数を書き換える）を足す
2. **キャラクターを汎用の見本 4 人に入れ替える**
   - 今の `characters/ally05`（ボルグ）・`characters/ally06`（セラ）は、ゲームの ID と、ゲームのための絵（ボルグは color-anime の採用・書き出し済みの絵）を持っている。汎用の forge に置くのはおかしい（依頼者）ので、2 人とも forge から消す（古い絵は git の履歴に残る）
   - 代わりに、汎用の ID の見本を 4 人置く（ID・表示名は Claude の案を依頼者が承認）:

     | ID | 表示名 | タグ | 作り方 |
     |---|---|---|---|
     | `knight` | 騎士 | 今の ally05（ボルグ）の `character.yaml` と同じ（`subject`・`appearance`・`outfit`・`items`・`expressions`） | シード固定。顔・全身とも 3034254740 |
     | `mage` | 魔法使い | 今の ally06（セラ）の `character.yaml` と同じ | シード固定。顔 3034254740・全身 4074111561 |
     | `schoolboy` | 男子生徒 | subject `1boy, solo, teenage boy`／appearance `short hair, black hair, brown eyes`／outfit `school uniform, blazer, white shirt, necktie, trousers`／items なし | 候補を作って依頼者が選ぶ |
     | `schoolgirl` | 女子生徒 | subject `1girl, solo, teenage girl`／appearance `medium hair, brown hair, brown eyes`／outfit `school uniform, blazer, white shirt, ribbon, pleated skirt`／items なし | 候補を作って依頼者が選ぶ |

   - 制服の 2 人はファンタジーの要素が無い現代の制服姿（依頼者）。制服は男女ともブレザー（Claude の案を依頼者が承認）
   - 4 人とも `style` は書かない（デフォルトの thick-line-flat）。表情は 3 つ（`normal`・`hurt`・`shout`）を書く。騎士・魔法使いは今の ally05・ally06 の表情のタグをそのまま、制服の 2 人は ally06 と同じタグにする（`default_expression: normal`）。`inpaint_box` は書かない（表情の範囲は依頼者がノートブックで決めるもので、見本では表情を作らない）
   - 騎士・魔法使いのシードは、画風を洗練したときに依頼者が選んだ 4 枚（Drive の `ally05_face_tlf-r2-b_3034254740.png`・`ally05_fullbody_tlf-r2-b_3034254740.png`・`ally06_face_tlf-r2-b_3034254740.png`・`ally06_fullbody_tlf-r2-b_4074111561.png`）のもの。この 4 枚の条件は、画風の定義が今の thick-line-flat と同じで、今の設定で組み直したプロンプトとも完全に一致することを確かめた（2026-11-22）。キャラクターの ID と画風の名前はプロンプトに入らないので、同じシードで作れば同じプロンプトになり、ほぼ同じ絵が出る見込み（GPU とライブラリの版も同じ。完全な再現は保証されない）。4 枚そのものは取り込まない（条件に ID `ally05`・画風名 `tlf-r2-b` が残るため。依頼者）
3. **依頼者が Colab で見本を作る**（Claude はこの手順を README の見本の節か PR の説明に書いて渡す）
   - `REPO_BRANCH` を作業ブランチにして準備のセルを実行する
   - 騎士・魔法使い: 指定のシードで顔・全身を作る（`forge.generate(["knight"], "face", seeds=[3034254740])` など）
   - 男子生徒・女子生徒: 顔の候補を作って選び、全身の候補を作って選ぶ
   - 顔は 4 人とも左向きで採用する（右向きに出たら「左右反転して採用」。騎士・魔法使いの元の顔は右向きだった）
   - 合計 8 枚（4 人 × 顔・全身）。表情は作らない
4. **Claude が見本を取り込み、書き出す**
   - 採用した 8 枚を、Google Drive のコネクターで Drive の置き場の `selected/<id>/` から取る。`download_file_content` で PNG はバイトのまま届き、生成の条件も残ることを確かめ済み（2026-11-22）。1 枚取るごとに絵が会話に入る
   - 取ってきた絵を `selected/<id>/` の形に置き、今の流れで取り込む（`install_selection`・書き戻しの一覧を確かめる・`python -m artgen.export <id>`）。zip は使わない
   - 取り込みの検査（名前・条件・キャラクターの一致）で止まったら、依頼者に知らせる
5. **文書を直す**
   - README・HANDOVER の、ボルグ・セラを書いている記述を、見本 4 人の記述に直す（ゲームの名前は書かない。forge の CLAUDE.md の決まり）
   - CLAUDE.md の「受け取った画像の扱い」に、Drive のコネクターから取る流れを足す（zip の流れは残す）

### ankardo 側（main へ PR を 1 つ。forge の PR のマージ後）

新しいゲームを作る手順は、ankardo のスキル `new-game`（`.claude/skills/new-game/SKILL.md`）に既にある。pixel-asset-forge をゲームへコピーする節「ドット絵を使うなら」と、コピーのスクリプト `scripts/copy-forge.sh`（テスト `scripts/copy-forge.test.sh`）もある。足りないのは illust-asset-forge の分だけなので、同じ形で足す（依頼者「基本的な考え方は pixel-asset-forge と同様」）。

1. **`copy-forge.sh` で、どちらの forge をコピーするかを引数で選べるようにする**（依頼者が案 A を選んだ。ほかの案は、illust 用のスクリプトを別に作る B（60 行ほどが重複する）、スクリプトを作らず手順だけ書く C（除くファイルや `UPSTREAM.md` を毎回手で作るので間違えやすい））
   - 使い方を `./scripts/copy-forge.sh <pixel|illust> <ゲームリポジトリのパス>` にする。1 回の実行で 1 つ。両方使うゲームは 2 回実行し、使わないゲームは実行しない
   - `pixel` は今と同じ動き（コピー元 `https://github.com/akabee0161/pixel-asset-forge.git`、コピー先 `pixel-asset-forge/`）
   - `illust` はコピー元 `https://github.com/akabee0161/illust-asset-forge.git`、コピー先 `illust-asset-forge/`。`HANDOVER.md` と `docs/superpowers/` は持ち込まない（引き継ぎはゲームの `HANDOVER.md` 1 つにする。forge の当時のログはゲームのログではない）
   - `UPSTREAM.md` の中身は今と同じ形で、forge の名前だけが変わる
   - 引数の 1 つ目が `pixel`・`illust` 以外なら止まる。テスト用の `FORGE_URL` の上書きは残す
   - `copy-forge.test.sh` を両方の forge で確かめるように直す（`illust` で `HANDOVER.md`・`docs/superpowers/` が入らないこと、引数の誤りで止まることを足す）
2. **`new-game` の SKILL.md に「イラストを使うなら（illust-asset-forge）」の節を足す**（「ドット絵を使うなら」と同じ形）
   - コピーする: `./scripts/copy-forge.sh illust <ゲームリポジトリのパス>`
   - コピーした後にゲーム側で行うこと: ノートブックの 4 つの変数を、そのゲームのリポジトリの URL・`develop`・`illust-asset-forge`・ゲームごとの Drive の置き場（`/content/drive/MyDrive/<ゲームのリポジトリ名>/illust-asset-forge`）に書き換える。`tests/test_notebook.py` の既定値のテストをその値に合わせ、`UPSTREAM.md` に 1 行書く。コピーの `CLAUDE.md` の「ゲーム側の事情を書かない」を書き換える。venv を作り（`uv venv illust-asset-forge/.venv && uv pip install --python illust-asset-forge/.venv/bin/python -e 'illust-asset-forge[dev]'` など）テストを通す。GPU を使う処理は依頼者が Colab で動かす
   - forge とコピーの関係は、pixel-asset-forge と同じ（ゲーム側で自由に直してよい、直したら「forge に戻す候補」に 1 行、forge の改善は手で持ってくる）
   - 「ドット絵を使うなら」の `copy-forge.sh` の呼び方を、新しい使い方（`pixel` を付ける）に直す
   - 経緯: この設計書へのリンク
3. ankardo の README の、`copy-forge.sh` に触れている箇所があれば合わせて直す

### character-tactics 側（develop へ PR を 1 つ。forge と ankardo の PR のマージ後）

1. **forge をコピーする**
   - ankardo の `./scripts/copy-forge.sh illust <character-tactics のパス>` でコピーする（手順の最初の確かめを兼ねる）。forge の main の中身が `illust-asset-forge/` に入り、`UPSTREAM.md` ができる。`HANDOVER.md`・`docs/superpowers/` は入らない
   - `.gitignore`（`illust-asset-forge/.gitignore` か根の `.gitignore`）で `.venv/`・`__pycache__/` などがコミットされないようにする。forge 自身の `.gitignore` がコピーされれば足りるかを確かめる
2. **ノートブックを character-tactics 向けにする**
   - `REPO_URL` を `https://github.com/akabee0161/character-tactics.git`、`REPO_BRANCH` を `develop`、`SUBDIR` を `illust-asset-forge`、`DRIVE_DIR` を `/content/drive/MyDrive/character-tactics/illust-asset-forge` にする（Drive の置き場は Claude の判断。forge 本体の置き場と混ざらなければよい。`develop` にするのは、機能ブランチを develop へマージした時点で Colab に届くようにするため）
   - forge の `tests/test_notebook.py` は既定値が forge 本体のものであることを確かめるので、コピーではこのテストを character-tactics の値に合わせて直し、`UPSTREAM.md` に 1 行書く
3. **キャラクター**
   - コピーには forge の見本 4 人（`knight`・`mage`・`schoolboy`・`schoolgirl`）が入る。画風と構図の手本として、そのまま残す（Claude の判断）
   - ゲームのボルグ・セラを、コピーの中に `characters/ally05/character.yaml`・`characters/ally06/character.yaml` として置き直す。中身は forge の commit `9627e8d` の同じファイル（`style` の行は無い。ボルグの `inpaint_box` は古い顔に合わせた値なので外す）。絵（`source/`・書き出し）は置かない。ボルグは工程 2 で作る。セラは工程 4 で作る
   - ゲームに出ている `assets/images/ally05-face.png` は、forge の古い color-anime の絵から作ったもので、工程 2 で差し替えるまでそのまま
4. **正典を直す**
   - README「顔グラの例外」: 元画像の場所が forge の `characters/ally05/source/face.png` を指している。forge から消えるので、forge の commit `9627e8d` の同じパスを指すように直す
   - README の構成の表に `illust-asset-forge/` の行を足す（pixel-asset-forge の行と同じ書き方）。「ドット絵の作りかた」と並べて、イラスト（顔グラ）の作りかたの節を足し、`illust-asset-forge/README.md` へ案内する
   - CLAUDE.md に、`illust-asset-forge/` の作業規約は `illust-asset-forge/CLAUDE.md` に従うこと、エンジン・道具を直したら `UPSTREAM.md` に 1 行足すことを書く
   - コピーの中の `illust-asset-forge/CLAUDE.md` の「リポジトリにゲーム側の事情を書かない」は、このゲーム専用のコピーでは当てはまらないので消すか書き換える

### 確かめ方

- forge・コピーの両方で `pytest` を通す（GPU なしで動く部分。見本 4 人とボルグ・セラの設定が、すべてのテンプレート・表情で組み立てられることを `tests/test_repo_configs.py` が見る）
- forge で、取り込んだ見本 8 枚の条件の `character` が見本の ID、`style` が `thick-line-flat` であること（`python -m artgen.pnginfo`）、書き戻しの一覧に画風が出ないこと、`python -m artgen.export <id>` が 4 人とも通ること
- 騎士・魔法使いの顔・全身が、指定した 4 枚とほぼ同じ絵になったかは、Claude が並べて依頼者に見せる。大きく違っても作り直すかは依頼者が決める
- Colab での確認のうち、forge 本体から動くことは見本を作るときに、character-tactics のコピーから動くことは工程 2 の最初に、依頼者が行う

## builder に任せること

- ノートブックの clone 先の名前、別のリポジトリの古い clone を検出したときの止め方
- forge の README の見本の説明の書き方
