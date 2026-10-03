import test from 'node:test';
import assert from 'node:assert/strict';
import { getKoreanTransliteration } from '../src/services/koreanTransliteration.js';
import { getLanguageGlossStrategy } from '../src/services/languageGlossStrategies.js';
import { tokenizeLiveCallTurn } from '../src/services/liveCallGlossService.js';
import { SUPPORTED_LANGUAGES, computeWordDiff } from './languageData.js';
import { DEFAULT_TARGET_LANGUAGES, LANGUAGE_METADATA } from '../src/constants/languages.js';

for (const [text, expected] of [['안녕하세요', 'annyeonghaseyo'], ['한국어', 'hangugeo'], ['감사합니다', 'gamsahamnida'], ['같이', 'gachi'], ['읽어요', 'ilgeoyo']]) {
  test(`romanizes ${text} with Hangul pronunciation rules`, () => {
    assert.equal(getKoreanTransliteration(text), expected);
    assert.equal(getKoreanTransliteration(text.normalize('NFD')), expected);
  });
}
test('punctuation and other scripts do not acquire Korean transliteration', () => {
  for (const text of ['!', 'Hello', '你好', '', null]) assert.equal(getKoreanTransliteration(text), null);
});
test('reader tokenization preserves Korean words and provides auxiliary text', () => {
  const tokens = getLanguageGlossStrategy('ko').tokenize('안녕하세요! 한국어 공부해요.');
  assert.deepEqual(tokens.map(t => t.word), ['안녕하세요', '!', '한국어', '공부해요', '.']);
  assert.equal(tokens[0].auxiliary, 'annyeonghaseyo');
  assert.equal(tokens[1].auxiliary, null);
});
test('live calls keep Korean romanization while Latin languages remain unchanged', () => {
  assert.equal(tokenizeLiveCallTurn('한국어', 'ko')[0].auxiliary, 'hangugeo');
  assert.equal(tokenizeLiveCallTurn('hello', 'en')[0].auxiliary, null);
});
test('Korean correction matching preserves unchanged Hangul words', () => {
  const tokens = computeWordDiff('한국어 공부해요', '한국어 배워요');
  assert.equal(tokens[0].text, '한국어');
  assert.equal(tokens[0].changed, false);
  assert.equal(tokens[1].changed, true);
});
test('frontend and backend expose Korean with ko-KR speech and romanization enabled', () => {
  assert.ok(DEFAULT_TARGET_LANGUAGES.some(l => l.code === 'ko'));
  assert.equal(LANGUAGE_METADATA.ko.hasTranslit, true);
  const korean = SUPPORTED_LANGUAGES.find(l => l.code === 'ko');
  assert.equal(korean.speechCode, 'ko-KR');
  assert.equal(korean.hasTranslit, true);
});
