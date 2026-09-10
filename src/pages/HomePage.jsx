import React from 'react';
import {
  MessageSquare,
  Youtube,
  Sparkles,
  ArrowRight,
  CheckCircle2,
  ChevronDown
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
  pt: '🇧🇷',
  zh: '🇨🇳',
  ja: '🇯🇵',
  ko: '🇰🇷',
  ar: '🇸🇦',
  hi: '🇮🇳',
  tr: '🇹🇷'
};

const NATIVE_LANG_OPTIONS = [
  { code: 'es', name: 'Español' },
  { code: 'en', name: 'Inglés (English)' },
  { code: 'fr', name: 'Francés (Français)' },
  { code: 'de', name: 'Alemán (Deutsch)' },
  { code: 'it', name: 'Italiano' },
  { code: 'pt', name: 'Portugués' },
  { code: 'pl', name: 'Polaco' },
  { code: 'ru', name: 'Ruso' },
  { code: 'zh', name: 'Chino' }
];

export default function HomePage({
  onSelectMode,
  targetLang,
  setTargetLang,
  nativeLang,
  setNativeLang,
  languages = []
}) {
  const currentTargetName = languages.find((l) => l.code === targetLang)?.name || targetLang;
  const currentNativeName =
    NATIVE_LANG_OPTIONS.find((l) => l.code === nativeLang)?.name ||
    languages.find((l) => l.code === nativeLang)?.name ||
    nativeLang;

  return (
    <div className="flex-1 overflow-y-auto w-full relative bg-gradient-to-b from-[#180905] via-[#210d07] to-[#140603] text-stone-100 flex flex-col justify-between px-4 py-8 md:py-12">
      {/* Background ambient lighting effects */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-rose-600/10 rounded-full blur-3xl pointer-events-none -z-10" />
      <div className="absolute bottom-10 right-1/4 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none -z-10" />

      {/* Main Container */}
      <div className="max-w-5xl mx-auto w-full flex-1 flex flex-col justify-center">
        
        {/* Hero Badge & Titles */}
        <div className="text-center max-w-2xl mx-auto mb-8 sm:mb-12 animate-fade-in">
          <div className="inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-full bg-gradient-to-r from-rose-950/90 to-[#38160e] border border-rose-700/50 shadow-md shadow-black/40 mb-4">
            <Sparkles className="w-4 h-4 text-rose-400" />
            <span className="text-xs font-bold tracking-wider uppercase text-rose-200">
              LinguaFlow AI Platform
            </span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-white leading-tight sm:leading-tight">
            ¿Cómo querés practicar{' '}
            <span className="bg-gradient-to-r from-rose-400 via-pink-400 to-amber-300 bg-clip-text text-transparent">
              hoy?
            </span>
          </h1>

          <p className="mt-3 text-sm sm:text-base text-rose-100/70 leading-relaxed max-w-xl mx-auto">
            Elegí tu experiencia de inmersión lingüística: conversá en tiempo real con tu tutor inteligente o entrená tu comprensión con videos de YouTube y subtítulos interactivos.
          </p>

          {/* Quick Language Selection Bar */}
          <div className="mt-6 inline-flex flex-wrap items-center justify-center gap-3 p-2 rounded-2xl bg-[#26110a]/90 border border-[#482015] shadow-lg shadow-black/30 backdrop-blur-md">
            {/* Target Lang */}
            <div className="relative flex items-center space-x-2 px-3 py-1.5 rounded-xl bg-[#36160d] border border-[#542416] hover:border-rose-500/50 transition-colors">
              <span className="text-xs text-rose-200/70 font-medium">Practicando:</span>
              <span className="text-base leading-none">{LANGUAGE_FLAGS[targetLang] || '🌐'}</span>
              <span className="text-xs font-bold text-white">{currentTargetName}</span>
              <ChevronDown className="w-3.5 h-3.5 text-rose-300/70 ml-0.5 pointer-events-none" />
              <select
                value={targetLang}
                onChange={(e) => setTargetLang && setTargetLang(e.target.value)}
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

            {/* Native Lang */}
            <div className="relative flex items-center space-x-2 px-3 py-1.5 rounded-xl bg-[#36160d] border border-[#542416] hover:border-rose-500/50 transition-colors">
              <span className="text-xs text-rose-200/70 font-medium">Tu idioma:</span>
              <span className="text-base leading-none">{LANGUAGE_FLAGS[nativeLang] || '🌐'}</span>
              <span className="text-xs font-bold text-white">{currentNativeName}</span>
              <ChevronDown className="w-3.5 h-3.5 text-rose-300/70 ml-0.5 pointer-events-none" />
              <select
                value={nativeLang}
                onChange={(e) => setNativeLang && setNativeLang(e.target.value)}
                aria-label="Tu idioma nativo"
                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full text-base"
              >
                {NATIVE_LANG_OPTIONS.map((l) => (
                  <option key={l.code} value={l.code} className="bg-[#1a0c07] text-white">
                    {l.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* 2 Big Interactive Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8 max-w-4xl mx-auto w-full mb-10">
          
          {/* CARD 1: CHAT TUTOR */}
          <div
            onClick={() => onSelectMode('chat')}
            className="group relative p-6 sm:p-8 rounded-3xl bg-[#241009]/95 hover:bg-[#2e150d] border border-[#4a2216] hover:border-rose-500/80 transition-all duration-300 shadow-xl shadow-black/40 hover:shadow-2xl hover:shadow-rose-950/50 flex flex-col justify-between cursor-pointer overflow-hidden transform hover:-translate-y-1"
          >
            {/* Top decorative gradient glow */}
            <div className="absolute -top-16 -right-16 w-36 h-36 bg-rose-500/15 rounded-full blur-2xl group-hover:bg-rose-500/25 transition-all" />

            <div>
              {/* Header Icon + Tag */}
              <div className="flex items-center justify-between mb-5">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-rose-600 via-rose-500 to-pink-500 flex items-center justify-center text-white shadow-lg shadow-rose-950/60 group-hover:scale-105 transition-transform">
                  <MessageSquare className="w-7 h-7" />
                </div>
                <span className="text-[11px] font-extrabold uppercase tracking-wider px-3 py-1 rounded-full bg-rose-950/80 text-rose-300 border border-rose-800/70">
                  ✦ Tutor IA
                </span>
              </div>

              {/* Title & Description */}
              <h2 className="text-xl sm:text-2xl font-bold text-white group-hover:text-rose-200 transition-colors">
                Chat con Tutor IA
              </h2>
              <p className="mt-2 text-xs sm:text-sm text-stone-300 leading-relaxed">
                Conversación interactiva y fluida con corrección pedagógica en vivo, desglose morfológico y pronunciación.
              </p>

              {/* Features List */}
              <ul className="mt-5 space-y-2.5 text-xs text-rose-100/80">
                <li className="flex items-start space-x-2.5">
                  <CheckCircle2 className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <span>Corrección en tiempo real con palabras editadas en <strong className="text-amber-300 font-semibold">dorado</strong></span>
                </li>
                <li className="flex items-start space-x-2.5">
                  <CheckCircle2 className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <span>Desglose gramatical interactivo de cada oración</span>
                </li>
                <li className="flex items-start space-x-2.5">
                  <CheckCircle2 className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <span>Reconocimiento de voz con code-switching multilingüe</span>
                </li>
                <li className="flex items-start space-x-2.5">
                  <CheckCircle2 className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <span>Práctica de trazos de caracteres Hanzi (chino)</span>
                </li>
              </ul>
            </div>

            {/* CTA Button */}
            <div className="mt-8 pt-4 border-t border-[#411c12]">
              <button
                type="button"
                className="w-full py-3.5 px-5 rounded-2xl bg-gradient-to-r from-rose-600 via-rose-500 to-pink-600 hover:from-rose-500 hover:to-pink-500 text-white font-bold text-sm shadow-lg shadow-rose-950/60 flex items-center justify-center space-x-2 transition-all group-hover:shadow-rose-900/80"
              >
                <span>Entrar al Chat</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </button>
            </div>
          </div>

          {/* CARD 2: YOUTUBE READER */}
          <div
            onClick={() => onSelectMode('youtube')}
            className="group relative p-6 sm:p-8 rounded-3xl bg-[#241009]/95 hover:bg-[#2e150d] border border-[#4a2216] hover:border-amber-500/80 transition-all duration-300 shadow-xl shadow-black/40 hover:shadow-2xl hover:shadow-amber-950/50 flex flex-col justify-between cursor-pointer overflow-hidden transform hover:-translate-y-1"
          >
            {/* Top decorative gradient glow */}
            <div className="absolute -top-16 -right-16 w-36 h-36 bg-amber-500/15 rounded-full blur-2xl group-hover:bg-amber-500/25 transition-all" />

            <div>
              {/* Header Icon + Tag */}
              <div className="flex items-center justify-between mb-5">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-red-600 via-rose-600 to-amber-500 flex items-center justify-center text-white shadow-lg shadow-red-950/60 group-hover:scale-105 transition-transform">
                  <Youtube className="w-7 h-7" />
                </div>
                <span className="text-[11px] font-extrabold uppercase tracking-wider px-3 py-1 rounded-full bg-amber-950/80 text-amber-300 border border-amber-800/70">
                  🎬 Inmersión Audiovisual
                </span>
              </div>

              {/* Title & Description */}
              <h2 className="text-xl sm:text-2xl font-bold text-white group-hover:text-amber-200 transition-colors">
                Lector de YouTube
              </h2>
              <p className="mt-2 text-xs sm:text-sm text-stone-300 leading-relaxed">
                Estudiá con cualquier video de YouTube, subtítulos interactivos, glosado palabra por palabra y navegación sincronizada.
              </p>

              {/* Features List */}
              <ul className="mt-5 space-y-2.5 text-xs text-rose-100/80">
                <li className="flex items-start space-x-2.5">
                  <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <span>Reproductor fijo con scroll independiente estilo Miraa</span>
                </li>
                <li className="flex items-start space-x-2.5">
                  <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <span>Glosado interlineal completo palabra por palabra</span>
                </li>
                <li className="flex items-start space-x-2.5">
                  <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <span>Segmentación lingüística china y Pinyin interlineal</span>
                </li>
                <li className="flex items-start space-x-2.5">
                  <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <span>Importación de subtítulos SRT, VTT y texto plano</span>
                </li>
              </ul>
            </div>

            {/* CTA Button */}
            <div className="mt-8 pt-4 border-t border-[#411c12]">
              <button
                type="button"
                className="w-full py-3.5 px-5 rounded-2xl bg-gradient-to-r from-amber-600 via-rose-600 to-red-600 hover:from-amber-500 hover:to-rose-500 text-white font-bold text-sm shadow-lg shadow-amber-950/60 flex items-center justify-center space-x-2 transition-all group-hover:shadow-amber-900/80"
              >
                <span>Abrir Lector de YouTube</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </button>
            </div>
          </div>

        </div>

        {/* Feature Highlights Strip */}
        <div className="max-w-4xl mx-auto w-full pt-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center">
            <div className="p-3 rounded-2xl bg-[#1e0d08]/80 border border-[#3b170e]">
              <div className="text-amber-400 font-bold text-xs">⚡ Motor Groq AI</div>
              <div className="text-[11px] text-rose-200/60 mt-0.5">openai/gpt-oss-120b</div>
            </div>
            <div className="p-3 rounded-2xl bg-[#1e0d08]/80 border border-[#3b170e]">
              <div className="text-rose-400 font-bold text-xs">🌐 13+ Idiomas</div>
              <div className="text-[11px] text-rose-200/60 mt-0.5">Soporte interlineal</div>
            </div>
            <div className="p-3 rounded-2xl bg-[#1e0d08]/80 border border-[#3b170e]">
              <div className="text-pink-400 font-bold text-xs">💾 Persistencia Local</div>
              <div className="text-[11px] text-rose-200/60 mt-0.5">Historial por idioma</div>
            </div>
            <div className="p-3 rounded-2xl bg-[#1e0d08]/80 border border-[#3b170e]">
              <div className="text-emerald-400 font-bold text-xs">🎙️ Voz Multilingüe</div>
              <div className="text-[11px] text-rose-200/60 mt-0.5">Code-switching STT</div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
