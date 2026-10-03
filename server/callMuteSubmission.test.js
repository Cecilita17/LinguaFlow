import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
const source = readFileSync(new URL('../src/hooks/usePipelineCall.js', import.meta.url), 'utf8');
const start = source.indexOf('  const toggleMute = useCallback');
const end = source.indexOf('  // End Pipeline Call', start);
function call({ mobile = true, speaking = true, text = '', finalizing = false, state = 'listening', muted = false } = {}) {
  const events = [], track = { enabled: !muted };
  const context = {
    useCallback: fn => fn, isMobileDevice: mobile,
    isMutedRef: { current: muted }, setIsMuted: value => events.push(['muted', value]),
    silenceTimeoutRef: { current: 123 }, clearTimeout: id => events.push(['clearTimer', id]),
    currentTurnRef: { current: { id: 'turn-1', text, finalized: false } },
    isUserSpeakingMobileRef: { current: speaking }, isFinalizingMobileTurnRef: { current: finalizing },
    processedUserTurnIdsRef: { current: new Set() },
    finalizeMobileTurn: () => { if (!finalizing) events.push(['submitAudio', track.enabled]); },
    finalizeUserSpeechTurn: (...args) => events.push(['submitText', ...args]),
    stopTurnAudioCapture: () => events.push(['discardCapture']),
    isSpeechRecognitionRunningRef: { current: !mobile },
    recognitionRef: { current: { abort: () => events.push(['abortRecognition']) } },
    micStreamRef: { current: { getAudioTracks: () => [track] } },
    callStateRef: { current: state }, isSttPausedRef: { current: false },
    isEchoGuardActiveRef: { current: false },
    startTurnAudioCapture: () => events.push(['startCapture']),
    startSpeechRecognitionIfReady: () => events.push(['startRecognition'])
  };
  const toggle = runInNewContext(source.slice(start, end) + '\ntoggleMute;', context);
  return { toggle, events, track, context };
}
test('muting on mobile submits the captured speech before disabling the microphone', () => {
  const c = call(); c.toggle();
  assert.ok(c.events.some(e => e[0] === 'submitAudio' && e[1] === true));
  assert.equal(c.track.enabled, false);
  assert.equal(c.context.isUserSpeakingMobileRef.current, false);
  assert.equal(c.context.silenceTimeoutRef.current, null);
});
test('muting on desktop submits the current interim phrase without waiting for silence', () => {
  const c = call({ mobile: false, text: 'The phrase I am saying' }); c.toggle();
  assert.deepEqual(c.events.find(e => e[0] === 'submitText'), ['submitText', 'The phrase I am saying', 'turn-1']);
  assert.ok(c.events.some(e => e[0] === 'abortRecognition'));
  assert.equal(c.track.enabled, false);
});
test('muting without speech discards audio rather than sending a silent recording', () => {
  const c = call({ speaking: false }); c.toggle();
  assert.ok(c.events.some(e => e[0] === 'discardCapture'));
  assert.ok(!c.events.some(e => e[0].startsWith('submit')));
});
test('muting during an existing mobile submission does not stop the recorder a second time', () => {
  const c = call({ speaking: false, finalizing: true }); c.toggle();
  assert.ok(!c.events.some(e => e[0] === 'discardCapture' || e[0].startsWith('submit')));
});
test('unmuting resumes capture and desktop recognition while listening', () => {
  const c = call({ mobile: false, muted: true }); c.toggle();
  assert.equal(c.track.enabled, true);
  assert.ok(c.events.some(e => e[0] === 'startCapture'));
  assert.ok(c.events.some(e => e[0] === 'startRecognition'));
  assert.ok(!c.events.some(e => e[0].startsWith('submit')));
});
test('unmuting while the bot speaks does not bypass the existing speech protection', () => {
  const c = call({ muted: true, state: 'speaking' }); c.toggle();
  assert.equal(c.track.enabled, true);
  assert.ok(!c.events.some(e => e[0] === 'startCapture'));
});
