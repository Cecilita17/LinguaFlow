const AUTO_CAPTION_KIND = 'asr';

export class YouTubeCaptionExtractionError extends Error {
  constructor(code, message, { status = 422, diagnostics = [] } = {}) {
    super(message);
    this.name = 'YouTubeCaptionExtractionError';
    this.code = code;
    this.status = status;
    this.diagnostics = diagnostics;
  }
}

export function textValue(value) {
  if (value == null) return '';
  if (typeof value === 'string') return value.trim();
  if (typeof value.toString === 'function') return String(value.toString()).trim();
  return String(value).trim();
}

export function selectCaptionTrack(tracks, preferredLanguage = 'auto') {
  const usable = (Array.isArray(tracks) ? tracks : []).filter(
    (track) => track?.language_code || track?.languageCode
  );
  if (usable.length === 0) return null;

  const preferred = String(preferredLanguage || 'auto').toLowerCase();
  const languageOf = (track) => String(track.language_code || track.languageCode || '').toLowerCase();

  if (preferred !== 'auto') {
    const exact = usable.find((track) => languageOf(track) === preferred);
    const family = usable.find((track) => languageOf(track).startsWith(`${preferred}-`));
    return exact || family || null;
  }

  return usable.find((track) => track.kind !== AUTO_CAPTION_KIND) || usable[0];
}

export function describeCaptionTracks(tracks) {
  return (Array.isArray(tracks) ? tracks : []).map((track) => ({
    languageCode: track.language_code || track.languageCode || '',
    languageLabel: textValue(track.name),
    kind: track.kind === AUTO_CAPTION_KIND ? 'auto-generated' : 'manual'
  }));
}

export function normalizeTranscriptSegments(segments) {
  const normalized = [];

  for (const segment of Array.isArray(segments) ? segments : []) {
    const text = textValue(segment?.snippet || segment?.text).replace(/\s+/g, ' ').trim();
    const startMs = Number(segment?.start_ms ?? segment?.startMs);
    const endMs = Number(segment?.end_ms ?? segment?.endMs);
    if (!text || !Number.isFinite(startMs)) continue;

    const startTime = Math.max(0, startMs / 1000);
    const candidateEndTime = Number.isFinite(endMs) ? endMs / 1000 : startTime + 2;
    normalized.push({
      startTime,
      endTime: Math.max(startTime + 0.2, candidateEndTime),
      text
    });
  }

  return normalized.map((subtitle, index) => ({
    id: `youtube_${index + 1}`,
    ...subtitle
  }));
}

export function classifyExtractorError(error) {
  const message = String(error?.message || '').toLowerCase();
  const status = Number(error?.status || error?.statusCode || error?.info?.status_code);

  if (error?.name === 'AbortError' || message.includes('timeout') || message.includes('timed out')) {
    return { code: 'UPSTREAM_TIMEOUT', status: 504, message: 'YouTube tardó demasiado en responder. Probá nuevamente en unos instantes.' };
  }
  if (message.includes('transcript') || message.includes('caption')) {
    return { code: 'CAPTIONS_UNAVAILABLE', status: 422, message: 'Este vídeo no expone subtítulos CC o autogenerados para importar.' };
  }
  if (status === 404 || message.includes('video unavailable') || message.includes('video not found')) {
    return { code: 'VIDEO_UNAVAILABLE', status: 404, message: 'Este vídeo no existe o ya no está disponible en YouTube.' };
  }
  if (status === 401 || status === 403 || message.includes('restricted') || message.includes('private') || message.includes('sign in')) {
    return { code: 'VIDEO_RESTRICTED', status: 403, message: 'YouTube restringió el acceso a este vídeo o a sus subtítulos.' };
  }
  if (status === 429 || message.includes('rate limit') || message.includes('too many requests')) {
    return { code: 'YOUTUBE_TEMPORARILY_BLOCKED', status: 429, message: 'YouTube bloqueó temporalmente la consulta. Esperá unos minutos e intentá otra vez.' };
  }
  return { code: 'EXTRACTOR_FAILURE', status: 502, message: 'No se pudo consultar YouTube en este momento. Probá nuevamente.' };
}
