/**
 * Audio Technical Utilities for Transcription
 * Pure Web Audio API operations: decoding, resampling, WAV encoding,
 * Float32Array extraction, and technical chunk planning.
 *
 * Backends:
 * - Groq Whisper API requires standard audio formats (.wav, .mp3, .m4a, etc.).
 *   When chunking, slices are resampled to 16kHz mono and encoded as 16-bit PCM WAV.
 * - Local Transformers.js (@xenova/transformers) requires a 16kHz mono Float32Array tensor.
 */

export const LONG_AUDIO_THRESHOLD_SECONDS = 180; // Audios > 3 minutes use chunking for API limits
export const CHUNK_DURATION_SECONDS = 60;        // 60 seconds per technical chunk
export const CHUNK_OVERLAP_SECONDS = 0;          // 0s overlap for clean, contiguous technical chunks

function writeString(view, offset, string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

/**
 * Decodes any browser-supported audio file (.mp3, .wav, .m4a, .webm, .ogg, etc.) into an AudioBuffer.
 *
 * @param {File|Blob} audioFile
 * @returns {Promise<AudioBuffer>}
 */
export async function decodeAudioFile(audioFile) {
  const arrayBuffer = await audioFile.arrayBuffer();
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) {
    throw new Error('Web Audio API no está disponible en este navegador.');
  }

  const audioCtx = new AudioContextClass();
  try {
    const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
    return audioBuffer;
  } finally {
    audioCtx.close().catch(() => {});
  }
}

/**
 * Slices an AudioBuffer from startSec to endSec, resamples to 16kHz mono, and encodes as 16-bit PCM WAV Blob.
 * Used for preparing audio slices for external REST APIs like Groq Whisper.
 *
 * @param {AudioBuffer} audioBuffer
 * @param {number} startSec
 * @param {number} endSec
 * @param {number} [targetSampleRate=16000]
 * @returns {Promise<Blob>} WAV Blob
 */
