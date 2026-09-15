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
    const tokens = Array.isArray(line.tokens) ? line.tokens : [];

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
            ? 'gap-x-1 sm:gap-x-1.5 gap-y-2 sm:gap-y-2.5'
            : 'gap-x-1.5 sm:gap-x-2 gap-y-1.5 sm:gap-y-2'
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
                  isUser ? 'text-pink-300 dark:text-pink-400' : 'text-stone-400'
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
                    isUser ? 'text-pink-700 dark:text-pink-300' : 'text-[var(--text-muted)] dark:text-stone-400'
                  }`}
                >
                  {auxiliary}
                </span>
              )}

              {/* Tier 2 (MIDDLE): Word */}
              {isChanged ? (
                <span
                  className="relative inline-block text-amber-600 dark:text-amber-300 font-extrabold tracking-wide underline decoration-amber-500/70 decoration-2 underline-offset-4 cursor-help group/word leading-tight select-text"
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
                  className={`leading-tight select-text font-semibold text-sm sm:text-base ${
                    isUser
                      ? 'text-rose-950 dark:text-rose-100'
                      : 'text-[var(--text-primary)]'
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
                  className={isUser ? '!text-rose-700 dark:!text-rose-300/90 text-xs sm:text-sm font-normal' : 'text-xs sm:text-sm'}
                />
              )}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="flex-1 overflow-y-auto w-full max-w-3xl mx-auto px-4 sm:px-6 py-4 sm:py-6 text-[var(--text-primary)] space-y-6 animate-fade-in">
      {/* 1. Header with Back button */}
      <div className="flex items-center justify-between pb-4 border-b border-[var(--border-primary)]">
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

        <div className="w-20" />
      </div>

      {/* 2. Metadata Card */}
      <div className="p-5 sm:p-6 rounded-3xl bg-[var(--surface-primary)] border border-[var(--border-primary)] shadow-md space-y-4">
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
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" />
              <span>{callData?.duration || '00:00'}</span>
            </span>
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/30 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5" />
              <span>{callData?.date || (isSpanish ? 'Hoy' : 'Today')}</span>
            </span>
          </div>
        </div>
      </div>

      {/* 3. Transcription Section */}
      <div className="p-5 sm:p-6 rounded-3xl bg-[var(--surface-primary)] border border-[var(--border-primary)] shadow-md space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="text-xs sm:text-sm font-bold text-rose-600 dark:text-rose-300 uppercase tracking-wider flex items-center gap-2">
            <FileText className="w-4 h-4 text-rose-500" />
            <span>{t('call_detail_transcript_title')}</span>
          </h4>

          {/* Glosses Toggle Button */}
          <button
            type="button"
            onClick={() => setShowGlosses(!showGlosses)}
            className={`px-2.5 py-1 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer border ${
              showGlosses
                ? 'bg-rose-500 text-white border-rose-600'
                : 'bg-[var(--surface-secondary)] text-[var(--text-secondary)] border-[var(--border-primary)] hover:bg-[var(--surface-hover)]'
            }`}
            title={showGlosses ? 'Ocultar glosas palabra por palabra' : 'Mostrar glosas palabra por palabra'}
          >
            <Languages className="w-3.5 h-3.5" />
            <span>{showGlosses ? 'Glosas ON' : 'Glosas OFF'}</span>
          </button>
        </div>

        {callData?.transcript && callData.transcript.length > 0 ? (
          <div className="space-y-3">
            {callData.transcript.map((line, idx) => (
              <div
                key={idx}
                className={`p-3.5 rounded-2xl text-xs leading-relaxed ${
                  line.sender === 'user'
                    ? 'bg-rose-500/10 border border-rose-500/20 text-[var(--text-primary)] ml-4 sm:ml-6'
                    : 'bg-[var(--surface-secondary)] border border-[var(--border-primary)] text-[var(--text-primary)] mr-4 sm:mr-6'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold text-[11px] text-rose-600 dark:text-rose-400 block">
                    {line.sender === 'user' ? (isSpanish ? 'Tú:' : 'You:') : 'LinguaFlow AI:'}
                  </span>
                  {line.sender === 'user' && (
                    line.hasCorrection ? (
                      <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 text-amber-500" />
                        <span>{isSpanish ? 'Corregido' : 'Corrected'}</span>
                      </span>
                    ) : (
                      <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                        <span>{isSpanish ? 'Sin errores' : 'No errors'}</span>
                      </span>
                    )
                  )}
                </div>

                {/* 3-Tier Interlinear Token Presentation */}
                {renderHistoryTokens(line)}

                {/* Pedagogical Correction summary diff if applicable */}
                {line.hasCorrection && line.originalText && line.correctedText && line.originalText.toLowerCase().trim() !== line.correctedText.toLowerCase().trim() && (
                  <div className="mt-2.5 pt-2 border-t border-rose-500/20 text-[11px] space-y-0.5">
                    <p className="text-[var(--text-muted)]">
                      <span className="font-medium text-rose-500">{isSpanish ? 'Original: ' : 'Original: '}</span>
                      <span className="line-through">{line.originalText}</span>
                    </p>
                    <p className="text-amber-600 dark:text-amber-400 font-medium">
                      <span>{isSpanish ? 'Correcto: ' : 'Corrected: '}</span>
                      <span>{line.correctedText}</span>
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-6 text-xs text-[var(--text-muted)] bg-[var(--surface-secondary)] rounded-2xl border border-[var(--border-primary)] p-4">
            <p>{isSpanish ? 'No se registró transcripción para esta llamada.' : 'No transcript recorded for this call.'}</p>
          </div>
        )}
      </div>

      {/* 4. Learned Vocabulary & Corrections Section */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="p-5 rounded-3xl bg-[var(--surface-primary)] border border-[var(--border-primary)] shadow-md space-y-3">
          <h4 className="text-xs sm:text-sm font-bold text-rose-600 dark:text-rose-300 uppercase tracking-wider flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-rose-500" />
            <span>{t('call_detail_vocab_title')}</span>
          </h4>
          <p className="text-xs text-[var(--text-muted)]">
            {isSpanish
              ? 'Las palabras practicadas en las llamadas se sincronizarán aquí automáticamente.'
              : 'Vocabulary practiced during voice calls will be automatically recorded here.'}
          </p>
        </div>

        <div className="p-5 rounded-3xl bg-[var(--surface-primary)] border border-[var(--border-primary)] shadow-md space-y-3">
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
