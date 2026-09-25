import React, { useState, useMemo, useEffect, useRef } from 'react';
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

function MonthlyHabitCard({
  lang,
  targetLang,
  isSpanish,
  monthName,
  currentYear,
  currentMonth,
  daysInCurrentMonth,
  trackerData,
  handleToggleCell,
  getActivityIcon,
  getActivityLabel
}) {
  const scrollContainerRef = useRef(null);
  const todayRef = useRef(null);

  useEffect(() => {
    if (scrollContainerRef.current && todayRef.current) {
      const container = scrollContainerRef.current;
      const todayElem = todayRef.current;
      const containerWidth = container.clientWidth;
      const todayWidth = todayElem.clientWidth;
      const containerRect = container.getBoundingClientRect();
      const todayRect = todayElem.getBoundingClientRect();
      const todayLeft = todayRect.left - containerRect.left + container.scrollLeft;

      const scrollPos = todayLeft - (containerWidth / 2) + (todayWidth / 2);
      container.scrollTo({
        left: Math.max(0, scrollPos),
        behavior: 'smooth'
      });
    } else if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollLeft = 0;
    }
  }, [currentYear, currentMonth]);

  const isCurrentContext = lang.code === targetLang;

  const langCompletedCount = useMemo(() => {
    let count = 0;
    daysInCurrentMonth.forEach(day => {
      HABIT_ACTIVITIES.forEach(act => {
        if (isHabitCompleted(trackerData, day.dateStr, lang.code, act.key)) {
          count++;
        }
      });
    });
    return count;
  }, [daysInCurrentMonth, trackerData, lang.code]);

  return (
    <div className="p-4 sm:p-6 rounded-3xl bg-[var(--surface-primary)] border border-[var(--border-primary)] shadow-md dark:bg-[#2d160e]/95 dark:border-[#562a1d] dark:shadow-xl transition-all">
      {/* Header of Language Card */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-3">
          <span className="text-2xl sm:text-3xl">{lang.flag || '🌐'}</span>
          <div>
            <div className="flex items-center space-x-2">
              <h3 className="text-base sm:text-lg font-bold text-[var(--text-primary)] dark:text-white">
                {lang.name}
              </h3>
              {isCurrentContext && (
                <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-600 dark:text-amber-300 border border-amber-500/30">
                  {isSpanish ? 'Idioma actual' : 'Current language'}
                </span>
              )}
            </div>
            <p className="text-xs text-[var(--text-secondary)] dark:text-rose-200/70">
              {monthName} {currentYear}
            </p>
          </div>
        </div>

        <div className="px-3 py-1.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-300 text-xs font-bold">
          {langCompletedCount} {isSpanish ? 'completados' : 'completed'}
        </div>
      </div>

      {/* Grid Container */}
      <div className="flex w-full items-stretch border rounded-2xl border-[var(--border-primary)] dark:border-[#4a2216] bg-[var(--surface-secondary)]/30 dark:bg-[#24120b]/40 overflow-hidden shadow-inner">
        {/* Left Fixed Column: Day / Activity labels */}
        <div className="w-32 sm:w-36 shrink-0 border-r border-[var(--border-primary)] dark:border-[#4a2216] bg-[var(--surface-primary)] dark:bg-[#2d160e] flex flex-col z-10 shadow-xs">
          {/* Header Row */}
          <div className="h-10 px-3 flex items-center border-b border-[var(--border-primary)] dark:border-[#4a2216] text-[10px] sm:text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">
            {isSpanish ? 'DÍA / ACTIVIDAD' : 'DAY / ACTIVITY'}
          </div>

          {/* Activity Rows */}
          {HABIT_ACTIVITIES.map((act) => (
            <div
              key={act.key}
              className="h-9 px-3 flex items-center gap-2 border-b last:border-b-0 border-[var(--border-primary)]/50 dark:border-[#4a2216]/50 text-xs font-semibold truncate text-[var(--text-primary)] dark:text-rose-100"
            >
              {getActivityIcon(act.key)}
              <span className="truncate">{getActivityLabel(act.key)}</span>
            </div>
          ))}
        </div>

        {/* Right Scrollable Column: Days */}
        <div
          ref={scrollContainerRef}
          className="flex-1 overflow-x-auto select-none scrollbar-thin scrollbar-thumb-rose-500/30 dark:scrollbar-thumb-rose-500/20"
        >
          <div className="min-w-max flex flex-col">
            {/* Header Row: Days */}
            <div className="flex h-10 border-b border-[var(--border-primary)] dark:border-[#3b170e]">
              {daysInCurrentMonth.map((day) => {
                const dayName = isSpanish ? day.dayNameEs : day.dayNameEn;
                return (
                  <div
                    key={day.dayNumber}
                    ref={day.isToday ? todayRef : null}
                    className={`w-8 sm:w-9 shrink-0 flex flex-col items-center justify-center text-center font-bold border-r border-[var(--border-primary)]/30 dark:border-[#3b170e]/30 ${
                      day.isToday
                        ? 'bg-rose-500 text-white dark:bg-rose-600 shadow-sm'
                        : day.isWeekend
                        ? 'bg-rose-500/5 text-rose-600 dark:bg-rose-950/20 dark:text-rose-300'
                        : 'text-[var(--text-primary)] dark:text-rose-100'
                    }`}
                  >
                    <span className="text-[9px] uppercase leading-none opacity-80">{dayName}</span>
                    <span className="text-xs leading-tight font-extrabold">{day.dayNumber}</span>
                  </div>
                );
              })}
            </div>

            {/* Activity Rows: Cells */}
            {HABIT_ACTIVITIES.map((act) => (
              <div
                key={act.key}
                className="flex h-9 border-b last:border-b-0 border-[var(--border-primary)]/50 dark:border-[#3b170e]/50"
              >
                {daysInCurrentMonth.map((day) => {
                  const completed = isHabitCompleted(trackerData, day.dateStr, lang.code, act.key);
                  return (
                    <div
                      key={day.dayNumber}
                      onClick={() => handleToggleCell(day.dateStr, lang.code, act.key)}
                      className={`w-8 sm:w-9 shrink-0 flex items-center justify-center border-r border-[var(--border-primary)]/30 dark:border-[#3b170e]/30 cursor-pointer transition-colors ${
                        completed
                          ? act.colorClasses?.activeBg || 'bg-rose-500/20 text-rose-600'
                          : day.isToday
                          ? 'bg-rose-500/10 hover:bg-rose-500/20'
                          : 'hover:bg-stone-500/10 dark:hover:bg-white/5'
                      }`}
                      title={`${day.dateStr} - ${getActivityLabel(act.key)}`}
                    >
                      {completed && (
                        <div className={`w-2.5 h-2.5 rounded-full ${act.colorClasses?.activeDot || 'bg-rose-500'} shadow-xs`} />
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

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
    <div className="flex-1 overflow-y-auto w-full relative bg-gradient-to-b from-[#faf5f0] via-[#f7f0e8] to-[#f0e6dc] text-[var(--text-primary)] dark:from-[#230f08] dark:via-[#2b140c] dark:to-[#1f0b06] dark:text-stone-100 flex flex-col justify-start px-3 sm:px-6 py-4 sm:py-8 pb-28 sm:pb-32 home-gradient-bg">
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-rose-500/5 dark:bg-rose-600/10 rounded-full blur-3xl pointer-events-none -z-10" />
      <div className="absolute bottom-10 right-1/4 w-96 h-96 bg-amber-400/5 dark:bg-amber-500/10 rounded-full blur-3xl pointer-events-none -z-10" />

      <div className="max-w-6xl mx-auto w-full flex-1 flex flex-col">
        {/* Top Navigation */}
        <div className="flex items-center justify-between pb-4 mb-4 border-b border-black/5 dark:border-white/10">
          <button
            type="button"
            onClick={onBack}
            className="px-3.5 py-1.5 rounded-xl bg-black/5 hover:bg-black/10 dark:bg-white/10 dark:hover:bg-white/15 border border-black/5 dark:border-white/10 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all cursor-pointer flex items-center gap-2 text-xs font-semibold active:scale-95"
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
            <div className="flex items-center space-x-2 self-start sm:self-auto bg-white/70 dark:bg-[#2d160e]/80 backdrop-blur-md border border-black/5 dark:border-white/10 p-1.5 rounded-2xl shadow-sm">
              <button
                type="button"
                onClick={handlePrevMonth}
                className="p-1.5 rounded-xl hover:bg-black/5 dark:hover:bg-white/10 text-[var(--text-primary)] transition-colors cursor-pointer active:scale-95"
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
                className="p-1.5 rounded-xl hover:bg-black/5 dark:hover:bg-white/10 text-[var(--text-primary)] transition-colors cursor-pointer active:scale-95"
                title={isSpanish ? 'Mes siguiente' : 'Next month'}
              >
                <ChevronRight className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={handleGoToCurrentMonth}
                className="px-2.5 py-1 text-[11px] font-bold rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-600 dark:text-rose-300 border border-rose-500/30 transition-colors ml-1 cursor-pointer active:scale-95"
              >
                {isSpanish ? 'Hoy' : 'Today'}
              </button>
            </div>
          </div>
        </div>

        {/* 2. CONFIGURACIÓN DE IDIOMAS SECTION */}
        <div className="mb-6 p-5 sm:p-6 rounded-3xl bg-white/70 dark:bg-[#2d160e]/85 backdrop-blur-xl border border-black/5 dark:border-white/10 shadow-sm transition-all">
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
              className="text-xs font-semibold px-3 py-1.5 rounded-xl bg-[var(--surface-secondary)] hover:bg-[var(--surface-hover)] dark:bg-[#361c12] text-[var(--text-secondary)] dark:text-rose-300 border border-[var(--border-primary)] dark:border-[#5d2f21] transition-all cursor-pointer"
            >
              {isConfigOpen
                ? (isSpanish ? 'Ocultar ajustes ▲' : 'Collapse ▲')
                : (isSpanish ? 'Editar idiomas ▼' : 'Edit languages ▼')}
            </button>
          </div>

          {isConfigOpen && (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2.5 sm:gap-3 mt-4 pt-4 border-t border-[var(--border-primary)]/60 dark:border-[#4a2216]">
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
                        : 'bg-[var(--surface-secondary)]/50 border-[var(--border-primary)] text-[var(--text-secondary)] opacity-65 hover:opacity-100 dark:bg-[#24120b]/60 dark:border-[#4a2216]'
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
          <div className="p-10 rounded-3xl bg-[var(--surface-primary)] border border-dashed border-[var(--border-primary)] text-center text-[var(--text-secondary)] dark:bg-[#2d160e]/60 dark:border-[#562a1d]">
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
            {trackedLanguages.map((lang) => (
              <MonthlyHabitCard
                key={lang.code}
                lang={lang}
                targetLang={targetLang}
                isSpanish={isSpanish}
                monthName={monthName}
                currentYear={currentYear}
                currentMonth={currentMonth}
                daysInCurrentMonth={daysInCurrentMonth}
                trackerData={trackerData}
                handleToggleCell={handleToggleCell}
                getActivityIcon={getActivityIcon}
                getActivityLabel={getActivityLabel}
              />
            ))}
          </div>
        )}

      </div>
    </div>
  );
}