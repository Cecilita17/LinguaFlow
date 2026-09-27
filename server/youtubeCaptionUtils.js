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

function decodeXmlEntities(value) {
  return String(value || '')
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, decimal) => String.fromCodePoint(parseInt(decimal, 10)))
    .replace(/&(amp|lt|gt|quot|apos);/g, (_, entity) => ({ amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" })[entity]);
}

function attributeValue(attributes, name) {
  const match = String(attributes || '').match(new RegExp(`\\b${name}=(?:"([^"]*)"|'([^']*)')`, 'i'));
  return match ? (match[1] ?? match[2] ?? '') : '';
}

export function parseJson3Captions(payload) {
  const data = typeof payload === 'string' ? JSON.parse(payload) : payload;
  if (!data || !Array.isArray(data.events)) {
    throw new YouTubeCaptionExtractionError(
      'CAPTION_PARSE_FAILED',
      'YouTube devolvió subtítulos JSON3 con una estructura inesperada.',
      { status: 502 }
    );
  }

  return data.events.map((event) => ({
    startMs: Number(event?.tStartMs),
    endMs: Number(event?.tStartMs) + Number(event?.dDurationMs || 0),
    text: (Array.isArray(event?.segs) ? event.segs : []).map((segment) => segment?.utf8 || '').join('')
  })).filter((segment) => Number.isFinite(segment.startMs) && segment.text.trim());
}

export function parseTimedTextXml(payload) {
  const segments = [];
  const textPattern = /<text\b([^>]*)>([\s\S]*?)<\/text>/gi;
  let match;

  while ((match = textPattern.exec(String(payload || '')))) {
    const startSeconds = Number(attributeValue(match[1], 'start'));
    const durationSeconds = Number(attributeValue(match[1], 'dur'));
    const text = decodeXmlEntities(match[2]).replace(/<[^>]+>/g, ' ');
    if (!Number.isFinite(startSeconds) || !text.trim()) continue;
    segments.push({
      startMs: startSeconds * 1000,
      endMs: (startSeconds + (Number.isFinite(durationSeconds) ? durationSeconds : 2)) * 1000,
      text
    });
  }

  if (segments.length === 0) {
    throw new YouTubeCaptionExtractionError(
      'CAPTION_PARSE_FAILED',
      'YouTube devolvió subtítulos XML con una estructura inesperada.',
      { status: 502 }
    );
  }

  return segments;
}

export function parseCaptionPayload(body, contentType = '') {
  const normalizedBody = String(body || '').trim();
  const normalizedType = String(contentType || '').toLowerCase();

  if (!normalizedBody) {
    throw new YouTubeCaptionExtractionError(
      'CAPTION_TRACK_EMPTY',
      'YouTube devolvió una pista de subtítulos vacía.',
      { status: 502 }
    );
  }

  if (normalizedType.includes('text/html') || /^<!doctype html|^<html\b/i.test(normalizedBody)) {
    throw new YouTubeCaptionExtractionError(
      'CAPTION_DOWNLOAD_FAILED',
      'YouTube devolvió una página HTML en lugar de los subtítulos.',
      { status: 502 }
    );
  }

  if (normalizedType.includes('json') || normalizedBody.startsWith('{')) {
    return { format: 'json3', segments: parseJson3Captions(normalizedBody) };
  }

  if (normalizedType.includes('xml') || normalizedBody.startsWith('<')) {
    return { format: 'xml', segments: parseTimedTextXml(normalizedBody) };
  }

  throw new YouTubeCaptionExtractionError(
    'CAPTION_PARSE_FAILED',
    'YouTube devolvió un formato de subtítulos no reconocido.',
    { status: 502 }
  );
}

export function classifyExtractorError(error) {
  if (error?.code && error instanceof YouTubeCaptionExtractionError) {
    return { code: error.code, status: error.status, message: error.message };
  }

  const message = String(error?.message || '').toLowerCase();
  const status = Number(error?.status || error?.statusCode || error?.info?.status_code);

  if (error?.name === 'AbortError' || message.includes('timeout') || message.includes('timed out')) {
    return { code: 'UPSTREAM_TIMEOUT', status: 504, message: 'YouTube tardó demasiado en responder. Probá nuevamente en unos instantes.' };
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
  if (message.includes('proof of origin') || message.includes('po token') || message.includes('potoken')) {
    return { code: 'YOUTUBE_POT_REQUIRED', status: 403, message: 'YouTube exige una verificación adicional para obtener estos subtítulos.' };
  }
  return { code: 'EXTRACTOR_FAILURE', status: 502, message: 'No se pudo consultar YouTube en este momento. Probá nuevamente.' };
}

