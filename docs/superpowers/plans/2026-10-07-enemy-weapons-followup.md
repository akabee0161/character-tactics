# 斧・槍の敵の後始末 計画（2026-10-07・親計画 2026-10-06-enemy-parts.md の段階4の前に挟む）

親計画の段階3（斧・槍）を 2026-10-07 に終え、承認済みの見た目の4体の武器を短剣から替えた
（眼帯のバンダナ・角付きの兜＝斧、フルフェイス・ごろつき＝槍。コミット 97435ed）。
その途中で計画の外の作業（`tools/weapon_check.py`、再生ページの速さ・1コマ送り、斧だけの見本）をした。
親計画の段階4（全体を1回レビュー）に戻る前に、この計画の T1〜T6 を行う（依頼者と合意、2026-10-07）。

作業ディレクトリは `pixel-asset-forge/`。進捗の台帳は `.superpowers/sdd/2026-10-06-enemy-variants/progress.md`（同じ台帳に続けて書く）。

## 前提（この計画を始める前に知っておくこと）

- **4体の正のコマは `cand/enemy-frames/<id>/`**（`axe-bandit` `axe-horn` `spear-knight` `spear-thug`）。生成は `cand/gen/mkweapons.py`（`mkframes.py` の素体＋部品に武器を重ねる）。色は未適用（`cloak_dark_*`）で、色は `enemy/dagger-*.json` の `recolor` を使う
- **`enemy_build.py` は `cand/enemy-frames/` を読まない。** どのレシピでも、元のコマはガウの完成コマ（`assets/unit/gau/`）になる。確認ページのシートは、セッション中に `/tmp` の一時スクリプトで作った（リポジトリには無い）
- 短剣の4体（`cand/enemy-frames/dagger-*`）は**残す**（依頼者「使うかもしれない」）。ただし短剣の攻撃のコマは承認されていない（承認されたのは見た目＝頭・目・服・色だけ）
- `cand/gen/mkframes.py` の短剣の攻撃コマは `/tmp/cand2`（ガウの組み直しコマ）に依存する。**短剣の4体のコマは作り直さない**（作り直すなら先に `/tmp/cand2` を作り直す）
- 絵を変えたら、見せて承認を得るまでコミット・書き出しへ進まない。見せ方は、PNG を data URI で埋め込んだ HTML を Artifact で公開してリンクを渡す。動きは `tools/enemy_gallery.py` の再生ページ（速さ 1/2・1/4、1コマ送りあり）
- 依頼者への返答は日本語
- push と PR は依頼者の指示があったときだけ

## T1: ガウを色替えしただけの敵3体を消す

依頼者「ガウの色違いは必要ない」（2026-10-07）。

- 消す: `enemy/dagger-red-m.json` `enemy/dagger-green-m.json` `enemy/dagger-violet-m.json`（`build/` の生成物は gitignore なので任意）
- 残す: `enemy/dagger-bandit.json` `dagger-knight.json` `dagger-horn.json` `dagger-thug.json`（4体の色。斧・槍の4体もこの色を使う）
- 例に `dagger-red-m.json` を使っている所を、残るレシピに直す: `CLAUDE.md`（54行目付近）、`README.md`（332行目付近）、`tools/enemy_build.py` の docstring
- `tests/test_enemy_gallery.py` は id の文字列を使うだけでファイルを読まないので、そのままでよい
- 確かめる: `.venv/bin/python -m unittest discover -s tests`
- 絵は変わらないので、確認ポイントなしでコミットしてよい（`chore:`）

## T2: 部品で組んだコマからシートを作る道筋を作る（確認ポイント: 作る前に方針を見せる）

困っていること: 段階4のレビューと T9（ゲームへの書き出し）に、4体の正のコマ（`cand/enemy-frames/`）からシートを作る手順がリポジトリに無い。

- **作る前に、方針を依頼者に見せて止まる。** 案（どれにするかは依頼者が決める）:
  - 案a: レシピに元のコマの置き場（例 `"frames": "cand/enemy-frames/axe-bandit"`）を書けるようにし、`enemy_build.py` がそこを読む。原型（`archetype`）に `axe` `spear` を足す（シート定義はどれも `sheets/gau.txt`）
  - 案b: `cand/gen/` に4体のシートを作るスクリプトを置く（`enemy_build.py` は変えない）。T9 でまた考える
- 案aなら `tests/test_enemy_build.py` にテストを足す（`tests/` から `cand/` の現役のコマを読まない。`tempfile` に小さなグリッドを書く）
- 4体のレシピ（`enemy/axe-bandit.json` など）を足すかどうかも方針と一緒に決める。色は対応する `dagger-*` と同じ
- できたら、4体（と短剣の4体）を `enemy_gallery.py` の再生ページで見られることを確かめる

## T3: 4体の `weapon_check.py` の指定を正典に書く

`types/unit/SPEC.md` の自己チェック①（ガウ・ロランの指定の隣）に足す。台帳にしか無いと、次に直す人が同じ条件で検査できない。

