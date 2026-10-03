import React from 'react';
import { Type } from 'lucide-react';
import { useReaderSettings } from '../../context/ReaderSettingsContext.jsx';
import { useSiteLanguage } from '../../context/SiteLanguageContext.jsx';
import { FONT_OPTIONS } from '../../utils/fontPreferences.js';

const SAMPLES = {
  general: { es: 'Cada palabra abre una puerta.', en: 'Every word opens a door.' },
  chinese: '每一个词都打开一扇门。',
  arabic: 'كل كلمة تفتح بابًا جديدًا.'
};

export function FontSettingsSection() {
  const { fontPreferences, setFontPreference } = useReaderSettings();
  const { t, isSpanish } = useSiteLanguage();
  return (
    <section className="p-4 sm:p-5 rounded-3xl bg-[var(--surface-primary)] border border-[var(--border-primary)] shadow-sm">
      <h2 className="text-xs sm:text-sm font-bold text-rose-600 dark:text-rose-300 uppercase tracking-wider mb-3 flex items-center gap-2"><Type className="w-4 h-4 text-rose-500" aria-hidden="true" />{t('font_settings_title')}</h2>
      <p className="text-sm text-[var(--text-secondary)] mb-4">{t('font_settings_description')}</p>
      <div className="grid md:grid-cols-3 gap-3">
        {Object.entries(FONT_OPTIONS).map(([script, options]) => (
          <div key={script} className="min-w-0 p-3 rounded-2xl bg-[var(--surface-secondary)] border border-[var(--border-primary)]">
            <label className="block text-xs font-semibold"><span className="block mb-2">{t(`font_script_${script}`)}</span>
              <select value={fontPreferences[script]} onChange={event => setFontPreference(script, event.target.value)} className="w-full rounded-xl px-3 py-2 text-xs sm:text-sm bg-[var(--input-bg)] text-[var(--text-primary)] border border-[var(--input-border)] focus:outline-none focus:ring-2 focus:ring-rose-500 cursor-pointer">
                {options.map(option => <option key={option.id} value={option.id}>{option.name || t(option.label)}</option>)}
              </select>
            </label>
            <p lang={script === 'arabic' ? 'ar' : script === 'chinese' ? 'zh' : isSpanish ? 'es' : 'en'} dir={script === 'arabic' ? 'rtl' : 'ltr'} className="mt-4 mb-1 text-lg leading-relaxed text-[var(--text-primary)] break-words">
              {script === 'general' ? SAMPLES.general[isSpanish ? 'es' : 'en'] : SAMPLES[script]}
            </p>
          </div>
        ))}
      </div>
      <p className="mt-3 text-xs leading-relaxed text-[var(--text-muted)]">{t('font_settings_saved')}</p>
    </section>
  );
}
