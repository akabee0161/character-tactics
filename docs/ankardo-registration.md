# ankardo への登録手順

このゲームを `ankardo.com/play/character-tactics/` で公開するために、
ankardo リポジトリ側と GitHub 側で必要な作業をまとめる。
ankardo の `.claude/skills/new-game/SKILL.md` に対応する。

## 1. ankardo リポジトリに追加するファイル（別 PR）

`site/content/games/character-tactics.json`:

```json
{
  "slug": "character-tactics",
  "title": "とりでの なかまたち",
  "description": "4人のなかまを動かして、島のとりでを守るシミュレーションゲーム。",
  "playUrl": "/play/character-tactics/",
  "genre": "simulation",
  "ageRange": "6〜10歳",
  "players": "ひとり用",
  "difficulty": "ふつう"
}
```

`site/lib/games.ts` の `getAllGames()` がこのディレクトリを自動で拾うので、コード変更は不要。
ただし必須フィールドが欠けていたり `genre` が `site/lib/genres.ts` の `GENRES` のキーでない場合、
`next build` がビルド時検証で失敗する。`simulation` は定義済みのキー。

## 2. 人手が必要な作業

エージェントは実行しない。Cloudflare 認証情報を持つ担当者が行う。

- [ ] このリポジトリの GitHub Secrets を設定する

  ```bash
  CLOUDFLARE_API_TOKEN=... CLOUDFLARE_ACCOUNT_ID=... \
    ankardo/scripts/setup-game-secrets.sh akabee0161/character-tactics
  ```

  `gh auth login` 済みで、対象リポジトリへの admin 権限が必要。

- [ ] このリポジトリに `production` environment の保護ルールを設定する（必須レビュアー、`main` ブランチのみ許可）
- [ ] 初回の `wrangler deploy` を承認して実行する
- [ ] ankardo 側の `site/` を再ビルド・デプロイし、カタログ一覧と詳細ページに反映されたことを確認する
- [ ] `https://ankardo.com/play/character-tactics/` を実機（PC とスマホ横持ち）で開いて動作を確認する
