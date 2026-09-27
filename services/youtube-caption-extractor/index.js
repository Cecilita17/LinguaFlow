import crypto from 'node:crypto';
import express from 'express';
import { fetchYouTubeCaptions } from '../../server/youtubeCaptionsService.js';

const app = express();
const port = Number(process.env.PORT || 8080);

app.disable('x-powered-by');
app.use(express.json({ limit: '100kb' }));

function hasValidApiKey(request) {
  const expected = String(process.env.EXTRACTOR_API_KEY || '');
  const received = String(request.get('x-api-key') || '');
  if (!expected || expected.length !== received.length) return false;
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(received));
}

app.get('/health', (_request, response) => {
  response.json({
    ok: true,
    visitorDataConfigured: Boolean(process.env.YOUTUBE_VISITOR_DATA),
    poTokenConfigured: Boolean(process.env.YOUTUBE_PO_TOKEN)
  });
});

app.post('/extract/youtube', async (request, response) => {
  if (!hasValidApiKey(request)) {
    return response.status(401).json({ error: 'Extractor no autorizado.', code: 'EXTRACTOR_UNAUTHORIZED' });
  }

  try {
    const result = await fetchYouTubeCaptions(request.body || {});
    return response.json({ success: true, ...result });
  } catch (error) {
    const status = Number.isInteger(error?.status) ? error.status : 502;
    const code = error?.code || 'EXTRACTOR_FAILURE';
    console.warn('[YouTubeCaptionExtractorService] failed', { code, status, diagnostics: error?.diagnostics || [] });
    return response.status(status).json({
      error: error?.message || 'No se pudieron obtener los subtítulos de YouTube.',
      code,
      diagnostics: Array.isArray(error?.diagnostics) ? error.diagnostics : []
    });
  }
});

app.listen(port, () => {
  console.log(`[YouTubeCaptionExtractorService] listening on ${port}`);
});
