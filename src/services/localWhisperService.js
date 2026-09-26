/**
 * Local Whisper Service (Compatibility Wrapper)
 * Delegates directly to the isolated transcription module (src/services/transcription/localWhisperAdapter.js).
 */

import {
  isLocalWhisperSupported,
  detectLocalBackend,
  preloadLocalWhisperModel,
  transcribeWithLocalWhisper
} from './transcription/localWhisperAdapter.js';

export {
  isLocalWhisperSupported,
  detectLocalBackend,
  preloadLocalWhisperModel
};

/**
 * Backward compatibility wrapper for local in-browser transcription.
 */
export async function transcribeAudioFileLocal({
  audioFile,
  targetLang = 'zh',
  modelId = 'Xenova/whisper-base',
  onProgress = null,
  onModelProgress = null,
  abortSignal = null
}) {
  const result = await transcribeWithLocalWhisper({
    audio: audioFile,
    language: targetLang,
    modelId,
    onProgress,
    onModelProgress,
    abortSignal
  });

  return {
    success: true,
    transcript: result.text,
    segments: result.segments,
    duration: result.duration,
    source: 'local-whisper',
    backend: result.backend,
    metrics: result.metrics,
    audioBlob: result.audioBlob,
    mimeType: result.mimeType
  };
}
