# CLAUDE.md

character-tactics で作業する際の指針。プロジェクトの詳細(構成・操作・コンテンツの足しかた)は README.md を参照。

## コミットメッセージ

- Conventional Commits(`feat:` / `fix:` / `refactor:` / `test:` / `docs:` / `chore:`) + 日本語の要約
- 要約は**通常の日本語(漢字仮名交じり)で書く。ひらがなのみに統一する必要はない**
- ゲーム内 UI の表示文字列は**漢字仮名交じり(常用漢字中心、ルビなし)で書く**。総ひらがなに統一しない。低学年でも読める語を選ぶ

## 開発コマンド

```bash
npm install
npm run dev     # 開発サーバ
npm test        # ユニットテスト (Vitest)
npm run build   # 型チェック + 本番ビルド (out/play/character-tactics/)
npm run balance # ステージの難易度を測る（ボットで全ステージを通し、勝率を表にする。40 シード、約 47 秒）
```

## テスト方針

描画コード(Canvas2D)にはユニットテストを書かない。テストは純ロジックとレイアウト計算に寄せ、見た目は README.md の CDP 手順(ヘッドレスブラウザ)で目視確認する。

## プルリクエスト

- PR の説明は `.github/pull_request_template.md` の5項目（概要・変更点・結果・リスク・確かめたこと）で書く（2026-10-05 依頼者と決めた。PR #28 で使った項目）
- PR は依頼者の指示があったときだけ作る

## ドット絵の確認の道具（2026-11-03 依頼者）

- `pixel-asset-forge/` の確認の道具は、依頼者が絵を1枚ずつ確かめなくて済むように作っている。道具で落ちたら、道具に従って絵を直して通す。直してよいか、道具の判定を変えてよいかを、途中で依頼者に聞かない
- `pixel-asset-forge/ISSUES.md` に記録済みの原因で落ちたときは、絵を変えず、ISSUES.md に記録して、その記録を添えて完成品を見せる
- 依頼者には、道具に従って直し終えた完成品を見せる。詳しくは `pixel-asset-forge/CLAUDE.md` の「確認の道具で落ちたら、道具に従って絵を直す」

## ドキュメントの扱い

- `docs/superpowers/`(specs / plans)は作成時点のログ。後から実装や運用が変わっても遡って更新しない
- `docs/superpowers/ledgers/` は進捗台帳（`.superpowers/sdd/<計画>/progress.md`）の写し。これもログ。計画を終えたら、その計画の台帳をここに写してコミットする
- 最新の状態を表す正典は README.md とこのファイル。実装・手順・制約が変わったら更新するのはこの2つ

## ブランチとプレビュー

- 機能ブランチから `develop` への PR を最初に作る。`develop` にマージすると、Cloudflare Access の受付の後ろに確認用のプレビューが固定の URL に自動で上がる（`.github/workflows/preview.yml`）
- 本番に出すときは、`develop` から `main` への PR をマージする（`deploy.yml` が本番に出す）
- `preview.yml` は `develop` への push だけで動き、`wrangler deploy` は書かない。`wrangler.toml` の `preview_urls = true` は確認用プレビューのためで、本番の `workers.dev` は開かない
- `develop` ができるまでの最初の PR（プレビューの導入そのもの）だけは `main` に向ける
