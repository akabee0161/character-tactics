// ヘッドレス Chromium を CDP（Chrome DevTools Protocol）で動かす小さな道具。unit-view と一時の撮影で使う。
// 依存は増やさない: WebSocket は Node の組み込み、開発サーバは vite の createServer。
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'vite';

export type Cdp = {
  send<T = unknown>(method: string, params?: Record<string, unknown>): Promise<T>;
  close(): void;
};

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** 開発サーバを起こす。url は base（/play/character-tactics/）を含む */
export async function startDevServer(): Promise<{ url: string; close(): Promise<void> }> {
  const server = await createServer({
    server: { port: 5180, strictPort: false, host: '127.0.0.1' },
    logLevel: 'error',
  });
  await server.listen();
  const url = server.resolvedUrls?.local[0];
  if (url === undefined) {
    await server.close();
    throw new Error('開発サーバの URL が分からない');
  }
  return { url, close: () => server.close() };
}

type Target = { type: string; webSocketDebuggerUrl?: string };

/** そのポートで CDP が答えるか（= 先客がいるか） */
async function portAnswers(port: number): Promise<boolean> {
  try {
    const res = await fetch(`http://127.0.0.1:${port}/json/version`);
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * 起こした Chromium のページだけを選ぶ。起こすときに --user-agent に印を付けておき、/json/version の User-Agent に
 * その印があるときだけ、そのポートの page に繋ぐ（別の Chromium が同じポートで答えていても、そのページには繋がない）
 */
async function waitForTarget(port: number, marker: string, timeoutMs: number): Promise<string> {
  const start = Date.now();
  let last = '';
  while (Date.now() - start < timeoutMs) {
    try {
      const ver = (await (await fetch(`http://127.0.0.1:${port}/json/version`)).json()) as { 'User-Agent'?: string };
      if (!(ver['User-Agent'] ?? '').includes(marker)) {
        last = `そのポートで答えているのは別の Chromium（User-Agent に印が無い）`;
        await sleep(200);
        continue;
      }
      const res = await fetch(`http://127.0.0.1:${port}/json/list`);
      const list = (await res.json()) as Target[];
      const page = list.find((t) => t.type === 'page' && t.webSocketDebuggerUrl !== undefined);
      if (page?.webSocketDebuggerUrl !== undefined) return page.webSocketDebuggerUrl;
      last = 'page がまだ無い';
    } catch (e) {
      last = e instanceof Error ? e.message : String(e);
    }
    await sleep(200);
  }
  throw new Error(`Chromium が起きない: ${timeoutMs}ms 待っても /json/list が答えない（${last}）`);
}

function connect(wsUrl: string): Promise<Cdp> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    let nextId = 1;
    const pending = new Map<number, { resolve(v: unknown): void; reject(e: Error): void }>();
    const waiters = new Map<string, { res(p: unknown): void; rej(e: Error): void }[]>();
    // 返事待ちとイベント待ちを全部失敗にする。Chromium やページが落ちたとき、待ちが永遠に残らないように
    const failAll = (e: Error) => {
      for (const p of pending.values()) p.reject(e);
      pending.clear();
      for (const list of waiters.values()) for (const w of list) w.rej(e);
      waiters.clear();
    };
    ws.addEventListener('message', (ev) => {
      const msg = JSON.parse(String(ev.data)) as {
        id?: number; result?: unknown; error?: { message: string }; method?: string; params?: unknown;
      };
      if (msg.id !== undefined) {
        const p = pending.get(msg.id);
        if (p === undefined) return;
        pending.delete(msg.id);
        if (msg.error) p.reject(new Error(`CDP ${msg.error.message}`));
        else p.resolve(msg.result);
      } else if (msg.method === 'Inspector.targetCrashed') {
        failAll(new Error('ページが落ちた（Inspector.targetCrashed）'));
      } else if (msg.method !== undefined) {
        const list = waiters.get(msg.method);
        if (list) {
          waiters.delete(msg.method);
          for (const w of list) w.res(msg.params);
        }
      }
    });
    ws.addEventListener('error', () => reject(new Error('Chromium が起きない: CDP の WebSocket に繋げない')));
    ws.addEventListener('close', () => failAll(new Error('CDP の接続が閉じた')));
    ws.addEventListener('open', () => {
      const cdp: Cdp & { once(method: string): Promise<unknown> } = {
        send<T>(method: string, params: Record<string, unknown> = {}): Promise<T> {
          const id = nextId++;
          return new Promise<T>((res, rej) => {
            pending.set(id, { resolve: res as (v: unknown) => void, reject: rej });
            ws.send(JSON.stringify({ id, method, params }));
          });
        },
        once(method: string): Promise<unknown> {
          return new Promise((res, rej) => {
            const list = waiters.get(method) ?? [];
            list.push({ res, rej });
            waiters.set(method, list);
          });
        },
        close() { ws.close(); },
      };
      resolve(cdp);
    });
  });
}

