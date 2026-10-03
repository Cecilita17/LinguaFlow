import { FONT_OPTIONS } from '../utils/fontPreferences.js';

export const OFFLINE_FONT_CACHE = 'linguaflow-fonts-v1';
export const FONT_DOWNLOAD_EVENT = 'linguaflow-fonts-downloaded';
const metadataUrl = (origin, family) => `${origin}/__linguaflow-fonts/${encodeURIComponent(family)}.json`;
const fontUrls = css => [...new Set([...css.matchAll(/url\(\s*['"]?([^'"\s)]+)['"]?\s*\)/g)].map(match => match[1]))];

export function offlineFontSupported() {
  return typeof caches !== 'undefined' && typeof URL.createObjectURL === 'function';
}

async function readInstalled(cache, origin, family) {
  const response = await cache.match(metadataUrl(origin, family));
  if (!response) return null;
  const entry = await response.json();
  if (entry.family !== family || !entry.css || !Array.isArray(entry.urls) || !entry.urls.length) return null;
  for (const url of entry.urls) if (!await cache.match(url)) return null;
  return entry;
}

export async function isFontDownloaded(family, { cacheStorage = globalThis.caches, origin = globalThis.location?.origin } = {}) {
  if (!cacheStorage || !origin) return false;
  try { return Boolean(await readInstalled(await cacheStorage.open(OFFLINE_FONT_CACHE), origin, family)); }
  catch { return false; }
}

export async function downloadFontForOffline(option, { cacheStorage = globalThis.caches, origin = globalThis.location?.origin, fetcher = globalThis.fetch, signal, onProgress } = {}) {
  if (!cacheStorage || !origin) throw new Error('FONT_OFFLINE_UNSUPPORTED');
  const known = Object.values(FONT_OPTIONS).flat().find(font => font.family === option?.family);
  if (!known || known.family === 'system-ui') throw new Error('FONT_OFFLINE_UNSUPPORTED');
  const cache = await cacheStorage.open(OFFLINE_FONT_CACHE);
  if (await readInstalled(cache, origin, known.family)) return;
  let css;
  if (known.family === 'Liberation Serif') {
    css = [400, 700].map(weight => `@font-face { font-family: 'Liberation Serif'; font-weight: ${weight}; font-style: normal; font-display: swap; src: url(${origin}/fonts/LiberationSerif-${weight === 400 ? 'Regular' : 'Bold'}.ttf) format('truetype'); }`).join('\n');
  } else {
    const weights = known.family === 'Amiri' ? '400;700' : known.weights || '400;500;600;700';
    const response = await fetcher(`https://fonts.googleapis.com/css2?family=${encodeURIComponent(known.family).replaceAll('%20', '+')}:wght@${weights}&display=swap`, { signal });
    if (!response.ok) throw new Error(`FONT_DOWNLOAD_HTTP_${response.status}`);
    css = await response.text();
  }
  const urls = fontUrls(css);
  if (!urls.length) throw new Error('FONT_DOWNLOAD_EMPTY');
  let completed = 0;
  onProgress?.({ completed, total: urls.length });
  // Download every Unicode subset, so later words also work without internet.
  const pending = [...urls];
  await Promise.all(Array.from({ length: Math.min(4, pending.length) }, async () => {
    while (pending.length) {
      if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
      const url = pending.shift();
      const parsed = new URL(url);
      if (parsed.origin !== 'https://fonts.gstatic.com' && !(parsed.origin === origin && parsed.pathname.startsWith('/fonts/'))) throw new Error('FONT_DOWNLOAD_INVALID_SOURCE');
      if (!await cache.match(url)) {
        const response = await fetcher(url, { signal, mode: 'cors' });
        if (!response.ok) throw new Error(`FONT_DOWNLOAD_HTTP_${response.status}`);
        const bytes = new Uint8Array(await response.clone().arrayBuffer());
        const signature = String.fromCharCode(...bytes.slice(0, 4));
        if (!['wOF2', 'wOFF', 'OTTO', 'ttcf', '\u0000\u0001\u0000\u0000'].includes(signature)) throw new Error('FONT_DOWNLOAD_INVALID_FILE');
        await cache.put(url, response);
      }
      onProgress?.({ completed: ++completed, total: urls.length });
    }
  }));
  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
  // Mark complete only after every font file is durably cached.
  await cache.put(metadataUrl(origin, known.family), new Response(JSON.stringify({ family: known.family, css, urls }), { headers: { 'Content-Type': 'application/json' } }));
}

export async function createOfflineFontStyles(families, { cacheStorage = globalThis.caches, origin = globalThis.location?.origin, createObjectURL = URL.createObjectURL } = {}) {
  const objectUrls = [];
  try {
    if (!cacheStorage || !origin) return { css: '', dispose() {} };
    const cache = await cacheStorage.open(OFFLINE_FONT_CACHE);
    const styles = [];
    for (const family of new Set(families)) {
      const entry = await readInstalled(cache, origin, family);
      if (!entry) continue;
      let css = entry.css;
      for (const url of entry.urls) {
        const response = await cache.match(url);
        const objectUrl = createObjectURL(await response.blob());
        objectUrls.push(objectUrl);
        css = css.split(url).join(objectUrl);
      }
      styles.push(css);
    }
    return { css: styles.join('\n'), dispose: () => objectUrls.forEach(url => URL.revokeObjectURL(url)) };
  } catch (error) {
    objectUrls.forEach(url => URL.revokeObjectURL(url));
    throw error;
  }
}
