import { bondSupporters } from '../core/bonds';
import { isFunbaruActive } from '../core/skills';
import { FORT_MAX_HP } from '../core/types';
import { playerUnits } from '../core/sim';
import { lookupDef } from '../engine/registry';
import type { Registry } from '../engine/registry';
import { LOGICAL_H, LOGICAL_W, mapToLogical } from './viewport';
import { HIT_EFFECT_DURATION } from './effects';
import type { EffectState } from './effects';
import type { BattleState, Vec2 } from '../core/types';

const COLORS = {
  sea: '#12303f',
  ground: '#3f5d3a',
  rock: '#2b3a44',
  fort: '#d8c98a',
  bar: '#101820',
  text: '#f2efe4',
  hpBack: '#000000',
  hpAlly: '#5ad06a',
  hpEnemy: '#d05a5a',
  bond: 'rgba(255, 190, 220, 0.55)',
};

const UNIT_R = 11;

function defOf(reg: Registry, defId: string): { name: string; color: string } {
  return lookupDef(reg, defId) ?? { name: defId, color: '#888888' };
}

/** EnemyDef.maxHp から見た目の半径を導く。ID を直書きしない */
function enemyRadius(maxHp: number): number {
  return maxHp >= 40 ? UNIT_R + 3 : UNIT_R;
}

export function drawBattle(
  ctx: CanvasRenderingContext2D,
  reg: Registry,
  state: BattleState,
  selected: string | null,
  effects: EffectState,
): void {
  ctx.save();
  ctx.fillStyle = COLORS.sea;
  ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);

  drawTerrain(ctx, state);
  drawFort(ctx, state);
  drawGoalMarkers(ctx, reg, state, selected);
  drawBonds(ctx, state);
  drawUnits(ctx, reg, state, selected);
  drawEffects(ctx, effects);
  drawTopBar(ctx, state);
  ctx.restore();
}

function drawTerrain(ctx: CanvasRenderingContext2D, state: BattleState): void {
  const { grid } = state;
  for (let i = 0; i < grid.walkable.length; i++) {
    const cx = i % grid.cols;
    const cy = Math.floor(i / grid.cols);
    const p = mapToLogical({ x: cx * grid.cell, y: cy * grid.cell });
    ctx.fillStyle = grid.walkable[i] ? COLORS.ground : COLORS.rock;
    ctx.fillRect(p.x, p.y, grid.cell, grid.cell);
  }
}

function drawFort(ctx: CanvasRenderingContext2D, state: BattleState): void {
  const p = mapToLogical(state.stage.placementZone[0]!.pos);
  ctx.fillStyle = COLORS.fort;
  ctx.fillRect(p.x - 18, p.y - 18, 36, 36);
  ctx.fillStyle = COLORS.bar;
  ctx.fillRect(p.x - 4, p.y - 10, 8, 20);
}

function drawBonds(ctx: CanvasRenderingContext2D, state: BattleState): void {
  ctx.lineWidth = 3;
  ctx.strokeStyle = COLORS.bond;
  const units = playerUnits(state);
  const supportersList = units.map((u) => ({ id: u.defId, pos: u.pos, retired: u.retired, uid: u.uid }));
  for (const unit of units) {
    if (unit.engagedWith === null) continue;
    for (const s of bondSupporters(state.reg, unit.defId, unit.pos, supportersList)) {
      const other = units.find((u) => u.uid === s.uid);
      if (!other) continue;
      const a = mapToLogical(unit.pos);
      const b = mapToLogical(other.pos);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
      drawHeart(ctx, mapToLogical({ x: other.pos.x, y: other.pos.y - 20 }));
    }
  }
}

