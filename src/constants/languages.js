/**
 * Centralized Language Constants and Metadata for LinguaFlow
 * Provides flags, native names, and metadata for aesthetic language selection.
 */

export const LANGUAGE_FLAGS = {
  es: '🇪🇸',
  en: '🇺🇸',
  zh: '🇨🇳',
  pl: '🇵🇱',
  de: '🇩🇪',
  fr: '🇫🇷',
  it: '🇮🇹',
  nl: '🇳🇱',
  ru: '🇷🇺',
  ar: '🇸🇦',
  pt: '🇧🇷',
  ja: '🇯🇵',
  ko: '🇰🇷',
  tr: '🇹🇷'
};

export const LANGUAGE_METADATA = {
  es: {
    code: 'es',
    name: 'Español',
    nativeName: 'Español',
    flag: '🇪🇸',
    speechCode: 'es-ES',
    hasTranslit: false
  },
  en: {
    code: 'en',
    name: 'Inglés',
    nativeName: 'English',
    flag: '🇺🇸',
    speechCode: 'en-US',
    hasTranslit: false
  },
  zh: {
    code: 'zh',
    name: 'Chino Mandarín',
    nativeName: '中文',
    flag: '🇨🇳',
    speechCode: 'zh-CN',
    hasTranslit: true,
    translitName: 'Pinyin'
  },
  pl: {
    code: 'pl',
    name: 'Polaco',
    nativeName: 'Polski',
    flag: '🇵🇱',
    speechCode: 'pl-PL',
    hasTranslit: false
  },
  de: {
    code: 'de',
    name: 'Alemán',
    nativeName: 'Deutsch',
    flag: '🇩🇪',
    speechCode: 'de-DE',
    hasTranslit: false
  },
  fr: {
    code: 'fr',
    name: 'Francés',
    nativeName: 'Français',
    flag: '🇫🇷',
    speechCode: 'fr-FR',
    hasTranslit: false
  },
  it: {
    code: 'it',
    name: 'Italiano',
    nativeName: 'Italiano',
    flag: '🇮🇹',
    speechCode: 'it-IT',
    hasTranslit: false
  },
  nl: {
    code: 'nl',
    name: 'Nederlands',
    nativeName: 'Nederlands',
    flag: '🇳🇱',
    speechCode: 'nl-NL',
    hasTranslit: false
  },
  ru: {
    code: 'ru',
    name: 'Ruso',
    nativeName: 'Русский',
    flag: '🇷🇺',
    speechCode: 'ru-RU',
    hasTranslit: false
  },
  ar: {
    code: 'ar',
    name: 'Árabe',
    nativeName: 'العربية',
    flag: '🇸🇦',
    speechCode: 'ar-SA',
    hasTranslit: false,
    rtl: true
  },
  pt: {
    code: 'pt',
    name: 'Portugués',
    nativeName: 'Português',
    flag: '🇧🇷',
    speechCode: 'pt-BR',
    hasTranslit: false
  },
  ja: {
    code: 'ja',
    name: 'Japonés',
    nativeName: '日本語',
    flag: '🇯🇵',
    speechCode: 'ja-JP',
    hasTranslit: true,
    translitName: 'Romaji'
  },
  ko: {
    code: 'ko',
    name: 'Coreano',
    nativeName: '한국어',
    flag: '🇰🇷',
    speechCode: 'ko-KR',
    hasTranslit: true,
    translitName: 'Romanización'
  },
  tr: {
    code: 'tr',
    name: 'Turco',
    nativeName: 'Türkçe',
    flag: '🇹🇷',
    speechCode: 'tr-TR',
    hasTranslit: false
  }
};

export const DEFAULT_TARGET_LANGUAGES = [
  LANGUAGE_METADATA.zh,
  LANGUAGE_METADATA.pl,
  LANGUAGE_METADATA.en,
  LANGUAGE_METADATA.es,
  LANGUAGE_METADATA.de,
  LANGUAGE_METADATA.fr,
  LANGUAGE_METADATA.it,
  LANGUAGE_METADATA.nl,
  LANGUAGE_METADATA.ru,
  LANGUAGE_METADATA.ar,
  LANGUAGE_METADATA.pt,
  LANGUAGE_METADATA.ja
];

export const NATIVE_LANG_OPTIONS = [
  { code: 'es', name: 'Español', nativeName: 'Español', flag: '🇪🇸' },
  { code: 'en', name: 'Inglés', nativeName: 'English', flag: '🇺🇸' },
  { code: 'de', name: 'Alemán', nativeName: 'Deutsch', flag: '🇩🇪' },
  { code: 'nl', name: 'Nederlands', nativeName: 'Nederlands', flag: '🇳🇱' },
  { code: 'ru', name: 'Ruso', nativeName: 'Русский', flag: '🇷🇺' },
  { code: 'pl', name: 'Polaco', nativeName: 'Polski', flag: '🇵🇱' },
  { code: 'it', name: 'Italiano', nativeName: 'Italiano', flag: '🇮🇹' },
  { code: 'fr', name: 'Francés', nativeName: 'Français', flag: '🇫🇷' },
  { code: 'zh', name: 'Chino Mandarín', nativeName: '中文', flag: '🇨🇳' },
  { code: 'ar', name: 'Árabe', nativeName: 'العربية', flag: '🇸🇦' },
  { code: 'pt', name: 'Portugués', nativeName: 'Português', flag: '🇧🇷' }
];

export const SUPPORTED_LANGUAGES = DEFAULT_TARGET_LANGUAGES;

export function getLanguageMeta(code) {
  if (!code) return { code: '', name: 'Desconocido', nativeName: '', flag: '🌐' };
  const rawCode = typeof code === 'string' ? code : (code.code || code.value || '');
  if (!rawCode || typeof rawCode !== 'string') {
    return {
      code: '',
      name: (typeof code === 'object' && code.name) ? code.name : 'Desconocido',
      nativeName: (typeof code === 'object' && code.nativeName) ? code.nativeName : '',
      flag: (typeof code === 'object' && code.flag) ? code.flag : '🌐'
    };
  }
  const lower = rawCode.toLowerCase().trim();
  if (LANGUAGE_METADATA[lower]) {
    return LANGUAGE_METADATA[lower];
  }
  return {
    code: lower,
    name: (typeof code === 'object' && code.name) ? code.name : lower.toUpperCase(),
    nativeName: (typeof code === 'object' && code.nativeName) ? code.nativeName : lower.toUpperCase(),
    flag: LANGUAGE_FLAGS[lower] || '🌐'
  };
}

/**
 * Known Right-to-Left (RTL) language codes.
 * Prepared for Arabic (ar), Hebrew (he), Persian/Farsi (fa), Urdu (ur).
 */
export const RTL_LANG_CODES = new Set(['ar', 'he', 'fa', 'ur']);

/**
 * Check if a language code represents a Right-to-Left (RTL) script.
 * @param {string} code
 * @returns {boolean}
 */
export function isRtlLanguage(code) {
  if (!code) return false;
  const clean = String(code).toLowerCase().split('-')[0].trim();
  return RTL_LANG_CODES.has(clean) || Boolean(LANGUAGE_METADATA[clean]?.rtl);
}

/**
 * Get the CSS/HTML text direction for a given language code ('rtl' or 'ltr').
 * @param {string} code
 * @returns {'rtl'|'ltr'}
 */
export function getTextDirection(code) {
  return isRtlLanguage(code) ? 'rtl' : 'ltr';
}


