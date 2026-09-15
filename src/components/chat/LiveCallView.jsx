import React, { useState } from 'react';
import {
  ArrowLeft,
  Mic,
  MicOff,
  PhoneOff,
  Sparkles,
  Volume2,
  FileText,
  ShieldCheck,
  Languages
} from 'lucide-react';
import { useSiteLanguage } from '../../context/SiteLanguageContext.jsx';
import { getLanguageMeta } from '../../constants/languages.js';

export function LiveCallView({
  targetLang,
  onEndCall
}) {
  const { t, isSpanish } = useSiteLanguage();
  const currentTargetMeta = getLanguageMeta(targetLang);

  const [isMuted, setIsMuted] = useState(false);
  const [showLiveTranscript, setShowLiveTranscript] = useState(true);

  // Placeholder real-time transcript entries demonstrating clean visual integration
  const [sampleTranscript] = useState([
    {
      id: 't-1',
      sender: 'bot',
      speaker: 'LinguaFlow AI',
      text: isSpanish
        ? '¡Hola! Estoy listo para conversar contigo en este momento. ¿De qué te gustaría hablar hoy?'
        : 'Hello! I am ready to practice conversation with you right now. What would you like to talk about?'
    },
    {
      id: 't-2',
      sender: 'user',
      speaker: isSpanish ? 'Tú' : 'You',
      text: isSpanish
        ? 'Me gustaría practicar cómo pedir comida en un restaurante.'
        : 'I would like to practice ordering food at a restaurant.'
    },
    {
      id: 't-3',
      sender: 'bot',
      speaker: 'LinguaFlow AI',
      text: isSpanish
        ? '¡Excelente elección! Imagina que acabas de entrar al restaurante. ¿Qué me dirías al acercarte a la mesa?'
        : 'Great choice! Imagine you just entered the restaurant. What would you say to the waiter?'
    }
  ]);

  return (
    <div className="flex-1 overflow-y-auto w-full max-w-3xl mx-auto px-4 sm:px-6 py-4 sm:py-6 text-[var(--text-primary)] flex flex-col justify-between min-h-[580px] animate-fade-in">
      {/* 1. TOP BAR */}
      <div className="flex items-center justify-between pb-4 border-b border-[var(--border-primary)]">
        <button
          type="button"
          onClick={onEndCall}
          className="px-3.5 py-2 rounded-xl bg-[var(--surface-secondary)] hover:bg-[var(--surface-hover)] border border-[var(--border-primary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer flex items-center gap-2 text-xs sm:text-sm font-semibold shadow-xs active:scale-95"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>{t('back_to_hub')}</span>
        </button>

        <div className="flex items-center space-x-2">
          <div className="w-7 h-7 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white shadow-sm">
            <Mic className="w-4 h-4" />
          </div>
          <h2 className="text-sm sm:text-base font-bold text-[var(--text-primary)] tracking-wide flex items-center gap-1.5">
            <span>{t('call_active_title')}</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
              {currentTargetMeta.flag} {currentTargetMeta.name}
            </span>
          </h2>
        </div>

        {/* Live Transcription Toggle Button */}
        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={() => setShowLiveTranscript(!showLiveTranscript)}
            className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs ${
              showLiveTranscript
                ? 'bg-rose-500/15 border-rose-500 text-rose-600 dark:text-rose-300'
                : 'bg-[var(--surface-secondary)] border-[var(--border-primary)] text-[var(--text-muted)] hover:text-[var(--text-primary)]'
            }`}
            title="Activar o desactivar transcripción en vivo"
          >
            <FileText className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{t('call_transcription_toggle')}</span>
            <span className="text-[10px] px-1 py-0.2 rounded bg-black/10 dark:bg-white/10">
              {showLiveTranscript ? t('call_transcription_on') : t('call_transcription_off')}
            </span>
          </button>
        </div>
      </div>

      {/* 2. CENTRAL CALL AREA */}
      <div className="my-auto py-8 flex flex-col items-center justify-center text-center space-y-6">
        {/* Animated AI Voice Avatar */}
        <div className="relative">
          <div className="w-28 h-28 sm:w-36 sm:h-36 rounded-full bg-gradient-to-tr from-emerald-600 via-teal-500 to-rose-500 p-1 shadow-2xl shadow-emerald-950/50 flex items-center justify-center">
            <div className="w-full h-full rounded-full bg-[var(--surface-primary)] border-4 border-emerald-500/40 flex items-center justify-center relative overflow-hidden">
              {/* Subtle ambient voice ripples */}
              <div className="absolute inset-0 bg-emerald-500/10 rounded-full animate-ping opacity-25" />
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-gradient-to-tr from-rose-500 to-pink-500 flex items-center justify-center text-white shadow-lg">
                <Sparkles className="w-8 h-8 sm:w-10 sm:h-10 animate-pulse" />
              </div>
            </div>
          </div>

          {/* Online badge */}
          <div className="absolute bottom-1 right-2 w-7 h-7 rounded-full bg-emerald-500 border-2 border-[var(--app-bg)] flex items-center justify-center text-white shadow-md">
            <Mic className="w-3.5 h-3.5" />
          </div>
        </div>

        {/* Status indicator text */}
        <div className="space-y-1">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-xs font-bold tracking-wide">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>{t('call_status_ready')}</span>
          </div>

          <h3 className="text-base sm:text-lg font-bold text-[var(--text-primary)]">
            {currentTargetMeta.name} · {isSpanish ? 'Llamada de voz en tiempo real' : 'Real-time voice call'}
          </h3>
          <p className="text-xs text-[var(--text-muted)] max-w-sm mx-auto">
            {isSpanish
              ? 'Interfaz lista para conectar voz en tiempo real. La llamada fluirá de forma continua sin presionar botones.'
              : 'Interface ready for real-time voice streaming. The call will flow seamlessly.'}
          </p>
        </div>

        {/* Collapsible Live Transcription Area */}
        {showLiveTranscript && (
          <div className="w-full max-w-xl rounded-3xl bg-[var(--surface-primary)] border border-[var(--border-primary)] p-4 sm:p-5 shadow-lg text-left space-y-3 animate-fade-in max-h-52 overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[var(--border-primary)]/70 pb-2">
              <span className="text-[11px] font-bold text-rose-600 dark:text-rose-400 uppercase tracking-wider flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5" />
                <span>{isSpanish ? 'Transcripción en vivo' : 'Live Transcript'}</span>
              </span>
              <span className="text-[10px] text-[var(--text-muted)] font-mono">
                Real-time
              </span>
            </div>

            <div className="space-y-2.5">
              {sampleTranscript.map((item) => (
                <div
                  key={item.id}
                  className={`p-2.5 rounded-xl text-xs leading-relaxed ${
                    item.sender === 'user'
                      ? 'bg-rose-500/10 border border-rose-500/20 text-[var(--text-primary)] ml-6'
                      : 'bg-[var(--surface-secondary)] border border-[var(--border-primary)] text-[var(--text-primary)] mr-6'
                  }`}
                >
                  <span className="font-bold text-[10px] text-rose-600 dark:text-rose-400 block mb-0.5">
                    {item.speaker}:
                  </span>
                  <p>{item.text}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 3. BOTTOM CALL CONTROLS */}
      <div className="pt-4 border-t border-[var(--border-primary)] flex items-center justify-center gap-4">
        {/* Mute/Unmute Toggle button */}
        <button
          type="button"
          onClick={() => setIsMuted(!isMuted)}
          className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all cursor-pointer shadow-md active:scale-95 border ${
            isMuted
              ? 'bg-amber-500/20 border-amber-500 text-amber-600 dark:text-amber-400'
              : 'bg-[var(--surface-secondary)] hover:bg-[var(--surface-hover)] border-[var(--border-primary)] text-[var(--text-primary)]'
          }`}
          title={isMuted ? t('call_mic_unmute') : t('call_mic_mute')}
        >
          {isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
        </button>

        {/* End Call Button */}
        <button
          type="button"
          onClick={onEndCall}
          className="px-6 py-3.5 rounded-2xl bg-red-600 hover:bg-red-700 text-white font-bold text-sm flex items-center gap-2.5 shadow-lg shadow-red-950/40 transition-all cursor-pointer active:scale-95"
        >
          <PhoneOff className="w-5 h-5" />
          <span>{t('call_end_action')}</span>
        </button>
      </div>
    </div>
  );
}

export default LiveCallView;
