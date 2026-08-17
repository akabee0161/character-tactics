import type { StageDef } from '../../core/types';

const A = { x: 848, y: 80 };
const B = { x: 848, y: 368 };

export const STAGE3: StageDef = {
  id: 3,
  name: 'ガルムの さいご',
  cell: 32,
  mapRows: [
    '##############################',
    '####......................####',
    '###........................###',
    '##...........####...........##',
    '##...........####...........##',
    '##..........................##',
    '##..........................##',
    '##..........................##',
    '##..........................##',
    '##...........####...........##',
    '##...........####...........##',
    '###........................###',
    '####......................####',
    '##############################',
  ],
  fort: { x: 144, y: 240 },
  landings: [A, B],
  garumFlees: false,
  waves: [
    { spawns: [
      { at: 0, kind: 'narazumono', from: A },
      { at: 1, kind: 'tatemochi', from: B },
      { at: 3, kind: 'narazumono', from: A },
    ] },
    { spawns: [
      { at: 0, kind: 'tatemochi', from: A },
      { at: 1, kind: 'tatemochi', from: B },
      { at: 2, kind: 'narazumono', from: A },
      { at: 3, kind: 'narazumono', from: B },
      { at: 4, kind: 'narazumono', from: A },
    ] },
    { spawns: [
      { at: 0, kind: 'narazumono', from: A },
      { at: 0, kind: 'narazumono', from: B },
      { at: 2, kind: 'narazumono', from: A },
      { at: 2, kind: 'narazumono', from: B },
      { at: 4, kind: 'tatemochi', from: A },
      { at: 5, kind: 'garum', from: B },
    ] },
  ],
};
