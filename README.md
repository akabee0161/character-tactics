# とりでの なかまたち (character-tactics)

小さな島の砦を、4人の仲間で守るリアルタイム防衛シミュレーション。
[ankardo](https://ankardo.com) のサブリソースとして `ankardo.com/play/character-tactics/` で公開する。

- 設計: `docs/superpowers/specs/2026-08-17-character-tactics-design.md`
- 実装計画: `docs/superpowers/plans/2026-08-17-character-tactics.md`

## 開発

必要なもの: Node.js 22 以上

```bash
npm install
npm run dev     # 開発サーバ
npm test        # ユニットテスト (Vitest)
npm run build   # 型チェック + 本番ビルド (out/play/character-tactics/)
```

## 構成

| ディレクトリ | 責務 |
|---|---|
| `src/core/` | 描画・DOM に依存しない純ロジック。ここだけでゲームのルールが完結する |
| `src/content/` | キャラ・敵・セリフ・ステージのデータ。ロジックを置かない |
| `src/render/` | Canvas2D 描画。`core` の状態を読むだけで書き換えない |
| `src/ui/` | 画面遷移・入力・吹き出しキュー |
| `src/save/` | localStorage の読み書き |

`src/core/**` と `src/content/**` は `window` / `document` / `localStorage` を参照しない。

## デプロイ

`main` への push で GitHub Actions がビルドし、Cloudflare Workers Static Assets へデプロイする。

ビルド設定で注意する点:

- `vite.config.ts` の `base` は `/play/character-tactics/`
- `vite.config.ts` の `build.outDir` は `out/play/character-tactics`（`out` 直下にすると、パス付きルートの Workers では deploy が失敗する）
- `wrangler` は `^4` 系に固定し、CI の Node.js は 22 以上にする
