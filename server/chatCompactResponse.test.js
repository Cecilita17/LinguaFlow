import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSystemInstruction, buildPedagogicalSystemInstruction } from './promptTemplates.js';
import { handleChat } from './handlers.js';
import { normalizeChineseTokens } from '../src/services/chineseTokenNormalizer.js';

test('compact Chinese chat omits redundant annotations while keeping teaching data', () => {
  const prompt = buildSystemInstruction('Mandarin Chinese', 'Español', 'B1', { localChineseAnnotations: true });
  assert(prompt.includes('Do NOT include "tokens" or "word_tokens"'));
  assert(prompt.includes('The client generates Pinyin locally'));
  assert(prompt.includes('Keep your natural response length'));
  const schema = JSON.parse(prompt.slice(prompt.indexOf('{\n  "user_correction":')).replace(/: boolean/g, ': false'));
  assert.equal(schema.bot_response.tokens, undefined);
  assert.equal(schema.user_correction.diff_tokens[0].translit, undefined);
  assert(schema.user_correction.corrected_text);
  assert(schema.bot_response.translation);
  assert(schema.bot_response.vocabulary.keyword.translit);
});

test('other languages and dedicated call corrections retain existing annotations', () => {
  for (const language of ['Arabic', 'English', 'Russian']) {
    const prompt = buildSystemInstruction(language, 'Español', 'B1', { localChineseAnnotations: true });
    assert(prompt.includes('ABSOLUTE COVERAGE RULE'));
    assert(!prompt.includes('The client generates Pinyin locally'));
  }
  const correction = buildPedagogicalSystemInstruction('Mandarin Chinese', 'Español', 'B1');
  assert(correction.includes('Provide accurate Pinyin with tone marks'));
  assert(!correction.includes('The client generates Pinyin locally'));
});

test('compact Chinese payload preserves corrections and restores bot words and Pinyin locally', async () => {
  const previousFetch = globalThis.fetch;
  const previousKey = process.env.GROQ_API_KEY;
  process.env.GROQ_API_KEY = 'gsk_test_compact_chat';
  let request;
  const fixture = {
    user_correction: {
      original_text: '我昨天去学校', corrected_text: '我昨天去了学校', has_errors: true,
      diff_tokens: [
        { text: '我', changed: false, original: null },
        { text: '昨天', changed: false, original: null },
        { text: '去了', changed: true, original: '去' },
        { text: '学校', changed: false, original: null }
      ]
    },
    bot_response: {
      text: '你在学校学习了什么？', translation: '¿Qué aprendiste en la escuela?',
      vocabulary: { 学校: { meaning: 'escuela', part_of_speech: 'sustantivo', translit: 'xué xiào' } }
    }
  };
  globalThis.fetch = async (url, options) => {
    assert.equal(url, 'https://api.groq.com/openai/v1/chat/completions');
    request = JSON.parse(options.body);
    return { ok: true, status: 200, headers: { get: () => 'test' }, json: async () => ({ choices: [{ message: { content: JSON.stringify(fixture) } }] }) };
  };
  let status, payload;
  const response = { setHeader() {}, status(code) { status = code; return this; }, json(body) { payload = body; return this; } };
  try {
    await handleChat({ method: 'POST', body: { message: '我昨天去学校', targetLang: 'zh', nativeLang: 'es', level: 'B1' }, headers: {} }, response);
    assert.equal(status, 200);
    assert(request.messages[0].content.includes('The client generates Pinyin locally'));
    assert.equal(payload.data.user_correction.corrected_text, fixture.user_correction.corrected_text);
    assert.equal(payload.data.user_correction.has_errors, true);
    assert.deepEqual(payload.data.user_correction.diff_tokens.map(({ text, changed, original }) => ({ text, changed, original })), fixture.user_correction.diff_tokens);
    assert.equal(payload.data.bot_response.translation, fixture.bot_response.translation);
    assert.deepEqual(payload.data.bot_response.vocabulary, fixture.bot_response.vocabulary);
    assert.deepEqual(payload.data.bot_response.tokens, []);
    for (const [text, sourceTokens] of [
      [payload.data.bot_response.text, payload.data.bot_response.tokens],
      [payload.data.user_correction.corrected_text, payload.data.user_correction.diff_tokens]
    ]) {
      const words = normalizeChineseTokens(text, sourceTokens);
      assert.equal(words.map(token => token.word).join(''), text);
      assert(words.some(token => token.word === '学校'));
      assert(words.filter(token => /[\u4e00-\u9fff]/.test(token.word)).every(token => token.pinyin && !/[\u4e00-\u9fff]/.test(token.pinyin)));
    }
  } finally {
    globalThis.fetch = previousFetch;
    if (previousKey === undefined) delete process.env.GROQ_API_KEY;
    else process.env.GROQ_API_KEY = previousKey;
  }
});
