import React, { useState } from 'react';
import {
  Languages,
  Mic,
  MicOff,
  Type,
  Settings,
  Volume2,
  Sparkles,
  RotateCcw,
  Menu,
  X,
  ChevronDown,
  MessageSquare,
  Youtube,
  Home,
  Globe
} from 'lucide-react';
import { LanguageSelectDropdown } from './LanguageSelectDropdown.jsx';
import { SiteLanguageToggle } from './SiteLanguageToggle.jsx';
import { useSiteLanguage } from '../context/SiteLanguageContext.jsx';
import {
  LANGUAGE_FLAGS,
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
  const { t } = useSiteLanguage();
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);

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
      <header className="sticky top-0 z-30 bg-[#23120b]/95 backdrop-blur-md border-b border-[#3d190f] px-4 py-2.5 md:py-3 shadow-lg shadow-black/25 text-white transition-colors">
        {/* MOBILE TOP BAR (< md) */}
        <div className="flex md:hidden items-center justify-between w-full">
          {/* Left: Brand Logo & Titles */}
          <div
            onClick={() => setActiveTab && setActiveTab('home')}
            className="flex items-center space-x-2.5 cursor-pointer select-none group"
            role="button"
            tabIndex={0}
            title={t('nav_home')}
          >
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-rose-500 to-pink-500 flex items-center justify-center text-white shadow-md shadow-rose-950/50 shrink-0 group-hover:scale-105 transition-transform">
              <Sparkles className="w-5 h-5 fill-white text-white" />
            </div>
            <div>
              <h1 className="font-bold text-white text-[17px] leading-tight tracking-wide group-hover:text-rose-200 transition-colors">
                LinguaFlow
              </h1>
            </div>
          </div>

          {/* Right: Site Language Switcher + Circular Target Language Button + Hamburger Menu */}
          <div className="flex items-center space-x-1.5 shrink-0">
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

            {/* Hamburger Button */}
            <button
              type="button"
              onClick={() => setIsMobileDrawerOpen(true)}
              aria-label="Abrir opciones de LinguaFlow"
              className="w-9 h-9 rounded-xl bg-[#2d140d] border border-[#482015] flex items-center justify-center text-stone-200 hover:text-white transition-colors"
            >
              <Menu className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* DESKTOP HEADER (>= md) - PRESERVED EXACTLY AS BEFORE */}
        <div className="hidden md:flex max-w-4xl mx-auto items-center justify-between gap-3">
          {/* Logo & Title */}
          <div
            onClick={() => setActiveTab && setActiveTab('home')}
            className="flex items-center space-x-2.5 cursor-pointer select-none group"
            role="button"
            tabIndex={0}
            title={t('nav_home')}
          >
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-rose-500 to-pink-400 flex items-center justify-center text-white shadow-md shadow-rose-900/40 group-hover:scale-105 transition-transform">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h1 className="font-bold text-white text-lg leading-tight tracking-wide group-hover:text-rose-200 transition-colors">
                LinguaFlow
              </h1>
            </div>
          </div>

          {/* Navigation Tabs (Inicio vs Chat vs YouTube Reader) */}
          <div className="flex items-center p-1 bg-[#1e0f0a]/90 rounded-xl border border-[#482519] text-xs font-bold">
            <button
              type="button"
              onClick={() => setActiveTab && setActiveTab('home')}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                activeTab === 'home'
                  ? 'bg-gradient-to-r from-rose-600 to-pink-600 text-white shadow-xs'
                  : 'text-rose-200/70 hover:text-white'
              }`}
            >
              <span>🏠</span>
              <span>{t('nav_home')}</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab && setActiveTab('chat')}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                activeTab === 'chat'
                  ? 'bg-gradient-to-r from-rose-600 to-pink-600 text-white shadow-xs'
                  : 'text-rose-200/70 hover:text-white'
              }`}
            >
              <span>💬</span>
              <span>{t('nav_chat')}</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab && setActiveTab('youtube')}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                activeTab === 'youtube'
                  ? 'bg-gradient-to-r from-rose-600 to-pink-600 text-white shadow-xs'
                  : 'text-rose-200/70 hover:text-white'
              }`}
            >
              <span>🎥</span>
              <span>{t('nav_youtube')}</span>
            </button>
          </div>

          {/* Aesthetic Language Selectors */}
          <div
            className="flex items-center space-x-1.5 p-1 rounded-2xl border border-[#482519] shadow-md text-xs bg-[#180904]"
            style={{ backgroundColor: '#180904' }}
          >
            <LanguageSelectDropdown
              value={targetLang}
              onChange={setTargetLang}
              options={languages}
              variant="header"
              align="left"
            />

            <span className="text-[#5a2e20] font-light">|</span>

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
              title={showTransliteration ? "Desactivar transliteración" : "Activar transliteración sobre palabras"}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all shadow-xs border ${
                showTransliteration
                  ? 'bg-rose-600 hover:bg-rose-500 text-white border-rose-500 shadow-rose-900/40'
                  : 'bg-[#3b1e15] text-rose-200/80 border-[#5a2e20] hover:bg-[#482519]'
              }`}
            >
              <Type className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Transliteración</span>
              <span className={`text-[10px] px-1 rounded ${showTransliteration ? 'bg-rose-800 text-rose-100' : 'bg-[#24120c] text-rose-300/60'}`}>
                {showTransliteration ? 'ON' : 'OFF'}
              </span>
            </button>

            {/* Hands-Free Mode Toggle */}
            <button
              type="button"
              onClick={() => setHandsFree(!handsFree)}
              title={handsFree ? "Desactivar modo manos libres" : "Activar modo manos libres"}
              className={`relative flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all shadow-xs border ${
                handsFree
                  ? 'bg-gradient-to-r from-pink-600 to-rose-600 text-white border-rose-400 shadow-rose-900/50'
                  : 'bg-[#3b1e15] text-rose-200/90 border-[#5a2e20] hover:bg-[#482519]'
              }`}
            >
              {handsFree ? (
                <>
                  <Mic className="w-3.5 h-3.5 animate-pulse text-white" />
                  <span>Manos Libres</span>
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-pink-300 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
                  </span>
                </>
              ) : (
                <>
                  <MicOff className="w-3.5 h-3.5 text-rose-300/50" />
                  <span className="hidden sm:inline">Manos Libres</span>
                </>
              )}
            </button>

            {/* AI Connection Status Badge */}
            {apiWarning ? (
              <button
                type="button"
                onClick={onOpenSettings}
                title="Aviso de Groq AI: Clic para revisar el backend"
                className="flex items-center space-x-1.5 px-2.5 py-1.5 rounded-xl bg-amber-950/90 border border-amber-500/80 text-amber-200 text-xs font-semibold shadow-xs hover:bg-amber-900/90 transition-all animate-pulse"
              >
                <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                <span className="hidden sm:inline">⚠️ Aviso Groq AI</span>
                <span className="sm:hidden">⚠️ IA</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={onOpenSettings}
                title="Groq AI Activa (openai/gpt-oss-120b)"
                className="flex items-center space-x-1.5 px-2.5 py-1.5 rounded-xl bg-emerald-950/85 border border-emerald-600/70 text-emerald-200 text-xs font-semibold shadow-xs hover:bg-emerald-900/80 transition-all"
              >
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                <span className="hidden sm:inline">⚡ Groq IA Activa</span>
                <span className="sm:hidden">IA</span>
              </button>
            )}

            {/* Reset Chat Button */}
            {onResetChat && (
              <button
                type="button"
                onClick={onResetChat}
                title="Reiniciar chat en este idioma"
                className="p-2 rounded-xl bg-[#3b1e15] border border-[#5a2e20] text-rose-200 hover:text-white hover:bg-[#482519] shadow-xs transition-colors"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            )}

            {/* Settings Button */}
            <button
              type="button"
              onClick={onOpenSettings}
              title="Ajustes de API y Voz"
              className="p-2 rounded-xl bg-[#3b1e15] border border-[#5a2e20] text-rose-200 hover:text-white hover:bg-[#482519] shadow-xs transition-colors"
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Hands-free Status Banner (Shown on both mobile & desktop when active) */}
        {handsFree && (
          <div className="max-w-4xl mx-auto mt-2 pt-2 border-t border-[#482519] flex items-center justify-between text-xs text-rose-200/80">
            <div className="flex items-center space-x-2">
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-rose-400 animate-pulse"></span>
              <span>
                {isSpeaking ? (
                  <span className="text-pink-300 font-medium flex items-center gap-1">
                    <Volume2 className="w-3.5 h-3.5" /> El bot está hablando...
                  </span>
                ) : isListening ? (
                  <span className="text-rose-200 font-medium flex items-center gap-1">
                    <Mic className="w-3.5 h-3.5 animate-bounce text-rose-400" /> Escuchándote... habla con tranquilidad
                  </span>
                ) : (
                  <span>Modo Manos Libres activo: responde automáticamente al terminar</span>
                )}
              </span>
            </div>
            <button
              onClick={() => setHandsFree(false)}
              className="text-rose-300/60 hover:text-rose-200 text-[11px] underline"
            >
              Pausar
            </button>
          </div>
        )}
      </header>

      {/* MOBILE DRAWER / SLIDE-IN PANEL */}
      {isMobileDrawerOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex justify-end">
          {/* Backdrop overlay */}
          <div
            className="fixed inset-0 bg-black/70 backdrop-blur-xs transition-opacity duration-200"
            onClick={() => setIsMobileDrawerOpen(false)}
            aria-hidden="true"
          />

          {/* Drawer container */}
          <div
            className="relative w-[86%] max-w-[340px] h-full bg-[#180b06] border-l border-[#3d190f] flex flex-col p-4 overflow-y-auto shadow-2xl z-10"
            role="dialog"
            aria-modal="true"
            aria-label="Opciones de LinguaFlow"
          >
            {/* Header: Title + Close Button */}
            <div className="flex items-center justify-between pb-3 border-b border-[#3d190f]/60">
              <h2 className="text-base font-bold text-white tracking-wide">
                Opciones de LinguaFlow
              </h2>
              <button
                type="button"
                onClick={() => setIsMobileDrawerOpen(false)}
                aria-label="Cerrar opciones"
                className="p-1.5 rounded-lg text-stone-400 hover:text-white hover:bg-white/5 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* 1. Modo de Práctica Actual */}
            <div className="mt-4">
              <h3 className="text-xs font-semibold text-rose-100/90 mb-2">
                {t('mobile_navigation')}
              </h3>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (setActiveTab) setActiveTab('home');
                    setIsMobileDrawerOpen(false);
                  }}
                  className={`flex flex-col items-center justify-center p-2.5 rounded-2xl border transition-all ${
                    activeTab === 'home'
                      ? 'bg-[#3f1c14] border-rose-500/70 text-white shadow-md shadow-rose-950/40'
                      : 'bg-[#200f0a] border-[#3d190f] text-stone-400 hover:text-stone-200'
                  }`}
                >
                  <div className="w-7 h-7 rounded-xl flex items-center justify-center mb-1">
                    <Home className="w-4 h-4" />
                  </div>
                  <span className="text-xs font-semibold">{t('nav_home')}</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    if (setActiveTab) setActiveTab('chat');
                    setIsMobileDrawerOpen(false);
                  }}
                  className={`flex flex-col items-center justify-center p-2.5 rounded-2xl border transition-all ${
                    activeTab === 'chat'
                      ? 'bg-[#3f1c14] border-rose-500/70 text-white shadow-md shadow-rose-950/40'
                      : 'bg-[#200f0a] border-[#3d190f] text-stone-400 hover:text-stone-200'
                  }`}
                >
                  <div className="w-7 h-7 rounded-xl flex items-center justify-center mb-1">
                    <MessageSquare className="w-4 h-4" />
                  </div>
                  <span className="text-xs font-semibold">{t('nav_chat')}</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    if (setActiveTab) setActiveTab('youtube');
                    setIsMobileDrawerOpen(false);
                  }}
                  className={`flex flex-col items-center justify-center p-2.5 rounded-2xl border transition-all ${
                    activeTab === 'youtube'
                      ? 'bg-[#3f1c14] border-rose-500/70 text-white shadow-md shadow-rose-950/40'
                      : 'bg-[#200f0a] border-[#3d190f] text-stone-400 hover:text-stone-200'
                  }`}
                >
                  <div className="w-7 h-7 rounded-xl flex items-center justify-center mb-1">
                    <Youtube className="w-4 h-4" />
                  </div>
                  <span className="text-xs font-semibold text-center leading-tight">
                    YouTube<br />Reader
                  </span>
                </button>
              </div>
            </div>

            {/* 2. Idioma del Sitio Web (ES / EN) */}
            <div className="mt-5">
              <div className="flex items-center justify-between mb-1">
                <h3 className="text-xs font-semibold text-rose-100/90 flex items-center space-x-1.5">
                  <Globe className="w-3.5 h-3.5 text-rose-400" />
                  <span>{t('site_language_title')}</span>
                </h3>
                <span className="text-[10px] text-rose-300/70 font-medium bg-rose-950/70 px-2 py-0.5 rounded-full border border-rose-800/60">
                  ES / EN
                </span>
              </div>
              <p className="text-[11px] text-stone-400 font-medium mb-2.5">
                {t('site_language_desc')}
              </p>
              <SiteLanguageToggle variant="segmented" />
            </div>

            {/* 3. Configuración de Idioma */}
            <div className="mt-5">
              <div className="flex items-center justify-between mb-1">
                <h3 className="text-xs font-semibold text-rose-100/90 flex items-center space-x-1.5">
                  <Languages className="w-3.5 h-3.5 text-rose-400" />
                  <span>{t('mobile_lang_settings')}</span>
                </h3>
                <span className="text-[10px] text-rose-300/70 font-medium bg-rose-950/70 px-2 py-0.5 rounded-full border border-rose-800/60">
                  Banderas
                </span>
              </div>
              <p className="text-[11px] text-stone-400 font-medium mb-3">
                {t('mobile_lang_desc')}
              </p>

              {/* Tu Idioma (Nativo) */}
              <div className="mb-2.5">
                <LanguageSelectDropdown
                  value={nativeLang}
                  onChange={setNativeLang}
                  options={NATIVE_LANG_OPTIONS}
                  label={t('native_lang_card_title')}
                  variant="card"
                  align="left"
                  className="w-full"
                />
              </div>

              {/* Idioma a Aprender (Target) */}
              <div>
                <LanguageSelectDropdown
                  value={targetLang}
                  onChange={setTargetLang}
                  options={languages}
                  label={t('target_lang_card_title')}
                  variant="card"
                  align="left"
                  className="w-full"
                />
              </div>
            </div>

            {/* 4. Herramientas de Voz e IA */}
            <div className="mt-5">
              <h3 className="text-xs font-semibold text-rose-100/90 mb-2">
                {t('voice_ai_tools')}
              </h3>
              <div className="space-y-2">
                {/* Transliteración */}
                <div className="flex items-center justify-between p-2.5 rounded-2xl bg-[#200f0a] border border-[#3d190f]">
                  <div className="flex items-center space-x-3">
                    <div className="w-7 h-7 rounded-full bg-[#2d140d] border border-[#482015] flex items-center justify-center text-rose-300 font-serif font-bold text-xs">
                      T
                    </div>
                    <span className="text-xs font-medium text-stone-200">
                      {t('transliteration')}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowTransliteration(!showTransliteration)}
                    aria-label="Alternar transliteración"
                    className={`w-12 h-6 rounded-full transition-all flex items-center px-0.5 ${
                      showTransliteration
                        ? 'bg-gradient-to-r from-rose-500 to-pink-500 justify-end pr-1.5'
                        : 'bg-[#2d160e] border border-[#482015] justify-start pl-0.5'
                    }`}
                  >
                    {showTransliteration ? (
                      <span className="text-[10px] font-bold text-white tracking-wide">ON</span>
                    ) : (
                      <div className="w-5 h-5 rounded-full bg-white shadow-xs" />
                    )}
                  </button>
                </div>

                {/* Manos Libres */}
                <div className="flex items-center justify-between p-2.5 rounded-2xl bg-[#200f0a] border border-[#3d190f]">
                  <div className="flex items-center space-x-3">
                    <div className="w-7 h-7 rounded-full bg-[#2d140d] border border-[#482015] flex items-center justify-center text-rose-300">
                      <Mic className="w-3.5 h-3.5" />
                    </div>
                    <span className="text-xs font-medium text-stone-200">
                      {t('hands_free')}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setHandsFree(!handsFree)}
                    aria-label="Alternar manos libres"
                    className={`w-12 h-6 rounded-full transition-all flex items-center px-0.5 ${
                      handsFree
                        ? 'bg-gradient-to-r from-rose-500 to-pink-500 justify-end pr-1.5'
                        : 'bg-[#2d160e] border border-[#482015] justify-start pl-0.5'
                    }`}
                  >
                    {handsFree ? (
                      <span className="text-[10px] font-bold text-white tracking-wide">ON</span>
                    ) : (
                      <div className="w-5 h-5 rounded-full bg-white shadow-xs" />
                    )}
                  </button>
                </div>

                {/* Modelo de IA */}
                <button
                  type="button"
                  onClick={() => {
                    onOpenSettings();
                    setIsMobileDrawerOpen(false);
                  }}
                  className="w-full flex items-center justify-between p-2.5 rounded-2xl bg-[#200f0a] border border-[#3d190f] hover:bg-[#28130c] transition-colors"
                >
                  <div className="flex items-center space-x-3 truncate">
                    <div className="w-7 h-7 rounded-full bg-[#2d140d] border border-[#482015] flex items-center justify-center text-teal-400 shrink-0">
                      <Sparkles className="w-3.5 h-3.5" />
                    </div>
                    <span className="text-xs font-medium text-stone-200 truncate">
                      Groq AI (openai/gpt-oss-120b)
                    </span>
                  </div>
                  <ChevronDown className="w-4 h-4 text-stone-400 shrink-0 ml-1" />
                </button>
              </div>
            </div>

            {/* 5. Acciones */}
            <div className="mt-5">
              <h3 className="text-xs font-semibold text-rose-100/90 mb-2">
                {t('conv_actions')}
              </h3>
              <button
                type="button"
                onClick={() => {
                  if (onResetChat) onResetChat();
                  setIsMobileDrawerOpen(false);
                }}
                className="w-full bg-[#200f0a] border border-[#3d190f] rounded-2xl p-3 flex items-center space-x-3 text-left hover:bg-[#28130c] transition-colors"
              >
                <RotateCcw className="w-4 h-4 text-rose-300 shrink-0" />
                <span className="text-xs font-medium text-stone-200">
                  {t('reset_conv')}
                </span>
              </button>
            </div>

            {/* 6. Cuenta y Ajustes */}
            <div className="mt-5">
              <h3 className="text-xs font-semibold text-rose-100/90 mb-2">
                {t('account_settings')}
              </h3>
              <button
                type="button"
                onClick={() => {
                  onOpenSettings();
                  setIsMobileDrawerOpen(false);
                }}
                className="w-full bg-[#200f0a] border border-[#3d190f] rounded-2xl p-3 flex items-center space-x-3 text-left hover:bg-[#28130c] transition-colors"
              >
                <Settings className="w-4 h-4 text-rose-300 shrink-0" />
                <span className="text-xs font-medium text-stone-200">
                  {t('advanced_settings')}
                </span>
              </button>
            </div>

            {/* Bottom decorative star */}
            <div className="mt-6 mb-2 flex items-center justify-center text-stone-500/40">
              <svg className="w-6 h-6 fill-current" viewBox="0 0 24 24">
                <path d="M12 0L14.59 9.41L24 12L14.59 14.59L12 24L9.41 14.59L0 12L9.41 9.41L12 0Z" />
              </svg>
            </div>
          </div>
        </div>
      )}

    </>
  );
}
