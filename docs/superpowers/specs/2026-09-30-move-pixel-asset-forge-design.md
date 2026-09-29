# pixel-asset-forge をゲームリポジトリへ移す（issue #6 の⑥・forge #8）設計

作成: 2026-09-30

## 目的

アセットを作るたびに pixel-asset-forge（以下 forge）と character-tactics の2つのリポジトリをまたいで作業している。これが大変なので、forge をゲームリポジトリへコピーする。ゲーム側では、エンジンを直しながらアセットを作れるようにする。

forge #8: https://github.com/akabee0161/pixel-asset-forge/issues/8

新しいゲームでも同じことができるように、コピーを ankardo の `new-game` スキルから半自動で行えるようにする。character-tactics はその最初の利用例とする。

## 決めたこと

依頼者の判断（2026-09-30）:

- forge を**丸ごと**コピーする。エンジン、規約（`types/*/SPEC.md`）、すべての絵のテキスト、`docs/`・`ISSUES.md`・`CLAUDE.md`・`README.md` を含め、今のゲームで使っていない絵も削らない
- 置き場所はゲームリポジトリの最上位の `pixel-asset-forge/`（リポジトリ名と同じ）。中の並びは forge と同じにする
- コピーのスクリプトは ankardo の `scripts/` に置き、`new-game` スキルから呼ぶ（`setup-game-secrets.sh` と同じ形）
- **forge とゲーム側のコピーは並行して開発する。** forge は凍結しない。forge の README にも何も書かない
- ゲーム側で出た改善点は、コピーの `UPSTREAM.md` に「forge に戻す候補」として書き溜める。ゲームの開発が終わったら、それを forge の issue にまとめて出す。取り込むときに、そのまま採用するか、抽象化してから入れるかを1件ずつ決める
- 開発の途中で forge が改善されても、ゲーム側へ取り込む仕組みは作らない。要るものは、その都度手で持ってくる
- Python（Pillow）とテストはゲーム側でも手元だけで動かす。CI には入れず、デプロイの `npm run build` にも Python を持ち込まない（2026-09-28 の方針のまま）
- 作った PNG は、対応表とスクリプトで `assets/images/` へ渡す（手でのコピーはやめる）
- リポジトリを分けておく意味が薄れていないかという懸念は、ankardo #17 に記録した。今は分けたままで進める

前提:

- コピー元は forge の main の `00ef131`（PR #7 のマージ）

## 1. ankardo: `scripts/copy-forge.sh`

```sh
./scripts/copy-forge.sh <ゲームリポジトリのパス>
```

- GitHub の forge（`https://github.com/akabee0161/pixel-asset-forge`）の main を一時フォルダに取得し、その最新 commit の中身（git 管理下のファイルだけ）を `<ゲームリポジトリ>/pixel-asset-forge/` へ書き出す。手元の forge の作業ツリーは使わない（未コミットの変更が混ざらないように）。`.git` や、git 管理外の `build/`・`.venv/` は入らない
- `pixel-asset-forge/UPSTREAM.md` を書く（下記）
- `pixel-asset-forge/` が既にあるときは、何も書かずにエラーで止まる（上書きしない）
- コミットはしない。ゲーム側で差分を見てから、人がコミットする

`UPSTREAM.md` の中身:

- コピー元のリポジトリ（`akabee0161/pixel-asset-forge`）、commit、コピーした日
- このフォルダはゲーム専用のコピーであり、自由に直してよいこと
- 「forge に戻す候補」の欄（最初は空）。ゲーム側でエンジンや規約を直したら、ここに1行足す
- ゲームの開発が終わったら、候補と「コピー元の commit からの差分」を材料に forge の issue を出すこと

`new-game` スキル（`.claude/skills/new-game/SKILL.md`）に、「ドット絵を使うなら」という手順を1つ足す。このスクリプトの呼び方と、コピーした後にゲーム側で行うこと（対応表を書く・書き出す）を書く。

## 2. character-tactics

### コピー

- `copy-forge.sh` で `pixel-asset-forge/` を作り、そのままコミットする（ゲーム側の変更と分けて、1つのコミットにする）

### 対応表

