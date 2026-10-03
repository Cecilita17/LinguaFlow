import React from 'react';
import { Play, Square, Pause, AlertCircle, Languages, Loader2, Bookmark, RefreshCw, Sparkles } from 'lucide-react';
import { resolveChinesePinyin } from '../../services/chineseTokenNormalizer.js';
import { tokenizeAndGlossLineOffline } from '../../services/subtitleGlossService.js';
import { PUNCTUATION_REGEX } from '../../services/languageGlossStrategies.js';
import { getKoreanTransliteration } from '../../services/koreanTransliteration.js';
import { getArabicTransliteration } from '../../services/arabicTransliteration.js';
import { getTextDirection, isRtlLanguage } from '../../constants/languages.js';
import { isGlossComplete } from '../../services/subtitleGlossService.js';
import { SavedWordState } from '../../context/SavedWordsContext.jsx';
import { InterlinearGloss } from '../common/InterlinearGloss.jsx';
import { useAudioSettings } from '../../context/AudioSettingsContext.jsx';
import { useSiteLanguage } from '../../context/SiteLanguageContext.jsx';
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
  audioSyncAnchor = null,
  isAudioSyncAvailable = false,
  translation = null,
  isTranslating = false,
  isTranslationVisible = false,
  translationError = null,
  onPlay = null,
  onStop = null,
  onParagraphClick = null,
  onParagraphPress = null,
  onSaveReadingBookmark = null,
  isReadingBookmarkDisabled = false,
  isReadingBookmarked = false,
  onWordClick = null,
  onGloss = null,
  onGlossParagraph = null,
  onTranslate = null,
  onTranslateParagraph = null,
  onRetrySimplification = null,
  isRetryingSimplification = false,
  onCreateAudioSyncAnchor = null,
  onRemoveAudioSyncAnchor = null
}) {
  const { wordHighlightEnabled } = useAudioSettings();
  const { t, isSpanish } = useSiteLanguage();
  const { text, tokens: storedTokens } = paragraph;
  const isChinese = targetLang === 'zh';
  // Display-only preparation: pinyin is local and does not mark glosses complete.
  const tokens = React.useMemo(() => {
    if (!isChinese) return storedTokens || [];
    const baseTokens = Array.isArray(storedTokens) && storedTokens.length > 0
      ? storedTokens : tokenizeAndGlossLineOffline(text, targetLang, nativeLang);
    return baseTokens.map(token => {
      const pinyin = resolveChinesePinyin(token);
      return typeof token === 'string'
        ? { word: token, text: token, pinyin, auxiliary: pinyin }
        : { ...token, pinyin, auxiliary: pinyin };
    });
  }, [storedTokens, text, isChinese, targetLang, nativeLang]);
  const isRtl = isRtlLanguage(targetLang);
  const textDirection = getTextDirection(targetLang);
  const isComplete = hasGloss || isGlossComplete(paragraph, targetLang, nativeLang);
  const handleGloss = onGloss || onGlossParagraph;
  const handleTranslate = onTranslate || onTranslateParagraph;
  const [isSyncMenuOpen, setIsSyncMenuOpen] = React.useState(false);
  const longPressTimerRef = React.useRef(null);
  const suppressNextParagraphClickRef = React.useRef(false);

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

  const handleParagraphClick = () => {
    if (isSyncMenuOpen) {
      setIsSyncMenuOpen(false);
      return;
    }
    if (suppressNextParagraphClickRef.current) {
      suppressNextParagraphClickRef.current = false;
      return;
    }
    if (onParagraphPress) onParagraphPress(paragraph);
    if (onParagraphClick) onParagraphClick(paragraph);
  };

  const clearLongPress = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const handleParagraphPointerDown = (event) => {
    if (!isAudioSyncAvailable || event.button > 0 || event.target.closest('button')) return;
    clearLongPress();
    longPressTimerRef.current = setTimeout(() => {
      suppressNextParagraphClickRef.current = true;
      setIsSyncMenuOpen(true);
    }, 550);
  };

  React.useEffect(() => () => clearLongPress(), []);

  const tokenCharRanges = React.useMemo(() => {
    return computeTokenCharRanges(text, tokens, targetLang);
  }, [text, tokens, targetLang]);

  const activeTokenIndex = React.useMemo(() => {
    if (!isPlaying || activeAudioCharIndex < 0) return -1;
    return findActiveTokenIndex(activeAudioCharIndex, tokenCharRanges);
  }, [isPlaying, activeAudioCharIndex, tokenCharRanges]);


  let runningChunkPos = 0;

  const renderTranslateButton = () => {
    const button = (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        if (handleTranslate) {
          handleTranslate(paragraph);
        }
      }}
      disabled={isTranslating || isRetryingSimplification}
      aria-label={
        isTranslating
          ? (isSpanish ? 'Traduciendo párrafo...' : 'Translating paragraph...')
          : isTranslationVisible && translation
          ? (isSpanish ? 'Ocultar traducción del párrafo' : 'Hide paragraph translation')
          : (isSpanish ? 'Traducir párrafo completo' : 'Translate full paragraph')
      }
      title={
        isTranslating
          ? (isSpanish ? 'Traduciendo párrafo con IA...' : 'Translating paragraph with AI...')
          : isTranslationVisible && translation
          ? (isSpanish ? 'Ocultar traducción del párrafo' : 'Hide paragraph translation')
          : translation
          ? (isSpanish ? 'Mostrar traducción del párrafo' : 'Show paragraph translation')
          : (isSpanish ? 'Traducir este párrafo' : 'Translate this paragraph')
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
    if (!paragraph.simplificationLevel || !onRetrySimplification) return button;
    return (
      <span className="inline-flex flex-col items-center align-middle gap-1">
        {button}
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            if (!isRetryingSimplification) onRetrySimplification(paragraph);
          }}
          disabled={isRetryingSimplification || isTranslating || isGlossing}
          aria-label={t(isRetryingSimplification ? 'paragraph_simplification_loading' : 'paragraph_simplification_retry')}
          title={t(isRetryingSimplification ? 'paragraph_simplification_loading' : 'paragraph_simplification_retry')}
          className={`w-7 h-7 sm:w-7.5 sm:h-7.5 rounded-full inline-flex items-center justify-center border border-[var(--border-primary)] bg-[var(--surface-secondary)] text-amber-600 dark:text-amber-300 hover:bg-amber-500/15 transition-colors disabled:opacity-60 disabled:cursor-wait ${isRtl ? 'mr-1 sm:mr-1.5' : 'ml-1 sm:ml-1.5'}`}
        >
          {isRetryingSimplification ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
        </button>
      </span>
    );
  };

  const isMarked = !isPlaying && (isAudioBookmark || isLastAudioPosition);

  return (
    <div
      data-paragraph-id={paragraph.id}
      onClick={handleParagraphClick}
      onPointerDown={handleParagraphPointerDown}
      onPointerUp={clearLongPress}
      onPointerCancel={clearLongPress}
      onPointerLeave={clearLongPress}
      onContextMenu={(event) => {
        if (!isAudioSyncAvailable || event.target.closest('button')) return;
        event.preventDefault();
        suppressNextParagraphClickRef.current = true;
        setIsSyncMenuOpen(true);
      }}
      className={`group/para relative p-3.5 sm:p-5 rounded-2xl sm:rounded-3xl transition-all border select-text ${
        isPlaying
          ? 'bg-gradient-to-r from-rose-950/80 via-[#3a180e]/90 to-[#2c120a] border-rose-500/80 shadow-lg shadow-rose-950/40 ring-2 ring-rose-500/30 text-white'
          : isMarked
            ? `bg-[var(--surface-primary)] hover:bg-[var(--surface-hover)] border-rose-500/60 dark:border-rose-500/50 shadow-md shadow-rose-950/10 ring-1 ring-rose-500/30 text-[var(--text-primary)] ${isRtl ? 'border-r-4 border-r-rose-500' : 'border-l-4 border-l-rose-500'}`
            : 'bg-[var(--surface-primary)] hover:bg-[var(--surface-hover)] border-[var(--border-primary)] hover:border-rose-500/50 shadow-sm shadow-black/5 dark:shadow-black/20 text-[var(--text-primary)]'
      }`}
    >
      {audioSyncAnchor && (
        <div
          title={isSpanish ? 'Párrafo sincronizado manualmente' : 'Paragraph manually synchronized'}
          className={`absolute -top-2.5 ${isRtl ? 'right-4 sm:right-6' : 'left-4 sm:left-6'} z-10 h-5 w-5 rounded-full bg-emerald-500 text-white shadow-sm flex items-center justify-center pointer-events-none`}
        >
          <RefreshCw className="w-3 h-3" />
        </div>
      )}
      {isSyncMenuOpen && (
        <div
          className={`absolute z-30 top-3 ${isRtl ? 'left-3' : 'right-3'} rounded-xl border border-[var(--border-primary)] bg-[var(--surface-primary)] shadow-xl p-1.5 flex flex-col gap-1 text-xs`}
          onClick={(event) => event.stopPropagation()}
        >
          <button
            type="button"
            onClick={() => {
              if (onCreateAudioSyncAnchor) onCreateAudioSyncAnchor(paragraph);
              setIsSyncMenuOpen(false);
            }}
            className="px-2.5 py-1.5 rounded-lg text-left hover:bg-[var(--surface-hover)] text-[var(--text-primary)] font-medium cursor-pointer"
          >
            {audioSyncAnchor
              ? (isSpanish ? 'Actualizar sincronización' : 'Update sync')
              : (isSpanish ? 'Sincronizar aquí' : 'Synchronize here')}
          </button>
          {audioSyncAnchor && (
            <button
              type="button"
              onClick={() => {
                if (onRemoveAudioSyncAnchor) onRemoveAudioSyncAnchor(paragraph);
                setIsSyncMenuOpen(false);
              }}
              className="px-2.5 py-1.5 rounded-lg text-left hover:bg-rose-500/10 text-rose-600 dark:text-rose-300 font-medium cursor-pointer"
            >
              {isSpanish ? 'Eliminar sincronización' : 'Remove sync'}
            </button>
          )}
        </div>
      )}
      {/* Saved reading or playback position */}
      {isMarked && !isPlaying && (
        <div
          aria-label={isSpanish ? 'Marcador de posición guardado' : 'Saved position bookmark'}
          title={isSpanish ? 'Última posición guardada' : 'Last saved position'}
          className={`absolute -top-2.5 ${isRtl ? 'left-4 sm:left-6' : 'right-4 sm:right-6'} z-10 px-2.5 py-0.5 rounded-full bg-[var(--surface-primary)] border border-rose-500/50 shadow-sm flex items-center gap-1.5 text-[10px] font-medium text-rose-600 dark:text-rose-400 select-none pointer-events-none`}
        >
          <Bookmark className="w-2.5 h-2.5 text-rose-500 fill-rose-500 shrink-0" />
          <span>{isSpanish ? 'Marcador' : 'Bookmark'}</span>
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
              className={`flex flex-wrap ${isChinese ? 'items-start' : 'items-center'} ${
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
                const auxiliary = targetLang === 'ko' ? getKoreanTransliteration(word) : (isChinese || isArabic)
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
                      e.stopPropagation();
                      if (onParagraphClick) onParagraphClick(paragraph);
                      if (onWordClick) {
                        onWordClick(word, { word, auxiliary, gloss: cleanGloss, targetLang });
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
                    {(isChinese || isArabic || targetLang === 'ko') && auxiliary && (
                      <span className="text-[12px] sm:text-[13px] text-[var(--text-muted)] dark:text-stone-400 font-mono font-medium tracking-tight leading-none mb-0.5 select-text opacity-85 group-hover/token:opacity-100 group-hover/token:text-[var(--text-secondary)] transition-opacity">
                        {auxiliary}
                      </span>
                    )}

                    {/* Tier 2 (CENTER): Word (Arabic with tashkīl in RTL, Russian, Polish, Latin scripts in LTR) */}
                    <SavedWordState word={word} lang={targetLang}>
                      {(isSaved) => (
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
                      )}
                    </SavedWordState>

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

                return (
                  <SavedWordState key={cIdx} word={cleanWord} lang={targetLang}>
                    {(isSaved) => (
                    <span
                    onClick={(e) => {
                      e.stopPropagation();
                      if (onParagraphClick) onParagraphClick(paragraph);
                      if (onWordClick) {
                        onWordClick(cleanWord, { word: cleanWord, targetLang });
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
                    )}
                  </SavedWordState>
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
                    {isSpanish ? 'TRADUCCIÓN' : 'TRANSLATION'}
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
          {onSaveReadingBookmark && !isReadingBookmarkDisabled && (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onSaveReadingBookmark(paragraph);
              }}
              title={isSpanish ? 'Guardar posición (con la voz detenida)' : 'Save position (with speech stopped)'}
              aria-label={isSpanish ? 'Guardar posición en este párrafo' : 'Save position at this paragraph'}
              aria-pressed={isReadingBookmarked}
              className={`relative w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center transition-all shadow-xs active:scale-95 cursor-pointer ${
                isReadingBookmarked
                  ? 'bg-rose-500/20 border border-rose-500/70 text-rose-600 dark:text-rose-300 ring-1 ring-rose-500/30 hover:bg-rose-500/30'
                  : 'bg-[var(--surface-secondary)] hover:bg-[var(--surface-hover)] border border-[var(--border-primary)] text-rose-600 dark:text-rose-300 hover:text-rose-700 dark:hover:text-white group-hover/para:border-rose-500/60'
              }`}
            >
              <Bookmark className={`w-3.5 h-3.5 ${isReadingBookmarked ? 'fill-current' : ''}`} />
            </button>
          )}
          {/* Paragraph Audio Button (▶️ / ⏸️ / ⚠️) - Plays/pauses ONLY this paragraph */}
          <button
            type="button"
            disabled={isRetryingSimplification}
            onClick={handleAudioClick}
            aria-label={
              isAudioError
                ? (isSpanish ? 'Error de reproducción (clic para reintentar)' : 'Playback error (click to retry)')
                : isPlaying
                ? (isSpanish ? 'Pausar o detener reproducción de audio' : 'Pause or stop audio playback')
                : (isSpanish ? 'Reproducir párrafo' : 'Play paragraph')
            }
            title={
              isAudioError
                ? (isSpanish ? 'Error de TTS. Haz clic para reintentar.' : 'TTS error. Click to retry.')
                : isPlaying
                ? (isSpanish ? 'Pausar o detener audio' : 'Pause or stop audio')
                : (isSpanish ? 'Reproducir párrafo' : 'Play paragraph')
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
            disabled={isGlossing || isComplete || isRetryingSimplification}
            aria-label={isSpanish ? 'Glosar este párrafo' : 'Gloss this paragraph'}
            title={
              isGlossing
                ? (isSpanish ? 'Glosando este párrafo...' : 'Glossing this paragraph...')
                : isComplete
                ? (isSpanish ? 'Párrafo glosado' : 'Paragraph glossed')
                : (isSpanish ? 'Glosar este párrafo con IA' : 'Gloss this paragraph with AI')
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
  if (prevProps.onSaveReadingBookmark !== nextProps.onSaveReadingBookmark) return false;
  if (prevProps.isReadingBookmarked !== nextProps.isReadingBookmarked) return false;
  if (prevProps.isReadingBookmarkDisabled !== nextProps.isReadingBookmarkDisabled) return false;
  if (prevProps.onParagraphPress !== nextProps.onParagraphPress) return false;
  if (prevProps.audioSyncAnchor !== nextProps.audioSyncAnchor) return false;
  if (prevProps.isAudioSyncAvailable !== nextProps.isAudioSyncAvailable) return false;
  if (prevProps.translation !== nextProps.translation) return false;
  if (prevProps.isTranslating !== nextProps.isTranslating) return false;
  if (prevProps.isTranslationVisible !== nextProps.isTranslationVisible) return false;
  if (prevProps.translationError !== nextProps.translationError) return false;
  if (prevProps.onRetrySimplification !== nextProps.onRetrySimplification) return false;
  if (prevProps.isRetryingSimplification !== nextProps.isRetryingSimplification) return false;

  // Only check character index if this paragraph is actively playing audio
  if (nextProps.isPlaying && prevProps.activeAudioCharIndex !== nextProps.activeAudioCharIndex) {
    return false;
  }

  return true;
}

export const TextParagraphItem = React.memo(TextParagraphItemComponent, arePropsEqual);
export default TextParagraphItem;
