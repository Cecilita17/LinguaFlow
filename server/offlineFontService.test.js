import test from 'node:test';
import assert from 'node:assert/strict';
import { downloadFontForOffline, isFontDownloaded, createOfflineFontStyles } from '../src/services/offlineFontService.js';
import { FONT_OPTIONS } from '../src/utils/fontPreferences.js';
const origin = 'https://linguaflow.test';
const option = FONT_OPTIONS.chinese.find(font => font.id === 'sans');
const files = ['https://fonts.gstatic.com/latin.woff2', 'https://fonts.gstatic.com/chinese.woff2'];
const css = files.map((url, index) => `@font-face { font-family:'Noto Sans SC'; src:url(${url}) format('woff2'); unicode-range: ${index ? 'U+4E00-9FFF' : 'U+0000-00FF'}; }`).join('\n');
function environment(fail = false) {
  const entries = new Map();
  const requests = [];
  const cache = {
    async match(url) { return entries.get(url)?.clone(); },
    async put(url, response) { entries.set(url, response.clone()); }
  };
  return { entries, requests, cacheStorage: { async open() { return cache; } }, origin,
    async fetcher(url) {
      requests.push(url);
      if (url.startsWith('https://fonts.googleapis.com/')) return new Response(css);
      if (fail && url === files[1]) return new Response('', { status: 503 });
      return new Response('wOF2font data');
    }
  };
}
test('downloads all Unicode subsets and marks complete only afterward', async () => {
  const env = environment();
  const progress = [];
  assert.equal(await isFontDownloaded(option.family, env),false);
  await downloadFontForOffline(option, { ...env, onProgress: item => progress.push(item) });
  assert.equal(await isFontDownloaded(option.family, env),true);
  for (const url of files) assert.ok(env.entries.has(url));
  assert.deepEqual(progress.at(-1), { completed: 2, total: 2 });
  const count = env.requests.length;
  await downloadFontForOffline(option,env);
  assert.equal(env.requests.length,count);
});
test('cached fonts restore through local blob URLs with no network calls', async () => {
  const env = environment();
  await downloadFontForOffline(option,env);
  const count = env.requests.length;
  let created = 0;
  const style = await createOfflineFontStyles([option.family], { ...env, createObjectURL: blob => { assert.ok(blob.size); return `blob:cached-${++created}`; } });
  assert.equal(created,2);
  assert.ok(!style.css.includes('https://fonts.gstatic.com'));
  assert.ok(style.css.includes('unicode-range: U+4E00-9FFF'));
  assert.equal(env.requests.length,count);
  style.dispose();
});
test('failed downloads do not claim availability or automatically retry', async () => {
  const env = environment(true);
  await assert.rejects(downloadFontForOffline(option,env), /FONT_DOWNLOAD_HTTP_503/);
  assert.equal(await isFontDownloaded(option.family,env),false);
  assert.equal(env.requests.filter(url => url === files[1]).length,1);
});
test('evicted files invalidate downloaded status and offline installation', async () => {
  const env = environment();
  await downloadFontForOffline(option,env);
  env.entries.delete(files[1]);
  assert.equal(await isFontDownloaded(option.family,env),false);
  const style = await createOfflineFontStyles([option.family],env);
  assert.equal(style.css,'');
  style.dispose();
});
test('unavailable browser storage and unapproved fonts are rejected', async () => {
  assert.equal(await isFontDownloaded(option.family,{ cacheStorage:null, origin }),false);
  await assert.rejects(downloadFontForOffline(option,{ cacheStorage:null, origin }), /FONT_OFFLINE_UNSUPPORTED/);
  await assert.rejects(downloadFontForOffline({ family:'Microsoft YaHei' },environment()), /FONT_OFFLINE_UNSUPPORTED/);
});

test('storage quota failure leaves the download unmarked', async () => {
  const env = environment();
  const originalOpen = env.cacheStorage.open;
  env.cacheStorage.open = async () => ({ ...await originalOpen(), async put() { throw new DOMException('Storage full', 'QuotaExceededError'); } });
  await assert.rejects(downloadFontForOffline(option,env), { name:'QuotaExceededError' });
  assert.equal(await isFontDownloaded(option.family,env),false);
});
