import { loadRegistry } from './engine/loader';
import { skillParam } from './engine/registry';
import { pickDialogue, pickStageIntro } from './core/dialogue';
import { SKILL_EFFECT_IDS } from './core/skills';
import { beginBattle, createBattleState, placeUnit } from './core/state';
import { playerUnits, step } from './core/sim';
import type { SimCommand } from './core/sim';
import { drawBattle, drawDragPreview } from './render/draw';
import { escortDefIds } from './render/objectives-view';
import { isWalkableAt } from './core/field';
import { makeEffectState, resetEffects, spawnEffects, syncDisplayedHp, tickEffects } from './render/effects';
import { LOGICAL_H, LOGICAL_W, computeViewport, logicalToMap, mapToLogical, screenToLogical } from './render/viewport';
import { clearBubbles, dismissBubble, makeBubbleState, pushBubbles, tickBubbles } from './ui/bubbles';
import { applyStageClear, hasReadIntro, isStageUnlocked, markIntroRead } from './ui/flow';
import { hitRect, pickUnit } from './ui/hit';
import { resolveMapGesture } from './ui/input';
import type { PointerStart } from './ui/input';
import {
  BTN, TALK_BODY_X, TALK_FONT, TALK_MAX_LINES, TALK_PAD, TALK_WINDOW,
  bubbleRectAt, portraitSlot, skillButtonAt, stageSlot,
} from './ui/layout';
import {
  drawBottomBar, drawBubble, drawDefeat, drawLoadErrors, drawPlacement, drawResult,
  drawSkillButton, drawStageSelect, drawTalk, drawTitle,
} from './ui/screens';
import { advanceTalk, makeTalkState, skipTalk, tickTalk } from './ui/talk';
import type { Measure, TalkState } from './ui/talk';
import { loadSave, newSave, writeSave } from './save/save';
import type { SaveData } from './save/save';
import type { XpGain } from './ui/flow';
import type { BattleState, Vec2 } from './core/types';

const FIXED_DT = 1 / 60;

type Phase = 'title' | 'select' | 'talk' | 'placement' | 'battle' | 'result' | 'defeat';

const canvas = document.getElementById('game') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;

function resize(): void {
  const scale = Math.min(window.innerWidth / LOGICAL_W, window.innerHeight / LOGICAL_H);
  canvas.width = Math.floor(LOGICAL_W * scale * window.devicePixelRatio);
  canvas.height = Math.floor(LOGICAL_H * scale * window.devicePixelRatio);
  canvas.style.width = `${Math.floor(LOGICAL_W * scale)}px`;
  canvas.style.height = `${Math.floor(LOGICAL_H * scale)}px`;
}
window.addEventListener('resize', resize);
resize();

const loadResult = loadRegistry(SKILL_EFFECT_IDS);
if (!loadResult.ok) {
  // 部分的に読めたぶんで続行しない。アセットを足したその場で事故に気づけることを優先する
  const vp = computeViewport(canvas.width, canvas.height);
  ctx.setTransform(vp.scale, 0, 0, vp.scale, vp.offsetX, vp.offsetY);
  drawLoadErrors(ctx, loadResult.errors);
  throw new Error(`assets の よみこみに しっぱい: ${loadResult.errors.length} けん`);
}
const registry = loadResult.value;

const loaded = loadSave(window.localStorage, registry);
let save: SaveData = loaded ?? newSave(registry);
let hasSave = loaded !== null;
let phase: Phase = 'title';
let stageIndex = 0;
let stageId = registry.stages[0]!.id;
let battle: BattleState | null = null;
let selected: string | null = null;
let pointerStart: PointerStart | null = null;
/** ドラッグ中の指の位置（マップ座標）。プレビュー描画が読む */
let dragMap: Vec2 | null = null;
let pendingSkill: string | null = null;
let result: { gains: XpGain[]; newTitles: string[] } | null = null;
/** 護衛対象の defId。beginStage で1度だけ作る */
let escorts: Set<string> = new Set();
const bubbles = makeBubbleState();
let talk: TalkState | null = null;
/** 会話の文字幅測定。ctx を閉じ込めるので talk.ts 側は Canvas を知らない */
const talkMeasure: Measure = (t) => {
  ctx.save();
  ctx.font = TALK_FONT;
  const w = ctx.measureText(t).width;
  ctx.restore();
  return w;
};
const talkMaxWidth = TALK_WINDOW.w - TALK_BODY_X - TALK_PAD;
const effects = makeEffectState();
const commands: SimCommand[] = [];
let accumulator = 0;
let lastTime = performance.now();

function toLogical(ev: PointerEvent): Vec2 {
  const rect = canvas.getBoundingClientRect();
  const vp = computeViewport(rect.width, rect.height);
  return screenToLogical(vp, ev.clientX - rect.left, ev.clientY - rect.top);
}

