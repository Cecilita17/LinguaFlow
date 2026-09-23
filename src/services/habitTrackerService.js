/**
 * src/services/habitTrackerService.js
 * 
 * Persistent Habit Tracker Data Service for LinguaFlow
 * 
 * Manages manual habit entries (Conversation, YouTube, Reading),
 * tracked language preferences, and calendar calculations.
 */

export const HABIT_TRACKER_STORAGE_PREFIX = 'linguaflow_habit_tracker_';
export const HABIT_TRACKER_VERSION = 1;

export const HABIT_ACTIVITIES = [
  {
    id: 'conversation',
    key: 'conversation',
    icon: 'MessageSquare',
    colorKey: 'blue',
    colorClasses: {
      activeBg: 'bg-blue-500/20 text-blue-600 dark:bg-blue-600/30 dark:text-blue-300 border-blue-500/60 dark:border-blue-400/70',
      activeText: 'text-blue-600 dark:text-blue-300',
      activeDot: 'bg-blue-500',
      badge: 'bg-blue-500/15 text-blue-600 dark:text-blue-300 border border-blue-500/30'
    }
  },
  {
    id: 'youtube',
    key: 'youtube',
    icon: 'Youtube',
    colorKey: 'rose',
    colorClasses: {
      activeBg: 'bg-rose-500/20 text-rose-600 dark:bg-rose-600/30 dark:text-rose-300 border-rose-500/60 dark:border-rose-400/70',
      activeText: 'text-rose-600 dark:text-rose-300',
      activeDot: 'bg-rose-500',
      badge: 'bg-rose-500/15 text-rose-600 dark:text-rose-300 border border-rose-500/30'
    }
  },
  {
    id: 'reading',
    key: 'reading',
    icon: 'FileText',
    colorKey: 'emerald',
    colorClasses: {
      activeBg: 'bg-emerald-500/20 text-emerald-600 dark:bg-emerald-600/30 dark:text-emerald-300 border-emerald-500/60 dark:border-emerald-400/70',
      activeText: 'text-emerald-600 dark:text-emerald-300',
      activeDot: 'bg-emerald-500',
      badge: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 border border-emerald-500/30'
    }
  }
];

export function getHabitStorageKey(user = null) {
  const userIdentifier = user?.id || user?.email || 'local_guest';
  const safeId = String(userIdentifier).replace(/[^a-zA-Z0-9_-]/g, '_');
  return `${HABIT_TRACKER_STORAGE_PREFIX}${safeId}`;
}

export function getDefaultHabitTrackerData(initialLangs = []) {
  const fallbackLangs = ['es', 'en', 'zh', 'ar', 'de', 'fr', 'nl', 'it', 'ru', 'pl', 'tr'];
  const tracked = initialLangs.length > 0
    ? initialLangs.map(l => (typeof l === 'string' ? l : l.code))
    : fallbackLangs.slice(0, 4);

  return {
    version: HABIT_TRACKER_VERSION,
    settings: {
      trackedLanguages: tracked
    },
    manualEntries: {},
    autoDetectedEntries: {},
    updatedAt: new Date().toISOString()
  };
}

export function loadHabitTrackerData(user = null, fallbackLangs = []) {
  if (typeof window === 'undefined' || !window.localStorage) {
    return getDefaultHabitTrackerData(fallbackLangs);
  }

  try {
    const key = getHabitStorageKey(user);
    const raw = localStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        return {
          version: parsed.version || HABIT_TRACKER_VERSION,
          settings: {
            trackedLanguages: Array.isArray(parsed.settings?.trackedLanguages)
              ? parsed.settings.trackedLanguages
              : ['es', 'en', 'zh', 'ar']
          },
          manualEntries: (parsed.manualEntries && typeof parsed.manualEntries === 'object')
            ? parsed.manualEntries
            : {},
          autoDetectedEntries: (parsed.autoDetectedEntries && typeof parsed.autoDetectedEntries === 'object')
            ? parsed.autoDetectedEntries
            : {},
          updatedAt: parsed.updatedAt || new Date().toISOString()
        };
      }
    }
  } catch (e) {
    console.warn('[HabitTrackerService] Error loading data:', e);
  }

  const defaultData = getDefaultHabitTrackerData(fallbackLangs);
  saveHabitTrackerData(defaultData, user);
  return defaultData;
}

export function saveHabitTrackerData(data, user = null) {
  if (typeof window === 'undefined' || !window.localStorage || !data) {
    return false;
  }

  try {
    const key = getHabitStorageKey(user);
    const payload = {
      ...data,
      updatedAt: new Date().toISOString()
    };
    localStorage.setItem(key, JSON.stringify(payload));
    return true;
  } catch (e) {
    console.warn('[HabitTrackerService] Error saving data:', e);
    return false;
  }
}

