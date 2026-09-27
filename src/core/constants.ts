/** 近接の間合い。ユニット定義の range とは別に、脅威判定・かけぬけるの当たり判定に使う */
export const MELEE_RANGE = 24;

/** この HP 割合を下回ると、ピンチのセリフを1度だけ出す */
export const PINCH_RATIO = 0.3;

/** 飛翔体の速さ（px/秒）。攻撃種別だけで決まる */
export const PROJECTILE_SPEED: Record<'bow' | 'magic', number> = { bow: 480, magic: 360 };

/**
 * 敵と味方が近づける最小の距離。近接の間合い（MELEE_RANGE）と同じにして、
 * ここまで近づけば近接攻撃が届くようにする
 */
export const MIN_SEPARATION = 24;

/**
 * 射程の判定に足す誤差。最小距離で押し戻した位置は、浮動小数点の誤差で射程を
 * わずかに超えることがあり、そのままだと交戦が成立しないまま止まってしまう
 */
export const RANGE_EPS = 1e-6;
