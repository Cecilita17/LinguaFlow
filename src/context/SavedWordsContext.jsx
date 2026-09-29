import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { requestAutoBackup } from '../services/autoBackupService.js';

export const STORAGE_KEY_SAVED_WORDS = 'linguaflow_saved_words';

const SavedWordsContext = createContext({
  savedWords: [],
  isWordSaved: () => false,
  toggleSavedWord: () => {},
  saveWord: () => {},
  removeWord: () => {}
});

/**
 * Normalizes a word key for a given language.
 * For alphabetic languages (English, Spanish, Polish, Russian, etc.), matching is case-insensitive.
 * For Chinese, matching is exact.
 */
export function getSavedWordKey(word = '', lang = '') {
  const cleanWord = String(word || '').trim();
  const cleanLang = String(lang || '').toLowerCase().split('-')[0].trim();
  if (!cleanWord) return '';

  if (cleanLang === 'zh') {
    return `zh:${cleanWord}`;
  }
  return `${cleanLang}:${cleanWord.toLowerCase()}`;
}

/**
 * Returns only the user's saved vocabulary that actually appears in a reading.
 * Token values are preferred because they are the same values highlighted in yellow;
 * the text check covers documents that have not yet been tokenized.
 */
export function getSavedWordsInParagraphs(savedWords = [], paragraphs = [], targetLang = '') {
  const language = String(targetLang || '').toLowerCase().split('-')[0];
  if (!language || !Array.isArray(savedWords) || !Array.isArray(paragraphs)) return [];

  const tokenKeys = new Set();
  const text = paragraphs
    .map((paragraph) => {
      const tokens = Array.isArray(paragraph?.tokens) ? paragraph.tokens : [];
      tokens.forEach((token) => {
        const word = typeof token === 'string' ? token : (token?.word || token?.text);
        if (word) tokenKeys.add(getSavedWordKey(word, language));
      });
      return paragraph?.text || '';
    })
    .join('\n');

  const escapeRegExp = (value) => Array.from(String(value)).map((char) =>
    '\\^$.*+?()[]{}|/'.includes(char) ? '\\' + char : char
  ).join('');
  const containsWord = (word) => {
    const cleanWord = String(word || '').trim();
    if (!cleanWord) return false;
    if (language === 'zh' || language === 'ja') return text.includes(cleanWord);
    return new RegExp(`(^|[^\\p{L}\\p{N}])${escapeRegExp(cleanWord)}(?=$|[^\\p{L}\\p{N}])`, 'iu').test(text);
  };

  const seen = new Set();
  return savedWords.filter((item) => {
    if (!item?.word || String(item.lang || '').toLowerCase().split('-')[0] !== language) return false;
    const key = getSavedWordKey(item.word, language);
    if (seen.has(key) || (!tokenKeys.has(key) && !containsWord(item.word))) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Returns only the user's saved vocabulary that actually appears in a historical chat session.
 * Checks message tokens, vocabulary keys, diffTokens, and raw text representations across all messages.
 * Deduplicated strictly by getSavedWordKey identity.
 *
 * @param {Array} savedWords - Active saved words list from SavedWordsContext
 * @param {object} session - Chat session object
 * @param {string} targetLang - Language code of the session
 * @returns {Array} Matching saved word objects
 */
export function getSavedWordsInChatSession(savedWords = [], session = null, targetLang = '') {
  const language = String(targetLang || session?.targetLang || '').toLowerCase().split('-')[0];
  if (!language || !Array.isArray(savedWords) || !session) return [];

  const messages = Array.isArray(session.messages) ? session.messages : [];
  if (messages.length === 0) return [];

  const tokenKeys = new Set();
  const textChunks = [];

  messages.forEach((msg) => {
    if (!msg) return;

    // 1. Check tokens
    if (Array.isArray(msg.tokens)) {
      msg.tokens.forEach((t) => {
        const clean = t?.clean_word || (typeof t === 'string' ? t : (t?.word || t?.text));
        if (clean) tokenKeys.add(getSavedWordKey(clean, language));
        if (t?.word && t.word !== clean) tokenKeys.add(getSavedWordKey(t.word, language));
        if (t?.text && t.text !== clean && t.text !== t?.word) tokenKeys.add(getSavedWordKey(t.text, language));
      });
    }

    // 2. Check vocabulary dictionary keys
    if (msg.vocabulary && typeof msg.vocabulary === 'object') {
      Object.keys(msg.vocabulary).forEach((vocabWord) => {
        if (vocabWord) tokenKeys.add(getSavedWordKey(vocabWord, language));
      });
    }

    // 3. Check diffTokens (user message corrections)
    if (Array.isArray(msg.diffTokens)) {
      msg.diffTokens.forEach((dt) => {
        if (dt?.text) textChunks.push(dt.text);
        if (dt?.original) textChunks.push(dt.original);
      });
    }

    // 4. Collect raw text strings for word boundary regex & CJK matching
    if (msg.text) textChunks.push(msg.text);
    if (msg.correctedText && msg.correctedText !== msg.text) textChunks.push(msg.correctedText);
    if (msg.originalText && msg.originalText !== msg.text) textChunks.push(msg.originalText);
  });

  const fullText = textChunks.join('\n');

  const escapeRegExp = (value) => Array.from(String(value)).map((char) =>
    '\\^$.*+?()[]{}|/'.includes(char) ? '\\' + char : char
  ).join('');

  const containsWord = (word) => {
    const cleanWord = String(word || '').trim();
    if (!cleanWord) return false;
    if (language === 'zh' || language === 'ja') return fullText.includes(cleanWord);
    return new RegExp(`(^|[^\\p{L}\\p{N}])${escapeRegExp(cleanWord)}(?=$|[^\\p{L}\\p{N}])`, 'iu').test(fullText);
  };

  const seen = new Set();
  return savedWords.filter((item) => {
    if (!item?.word || String(item.lang || '').toLowerCase().split('-')[0] !== language) return false;
    const key = getSavedWordKey(item.word, language);
    if (seen.has(key)) return false;
    if (!tokenKeys.has(key) && !containsWord(item.word)) return false;
    seen.add(key);
    return true;
  });
}

function persistSavedWords(words) {
  try {
    localStorage.setItem(STORAGE_KEY_SAVED_WORDS, JSON.stringify(words));
    requestAutoBackup({ type: 'saved-words', reason: 'saved-words-updated' });
  } catch (e) {
    console.warn('Failed to save words to localStorage:', e);
  }
}

export function SavedWordsProvider({ children }) {
  const [savedWords, setSavedWords] = useState(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_SAVED_WORDS);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {
      console.warn('Failed to parse saved words from localStorage:', e);
    }
    return [];
  });

  // Fast lookup Set using normalized keys
  const savedKeysSet = useMemo(() => {
    const set = new Set();
    for (const item of savedWords) {
      if (item && item.word && item.lang) {
        set.add(getSavedWordKey(item.word, item.lang));
      }
    }
    return set;
  }, [savedWords]);

  // Listen to storage events and backup restoration for cross-tab sync
  useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.key === STORAGE_KEY_SAVED_WORDS && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (Array.isArray(parsed)) {
            setSavedWords(parsed);
          }
        } catch (err) {}
      }
    };
    const handleSyncEvent = () => {
      try {
        const stored = localStorage.getItem(STORAGE_KEY_SAVED_WORDS);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed)) setSavedWords(parsed);
        }
      } catch (err) {}
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('linguaflow-saved-words-sync', handleSyncEvent);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('linguaflow-saved-words-sync', handleSyncEvent);
    };
  }, []);

  const isWordSaved = useCallback((word, lang) => {
    if (!word || !lang) return false;
    const key = getSavedWordKey(word, lang);
    return savedKeysSet.has(key);
  }, [savedKeysSet]);

  const saveWord = useCallback((word, lang) => {
    if (!word || !lang) return;
    const trimmedWord = String(word).trim();
    const cleanLang = String(lang).toLowerCase().split('-')[0].trim();
    if (!trimmedWord || !cleanLang) return;

    setSavedWords((prev) => {
      const key = getSavedWordKey(trimmedWord, cleanLang);
      const exists = prev.some((item) => getSavedWordKey(item.word, item.lang) === key);
      if (exists) return prev;
      const next = [
        ...prev,
        {
          word: trimmedWord,
          lang: cleanLang,
          addedAt: Date.now()
        }
      ];
      persistSavedWords(next);
      return next;
    });
  }, []);

  const removeWord = useCallback((word, lang) => {
    if (!word || !lang) return;
    const key = getSavedWordKey(word, lang);
    setSavedWords((prev) => {
      const next = prev.filter((item) => getSavedWordKey(item.word, item.lang) !== key);
      if (next.length !== prev.length) {
        persistSavedWords(next);
      }
      return next;
    });
  }, []);

  const toggleSavedWord = useCallback((word, lang) => {
    if (!word || !lang) return;
    const key = getSavedWordKey(word, lang);
    if (savedKeysSet.has(key)) {
      removeWord(word, lang);
    } else {
      saveWord(word, lang);
    }
  }, [savedKeysSet, removeWord, saveWord]);

  return (
    <SavedWordsContext.Provider
      value={{
        savedWords,
        isWordSaved,
        toggleSavedWord,
        saveWord,
        removeWord
      }}
    >
      {children}
    </SavedWordsContext.Provider>
  );
}

export function useSavedWords() {
  return useContext(SavedWordsContext);
}
