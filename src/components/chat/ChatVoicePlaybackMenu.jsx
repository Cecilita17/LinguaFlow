import React from 'react';
import { Gauge, Volume2 } from 'lucide-react';
import { useSiteLanguage } from '../../context/SiteLanguageContext.jsx';
import { useAudioSettings, SPEECH_RATE_OPTIONS } from '../../context/AudioSettingsContext.jsx';

export function ChatVoicePlaybackMenu({ onClose }) {
  const { isSpanish, t } = useSiteLanguage();
  const { speechRate, setSpeechRate, autoPlayAi, setAutoPlayAi } = useAudioSettings();

  return (
    <div
      className="absolute right-0 top-full mt-2 w-72 rounded-2xl border border-[var(--border-primary)] bg-[var(--surface-primary)] p-3 shadow-xl shadow-black/20 z-40 animate-fade-in"
      role="dialog"
      aria-label={isSpanish ? 'Voz y reproducción' : 'Voice and playback'}
    >
      <div className="flex items-center justify-between pb-2.5 mb-3 border-b border-[var(--border-primary)]">
        <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-rose-600 dark:text-rose-300">
          <Volume2 className="w-4 h-4 text-rose-500" />
          {isSpanish ? 'Voz y reproducción' : 'Voice & Playback'}
        </span>
        <button
          type="button"
          onClick={onClose}
          className="text-[11px] font-semibold text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
        >
          {isSpanish ? 'Listo' : 'Done'}
        </button>
      </div>

      <div className="flex items-center justify-between gap-3 rounded-xl bg-[var(--surface-secondary)] border border-[var(--border-primary)] p-2.5">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-[var(--text-primary)]">{t('auto_play_ai_title')}</p>
          <p className="mt-0.5 text-[11px] leading-snug text-[var(--text-muted)]">{t('auto_play_ai_desc')}</p>
        </div>
        <button
          type="button"
          onClick={() => setAutoPlayAi(!autoPlayAi)}
          aria-pressed={autoPlayAi}
          aria-label={t('auto_play_ai_title')}
          className={`w-11 h-6 rounded-full transition-all flex items-center px-0.5 shrink-0 cursor-pointer ${
            autoPlayAi
              ? 'bg-gradient-to-r from-rose-500 to-pink-500 justify-end pr-1.5'
              : 'bg-[var(--surface-tertiary)] border border-[var(--border-primary)] justify-start pl-0.5'
          }`}
        >
          {autoPlayAi ? (
            <span className="text-[10px] font-bold text-white tracking-wide">ON</span>
          ) : (
            <span className="w-5 h-5 rounded-full bg-white shadow-xs" />
          )}
        </button>
      </div>

      <label className="block mt-3">
        <span className="mb-1.5 flex items-center justify-between text-xs font-semibold text-[var(--text-primary)]">
          <span className="flex items-center gap-1.5">
            <Gauge className="w-3.5 h-3.5 text-rose-500" />
            {t('speech_playback_speed')}
          </span>
          <span className="font-mono text-rose-600 dark:text-rose-400">{Number(speechRate).toFixed(2)}×</span>
        </span>
        <select
          value={speechRate}
          onChange={(event) => setSpeechRate(parseFloat(event.target.value) || 1.0)}
          className="w-full rounded-xl border border-[var(--border-primary)] bg-[var(--surface-tertiary)] px-3 py-2 text-xs font-bold font-mono text-[var(--text-primary)] outline-none focus:ring-1 focus:ring-rose-500 cursor-pointer"
          aria-label={t('speech_playback_speed')}
        >
          {SPEECH_RATE_OPTIONS.map((rate) => (
            <option key={rate} value={rate}>
              {rate.toFixed(2)}×
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
