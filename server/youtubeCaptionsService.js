/**
 * Retrieves public YouTube caption tracks for the YouTube Reader beta importer.
 * This is intentionally server-side because YouTube caption endpoints are not
 * reliably accessible from browsers due to CORS restrictions.
 */

const VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;

function extractJsonObject(source, marker) {
  const markerIndex = source.indexOf(marker);
  if (markerIndex < 0) return null;
  const start = source.indexOf('{', markerIndex + marker.length);
  if (start < 0) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = start; index < source.length; index += 1) {
    const char = source[index];
    if (inString) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') {
      inString = true;
    } else if (char === '{') {
      depth += 1;
    } else if (char === '}') {
      depth -= 1;
      if (depth === 0) {
        try {
          return JSON.parse(source.slice(start, index + 1));
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}

function extractConfigString(source, key) {
  const match = source.match(new RegExp(`"${key}":"([^\"]+)"`));
  return match?.[1] || '';
}

async function fetchEmbeddedPagePlayerResponse(videoId) {
  const response = await fetchWithTimeout(
    `https://www.youtube.com/embed/${encodeURIComponent(videoId)}?hl=en&cc_load_policy=1`,
    {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; LinguaFlow YouTube captions beta)',
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer': 'https://www.youtube.com/'
      }
    }
  );
  if (!response.ok) return null;

  const html = await response.text();
  return (
    extractJsonObject(html, 'ytInitialPlayerResponse =') ||
    extractJsonObject(html, 'var ytInitialPlayerResponse =') ||
    extractJsonObject(html, 'ytInitialPlayerResponse=')
  );
}

async function fetchEmbeddedPlayerResponse(videoId) {
  // Some videos omit captions from the watch-page response but expose them to
  // the embedded player, which is the same public player used in webpages.
  const url = `https://www.youtube.com/get_video_info?video_id=${encodeURIComponent(videoId)}&el=embedded&hl=en&html5=1`;
  const response = await fetchWithTimeout(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; LinguaFlow YouTube captions beta)',
      'Accept-Language': 'en-US,en;q=0.9'
    }
  });
  if (!response.ok) return null;

  const params = new URLSearchParams(await response.text());
  const playerResponse = params.get('player_response');
  if (!playerResponse) return null;
  try {
    return JSON.parse(playerResponse);
  } catch {
    return null;
  }
}

async function fetchAndroidPlayerResponse(videoId) {
  // The Android InnerTube client exposes caption tracks more consistently than
  // the watch page. This public client key is required by YouTube's player API.
  const clientVersion = '20.10.38';
  const clientKey = 'AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8';
  const response = await fetchWithTimeout(
    `https://www.youtube.com/youtubei/v1/player?key=${clientKey}&prettyPrint=false`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': `com.google.android.youtube/${clientVersion} (Linux; U; Android 14)`,
        'X-YouTube-Client-Name': '3',
        'X-YouTube-Client-Version': clientVersion,
        'Origin': 'https://www.youtube.com'
      },
      body: JSON.stringify({
        context: {
          client: {
            clientName: 'ANDROID',
            clientVersion,
            androidSdkVersion: 30,
            hl: 'en',
            gl: 'US'
          }
        },
        videoId,
        contentCheckOk: true,
        racyCheckOk: true
      })
    }
  );
  if (!response.ok) return null;
  return response.json().catch(() => null);
}

