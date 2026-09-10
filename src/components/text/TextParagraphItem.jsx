import React from 'react';
import { Play, Square, AlertCircle, Languages, Loader2 } from 'lucide-react';
import { PUNCTUATION_REGEX } from '../../services/languageGlossStrategies.js';
import { getTextDirection, isRtlLanguage } from '../../constants/languages.js';
import { isGlossComplete } from '../../services/subtitleGlossService.js';

/**
 * TextParagraphItem
 * Renders an independent paragraph with:
 * 1. Interlinear tokens (Chinese Pinyin above word, Arabic tashkeel without Latin transliteration, Polish/Russian words + gloss)
 * 2. Dedicated vertical actions column (shrink-0, aligned at top):
 *    - Audio button on top (▶️ / ⏹️ / ⚠️) - plays ONLY this paragraph
 *    - Gloss button below (🔤) - glosses ONLY this paragraph with AI
 * 3. Compact button dimensions (~w-8 h-8 / sm:w-9 sm:h-9) to maximize reading width
 * 4. Interactive word click for dictionary definition lookup
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
  onPlay = null,
  onStop = null,
  onWordClick = null,
  onGloss = null,
  onGlossParagraph = null
}) {
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
      className={`group/para relative p-3.5 sm:p-5 rounded-2xl sm:rounded-3xl transition-all border select-text ${
        isPlaying
          ? 'bg-gradient-to-r from-rose-950/80 via-[#3a180e]/90 to-[#2c120a] border-rose-500/80 shadow-lg shadow-rose-950/40 ring-2 ring-rose-500/30 text-white'
          : 'bg-[var(--surface-primary)] hover:bg-[var(--surface-hover)] border-[var(--border-primary)] hover:border-rose-500/50 shadow-sm shadow-black/5 dark:shadow-black/20 text-[var(--text-primary)]'
      }`}
    >
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
              className={`flex flex-wrap items-center gap-x-2 sm:gap-x-3 gap-y-2 leading-tight break-words max-w-full ${
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
                      className="text-[var(--text-muted)] font-medium px-0.5 select-text self-center text-base sm:text-lg isolate [unicode-bidi:isolate]"
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
                    className="inline-flex flex-col items-center justify-center px-1.5 py-1 rounded-xl hover:bg-black/5 dark:hover:bg-white/10 active:bg-rose-500/20 transition-colors cursor-pointer group/token max-w-full isolate [unicode-bidi:isolate]"
                    title={cleanGloss ? `"${word}": ${cleanGloss}` : word}
                  >
                    {/* Tier 1 (TOP): ONLY FOR CHINESE - Tone-marked Pinyin in auxiliary */}
                    {isChinese && auxiliary && (
                      <span className="text-[11px] sm:text-xs text-rose-600 dark:text-rose-300 font-mono font-semibold tracking-tight leading-none mb-1 select-text">
                        {auxiliary}
                      </span>
                    )}

                    {/* Tier 2 (CENTER): Word (Arabic with tashkīl in RTL, Russian, Polish, Latin scripts in LTR) */}
                    <span
                      dir={textDirection}
                      className={`font-semibold tracking-wide select-text ${
                        isPlaying ? 'text-white font-bold drop-shadow-xs' : 'text-[var(--text-primary)]'
                      } ${fontClass}`}
                    >
                      {word}
                    </span>

                    {/* Tier 3 (BOTTOM): Gloss in student's native language (STRICTLY LTR) */}
                    {cleanGloss && (
                      <span
                        dir="ltr"
                        className="text-[10px] sm:text-[11px] text-[var(--text-muted)] group-hover/token:text-rose-600 dark:group-hover/token:text-rose-300 font-normal leading-tight mt-1 max-w-[140px] truncate text-center select-text isolate [unicode-bidi:isolate]"
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
              {text}
            </p>
          )}
        </div>

        {/* VERTICAL ACTIONS COLUMN: Audio on top, Gloss below. Compact (w-8 h-8 / sm:w-9 sm:h-9) */}
        <div
          dir="ltr"
          className="shrink-0 flex flex-col items-center gap-1.5 self-start pt-0.5"
        >
          {/* Paragraph Audio Button (▶️ / ⏹️ / ⚠️) - Plays ONLY this paragraph */}
          <button
            type="button"
            onClick={handleAudioClick}
            aria-label={
              isAudioError
                ? 'Error de reproducción (clic para reintentar)'
                : isPlaying
                ? 'Detener reproducción de audio'
                : 'Reproducir párrafo'
            }
            title={
              isAudioError
                ? 'Error de TTS. Haz clic para reintentar.'
                : isPlaying
                ? 'Detener audio'
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
                <Square className="w-3.5 h-3.5 fill-white" />
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
