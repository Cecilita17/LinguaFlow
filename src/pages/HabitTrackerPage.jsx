import React, { useState, useMemo, useEffect } from 'react';
import {
  ArrowLeft,
  CalendarCheck,
  ChevronLeft,
  ChevronRight,
  MessageSquare,
  Youtube,
  FileText,
  Check,
  Calendar
} from 'lucide-react';
import { useSiteLanguage } from '../context/SiteLanguageContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import {
  LANGUAGE_METADATA,
  getLanguageMeta
} from '../constants/languages.js';
import {
  HABIT_ACTIVITIES,
  loadHabitTrackerData,
  toggleTrackedLanguage,
  toggleHabitEntry,
  isHabitCompleted,
  getDaysInMonth
} from '../services/habitTrackerService.js';

const MONTH_NAMES_ES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

const MONTH_NAMES_EN = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export function HabitTrackerPage({
  onBack,
  targetLang,
  languages = []
}) {
  const { isSpanish } = useSiteLanguage();
  const { user } = useAuth();

  const now = new Date();
  const [currentYear, setCurrentYear] = useState(now.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(now.getMonth());
  const [isConfigOpen, setIsConfigOpen] = useState(true);

  const [trackerData, setTrackerData] = useState(() => {
    return loadHabitTrackerData(user, languages);
  });

  useEffect(() => {
    setTrackerData(loadHabitTrackerData(user, languages));
  }, [user]);

  const allLanguages = useMemo(() => {
    const metaList = Object.values(LANGUAGE_METADATA);
    if (Array.isArray(languages) && languages.length > 0) {
      const mergedMap = new Map();
      languages.forEach(l => {
        if (l && l.code) {
          const meta = getLanguageMeta(l.code);
          mergedMap.set(l.code, { ...meta, ...l });
        }
      });
      metaList.forEach(m => {
        if (!mergedMap.has(m.code)) {
          mergedMap.set(m.code, m);
        }
      });
      return Array.from(mergedMap.values());
    }
    return metaList;
  }, [languages]);

  const trackedLanguageCodes = trackerData.settings?.trackedLanguages || [];

  const trackedLanguages = useMemo(() => {
    return allLanguages.filter(lang => trackedLanguageCodes.includes(lang.code));
  }, [allLanguages, trackedLanguageCodes]);

  const daysInCurrentMonth = useMemo(() => {
    return getDaysInMonth(currentYear, currentMonth);
  }, [currentYear, currentMonth]);

  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear(prev => prev - 1);
    } else {
      setCurrentMonth(prev => prev - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear(prev => prev + 1);
    } else {
      setCurrentMonth(prev => prev + 1);
    }
  };

  const handleGoToCurrentMonth = () => {
    const today = new Date();
    setCurrentYear(today.getFullYear());
    setCurrentMonth(today.getMonth());
  };

  const handleToggleLanguage = (langCode) => {
    const isCurrentlyTracked = trackedLanguageCodes.includes(langCode);
    const updated = toggleTrackedLanguage(trackerData, langCode, !isCurrentlyTracked, user);
    setTrackerData(updated);
  };

  const handleToggleCell = (dateStr, langCode, activityKey) => {
    const updated = toggleHabitEntry(trackerData, dateStr, langCode, activityKey, user);
    setTrackerData(updated);
  };

  const monthName = isSpanish
    ? MONTH_NAMES_ES[currentMonth]
    : MONTH_NAMES_EN[currentMonth];

  const monthlyStats = useMemo(() => {
    let completedCount = 0;
    daysInCurrentMonth.forEach(day => {
      trackedLanguages.forEach(lang => {
        HABIT_ACTIVITIES.forEach(act => {
          if (isHabitCompleted(trackerData, day.dateStr, lang.code, act.key)) {
            completedCount++;
          }
        });
      });
    });
    return { completedCount };
  }, [daysInCurrentMonth, trackedLanguages, trackerData]);

  const getActivityLabel = (actId) => {
    if (actId === 'conversation') {
      return isSpanish ? 'Conversación' : 'Conversation';
    }
    if (actId === 'youtube') {
      return 'YouTube';
    }
    if (actId === 'reading') {
      return isSpanish ? 'Lectura' : 'Reading';
    }
    return actId;
  };

  const getActivityIcon = (actId) => {
    if (actId === 'conversation') return <MessageSquare className="w-4 h-4 text-blue-500" />;
    if (actId === 'youtube') return <Youtube className="w-4 h-4 text-rose-500" />;
    if (actId === 'reading') return <FileText className="w-4 h-4 text-emerald-500" />;
    return <Check className="w-4 h-4" />;
  };

  return (
    <div className="flex-1 overflow-y-auto w-full relative bg-gradient-to-b from-[#faf5f0] via-[#f7f0e8] to-[#f0e6dc] text-[var(--text-primary)] dark:from-[#180905] dark:via-[#210d07] dark:to-[#140603] dark:text-stone-100 flex flex-col justify-start px-3 sm:px-6 py-4 sm:py-8 home-gradient-bg">
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-rose-500/5 dark:bg-rose-600/10 rounded-full blur-3xl pointer-events-none -z-10" />
      <div className="absolute bottom-10 right-1/4 w-96 h-96 bg-amber-400/5 dark:bg-amber-500/10 rounded-full blur-3xl pointer-events-none -z-10" />

      <div className="max-w-6xl mx-auto w-full flex-1 flex flex-col">
        {/* Top Navigation */}
        <div className="flex items-center justify-between pb-4 mb-4 border-b border-[var(--border-primary)]/70">
          <button
            type="button"
            onClick={onBack}
            className="px-3.5 py-1.5 rounded-xl bg-[var(--surface-secondary)] hover:bg-[var(--surface-hover)] border border-[var(--border-primary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all cursor-pointer flex items-center gap-2 text-xs font-semibold shadow-xs active:scale-95"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>{isSpanish ? 'Volver a Inicio' : 'Back to Home'}</span>
          </button>

          <div className="flex items-center space-x-2 text-xs font-bold text-[var(--text-secondary)]">
            <span className="text-sm">📅</span>
            <span>Habit Tracker</span>
          </div>
        </div>

        {/* 1. HEADER HERO */}
        <div className="mb-6 animate-fade-in">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-500 via-rose-500 to-pink-500 flex items-center justify-center text-white shadow-md shadow-rose-950/30 shrink-0">
                <CalendarCheck className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-[var(--text-primary)] dark:text-white">
                  Habit Tracker
                </h1>
                <p className="text-xs sm:text-sm text-[var(--text-secondary)] dark:text-rose-100/70 font-medium">
                  {isSpanish
                    ? 'Lleva un registro de los idiomas que practicas cada día.'
                    : 'Keep track of the languages you practice every day.'}
                </p>
              </div>
            </div>

            {/* Quick Month Selector */}
            <div className="flex items-center space-x-2 self-start sm:self-auto bg-[var(--surface-primary)] dark:bg-[#241009]/95 border border-[var(--border-primary)] dark:border-[#4a2216] p-1.5 rounded-2xl shadow-sm">
              <button
                type="button"
                onClick={handlePrevMonth}
                className="p-1.5 rounded-xl hover:bg-[var(--surface-secondary)] dark:hover:bg-[#2e150d] text-[var(--text-primary)] transition-colors cursor-pointer"
                title={isSpanish ? 'Mes anterior' : 'Previous month'}
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <div className="px-3 py-1 text-xs sm:text-sm font-bold text-center min-w-[130px]">
                <span>{monthName} {currentYear}</span>
              </div>

              <button
                type="button"
                onClick={handleNextMonth}
                className="p-1.5 rounded-xl hover:bg-[var(--surface-secondary)] dark:hover:bg-[#2e150d] text-[var(--text-primary)] transition-colors cursor-pointer"
                title={isSpanish ? 'Mes siguiente' : 'Next month'}
              >
                <ChevronRight className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={handleGoToCurrentMonth}
                className="px-2.5 py-1 text-[11px] font-bold rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-600 dark:text-rose-300 border border-rose-500/30 transition-colors ml-1 cursor-pointer"
              >
                {isSpanish ? 'Hoy' : 'Today'}
              </button>
            </div>
          </div>
        </div>

        {/* 2. CONFIGURACIÓN DE IDIOMAS SECTION */}
        <div className="mb-6 p-5 sm:p-6 rounded-3xl bg-[var(--surface-primary)] border border-[var(--border-primary)] shadow-md dark:bg-[#241009]/95 dark:border-[#4a2216] dark:shadow-xl transition-all">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h2 className="text-base sm:text-lg font-bold text-[var(--text-primary)] dark:text-white">
                {isSpanish
                  ? 'Configura los idiomas que quieres trackear'
                  : 'Configure the languages you want to track'}
              </h2>
              <p className="text-xs text-[var(--text-secondary)] dark:text-rose-200/70">
                {isSpanish
                  ? 'Puedes activar o desactivar los idiomas en cualquier momento.'
                  : 'You can enable or disable languages at any time.'}
              </p>
            </div>

            <button
              type="button"
              onClick={() => setIsConfigOpen(prev => !prev)}
              className="text-xs font-semibold px-3 py-1.5 rounded-xl bg-[var(--surface-secondary)] hover:bg-[var(--surface-hover)] dark:bg-[#2e150d] text-[var(--text-secondary)] dark:text-rose-300 border border-[var(--border-primary)] dark:border-[#52271a] transition-all cursor-pointer"
            >
              {isConfigOpen
                ? (isSpanish ? 'Ocultar ajustes ▲' : 'Collapse ▲')
                : (isSpanish ? 'Editar idiomas ▼' : 'Edit languages ▼')}
            </button>
          </div>

          {isConfigOpen && (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2.5 sm:gap-3 mt-4 pt-4 border-t border-[var(--border-primary)]/60 dark:border-[#3b170e]">
              {allLanguages.map((lang) => {
                const isTracked = trackedLanguageCodes.includes(lang.code);
                const isCurrentContext = lang.code === targetLang;

                return (
                  <div
                    key={lang.code}
                    onClick={() => handleToggleLanguage(lang.code)}
                    className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-2 select-none ${
                      isTracked
                        ? 'bg-rose-500/10 border-rose-500/60 text-rose-900 dark:bg-rose-950/40 dark:border-rose-500/60 dark:text-rose-100 shadow-xs'
                        : 'bg-[var(--surface-secondary)]/50 border-[var(--border-primary)] text-[var(--text-secondary)] opacity-65 hover:opacity-100 dark:bg-[#1a0b06]/60 dark:border-[#3b170e]'
                    }`}
                  >
                    <div className="flex items-center space-x-2.5 min-w-0">
                      <span className="text-xl shrink-0">{lang.flag || '🌐'}</span>
                      <div className="min-w-0">
                        <p className="text-xs font-bold truncate text-[var(--text-primary)] dark:text-white">
                          {lang.name}
                        </p>
                        {isCurrentContext && (
                          <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-600 dark:text-amber-300 border border-amber-500/30">
                            {isSpanish ? 'Activo' : 'Current'}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className={`w-9 h-5 rounded-full p-0.5 transition-colors shrink-0 ${
                      isTracked ? 'bg-rose-500' : 'bg-stone-300 dark:bg-stone-700'
                    }`}>
                      <div className={`w-4 h-4 rounded-full bg-white transition-transform shadow-xs ${
                        isTracked ? 'translate-x-4' : 'translate-x-0'
                      }`} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* 3. TRACKER HEADER LEGEND & SUMMARY */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4 px-1">
          <div className="flex items-center space-x-3 text-xs font-semibold">
            <span className="text-[var(--text-secondary)] font-bold">
              {isSpanish ? 'Actividades:' : 'Activities:'}
            </span>
            <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded-xl bg-blue-500/10 border border-blue-500/30 text-blue-600 dark:text-blue-300">
              <MessageSquare className="w-3.5 h-3.5" />
              <span>{isSpanish ? 'Conversación' : 'Conversation'}</span>
            </div>
            <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-300">
              <Youtube className="w-3.5 h-3.5" />
              <span>YouTube</span>
            </div>
            <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-300">
              <FileText className="w-3.5 h-3.5" />
              <span>{isSpanish ? 'Lectura' : 'Reading'}</span>
            </div>
          </div>

          <div className="text-xs font-medium text-[var(--text-secondary)] dark:text-rose-200/70">
            <span>{isSpanish ? 'Total completado este mes:' : 'Total completed this month:'}</span>{' '}
            <strong className="text-rose-600 dark:text-rose-300 font-bold">{monthlyStats.completedCount}</strong>
          </div>
        </div>

        {/* 4. TRACKED LANGUAGES HABIT CARDS */}
        {trackedLanguages.length === 0 ? (
          <div className="p-10 rounded-3xl bg-[var(--surface-primary)] border border-dashed border-[var(--border-primary)] text-center text-[var(--text-secondary)] dark:bg-[#241009]/60 dark:border-[#4a2216]">
            <Calendar className="w-10 h-10 mx-auto mb-3 text-rose-400 opacity-60" />
            <p className="text-base font-bold text-[var(--text-primary)] dark:text-white">
              {isSpanish ? 'No hay idiomas seleccionados para trackear' : 'No languages selected to track'}
            </p>
            <p className="text-xs mt-1 text-[var(--text-secondary)] dark:text-rose-200/70">
              {isSpanish
                ? 'Activa al menos un idioma en la sección superior para comenzar a registrar tus hábitos.'
                : 'Enable at least one language above to start recording your study habits.'}
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {trackedLanguages.map((lang) => {
              const isCurrentStudy = lang.code === targetLang;

              return (
                <div
                  key={lang.code}
                  className="rounded-3xl bg-[var(--surface-primary)] border border-[var(--border-primary)] shadow-md dark:bg-[#241009]/95 dark:border-[#4a2216] dark:shadow-xl overflow-hidden transition-all"
                >
                  {/* Language Card Top Header */}
                  <div className="px-5 py-4 bg-[var(--surface-secondary)]/40 dark:bg-[#1f0d07] border-b border-[var(--border-primary)]/60 dark:border-[#3b170e] flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <span className="text-2xl">{lang.flag || '🌐'}</span>
                      <div>
                        <div className="flex items-center space-x-2">
                          <h3 className="text-base font-bold text-[var(--text-primary)] dark:text-white">
                            {lang.name}
                          </h3>
                          {lang.nativeName && lang.nativeName !== lang.name && (
                            <span className="text-xs text-[var(--text-secondary)] dark:text-rose-200/60 font-medium">
                              ({lang.nativeName})
                            </span>
                          )}
                          {isCurrentStudy && (
                            <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-300 border border-amber-500/30">
                              {isSpanish ? 'En curso' : 'Active'}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="text-xs text-[var(--text-secondary)] dark:text-rose-200/70 font-medium">
                      <span>{monthName} {currentYear}</span>
                    </div>
                  </div>

                  {/* Calendar Matrix Scroll Container */}
                  <div className="p-4 sm:p-5 overflow-x-auto">
                    <div className="min-w-[760px]">
                      {/* Days Header Row */}
                      <div className="grid grid-cols-[140px_repeat(31,minmax(28px,1fr))] gap-1 items-center pb-2 mb-2 border-b border-[var(--border-primary)]/40 dark:border-[#3b170e]">
                        <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-secondary)] dark:text-rose-200/60 px-2">
                          {isSpanish ? 'Día / Actividad' : 'Day / Activity'}
                        </div>
                        {daysInCurrentMonth.map((day) => (
                          <div
                            key={day.dateStr}
                            className={`flex flex-col items-center justify-center py-1 rounded-lg text-center select-none ${
                              day.isToday
                                ? 'bg-rose-500/20 text-rose-600 dark:bg-rose-500/30 dark:text-rose-200 font-black border border-rose-500/50'
                                : day.isWeekend
                                ? 'text-[var(--text-secondary)] dark:text-rose-200/50 opacity-80'
                                : 'text-[var(--text-primary)] dark:text-stone-300'
                            }`}
                          >
                            <span className="text-[10px] font-semibold leading-none">
                              {isSpanish ? day.dayNameEs : day.dayNameEn}
                            </span>
                            <span className="text-xs font-bold leading-tight mt-0.5">
                              {day.dayNumber}
                            </span>
                          </div>
                        ))}
                      </div>

                      {/* 3 Activity Rows */}
                      <div className="space-y-2">
                        {HABIT_ACTIVITIES.map((act) => {
                          return (
                            <div
                              key={act.id}
                              className="grid grid-cols-[140px_repeat(31,minmax(28px,1fr))] gap-1 items-center py-1"
                            >
                              {/* Left Column Activity Label */}
                              <div className="flex items-center space-x-2 px-2 select-none">
                                <div className="shrink-0">{getActivityIcon(act.id)}</div>
                                <span className="text-xs font-bold truncate text-[var(--text-primary)] dark:text-stone-200">
                                  {getActivityLabel(act.id)}
                                </span>
                              </div>

                              {/* Day Checkboxes */}
                              {daysInCurrentMonth.map((day) => {
                                const completed = isHabitCompleted(trackerData, day.dateStr, lang.code, act.key);

                                return (
                                  <button
                                    key={day.dateStr}
                                    type="button"
                                    onClick={() => handleToggleCell(day.dateStr, lang.code, act.key)}
                                    title={`${day.dateStr} | ${lang.name} | ${getActivityLabel(act.id)}: ${completed ? (isSpanish ? 'Completado' : 'Completed') : (isSpanish ? 'Sin marcar' : 'Not completed')}`}
                                    className={`h-8 rounded-xl border flex items-center justify-center transition-all cursor-pointer active:scale-90 ${
                                      completed
                                        ? act.colorClasses.activeBg + ' shadow-xs'
                                        : 'bg-[var(--surface-secondary)]/30 border-[var(--border-primary)]/60 hover:border-stone-400 dark:bg-[#1a0b06]/40 dark:border-[#3b170e] dark:hover:border-[#663022]'
                                    } ${day.isToday ? 'ring-1 ring-rose-500/40' : ''}`}
                                  >
                                    {completed ? (
                                      <Check className="w-4 h-4 stroke-[3]" />
                                    ) : (
                                      <span className="w-1.5 h-1.5 rounded-full bg-stone-300 dark:bg-stone-700 opacity-40" />
                                    )}
                                  </button>
                                );
                              })}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

      </div>
    </div>
  );
}