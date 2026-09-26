/**
 * Audio Chunking Service (Compatibility Layer)
 * Re-exports technical audio utilities from src/services/transcription/audioUtils.js.
 */

export {
  LONG_AUDIO_THRESHOLD_SECONDS,
  CHUNK_DURATION_SECONDS,
  CHUNK_OVERLAP_SECONDS,
  decodeAudioFile,
  encodeAudioSliceToWav,
  extractAudioSliceFloat32,
  planAudioChunks
} from './transcription/audioUtils.js';

/**
 * Backward compatibility helper for text deduplication/similarity.
 */
export function normalizeTextForDeduplication(str) {
  if (!str || typeof str !== 'string') return '';
  return str.toLowerCase().replace(/[\p{P}\p{S}\s]+/gu, '').trim();
}

/**
 * Backward compatibility helper for calculating text similarity.
 */
export function calculateTextSimilarity(str1, str2) {
  const s1 = normalizeTextForDeduplication(str1);
  const s2 = normalizeTextForDeduplication(str2);
  if (!s1 && !s2) return 1.0;
  if (!s1 || !s2) return 0.0;
  if (s1 === s2) return 1.0;
  return 0.5;
}

/**
 * Backward compatibility wrapper for mergeChunkSegments.
 */
export function mergeChunkSegments(chunkResults, overlapSec = 0, totalAudioDuration = null) {
  if (!Array.isArray(chunkResults) || chunkResults.length === 0) {
    return { combinedSegments: [], combinedTranscript: '', diagnostics: null };
  }

  const allSegments = [];
  for (let i = 0; i < chunkResults.length; i++) {
    const cr = chunkResults[i];
    const offset = cr.chunk?.offsetSec || 0;
    const rawSegs = Array.isArray(cr.segments) ? cr.segments : [];

    for (const seg of rawSegs) {
      if (!seg || !seg.text) continue;
      const start = typeof seg.start === 'number' ? seg.start + offset : offset;
      const end = typeof seg.end === 'number' ? seg.end + offset : start + 2;
      allSegments.push({
        id: allSegments.length,
        start: Math.round(start * 100) / 100,
        end: Math.round(end * 100) / 100,
        text: seg.text.trim()
      });
    }
  }

  allSegments.sort((a, b) => a.start - b.start);
  for (let i = 0; i < allSegments.length; i++) {
    allSegments[i].id = i;
  }

  const combinedTranscript = allSegments.map(s => s.text).join(' ').trim();
  return {
    combinedSegments: allSegments,
    combinedTranscript,
    diagnostics: null
  };
}
