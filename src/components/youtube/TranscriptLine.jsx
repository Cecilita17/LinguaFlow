import React from 'react';
import { formatTimestamp } from '../../services/subtitleService.js';
import { Play, Volume2 } from 'lucide-react';

export function TranscriptLine({
  line,
  isActive = false,
  onSeek,
  fontSize = 'base',
  showTimestamps = true,
  searchQuery = '',
  interlinearMode = true,
  onWordClick = null // Prepared for future word-level glossary lookup
}) {
  const { startTime, text, tokens = [], glosses = [] } = line;

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
      {/* Timestamp / Jump Button */}
      {showTimestamps && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            handleLineClick();
          }}
          className={`flex-shrink-0 px-2 py-1 rounded-lg text-[11px] font-mono font-bold transition-all flex items-center gap-1 ${
            isActive
              ? 'bg-rose-600 text-white shadow-xs'
              : 'bg-[#180c07] text-rose-300/70 group-hover/line:text-rose-200 group-hover/line:bg-[#32170f]'
          }`}
          title={`Saltar al segundo ${Math.round(startTime)}`}
        >
          <Play className="w-2.5 h-2.5 fill-current" />
          <span>{formatTimestamp(startTime)}</span>
        </button>
      )}

      {/* Main Text Content */}
      <div className="flex-1 min-w-0">
        {interlinearMode && tokens && tokens.length > 0 ? (
          <div className="flex flex-wrap items-center gap-x-1.5 sm:gap-x-2.5 gap-y-2 leading-tight break-words max-w-full">
            {tokens.map((tokenObj, idx) => {
              const word = typeof tokenObj === 'string' ? tokenObj : tokenObj.word;
              const pinyin = typeof tokenObj === 'object' ? tokenObj.pinyin : null;
              const rawGloss = typeof tokenObj === 'object' ? tokenObj.gloss : (glosses && glosses[idx]);
              const isPunctuation = typeof tokenObj === 'object'
                ? tokenObj.isPunctuation
                : /^[，。！？；：、“”‘’（）《》…—,.!?;:'"()\-]+$/.test(word);

              // Never display Pinyin as gloss or word as gloss (except when gloss is a valid Spanish word like 'de')
              const isLegitSameWord = word === '的' && rawGloss?.toLowerCase() === 'de';
              const cleanGloss = (rawGloss && (rawGloss !== pinyin || isLegitSameWord) && rawGloss !== word) ? rawGloss : null;

              if (isPunctuation) {
                return (
                  <span
                    key={idx}
                    className="text-stone-400 font-medium px-0.5 select-text self-center text-base sm:text-lg"
                  >
                    {word}
                  </span>
                );
              }

              return (
                <div
                  key={idx}
                  onClick={(e) => {
                    if (onWordClick) {
                      e.stopPropagation();
                      onWordClick(word, { word, pinyin, gloss: cleanGloss });
                    }
                  }}
                  className="inline-flex flex-col items-center justify-center px-1 py-0.5 rounded-lg hover:bg-white/10 transition-colors group/token max-w-full"
                >
                  {/* Tier 1 (TOP): Pinyin with tone marks */}
                  {pinyin ? (
                    <span className="text-[11px] sm:text-xs text-rose-300 font-mono tracking-tight leading-none mb-1 select-text">
                      {pinyin}
                    </span>
                  ) : (
                    <span className="text-[10px] text-transparent select-none leading-none mb-1">
                      &nbsp;
                    </span>
                  )}

                  {/* Tier 2 (CENTER): Chinese Character / Word */}
                  <span
                    className={`font-semibold tracking-wide ${
                      isActive ? 'text-white font-bold drop-shadow-xs' : 'text-stone-100'
                    } ${fontClass}`}
                  >
                    {renderHighlightedText(word)}
                  </span>

                  {/* Tier 3 (BOTTOM): Gloss / Meaning in student's native language */}
                  {cleanGloss && (
                    <span
                      title={cleanGloss}
                      className="text-[10px] sm:text-[11px] text-stone-300/80 group-hover/line:text-stone-200 font-normal leading-tight mt-1 max-w-[120px] truncate text-center select-text"
                    >
                      {cleanGloss}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          /* Normal Subtitle View Mode (Traditional Subtitles) */
          <p
            className={`${fontClass} ${
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
