import React from 'react';
import {
  MessageSquare,
  Youtube,
  Sparkles,
  ArrowRight,
  CheckCircle2,
  FileText,
  Camera,
  CalendarCheck,
  Settings as SettingsIcon,
  Zap,
  Server,
  Info
} from 'lucide-react';
import { LanguageSelectDropdown } from '../components/LanguageSelectDropdown.jsx';
import { useSiteLanguage } from '../context/SiteLanguageContext.jsx';
import {
  LANGUAGE_FLAGS,
  NATIVE_LANG_OPTIONS,
  getLanguageMeta
} from '../constants/languages.js';
import { getStudyGreeting } from '../constants/greetings.js';

export default function HomePage({
  onSelectMode,
  targetLang,
  setTargetLang,
  nativeLang,
  setNativeLang,
  languages = [],
  apiWarning = null
}) {
  const { t, isSpanish } = useSiteLanguage();
  const currentTargetMeta = getLanguageMeta(targetLang);
  const currentNativeMeta = getLanguageMeta(nativeLang);
  const greeting = getStudyGreeting(targetLang);

  return (
    <div className="flex-1 overflow-y-auto w-full relative bg-gradient-to-b from-[#faf5f0] via-[#f7f0e8] to-[#f0e6dc] text-[var(--text-primary)] dark:from-[#180905] dark:via-[#210d07] dark:to-[#140603] dark:text-stone-100 flex flex-col justify-between px-3 sm:px-6 py-4 sm:py-8 home-gradient-bg">
      {/* Background ambient lighting effects */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-rose-500/5 dark:bg-rose-600/10 rounded-full blur-3xl pointer-events-none -z-10" />
      <div className="absolute bottom-10 right-1/4 w-96 h-96 bg-amber-400/5 dark:bg-amber-500/10 rounded-full blur-3xl pointer-events-none -z-10" />

      {/* Main Container */}
      <div className="max-w-4xl mx-auto w-full flex-1 flex flex-col justify-center">

        {/* 1. DYNAMIC GREETING (prominent on mobile & desktop, immediately updates when targetLang changes) */}
        <div className="w-full flex flex-col items-center justify-center text-center mx-auto mb-4 sm:mb-6 animate-fade-in pt-1">
          <h1
            className="w-full flex items-center justify-center text-center text-4xl sm:text-6xl font-black tracking-tight text-[var(--text-primary)] dark:text-white leading-tight transition-all"
            dir={greeting.rtl ? 'rtl' : 'ltr'}
          >
            <span className="inline-block text-center bg-gradient-to-r from-rose-600 via-pink-600 to-amber-600 dark:from-rose-400 dark:via-pink-400 dark:to-amber-300 bg-clip-text text-transparent">
              {greeting.text}
            </span>
          </h1>

          {greeting.translit && (
            <p className="text-xs sm:text-sm font-medium text-rose-500/80 dark:text-rose-300/80 mt-1 font-mono tracking-wide text-center">
              {greeting.translit}
            </p>
          )}

          <p className="text-xs sm:text-sm text-[var(--text-secondary)] dark:text-rose-100/70 mt-1.5 font-medium">
            {isSpanish ? 'Selecciona una actividad para continuar practicando' : 'Choose an activity to keep practicing'}
          </p>
        </div>

        {/* 2. MAIN ACTION CARDS (Mobile: 2-column big icon grid; Desktop: 2-column detailed cards) */}
        <div className="grid grid-cols-2 sm:grid-cols-2 gap-3 sm:gap-5 w-full mb-6">

          {/* CARD 1: TUTOR CHAT */}
          <div
            onClick={() => onSelectMode('chat')}
            className="group relative p-4 py-5 sm:p-6 rounded-2xl sm:rounded-3xl bg-[var(--surface-primary)] hover:bg-[var(--surface-secondary)] border border-[var(--border-primary)] hover:border-rose-500/80 transition-all duration-300 shadow-md hover:shadow-xl dark:bg-[#241009]/95 dark:hover:bg-[#2e150d] dark:border-[#4a2216] dark:shadow-xl dark:shadow-black/40 dark:hover:shadow-2xl dark:hover:shadow-rose-950/50 flex flex-col items-center sm:items-stretch justify-center sm:justify-between text-center sm:text-left cursor-pointer overflow-hidden transform active:scale-95 sm:active:scale-98 sm:hover:-translate-y-1 min-h-[135px] sm:min-h-0"
          >
            <div className="flex flex-col sm:flex-row items-center sm:space-x-4">
              <div className="w-14 h-14 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-tr from-rose-600 via-rose-500 to-pink-500 flex items-center justify-center text-white shadow-lg shadow-rose-950/40 shrink-0 mb-2.5 sm:mb-0 group-hover:scale-105 transition-transform">
                <MessageSquare className="w-7 h-7 sm:w-7 sm:h-7" />
              </div>
              <div className="w-full sm:flex-1 sm:min-w-0">
                <div className="flex items-center justify-center sm:justify-between">
                  <h2 className="text-sm sm:text-lg font-bold text-[var(--text-primary)] dark:text-white group-hover:text-rose-500 dark:group-hover:text-rose-200 transition-colors line-clamp-2 leading-tight sm:leading-normal">
                    Conversations & Voice
                  </h2>
                  <span className="hidden sm:inline-flex text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-600 dark:text-rose-300 border border-rose-500/30">
                    IA
                  </span>
                </div>
                <p className="hidden sm:block text-xs text-[var(--text-secondary)] dark:text-rose-200/70 mt-1 leading-snug line-clamp-2">
                  {isSpanish
                    ? 'Conversación interactiva con correcciones inteligentes en tiempo real.'
                    : 'Interactive AI conversation with real-time grammar feedback.'}
                </p>
              </div>
            </div>
            <div className="hidden sm:flex mt-4 pt-3 border-t border-[var(--border-primary)]/50 items-center justify-between text-xs font-bold text-rose-600 dark:text-rose-300">
              <span>{isSpanish ? 'Abrir Chat' : 'Start Chat'}</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>

          {/* CARD 2: YOUTUBE READER (Opens YouTube Library) */}
          <div
            onClick={() => onSelectMode('youtube')}
            className="group relative p-4 py-5 sm:p-6 rounded-2xl sm:rounded-3xl bg-[var(--surface-primary)] hover:bg-[var(--surface-secondary)] border border-[var(--border-primary)] hover:border-amber-500/80 transition-all duration-300 shadow-md hover:shadow-xl dark:bg-[#241009]/95 dark:hover:bg-[#2e150d] dark:border-[#4a2216] dark:shadow-xl dark:shadow-black/40 dark:hover:shadow-2xl dark:hover:shadow-amber-950/50 flex flex-col items-center sm:items-stretch justify-center sm:justify-between text-center sm:text-left cursor-pointer overflow-hidden transform active:scale-95 sm:active:scale-98 sm:hover:-translate-y-1 min-h-[135px] sm:min-h-0"
          >
            <div className="flex flex-col sm:flex-row items-center sm:space-x-4">
              <div className="w-14 h-14 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-tr from-red-600 via-rose-600 to-amber-500 flex items-center justify-center text-white shadow-lg shadow-red-950/40 shrink-0 mb-2.5 sm:mb-0 group-hover:scale-105 transition-transform">
                <Youtube className="w-7 h-7 sm:w-7 sm:h-7" />
              </div>
              <div className="w-full sm:flex-1 sm:min-w-0">
                <div className="flex items-center justify-center sm:justify-between">
                  <h2 className="text-sm sm:text-lg font-bold text-[var(--text-primary)] dark:text-white group-hover:text-amber-500 dark:group-hover:text-amber-200 transition-colors line-clamp-2 leading-tight sm:leading-normal">
                    YouTube Reader
                  </h2>
                  <span className="hidden sm:inline-flex text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-300 border border-amber-500/30">
                    {isSpanish ? 'Biblioteca' : 'Library'}
                  </span>
                </div>
                <p className="hidden sm:block text-xs text-[var(--text-secondary)] dark:text-rose-200/70 mt-1 leading-snug line-clamp-2">
                  {isSpanish
                    ? 'Tu biblioteca de vídeos con transcripciones interlineales y glosado.'
                    : 'Your video library with interlinear transcripts and instant glossing.'}
                </p>
              </div>
            </div>
            <div className="hidden sm:flex mt-4 pt-3 border-t border-[var(--border-primary)]/50 items-center justify-between text-xs font-bold text-amber-600 dark:text-amber-300">
              <span>{isSpanish ? 'Ver Biblioteca de Vídeos' : 'Open Video Library'}</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>

          {/* CARD 3: TEXT READER */}
          <div
            onClick={() => onSelectMode('text')}
            className="group relative p-4 py-5 sm:p-6 rounded-2xl sm:rounded-3xl bg-[var(--surface-primary)] hover:bg-[var(--surface-secondary)] border border-[var(--border-primary)] hover:border-pink-500/80 transition-all duration-300 shadow-md hover:shadow-xl dark:bg-[#241009]/95 dark:hover:bg-[#2e150d] dark:border-[#4a2216] dark:shadow-xl dark:shadow-black/40 dark:hover:shadow-2xl dark:hover:shadow-pink-950/50 flex flex-col items-center sm:items-stretch justify-center sm:justify-between text-center sm:text-left cursor-pointer overflow-hidden transform active:scale-95 sm:active:scale-98 sm:hover:-translate-y-1 min-h-[135px] sm:min-h-0"
          >
            <div className="flex flex-col sm:flex-row items-center sm:space-x-4">
              <div className="w-14 h-14 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-tr from-pink-600 via-rose-500 to-amber-500 flex items-center justify-center text-white shadow-lg shadow-pink-950/40 shrink-0 mb-2.5 sm:mb-0 group-hover:scale-105 transition-transform">
                <FileText className="w-7 h-7 sm:w-7 sm:h-7" />
              </div>
              <div className="w-full sm:flex-1 sm:min-w-0">
                <div className="flex items-center justify-center sm:justify-between">
                  <h2 className="text-sm sm:text-lg font-bold text-[var(--text-primary)] dark:text-white group-hover:text-pink-500 dark:group-hover:text-pink-200 transition-colors line-clamp-2 leading-tight sm:leading-normal">
                    Text Reader
                  </h2>
                  <span className="hidden sm:inline-flex text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-pink-500/15 text-pink-600 dark:text-pink-300 border border-pink-500/30">
                    EPUB / TXT
                  </span>
                </div>
                <p className="hidden sm:block text-xs text-[var(--text-secondary)] dark:text-rose-200/70 mt-1 leading-snug line-clamp-2">
                  {isSpanish
                    ? 'Lee textos y libros con audio por párrafos y definiciones al clic.'
                    : 'Read texts and books with paragraph TTS audio and word lookups.'}
                </p>
              </div>
            </div>
            <div className="hidden sm:flex mt-4 pt-3 border-t border-[var(--border-primary)]/50 items-center justify-between text-xs font-bold text-pink-600 dark:text-pink-300">
              <span>{isSpanish ? 'Abrir Text Reader' : 'Open Text Reader'}</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>

          {/* CARD 4: IMAGE READER */}
          <div
            onClick={() => onSelectMode('image')}
            className="group relative p-4 py-5 sm:p-6 rounded-2xl sm:rounded-3xl bg-[var(--surface-primary)] hover:bg-[var(--surface-secondary)] border border-[var(--border-primary)] hover:border-pink-500/80 transition-all duration-300 shadow-md hover:shadow-xl dark:bg-[#241009]/95 dark:hover:bg-[#2e150d] dark:border-[#4a2216] dark:shadow-xl dark:shadow-black/40 dark:hover:shadow-2xl dark:hover:shadow-pink-950/50 flex flex-col items-center sm:items-stretch justify-center sm:justify-between text-center sm:text-left cursor-pointer overflow-hidden transform active:scale-95 sm:active:scale-98 sm:hover:-translate-y-1 min-h-[135px] sm:min-h-0"
          >
            <div className="flex flex-col sm:flex-row items-center sm:space-x-4">
              <div className="w-14 h-14 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-tr from-pink-600 via-rose-500 to-pink-400 flex items-center justify-center text-white shadow-lg shadow-pink-950/40 shrink-0 mb-2.5 sm:mb-0 group-hover:scale-105 transition-transform">
                <Camera className="w-7 h-7 sm:w-7 sm:h-7" />
              </div>
              <div className="w-full sm:flex-1 sm:min-w-0">
                <div className="flex items-center justify-center sm:justify-between">
                  <h2 className="text-sm sm:text-lg font-bold text-[var(--text-primary)] dark:text-white group-hover:text-pink-500 dark:group-hover:text-pink-200 transition-colors line-clamp-2 leading-tight sm:leading-normal">
                    Image Reader
                  </h2>
                  <span className="hidden sm:inline-flex text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-pink-500/15 text-pink-600 dark:text-pink-300 border border-pink-500/30">
                    Vision IA
                  </span>
                </div>
                <p className="hidden sm:block text-xs text-[var(--text-secondary)] dark:text-rose-200/70 mt-1 leading-snug line-clamp-2">
                  {isSpanish
                    ? 'Sube una foto y obtén una descripción pedagógica adaptada a tu nivel con lectura y audio.'
                    : 'Upload a photo to get a level-adapted pedagogical description with reading and audio.'}
                </p>
              </div>
            </div>
            <div className="hidden sm:flex mt-4 pt-3 border-t border-[var(--border-primary)]/50 items-center justify-between text-xs font-bold text-pink-600 dark:text-pink-300">
              <span>{isSpanish ? 'Abrir Image Reader' : 'Open Image Reader'}</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>

          {/* CARD 5: HABIT TRACKER (Opens Dedicated Habit Tracker Section) */}
          <div
            onClick={() => onSelectMode('habits')}
            className="group relative p-4 py-5 sm:p-6 rounded-2xl sm:rounded-3xl bg-[var(--surface-primary)] hover:bg-[var(--surface-secondary)] border border-[var(--border-primary)] hover:border-amber-500/80 transition-all duration-300 shadow-md hover:shadow-xl dark:bg-[#241009]/95 dark:hover:bg-[#2e150d] dark:border-[#4a2216] dark:shadow-xl dark:shadow-black/40 dark:hover:shadow-2xl dark:hover:shadow-amber-950/50 flex flex-col items-center sm:items-stretch justify-center sm:justify-between text-center sm:text-left cursor-pointer overflow-hidden transform active:scale-95 sm:active:scale-98 sm:hover:-translate-y-1 min-h-[135px] sm:min-h-0"
          >
            <div className="flex flex-col sm:flex-row items-center sm:space-x-4">
              <div className="w-14 h-14 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-tr from-amber-500 via-rose-500 to-pink-500 flex items-center justify-center text-white shadow-lg shadow-rose-950/40 shrink-0 mb-2.5 sm:mb-0 group-hover:scale-105 transition-transform">
                <CalendarCheck className="w-7 h-7 sm:w-7 sm:h-7" />
              </div>
              <div className="w-full sm:flex-1 sm:min-w-0">
                <div className="flex items-center justify-center sm:justify-between">
                  <h2 className="text-sm sm:text-lg font-bold text-[var(--text-primary)] dark:text-white group-hover:text-amber-500 dark:group-hover:text-amber-200 transition-colors line-clamp-2 leading-tight sm:leading-normal">
                    Habit Tracker
                  </h2>
                  <span className="hidden sm:inline-flex text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-300 border border-amber-500/30">
                    📅
                  </span>
                </div>
                <p className="hidden sm:block text-xs text-[var(--text-secondary)] dark:text-rose-200/70 mt-1 leading-snug line-clamp-2">
                  {isSpanish
                    ? 'Lleva un registro diario de tus hábitos de estudio por idioma.'
                    : 'Keep a daily log of your study habits and practice across all languages.'}
                </p>
              </div>
            </div>
            <div className="hidden sm:flex mt-4 pt-3 border-t border-[var(--border-primary)]/50 items-center justify-between text-xs font-bold text-amber-600 dark:text-amber-300">
              <span>{isSpanish ? 'Abrir Habit Tracker' : 'Open Habit Tracker'}</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>

          {/* CARD 6: SETTINGS (Opens Dedicated Settings Page) */}
          <div
            onClick={() => onSelectMode('settings')}
            className="group relative p-4 py-5 sm:p-6 rounded-2xl sm:rounded-3xl bg-[var(--surface-primary)] hover:bg-[var(--surface-secondary)] border border-[var(--border-primary)] hover:border-stone-400/80 transition-all duration-300 shadow-md hover:shadow-xl dark:bg-[#241009]/95 dark:hover:bg-[#2e150d] dark:border-[#4a2216] dark:shadow-xl dark:shadow-black/40 dark:hover:shadow-2xl dark:hover:shadow-stone-900/50 flex flex-col items-center sm:items-stretch justify-center sm:justify-between text-center sm:text-left cursor-pointer overflow-hidden transform active:scale-95 sm:active:scale-98 sm:hover:-translate-y-1 min-h-[135px] sm:min-h-0"
          >
            <div className="flex flex-col sm:flex-row items-center sm:space-x-4">
              <div className="w-14 h-14 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-tr from-stone-600 via-rose-700 to-stone-800 flex items-center justify-center text-white shadow-lg shadow-black/40 shrink-0 mb-2.5 sm:mb-0 group-hover:scale-105 transition-transform">
                <SettingsIcon className="w-7 h-7 sm:w-7 sm:h-7" />
              </div>
              <div className="w-full sm:flex-1 sm:min-w-0">
                <div className="flex items-center justify-center sm:justify-between">
                  <h2 className="text-sm sm:text-lg font-bold text-[var(--text-primary)] dark:text-white group-hover:text-rose-400 transition-colors line-clamp-2 leading-tight sm:leading-normal">
                    {isSpanish ? 'Ajustes' : 'Settings'}
                  </h2>
                  <span className="hidden sm:inline-flex text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-stone-500/15 text-stone-300 border border-stone-500/30">
                    ⚙️
                  </span>
                </div>
                <p className="hidden sm:block text-xs text-[var(--text-secondary)] dark:text-rose-200/70 mt-1 leading-snug line-clamp-2">
                  {isSpanish
                    ? 'Configura idiomas, tema, velocidad de voz, nivel de IA y opciones.'
                    : 'Configure languages, theme, speech speed, AI level and options.'}
                </p>
              </div>
            </div>
            <div className="hidden sm:flex mt-4 pt-3 border-t border-[var(--border-primary)]/50 items-center justify-between text-xs font-bold text-rose-400">
              <span>{isSpanish ? 'Configurar LinguaFlow' : 'Open Settings'}</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>

        </div>

        {/* 3. GROQ AI / BACKEND STATUS INFORMATION (Solely at the bottom of the Home page per Requirement 6 & 7) */}
        <div className="w-full pt-2">
          <div className="p-3.5 sm:p-4 rounded-2xl bg-[var(--surface-primary)] border border-[var(--border-primary)] shadow-xs dark:bg-[#1e0d08]/80 dark:border-[#3b170e] flex items-center justify-between gap-3">
            <div className="flex items-center space-x-3">
              <div
                className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                  apiWarning ? 'bg-rose-500/20 text-rose-400' : 'bg-emerald-500/20 text-emerald-400'
                }`}
              >
                <Zap className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-[var(--text-primary)]">
                    {apiWarning ? (isSpanish ? 'Aviso Groq AI' : 'Groq AI Warning') : (isSpanish ? 'Motor Groq AI Activo' : 'Groq AI Engine Active')}
                  </span>
                  <span
                    className={`w-2 h-2 rounded-full ${
                      apiWarning ? 'bg-rose-500 animate-pulse' : 'bg-emerald-500'
                    }`}
                  />
                </div>
                <div className="text-[11px] text-[var(--text-muted)] font-mono mt-0.5">
                  openai/gpt-oss-120b • Whisper V3
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => onSelectMode('settings')}
              className="text-[11px] font-semibold text-rose-600 dark:text-rose-400 hover:text-rose-700 dark:hover:text-rose-300 underline shrink-0 cursor-pointer"
            >
              {isSpanish ? 'Ver estado' : 'View status'}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
