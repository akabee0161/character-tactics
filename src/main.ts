import { imageUrls, loadRegistry } from './engine/loader';
import { makeImageCache } from './render/images';
import { lookupDef, skillParam } from './engine/registry';
import { pickDialogue, pickStageIntro, pickStageOutro } from './core/dialogue';
import { SKILL_EFFECT_IDS } from './core/skills';
import { beginBattle, canPlaceAt, createBattleState, placeUnit } from './core/state';
import { playerUnits, step } from './core/sim';
import type { SimCommand } from './core/sim';
import { drawBattle, drawDragPreview } from './render/draw';
import { escortDefIds } from './render/objectives-view';
import { isWalkableAt } from './core/field';
import { makeEffectState, resetEffects, spawnEffects, syncDisplayedHp, tickEffects } from './render/effects';
import { makeAnimStore, noteAttacks, resetAnim, updateMotion } from './render/anim';
import { LOGICAL_H, LOGICAL_W, computeViewport, fitCanvas, logicalToMap, screenToLogical } from './render/viewport';
import { clearSpeech, makeSpeechState, pushSpeech, tickSpeech } from './ui/speech';
import { applyStageClear, hasReadIntro, isStageUnlocked, markIntroRead } from './ui/flow';
import { hitRect, pickUnit } from './ui/hit';
import { resolveMapGesture } from './ui/input';
import type { PointerStart } from './ui/input';
import {
  BOTTOM_PANEL_Y, BTN, MESSAGE_BAR, STAGE_LIST_VIEW, TALK_BODY_X, TALK_FONT, TALK_MAX_LINES,
  TALK_PAD, TALK_WINDOW, portraitSlot, stageListContentH, stageSlot,
} from './ui/layout';
import { clampScroll, isTap, maxScroll } from './ui/scroll';
import {
  drawBottomBar, drawDefeat, drawLoadErrors, drawPlacement, drawResult,
  drawSpeechBar, drawStageSelect, drawTalk, drawTitle,
} from './ui/screens';
import { advanceTalk, makeTalkState, skipTalk, tickTalk } from './ui/talk';
import type { Measure, TalkState } from './ui/talk';
import { loadSave, newSave, writeSave } from './save/save';
import type { SaveData } from './save/save';
import type { XpGain } from './ui/flow';
import type { BattleState, Vec2 } from './core/types';

const FIXED_DT = 1 / 60;

type Phase = 'title' | 'select' | 'talk' | 'placement' | 'battle' | 'outro' | 'result' | 'defeat';

const canvas = document.getElementById('game') as HTMLCanvasElement;
const stageBox = document.getElementById('stage') as HTMLElement;
const ctx = canvas.getContext('2d')!;

function resize(): void {
  const box = stageBox.getBoundingClientRect();
  const fit = fitCanvas(box.width, box.height, window.devicePixelRatio);
  canvas.style.width = `${fit.cssW}px`;
  canvas.style.height = `${fit.cssH}px`;
  // 当てたあとの実寸から backing store を決める。CSS が何らかの制約を効かせても、
  // 描画と入力が同じ実寸を見ているかぎりクリック位置はずれない
  const actual = canvas.getBoundingClientRect();
  canvas.width = Math.max(1, Math.round(actual.width * window.devicePixelRatio));
  canvas.height = Math.max(1, Math.round(actual.height * window.devicePixelRatio));
  // width への代入でコンテキストの状態が全部リセットされるので、ここで毎回入れ直す
  ctx.imageSmoothingEnabled = false;
}
// window の resize ではブラウザズームによる devicePixelRatio の変化を拾えない
new ResizeObserver(resize).observe(stageBox);
resize();

