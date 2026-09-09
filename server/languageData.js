/**
 * Supported Target Languages (Filtered strictly to requested languages)
 */

export const SUPPORTED_LANGUAGES = [
  { code: 'es', name: 'Español', englishName: 'Spanish', native: 'Español', speechCode: 'es-ES', hasTranslit: false },
  { code: 'en', name: 'Inglés', englishName: 'English', native: 'English', speechCode: 'en-US', hasTranslit: false },
  { code: 'nl', name: 'Nederlands', englishName: 'Dutch', native: 'Nederlands', speechCode: 'nl-NL', hasTranslit: false },
  { code: 'pl', name: 'Polaco', englishName: 'Polish', native: 'Polski', speechCode: 'pl-PL', hasTranslit: false },
  { code: 'de', name: 'Alemán', englishName: 'German', native: 'Deutsch', speechCode: 'de-DE', hasTranslit: false },
  { code: 'fr', name: 'Francés', englishName: 'French', native: 'Français', speechCode: 'fr-FR', hasTranslit: false },
  { code: 'it', name: 'Italiano', englishName: 'Italian', native: 'Italiano', speechCode: 'it-IT', hasTranslit: false },
  { code: 'ar', name: 'Árabe', englishName: 'Arabic', native: 'العربية', speechCode: 'ar-SA', hasTranslit: true, translitName: 'Romanización', rtl: true },
  { code: 'zh', name: 'Chino Mandarín', englishName: 'Mandarin Chinese', native: '中文 (普通话)', speechCode: 'zh-CN', hasTranslit: true, translitName: 'Pinyin' },
  { code: 'ru', name: 'Ruso', englishName: 'Russian', native: 'Русский', speechCode: 'ru-RU', hasTranslit: true, translitName: 'Romanización' }
];

/**
 * Intelligent LCS (Longest Common Subsequence) diffing algorithm
 * between original learner text and grammatically corrected text.
 */
export function computeWordDiff(original, corrected) {
  const orig = original.trim().split(/\s+/).filter(Boolean);
  const corr = corrected.trim().split(/\s+/).filter(Boolean);

  const clean = w => (w || '').toLowerCase().replace(/^[^\w\u00C0-\u024F\u0400-\u04FF\u0600-\u06FF\u4E00-\u9FFF]+|[^\w\u00C0-\u024F\u0400-\u04FF\u0600-\u06FF\u4E00-\u9FFF]+$/g, '');

  const m = orig.length;
  const n = corr.length;
  const dp = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (clean(orig[i - 1]) === clean(corr[j - 1]) && clean(orig[i - 1]).length > 0) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  let i = m;
  let j = n;
  const tokens = [];

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && clean(orig[i - 1]) === clean(corr[j - 1]) && clean(orig[i - 1]).length > 0) {
      tokens.unshift({
        text: corr[j - 1],
        changed: false,
        original: null
      });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      tokens.unshift({
        text: corr[j - 1],
        changed: true,
        original: i > 0 && dp[i - 1][j] === dp[i][j] ? orig[i - 1] : null
      });
      if (i > 0 && dp[i - 1][j] === dp[i][j]) i--;
      j--;
    } else if (i > 0) {
      if (tokens.length > 0 && tokens[0].changed) {
        tokens[0].original = (orig[i - 1] + ' ' + (tokens[0].original || '')).trim();
      } else if (tokens.length > 0) {
        tokens[0].changed = true;
        tokens[0].original = orig[i - 1];
      }
      i--;
    }
  }

  return tokens;
}
