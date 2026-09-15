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
  PUNCTUATION_REGEX
} from './subtitleGlossService.js';
import { getArabicTransliteration } from './arabicTransliteration.js';
import { CHINESE_OFFLINE_DICT } from './languageGlossStrategies.js';

/**
 * Tokenize a live call turn into interlinear units.
 * Guarantees zero latency (0ms offline execution) with accurate Tier 1 transliteration for Arabic & Chinese.
 */
export function tokenizeLiveCallTurn(text, targetLang = 'es', diffTokens = null) {
  if (!text || typeof text !== 'string') return [];
  const clean = text.trim();
  if (!clean) return [];

  const isArabic = targetLang === 'ar';
  const isChinese = targetLang === 'zh';

  let baseTokens = tokenizeAndGlossLineOffline(clean, targetLang);

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
    baseTokens = mapDiffTokensOntoTokens(baseTokens, diffTokens);
  }

  return baseTokens;
}

/**
 * Maps diffTokens annotations (changed, original) from grammar corrections onto tokens
 */
function mapDiffTokensOntoTokens(tokens, diffTokens) {
  if (!Array.isArray(tokens) || !Array.isArray(diffTokens)) return tokens;

  const changedMap = new Map();
  diffTokens.forEach(dt => {
    if (dt.changed && dt.text) {
      const cleanW = dt.text.trim().toLowerCase();
      changedMap.set(cleanW, dt);
    }
  });

  if (changedMap.size === 0) return tokens;

  return tokens.map(t => {
    const w = (t.text || t.word || '').trim().toLowerCase();
    const diff = changedMap.get(w);
    if (diff) {
      return {
        ...t,
        changed: true,
        original: diff.original
      };
    }
    return t;
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
    : tokenizeLiveCallTurn(text, targetLang);

  try {
    const linePayload = {
      id: turnId || `turn-${Date.now()}`,
      text: text.trim(),
      tokens: preparedTokens
    };

    const aiResults = await fetchBatchGlossesApi([linePayload], targetLang, nativeLang, apiKey, abortSignal);

    if (Array.isArray(aiResults) && aiResults.length > 0) {
      const item = aiResults[0];
      if (item && Array.isArray(item.tokens) && item.tokens.length > 0) {
        const merged = mergeAiTokensWithSegmented(preparedTokens, item.tokens, targetLang, text);

        // Preserve any changed/original flags from preparedTokens
        const changedTokensMap = new Map();
        preparedTokens.forEach(pt => {
          if (pt.changed && pt.text) {
            changedTokensMap.set(pt.text.trim().toLowerCase(), pt);
          }
        });

        return merged.map(t => {
          const w = (t.text || t.word || '').trim();
          const wLower = w.toLowerCase();
          const changedInfo = changedTokensMap.get(wLower);

          const baseWithDiff = changedInfo
            ? { ...t, changed: true, original: changedInfo.original }
            : t;

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
