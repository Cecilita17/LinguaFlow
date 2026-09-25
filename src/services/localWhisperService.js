/**
 * Local Whisper Service
 * Orchestrates client-side in-browser transcription using WebAssembly/WebGPU,
 * Web Audio API decoding, unified single-pass windowing, and timestamp alignment.
 */

import {
  decodeAudioFile,
  extractAudioSliceFloat32
} from './audioChunkingService.js';

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
      new URL('../workers/localWhisperWorker.js', import.meta.url),
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
 * @param {File|Blob} params.audioFile
 * @param {string} [params.targetLang='zh']
 * @param {string} [params.modelId='Xenova/whisper-base']
 * @param {function} [params.onProgress]
 * @param {function} [params.onModelProgress]
 * @param {AbortSignal} [params.abortSignal]
 * @returns {Promise<{ success: boolean, transcript: string, segments: Array, duration: number, source: string, backend: string, metrics: object, audioBlob: Blob, mimeType: string }>}
 */
export async function transcribeAudioFileLocal({
  audioFile,
  targetLang = 'zh',
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

  console.log('[LocalWhisper] Starting unified local in-browser transcription:', {
    name: audioFile.name,
    size: audioFile.size,
    type: audioFile.type,
    targetLang,
    modelId,
    detectedBackend
  });

  if (typeof onProgress === 'function') {
    onProgress('Decodificando audio en el navegador...');
  }

  // 1. Decode audio in browser Web Audio API
  let decodedBuffer;
  try {
    decodedBuffer = await decodeAudioFile(audioFile);
  } catch (decErr) {
    console.error('[LocalWhisper] Error decoding audio file:', decErr);
    throw new Error(`No se pudo decodificar el formato de audio: ${decErr.message || 'Formato no soportado'}`);
  }

  const totalDuration = decodedBuffer.duration;
  console.log(`[LocalWhisper] Audio decoded: ${totalDuration.toFixed(2)}s, SampleRate: ${decodedBuffer.sampleRate}Hz, Backend: ${detectedBackend}`);

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

    // Post to worker (transfer Float32Array buffer for 0-copy efficiency)
    worker.postMessage({
      type: 'TRANSCRIBE_AUDIO',
      id: reqId,
      payload: {
        audioData: float32Data,
        language: targetLang,
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

  const finalBackend = result.backend || detectedBackend;
  const metrics = result.metrics || {};

  // Log official benchmark telemetry
  console.log(
    `%c================ [LinguaFlow Whisper Local Benchmark] ================\n` +
    `Audio:              ${(metrics.audioDuration || totalDuration).toFixed(2)} s (${((metrics.audioDuration || totalDuration) / 60).toFixed(1)} min)\n` +
    `Backend:            ${finalBackend}\n` +
    `Modelo:             ${metrics.modelId || modelId}\n` +
    `Carga modelo:       ${(metrics.modelLoadTimeSec || 0).toFixed(2)} s\n` +
    `Inferencia total:   ${(metrics.inferenceTimeSec || 0).toFixed(2)} s\n` +
    `RTF:                ${(metrics.rtf || 0).toFixed(3)} (${metrics.rtf > 0 ? (1 / metrics.rtf).toFixed(1) : 'N/A'}x)\n` +
    `Chunks (ventanas):  ${metrics.totalChunks || 1}\n` +
    `Tiempo medio/chunk: ${(metrics.avgChunkTimeSec || 0).toFixed(2)} s\n` +
    `Segmentos finales:  ${result.segments.length}\n` +
    `======================================================================`,
    'color: #10b981; font-weight: bold;'
  );

  return {
    success: true,
    transcript: finalTranscript,
    segments: result.segments,
    duration: Math.round(totalDuration * 100) / 100,
    source: `local (Whisper ${finalBackend})`,
    backend: finalBackend,
    metrics,
    audioBlob: audioFile,
    mimeType: audioFile.type || 'audio/webm'
  };
}
