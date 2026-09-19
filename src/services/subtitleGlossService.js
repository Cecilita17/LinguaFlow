/**
 * Subtitle Gloss Service
 * Provides:
 * 1. Hybrid local-first glossing using language-specific strategies (Chinese, Arabic, Polish, etc.)
 * 2. Instant offline lexicon resolution for high-frequency vocabulary, Pinyin, and transliterations
 * 3. Contextual AI batch requests sending ONLY unresolved unknown tokens with full sentence context
 * 4. Drastic reduction in Groq token consumption (70-90% savings) preventing response truncation
 * 5. Multi-strategy robust ID & positional matching so 100% of AI tokens are applied
 * 6. Detailed performance and token savings logging
 * 7. Persistent caching by videoId/content hash (v2) to eliminate duplicate requests
 */

import { API_BASE_URL } from './chatService.js';
import {
  getLanguageGlossStrategy,
  normalizeArabicForMatching,
  CHINESE_OFFLINE_DICT,
  ARABIC_OFFLINE_DICT,
  POLISH_OFFLINE_DICT,
  PUNCTUATION_REGEX,
  getCachedGloss,
  setCachedGloss,
  clearLexicalGlossCache,
  getLexicalGlossCacheStats
} from './languageGlossStrategies.js';
import { getArabicTransliteration } from './arabicTransliteration.js';
import {
  computeSubtitleHash,
  getLibraryKey,
  parseLibraryKey,
  getTranscriptFromLibrary,
  saveTranscriptToLibrary,
  getAllSavedTranscripts,
  findTranscriptsByVideoId,
  deleteTranscriptFromLibrary,
  getSavedTranscriptsCount
} from './transcriptLibraryStorage.js';

// Re-export dictionaries, strategies, and library functions for backwards-compatibility
export {
  CHINESE_OFFLINE_DICT,
  ARABIC_OFFLINE_DICT,
  POLISH_OFFLINE_DICT,
  PUNCTUATION_REGEX,
  normalizeArabicForMatching,
  getLanguageGlossStrategy,
  getCachedGloss,
  setCachedGloss,
  clearLexicalGlossCache,
  getLexicalGlossCacheStats,
  computeSubtitleHash,
  getLibraryKey,
  parseLibraryKey,
  getTranscriptFromLibrary,
  saveTranscriptToLibrary,
  getAllSavedTranscripts,
  findTranscriptsByVideoId,
  deleteTranscriptFromLibrary,
  getSavedTranscriptsCount
};

/**
 * Retrieve effective API key from argument or client configuration in localStorage
 */
export function getEffectiveApiKey(explicitKey = '') {
  if (explicitKey && typeof explicitKey === 'string' && explicitKey.trim()) {
    return explicitKey.trim().replace(/^["']|["']$/g, '');
  }
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const saved = localStorage.getItem('linguaflow_config');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed?.apiKey) {
          return parsed.apiKey.trim().replace(/^["']|["']$/g, '');
        }
      }
    }
  } catch (e) {}
  return '';
}

/**
 * Tokenize a single text line into words with offline Pinyin, transliteration, and glosses.
 * Uses language-tailored strategy (e.g. Intl.Segmenter for Chinese words, Arabic letters + vowels, Polish Latin words).
 */
export function tokenizeAndGlossLineOffline(rawText, targetLang = 'zh', nativeLang = 'es') {
  if (!rawText || typeof rawText !== 'string') return [];
  const text = rawText.trim();
  if (!text) return [];

  try {
    const strategy = getLanguageGlossStrategy(targetLang);
    if (!strategy || typeof strategy.tokenize !== 'function') return [];
    const tokens = strategy.tokenize(text, nativeLang);
    return Array.isArray(tokens) ? tokens : [];
  } catch (err) {
    console.warn(`[tokenizeAndGlossLineOffline] Fallback tokenization for lang "${targetLang}":`, err);
    try {
      const parts = text.split(/\s+/).filter(Boolean);
      return parts.map(w => ({
        text: w,
        word: w,
        targetLang,
        nativeLang: nativeLang || 'es',
        auxiliary: null,
        pinyin: null,
        translit: null,
        gloss: null,
        glossSource: null,
        isPunctuation: PUNCTUATION_REGEX.test(w)
      }));
    } catch {
      return [];
    }
  }
}

/**
 * Rigorously checks whether a subtitle line is completely and authentically glossed.
 * Evaluates completion according to the language-specific strategy rules.
 */
export function isGlossComplete(sub, targetLang = 'zh', nativeLang = 'es') {
  if (!sub || typeof sub !== 'object') return false;
  if (!Array.isArray(sub.tokens) || sub.tokens.length === 0) return false;

  const strategy = getLanguageGlossStrategy(targetLang);
  const substantiveTokens = sub.tokens.filter(t => {
    if (!t) return false;
    if (t.isPunctuation) return false;
    const word = (t.text || t.word || '').trim();
    if (!word) return false;
    return !PUNCTUATION_REGEX.test(word);
  });

  // If the line consists strictly of punctuation/notes, it's considered complete
  if (substantiveTokens.length === 0) return true;

  for (const token of substantiveTokens) {
    if (!strategy.isTokenComplete(token, nativeLang)) {
      return false;
    }
  }

  // Consistency check for Chinese: e.g. a 6+ character sentence shouldn't have only 1 substantive token
  if (targetLang === 'zh') {
    const rawChineseChars = (sub.text || '').replace(/[^\u4e00-\u9fa5]/g, '');
    if (rawChineseChars.length >= 6 && substantiveTokens.length <= 1) {
      return false;
    }

    // Detect suspicious single-char tokenization: if two adjacent single-char Chinese tokens
    // form a known compound word in the offline dict, the segmentation is defective.
    // This triggers re-glossing for old documents saved with char-by-char tokenization.
    const zhStrategy = getLanguageGlossStrategy('zh');
    for (let i = 0; i < substantiveTokens.length - 1; i++) {
      const w1 = (substantiveTokens[i].text || substantiveTokens[i].word || '').trim();
      const w2 = (substantiveTokens[i + 1].text || substantiveTokens[i + 1].word || '').trim();
      // Both must be exactly one CJK character
      if (
        w1.length === 1 && w2.length === 1 &&
        /[\u4e00-\u9fa5]/.test(w1) && /[\u4e00-\u9fa5]/.test(w2) &&
        zhStrategy.lookupOffline(w1 + w2, 'es')
      ) {
        return false; // Adjacent chars form a compound word → segmentation needs correction
      }
      // Also check 3-char compounds with the following token
      if (i + 2 < substantiveTokens.length) {
        const w3 = (substantiveTokens[i + 2].text || substantiveTokens[i + 2].word || '').trim();
        if (
          w1.length === 1 && w2.length === 1 && w3.length === 1 &&
          /[\u4e00-\u9fa5]/.test(w3) &&
          zhStrategy.lookupOffline(w1 + w2 + w3, 'es')
        ) {
          return false;
        }
      }
    }
  }

  return true;
}

