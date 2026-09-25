import React from 'react';
import { Play, Square, Pause, AlertCircle, Languages, Loader2, Bookmark } from 'lucide-react';
import { PUNCTUATION_REGEX } from '../../services/languageGlossStrategies.js';
import { getArabicTransliteration } from '../../services/arabicTransliteration.js';
import { getTextDirection, isRtlLanguage } from '../../constants/languages.js';
import { isGlossComplete } from '../../services/subtitleGlossService.js';
import { useSavedWords } from '../../context/SavedWordsContext.jsx';
import { InterlinearGloss } from '../common/InterlinearGloss.jsx';
import { useAudioSettings } from '../../context/AudioSettingsContext.jsx';
import { computeTokenCharRanges, findActiveTokenIndex } from '../../utils/audioWordSync.js';

/**
 * TextParagraphItem
 * Renders an independent paragraph with:
 * 1. Interlinear tokens (Chinese Pinyin above word, Arabic tashkeel without Latin transliteration, Polish/Russian words + gloss)
 * 2. Dedicated vertical actions column (shrink-0, aligned at top):
 *    - Audio button on top (▶️ / ⏸️ / ⚠️) - plays/pauses ONLY this paragraph
 *    - Gloss button below (🔤) - glosses ONLY this paragraph with AI
 * 3. Compact button dimensions (~w-8 h-8 / sm:w-9 sm:h-9) to maximize reading width
 * 4. Interactive word click for dictionary definition lookup and saved words yellow highlighting
 * 5. Authentic RTL support for Arabic, Hebrew, etc.
 */
