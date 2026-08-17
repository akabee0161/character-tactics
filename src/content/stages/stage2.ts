import type { StageDef } from '../../core/types';

const A = { x: 848, y: 80 };
const B = { x: 848, y: 368 };

export const STAGE2: StageDef = {
  id: 2,
  name: 'ふたつの みなと',
  cell: 32,
  mapRows: [
    '##############################',
    '####......................####',
    '###........................###',
    '##..........................##',
    '##..........................##',
    '##.......####...............##',
    '##.......####...............##',
    '##.......####...............##',
    '##.......####...............##',
    '##..........................##',
    '##..........................##',
    '###........................###',
    '####......................####',
    '##############################',
  ],
  fort: { x: 144, y: 240 },
  landings: [A, B],
  garumFlees: true,
  waves: [
    { spawns: [
      { at: 0, kind: 'narazumono', from: A },
      { at: 1.5, kind: 'narazumono', from: B },
      { at: 3, kind: 'narazumono', from: A },
      { at: 4.5, kind: 'narazumono', from: B },
    ] },
    { spawns: [
      { at: 0, kind: 'narazumono', from: A },
      { at: 1, kind: 'narazumono', from: B },
      { at: 2.5, kind: 'narazumono', from: A },
      { at: 3.5, kind: 'narazumono', from: B },
      { at: 5, kind: 'narazumono', from: A },
      { at: 6, kind: 'narazumono', from: B },
    ] },
    { spawns: [
      { at: 0, kind: 'narazumono', from: A },
      { at: 0, kind: 'narazumono', from: B },
      { at: 3, kind: 'narazumono', from: A },
      { at: 3, kind: 'narazumono', from: B },
      { at: 6, kind: 'garum', from: A },
    ] },
  ],
};