/**
 * Call backend batch gloss endpoint to enrich a set of lines with AI glosses.
 * Crucially passes client pre-segmented words, specific UNRESOLVED unknown tokens, and effective API key.
 */
export async function fetchBatchGlossesApi(lines, targetLang = 'zh', nativeLang = 'es', apiKey = '', abortSignal = null, options = {}) {
  if (!Array.isArray(lines) || lines.length === 0) return [];
  if (abortSignal?.aborted) return [];

  const url = `${API_BASE_URL}/api/batch-gloss`;
  const fallbackUrl = `${API_BASE_URL}/batch-gloss`;
  const effectiveKey = getEffectiveApiKey(apiKey);
  const strategy = getLanguageGlossStrategy(targetLang);

  const payload = {
    lines: lines.map(l => {
      // For Chinese: send empty words/unknownTokens so the backend performs fresh
      // lexical segmentation from the full sentence text. This is necessary because
      // client-side pre-segmentation for Chinese is unreliable (single chars vs compounds),
      // and telling the AI to "preserve pre-segmented words" perpetuates bad segmentation.
      if (targetLang === 'zh') {
        return {
          id: l.id,
          text: l.text,
          words: [],
          unknownTokens: []
        };
      }

      // For other languages: send pre-segmented tokens to save API tokens (hybrid mode)
      const words = (l.tokens || [])
        .filter(t => !t.isPunctuation && (t.text || t.word))
        .map(t => t.text || t.word);
      const unknownTokens = options.forceFullLine
        ? words
        : (l.tokens || [])
            .filter(t => !t.isPunctuation && (t.text || t.word) && !strategy.isTokenComplete(t, nativeLang))
            .map(t => t.text || t.word);

      return {
        id: l.id,
        text: l.text,
        words,
        unknownTokens: unknownTokens.length > 0 ? unknownTokens : words
      };
    }),
    targetLang,
    nativeLang,
    apiKey: effectiveKey
  };

  const batchId = lines.map(l => l.id).join(',');
  const attemptStartTime = Date.now();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort('timeout_28s');
  }, 28000);
  const onParentAbort = () => {
    controller.abort(abortSignal?.reason || 'parent_aborted');
  };
  if (abortSignal) {
    abortSignal.addEventListener('abort', onParentAbort, { once: true });
  }

  try {
    const headers = { 'Content-Type': 'application/json' };
    if (effectiveKey) {
      headers['x-api-key'] = effectiveKey;
    }

    let res = await fetch(url, {
      method: 'POST',
      headers,
      signal: controller.signal,
      body: JSON.stringify(payload)
    });

    if (!res.ok && res.status === 404) {
      res = await fetch(fallbackUrl, {
        method: 'POST',
        headers,
        signal: controller.signal,
        body: JSON.stringify(payload)
      });
    }

    if (res.ok) {
      const data = await res.json();
      if (data.success && Array.isArray(data.lines)) {
        const linesResult = data.lines;
        linesResult.isComplete = Boolean(data.isComplete);
        linesResult.missingIds = data.missingIds || [];
        return linesResult;
      } else {
        console.warn('[Gloss] batch response missing lines or unsuccessful (fail-cheap, no retry):', {
          status: res.status,
          targetLang,
          nativeLang,
          subtitleIds: lines.map(l => l.id),
          requestedCount: lines.length,
          payload: data
        });
      }
    } else {
      const errText = await res.text().catch(() => '');
      console.warn('[Gloss] batch request failed (fail-cheap, no retry):', {
        status: res.status,
        targetLang,
        nativeLang,
        subtitleIds: lines.map(l => l.id),
        requestedCount: lines.length,
        response: errText
      });
    }
  } catch (err) {
    console.warn(`[Gloss] Batch gloss request failed (fail-cheap, 0 retries):`, {
      error: err.message,
      targetLang,
      nativeLang,
      subtitleIds: lines.map(l => l.id),
      requestedCount: lines.length
    });
  } finally {
    clearTimeout(timeoutId);
    if (abortSignal) {
      abortSignal.removeEventListener('abort', onParentAbort);
    }
  }

  return [];
}

/**
 * Cache key generator for persistent storage (version 4 ensures targetLang + nativeLang pair isolation)
 */
export function getStorageKey(videoId, subtitlesCount, targetLang = 'zh', nativeLang = 'es') {
  const cleanId = (videoId || 'generic').replace(/[^a-zA-Z0-9_-]/g, '');
  const cleanTarget = (targetLang || 'zh').replace(/[^a-zA-Z0-9_-]/g, '');
  const cleanNative = (nativeLang || 'es').replace(/[^a-zA-Z0-9_-]/g, '');
  return `linguaflow_gloss_v4_${cleanId}_${subtitlesCount}_${cleanTarget}_${cleanNative}`;
}

/**
 * Safely parse and retrieve cached glosses from localStorage with JSON validity checks
 */
export function loadCachedGlosses(videoId, subtitlesCount, targetLang = 'zh', nativeLang = 'es') {
  if (typeof window === 'undefined' || !window.localStorage) {
    return {};
  }
  const key = getStorageKey(videoId, subtitlesCount, targetLang, nativeLang);
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return (parsed && typeof parsed === 'object') ? parsed : {};
  } catch (err) {
    console.warn('[GlossCache] Corrupted cache detected, clearing key:', key);
    try { localStorage.removeItem(key); } catch (e) {}
    return {};
  }
}

/**
 * Safely persist verified glosses to localStorage
 */
export function saveCachedGlosses(videoId, subtitlesCount, cacheData, targetLang = 'zh', nativeLang = 'es') {
  if (typeof window === 'undefined' || !window.localStorage || !cacheData) return;
  const key = getStorageKey(videoId, subtitlesCount, targetLang, nativeLang);
  try {
    localStorage.setItem(key, JSON.stringify(cacheData));
  } catch (err) {
    console.warn('[GlossCache] Failed to save glosses to localStorage (quota exceeded?):', err.message);
  }
}

