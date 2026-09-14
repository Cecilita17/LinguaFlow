import { mergeChineseAiTokensByCoverage } from './subtitleGlossService.js';

/**
 * Normalizes Chinese message tokens against original raw text.
 * Uses mergeChineseAiTokensByCoverage to ensure accurate word segmentation and pinyin coverage.
 */
export function normalizeChineseMessageTokens(originalText, aiTokens) {
  if (!originalText || !Array.isArray(aiTokens) || aiTokens.length === 0) {
    return null;
  }
  try {
    const merged = mergeChineseAiTokensByCoverage([], aiTokens, originalText);
    return Array.isArray(merged) && merged.length > 0 ? merged : null;
  } catch (e) {
    console.warn('[ChineseTokenNormalizer] Failed to normalize tokens:', e);
    return null;
  }
}
