/**
 * Local Whisper Adapter
 * Orchestrates client-side in-browser transcription using WebAssembly/WebGPU,
 * Web Audio API decoding, Float32Array tensor preparation, and the Web Worker.
 *
 * GUARANTEES:
 * - Returns the canonical transcription structure without modifying or filtering Whisper's words.
 * - Encapsulates the Web Worker lifecycle and progress reporting.
 */

import {
  decodeAudioFile,
  extractAudioSliceFloat32
} from './audioUtils.js';

let workerInstance = null;
let currentRequestId = 0;

/**
 * Checks whether the current browser environment supports in-browser WebAssembly/WebGPU transcription.
 */
export function isLocalWhisperSupported() {
  const hasWorker = typeof window !== 'undefined' && typeof window.Worker !== 'undefined';
  const hasAudioContext = typeof window !== 'undefined' && (Boolean(window.AudioContext) || Boolean(window.webkitAudioContext));
  const hasOfflineAudioContext = typeof window !== 'undefined' && (Boolean(window.OfflineAudioContext) || Boolean(window.webkitOfflineAudioContext));
  return hasWorker && hasAudioContext && hasOfflineAudioContext;
}

/**
 * Detects whether the local environment supports WebGPU.
 */
export async function detectLocalBackend() {
  if (typeof navigator !== 'undefined' && 'gpu' in navigator && Boolean(navigator.gpu)) {
    try {
      const adapter = await navigator.gpu.requestAdapter();
      if (adapter) {
        return 'WebGPU';
      }
    } catch (e) {}
  }
  return 'CPU';
}

/**
 * Returns or instantiates the singleton Web Worker.
 */
function getOrCreateWorker() {
  if (!workerInstance) {
    workerInstance = new Worker(
      new URL('../../workers/localWhisperWorker.js', import.meta.url),
      { type: 'module' }
    );
  }
  return workerInstance;
}

/**
 * Preloads the local Whisper model in the background.
 */
export function preloadLocalWhisperModel(modelId = 'Xenova/whisper-base', onProgress = null) {
  if (!isLocalWhisperSupported()) return Promise.reject(new Error('Whisper local no es compatible con este navegador.'));

  const worker = getOrCreateWorker();
  const reqId = ++currentRequestId;

  return new Promise((resolve, reject) => {
    const handler = (event) => {
      const { type, id, status, progress, error, message, backend, loadTimeMs } = event.data || {};
      if (id !== reqId) return;

      if (type === 'MODEL_PROGRESS' && typeof onProgress === 'function') {
        onProgress(progress);
      } else if (type === 'MODEL_STATUS' && status === 'ready') {
        worker.removeEventListener('message', handler);
        resolve({ success: true, message, backend, loadTimeMs });
      } else if (type === 'MODEL_ERROR') {
        worker.removeEventListener('message', handler);
        reject(new Error(error || 'Error al pre-cargar el modelo local.'));
      }
    };

    worker.addEventListener('message', handler);
    worker.postMessage({
      type: 'INIT_MODEL',
      id: reqId,
      payload: { modelId }
    });
  });
}

/**
 * Transcribes an audio file completely in the browser using the local Whisper Web Worker.
 *
 * @param {object} params
 * @param {File|Blob} params.audio - Audio file or blob
 * @param {string} [params.language='es'] - Target language
 * @param {string} [params.modelId='Xenova/whisper-base'] - HuggingFace model identifier
 * @param {function} [params.onProgress] - Transcription progress callback
 * @param {function} [params.onModelProgress] - Model download progress callback
 * @param {AbortSignal} [params.abortSignal] - Abort signal for cancellation
 * @returns {Promise<{ text: string, segments: Array<{ id: number, start: number, end: number, text: string }>, duration: number, language: string, engine: string, backend: string, metrics: object, audioBlob: Blob, mimeType: string }>}
 */
