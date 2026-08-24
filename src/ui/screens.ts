import { CHARACTERS } from '../content/characters';
import { ENEMIES } from '../content/enemies';
import { STAGES } from '../content/stages';
import { TITLE_LABELS, TITLE_OWNER, xpToNext } from '../core/progress';
import { CHAR_IDS } from '../core/types';
import { LOGICAL_H, LOGICAL_W, mapToLogical } from '../render/viewport';
import { BOTTOM_BAR_H, BOTTOM_BAR_Y, BTN, STAGE_BTN, portraitSlot, skillButtonAt } from './layout';
import { isStageUnlocked } from './flow';
import type { DialogueRequest } from '../core/dialogue';
import type { XpGain } from './flow';
import type { TitleId } from '../core/progress';
import type { SaveData } from '../save/save';
import type { BattleState, CharId } from '../core/types';
import type { Rect } from './hit';

const INK = '#f2efe4';
const PANEL = 'rgba(16, 24, 32, 0.88)';

function panel(ctx: CanvasRenderingContext2D, r: Rect, fill = PANEL): void {
  ctx.fillStyle = fill;
  ctx.fillRect(r.x, r.y, r.w, r.h);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2;
  ctx.strokeRect(r.x + 1, r.y + 1, r.w - 2, r.h - 2);
}

function button(ctx: CanvasRenderingContext2D, r: Rect, label: string, enabled = true): void {
  panel(ctx, r, enabled ? '#2c4a63' : '#2a2f35');
  ctx.fillStyle = enabled ? INK : '#78808a';
  ctx.font = '26px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, r.x + r.w / 2, r.y + r.h / 2);
  ctx.textAlign = 'left';
}

function clear(ctx: CanvasRenderingContext2D): void {
  ctx.fillStyle = '#101820';
  ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);
}

export function drawTitle(ctx: CanvasRenderingContext2D, hasSave: boolean): void {
  clear(ctx);
  ctx.fillStyle = INK;
  ctx.font = '58px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('とりでの なかまたち', LOGICAL_W / 2, 180);
  ctx.font = '22px sans-serif';
  ctx.fillText('4にんの なかまで しまを まもろう', LOGICAL_W / 2, 232);
  ctx.textAlign = 'left';
  button(ctx, BTN.titleNew, 'はじめから');
  button(ctx, BTN.titleContinue, 'つづきから', hasSave);
}

export function drawStageSelect(ctx: CanvasRenderingContext2D, save: SaveData): void {
  clear(ctx);
  ctx.fillStyle = INK;
  ctx.font = '36px sans-serif';
  ctx.fillText('どの しまを まもる？', 40, 100);

  STAGES.forEach((stage, i) => {
    const r = STAGE_BTN[i]!;
    const unlocked = isStageUnlocked(save, i);
    panel(ctx, r, unlocked ? '#2c4a63' : '#2a2f35');
    ctx.fillStyle = unlocked ? INK : '#78808a';
    ctx.font = '24px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(unlocked ? stage.name : 'まだ いけない', r.x + r.w / 2, r.y + 60);
    ctx.font = '18px sans-serif';
    if (unlocked && i < save.clearedStages) ctx.fillText('クリア ずみ', r.x + r.w / 2, r.y + 104);
    ctx.textAlign = 'left';
  });

  drawRoster(ctx, save);
}

function drawRoster(ctx: CanvasRenderingContext2D, save: SaveData): void {
  ctx.font = '18px sans-serif';
  CHAR_IDS.forEach((id, i) => {
    const r = portraitSlot(i);
    panel(ctx, r, '#18222c');
    ctx.fillStyle = CHARACTERS[id].color;
    ctx.beginPath();
    ctx.arc(r.x + 28, r.y + 32, 16, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = INK;
    ctx.fillText(`${CHARACTERS[id].name} Lv${save.chars[id].level}`, r.x + 54, r.y + 26);
    const own = save.titles.filter((t) => TITLE_OWNER[t] === id || TITLE_OWNER[t] === null);
    ctx.fillStyle = '#9fb3c4';
    ctx.fillText(own.map((t) => TITLE_LABELS[t]).join('、'), r.x + 54, r.y + 48);
  });
}

export function drawPlacement(ctx: CanvasRenderingContext2D, state: BattleState): void {
  ctx.fillStyle = 'rgba(16, 24, 32, 0.35)';
  ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);

  ctx.fillStyle = '#ffd479';
  for (const l of state.stage.landings) {
    const p = mapToLogical(l);
    ctx.beginPath();
    ctx.moveTo(p.x + 26, p.y);
    ctx.lineTo(p.x - 6, p.y - 16);
    ctx.lineTo(p.x - 6, p.y + 16);
    ctx.closePath();
    ctx.fill();
  }

  ctx.fillStyle = INK;
  ctx.font = '24px sans-serif';
  ctx.fillText('なかまを ドラッグして おこう', 40, 380);
  button(ctx, BTN.start, 'はじめる');
}

