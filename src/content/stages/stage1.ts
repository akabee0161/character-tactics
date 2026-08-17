import type { StageDef } from '../../core/types';

const L = { x: 848, y: 240 };

export const STAGE1: StageDef = {
  id: 1,
  name: 'はじまりの しま',
  cell: 32,
  mapRows: [
    '##############################',
    '##############################',
    '####......................####',
    '###........................###',
    '##..........................##',
    '##..........................##',
    '##..........................##',
    '##..........................##',
    '##..........................##',
    '##..........................##',
    '###........................###',
    '####......................####',
    '##############################',
    '##############################',
  ],
  fort: { x: 144, y: 240 },
  landings: [L],
  garumFlees: true,
  waves: [
    { spawns: [
      { at: 0, kind: 'narazumono', from: L },
      { at: 3, kind: 'narazumono', from: L },
      { at: 6, kind: 'narazumono', from: L },
    ] },
    { spawns: [
      { at: 0, kind: 'narazumono', from: L },
      { at: 2.5, kind: 'narazumono', from: L },
      { at: 5, kind: 'narazumono', from: L },
      { at: 7.5, kind: 'narazumono', from: L },
    ] },
    { spawns: [
      { at: 0, kind: 'narazumono', from: L },
      { at: 2, kind: 'narazumono', from: L },
      { at: 4, kind: 'narazumono', from: L },
      { at: 6, kind: 'garum', from: L },
    ] },
  ],
};
