import { lookupDef, skillParam } from '../engine/registry';
import { titlesOf, xpToNext } from '../core/progress';
import { DEFAULT_SKILL_COOLDOWN } from '../core/skills';
import { PLACEMENT_RADIUS } from '../core/state';
import { LOGICAL_H, LOGICAL_W, mapToLogical } from '../render/viewport';
import {
  BOTTOM_PANEL_Y, BTN, BUBBLE_FONT_PX, BUBBLE_LINE_H, BUBBLE_PAD, SKILL_BUTTON, TALK_BODY_X,
  TALK_FONT, TALK_LINE_H, TALK_PAD, TALK_WINDOW, bubbleLines, bubbleRectAt, portraitSlot,
  rosterSlot, stageSlot,
} from './layout';
import { skillButtonState } from './skillbutton';
import { currentSpeaker, pageCount, visibleLines } from './talk';
import { isStageUnlocked } from './flow';
import type { Bubble } from './bubbles';
import type { TalkState } from './talk';
import type { XpGain } from './flow';
import type { Registry } from '../engine/registry';
import type { ValidationError } from '../engine/schema';
import type { SaveData } from '../save/save';
import type { BattleState, Vec2 } from '../core/types';
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
  ctx.textBaseline = 'alphabetic';
}

function clear(ctx: CanvasRenderingContext2D): void {
  ctx.fillStyle = '#101820';
  ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);
}

export function drawTitle(ctx: CanvasRenderingContext2D, hasSave: boolean): void {
  clear(ctx);
  ctx.fillStyle = INK;
  ctx.font = '40px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('とりでの なかまたち', LOGICAL_W / 2, 260);
  ctx.font = '22px sans-serif';
  ctx.fillText('4にんの なかまで', LOGICAL_W / 2, 320);
  ctx.fillText('てきの ほんきょちへ せめこもう', LOGICAL_W / 2, 352);
  ctx.textAlign = 'left';
  button(ctx, BTN.titleNew, 'はじめから');
  button(ctx, BTN.titleContinue, 'つづきから', hasSave);
}

export function drawStageSelect(ctx: CanvasRenderingContext2D, reg: Registry, save: SaveData): void {
  clear(ctx);
  ctx.fillStyle = INK;
  ctx.font = '30px sans-serif';
  ctx.fillText('どの ステージに いく？', 40, 100);

  reg.stages.forEach((stage, i) => {
    const r = stageSlot(i);
    const unlocked = isStageUnlocked(reg, save, i);
    panel(ctx, r, unlocked ? '#2c4a63' : '#2a2f35');
    ctx.fillStyle = unlocked ? INK : '#78808a';
    ctx.font = '22px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(unlocked ? stage.name : 'まだ いけない', r.x + r.w / 2, r.y + 50);
    ctx.font = '18px sans-serif';
    if (unlocked && save.clearedStageIds.includes(stage.id)) ctx.fillText('クリア ずみ', r.x + r.w / 2, r.y + 88);
    ctx.textAlign = 'left';
  });

  drawRoster(ctx, reg, save);
}

