import React, { useState, useEffect, useRef } from 'react';
import {
  ArrowLeft,
  Mic,
  MicOff,
  PhoneOff,
  Sparkles,
  Volume2,
  FileText,
  Languages,
  AlertCircle,
  RotateCcw,
  CheckCircle2,
  Loader2,
  Radio
} from 'lucide-react';
import { useSiteLanguage } from '../../context/SiteLanguageContext.jsx';
import { getLanguageMeta, getTextDirection, isRtlLanguage } from '../../constants/languages.js';
import { usePipelineCall } from '../../hooks/usePipelineCall.js';
import { InterlinearGloss } from '../common/InterlinearGloss.jsx';
import { getArabicTransliteration } from '../../services/arabicTransliteration.js';
import { PUNCTUATION_REGEX } from '../../services/languageGlossStrategies.js';
import { tokenizeLiveCallTurn } from '../../services/liveCallGlossService.js';

export function LiveCallView({
  targetLang,
  nativeLang = 'es',
  level = 'A2/B1',
  apiKey = '',
  onEndCall
}) {
  const { t, isSpanish } = useSiteLanguage();
  const currentTargetMeta = getLanguageMeta(targetLang);

  const isChinese = targetLang === 'zh';
  const isArabic = targetLang === 'ar';
  const hasTranslit = isChinese || isArabic;
  const isRtl = isRtlLanguage(targetLang);
  const textDirection = getTextDirection(targetLang);

  const [showLiveTranscript, setShowLiveTranscript] = useState(true);
  const transcriptContainerRef = useRef(null);

  const activeCall = usePipelineCall({
    targetLang,
    nativeLang,
    level,
    apiKey,
    isSpanish
  });

  const {
    callState,
    isMuted,
    errorMessage,
    liveTranscript,
    showGlosses,
    setShowGlosses,
    toggleGlosses,
    formattedDuration,
    startCall,
    endCall,
    toggleMute
  } = activeCall;

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

  // Helper to render 3-tier interlinear tokens: Translit/Pinyin (Tier 1, ar/zh only) + Word (Tier 2) + Gloss (Tier 3, when ON)
  const renderInterlinearTokens = (tokens, isUser = false) => {
    if (!Array.isArray(tokens) || tokens.length === 0) return null;

    return (
      <div
        dir={textDirection}
        style={{ direction: textDirection }}
        className={`flex flex-wrap items-start ${
          isChinese
            ? 'gap-x-1 sm:gap-x-1.5 gap-y-2.5 sm:gap-y-3'
            : 'gap-x-1.5 sm:gap-x-2 gap-y-2 sm:gap-y-2.5'
        } leading-tight break-words max-w-full ${
          isRtl ? 'justify-start text-right' : 'justify-start text-left'
        }`}
      >
        {tokens.map((tokenObj, idx) => {
          if (!tokenObj) return null;
          const rawWord = typeof tokenObj === 'string'
            ? tokenObj
            : (tokenObj.word || tokenObj.text || '');
          const word = rawWord != null ? String(rawWord).trim() : '';
          if (!word) return null;

          const isPunctuation = typeof tokenObj === 'object' && typeof tokenObj.isPunctuation === 'boolean'
            ? tokenObj.isPunctuation
            : PUNCTUATION_REGEX.test(word);

          // Tier 1 (Transliteration / Pīnyīn): STRICTLY for Arabic ('ar') and Chinese ('zh')
          const rawAux = (isChinese || isArabic) && tokenObj && typeof tokenObj === 'object'
            ? (tokenObj.auxiliary ?? tokenObj.translit ?? tokenObj.pinyin ?? (isArabic ? getArabicTransliteration(word) : null))
            : (isArabic ? getArabicTransliteration(word) : null);
          const auxiliary = (isChinese || isArabic) && rawAux != null ? String(rawAux).trim() : null;

          // Tier 3 (Word-by-word Gloss):
          const rawGlossVal = tokenObj && typeof tokenObj === 'object' ? tokenObj.gloss : null;
          const rawGloss = rawGlossVal != null ? String(rawGlossVal).trim() : null;
          const wordLower = word.toLowerCase();
          const rawGlossLower = rawGloss ? rawGloss.toLowerCase() : null;
          const isLegitSameWord = word === '的' && rawGlossLower === 'de';
          const cleanGloss = (rawGloss && (rawGloss !== auxiliary || isLegitSameWord) && rawGlossLower !== wordLower)
            ? rawGloss
            : null;

          if (isPunctuation) {
            return (
              <span
                key={idx}
                dir={textDirection}
                className={`font-medium select-text self-start isolate [unicode-bidi:isolate] ${
                  isUser ? 'text-pink-200/90' : 'text-stone-400'
                } ${
                  isChinese
                    ? (hasTranslit ? 'text-sm sm:text-base mt-2.5 sm:mt-3' : 'text-sm sm:text-base mt-0.5')
                    : (hasTranslit ? 'text-base sm:text-lg mt-2.5 sm:mt-3' : 'text-base sm:text-lg mt-0.5')
                }`}
              >
                {word}
              </span>
            );
          }

          const isChanged = Boolean(isUser && tokenObj.changed);

          return (
            <div
              key={idx}
              dir={textDirection}
              className="inline-flex flex-col items-center justify-start rounded transition-colors group/token max-w-full isolate [unicode-bidi:isolate] px-0.5 sm:px-1 py-0.5"
            >
              {/* Tier 1 (TOP): Transliteration for Arabic / Pīnyīn for Chinese ONLY */}
              {hasTranslit && auxiliary && (
                <span
                  dir="ltr"
                  className={`text-[11px] sm:text-[12px] font-mono font-medium tracking-tight leading-none mb-0.5 select-text opacity-90 ${
                    isUser ? 'text-pink-100' : 'text-[var(--text-muted)] dark:text-stone-400'
                  }`}
                >
                  {auxiliary}
                </span>
              )}

              {/* Tier 2 (MIDDLE): Word */}
              {isChanged ? (
                <span
                  className="relative inline-block text-amber-200 dark:text-amber-200 font-extrabold tracking-wide underline decoration-amber-300 decoration-2 underline-offset-4 cursor-help group/word leading-tight select-text"
                  title={tokenObj.original ? `Original: "${tokenObj.original}"` : (isSpanish ? 'Palabra corregida' : 'Corrected word')}
                >
                  <span>{word}</span>
                  {tokenObj.original && (
                    <span dir="ltr" className="hidden group-hover/word:block absolute bottom-full left-1/2 -translate-x-1/2 mb-1 z-20 whitespace-nowrap bg-stone-900 text-white text-[10px] px-2 py-0.5 rounded shadow-lg border border-stone-700 pointer-events-none">
                      Original: <span className="line-through text-rose-300">{tokenObj.original}</span>
                    </span>
                  )}
                </span>
              ) : (
                <span
                  dir={textDirection}
                  className={`leading-tight select-text ${
                    isUser
                      ? 'text-white font-semibold'
                      : 'text-[var(--text-primary)] font-semibold'
                  } ${isArabic ? 'font-arabic text-base sm:text-lg' : ''}`}
                >
                  {word}
                </span>
              )}

              {/* Tier 3 (BOTTOM): Word-by-word Gloss */}
              {showGlosses && cleanGloss && (
                <InterlinearGloss
                  gloss={cleanGloss}
                  isChinese={isChinese}
                  nativeLang={nativeLang}
                  className={
                    isUser
                      ? 'text-amber-200 dark:text-amber-200 text-xs font-normal mt-0.5 max-w-[160px] sm:max-w-[200px]'
                      : 'text-rose-600 dark:text-rose-400 text-xs font-normal mt-0.5 max-w-[160px] sm:max-w-[200px]'
                  }
                />
              )}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="flex-1 overflow-hidden w-full flex flex-col min-h-0 bg-[var(--app-bg)] text-[var(--text-primary)] animate-fade-in relative">
      {/* 1. TOP HEADER & CONTROLS BAR */}
      <header className="px-4 sm:px-6 py-3 border-b border-[var(--border-primary)] bg-[var(--surface-primary)] shadow-xs flex items-center justify-between z-10">
        <button
          type="button"
          onClick={handleEndCallAction}
          className="px-3.5 py-1.5 rounded-xl bg-[var(--surface-secondary)] hover:bg-[var(--surface-hover)] border border-[var(--border-primary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer flex items-center gap-2 text-xs sm:text-sm font-semibold shadow-xs active:scale-95"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>{t('back_to_hub')}</span>
        </button>

        {/* Center: Language & Duration */}
        <div className="flex items-center space-x-2 sm:space-x-3">
          <span className="text-xl sm:text-2xl">{currentTargetMeta.flag}</span>
          <div className="text-left hidden xs:block">
            <span className="text-xs sm:text-sm font-bold text-[var(--text-primary)] block leading-tight">
              {currentTargetMeta.name}
            </span>
          </div>
          <span className="font-mono text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20 shadow-xs">
            {formattedDuration}
          </span>
        </div>

        {/* Right: Toggle Buttons */}
        <div className="flex items-center space-x-2">
          {showLiveTranscript && (
            <button
              type="button"
              onClick={toggleGlosses}
              className={`px-2.5 sm:px-3 py-1.5 rounded-xl border text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs active:scale-95 ${
                showGlosses
                  ? 'bg-amber-500 text-white border-amber-600'
                  : 'bg-[var(--surface-secondary)] border-[var(--border-primary)] text-[var(--text-muted)] hover:text-[var(--text-primary)]'
              }`}
              title={showGlosses ? (isSpanish ? 'Desactivar glosas' : 'Disable glosses') : (isSpanish ? 'Activar glosas palabra por palabra' : 'Enable word-by-word glosses')}
            >
              <Languages className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{isSpanish ? 'Glosas' : 'Glosses'}</span>
              <span className="text-[10px] px-1 py-0.2 rounded bg-black/10 dark:bg-white/10 font-mono">
                {showGlosses ? 'ON' : 'OFF'}
              </span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setShowLiveTranscript(!showLiveTranscript)}
            className={`px-2.5 sm:px-3 py-1.5 rounded-xl border text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs active:scale-95 ${
              showLiveTranscript
                ? 'bg-rose-500 text-white border-rose-600'
                : 'bg-[var(--surface-secondary)] border-[var(--border-primary)] text-[var(--text-muted)] hover:text-[var(--text-primary)]'
            }`}
            title="Activar o desactivar transcripción en vivo"
          >
            <FileText className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{t('call_transcription_toggle')}</span>
            <span className="text-[10px] px-1 py-0.2 rounded bg-black/10 dark:bg-white/10 font-mono">
              {showLiveTranscript ? t('call_transcription_on') : t('call_transcription_off')}
            </span>
          </button>
        </div>
      </header>

      {/* 2. COMPACT CALL STATUS BAR */}
      <div className="px-4 py-2.5 bg-[var(--surface-secondary)]/70 border-b border-[var(--border-primary)] flex items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 sm:gap-3 max-w-2xl">
          {/* Pulsing AI mini-avatar */}
          <div
            className={`w-6 h-6 rounded-full flex items-center justify-center text-white shadow-sm transition-all ${
              callState === 'speaking'
                ? 'bg-gradient-to-tr from-rose-500 to-pink-500 animate-pulse ring-2 ring-rose-400/50'
                : callState === 'listening'
                ? 'bg-gradient-to-tr from-emerald-600 to-teal-500 ring-2 ring-emerald-400/50'
                : callState === 'thinking'
                ? 'bg-gradient-to-tr from-purple-600 to-indigo-500 animate-pulse'
                : callState === 'error'
                ? 'bg-red-500'
                : 'bg-stone-500'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
          </div>

          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-[11px] font-bold tracking-wide transition-all ${statusInfo.colorClass}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${statusInfo.dotClass}`} />
              <span>{statusInfo.label}</span>
            </span>

            {callState === 'error' && (
              <button
                type="button"
                onClick={startCall}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-red-600 text-white font-bold text-[10px] hover:bg-red-700 cursor-pointer shadow-xs active:scale-95"
              >
                <RotateCcw className="w-3 h-3" />
                <span>{isSpanish ? 'Reintentar' : 'Retry'}</span>
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5 text-[10px] text-[var(--text-muted)] font-mono">
          <Radio className="w-3 h-3 text-emerald-500 animate-pulse" />
          <span>Pipeline (STT→LLM→TTS)</span>
        </div>
      </div>

      {/* 3. WIDE CONVERSATIONAL STREAM (USER VS LINGUAFLOW AI) */}
      <main
        ref={transcriptContainerRef}
        className="flex-1 overflow-y-auto px-3 sm:px-6 py-4 sm:py-6 max-w-4xl w-full mx-auto space-y-4 sm:space-y-6 scroll-smooth"
      >
        {showLiveTranscript ? (
          liveTranscript.length > 0 ? (
            liveTranscript.map((item) => {
              const isUser = item.sender === 'user';
              const userTokens = item.tokens || (item.text ? tokenizeLiveCallTurn(item.text, targetLang, item.diffTokens) : []);
              const botTokens = item.tokens || (item.text ? tokenizeLiveCallTurn(item.text, targetLang) : []);

              if (isUser) {
                return (
                  <div key={item.id} className="flex flex-col items-end w-full animate-fade-in group">
                    {/* User Header Badge */}
                    <div className="flex items-center space-x-2 mb-1 px-1">
                      <span className="text-xs font-semibold text-[var(--text-secondary)]">
                        {item.speaker || (isSpanish ? 'Tú' : 'You')}
                      </span>
                      {item.isCorrecting ? (
                        <span className="flex items-center space-x-1.5 text-[10px] sm:text-[11px] font-semibold text-pink-700 dark:text-pink-300 bg-pink-500/15 px-2 py-0.5 rounded-full border border-pink-500/30 shadow-xs animate-pulse">
                          <Sparkles className="w-3 h-3 text-pink-500" />
                          <span>{isSpanish ? 'Analizando...' : 'Analyzing...'}</span>
                        </span>
                      ) : item.hasCorrection ? (
                        <span className="flex items-center space-x-1.5 text-[10px] sm:text-[11px] font-semibold text-amber-700 dark:text-amber-300 bg-amber-500/15 px-2 py-0.5 rounded-full border border-amber-500/30 shadow-xs">
                          <CheckCircle2 className="w-3 h-3 text-amber-500" />
                          <span>{isSpanish ? 'Corregido' : 'Corrected'}</span>
                        </span>
                      ) : (
                        <span className="flex items-center space-x-1.5 text-[10px] sm:text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-500/15 px-2 py-0.5 rounded-full border border-emerald-500/30 shadow-xs">
                          <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                          <span>{isSpanish ? 'Sin errores' : 'No errors'}</span>
                        </span>
                      )}
                      {item.isGlossing && (
                        <span className="flex items-center space-x-1 text-[10px] text-amber-600 dark:text-amber-400 bg-amber-500/15 px-2 py-0.5 rounded-full border border-amber-500/30 animate-pulse">
                          <Loader2 className="w-2.5 h-2.5 animate-spin" />
                          <span>{isSpanish ? 'Glosando...' : 'Glossing...'}</span>
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
                      dir={targetLang === 'ar' || /[؀-ۿ]/.test(item.text || '') ? 'rtl' : 'ltr'}
                      className="max-w-[92%] sm:max-w-[82%] bg-gradient-to-r from-rose-600 via-rose-500 to-pink-600 text-white rounded-3xl rounded-tr-xs px-4 sm:px-5 py-3 sm:py-3.5 shadow-md shadow-rose-950/20 border border-rose-400/30 text-left"
                    >
                      {!item.text ? (
                        <span className="italic opacity-85 text-xs flex items-center gap-1.5 py-0.5 animate-pulse">
                          <Mic className="w-3.5 h-3.5 text-pink-200" />
                          <span>{isSpanish ? 'Transcribiendo audio...' : 'Transcribing speech...'}</span>
                        </span>
                      ) : (
                        renderInterlinearTokens(userTokens, true)
                      )}

                      {/* Pedagogical Correction Comparison (Secondary block below) */}
                      {item.hasCorrection && item.originalText && item.correctedText && item.originalText.toLowerCase().trim() !== item.correctedText.toLowerCase().trim() && (
                        <div className="mt-2.5 pt-2 border-t border-white/20 text-xs space-y-0.5" dir="ltr">
                          <div className="flex items-center gap-1.5 text-pink-100/90">
                            <span className="font-medium text-pink-200">{isSpanish ? 'Original:' : 'Original:'}</span>
                            <span className="line-through text-pink-200/80">{item.originalText}</span>
                          </div>
                          <div className="flex items-center gap-1.5 font-semibold text-amber-200">
                            <span>{isSpanish ? 'Correcto:' : 'Corrected:'}</span>
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
                <div key={item.id} className="flex flex-col items-start w-full animate-fade-in group">
                  {/* Bot Header */}
                  <div className="flex items-center space-x-1.5 mb-1 px-1">
                    <div className="w-4 h-4 rounded-full bg-gradient-to-tr from-rose-500 to-pink-400 flex items-center justify-center text-[10px] text-white font-bold shadow-xs">
                      L
                    </div>
                    <span className="text-xs font-semibold text-rose-600 dark:text-rose-400">
                      LinguaFlow AI
                    </span>
                    {item.isGlossing && (
                      <span className="flex items-center space-x-1 text-[10px] text-amber-500 dark:text-amber-400">
                        <Loader2 className="w-2.5 h-2.5 animate-spin" />
                        <span>{isSpanish ? 'Glosando...' : 'Glossing...'}</span>
                      </span>
                    )}
                    {item.timestamp && (
                      <span className="text-[10px] text-[var(--text-muted)] font-mono">
                        {item.timestamp}
                      </span>
                    )}
                  </div>

                  {/* Bot Bubble */}
                  <div
                    dir={targetLang === 'ar' || /[؀-ۿ]/.test(item.text || '') ? 'rtl' : 'ltr'}
                    className="max-w-[92%] sm:max-w-[82%] bg-[var(--surface-primary)] dark:bg-stone-900 text-[var(--text-primary)] border border-[var(--border-primary)] rounded-3xl rounded-tl-xs px-4 sm:px-5 py-3 sm:py-3.5 shadow-sm text-left"
                  >
                    {renderInterlinearTokens(botTokens, false)}
                    {item.isStreaming && (
                      <span className="inline-block w-1.5 h-3.5 bg-rose-500 ml-1 animate-pulse align-middle" />
                    )}
                  </div>
                </div>
              );
            })
          ) : (
            <div className="text-center py-16 text-sm text-[var(--text-muted)] flex flex-col items-center justify-center gap-3">
              {callState === 'connecting' ? (
                <>
                  <div className="w-6 h-6 border-2 border-rose-500 border-t-transparent rounded-full animate-spin" />
                  <span>{isSpanish ? 'Estableciendo enlace de audio en tiempo real...' : 'Establishing real-time audio connection...'}</span>
                </>
              ) : callState === 'error' ? (
                <>
                  <div className="w-12 h-12 rounded-full bg-red-500/10 text-red-500 flex items-center justify-center mb-1">
                    <AlertCircle className="w-6 h-6" />
                  </div>
                  <p className="font-semibold text-base text-red-600 dark:text-red-400 max-w-md">
                    {errorMessage || (isSpanish ? 'Error al acceder al micrófono' : 'Error accessing microphone')}
                  </p>
                  <button
                    type="button"
                    onClick={startCall}
                    className="mt-2 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs shadow-md transition-all active:scale-95 cursor-pointer"
                  >
                    <RotateCcw className="w-4 h-4" />
                    <span>{isSpanish ? 'Reintentar conexión' : 'Retry connection'}</span>
                  </button>
                </>
              ) : (
                <>
                  <div className="w-12 h-12 rounded-full bg-rose-500/10 text-rose-500 flex items-center justify-center mb-1">
                    <Mic className="w-6 h-6" />
                  </div>
                  <p className="font-medium text-base text-[var(--text-primary)]">
                    {isSpanish ? 'Comienza a hablar en voz alta' : 'Start speaking aloud'}
                  </p>
                  <p className="text-xs text-[var(--text-muted)] max-w-sm">
                    {isSpanish
                      ? 'La IA te responderá con voz fluida y natural. Tus frases serán analizadas y corregidas aquí mismo en tiempo real.'
                      : 'The AI will reply fluently in voice. Your phrases will be transcribed and corrected here in real-time.'}
                  </p>
                </>
              )}
            </div>
          )
        ) : (
          <div className="text-center py-20 text-xs text-[var(--text-muted)] flex flex-col items-center justify-center gap-2">
            <Volume2 className="w-8 h-8 text-rose-400/60 animate-pulse" />
            <p>{isSpanish ? 'Transcripción oculta. El audio sigue activo.' : 'Transcript hidden. Audio remains active.'}</p>
          </div>
        )}
      </main>

      {/* 4. BOTTOM FLOATING / DOCKED CALL CONTROLS */}
      <footer className="px-4 py-3 sm:py-4 border-t border-[var(--border-primary)] bg-[var(--surface-primary)] shadow-md flex items-center justify-center gap-4 sm:gap-6 z-20">
        {/* Mute/Unmute Toggle button */}
        <button
          type="button"
          onClick={toggleMute}
          className={`w-12 h-12 sm:w-14 sm:h-14 rounded-2xl flex items-center justify-center transition-all cursor-pointer shadow-md active:scale-95 border ${
            isMuted
              ? 'bg-amber-500/20 border-amber-500 text-amber-600 dark:text-amber-400'
              : 'bg-[var(--surface-secondary)] hover:bg-[var(--surface-hover)] border-[var(--border-primary)] text-[var(--text-primary)]'
          }`}
          title={isMuted ? t('call_mic_unmute') : t('call_mic_mute')}
        >
          {isMuted ? <MicOff className="w-5 h-5 sm:w-6 sm:h-6" /> : <Mic className="w-5 h-5 sm:w-6 sm:h-6" />}
        </button>

        {/* End Call Button */}
        <button
          type="button"
          onClick={handleEndCallAction}
          className="px-6 sm:px-8 py-3 sm:py-3.5 rounded-2xl bg-red-600 hover:bg-red-700 text-white font-bold text-sm flex items-center gap-2.5 shadow-lg shadow-red-950/40 transition-all cursor-pointer active:scale-95"
        >
          <PhoneOff className="w-5 h-5" />
          <span>{t('call_end_action')}</span>
        </button>
      </footer>
    </div>
  );
}

export default LiveCallView;
