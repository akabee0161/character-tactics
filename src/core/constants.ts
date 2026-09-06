/** 近接の間合い。ユニット定義の range とは別に、脅威判定・かけぬけるの当たり判定に使う */
export const MELEE_RANGE = 24;

/** この HP 割合を下回ると、ピンチのセリフを1度だけ出す */
export const PINCH_RATIO = 0.3;

/** 飛翔体の速さ（px/秒）。攻撃種別だけで決まる */
export const PROJECTILE_SPEED: Record<'bow' | 'magic', number> = { bow: 480, magic: 360 };