export function toggleTrackedLanguage(currentData, langCode, isEnabled, user = null) {
  if (!currentData || !langCode) return currentData;

  const currentList = Array.isArray(currentData.settings?.trackedLanguages)
    ? [...currentData.settings.trackedLanguages]
    : [];

  let nextList;
  if (isEnabled) {
    if (!currentList.includes(langCode)) {
      nextList = [...currentList, langCode];
    } else {
      nextList = currentList;
    }
  } else {
    nextList = currentList.filter(code => code !== langCode);
  }

  const updatedData = {
    ...currentData,
    settings: {
      ...currentData.settings,
      trackedLanguages: nextList
    }
  };

  saveHabitTrackerData(updatedData, user);
  return updatedData;
}

export function toggleHabitEntry(currentData, dateStr, langCode, activityKey, user = null) {
  if (!currentData || !dateStr || !langCode || !activityKey) return currentData;

  const manualEntries = { ...(currentData.manualEntries || {}) };
  const dateObj = { ...(manualEntries[dateStr] || {}) };
  const langObj = { ...(dateObj[langCode] || {}) };

  const currentStatus = Boolean(langObj[activityKey]);
  const newStatus = !currentStatus;

  langObj[activityKey] = newStatus;
  dateObj[langCode] = langObj;
  manualEntries[dateStr] = dateObj;

  const updatedData = {
    ...currentData,
    manualEntries
  };

  saveHabitTrackerData(updatedData, user);
  return updatedData;
}

export function isHabitCompleted(data, dateStr, langCode, activityKey) {
  if (!data?.manualEntries?.[dateStr]?.[langCode]) return false;
  return Boolean(data.manualEntries[dateStr][langCode][activityKey]);
}

export function getDaysInMonth(year, month) {
  const days = [];
  const daysCount = new Date(year, month + 1, 0).getDate();
  const today = new Date();
  const todayYear = today.getFullYear();
  const todayMonth = today.getMonth();
  const todayDate = today.getDate();

  const dayNamesEs = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];
  const dayNamesEn = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

  for (let d = 1; d <= daysCount; d++) {
    const currentDate = new Date(year, month, d);
    const dayOfWeek = currentDate.getDay();
    const formattedMonth = String(month + 1).padStart(2, '0');
    const formattedDay = String(d).padStart(2, '0');
    const dateStr = `${year}-${formattedMonth}-${formattedDay}`;

    const isToday = (year === todayYear && month === todayMonth && d === todayDate);
    const isWeekend = (dayOfWeek === 0 || dayOfWeek === 6);

    days.push({
      dayNumber: d,
      dateStr,
      dayOfWeek,
      dayNameEs: dayNamesEs[dayOfWeek],
      dayNameEn: dayNamesEn[dayOfWeek],
      isToday,
      isWeekend
    });
  }

  return days;
}

export function gatherAllHabitTrackerData() {
  const result = {};
  if (typeof window === 'undefined' || !window.localStorage) return result;

  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(HABIT_TRACKER_STORAGE_PREFIX)) {
        try {
          const raw = localStorage.getItem(key);
          if (raw) {
            result[key] = JSON.parse(raw);
          }
        } catch (e) {}
      }
    }
  } catch (e) {}

  return result;
}

export function getLocalDateString(d = new Date()) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function recordAutomaticHabitActivity(currentData, dateStr, langCode, activityKey, user = null) {
  if (!langCode || !activityKey) return currentData;

  const data = currentData || loadHabitTrackerData(user);
  const effectiveDateStr = dateStr || getLocalDateString();

  const currentTracked = Array.isArray(data.settings?.trackedLanguages)
    ? [...data.settings.trackedLanguages]
    : [];

  let nextTracked = currentTracked;
  if (!currentTracked.includes(langCode)) {
    nextTracked = [...currentTracked, langCode];
  }

  const manualEntries = { ...(data.manualEntries || {}) };
  const dateObj = { ...(manualEntries[effectiveDateStr] || {}) };
  const langObj = { ...(dateObj[langCode] || {}) };

  if (langObj[activityKey] === true && currentTracked.includes(langCode)) {
    return data;
  }

  langObj[activityKey] = true;
  dateObj[langCode] = langObj;
  manualEntries[effectiveDateStr] = dateObj;

  const updatedData = {
    ...data,
    settings: {
      ...(data.settings || {}),
      trackedLanguages: nextTracked
    },
    manualEntries
  };

  saveHabitTrackerData(updatedData, user);
  return updatedData;
}

export function recordHabitActivityForToday({ user = null, langCode, activityKey }) {
  if (!langCode || !activityKey) return null;
  const currentData = loadHabitTrackerData(user);
  const todayStr = getLocalDateString();
  return recordAutomaticHabitActivity(currentData, todayStr, langCode, activityKey, user);
}