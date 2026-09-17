import React, { useState } from 'react';
import {
  ArrowLeft,
  Mic,
  Calendar,
  Clock,
  BookOpen,
  FileText,
  Sparkles,
  CheckCircle2,
  Languages
} from 'lucide-react';
import { useSiteLanguage } from '../../context/SiteLanguageContext.jsx';
import { getLanguageMeta } from '../../constants/languages.js';
import { InterlinearGloss } from '../common/InterlinearGloss.jsx';
import { PUNCTUATION_REGEX } from '../../services/subtitleGlossService.js';
import { tokenizeLiveCallTurn } from '../../services/liveCallGlossService.js';

export function CallDetailView({
  callData,
  onBack,
  nativeLang = 'es'
}) {
  const { t, isSpanish } = useSiteLanguage();
  const targetLang = callData?.lang || 'es';
  const langMeta = getLanguageMeta(targetLang);

  const isArabic = targetLang === 'ar';
  const isChinese = targetLang === 'zh';
  const hasTranslit = isArabic || isChinese;
  const textDirection = isArabic ? 'rtl' : 'ltr';
  const isRtl = isArabic;

  // Check if any line in transcript contains glosses to set intelligent initial toggle state
  const hasAnyGlosses = Boolean(
    callData?.transcript?.some((line) =>
      (Array.isArray(line.tokens) && line.tokens.some((t) => Boolean(t.gloss))) ||
      (Array.isArray(line.glosses) && line.glosses.some(Boolean))
    )
  );

  const [showGlosses, setShowGlosses] = useState(hasAnyGlosses);

  // Render 3-tier interlinear tokens for history segment
  const renderHistoryTokens = (line) => {
    const isUser = line.sender === 'user';
    const tokens = Array.isArray(line.tokens) && line.tokens.length > 0
      ? line.tokens
      : (line.text ? tokenizeLiveCallTurn(line.text, targetLang, line.diffTokens) : []);

    // Fallback for legacy history records without tokenization
    if (tokens.length === 0) {
      if (hasTranslit && line.transliteration) {
        return (
          <div className="space-y-1">
            <p dir="ltr" className="text-xs font-mono text-[var(--text-muted)] dark:text-stone-400">
              {line.transliteration}
            </p>
            <p dir={textDirection} className="whitespace-pre-wrap font-medium">
              {line.text}
            </p>
          </div>
        );
      }
      return <p dir={textDirection} className="whitespace-pre-wrap">{line.text}</p>;
    }

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
          const auxiliary = hasTranslit && tokenObj && typeof tokenObj === 'object'
            ? (tokenObj.auxiliary ?? tokenObj.translit ?? tokenObj.pinyin ?? null)
            : null;

          // Tier 3 (Word-by-word Gloss):
          const rawGlossVal = tokenObj && typeof tokenObj === 'object' ? tokenObj.gloss : null;
          const rawGloss = rawGlossVal != null ? String(rawGlossVal).trim() : null;
          const rawGlossLower = rawGloss ? rawGloss.toLowerCase() : null;
          const isLegitSameAux = word === '的' && rawGlossLower === 'de';
          const cleanGloss = (rawGloss && (rawGloss !== auxiliary || isLegitSameAux))
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
    <div className="flex-1 overflow-y-auto w-full max-w-4xl mx-auto px-3 sm:px-6 py-4 sm:py-6 text-[var(--text-primary)] space-y-5 animate-fade-in">
      {/* 1. Header with Back button */}
      <div className="flex items-center justify-between pb-3 border-b border-[var(--border-primary)]">
        <button
          type="button"
          onClick={onBack}
          className="px-3.5 py-2 rounded-xl bg-[var(--surface-secondary)] hover:bg-[var(--surface-hover)] border border-[var(--border-primary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer flex items-center gap-2 text-xs sm:text-sm font-semibold shadow-xs active:scale-95"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>{t('back_to_hub')}</span>
        </button>

        <div className="flex items-center space-x-2">
          <div className="w-7 h-7 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white shadow-sm">
            <Mic className="w-4 h-4" />
          </div>
          <h2 className="text-base sm:text-lg font-bold text-[var(--text-primary)] tracking-wide">
            {t('call_detail_title')}
          </h2>
        </div>

        <div className="w-16" />
      </div>

      {/* 2. Metadata Card */}
      <div className="p-4 sm:p-5 rounded-3xl bg-[var(--surface-primary)] border border-[var(--border-primary)] shadow-md space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center space-x-3">
            <span className="text-3xl">{langMeta.flag}</span>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-[var(--text-primary)]">
                {langMeta.name}
              </h3>
              <p className="text-xs text-[var(--text-muted)]">
                {callData?.summary || (isSpanish ? 'Llamada de voz completada' : 'Completed voice call')}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 flex items-center gap-1.5 shadow-xs">
              <Clock className="w-3.5 h-3.5" />
              <span>{callData?.duration || '00:00'}</span>
            </span>
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/30 flex items-center gap-1.5 shadow-xs">
              <Calendar className="w-3.5 h-3.5" />
              <span>{callData?.date || (isSpanish ? 'Hoy' : 'Today')}</span>
            </span>
          </div>
        </div>
      </div>

      {/* 3. Transcription Section (Wide Modern Feed) */}
      <div className="p-4 sm:p-6 rounded-3xl bg-[var(--surface-primary)] border border-[var(--border-primary)] shadow-md space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-[var(--border-primary)]/70">
          <h4 className="text-xs sm:text-sm font-bold text-rose-600 dark:text-rose-400 uppercase tracking-wider flex items-center gap-2">
            <FileText className="w-4 h-4 text-rose-500" />
            <span>{t('call_detail_transcript_title')}</span>
          </h4>

          {/* Glosses Toggle Button */}
          <button
            type="button"
            onClick={() => setShowGlosses(!showGlosses)}
            className={`px-3 py-1 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer border ${
              showGlosses
                ? 'bg-rose-500 text-white border-rose-600'
                : 'bg-[var(--surface-secondary)] text-[var(--text-secondary)] border-[var(--border-primary)] hover:bg-[var(--surface-hover)]'
            }`}
            title={showGlosses ? (isSpanish ? 'Ocultar glosas palabra por palabra' : 'Hide word-by-word glosses') : (isSpanish ? 'Mostrar glosas palabra por palabra' : 'Show word-by-word glosses')}
          >
            <Languages className="w-3.5 h-3.5" />
            <span>{showGlosses ? 'Glosas ON' : 'Glosas OFF'}</span>
          </button>
        </div>

        {callData?.transcript && callData.transcript.length > 0 ? (
          <div className="space-y-4 sm:space-y-5 pt-2">
            {callData.transcript.map((line, idx) => {
              const isUser = line.sender === 'user';

              if (isUser) {
                return (
                  <div key={idx} className="flex flex-col items-end w-full animate-fade-in group">
                    {/* User Header Badge */}
                    <div className="flex items-center space-x-2 mb-1 px-1">
                      <span className="text-xs font-semibold text-[var(--text-secondary)]">
                        {isSpanish ? 'Tú' : 'You'}
                      </span>
                      {line.hasCorrection ? (
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
                      {line.timestamp && (
                        <span className="text-[10px] text-[var(--text-muted)] font-mono">
                          {line.timestamp}
                        </span>
                      )}
                    </div>

                    {/* User Speech Bubble with Corrected Version as Primary */}
                    <div
                      dir={targetLang === 'ar' || /[؀-ۿ]/.test(line.text || '') ? 'rtl' : 'ltr'}
                      className="max-w-[92%] sm:max-w-[82%] bg-gradient-to-r from-rose-600 via-rose-500 to-pink-600 text-white rounded-3xl rounded-tr-xs px-4 sm:px-5 py-3 sm:py-3.5 shadow-md shadow-rose-950/20 border border-rose-400/30 text-left"
                    >
                      {renderHistoryTokens(line)}

                      {/* Secondary Pedagogical Comparison (Original vs Corrected) */}
                      {line.hasCorrection && line.originalText && line.correctedText && line.originalText.toLowerCase().trim() !== line.correctedText.toLowerCase().trim() && (
                        <div className="mt-2.5 pt-2 border-t border-white/20 text-xs space-y-0.5" dir="ltr">
                          <div className="flex items-center gap-1.5 text-pink-100/90">
                            <span className="font-medium text-pink-200">{isSpanish ? 'Original:' : 'Original:'}</span>
                            <span className="line-through text-pink-200/80">{line.originalText}</span>
                          </div>
                          <div className="flex items-center gap-1.5 font-semibold text-amber-200">
                            <span>{isSpanish ? 'Correcto:' : 'Corrected:'}</span>
                            <span>{line.correctedText}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              }

              // Assistant Message (Left)
              return (
                <div key={idx} className="flex flex-col items-start w-full animate-fade-in group">
                  {/* Bot Header */}
                  <div className="flex items-center space-x-1.5 mb-1 px-1">
                    <div className="w-4 h-4 rounded-full bg-gradient-to-tr from-rose-500 to-pink-400 flex items-center justify-center text-[10px] text-white font-bold shadow-xs">
                      L
                    </div>
                    <span className="text-xs font-semibold text-rose-600 dark:text-rose-400">
                      LinguaFlow AI
                    </span>
                    {line.timestamp && (
                      <span className="text-[10px] text-[var(--text-muted)] font-mono">
                        {line.timestamp}
                      </span>
                    )}
                  </div>

                  {/* Bot Bubble */}
                  <div
                    dir={targetLang === 'ar' || /[؀-ۿ]/.test(line.text || '') ? 'rtl' : 'ltr'}
                    className="max-w-[92%] sm:max-w-[82%] bg-[var(--surface-secondary)] text-[var(--text-primary)] border border-[var(--border-primary)] rounded-3xl rounded-tl-xs px-4 sm:px-5 py-3 sm:py-3.5 shadow-sm text-left"
                  >
                    {renderHistoryTokens(line)}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-8 text-xs text-[var(--text-muted)] bg-[var(--surface-secondary)] rounded-2xl border border-[var(--border-primary)] p-4">
            <p>{isSpanish ? 'No se registró transcripción para esta llamada.' : 'No transcript recorded for this call.'}</p>
          </div>
        )}
      </div>

      {/* 4. Learned Vocabulary & Corrections Section */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="p-4 sm:p-5 rounded-3xl bg-[var(--surface-primary)] border border-[var(--border-primary)] shadow-md space-y-2">
          <h4 className="text-xs sm:text-sm font-bold text-rose-600 dark:text-rose-300 uppercase tracking-wider flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-rose-500" />
            <span>{t('call_detail_vocab_title')}</span>
          </h4>
          <p className="text-xs text-[var(--text-muted)]">
            {isSpanish
              ? 'Las palabras practicadas en las llamadas se sincronizan aquí automáticamente.'
              : 'Vocabulary practiced during voice calls will be automatically recorded here.'}
          </p>
        </div>

        <div className="p-4 sm:p-5 rounded-3xl bg-[var(--surface-primary)] border border-[var(--border-primary)] shadow-md space-y-2">
          <h4 className="text-xs sm:text-sm font-bold text-rose-600 dark:text-rose-300 uppercase tracking-wider flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-rose-500" />
            <span>{t('call_detail_corrections_title')}</span>
          </h4>
          <p className="text-xs text-[var(--text-muted)]">
            {isSpanish
              ? 'Retroalimentación y sugerencias fonéticas registradas de la llamada.'
              : 'Feedback and phonetic suggestions recorded from the call.'}
          </p>
        </div>
      </div>
    </div>
  );
}

export default CallDetailView;
