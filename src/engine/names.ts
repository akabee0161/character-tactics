/**
 * 本文の `{<ID>}` を名前に置き換える。ID に使える文字は [A-Za-z0-9_-]。
 * 知らない ID はそのまま残し、unknown に（出た順・重複なしで）入れる
 */
export function fillNames(
  text: string,
  nameOf: (id: string) => string | null,
): { text: string; unknown: string[] } {
  const unknown: string[] = [];
  const out = text.replace(/\{([A-Za-z0-9_-]+)\}/g, (whole, id: string) => {
    const name = nameOf(id);
    if (name !== null) return name;
    if (!unknown.includes(id)) unknown.push(id);
    return whole;
  });
  return { text: out, unknown };
}
