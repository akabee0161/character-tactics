# 戦闘フィードバック強化（エフェクトシステム）

作成日: 2026-09-04

## 1. 目的

「戦っている実感」を得られるようにする。現状は、攻撃がヒットしても円が0.25秒表示されるだけ、
回復は何も見えない、ダメージ量もHPバーの減りでしか分からない、必殺技はステージ中1回きりの
使い切りでクールダウンの概念がない。これらを補強し、後日ドット絵アセットに差し替える前提の
プレースホルダー図形（円・線・テキスト）でまず演出を作る。

音（SE）・画面シェイクは今回のスコープに含めない。

## 2. スコープ

### ① スキル（必殺技）のクールダウン制
1. 使い切り制（`skillUsed: boolean`）→ 複数回使用可能なクールダウン制へ変更
2. クールダウン残り時間の表示（ポートレートにバー表示）

### ② 攻撃エフェクト
3. 攻撃時の演出（弓の射線など、何をどこに攻撃しているかが見える）
4. 攻撃種別（近接／弓）ごとの見た目の差別化

### ③ 回復エフェクト
5. おまじない発動時、術者→対象へ飛ぶ演出
6. 対象の足元に広がる回復の輪

### ④ ダメージ／回復量の可視化
7. 被ダメージ量のポップアップ表示
8. 回復量のポップアップ表示
9. クリティカル（ねらいうち発動中の一撃）の視覚的な差別化

### ⑤ スキルごとの固有発動エフェクト
10. ふんばる — 発動時の衝撃波リング（強調表示）
11. ねらいうち — 発動時の照準表示
12. かけぬける — 移動軌跡のトレイル＋斬撃線＋ヒット時の火花

### ⑥ その他の戦闘フィードバック
13. 撃破エフェクト（ユニットが倒れる瞬間の演出）
14. 被弾ノックバック（被弾時にユニットが一瞬のけぞる、実座標には影響しない見た目だけの演出）
15. 絆支援（bondSupport）発動時の強調演出
16. HPバーの減少アニメーション（瞬時切替→緩やかな追従）

### 対象外
- 効果音（SE）
- 画面シェイク

## 3. アーキテクチャ方針

**判別可能Union型1本にエフェクトを集約する。** `src/render/effects.ts` の
`Effect = { pos: Vec2; ttl: number }` を、`kind` で分岐する判別可能Unionに拡張し、
`EffectState.items` にすべて積む。エフェクト種別を増やす際の変更点を「Unionに1バリアント
追加」「`drawEffects` のswitchに1case追加」に閉じ込める。

種別ごとに配列・spawn関数・draw関数を分離する案や、汎用パーティクルシステムを新設する案も
検討したが、前者は種別が増えるたびに配列と呼び出し箇所が増殖し、後者は今回の要求（将来の
ドット絵差し替えを見据えたプレースホルダー図形の描画）に対して明らかに過剰で見送った。

**ノックバックとHPバーの減少アニメーションは `items` と別枠。** これらは`ttl`で消える
ワンショット演出ではなく「ユニットに紐づく持続的な見た目補正」なので、`EffectState` に
以下を追加する。

```ts
knockback: Map<string, { ttl: number; dir: Vec2 }>; // uid -> 描画位置オフセット
displayedHp: Map<string, number>;                    // uid -> 表示用HP（実HPへ滑らかに追従）
```

いずれも core（`Unit.pos` / `Unit.hp` 本体）には触れない、render層だけで完結する見た目の
演出。

## 4. core層の変更

### 4.1 スキルのクールダウン化

- `Unit.skillUsed: boolean` を `Unit.skillCooldownUntil: number` に置き換える
  （絶対シム時刻。`0` なら開始時点で使用可能）。
- `assets/skills.json` の各スキルの `params` に `cooldown`（秒）を追加する。
- `src/core/skills.ts`:
  - `canUseSkill`: `state.time >= unit.skillCooldownUntil` で判定するよう変更。
  - `useSkill`: 成功時に
    `self.skillCooldownUntil = state.time + skillParam(state.reg, self.skillId!, 'cooldown', デフォルト値)`
    をセットする。
