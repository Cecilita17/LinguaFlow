import React from 'react';
import { Volume2, Languages, Loader2 } from 'lucide-react';
import { getLanguageGlossStrategy, PUNCTUATION_REGEX } from '../../services/languageGlossStrategies.js';
import { isGlossComplete } from '../../services/subtitleGlossService.js';
import { getTextDirection, isRtlLanguage } from '../../constants/languages.js';
import { useSavedWords } from '../../context/SavedWordsContext.jsx';

export function TranscriptLine({
  line,
  isActive = false,
  onSeek,
  onGloss = null,
  onGlossLine = null,
  isGlossing = false,
  isGlossingThisLine = false,
  hasGloss = false,
  fontSize = 'base',
  showTimestamps = true,
  searchQuery = '',
  interlinearMode = true,
  targetLang = 'zh',
  onWordClick = null
}) {
  const { isWordSaved } = useSavedWords();
  if (!line || typeof line !== 'object') return null;
  const startTime = typeof line.startTime === 'number' && !isNaN(line.startTime) ? line.startTime : 0;
  const rawText = typeof line.text === 'string' ? line.text : (line.text != null ? String(line.text) : '');
  const text = rawText;
  const tokens = Array.isArray(line.tokens) ? line.tokens : [];
  const glosses = Array.isArray(line.glosses) ? line.glosses : [];
  const isRtl = isRtlLanguage(targetLang);
  const textDirection = getTextDirection(targetLang);
  const isComplete = hasGloss || isGlossComplete(line, targetLang);
  const handleGloss = onGloss || onGlossLine;
  const glossing = isGlossing || isGlossingThisLine;

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

  return (
    <div
      onClick={handleLineClick}
      className={`group/line relative p-3 sm:p-3.5 rounded-2xl transition-all cursor-pointer border flex items-start gap-3 select-text ${
        isActive
          ? 'bg-gradient-to-r from-rose-950/90 via-[#3d1a10] to-[#2e130b] border-rose-500/80 shadow-md shadow-rose-950/40 ring-2 ring-rose-500/30'
          : 'bg-[var(--surface-primary)] hover:bg-[var(--surface-hover)] border-[var(--border-primary)] shadow-xs text-[var(--text-primary)]'
      }`}
    >
      {/* Per-Paragraph Actions: 🎧 Audio (top) + 🔤 Traducción (bottom) */}
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

        {/* 🔤 Translation Action: Glosses ONLY this line/paragraph */}
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
        {interlinearMode && tokens && tokens.length > 0 ? (
          (() => {
            const isChinese = targetLang === 'zh';

            return (
              <div
                dir={textDirection}
                style={{ direction: textDirection }}
                className={`flex flex-wrap items-center ${
                  isChinese
                    ? 'gap-x-1 sm:gap-x-1.5 gap-y-3'
                    : 'gap-x-1.5 sm:gap-x-2.5 gap-y-2'
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

                  const rawAux = isChinese && tokenObj && typeof tokenObj === 'object'
                    ? (tokenObj.auxiliary ?? tokenObj.pinyin ?? null)
                    : null;
                  const auxiliary = rawAux != null ? String(rawAux).trim() : null;

                  const rawGlossVal = tokenObj && typeof tokenObj === 'object'
                    ? tokenObj.gloss
                    : (glosses && glosses[idx]);
                  const rawGloss = rawGlossVal != null ? String(rawGlossVal).trim() : null;

                  const isPunctuation = tokenObj && typeof tokenObj === 'object' && typeof tokenObj.isPunctuation === 'boolean'
                    ? tokenObj.isPunctuation
                    : PUNCTUATION_REGEX.test(word);

                  // Never display auxiliary as gloss or word as gloss (except when gloss is a valid word like 'de')
                  const wordLower = word.toLowerCase();
                  const rawGlossLower = rawGloss ? rawGloss.toLowerCase() : null;
                  const isLegitSameWord = word === '的' && rawGlossLower === 'de';
                  const cleanGloss = (rawGloss && (rawGloss !== auxiliary || isLegitSameWord) && rawGlossLower !== wordLower) ? rawGloss : null;

                  if (isPunctuation) {
                    return (
                      <span
                        key={idx}
                        dir={textDirection}
                        className={`text-stone-400 font-medium ${
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
                      className={`inline-flex flex-col items-center justify-center rounded-md hover:bg-white/10 transition-colors group/token max-w-full isolate [unicode-bidi:isolate] cursor-pointer ${
                        isChinese ? 'px-0.5 sm:px-1 py-0.5' : 'px-1 py-0.5'
                      }`}
                    >
                      {/* Tier 1 (TOP): ONLY FOR CHINESE - Tone-marked Pinyin in auxiliary */}
                      {isChinese && auxiliary && (
                        <span className="text-[12px] sm:text-[13px] text-[var(--text-muted)] dark:text-stone-400 font-mono font-medium tracking-tight leading-none mb-0.5 select-text opacity-85 group-hover/token:opacity-100 group-hover/token:text-[var(--text-secondary)] transition-opacity">
                          {auxiliary}
                        </span>
                      )}

                      {/* Tier 2 (CENTER): Word (Arabic with diacritics/tashkeel in RTL, Russian/Polish/Latin scripts in LTR) */}
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
                                : isActive
                                ? 'text-white font-bold drop-shadow-xs'
                                : 'text-[var(--text-primary)]'
                            } ${fontClass}`}
                          >
                            {renderHighlightedText(word)}
                          </span>
                        );
                      })()}

                      {/* Tier 3 (BOTTOM): Gloss in student's native language (STRICTLY LTR) */}
                      {cleanGloss && (
                        <span
                          dir="ltr"
                          title={cleanGloss}
                          className={`${
                            isChinese
                              ? 'text-[14px] sm:text-[15px] text-[var(--text-muted)]/75 dark:text-stone-400/75 group-hover/line:text-[var(--text-secondary)] mt-0.5 max-w-[90px]'
                              : 'text-[14px] sm:text-[15px] text-[var(--text-muted)] group-hover/line:text-[var(--text-secondary)] mt-1 max-w-[120px]'
                          } font-normal leading-tight truncate text-center select-text isolate [unicode-bidi:isolate] transition-colors`}
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
              return renderHighlightedText(chunk);
            })}
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
