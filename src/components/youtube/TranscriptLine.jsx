import React from 'react';
import { Volume2, Languages, Loader2 } from 'lucide-react';
import { getLanguageGlossStrategy, PUNCTUATION_REGEX } from '../../services/languageGlossStrategies.js';
import { isGlossComplete } from '../../services/subtitleGlossService.js';
import { getTextDirection, isRtlLanguage } from '../../constants/languages.js';

export function TranscriptLine({
  line,
  isActive = false,
  onSeek,
  onGlossLine = null,
  isGlossingThisLine = false,
  fontSize = 'base',
  showTimestamps = true,
  searchQuery = '',
  interlinearMode = true,
  targetLang = 'zh',
  onWordClick = null // Prepared for future word-level glossary lookup
}) {
  const { startTime, text, tokens = [], glosses = [] } = line;
  const isRtl = isRtlLanguage(targetLang);
  const textDirection = getTextDirection(targetLang);
  const isComplete = isGlossComplete(line, targetLang);

  // Font size classes
  const fontClassMap = {
    sm: 'text-xs sm:text-sm leading-relaxed',
    base: 'text-sm sm:text-base leading-relaxed',
    lg: 'text-base sm:text-lg leading-relaxed',
    xl: 'text-lg sm:text-xl leading-relaxed'
  };
  const fontClass = fontClassMap[fontSize] || fontClassMap.base;

  // Search highlighting helper
  const renderHighlightedText = (content) => {
    if (!searchQuery || !searchQuery.trim()) return content;
    const query = searchQuery.trim();
    const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    const parts = content.split(regex);

    return parts.map((part, i) =>
      regex.test(part) ? (
        <mark key={i} className="bg-amber-400 text-stone-900 font-bold px-0.5 rounded">
          {part}
        </mark>
      ) : (
        part
      )
    );
  };

  const handleLineClick = () => {
    if (onSeek && typeof startTime === 'number') {
      onSeek(startTime);
    }
  };

  return (
    <div
      onClick={handleLineClick}
      className={`group/line relative p-3 sm:p-3.5 rounded-2xl transition-all cursor-pointer border flex items-start gap-3 select-text ${
        isActive
          ? 'bg-gradient-to-r from-rose-950/90 via-[#3d1a10] to-[#2e130b] border-rose-500/80 shadow-md shadow-rose-950/40 ring-2 ring-rose-500/30'
          : 'bg-[#24120c]/60 hover:bg-[#2b160f] border-transparent hover:border-[#482519]'
      }`}
    >
      {/* Per-Paragraph Actions: 🎧 Audio + 🔤 Traducción */}
      <div className="flex items-center space-x-1 shrink-0 pt-0.5" onClick={(e) => e.stopPropagation()}>
        {/* 🎧 Audio Action: Plays/seeks this line in the video */}
        <button
          type="button"
          onClick={handleLineClick}
          title="Reproducir audio de este párrafo"
          className={`p-1.5 rounded-lg transition-all flex items-center justify-center cursor-pointer active:scale-95 ${
            isActive
              ? 'bg-rose-600 text-white shadow-xs'
              : 'bg-[#180c07] text-rose-300/70 hover:text-white hover:bg-[#32170f] border border-[#3d190f]'
          }`}
        >
          <Volume2 className="w-3.5 h-3.5" />
        </button>

        {/* 🔤 Translation Action: Glosses ONLY this paragraph */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            if (!isComplete && !isGlossingThisLine && onGlossLine) {
              onGlossLine(line);
            }
          }}
          disabled={isGlossingThisLine}
          title={
            isGlossingThisLine
              ? 'Glosando este párrafo...'
              : isComplete
              ? 'Párrafo glosado'
              : 'Glosar este párrafo con IA'
          }
          className={`p-1.5 rounded-lg transition-all flex items-center justify-center cursor-pointer active:scale-95 ${
            isGlossingThisLine
              ? 'bg-amber-950/80 text-amber-300 border border-amber-500/60 cursor-wait'
              : isComplete
              ? 'bg-emerald-950/50 text-emerald-400 border border-emerald-600/50 hover:bg-emerald-900/60'
              : 'bg-[#180c07] text-rose-300/70 hover:text-white hover:bg-[#32170f] border border-[#3d190f]'
          }`}
        >
          {isGlossingThisLine ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Languages className="w-3.5 h-3.5" />
          )}
        </button>
      </div>

      {/* Main Text Content */}
      <div className="flex-1 min-w-0" dir={textDirection}>
        {interlinearMode && tokens && tokens.length > 0 ? (
          (() => {
            const isChinese = targetLang === 'zh';

            return (
              <div
                dir={textDirection}
                style={{ direction: textDirection }}
                className={`flex flex-wrap items-center gap-x-1.5 sm:gap-x-2.5 gap-y-2 leading-tight break-words max-w-full ${
                  isRtl ? 'justify-start text-right' : 'justify-start text-left'
                }`}
              >
                {tokens.map((tokenObj, idx) => {
                  const word = typeof tokenObj === 'string' ? tokenObj : (tokenObj.word || tokenObj.text);
                  const auxiliary = isChinese ? (tokenObj.auxiliary || tokenObj.pinyin || null) : null;
                  const rawGloss = typeof tokenObj === 'object' ? tokenObj.gloss : (glosses && glosses[idx]);
                  const isPunctuation = typeof tokenObj === 'object'
                    ? tokenObj.isPunctuation
                    : PUNCTUATION_REGEX.test(word);

                  // Never display auxiliary as gloss or word as gloss (except when gloss is a valid word like 'de')
                  const isLegitSameWord = word === '的' && rawGloss?.toLowerCase() === 'de';
                  const cleanGloss = (rawGloss && (rawGloss !== auxiliary || isLegitSameWord) && rawGloss.toLowerCase() !== word?.toLowerCase()) ? rawGloss : null;

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
                      className="inline-flex flex-col items-center justify-center px-1 py-0.5 rounded-lg hover:bg-white/10 transition-colors group/token max-w-full isolate [unicode-bidi:isolate]"
                    >
                      {/* Tier 1 (TOP): ONLY FOR CHINESE - Tone-marked Pinyin in auxiliary */}
                      {isChinese && auxiliary && (
                        <span className="text-[11px] sm:text-xs text-rose-300 font-mono tracking-tight leading-none mb-1 select-text">
                          {auxiliary}
                        </span>
                      )}

                      {/* Tier 2 (CENTER): Word (Arabic with diacritics/tashkeel in RTL, Russian/Polish/Latin scripts in LTR) */}
                      <span
                        dir={textDirection}
                        className={`font-semibold tracking-wide ${
                          isActive ? 'text-white font-bold drop-shadow-xs' : 'text-stone-100'
                        } ${fontClass}`}
                      >
                        {renderHighlightedText(word)}
                      </span>

                      {/* Tier 3 (BOTTOM): Gloss in student's native language (STRICTLY LTR) */}
                      {cleanGloss && (
                        <span
                          dir="ltr"
                          title={cleanGloss}
                          className="text-[10px] sm:text-[11px] text-stone-300/80 group-hover/line:text-stone-200 font-normal leading-tight mt-1 max-w-[120px] truncate text-center select-text isolate [unicode-bidi:isolate]"
                        >
                          {cleanGloss}
                        </span>
                      )}
                    </div>
                  );
                })}
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
                : 'text-rose-100/90 group-hover/line:text-white'
            }`}
          >
            {renderHighlightedText(text)}
          </p>
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
