import React from 'react';
import { useSiteLanguage } from '../context/SiteLanguageContext.jsx';
import { Globe, Check } from 'lucide-react';

export function SiteLanguageToggle({
  variant = 'header',
  className = '',
  showLabel = true
}) {
  const { siteLang, setSiteLang, toggleSiteLang, t, isSpanish, isEnglish } = useSiteLanguage();

  if (variant === 'segmented') {
    return (
      <div
        className={`w-full bg-[var(--surface-tertiary)] dark:bg-[#1b0c07] p-1 rounded-2xl border border-[var(--border-primary)] dark:border-[#482015] grid grid-cols-2 gap-1.5 shadow-inner site-lang-segmented ${className}`}
      >
        <button
          type="button"
          onClick={() => setSiteLang('es')}
          className={`flex items-center justify-center space-x-2 py-2.5 px-3 rounded-xl font-bold text-xs transition-all cursor-pointer ${
            isSpanish
              ? 'bg-[var(--surface-primary)] text-rose-700 border border-rose-300 shadow-sm ring-1 ring-rose-500/20 dark:bg-gradient-to-r dark:from-rose-900/80 dark:to-[#3b170e] dark:text-white dark:border-rose-500/60 dark:shadow-md dark:shadow-rose-950/40 dark:ring-rose-500/40'
              : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)] border border-transparent dark:text-stone-300 dark:hover:text-white dark:hover:bg-[#28130b]'
          }`}
        >
          <span className="text-base leading-none">🇪🇸</span>
          <span>Español</span>
          {isSpanish && <Check className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400 stroke-[3] ml-1" />}
        </button>

        <button
          type="button"
          onClick={() => setSiteLang('en')}
          className={`flex items-center justify-center space-x-2 py-2.5 px-3 rounded-xl font-bold text-xs transition-all cursor-pointer ${
            isEnglish
              ? 'bg-[var(--surface-primary)] text-rose-700 border border-rose-300 shadow-sm ring-1 ring-rose-500/20 dark:bg-gradient-to-r dark:from-rose-900/80 dark:to-[#3b170e] dark:text-white dark:border-rose-500/60 dark:shadow-md dark:shadow-rose-950/40 dark:ring-rose-500/40'
              : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)] border border-transparent dark:text-stone-300 dark:hover:text-white dark:hover:bg-[#28130b]'
          }`}
        >
          <span className="text-base leading-none">🇺🇸</span>
          <span>English</span>
          {isEnglish && <Check className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400 stroke-[3] ml-1" />}
        </button>
      </div>
    );
  }

  if (variant === 'compact') {
    return (
      <button
        type="button"
        onClick={toggleSiteLang}
        title={isSpanish ? 'Switch site language to English' : 'Cambiar idioma del sitio a Español'}
        className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-[var(--surface-secondary)] hover:bg-[var(--surface-hover)] border border-[var(--border-primary)] hover:border-rose-500/60 text-xs font-semibold text-[var(--text-primary)] dark:bg-[#2d140d] dark:hover:bg-[#3d1a10] dark:border-[#482015] dark:text-stone-200 dark:hover:text-white transition-all shadow-xs cursor-pointer active:scale-95 ${className}`}
      >
        <span className="text-sm leading-none">{isSpanish ? '🇪🇸' : '🇺🇸'}</span>
        <span className="tracking-wider uppercase text-[11px] font-bold text-rose-600 dark:text-rose-200">
          {siteLang.toUpperCase()}
        </span>
      </button>
    );
  }

  // Default 'header' variant: Sleek sliding toggle pill
  return (
    <div
      className={`inline-flex items-center bg-[var(--surface-tertiary)] dark:bg-[#180904] p-0.5 rounded-xl border border-[var(--border-primary)] dark:border-[#482519] shadow-xs site-lang-toggle-header ${className}`}
      title={isSpanish ? 'Idioma del sitio: Español (clic para English)' : 'Site language: English (click for Spanish)'}
    >
      <button
        type="button"
        onClick={() => setSiteLang('es')}
        className={`flex items-center space-x-1 px-2 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
          isSpanish
            ? 'bg-[var(--surface-primary)] text-rose-700 border border-rose-300 shadow-xs dark:bg-gradient-to-r dark:from-rose-900/80 dark:to-[#3b170e] dark:text-white dark:border-rose-500/40'
            : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)] dark:text-stone-400 dark:hover:text-stone-200 dark:hover:bg-[#2a130c]'
        }`}
      >
        <span className="text-xs leading-none">🇪🇸</span>
        <span>ES</span>
      </button>

      <button
        type="button"
        onClick={() => setSiteLang('en')}
        className={`flex items-center space-x-1 px-2 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
          isEnglish
            ? 'bg-[var(--surface-primary)] text-rose-700 border border-rose-300 shadow-xs dark:bg-gradient-to-r dark:from-rose-900/80 dark:to-[#3b170e] dark:text-white dark:border-rose-500/40'
            : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)] dark:text-stone-400 dark:hover:text-stone-200 dark:hover:bg-[#2a130c]'
        }`}
      >
        <span className="text-xs leading-none">🇺🇸</span>
        <span>EN</span>
      </button>
    </div>
  );
}

export default SiteLanguageToggle;
