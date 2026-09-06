# CLAUDE.md

character-tactics で作業する際の指針。プロジェクトの詳細(構成・操作・コンテンツの足しかた)は README.md を参照。

## コミットメッセージ

- Conventional Commits(`feat:` / `fix:` / `refactor:` / `test:` / `docs:` / `chore:`) + 日本語の要約
- 要約は**通常の日本語(漢字仮名交じり)で書く。ひらがなのみに統一する必要はない**
- 「画面に出す文字は総ひらがな(子ども向けの表記)」という方針はゲーム内 UI の表示文字列にのみ適用する。コミットメッセージ・ドキュメント・コードコメントには適用しない

## 開発コマンド

```bash
npm install
npm run dev     # 開発サーバ
npm test        # ユニットテスト (Vitest)
npm run build   # 型チェック + 本番ビルド (out/play/character-tactics/)
```

## テスト方針

描画コード(Canvas2D)にはユニットテストを書かない。テストは純ロジックとレイアウト計算に寄せ、見た目は README.md の CDP 手順(ヘッドレスブラウザ)で目視確認する。

## ドキュメントの扱い

- `docs/superpowers/`(specs / plans)は作成時点のログ。後から実装や運用が変わっても遡って更新しない
- 最新の状態を表す正典は README.md とこのファイル。実装・手順・制約が変わったら更新するのはこの2つ
