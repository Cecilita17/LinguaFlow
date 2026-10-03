import React, { createContext, useContext, useState, useCallback, useLayoutEffect, useEffect } from 'react';
import { FONT_PREFERENCES_KEY, DEFAULT_FONT_PREFERENCES, FONT_OPTIONS, normalizeFontPreferences, getFontConfiguration } from '../utils/fontPreferences.js';
import { createOfflineFontStyles, FONT_DOWNLOAD_EVENT } from '../services/offlineFontService.js';
import { requestAutoBackup } from '../services/autoBackupService.js';

export const GLOBAL_FONT_SIZE_KEY = 'linguaflow_global_font_size';
export const FONT_SIZE_OPTIONS = ['sm', 'base', 'lg', 'xl', '2xl'];
export const DEFAULT_FONT_SIZE = 'base';

const ReaderSettingsContext = createContext({
  fontSize: DEFAULT_FONT_SIZE,
  setFontSize: () => {},
  cycleFontSize: () => {},
  fontSizeOptions: FONT_SIZE_OPTIONS,
  fontPreferences: DEFAULT_FONT_PREFERENCES,
  setFontPreference: () => {}
});

export function ReaderSettingsProvider({ children }) {
  const [fontPreferences, setFontPreferences] = useState(() => {
    try { return normalizeFontPreferences(JSON.parse(localStorage.getItem(FONT_PREFERENCES_KEY) || '{}')); }
    catch { return { ...DEFAULT_FONT_PREFERENCES }; }
  });
  useLayoutEffect(() => {
    const { family, stylesheet } = getFontConfiguration(fontPreferences);
    document.documentElement.style.setProperty('--app-font-family', family);
    // Load only the additional families chosen by the user.
    const linkId = 'linguaflow-selected-fonts';
    let link = document.getElementById(linkId);
    if (stylesheet) {
      if (!link) {
        link = document.createElement('link');
        link.id = linkId;
        link.rel = 'stylesheet';
        document.head.appendChild(link);
      }
      if (link.getAttribute('href') !== stylesheet) link.setAttribute('href', stylesheet);
    } else if (link) link.remove();
  }, [fontPreferences]);
  const [offlineFontsVersion, setOfflineFontsVersion] = useState(0);
  useEffect(() => {
    const refresh = () => setOfflineFontsVersion(version => version + 1);
    window.addEventListener(FONT_DOWNLOAD_EVENT, refresh);
    return () => window.removeEventListener(FONT_DOWNLOAD_EVENT, refresh);
  }, []);
  useEffect(() => {
    let cancelled = false;
    let installed = null;
    let style = null;
    const selected = Object.entries(FONT_OPTIONS).map(([script, options]) => options.find(option => option.id === fontPreferences[script]).family);
    createOfflineFontStyles(selected).then(result => {
      if (cancelled) { result.dispose(); return; }
      installed = result;
      if (result.css) {
        style = document.createElement('style');
        style.dataset.linguaflowOfflineFonts = 'true';
        style.textContent = result.css;
        document.head.appendChild(style);
      }
    }).catch(() => {});
    return () => {
      cancelled = true;
      style?.remove();
      installed?.dispose();
    };
  }, [fontPreferences, offlineFontsVersion]);
  const setFontPreference = useCallback((script, id) => {
    if (!FONT_OPTIONS[script]?.some(option => option.id === id)) return;
    setFontPreferences(previous => {
      const next = { ...previous, [script]: id };
      try {
        localStorage.setItem(FONT_PREFERENCES_KEY, JSON.stringify(next));
        requestAutoBackup({ type: 'settings', reason: 'reader-font-updated' });
      } catch {}
      return next;
    });
  }, []);
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
    fontSizeOptions: FONT_SIZE_OPTIONS,
    fontPreferences,
    setFontPreference
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
      fontSizeOptions: FONT_SIZE_OPTIONS,
      fontPreferences: DEFAULT_FONT_PREFERENCES,
      setFontPreference: () => {}
    };
  }
  return context;
}

export default ReaderSettingsContext;
