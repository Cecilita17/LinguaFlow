import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
const syncSource = readFileSync(new URL('../src/utils/audioWordSync.js', import.meta.url), 'utf8');
const estimateSpeechDurationMs = runInNewContext(syncSource.slice(syncSource.indexOf('export function estimateSpeechDurationMs'), syncSource.indexOf('/**', syncSource.indexOf('export function estimateSpeechDurationMs'))).replace('export ', '') + '\nestimateSpeechDurationMs;');
const source = readFileSync(new URL('../src/hooks/useSpeech.js', import.meta.url), 'utf8');
function harness(android = false) {
 const spoken = [], calls = [], state = {};
 let now = 1000;
 const engine = {
  paused: false, cancel() { calls.push('cancel'); },
  pause() { this.paused = true; calls.push('pause'); },
  resume() { this.paused = false; calls.push('resume'); },
  getVoices: () => [], speak(utterance) { spoken.push(utterance); utterance.onstart(); }
 };
 const setters = Object.fromEntries(['IsSpeaking', 'IsSpeechPaused', 'SpeakingMessageId', 'SpeakingText', 'SpeakingCharIndex'].map(name => ['set' + name, value => { state[name] = value; }]));
 const controls = runInNewContext(source.slice(source.indexOf('  // Text to Speech (TTS)'), source.indexOf('\n  return {', source.indexOf('  // Text to Speech (TTS)'))) + '\n({ speakText, toggleMessageSpeech, stopSpeaking });', {
  ...setters, Date: { now: () => now }, Intl, estimateSpeechDurationMs, navigator: { userAgent: android ? 'Android' : 'Desktop' }, window: { speechSynthesis: engine },
  playbackIdRef: { current: 0 }, activeSpeechRef: { current: null },
  useCallback: fn => fn, targetLangCode: 'es-ES', getBrowserVoice: () => null,
  mapSpeechRateToUtteranceRate: rate => rate,
  SpeechSynthesisUtterance: function(text) { this.text = text; }
 });
 return { ...controls, spoken, calls, state, engine, advance(ms) { now += ms; } };
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


test('Android resumes at the last spoken word even if native resume does nothing', () => {
 const h = harness(true);
 h.engine.resume = () => {};
 h.toggleMessageSpeech('Hola como estas', 'es-ES', 0.75, 'bot-1');
 h.spoken[0].onboundary({ charIndex: 5, name: 'word' });
 h.toggleMessageSpeech('Hola como estas', 'es-ES', 0.75, 'bot-1');
 h.spoken[0].onend();
 assert.equal(h.state.IsSpeechPaused, true, 'cancel callbacks cannot discard the saved position');
 h.toggleMessageSpeech('Hola como estas', 'es-ES', 0.75, 'bot-1');
 assert.equal(h.spoken[1].text, 'como estas');
 assert.equal(h.spoken[1].rate, 0.75);
 assert.equal(h.state.SpeakingCharIndex, 5);
 assert.equal(h.state.SpeakingText, 'Hola como estas');
 h.spoken[1].onboundary({ charIndex: 5 });
 assert.equal(h.state.SpeakingCharIndex, 10);
});

test('repeated Android pauses preserve position and invoke completion once', () => {
 const h = harness(true);
 let ended = 0;
 h.speakText('Hola como estas', 'es-ES', 1, () => { ended++; }, undefined, 'user-1');
 h.spoken[0].onboundary({ charIndex: 5 });
 h.toggleMessageSpeech('Hola como estas', 'es-ES', 1, 'user-1');
 h.toggleMessageSpeech('Hola como estas', 'es-ES', 1, 'user-1');
 h.spoken[1].onboundary({ charIndex: 5 });
 h.toggleMessageSpeech('Hola como estas', 'es-ES', 1, 'user-1');
 h.toggleMessageSpeech('Hola como estas', 'es-ES', 1, 'user-1');
 assert.equal(h.spoken[2].text, 'estas');
 h.spoken[2].onend();
 assert.equal(ended, 1);
});


test('Android without word events resumes from an estimated whole-word position', () => {
 const h = harness(true);
 h.toggleMessageSpeech('Hola como estas', 'es-ES', 1, 'bot-1');
 h.advance(400);
 h.toggleMessageSpeech('Hola como estas', 'es-ES', 1, 'bot-1');
 h.advance(10000);
 h.toggleMessageSpeech('Hola como estas', 'es-ES', 1, 'bot-1');
 assert.equal(h.spoken[1].text, 'como estas', 'paused time must not advance the saved position');
});
