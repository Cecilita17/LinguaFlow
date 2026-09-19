/**
 * Standalone Live Call Gloss Service for LinguaFlow
 * Provides interlinear word-by-word glossing and transliteration strictly for Live Calls.
 *
 * Language Rules:
 * - Arabic ('ar'): Transliteration strictly on Tier 1 (auxiliary), Arabic text on Tier 2, gloss on Tier 3.
 * - Chinese ('zh'): Tone-marked Pinyin strictly on Tier 1 (auxiliary), Hanzi text on Tier 2, gloss on Tier 3.
 * - All other languages: Strictly NO transliteration (auxiliary: null, pinyin: null, translit: null).
 *
 * Completely decoupled from Readers and Chat.
 */

import {
  tokenizeAndGlossLineOffline,
  fetchBatchGlossesApi,
  mergeAiTokensWithSegmented,
  getEffectiveApiKey,
  PUNCTUATION_REGEX
} from './subtitleGlossService.js';
import { getArabicTransliteration } from './arabicTransliteration.js';
import { CHINESE_OFFLINE_DICT } from './languageGlossStrategies.js';
import { computeWordDiff } from './diffUtils.js';

/**
 * Tokenize a live call turn into interlinear units.
 * Guarantees zero latency (0ms offline execution) with accurate Tier 1 transliteration for Arabic & Chinese.
 */
export function tokenizeLiveCallTurn(text, targetLang = 'es', diffTokens = null, nativeLang = 'es') {
  if (!text || typeof text !== 'string') return [];
  const clean = text.trim();
  if (!clean) return [];

  const isArabic = targetLang === 'ar';
  const isChinese = targetLang === 'zh';

  let baseTokens = tokenizeAndGlossLineOffline(clean, targetLang, nativeLang);

  if (!Array.isArray(baseTokens) || baseTokens.length === 0) {
    const parts = clean.split(/\s+/).filter(Boolean);
    baseTokens = parts.map(w => ({
      text: w,
      word: w,
      auxiliary: isArabic ? getArabicTransliteration(w) : null,
      pinyin: null,
      translit: isArabic ? getArabicTransliteration(w) : null,
      gloss: null,
      isPunctuation: PUNCTUATION_REGEX.test(w)
    }));
  }

  // Enforce strict language transliteration boundaries
  baseTokens = baseTokens.map(token => {
    const w = token.text || token.word || '';
    const isPunct = token.isPunctuation || PUNCTUATION_REGEX.test(w);

    if (isPunct) {
      return {
        ...token,
        auxiliary: null,
        pinyin: null,
        translit: null,
        isPunctuation: true
      };
    }

    if (isArabic) {
      const translit = token.auxiliary || token.translit || getArabicTransliteration(w);
      return {
        ...token,
        auxiliary: translit,
        translit: translit,
        pinyin: null
      };
    }

    if (isChinese) {
      const pinyin = token.auxiliary || token.pinyin || token.translit || CHINESE_OFFLINE_DICT[w]?.pinyin || null;
      return {
        ...token,
        auxiliary: pinyin,
        pinyin: pinyin,
        translit: pinyin
      };
    }

    // ALL other languages: strictly NO transliteration
    return {
      ...token,
      auxiliary: null,
      pinyin: null,
      translit: null
    };
  });

  // Map pedagogical diff tags (changed, original) onto tokens if present
  if (Array.isArray(diffTokens) && diffTokens.length > 0) {
    if (isChinese) {
      baseTokens = mapChineseDiffTokensOntoTokens(baseTokens, diffTokens);
    } else {
      baseTokens = mapDiffTokensOntoTokens(baseTokens, diffTokens);
    }
  }

  return baseTokens.map((t) => ({
    ...t,
    changed: Boolean(t.changed),
    original: t.original || null
  }));
}

