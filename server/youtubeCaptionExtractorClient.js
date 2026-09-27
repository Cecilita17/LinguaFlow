import { YouTubeCaptionExtractionError } from './youtubeCaptionUtils.js';

const REQUEST_TIMEOUT_MS = 30000;

function configuredExtractorUrl() {
  const value = String(process.env.YOUTUBE_CAPTION_EXTRACTOR_URL || '').trim();
  return value ? value.replace(/\/+$/, '') : null;
}

function withTimeout(promise) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  return Promise.race([promise(controller.signal), new Promise((_, reject) => {
    controller.signal.addEventListener('abort', () => reject(new YouTubeCaptionExtractionError(
      'UPSTREAM_TIMEOUT',
      'El servicio de subtítulos tardó demasiado en responder.',
      { status: 504 }
    )));
  })]).finally(() => clearTimeout(timeout));
}

export async function fetchConfiguredYouTubeCaptions(request) {
  const baseUrl = configuredExtractorUrl();
  if (!baseUrl) return null;

  let response;
  let payload;
  try {
    response = await withTimeout((signal) => fetch(`${baseUrl}/extract/youtube`, {
      method: 'POST',
      signal,
      headers: {
        'content-type': 'application/json',
        'x-api-key': String(process.env.YOUTUBE_CAPTION_EXTRACTOR_API_KEY || '')
      },
      body: JSON.stringify(request)
    }));
    payload = await response.json().catch(() => ({}));
  } catch (error) {
    if (error instanceof YouTubeCaptionExtractionError) throw error;
    throw new YouTubeCaptionExtractionError(
      'EXTERNAL_EXTRACTOR_UNAVAILABLE',
      'No se pudo conectar con el servicio de subtítulos de YouTube.',
      { status: 502 }
    );
  }

  if (!response.ok || !payload?.success || !Array.isArray(payload.subtitles)) {
    throw new YouTubeCaptionExtractionError(
      payload?.code || 'EXTERNAL_EXTRACTOR_FAILURE',
      payload?.error || 'El servicio de subtítulos no pudo procesar este vídeo.',
      { status: Number.isInteger(response.status) ? response.status : 502, diagnostics: payload?.diagnostics || [] }
    );
  }

  return payload;
}
