import React from 'react';
import {
  Mic,
  MicOff,
  Type,
  Settings,
  Volume2,
  RotateCcw
} from 'lucide-react';
import { LanguageSelectDropdown } from './LanguageSelectDropdown.jsx';
import { SiteLanguageToggle } from './SiteLanguageToggle.jsx';
import { useSiteLanguage } from '../context/SiteLanguageContext.jsx';
import { useAudioSettings } from '../context/AudioSettingsContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import {
  NATIVE_LANG_OPTIONS,
  getLanguageMeta
} from '../constants/languages.js';

export function Header({
  languages = [],
  targetLang,
  setTargetLang,
  nativeLang,
  setNativeLang,
  showTransliteration,
  setShowTransliteration,
  handsFree,
  setHandsFree,
  onOpenSettings,
  onResetChat,
  isListening,
  isSpeaking,
  hasApiKey = false,
  apiWarning = null,
  activeTab = 'chat',
  setActiveTab
}) {
  const { t, isSpanish } = useSiteLanguage();
  const { user, isAuthenticated } = useAuth();
  const {
    speechRate,
    setSpeechRate,
    autoPlayAi,
    setAutoPlayAi,
    autoPlayTextReader,
    setAutoPlayTextReader
  } = useAudioSettings();

  const currentTargetMeta = getLanguageMeta(targetLang);
  const currentNativeMeta = getLanguageMeta(nativeLang);
  const currentTargetName = currentTargetMeta.name || (Array.isArray(languages) && languages.find((l) => l && l.code === targetLang)?.name) || targetLang;
  const currentNativeName =
    currentNativeMeta.name ||
    NATIVE_LANG_OPTIONS.find((l) => l && l.code === nativeLang)?.name ||
    (Array.isArray(languages) && languages.find((l) => l && l.code === nativeLang)?.name) ||
    nativeLang;

  return (
    <>
      <header className="sticky top-0 z-30 bg-white/80 dark:bg-[#1a0c08]/90 backdrop-blur-xl border-b border-black/5 dark:border-white/5 px-4 py-3 md:py-3.5 shadow-xs text-[var(--text-primary)] transition-colors">
        {/* MOBILE TOP BAR (< md) */}
        <div className="flex md:hidden items-center justify-between w-full">
          {/* Left: Brand Logo & Titles */}
          <div
            onClick={() => setActiveTab && setActiveTab('home')}
            className="flex items-center space-x-3 cursor-pointer select-none group"
            role="button"
            tabIndex={0}
            title={t('nav_home')}
          >
            <img
              src="/linguaflow-logo.svg"
              alt="LinguaFlow"
              className="w-10 h-10 shrink-0 drop-shadow-sm group-hover:scale-105 transition-transform"
              draggable="false"
            />
            <div>
              <h1 className="font-extrabold text-[18px] leading-tight tracking-[0.01em] group-hover:text-rose-500 transition-colors">
                LinguaFlow
              </h1>
            </div>
          </div>

          {/* Right: Site Language Switcher + Target Language Button */}
          <div className="flex items-center space-x-3.5 shrink-0">
            {/* Website Language Switcher (ES/EN) */}
            <SiteLanguageToggle variant="compact" />

            {/* Target Language Dropdown */}
            <LanguageSelectDropdown
              value={targetLang}
              onChange={setTargetLang}
              options={languages}
              variant="header"
              align="right"
            />
          </div>
        </div>

        {/* DESKTOP HEADER (>= md) */}
        {activeTab === 'home' || activeTab === 'chat' || activeTab === 'settings' ? (
          /* =================== HOME, CHAT & SETTINGS DESKTOP: SINGLE SIMPLE BAR (MATCHING MOBILE LAYOUT) =================== */
          <div className="hidden md:flex max-w-4xl mx-auto items-center justify-between w-full">
            {/* Left: Brand Logo & Title */}
            <div
              onClick={() => setActiveTab && setActiveTab('home')}
              className="flex items-center space-x-3 cursor-pointer select-none group"
              role="button"
              tabIndex={0}
              title={t('nav_home')}
            >
              <img
                src="/linguaflow-logo.svg"
                alt="LinguaFlow"
                className="w-10 h-10 lg:w-11 lg:h-11 shrink-0 drop-shadow-sm group-hover:scale-105 transition-transform"
                draggable="false"
              />
              <div>
                <h1 className="font-extrabold text-[19px] leading-tight tracking-[0.01em] group-hover:text-rose-500 transition-colors">
                  LinguaFlow
                </h1>
              </div>
            </div>

            {/* Right: Site Language Switcher + Target Language Button */}
            <div className="flex items-center space-x-4 shrink-0">
              {/* Website Language Switcher (ES/EN) */}
              <SiteLanguageToggle variant="compact" />

              {/* Target Language Dropdown */}
              <LanguageSelectDropdown
                value={targetLang}
                onChange={setTargetLang}
                options={languages}
                variant="header"
                align="right"
              />
            </div>
          </div>
        ) : (
          /* =================== OTHER TABS (CHAT, ETC.): PRESERVED EXACTLY AS BEFORE =================== */
          <div className="hidden md:flex max-w-4xl mx-auto items-center justify-between gap-3">
            {/* Logo & Title */}
            <div
              onClick={() => setActiveTab && setActiveTab('home')}
              className="flex items-center space-x-3 cursor-pointer select-none group"
              role="button"
              tabIndex={0}
              title={t('nav_home')}
            >
              <img
                src="/linguaflow-logo.svg"
                alt="LinguaFlow"
                className="w-10 h-10 lg:w-11 lg:h-11 drop-shadow-sm group-hover:scale-105 transition-transform"
                draggable="false"
              />
              <div>
                <h1 className="font-extrabold text-[19px] leading-tight tracking-[0.01em] group-hover:text-rose-500 transition-colors">
                  LinguaFlow
                </h1>
              </div>
            </div>

            {/* Navigation Tabs (Inicio vs Chat vs YouTube Reader) */}
            <div className="flex items-center p-1 bg-black/5 dark:bg-white/5 rounded-2xl border border-black/5 dark:border-white/10 text-xs font-bold backdrop-blur-md">
              <button
                type="button"
                onClick={() => setActiveTab && setActiveTab('home')}
                className={`px-3 py-1.5 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer active:scale-95 ${
                  activeTab === 'home'
                    ? 'bg-gradient-to-r from-rose-600 to-pink-600 text-white shadow-sm'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-black/5 dark:hover:bg-white/10'
                }`}
              >
                <span>🏠</span>
                <span>{t('nav_home')}</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab && setActiveTab('chat')}
                className={`px-3 py-1.5 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer active:scale-95 ${
                  activeTab === 'chat'
                    ? 'bg-gradient-to-r from-rose-600 to-pink-600 text-white shadow-sm'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-black/5 dark:hover:bg-white/10'
                }`}
              >
                <span>💬</span>
                <span>{t('nav_chat')}</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab && setActiveTab('youtube')}
                className={`px-3 py-1.5 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer active:scale-95 ${
                  activeTab === 'youtube'
                    ? 'bg-gradient-to-r from-rose-600 to-pink-600 text-white shadow-sm'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-black/5 dark:hover:bg-white/10'
                }`}
              >
                <span>🎥</span>
                <span>{t('nav_youtube')}</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab && setActiveTab('text')}
                className={`px-3 py-1.5 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer active:scale-95 ${
                  activeTab === 'text'
                    ? 'bg-gradient-to-r from-rose-600 to-pink-600 text-white shadow-sm'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-black/5 dark:hover:bg-white/10'
                }`}
              >
                <span>📖</span>
                <span>{t('nav_text_reader') || 'Importar texto'}</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab && setActiveTab('image')}
                className={`px-3 py-1.5 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer active:scale-95 ${
                  activeTab === 'image'
                    ? 'bg-gradient-to-r from-rose-600 to-pink-600 text-white shadow-sm'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-black/5 dark:hover:bg-white/10'
                }`}
              >
                <span>📷</span>
                <span>{t('nav_image_reader') || 'Image Reader'}</span>
              </button>
            </div>

            {/* Aesthetic Language Selectors */}
            <div
              className="flex items-center space-x-1.5 p-1 rounded-2xl border border-black/5 dark:border-white/10 shadow-xs text-xs bg-black/5 dark:bg-white/5 backdrop-blur-md"
            >
              <LanguageSelectDropdown
                value={targetLang}
                onChange={setTargetLang}
                options={languages}
                variant="header"
                align="left"
              />

              <span className="text-[var(--border-primary)] font-light">|</span>

              <LanguageSelectDropdown
                value={nativeLang}
                onChange={setNativeLang}
                options={NATIVE_LANG_OPTIONS}
                variant="header"
                align="right"
              />
            </div>

            {/* Website Language Switcher (ES / EN) */}
            <SiteLanguageToggle variant="header" />

            {/* Action Toggles */}
            <div className="flex items-center space-x-2">
              {/* Transliteration Toggle */}
              <button
                type="button"
                onClick={() => setShowTransliteration(!showTransliteration)}
                title={showTransliteration ? t('transliteration_title_on') : t('transliteration_title_off')}
                className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer active:scale-95 ${
                  showTransliteration
                    ? 'bg-rose-500/20 text-rose-600 dark:text-rose-300 ring-1 ring-rose-500/30'
                    : 'bg-black/5 hover:bg-black/10 dark:bg-white/10 dark:hover:bg-white/15 text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                <Type className="w-3.5 h-3.5" />
                <span className="hidden md:inline">{t('transliteration')}</span>
                <span className={`text-[10px] px-1 rounded ${showTransliteration ? 'bg-rose-600 text-white' : 'bg-black/10 dark:bg-white/10 text-[var(--text-muted)]'}`}>
                  {showTransliteration ? 'ON' : 'OFF'}
                </span>
              </button>

              {/* Hands-Free Mode Toggle */}
              <button
                type="button"
                onClick={() => setHandsFree(!handsFree)}
                title={handsFree ? (isSpanish ? 'Desactivar modo manos libres' : 'Disable hands-free mode') : (isSpanish ? 'Activar modo manos libres' : 'Enable hands-free mode')}
                className={`relative flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer active:scale-95 ${
                  handsFree
                    ? 'bg-gradient-to-r from-pink-600 to-rose-600 text-white shadow-sm'
                    : 'bg-black/5 hover:bg-black/10 dark:bg-white/10 dark:hover:bg-white/15 text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                {handsFree ? (
                  <>
                    <Mic className="w-3.5 h-3.5 animate-pulse text-white" />
                    <span>{t('hands_free')}</span>
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-pink-300 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
                    </span>
                  </>
                ) : (
                  <>
                    <MicOff className="w-3.5 h-3.5 text-rose-500 dark:text-rose-300/50" />
                    <span className="hidden sm:inline">{t('hands_free')}</span>
                  </>
                )}
              </button>

              {/* AI Connection Status Badge (Desktop only: on mobile it appears exclusively at the bottom of Home page) */}
              {apiWarning ? (
                <button
                  type="button"
                  onClick={onOpenSettings}
                  title={isSpanish ? 'Aviso de Groq AI: clic para revisar el backend' : 'Groq AI warning: click to review the backend'}
                  className="hidden md:flex items-center space-x-1.5 px-2.5 py-1.5 rounded-xl bg-amber-950/80 border border-amber-500/60 text-amber-200 text-xs font-semibold shadow-xs hover:bg-amber-900/80 transition-all animate-pulse active:scale-95 cursor-pointer"
                >
                  <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                  <span>{isSpanish ? '⚠️ Aviso Groq AI' : '⚠️ Groq AI warning'}</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onOpenSettings}
                  title={isSpanish ? 'Groq AI activa (openai/gpt-oss-120b)' : 'Groq AI active (openai/gpt-oss-120b)'}
                  className="hidden md:flex items-center space-x-1.5 px-2.5 py-1.5 rounded-xl bg-emerald-950/80 border border-emerald-600/60 text-emerald-200 text-xs font-semibold shadow-xs hover:bg-emerald-900/80 transition-all active:scale-95 cursor-pointer"
                >
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                  <span>{isSpanish ? '⚡ Groq IA activa' : '⚡ Groq AI active'}</span>
                </button>
              )}

              {/* Reset Chat Button */}
              {onResetChat && (
                <button
                  type="button"
                  onClick={onResetChat}
                  title={isSpanish ? 'Reiniciar chat en este idioma' : 'Reset chat in this language'}
                  className="p-2 rounded-xl bg-black/5 hover:bg-black/10 dark:bg-white/10 dark:hover:bg-white/15 text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer active:scale-95 transition-all"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
              )}

              {/* Settings Button */}
              <button
                type="button"
                onClick={onOpenSettings}
                title={isSpanish ? 'Ajustes de API y voz' : 'API and voice settings'}
                className="p-2 rounded-xl bg-black/5 hover:bg-black/10 dark:bg-white/10 dark:hover:bg-white/15 text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer active:scale-95 transition-all"
              >
                <Settings className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Hands-free Status Banner (Shown on both mobile & desktop when active) */}
        {handsFree && (
          <div className="max-w-4xl mx-auto mt-2 pt-2 border-t border-[#482519] flex items-center justify-between text-xs text-rose-200/80">
            <div className="flex items-center space-x-2">
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-rose-400 animate-pulse"></span>
              <span>
                {isSpeaking ? (
                  <span className="text-pink-300 font-medium flex items-center gap-1">
                    <Volume2 className="w-3.5 h-3.5" /> {isSpanish ? 'El bot está hablando...' : 'The bot is speaking...'}
                  </span>
                ) : isListening ? (
                  <span className="text-rose-200 font-medium flex items-center gap-1">
                    <Mic className="w-3.5 h-3.5 animate-bounce text-rose-400" /> {isSpanish ? 'Escuchándote... habla con tranquilidad' : 'Listening... speak freely'}
                  </span>
                ) : (
                  <span>{isSpanish ? 'Modo manos libres activo: responde automáticamente al terminar' : 'Hands-free mode active: replies automatically when you finish'}</span>
                )}
              </span>
            </div>
            <button
              onClick={() => setHandsFree(false)}
              className="text-rose-300/60 hover:text-rose-200 text-[11px] underline"
            >
              {isSpanish ? 'Pausar' : 'Pause'}
            </button>
          </div>
        )}
      </header>
    </>
  );
}
