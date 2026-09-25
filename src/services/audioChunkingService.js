/**
 * Audio Chunking Service
 * Provides client-side Web Audio API decoding, slicing, 16kHz mono WAV encoding,
 * robust 60s/8s chunking for Groq Whisper, and non-destructive timestamp merge.
 */

export const LONG_AUDIO_THRESHOLD_SECONDS = 180; // Audios > 3 minutes use chunking
export const CHUNK_DURATION_SECONDS = 60;        // 60 seconds per chunk for high completeness
export const CHUNK_OVERLAP_SECONDS = 8;          // 8 seconds overlap between chunks

function writeString(view, offset, string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

/**
 * Normalizes text for similarity and duplicate comparison across languages.
 */
export function normalizeTextForDeduplication(str) {
  if (!str || typeof str !== 'string') return '';
  return str
    .toLowerCase()
    .replace(/[\p{P}\p{S}\s]+/gu, '')
    .trim();
}

/**
 * Calculates Levenshtein similarity between two strings (0.0 to 1.0).
 */
export function calculateTextSimilarity(str1, str2) {
  const s1 = normalizeTextForDeduplication(str1);
  const s2 = normalizeTextForDeduplication(str2);
  if (!s1 && !s2) return 1.0;
  if (!s1 || !s2) return 0.0;
  if (s1 === s2) return 1.0;
  if (s1.includes(s2) || s2.includes(s1)) {
    return Math.min(s1.length, s2.length) / Math.max(s1.length, s2.length);
  }

  const len1 = s1.length;
  const len2 = s2.length;
  if (Math.abs(len1 - len2) > Math.max(len1, len2) * 0.6) return 0.0;

  const dp = Array.from({ length: len1 + 1 }, () => new Uint16Array(len2 + 1));
  for (let i = 0; i <= len1; i++) dp[i][0] = i;
  for (let j = 0; j <= len2; j++) dp[0][j] = j;

  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      );
    }
  }

  const distance = dp[len1][len2];
  const maxLen = Math.max(len1, len2);
  return Math.max(0, 1 - distance / maxLen);
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
 * Slices an AudioBuffer from startSec to endSec, resamples to 16kHz mono, and encodes as 16-bit PCM WAV.
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
 * Plans chunk boundary splits for an audio file.
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

/**
 * Validates temporal coverage of merged segments and reports significant gaps or trailing omissions.
 *
 * @param {Array<object>} segments
 * @param {number|null} [audioDuration=null]
 * @returns {object} Diagnostic coverage report
 */
export function validateTemporalCoverage(segments, audioDuration = null) {
  if (!Array.isArray(segments) || segments.length === 0) {
    return {
      firstStart: 0,
      lastEnd: 0,
      audioDuration: audioDuration || 0,
      coveragePercent: 0,
      gapsCount: 0,
      gaps: []
    };
  }

  const gaps = [];
  const GAP_THRESHOLD_SECONDS = 10.0; // Gaps >= 10s logged as warning

  for (let i = 1; i < segments.length; i++) {
    const prev = segments[i - 1];
    const curr = segments[i];
    const gapDuration = curr.start - prev.end;

    if (gapDuration >= GAP_THRESHOLD_SECONDS) {
      gaps.push({
        fromIndex: i - 1,
        toIndex: i,
        prevEnd: prev.end,
        currStart: curr.start,
        gapSeconds: Math.round(gapDuration * 100) / 100,
        prevSnippet: prev.text.slice(-25),
        currSnippet: curr.text.slice(0, 25)
      });
    }
  }

  const firstStart = segments[0]?.start ?? 0;
  const lastEnd = segments[segments.length - 1]?.end ?? 0;
  const effectiveDuration = (typeof audioDuration === 'number' && audioDuration > 0) ? audioDuration : lastEnd;
  const coveragePercent = effectiveDuration > 0
    ? Math.min(100, Math.round((lastEnd / effectiveDuration) * 100))
    : 100;

  if (gaps.length > 0) {
    console.warn(`[AudioDiagnostics] ⚠️ Detected ${gaps.length} suspicious temporal gap(s) > ${GAP_THRESHOLD_SECONDS}s:`, gaps);
  }

  if (typeof audioDuration === 'number' && audioDuration > 30) {
    const trailingGap = audioDuration - lastEnd;
    if (trailingGap > 15.0) {
      console.warn(`[AudioDiagnostics] ⚠️ Trailing omission warning: Audio is ${audioDuration.toFixed(2)}s, but last segment ends at ${lastEnd.toFixed(2)}s (trailing gap: ${trailingGap.toFixed(2)}s).`);
    }
  }

  const diagnostics = {
    firstStart,
    lastEnd,
    audioDuration: effectiveDuration,
    coveragePercent,
    gapsCount: gaps.length,
    gaps
  };

  console.log('[AudioDiagnostics] Coverage validation report:', diagnostics);
  return diagnostics;
}

