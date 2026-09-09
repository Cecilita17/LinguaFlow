/**
 * Supported Target Languages (Filtered strictly to requested languages)
 */

export const SUPPORTED_LANGUAGES = [
  { code: 'ar', name: 'Árabe', englishName: 'Arabic', native: 'العربية', speechCode: 'ar-SA', hasTranslit: true, translitName: 'Romanización', rtl: true },
  { code: 'zh', name: 'Chino Mandarín', englishName: 'Mandarin Chinese', native: '中文 (普通话)', speechCode: 'zh-CN', hasTranslit: true, translitName: 'Pinyin' },
  { code: 'pl', name: 'Polaco', englishName: 'Polish', native: 'Polski', speechCode: 'pl-PL', hasTranslit: false },
  { code: 'ru', name: 'Ruso', englishName: 'Russian', native: 'Русский', speechCode: 'ru-RU', hasTranslit: true, translitName: 'Romanización' },
  { code: 'nl', name: 'Nederlands', englishName: 'Dutch', native: 'Nederlands', speechCode: 'nl-NL', hasTranslit: false },
  { code: 'de', name: 'Alemán', englishName: 'German', native: 'Deutsch', speechCode: 'de-DE', hasTranslit: false },
  { code: 'fr', name: 'Francés', englishName: 'French', native: 'Français', speechCode: 'fr-FR', hasTranslit: false },
  { code: 'it', name: 'Italiano', englishName: 'Italian', native: 'Italiano', speechCode: 'it-IT', hasTranslit: false }
];

/**
 * Heuristic diffing algorithm between original string and corrected string
 */
export function computeWordDiff(original, corrected) {
  const origWords = original.trim().split(/\s+/);
  const corrWords = corrected.trim().split(/\s+/);
  const diffTokens = [];

  let i = 0;
  let j = 0;

  while (i < origWords.length || j < corrWords.length) {
    const orig = origWords[i] || '';
    const corr = corrWords[j] || '';

    // Normalize for punctuation
    const cleanOrig = orig.toLowerCase().replace(/^[^\w\u00C0-\u024F\u0400-\u04FF\u0600-\u06FF\u4E00-\u9FFF]+|[^\w\u00C0-\u024F\u0400-\u04FF\u0600-\u06FF\u4E00-\u9FFF]+$/g, '');
    const cleanCorr = corr.toLowerCase().replace(/^[^\w\u00C0-\u024F\u0400-\u04FF\u0600-\u06FF\u4E00-\u9FFF]+|[^\w\u00C0-\u024F\u0400-\u04FF\u0600-\u06FF\u4E00-\u9FFF]+$/g, '');

    if (cleanOrig === cleanCorr && cleanOrig.length > 0) {
      diffTokens.push({
        text: (diffTokens.length > 0 ? ' ' : '') + corr,
        changed: false,
        original: null
      });
      i++;
      j++;
    } else {
      // Changed word! Highlight
      diffTokens.push({
        text: (diffTokens.length > 0 ? ' ' : '') + (corr || ''),
        changed: true,
        original: orig || null
      });
      i++;
      j++;
    }
  }

  return diffTokens;
}
