// unit-view ページの並べ方（純関数）。シートのファイルごとに 1 区画、区画の中は 12 行（状態 × 方向）× 最大のコマ数の升
import type { Registry } from '../engine/registry';
import type { MapSheet } from '../engine/schema';
import { DIRS, STATES } from '../render/anim';
import type { AnimState, Dir } from '../render/anim';
import { FOOT_INSET } from '../render/sprites';

/** 升の、コマの四方の余白。旗は右に 7px、HP バーは飛行の持ち上げ込みで上に 14px はみ出すため */
export const CELL_PAD = 16;
/** 区画の上の、シート名と定義 ID を書く文字の帯の高さ */
export const LABEL_H = 14;
/** どのパレットにも無い背景色。ここに地形は描かない */
export const VIEW_BG = [255, 0, 255] as const;

/** 区画どうしの間（見やすさのため。判定には使わない） */
const SECTION_GAP = 8;

export type ViewEntry = { defId: string; isAlly: boolean; flying: boolean; bowCap: boolean; sheet: MapSheet };

/**
 * シートを持つ定義を、仲間（ID 順）→ 敵（ID 順）の順に見て、シートのファイル名ごとに最初の 1 つだけ残す。
 * 味方と -foe が同じシートを指すときは味方が残る（旗ありで描く）
 */
export function pickViewEntries(reg: Registry): ViewEntry[] {
  const out: ViewEntry[] = [];
  const seen = new Set<string>();
  const byId = <T extends { id: string }>(m: Map<string, T>): T[] => [...m.values()].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  for (const u of byId(reg.units)) {
    const sheet = u.sprites.map;
    if (sheet === null || seen.has(sheet.sheet)) continue;
    seen.add(sheet.sheet);
    out.push({ defId: u.id, isAlly: true, flying: u.flying === true, bowCap: false, sheet });
  }
  for (const e of byId(reg.enemies)) {
    const sheet = e.sprites.map;
    if (sheet === null || seen.has(sheet.sheet)) continue;
    seen.add(sheet.sheet);
    out.push({ defId: e.id, isAlly: false, flying: e.flying === true, bowCap: e.bowDamageCap !== null, sheet });
  }
  return out;
}

export type ViewCell = {
  state: AnimState;
  dir: Dir;
  col: number;
  /** シートの行（状態 × 4 + 方向）。frameOf を使わず、ここで独立に数える */
  row: number;
  /** 足元の点（絵の足元の行がここに来る） */
  foot: { x: number; y: number };
  box: { x: number; y: number; w: number; h: number };
};
export type ViewSection = { entry: ViewEntry; label: { x: number; y: number }; cells: ViewCell[] };
export type ViewLayout = { width: number; height: number; sections: ViewSection[] };

export function layoutUnitView(entries: ViewEntry[], maxWidth: number): ViewLayout {
  const sections: ViewSection[] = [];
  let width = 0;
  let x = 0;
  let y = 0;
  let shelfH = 0;
  for (const entry of entries) {
    const f = entry.sheet.frame;
    const cell = f + 2 * CELL_PAD;
    const cols = Math.max(entry.sheet.idle.frames, entry.sheet.walk.frames, entry.sheet.attack.frames);
    const secW = cols * cell;
    const secH = LABEL_H + 12 * cell;
    if (x > 0 && x + secW > maxWidth) {
      x = 0;
      y += shelfH + SECTION_GAP;
      shelfH = 0;
    }
    const cells: ViewCell[] = [];
    for (let row = 0; row < 12; row++) {
      for (let col = 0; col < cols; col++) {
        const bx = x + col * cell;
        const by = y + LABEL_H + row * cell;
        cells.push({
          state: STATES[Math.floor(row / 4)]!,
          dir: DIRS[row % 4]!,
          col,
          row,
          foot: { x: bx + cell / 2, y: by + CELL_PAD + f - FOOT_INSET },
          box: { x: bx, y: by, w: cell, h: cell },
        });
      }
    }
    sections.push({ entry, label: { x, y }, cells });
    width = Math.max(width, x + secW);
    shelfH = Math.max(shelfH, secH);
    x += secW + SECTION_GAP;
  }
  return { width, height: y + shelfH, sections };
}
