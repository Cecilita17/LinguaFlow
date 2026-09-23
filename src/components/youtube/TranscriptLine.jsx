import React from 'react';
import { Volume2, Languages, Loader2 } from 'lucide-react';
import { getLanguageGlossStrategy, PUNCTUATION_REGEX } from '../../services/languageGlossStrategies.js';
import { getArabicTransliteration } from '../../services/arabicTransliteration.js';
import { isGlossComplete } from '../../services/subtitleGlossService.js';
import { getTextDirection, isRtlLanguage } from '../../constants/languages.js';
import { useSavedWords } from '../../context/SavedWordsContext.jsx';
import { useAudioSettings } from '../../context/AudioSettingsContext.jsx';
import { InterlinearGloss } from '../common/InterlinearGloss.jsx';
import { calculateActiveTokenIndexFromTime, calculateActiveChunkIndexFromTime } from '../../utils/audioWordSync.js';

export function TranscriptLine({
  line,
  isActive = false,
  currentTime = 0,
  onSeek,
  onGloss = null,
  onGlossLine = null,
  isGlossing = false,
  isGlossingThisLine = false,
  hasGloss = false,
  translation = null,
  isTranslating = false,
  isTranslationVisible = false,
  translationError = null,
  onTranslate = null,
  onTranslateLine = null,
  fontSize = 'base',
  showTimestamps = true,
  searchQuery = '',
  interlinearMode = true,
  targetLang = 'zh',
  nativeLang = 'es',
  onWordClick = null
}) {
  const { isWordSaved } = useSavedWords();
  const { wordHighlightEnabled } = useAudioSettings();
  if (!line || typeof line !== 'object') return null;
  const startTime = typeof line.startTime === 'number' && !isNaN(line.startTime) ? line.startTime : 0;
  const rawText = typeof line.text === 'string' ? line.text : (line.text != null ? String(line.text) : '');
  const text = rawText;
  const tokens = Array.isArray(line.tokens) ? line.tokens : [];
  const isArabic = targetLang === 'ar' || /[\u0600-\u06FF]/.test(rawText || '');
  const isRtl = isRtlLanguage(targetLang) || isArabic;
  const textDirection = isRtl ? 'rtl' : 'ltr';
  const isComplete = hasGloss || isGlossComplete(line, targetLang, nativeLang);
  const handleGloss = onGloss || onGlossLine;
  const handleTranslate = onTranslate || onTranslateLine;
  const glossing = isGlossing || isGlossingThisLine;

  const activeTokenIndex = React.useMemo(() => {
    if (!isActive) return -1;
    return calculateActiveTokenIndexFromTime(tokens, currentTime, line.startTime, line.endTime);
  }, [isActive, tokens, currentTime, line.startTime, line.endTime]);

  const activeChunkIndex = React.useMemo(() => {
    if (!isActive) return -1;
    return calculateActiveChunkIndexFromTime(text, currentTime, line.startTime, line.endTime);
  }, [isActive, text, currentTime, line.startTime, line.endTime]);

  // Font size classes
  const fontClassMap = {
    sm: 'text-xs sm:text-sm leading-relaxed',
    base: 'text-sm sm:text-base leading-relaxed',
    lg: 'text-base sm:text-lg leading-relaxed',
    xl: 'text-lg sm:text-xl leading-relaxed',
    '2xl': 'text-xl sm:text-2xl leading-relaxed'
  };
  const fontClass = fontClassMap[fontSize] || fontClassMap.base;

  // Search highlighting helper
  const renderHighlightedText = (content) => {
    const str = content != null ? String(content) : '';
    if (!searchQuery || !searchQuery.trim() || !str) return str;
    try {
      const query = searchQuery.trim();
      const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
      const parts = str.split(regex);

      return parts.map((part, i) =>
        regex.test(part) ? (
          <mark key={i} className="bg-amber-400 text-stone-900 font-bold px-0.5 rounded">
            {part}
          </mark>
        ) : (
          part
        )
      );
    } catch {
      return str;
    }
  };

  const handleLineClick = () => {
    if (onSeek && typeof startTime === 'number') {
      onSeek(startTime);
    }
  };

  const renderTranslateButton = () => (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        if (handleTranslate) {
          handleTranslate(line);
        }
      }}
      disabled={isTranslating}
      aria-label={
        isTranslating
          ? 'Traduciendo línea...'
          : isTranslationVisible && translation
          ? 'Ocultar traducción de la línea'
          : 'Traducir línea completa'
      }
      title={
        isTranslating
          ? 'Traduciendo línea con IA...'
          : isTranslationVisible && translation
          ? 'Ocultar traducción de la línea'
          : translation
          ? 'Mostrar traducción de la línea'
          : 'Traducir esta línea'
      }
      className={`inline-flex items-center justify-center align-middle w-7 h-7 sm:w-7.5 sm:h-7.5 rounded-lg transition-all cursor-pointer select-none active:scale-90 self-center ${
        isRtl ? 'mr-1 sm:mr-1.5' : 'ml-1 sm:ml-1.5'
      } ${
        isTranslating
          ? 'bg-violet-500/15 text-violet-600 dark:text-violet-400 cursor-wait'
          : isTranslationVisible && translation
          ? 'bg-violet-500/20 text-violet-700 dark:text-violet-300 ring-1 ring-violet-500/30'
          : translation
          ? 'bg-violet-500/10 text-violet-600 dark:text-violet-400 hover:bg-violet-500/20'
          : 'text-[var(--text-muted)] hover:text-violet-600 dark:hover:text-violet-400 hover:bg-violet-500/10'
      }`}
    >
      {isTranslating ? (
        <Loader2 className="w-3.5 h-3.5 animate-spin text-violet-600 dark:text-violet-400" />
      ) : (
        <span className="font-bold text-[11px] sm:text-[12px] tracking-tight leading-none">
          A文
        </span>
      )}
    </button>
  );

  return (
    <div
      onClick={handleLineClick}
      className={`group/line relative p-3 sm:p-3.5 rounded-2xl transition-all cursor-pointer border flex items-start gap-3 select-text ${
        isActive
          ? 'bg-gradient-to-r from-rose-950/90 via-[#3d1a10] to-[#2e130b] border-rose-500/80 shadow-md shadow-rose-950/40 ring-2 ring-rose-500/30'
          : 'bg-[var(--surface-primary)] hover:bg-[var(--surface-hover)] border-[var(--border-primary)] shadow-xs text-[var(--text-primary)]'
      }`}
    >
      {/* Per-Paragraph Actions: 🎧 Audio (top) + 🔤 Glosar (bottom) */}
      <div className="flex flex-col items-center gap-1 shrink-0 pt-0.5" onClick={(e) => e.stopPropagation()}>
        {/* 🎧 Audio Action: Plays/seeks this line in the video */}
        <button
          type="button"
          onClick={handleLineClick}
          title="Reproducir audio de este párrafo"
          className={`p-1.5 rounded-lg transition-all flex items-center justify-center cursor-pointer active:scale-95 ${
            isActive
              ? 'bg-rose-600 text-white shadow-xs'
              : 'bg-[var(--surface-secondary)] text-rose-600 dark:text-rose-300 hover:text-rose-700 dark:hover:text-white hover:bg-[var(--surface-hover)] border border-[var(--border-primary)]'
          }`}
        >
          <Volume2 className="w-3.5 h-3.5" />
        </button>

        {/* 🔤 Gloss Action: Glosses ONLY this line/paragraph */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            if (!isComplete && !glossing && handleGloss) {
              handleGloss(line);
            }
          }}
          disabled={glossing || isComplete}
          title={
            glossing
              ? 'Glosando este párrafo...'
              : isComplete
              ? 'Párrafo glosado'
              : 'Glosar este párrafo con IA'
          }
          className={`p-1.5 rounded-lg transition-all flex items-center justify-center cursor-pointer active:scale-95 ${
            glossing
              ? 'bg-amber-950/80 text-amber-300 border border-amber-500/60 cursor-wait'
              : isComplete
              ? 'bg-emerald-950/50 text-emerald-400 border border-emerald-600/50 cursor-default'
              : 'bg-[var(--surface-secondary)] text-rose-600 dark:text-rose-300 hover:text-rose-700 dark:hover:text-white hover:bg-[var(--surface-hover)] border border-[var(--border-primary)]'
          }`}
        >
          {glossing ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Languages className={`w-3.5 h-3.5 ${isComplete ? 'text-emerald-400' : 'text-rose-400'}`} />
          )}
        </button>
      </div>

      {/* Main Text Content */}
      <div className="flex-1 min-w-0" dir={textDirection}>
        {Array.isArray(tokens) && tokens.length > 0 ? (
          (() => {
            const isChinese = targetLang === 'zh';

            return (
              <div
                dir={textDirection}
                style={{ direction: textDirection }}
                className={`flex flex-wrap items-center ${
                  isChinese
                    ? 'gap-x-1 sm:gap-x-1.5 gap-y-3'
                    : 'gap-x-1.5 sm:gap-x-2.5 gap-y-2.5'
                } leading-tight break-words max-w-full ${
                  isRtl ? 'justify-start text-right' : 'justify-start text-left'
                }`}
              >
                {tokens.map((tokenObj, idx) => {
                  if (!tokenObj) return null;
                  const rawWord = typeof tokenObj === 'string'
                    ? tokenObj
                    : (tokenObj && typeof tokenObj === 'object' ? (tokenObj.word ?? tokenObj.text) : '');
                  const word = rawWord != null ? String(rawWord) : '';
                  if (!word) return null;

                  const rawAux = (isChinese || isArabic) && tokenObj && typeof tokenObj === 'object'
                    ? (tokenObj.auxiliary ?? tokenObj.translit ?? tokenObj.pinyin ?? (isArabic ? getArabicTransliteration(word) : null))
                    : (isArabic ? getArabicTransliteration(word) : null);
                  const auxiliary = rawAux != null ? String(rawAux).trim() : null;

                  const rawGlossVal = tokenObj && typeof tokenObj === 'object'
                    ? tokenObj.gloss
                    : null;
                  const rawGloss = rawGlossVal != null ? String(rawGlossVal).trim() : null;
                  const rawGlossLower = rawGloss ? rawGloss.toLowerCase() : null;

                  const isPunctuation = tokenObj && typeof tokenObj === 'object' && typeof tokenObj.isPunctuation === 'boolean'
                    ? tokenObj.isPunctuation
                    : PUNCTUATION_REGEX.test(word);

                  // Never display auxiliary as gloss unless it is a genuine translation (e.g. 的 -> de)
                  const isLegitSameAux = word === '的' && rawGlossLower === 'de';
                  const cleanGloss = (rawGloss && (rawGloss !== auxiliary || isLegitSameAux)) ? rawGloss : null;

                  if (isPunctuation) {
                    return (
                      <span
                        key={idx}
                        dir={textDirection}
                        className={`text-stone-400 font-medium ${
                          isChinese ? 'px-0 text-sm sm:text-base -ml-0.5 mt-3 sm:mt-3.5' : 'px-0.5 text-base sm:text-lg mt-0.5 sm:mt-1'
                        } select-text self-start isolate [unicode-bidi:isolate]`}
                      >
                        {word}
                      </span>
                    );
                  }

                  return (
                    <div
                      key={idx}
                      dir={textDirection}
                      onClick={(e) => {
                        if (onWordClick) {
                          e.stopPropagation();
                          onWordClick(word, { word, auxiliary, gloss: cleanGloss });
                        }
                      }}
                      role={onWordClick ? 'button' : undefined}
                      tabIndex={onWordClick ? 0 : undefined}
                      className={`inline-flex flex-col items-center justify-start rounded-md hover:bg-white/10 transition-colors group/token max-w-full isolate [unicode-bidi:isolate] cursor-pointer ${
                        isChinese ? 'px-0.5 sm:px-1 py-0.5' : 'px-1 py-0.5'
                      }`}
                    >
                      {/* Tier 1 (TOP): Pinyin for Chinese / Transliteration for Arabic */}
                      {(isChinese || isArabic) && auxiliary && (
                        <span dir="ltr" className="text-[12px] sm:text-[13px] text-[var(--text-muted)] dark:text-stone-400 font-mono font-medium tracking-tight leading-none mb-0.5 select-text opacity-85 group-hover/token:opacity-100 group-hover/token:text-[var(--text-secondary)] transition-opacity">
                          {auxiliary}
                        </span>
                      )}

                      {/* Tier 2 (CENTER): Word (Arabic with diacritics/tashkeel in RTL, Russian/Polish/Latin scripts in LTR) */}
                      {(() => {
                        const isSaved = !isPunctuation && isWordSaved(word, targetLang);
                        const isAudioActive = wordHighlightEnabled && isActive && activeTokenIndex === idx;
                        return (
                          <span
                            dir={textDirection}
                            className={`${
                              isChinese ? 'font-medium tracking-normal' : isArabic ? 'font-semibold tracking-wide font-arabic' : 'font-semibold tracking-wide'
                            } select-text leading-tight ${
                              isSaved
                                ? 'bg-amber-300 text-stone-950 dark:bg-amber-400 dark:text-stone-950 rounded px-1 font-bold shadow-xs ring-1 ring-amber-400/60'
                                : isActive
                                ? 'text-white font-bold drop-shadow-xs'
                                : 'text-[var(--text-primary)]'
                            } ${isAudioActive ? 'audio-word-active' : ''} ${fontClass}`}
                          >
                            {renderHighlightedText(word)}
                          </span>
                        );
                      })()}

                      {/* Tier 3 (BOTTOM): Gloss in student's native language (Only shown when interlinearMode is true) */}
                      {interlinearMode && cleanGloss && (
                        <InterlinearGloss
                          gloss={cleanGloss}
                          isChinese={isChinese}
                          nativeLang={nativeLang}
                        />
                      )}
                    </div>
                  );
                })}
                {/* Inline Paragraph Translation Icon (At end of tokens flow) */}
                {renderTranslateButton()}
              </div>
            );
          })()
        ) : (
          /* Normal Subtitle View Mode (Traditional Subtitles) */
          <p
            dir={textDirection}
            style={{ direction: textDirection }}
            className={`${fontClass} ${isRtl ? 'text-right' : 'text-left'} ${
              isActive
                ? 'text-white font-semibold drop-shadow-xs'
                : 'text-[var(--text-primary)]'
            }`}
          >
            {text.split(/([\s.,!?;:()¿¡'"“”‘’—–\-_/\\`~，。！？；：、“”‘’（）《》…]+)/).map((chunk, cIdx) => {
              if (!chunk) return null;
              const isPunctuationOrSpace = /^[\s.,!?;:()¿¡'"“”‘’—–\-_/\\`~，。！？；：、“”‘’（）《》…]+$/.test(chunk);
              const cleanWord = chunk.trim();
              const isAudioActive = wordHighlightEnabled && isActive && activeChunkIndex === cIdx;

              if (isPunctuationOrSpace || !cleanWord) {
                return (
                  <span key={cIdx} className={isAudioActive ? 'audio-word-active' : ''}>
                    {renderHighlightedText(chunk)}
                  </span>
                );
              }

              const isSaved = isWordSaved(cleanWord, targetLang);

              return (
                <span
                  key={cIdx}
                  onClick={(e) => {
                    if (onWordClick) {
                      e.stopPropagation();
                      onWordClick(cleanWord, { word: cleanWord });
                    }
                  }}
                  role={onWordClick ? 'button' : undefined}
                  tabIndex={onWordClick ? 0 : undefined}
                  className={`cursor-pointer transition-colors rounded px-0.5 hover:bg-white/10 active:bg-rose-500/20 ${
                    isSaved
                      ? 'bg-amber-300 text-stone-950 dark:bg-amber-400 dark:text-stone-950 rounded px-1 font-bold shadow-xs ring-1 ring-amber-400/60'
                      : isActive
                      ? 'text-white font-bold drop-shadow-xs'
                      : 'text-[var(--text-primary)] hover:text-rose-600 dark:hover:text-rose-400'
                  } ${isAudioActive ? 'audio-word-active' : ''}`}
                  title={isSaved ? `Palabra guardada: "${cleanWord}"` : `Consultar "${cleanWord}"`}
                >
                  {renderHighlightedText(chunk)}
                </span>
              );
            })}
            {/* Inline Paragraph Translation Icon (At end of text flow) */}
            {renderTranslateButton()}
          </p>
        )}

        {/* FULL LINE TRANSLATION DISPLAY (Below subtitle content) */}
        {isTranslationVisible && (
          <div
            dir={isRtlLanguage(nativeLang) ? 'rtl' : 'ltr'}
            className="mt-2.5 pt-2 pb-0.5 border-t border-[var(--border-subtle)] text-xs sm:text-sm select-text transition-all"
          >
            {isTranslating ? (
              <div className="flex items-center gap-2 text-violet-600 dark:text-violet-400 py-1">
                <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
                <span className="text-xs font-medium italic">Traduciendo línea completa...</span>
              </div>
            ) : translationError ? (
              <div className="flex items-center justify-between gap-2 p-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-200 text-xs">
                <span className="italic">{translationError}</span>
                {handleTranslate && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleTranslate(line);
                    }}
                    className="shrink-0 px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-900 dark:text-amber-100 font-semibold cursor-pointer active:scale-95 transition-all text-[11px]"
                  >
                    Reintentar
                  </button>
                )}
              </div>
            ) : translation ? (
              <div className="flex items-start gap-2.5 leading-relaxed">
                <span className="not-italic text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-violet-500/15 text-violet-700 dark:text-violet-300 shrink-0 border border-violet-500/30 select-none mt-0.5">
                  TRADUCCIÓN
                </span>
                <span className="flex-1 select-text text-[var(--text-primary)] dark:text-stone-200 italic">
                  {translation}
                </span>
              </div>
            ) : null}
          </div>
        )}
      </div>

      {/* Active Line indicator pulse */}
      {isActive && (
        <span className="w-2 h-2 rounded-full bg-rose-400 animate-ping flex-shrink-0 mt-2" />
      )}
    </div>
  );
}

export default TranscriptLine;
