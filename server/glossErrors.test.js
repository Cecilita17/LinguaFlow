import test from 'node:test';
import assert from 'node:assert/strict';
import { handleBatchGloss } from './handlers.js';
import { createGlossError, formatGlossError, glossErrorCodeForHttp } from '../src/utils/glossErrors.js';
import { TRANSLATIONS } from '../src/constants/translations.js';

const lines = [
  { id: 'p1', text: 'كتاب جديد', words: ['كتاب', 'جديد'], unknownTokens: ['كتاب', 'جديد'] },
  { id: 'p2', text: 'بيت كبير', words: ['بيت', 'كبير'], unknownTokens: ['بيت', 'كبير'] }
];

async function request(fetchImpl, { missingKey = false } = {}) {
  const oldFetch = globalThis.fetch;
  const oldKey = process.env.GROQ_API_KEY;
  if (missingKey) delete process.env.GROQ_API_KEY;
  else process.env.GROQ_API_KEY = 'gsk_test_diagnostics';
  let calls = 0, status = 200, payload;
  globalThis.fetch = async (...args) => { calls++; return fetchImpl(...args); };
  const response = { setHeader() {}, status(value) { status = value; return this; }, json(value) { payload = value; return this; } };
  try {
    await handleBatchGloss({ method: 'POST', body: { lines, targetLang: 'ar', nativeLang: 'es' }, headers: {} }, response);
    return { calls, status, payload };
  } finally {
    globalThis.fetch = oldFetch;
    if (oldKey === undefined) delete process.env.GROQ_API_KEY;
    else process.env.GROQ_API_KEY = oldKey;
  }
}

const reply = (content, finishReason = 'stop') => ({
  ok: true, status: 200, headers: { get: () => 'test-request' },
  json: async () => ({ choices: [{ finish_reason: finishReason, message: { content } }] })
});

test('gloss errors distinguish provider HTTP failures and do not expose raw responses', async () => {
  for (const [status, code] of [[429, 'GLOSS_RATE_LIMIT'], [401, 'GLOSS_AUTH_FAILED'], [403, 'GLOSS_ACCESS_DENIED'], [413, 'GLOSS_INPUT_TOO_LARGE'], [400, 'GLOSS_INVALID_REQUEST'], [503, 'GLOSS_PROVIDER_UNAVAILABLE']]) {
    const result = await request(async () => ({ ok: false, status,
      headers: { get: name => name === 'retry-after' ? '30' : 'test-request' },
      text: async () => JSON.stringify({ error: { code: 'provider_error', message: 'Sensitive gsk_test_secret' } })
    }));
    assert.equal(result.calls, 1);
    assert.equal(result.payload.code, code);
    assert.equal(result.payload.providerStatus, status);
    assert.equal(result.payload.retryAfter, '30');
    assert(!JSON.stringify(result.payload).includes('gsk_test_secret'));
  }
});

test('gloss diagnostics distinguish missing configuration, network, empty and invalid AI output', async () => {
  assert.equal((await request(async () => { throw Error('must not call'); }, { missingKey: true })).calls, 0);
  assert.equal((await request(async () => {}, { missingKey: true })).payload.code, 'GLOSS_API_KEY_MISSING');
  assert.equal((await request(async () => { throw TypeError('fetch failed'); })).payload.code, 'GLOSS_NETWORK_ERROR');
  assert.equal((await request(async () => reply(''))).payload.code, 'GLOSS_EMPTY_RESPONSE');
  assert.equal((await request(async () => reply('{invalid'))).payload.code, 'GLOSS_INVALID_RESPONSE');
  assert.equal((await request(async () => reply('{invalid', 'length'))).payload.code, 'GLOSS_TRUNCATED');
});

test('partial truncated output retains valid glosses and diagnostic metadata', async () => {
  const result = await request(async () => reply(JSON.stringify({ lines: [{ id: 'p1', tokens: [
    { word: 'كتاب', gloss: 'libro' }, { word: 'جديد', gloss: 'nuevo' }
  ] }] }), 'length'));
  assert.equal(result.calls, 1);
  assert.equal(result.payload.success, true);
  assert.equal(result.payload.warningCode, 'GLOSS_TRUNCATED');
  assert.equal(result.payload.lines.length, 1);
  assert.deepEqual(result.payload.missingIds, ['p2']);
});

test('gloss timeout carries its actual deadline without retrying', async () => {
  const originalTimeout = globalThis.setTimeout;
  globalThis.setTimeout = (fn, ms, ...args) => originalTimeout(fn, ms === 25000 ? 0 : ms, ...args);
  try {
    const result = await request(async (url, options) => new Promise((resolve, reject) => {
      options.signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true });
    }));
    assert.equal(result.calls, 1);
    assert.equal(result.payload.code, 'GLOSS_TIMEOUT');
    assert.equal(result.payload.timeoutSeconds, 25);
  } finally { globalThis.setTimeout = originalTimeout; }
});

test('Spanish and English gloss notices describe missing words and provider errors', () => {
  for (const language of ['es', 'en']) {
    const t = (key, params = {}) => Object.entries(params).reduce((value, [name, replacement]) => value.replaceAll(`{${name}}`, String(replacement)), TRANSLATIONS[language][key] || key);
    const incomplete = formatGlossError(createGlossError('GLOSS_INCOMPLETE', { missingWordsCount: 2, totalWords: 8, missingWords: ['كتاب', 'جديد'] }), t);
    assert(incomplete.includes('2/8'));
    assert(incomplete.includes('كتاب, جديد'));
    assert(incomplete.includes('GLOSS_INCOMPLETE'));
    assert(!incomplete.includes('gloss_reason_'));
    const limited = formatGlossError(createGlossError('GLOSS_RATE_LIMIT', { providerStatus: 429, retryAfter: '30' }), t);
    assert(limited.includes('HTTP 429'));
    assert(limited.includes('30'));
    assert(!limited.includes('gloss_reason_'));
  }
});

test('provider diagnostic codes distinguish input size and unavailable models', () => {
  assert.equal(glossErrorCodeForHttp(400, 'context_length_exceeded'), 'GLOSS_INPUT_TOO_LARGE');
  assert.equal(glossErrorCodeForHttp(404, 'model_not_found'), 'GLOSS_MODEL_UNAVAILABLE');
});
