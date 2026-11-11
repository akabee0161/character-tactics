// ステージの難易度を測る CLI。使い方: npm run balance [-- <シード数（既定 40）>] [--check]
import { loadRegistry } from '../src/engine/loader';
import { SKILL_EFFECT_IDS } from '../src/core/skills';
import { formatTable, isOutOfBand, measure } from '../src/core/balance';

let seeds = 40;
let check = false;
for (const a of process.argv.slice(2)) {
  if (a === '--') continue;
  if (a === '--check') check = true;
  else if (/^[1-9][0-9]*$/.test(a)) seeds = Number(a);
  else {
    console.error(`引数が不正です: ${a}\n使い方: npm run balance [-- <シード数（正の整数）>] [--check]`);
    process.exit(2);
  }
}

const r = loadRegistry(SKILL_EFFECT_IDS);
if (!r.ok) {
  console.error('assets の よみこみに しっぱい:\n' + r.errors.map((e) => `  ${e.file} ${e.path}: ${e.reason}`).join('\n'));
  process.exit(2);
}

const stats = measure(r.value, seeds);
console.log(formatTable(stats));
if (check && stats.some(isOutOfBand)) process.exit(1);