function beginStage(index: number): void {
  stageIndex = index;
  stageId = registry.stages[index]!.id;
  battle = createBattleState(registry, registry.stages[index]!, save.units, Date.now() % 100000);
  escorts = new Set(escortDefIds(battle.stage));
  selected = null;
  pendingSkill = null;
  clearBubbles(bubbles);
  resetEffects(effects);
  pointerStart = null;
  dragMap = null;
  commands.length = 0;
  accumulator = 0;
  talk = makeTalkState(
    pickStageIntro(registry, battle.stage), talkMeasure, talkMaxWidth, TALK_MAX_LINES,
  );
  phase = talk.done ? 'placement' : 'talk';
}

/** 会話フェーズを終える。読み切った記録を残してから配置へ移る */
function endTalk(): void {
  const next = markIntroRead(save, stageId);
  if (next !== save) {
    save = next;
    hasSave = writeSave(window.localStorage, save) || hasSave;
  }
  phase = 'placement';
}

function onPointerDown(ev: PointerEvent): void {
  const p = toLogical(ev);

  switch (phase) {
    case 'title':
      if (hitRect(BTN.titleNew, p)) {
        save = newSave(registry);
        hasSave = writeSave(window.localStorage, save) || hasSave;
        phase = 'select';
      } else if (hasSave && hitRect(BTN.titleContinue, p)) {
        phase = 'select';
      }
      return;

    case 'select':
      for (let i = 0; i < registry.stages.length; i++) {
        if (hitRect(stageSlot(i), p) && isStageUnlocked(registry, save, i)) beginStage(i);
      }
      return;

    case 'talk': {
      if (!talk) return;
      if (hasReadIntro(save, stageId) && hitRect(BTN.skip, p)) skipTalk(talk);
      else advanceTalk(talk, talkMeasure, talkMaxWidth, TALK_MAX_LINES);
      if (talk.done) endTalk();
      return;
    }

    case 'placement': {
      if (!battle) return;
      if (hitRect(BTN.start, p)) {
        pointerStart = null;
        writeSave(window.localStorage, save); // ステージ開始時点を保存する
        beginBattle(battle);
        phase = 'battle';
        return;
      }
      beginMapPointer(battle, p, ev);
      return;
    }

    case 'battle': {
      if (!battle) return;
      if (pendingSkill) {
        pointerStart = null;
        commands.push({ type: 'skill', uid: pendingSkill, dest: logicalToMap(p) });
        pendingSkill = null;
        return;
      }
      // 1) スキルボタン。吹き出しと重なりうるので操作を先に見る
      if (selected) {
        const unit = battle.units.find((u) => u.uid === selected)!;
        const canTap = !unit.retired && battle.time >= unit.skillCooldownUntil;
        if (canTap && hitRect(skillButtonAt(mapToLogical(unit.pos)), p)) {
          pointerStart = null;
          if (skillParam(battle.reg, unit.skillId ?? '', 'needsDest', 0) === 1) pendingSkill = selected;
          else commands.push({ type: 'skill', uid: selected });
          return;
        }
      }
      // 2) 吹き出し。当たったらその1つだけ消す
      //    ただしユニットのタップ円と重なるときは操作を優先する。吹き出しは自分の丸とは
      //    重ならない位置に出るが、すぐ上に立っている別のユニットの丸とは重なりうる
      const overUnit = pickUnit(playerUnits(battle), logicalToMap(p)) !== null;
      if (!overUnit) {
        // 描画は items の挿入順（先が下、後が上）。当たり判定も同じ順で見えている
        // ものを優先するため逆順にする
        for (const b of [...bubbles.items.values()].reverse()) {
          const unit = battle.units.find((u) => u.uid === b.uid);
          if (!unit) continue;
          if (hitRect(bubbleRectAt(mapToLogical(unit.pos), b.text), p)) {
            dismissBubble(bubbles, b.uid);
            return;
          }
        }
      }
      // 3) マップ操作
      beginMapPointer(battle, p, ev);
      return;
    }

    case 'result':
      if (hitRect(BTN.next, p)) phase = 'select';
      return;

    case 'defeat':
      if (hitRect(BTN.retry, p)) beginStage(stageIndex);
      else if (hitRect(BTN.toSelect, p)) phase = 'select';
      return;
  }
}

function beginMapPointer(state: BattleState, p: Vec2, ev: PointerEvent): void {
  if (pointerStart !== null) return; // 別の指のジェスチャが進行中は新しいジェスチャを始めない
  // drawBottomBar と同じ無フィルタ配列でインデックスを解決する。playerUnits() は retired を
  // 除外して再インデックスするため、これと混ぜるとポートレートの見た目とタップ対象がずれる
  const portraitUnits = state.units.filter((u) => u.side === 'player').slice(0, 4);
  for (let i = 0; i < 4; i++) {
    if (hitRect(portraitSlot(i), p)) {
      const unit = portraitUnits[i];
      const uid = unit && !unit.retired ? unit.uid : null;
      if (uid !== null) selected = selected === uid ? null : uid;
      pointerStart = null;
      return;
    }
  }
  const startMap = logicalToMap(p);
  const uid = pickUnit(playerUnits(state), startMap);
  pointerStart = {
    uid,
    startMap,
    wasSelected: uid !== null && selected === uid,
    pointerId: ev.pointerId,
  };
  dragMap = startMap;
  canvas.setPointerCapture(ev.pointerId);
  if (uid !== null) {
    selected = uid; // 掴んだ時点で見た目に反映する。解除は pointerup で判定する
  }
}

