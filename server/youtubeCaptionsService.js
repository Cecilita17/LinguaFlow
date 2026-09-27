import { Innertube } from 'youtubei.js';
import {
  YouTubeCaptionExtractionError,
  classifyExtractorError,
  describeCaptionTracks,
  normalizeTranscriptSegments,
  parseCaptionPayload,
  selectCaptionTrack,
  textValue
} from './youtubeCaptionUtils.js';

const VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;
const EXTRACTOR_TIMEOUT_MS = 20000;
const CLIENT_PROFILES = ['ANDROID', 'IOS', 'WEB'];

function logDiagnostic(event, data = {}) {
  console.info('[YouTubeCaptionExtractor]', JSON.stringify({ event, ...data }));
}

function compactText(value, maximumLength = 180) {
  const text = textValue(value).replace(/\s+/g, ' ').trim();
  return text ? text.slice(0, maximumLength) : null;
}

function describeInfoStructure(info) {
  const captions = info?.captions;
  const tracks = captions?.caption_tracks;
  const playabilityStatus = compactText(info?.playability_status?.status);
  const playabilityReason = compactText(info?.playability_status?.reason);

  return {
    basicInfoPresent: Boolean(info?.basic_info),
    captionsPresent: Boolean(captions),
    captionsType: captions?.constructor?.name || null,
    captionKeys: captions ? Object.keys(captions).sort() : [],
    captionTracksPresent: Array.isArray(tracks),
    captionTrackCount: Array.isArray(tracks) ? tracks.length : null,
    playabilityStatus,
    playabilityReason
  };
}

function playbackFailure(structure, diagnostics) {
  const status = structure.playabilityStatus || '';
  const reason = structure.playabilityReason || '';
  const details = { status: 403, diagnostics };

  if (/proof of origin|po token|potoken/i.test(`${status} ${reason}`)) {
    return new YouTubeCaptionExtractionError('YOUTUBE_POT_REQUIRED', 'YouTube exige una verificación adicional para consultar este vídeo.', details);
  }

  if (/not a bot|confirm.*bot|unusual traffic|automated/i.test(reason)) {
    return new YouTubeCaptionExtractionError('YOUTUBE_TEMPORARILY_BLOCKED', 'YouTube solicitó una verificación anti-bot al servidor. Probá nuevamente más tarde.', { status: 429, diagnostics });
  }

  if (/AGE_CHECK_REQUIRED|CONTENT_CHECK_REQUIRED/i.test(status) || (status === 'LOGIN_REQUIRED' && /age|mature/i.test(reason))) {
    return new YouTubeCaptionExtractionError('VIDEO_RESTRICTED', 'YouTube requiere iniciar sesión o una verificación para acceder a este vídeo.', details);
  }

  if (status === 'LOGIN_REQUIRED') {
    return new YouTubeCaptionExtractionError('YOUTUBE_TEMPORARILY_BLOCKED', 'YouTube rechazó temporalmente la consulta del servidor y pidió iniciar sesión.', { status: 429, diagnostics });
  }

  if (/UNPLAYABLE|ERROR/i.test(status)) {
    return new YouTubeCaptionExtractionError(
      'VIDEO_UNAVAILABLE',
      reason ? `YouTube no puede reproducir este vídeo: ${reason}` : 'YouTube no puede reproducir este vídeo.',
      { status: 404, diagnostics }
    );
  }

  return null;
}

function withTimeout(promise, stage) {
  let timeoutId;
  const timeout = new Promise((_, reject) => {
    timeoutId = setTimeout(() => reject(new YouTubeCaptionExtractionError(
      'UPSTREAM_TIMEOUT',
      'YouTube tardó demasiado en responder. Probá nuevamente en unos instantes.',
      { status: 504, diagnostics: [{ stage, outcome: 'timeout' }] }
    )), EXTRACTOR_TIMEOUT_MS);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timeoutId));
}

