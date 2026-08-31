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

export function loadRegistry(knownSkillIds: readonly string[]): Validated<Registry> {
  return buildRegistry(assetFiles(), knownSkillIds);
}