function onPointerMove(ev: PointerEvent): void {
  if (!pointerStart || ev.pointerId !== pointerStart.pointerId) return;
  dragMap = logicalToMap(toLogical(ev));
}

function onPointerUp(ev: PointerEvent): void {
  if (!pointerStart || ev.pointerId !== pointerStart.pointerId) return;
  const start = pointerStart;
  pointerStart = null;
  dragMap = null;
  if (!battle) return;
  if (phase !== 'placement' && phase !== 'battle') return;

  const endMap = logicalToMap(toLogical(ev));
  const g = resolveMapGesture(start, endMap, selected);
  switch (g.type) {
    case 'select':
      selected = g.uid;
      return;
    case 'deselect':
      selected = null;
      return;
    case 'moveUnit':
      if (phase === 'battle') commands.push({ type: 'move', uid: g.uid, dest: g.dest });
      else placeUnit(battle, g.uid, g.dest);
      return;
    case 'none':
      return;
  }
}

function onPointerCancel(ev: PointerEvent): void {
  if (!pointerStart || ev.pointerId !== pointerStart.pointerId) return;
  pointerStart = null;
  dragMap = null;
}

canvas.addEventListener('pointerdown', onPointerDown);
canvas.addEventListener('pointermove', onPointerMove);
canvas.addEventListener('pointerup', onPointerUp);
canvas.addEventListener('pointercancel', onPointerCancel);

function update(dt: number): void {
  tickEffects(effects, dt);
  if (phase === 'talk' && talk) {
    tickTalk(talk, dt);
    return;
  }
  if (phase !== 'battle' || !battle) return;
  syncDisplayedHp(effects, battle.units, dt);
  tickBubbles(bubbles, dt);

  accumulator += dt;
  while (accumulator >= FIXED_DT) {
    accumulator -= FIXED_DT;
    const batch = commands.splice(0, commands.length);
    step(battle, batch, FIXED_DT);
    spawnEffects(effects, battle.events);
    pushBubbles(bubbles, pickDialogue(battle.reg, battle.events));
  }

  if (battle.phase === 'defeat') {
    phase = 'defeat';
  } else if (battle.phase === 'victory') {
    const r = applyStageClear(registry, save, stageId, battle);
    save = r.save;
    hasSave = writeSave(window.localStorage, save) || hasSave;
    result = { gains: r.gains, newTitles: r.newTitles };
    phase = 'result';
  }
}

function render(): void {
  const vp = computeViewport(canvas.width, canvas.height);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.setTransform(vp.scale, 0, 0, vp.scale, vp.offsetX, vp.offsetY);

  switch (phase) {
    case 'title':
      drawTitle(ctx, hasSave);
      break;
    case 'select':
      drawStageSelect(ctx, registry, save);
      break;
    case 'talk':
      if (battle && talk) {
        drawBattle(ctx, registry, battle, null, effects, escorts);
        drawTalk(ctx, registry, talk, hasReadIntro(save, stageId));
      }
      break;
    case 'placement':
      if (battle) {
        drawBattle(ctx, registry, battle, selected, effects, escorts);
        drawPlacement(ctx, battle);
        drawBottomBar(ctx, registry, battle, selected, escorts);
      }
      break;
    case 'battle':
      if (battle) {
        drawBattle(ctx, registry, battle, selected, effects, escorts);
        drawBottomBar(ctx, registry, battle, selected, escorts);
        for (const b of bubbles.items.values()) {
          const unit = battle.units.find((u) => u.uid === b.uid);
          if (unit) drawBubble(ctx, b, mapToLogical(unit.pos));
        }
        if (selected) drawSkillButton(ctx, registry, battle, selected);
      }
      break;
    case 'result':
      if (result) drawResult(ctx, registry, result.gains, result.newTitles);
      break;
    case 'defeat':
      drawDefeat(ctx);
      break;
  }

  const dragUid = pointerStart?.uid ?? null;
  const dragPhaseOk = phase === 'placement' || phase === 'battle';
  if (battle && dragPhaseOk && dragUid !== null && dragMap !== null) {
    const unit = battle.units.find((u) => u.uid === dragUid)!;
    const blocked = !isWalkableAt(battle.grid, dragMap);
    drawDragPreview(ctx, registry, unit.pos, dragMap, unit.defId, blocked);
  }
}

function loop(now: number): void {
  const dt = Math.min(0.25, (now - lastTime) / 1000);
  lastTime = now;
  update(dt);
  render();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
