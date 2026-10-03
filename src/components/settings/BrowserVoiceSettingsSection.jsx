import React, { useEffect, useRef, useState } from 'react';
import { Volume2, Square, Info } from 'lucide-react';
import { useAudioSettings, mapSpeechRateToUtteranceRate } from '../../context/AudioSettingsContext.jsx';
import { useSiteLanguage } from '../../context/SiteLanguageContext.jsx';
import { LANGUAGE_METADATA, getLocalizedLanguageName } from '../../constants/languages.js';
import { browserVoiceId, matchingBrowserVoices, speechLanguageKey, BROWSER_VOICE_SAMPLES } from '../../utils/browserSpeechVoices.js';

export function BrowserVoiceSettingsSection({ targetLang = 'es' }) {
  const { t, isSpanish } = useSiteLanguage();
  const { browserVoices, browserVoicePreferences, setBrowserVoicePreference, getBrowserVoice, speechRate } = useAudioSettings();
  const [language, setLanguage] = useState(speechLanguageKey(targetLang));
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [previewError, setPreviewError] = useState(false);
  const previewRef = useRef(null);
  const supported = typeof window !== 'undefined' && Boolean(window.speechSynthesis) && typeof SpeechSynthesisUtterance !== 'undefined';
  const voices = matchingBrowserVoices(browserVoices, language);
  const selectedId = browserVoicePreferences[language] || '';
  const missingVoice = Boolean(selectedId && !voices.some(voice => browserVoiceId(voice) === selectedId));
  useEffect(() => setLanguage(speechLanguageKey(targetLang)), [targetLang]);

  useEffect(() => {
    setPreviewError(false);
    setIsPreviewing(false);
    return () => {
      if (previewRef.current) {
        previewRef.current = null;
        window.speechSynthesis?.cancel();
      }
    };
  }, [language, selectedId]);

  const preview = () => {
    if (!supported) return;
    if (isPreviewing) {
      previewRef.current = null;
      window.speechSynthesis.cancel();
      setIsPreviewing(false);
      return;
    }
    const voice = getBrowserVoice(language);
    if (!voice) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(BROWSER_VOICE_SAMPLES[language]);
    utterance.lang = voice.lang;
    utterance.voice = voice;
    utterance.rate = mapSpeechRateToUtteranceRate(speechRate);
    previewRef.current = utterance;
    setPreviewError(false);
    setIsPreviewing(true);
    utterance.onend = () => {
      if (previewRef.current !== utterance) return;
      previewRef.current = null;
      setIsPreviewing(false);
    };
    utterance.onerror = () => {
      if (previewRef.current !== utterance) return;
      previewRef.current = null;
      setIsPreviewing(false);
      setPreviewError(true);
    };
    try { window.speechSynthesis.speak(utterance); }
    catch { utterance.onerror(); }
  };

  const selectClass = 'w-full bg-[var(--input-bg)] border border-[var(--input-border)] rounded-xl px-3 py-2 text-xs sm:text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-rose-500 cursor-pointer disabled:opacity-50';
  return (
    <section className="p-4 sm:p-5 rounded-3xl bg-[var(--surface-primary)] border border-[var(--border-primary)] shadow-sm">
      <h2 className="text-xs sm:text-sm font-bold text-rose-600 dark:text-rose-300 uppercase tracking-wider mb-3 flex items-center gap-2"><Volume2 className="w-4 h-4 text-rose-500" aria-hidden="true" />{t('browser_voice_title')}</h2>
      <p className="text-sm text-[var(--text-secondary)] mb-4">{t('browser_voice_description')}</p>
      <div className="grid sm:grid-cols-2 gap-3">
        <label className="block text-xs font-semibold text-[var(--text-primary)]"><span className="block mb-1.5">{t('browser_voice_language')}</span>
          <select value={language} onChange={event => setLanguage(event.target.value)} className={selectClass}>
            {Object.keys(BROWSER_VOICE_SAMPLES).map(code => <option key={code} value={code}>{getLocalizedLanguageName(code, LANGUAGE_METADATA[code]?.name, isSpanish)}</option>)}
          </select>
        </label>
        <label className="block text-xs font-semibold text-[var(--text-primary)]"><span className="block mb-1.5">{t('browser_voice_selection')}</span>
          <select value={selectedId} disabled={!supported} onChange={event => setBrowserVoicePreference(language, event.target.value)} className={selectClass}>
            <option value="">{t('browser_voice_automatic')}</option>
            {missingVoice && <option value={selectedId} disabled>{t('browser_voice_unavailable')}</option>}
            {voices.map(voice => <option key={browserVoiceId(voice)} value={browserVoiceId(voice)}>{voice.name} · {voice.lang}</option>)}
          </select>
        </label>
      </div>
      <div className="flex flex-wrap items-center gap-3 mt-4">
        <button type="button" disabled={!supported || !voices.length} onClick={preview} className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-300 border border-rose-500/25 hover:bg-rose-500/20 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 text-xs sm:text-sm font-semibold">
          {isPreviewing ? <Square className="w-4 h-4" aria-hidden="true" /> : <Volume2 className="w-4 h-4" aria-hidden="true" />}
          {t(isPreviewing ? 'browser_voice_stop' : 'browser_voice_preview')}
        </button>
        <p className="text-xs text-[var(--text-muted)]" role="status">{!supported ? t('browser_voice_unsupported') : !voices.length ? t('browser_voice_empty') : missingVoice ? t('browser_voice_fallback') : t('browser_voice_saved')}</p>
      </div>
      {previewError && <p role="alert" className="mt-3 text-xs text-rose-600 dark:text-rose-300">{t('browser_voice_preview_error')}</p>}
      <p className="flex items-start gap-2 mt-4 text-xs leading-relaxed text-[var(--text-muted)]"><Info className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />{t('browser_voice_device_note')}</p>
    </section>
  );
}
