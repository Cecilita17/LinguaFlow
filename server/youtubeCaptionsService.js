/**
 * YouTube caption extraction for the Beta importer.
 *
 * Primary extractor: youtubei.js (MIT), a maintained Node client for YouTube's
 * InnerTube API. It replaces LinguaFlow's former hand-maintained collection of
 * watch-page, embed-page and timedtext parsers.
 */
import { Innertube } from 'youtubei.js';
import {
  YouTubeCaptionExtractionError,
  classifyExtractorError,
  describeCaptionTracks,
  normalizeTranscriptSegments,
  selectCaptionTrack,
  textValue
} from './youtubeCaptionUtils.js';

const VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;
const EXTRACTOR_TIMEOUT_MS = 20000;

function logDiagnostic(event, data = {}) {
  // Never log signed caption URLs, cookies or request headers.
  console.info('[YouTubeCaptionExtractor]', JSON.stringify({ event, ...data }));
}

function withTimeout(promise, stage) {
  let timeoutId;
  const timeout = new Promise((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new YouTubeCaptionExtractionError(
        'UPSTREAM_TIMEOUT',
        'YouTube tardó demasiado en responder. Probá nuevamente en unos instantes.',
        { status: 504, diagnostics: [{ stage, outcome: 'timeout' }] }
      ));
    }, EXTRACTOR_TIMEOUT_MS);
  });

  return Promise.race([promise, timeout]).finally(() => clearTimeout(timeoutId));
}

async function createInnertube(diagnostics) {
  return withTimeout(
    Innertube.create({
      client_type: 'WEB',
      generate_session_locally: true,
      enable_session_cache: true,
      fast_fail: false,
      fetch: async (input, init) => {
        const rawUrl = typeof input === 'string'
          ? input
          : (input instanceof URL ? input.toString() : input.url);
        const requestUrl = new URL(rawUrl);
        const source = requestUrl.pathname;
        try {
          const response = await fetch(input, init);
          diagnostics.push({
            stage: 'upstream-request',
            source,
            httpStatus: response.status,
            contentType: response.headers.get('content-type') || ''
          });
          return response;
        } catch (error) {
          diagnostics.push({
            stage: 'upstream-request',
            source,
            outcome: error?.name === 'AbortError' ? 'timeout' : 'network-error'
          });
          throw error;
        }
      }
    }),
    'create-session'
  );
}

function selectTranscriptLanguage(transcriptInfo, track) {
  const requestedLabel = textValue(track?.name);
  const availableLanguages = Array.isArray(transcriptInfo?.languages) ? transcriptInfo.languages : [];

  if (!requestedLabel || requestedLabel === transcriptInfo.selectedLanguage) {
    return Promise.resolve(transcriptInfo);
  }

  if (!availableLanguages.includes(requestedLabel)) {
    logDiagnostic('language-menu-mismatch', {
      selectedLanguage: transcriptInfo.selectedLanguage || '',
      requestedLanguage: requestedLabel,
      availableLanguages
    });
    return Promise.resolve(transcriptInfo);
  }

  return transcriptInfo.selectLanguage(requestedLabel);
}

export async function fetchYouTubeCaptions({ videoId, preferredLanguage = 'auto' }) {
  if (!VIDEO_ID_PATTERN.test(String(videoId || ''))) {
    throw new YouTubeCaptionExtractionError(
      'INVALID_VIDEO_ID',
      'El enlace de YouTube no es válido.',
      { status: 400, diagnostics: [{ stage: 'validate', outcome: 'invalid-video-id' }] }
    );
  }

  const diagnostics = [{ stage: 'validate', outcome: 'ok' }];

  try {
    const innertube = await createInnertube(diagnostics);
    diagnostics.push({ stage: 'create-session', outcome: 'ok' });

    const info = await withTimeout(innertube.getInfo(videoId), 'video-metadata');
    const title = textValue(info?.basic_info?.title) || `YouTube Video (${videoId})`;
    const tracks = info?.captions?.caption_tracks || [];
    const trackSummary = describeCaptionTracks(tracks);
    diagnostics.push({
      stage: 'video-metadata',
      outcome: 'ok',
      trackCount: trackSummary.length,
      tracks: trackSummary
    });
    logDiagnostic('metadata', { videoId, title, trackCount: trackSummary.length, tracks: trackSummary });

    if (tracks.length === 0) {
      throw new YouTubeCaptionExtractionError(
        'CAPTIONS_UNAVAILABLE',
        'Este vídeo no expone subtítulos CC o autogenerados para importar.',
        { status: 422, diagnostics }
      );
    }

    const track = selectCaptionTrack(tracks, preferredLanguage);
    if (!track) {
      const requested = String(preferredLanguage || '').toUpperCase();
      throw new YouTubeCaptionExtractionError(
        'REQUESTED_LANGUAGE_UNAVAILABLE',
        `El vídeo tiene subtítulos, pero no hay una pista disponible en ${requested}.`,
        { status: 422, diagnostics }
      );
    }

    const transcriptInfo = await withTimeout(info.getTranscript(), 'transcript');
    const localizedTranscript = await withTimeout(
      selectTranscriptLanguage(transcriptInfo, track),
      'select-language'
    );
    const segments = localizedTranscript?.transcript?.content?.body?.initial_segments || [];
    const subtitles = normalizeTranscriptSegments(segments);
    diagnostics.push({
      stage: 'transcript',
      outcome: subtitles.length > 0 ? 'ok' : 'empty',
      selectedLanguage: localizedTranscript?.selectedLanguage || textValue(track.name),
      subtitleCount: subtitles.length
    });
    logDiagnostic('transcript', {
      videoId,
      languageCode: track.language_code || '',
      isAutoGenerated: track.kind === 'asr',
      subtitleCount: subtitles.length
    });

    if (subtitles.length === 0) {
      throw new YouTubeCaptionExtractionError(
        'CAPTION_TRACK_EMPTY',
        'YouTube encontró la pista de subtítulos, pero la devolvió vacía.',
        { status: 502, diagnostics }
      );
    }

    return {
      videoId,
      title,
      languageCode: track.language_code || 'auto',
      languageLabel: textValue(track.name) || track.language_code || 'Auto',
      source: track.kind === 'asr' ? 'YouTube auto-generated captions' : 'YouTube CC',
      isAutoGenerated: track.kind === 'asr',
      subtitles,
      diagnostics
    };
  } catch (error) {
    if (error instanceof YouTubeCaptionExtractionError) {
      throw error;
    }

    const classified = classifyExtractorError(error);
    diagnostics.push({
      stage: 'extract',
      outcome: 'error',
      code: classified.code,
      upstreamStatus: Number(error?.status || error?.statusCode || error?.info?.status_code) || null
    });
    logDiagnostic('error', { videoId, code: classified.code, diagnostics });
    throw new YouTubeCaptionExtractionError(classified.code, classified.message, {
      status: classified.status,
      diagnostics
    });
  }
}
