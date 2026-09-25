import React, { useMemo } from 'react';
import {
  MessageSquare,
  Youtube,
  FileText,
  Camera,
  Flame,
  ArrowRight,
  ChevronRight,
  Sparkles
} from 'lucide-react';
import { useSiteLanguage } from '../context/SiteLanguageContext.jsx';
import { getLanguageMeta } from '../constants/languages.js';
import { getStudyGreeting } from '../constants/greetings.js';
import { loadHabitTrackerData } from '../services/habitTrackerService.js';

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
  const greeting = getStudyGreeting(targetLang);

  // Compute daily habit progress
  const habitStats = useMemo(() => {
    try {
      const data = loadHabitTrackerData();
      const today = new Date();
      const yyyy = today.getFullYear();
      const mm = String(today.getMonth() + 1).padStart(2, '0');
      const dd = String(today.getDate()).padStart(2, '0');
      const dateStr = `${yyyy}-${mm}-${dd}`;
      const langEntries = data?.manualEntries?.[dateStr]?.[targetLang] || {};
      const completed = ['conversation', 'youtube', 'reading'].filter(k => langEntries[k]).length;
      const pct = Math.round((completed / 3) * 100);
      return { completed, total: 3, pct: pct > 0 ? pct : 0 };
    } catch {
      return { completed: 0, total: 3, pct: 0 };
    }
  }, [targetLang]);

  return (
    <div className="flex-1 overflow-y-auto w-full relative bg-gradient-to-b from-[#faf5f0] via-[#f7f0e8] to-[#f0e6dc] text-[var(--text-primary)] dark:from-[#180905] dark:via-[#210d07] dark:to-[#140603] dark:text-stone-100 flex flex-col justify-between px-3.5 sm:px-6 py-4 sm:py-6 home-gradient-bg min-h-0">
      {/* Background ambient lighting effects */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-rose-500/10 dark:bg-rose-600/15 rounded-full blur-3xl pointer-events-none -z-10" />
      <div className="absolute bottom-10 right-1/4 w-96 h-96 bg-amber-400/10 dark:bg-amber-500/15 rounded-full blur-3xl pointer-events-none -z-10" />

      {/* Main Content Area */}
      <div className="max-w-2xl mx-auto w-full flex-1 flex flex-col justify-evenly sm:justify-center py-2 pb-24 sm:py-0 sm:pb-8">

        {/* 1. DYNAMIC GREETING */}
        <div className="w-full flex flex-col items-center justify-center text-center mx-auto mb-2 sm:mb-7 animate-fade-in pt-1">
          <h1
            className="w-full flex items-center justify-center text-center text-5xl sm:text-7xl font-black tracking-tight leading-tight transition-all drop-shadow-[0_0_35px_rgba(244,63,94,0.35)]"
            dir={greeting.rtl ? 'rtl' : 'ltr'}
          >
            <span className="inline-block text-center bg-gradient-to-r from-rose-500 via-pink-500 to-amber-400 dark:from-rose-400 dark:via-pink-400 dark:to-amber-300 bg-clip-text text-transparent">
              {greeting.text}
            </span>
          </h1>

          {greeting.translit && (
            <p className="text-sm sm:text-base font-medium text-rose-500/90 dark:text-rose-300/90 mt-1 font-mono tracking-wide text-center">
              {greeting.translit}
            </p>
          )}

          <p className="text-xs sm:text-sm text-[var(--text-secondary)] dark:text-rose-100/70 mt-1.5 font-medium">
            {isSpanish ? 'Selecciona una actividad para continuar practicando' : 'Choose an activity to keep practicing'}
          </p>
        </div>

        {/* 2. FEATURED HERO CARD (Conversations & Voice) */}
        <div
          onClick={() => onSelectMode('chat')}
          className="group relative w-full p-4 sm:p-5 rounded-3xl bg-[var(--surface-primary)] hover:bg-[var(--surface-secondary)] border border-[var(--border-primary)] hover:border-rose-500/50 transition-all duration-300 shadow-lg hover:shadow-2xl dark:bg-[#200d08]/90 dark:hover:bg-[#29110b] dark:border-[#421b12] dark:shadow-xl dark:shadow-black/40 dark:hover:shadow-2xl dark:hover:shadow-rose-950/50 cursor-pointer overflow-hidden transform active:scale-[0.98] sm:hover:-translate-y-0.5 mb-2 sm:mb-5 backdrop-blur-xl"
        >
          <div className="flex items-center justify-between gap-3 sm:gap-4">
            {/* Left: Icon */}
            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl sm:rounded-3xl bg-gradient-to-br from-rose-500 via-pink-500 to-amber-400 flex items-center justify-center text-white shadow-lg shadow-rose-950/40 shrink-0 group-hover:scale-105 transition-transform duration-300">
              <MessageSquare className="w-7 h-7 sm:w-8 sm:h-8" />
            </div>

            {/* Middle: Title & Subtitle */}
            <div className="flex-1 min-w-0 pr-2">
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-[var(--text-primary)] dark:text-white group-hover:text-rose-500 dark:group-hover:text-rose-300 transition-colors truncate">
                  Conversations & Voice
                </h2>
                <span className="hidden sm:inline-flex text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-600 dark:text-rose-300 border border-rose-500/30">
                  AI
                </span>
              </div>
              <p className="text-xs sm:text-sm text-[var(--text-secondary)] dark:text-rose-200/70 mt-0.5 leading-snug line-clamp-1 sm:line-clamp-2">
                {isSpanish
                  ? 'Practica conversación e interacción oral con correcciones.'
                  : 'Interactive AI conversation with real-time feedback.'}
              </p>
            </div>

            {/* Right: Continue Action Pill */}
            <div className="shrink-0">
              <button
                type="button"
                className="px-3.5 py-1.5 sm:px-4 sm:py-2 rounded-full bg-gradient-to-r from-rose-500 to-amber-500 hover:from-rose-600 hover:to-amber-600 text-white text-xs sm:text-sm font-semibold shadow-md shadow-rose-950/30 flex items-center space-x-1 group-hover:shadow-rose-500/30 transition-all pointer-events-none"
              >
                <span>{isSpanish ? 'Continuar' : 'Continue'}</span>
                <ChevronRight className="w-3.5 h-3.5 sm:w-4 sm:h-4 group-hover:translate-x-0.5 transition-transform" />
              </button>
            </div>
          </div>
        </div>

        {/* 3. 2x2 GRID OF 4 CARDS */}
        <div className="grid grid-cols-2 gap-x-3.5 gap-y-4 sm:gap-4 w-full">

          {/* CARD 1: YOUTUBE READER */}
          <div
            onClick={() => onSelectMode('youtube')}
            className="group relative p-4 sm:p-5 rounded-2xl sm:rounded-3xl bg-[var(--surface-primary)] hover:bg-[var(--surface-secondary)] border border-[var(--border-primary)] hover:border-amber-500/50 transition-all duration-300 shadow-md hover:shadow-xl dark:bg-[#200d08]/90 dark:hover:bg-[#29110b] dark:border-[#421b12] dark:shadow-xl dark:shadow-black/30 dark:hover:shadow-amber-950/40 cursor-pointer overflow-hidden transform active:scale-95 sm:active:scale-[0.98] sm:hover:-translate-y-0.5 flex flex-col justify-between min-h-[140px] sm:min-h-[155px] backdrop-blur-xl"
          >
            <div className="flex items-start justify-between">
              <div className="w-12 h-12 sm:w-13 sm:h-13 rounded-2xl bg-gradient-to-br from-red-600 via-rose-600 to-amber-500 flex items-center justify-center text-white shadow-md shadow-red-950/40 shrink-0 group-hover:scale-105 transition-transform">
                <Youtube className="w-6 h-6 sm:w-6 sm:h-6" />
              </div>
              <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-300 border border-amber-500/25">
                {isSpanish ? 'Vídeos' : 'Videos'}
              </span>
            </div>
            <div className="mt-3">
              <h3 className="text-sm sm:text-base font-bold text-[var(--text-primary)] dark:text-white group-hover:text-amber-500 dark:group-hover:text-amber-200 transition-colors leading-tight">
                YouTube Reader
              </h3>
              <p className="text-[11px] sm:text-xs text-[var(--text-secondary)] dark:text-rose-200/70 mt-1 line-clamp-1">
                {isSpanish ? 'Biblioteca de vídeos' : 'Video library & audio'}
              </p>
            </div>
          </div>

          {/* CARD 2: TEXT READER */}
          <div
            onClick={() => onSelectMode('text')}
            className="group relative p-4 sm:p-5 rounded-2xl sm:rounded-3xl bg-[var(--surface-primary)] hover:bg-[var(--surface-secondary)] border border-[var(--border-primary)] hover:border-pink-500/50 transition-all duration-300 shadow-md hover:shadow-xl dark:bg-[#200d08]/90 dark:hover:bg-[#29110b] dark:border-[#421b12] dark:shadow-xl dark:shadow-black/30 dark:hover:shadow-pink-950/40 cursor-pointer overflow-hidden transform active:scale-95 sm:active:scale-[0.98] sm:hover:-translate-y-0.5 flex flex-col justify-between min-h-[140px] sm:min-h-[155px] backdrop-blur-xl"
          >
            <div className="flex items-start justify-between">
              <div className="w-12 h-12 sm:w-13 sm:h-13 rounded-2xl bg-gradient-to-br from-pink-600 via-rose-500 to-amber-500 flex items-center justify-center text-white shadow-md shadow-pink-950/40 shrink-0 group-hover:scale-105 transition-transform">
                <FileText className="w-6 h-6 sm:w-6 sm:h-6" />
              </div>
              <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-pink-500/15 text-pink-600 dark:text-pink-300 border border-pink-500/25">
                EPUB / TXT
              </span>
            </div>
            <div className="mt-3">
              <h3 className="text-sm sm:text-base font-bold text-[var(--text-primary)] dark:text-white group-hover:text-pink-500 dark:group-hover:text-pink-200 transition-colors leading-tight">
                Text Reader
              </h3>
              <p className="text-[11px] sm:text-xs text-[var(--text-secondary)] dark:text-rose-200/70 mt-1 line-clamp-1">
                {isSpanish ? 'Libros y textos con TTS' : 'Books & TTS audio'}
              </p>
            </div>
          </div>

          {/* CARD 3: IMAGE READER */}
          <div
            onClick={() => onSelectMode('image')}
            className="group relative p-4 sm:p-5 rounded-2xl sm:rounded-3xl bg-[var(--surface-primary)] hover:bg-[var(--surface-secondary)] border border-[var(--border-primary)] hover:border-pink-500/50 transition-all duration-300 shadow-md hover:shadow-xl dark:bg-[#200d08]/90 dark:hover:bg-[#29110b] dark:border-[#421b12] dark:shadow-xl dark:shadow-black/30 dark:hover:shadow-pink-950/40 cursor-pointer overflow-hidden transform active:scale-95 sm:active:scale-[0.98] sm:hover:-translate-y-0.5 flex flex-col justify-between min-h-[140px] sm:min-h-[155px] backdrop-blur-xl"
          >
            <div className="flex items-start justify-between">
              <div className="w-12 h-12 sm:w-13 sm:h-13 rounded-2xl bg-gradient-to-br from-pink-600 via-rose-500 to-pink-400 flex items-center justify-center text-white shadow-md shadow-pink-950/40 shrink-0 group-hover:scale-105 transition-transform">
                <Camera className="w-6 h-6 sm:w-6 sm:h-6" />
              </div>
              <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-pink-500/15 text-pink-600 dark:text-pink-300 border border-pink-500/25">
                Vision IA
              </span>
            </div>
            <div className="mt-3">
              <h3 className="text-sm sm:text-base font-bold text-[var(--text-primary)] dark:text-white group-hover:text-pink-500 dark:group-hover:text-pink-200 transition-colors leading-tight">
                Image Reader
              </h3>
              <p className="text-[11px] sm:text-xs text-[var(--text-secondary)] dark:text-rose-200/70 mt-1 line-clamp-1">
                {isSpanish ? 'Fotos pedagógicas con audio' : 'Pedagogical photo reading'}
              </p>
            </div>
          </div>

          {/* CARD 4: DAILY PROGRESS */}
          <div
            onClick={() => onSelectMode('habits')}
            className="group relative p-4 sm:p-5 rounded-2xl sm:rounded-3xl bg-[var(--surface-primary)] hover:bg-[var(--surface-secondary)] border border-[var(--border-primary)] hover:border-amber-500/50 transition-all duration-300 shadow-md hover:shadow-xl dark:bg-[#200d08]/90 dark:hover:bg-[#29110b] dark:border-[#421b12] dark:shadow-xl dark:shadow-black/30 dark:hover:shadow-amber-950/40 cursor-pointer overflow-hidden transform active:scale-95 sm:active:scale-[0.98] sm:hover:-translate-y-0.5 flex flex-col justify-between min-h-[140px] sm:min-h-[155px] backdrop-blur-xl"
          >
            <div className="flex items-start justify-between">
              {/* Circular Progress Ring */}
              <div className="relative w-12 h-12 sm:w-13 sm:h-13 flex items-center justify-center shrink-0">
                <svg className="w-full h-full -rotate-90 transform" viewBox="0 0 36 36">
                  <path
                    className="text-stone-300/40 dark:text-[#38160e]"
                    strokeWidth="3.5"
                    stroke="currentColor"
                    fill="none"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                  <path
                    className="text-amber-500 drop-shadow-[0_0_8px_rgba(245,158,11,0.5)] transition-all duration-700 ease-out"
                    strokeDasharray={`${habitStats.pct > 0 ? habitStats.pct : 15}, 100`}
                    strokeWidth="3.5"
                    strokeLinecap="round"
                    stroke="currentColor"
                    fill="none"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <Flame className="w-4 h-4 sm:w-5 sm:h-5 text-amber-500 fill-amber-500/80 animate-pulse" />
                </div>
              </div>
              <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-300 border border-amber-500/25">
                {habitStats.pct > 0 ? `${habitStats.pct}%` : (isSpanish ? 'Racha' : 'Streak')}
              </span>
            </div>
            <div className="mt-3">
              <h3 className="text-sm sm:text-base font-bold text-[var(--text-primary)] dark:text-white group-hover:text-amber-500 dark:group-hover:text-amber-200 transition-colors leading-tight">
                {isSpanish ? 'Progreso Diario' : 'Daily Progress'}
              </h3>
              <p className="text-[11px] sm:text-xs text-[var(--text-secondary)] dark:text-rose-200/70 mt-1 line-clamp-1">
                {habitStats.completed > 0
                  ? (isSpanish ? `${habitStats.completed}/3 completados hoy` : `${habitStats.completed}/3 completed today`)
                  : (isSpanish ? 'Tus hábitos de práctica' : 'Track your study habits')}
              </p>
            </div>
          </div>

        </div>

      </div>

    </div>
  );
}