- 影響範囲:
  - `src/main.ts`（`unit.skillUsed` を使ったスキルボタンのタップ判定）
  - `src/ui/screens.ts`（`drawBottomBar` の準備完了マーカー、`drawSkillButton` の表示可否）
  - `src/core/state.ts`（ユニット初期化時のフィールド名変更）
  - 既存テスト `sim.test.ts` / `skills.test.ts` の `skillUsed` 参照

### 4.2 SimEvent の拡張

`src/core/types.ts` の `SimEvent` を以下のように拡張する。

```ts
| { type: 'hit'; targetPos: Vec2; amount: number;
    sourceUid: string; sourceDefId: string; attackKind: AttackKind;
    sourcePos: Vec2; neraiuchi: boolean }
| { type: 'heal'; targetPos: Vec2; amount: number; sourceUid: string; sourceDefId: string }
| { type: 'skill'; uid: string; defId: string; skillId: string; hits: number; pos: Vec2 }
| { type: 'unitDefeated'; uid: string; defId: string; byUid: string | null; byDefId: string | null;
    neraiuchi: boolean; pos: Vec2 }
```

- `hit` は既存の `targetPos` / `amount` に加え、攻撃エフェクトの描き分け（近接／弓）と
  クリティカル演出の判定に必要な情報を足す。発生元は `src/core/sim.ts` の通常攻撃処理と
  `src/core/skills.ts` の `kakenukeru`（`neraiuchi: false` 固定）。
- `heal` は新設。現状 `omajinai` は `target.hp` を直接書き換えるだけでイベントが一切出て
  いないため、回復エフェクト／回復量ポップアップの発生源として追加する。
- `skill` / `unitDefeated` への `pos` 追加は、`hit` が `targetPos` を持つのと同じ
  「発生時点の位置を非正規化して積む」パターンに合わせる。`unitDefeated` は `retired` 後は
  ユニット配列から座標を追えなくなるため、イベント側に持たせる必要がある。

## 5. render層の変更

### 5.1 Effect のバリアント

`src/render/effects.ts` の `Effect` 型を以下の判別可能Unionにする（`ttl` はいずれも保持）。

| kind | 内容 | 発生源イベント |
|---|---|---|
| `hit` | ヒット時の円。`critical: boolean` で色・大きさを変える | `hit` |
| `attackLine` | 弓の射線。`from`（`sourcePos`）→`to`（`targetPos`）に一瞬線を引く | `hit`（`attackKind === 'bow'`） |
| `heal` | 対象の足元に広がる回復の輪 | `heal` |
| `healBeam` | 術者→対象へ飛ぶ光の弧。`from` / `to` を持つ | `heal` |
| `skillCast` | スキル発動演出。`skillId` を保持し、描画側で `funbaru`＝衝撃波リング／`neraiuchi`＝照準に分岐 | `skill`（`kakenukeru` を除く） |
| `trail` | かけぬけるの移動軌跡＋斬撃線。`from` / `to` を持つ | `skill`（`skillId === 'kakenukeru'`） |
| `defeat` | 撃破演出 | `unitDefeated` |
| `damageText` | ダメージ量ポップアップ。`amount` / `critical` を持ち、上に浮きながらフェード | `hit` |
| `healText` | 回復量ポップアップ。`amount` を持つ | `heal` |
| `bondPulse` | 絆支援発動の強調 | `bondSupport` |

近接攻撃（`attackKind !== 'bow'`）は既存の `hit` 円のみで、新規の軌跡演出は追加しない
（既にヒット位置＝相手の位置で分かるため）。

### 5.2 spawn関数

既存の `spawnHitEffects(state, events)` を `spawnEffects(state, events)` に拡張し、
上記すべてのイベント種別から対応する `Effect` を積む1関数にまとめる。`main.ts` からの
呼び出し箇所を増やさないため。

### 5.3 knockback / displayedHp のtick

`tickEffects(state, dt)` に、`items` の `ttl` 減算に加えて `knockback` と `displayedHp`
の更新を統合する。

- `knockback`: `ttl` を減算し、0以下になったら `Map` から削除。
- `displayedHp`: 各ユニットの実 `hp` に向けて指数減衰で近づける。ユニットが `state.units`
  から見つからなくなった（＝倒れて配列外扱いになる想定がある場合）エントリは削除する。

### 5.4 draw.ts の変更

- `drawUnits` に `effects: EffectState` を引数として渡すよう変更する（現状は受け取って
  いない）。ユニット描画位置に `knockback` のオフセットを加算し、HPバー描画には
  `displayedHp` を参照する。