function TextParagraphItemComponent({
  paragraph,
  targetLang = 'zh',
  fontSize = 'base',
  interlinearMode = true,
  nativeLang = 'es',
  isPlaying = false,
  activeAudioCharIndex = -1,
  isAudioError = false,
  isGlossing = false,
  hasGloss = false,
  isAudioBookmark = false,
  isLastAudioPosition = false,
  translation = null,
  isTranslating = false,
  isTranslationVisible = false,
  translationError = null,
  onPlay = null,
  onStop = null,
  onWordClick = null,
  onGloss = null,
  onGlossParagraph = null,
  onTranslate = null,
  onTranslateParagraph = null
}) {
  const { isWordSaved } = useSavedWords();
  const { wordHighlightEnabled } = useAudioSettings();
  const { text, tokens = [] } = paragraph;
  const isChinese = targetLang === 'zh';
  const isRtl = isRtlLanguage(targetLang);
  const textDirection = getTextDirection(targetLang);
  const isComplete = hasGloss || isGlossComplete(paragraph, targetLang, nativeLang);
  const handleGloss = onGloss || onGlossParagraph;
  const handleTranslate = onTranslate || onTranslateParagraph;

  // Responsive font size classes
  const fontClassMap = {
    sm: 'text-xs sm:text-sm leading-relaxed',
    base: 'text-sm sm:text-base leading-relaxed',
    lg: 'text-base sm:text-lg leading-relaxed',
    xl: 'text-lg sm:text-xl leading-relaxed',
    '2xl': 'text-xl sm:text-2xl leading-relaxed'
  };
  const fontClass = fontClassMap[fontSize] || fontClassMap.base;

  const handleAudioClick = (e) => {
    e.stopPropagation();
    if (isPlaying) {
      if (onStop) onStop();
    } else {
      if (onPlay) onPlay(paragraph);
    }
  };

  const tokenCharRanges = React.useMemo(() => {
    return computeTokenCharRanges(text, tokens, targetLang);
  }, [text, tokens, targetLang]);

  const activeTokenIndex = React.useMemo(() => {
    if (!isPlaying || activeAudioCharIndex < 0) return -1;
    return findActiveTokenIndex(activeAudioCharIndex, tokenCharRanges);
  }, [isPlaying, activeAudioCharIndex, tokenCharRanges]);


  let runningChunkPos = 0;

  const renderTranslateButton = () => (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        if (handleTranslate) {
          handleTranslate(paragraph);
        }
      }}
      disabled={isTranslating}
      aria-label={
        isTranslating
          ? 'Traduciendo párrafo...'
          : isTranslationVisible && translation
          ? 'Ocultar traducción del párrafo'
          : 'Traducir párrafo completo'
      }
      title={
        isTranslating
          ? 'Traduciendo párrafo con IA...'
          : isTranslationVisible && translation
          ? 'Ocultar traducción del párrafo'
          : translation
          ? 'Mostrar traducción del párrafo'
          : 'Traducir este párrafo'
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

  const isMarked = isAudioBookmark || isLastAudioPosition;

  return (
    <div
      data-paragraph-id={paragraph.id}
      className={`group/para relative p-3.5 sm:p-5 rounded-2xl sm:rounded-3xl transition-all border select-text ${
        isPlaying
          ? 'bg-gradient-to-r from-rose-950/80 via-[#3a180e]/90 to-[#2c120a] border-rose-500/80 shadow-lg shadow-rose-950/40 ring-2 ring-rose-500/30 text-white'
          : isMarked
            ? `bg-[var(--surface-primary)] hover:bg-[var(--surface-hover)] border-rose-500/60 dark:border-rose-500/50 shadow-md shadow-rose-950/10 ring-1 ring-rose-500/30 text-[var(--text-primary)] ${isRtl ? 'border-r-4 border-r-rose-500' : 'border-l-4 border-l-rose-500'}`
            : 'bg-[var(--surface-primary)] hover:bg-[var(--surface-hover)] border-[var(--border-primary)] hover:border-rose-500/50 shadow-sm shadow-black/5 dark:shadow-black/20 text-[var(--text-primary)]'
      }`}
    >
      {/* MANUAL AUDIO BOOKMARK — Discreet, clearly visible manual bookmark accent */}
      {isMarked && !isPlaying && (
        <div
          aria-label="Marcador de posición guardado"
          title="Posición guardada manualmente"
          className={`absolute -top-2.5 ${isRtl ? 'left-4 sm:left-6' : 'right-4 sm:right-6'} z-10 px-2.5 py-0.5 rounded-full bg-[var(--surface-primary)] border border-rose-500/50 shadow-sm flex items-center gap-1.5 text-[10px] font-medium text-rose-600 dark:text-rose-400 select-none pointer-events-none`}
        >
          <Bookmark className="w-2.5 h-2.5 text-rose-500 fill-rose-500 shrink-0" />
          <span>Marcador</span>
        </div>
      )}
      <div
        className="flex items-start justify-between gap-2.5 sm:gap-3.5 w-full"
        dir={textDirection}
      >
        {/* TEXT CONTENT / INTERLINEAR TOKENS */}
        <div className="flex-1 min-w-0" dir={textDirection}>
          {Array.isArray(tokens) && tokens.length > 0 ? (
            <div
              dir={textDirection}
              style={{ direction: textDirection }}
              className={`flex flex-wrap items-center ${
                isChinese
                  ? 'gap-x-1 sm:gap-x-1.5 gap-y-3 sm:gap-y-3.5'
                  : 'gap-x-1.5 sm:gap-x-2 gap-y-2.5 sm:gap-y-3'
              } leading-tight break-words max-w-full ${
                isRtl ? 'justify-start text-right' : 'justify-start text-left'
              }`}
            >
              {tokens.map((tokenObj, idx) => {
                const isArabic = targetLang === 'ar';
                const word = typeof tokenObj === 'string' ? tokenObj : (tokenObj.word || tokenObj.text);
                const isPunctuation = typeof tokenObj === 'object'
                  ? tokenObj.isPunctuation
                  : PUNCTUATION_REGEX.test(word);
                const auxiliary = (isChinese || isArabic)
                  ? (tokenObj.auxiliary || tokenObj.translit || tokenObj.pinyin || (isArabic && word && !isPunctuation ? getArabicTransliteration(word) : null))
                  : null;
                const rawGloss = typeof tokenObj === 'object' ? tokenObj.gloss : null;

                // Never display auxiliary as gloss unless it is a genuine translation (e.g. 的 -> de)
                const isLegitSameAux = word === '的' && rawGloss?.toLowerCase() === 'de';
                const cleanGloss = (rawGloss && (rawGloss !== auxiliary || isLegitSameAux))
                  ? rawGloss
                  : null;

                if (isPunctuation) {
                  return (
                    <span
                      key={idx}
                      dir={textDirection}
                      className={`text-[var(--text-muted)] font-medium ${
                        isChinese ? 'px-0 text-sm sm:text-base -ml-0.5 mt-3 sm:mt-3.5' : 'px-0.5 text-base sm:text-lg mt-0.5 sm:mt-1'
                      } select-text self-start isolate [unicode-bidi:isolate]`}
                    >
                      {word}
                    </span>
                  );
                }

                const isAudioActive = wordHighlightEnabled && isPlaying && activeTokenIndex === idx;

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
                    className={`inline-flex flex-col items-center justify-start transition-colors cursor-pointer group/token max-w-full isolate [unicode-bidi:isolate] ${
                      isChinese
                        ? 'px-0.5 sm:px-1 py-0.5 rounded-md hover:bg-black/5 dark:hover:bg-white/10 active:bg-rose-500/15'
                        : 'px-1 sm:px-1.5 py-0.5 rounded-xl hover:bg-black/5 dark:hover:bg-white/10 active:bg-rose-500/20'
                    }`}
                    title={cleanGloss ? `"${word}": ${cleanGloss}` : word}
                  >
                    {/* Tier 1 (TOP): Pinyin for Chinese / Transliteration for Arabic */}
                    {(isChinese || isArabic) && auxiliary && (
                      <span className="text-[12px] sm:text-[13px] text-[var(--text-muted)] dark:text-stone-400 font-mono font-medium tracking-tight leading-none mb-0.5 select-text opacity-85 group-hover/token:opacity-100 group-hover/token:text-[var(--text-secondary)] transition-opacity">
                        {auxiliary}
                      </span>
                    )}

                    {/* Tier 2 (CENTER): Word (Arabic with tashkīl in RTL, Russian, Polish, Latin scripts in LTR) */}
                    {(() => {
                      const isSaved = !isPunctuation && isWordSaved(word, targetLang);
                      return (
                        <span
                          dir={textDirection}
                          className={`${
                            isChinese ? 'font-medium tracking-normal' : 'font-semibold tracking-wide'
                          } select-text leading-tight ${
                            isSaved
                              ? 'bg-amber-300 text-stone-950 dark:bg-amber-400 dark:text-stone-950 rounded px-1 font-bold shadow-xs ring-1 ring-amber-400/60'
                              : isPlaying
                              ? 'text-white font-bold drop-shadow-xs'
                              : 'text-[var(--text-primary)]'
                          } ${isAudioActive ? 'audio-word-active' : ''} ${fontClass}`}
                        >
                          {word}
                        </span>
                      );
                    })()}

                    {/* Tier 3 (BOTTOM): Gloss in student's native language (Only shown when interlinearMode is enabled) */}
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
          ) : (
            /* Fallback paragraph text when tokens have not been parsed yet */
            <p
              dir={textDirection}
              style={{ direction: textDirection }}
              className={`${fontClass} ${isRtl ? 'text-right' : 'text-left'} select-text ${
                isPlaying
                  ? 'text-white font-semibold drop-shadow-xs'
                  : 'text-[var(--text-primary)]'
              }`}
            >
              {text.split(/([\s.,!?;:()¿¡'"“”‘’—–\-_/\\`~，。！？；：、“”‘’（）《》…]+)/).map((chunk, cIdx) => {
                if (!chunk) return null;
                const isPunctuationOrSpace = /^[\s.,!?;:()¿¡'"“”‘’—–\-_/\\`~，。！？；：、“”‘’（）《》…]+$/.test(chunk);
                const cleanWord = chunk.trim();
                const chunkStart = runningChunkPos;
                const chunkEnd = runningChunkPos + chunk.length;
                runningChunkPos = chunkEnd;
                const isAudioActive = wordHighlightEnabled && isPlaying && activeAudioCharIndex >= 0 && chunkStart <= activeAudioCharIndex && activeAudioCharIndex < chunkEnd;

                if (isPunctuationOrSpace || !cleanWord) {
                  return (
                    <span key={cIdx} className={isAudioActive ? 'audio-word-active' : ''}>
                      {chunk}
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
                    className={`cursor-pointer transition-colors rounded px-0.5 hover:bg-black/5 dark:hover:bg-white/10 active:bg-rose-500/20 ${
                      isSaved
                        ? 'bg-amber-300 text-stone-950 dark:bg-amber-400 dark:text-stone-950 font-bold shadow-xs ring-1 ring-amber-400/60'
                        : isPlaying
                        ? 'text-white font-semibold drop-shadow-xs'
                        : 'text-[var(--text-primary)] hover:text-rose-600 dark:hover:text-rose-400'
                    } ${isAudioActive ? 'audio-word-active' : ''}`}
                    title={isSaved ? `Palabra guardada: "${cleanWord}"` : `Consultar "${cleanWord}"`}
                  >
                    {chunk}
                  </span>
                );
              })}
              {/* Inline Paragraph Translation Icon (At end of text flow) */}
              {renderTranslateButton()}
            </p>
          )}

          {/* PARAGRAPH TRANSLATION DISPLAY (Below paragraph content) */}
          {isTranslationVisible && (
            <div
              dir={isRtlLanguage(nativeLang) ? 'rtl' : 'ltr'}
              className="mt-3 pt-2.5 pb-0.5 border-t border-[var(--border-subtle)] text-xs sm:text-sm select-text transition-all"
            >
              {isTranslating ? (
                <div className="flex items-center gap-2 text-violet-600 dark:text-violet-400 py-1">
                  <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
                  <span className="text-xs font-medium italic">Traduciendo párrafo completo...</span>
                </div>
              ) : translationError ? (
                <div className="flex items-center justify-between gap-2 p-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-200 text-xs">
                  <span className="italic">{translationError}</span>
                  {handleTranslate && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleTranslate(paragraph);
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

        {/* VERTICAL ACTIONS COLUMN: Audio on top, Gloss below. Compact (w-8 h-8 / sm:w-9 sm:h-9) */}
        <div
          dir="ltr"
          className="shrink-0 flex flex-col items-center gap-1.5 self-start pt-0.5"
        >
          {/* Paragraph Audio Button (▶️ / ⏸️ / ⚠️) - Plays/pauses ONLY this paragraph */}
          <button
            type="button"
            onClick={handleAudioClick}
            aria-label={
              isAudioError
                ? 'Error de reproducción (clic para reintentar)'
                : isPlaying
                ? 'Pausar o detener reproducción de audio'
                : 'Reproducir párrafo'
            }
            title={
              isAudioError
                ? 'Error de TTS. Haz clic para reintentar.'
                : isPlaying
                ? 'Pausar o detener audio'
                : 'Reproducir párrafo'
            }
            className={`relative w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center transition-all shadow-xs active:scale-95 cursor-pointer ${
              isAudioError
                ? 'bg-amber-900/80 border border-amber-500/80 text-amber-200 hover:bg-amber-800'
                : isPlaying
                ? 'bg-gradient-to-tr from-pink-600 to-rose-600 text-white border border-rose-400/90 shadow-rose-900/60 ring-2 ring-rose-400/40'
                : 'bg-[var(--surface-secondary)] hover:bg-[var(--surface-hover)] border border-[var(--border-primary)] text-rose-600 dark:text-rose-300 hover:text-rose-700 dark:hover:text-white group-hover/para:border-rose-500/60'
            }`}
          >
            {isAudioError ? (
              <AlertCircle className="w-4 h-4 text-amber-300" />
            ) : isPlaying ? (
              <>
                <span className="absolute -inset-1 rounded-xl border-2 border-rose-400/60 animate-ping pointer-events-none" />
                <Pause className="w-3.5 h-3.5 fill-white" />
              </>
            ) : (
              <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
            )}
          </button>

          {/* Paragraph Gloss Button (🔤) - Glosses ONLY this paragraph */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (!isComplete && !isGlossing && handleGloss) {
                handleGloss(paragraph);
              }
            }}
            disabled={isGlossing || isComplete}
            aria-label="Glosar este párrafo"
            title={
              isGlossing
                ? 'Glosando este párrafo...'
                : isComplete
                ? 'Párrafo glosado'
                : 'Glosar este párrafo con IA'
            }
            className={`relative w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center transition-all shadow-xs active:scale-95 cursor-pointer ${
              isGlossing
                ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/50 cursor-wait'
                : isComplete
                ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/40 cursor-default'
                : 'bg-[var(--surface-secondary)] hover:bg-[var(--surface-hover)] border border-[var(--border-primary)] hover:border-rose-500/60 text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            {isGlossing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Languages className={`w-4 h-4 ${isComplete ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500 dark:text-rose-400'}`} />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

function arePropsEqual(prevProps, nextProps) {
  if (prevProps.paragraph !== nextProps.paragraph) return false;
  if (prevProps.targetLang !== nextProps.targetLang) return false;
  if (prevProps.fontSize !== nextProps.fontSize) return false;
  if (prevProps.interlinearMode !== nextProps.interlinearMode) return false;
  if (prevProps.nativeLang !== nextProps.nativeLang) return false;
  if (prevProps.isPlaying !== nextProps.isPlaying) return false;
  if (prevProps.isAudioError !== nextProps.isAudioError) return false;
  if (prevProps.isGlossing !== nextProps.isGlossing) return false;
  if (prevProps.hasGloss !== nextProps.hasGloss) return false;
  if (prevProps.isAudioBookmark !== nextProps.isAudioBookmark) return false;
  if (prevProps.isLastAudioPosition !== nextProps.isLastAudioPosition) return false;
  if (prevProps.translation !== nextProps.translation) return false;
  if (prevProps.isTranslating !== nextProps.isTranslating) return false;
  if (prevProps.isTranslationVisible !== nextProps.isTranslationVisible) return false;
  if (prevProps.translationError !== nextProps.translationError) return false;

  // Only check character index if this paragraph is actively playing audio
  if (nextProps.isPlaying && prevProps.activeAudioCharIndex !== nextProps.activeAudioCharIndex) {
    return false;
  }

  return true;
}

export const TextParagraphItem = React.memo(TextParagraphItemComponent, arePropsEqual);
export default TextParagraphItem;
