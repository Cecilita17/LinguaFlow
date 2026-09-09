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
  Youtube
} from 'lucide-react';

const LANGUAGE_FLAGS = {
  es: '🇪🇸',
  en: '🇺🇸',
  de: '🇩🇪',
  nl: '🇳🇱',
  pl: '🇵🇱',
  ru: '🇷🇺',
  fr: '🇫🇷',
  it: '🇮🇹',
  zh: '🇨🇳',
  ar: '🇸🇦',
  pt: '🇧🇷',
  tr: '🇹🇷',
  ja: '🇯🇵'
};

const NATIVE_LANG_OPTIONS = [
  { code: 'es', name: 'Español' },
  { code: 'en', name: 'English' },
  { code: 'de', name: 'Deutsch' },
  { code: 'nl', name: 'Nederlands' },
  { code: 'ru', name: 'Русский' },
  { code: 'pl', name: 'Polski' },
  { code: 'it', name: 'Italiano' },
  { code: 'fr', name: 'Français' },
  { code: 'zh', name: '中文' },
  { code: 'ar', name: 'العربية' },
  { code: 'pt', name: 'Português' }
];

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
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);

  const currentTargetName = languages.find((l) => l.code === targetLang)?.name || targetLang;
  const currentNativeName =
    NATIVE_LANG_OPTIONS.find((l) => l.code === nativeLang)?.name ||
    languages.find((l) => l.code === nativeLang)?.name ||
    nativeLang;

  return (
    <>
      <header className="sticky top-0 z-30 bg-[#23120b]/95 backdrop-blur-md border-b border-[#3d190f] px-4 py-2.5 md:py-3 shadow-lg shadow-black/25 text-white transition-colors">
        {/* MOBILE TOP BAR (< md) */}
        <div className="flex md:hidden items-center justify-between w-full">
          {/* Left: Brand Logo & Titles */}
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-rose-500 to-pink-500 flex items-center justify-center text-white shadow-md shadow-rose-950/50 shrink-0">
              <Sparkles className="w-5 h-5 fill-white text-white" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="font-bold text-white text-[17px] leading-tight tracking-wide">
                  LinguaFlow
                </h1>
                <span className="text-[10px] uppercase tracking-wider font-bold bg-rose-950/70 text-rose-300 px-2 py-0.5 rounded-full border border-rose-800/80">
                  AI TUTOR
                </span>
              </div>
              <p className="text-[11px] text-rose-200/60 leading-tight mt-0.5">
                Práctica conversacional interactiva
              </p>
            </div>
          </div>

          {/* Right: Circular Target Language Button + Hamburger Menu */}
          <div className="flex items-center space-x-2 shrink-0">
            {/* Circular Language Flag Button */}
            <div className="relative flex items-center justify-center bg-[#2d140d] border border-[#482015] rounded-full pl-2 pr-1.5 py-1 shadow-xs hover:bg-[#381a11] transition-colors">
              <span className="text-base leading-none select-none">
                {LANGUAGE_FLAGS[targetLang] || '🌐'}
              </span>
              <ChevronDown className="w-3.5 h-3.5 text-stone-300 ml-1 pointer-events-none" />
              <select
                value={targetLang}
                onChange={(e) => setTargetLang(e.target.value)}
                aria-label="Idioma a practicar"
                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full text-base"
              >
                {languages.map((l) => (
                  <option key={l.code} value={l.code} className="bg-[#1a0c07] text-white">
                    {l.name}
                  </option>
                ))}
              </select>
            </div>

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
          <div className="flex items-center space-x-2.5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-rose-500 to-pink-400 flex items-center justify-center text-white shadow-md shadow-rose-900/40">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="font-bold text-white text-lg leading-tight tracking-wide">LinguaFlow</h1>
                <span className="text-[10px] uppercase tracking-wider font-bold bg-rose-950/80 text-rose-300 px-2.5 py-0.5 rounded-full border border-rose-800/80">
                  AI Tutor
                </span>
              </div>
              <p className="text-xs text-rose-200/70">Práctica conversacional interactiva</p>
            </div>
          </div>

          {/* Navigation Tabs (Chat vs YouTube Reader) */}
          <div className="flex items-center p-1 bg-[#1e0f0a]/90 rounded-xl border border-[#482519] text-xs font-bold">
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
              <span>Chat</span>
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
              <span>YouTube Reader</span>
            </button>
          </div>

          {/* Language Selectors */}
          <div className="flex items-center space-x-2 bg-[#1e0f0a]/90 p-1.5 rounded-xl border border-[#482519] text-xs">
            <div className="flex items-center space-x-1 pl-1 text-rose-200/70">
              <Languages className="w-4 h-4 text-rose-300" />
              <span className="hidden sm:inline font-medium">Practicar:</span>
            </div>
            <select
              value={targetLang}
              onChange={(e) => setTargetLang(e.target.value)}
              aria-label="Idioma a practicar"
              className="bg-[#3b1e15] text-white font-semibold rounded-lg px-2 py-1 shadow-xs border border-[#5a2e20] outline-none focus:ring-2 focus:ring-rose-400"
            >
              {languages.map((l) => (
                <option key={l.code} value={l.code} className="bg-[#2b160f] text-white">
                  {l.name}
                </option>
              ))}
            </select>

            <span className="text-[#5a2e20] font-light">|</span>

            <div className="flex items-center space-x-1 text-rose-200/70">
              <span className="hidden sm:inline font-medium">Tu idioma:</span>
            </div>
            <select
              value={nativeLang}
              onChange={(e) => setNativeLang(e.target.value)}
              aria-label="Tu idioma nativo"
              className="bg-[#3b1e15] text-white font-semibold rounded-lg px-2 py-1 shadow-xs border border-[#5a2e20] outline-none focus:ring-2 focus:ring-rose-400"
            >
              <option value="es" className="bg-[#2b160f] text-white">Español</option>
              <option value="en" className="bg-[#2b160f] text-white">English</option>
              <option value="de" className="bg-[#2b160f] text-white">Deutsch</option>
              <option value="nl" className="bg-[#2b160f] text-white">Nederlands</option>
              <option value="ru" className="bg-[#2b160f] text-white">Русский</option>
              <option value="pl" className="bg-[#2b160f] text-white">Polski</option>
              <option value="it" className="bg-[#2b160f] text-white">Italiano</option>
              <option value="fr" className="bg-[#2b160f] text-white">Français</option>
              <option value="zh" className="bg-[#2b160f] text-white">中文</option>
              <option value="ar" className="bg-[#2b160f] text-white">العربية</option>
              <option value="pt" className="bg-[#2b160f] text-white">Português</option>
            </select>
          </div>

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
                Modo de Práctica Actual
              </h3>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (setActiveTab) setActiveTab('chat');
                    setIsMobileDrawerOpen(false);
                  }}
                  className={`flex flex-col items-center justify-center p-3 rounded-2xl border transition-all ${
                    activeTab === 'chat'
                      ? 'bg-[#3f1c14] border-rose-500/70 text-white shadow-md shadow-rose-950/40'
                      : 'bg-[#200f0a] border-[#3d190f] text-stone-400 hover:text-stone-200'
                  }`}
                >
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center mb-1">
                    <MessageSquare className="w-5 h-5" />
                  </div>
                  <span className="text-xs font-semibold">Chat</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    if (setActiveTab) setActiveTab('youtube');
                    setIsMobileDrawerOpen(false);
                  }}
                  className={`flex flex-col items-center justify-center p-3 rounded-2xl border transition-all ${
                    activeTab === 'youtube'
                      ? 'bg-[#3f1c14] border-rose-500/70 text-white shadow-md shadow-rose-950/40'
                      : 'bg-[#200f0a] border-[#3d190f] text-stone-400 hover:text-stone-200'
                  }`}
                >
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center mb-1">
                    <Youtube className="w-5 h-5" />
                  </div>
                  <span className="text-xs font-semibold text-center leading-tight">
                    YouTube<br />Reader
                  </span>
                </button>
              </div>
            </div>

            {/* 2. Configuración de Idioma */}
            <div className="mt-5">
              <h3 className="text-xs font-semibold text-rose-100/90 mb-1">
                Configuración de Idioma
              </h3>
              <p className="text-[11px] text-stone-400 font-medium mb-2.5">
                Idiomas de la App y Tutor
              </p>

              {/* Tu Idioma */}
              <div className="relative bg-[#200f0a] border border-[#3d190f] rounded-2xl p-3 flex items-center justify-between shadow-xs mb-2">
                <div className="flex items-center space-x-3 pointer-events-none">
                  <span className="text-xl leading-none">
                    {LANGUAGE_FLAGS[nativeLang] || '🌐'}
                  </span>
                  <span className="text-xs font-medium text-stone-200">
                    Tu Idioma ({currentNativeName})
                  </span>
                </div>
                <ChevronDown className="w-4 h-4 text-stone-400 pointer-events-none" />
                <select
                  value={nativeLang}
                  onChange={(e) => setNativeLang(e.target.value)}
                  aria-label="Tu idioma nativo"
                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full text-base bg-[#200f0a] text-white"
                >
                  {NATIVE_LANG_OPTIONS.map((l) => (
                    <option key={l.code} value={l.code} className="bg-[#1a0c07] text-white">
                      {l.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Idioma a Aprender */}
              <div className="relative bg-[#200f0a] border border-[#3d190f] rounded-2xl p-3 flex items-center justify-between shadow-xs">
                <div className="flex items-center space-x-3 pointer-events-none">
                  <span className="text-xl leading-none">
                    {LANGUAGE_FLAGS[targetLang] || '🌐'}
                  </span>
                  <span className="text-xs font-medium text-stone-200">
                    Idioma a Aprender ({currentTargetName})
                  </span>
                </div>
                <ChevronDown className="w-4 h-4 text-stone-400 pointer-events-none" />
                <select
                  value={targetLang}
                  onChange={(e) => setTargetLang(e.target.value)}
                  aria-label="Idioma a practicar"
                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full text-base bg-[#200f0a] text-white"
                >
                  {languages.map((l) => (
                    <option key={l.code} value={l.code} className="bg-[#1a0c07] text-white">
                      {l.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* 3. Herramientas de Voz e IA */}
            <div className="mt-5">
              <h3 className="text-xs font-semibold text-rose-100/90 mb-2">
                Herramientas de Voz e IA
              </h3>
              <div className="space-y-2">
                {/* Transliteración */}
                <div className="flex items-center justify-between p-2.5 rounded-2xl bg-[#200f0a] border border-[#3d190f]">
                  <div className="flex items-center space-x-3">
                    <div className="w-7 h-7 rounded-full bg-[#2d140d] border border-[#482015] flex items-center justify-center text-rose-300 font-serif font-bold text-xs">
                      T
                    </div>
                    <span className="text-xs font-medium text-stone-200">
                      Transliteración
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
                      Manos Libres
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
                      Modelo de IA (openai/gpt-oss-120b)
                    </span>
                  </div>
                  <ChevronDown className="w-4 h-4 text-stone-400 shrink-0 ml-1" />
                </button>
              </div>
            </div>

            {/* 4. Acciones */}
            <div className="mt-5">
              <h3 className="text-xs font-semibold text-rose-100/90 mb-2">
                Acciones
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
                  Reiniciar <span className="text-stone-400">Nueva Conversación</span>
                </span>
              </button>
            </div>

            {/* 5. Cuenta y Ajustes */}
            <div className="mt-5">
              <h3 className="text-xs font-semibold text-rose-100/90 mb-2">
                Cuenta y Ajustes
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
                  Ajustes Avanzados
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
