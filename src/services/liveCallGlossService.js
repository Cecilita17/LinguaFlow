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

const cleanDiffWord = (w) => (w || '').replace(/^[^\w\u00C0-\u024F\u0400-\u04FF\u0600-\u06FF\u4E00-\u9FFF]+|[^\w\u00C0-\u024F\u0400-\u04FF\u0600-\u06FF\u4E00-\u9FFF]+$/g, '').toLowerCase();
const cleanDiffOriginal = (w) => (w || '').replace(/^[^\w\u00C0-\u024F\u0400-\u04FF\u0600-\u06FF\u4E00-\u9FFF]+|[^\w\u00C0-\u024F\u0400-\u04FF\u0600-\u06FF\u4E00-\u9FFF]+$/g, '');

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

const QUESTION_PATTERNS = {
  en: /^(who|what|where|when|why|how|which|whose|whom|is|are|am|was|were|do|does|did|can|could|would|should|will|shall|may|might|must|have|has|had|isn't|aren't|wasn't|weren't|don't|doesn't|didn't|can't|couldn't|won't|wouldn't|haven't|hasn't|hadn't)\b/i,
  es: /^([¿]?\s*(qu[eé]|cu[aá]l|cu[aá]les|qui[eé]n|qui[eé]nes|d[oó]nde|ad[oó]nde|cu[aá]ndo|por\s*qu[eé]|c[oó]mo|cu[aá]nto|cu[aá]nta|cu[aá]ntos|cu[aá]ntas|acaso)\b|\b(no\s*es\s*cierto|verdad|no)\s*$)/i,
  fr: /^(qui|que|quoi|o[uù]|quand|pourquoi|comment|combien|quel|quelle|quels|quelles|est-ce|es-tu|as-tu|avez-vous|pouvez-vous|peux-tu|faut-il)\b/i,
  de: /^(wer|was|wo|wann|warum|wie|woher|wohin|welche|welcher|welches|bist|sind|ist|war|hast|haben|hat|hatte|kannst|k[oö]nnen|kann|willst|wollen|will|m[oö]chtest|musst|m[uü]ssen)\b/i,
  it: /^(chi|che|cosa|dove|quando|perch[eé]|come|quanto|quanta|quanti|quante|quale|quali|sei|siete|[eè]|era|hai|hanno|ha|puoi|potete|vuoi|volete)\b/i,
  pt: /^(quem|o\s*que|que|qual|quais|onde|aonde|quando|por\s*que|por\s*qu[eê]|como|quanto|quanta|quantos|quantas|[eé]|s[aã]o|est[aá]|tem|voc[eê]\s*pode)\b/i,
  pl: /^(kto|co|gdzie|dok[aą]d|sk[aą]d|kiedy|dlaczego|czemu|jak|ile|ilu|jaki|jaka|jakie|czy|jak\s+si[eę]\s+masz)\b/i,
  ru: /^(кто|что|где|куда|откуда|когда|почему|зачем|как|сколько|какой|какая|какое|какие|разве|неужели|ли)\b/i,
  tr: /^(kim|ne|nerede|nereye|nereden|ne\s*zaman|neden|ni[cç]in|niye|nas[iı]l|ka[cç]|hangi|hangisi)\b|(\b(m[iımuü]|m[iımuü]s[iı]n|m[iımuü]y[iı]z)\s*$)/i,
  ar: /^([أا]?[يی]?[ن]?|[م]?ن|[م]?اذا|[م]?ا|[أا]ين|[م]?تى|[ل]?ماذا|[ك]?يف|[ك]?م|[ه]?ل|[أا]\b)/,
  zh: /(什么|哪儿|哪里|什么时候|为什么|怎么|怎样|多少|几|吗|呢|谁|是不是|能不能|可不可以|好不好)($|[？?])/
};

function capitalizeFirstLetter(text, lang) {
  if (!text) return '';
  if (lang === 'ar' || lang === 'zh') return text;
  if (text.startsWith('¿') || text.startsWith('¡')) {
    if (text.length > 1) {
      return text[0] + text[1].toUpperCase() + text.slice(2);
    }
    return text;
  }
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function detectIsQuestion(text, lang) {
  const pattern = QUESTION_PATTERNS[lang] || QUESTION_PATTERNS.en;
  if (pattern && pattern.test(text.trim())) {
    return true;
  }
  if (lang !== 'en' && QUESTION_PATTERNS.en.test(text.trim())) {
    return true;
  }
  return false;
}

/**
 * Zero-latency intelligent speech punctuation helper exclusively for Live Call voice messages.
 * Adds appropriate sentence-ending punctuation (. / ? / ! / ؟ / 。) and capitalizes sentences
 * without modifying words, translating, or altering vocabulary.
 */
export function punctuateSpeechTurn(rawText, lang = 'en') {
  if (!rawText || typeof rawText !== 'string') return '';
  let text = rawText.trim();
  if (!text) return '';

  const cleanLang = (lang || 'en').toLowerCase().slice(0, 2);

  // If text already ends with valid punctuation, preserve it and ensure casing
  if (/[.!?؟。！]$/.test(text)) {
    return capitalizeFirstLetter(text, cleanLang);
  }

  const isArabic = cleanLang === 'ar' || /[\u0600-\u06FF]/.test(text);
  const isChinese = cleanLang === 'zh' || /[\u4E00-\u9FFF]/.test(text);

  const isQuestion = detectIsQuestion(text, cleanLang);
  text = capitalizeFirstLetter(text, cleanLang);

  if (isArabic) {
    return text + (isQuestion ? '؟' : '.');
  }
  if (isChinese) {
    return text + (isQuestion ? '？' : '。');
  }
  return text + (isQuestion ? '?' : '.');
}
