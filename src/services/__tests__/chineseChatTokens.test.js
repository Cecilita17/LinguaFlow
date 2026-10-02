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

test('groups the screenshot compounds even without browser word segmentation', async () => {
  const { segmentChineseWords } = await import('../chineseWordSegmentation.js');
  const originalSegmenter = Intl.Segmenter;
  try {
    Intl.Segmenter = undefined;
    const text = '听起来宝宝哭得挺让人心疼的。你们平时是怎么安抚他呢？如果他在被抱的时候不舒服，可以尝试轻轻摇晃或者唱歌哄他。还有，喂母乳的过程如果有困难，记得可以向儿科医生或哺乳顾问求助。';
    const words = ['宝宝', '心疼', '平时', '安抚', '尝试', '轻轻', '摇晃', '唱歌', '过程', '困难', '记得', '儿科医生', '哺乳', '顾问', '求助'];
    for (const source of [[], Array.from(text, word => ({ word, pinyin: resolveChinesePinyin(word) }))]) {
      const output = normalizeChineseTokens(text, source);
      assert.equal(output.map(token => token.word).join(''), text);
      for (const word of words) assert(output.some(token => token.word === word), word);
      assert(validateChineseTokens(text, output).isValid);
    }
    const mixed = '宝宝 Hello café 123，心疼！';
    assert.equal(segmentChineseWords(mixed).map(token => token.segment).join(''), mixed);
    assert.deepEqual(segmentChineseWords('宝宝，心疼').map(token => token.segment), ['宝宝', '，', '心疼']);
  } finally {
    Intl.Segmenter = originalSegmenter;
  }
});

test('repairs same-length token text mismatches before chat rendering', () => {
  const text = '宝宝让人心疼。';
  const source = [
    { word: '宝贝', pinyin: 'bǎo bèi' },
    { word: '让', pinyin: 'ràng' },
    { word: '人', pinyin: 'rén' },
    { word: '心疼', pinyin: 'xīn téng' },
    { word: '。' }
  ];
  assert.equal(validateChineseTokens(text, source).isValid, false);
  const output = normalizeChineseTokens(text, source);
  assert.equal(output.map(token => token.word).join(''), text);
  assert(output.some(token => token.word === '宝宝'));
  assert(output.some(token => token.word === '心疼'));
});