```sh
C="--blade stone_hi,stone_base --weapon wood_base,wood_shadow --hand skin_rose_hi,skin_rose_base,skin_rose_shadow --arm cloak_dark_hi,cloak_dark_base,cloak_dark_shadow"
# 斧（axe-bandit・axe-horn）
.venv/bin/python tools/weapon_check.py cand/enemy-frames/axe-bandit $C --hidden up_atk_wind,up_atk_hit --depth down,up \
    --partial left_base,left_idle2,left_walk_a,left_walk_b,left_atk_wind
# 槍（spear-knight・spear-thug）
.venv/bin/python tools/weapon_check.py cand/enemy-frames/spear-knight $C --hidden left_atk_hit
```

- 斧の up の攻撃は axe head が木の棒に隠れ（振りかぶり）、体の向こうに隠れる（当たり）ので `--hidden`。down・up は奥行きの表現なので `--depth`
- **right は例外に入れない**（握る手が体の手前側なので武器も手前。right を例外に入れて欠陥を見逃した、2026-10-07）
- 2026-10-07 の時点で4体とも全項目を通る

## T4: 武器を描くときの決まりを正典に書く

`types/unit/SPEC.md` に「武器を描くときの決まり」として足す（コメント `cand/gen/mkweapons.py` と台帳にしか無い）。斧で合意した見え方（2026-10-07、`build/axe_views.html` の見本）:

- 武器の形は、物だけを向きごとに描いた見本で先に合わせてから、攻撃のコマに当てはめる
- 視点は前から見ている（斜め上から見下ろす前提で描かない）
- 斧は太い木の棒の一端に axe head。前を向くとき刃は木の前、後ろを向くとき刃は木の後ろ。真後ろにあれば木の棒に隠れて見えない
- 刃を手前・奥へ向けた axe head は木の棒と同じ幅（1px）
- 振り下ろした後（45度ほど）は、木の棒がほぼ見えて先端だけ axe head がのぞく。棒は少し短く（45度の分）
- 攻撃のコマで刃は相手の側を向く。left・right の当たりは剣と同じ斜め45度
- 武器を握る手は、他の手と同じ大きさ（柄をまたいで3px × 柄に沿って2px）。横の柄でも柄の上下に1pxずつはみ出す
- 振りかぶりで手を上げたら、体と手の間に腕（袖）を描く（空白にしない）
- right は握る手が体の手前側なので、武器も体の手前に描く（left を反転した重なり順を引き継がない）。手前に描く武器は輪郭を一周閉じる（同じ色の兜や顔に刃が直に接しないように）

## T5: ガウ・ロランの left の立ち・歩きの 1px の手を直す（確認ポイント）

依頼者「修正の必要がある」、「計画の中に入れて修正」（2026-10-07）。ISSUES.md の「left 向きの立ち・歩きで、武器を持つ手が 1px 幅」。

- 対象: `assets/unit/gau/left_{base,idle2,walk_a,walk_b}.txt`、`assets/unit/roran/left_{base,idle2,walk_a,walk_b}.txt`（8コマ）
- 直し方: 槍兵の案と同じく、奥の手（x21）を2px幅の拳にして武器の上に描く（`cand/gen/mkweapons.py` の `FIST_BACK_L` = `["ooo.", "obbo", "obco", "ooo."]` を (20,17) に。idle2 は2px上）。各ユニットの文字（`# map:`）で描くこと
- 確かめる: `validate.py`、`unit_check.py`（ロラン `--items GHJRkmns`、ガウ `--items stlmn`）、`weapon_check.py`（ガウ・ロランの指定は SPEC。直したら「手が細い」が消える）、`sheet.py` のプレビューの足元ライン
- 再生ページで見せて止まる。承認後にコミットし、ISSUES.md の該当行を消す
- ゲームへの書き出し（`tools/export.py`）をするかは、承認のときに依頼者に聞く

## T6: ガウの right の振りかぶりで浮いた手を直す（確認ポイント）

依頼者「計画の中に入れて修正」（2026-10-07）。ISSUES.md の「ガウの right の振りかぶりで、手が体から浮いて見える」。

- 対象: `assets/unit/gau/right_atk_wind.txt`（握る手 x9〜11, y17〜18 が袖・腕とつながっていない）
- 直し方: 斧の振りかぶりと同じく、体と手の間に腕（袖）を描く。他のコマ（ロランの right_atk_wind など）の腕のつながり方を手本にする
- 確かめる: `weapon_check.py`（「手が体から浮いている」が消える）、`validate.py`、`unit_check.py`
- 再生ページで見せて止まる。承認後にコミットし、ISSUES.md の該当行を消す。書き出しは T5 と同じく依頼者に聞く
- 注意: 短剣の4体（`cand/enemy-frames/dagger-*`）の攻撃コマは、ガウの完成コマとの差から作られている。ガウを直しても短剣の4体は自動では変わらない（作り直さない。前提を参照）

## T7: 小さな記録

- ISSUES.md に足す: `cand/gen/mkframes.py` が `sys.path` の先頭に `/tmp` を入れている（`/tmp` に同じ名前のファイルがあると部品を取り違える）。直すのは任意

## この計画の後

親計画 `2026-10-06-enemy-parts.md` の段階4（全体を1回レビュー）へ戻る。その後、親の親 `2026-10-06-enemy-variants.md` の止めている T6〜T9（女性素体・ゲームへの書き出し）と、段階2・3（剣盾・弓）をどうするかを依頼者に決めてもらう。
