/**
 * Audio Chunking Service
 * Provides client-side Web Audio API decoding, slicing, 16kHz mono WAV encoding,
 * and intelligent timestamp-anchored deduplication for robust long audio transcription.
 */

export const LONG_AUDIO_THRESHOLD_SECONDS = 180; // Audios > 3 minutes use chunking
export const CHUNK_DURATION_SECONDS = 210;       // 3.5 minutes per chunk
export const CHUNK_OVERLAP_SECONDS = 12;         // 12 seconds overlap between chunks

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

  const step = Math.max(30, chunkDurationSec - overlapSec);
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
 * Merges and deduplicates segments across overlapping audio chunks with absolute timestamps.
 * Implements multi-tier comparison:
 * 1. Absolute timestamp realignment per chunk.
 * 2. Overlap window boundary analysis.
 * 3. Temporal overlap + text similarity deduplication (keeps complete sentence and spans timestamps).
 *
 * @param {Array<{ chunk: object, segments: Array }>} chunkResults
 * @param {number} [overlapSec=CHUNK_OVERLAP_SECONDS]
 * @returns {{ combinedSegments: Array, combinedTranscript: string }}
 */
export function mergeChunkSegments(chunkResults, overlapSec = CHUNK_OVERLAP_SECONDS) {
  if (!Array.isArray(chunkResults) || chunkResults.length === 0) {
    return { combinedSegments: [], combinedTranscript: '' };
  }

  if (chunkResults.length === 1) {
    const single = chunkResults[0];
    const offset = single.chunk?.offsetSec || 0;
    const aligned = (single.segments || []).map((s, idx) => ({
      id: s.id !== undefined ? s.id : idx,
      start: Math.round(((typeof s.start === 'number' ? s.start : 0) + offset) * 100) / 100,
      end: Math.round(((typeof s.end === 'number' ? s.end : 0) + offset) * 100) / 100,
      text: (s.text || '').trim()
    })).filter(s => Boolean(s.text));

    return {
      combinedSegments: aligned,
      combinedTranscript: aligned.map(s => s.text).join(' ').trim()
    };
  }

  // 1. Convert all segments in every chunk to absolute timestamps
  const chunkAbsSegments = chunkResults.map(cr => {
    const offset = cr.chunk?.offsetSec || 0;
    return (cr.segments || []).map((s, idx) => ({
      id: s.id !== undefined ? s.id : idx,
      start: Math.round(((typeof s.start === 'number' ? s.start : 0) + offset) * 100) / 100,
      end: Math.round(((typeof s.end === 'number' ? s.end : 0) + offset) * 100) / 100,
      text: (s.text || '').trim(),
      chunkIndex: cr.chunk?.index || 0
    })).filter(s => Boolean(s.text));
  });

  // 2. Progressively merge chunk k into accumulated result
  let merged = [...chunkAbsSegments[0]];

  for (let k = 1; k < chunkAbsSegments.length; k++) {
    const currentChunk = chunkResults[k].chunk;
    const currentSegments = chunkAbsSegments[k];
    if (currentSegments.length === 0) continue;
    if (merged.length === 0) {
      merged = [...currentSegments];
      continue;
    }

    const overlapStart = currentChunk.offsetSec; // Where this chunk started physically
    const overlapMargin = overlapSec;            // Length of overlap window

    const nextMerged = [];

    // Keep all previous segments that clearly end before the overlap zone starts
    const previousOverlapCandidates = [];
    for (const seg of merged) {
      if (seg.end <= overlapStart + 1.0) {
        nextMerged.push(seg);
      } else {
        previousOverlapCandidates.push(seg);
      }
    }

    // Examine candidates in the overlap zone between previous and current chunk
    const currentOverlapCandidates = [];
    const futureCurrentSegments = [];

    for (const seg of currentSegments) {
      if (seg.start < overlapStart + overlapMargin + 2.0) {
        currentOverlapCandidates.push(seg);
      } else {
        futureCurrentSegments.push(seg);
      }
    }

    // Match and deduplicate overlapping candidate pairs
    const usedCurrentIndices = new Set();

    for (const prevSeg of previousOverlapCandidates) {
      let matchedCurrentIdx = -1;
      let bestSimilarity = 0;

      for (let cIdx = 0; cIdx < currentOverlapCandidates.length; cIdx++) {
        if (usedCurrentIndices.has(cIdx)) continue;
        const currSeg = currentOverlapCandidates[cIdx];

        // Check temporal overlap
        const overlapDuration = Math.max(0, Math.min(prevSeg.end, currSeg.end) - Math.max(prevSeg.start, currSeg.start));
        const minDuration = Math.max(0.2, Math.min(prevSeg.end - prevSeg.start, currSeg.end - currSeg.start));
        const temporalOverlapRatio = overlapDuration / minDuration;

        // Check text similarity
        const sim = calculateTextSimilarity(prevSeg.text, currSeg.text);

        if ((temporalOverlapRatio > 0.4 && sim > 0.5) || sim > 0.85 || (temporalOverlapRatio > 0.7 && sim > 0.3)) {
          if (sim > bestSimilarity) {
            bestSimilarity = sim;
            matchedCurrentIdx = cIdx;
          }
        }
      }

      if (matchedCurrentIdx !== -1) {
        // Duplicate found in overlap: pick the most complete text and span timestamps
        usedCurrentIndices.add(matchedCurrentIdx);
        const currSeg = currentOverlapCandidates[matchedCurrentIdx];

        const chosenText = currSeg.text.length >= prevSeg.text.length ? currSeg.text : prevSeg.text;
        const unifiedStart = Math.min(prevSeg.start, currSeg.start);
        const unifiedEnd = Math.max(prevSeg.end, currSeg.end);

        nextMerged.push({
          ...currSeg,
          start: unifiedStart,
          end: unifiedEnd,
          text: chosenText
        });
      } else {
        // No match in current chunk: preserve previous segment if its midpoint is before boundary split
        const splitBoundary = overlapStart + (overlapMargin / 2);
        const mid = (prevSeg.start + prevSeg.end) / 2;
        if (mid < splitBoundary || prevSeg.start < splitBoundary) {
          nextMerged.push(prevSeg);
        }
      }
    }

    // Add remaining unmatched current chunk candidates that start around or after boundary split
    const splitBoundary = overlapStart + (overlapMargin / 2);
    for (let cIdx = 0; cIdx < currentOverlapCandidates.length; cIdx++) {
      if (usedCurrentIndices.has(cIdx)) continue;
      const currSeg = currentOverlapCandidates[cIdx];
      const mid = (currSeg.start + currSeg.end) / 2;
      if (mid >= splitBoundary || currSeg.end > splitBoundary) {
        nextMerged.push(currSeg);
      }
    }

    // Add all future segments from current chunk
    for (const seg of futureCurrentSegments) {
      nextMerged.push(seg);
    }

    merged = nextMerged;
  }

  // 3. Final cleanup: sort by start timestamp and deduplicate identical consecutive segments
  merged.sort((a, b) => a.start - b.start || a.end - b.end);

  const deduplicated = [];
  for (let i = 0; i < merged.length; i++) {
    const curr = merged[i];
    if (deduplicated.length > 0) {
      const prev = deduplicated[deduplicated.length - 1];
      // Check if exact duplicate in time and text
      if (Math.abs(prev.start - curr.start) < 0.5 && calculateTextSimilarity(prev.text, curr.text) > 0.9) {
        continue;
      }
    }
    deduplicated.push(curr);
  }

  const combinedTranscript = deduplicated.map(s => s.text).join(' ').trim();

  return {
    combinedSegments: deduplicated,
    combinedTranscript
  };
}