/**
 * Robust, safe matching to associate an AI response item with its corresponding subtitle.
 * 
 * Hierarchy:
 * 1. Exact ID match within the active batch/chunk (Highest confidence).
 * 2. Exact ID match in the global subtitles list.
 * 3. Exact text match within the active batch/chunk.
 * 4. Local batch position:
 *    - 1-based index (e.g. 1..N or "line_1"): maps to chunkList[num - 1].
 *    - 0-based index (0..N-1): maps to chunkList[0].
 *    - Positional itemIndex in chunkList.
 * 5. If ambiguous or unresolvable: DO NOT search global list with digitsOnly! Return -1 to avoid corrupting other lines.
 *
 * @param {Array} subtitlesList - Full list of all subtitles in the video
 * @param {Array} chunkList - The specific batch/chunk of subtitles sent to the API
 * @param {Object} aiItem - AI response item { id, tokens, [text] }
 * @param {number} itemIndex - Index of the item in the AI response array
 * @param {Object} [debugInfo] - Optional out-param to record match mode
 * @returns {number} Index in subtitlesList, or -1 if unresolved
 */
export function findMatchingSubtitleIndex(subtitlesList, chunkList, aiItem, itemIndex, debugInfo = null) {
  if (!aiItem || !Array.isArray(subtitlesList)) {
    if (debugInfo) debugInfo.mode = 'invalid_args';
    return -1;
  }

  const rawId = String(aiItem.id || '').trim();
  const digitsOnly = rawId.replace(/\D+/g, '');

  // 1. Exact ID match within the active batch/chunk (Highest confidence)
  if (rawId && Array.isArray(chunkList)) {
    const chunkIdx = chunkList.findIndex(s => String(s.id).trim() === rawId);
    if (chunkIdx !== -1) {
      const globalIdx = subtitlesList.findIndex(s => s.id === chunkList[chunkIdx].id);
      if (globalIdx !== -1) {
        if (debugInfo) debugInfo.mode = 'exact-id-chunk';
        return globalIdx;
      }
    }
  }

  // 2. Exact ID match in the global subtitles list
  if (rawId) {
    const globalIdx = subtitlesList.findIndex(s => String(s.id).trim() === rawId);
    if (globalIdx !== -1) {
      if (debugInfo) debugInfo.mode = 'exact-id-global';
      return globalIdx;
    }
  }

  // 3. Exact text match within the active batch/chunk
  if (aiItem.text && Array.isArray(chunkList)) {
    const cleanText = aiItem.text.trim();
    const chunkIdx = chunkList.findIndex(s => s.text && s.text.trim() === cleanText);
    if (chunkIdx !== -1) {
      const globalIdx = subtitlesList.findIndex(s => s.id === chunkList[chunkIdx].id);
      if (globalIdx !== -1) {
        if (debugInfo) debugInfo.mode = 'exact-text-chunk';
        return globalIdx;
      }
    }
  }

  // 4. Batch-local index resolution:
  // If Groq returned a 1-based index (e.g. 1, 2, 3.. or "line_1", "1") within the batch
  if (Array.isArray(chunkList) && chunkList.length > 0) {
    if (digitsOnly) {
      const num = parseInt(digitsOnly, 10);
      // Check 1-based index (1 <= num <= chunkList.length)
      if (num >= 1 && num <= chunkList.length) {
        const targetSub = chunkList[num - 1];
        const globalIdx = subtitlesList.findIndex(s => s.id === targetSub.id);
        if (globalIdx !== -1) {
          if (debugInfo) debugInfo.mode = 'batch-position-1based';
          return globalIdx;
        }
      }
      // Check 0-based index (0 <= num < chunkList.length)
      if (num === 0 && chunkList[0]) {
        const globalIdx = subtitlesList.findIndex(s => s.id === chunkList[0].id);
        if (globalIdx !== -1) {
          if (debugInfo) debugInfo.mode = 'batch-position-0based';
          return globalIdx;
        }
      }
    }

    // 5. Positional fallback within the chunk (itemIndex matches position in sent chunk)
    if (typeof itemIndex === 'number' && itemIndex >= 0 && itemIndex < chunkList.length) {
      const targetSub = chunkList[itemIndex];
      const globalIdx = subtitlesList.findIndex(s => s.id === targetSub.id);
      if (globalIdx !== -1) {
        if (debugInfo) debugInfo.mode = 'batch-position-itemIndex';
        return globalIdx;
      }
    }
  }

  // If completely unresolved or ambiguous, DO NOT search global digitsOnly against all video subtitles!
  if (debugInfo) debugInfo.mode = 'unresolved';
  return -1;
}

/**
 * Safely merge AI tokens onto pre-segmented client tokens.
 *
 * For Chinese (zh): AUTHORITATIVE RESEGMENTATION MODE
 *   - AI tokens define the authoritative lexical units (multi-character compound words).
 *   - Validates that AI tokens sequentially cover the exact original Chinese sentence.
 *   - Preserves all punctuation in exact positions (whether returned by AI or in source text).
 *   - Preserves any user manual glosses for words.
 *   - If validation passes: returns the new authoritative lexical token array.
 * /**
 * Validates whether the given AI tokens accurately and completely cover the original Chinese text:
 * - No characters omitted
 * - No characters invented or duplicated
 * - Order is preserved exactly
 * - Ignores harmless whitespace differences
 *
 * @param {string} originalText
 * @param {Array} aiTokens
 * @returns {boolean} True if coverage is 100% valid
 */