const loadResult = loadRegistry(SKILL_EFFECT_IDS);
if (!loadResult.ok) {
  // 部分的に読めたぶんで続行しない。アセットを足したその場で事故に気づけることを優先する
  const vp = computeViewport(canvas.width, canvas.height);
  ctx.setTransform(vp.scale, 0, 0, vp.scale, vp.offsetX, vp.offsetY);
  drawLoadErrors(ctx, loadResult.errors);
  throw new Error(`assets の 読み込みに 失敗: ${loadResult.errors.length} 件`);
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
/**
 * ステージ選択の縦スクロール。盤面のドラッグ（pointerStart / dragMap）とは
 * 別系統で持つ。1つに混ぜると、フェーズごとに意味の違う値が同じ変数に入って読めなくなる
 */
let stageScrollY = 0;
let stageDrag: { pointerId: number; startY: number; startScrollY: number } | null = null;

function stageScrollMax(): number {
  return maxScroll(stageListContentH(registry.stages.length), STAGE_LIST_VIEW.h);
}

/** 選択画面に入るたびに一番上へ戻す */
function toStageSelect(): void {
  stageScrollY = 0;
  stageDrag = null;
  phase = 'select';
}

let pendingSkill: string | null = null;
let result: { gains: XpGain[]; newTitles: string[] } | null = null;
/** 護衛対象の defId。beginStage で1度だけ作る */
let escorts: Set<string> = new Set();
const speech = makeSpeechState();
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
const anim = makeAnimStore();

/** 攻撃モーションの長さ。シートを持たないユニットは null */
function attackDuration(defId: string): number | null {
  const def = lookupDef(registry, defId);
  const sheet = def?.sprites.map;
  if (!sheet) return null;
  return sheet.attack.frames / sheet.attack.fps;
}
const images = makeImageCache(imageUrls());
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
  clearSpeech(speech);
  resetEffects(effects);
  resetAnim(anim);
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

/** 勝利の後始末。会話があってもなくても、必ずここを1度だけ通す */
function finishStage(state: BattleState): void {
  const r = applyStageClear(registry, save, stageId, state);
  save = r.save;
  hasSave = writeSave(window.localStorage, save) || hasSave;
  result = { gains: r.gains, newTitles: r.newTitles };
  phase = 'result';
}

function onPointerDown(ev: PointerEvent): void {
  const p = toLogical(ev);

  switch (phase) {
    case 'title':
      if (hitRect(BTN.titleNew, p)) {
        save = newSave(registry);
        hasSave = writeSave(window.localStorage, save) || hasSave;
        toStageSelect();
      } else if (hasSave && hitRect(BTN.titleContinue, p)) {
        toStageSelect();
      }
      return;

    case 'select':
      if (hitRect(STAGE_LIST_VIEW, p)) {
        stageDrag = { pointerId: ev.pointerId, startY: p.y, startScrollY: stageScrollY };
        canvas.setPointerCapture(ev.pointerId);
      }
      return;

    case 'talk': {
      if (!talk) return;
      if (hasReadIntro(save, stageId) && hitRect(BTN.skip, p)) skipTalk(talk);
      else advanceTalk(talk, talkMeasure, talkMaxWidth, TALK_MAX_LINES);
      if (talk.done) endTalk();
      return;
    }

    case 'outro': {
      if (!talk || !battle) return;
      // クリア済みのステージ（2周目以降）だけ「とばす」を出す
      if (save.clearedStageIds.includes(stageId) && hitRect(BTN.skip, p)) skipTalk(talk);
      else advanceTalk(talk, talkMeasure, talkMaxWidth, TALK_MAX_LINES);
      if (talk.done) finishStage(battle);
      return;
    }

    case 'placement': {
      if (!battle) return;
      if (hitRect(MESSAGE_BAR, p)) {
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
      beginMapPointer(battle, p, ev);
      return;
    }

    case 'result':
      if (hitRect(BTN.next, p)) toStageSelect();
      return;

    case 'defeat':
      if (hitRect(BTN.retry, p)) beginStage(stageIndex);
      else if (hitRect(BTN.toSelect, p)) toStageSelect();
      return;
  }
}

function beginMapPointer(state: BattleState, p: Vec2, ev: PointerEvent): void {
  if (pointerStart !== null) return; // 別の指のジェスチャが進行中は新しいジェスチャを始めない
  // drawBottomBar と同じ無フィルタ配列でインデックスを解決する。playerUnits() は retired を
  // 除外して再インデックスするため、これと混ぜるとポートレートの見た目とタップ対象がずれる
  const portraitUnits = state.units.filter((u) => u.side === 'player').slice(0, 4);
  for (let i = 0; i < 4; i++) {
    if (!hitRect(portraitSlot(i), p)) continue;
    pointerStart = null;
    const unit = portraitUnits[i];
    if (!unit || unit.retired) return;
    // ポートレートのタップは「選択して必殺技を出す」。選択の解除はマップ上の再タップで行う
    selected = unit.uid;
    if (phase !== 'battle') return;
    if (unit.skillId === null || state.time < unit.skillCooldownUntil) return;
    if (skillParam(state.reg, unit.skillId, 'needsDest', 0) === 1) pendingSkill = unit.uid;
    else commands.push({ type: 'skill', uid: unit.uid });
    return;
  }
  // 下パネルのタップはマップ操作に落とさない。マップの外を移動先に解釈させない
  if (p.y >= BOTTOM_PANEL_Y) {
    pointerStart = null;
    return;
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
  if (stageDrag && ev.pointerId === stageDrag.pointerId) {
    const dy = toLogical(ev).y - stageDrag.startY;
    stageScrollY = clampScroll(stageDrag.startScrollY - dy, stageScrollMax());
    return;
  }
  if (!pointerStart || ev.pointerId !== pointerStart.pointerId) return;
  dragMap = logicalToMap(toLogical(ev));
}

function onPointerUp(ev: PointerEvent): void {
  if (stageDrag && ev.pointerId === stageDrag.pointerId) {
    const start = stageDrag;
    stageDrag = null;
    const p = toLogical(ev);
    // 指がほとんど動いていなければ選んだとみなす。動いていればスクロールだった
    if (phase === 'select' && isTap(p.y - start.startY)) {
      const hit = { x: p.x, y: p.y + stageScrollY };
      for (let i = 0; i < registry.stages.length; i++) {
        if (hitRect(stageSlot(i), hit) && isStageUnlocked(registry, save, i)) beginStage(i);
      }
    }
    return;
  }
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
  if (stageDrag && ev.pointerId === stageDrag.pointerId) {
    stageDrag = null;
    return;
  }
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
  if ((phase === 'talk' || phase === 'outro') && talk) {
    tickTalk(talk, dt);
    return;
  }
  if (phase !== 'battle' || !battle) return;
  syncDisplayedHp(effects, battle.units, dt);
  tickSpeech(speech, dt);

  accumulator += dt;
  while (accumulator >= FIXED_DT) {
    accumulator -= FIXED_DT;
    const batch = commands.splice(0, commands.length);
    step(battle, batch, FIXED_DT);
    spawnEffects(effects, battle.events);
    noteAttacks(anim, battle.events, battle.time, attackDuration);
    pushSpeech(speech, pickDialogue(battle.reg, battle.events));
  }
  updateMotion(anim, battle.units, battle.time);

  if (battle.phase === 'defeat') {
    phase = 'defeat';
  } else if (battle.phase === 'victory') {
    clearSpeech(speech);   // 会話の邪魔になるので消す。時間は止まっている
    talk = makeTalkState(
      pickStageOutro(registry, battle.stage), talkMeasure, talkMaxWidth, TALK_MAX_LINES,
    );
    if (talk.done) finishStage(battle);
    else {
      // battle.time は勝利で止まる。anim を持ち越すと最後の攻撃者が
      // 攻撃コマのまま固まって見えるので、アウトロ開始時にクリアする
      resetAnim(anim);
      phase = 'outro';
    }
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
      drawStageSelect(ctx, registry, save, images, stageScrollY);
      break;
    case 'talk':
      if (battle && talk) {
        drawBattle(ctx, registry, battle, null, effects, escorts, images, anim);
        drawTalk(ctx, registry, talk, hasReadIntro(save, stageId), images);
      }
      break;
    case 'outro':
      if (battle && talk) {
        drawBattle(ctx, registry, battle, null, effects, escorts, images, anim);
        drawTalk(ctx, registry, talk, save.clearedStageIds.includes(stageId), images);
      }
      break;
    case 'placement':
      if (battle) {
        drawBattle(ctx, registry, battle, selected, effects, escorts, images, anim);
        drawBottomBar(ctx, registry, battle, selected, escorts, images);
        drawPlacement(ctx, battle);
      }
      break;
    case 'battle':
      if (battle) {
        drawBattle(ctx, registry, battle, selected, effects, escorts, images, anim);
        drawBottomBar(ctx, registry, battle, selected, escorts, images);
        if (speech.current !== null) drawSpeechBar(ctx, registry, speech.current, images);
      }
      break;
    case 'result':
      if (result) drawResult(ctx, registry, result.gains, result.newTitles, images);
      break;
    case 'defeat':
      drawDefeat(ctx);
      break;
  }

  const dragUid = pointerStart?.uid ?? null;
  const dragPhaseOk = phase === 'placement' || phase === 'battle';
  if (battle && dragPhaseOk && dragUid !== null && dragMap !== null) {
    const unit = battle.units.find((u) => u.uid === dragUid)!;
    const blocked = phase === 'placement'
      ? !canPlaceAt(battle.stage, battle.grid, dragMap)
      : !isWalkableAt(battle.grid, dragMap);
    drawDragPreview(ctx, registry, unit.pos, dragMap, unit.defId, blocked, images);
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
