// ユニットの絵をゲームの描画で描き、シートと画素で照らし合わせる CLI。使い方: npm run unit-view [-- --out <dir>]
// 環境変数 CHROME（Chromium の実行ファイル）が要る。CDP のポートは CDP_PORT（既定 9333）。
// 終了コード: 0 = 全部一致、1 = 違う升がある、2 = ページが開けない・時間切れ・Chromium が起きない
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { evaluate, launchChrome, openPage, screenshot, startDevServer, waitFor } from './cdp';
import type { UnitViewResult } from '../src/dev/unit-view';

const WAIT_MS = 60000;

function parseOut(argv: string[]): string {
  let out = 'out/unit-view';
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a === '--') continue;
    if (a === '--out') {
      const v = argv[i + 1];
      if (v === undefined || v.startsWith('--')) {
        console.error('--out には保存先のディレクトリを書いてください');
        process.exit(2);
      }
      out = v;
      i++;
    } else {
      console.error(`引数が不正です: ${a}\n使い方: npm run unit-view [-- --out <dir>]`);
      process.exit(2);
    }
  }
  return out;
}

async function main(): Promise<number> {
  const outDir = parseOut(process.argv.slice(2));
  const chrome = process.env.CHROME;
  if (chrome === undefined || chrome === '') {
    console.error('環境変数 CHROME に Chromium の実行ファイルを入れてください');
    return 2;
  }
  const port = Number(process.env.CDP_PORT ?? 9333);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    console.error(`CDP_PORT が不正です: ${process.env.CDP_PORT}`);
    return 2;
  }

  let dev: Awaited<ReturnType<typeof startDevServer>> | null = null;
  let browser: Awaited<ReturnType<typeof launchChrome>> | null = null;
  // 時間切れや Ctrl+C・kill のときも Chromium と開発サーバを止めてから終わる
  stopAll = async () => {
    await browser?.close().catch(() => undefined);
    await dev?.close().catch(() => undefined);
  };
  try {
    dev = await startDevServer();
    browser = await launchChrome({ chrome, port });
    const { cdp } = browser;
    await openPage(cdp, `${dev.url}unit-view.html`, { width: 800, height: 600 });
    const result = await waitFor<UnitViewResult>(cdp, 'window.__unitView ?? null', WAIT_MS);
    if (result.error !== null) {
      console.error(`ページが失敗: ${result.error}`);
      return 2;
    }
    // 撮るために、窓を描いた大きさに合わせる（論理 1px = 画面 1px）
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: result.width, height: result.height, deviceScaleFactor: 1, mobile: false,
    });
    await evaluate(cdp, 'new Promise((r) => requestAnimationFrame(() => r(true)))');
    mkdirSync(outDir, { recursive: true });
    await screenshot(cdp, join(outDir, 'unit-view.png'));
    writeFileSync(join(outDir, 'unit-view.json'), JSON.stringify(result, null, 2));

    let ng = 0;
    for (const s of result.sections) {
      const maxCovered = `かぶり最大 ${s.maxCovered}`;
      if (s.mismatched.length === 0) {
        console.log(`OK  ${s.sheet} (${s.defId})  ${maxCovered}`);
      } else {
        ng += s.mismatched.length;
        console.log(`NG  ${s.sheet} (${s.defId})  違う升 ${s.mismatched.length}  ${maxCovered}`);
        for (const m of s.mismatched) console.log(`  ${m.state} ${m.dir} ${m.col}: ${m.pixels} 画素`);
      }
    }
    console.log(`画面: ${join(outDir, 'unit-view.png')}`);
    return ng === 0 ? 0 : 1;
  } catch (e) {
    console.error(e instanceof Error ? e.message : String(e));
    return 2;
  } finally {
    await stopAll();
  }
}

let stopAll: () => Promise<void> = async () => undefined;

/** 全体の上限。ページや Chromium が止まって返事が来ないときも、終了コード 2 で終わる */
const TOTAL_LIMIT_MS = WAIT_MS + 60000;
const hardLimit = setTimeout(() => {
  console.error(`時間切れ: 全体で ${TOTAL_LIMIT_MS / 1000} 秒を超えた`);
  void stopAll().finally(() => process.exit(2));
}, TOTAL_LIMIT_MS);
for (const sig of ['SIGINT', 'SIGTERM'] as const) {
  process.on(sig, () => {
    console.error(`${sig} を受けた。後始末をして終わる`);
    void stopAll().finally(() => process.exit(2));
  });
}

main().then(
  (code) => { clearTimeout(hardLimit); process.exit(code); },
  (e) => {
    console.error(e instanceof Error ? e.message : String(e));
    process.exit(2);
  },
);
