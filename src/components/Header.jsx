import React from 'react';
import { Languages, Mic, MicOff, Type, Settings, Volume2, Sparkles } from 'lucide-react';

export function Header({
  languages,
  targetLang,
  setTargetLang,
  nativeLang,
  setNativeLang,
  showTransliteration,
  setShowTransliteration,
  handsFree,
  setHandsFree,
  onOpenSettings,
  isListening,
  isSpeaking,
  hasApiKey = false
}) {
  return (
    <header className="sticky top-0 z-30 bg-[#2b160f]/95 backdrop-blur-md border-b border-[#482519] px-4 py-3 shadow-lg shadow-black/20 text-white transition-colors">
      <div className="max-w-4xl mx-auto flex flex-wrap items-center justify-between gap-3">
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
          {hasApiKey ? (
            <button
              type="button"
              onClick={onOpenSettings}
              title="IA Gemini Activa - Clic para ver configuración"
              className="flex items-center space-x-1.5 px-2.5 py-1.5 rounded-xl bg-emerald-950/85 border border-emerald-600/70 text-emerald-200 text-xs font-semibold shadow-xs hover:bg-emerald-900/80 transition-all"
            >
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span className="hidden sm:inline">✨ Gemini IA Activa</span>
              <span className="sm:hidden">IA</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={onOpenSettings}
              title="Conectar Gemini AI para respuestas 100% generativas en vivo"
              className="flex items-center space-x-1.5 px-2.5 py-1.5 rounded-xl bg-gradient-to-r from-rose-950/90 to-pink-950/90 border border-rose-600/60 text-rose-200 hover:text-white text-xs font-semibold shadow-xs hover:border-rose-400 transition-all group"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-300 group-hover:rotate-12 transition-transform" />
              <span className="hidden sm:inline">Conectar Gemini IA</span>
              <span className="sm:hidden">IA</span>
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

      {/* Hands-free Status Banner */}
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
  );
}