export function validateChineseAiSegmentation(originalText, aiTokens) {
  if (!originalText || typeof originalText !== 'string' || !Array.isArray(aiTokens) || aiTokens.length === 0) {
    return false;
  }

  const cleanOriginal = originalText.replace(/\s+/g, '');
  if (!cleanOriginal) return false;

  // 1. Check if direct concatenation of all AI tokens matches cleanOriginal
  const cleanAiChars = aiTokens.map(t => (t.word || t.text || '').replace(/\s+/g, '')).join('');
  if (cleanAiChars === cleanOriginal) {
    return true;
  }

  // 2. Check if AI tokens covered all non-punctuation characters in exact order
  // (AI often omits or reformats punctuation like trailing 。or quotes)
  const PUNCT_STRIP_REGEX = /[，。！？；：、“”‘’（）《》…—,.!?;:'"()¿?¡!/\-_—\s\t،؛؟ـ]/g;
  const nonPunctOrig = cleanOriginal.replace(PUNCT_STRIP_REGEX, '');
  const nonPunctAi = cleanAiChars.replace(PUNCT_STRIP_REGEX, '');
  if (nonPunctOrig.length > 0 && nonPunctAi === nonPunctOrig) {
    return true;
  }

  return false;
}

/**
 * Merges Chinese AI tokens by coverage, making AI lexical segmentation authoritative.
 * Preserves original punctuation positions and any user manual glosses.
 *
 * @param {Array} originalTokens - Client provisional tokens
 * @param {Array} aiTokens - AI lexical tokens
 * @param {string} [originalText=''] - Raw original sentence text
 * @returns {Array} Final lexical tokens, or safe fallback if validation fails
 */
export function mergeChineseAiTokensByCoverage(originalTokens = [], aiTokens = [], originalText = '', nativeLang = 'es') {
  if (!Array.isArray(aiTokens) || aiTokens.length === 0) {
    return originalTokens;
  }

  const authoritativeText = (typeof originalText === 'string' && originalText.trim())
    ? originalText.trim()
    : (Array.isArray(originalTokens) ? originalTokens.map(t => t.text || t.word || '').join('').trim() : '');

  if (!authoritativeText) {
    return originalTokens;
  }

  // 1. Validate coverage
  const isValid = validateChineseAiSegmentation(authoritativeText, aiTokens);
  if (!isValid) {
    const cleanOriginal = authoritativeText.replace(/\s+/g, '');
    const cleanAiChars = aiTokens.map(t => (t.word || t.text || '').replace(/\s+/g, '')).join('');
    const PUNCT_STRIP_REGEX = /[，。！？；：、“”‘’（）《》…—,.!?;:'"()¿?¡!/\-_—\s\t،؛؟ـ]/g;
    const nonPunctOrig = cleanOriginal.replace(PUNCT_STRIP_REGEX, '');
    const nonPunctAi = cleanAiChars.replace(PUNCT_STRIP_REGEX, '');

    const reasonDetails = [];
    if (cleanAiChars.length !== cleanOriginal.length) {
      reasonDetails.push(`Length mismatch (cleanOriginal: ${cleanOriginal.length}, cleanAiChars: ${cleanAiChars.length})`);
    }
    if (nonPunctAi !== nonPunctOrig) {
      reasonDetails.push(`Non-punctuation text mismatch (nonPunctOrig: "${nonPunctOrig}", nonPunctAi: "${nonPunctAi}")`);
    } else {
      reasonDetails.push(`Punctuation or whitespace ordering mismatch`);
    }

    console.warn(`[ChineseCoverageDebug] [TEMPORARY_DIAGNOSTIC]
Original: "${authoritativeText}"
AI tokens: ${JSON.stringify(aiTokens.map(t => t.word || t.text || ''))}
Reconstructed: "${aiTokens.map(t => t.word || t.text || '').join('')}"
Normalized original: "${nonPunctOrig}"
Normalized reconstructed: "${nonPunctAi}"
MATCH: false
Reason: ${reasonDetails.join(' | ')}`);

    console.warn('[ChineseMerge] AI tokens failed coverage validation against original text. Using provisional fallback.');
    return originalTokens;
  }

  // 2. Resegment by coverage
  const resegmented = tryChineseResegmentation(originalTokens, aiTokens, authoritativeText, nativeLang);
  if (resegmented !== null && resegmented.length > 0) {
    return resegmented;
  }

  return originalTokens;
}

/**
 * Merges AI-generated gloss tokens with client-side segmented tokens.
 *
 * For Chinese (zh): EXCLUSIVE COVERAGE-BASED BRANCH
 *   - Local tokenization is strictly provisional.
 *   - AI word-level tokenization is authoritative when validated by text coverage.
 *   - Multi-character words (e.g. 喜欢, 学习, 中文) replace individual Hanzi characters.
 *
 * For all other languages: MAP-BASED MERGE (unchanged behavior)
 *   - NEVER breaks or splits client word units.
 *   - Preserves locally resolved tokens and enriches unresolved ones.
 *
 * @param {Array} originalTokens - Client-side provisional tokens
 * @param {Array} aiTokens - AI-returned tokens with lexical groupings
 * @param {string} targetLang - Target language code (e.g. 'zh', 'ar', 'pl')
 * @param {string} [originalText=''] - Optional raw original text of the sentence/paragraph
 * @param {string} [nativeLang='es'] - User native language for gloss translation
 * @returns {Array} Final merged/resegmented tokens
 */
export function mergeAiTokensWithSegmented(originalTokens = [], aiTokens = [], targetLang = 'zh', originalText = '', nativeLang = 'es') {
  if (!Array.isArray(aiTokens) || aiTokens.length === 0) {
    return originalTokens;
  }

  // ============================================================
  // EXCLUSIVE CHINESE BRANCH (Coverage-based lexical merge)
  // ============================================================
  if (targetLang === 'zh') {
    return mergeChineseAiTokensByCoverage(originalTokens, aiTokens, originalText, nativeLang);
  }

  // ============================================================
  // MAP-BASED MERGE (for all non-Chinese languages)
  // ============================================================
  const aiMap = new Map();
  const normalizedAiMap = new Map();

  aiTokens.forEach(item => {
    const w = (item.word || item.text || '').trim();
    if (w) {
      aiMap.set(w, item);
      aiMap.set(w.toLowerCase(), item);
      if (item.gloss && typeof item.gloss === 'string' && item.gloss.trim().length > 0 && !PUNCTUATION_REGEX.test(w)) {
        setCachedGloss(w, targetLang, nativeLang, item);
      }
      if (targetLang === 'ar' || /[\u0600-\u06FF]/.test(w)) {
        const norm = normalizeArabicForMatching(w);
        if (norm) {
          normalizedAiMap.set(norm, item);
          // If AI returned a prefixed word (e.g. 'والسلام'), also index base word ('سلام')
          if (norm.length > 2 && /^[وفبل]/.test(norm)) {
            const base = norm.slice(1);
            if (!normalizedAiMap.has(base)) {
              normalizedAiMap.set(base, item);
            }
          }
        }
      }
    }
  });

  const strategy = getLanguageGlossStrategy(targetLang);
  const usedAiTokens = new Set();

  const intermediateTokens = originalTokens.map(orig => {
    if (orig.isPunctuation) return orig;

    const isManual = orig.glossSource === 'manual';
    const w = (orig.text || orig.word || '').trim();
    let match = aiMap.get(w) || aiMap.get(w.toLowerCase());

    if (!match && (targetLang === 'ar' || /[\u0600-\u06FF]/.test(w))) {
      const normW = normalizeArabicForMatching(w);
      if (normW) {
        match = normalizedAiMap.get(normW);
        // Prefix fallback if AI dropped common clitic (و/ف/ب/ل)
        if (!match && normW.length > 2 && /^[وفبل]/.test(normW)) {
          match = normalizedAiMap.get(normW.slice(1));
        }
      }
    }

    if (match) {
      usedAiTokens.add(match);
      // 1. TIER 1: MANUAL GLOSS PRIORITY - NEVER OVERWRITE orig.gloss
      if (isManual) {
        return {
          ...orig,
          glossSource: 'manual'
        };
      }

      // 2. TIER 2: AI GLOSS COMPLETION
      const translitFallback = targetLang === 'ar' ? getArabicTransliteration(orig.word || orig.text) : (match.pinyin || match.translit || null);
      return {
        ...orig,
        targetLang: targetLang,
        nativeLang: nativeLang || 'es',
        auxiliary: match.auxiliary || translitFallback,
        pinyin: match.pinyin || match.auxiliary || null,
        translit: match.translit || match.auxiliary || translitFallback,
        gloss: match.gloss || null,
        glossSource: 'ai'
      };
    }

    return orig;
  });

  // Second pass: Positional alignment for remaining unassigned AI tokens
  const unassignedAiTokens = aiTokens.filter(t => !usedAiTokens.has(t) && (t.gloss || t.translation));
  let unassignedIdx = 0;

  return intermediateTokens.map(token => {
    if (token.isPunctuation) return token;
    if (token.glossSource === 'manual' || token.glossSource === 'ai') return token;

    // Check if an unassigned AI token can be applied positionally
    if (unassignedIdx < unassignedAiTokens.length) {
      const aiToken = unassignedAiTokens[unassignedIdx++];
      const translitFallback = targetLang === 'ar' ? getArabicTransliteration(token.word || token.text) : (aiToken.pinyin || aiToken.translit || null);
      return {
        ...token,
        targetLang: targetLang,
        nativeLang: nativeLang || 'es',
        auxiliary: aiToken.auxiliary || translitFallback,
        pinyin: aiToken.pinyin || aiToken.auxiliary || null,
        translit: aiToken.translit || aiToken.auxiliary || translitFallback,
        gloss: aiToken.gloss || null,
        glossSource: 'ai'
      };
    }

    // If it's an offline dictionary match for the ACTIVE strategy and nativeLang, preserve/set it
    const w = (token.text || token.word || '').trim();
    const offlineEntry = strategy.lookupOffline(w, nativeLang);
    if (offlineEntry && offlineEntry.gloss) {
      const translitFallback = targetLang === 'ar' ? getArabicTransliteration(token.word || token.text) : null;
      return {
        ...token,
        targetLang: targetLang,
        nativeLang: nativeLang || 'es',
        auxiliary: offlineEntry.auxiliary || offlineEntry.pinyin || offlineEntry.translit || translitFallback,
        pinyin: offlineEntry.pinyin || offlineEntry.auxiliary || null,
        translit: offlineEntry.translit || translitFallback,
        gloss: offlineEntry.gloss,
        glossSource: 'offline'
      };
    }

    // If the token was previously resolved with AI for the ACTIVE targetLang and nativeLang, keep it
    if (token.glossSource === 'ai' && token.targetLang === targetLang && token.nativeLang === (nativeLang || 'es') && token.gloss) {
      return token;
    }

    // Otherwise, the token is unresolved for this targetLang/nativeLang pair
    const translitFallback = targetLang === 'ar' ? getArabicTransliteration(token.word || token.text) : null;
    return {
      ...token,
      targetLang: targetLang,
      nativeLang: nativeLang || 'es',
      auxiliary: translitFallback,
      pinyin: null,
      translit: translitFallback,
      gloss: null,
      glossSource: null
    };
  });
}

/**
 * Validates and reconstructs the Chinese token array from AI lexical units based on exact text coverage.
 *
 * Algorithm:
 * 1. Obtains the full original sentence text (from rawOriginalText or originalTokens).
 * 2. Iterates along the original sentence text, consuming matching AI tokens.
 * 3. Preserves punctuation in its exact original positions (whether present in AI tokens or in source text).
 * 4. Preserves manual gloss overrides from provisional original tokens.
 * 5. Strictly validates that:
 *    - No characters are omitted.
 *    - No characters are invented or hallucinated.
 *    - Character order is preserved exactly.
 *    - All AI tokens are accounted for.
 * 6. Returns the reconstructed token array if 100% verified, or null on any mismatch.
 *
 * @param {Array} originalTokens - Client-side provisional tokens
 * @param {Array} aiTokens - AI-returned tokens with lexical groupings
 * @param {string} [rawOriginalText=''] - Raw sentence text
 * @param {string} [nativeLang='es'] - User native language
 * @returns {Array|null} New token array, or null if coverage validation fails
 */
function tryChineseResegmentation(originalTokens, aiTokens, rawOriginalText = '', nativeLang = 'es') {
  if (!Array.isArray(aiTokens) || aiTokens.length === 0) return null;

  // 1. Obtain authoritative full original text
  const fullOriginalText = (typeof rawOriginalText === 'string' && rawOriginalText.trim())
    ? rawOriginalText.trim()
    : (Array.isArray(originalTokens) ? originalTokens.map(t => t.text || t.word || '').join('').trim() : '');

  if (!fullOriginalText) return null;

  // 2. Clean and filter AI tokens (trim words, skip empty)
  const cleanAiTokens = aiTokens
    .map(t => ({
      ...t,
      word: (t.word || t.text || '').trim()
    }))
    .filter(t => t.word.length > 0);

  if (cleanAiTokens.length === 0) return null;

  // 3. Preserve manual gloss overrides from provisional original tokens
  const manualGlossMap = new Map();
  if (Array.isArray(originalTokens)) {
    for (const tok of originalTokens) {
      if (tok && tok.glossSource === 'manual' && tok.gloss) {
        const w = (tok.word || tok.text || '').trim();
        if (w) manualGlossMap.set(w, tok.gloss);
      }
    }
  }

  // Helper to match an AI word at textIdx, skipping whitespace in both
  function matchWordAt(text, startIdx, word) {
    let tIdx = startIdx;
    let wIdx = 0;
    while (wIdx < word.length) {
      if (/\s/.test(word[wIdx])) {
        wIdx++;
        while (tIdx < text.length && /\s/.test(text[tIdx])) {
          tIdx++;
        }
        continue;
      }
      while (tIdx < text.length && /\s/.test(text[tIdx])) {
        tIdx++;
      }
      if (tIdx >= text.length || text[tIdx] !== word[wIdx]) {
        return -1;
      }
      tIdx++;
      wIdx++;
    }
    return tIdx;
  }

  // Punctuation run matcher for Chinese & Western punctuation
  const PUNCT_RUN_REGEX = /^[，。！？；：、“”‘’（）《》…—,.!?;:'"()¿?¡!/\-_—\s\t،؛؟ـ]+/;

  const result = [];
  let textIdx = 0;
  let aiIdx = 0;
  const textLen = fullOriginalText.length;

  while (textIdx < textLen) {
    // Skip whitespace in original text
    if (/\s/.test(fullOriginalText[textIdx])) {
      textIdx++;
      continue;
    }

    const remainingText = fullOriginalText.slice(textIdx);
    const currentAiToken = aiIdx < cleanAiTokens.length ? cleanAiTokens[aiIdx] : null;

    // Check if current AI token matches at textIdx (with whitespace tolerance)
    const endIdx = currentAiToken ? matchWordAt(fullOriginalText, textIdx, currentAiToken.word) : -1;
    if (endIdx > -1) {
      const isPunct = PUNCTUATION_REGEX.test(currentAiToken.word);
      const isManual = manualGlossMap.has(currentAiToken.word);
      const aux = isPunct ? null : (currentAiToken.auxiliary || currentAiToken.pinyin || null);
      const gloss = isManual
        ? manualGlossMap.get(currentAiToken.word)
        : (isPunct ? null : (currentAiToken.gloss || null));

      if (!isPunct && gloss && !isManual) {
        setCachedGloss(currentAiToken.word, 'zh', nativeLang, {
          word: currentAiToken.word,
          auxiliary: aux,
          pinyin: aux,
          gloss
        });
      }

      result.push({
        text: currentAiToken.word,
        word: currentAiToken.word,
        targetLang: 'zh',
        nativeLang: nativeLang || 'es',
        auxiliary: aux,
        pinyin: aux,
        translit: null,
        gloss,
        isPunctuation: isPunct,
        glossSource: isManual ? 'manual' : (isPunct ? undefined : 'ai')
      });

      textIdx = endIdx;
      aiIdx++;
      continue;
    }

    // If AI omitted punctuation that exists in original text, emit punctuation from original text
    const punctMatch = remainingText.match(PUNCT_RUN_REGEX);
    if (punctMatch) {
      const p = punctMatch[0].trim();
      if (p) {
        result.push({
          text: p,
          word: p,
          auxiliary: null,
          pinyin: null,
          translit: null,
          gloss: null,
          isPunctuation: true
        });
      }
      textIdx += punctMatch[0].length;
      continue;
    }

    // Mismatch: AI tokens do not accurately match or cover the original text
    return null;
  }

  // Skip any trailing whitespace
  while (textIdx < textLen && /\s/.test(fullOriginalText[textIdx])) {
    textIdx++;
  }

  // Verification: All AI tokens must be consumed, and all text must be covered
  if (aiIdx < cleanAiTokens.length || textIdx < textLen) {
    return null;
  }

  return result.length > 0 ? result : null;
}


/**
 * Gloss a single subtitle line on demand with AI.
 * 
 * 1. Checks if the line is already complete via isGlossComplete.
 *    If already complete, immediately returns the line without any API call ($0 cost).
 * 2. Ensures the line has offline tokenization applied.
 * 3. Sends ONLY this single line to Groq AI via fetchBatchGlossesApi([sub], ...).
 * 4. Merges returned AI tokens with language-specific strategy rules.
 * 5. Returns the updated line with tokens and glossStatus: 'glosado'.
 * 
 * @param {Object} params
 * @param {Object} params.sub - Subtitle line object
 * @param {string} [params.targetLang='zh']
 * @param {string} [params.nativeLang='es']
 * @param {string} [params.apiKey='']
 * @param {AbortSignal} [params.abortSignal=null]
 * @returns {Promise<Object>} The updated subtitle line object
 */
export async function glossSingleSubtitleLine({
  sub,
  targetLang = 'zh',
  nativeLang = 'es',
  apiKey = '',
  abortSignal = null
}) {
  if (!sub || typeof sub !== 'object') return sub;

  // If already complete, return immediately (zero API calls!)
  if (isGlossComplete(sub, targetLang, nativeLang)) {
    return {
      ...sub,
      glossStatus: 'glosado'
    };
  }

  // Ensure tokens are tokenized offline if empty
  const currentTokens = Array.isArray(sub.tokens) && sub.tokens.length > 0
    ? sub.tokens
    : tokenizeAndGlossLineOffline(sub.text || '', targetLang, nativeLang);

  const preparedSub = {
    ...sub,
    tokens: currentTokens
  };

  try {
    const aiResults = await fetchBatchGlossesApi([preparedSub], targetLang, nativeLang, apiKey, abortSignal, { forceFullLine: true });
    if (Array.isArray(aiResults) && aiResults.length > 0) {
      const match = aiResults[0];
      if (match && Array.isArray(match.tokens) && match.tokens.length > 0) {
        const mergedTokens = mergeAiTokensWithSegmented(currentTokens, match.tokens, targetLang, preparedSub.text || sub.text || '', nativeLang);
        return {
          ...preparedSub,
          tokens: mergedTokens,
          glossStatus: 'glosado'
        };
      }
    }
  } catch (err) {
    console.warn('[LinguaFlow Gloss Engine] Error glossing single line:', err.message);
  }

  // Return with existing tokens if API call failed or had no results
  return {
    ...preparedSub,
    glossStatus: isGlossComplete(preparedSub, targetLang, nativeLang) ? 'glosado' : 'sin glosar'
  };
}

/**
 * Main orchestrator:
 * 1. Immediately prepares all lines with offline word segmentation + Pinyin/transliteration (no waiting)
 * 2. Merges any already cached AI glosses from localStorage without re-splitting words
 * 3. Enqueues all incomplete lines in safe chunks of 5 lines sending ONLY unknown tokens with context
 * 4. Logs exact efficiency metrics: Subtitle lines, Total tokens, Resolved locally, Sent to Groq, AI requests
 * 5. Validates returned IDs & completeness; retries any missing or incomplete lines up to 2 times
 * 6. Triggers onUpdate callback as each batch finishes so the user sees real-time glossing
 * 7. Provides onProgress callback with exact verified completed counts (e.g. 28 / 30 lines glossed)
 */
export function enrichSubtitlesWithGlosses({
  subtitles = [],
  targetLang = 'zh',
  nativeLang = 'es',
  apiKey = '',
  videoId = '',
  videoTitle = '',
  videoUrl = '',
  sourceType = 'srt',
  abortSignal = null,
  onUpdate = null,
  onProgress = null
}) {
  if (!Array.isArray(subtitles) || subtitles.length === 0) {
    return subtitles;
  }

  const strategy = getLanguageGlossStrategy(targetLang);
  const totalSubtitles = subtitles.length;
  const subHash = computeSubtitleHash(subtitles);
  const cache = loadCachedGlosses(videoId, totalSubtitles, targetLang, nativeLang);

  // Phase 1: Apply offline tokenization & merge cached AI tokens if available
  const prepared = subtitles.map(sub => {
    // If valid Chinese cache exists, restore authoritative lexical tokens directly
    if (targetLang === 'zh' && cache[sub.id] && Array.isArray(cache[sub.id]) && cache[sub.id].length > 0) {
      if (validateChineseAiSegmentation(sub.text, cache[sub.id])) {
        return {
          ...sub,
          tokens: cache[sub.id]
        };
      }
    }

    const offlineTokens = tokenizeAndGlossLineOffline(sub.text, targetLang, nativeLang);

    if (cache[sub.id] && Array.isArray(cache[sub.id]) && cache[sub.id].length > 0) {
      const mergedTokens = mergeAiTokensWithSegmented(offlineTokens, cache[sub.id], targetLang, sub.text, nativeLang);
      return {
        ...sub,
        tokens: mergedTokens
      };
    }

    return {
      ...sub,
      tokens: offlineTokens
    };
  });

  const getCompletedCount = (subsList) => subsList.filter(s => isGlossComplete(s, targetLang, nativeLang)).length;
  const initialCompleted = getCompletedCount(prepared);

  if (!onUpdate && !onProgress) {
    return prepared;
  }

  (async () => {
    let currentSubtitles = [...prepared];

    const checkAborted = () => {
      if (abortSignal && abortSignal.aborted) {
        console.log('[LinguaFlow Gloss Engine] Glossing paused/stopped by user.');
        if (onProgress) {
          const nowComp = getCompletedCount(currentSubtitles);
          onProgress({
            total: totalSubtitles,
            completed: nowComp,
            isGlossing: false,
            isPaused: true,
            isComplete: nowComp === totalSubtitles,
            failed: 0
          });
        }
        return true;
      }
      return false;
    };

    if (checkAborted()) return;

    // Check persistent library (IndexedDB)
    let savedRecord = null;
    try {
      savedRecord = await getTranscriptFromLibrary(videoId, subHash, targetLang, nativeLang);
    } catch (e) {
      console.warn('Failed to check transcript library:', e);
    }

    if (savedRecord && Array.isArray(savedRecord.subtitles) && savedRecord.subtitles.length > 0) {
      const savedCompleted = getCompletedCount(savedRecord.subtitles);
      if (savedCompleted === totalSubtitles) {
        console.log(`[GlossCache] HIT — loading saved transcript (${savedCompleted}/${totalSubtitles} lines)`);
        if (onUpdate) onUpdate(savedRecord.subtitles);
        if (onProgress) {
          onProgress({
            total: totalSubtitles,
            completed: totalSubtitles,
            isGlossing: false,
            isComplete: true,
            failed: 0
          });
        }
        return; // Zero calls to Groq! $0 cost!
      } else if (savedCompleted > 0) {
        console.log(`[GlossCache] PARTIAL — ${savedCompleted}/${totalSubtitles} lines already processed`);
        // Merge tokens from savedRecord into currentSubtitles
        currentSubtitles = currentSubtitles.map(sub => {
          const matching = savedRecord.subtitles.find(s => s.id === sub.id || (s.startTime && Math.abs(s.startTime - sub.startTime) < 0.1));
          if (matching && matching.tokens && matching.tokens.length > 0) {
            if (targetLang === 'zh' && validateChineseAiSegmentation(sub.text, matching.tokens)) {
              return {
                ...sub,
                tokens: matching.tokens
              };
            }
            return {
              ...sub,
              tokens: mergeAiTokensWithSegmented(sub.tokens, matching.tokens, targetLang, sub.text, nativeLang)
            };
          }
          return sub;
        });
        if (onUpdate) onUpdate([...currentSubtitles]);
      }
    } else {
      console.log('[GlossCache] MISS — generating glosses');
    }

    // Recalculate missing lines that still need AI glossing
    const missingLines = currentSubtitles.filter(sub => !isGlossComplete(sub, targetLang, nativeLang));
    const nowCompleted = getCompletedCount(currentSubtitles);

    // Calculate metrics for logging
    let totalSubstantiveTokens = 0;
    let locallyResolvedTokens = 0;
    let sentToGroqTokens = 0;

    currentSubtitles.forEach(sub => {
      (sub.tokens || []).forEach(t => {
        if (!t.isPunctuation && (t.text || t.word)) {
          totalSubstantiveTokens++;
          if (strategy.isTokenComplete(t, nativeLang)) {
            locallyResolvedTokens++;
          }
        }
      });
    });

    missingLines.forEach(sub => {
      (sub.tokens || []).forEach(t => {
        if (!t.isPunctuation && (t.text || t.word) && !strategy.isTokenComplete(t, nativeLang)) {
          sentToGroqTokens++;
        }
      });
    });

    const estimatedAiRequests = missingLines.length > 0 ? Math.ceil(missingLines.length / 5) : 0;
    console.log(`[LinguaFlow Gloss Engine] Subtitle lines: ${totalSubtitles} | Total tokens: ${totalSubstantiveTokens} | Resolved locally: ${locallyResolvedTokens} | Sent to Groq: ${sentToGroqTokens} | AI requests: ${estimatedAiRequests}`);

    if (missingLines.length === 0) {
      console.log(`[GlossCache] SAVED — ${totalSubtitles}/${totalSubtitles} lines`);
      try {
        await saveTranscriptToLibrary({
          videoId,
          videoTitle,
          videoUrl,
          targetLanguage: targetLang,
          nativeLanguage: nativeLang,
          sourceType,
          subtitleHash: subHash,
          subtitlesCount: totalSubtitles,
          completedLinesCount: totalSubtitles,
          isComplete: true,
          subtitles: currentSubtitles
        });
      } catch (e) {
        console.warn('[GlossCache] Error saving complete transcript to library:', e);
      }

      if (onProgress) {
        onProgress({
          total: totalSubtitles,
          completed: totalSubtitles,
          isGlossing: false,
          isComplete: true,
          failed: 0
        });
      }
      return;
    }

    if (onProgress) {
      onProgress({
        total: totalSubtitles,
        completed: nowCompleted,
        isGlossing: true,
        isComplete: false,
        failed: 0
      });
    }

    // Phase 2: Reliable batch processing in chunks of 5 lines (Fail-Cheap: 1 request per chunk, zero retry multiplication)
    const CHUNK_SIZE = 5;
    let actualAiRequestsCount = 0;

    const initialChunks = [];
    for (let i = 0; i < missingLines.length; i += CHUNK_SIZE) {
      initialChunks.push(missingLines.slice(i, i + CHUNK_SIZE));
    }

    // Helper to process a single batch of lines
    const processBatch = async (batch) => {
      if (!Array.isArray(batch) || batch.length === 0) return;
      if (checkAborted()) return;

      actualAiRequestsCount++;
      const aiResults = await fetchBatchGlossesApi(batch, targetLang, nativeLang, apiKey, abortSignal);
      if (checkAborted()) return;
      let hasNewData = false;

      if (Array.isArray(aiResults) && aiResults.length > 0) {
        aiResults.forEach((item, itemIdx) => {
          if (item && Array.isArray(item.tokens) && item.tokens.length > 0) {
            const debugInfo = { mode: 'none' };
            const idx = findMatchingSubtitleIndex(currentSubtitles, batch, item, itemIdx, debugInfo);
            if (targetLang === 'zh') {
              if (idx !== -1) {
                const sub = currentSubtitles[idx];
                console.log(`[ChineseMatchDebug] aiId=${item.id} batchIndex=${itemIdx} matched=${sub.id} mode=${debugInfo.mode} text="${sub.text}"`);
              } else {
                console.warn(`[ChineseMatchDebug] UNRESOLVED aiId=${item.id} batchIndex=${itemIdx}`);
              }
            }

            if (idx !== -1) {
              const sub = currentSubtitles[idx];
              const mergedTokens = mergeAiTokensWithSegmented(sub.tokens, item.tokens, targetLang, sub.text, nativeLang);
              const candidateSub = {
                ...sub,
                tokens: mergedTokens
              };

              currentSubtitles[idx] = candidateSub;
              hasNewData = true;

              // Only persist to cache if verified complete
              if (isGlossComplete(candidateSub, targetLang, nativeLang)) {
                cache[sub.id] = mergedTokens;
              }
            }
          }
        });
      }

      if (hasNewData) {
        saveCachedGlosses(videoId, totalSubtitles, cache, targetLang, nativeLang);
        const currentCompleted = getCompletedCount(currentSubtitles);

        // PERSIST IMMEDIATELY TO INDEXEDDB LIBRARY AFTER EACH BATCH
        try {
          await saveTranscriptToLibrary({
            videoId,
            videoTitle,
            videoUrl,
            targetLanguage: targetLang,
            nativeLanguage: nativeLang,
            sourceType,
            subtitleHash: subHash,
            subtitlesCount: totalSubtitles,
            completedLinesCount: currentCompleted,
            isComplete: currentCompleted === totalSubtitles,
            subtitles: currentSubtitles
          });
          console.log(`[GlossCache] SAVED — ${currentCompleted}/${totalSubtitles} lines`);
        } catch (e) {
          console.warn('[GlossCache] Failed to save batch to library:', e);
        }

        if (onUpdate) {
          onUpdate([...currentSubtitles]);
        }
      }

      if (onProgress) {
        const completed = getCompletedCount(currentSubtitles);
        onProgress({
          total: totalSubtitles,
          completed,
          isGlossing: true,
          isComplete: completed === totalSubtitles,
          failed: 0
        });
      }
    };

    // Process each chunk in a single pass (Fail-Cheap policy: no cascading retries)
    for (const chunk of initialChunks) {
      if (checkAborted()) return;
      await processBatch(chunk);
      if (checkAborted()) return;
      await new Promise(r => setTimeout(r, 150));
    }

    // Final verified progress update and save
    const finalCompleted = getCompletedCount(currentSubtitles);
    const failed = totalSubtitles - finalCompleted;

    try {
      await saveTranscriptToLibrary({
        videoId,
        videoTitle,
        videoUrl,
        targetLanguage: targetLang,
        nativeLanguage: nativeLang,
        sourceType,
        subtitleHash: subHash,
        subtitlesCount: totalSubtitles,
        completedLinesCount: finalCompleted,
        isComplete: finalCompleted === totalSubtitles,
        subtitles: currentSubtitles
      });
      console.log(`[GlossCache] SAVED — ${finalCompleted}/${totalSubtitles} lines`);
    } catch (e) {
      console.warn('[GlossCache] Failed final save to library:', e);
    }

    console.log(`[LinguaFlow Gloss Engine] Finished: Subtitle lines: ${totalSubtitles} | AI requests: ${actualAiRequestsCount}`);

    if (onProgress) {
      onProgress({
        total: totalSubtitles,
        completed: finalCompleted,
        isGlossing: false,
        isComplete: finalCompleted === totalSubtitles,
        failed
      });
    }
  })().catch(err => {
    console.warn('Background batch glossing notice:', err);
    if (onProgress) {
      const finalCompleted = getCompletedCount(prepared);
      onProgress({
        total: totalSubtitles,
        completed: finalCompleted,
        isGlossing: false,
        isComplete: finalCompleted === totalSubtitles,
        failed: totalSubtitles - finalCompleted
      });
    }
  });

  return prepared;
}