- `drawEffects` は `Effect.kind` によるswitchで分岐する。

## 6. UI層の変更（クールダウン表示）

`src/ui/screens.ts` の `drawBottomBar` を変更する。

- 既存の「スキル準備完了マーカー」（`r.x+198, r.y+32` の丸）は廃止する。
- 代わりに、HPバー（`r.x+50, r.y+34`、幅120×高さ8）の直下、`r.x+50, r.y+46` あたりに
  幅120×高さ6程度のクールダウンバーを追加する。
  - 塗り具合 = `1 - (残りクールダウン秒数 / 総クールダウン秒数)`
  - 満タン（`#ffd479`）＝今すぐ使用可能。減っている間は黒背景のまま徐々に黄色が満ちる。
  - スキルを持たない（`skillId === null`）ユニット・退場済みユニットはバー自体を表示しない。
- `drawSkillButton`（戦闘中にユニット頭上へ出す使用ボタン）の表示可否判定も
  `unit.skillUsed` から `state.time >= unit.skillCooldownUntil` に変更する。

## 7. スキル固有エフェクトの詳細（プレースホルダー図形での表現）

- **ふんばる**（被ダメージ半減・耐える）— 発動時に足元から広がる衝撃波リングを1回強めに
  表示する。継続中の被ダメージ半減状態は既存の黄色い輪（`isFunbaruActive` の描画）をそのまま
  流用する。
- **ねらいうち**（次の一撃が確定クリティカル）— 発動時にキャラの頭上へクロスヘア（照準）を
  一瞬表示し、既存の白い輪（`neraiuchiArmed` の描画）に収束させる。
- **おまじない**（範囲内の最も弱った味方を回復）— `healBeam`（術者→対象へ弧を描く光の粒子）
  ＋ `heal`（対象の足元の輪）＋ `healText`（回復量ポップアップ）の組み合わせで表現する。
- **かけぬける**（直線移動しつつ通過した敵にダメージ）— `trail`（移動軌跡の残像＋斬撃線）を
  移動元→移動先に表示し、ヒットした敵には既存の `hit` 円に加えて小さな火花を足す。

## 8. 実装順序

依存関係の少ない順に、以下の単位で段階的に実装する。

1. スキルのクールダウン化＋バー表示（§4.1, §6）
2. ダメージ／回復量ポップアップ＋クリティカルの視覚差別化（§4.2 の `hit`/`heal` 拡張が土台）
3. 攻撃エフェクト（弓の射線）
4. 回復エフェクト
5. スキル固有の発動エフェクト（ふんばる／ねらいうち／かけぬける）
6. 撃破エフェクト・被弾ノックバック・絆強調・HPバーアニメーション（仕上げ）

## 9. テスト方針

既存パターンを踏襲する。

- `src/core/**` の変更（クールダウン判定、`heal` イベント発火など）は `skills.test.ts` /
  `sim.test.ts` と同様にロジックの単体テストを書く。
- `src/render/**` の変更（`spawnEffects` / `tickEffects`）は `effects.test.ts` と同様、
  状態遷移（このイベントが来たらこの `Effect` が積まれ、`ttl` 経過で消える）をテストする。
- 実際の Canvas 描画（`draw.ts` / `screens.ts`）は現状テストされておらず、今回もそれに
  合わせてテスト対象外とする。

## 10. 影響を受ける既存ファイル

- `assets/skills.json` — `cooldown` パラメータ追加
- `src/core/types.ts` — `Unit.skillCooldownUntil`、`SimEvent` 拡張
- `src/core/state.ts` — ユニット初期化フィールド変更
- `src/core/skills.ts` — `canUseSkill` / `useSkill` / `omajinai` の `heal` イベント発火
- `src/core/sim.ts` — 通常攻撃の `hit` イベントに情報追加
- `src/render/effects.ts` — `Effect` Union化、`spawnEffects`、`knockback` / `displayedHp`
- `src/render/draw.ts` — `drawUnits` へ `effects` 渡し、`drawEffects` の拡張
- `src/ui/screens.ts` — クールダウンバー描画、`drawSkillButton` の判定変更
- `src/main.ts` — スキルボタンのタップ判定変更
- 既存テスト: `sim.test.ts` / `skills.test.ts` / `effects.test.ts`
