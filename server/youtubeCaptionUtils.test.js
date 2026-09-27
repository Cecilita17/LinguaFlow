import test from 'node:test';
import assert from 'node:assert/strict';
import {
  YouTubeCaptionExtractionError,
  classifyExtractorError,
  normalizeTranscriptSegments,
  parseCaptionPayload,
  selectCaptionTrack
} from './youtubeCaptionUtils.js';
import { fetchYouTubeCaptions } from './youtubeCaptionsService.js';

const manualEnglish = { language_code: 'en', name: 'English', base_url: 'https://captions.example/manual' };
const autoChinese = { language_code: 'zh-Hans', name: 'Chinese (Simplified)', kind: 'asr', base_url: 'https://captions.example/asr' };

function response({ status = 200, contentType = 'application/json', body = '' } = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => contentType },
    text: async () => body
  };
}

function info(tracks, transcriptSegments = []) {
  return {
    basic_info: { title: 'Test video' },
    captions: { caption_tracks: tracks },
    getTranscript: async () => ({
      selectedLanguage: 'English',
      languages: ['English'],
      transcript: { content: { body: { initial_segments: transcriptSegments } } }
    })
  };
}

function infoWithoutCaptionTracks() {
  return {
    basic_info: { title: 'Test video' },
    captions: { unexpected_caption_shape: true },
    getTranscript: async () => ({})
  };
}

function factoryByClient(entries) {
  return async () => ({
    getInfo: async (_videoId, options) => entries[options.client] || info([])
  });
}

const json3 = JSON.stringify({
  events: [{ tStartMs: 1200, dDurationMs: 2300, segs: [{ utf8: 'Hello world' }] }]
});

test('selectCaptionTrack supports manual CC, ASR, exact and family language matching', () => {
  assert.equal(selectCaptionTrack([manualEnglish, autoChinese], 'auto'), manualEnglish);
  assert.equal(selectCaptionTrack([autoChinese], 'auto'), autoChinese);
  assert.equal(selectCaptionTrack([manualEnglish, autoChinese], 'zh'), autoChinese);
  assert.equal(selectCaptionTrack([manualEnglish], 'ar'), null);
});

test('normalizeTranscriptSegments preserves timestamp precision', () => {
  assert.deepEqual(normalizeTranscriptSegments([
    { start_ms: '1230', end_ms: '3450', snippet: '  Hola\n mundo  ' },
    { start_ms: 'invalid', end_ms: '4000', snippet: 'ignored' }
  ]), [{ id: 'youtube_1', startTime: 1.23, endTime: 3.45, text: 'Hola mundo' }]);
});

test('parseCaptionPayload parses JSON3 and XML timed text', () => {
  assert.deepEqual(parseCaptionPayload(json3, 'application/json').segments, [
    { startMs: 1200, endMs: 3500, text: 'Hello world' }
  ]);
  assert.deepEqual(
    parseCaptionPayload('<transcript><text start="1.2" dur="2.3">Hola &amp; adi&#243;s</text></transcript>', 'text/xml').segments,
    [{ startMs: 1200, endMs: 3500, text: 'Hola & adiós' }]
  );
});

test('parseCaptionPayload rejects empty bodies, unexpected HTML and malformed payloads', () => {
  assert.throws(() => parseCaptionPayload('', 'application/json'), { code: 'CAPTION_TRACK_EMPTY' });
  assert.throws(() => parseCaptionPayload('<!doctype html><html></html>', 'text/html'), { code: 'CAPTION_DOWNLOAD_FAILED' });
  assert.throws(() => parseCaptionPayload('{"events":"wrong"}', 'application/json'), { code: 'CAPTION_PARSE_FAILED' });
});

test('classifyExtractorError keeps caption download failures distinct from unavailable captions', () => {
  assert.equal(classifyExtractorError(new YouTubeCaptionExtractionError('CAPTION_DOWNLOAD_FAILED', 'download failed')).code, 'CAPTION_DOWNLOAD_FAILED');
  assert.equal(classifyExtractorError({ message: 'Video unavailable', status: 404 }).code, 'VIDEO_UNAVAILABLE');
  assert.equal(classifyExtractorError({ name: 'AbortError', message: 'aborted' }).code, 'UPSTREAM_TIMEOUT');
});