- ゲームのルートに置く（例: `sprites.json`）。ゲーム専用なので、コピーした forge の外に置く
- 「forge の `build/` からの相対パス → 書き出し先のファイル名」の組を並べる。書き出し先のフォルダは対応表には書かず、スクリプトの引数で渡す（character-tactics では `assets/images`）。今は次の6組:

| forge の生成物 | ゲームのファイル |
|---|---|
| `build/tile/plain.png` | `tile-plain.png` |
| `build/tile/forest.png` | `tile-forest.png` |
| `build/sets/village.png` | `tile-village.png` |
| `build/sets/rock.png` | `tile-rock.png` |
| `build/sets/tree.png` | `tile-tree.png` |
| `build/sheets/roran.png` | `roran-map.png` |

- 村・岩・木は `build/sets/`（32px）から取る。`build/tile/` にある同名の 16px の旧版は使わない（README に注意書きがある取り違えを、対応表で固定する）

### 書き出しのスクリプト

- `pixel-asset-forge/tools/` に足す（例: `export.py`）。対応表のパスと書き出し先のフォルダを引数に取り、forge のビルド（`render.py`・`sets.py`・`sheet.py`）を行ってから、対応表どおりにコピーする
- どのゲームでも使えるので、`UPSTREAM.md` の「forge に戻す候補」の1件目にする
- 次の場合はエラーで止まり、何もコピーしない:
  - 対応表の形が正しくない（JSON として読めない、組の中身が文字列でない など）
  - 対応表が指す生成物が `build/` に無い（ビルドされていない、名前の誤り）
  - 生成物のパスが `build/` の外を指す、または書き出し先のファイル名にパスの区切り（`/`）を含む

### ドキュメント

- README の「絵は pixel-asset-forge で作り、PNG をここへコピーしている」と、タイルのコピー元の説明（`build/tile/`・`build/sets/` の取り違えの注意）を、`pixel-asset-forge/` と対応表・書き出しの手順に書き換える
- `assets/images/README.txt` も同様に直す
- HANDOVER の「アセットのテキストとビルドの移設」を、終わったこととして書き換える

## 3. forge

- #8 に結果（ゲーム側の置き場所・コピー元の commit・`UPSTREAM.md` のこと）を書いて閉じる
- コードとドキュメントは変えない

## 確かめ方

### 移設が正しくできたか

- 移設後に character-tactics で「ビルド → 書き出し」を実行し、上の6枚の `git diff` が空であることを確かめる。空なら、対応表もコピーも正しい
- `roran-map.png` は、forge の #5（20コマの描き直し）より前にコピーした可能性がある。差分が出たら、その時点で止めて依頼者に報告し、新しい絵にするかどうかを決めてもらう。ほかの5枚で差分が出たときも、止めて報告する

### テスト

- 書き出しのスクリプト: forge のほかの道具と同じく `unittest` で、TDD で作る。上の「エラーで止まる」3つの場合を含める。テストは `pixel-asset-forge/tests/` に置き、forge と同じ手順で手元で走らせる
- `copy-forge.sh`: 一時フォルダに空の git リポジトリを作って実行し、次の3点を確かめる
  - 書き出した中身が forge の commit の中身と一致する
  - `UPSTREAM.md` が書かれ、コピー元の commit が入っている
  - `pixel-asset-forge/` が既にあるときは止まり、中身が変わらない
- character-tactics の `npm test` と `npm run build` が通ること（ゲームのコードは変えないが、`assets/images/` を書き出し直すため）

## 作業の順番

1. ankardo: `copy-forge.sh` を作り、`new-game` スキルを更新する
2. character-tactics: コピー → 書き出しのスクリプトと対応表 → 6枚に差分が無いことの確認 → README・HANDOVER の更新
3. forge: #8 に結果を書いて閉じる

PR はリポジトリごとに分かれる（ankardo と character-tactics）。PR は依頼者の指示で作る。

## 範囲外

- forge の改善をゲーム側へ取り込む仕組み
- forge を ankardo に統合するかどうか（ankardo #17）
- Python のテストを CI で走らせること
- ゲームで使っていない絵の整理
