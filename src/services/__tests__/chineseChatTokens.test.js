import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeChineseTokens, resolveChinesePinyin, validateChineseTokens } from '../chineseTokenNormalizer.js';

test('repairs fragmented user and bot messages without dropping text', () => {
  const examples = [
    ['我现在有很多压力，老公表现不好，太被动。', ['压力', '老公', '表现', '被动']],
    ['相处让你困扰，想尝试哪些方式减轻压力或者沟通？', ['相处', '困扰', '尝试', '方式', '减轻', '压力', '沟通']]
  ];
  for (const [text, words] of examples) {
    for (const source of [[], Array.from(text, word => ({ word, pinyin: word })), Array.from(text, word => ({ word, pinyin: resolveChinesePinyin(word) }))]) {
      const output = normalizeChineseTokens(text, source);
      assert.equal(output.map(token => token.word).join(''), text);
      for (const word of words) assert(output.some(token => token.word === word), word);
      assert(validateChineseTokens(text, output).isValid);
      for (const token of output.filter(token => /[\u4e00-\u9fff]/.test(token.word))) {
        assert(token.pinyin);
        assert(!/[\u4e00-\u9fff]/.test(token.pinyin));
      }
    }
  }
});

test('replaces mixed Hanzi pronunciation and preserves valid contextual pinyin', () => {
  assert.equal(resolveChinesePinyin({ word: '压力', pinyin: '压 lì' }), 'yā lì');
  assert.equal(resolveChinesePinyin({ word: '重庆', pinyin: 'chóng qìng' }), 'chóng qìng');
  assert.equal(resolveChinesePinyin({ word: 'hello' }), null);
  const output = normalizeChineseTokens('压力', [{ word: '压力', pinyin: 'yā lì', gloss: 'pressure', saved: true }]);
  assert.equal(output[0].gloss, 'pressure');
  assert.equal(output[0].saved, true);
});