function drawRoster(ctx: CanvasRenderingContext2D, reg: Registry, save: SaveData): void {
  ctx.font = '18px sans-serif';
  const ids = [...reg.units.keys()];
  ids.forEach((id, i) => {
    const r = rosterSlot(i);
    panel(ctx, r, '#18222c');
    const def = reg.units.get(id)!;
    ctx.fillStyle = def.color;
    ctx.beginPath();
    ctx.arc(r.x + 28, r.y + 32, 16, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = INK;
    ctx.fillText(`${def.name} Lv${save.units[id]!.level}`, r.x + 56, r.y + 26);
    const own = titlesOf(reg, save.titles, id);
    ctx.fillStyle = '#9fb3c4';
    ctx.fillText(own.map((t) => t.label).join('、'), r.x + 56, r.y + 50);
  });
}

export function drawPlacement(ctx: CanvasRenderingContext2D, state: BattleState): void {
  ctx.fillStyle = 'rgba(16, 24, 32, 0.35)';
  ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);

  // 置ける はんいを 見せる。ここに おけないと プレイヤーが しれない と こまる
  ctx.strokeStyle = '#ffd479';
  ctx.lineWidth = 2;
  ctx.setLineDash([5, 4]);
  for (const z of state.stage.placementZone) {
    const p = mapToLogical(z.pos);
    ctx.beginPath();
    ctx.arc(p.x, p.y, PLACEMENT_RADIUS, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.setLineDash([]);

  ctx.fillStyle = INK;
  ctx.font = '20px sans-serif';
  ctx.fillText('きいろい わくの なかに なかまを おこう', 24, 760);
  button(ctx, SKILL_BUTTON, 'はじめる');
}

export function drawBottomBar(
  ctx: CanvasRenderingContext2D,
  reg: Registry,
  state: BattleState,
  selected: string | null,
  escorts: Set<string>,
): void {
  ctx.fillStyle = 'rgba(16, 24, 32, 0.92)';
  ctx.fillRect(0, BOTTOM_PANEL_Y, LOGICAL_W, LOGICAL_H - BOTTOM_PANEL_Y);

  state.units
    .filter((u) => u.side === 'player')
    .slice(0, 4)
    .forEach((unit, i) => {
      const r = portraitSlot(i);
      panel(ctx, r, selected === unit.uid ? '#3a5f7d' : '#18222c');

      const def = lookupDef(reg, unit.defId) ?? { name: unit.defId, color: '#888888' };
      ctx.globalAlpha = unit.retired ? 0.4 : 1;
      ctx.fillStyle = def.color;
      ctx.beginPath();
      ctx.arc(r.x + 22, r.y + 22, 13, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = INK;
      ctx.font = '18px sans-serif';
      ctx.fillText(def.name, r.x + 42, r.y + 28);

      ctx.fillStyle = '#000';
      ctx.fillRect(r.x + 8, r.y + 60, 113, 7);
      ctx.fillStyle = unit.retired ? '#666' : '#5ad06a';
      ctx.fillRect(r.x + 8, r.y + 60, 113 * Math.max(0, unit.hp / unit.maxHp), 7);

      ctx.globalAlpha = 1;

      if (unit.skillId !== null && !unit.retired) {
        const total = skillParam(reg, unit.skillId, 'cooldown', DEFAULT_SKILL_COOLDOWN);
        const remaining = Math.max(0, unit.skillCooldownUntil - state.time);
        const ratio = total > 0 ? 1 - remaining / total : 1;
        ctx.fillStyle = '#000';
        ctx.fillRect(r.x + 8, r.y + 70, 113, 5);
        ctx.fillStyle = '#ffd479';
        ctx.fillRect(r.x + 8, r.y + 70, 113 * Math.max(0, Math.min(1, ratio)), 5);
      }

      if (unit.retired) {
        ctx.fillStyle = '#ff9a9a';
        ctx.font = '14px sans-serif';
        ctx.fillText('たいきゃく', r.x + 42, r.y + 50);
      }

      if (escorts.has(unit.defId)) {
        ctx.fillStyle = '#ffd479';
        ctx.beginPath();
        ctx.moveTo(r.x + 8, r.y + 10);
        ctx.lineTo(r.x + 2, r.y + 20);
        ctx.lineTo(r.x + 14, r.y + 20);
        ctx.closePath();
        ctx.fill();
      }
    });
}

export function drawSkillButton(
  ctx: CanvasRenderingContext2D,
  reg: Registry,
  state: BattleState,
  selected: string | null,
): void {
  const s = skillButtonState(reg, state, selected);
  button(ctx, SKILL_BUTTON, s.label, s.enabled);
}

/** 戦闘中の吹き出し。キャラの頭上に出し、時間は止めない */
export function drawBubble(ctx: CanvasRenderingContext2D, bubble: Bubble, logicalPos: Vec2): void {
  const r = bubbleRectAt(logicalPos, bubble.text);
  panel(ctx, r, '#f7f3e6');

  // 吹き出しの尻尾。キャラの方を指す
  ctx.fillStyle = '#f7f3e6';
  ctx.beginPath();
  ctx.moveTo(r.x + r.w / 2 - 8, r.y + r.h);
  ctx.lineTo(r.x + r.w / 2 + 8, r.y + r.h);
  ctx.lineTo(r.x + r.w / 2, r.y + r.h + 10);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#1a1a1a';
  ctx.font = `${BUBBLE_FONT_PX}px sans-serif`;
  // 1行目のベースラインは、天面のパディング＋フォントの上昇分（実測はできないので概算）
  const firstBaselineY = r.y + BUBBLE_PAD + BUBBLE_FONT_PX * 0.875;
  bubbleLines(bubble.text).forEach((line, i) => {
    ctx.fillText(line, r.x + BUBBLE_PAD, firstBaselineY + i * BUBBLE_LINE_H);
  });
}

/** 会話フェーズのウィンドウ。背景のマップは呼び出し側が先に描いておく */
export function drawTalk(
  ctx: CanvasRenderingContext2D,
  reg: Registry,
  state: TalkState,
  canSkip: boolean,
): void {
  ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
  ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);

  if (canSkip) button(ctx, BTN.skip, 'とばす');

  const r = TALK_WINDOW;
  panel(ctx, r, '#f7f3e6');

  const speaker = currentSpeaker(state);
  // 地の文は顔の丸も名前も出さず、本文を左端から描く
  const bodyX = r.x + (speaker === null ? TALK_PAD : TALK_BODY_X);

  if (speaker !== null) {
    const info = lookupDef(reg, speaker) ?? { name: speaker, color: '#888888' };
    ctx.fillStyle = info.color;
    ctx.beginPath();
    ctx.arc(r.x + 54, r.y + 60, 30, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#1a1a1a';
    ctx.font = '20px sans-serif';
    ctx.fillText(info.name, bodyX, r.y + 34);
  }

  ctx.fillStyle = '#1a1a1a';
  ctx.font = TALK_FONT;
  visibleLines(state).forEach((line, i) => {
    ctx.fillText(line, bodyX, r.y + 74 + i * TALK_LINE_H);
  });

  ctx.font = '18px sans-serif';
  ctx.fillStyle = '#666';
  ctx.textAlign = 'right';
  if (pageCount(state) > 1) {
    ctx.fillText(`${state.page + 1} / ${pageCount(state)}`, r.x + r.w - 20, r.y + r.h - 18);
  } else {
    ctx.fillText('タップで つぎへ', r.x + r.w - 20, r.y + r.h - 18);
  }
  ctx.textAlign = 'left';
}

export function drawResult(
  ctx: CanvasRenderingContext2D,
  reg: Registry,
  gains: XpGain[],
  newTitles: string[],
): void {
  clear(ctx);
  ctx.fillStyle = INK;
  ctx.font = '28px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('てきの ほんきょちに とうたつ！', LOGICAL_W / 2, 100);
  ctx.textAlign = 'left';

  ctx.font = '19px sans-serif';
  gains.forEach((g, i) => {
    const y = 180 + i * 56;
    const def = lookupDef(reg, g.id) ?? { name: g.id, color: '#888888' };
    ctx.fillStyle = def.color;
    ctx.beginPath();
    ctx.arc(40, y - 6, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = INK;
    ctx.fillText(def.name, 66, y);
    ctx.fillStyle = g.leveledUp ? '#ffd479' : '#9fb3c4';
    ctx.font = '17px sans-serif';
    ctx.fillText(
      g.leveledUp
        ? `レベルアップ！ Lv${g.before.level} → Lv${g.after.level}`
        : `Lv${g.after.level} (${g.after.xp}/${xpToNext(g.after.level)})`,
      66, y + 24,
    );
    ctx.font = '19px sans-serif';
  });

  if (newTitles.length > 0) {
    ctx.fillStyle = '#ffd479';
    ctx.font = '22px sans-serif';
    const label = (id: string): string => reg.titles.find((t) => t.id === id)?.label ?? id;
    ctx.fillText(`しょうごう ゲット: ${newTitles.map(label).join('、')}`, 40, 560);
  }

  button(ctx, BTN.next, 'つぎへ');
}

export function drawDefeat(ctx: CanvasRenderingContext2D): void {
  clear(ctx);
  ctx.fillStyle = INK;
  ctx.font = '32px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('なかまを まもれなかった', LOGICAL_W / 2, 320);
  ctx.textAlign = 'left';
  button(ctx, BTN.retry, 'もういちど');
  button(ctx, BTN.toSelect, 'しまを えらぶ');
}

export function drawLoadErrors(ctx: CanvasRenderingContext2D, errors: ValidationError[]): void {
  clear(ctx);
  ctx.fillStyle = '#ff9a9a';
  ctx.font = '28px sans-serif';
  ctx.fillText('データの よみこみに しっぱいしました', 40, 80);
  ctx.fillStyle = INK;
  ctx.font = '13px monospace';
  errors.slice(0, 20).forEach((e, i) => {
    ctx.fillText(`${e.file} ${e.path}: ${e.reason}`, 40, 130 + i * 20);
  });
  if (errors.length > 20) {
    ctx.fillText(`ほか ${errors.length - 20} けん`, 40, 130 + 20 * 20);
  }
}