const cleanDiffWord = (w) => (w || '').replace(/^[^\w\u00C0-\u024F\u0400-\u04FF\u0600-\u06FF\u4E00-\u9FFF]+|[^\w\u00C0-\u024F\u0400-\u04FF\u0600-\u06FF\u4E00-\u9FFF]+$/g, '').toLowerCase();
const cleanDiffOriginal = (w) => (w || '').replace(/^[^\w\u00C0-\u024F\u0400-\u04FF\u0600-\u06FF\u4E00-\u9FFF]+|[^\w\u00C0-\u024F\u0400-\u04FF\u0600-\u06FF\u4E00-\u9FFF]+$/g, '');

/**
 * Maps diffTokens annotations (changed, original) onto Chinese tokens with character-level precision.
 */
function mapChineseDiffTokensOntoTokens(tokens, diffTokens) {
  if (!Array.isArray(tokens) || !Array.isArray(diffTokens)) return tokens;

  // Flatten diff tokens into character-level entries
  const diffCharEntries = [];
  diffTokens.forEach((dt) => {
    const rawText = dt.text || '';
    if (!rawText) return;
    const isChanged = Boolean(dt.changed);
    const orig = dt.original ? cleanDiffOriginal(dt.original) : null;
    for (const c of rawText) {
      if (c.trim()) {
        diffCharEntries.push({
          char: c,
          changed: isChanged,
          original: orig
        });
      }
    }
  });

  if (diffCharEntries.length === 0 || !diffCharEntries.some((d) => d.changed)) return tokens;

  let charIdx = 0;
  return tokens.map((t) => {
    const w = (t.text || t.word || '').trim();
    const isPunct = t.isPunctuation || PUNCTUATION_REGEX.test(w);

    if (isPunct) {
      if (charIdx < diffCharEntries.length && diffCharEntries[charIdx].char === w) {
        charIdx++;
      }
      return {
        ...t,
        changed: false,
        original: null
      };
    }

    let tokenChanged = false;
    let tokenOriginals = [];

    for (const c of w) {
      if (charIdx < diffCharEntries.length) {
        const entry = diffCharEntries[charIdx];
        if (entry.changed) {
          tokenChanged = true;
          if (entry.original && !tokenOriginals.includes(entry.original)) {
            tokenOriginals.push(entry.original);
          }
        }
        charIdx++;
      }
    }

    return {
      ...t,
      changed: tokenChanged,
      original: tokenOriginals.length > 0 ? tokenOriginals.join('') : (tokenChanged ? t.original || null : null)
    };
  });
}

/**
 * Maps diffTokens annotations (changed, original) from grammar corrections onto tokens
 */
function mapDiffTokensOntoTokens(tokens, diffTokens) {
  if (!Array.isArray(tokens) || !Array.isArray(diffTokens)) return tokens;

  // Flatten diff tokens that might contain multiple words into individual word diff entries
  const flattenedDiffs = [];
  diffTokens.forEach((dt) => {
    if (!dt.text && dt.original) {
      // Deletion
      return;
    }
    const words = (dt.text || '').trim().split(/\s+/).filter(Boolean);
    if (words.length === 0) return;

    if (words.length === 1) {
      flattenedDiffs.push({
        word: cleanDiffWord(words[0]),
        rawText: words[0],
        changed: Boolean(dt.changed),
        original: dt.original ? cleanDiffOriginal(dt.original) : null
      });
    } else {
      // Multi-word replacement
      words.forEach((w, idx) => {
        flattenedDiffs.push({
          word: cleanDiffWord(w),
          rawText: w,
          changed: Boolean(dt.changed),
          original: idx === 0 && dt.original ? cleanDiffOriginal(dt.original) : (dt.original ? cleanDiffOriginal(dt.original) : null)
        });
      });
    }
  });

  if (flattenedDiffs.length === 0 || !flattenedDiffs.some((d) => d.changed)) return tokens;

  // Map sequentially onto non-punctuation tokens
  let diffIdx = 0;
  return tokens.map((t) => {
    if (t.isPunctuation) {
      return t;
    }

    const tokenWord = cleanDiffWord(t.text || t.word || '');
    if (!tokenWord) return t;

    // Look for matching diff token at or near diffIdx
    let matchedDiff = null;
    if (diffIdx < flattenedDiffs.length && flattenedDiffs[diffIdx].word === tokenWord) {
      matchedDiff = flattenedDiffs[diffIdx];
      diffIdx++;
    } else {
      // Fallback search forward slightly in case of slight alignment offset
      for (let k = diffIdx; k < Math.min(flattenedDiffs.length, diffIdx + 3); k++) {
        if (flattenedDiffs[k].word === tokenWord) {
          matchedDiff = flattenedDiffs[k];
          diffIdx = k + 1;
          break;
        }
      }
    }

    if (matchedDiff && matchedDiff.changed) {
      return {
        ...t,
        changed: true,
        original: matchedDiff.original
      };
    }

    return {
      ...t,
      changed: false,
      original: null
    };
  });
}

