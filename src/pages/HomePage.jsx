import React from 'react';
import {
  MessageSquare,
  Youtube,
  Sparkles,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  FileText
} from 'lucide-react';
import { LanguageSelectDropdown } from '../components/LanguageSelectDropdown.jsx';
import { useSiteLanguage } from '../context/SiteLanguageContext.jsx';
import {
  LANGUAGE_FLAGS,
  NATIVE_LANG_OPTIONS,
  getLanguageMeta
} from '../constants/languages.js';

export default function HomePage({
  onSelectMode,
  targetLang,
  setTargetLang,
  nativeLang,
  setNativeLang,
  languages = []
}) {
  const { t } = useSiteLanguage();
  const currentTargetMeta = getLanguageMeta(targetLang);
  const currentNativeMeta = getLanguageMeta(nativeLang);
  const currentTargetName = currentTargetMeta.name || (Array.isArray(languages) && languages.find((l) => l && l.code === targetLang)?.name) || targetLang;
  const currentNativeName =
    currentNativeMeta.name ||
    NATIVE_LANG_OPTIONS.find((l) => l && l.code === nativeLang)?.name ||
    (Array.isArray(languages) && languages.find((l) => l && l.code === nativeLang)?.name) ||
    nativeLang;

  return (
    <div className="flex-1 overflow-y-auto w-full relative bg-gradient-to-b from-[#faf5f0] via-[#f7f0e8] to-[#f0e6dc] text-[var(--text-primary)] dark:from-[#180905] dark:via-[#210d07] dark:to-[#140603] dark:text-stone-100 flex flex-col justify-between px-4 py-8 md:py-12 home-gradient-bg">
      {/* Background ambient lighting effects */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-rose-500/5 dark:bg-rose-600/10 rounded-full blur-3xl pointer-events-none -z-10" />
      <div className="absolute bottom-10 right-1/4 w-96 h-96 bg-amber-400/5 dark:bg-amber-500/10 rounded-full blur-3xl pointer-events-none -z-10" />

      {/* Main Container */}
      <div className="max-w-5xl mx-auto w-full flex-1 flex flex-col justify-center">
        
        {/* Hero Badge & Titles */}
        <div className="text-center max-w-2xl mx-auto mb-8 sm:mb-12 animate-fade-in">
          <div className="inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-full bg-rose-50 border border-rose-200 text-rose-700 shadow-xs dark:bg-gradient-to-r dark:from-rose-950/90 dark:to-[#38160e] dark:border-rose-700/50 dark:shadow-md dark:shadow-black/40 mb-4">
            <Sparkles className="w-4 h-4 text-rose-600 dark:text-rose-400" />
            <span className="text-xs font-bold tracking-wider uppercase text-rose-700 dark:text-rose-200">
              {t('home_badge')}
            </span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-[var(--text-primary)] dark:text-white leading-tight sm:leading-tight">
            {t('home_title_pre')}
            <span className="bg-gradient-to-r from-rose-600 via-pink-600 to-amber-600 dark:from-rose-400 dark:via-pink-400 dark:to-amber-300 bg-clip-text text-transparent">
              {t('home_title_highlight')}
            </span>
          </h1>

          <p className="mt-3 text-sm sm:text-base text-[var(--text-secondary)] dark:text-rose-100/70 leading-relaxed max-w-xl mx-auto font-medium">
            {t('home_subtitle')}
          </p>

          {/* Quick Language Selection Bar */}
          <div className="mt-6 inline-flex flex-wrap items-center justify-center gap-3 p-2 rounded-2xl bg-[var(--surface-primary)] border border-[var(--border-primary)] shadow-md shadow-stone-900/5 dark:bg-[#26110a]/90 dark:border-[#482015] dark:shadow-lg dark:shadow-black/30 backdrop-blur-md">
            <LanguageSelectDropdown
              value={targetLang}
              onChange={(newLang) => setTargetLang && setTargetLang(newLang)}
              options={languages}
              label={t('home_practicing')}
              variant="pill"
            />

            <LanguageSelectDropdown
              value={nativeLang}
              onChange={(newLang) => setNativeLang && setNativeLang(newLang)}
              options={NATIVE_LANG_OPTIONS}
              label={t('home_your_lang')}
              variant="pill"
            />
          </div>
        </div>

        {/* 3 Big Interactive Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-6xl mx-auto w-full mb-10">
          
          {/* CARD 1: CHAT TUTOR */}
          <div
            onClick={() => onSelectMode('chat')}
            className="group relative p-6 rounded-3xl bg-[var(--surface-primary)] hover:bg-[var(--surface-secondary)] border border-[var(--border-primary)] hover:border-rose-500/80 transition-all duration-300 shadow-md hover:shadow-xl dark:bg-[#241009]/95 dark:hover:bg-[#2e150d] dark:border-[#4a2216] dark:shadow-xl dark:shadow-black/40 dark:hover:shadow-2xl dark:hover:shadow-rose-950/50 flex flex-col justify-between cursor-pointer overflow-hidden transform hover:-translate-y-1"
          >
            {/* Top decorative gradient glow */}
            <div className="absolute -top-16 -right-16 w-36 h-36 bg-rose-500/10 group-hover:bg-rose-500/20 dark:bg-rose-500/15 dark:group-hover:bg-rose-500/25 rounded-full blur-2xl transition-all" />

            <div>
              {/* Header Icon + Tag */}
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-rose-600 via-rose-500 to-pink-500 flex items-center justify-center text-white shadow-lg shadow-rose-950/40 dark:shadow-rose-950/60 group-hover:scale-105 transition-transform">
                  <MessageSquare className="w-6 h-6" />
                </div>
                <span className="text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-1 rounded-full bg-rose-50 text-rose-700 border border-rose-200/90 dark:bg-rose-950/80 dark:text-rose-300 dark:border-rose-800/70">
                  ✦ {t('home_chat_tag')}
                </span>
              </div>

              {/* Title & Description */}
              <h2 className="text-xl font-bold text-[var(--text-primary)] group-hover:text-rose-600 dark:text-white dark:group-hover:text-rose-200 transition-colors">
                {t('home_chat_title')}
              </h2>
              <p className="mt-2 text-xs text-[var(--text-secondary)] dark:text-stone-300 leading-relaxed font-normal">
                {t('home_chat_desc')}
              </p>

              {/* Features List */}
              <ul className="mt-4 space-y-2 text-xs text-[var(--text-secondary)] dark:text-rose-100/80 font-medium">
                <li className="flex items-start space-x-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-rose-500 dark:text-rose-400 shrink-0 mt-0.5" />
                  <span>{t('home_chat_f1')}</span>
                </li>
                <li className="flex items-start space-x-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-rose-500 dark:text-rose-400 shrink-0 mt-0.5" />
                  <span>{t('home_chat_f2')}</span>
                </li>
                <li className="flex items-start space-x-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-rose-500 dark:text-rose-400 shrink-0 mt-0.5" />
                  <span>{t('home_chat_f3')}</span>
                </li>
              </ul>
            </div>

            {/* CTA Button */}
            <div className="mt-6 pt-4 border-t border-[var(--border-subtle)] dark:border-[#411c12]">
              <button
                type="button"
                className="w-full py-3 px-4 rounded-2xl bg-gradient-to-r from-rose-600 via-rose-500 to-pink-600 hover:from-rose-500 hover:to-pink-500 text-white font-bold text-xs shadow-md shadow-rose-900/20 dark:shadow-lg dark:shadow-rose-950/60 flex items-center justify-center space-x-2 transition-all group-hover:shadow-rose-900/40 dark:group-hover:shadow-rose-900/80"
              >
                <span>{t('home_chat_btn')}</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </button>
            </div>
          </div>

          {/* CARD 2: YOUTUBE READER */}
          <div
            onClick={() => onSelectMode('youtube')}
            className="group relative p-6 rounded-3xl bg-[var(--surface-primary)] hover:bg-[var(--surface-secondary)] border border-[var(--border-primary)] hover:border-amber-500/80 transition-all duration-300 shadow-md hover:shadow-xl dark:bg-[#241009]/95 dark:hover:bg-[#2e150d] dark:border-[#4a2216] dark:shadow-xl dark:shadow-black/40 dark:hover:shadow-2xl dark:hover:shadow-amber-950/50 flex flex-col justify-between cursor-pointer overflow-hidden transform hover:-translate-y-1"
          >
            {/* Top decorative gradient glow */}
            <div className="absolute -top-16 -right-16 w-36 h-36 bg-amber-500/10 group-hover:bg-amber-500/20 dark:bg-amber-500/15 dark:group-hover:bg-amber-500/25 rounded-full blur-2xl transition-all" />

            <div>
              {/* Header Icon + Tag */}
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-red-600 via-rose-600 to-amber-500 flex items-center justify-center text-white shadow-lg shadow-red-950/40 dark:shadow-red-950/60 group-hover:scale-105 transition-transform">
                  <Youtube className="w-6 h-6" />
                </div>
                <span className="text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-1 rounded-full bg-amber-50 text-amber-800 border border-amber-200/90 dark:bg-amber-950/80 dark:text-amber-300 dark:border-amber-800/70">
                  ✦ {t('home_yt_tag')}
                </span>
              </div>

              {/* Title & Description */}
              <h2 className="text-xl font-bold text-[var(--text-primary)] group-hover:text-amber-600 dark:text-white dark:group-hover:text-amber-200 transition-colors">
                {t('home_yt_title')}
              </h2>
              <p className="mt-2 text-xs text-[var(--text-secondary)] dark:text-stone-300 leading-relaxed font-normal">
                {t('home_yt_desc')}
              </p>

              {/* Features List */}
              <ul className="mt-4 space-y-2 text-xs text-[var(--text-secondary)] dark:text-rose-100/80 font-medium">
                <li className="flex items-start space-x-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400 shrink-0 mt-0.5" />
                  <span>{t('home_yt_f1')}</span>
                </li>
                <li className="flex items-start space-x-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400 shrink-0 mt-0.5" />
                  <span>{t('home_yt_f2')}</span>
                </li>
                <li className="flex items-start space-x-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400 shrink-0 mt-0.5" />
                  <span>{t('home_yt_f3')}</span>
                </li>
              </ul>
            </div>

            {/* CTA Button */}
            <div className="mt-6 pt-4 border-t border-[var(--border-subtle)] dark:border-[#411c12]">
              <button
                type="button"
                className="w-full py-3 px-4 rounded-2xl bg-gradient-to-r from-amber-600 via-rose-600 to-red-600 hover:from-amber-500 hover:to-rose-500 text-white font-bold text-xs shadow-md shadow-amber-900/20 dark:shadow-lg dark:shadow-amber-950/60 flex items-center justify-center space-x-2 transition-all group-hover:shadow-amber-900/40 dark:group-hover:shadow-amber-900/80"
              >
                <span>{t('home_yt_btn')}</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </button>
            </div>
          </div>

          {/* CARD 3: TEXT READER */}
          <div
            onClick={() => onSelectMode('text')}
            className="group relative p-6 rounded-3xl bg-[var(--surface-primary)] hover:bg-[var(--surface-secondary)] border border-[var(--border-primary)] hover:border-pink-500/80 transition-all duration-300 shadow-md hover:shadow-xl dark:bg-[#241009]/95 dark:hover:bg-[#2e150d] dark:border-[#4a2216] dark:shadow-xl dark:shadow-black/40 dark:hover:shadow-2xl dark:hover:shadow-pink-950/50 flex flex-col justify-between cursor-pointer overflow-hidden transform hover:-translate-y-1"
          >
            {/* Top decorative gradient glow */}
            <div className="absolute -top-16 -right-16 w-36 h-36 bg-pink-500/10 group-hover:bg-pink-500/20 dark:bg-pink-500/15 dark:group-hover:bg-pink-500/25 rounded-full blur-2xl transition-all" />

            <div>
              {/* Header Icon + Tag */}
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-pink-600 via-rose-500 to-amber-500 flex items-center justify-center text-white shadow-lg shadow-pink-950/40 dark:shadow-pink-950/60 group-hover:scale-105 transition-transform">
                  <FileText className="w-6 h-6" />
                </div>
                <span className="text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-1 rounded-full bg-pink-50 text-pink-700 border border-pink-200/90 dark:bg-pink-950/80 dark:text-pink-300 dark:border-pink-800/70">
                  ✦ {t('home_text_tag') || 'LECTOR DE TEXTOS'}
                </span>
              </div>

              {/* Title & Description */}
              <h2 className="text-xl font-bold text-[var(--text-primary)] group-hover:text-pink-600 dark:text-white dark:group-hover:text-pink-200 transition-colors">
                {t('home_text_title') || 'Importar Texto'}
              </h2>
              <p className="mt-2 text-xs text-[var(--text-secondary)] dark:text-stone-300 leading-relaxed font-normal">
                {t('home_text_desc') || 'Pega o importa cualquier texto sin video. Lee párrafos con audio individual y glosado inteligente.'}
              </p>

              {/* Features List */}
              <ul className="mt-4 space-y-2 text-xs text-[var(--text-secondary)] dark:text-rose-100/80 font-medium">
                <li className="flex items-start space-x-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-pink-500 dark:text-pink-400 shrink-0 mt-0.5" />
                  <span>{t('home_text_f1') || 'Lectura independiente sin video'}</span>
                </li>
                <li className="flex items-start space-x-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-pink-500 dark:text-pink-400 shrink-0 mt-0.5" />
                  <span>{t('home_text_f2') || 'Audio TTS por párrafo individual'}</span>
                </li>
                <li className="flex items-start space-x-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-pink-500 dark:text-pink-400 shrink-0 mt-0.5" />
                  <span>{t('home_text_f3') || 'Glosado interlineal por palabras'}</span>
                </li>
              </ul>
            </div>

            {/* CTA Button */}
            <div className="mt-6 pt-4 border-t border-[var(--border-subtle)] dark:border-[#411c12]">
              <button
                type="button"
                className="w-full py-3 px-4 rounded-2xl bg-gradient-to-r from-pink-600 via-rose-500 to-amber-600 hover:from-pink-500 hover:to-amber-500 text-white font-bold text-xs shadow-md shadow-pink-900/20 dark:shadow-lg dark:shadow-pink-950/60 flex items-center justify-center space-x-2 transition-all group-hover:shadow-pink-900/40 dark:group-hover:shadow-pink-900/80"
              >
                <span>{t('home_text_btn') || 'Abrir Lector de Texto'}</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </button>
            </div>
          </div>

        </div>

        {/* Feature Highlights Strip */}
        <div className="max-w-4xl mx-auto w-full pt-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center">
            <div className="p-3 rounded-2xl bg-[var(--surface-primary)] border border-[var(--border-primary)] shadow-xs dark:bg-[#1e0d08]/80 dark:border-[#3b170e]">
              <div className="text-amber-600 dark:text-amber-400 font-bold text-xs">⚡ Motor Groq AI</div>
              <div className="text-[11px] text-[var(--text-secondary)] dark:text-rose-200/60 font-medium mt-0.5">openai/gpt-oss-120b</div>
            </div>
            <div className="p-3 rounded-2xl bg-[var(--surface-primary)] border border-[var(--border-primary)] shadow-xs dark:bg-[#1e0d08]/80 dark:border-[#3b170e]">
              <div className="text-rose-600 dark:text-rose-400 font-bold text-xs">🌐 13+ Idiomas</div>
              <div className="text-[11px] text-[var(--text-secondary)] dark:text-rose-200/60 font-medium mt-0.5">Soporte interlineal</div>
            </div>
            <div className="p-3 rounded-2xl bg-[var(--surface-primary)] border border-[var(--border-primary)] shadow-xs dark:bg-[#1e0d08]/80 dark:border-[#3b170e]">
              <div className="text-pink-600 dark:text-pink-400 font-bold text-xs">💾 Persistencia Local</div>
              <div className="text-[11px] text-[var(--text-secondary)] dark:text-rose-200/60 font-medium mt-0.5">Historial por idioma</div>
            </div>
            <div className="p-3 rounded-2xl bg-[var(--surface-primary)] border border-[var(--border-primary)] shadow-xs dark:bg-[#1e0d08]/80 dark:border-[#3b170e]">
              <div className="text-emerald-600 dark:text-emerald-400 font-bold text-xs">🎙️ Voz Multilingüe</div>
              <div className="text-[11px] text-[var(--text-secondary)] dark:text-rose-200/60 font-medium mt-0.5">Code-switching STT</div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