export async function encodeAudioSliceToWav(audioBuffer, startSec = 0, endSec = null, targetSampleRate = 16000) {
  const safeStartSec = Math.max(0, startSec);
  const safeEndSec = Math.min(audioBuffer.duration, endSec !== null ? endSec : audioBuffer.duration);
  const sliceDuration = Math.max(0.1, safeEndSec - safeStartSec);

  const startSample = Math.max(0, Math.floor(safeStartSec * audioBuffer.sampleRate));
  const endSample = Math.min(audioBuffer.length, Math.floor(safeEndSec * audioBuffer.sampleRate));
  const numSliceSamples = Math.max(1, endSample - startSample);

  const targetLength = Math.max(1, Math.floor(sliceDuration * targetSampleRate));

  const OfflineContextClass = window.OfflineAudioContext || window.webkitOfflineAudioContext;
  if (!OfflineContextClass) {
    throw new Error('OfflineAudioContext no está disponible en este navegador.');
  }

  // 1. Resample and downmix to 16kHz mono via OfflineAudioContext
  const offlineCtx = new OfflineContextClass(1, targetLength, targetSampleRate);
  const tempBuffer = offlineCtx.createBuffer(
    audioBuffer.numberOfChannels,
    numSliceSamples,
    audioBuffer.sampleRate
  );

  for (let ch = 0; ch < audioBuffer.numberOfChannels; ch++) {
    const chData = audioBuffer.getChannelData(ch).subarray(startSample, endSample);
    tempBuffer.copyToChannel(chData, ch);
  }

  const source = offlineCtx.createBufferSource();
  source.buffer = tempBuffer;
  source.connect(offlineCtx.destination);
  source.start(0);

  const renderedBuffer = await offlineCtx.startRendering();
  const channelData = renderedBuffer.getChannelData(0);
  const numSamples = channelData.length;

  // 2. Encode 16-bit PCM WAV
  const wavBuffer = new ArrayBuffer(44 + numSamples * 2);
  const view = new DataView(wavBuffer);

  // RIFF Header
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + numSamples * 2, true);
  writeString(view, 8, 'WAVE');

  // "fmt " Subchunk
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true); // Subchunk1Size = 16 for PCM
  view.setUint16(20, 1, true); // AudioFormat = 1 (PCM)
  view.setUint16(22, 1, true); // NumChannels = 1 (Mono)
  view.setUint32(24, targetSampleRate, true); // SampleRate (16000)
  view.setUint32(28, targetSampleRate * 2, true); // ByteRate = SampleRate * NumChannels * 2
  view.setUint16(32, 2, true); // BlockAlign = NumChannels * 2
  view.setUint16(34, 16, true); // BitsPerSample = 16

  // "data" Subchunk
  writeString(view, 36, 'data');
  view.setUint32(40, numSamples * 2, true);

  // Write PCM Samples
  let offset = 44;
  for (let i = 0; i < numSamples; i++) {
    const s = Math.max(-1, Math.min(1, channelData[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
    offset += 2;
  }

  return new Blob([wavBuffer], { type: 'audio/wav' });
}

/**
 * Extracts and resamples an audio slice directly into a 16kHz mono Float32Array tensor.
 * Used for in-browser client-side inference with local Whisper Web Workers (@xenova/transformers).
 *
 * @param {AudioBuffer} audioBuffer
 * @param {number} startSec
 * @param {number} endSec
 * @param {number} [targetSampleRate=16000]
 * @returns {Promise<Float32Array>} 16kHz mono Float32 tensor
 */
export async function extractAudioSliceFloat32(audioBuffer, startSec = 0, endSec = null, targetSampleRate = 16000) {
  const safeStartSec = Math.max(0, startSec);
  const safeEndSec = Math.min(audioBuffer.duration, endSec !== null ? endSec : audioBuffer.duration);
  const sliceDuration = Math.max(0.1, safeEndSec - safeStartSec);

  const startSample = Math.max(0, Math.floor(safeStartSec * audioBuffer.sampleRate));
  const endSample = Math.min(audioBuffer.length, Math.floor(safeEndSec * audioBuffer.sampleRate));
  const numSliceSamples = Math.max(1, endSample - startSample);

  const targetLength = Math.max(1, Math.floor(sliceDuration * targetSampleRate));

  const OfflineContextClass = window.OfflineAudioContext || window.webkitOfflineAudioContext;
  if (!OfflineContextClass) {
    throw new Error('OfflineAudioContext no está disponible en este navegador.');
  }

  const offlineCtx = new OfflineContextClass(1, targetLength, targetSampleRate);
  const tempBuffer = offlineCtx.createBuffer(
    audioBuffer.numberOfChannels,
    numSliceSamples,
    audioBuffer.sampleRate
  );

  for (let ch = 0; ch < audioBuffer.numberOfChannels; ch++) {
    const chData = audioBuffer.getChannelData(ch).subarray(startSample, endSample);
    tempBuffer.copyToChannel(chData, ch);
  }

  const source = offlineCtx.createBufferSource();
  source.buffer = tempBuffer;
  source.connect(offlineCtx.destination);
  source.start(0);

  const renderedBuffer = await offlineCtx.startRendering();
  return renderedBuffer.getChannelData(0);
}

/**
 * Plans technical contiguous chunk boundaries for an audio file to satisfy API limits.
 *
 * @param {AudioBuffer} audioBuffer
 * @param {object} [options]
 * @param {number} [options.chunkDurationSec=CHUNK_DURATION_SECONDS]
 * @param {number} [options.overlapSec=CHUNK_OVERLAP_SECONDS]
 * @param {number} [options.minDurationForChunking=LONG_AUDIO_THRESHOLD_SECONDS]
 * @returns {{ shouldChunk: boolean, totalDuration: number, chunks: Array<{ index: number, startSec: number, endSec: number, offsetSec: number, duration: number }> }}
 */
export function planAudioChunks(audioBuffer, {
  chunkDurationSec = CHUNK_DURATION_SECONDS,
  overlapSec = CHUNK_OVERLAP_SECONDS,
  minDurationForChunking = LONG_AUDIO_THRESHOLD_SECONDS
} = {}) {
  const totalDuration = audioBuffer.duration;

  if (totalDuration <= minDurationForChunking) {
    return {
      shouldChunk: false,
      totalDuration,
      chunks: []
    };
  }

  const step = Math.max(10, chunkDurationSec - overlapSec);
  const chunks = [];
  let start = 0;
  let chunkIdx = 0;

  while (start < totalDuration) {
    const end = Math.min(totalDuration, start + chunkDurationSec);
    chunks.push({
      index: chunkIdx,
      startSec: Math.round(start * 100) / 100,
      endSec: Math.round(end * 100) / 100,
      offsetSec: Math.round(start * 100) / 100,
      duration: Math.round((end - start) * 100) / 100
    });
    chunkIdx++;
    if (end >= totalDuration) break;
    start += step;
  }

  return {
    shouldChunk: true,
    totalDuration,
    chunks
  };
}