function drawHeart(ctx: CanvasRenderingContext2D, p: Vec2): void {
  ctx.fillStyle = '#ff9ec4';
  ctx.beginPath();
  ctx.arc(p.x - 3, p.y, 3.5, 0, Math.PI * 2);
  ctx.arc(p.x + 3, p.y, 3.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(p.x - 6.2, p.y + 1);
  ctx.lineTo(p.x, p.y + 8);
  ctx.lineTo(p.x + 6.2, p.y + 1);
  ctx.fill();
}

function drawHpBar(ctx: CanvasRenderingContext2D, p: Vec2, ratio: number, color: string): void {
  const w = 26;
  ctx.fillStyle = COLORS.hpBack;
  ctx.fillRect(p.x - w / 2, p.y - UNIT_R - 9, w, 4);
  ctx.fillStyle = color;
  ctx.fillRect(p.x - w / 2, p.y - UNIT_R - 9, w * Math.max(0, Math.min(1, ratio)), 4);
}

function drawUnits(
  ctx: CanvasRenderingContext2D,
  reg: Registry,
  state: BattleState,
  selected: string | null,
): void {
  for (const unit of state.units) {
    if (unit.retired) continue;
    const isAlly = unit.side === 'player';
    const p = mapToLogical(unit.pos);
    const radius = isAlly ? UNIT_R : enemyRadius(unit.maxHp);
    ctx.fillStyle = defOf(reg, unit.defId).color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
    ctx.fill();

    if (unit.bowDamageCap !== null) {
      ctx.fillStyle = '#c8ccd4';
      ctx.fillRect(p.x - 14, p.y - 8, 5, 16);
    }

    if (isAlly) {
      // はた（キャラだとわかるように）
      ctx.fillStyle = COLORS.text;
      ctx.fillRect(p.x + UNIT_R - 2, p.y - UNIT_R - 6, 2, 10);
      ctx.fillRect(p.x + UNIT_R, p.y - UNIT_R - 6, 7, 5);

      if (unit.uid === selected) {
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 3;
        ctx.setLineDash([4, 3]);
        ctx.beginPath();
        ctx.arc(p.x, p.y, UNIT_R + 10, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }

    if (isFunbaruActive(unit, state.time)) {
      ctx.strokeStyle = '#ffe27a';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(p.x, p.y, UNIT_R + 4, 0, Math.PI * 2);
      ctx.stroke();
    }
    if (unit.neraiuchiArmed) {
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(p.x, p.y, UNIT_R + 7, 0, Math.PI * 2);
      ctx.stroke();
    }
    drawHpBar(ctx, p, unit.hp / unit.maxHp, isAlly ? COLORS.hpAlly : COLORS.hpEnemy);
  }
}

function drawEffects(ctx: CanvasRenderingContext2D, effects: EffectState): void {
  for (const e of effects.items) {
    const p = mapToLogical(e.pos);
    const ratio = Math.max(0, e.ttl / HIT_EFFECT_DURATION);
    ctx.strokeStyle = `rgba(255, 235, 150, ${ratio})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(p.x, p.y, UNIT_R + (1 - ratio) * 14, 0, Math.PI * 2);
    ctx.stroke();
  }
}

function drawTopBar(ctx: CanvasRenderingContext2D, state: BattleState): void {
  ctx.fillStyle = COLORS.bar;
  ctx.fillRect(0, 0, LOGICAL_W, 46);
  ctx.fillStyle = COLORS.text;
  ctx.font = '20px sans-serif';
  ctx.textBaseline = 'middle';
  ctx.fillText(`とりで ${state.fortHp} / ${FORT_MAX_HP}`, 16, 23);
  ctx.fillText(state.stage.name, 280, 23);
}

/** 4人ぶんの移動先を常に出す。誰がどこへ向かっているかを盤面だけで読めるようにする */
export function drawGoalMarkers(
  ctx: CanvasRenderingContext2D,
  reg: Registry,
  state: BattleState,
  selected: string | null,
): void {
  for (const unit of state.units) {
    if (unit.side !== 'player' || unit.retired || !unit.goalPos) continue;
    const a = mapToLogical(unit.pos);
    const g = mapToLogical(unit.goalPos);
    const color = defOf(reg, unit.defId).color;
    const isSelected = unit.uid === selected;

    // 交戦中は足が止まっているので薄くする。交戦が解けたら再開するため消しはしない
    ctx.globalAlpha = unit.engagedWith !== null ? 0.35 : 1;
    ctx.strokeStyle = color;

    if (isSelected) {
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 5]);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(g.x, g.y);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    ctx.lineWidth = isSelected ? 3 : 2;
    ctx.beginPath();
    ctx.arc(g.x, g.y, isSelected ? 11 : 6, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(g.x, g.y, 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
}

/** ドラッグ中に、離したらどうなるかを先に見せる */
export function drawDragPreview(
  ctx: CanvasRenderingContext2D,
  reg: Registry,
  fromMap: Vec2,
  toMap: Vec2,
  defId: string,
  blocked: boolean,
): void {
  const a = mapToLogical(fromMap);
  const b = mapToLogical(toMap);
  const color = blocked ? COLORS.hpEnemy : defOf(reg, defId).color;

  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.setLineDash([6, 5]);
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.globalAlpha = 0.5;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(b.x, b.y, UNIT_R, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
}