test('direct track download works when getTranscript fails', async () => {
  const directInfo = info([manualEnglish]);
  directInfo.getTranscript = async () => { throw new Error('Transcript panel not found'); };
  const result = await fetchYouTubeCaptions(
    { videoId: 'abcdefghijk', preferredLanguage: 'en' },
    {
      innertubeFactory: factoryByClient({ ANDROID: directInfo }),
      fetchImpl: async () => response({ body: json3 })
    }
  );
  assert.equal(result.subtitles[0].text, 'Hello world');
  assert.equal(result.source, 'YouTube CC');
});

test('direct download uses the next supported client after a 200 empty body', async () => {
  let requestCount = 0;
  const result = await fetchYouTubeCaptions(
    { videoId: 'abcdefghijk', preferredLanguage: 'en' },
    {
      innertubeFactory: factoryByClient({ ANDROID: info([manualEnglish]), IOS: info([manualEnglish]) }),
      fetchImpl: async () => response({ body: ++requestCount === 1 ? '' : json3 })
    }
  );
  assert.equal(result.subtitles.length, 1);
});

test('getTranscript fallback works when direct download fails', async () => {
  const fallbackSegments = [{ start_ms: 1000, end_ms: 2000, snippet: 'Fallback text' }];
  const result = await fetchYouTubeCaptions(
    { videoId: 'abcdefghijk', preferredLanguage: 'en' },
    {
      innertubeFactory: factoryByClient({ ANDROID: info([manualEnglish], fallbackSegments) }),
      fetchImpl: async () => response({ status: 403, contentType: 'text/html', body: '<html>denied</html>' })
    }
  );
  assert.equal(result.subtitles[0].text, 'Fallback text');
  assert.equal(result.source, 'YouTube CC (fallback)');
});

test('returns requested-language-unavailable without silently selecting another track', async () => {
  await assert.rejects(
    fetchYouTubeCaptions(
      { videoId: 'abcdefghijk', preferredLanguage: 'ar' },
      { innertubeFactory: factoryByClient({ ANDROID: info([manualEnglish, autoChinese]) }) }
    ),
    { code: 'REQUESTED_LANGUAGE_UNAVAILABLE' }
  );
});

test('distinguishes confirmed absent captions from track-discovery failures', async () => {
  await assert.rejects(
    fetchYouTubeCaptions(
      { videoId: 'abcdefghijk', preferredLanguage: 'auto' },
      { innertubeFactory: factoryByClient({ ANDROID: info([]), IOS: info([]), WEB: info([]) }) }
    ),
    { code: 'CAPTIONS_CONFIRMED_UNAVAILABLE' }
  );

  await assert.rejects(
    fetchYouTubeCaptions(
      { videoId: 'abcdefghijk', preferredLanguage: 'auto' },
      { innertubeFactory: factoryByClient({ ANDROID: infoWithoutCaptionTracks(), IOS: infoWithoutCaptionTracks(), WEB: infoWithoutCaptionTracks() }) }
    ),
    { code: 'CAPTION_TRACK_DISCOVERY_FAILED' }
  );
});

test('does not misclassify YouTube anti-bot login challenges as a user video restriction', async () => {
  const blockedInfo = {
    basic_info: { title: 'Test video' },
    playability_status: { status: 'LOGIN_REQUIRED', reason: 'Sign in to confirm you’re not a bot' }
  };
  await assert.rejects(
    fetchYouTubeCaptions(
      { videoId: 'abcdefghijk', preferredLanguage: 'auto' },
      { innertubeFactory: factoryByClient({ ANDROID: blockedInfo, IOS: blockedInfo, WEB: blockedInfo }) }
    ),
    { code: 'YOUTUBE_TEMPORARILY_BLOCKED' }
  );
});

test('returns the direct download failure after direct and getTranscript both fail', async () => {
  const brokenInfo = info([manualEnglish]);
  brokenInfo.getTranscript = async () => { throw new Error('Transcript panel not found'); };
  await assert.rejects(
    fetchYouTubeCaptions(
      { videoId: 'abcdefghijk', preferredLanguage: 'en' },
      {
        innertubeFactory: factoryByClient({ ANDROID: brokenInfo }),
        fetchImpl: async () => response({ status: 403, contentType: 'text/html', body: '<html>denied</html>' })
      }
    ),
    { code: 'CAPTION_DOWNLOAD_FAILED' }
  );
});
