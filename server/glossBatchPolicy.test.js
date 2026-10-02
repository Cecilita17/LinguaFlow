import test from 'node:test';
import assert from 'node:assert/strict';
import { buildGlossBatches, runGlossBatches, isRecoverableGlossError } from '../src/utils/glossBatchPolicy.js';
import { createGlossError, formatGlossError } from '../src/utils/glossErrors.js';
import { TRANSLATIONS } from '../src/constants/translations.js';

const line = (id, words) => ({ id, text: Array(words).fill('كلمة').join(' ') });

test('Arabic batches use length budgets and keep long paragraphs intact and isolated', () => {
  const paragraphs = [line('a', 70), line('b', 70), line('c', 10), line('long', 250), line('d', 10)];
  const batches = buildGlossBatches(paragraphs, 'ar');
  assert.deepEqual(batches.map(batch => batch.map(p => p.id)), [['a'], ['b', 'c'], ['long'], ['d']]);
  assert.deepEqual(batches.flat(), paragraphs);
  assert.equal(batches[2][0], paragraphs[3]);
  assert.deepEqual(buildGlossBatches(Array.from({ length: 11 }, (_, i) => line(i, 1)), 'ar').map(batch => batch.length), [5, 5, 1]);
});

test('local failures skip the failed batch and continue without retrying any paragraph', async () => {
  const a = line('a', 1), b = line('b', 1), c = line('c', 1);
  const attempted = [], errors = [];
  await runGlossBatches({ batches: [[a, a], [b], [a, c]], delayMs: 0, isAborted: () => false,
    processBatch: async batch => { attempted.push(...batch.map(p => p.id)); if (batch[0].id === 'a') throw createGlossError('GLOSS_TRUNCATED'); },
    onRecoverableError: (error, batch) => errors.push({ code: error.code, ids: batch.map(p => p.id) })
  });
  assert.deepEqual(attempted, ['a', 'b', 'c']);
  assert.deepEqual(errors, [{ code: 'GLOSS_TRUNCATED', ids: ['a'] }]);
});

test('access, rate limits, unavailable services and timeouts stop subsequent API requests', async () => {
  for (const code of ['GLOSS_AUTH_FAILED', 'GLOSS_API_KEY_MISSING', 'GLOSS_RATE_LIMIT', 'GLOSS_PROVIDER_UNAVAILABLE', 'GLOSS_NETWORK_ERROR', 'GLOSS_TIMEOUT', 'GLOSS_MODEL_UNAVAILABLE']) {
    let requests = 0;
    await assert.rejects(runGlossBatches({ batches: [[line('a', 1)], [line('b', 1)]], delayMs: 0, isAborted: () => false,
      processBatch: async () => { requests++; throw createGlossError(code); },
      onRecoverableError: () => assert.fail('Fatal error must not continue')
    }), { code });
    assert.equal(requests, 1);
    assert.equal(isRecoverableGlossError({ code }), false);
  }
});

test('user cancellation after a local error does not start another batch', async () => {
  let requests = 0, aborted = false;
  await runGlossBatches({ batches: [[line('a', 1)], [line('b', 1)]], delayMs: 0, isAborted: () => aborted,
    processBatch: async () => { requests++; throw createGlossError('GLOSS_INCOMPLETE'); },
    onRecoverableError: () => { aborted = true; }
  });
  assert.equal(requests, 1);
});

test('continuing notices explain the skipped error in both interface languages', () => {
  for (const language of ['es', 'en']) {
    const t = (key, params = {}) => Object.entries(params).reduce((value, [name, replacement]) => value.replaceAll(`{${name}}`, String(replacement)), TRANSLATIONS[language][key] || key);
    const notice = formatGlossError(createGlossError('GLOSS_TRUNCATED'), t, { continuing: true });
    assert(notice.includes('GLOSS_TRUNCATED'));
    assert(!notice.includes(language === 'es' ? 'Glosado detenido' : 'Glossing stopped'));
  }
});