async function fetchPlayerResponseFallback(html, videoId) {
  const apiKey = extractConfigString(html, 'INNERTUBE_API_KEY');
  if (!apiKey) return null;
  const clientVersion = extractConfigString(html, 'INNERTUBE_CLIENT_VERSION') || '2.20250101.00.00';
  const response = await fetchWithTimeout(`https://www.youtube.com/youtubei/v1/player?key=${encodeURIComponent(apiKey)}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'Mozilla/5.0 (compatible; LinguaFlow YouTube captions beta)',
      'X-YouTube-Client-Name': '1',
      'X-YouTube-Client-Version': clientVersion
    },
    body: JSON.stringify({
      videoId,
      contentCheckOk: true,
      racyCheckOk: true,
      context: { client: { clientName: 'WEB', clientVersion } }
    })
  });
  if (!response.ok) return null;
  return response.json().catch(() => null);
}

function trackLabel(track) {
  const name = track?.name?.simpleText || track?.name?.runs?.map((run) => run.text).join('') || track?.languageCode || '';
  return String(name).trim();
}

function decodeXmlEntities(value = '') {
  return String(value)
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function parseXmlAttributes(value = '') {
  const attributes = {};
  for (const match of value.matchAll(/([\w-]+)="([^"]*)"/g)) {
    attributes[match[1]] = decodeXmlEntities(match[2]);
  }
  return attributes;
}

async function fetchLegacyCaptionTracks(videoId) {
  const listUrl = `https://www.youtube.com/api/timedtext?type=list&v=${encodeURIComponent(videoId)}`;
  const response = await fetchWithTimeout(listUrl, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; LinguaFlow YouTube captions beta)' }
  });
  if (!response.ok) return [];
  const xml = await response.text();
  return [...xml.matchAll(/<track\s+([^>]*)\/?>(?:<\/track>)?/g)]
    .map((match) => parseXmlAttributes(match[1]))
    .filter((track) => track.lang_code)
    .map((track) => {
      const params = new URLSearchParams({ v: videoId, lang: track.lang_code });
      if (track.kind) params.set('kind', track.kind);
      return {
        baseUrl: `https://www.youtube.com/api/timedtext?${params.toString()}`,
        languageCode: track.lang_code,
        kind: track.kind || '',
        name: { simpleText: track.name || track.lang_translated || track.lang_code }
      };
    });
}

function chooseTrack(tracks, preferredLanguage = 'auto') {
  const preferred = String(preferredLanguage || 'auto').toLowerCase();
  const usable = tracks.filter((track) => track?.baseUrl && track?.languageCode);
  if (preferred !== 'auto') {
    const exact = usable.find((track) => track.languageCode.toLowerCase() === preferred);
    const languageFamily = usable.find((track) => track.languageCode.toLowerCase().startsWith(`${preferred}-`));
    if (exact || languageFamily) return exact || languageFamily;
  }

  // Prefer a human-made CC track. Auto-generated tracks are a supported fallback.
  return usable.find((track) => track.kind !== 'asr') || usable[0] || null;
}

