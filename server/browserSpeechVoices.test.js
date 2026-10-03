import test from 'node:test';
import assert from 'node:assert/strict';
import { browserVoiceId, matchingBrowserVoices, resolveBrowserVoice, normalizeBrowserVoicePreferences, speechLanguageKey } from '../src/utils/browserSpeechVoices.js';
const italianA = { voiceURI: 'it-a', name: 'Italian A', lang: 'it-IT' };
const italianB = { voiceURI: 'it-b', name: 'Italian B', lang: 'it-CH' };
const arabic = { voiceURI: 'ar-a', name: 'Arabic', lang: 'ar-SA' };
const voices = [arabic, italianA, italianB];

test('saved voice applies to regional codes and survives JSON storage', () => {
  const preferences = JSON.parse(JSON.stringify({ it: browserVoiceId(italianB) }));
  assert.equal(resolveBrowserVoice(voices, 'it-IT', preferences), italianB);
  assert.equal(resolveBrowserVoice(voices, 'it_CH', preferences), italianB);
  assert.equal(speechLanguageKey('AR_sa'), 'ar');
});
test('automatic mode preserves the existing first compatible voice behavior', () => {
  assert.equal(resolveBrowserVoice(voices, 'it-IT', {}), italianA);
  assert.equal(resolveBrowserVoice(voices, 'ar-SA', {}), arabic);
});
test('unavailable saved voice falls back safely on another device', () => {
  assert.equal(resolveBrowserVoice([arabic, italianA], 'it', { it: browserVoiceId(italianB) }), italianA);
  assert.equal(resolveBrowserVoice([], 'it', { it: browserVoiceId(italianB) }), null);
});
test('voice preferences cannot select a different language', () => {
  assert.equal(resolveBrowserVoice(voices, 'it', { it: browserVoiceId(arabic) }), italianA);
  assert.deepEqual(matchingBrowserVoices(voices, 'it'), [italianA, italianB]);
  assert.equal(resolveBrowserVoice(voices, 'ja', {}), null);
});
test('malformed stored preferences and empty languages are safe', () => {
  for (const value of [null, [], 'invalid', 42]) assert.deepEqual(normalizeBrowserVoicePreferences(value), {});
  assert.deepEqual(normalizeBrowserVoicePreferences({ it: browserVoiceId(italianB), ar: 3, 'invalid-key': 'voice' }), { it: browserVoiceId(italianB) });
  assert.deepEqual(matchingBrowserVoices(voices, ''), []);
});
