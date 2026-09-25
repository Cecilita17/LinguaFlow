/**
 * Local Whisper Web Worker
 * Uses @xenova/transformers in an isolated Web Worker thread for in-browser,
 * free, zero-server audio transcription using quantized multilingual Whisper.
 */

import { pipeline, env } from '@xenova/transformers';

// Configure environment for in-browser worker execution
env.allowLocalModels = false;
env.useBrowserCache = true;

// Default multilingual model (base quantized: ~73MB)
const DEFAULT_MODEL_ID = 'Xenova/whisper-base';

let transcriber = null;
let currentModelId = DEFAULT_MODEL_ID;
let isInitializing = false;

/**
 * Initializes or retrieves the singleton ASR pipeline.
 */
async function getTranscriber(modelId = DEFAULT_MODEL_ID, onProgress = null) {
  if (transcriber && currentModelId === modelId) {
    return transcriber;
  }

  isInitializing = true;
  currentModelId = modelId;

  try {
    transcriber = await pipeline('automatic-speech-recognition', modelId, {
      quantized: true,
      progress_callback: (prog) => {
        if (typeof onProgress === 'function') {
          onProgress(prog);
        }
      }
    });
    isInitializing = false;
    return transcriber;
  } catch (err) {
    isInitializing = false;
    transcriber = null;
    throw err;
  }
}

// Map common app language codes to Whisper language names/codes
const WHISPER_LANG_MAP = {
  zh: 'chinese',
  ru: 'russian',
  es: 'spanish',
  en: 'english',
  fr: 'french',
  de: 'german',
  it: 'italian',
  pt: 'portuguese',
  ja: 'japanese',
  ko: 'korean',
  ar: 'arabic',
  hi: 'hindi',
  tr: 'turkish',
  pl: 'polish',
  nl: 'dutch',
  sv: 'swedish',
  el: 'greek',
  uk: 'ukrainian',
  vi: 'vietnamese',
  th: 'thai',
  id: 'indonesian',
  he: 'hebrew',
  fa: 'persian'
};

self.addEventListener('message', async (event) => {
  const { type, payload, id } = event.data || {};

  if (type === 'INIT_MODEL') {
    const modelId = payload?.modelId || DEFAULT_MODEL_ID;
    try {
      self.postMessage({
        type: 'MODEL_STATUS',
        id,
        status: 'loading',
        message: 'Iniciando carga de modelo Whisper local...'
      });

      await getTranscriber(modelId, (progress) => {
        self.postMessage({
          type: 'MODEL_PROGRESS',
          id,
          progress
        });
      });

      self.postMessage({
        type: 'MODEL_STATUS',
        id,
        status: 'ready',
        message: 'Modelo Whisper local listo.'
      });
    } catch (err) {
      console.error('[LocalWhisperWorker] Error cargando modelo:', err);
      self.postMessage({
        type: 'MODEL_ERROR',
        id,
        error: err.message || 'Error al cargar el modelo Whisper local.'
      });
    }
    return;
  }

  if (type === 'TRANSCRIBE_CHUNK') {
    const {
      audioData,
      language,
      modelId = DEFAULT_MODEL_ID,
      chunkIndex = 0,
      totalChunks = 1,
      offsetSec = 0
    } = payload || {};

    try {
      const pipe = await getTranscriber(modelId, (progress) => {
        self.postMessage({
          type: 'MODEL_PROGRESS',
          id,
          progress
        });
      });

      const whisperLang = WHISPER_LANG_MAP[language] || language || null;

      self.postMessage({
        type: 'CHUNK_PROGRESS',
        id,
        chunkIndex,
        totalChunks,
        status: 'transcribing',
        message: `Procesando fragmento ${chunkIndex + 1} de ${totalChunks}...`
      });

      // Execute local Whisper transcription
      const options = {
        task: 'transcribe', // MUST BE transcribe, NEVER translate (preserves original language)
        return_timestamps: true,
        chunk_length_s: 30,
        stride_length_s: 5
      };

      if (whisperLang) {
        options.language = whisperLang;
      }

      const result = await pipe(audioData, options);

      // Normalize output segments
      const rawChunks = Array.isArray(result?.chunks) ? result.chunks : [];
      const segments = rawChunks.map((c, idx) => {
        const start = Array.isArray(c.timestamp) && typeof c.timestamp[0] === 'number'
          ? c.timestamp[0]
          : 0;
        const end = Array.isArray(c.timestamp) && typeof c.timestamp[1] === 'number'
          ? c.timestamp[1]
          : (start + 2.0);

        return {
          id: idx,
          start: Math.round(start * 100) / 100,
          end: Math.round(end * 100) / 100,
          text: (c.text || '').trim()
        };
      }).filter(s => Boolean(s.text));

      self.postMessage({
        type: 'CHUNK_SUCCESS',
        id,
        chunkIndex,
        totalChunks,
        offsetSec,
        transcript: (result?.text || '').trim(),
        segments
      });
    } catch (err) {
      console.error(`[LocalWhisperWorker] Error en fragmento ${chunkIndex + 1}:`, err);
      self.postMessage({
        type: 'CHUNK_ERROR',
        id,
        chunkIndex,
        error: err.message || `Error al procesar fragmento ${chunkIndex + 1}`
      });
    }
  }
});