async function createInnertube(diagnostics) {
  return withTimeout(Innertube.create({
    client_type: 'WEB',
    generate_session_locally: true,
    enable_session_cache: true,
    fast_fail: false,
    fetch: async (input, init) => {
      const rawUrl = typeof input === 'string' ? input : (input instanceof URL ? input.toString() : input.url);
      const source = new URL(rawUrl).pathname;
      try {
        const response = await fetch(input, init);
        diagnostics.push({ stage: 'upstream-request', source, httpStatus: response.status, contentType: response.headers.get('content-type') || '' });
        return response;
      } catch (error) {
        diagnostics.push({ stage: 'upstream-request', source, outcome: error?.name === 'AbortError' ? 'timeout' : 'network-error' });
        throw error;
      }
    }
  }), 'create-session');
}

function toExtractionError(error, diagnostics) {
  if (error instanceof YouTubeCaptionExtractionError) {
    return new YouTubeCaptionExtractionError(error.code, error.message, { status: error.status, diagnostics });
  }
  const classified = classifyExtractorError(error);
  return new YouTubeCaptionExtractionError(classified.code, classified.message, { status: classified.status, diagnostics });
}

function selectTranscriptLanguage(transcriptInfo, track) {
  const label = textValue(track?.name);
  if (!label || label === transcriptInfo.selectedLanguage || !Array.isArray(transcriptInfo.languages) || !transcriptInfo.languages.includes(label)) {
    return Promise.resolve(transcriptInfo);
  }
  return transcriptInfo.selectLanguage(label);
}

async function downloadCaptionTrack({ track, clientProfile, diagnostics, fetchImpl }) {
  if (!track?.base_url) {
    throw new YouTubeCaptionExtractionError('CAPTION_DOWNLOAD_FAILED', 'YouTube no proporcionó una URL de descarga para la pista de subtítulos.', { status: 502, diagnostics });
  }

  const captionUrl = new URL(track.base_url);
  captionUrl.searchParams.set('fmt', 'json3');
  let response;
  try {
    response = await withTimeout(
      fetchImpl(captionUrl, { headers: { accept: 'application/json, text/xml;q=0.9, */*;q=0.8' } }),
      'caption-download'
    );
  } catch (error) {
    throw toExtractionError(error, diagnostics);
  }

  const contentType = response.headers?.get?.('content-type') || '';
  const body = await withTimeout(response.text(), 'caption-read-body');
  const details = {
    stage: 'caption-download',
    clientProfile,
    httpStatus: response.status,
    contentType,
    bodyLength: body.length,
    outcome: response.ok && body.length > 0 ? 'received' : 'unusable'
  };
  diagnostics.push(details);
  logDiagnostic('caption-download', details);

  if (!response.ok) {
    throw new YouTubeCaptionExtractionError('CAPTION_DOWNLOAD_FAILED', 'YouTube rechazó la descarga de la pista de subtítulos.', { status: response.status || 502, diagnostics });
  }

  const parsed = parseCaptionPayload(body, contentType);
  diagnostics.push({ stage: 'caption-parsing', clientProfile, outcome: 'ok', format: parsed.format, parsedSegmentCount: parsed.segments.length });
  logDiagnostic('caption-parsing', { clientProfile, format: parsed.format, parsedSegmentCount: parsed.segments.length });
  return normalizeTranscriptSegments(parsed.segments);
}

function buildResult({ videoId, info, track, subtitles, source, diagnostics }) {
  return {
    videoId,
    title: textValue(info?.basic_info?.title) || `YouTube Video (${videoId})`,
    languageCode: track.language_code || 'auto',
    languageLabel: textValue(track.name) || track.language_code || 'Auto',
    source,
    isAutoGenerated: track.kind === 'asr',
    subtitles,
    diagnostics
  };
}

