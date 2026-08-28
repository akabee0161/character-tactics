/** 近接の間合い。ユニット定義の range とは別に、脅威判定・かけぬけるの当たり判定に使う */
export const MELEE_RANGE = 24;
export const BOW_RANGE = 160;

/**
 * 敵が砦に到達したときに与えるダメージ。engine の EnemyDef には載らない
 * （Task 5 で「fortDamage は捨てる」と決めたが、砦・ウェーブの仕組みじたいは
 * フェーズ 5 まで残るため、core 側の暫定値として持つ）
 */
export const FORT_DAMAGE: Record<string, number> = {
  narazumono: 3,
  tatemochi: 5,
  garum: 10,
};