/**
 * Asynchronously fetch AI word-by-word glosses for a single live call turn.
 * Non-blocking, isolated, and preserves diff annotations and transliterations.
 */
export async function glossLiveCallTurnAsync({
  turnId,
  text,
  tokens = [],
  targetLang = 'es',
  nativeLang = 'es',
  apiKey = '',
  abortSignal = null
}) {
  if (!text || !text.trim()) return tokens;
  const isArabic = targetLang === 'ar';
  const isChinese = targetLang === 'zh';

  const preparedTokens = Array.isArray(tokens) && tokens.length > 0
    ? tokens
    : tokenizeLiveCallTurn(text, targetLang, null, nativeLang);

  try {
    const linePayload = {
      id: turnId || `turn-${Date.now()}`,
      text: text.trim(),
      tokens: preparedTokens
    };

    const effectiveKey = getEffectiveApiKey(apiKey);
    const aiResults = await fetchBatchGlossesApi([linePayload], targetLang, nativeLang, effectiveKey, abortSignal);

    if (Array.isArray(aiResults) && aiResults.length > 0) {
      const item = aiResults[0];
      if (item && Array.isArray(item.tokens) && item.tokens.length > 0) {
        const merged = mergeAiTokensWithSegmented(preparedTokens, item.tokens, targetLang, text, nativeLang);

        // Preserve any changed/original flags from preparedTokens
        const changedTokensMap = new Map();
        preparedTokens.forEach(pt => {
          if (pt.changed && pt.text) {
            changedTokensMap.set(pt.text.trim().toLowerCase(), pt);
          }
        });

        // For Chinese, build character-level index sets of changed positions
        const chineseChangedCharIndices = new Set();
        const chineseOriginalsMap = new Map();
        if (isChinese) {
          let charOffset = 0;
          preparedTokens.forEach(pt => {
            const ptText = (pt.text || pt.word || '').trim();
            const isPunct = pt.isPunctuation || PUNCTUATION_REGEX.test(ptText);
            if (!isPunct) {
              for (let ci = 0; ci < ptText.length; ci++) {
                if (pt.changed) {
                  chineseChangedCharIndices.add(charOffset + ci);
                  if (pt.original) {
                    chineseOriginalsMap.set(charOffset + ci, pt.original);
                  }
                }
              }
              charOffset += ptText.length;
            }
          });
        }

        let mergedChineseCharOffset = 0;
        return merged.map(t => {
          const w = (t.text || t.word || '').trim();
          const wLower = w.toLowerCase();
          const isPunct = t.isPunctuation || PUNCTUATION_REGEX.test(w);

          let baseWithDiff = t;

          if (isChinese && !isPunct) {
            let tokenIsChanged = false;
            let tokenOriginal = null;
            for (let ci = 0; ci < w.length; ci++) {
              if (chineseChangedCharIndices.has(mergedChineseCharOffset + ci)) {
                tokenIsChanged = true;
                if (!tokenOriginal && chineseOriginalsMap.has(mergedChineseCharOffset + ci)) {
                  tokenOriginal = chineseOriginalsMap.get(mergedChineseCharOffset + ci);
                }
              }
            }
            mergedChineseCharOffset += w.length;

            if (tokenIsChanged) {
              baseWithDiff = {
                ...t,
                changed: true,
                original: tokenOriginal || null
              };
            }
          } else {
            const changedInfo = changedTokensMap.get(wLower);
            if (changedInfo) {
              baseWithDiff = {
                ...t,
                changed: true,
                original: changedInfo.original
              };
            }
          }

          if (isArabic && !t.isPunctuation) {
            const translit = t.auxiliary || t.translit || getArabicTransliteration(w);
            return {
              ...baseWithDiff,
              auxiliary: translit,
              translit: translit,
              pinyin: null
            };
          }

          if (isChinese && !t.isPunctuation) {
            const pinyin = t.auxiliary || t.pinyin || t.translit || CHINESE_OFFLINE_DICT[w]?.pinyin || null;
            return {
              ...baseWithDiff,
              auxiliary: pinyin,
              pinyin: pinyin,
              translit: pinyin
            };
          }

          if (!isArabic && !isChinese) {
            return {
              ...baseWithDiff,
              auxiliary: null,
              pinyin: null,
              translit: null
            };
          }

          return baseWithDiff;
        });
      }
    }
  } catch (err) {
    console.warn('[LiveCallGloss] Async glossing notice:', err);
  }

  return preparedTokens;
}

