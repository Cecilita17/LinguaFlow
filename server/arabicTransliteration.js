/**
 * Arabic Transliteration Engine
 * Provides deterministic offline dictionary lookups and phonetic rule-based Latin transliteration
 * for Modern Standard Arabic (MSA) with full support for tashkeel (diacritics).
 */

import { ARABIC_OFFLINE_DICT } from '../src/services/languageGlossStrategies.js';

// Arabic consonant map (ALA-LC / DIN standard inspired)
const ARABIC_LETTER_MAP = {
  'ا': 'ā',
  'أ': 'a',
  'إ': 'i',
  'آ': 'ā',
  'ء': "'",
  'ؤ': "'",
  'ئ': "'",
  'ب': 'b',
  'ت': 't',
  'ث': 'th',
  'ج': 'j',
  'ح': 'ḥ',
  'خ': 'kh',
  'د': 'd',
  'ذ': 'dh',
  'ر': 'r',
  'ز': 'z',
  'س': 's',
  'ش': 'sh',
  'ص': 'ṣ',
  'ض': 'ḍ',
  'ط': 'ṭ',
  'ظ': 'ẓ',
  'ع': "'",
  'غ': 'gh',
  'ف': 'f',
  'ق': 'q',
  'ك': 'k',
  'ل': 'l',
  'م': 'm',
  'ن': 'n',
  'ه': 'h',
  'و': 'w',
  'ي': 'y',
  'ى': 'ā',
  'ة': 'h',
  'پ': 'p',
  'چ': 'ch',
  'ڤ': 'v',
  'گ': 'g'
};

// Tashkeel / Diacritics
const HARAKAT = {
  '\u064E': 'a',   // Fatḥah
  '\u064F': 'u',   // Ḍammah
  '\u0650': 'i',   // Kasrah
  '\u064B': 'an',  // Fatḥatān
  '\u064C': 'un',  // Ḍammatān
  '\u064D': 'in',  // Kasratān
  '\u0652': '',    // Sukūn
  '\u0670': 'ā',   // Dagger Alif (superscript)
};

/**
 * Phonetic rule-based transliterator for Arabic words.
 * Works on vocalized (with tashkeel) and unvocalized text.
 */
export function transliterateArabic(text) {
  if (!text || typeof text !== 'string') return '';
  const clean = text.trim();
  if (!clean) return '';

  // Return Latin/numeric punctuation directly if no Arabic characters
  if (!/[\u0600-\u06FF]/.test(clean)) {
    return clean;
  }

  const chars = Array.from(clean);
  let result = '';
  let prevConsonant = '';

  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i];
    const nextCh = chars[i + 1] || '';

    // Handle Shaddah (doubles the previous consonant)
    if (ch === '\u0651') {
      if (prevConsonant) {
        result += prevConsonant;
      }
      continue;
    }

    // Handle Tashkeel vowels
    if (HARAKAT[ch] !== undefined) {
      result += HARAKAT[ch];
      continue;
    }

    // Definite article "ال" (al-) at beginning of word or after spaces
    if (ch === 'ا' && nextCh === 'ل' && (i === 0 || chars[i - 1] === ' ')) {
      result += 'al-';
      i++; // Skip 'ل'
      prevConsonant = 'l';
      continue;
    }

    // Handle long vowels (و = ū when after damma/consonant, ي = ī when after kasra/consonant)
    if (ch === 'و') {
      const prev = chars[i - 1];
      if (prev === '\u064F') {
        // Replace previous 'u' with 'ū' or just append 'ū'
        if (result.endsWith('u')) {
          result = result.slice(0, -1) + 'ū';
        } else {
          result += 'ū';
        }
        prevConsonant = 'w';
        continue;
      }
    }

    if (ch === 'ي') {
      const prev = chars[i - 1];
      if (prev === '\u0650') {
        if (result.endsWith('i')) {
          result = result.slice(0, -1) + 'ī';
        } else {
          result += 'ī';
        }
        prevConsonant = 'y';
        continue;
      }
    }

    if (ch === 'ا' && (chars[i - 1] === '\u064E')) {
      if (result.endsWith('a')) {
        result = result.slice(0, -1) + 'ā';
      } else {
        result += 'ā';
      }
      prevConsonant = '';
      continue;
    }

    // Standard consonant/vowel lookup
    if (ARABIC_LETTER_MAP[ch] !== undefined) {
      const mapped = ARABIC_LETTER_MAP[ch];
      result += mapped;
      prevConsonant = mapped;
    } else {
      // Pass-through non-Arabic characters (spaces, punctuation, digits)
      result += ch;
      prevConsonant = '';
    }
  }

  // Clean up formatting
  return result
    .replace(/--+/g, '-')
    .trim();
}

/**
 * Resolves Arabic transliteration with deterministic dictionary priority and rule-based fallback.
 */
export function getArabicTransliteration(word, existingTranslit = null) {
  if (existingTranslit && typeof existingTranslit === 'string' && existingTranslit.trim().length > 0) {
    return existingTranslit.trim();
  }

  if (!word || typeof word !== 'string') return null;
  const clean = word.trim();
  if (!clean || !/[\u0600-\u06FF]/.test(clean)) return null;

  // 1. Check direct offline dictionary
  if (ARABIC_OFFLINE_DICT && ARABIC_OFFLINE_DICT[clean]?.translit) {
    return ARABIC_OFFLINE_DICT[clean].translit;
  }

  // 2. Check stripped diacritics in offline dictionary
  const stripped = clean.replace(/[\u064B-\u065F\u0670]/g, '');
  if (ARABIC_OFFLINE_DICT && ARABIC_OFFLINE_DICT[stripped]?.translit) {
    return ARABIC_OFFLINE_DICT[stripped].translit;
  }

  // 3. Deterministic rule-based transliteration
  const translit = transliterateArabic(clean);
  return translit || null;
}

export function containsArabic(text) {
  return typeof text === 'string' && /[\u0600-\u06FF]/.test(text);
}
