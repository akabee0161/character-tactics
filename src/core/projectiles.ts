import { PROJECTILE_SPEED } from './constants';
import { applyDamage } from './damage';
import { distance } from './field';
import type { BattleState, HitSource, Projectile, Unit } from './types';

/** 遠距離の1発を撃つ。近接はここを通らない */
export function spawnProjectile(state: BattleState, source: HitSource, target: Unit): void {
  if (source.attack === 'melee') return;
  state.projectiles.push({
    id: `pj${state.nextProjectileId++}`,
    kind: source.attack,
    source,
    targetUid: target.uid,
    pos: { ...source.pos },
  });
}

/**
 * 飛翔体を進め、届いたものを命中させる。
 * 追尾するので必ず当たる。外れる弾は子ども向けの操作感に合わない。
 * 目標が退場していたら不発として消える
 */
export function updateProjectiles(state: BattleState, dt: number): void {
  const byUid = new Map(state.units.map((u) => [u.uid, u]));
  const alive: Projectile[] = [];

  for (const pj of state.projectiles) {
    const target = byUid.get(pj.targetUid);
    if (!target || target.retired) continue;

    const stepLen = PROJECTILE_SPEED[pj.kind] * dt;
    const remaining = distance(pj.pos, target.pos);
    if (remaining > stepLen) {
      pj.pos = {
        x: pj.pos.x + ((target.pos.x - pj.pos.x) / remaining) * stepLen,
        y: pj.pos.y + ((target.pos.y - pj.pos.y) / remaining) * stepLen,
      };
      alive.push(pj);
      continue;
    }

    pj.pos = { ...target.pos };
    applyDamage(state, pj.source, target);
  }

  state.projectiles = alive;
}
