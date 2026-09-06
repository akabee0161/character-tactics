import { buildRegistry } from './registry';
import type { Registry } from './registry';
import type { Validated } from './schema';

/**
 * ビルド時にアセットをバンドルへ同梱する。非同期ロードとローディング画面を作らずに済み、
 * Cloudflare Workers Static Assets 上でもパス解決の問題が起きない。
 * 実行時に外部ファイルから読みたくなったら、差し替えるのはこの1本だけでよい。
 */
export function assetFiles(): Record<string, unknown> {
  return import.meta.glob('/assets/**/*.json', { eager: true, import: 'default' });
}

/**
 * 画像もビルド時に取り込む。JSON と同じく base 付きの URL に解決されるので、
 * パス付きルートの Workers 上でも壊れない
 */
export function imageUrls(): Record<string, string> {
  return import.meta.glob('/assets/images/*.png', { eager: true, query: '?url', import: 'default' });
}

/** '/assets/images/tate.png' → 'tate.png' */
export function imageNames(urls: Record<string, string>): string[] {
  return Object.keys(urls).map((p) => p.split('/').pop() ?? '');
}

export function loadRegistry(knownSkillIds: readonly string[]): Validated<Registry> {
  return buildRegistry(assetFiles(), knownSkillIds, imageNames(imageUrls()));
}
