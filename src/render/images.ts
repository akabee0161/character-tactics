/**
 * 画像のキャッシュ。ローディング画面は作らない方針なので、読み込みは待たない。
 * 読み終わっていないあいだ imageFor は null を返し、呼び出し側は図形のプレースホルダに落ちる
 */
export type ImageCache = { byName: Map<string, HTMLImageElement> };

/** キーは '/assets/images/tate.png' のようなパス。ファイル名だけを索引にする */
export function makeImageCache(urls: Record<string, string>): ImageCache {
  const byName = new Map<string, HTMLImageElement>();
  for (const [path, url] of Object.entries(urls)) {
    const name = path.split('/').pop();
    if (name === undefined) continue;
    const img = new Image();
    img.src = url;
    byName.set(name, img);
  }
  return { byName };
}

export function imageFor(cache: ImageCache, name: string | null): CanvasImageSource | null {
  if (name === null) return null;
  const img = cache.byName.get(name);
  if (!img || !img.complete || img.naturalWidth === 0) return null;
  return img;
}
