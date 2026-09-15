import React, { useState, useEffect, useRef } from 'react';
import {
  ArrowLeft,
  Mic,
  MicOff,
  PhoneOff,
  Sparkles,
  Volume2,
  FileText,
  ShieldCheck,
  Languages,
  AlertCircle,
  RotateCcw,
  CheckCircle2
} from 'lucide-react';
import { useSiteLanguage } from '../../context/SiteLanguageContext.jsx';
import { getLanguageMeta } from '../../constants/languages.js';
import { useRealtimeCall } from '../../hooks/useRealtimeCall.js';

export function LiveCallView({
  targetLang,
  nativeLang = 'es',
  level = 'A2/B1',
  onEndCall
}) {
  const { t, isSpanish } = useSiteLanguage();
  const currentTargetMeta = getLanguageMeta(targetLang);

  const [showLiveTranscript, setShowLiveTranscript] = useState(true);
  const transcriptContainerRef = useRef(null);

  const {
    callState,
    isMuted,
    errorMessage,
    liveTranscript,
    formattedDuration,
    startCall,
    endCall,
    toggleMute
  } = useRealtimeCall({
    targetLang,
    nativeLang,
    level,
    isSpanish
  });

  // Automatically start call on mount
  useEffect(() => {
    startCall();
  }, [startCall]);

  // Keep transcript scrolled to latest conversational turn
  useEffect(() => {
    if (transcriptContainerRef.current) {
      transcriptContainerRef.current.scrollTop = transcriptContainerRef.current.scrollHeight;
    }
  }, [liveTranscript]);

  const handleEndCallAction = () => {
    const sessionData = endCall();
    if (onEndCall) {
      onEndCall(sessionData);
    }
  };

  // Compute status badge text and visual appearance
  const getStatusDisplay = () => {
    if (isMuted) {
      return {
        label: isSpanish ? 'Micrófono silenciado' : 'Microphone muted',
        colorClass: 'bg-amber-500/15 border-amber-500/30 text-amber-700 dark:text-amber-300',
        dotClass: 'bg-amber-500'
      };
    }
    switch (callState) {
      case 'connecting':
        return {
          label: t('call_status_connecting'),
          colorClass: 'bg-amber-500/15 border-amber-500/30 text-amber-700 dark:text-amber-300',
          dotClass: 'bg-amber-500 animate-ping'
        };
      case 'listening':
        return {
          label: t('call_status_listening'),
          colorClass: 'bg-emerald-500/15 border-emerald-500/30 text-emerald-700 dark:text-emerald-300',
          dotClass: 'bg-emerald-500 animate-pulse'
        };
      case 'thinking':
        return {
          label: t('call_status_thinking'),
          colorClass: 'bg-purple-500/15 border-purple-500/30 text-purple-700 dark:text-purple-300',
          dotClass: 'bg-purple-500 animate-ping'
        };
      case 'speaking':
        return {
          label: t('call_status_speaking'),
          colorClass: 'bg-rose-500/15 border-rose-500/30 text-rose-700 dark:text-rose-300',
          dotClass: 'bg-rose-500 animate-pulse'
        };
      case 'error':
        return {
          label: isSpanish ? 'Error de conexión' : 'Connection error',
          colorClass: 'bg-red-500/15 border-red-500/30 text-red-700 dark:text-red-300',
          dotClass: 'bg-red-500'
        };
      case 'idle':
      default:
        return {
          label: t('call_status_ready'),
          colorClass: 'bg-emerald-500/15 border-emerald-500/30 text-emerald-700 dark:text-emerald-300',
          dotClass: 'bg-emerald-500 animate-pulse'
        };
    }
  };

  const statusInfo = getStatusDisplay();

  return (
    <div className="flex-1 overflow-y-auto w-full max-w-3xl mx-auto px-4 sm:px-6 py-4 sm:py-6 text-[var(--text-primary)] flex flex-col justify-between min-h-[580px] animate-fade-in">
      {/* 1. TOP BAR */}
      <div className="flex items-center justify-between pb-4 border-b border-[var(--border-primary)]">
        <button
          type="button"
          onClick={handleEndCallAction}
          className="px-3.5 py-2 rounded-xl bg-[var(--surface-secondary)] hover:bg-[var(--surface-hover)] border border-[var(--border-primary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer flex items-center gap-2 text-xs sm:text-sm font-semibold shadow-xs active:scale-95"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>{t('back_to_hub')}</span>
        </button>

        <div className="flex items-center space-x-2">
          <span className="font-mono text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20">
            {formattedDuration}
          </span>
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
      <div className="my-auto py-6 flex flex-col items-center justify-center text-center space-y-5">
        {/* Animated AI Voice Avatar */}
        <div className="relative">
          <div
            className={`w-28 h-28 sm:w-36 sm:h-36 rounded-full p-1 shadow-2xl transition-all duration-500 flex items-center justify-center ${
              callState === 'speaking'
                ? 'bg-gradient-to-tr from-rose-500 via-pink-500 to-amber-400 shadow-rose-950/60 scale-105'
                : callState === 'listening'
                ? 'bg-gradient-to-tr from-emerald-600 via-teal-500 to-rose-500 shadow-emerald-950/50'
                : callState === 'thinking'
                ? 'bg-gradient-to-tr from-purple-600 via-indigo-500 to-rose-500 shadow-purple-950/50'
                : callState === 'error'
                ? 'bg-gradient-to-tr from-red-600 to-rose-700 shadow-red-950/50'
                : 'bg-gradient-to-tr from-amber-500 to-teal-500 shadow-teal-950/40'
            }`}
          >
            <div className="w-full h-full rounded-full bg-[var(--surface-primary)] border-4 border-emerald-500/30 flex items-center justify-center relative overflow-hidden">
              {/* Voice ripple animations */}
              {(callState === 'speaking' || callState === 'listening') && (
                <div
                  className={`absolute inset-0 rounded-full animate-ping opacity-25 ${
                    callState === 'speaking' ? 'bg-rose-500' : 'bg-emerald-500'
                  }`}
                />
              )}
              <div
                className={`w-16 h-16 sm:w-20 sm:h-20 rounded-full flex items-center justify-center text-white shadow-lg transition-all duration-300 ${
                  callState === 'speaking'
                    ? 'bg-gradient-to-tr from-rose-500 to-pink-500 scale-110'
                    : callState === 'thinking'
                    ? 'bg-gradient-to-tr from-purple-600 to-indigo-500'
                    : 'bg-gradient-to-tr from-teal-500 to-emerald-600'
                }`}
              >
                <Sparkles className={`w-8 h-8 sm:w-10 sm:h-10 ${callState === 'speaking' ? 'animate-bounce' : 'animate-pulse'}`} />
              </div>
            </div>
          </div>

          {/* Online status badge */}
          <div
            className={`absolute bottom-1 right-2 w-7 h-7 rounded-full border-2 border-[var(--app-bg)] flex items-center justify-center text-white shadow-md transition-colors ${
              isMuted
                ? 'bg-amber-500'
                : callState === 'error'
                ? 'bg-red-500'
                : 'bg-emerald-500'
            }`}
          >
            {isMuted ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
          </div>
        </div>

        {/* Dynamic Status Indicator */}
        <div className="space-y-1.5">
          <div
            className={`inline-flex items-center gap-2 px-3.5 py-1 rounded-full border text-xs font-bold tracking-wide transition-all ${statusInfo.colorClass}`}
          >
            <span className={`w-2 h-2 rounded-full ${statusInfo.dotClass}`} />
            <span>{statusInfo.label}</span>
          </div>

          <h3 className="text-base sm:text-lg font-bold text-[var(--text-primary)]">
            {currentTargetMeta.name} · {isSpanish ? 'Llamada de voz en tiempo real' : 'Real-time voice call'}
          </h3>

          {callState === 'error' ? (
            <div className="max-w-md mx-auto p-3 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400 text-xs space-y-2">
              <div className="flex items-center justify-center gap-1.5 font-bold">
                <AlertCircle className="w-4 h-4" />
                <span>{errorMessage || 'Error en la conexión WebRTC'}</span>
              </div>
              <button
                type="button"
                onClick={startCall}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs transition-colors cursor-pointer shadow-sm active:scale-95"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>{isSpanish ? 'Reintentar llamada' : 'Retry call'}</span>
              </button>
            </div>
          ) : (
            <p className="text-xs text-[var(--text-muted)] max-w-md mx-auto">
              {isSpanish
                ? 'Habla con naturalidad. La IA escucha y responde continuamente. Puedes interrumpirla cuando quieras.'
                : 'Speak naturally. The AI continuously listens and responds. You can interrupt at any time.'}
            </p>
          )}
        </div>

        {/* Collapsible Live Transcription Area */}
        {showLiveTranscript && (
          <div
            ref={transcriptContainerRef}
            className="w-full max-w-xl rounded-3xl bg-[var(--surface-primary)] border border-[var(--border-primary)] p-4 sm:p-5 shadow-xl text-left flex flex-col animate-fade-in max-h-72 sm:max-h-80 overflow-y-auto scroll-smooth"
          >
            {/* Transcript Header */}
            <div className="flex items-center justify-between border-b border-[var(--border-primary)]/70 pb-2 mb-3 sticky top-0 bg-[var(--surface-primary)] z-10">
              <span className="text-[11px] font-bold text-rose-600 dark:text-rose-400 uppercase tracking-wider flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5" />
                <span>{isSpanish ? 'Transcripción en vivo' : 'Live Transcript'}</span>
              </span>
              <span className="text-[10px] text-[var(--text-muted)] font-mono flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>WebRTC Realtime</span>
              </span>
            </div>

            {/* Conversation Flow (User vs LinguaFlow AI) */}
            <div className="space-y-1">
              {liveTranscript.length > 0 ? (
                liveTranscript.map((item) => {
                  const isUser = item.sender === 'user';

                  if (isUser) {
                    return (
                      <div key={item.id} className="flex flex-col items-end my-2.5 animate-fade-in group w-full">
                        {/* User Header Badge */}
                        <div className="flex items-center space-x-2 mb-1 px-1">
                          <span className="text-xs font-semibold text-[var(--text-secondary)]">
                            {item.speaker || (isSpanish ? 'Tú' : 'You')}
                          </span>
                          {item.isCorrecting ? (
                            <span className="flex items-center space-x-1.5 text-[10px] sm:text-[11px] font-semibold text-pink-200 bg-pink-950/60 px-2 sm:px-2.5 py-0.5 rounded-full border border-pink-700/60 shadow-xs animate-pulse">
                              <Sparkles className="w-3 h-3 text-pink-300" />
                              <span>{isSpanish ? 'Analizando...' : 'Analyzing...'}</span>
                            </span>
                          ) : item.hasCorrection ? (
                            <span className="flex items-center space-x-1.5 text-[10px] sm:text-[11px] font-semibold text-amber-200 bg-amber-950/80 px-2 sm:px-2.5 py-0.5 rounded-full border border-amber-700/80 shadow-xs">
                              <CheckCircle2 className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-amber-300" />
                              <span>{isSpanish ? 'Corregido automáticamente' : 'Auto-corrected'}</span>
                            </span>
                          ) : (
                            <span className="flex items-center space-x-1.5 text-[10px] sm:text-[11px] font-semibold text-emerald-200 bg-emerald-950/80 px-2 sm:px-2.5 py-0.5 rounded-full border border-emerald-700/80 shadow-xs">
                              <CheckCircle2 className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-emerald-400" />
                              <span>{isSpanish ? 'Sin errores' : 'No errors'}</span>
                            </span>
                          )}
                          {item.timestamp && (
                            <span className="text-[10px] text-[var(--text-muted)] font-mono">
                              {item.timestamp}
                            </span>
                          )}
                        </div>

                        {/* User Speech Bubble */}
                        <div
                          dir={targetLang === 'ar' || /[\u0600-\u06FF]/.test(item.text || '') ? 'rtl' : 'ltr'}
                          className="max-w-[88%] sm:max-w-[78%] bg-gradient-to-r from-rose-600 via-rose-500 to-pink-600 text-white rounded-2xl rounded-tr-xs px-3.5 sm:px-4 py-2.5 shadow-md shadow-black/20 border border-rose-400/30 text-left"
                        >
                          <div className="text-[13px] sm:text-sm leading-relaxed tracking-wide font-normal select-text">
                            {!item.text ? (
                              <span className="italic opacity-85 text-xs flex items-center gap-1.5 py-0.5 animate-pulse">
                                <Mic className="w-3.5 h-3.5 text-pink-200" />
                                <span>{isSpanish ? 'Transcribiendo audio...' : 'Transcribing speech...'}</span>
                              </span>
                            ) : item.diffTokens && item.diffTokens.length > 0 ? (
                              item.diffTokens.map((token, idx) => {
                                const rawWord = token.text || '';
                                const cleanWord = rawWord.trim();
                                if (!cleanWord) return null;
                                const needsSpace = targetLang !== 'zh' && idx > 0;

                                if (token.changed) {
                                  return (
                                    <React.Fragment key={idx}>
                                      {needsSpace && ' '}
                                      <span
                                        className="relative inline-block mx-0.5 text-amber-300 font-extrabold tracking-wide underline decoration-amber-400/70 decoration-2 underline-offset-4 cursor-help group/word"
                                        title={token.original ? `Original: "${token.original}"` : (isSpanish ? 'Palabra corregida' : 'Corrected word')}
                                      >
                                        <span>{cleanWord}</span>
                                        {token.original && (
                                          <span dir="ltr" className="hidden group-hover/word:block absolute bottom-full left-1/2 -translate-x-1/2 mb-1 z-20 whitespace-nowrap bg-stone-900 text-white text-[10px] px-2 py-0.5 rounded shadow-lg border border-stone-700 pointer-events-none">
                                            Original: <span className="line-through text-rose-300">{token.original}</span>
                                          </span>
                                        )}
                                      </span>
                                    </React.Fragment>
                                  );
                                }

                                return (
                                  <React.Fragment key={idx}>
                                    {needsSpace && ' '}
                                    <span>{cleanWord}</span>
                                  </React.Fragment>
                                );
                              })
                            ) : (
                              <span>{item.text}</span>
                            )}
                          </div>

                          {/* Pedagogical Correction Comparison */}
                          {item.hasCorrection && item.originalText && item.correctedText && item.originalText.toLowerCase().trim() !== item.correctedText.toLowerCase().trim() && (
                            <div className="mt-2 pt-2 border-t border-white/20 text-[11px] text-white/95 flex flex-col gap-0.5" dir="ltr">
                              <div className="flex items-center gap-1.5 text-pink-100">
                                <span className="font-semibold text-rose-200">{isSpanish ? 'Original:' : 'Original:'}</span>
                                <span className="line-through text-pink-200/90">{item.originalText}</span>
                              </div>
                              <div className="flex items-center gap-1.5 font-semibold text-amber-300">
                                <span>{isSpanish ? 'Forma correcta:' : 'Corrected:'}</span>
                                <span>{item.correctedText}</span>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  }

                  // Assistant (LinguaFlow AI) Message
                  return (
                    <div key={item.id} className="flex flex-col items-start my-2.5 animate-fade-in group w-full">
                      {/* Bot Header */}
                      <div className="flex items-center space-x-1.5 mb-1 px-1">
                        <div className="w-4 h-4 rounded-full bg-gradient-to-tr from-rose-500 to-pink-400 flex items-center justify-center text-[10px] text-white font-bold shadow-xs">
                          L
                        </div>
                        <span className="text-xs font-semibold text-rose-600 dark:text-rose-400">
                          LinguaFlow AI
                        </span>
                        {item.timestamp && (
                          <span className="text-[10px] text-[var(--text-muted)] font-mono">
                            {item.timestamp}
                          </span>
                        )}
                      </div>

                      {/* Bot Bubble */}
                      <div
                        dir={targetLang === 'ar' || /[\u0600-\u06FF]/.test(item.text || '') ? 'rtl' : 'ltr'}
                        className="max-w-[88%] sm:max-w-[78%] bg-[var(--surface-secondary)] text-[var(--text-primary)] border border-[var(--border-primary)] rounded-2xl rounded-tl-xs px-3.5 sm:px-4 py-2.5 shadow-md shadow-black/10 text-left"
                      >
                        <p className="text-[13px] sm:text-sm leading-relaxed whitespace-pre-wrap select-text">
                          {item.text}
                          {item.isStreaming && (
                            <span className="inline-block w-1.5 h-3.5 bg-rose-500 ml-1 animate-pulse align-middle" />
                          )}
                        </p>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="text-center py-8 text-xs text-[var(--text-muted)] italic flex flex-col items-center justify-center gap-2">
                  {callState === 'connecting' ? (
                    <>
                      <div className="w-4 h-4 border-2 border-rose-500 border-t-transparent rounded-full animate-spin" />
                      <span>{isSpanish ? 'Estableciendo enlace de audio...' : 'Establishing audio connection...'}</span>
                    </>
                  ) : (
                    <span>{isSpanish ? 'Comienza a hablar para iniciar la conversación...' : 'Start speaking to begin conversation...'}</span>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 3. BOTTOM CALL CONTROLS */}
      <div className="pt-4 border-t border-[var(--border-primary)] flex items-center justify-center gap-4">
        {/* Mute/Unmute Toggle button */}
        <button
          type="button"
          onClick={toggleMute}
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
          onClick={handleEndCallAction}
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