export async function transcribeWithLocalWhisper({
  audio,
  language = 'es',
  modelId = 'Xenova/whisper-base',
  onProgress = null,
  onModelProgress = null,
  abortSignal = null
}) {
  if (!isLocalWhisperSupported()) {
    throw new Error('Tu navegador no cuenta con soporte para Web Audio API o Web Workers requeridos para la transcripción local.');
  }

  if (abortSignal?.aborted) {
    throw new Error('Transcripción cancelada por el usuario.');
  }

  const detectedBackend = await detectLocalBackend();

  if (typeof onProgress === 'function') {
    onProgress('Decodificando audio en el navegador...');
  }

  // 1. Decode audio in browser Web Audio API
  let decodedBuffer;
  try {
    decodedBuffer = await decodeAudioFile(audio);
  } catch (decErr) {
    throw new Error(`No se pudo decodificar el formato de audio: ${decErr.message || 'Formato no soportado'}`);
  }

  const totalDuration = decodedBuffer.duration;

  if (abortSignal?.aborted) {
    throw new Error('Transcripción cancelada por el usuario.');
  }

  if (typeof onProgress === 'function') {
    onProgress('Preparando tensores de audio a 16 kHz...');
  }

  // 2. Extract 16kHz mono Float32Array for full audio duration
  const float32Data = await extractAudioSliceFloat32(
    decodedBuffer,
    0,
    totalDuration,
    16000
  );

  if (abortSignal?.aborted) {
    throw new Error('Transcripción cancelada por el usuario.');
  }

  const worker = getOrCreateWorker();
  const reqId = ++currentRequestId;

  // 3. Execute single-pass transcription in Web Worker
  const result = await new Promise((resolve, reject) => {
    let aborted = false;

    const abortHandler = () => {
      aborted = true;
      worker.removeEventListener('message', messageHandler);
      reject(new Error('Transcripción cancelada por el usuario.'));
    };

    if (abortSignal) {
      abortSignal.addEventListener('abort', abortHandler, { once: true });
    }

    const messageHandler = (event) => {
      if (aborted) return;
      const { type, id, transcript, segments, progress, error, backend, metrics, message, progressPercent, chunkIndex, totalChunks } = event.data || {};
      if (id !== reqId) return;

      if (type === 'MODEL_PROGRESS') {
        if (typeof onModelProgress === 'function') {
          onModelProgress(progress);
        }
        if (typeof onProgress === 'function' && progress?.status === 'progress' && progress?.total) {
          const pct = Math.round((progress.loaded / progress.total) * 100) || 0;
          onProgress(`Descargando modelo Whisper (${pct}%)...`);
        }
      } else if (type === 'CHUNK_PROGRESS') {
        if (typeof onProgress === 'function') {
          onProgress(message || `Transcribiendo audio (${progressPercent || 0}%)...`, {
            chunkIndex,
            totalChunks,
            progressPercent,
            backend
          });
        }
      } else if (type === 'CHUNK_SUCCESS') {
        if (abortSignal) {
          abortSignal.removeEventListener('abort', abortHandler);
        }
        worker.removeEventListener('message', messageHandler);
        resolve({
          transcript: transcript || '',
          segments: segments || [],
          backend: backend || detectedBackend,
          metrics: metrics || null
        });
      } else if (type === 'CHUNK_ERROR' || type === 'MODEL_ERROR') {
        if (abortSignal) {
          abortSignal.removeEventListener('abort', abortHandler);
        }
        worker.removeEventListener('message', messageHandler);
        reject(new Error(error || 'Error durante la transcripción de audio.'));
      }
    };

    worker.addEventListener('message', messageHandler);

    worker.postMessage({
      type: 'TRANSCRIBE_AUDIO',
      id: reqId,
      payload: {
        audioData: float32Data,
        language,
        modelId,
        audioDuration: totalDuration,
        chunkIndex: 0,
        totalChunks: 1,
        offsetSec: 0
      }
    }, [float32Data.buffer]);
  });

  const finalTranscript = (result.transcript || '').trim();
  if (!finalTranscript) {
    throw new Error('No se detectó contenido de voz en el archivo de audio.');
  }

  const normalizedSegments = (Array.isArray(result.segments) ? result.segments : []).map((seg, idx) => ({
    id: typeof seg.id === 'number' ? seg.id : idx,
    start: typeof seg.start === 'number' ? Math.round(seg.start * 100) / 100 : 0,
    end: typeof seg.end === 'number' ? Math.round(Math.max(seg.start || 0, seg.end) * 100) / 100 : 0,
    text: (seg.text || '').trim()
  })).filter(s => Boolean(s.text));

  return {
    text: finalTranscript,
    segments: normalizedSegments,
    duration: Math.round(totalDuration * 100) / 100,
    language,
    engine: 'local',
    backend: result.backend || detectedBackend,
    metrics: result.metrics || null,
    audioBlob: audio,
    mimeType: audio.type || 'audio/webm'
  };
}
