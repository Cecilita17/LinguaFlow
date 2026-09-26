/**
 * Transcription Service (Unified Transcription Layer)
 *
 * Provides a clean, isolated entry point for pure audio transcription:
 * AUDIO ORIGINAL -> TRANSCRIPTION LAYER -> CANONICAL RAW TRANSCRIPTION
 *
 * GUARANTEES:
 * - Decoupled from Text Reader paragraphs, alignment, glosses, translations, or DB persistence.
 * - Always returns verbatim text and segments with real absolute timestamps.
 * - Supports both 'groq' (cloud) and 'local' (in-browser WebGPU/WASM) engines.
 */

import { transcribeWithGroq } from './groqWhisperAdapter.js';
import {
  transcribeWithLocalWhisper,
  isLocalWhisperSupported,
  detectLocalBackend,
  preloadLocalWhisperModel
} from './localWhisperAdapter.js';

export {
  isLocalWhisperSupported,
  detectLocalBackend,
  preloadLocalWhisperModel
};

/**
 * Universal transcription function.
 *
 * @param {object} params
 * @param {File|Blob} params.audio - The audio file or blob to transcribe
 * @param {string} [params.language='es'] - Target language code (e.g., 'es', 'zh', 'en')
 * @param {'local'|'groq'} [params.engine='local'] - Transcription engine to use
 * @param {string} [params.apiKey=''] - Optional API key override (for Groq)
 * @param {string} [params.modelId='Xenova/whisper-base'] - Model ID (for Local Whisper)
 * @param {Function} [params.onProgress=null] - Progress callback
 * @param {Function} [params.onModelProgress=null] - Model download progress callback (for Local Whisper)
 * @param {AbortSignal} [params.abortSignal=null] - Cancellation signal
 * @returns {Promise<{
 *   text: string,
 *   segments: Array<{ id: number, start: number, end: number, text: string }>,
 *   duration: number,
 *   language: string,
 *   engine: string,
 *   pathname?: string|null,
 *   url?: string|null,
 *   mimeType?: string,
 *   backend?: string,
 *   metrics?: object
 * }>}
 */
export async function transcribeAudio({
  audio,
  language = 'es',
  engine = 'local',
  apiKey = '',
  modelId = 'Xenova/whisper-base',
  onProgress = null,
  onModelProgress = null,
  abortSignal = null
}) {
  if (!audio) {
    throw new Error('No se especificó ningún archivo o blob de audio para transcribir.');
  }

  const selectedEngine = (engine || 'local').toLowerCase().trim();

  if (selectedEngine === 'groq') {
    return transcribeWithGroq({
      audio,
      language,
      apiKey,
      onProgress,
      abortSignal
    });
  }

  return transcribeWithLocalWhisper({
    audio,
    language,
    modelId,
    onProgress,
    onModelProgress,
    abortSignal
  });
}
