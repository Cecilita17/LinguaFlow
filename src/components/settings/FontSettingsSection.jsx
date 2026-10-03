import React, { useEffect, useRef, useState } from 'react';
import { Type, Download, Check, Loader2 } from 'lucide-react';
import { useReaderSettings } from '../../context/ReaderSettingsContext.jsx';
import { useSiteLanguage } from '../../context/SiteLanguageContext.jsx';
import { downloadFontForOffline, isFontDownloaded, offlineFontSupported, FONT_DOWNLOAD_EVENT } from '../../services/offlineFontService.js';
import { FONT_OPTIONS } from '../../utils/fontPreferences.js';

const SAMPLES = {
  general: { es: 'Cada palabra abre una puerta.', en: 'Every word opens a door.' },
  arabic: 'كل كلمة تفتح بابًا جديدًا.'
};

export function FontSettingsSection() {
  const { fontPreferences, setFontPreference } = useReaderSettings();
  const { t, isSpanish } = useSiteLanguage();
  const [downloaded, setDownloaded] = useState({});
  const [downloading, setDownloading] = useState(null);
  const [progress, setProgress] = useState(null);
  const [downloadError, setDownloadError] = useState(null);
  const downloadRef = useRef(null);
  const mountedRef = useRef(false);
  const supported = offlineFontSupported();
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; downloadRef.current?.abort(); };
  }, []);
  useEffect(() => {
    let cancelled = false;
    Promise.all(Object.values(FONT_OPTIONS).flat().map(async option => [option.family, await isFontDownloaded(option.family)]))
      .then(entries => { if (!cancelled) setDownloaded(Object.fromEntries(entries)); });
    return () => { cancelled = true; };
  }, [fontPreferences]);
  const download = async option => {
    if (downloadRef.current) return;
    const controller = new AbortController();
    downloadRef.current = controller;
    setDownloading(option.family);
    setProgress(null);
    setDownloadError(null);
    const timeout = setTimeout(() => controller.abort(), 120000);
    try {
      await downloadFontForOffline(option, { signal: controller.signal, onProgress: value => {
        if (mountedRef.current) setProgress(value);
      } });
      if (mountedRef.current) {
        setDownloaded(previous => ({ ...previous, [option.family]: true }));
        window.dispatchEvent(new Event(FONT_DOWNLOAD_EVENT));
      }
    } catch (error) {
      controller.abort();
      if (mountedRef.current) setDownloadError(error.name === 'QuotaExceededError' ? 'font_download_space_error' : 'font_download_error');
    } finally {
      clearTimeout(timeout);
      downloadRef.current = null;
      if (mountedRef.current) { setDownloading(null); setProgress(null); }
    }
  };
  return (
    <section className="p-4 sm:p-5 rounded-3xl bg-[var(--surface-primary)] border border-[var(--border-primary)] shadow-sm">
      <h2 className="text-xs sm:text-sm font-bold text-rose-600 dark:text-rose-300 uppercase tracking-wider mb-3 flex items-center gap-2"><Type className="w-4 h-4 text-rose-500" aria-hidden="true" />{t('font_settings_title')}</h2>
      <p className="text-sm text-[var(--text-secondary)] mb-4">{t('font_settings_description')}</p>
      <div className="grid md:grid-cols-3 gap-3">
        {Object.entries(FONT_OPTIONS).map(([script, options]) => {
          const selected = options.find(option => option.id === fontPreferences[script]);
          return (
          <div key={script} className="min-w-0 p-3 rounded-2xl bg-[var(--surface-secondary)] border border-[var(--border-primary)]">
            <label className="block text-xs font-semibold"><span className="block mb-2">{t(`font_script_${script}`)}</span>
              <select value={fontPreferences[script]} onChange={event => setFontPreference(script, event.target.value)} className="w-full rounded-xl px-3 py-2 text-xs sm:text-sm bg-[var(--input-bg)] text-[var(--text-primary)] border border-[var(--input-border)] focus:outline-none focus:ring-2 focus:ring-rose-500 cursor-pointer">
                {options.map(option => <option key={option.id} value={option.id}>{option.name || t(option.label)}</option>)}
              </select>
            </label>
            {selected.family !== 'system-ui' && (
              <button type="button" disabled={!supported || Boolean(downloading) || downloaded[selected.family]} onClick={() => download(selected)} className="mt-3 w-full flex items-center justify-center gap-2 px-2 py-2 rounded-xl text-xs font-semibold border border-rose-500/25 bg-rose-500/10 text-rose-600 dark:text-rose-300 hover:bg-rose-500/20 transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-default focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500">
                {downloading === selected.family ? <Loader2 className="w-4 h-4 shrink-0 animate-spin" aria-hidden="true" /> : downloaded[selected.family] ? <Check className="w-4 h-4 shrink-0" aria-hidden="true" /> : <Download className="w-4 h-4 shrink-0" aria-hidden="true" />}
                {t(downloading === selected.family ? 'font_downloading' : downloaded[selected.family] ? 'font_downloaded' : 'font_download_action')}
              </button>
            )}
            {script === 'chinese' ? (
              <div className="mt-4 space-y-2">
                {[['你好', 'Nǐ hǎo', 'font_chinese_hello'], ['中国', 'Zhōngguó', 'font_chinese_china'], ['谢谢', 'Xièxiè', 'font_chinese_thanks']].map(([word, pinyin, meaning]) => (
                  <p key={word} className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 leading-relaxed">
                    <span lang="zh" className="text-lg">{word}</span>
                    <span lang="zh-Latn" className="text-xs text-[var(--text-muted)]">{pinyin}</span>
                    <span className="text-xs text-[var(--text-secondary)]">— {t(meaning)}</span>
                  </p>
                ))}
                <p className="pt-1 text-xs leading-relaxed text-[var(--text-muted)]">{t('font_chinese_system_note')}</p>
              </div>
            ) : <p lang={script === 'arabic' ? 'ar' : script === 'chinese' ? 'zh' : isSpanish ? 'es' : 'en'} dir={script === 'arabic' ? 'rtl' : 'ltr'} className="mt-4 mb-1 text-lg leading-relaxed text-[var(--text-primary)] break-words">
              {script === 'general' ? SAMPLES.general[isSpanish ? 'es' : 'en'] : SAMPLES[script]}
            </p>}
          </div>
          );
        })}
      </div>
      {downloading && <p role="status" className="mt-3 text-xs text-[var(--text-secondary)]">{progress ? t('font_download_progress', progress) : t('font_downloading')}</p>}
      {downloadError && <p role="alert" className="mt-3 text-xs text-rose-600 dark:text-rose-300">{t(downloadError)}</p>}
      {!supported && <p className="mt-3 text-xs text-[var(--text-muted)]">{t('font_download_unsupported')}</p>}
      <p className="mt-3 text-xs leading-relaxed text-[var(--text-muted)]">{t('font_settings_saved')}</p>
    </section>
  );
}
