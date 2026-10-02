import test from 'node:test';
import assert from 'node:assert/strict';
import { handleSimplifyEpubBlock } from './handlers.js';
import { formatSimplificationError } from '../src/utils/simplificationErrors.js';
import { TRANSLATIONS } from '../src/constants/translations.js';

async function request(content, { retry = true, source = 'Este es un párrafo corto para practicar.', providerStatus = 200, targetLang = 'es' } = {}) {
  const oldFetch = globalThis.fetch, oldKey = process.env.GROQ_API_KEY;
  process.env.GROQ_API_KEY = 'gsk_test_paragraph';
  let calls = 0, status, payload;
  globalThis.fetch = async () => {
    calls++;
    return { ok: providerStatus === 200, status: providerStatus, headers: { get: () => 'test' },
      text: async () => 'provider failure',
      json: async () => ({ choices: [{ message: { content } }] }) };
  };
  const res = { setHeader() {}, status(value) { status = value; return this; }, json(value) { payload = value; return this; } };
  try {
    await handleSimplifyEpubBlock({ method: 'POST', headers: {}, body: {
      sourceParagraphs: [{ sourceParagraphId: 'p1', text: source }],
      paragraphRetry: retry, targetLang, level: 'beginner'
    } }, res);
    return { calls, status, payload };
  } finally {
    globalThis.fetch = oldFetch;
    if (oldKey === undefined) delete process.env.GROQ_API_KEY;
    else process.env.GROQ_API_KEY = oldKey;
  }
}

test('single-paragraph retry accepts plain text without a separator or a 20-word minimum', async () => {
  const result = await request('Este texto es corto y fácil.');
  assert.equal(result.status, 200);
  assert.equal(result.calls, 1);
  assert.deepEqual(result.payload.paragraphs, [{ sourceParagraphId: 'p1', text: 'Este texto es corto y fácil.' }]);
});

test('short paragraph retries retain content validation and never retry automatically', async () => {
  const result = await request('Hola', { source: 'Este párrafo contiene detalles que deben conservarse incluso después de simplificarlo.' });
  assert.equal(result.status, 422);
  assert.equal(result.calls, 1);
  assert.equal(result.payload.code, 'SIMPLIFY_TOO_SHORT');
  assert.equal(result.payload.outputWords, 1);
  assert.equal(result.payload.returnedParagraphs, 1);
  assert.equal(result.payload.expectedParagraphs, 1);
});

test('legacy block validation and retries stay unchanged', async () => {
  const result = await request(JSON.stringify({ paragraphs: [{ text: 'Este texto es corto y fácil.' }] }), { retry: false });
  assert.equal(result.status, 422);
  assert.equal(result.calls, 2);
});

test('paragraph retries report provider failures without a second request', async () => {
  const result = await request('', { providerStatus: 429 });
  assert.equal(result.calls, 1);
  assert.equal(result.status, 429);
  assert.equal(result.payload.code, 'SIMPLIFY_RATE_LIMIT');
});

test('invalid output preserves the paragraph and reports incomplete counts', async () => {
  const result = await request('{invalid');
  assert.equal(result.calls, 1);
  assert.equal(result.payload.code, 'SIMPLIFY_INCOMPLETE');
  assert.equal(result.payload.returnedParagraphs, 0);
});

test('simplification failure notices include a translated reason and validation counts', () => {
  for (const language of ['es', 'en']) {
    const t = (key, params = {}) => Object.entries(params).reduce((text, [name, value]) => text.replaceAll(`{${name}}`, String(value)), TRANSLATIONS[language][key] || key);
    const message = formatSimplificationError({ code: 'SIMPLIFY_TOO_SHORT', status: 422, outputWords: 3, sourceWords: 18 }, t);
    assert(message.includes('SIMPLIFY_TOO_SHORT'));
    assert(message.includes('HTTP 422'));
    assert(message.includes('3/18'));
    assert(!message.includes('simplification_reason_'));
  }
});

test('a short Arabic paragraph can be simplified without forced expansion to 20 words', async () => {
  const result = await request('هذا نص سهل.', { source: 'هذا نص صعب قليلا.', targetLang: 'ar' });
  assert.equal(result.status, 200);
  assert.equal(result.calls, 1);
  assert.equal(result.payload.paragraphs[0].text, 'هذا نص سهل.');
});
