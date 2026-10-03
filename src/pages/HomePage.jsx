import React, { useEffect, useMemo, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { HomeActivityIcon } from '../components/home/HomeActivityIcon.jsx';
import './HomePage.css';
import { useSiteLanguage } from '../context/SiteLanguageContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { getStudyGreeting } from '../constants/greetings.js';
import {
  HABIT_TRACKER_UPDATED_EVENT,
  getHabitStorageKey,
  loadHabitTrackerData
} from '../services/habitTrackerService.js';

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
  const { user } = useAuth();
  const [habitDataVersion, setHabitDataVersion] = useState(0);
  const greeting = getStudyGreeting(targetLang);

  useEffect(() => {
    const storageKey = getHabitStorageKey(user);
    const refreshHabitProgress = (event) => {
      if (!event?.detail || event.detail.storageKey === storageKey) {
        setHabitDataVersion((version) => version + 1);
      }
    };
    const refreshFromOtherTab = (event) => {
      if (event.key === storageKey) setHabitDataVersion((version) => version + 1);
    };

    window.addEventListener(HABIT_TRACKER_UPDATED_EVENT, refreshHabitProgress);
    window.addEventListener('storage', refreshFromOtherTab);
    return () => {
      window.removeEventListener(HABIT_TRACKER_UPDATED_EVENT, refreshHabitProgress);
      window.removeEventListener('storage', refreshFromOtherTab);
    };
  }, [user]);

  // Compute daily habit progress from the active user's tracker data.
  const habitStats = useMemo(() => {
    try {
      const data = loadHabitTrackerData(user);
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
  }, [targetLang, user, habitDataVersion]);

  return (
    <div className="flex-1 overflow-y-auto w-full relative bg-gradient-to-b from-[#faf5f0] via-[#f7f0e8] to-[#f0e6dc] text-[var(--text-primary)] dark:from-[#230f08] dark:via-[#2b140c] dark:to-[#1f0b06] dark:text-stone-100 flex flex-col justify-between px-3.5 sm:px-6 py-4 sm:py-6 home-gradient-bg min-h-0">
      {/* Background ambient lighting effects */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-rose-500/10 dark:bg-rose-600/15 rounded-full blur-3xl pointer-events-none -z-10" />
      <div className="absolute bottom-10 right-1/4 w-96 h-96 bg-amber-400/10 dark:bg-amber-500/15 rounded-full blur-3xl pointer-events-none -z-10" />

      {/* Main Content Area */}
      <div className="max-w-2xl mx-auto w-full flex-1 flex flex-col justify-center py-2 pb-24 sm:py-0">

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

        <button type="button" onClick={() => onSelectMode('chat')} className="home-activity-card home-conversation-card group">
          <HomeActivityIcon kind="chat" className="home-chat-illustration" />
          <span className="home-conversation-copy">
            <span className="home-activity-title">{t('home_activity_chat_title')}</span>
            <span className="home-activity-description">{t('home_activity_chat_description')}</span>
          </span>
          <span className="home-continue-pill">{t('home_activity_continue')}<ArrowRight aria-hidden="true" /></span>
        </button>

        <div className="home-activities-grid">
          {[
            { mode: 'youtube', title: 'YouTube Reader', description: 'home_activity_youtube_description', badge: 'home_activity_videos' },
            { mode: 'text', title: 'Text Reader', description: 'home_activity_text_description', badgeText: 'EPUB / TXT' },
            { mode: 'image', title: 'Image Reader', description: 'home_activity_image_description', badge: 'home_activity_vision' },
            { mode: 'habits', title: t('home_activity_progress_title'), description: 'home_activity_progress_description', badge: 'home_activity_streak' }
          ].map(activity => (
            <button key={activity.mode} type="button" onClick={() => onSelectMode(activity.mode)} className={`home-activity-card home-grid-card home-card-${activity.mode} group`}>
              <span className="home-activity-badge">
                {activity.mode === 'habits' ? `${habitStats.completed} / ${habitStats.total}` : (activity.badgeText || t(activity.badge))}
              </span>
              <HomeActivityIcon kind={activity.mode} progress={activity.mode === 'habits' ? habitStats.pct : 0} className="home-activity-illustration" />
              <span className="home-activity-copy">
                <span className="home-activity-title">{activity.title}</span>
                <span className="home-activity-description">
                  {activity.mode === 'habits' && habitStats.completed > 0
                    ? t(habitStats.completed === 1 ? 'home_activity_completed_one' : 'home_activity_completed_many').replace('{count}', habitStats.completed)
                    : t(activity.description)}
                </span>
              </span>
            </button>
          ))}
        </div>

      </div>

    </div>
  );
}
