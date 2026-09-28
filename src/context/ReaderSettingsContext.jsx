import React, { createContext, useContext, useState, useCallback } from 'react';
import { requestAutoBackup } from '../services/autoBackupService.js';

export const GLOBAL_FONT_SIZE_KEY = 'linguaflow_global_font_size';
export const FONT_SIZE_OPTIONS = ['sm', 'base', 'lg', 'xl', '2xl'];
export const DEFAULT_FONT_SIZE = 'base';

const ReaderSettingsContext = createContext({
  fontSize: DEFAULT_FONT_SIZE,
  setFontSize: () => {},
  cycleFontSize: () => {},
  fontSizeOptions: FONT_SIZE_OPTIONS
});

export function ReaderSettingsProvider({ children }) {
  const [fontSize, setFontSizeState] = useState(() => {
    try {
      const saved = localStorage.getItem(GLOBAL_FONT_SIZE_KEY);
      if (saved && FONT_SIZE_OPTIONS.includes(saved)) {
        return saved;
      }
    } catch (e) {
      console.warn('Failed to read global font size from localStorage:', e);
    }
    return DEFAULT_FONT_SIZE;
  });

  const setFontSize = useCallback((newSize) => {
    setFontSizeState((prev) => {
      const resolvedSize = typeof newSize === 'function' ? newSize(prev) : newSize;
      const validSize = FONT_SIZE_OPTIONS.includes(resolvedSize) ? resolvedSize : DEFAULT_FONT_SIZE;
      try {
        localStorage.setItem(GLOBAL_FONT_SIZE_KEY, validSize);
        requestAutoBackup({ type: 'settings', reason: 'reader-font-size-updated' });
      } catch (e) {
        console.warn('Failed to persist global font size to localStorage:', e);
      }
      return validSize;
    });
  }, []);

  const cycleFontSize = useCallback(() => {
    setFontSizeState((prev) => {
      const currentIndex = FONT_SIZE_OPTIONS.indexOf(prev);
      const nextIndex = currentIndex >= 0 ? (currentIndex + 1) % FONT_SIZE_OPTIONS.length : 1;
      const nextSize = FONT_SIZE_OPTIONS[nextIndex];
      try {
        localStorage.setItem(GLOBAL_FONT_SIZE_KEY, nextSize);
        requestAutoBackup({ type: 'settings', reason: 'reader-font-size-updated' });
      } catch (e) {
        console.warn('Failed to persist global font size to localStorage:', e);
      }
      return nextSize;
    });
  }, []);

  const value = {
    fontSize,
    setFontSize,
    cycleFontSize,
    fontSizeOptions: FONT_SIZE_OPTIONS
  };

  return (
    <ReaderSettingsContext.Provider value={value}>
      {children}
    </ReaderSettingsContext.Provider>
  );
}

export function useReaderSettings() {
  const context = useContext(ReaderSettingsContext);
  if (!context) {
    return {
      fontSize: DEFAULT_FONT_SIZE,
      setFontSize: () => {},
      cycleFontSize: () => {},
      fontSizeOptions: FONT_SIZE_OPTIONS
    };
  }
  return context;
}

export default ReaderSettingsContext;
