# とりでの なかまたち (character-tactics)

4人の仲間を率いて、敵の本拠地へ攻め込むリアルタイム侵攻シミュレーション。
[ankardo](https://ankardo.com) のサブリソースとして `ankardo.com/play/character-tactics/` で公開する。

- 設計: `docs/superpowers/specs/2026-08-28-invasion-pivot-design.md`
- 実装計画: `docs/superpowers/plans/2026-08-28-invasion-pivot.md`

## そうさ

| 操作 | 結果 |
|---|---|
| なかまをタップ | 選択する。もう一度タップで選択を外す |
| 下のポートレートをタップ | 同じく選択・解除 |
| なかまをドラッグして離す | 戦闘中はその地点へ移動 |
| 選択中に地面をタップ | 戦闘中はその地点へ移動 |

移動先は 4 人ぶんが常に表示される。選択中のなかまだけ、現在地から目的地への線が引かれる。交戦中は足が止まるためマーカーが薄くなり、交戦が解けたら残りの経路を再開する。配置中は、ドラッグ先が配置できないマス（壁など）だとプレビューの線と丸が赤く変わり、そのまま離しても失敗することが事前にわかる。

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
| `assets/` | ステージ・ユニット・敵・スキル・称号・セリフの定義（JSON）。ロジックを置かない |
| `src/engine/` | 定義の型検証・読み込み・索引。`core` を知らない |
| `src/core/` | 描画・DOM に依存しない純ロジック |
| `src/render/` | Canvas2D 描画 |
| `src/ui/` | 画面遷移・入力・吹き出しキュー |
| `src/save/` | localStorage の読み書き |

`src/core/**` と `src/engine/**` は `window` / `document` / `localStorage` を参照しない。

## コンテンツの足しかた

コードを書き換えずに足せるもの:

- **ステージ** — `assets/stages/<id>.json` を1本置く。ファイル名と `id` を一致させること
- **味方・同行 NPC** — `assets/units/<id>.json`。`combat: false` にすると攻撃しない同行者になる
- **敵** — `assets/enemies/<id>.json`
- **セリフ** — `assets/lines/*.json`
- **称号** — `assets/titles.json`。`counter` に使えるキーは `skill:<skillId>:uses` / `skill:<skillId>:hits` / `kill:neraiuchi` / `bond:supports`
- **絆** — `assets/bonds.json`

コードが要るもの:

- **新しいスキル** — `src/core/skills.ts` の `SKILL_EFFECTS` に効果を足し、`assets/skills.json` に数値を足す。`assets/skills.json` の各スキルには `params.cooldown`（秒）が必須
- **新しい AI パターン** — `src/core/ai.ts` の `AI_BEHAVIORS` に足し、`src/engine/schema.ts` の `AiDef` と `AI_KINDS` に variant を足す
- **新しい勝敗条件** — `src/engine/schema.ts` の `VictoryCond` / `DefeatCond` に variant を足し、`src/core/objectives.ts` で判定を書く

JSON が壊れていると起動時にエラー画面が出て止まる。どのファイルのどのフィールドがなぜ不正かが出るので、それを直すこと。

## デプロイ

`main` への push で GitHub Actions がビルドし、Cloudflare Workers Static Assets へデプロイする。

ビルド設定で注意する点:

- `vite.config.ts` の `base` は `/play/character-tactics/`
- `vite.config.ts` の `build.outDir` は `out/play/character-tactics`（`out` 直下にすると、パス付きルートの Workers では deploy が失敗する）
- `wrangler` は `^4` 系に固定し、CI の Node.js は 22 以上にする