/** Chromium を起こして CDP で繋ぐ。close で Chromium を止め、一時のプロファイルを消す */
export async function launchChrome(opts: { chrome: string; port: number }): Promise<{ cdp: Cdp; close(): Promise<void> }> {
  // そのポートに先客（別の Chromium）がいると、その page を自分のものと取り違えて操作してしまう。先に空きを確かめる
  if (await portAnswers(opts.port)) {
    throw new Error(`Chromium が起きない: CDP のポート ${opts.port} はすでに使われている（CDP_PORT を変えてください）`);
  }
  const profile = mkdtempSync(join(tmpdir(), 'unit-view-chrome-'));
  const marker = `unit-view-${randomUUID()}`;
  const child = spawn(
    opts.chrome,
    [
      '--headless=new', '--no-sandbox', '--disable-gpu',
      `--remote-debugging-port=${opts.port}`, `--user-data-dir=${profile}`, `--user-agent=${marker}`, 'about:blank',
    ],
    { stdio: 'ignore' },
  );
  let spawnError: string | null = null;
  child.on('error', (e) => { spawnError = e.message; });
  const stop = async () => {
    if (child.exitCode === null && !child.killed) {
      child.kill('SIGKILL');
      await new Promise<void>((r) => { child.once('exit', () => r()); setTimeout(r, 3000); });
    }
    rmSync(profile, { recursive: true, force: true });
  };
  try {
    const wsUrl = await Promise.race([
      // 空きを確かめた後で別の Chromium が同じポートを取る競合に備え、繋ぐ先は自分が起こした Chromium（User-Agent の印）に限る
      waitForTarget(opts.port, marker, 15000),
      (async () => {
        while (spawnError === null) await sleep(100);
        throw new Error(`Chromium が起きない: ${spawnError}`);
      })(),
    ]);
    const cdp = await connect(wsUrl);
    return { cdp, close: async () => { cdp.close(); await stop(); } };
  } catch (e) {
    await stop();
    throw e;
  }
}

type WithOnce = Cdp & { once(method: string): Promise<unknown> };

/** ページを開く。deviceScaleFactor は 1 に固定。initScript があれば、ページの script より前に実行する */
export async function openPage(
  cdp: Cdp, url: string, size: { width: number; height: number }, initScript?: string,
): Promise<void> {
  await cdp.send('Page.enable');
  await cdp.send('Inspector.enable'); // ページ（レンダラ）が落ちたら Inspector.targetCrashed が来る
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: size.width, height: size.height, deviceScaleFactor: 1, mobile: false,
  });
  if (initScript !== undefined) {
    await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: initScript });
  }
  const loaded = (cdp as WithOnce).once('Page.loadEventFired');
  // navigate が先に失敗したとき、loaded の失敗が「処理されない reject」になってプロセスが落ちないように
  loaded.catch(() => undefined);
  await cdp.send('Page.navigate', { url });
  await loaded;
}

export async function evaluate<T>(cdp: Cdp, expression: string): Promise<T> {
  const r = await cdp.send<{ result: { value?: T }; exceptionDetails?: { text: string; exception?: { description?: string } } }>(
    'Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true },
  );
  if (r.exceptionDetails) {
    throw new Error(`ページの中で失敗: ${r.exceptionDetails.exception?.description ?? r.exceptionDetails.text}`);
  }
  return r.result.value as T;
}

/** 式の値が null / undefined でなくなるまで 200ms ごとに評価する */
export async function waitFor<T>(cdp: Cdp, expression: string, timeoutMs: number): Promise<T> {
  const start = Date.now();
  for (;;) {
    const v = await evaluate<T | null | undefined>(cdp, expression);
    if (v !== null && v !== undefined) return v;
    if (Date.now() - start >= timeoutMs) throw new Error(`時間切れ: ${expression}`);
    await sleep(200);
  }
}

export async function screenshot(cdp: Cdp, path: string): Promise<void> {
  const r = await cdp.send<{ data: string }>('Page.captureScreenshot', { format: 'png' });
  writeFileSync(path, Buffer.from(r.data, 'base64'));
}