/**
 * Extract line-level transliteration string from tokens strictly for Arabic & Chinese.
 * Returns null for any other language.
 */
export function extractTurnTransliteration(tokens, targetLang) {
  if (!Array.isArray(tokens) || tokens.length === 0) return null;
  const isArabic = targetLang === 'ar';
  const isChinese = targetLang === 'zh';
  if (!isArabic && !isChinese) return null;

  const translitParts = tokens
    .filter(t => !t.isPunctuation)
    .map(t => t.auxiliary || t.translit || t.pinyin || '')
    .filter(Boolean);

  return translitParts.length > 0 ? translitParts.join(' ') : null;
}

/**
 * Extract glosses array from tokens.
 */
export function extractTurnGlosses(tokens) {
  if (!Array.isArray(tokens) || tokens.length === 0) return [];
  return tokens.map(t => t.gloss || null);
}

/**
 * Parses and tokenizes an AI response in Integrated Correction Mode.
 * Identifies <correction>...</correction> tags, computes word diff against userPrompt,
 * and sets changed: true on modified/translated words inside the reconstructed sentence.
 */
export function parseIntegratedCorrectionTokens(rawAiText, userPrompt = '', targetLang = 'es', nativeLang = 'es') {
  if (!rawAiText || typeof rawAiText !== 'string') return [];

  const match = rawAiText.match(/<correction>([\s\S]*?)(?:<\/correction>|$)/i);
  if (!match) {
    const cleanText = rawAiText.replace(/<\/?correction>/gi, '').trim();
    return tokenizeLiveCallTurn(cleanText, targetLang, null, nativeLang);
  }

  const corrPhrase = match[1].trim();
  const beforeText = rawAiText.slice(0, match.index).replace(/<\/?correction>/gi, '');
  const afterText = rawAiText.slice(match.index + match[0].length).replace(/<\/?correction>/gi, '');

  const beforeTokens = beforeText ? tokenizeLiveCallTurn(beforeText, targetLang, null, nativeLang) : [];
  const afterTokens = afterText ? tokenizeLiveCallTurn(afterText, targetLang, null, nativeLang) : [];

  // Compute diff against userPrompt for the correction span
  const diffTokens = corrPhrase ? computeWordDiff(userPrompt || '', corrPhrase) : [];
  const corrTokens = corrPhrase ? tokenizeLiveCallTurn(corrPhrase, targetLang, diffTokens, nativeLang) : [];

  return [...beforeTokens, ...corrTokens, ...afterTokens];
}