export async function fetchYouTubeCaptions(
  { videoId, preferredLanguage = 'auto' },
  { innertubeFactory = createInnertube, fetchImpl = fetch } = {}
) {
  if (!VIDEO_ID_PATTERN.test(String(videoId || ''))) {
    throw new YouTubeCaptionExtractionError('INVALID_VIDEO_ID', 'El enlace de YouTube no es válido.', {
      status: 400,
      diagnostics: [{ stage: 'validate', outcome: 'invalid-video-id' }]
    });
  }

  const diagnostics = [{ stage: 'validate', outcome: 'ok' }];
  const candidates = [];
  let lastFailure = null;

  try {
    const innertube = await innertubeFactory(diagnostics);
    diagnostics.push({ stage: 'create-session', outcome: 'ok' });
    logDiagnostic('create-session', { outcome: 'ok' });

    for (const clientProfile of CLIENT_PROFILES) {
      let info;
      try {
        // youtubei.js 17.x requires { client }, not a bare profile string.
        info = await withTimeout(innertube.getInfo(videoId, { client: clientProfile }), `get-info-${clientProfile.toLowerCase()}`);
      } catch (error) {
        lastFailure = toExtractionError(error, diagnostics);
        diagnostics.push({ stage: 'get-info', clientProfile, outcome: 'error', code: lastFailure.code });
        logDiagnostic('get-info', { clientProfile, outcome: 'error', code: lastFailure.code });
        continue;
      }

      const structure = describeInfoStructure(info);
      diagnostics.push({ stage: 'get-info', clientProfile, outcome: 'ok', ...structure });
      logDiagnostic('get-info', { clientProfile, outcome: 'ok', ...structure });

      const unavailableVideo = playbackFailure(structure, diagnostics);
      if (unavailableVideo) {
        lastFailure = unavailableVideo;
        diagnostics.push({ stage: 'playability', clientProfile, outcome: 'unavailable', code: unavailableVideo.code });
        logDiagnostic('playability', { clientProfile, outcome: 'unavailable', code: unavailableVideo.code });
        continue;
      }

      const tracks = Array.isArray(info?.captions?.caption_tracks) ? info.captions.caption_tracks : [];
      const trackSummary = describeCaptionTracks(tracks);
      const discoveryOutcome = structure.captionTracksPresent ? 'ok' : 'tracks-property-missing';
      diagnostics.push({ stage: 'track-discovery', clientProfile, outcome: discoveryOutcome, trackCount: trackSummary.length, tracks: trackSummary });
      logDiagnostic('track-discovery', { clientProfile, outcome: discoveryOutcome, trackCount: trackSummary.length, tracks: trackSummary });
      if (tracks.length === 0) continue;

      const track = selectCaptionTrack(tracks, preferredLanguage);
      if (!track) {
        diagnostics.push({ stage: 'track-selection', clientProfile, outcome: 'requested-language-unavailable', preferredLanguage });
        continue;
      }
      diagnostics.push({
        stage: 'track-selection',
        clientProfile,
        outcome: 'ok',
        languageCode: track.language_code || '',
        languageLabel: textValue(track.name),
        kind: track.kind === 'asr' ? 'auto-generated' : 'manual'
      });
      logDiagnostic('track-selection', { clientProfile, languageCode: track.language_code || '', kind: track.kind === 'asr' ? 'auto-generated' : 'manual' });

      const candidate = { clientProfile, info, track };
      candidates.push(candidate);
      try {
        const subtitles = await downloadCaptionTrack({ track, clientProfile, diagnostics, fetchImpl });
        diagnostics.push({ stage: 'normalization', clientProfile, outcome: subtitles.length ? 'ok' : 'empty', subtitleCount: subtitles.length });
        if (!subtitles.length) {
          throw new YouTubeCaptionExtractionError('CAPTION_TRACK_EMPTY', 'YouTube devolvió una pista de subtítulos sin segmentos utilizables.', { status: 502, diagnostics });
        }
        return buildResult({
          videoId, info, track, subtitles, diagnostics,
          source: track.kind === 'asr' ? 'YouTube auto-generated captions' : 'YouTube CC'
        });
      } catch (error) {
        lastFailure = toExtractionError(error, diagnostics);
        diagnostics.push({ stage: 'caption-download', clientProfile, outcome: 'failed', code: lastFailure.code });
        logDiagnostic('caption-download-failed', { clientProfile, code: lastFailure.code });
      }
    }

    if (!candidates.length) {
      const discoveredTracks = diagnostics.some((entry) => entry.stage === 'track-discovery' && entry.trackCount > 0);
      if (discoveredTracks) {
        throw new YouTubeCaptionExtractionError(
          'REQUESTED_LANGUAGE_UNAVAILABLE',
          `El vídeo tiene subtítulos, pero no hay una pista disponible en ${String(preferredLanguage || '').toUpperCase()}.`,
          { status: 422, diagnostics }
        );
      }

      if (lastFailure?.code === 'VIDEO_RESTRICTED' || lastFailure?.code === 'VIDEO_UNAVAILABLE') {
        throw lastFailure;
      }

      const successfulDiscovery = diagnostics.filter((entry) => entry.stage === 'get-info' && entry.outcome === 'ok');
      const captionsConfirmedUnavailable = successfulDiscovery.length > 0 && successfulDiscovery.every(
        (entry) => entry.captionsPresent && entry.captionTracksPresent && entry.captionTrackCount === 0
      );
      if (captionsConfirmedUnavailable) {
        throw new YouTubeCaptionExtractionError(
          'CAPTIONS_CONFIRMED_UNAVAILABLE',
          'YouTube informó que este vídeo no tiene subtítulos CC ni autogenerados disponibles para importar.',
          { status: 422, diagnostics }
        );
      }

      throw new YouTubeCaptionExtractionError(
        'CAPTION_TRACK_DISCOVERY_FAILED',
        'No se pudieron detectar las pistas de subtítulos que YouTube ofrece para este vídeo.',
        { status: 502, diagnostics }
      );
    }

    // Supported youtubei.js fallback, after every direct track request failed.
    for (const { clientProfile, info, track } of candidates) {
      try {
        diagnostics.push({ stage: 'getTranscript-fallback', clientProfile, outcome: 'start' });
        const transcriptInfo = await withTimeout(info.getTranscript(), 'getTranscript-fallback');
        const transcript = await withTimeout(selectTranscriptLanguage(transcriptInfo, track), 'select-transcript-language');
        const subtitles = normalizeTranscriptSegments(transcript?.transcript?.content?.body?.initial_segments || []);
        diagnostics.push({ stage: 'getTranscript-fallback', clientProfile, outcome: subtitles.length ? 'ok' : 'empty', subtitleCount: subtitles.length });
        logDiagnostic('getTranscript-fallback', { clientProfile, outcome: subtitles.length ? 'ok' : 'empty', subtitleCount: subtitles.length });
        if (!subtitles.length) continue;
        return buildResult({
          videoId, info, track, subtitles, diagnostics,
          source: track.kind === 'asr' ? 'YouTube auto-generated captions (fallback)' : 'YouTube CC (fallback)'
        });
      } catch (error) {
        const fallbackFailure = toExtractionError(error, diagnostics);
        // Preserve the direct-track failure: a missing transcript panel does
        // not prove that the selected caption track was unavailable.
        if (!lastFailure) lastFailure = fallbackFailure;
        diagnostics.push({ stage: 'getTranscript-fallback', clientProfile, outcome: 'failed', code: fallbackFailure.code });
        logDiagnostic('getTranscript-fallback', { clientProfile, outcome: 'failed', code: fallbackFailure.code });
      }
    }

    throw lastFailure || new YouTubeCaptionExtractionError('CAPTION_DOWNLOAD_FAILED', 'No se pudo descargar la pista de subtítulos de YouTube.', { status: 502, diagnostics });
  } catch (error) {
    const extractionError = toExtractionError(error, diagnostics);
    diagnostics.push({
      stage: 'extract',
      outcome: 'error',
      code: extractionError.code,
      upstreamStatus: Number(error?.status || error?.statusCode || error?.info?.status_code) || null
    });
    logDiagnostic('error', { videoId, code: extractionError.code, diagnostics });
    throw extractionError;
  }
}
