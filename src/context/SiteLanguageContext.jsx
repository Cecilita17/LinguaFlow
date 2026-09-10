import React, { createContext, useContext, useState, useCallback } from 'react';
import { TRANSLATIONS } from '../constants/translations.js';

const SITE_LANG_STORAGE_KEY = 'linguaflow_site_lang';

export const SiteLanguageContext = createContext({
  siteLang: 'es',
  setSiteLang: () => {},
  toggleSiteLang: () => {},
  t: (key, params) => key,
  isSpanish: true,
  isEnglish: false
});

export function SiteLanguageProvider({ children }) {
  const [siteLang, setSiteLangState] = useState(() => {
    try {
      const saved = localStorage.getItem(SITE_LANG_STORAGE_KEY);
      if (saved === 'en' || saved === 'es') return saved;
    } catch (e) {}
    return 'es';
  });

  const setSiteLang = useCallback((lang) => {
    const validLang = lang === 'en' ? 'en' : 'es';
    setSiteLangState(validLang);
    try {
      localStorage.setItem(SITE_LANG_STORAGE_KEY, validLang);
    } catch (e) {}
  }, []);

  const toggleSiteLang = useCallback(() => {
    setSiteLangState((prev) => {
      const next = prev === 'es' ? 'en' : 'es';
      try {
        localStorage.setItem(SITE_LANG_STORAGE_KEY, next);
      } catch (e) {}
      return next;
    });
  }, []);

  const t = useCallback((key, params = {}) => {
    const langDict = TRANSLATIONS[siteLang] || TRANSLATIONS.es;
    let text = langDict[key] ?? TRANSLATIONS.es[key] ?? key;
    if (params && typeof params === 'object') {
      Object.entries(params).forEach(([paramKey, paramVal]) => {
        text = text.replace(new RegExp(`\\{${paramKey}\\}`, 'g'), String(paramVal));
      });
    }
    return text;
  }, [siteLang]);

  const value = {
    siteLang,
    setSiteLang,
    toggleSiteLang,
    t,
    isSpanish: siteLang === 'es',
    isEnglish: siteLang === 'en'
  };

  return (
    <SiteLanguageContext.Provider value={value}>
      {children}
    </SiteLanguageContext.Provider>
  );
}

export function useSiteLanguage() {
  const context = useContext(SiteLanguageContext);
  if (!context) {
    return {
      siteLang: 'es',
      setSiteLang: () => {},
      toggleSiteLang: () => {},
      t: (key) => key,
      isSpanish: true,
      isEnglish: false
    };
  }
  return context;
}

export default SiteLanguageContext;