export function drawBottomBar(
  ctx: CanvasRenderingContext2D,
  state: BattleState,
  selected: CharId | null,
): void {
  ctx.fillStyle = 'rgba(16, 24, 32, 0.92)';
  ctx.fillRect(0, BOTTOM_BAR_Y, LOGICAL_W, BOTTOM_BAR_H);

  CHAR_IDS.forEach((id, i) => {
    const ally = state.allies.find((a) => a.id === id)!;
    const r = portraitSlot(i);
    panel(ctx, r, selected === id ? '#3a5f7d' : '#18222c');

    ctx.globalAlpha = ally.retired ? 0.4 : 1;
    ctx.fillStyle = CHARACTERS[id].color;
    ctx.beginPath();
    ctx.arc(r.x + 26, r.y + 32, 15, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = INK;
    ctx.font = '17px sans-serif';
    ctx.fillText(CHARACTERS[id].name, r.x + 50, r.y + 24);

    ctx.fillStyle = '#000';
    ctx.fillRect(r.x + 50, r.y + 34, 120, 8);
    ctx.fillStyle = ally.retired ? '#666' : '#5ad06a';
    ctx.fillRect(r.x + 50, r.y + 34, 120 * Math.max(0, ally.hp / ally.maxHp), 8);

    ctx.fillStyle = ally.skillUsed || ally.retired ? '#555' : '#ffd479';
    ctx.beginPath();
    ctx.arc(r.x + 198, r.y + 32, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    if (ally.retired) {
      ctx.fillStyle = '#ff9a9a';
      ctx.font = '15px sans-serif';
      ctx.fillText('たいきゃく', r.x + 50, r.y + 56);
    }
  });
}

export function drawSkillButton(
  ctx: CanvasRenderingContext2D,
  state: BattleState,
  selected: CharId,
): Rect | null {
  const ally = state.allies.find((a) => a.id === selected);
  if (!ally || ally.retired || ally.skillUsed) return null;
  const r = skillButtonAt(mapToLogical(ally.pos));
  const labels: Record<string, string> = {
    funbaru: 'ふんばる', neraiuchi: 'ねらいうち', omajinai: 'おまじない', kakenukeru: 'かけぬける',
  };
  button(ctx, r, labels[ally.skill] ?? 'スキル');
  return r;
}

export function drawBubble(ctx: CanvasRenderingContext2D, req: DialogueRequest): void {
  ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
  ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);

  const r: Rect = { x: 120, y: 300, w: 720, h: 150 };
  panel(ctx, r, '#f7f3e6');
  const info = req.speaker.side === 'ally' ? CHARACTERS[req.speaker.id] : ENEMIES[req.speaker.id];
  ctx.fillStyle = info.color;
  ctx.beginPath();
  ctx.arc(r.x + 54, r.y + 60, 30, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#1a1a1a';
  ctx.font = '20px sans-serif';
  ctx.fillText(info.name, r.x + 100, r.y + 34);
  ctx.font = '26px sans-serif';
  req.text.split('\n').forEach((line, i) => {
    ctx.fillText(line, r.x + 100, r.y + 74 + i * 36);
  });

  ctx.font = '18px sans-serif';
  ctx.fillStyle = '#666';
  ctx.textAlign = 'right';
  ctx.fillText('タップで つぎへ', r.x + r.w - 20, r.y + r.h - 18);
  ctx.textAlign = 'left';
}

export function drawWaveCleared(ctx: CanvasRenderingContext2D, state: BattleState): void {
  ctx.fillStyle = 'rgba(16, 24, 32, 0.6)';
  ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);
  ctx.fillStyle = INK;
  ctx.font = '40px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('つぎの しゅうげきが くるよ', LOGICAL_W / 2, 260);
  ctx.font = '20px sans-serif';
  ctx.fillText(`しゅうげき ${state.waveIndex + 2} / ${state.stage.waves.length}`, LOGICAL_W / 2, 306);
  ctx.textAlign = 'left';
  button(ctx, BTN.next, 'つぎへ');
}

export function drawResult(
  ctx: CanvasRenderingContext2D,
  state: BattleState,
  gains: XpGain[],
  newTitles: TitleId[],
): void {
  clear(ctx);
  ctx.fillStyle = INK;
  ctx.font = '44px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('しまを まもった！', LOGICAL_W / 2, 90);
  ctx.textAlign = 'left';

  ctx.font = '19px sans-serif';
  gains.forEach((g, i) => {
    const y = 150 + i * 46;
    ctx.fillStyle = CHARACTERS[g.id].color;
    ctx.beginPath();
    ctx.arc(60, y - 6, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = INK;
    const st = state.stats[g.id];
    ctx.fillText(
      `${CHARACTERS[g.id].name}  たおした ${st.defeats}  スキル ${st.skillUses}  おうえん ${st.bondSupports}`,
      90, y,
    );
    ctx.fillText(`+${g.gained} けいけんち`, 620, y);
    ctx.fillStyle = g.leveledUp ? '#ffd479' : '#9fb3c4';
    ctx.fillText(
      g.leveledUp ? `レベルアップ！ Lv${g.after.level}` : `Lv${g.after.level} (${g.after.xp}/${xpToNext(g.after.level)})`,
      770, y,
    );
  });

  if (newTitles.length > 0) {
    ctx.fillStyle = '#ffd479';
    ctx.font = '22px sans-serif';
    ctx.fillText(`しょうごう ゲット: ${newTitles.map((t) => TITLE_LABELS[t]).join('、')}`, 60, 350);
  }

  button(ctx, BTN.next, 'つぎへ');
}

export function drawDefeat(ctx: CanvasRenderingContext2D): void {
  clear(ctx);
  ctx.fillStyle = INK;
  ctx.font = '44px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('とりでが やぶられた', LOGICAL_W / 2, 240);
  ctx.textAlign = 'left';
  button(ctx, BTN.retry, 'もういちど');
  button(ctx, BTN.toSelect, 'しまを えらぶ');
}
