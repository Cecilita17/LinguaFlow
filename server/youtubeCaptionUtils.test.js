import test from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyExtractorError,
  normalizeTranscriptSegments,
  selectCaptionTrack
} from './youtubeCaptionUtils.js';

const tracks = [
  { language_code: 'en', name: 'English', kind: undefined },
  { language_code: 'zh-Hans', name: 'Chinese (Simplified)', kind: 'asr' }
];

test('selectCaptionTrack prefers exact requested language', () => {
  assert.equal(selectCaptionTrack(tracks, 'zh').language_code, 'zh-Hans');
  assert.equal(selectCaptionTrack(tracks, 'en').language_code, 'en');
});

test('selectCaptionTrack prefers manual CC in auto mode and rejects missing requested language', () => {
  assert.equal(selectCaptionTrack(tracks, 'auto').language_code, 'en');
  assert.equal(selectCaptionTrack(tracks, 'ar'), null);
});

test('normalizeTranscriptSegments preserves timestamp precision and skips non-segments', () => {
  assert.deepEqual(normalizeTranscriptSegments([
    { start_ms: '1230', end_ms: '3450', snippet: '  Hola\n mundo  ' },
    { start_ms: 'invalid', end_ms: '4000', snippet: 'ignored' },
    { start_ms: '4000', end_ms: '4000', snippet: 'next' }
  ]), [
    { id: 'youtube_1', startTime: 1.23, endTime: 3.45, text: 'Hola mundo' },
    { id: 'youtube_2', startTime: 4, endTime: 4.2, text: 'next' }
  ]);
});

test('classifyExtractorError distinguishes unavailable, restricted, captions and timeout', () => {
  assert.equal(classifyExtractorError(new Error('Transcript panel not found')).code, 'CAPTIONS_UNAVAILABLE');
  assert.equal(classifyExtractorError({ message: 'Video unavailable', status: 404 }).code, 'VIDEO_UNAVAILABLE');
  assert.equal(classifyExtractorError({ message: 'Sign in required', status: 403 }).code, 'VIDEO_RESTRICTED');
  assert.equal(classifyExtractorError({ name: 'AbortError', message: 'aborted' }).code, 'UPSTREAM_TIMEOUT');
});
