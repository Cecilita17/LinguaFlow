import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
const source = readFileSync(new URL('../src/hooks/useSpeech.js', import.meta.url), 'utf8');
function harness() {
 const spoken = [], calls = [], state = {};
 const engine = {
  paused: false, cancel() { calls.push('cancel'); },
  pause() { this.paused = true; calls.push('pause'); },
  resume() { this.paused = false; calls.push('resume'); },
  getVoices: () => [], speak(utterance) { spoken.push(utterance); utterance.onstart(); }
 };
 const setters = Object.fromEntries(['IsSpeaking', 'IsSpeechPaused', 'SpeakingMessageId', 'SpeakingText', 'SpeakingCharIndex'].map(name => ['set' + name, value => { state[name] = value; }]));
 const controls = runInNewContext(source.slice(source.indexOf('  // Text to Speech (TTS)'), source.indexOf('\n  return {', source.indexOf('  // Text to Speech (TTS)'))) + '\n({ speakText, toggleMessageSpeech, stopSpeaking });', {
  ...setters, window: { speechSynthesis: engine },
  playbackIdRef: { current: 0 }, activeSpeechRef: { current: null },
  useCallback: fn => fn, targetLangCode: 'es-ES', getBrowserVoice: () => null,
  mapSpeechRateToUtteranceRate: rate => rate,
  SpeechSynthesisUtterance: function(text) { this.text = text; }
 });
 return { ...controls, spoken, calls, state, engine };
}
test('the same message pauses and resumes without restarting its utterance', () => {
 const h = harness();
 h.toggleMessageSpeech('Hola', 'es-ES', 0.75, 'user-1');
 h.toggleMessageSpeech('Hola', 'es-ES', 0.75, 'user-1');
 assert.equal(h.state.IsSpeechPaused, true);
 h.toggleMessageSpeech('Hola', 'es-ES', 0.75, 'user-1');
 assert.equal(h.state.IsSpeechPaused, false);
 assert.equal(h.spoken.length, 1);
 assert.equal(h.spoken[0].rate, 0.75);
});
test('another message with identical text replaces paused audio and resumes the engine', () => {
 const h = harness();
 h.toggleMessageSpeech('Hola', 'es-ES', 1, 'user-1');
 h.toggleMessageSpeech('Hola', 'es-ES', 1, 'user-1');
 h.toggleMessageSpeech('Hola', 'es-ES', 1, 'bot-1');
 assert.equal(h.spoken.length, 2);
 assert.equal(h.engine.paused, false);
 assert.equal(h.state.SpeakingMessageId, 'bot-1');
 h.spoken[0].onend();
 assert.equal(h.state.SpeakingMessageId, 'bot-1', 'old cancellation callbacks cannot clear new playback');
});
test('automatic bot speech can be paused from its message button', () => {
 const h = harness();
 h.speakText('Hola', 'es-ES', 1, undefined, undefined, 'bot-1');
 h.toggleMessageSpeech('Hola', 'es-ES', 1, 'bot-1');
 assert.equal(h.state.IsSpeechPaused, true);
 assert.equal(h.spoken.length, 1);
});
test('ended and stopped messages reset their pause state', () => {
 const h = harness();
 h.toggleMessageSpeech('Hola', 'es-ES', 1, 'bot-1');
 h.spoken[0].onend();
 assert.equal(h.state.SpeakingMessageId, null);
 h.toggleMessageSpeech('Hola', 'es-ES', 1, 'bot-1');
 assert.equal(h.spoken.length, 2);
 h.toggleMessageSpeech('Hola', 'es-ES', 1, 'bot-1');
 h.stopSpeaking();
 assert.equal(h.state.IsSpeechPaused, false);
 assert.equal(h.state.SpeakingMessageId, null);
});
