import React from 'react';
import { Play, Square, AlertCircle, Languages, Loader2 } from 'lucide-react';
import { PUNCTUATION_REGEX } from '../../services/languageGlossStrategies.js';
import { getTextDirection, isRtlLanguage } from '../../constants/languages.js';
import { isGlossComplete } from '../../services/subtitleGlossService.js';

/**
 * TextParagraphItem
 * Renders an independent paragraph with:
 * 1. Interlinear tokens (Chinese Pinyin above word, Arabic tashkeel without Latin transliteration, Polish/Russian words + gloss)
 * 2. Dedicated right-aligned audio button (Play / Playing / Stop / Error) - plays ONLY this paragraph
 * 3. Dedicated translation/glossing button right below audio button - glosses ONLY this paragraph with AI
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
  onPlay = null,
  onStop = null,
  onWordClick = null,
  onGlossParagraph = null
}) {
  const { text, tokens = [] } = paragraph;
  const isChinese = targetLang === 'zh';
  const isRtl = isRtlLanguage(targetLang);
  const textDirection = getTextDirection(targetLang);
  const isComplete = isGlossComplete(paragraph, targetLang);

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
      className={`group/para relative p-4 sm:p-5 rounded-2xl sm:rounded-3xl transition-all border select-text ${
        isPlaying
          ? 'bg-gradient-to-r from-rose-950/80 via-[#3a180e]/90 to-[#2c120a] border-rose-500/80 shadow-lg shadow-rose-950/40 ring-2 ring-rose-500/30'
          : 'bg-[#24110a]/80 hover:bg-[#2c150d] border-[#441f14] hover:border-[#5a2a1c] shadow-md shadow-black/20'
      }`}
    >
      <div className="flex items-start justify-between gap-3 sm:gap-4 w-full">
          {/* LEFT: Text Content / Interlinear Glosses */}
          <div className="flex-1 min-w-0" dir={textDirection}>
            {interlinearMode && Array.isArray(tokens) && tokens.length > 0 ? (
              <div
                dir={textDirection}
                style={{ direction: textDirection }}
                className={`flex flex-wrap items-center gap-x-2 sm:gap-x-3 gap-y-2.5 leading-tight break-words max-w-full ${
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
                        className="text-stone-400 font-medium px-0.5 select-text self-center text-base sm:text-lg isolate [unicode-bidi:isolate]"
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
                      className="inline-flex flex-col items-center justify-center px-1.5 py-1 rounded-xl hover:bg-white/10 active:bg-rose-900/40 transition-colors cursor-pointer group/token max-w-full isolate [unicode-bidi:isolate]"
                      title={cleanGloss ? `"${word}": ${cleanGloss}` : word}
                    >
                      {/* Tier 1 (TOP): ONLY FOR CHINESE - Tone-marked Pinyin in auxiliary */}
                      {isChinese && auxiliary && (
                        <span className="text-[11px] sm:text-xs text-rose-300 font-mono tracking-tight leading-none mb-1 select-text">
                          {auxiliary}
                        </span>
                      )}

                      {/* Tier 2 (CENTER): Word (Arabic with tashkīl in RTL, Russian, Polish, Latin scripts in LTR) */}
                      <span
                        dir={textDirection}
                        className={`font-semibold tracking-wide select-text ${
                          isPlaying ? 'text-white font-bold drop-shadow-xs' : 'text-stone-100'
                        } ${fontClass}`}
                      >
                        {word}
                      </span>

                      {/* Tier 3 (BOTTOM): Gloss in student's native language (STRICTLY LTR) */}
                      {cleanGloss && (
                        <span
                          dir="ltr"
                          className="text-[10px] sm:text-[11px] text-stone-300/80 group-hover/token:text-rose-200 font-normal leading-tight mt-1 max-w-[140px] truncate text-center select-text isolate [unicode-bidi:isolate]"
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
                    : 'text-stone-100 group-hover/para:text-white'
                }`}
              >
                {text}
              </p>
            )}
          </div>

          {/* RIGHT: Actions (Audio Button + Debajo: ✎ Glosar manualmente) */}
          <div className="shrink-0 flex flex-col items-center sm:items-end gap-2 pt-0.5 sm:pt-1">
            {/* Paragraph Audio Button (▶️ / ⏹️ / ⚠️) */}
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
              className={`relative w-10 h-10 sm:w-11 sm:h-11 rounded-2xl flex items-center justify-center transition-all shadow-md active:scale-95 cursor-pointer ${
                isAudioError
                  ? 'bg-amber-900/80 border border-amber-500/80 text-amber-200 hover:bg-amber-800'
                  : isPlaying
                  ? 'bg-gradient-to-tr from-pink-600 to-rose-600 text-white border border-rose-400/90 shadow-rose-900/60 ring-2 ring-rose-400/40'
                  : 'bg-[#2f150d] hover:bg-[#3d1c12] border border-[#522518] text-rose-300 hover:text-white group-hover/para:border-rose-700/60'
              }`}
            >
              {isAudioError ? (
                <AlertCircle className="w-5 h-5 text-amber-300" />
              ) : isPlaying ? (
                <>
                  <span className="absolute -inset-1 rounded-2xl border-2 border-rose-400/60 animate-ping pointer-events-none" />
                  <Square className="w-4 h-4 fill-white" />
                </>
              ) : (
                <Play className="w-4 h-4 fill-current ml-0.5" />
              )}
            </button>

            {/* Debajo del botón de audio: Botón de glosado individual para este párrafo */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (!isComplete && !isGlossing && onGlossParagraph) {
                  onGlossParagraph(paragraph);
                }
              }}
              disabled={isGlossing}
              aria-label="Glosar este párrafo"
              title={
                isGlossing
                  ? 'Glosando este párrafo...'
                  : isComplete
                  ? 'Párrafo glosado'
                  : 'Glosar este párrafo con IA'
              }
              className={`relative w-10 h-10 sm:w-11 sm:h-11 rounded-2xl flex items-center justify-center transition-all shadow-md active:scale-95 cursor-pointer ${
                isGlossing
                  ? 'bg-amber-950/80 text-amber-300 border border-amber-500/60 cursor-wait'
                  : isComplete
                  ? 'bg-emerald-950/50 text-emerald-400 border border-emerald-600/50 hover:bg-emerald-900/60'
                  : 'bg-[#2a130b] hover:bg-[#38190e] border border-[#482015] hover:border-rose-500/60 text-stone-200 hover:text-white'
              }`}
            >
              {isGlossing ? (
                <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 animate-spin" />
              ) : (
                <Languages className={`w-4 h-4 sm:w-5 sm:h-5 ${isComplete ? 'text-emerald-400' : 'text-rose-400'}`} />
              )}
            </button>
          </div>
        </div>
    </div>
  );
}

export default TextParagraphItem;
