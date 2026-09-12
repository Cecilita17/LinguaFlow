import React from 'react';
import { Play, Square, Pause, AlertCircle, Languages, Loader2, Headphones } from 'lucide-react';
import { PUNCTUATION_REGEX } from '../../services/languageGlossStrategies.js';
import { getTextDirection, isRtlLanguage } from '../../constants/languages.js';
import { isGlossComplete } from '../../services/subtitleGlossService.js';
import { useSavedWords } from '../../context/SavedWordsContext.jsx';

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
export function TextParagraphItem({
  paragraph,
  targetLang = 'zh',
  fontSize = 'base',
  interlinearMode = true,
  isPlaying = false,
  isAudioError = false,
  isGlossing = false,
  hasGloss = false,
  isLastAudioPosition = false,
  onPlay = null,
  onStop = null,
  onWordClick = null,
  onGloss = null,
  onGlossParagraph = null
}) {
  const { isWordSaved } = useSavedWords();
  const { text, tokens = [] } = paragraph;
  const isChinese = targetLang === 'zh';
  const isRtl = isRtlLanguage(targetLang);
  const textDirection = getTextDirection(targetLang);
  const isComplete = hasGloss || isGlossComplete(paragraph, targetLang);
  const handleGloss = onGloss || onGlossParagraph;

  // Responsive font size classes
  const fontClassMap = {
    sm: 'text-xs sm:text-sm leading-relaxed',
    base: 'text-sm sm:text-base leading-relaxed',
    lg: 'text-base sm:text-lg leading-relaxed',
    xl: 'text-lg sm:text-xl leading-relaxed'
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

  return (
    <div
      data-paragraph-id={paragraph.id}
      className={`group/para relative p-3.5 sm:p-5 rounded-2xl sm:rounded-3xl transition-all border select-text ${
        isPlaying
          ? 'bg-gradient-to-r from-rose-950/80 via-[#3a180e]/90 to-[#2c120a] border-rose-500/80 shadow-lg shadow-rose-950/40 ring-2 ring-rose-500/30 text-white'
          : isLastAudioPosition
            ? `bg-[var(--surface-primary)] hover:bg-[var(--surface-hover)] border-rose-500/60 dark:border-rose-500/50 shadow-md shadow-rose-950/10 ring-1 ring-rose-500/30 text-[var(--text-primary)] ${isRtl ? 'border-r-4 border-r-rose-500' : 'border-l-4 border-l-rose-500'}`
            : 'bg-[var(--surface-primary)] hover:bg-[var(--surface-hover)] border-[var(--border-primary)] hover:border-rose-500/50 shadow-sm shadow-black/5 dark:shadow-black/20 text-[var(--text-primary)]'
      }`}
    >
      {/* LAST AUDIO POSITION BOOKMARK — Discreet, clearly visible accent */}
      {isLastAudioPosition && !isPlaying && (
        <div
          aria-label="Último párrafo reproducido"
          title="Último párrafo cuyo audio fue reproducido"
          className={`absolute -top-2.5 ${isRtl ? 'left-4 sm:left-6' : 'right-4 sm:right-6'} z-10 px-2.5 py-0.5 rounded-full bg-[var(--surface-primary)] border border-rose-500/50 shadow-sm flex items-center gap-1.5 text-[10px] font-medium text-rose-600 dark:text-rose-400 select-none pointer-events-none`}
        >
          <Headphones className="w-2.5 h-2.5 text-rose-500 shrink-0" />
          <span>Último audio</span>
        </div>
      )}
      <div
        className="flex items-start justify-between gap-2.5 sm:gap-3.5 w-full"
        dir={textDirection}
      >
        {/* TEXT CONTENT / INTERLINEAR GLOSSES */}
        <div className="flex-1 min-w-0" dir={textDirection}>
          {interlinearMode && Array.isArray(tokens) && tokens.length > 0 ? (
            <div
              dir={textDirection}
              style={{ direction: textDirection }}
              className={`flex flex-wrap items-center ${
                isChinese
                  ? 'gap-x-1 sm:gap-x-1.5 gap-y-1'
                  : 'gap-x-2 sm:gap-x-3 gap-y-2'
              } leading-tight break-words max-w-full ${
                isRtl ? 'justify-start text-right' : 'justify-start text-left'
              }`}
            >
              {tokens.map((tokenObj, idx) => {
                const word = typeof tokenObj === 'string' ? tokenObj : (tokenObj.word || tokenObj.text);
                const auxiliary = isChinese ? (tokenObj.auxiliary || tokenObj.pinyin || null) : null;
                const rawGloss = typeof tokenObj === 'object' ? tokenObj.gloss : null;
                const isPunctuation = typeof tokenObj === 'object'
                  ? tokenObj.isPunctuation
                  : PUNCTUATION_REGEX.test(word);

                // Never display auxiliary as gloss or word as gloss (except valid cases like 'de')
                const isLegitSameWord = word === '的' && rawGloss?.toLowerCase() === 'de';
                const cleanGloss = (rawGloss && (rawGloss !== auxiliary || isLegitSameWord) && rawGloss.toLowerCase() !== word?.toLowerCase())
                  ? rawGloss
                  : null;

                if (isPunctuation) {
                  return (
                    <span
                      key={idx}
                      dir={textDirection}
                      className={`text-[var(--text-muted)] font-medium ${
                        isChinese ? 'px-0 text-sm sm:text-base -ml-0.5' : 'px-0.5 text-base sm:text-lg'
                      } select-text self-center isolate [unicode-bidi:isolate]`}
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
                    className={`inline-flex flex-col items-center justify-center transition-colors cursor-pointer group/token max-w-full isolate [unicode-bidi:isolate] ${
                      isChinese
                        ? 'px-0.5 sm:px-1 py-0.5 rounded-md hover:bg-black/5 dark:hover:bg-white/10 active:bg-rose-500/15'
                        : 'px-1.5 py-1 rounded-xl hover:bg-black/5 dark:hover:bg-white/10 active:bg-rose-500/20'
                    }`}
                    title={cleanGloss ? `"${word}": ${cleanGloss}` : word}
                  >
                    {/* Tier 1 (TOP): ONLY FOR CHINESE - Tone-marked Pinyin in auxiliary */}
                    {isChinese && auxiliary && (
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
                          } ${fontClass}`}
                        >
                          {word}
                        </span>
                      );
                    })()}

                    {/* Tier 3 (BOTTOM): Gloss in student's native language (STRICTLY LTR) */}
                    {cleanGloss && (
                      <span
                        dir="ltr"
                        className={`${
                          isChinese
                            ? 'text-[14px] sm:text-[15px] text-[var(--text-muted)]/75 dark:text-stone-400/75 group-hover/token:text-[var(--text-secondary)] mt-0.5 max-w-[90px]'
                            : 'text-[14px] sm:text-[15px] text-[var(--text-muted)] group-hover/token:text-rose-600 dark:group-hover/token:text-rose-300 mt-1 max-w-[140px]'
                        } font-normal leading-tight truncate text-center select-text isolate [unicode-bidi:isolate] transition-colors`}
                      >
                        {cleanGloss}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            /* Normal paragraph text */
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
                const cleanWord = chunk.trim();
                if (cleanWord && isWordSaved(cleanWord, targetLang)) {
                  return (
                    <span
                      key={cIdx}
                      onClick={(e) => {
                        if (onWordClick) {
                          e.stopPropagation();
                          onWordClick(cleanWord, null);
                        }
                      }}
                      className="bg-amber-300 text-stone-950 dark:bg-amber-400 dark:text-stone-950 rounded px-1 font-bold shadow-xs cursor-pointer inline-block ring-1 ring-amber-400/60"
                      title={`Palabra guardada: "${cleanWord}"`}
                    >
                      {chunk}
                    </span>
                  );
                }
                return chunk;
              })}
            </p>
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

export default TextParagraphItem;