/**
 * Merges and deduplicates segments across overlapping audio chunks with absolute timestamps.
 * 
 * CORE PRINCIPLES:
 * 1. Convert all segments in every chunk to ABSOLUTE timestamps (start + offsetSec, end + offsetSec).
 * 2. NUNCA eliminar un segmento simplemente porque no encontró un match.
 * 3. Sólo unificar/deduplicar cuando haya evidencia clara de solapamiento temporal y similitud textual.
 * 4. Si no hay match claro, CONSERVAR AMBOS SEGMENTOS.
 * 5. Ordenar todos los segmentos resultantes cronológicamente por start.
 * 6. Validar cobertura temporal para detectar gaps.
 *
 * @param {Array<{ chunk: object, segments: Array }>} chunkResults
 * @param {number} [overlapSec=CHUNK_OVERLAP_SECONDS]
 * @param {number|null} [totalAudioDuration=null]
 * @returns {{ combinedSegments: Array, combinedTranscript: string, diagnostics: object }}
 */
export function mergeChunkSegments(chunkResults, overlapSec = CHUNK_OVERLAP_SECONDS, totalAudioDuration = null) {
  if (!Array.isArray(chunkResults) || chunkResults.length === 0) {
    return { combinedSegments: [], combinedTranscript: '', diagnostics: null };
  }

  let totalRawSegmentsCount = 0;
  let fallbackSegmentsCount = 0;

  // 1. Convert all segments from all chunks to absolute timestamps
  const allAbsoluteSegments = [];

  for (let cIdx = 0; cIdx < chunkResults.length; cIdx++) {
    const cr = chunkResults[cIdx];
    const offset = cr.chunk?.offsetSec || 0;
    const rawSegs = Array.isArray(cr.segments) ? cr.segments : [];
    totalRawSegmentsCount += rawSegs.length;

    console.log(`[AudioDiagnostics] Chunk ${cIdx + 1}/${chunkResults.length} raw input:`, {
      chunkIndex: cr.chunk?.index ?? cIdx,
      offsetSec: offset,
      durationSec: cr.chunk?.duration,
      segmentsCount: rawSegs.length,
      hasFallbackSegment: rawSegs.some(s => s?.isFallback),
      firstSegment: rawSegs[0] ? { start: rawSegs[0].start, end: rawSegs[0].end, absStart: rawSegs[0].start + offset, text: rawSegs[0].text } : null,
      lastSegment: rawSegs[rawSegs.length - 1] ? { start: rawSegs[rawSegs.length - 1].start, end: rawSegs[rawSegs.length - 1].end, absEnd: rawSegs[rawSegs.length - 1].end + offset, text: rawSegs[rawSegs.length - 1].text } : null
    });

    for (let sIdx = 0; sIdx < rawSegs.length; sIdx++) {
      const s = rawSegs[sIdx];
      const text = (s.text || '').trim();
      if (!text) continue;

      if (s.isFallback) {
        fallbackSegmentsCount++;
      }

      const relStart = typeof s.start === 'number' ? s.start : 0;
      const relEnd = typeof s.end === 'number' ? s.end : (relStart + 2.0);

      allAbsoluteSegments.push({
        start: Math.round((relStart + offset) * 100) / 100,
        end: Math.round((relEnd + offset) * 100) / 100,
        text,
        chunkIndex: cr.chunk?.index ?? cIdx,
        isFallback: Boolean(s.isFallback)
      });
    }
  }

  if (allAbsoluteSegments.length === 0) {
    return { combinedSegments: [], combinedTranscript: '', diagnostics: null };
  }

  // 2. Initial sort by absolute start time
  allAbsoluteSegments.sort((a, b) => a.start - b.start || a.end - b.end);

  // 3. Conservative non-destructive merge: Pairwise deduplication ONLY on ultra-safe criteria
  const consolidated = [];
  let duplicatesMergedCount = 0;

  for (const candidate of allAbsoluteSegments) {
    let mergedWithExisting = false;

    // Compare only with recently added segments that are within the overlap window
    for (let i = consolidated.length - 1; i >= 0; i--) {
      const existing = consolidated[i];

      // If existing segment ended well before candidate started, stop search
      if (candidate.start - existing.end > (overlapSec + 2.0)) {
        break;
      }

      // Compute temporal overlap between existing and candidate
      const overlapStart = Math.max(existing.start, candidate.start);
      const overlapEnd = Math.min(existing.end, candidate.end);
      const overlapDuration = Math.max(0, overlapEnd - overlapStart);
      const minDuration = Math.max(0.1, Math.min(existing.end - existing.start, candidate.end - candidate.start));
      const temporalOverlapRatio = overlapDuration / minDuration;

      // Compute text similarity
      const textSim = calculateTextSimilarity(existing.text, candidate.text);
      const isExactText = normalizeTextForDeduplication(existing.text) === normalizeTextForDeduplication(candidate.text);
      const isCloseInTime = Math.abs(existing.start - candidate.start) <= 1.5 && Math.abs(existing.end - candidate.end) <= 2.0;

      // Ultra-safe criteria: ONLY eliminate if practically identical text or >= 0.90 similarity + coincident timestamps
      const isDuplicate =
        (isExactText && (temporalOverlapRatio > 0.2 || isCloseInTime)) ||
        (textSim >= 0.90 && isCloseInTime);

      if (isDuplicate) {
        // Genuine duplicate: unify timestamps and choose the longer / more complete text
        existing.start = Math.min(existing.start, candidate.start);
        existing.end = Math.max(existing.end, candidate.end);
        if (candidate.text.length > existing.text.length) {
          existing.text = candidate.text;
        }
        mergedWithExisting = true;
        duplicatesMergedCount++;
        break;
      }
    }

    // If NO duplicate criteria met, ALWAYS keep the segment!
    if (!mergedWithExisting) {
      consolidated.push({ ...candidate });
    }
  }

  // 4. Final chronological sort and index assignment
  consolidated.sort((a, b) => a.start - b.start || a.end - b.end);

  const finalSegments = [];
  for (let idx = 0; idx < consolidated.length; idx++) {
    const curr = consolidated[idx];

    // Check for exact immediate duplicate (identical normalized text starting within 0.5s)
    if (finalSegments.length > 0) {
      const prev = finalSegments[finalSegments.length - 1];
      const isConsecutiveExact = normalizeTextForDeduplication(prev.text) === normalizeTextForDeduplication(curr.text);
      if (isConsecutiveExact && Math.abs(prev.start - curr.start) <= 0.5) {
        prev.end = Math.max(prev.end, curr.end);
        if (curr.text.length > prev.text.length) {
          prev.text = curr.text;
        }
        continue;
      }
    }

    finalSegments.push({
      id: finalSegments.length,
      start: curr.start,
      end: curr.end,
      text: curr.text
    });
  }

  const combinedTranscript = finalSegments.map(s => s.text).join(' ').trim();

  // 5. Validate temporal coverage
  const diagnostics = validateTemporalCoverage(finalSegments, totalAudioDuration);

  console.log('[AudioDiagnostics] Merge results summary:', {
    chunksCount: chunkResults.length,
    rawSegmentsTotal: totalRawSegmentsCount,
    fallbackSegmentsCount,
    duplicatesMergedCount,
    finalSegmentsCount: finalSegments.length,
    transcriptLengthChars: combinedTranscript.length,
    firstSegmentStart: finalSegments[0]?.start,
    lastSegmentEnd: finalSegments[finalSegments.length - 1]?.end,
    coveragePercent: diagnostics.coveragePercent
  });

  return {
    combinedSegments: finalSegments,
    combinedTranscript,
    diagnostics
  };
}

/**
 * Extracts an audio slice from an AudioBuffer as a 16kHz mono Float32Array (suitable for Whisper models).
 *
 * @param {AudioBuffer} audioBuffer
 * @param {number} [startSec=0]
 * @param {number} [endSec=null]
 * @param {number} [targetSampleRate=16000]
 * @returns {Promise<Float32Array>}
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