function captionText(event) {
  return (event?.segs || [])
    .map((segment) => segment?.utf8 || '')
    .join('')
    .replace(/\n/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeCaptionText(value = '') {
  return decodeXmlEntities(String(value).replace(/<[^>]*>/g, ''))
    .replace(/\n/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseCaptionXml(xml = '') {
  const subtitles = [];
  const append = (attributes, rawText) => {
    const text = normalizeCaptionText(rawText);
    const startTime = Number(attributes.t ?? attributes.start);
    const duration = Number(attributes.d ?? attributes.dur);
    const normalizedStart = Number.isFinite(startTime)
      ? (attributes.t !== undefined ? startTime / 1000 : startTime)
      : NaN;
    const normalizedDuration = Number.isFinite(duration)
      ? (attributes.d !== undefined ? duration / 1000 : duration)
      : 2;
    if (!text || !Number.isFinite(normalizedStart)) return;
    subtitles.push({
      startTime: Math.max(0, normalizedStart),
      endTime: Math.max(
        normalizedStart + 0.2,
        normalizedStart + (normalizedDuration > 0 ? normalizedDuration : 2)
      ),
      text
    });
  };

  for (const match of String(xml).matchAll(/<p\s+([^>]*)>([\s\S]*?)<\/p>/g)) {
    append(parseXmlAttributes(match[1]), match[2]);
  }
  if (subtitles.length > 0) return subtitles;

  for (const match of String(xml).matchAll(/<text\s+([^>]*)>([\s\S]*?)<\/text>/g)) {
    append(parseXmlAttributes(match[1]), match[2]);
  }
  return subtitles;
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 15000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchYouTubeCaptions({ videoId, preferredLanguage = 'auto' }) {
  if (!VIDEO_ID_PATTERN.test(String(videoId || ''))) {
    throw new Error('El enlace de YouTube no es válido.');
  }

  const watchUrl = `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}&hl=en`;
  const watchResponse = await fetchWithTimeout(watchUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; LinguaFlow YouTube captions beta)',
      'Accept-Language': 'en-US,en;q=0.9'
    }
  });

  if (!watchResponse.ok) {
    throw new Error('YouTube no permitió consultar los subtítulos de este vídeo.');
  }

  const html = await watchResponse.text();
  let playerResponse =
    extractJsonObject(html, 'ytInitialPlayerResponse =') ||
    extractJsonObject(html, 'var ytInitialPlayerResponse =') ||
    extractJsonObject(html, 'ytInitialPlayerResponse=');

  let tracks = playerResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks || [];
  if (tracks.length === 0) {
    const embeddedPagePlayerResponse = await fetchEmbeddedPagePlayerResponse(videoId);
    if (embeddedPagePlayerResponse) {
      playerResponse = embeddedPagePlayerResponse;
      tracks = playerResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks || [];
    }
  }
  if (tracks.length === 0) {
    const embeddedPlayerResponse = await fetchEmbeddedPlayerResponse(videoId);
    if (embeddedPlayerResponse) {
      playerResponse = embeddedPlayerResponse;
      tracks = playerResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks || [];
    }
  }
  if (tracks.length === 0) {
    const androidPlayerResponse = await fetchAndroidPlayerResponse(videoId);
    if (androidPlayerResponse) {
      playerResponse = androidPlayerResponse;
      tracks = playerResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks || [];
    }
  }
  if (tracks.length === 0) {
    const webPlayerResponse = await fetchPlayerResponseFallback(html, videoId);
    if (webPlayerResponse) {
      playerResponse = webPlayerResponse;
      tracks = playerResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks || [];
    }
  }
  if (tracks.length === 0) {
    tracks = await fetchLegacyCaptionTracks(videoId);
  }

  const track = chooseTrack(tracks, preferredLanguage);
  if (!track) {
    throw new Error('YouTube no expuso una pista CC o auto-generada para este vídeo. Probá otro idioma o la importación normal.');
  }

  const captionUrl = new URL(track.baseUrl);
  captionUrl.searchParams.set('fmt', 'json3');
  const captionsResponse = await fetchWithTimeout(captionUrl.toString(), {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; LinguaFlow YouTube captions beta)',
      'Referer': watchUrl
    }
  });

  if (!captionsResponse.ok) {
    throw new Error('No se pudieron descargar los subtítulos de este vídeo.');
  }

  const captionBody = await captionsResponse.text();
  let payload = null;
  try {
    payload = JSON.parse(captionBody || 'null');
  } catch {
    // Public timedtext endpoints can return XML even when fmt=json3 is requested.
  }
  const jsonSubtitles = (payload?.events || [])
    .map((event) => {
      const text = captionText(event);
      const startTime = Number(event?.tStartMs) / 1000;
      const duration = Number(event?.dDurationMs) / 1000;
      if (!text || !Number.isFinite(startTime)) return null;
      return {
        startTime: Math.max(0, startTime),
        endTime: Math.max(startTime + 0.2, startTime + (Number.isFinite(duration) && duration > 0 ? duration : 2)),
        text
      };
    })
    .filter(Boolean);

  const parsedSubtitles = jsonSubtitles.length > 0 ? jsonSubtitles : parseCaptionXml(captionBody);
  const subtitles = parsedSubtitles
    .map((subtitle, index) => ({ ...subtitle, id: `youtube_${index + 1}` }))
    .slice(0, 10000);

  if (subtitles.length === 0) {
    throw new Error('YouTube devolvió una pista de subtítulos vacía.');
  }

  const title = playerResponse?.videoDetails?.title || `YouTube Video (${videoId})`;
  const isAutoGenerated = track.kind === 'asr';
  return {
    videoId,
    title,
    languageCode: track.languageCode,
    languageLabel: trackLabel(track),
    source: isAutoGenerated ? 'YouTube auto-generated captions' : 'YouTube CC',
    isAutoGenerated,
    subtitles
  };
}
