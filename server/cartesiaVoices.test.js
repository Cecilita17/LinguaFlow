import test from 'node:test';
import assert from 'node:assert/strict';
import { handleListCartesiaVoices, DEFAULT_CARTESIA_CATALOG } from './pipelineHandlers.js';

const ids = ['11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222', '33333333-3333-4333-8333-333333333333'];
const voice = (id, extra = {}) => ({ id, name: 'Test voice', language: 'es', is_owner: false, ...extra });
const ok = body => ({ ok: true, status: 200, json: async () => body });
async function run(fetcher, key = 'secret-test-key') {
  const originalFetch = global.fetch, originalKey = process.env.CARTESIA_API_KEY;
  const info = console.info, warn = console.warn;
  const logs = [];
  global.fetch = fetcher;
  if (key === null) delete process.env.CARTESIA_API_KEY;
  else process.env.CARTESIA_API_KEY = key;
  console.info = (...args) => logs.push(args.join(' '));
  console.warn = (...args) => logs.push(args.join(' '));
  let body;
  const res = { setHeader() {}, status(code) { assert.equal(code, 200); return this; }, json(value) { body = value; return value; } };
  try {
    await handleListCartesiaVoices({ method: 'GET' }, res);
    assert.ok(!logs.join('\n').includes('secret-test-key'));
    return { body, logs };
  } finally {
    global.fetch = originalFetch; console.info = info; console.warn = warn;
    if (originalKey === undefined) delete process.env.CARTESIA_API_KEY;
    else process.env.CARTESIA_API_KEY = originalKey;
  }
}
test('discovers clones on later pages and preserves ownership across duplicate catalog entries', async () => {
  const calls = [];
  const { body, logs } = await run(async (url, options) => {
    const u = new URL(url); calls.push(u);
    assert.equal(options.headers.Authorization, 'Bearer secret-test-key');
    assert.equal(u.searchParams.get('limit'), '100');
    if (u.searchParams.get('is_owner') === 'true') {
      if (!u.searchParams.has('starting_after')) return ok({ data: [voice(ids[0])], has_more: true, next_page: ids[0] });
      assert.equal(u.searchParams.get('starting_after'), ids[0]);
      return ok({ data: [voice(ids[1], { name: 'My clone', access: 'public' })], has_more: false });
    }
    if (!u.searchParams.has('starting_after')) return ok({ data: [voice(ids[1])], has_more: true, next_page: ids[1] });
    return ok({ data: [voice(ids[2])], has_more: false });
  });
  assert.equal(calls.length, 4);
  assert.equal(body.voices.filter(v => v.id === ids[1]).length, 1);
  assert.equal(body.voices.find(v => v.id === ids[1]).is_owner, true);
  assert.equal(body.voices.find(v => v.id === ids[2]).is_owner, false);
  assert.ok(logs.some(line => line.includes('"ownedCount":2')));
});
test('keeps discovered clones when the public catalog fails and reports fallback', async () => {
  const { body, logs } = await run(async url => new URL(url).searchParams.has('is_owner')
    ? ok({ data: [voice(ids[0])], has_more: false }) : { ok: false, status: 403 });
  assert.equal(body.voices.find(v => v.id === ids[0]).is_owner, true);
  assert.match(body.warning, /catalog:HTTP_403/);
  assert.equal(body.catalogSource, 'cartesia+DEFAULT_CARTESIA_CATALOG');
  assert.ok(logs.some(line => line.includes('"status":403')));
});
test('authentication errors explicitly report the default fallback without logging upstream secrets', async () => {
  const { body, logs } = await run(async () => ({ ok: false, status: 401, json: async () => ({ token: 'secret-test-key' }) }));
  assert.deepEqual(body.voices, DEFAULT_CARTESIA_CATALOG);
  assert.equal(body.catalogSource, 'DEFAULT_CARTESIA_CATALOG');
  assert.match(body.warning, /HTTP_401/);
  assert.ok(logs.some(line => line.includes('catalog_result')));
});
test('a repeated cursor stops pagination rather than retrying forever', async () => {
  let calls = 0;
  const { body } = await run(async () => { calls++; return ok({ data: [voice(ids[0])], has_more: true, next_page: ids[0] }); });
  assert.equal(calls, 4);
  assert.match(body.warning, /INVALID_PAGINATION_CURSOR/);
});
test('an unexpected response shape is visible rather than silently treated as an empty catalog', async () => {
  const { body } = await run(async () => ok({ unexpected: [] }));
  assert.match(body.warning, /INVALID_RESPONSE_SHAPE/);
  assert.equal(body.catalogSource, 'DEFAULT_CARTESIA_CATALOG');
});
test('missing credentials do not call Cartesia and explicitly identify fallback', async () => {
  const { body } = await run(async () => { throw new Error('Should not fetch'); }, null);
  assert.equal(body.hasApiKey, false);
  assert.equal(body.warning, 'MISSING_API_KEY');
  assert.equal(body.catalogSource, 'DEFAULT_CARTESIA_CATALOG');
});
test('legacy array responses still work and diagnostics omit unknown fields', async () => {
  const { body, logs } = await run(async () => ok([voice(ids[0], { token: 'secret-test-key', access_token: 'other-secret', name: 'secret-test-key' })]));
  assert.equal(body.voices.find(v => v.id === ids[0]).is_owner, true);
  assert.ok(!logs.join('\n').includes('other-secret'));
});
