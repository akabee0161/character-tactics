import type { SpawnerDef } from '../engine/schema';

export type DueSpawn = { index: number; spawner: SpawnerDef };

/**
 * いま湧かせるべき敵を返す。1回の呼び出しで湧き口ごとに最大1体。
 * n 体目が出る時刻は firstAfter + every × (n - 1)。
 * counts[index] が total に達した湧き口は返さない
 */
export function dueSpawns(
  spawners: SpawnerDef[], counts: number[], time: number,
): DueSpawn[] {
  const out: DueSpawn[] = [];
  spawners.forEach((spawner, index) => {
    const done = counts[index] ?? 0;
    if (done >= spawner.total) return;
    if (time < spawner.firstAfter + spawner.every * done) return;
    out.push({ index, spawner });
  });
  return out;
}
