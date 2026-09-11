import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';

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
  const cleanLang = String(lang || '').toLowerCase().trim();
  if (!cleanWord) return '';

  if (cleanLang === 'zh') {
    return `zh:${cleanWord}`;
  }
  return `${cleanLang}:${cleanWord.toLowerCase()}`;
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

  // Persist to localStorage whenever savedWords changes
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_SAVED_WORDS, JSON.stringify(savedWords));
    } catch (e) {
      console.warn('Failed to save words to localStorage:', e);
    }
  }, [savedWords]);

  const isWordSaved = useCallback((word, lang) => {
    if (!word || !lang) return false;
    const key = getSavedWordKey(word, lang);
    return savedKeysSet.has(key);
  }, [savedKeysSet]);

  const saveWord = useCallback((word, lang) => {
    if (!word || !lang) return;
    const trimmedWord = String(word).trim();
    const cleanLang = String(lang).toLowerCase().trim();
    if (!trimmedWord) return;

    setSavedWords((prev) => {
      const key = getSavedWordKey(trimmedWord, cleanLang);
      const exists = prev.some((item) => getSavedWordKey(item.word, item.lang) === key);
      if (exists) return prev;
      return [
        ...prev,
        {
          word: trimmedWord,
          lang: cleanLang,
          addedAt: Date.now()
        }
      ];
    });
  }, []);

  const removeWord = useCallback((word, lang) => {
    if (!word || !lang) return;
    const key = getSavedWordKey(word, lang);
    setSavedWords((prev) => prev.filter((item) => getSavedWordKey(item.word, item.lang) !== key));
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
