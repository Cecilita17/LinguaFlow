/**
 * Local Whisper Service
 * Orchestrates client-side in-browser transcription using WebAssembly / Web Worker,
 * Web Audio API decoding, audio chunking, and timestamp deduplication.
 */

import {
  decodeAudioFile,
  extractAudioSliceFloat32,
  planAudioChunks,
  mergeChunkSegments,
  LONG_AUDIO_THRESHOLD_SECONDS,
  CHUNK_DURATION_SECONDS,
  CHUNK_OVERLAP_SECONDS
} from './audioChunkingService.js';

let workerInstance = null;
let currentRequestId = 0;

/**
 * Checks whether the current browser environment supports in-browser WebAssembly transcription.
 */
export function isLocalWhisperSupported() {
  const hasWorker = typeof window !== 'undefined' && typeof window.Worker !== 'undefined';
  const hasAudioContext = typeof window !== 'undefined' && (Boolean(window.AudioContext) || Boolean(window.webkitAudioContext));
  const hasOfflineAudioContext = typeof window !== 'undefined' && (Boolean(window.OfflineAudioContext) || Boolean(window.webkitOfflineAudioContext));
  return hasWorker && hasAudioContext && hasOfflineAudioContext;
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
  if (!isLocalWhisperSupported()) return Promise.reject(new Error('WebAssembly Whisper no es compatible con este navegador.'));

  const worker = getOrCreateWorker();
  const reqId = ++currentRequestId;

  return new Promise((resolve, reject) => {
    const handler = (event) => {
      const { type, id, status, progress, error, message } = event.data || {};
      if (id !== reqId) return;

      if (type === 'MODEL_PROGRESS' && typeof onProgress === 'function') {
        onProgress(progress);
      } else if (type === 'MODEL_STATUS' && status === 'ready') {
        worker.removeEventListener('message', handler);
        resolve({ success: true, message });
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
 * @returns {Promise<{ success: boolean, transcript: string, segments: Array, duration: number, source: string, audioBlob: Blob, mimeType: string }>}
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
    throw new Error('Tu navegador no cuenta con soporte completo para Web Audio API o Web Workers requeridos para la transcripción local.');
  }

  if (abortSignal?.aborted) {
    throw new Error('Transcripción cancelada por el usuario.');
  }

  console.log('[LocalWhisper] Starting local in-browser transcription for file:', {
    name: audioFile.name,
    size: audioFile.size,
    type: audioFile.type,
    targetLang,
    modelId
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
  console.log(`[LocalWhisper] Audio decoded successfully. Duration: ${totalDuration.toFixed(2)}s, SampleRate: ${decodedBuffer.sampleRate}Hz`);

  if (abortSignal?.aborted) {
    throw new Error('Transcripción cancelada por el usuario.');
  }

  // 2. Plan audio chunks (if > 180s, chunk into 210s with 12s overlap)
  const chunkPlan = planAudioChunks(decodedBuffer, {
    chunkDurationSec: CHUNK_DURATION_SECONDS,
    overlapSec: CHUNK_OVERLAP_SECONDS,
    minDurationForChunking: LONG_AUDIO_THRESHOLD_SECONDS
  });

  const worker = getOrCreateWorker();
  const chunksToProcess = chunkPlan.shouldChunk && chunkPlan.chunks.length > 0
    ? chunkPlan.chunks
    : [{ index: 0, startSec: 0, endSec: totalDuration, offsetSec: 0, duration: totalDuration }];

  const totalChunks = chunksToProcess.length;
  console.log(`[LocalWhisper] Processing plan: ${totalChunks} chunk(s), shouldChunk: ${chunkPlan.shouldChunk}`);

  const chunkResults = [];

  for (let i = 0; i < totalChunks; i++) {
    if (abortSignal?.aborted) {
      throw new Error('Transcripción cancelada por el usuario.');
    }

    const chunk = chunksToProcess[i];
    const chunkPercent = Math.round((i / totalChunks) * 100);

    if (typeof onProgress === 'function') {
      if (totalChunks > 1) {
        onProgress(`Transcribiendo localmente: fragmento ${i + 1} de ${totalChunks} (${chunkPercent}%)...`);
      } else {
        onProgress('Transcribiendo localmente con Whisper...');
      }
    }

    // Extract 16kHz mono Float32Array slice
    const float32Data = await extractAudioSliceFloat32(
      decodedBuffer,
      chunk.startSec,
      chunk.endSec,
      16000
    );

    const reqId = ++currentRequestId;

    const chunkPromise = new Promise((resolve, reject) => {
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
        const { type, id, chunkIndex, transcript, segments, progress, error } = event.data || {};
        if (id !== reqId) return;

        if (type === 'MODEL_PROGRESS') {
          if (typeof onModelProgress === 'function') {
            onModelProgress(progress);
          }
          if (typeof onProgress === 'function' && progress?.status === 'progress') {
            const pct = Math.round((progress.loaded / progress.total) * 100) || 0;
            onProgress(`Descargando modelo Whisper local (${pct}%)...`);
          }
        } else if (type === 'CHUNK_PROGRESS') {
          if (typeof onProgress === 'function' && totalChunks > 1) {
            onProgress(`Transcribiendo localmente: fragmento ${i + 1} de ${totalChunks}...`);
          }
        } else if (type === 'CHUNK_SUCCESS') {
          if (abortSignal) {
            abortSignal.removeEventListener('abort', abortHandler);
          }
          worker.removeEventListener('message', messageHandler);
          resolve({
            chunk,
            transcript: transcript || '',
            segments: segments || []
          });
        } else if (type === 'CHUNK_ERROR' || type === 'MODEL_ERROR') {
          if (abortSignal) {
            abortSignal.removeEventListener('abort', abortHandler);
          }
          worker.removeEventListener('message', messageHandler);
          reject(new Error(error || `Error en el fragmento ${chunkIndex + 1}`));
        }
      };

      worker.addEventListener('message', messageHandler);

      worker.postMessage({
        type: 'TRANSCRIBE_CHUNK',
        id: reqId,
        payload: {
          audioData: float32Data,
          language: targetLang,
          modelId,
          chunkIndex: i,
          totalChunks,
          offsetSec: chunk.offsetSec
        }
      });
    });

    const chunkResult = await chunkPromise;
    chunkResults.push(chunkResult);
  }

  if (typeof onProgress === 'function') {
    onProgress('Sincronizando segmentos y deduplicando texto...');
  }

  // 3. Merge segments across overlapping chunks with timestamp deduplication
  const { combinedSegments, combinedTranscript } = mergeChunkSegments(chunkResults, CHUNK_OVERLAP_SECONDS);

  if (!combinedTranscript) {
    throw new Error('No se detectó contenido de voz en el archivo de audio.');
  }

  console.log('[LocalWhisper] Local transcription completed successfully:', {
    totalSegments: combinedSegments.length,
    firstSegment: combinedSegments[0],
    lastSegment: combinedSegments[combinedSegments.length - 1],
    transcriptLength: combinedTranscript.length
  });

  return {
    success: true,
    transcript: combinedTranscript,
    segments: combinedSegments,
    duration: Math.round(totalDuration * 100) / 100,
    source: `local (Whisper WASM)`,
    audioBlob: audioFile,
    mimeType: audioFile.type || 'audio/webm'
  };
}
