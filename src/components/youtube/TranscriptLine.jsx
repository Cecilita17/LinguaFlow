import React from 'react';
import { Volume2, Languages, Loader2 } from 'lucide-react';
import { getLanguageGlossStrategy, PUNCTUATION_REGEX } from '../../services/languageGlossStrategies.js';
import { getArabicTransliteration } from '../../services/arabicTransliteration.js';
import { isGlossComplete } from '../../services/subtitleGlossService.js';
import { getTextDirection, isRtlLanguage } from '../../constants/languages.js';
import { useSavedWords } from '../../context/SavedWordsContext.jsx';
import { useAudioSettings } from '../../context/AudioSettingsContext.jsx';
import { InterlinearGloss } from '../common/InterlinearGloss.jsx';

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
  const glossing = isGlossing || isGlossingThisLine;

  const activeTokenIndex = React.useMemo(() => {
    if (!isActive || !tokens || tokens.length === 0) return -1;
    const time = typeof currentTime === 'number' && !isNaN(currentTime) ? currentTime : 0;
    const start = typeof line.startTime === 'number' ? line.startTime : 0;
    const end = typeof line.endTime === 'number' && line.endTime > start ? line.endTime : start + 4.0;
    
    // Check if tokens have individual timestamps
    const hasPerTokenTimestamps = tokens.some(t => t && typeof t === 'object' && typeof t.startTime === 'number');
    if (hasPerTokenTimestamps) {
      return tokens.findIndex(t => {
        if (!t || typeof t !== 'object') return false;
        const tStart = t.startTime ?? start;
        const tEnd = t.endTime ?? end;
        return time >= tStart && time <= tEnd;
      });
    }

    // Proportional progress based on character count of non-punctuation tokens
    const duration = Math.max(0.4, end - start);
    const elapsed = Math.max(0, Math.min(duration, time - start));
    const progress = elapsed / duration;

    const tokenWeights = tokens.map(tok => {
      if (!tok) return 0;
      const rawWord = typeof tok === 'string' ? tok : (tok.word ?? tok.text ?? '');
      const isPunct = tok && typeof tok === 'object' && typeof tok.isPunctuation === 'boolean'
        ? tok.isPunctuation
        : PUNCTUATION_REGEX.test(rawWord);
      return isPunct ? 0 : Math.max(1, rawWord.length);
    });

    const totalWeight = tokenWeights.reduce((sum, w) => sum + w, 0);
    if (totalWeight === 0) return -1;

    const targetCharOffset = progress * totalWeight;
    let accumulated = 0;
    for (let i = 0; i < tokens.length; i++) {
      accumulated += tokenWeights[i];
      if (tokenWeights[i] > 0 && targetCharOffset < accumulated) {
        return i;
      }
    }
    for (let i = tokens.length - 1; i >= 0; i--) {
      if (tokenWeights[i] > 0) return i;
    }
    return -1;
  }, [isActive, tokens, currentTime, line.startTime, line.endTime]);

  const activeChunkIndex = React.useMemo(() => {
    if (!isActive || !text) return -1;
    const chunks = text.split(/([\s.,!?;:()¿¡'"“”‘’—–\-_/\\`~，。！？；：、“”‘’（）《》…]+)/);
    const time = typeof currentTime === 'number' && !isNaN(currentTime) ? currentTime : 0;
    const start = typeof line.startTime === 'number' ? line.startTime : 0;
    const end = typeof line.endTime === 'number' && line.endTime > start ? line.endTime : start + 4.0;
    const duration = Math.max(0.4, end - start);
    const elapsed = Math.max(0, Math.min(duration, time - start));
    const progress = elapsed / duration;

    const chunkWeights = chunks.map(c => {
      const trimmed = (c || '').trim();
      return (trimmed && !PUNCTUATION_REGEX.test(trimmed)) ? Math.max(1, trimmed.length) : 0;
    });
    const totalWeight = chunkWeights.reduce((sum, w) => sum + w, 0);
    if (totalWeight === 0) return -1;

    const targetCharOffset = progress * totalWeight;
    let accumulated = 0;
    for (let i = 0; i < chunks.length; i++) {
      accumulated += chunkWeights[i];
      if (chunkWeights[i] > 0 && targetCharOffset < accumulated) {
        return i;
      }
    }
    for (let i = chunks.length - 1; i >= 0; i--) {
      if (chunkWeights[i] > 0) return i;
    }
    return -1;
  }, [isActive, text, currentTime, line.startTime, line.endTime]);

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
            const isArabic = targetLang === 'ar';

            return (
              <div
                dir={textDirection}
                style={{ direction: textDirection }}
                className={`flex flex-wrap items-start ${
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
                    : (glosses && glosses[idx]);
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

                      {/* Tier 3 (BOTTOM): Gloss in student's native language (responsive wrapping, never truncated) */}
                      <InterlinearGloss
                        gloss={cleanGloss}
                        isChinese={isChinese}
                        nativeLang={nativeLang}
                      />
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
              const isAudioActive = wordHighlightEnabled && isActive && activeChunkIndex === cIdx;
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
                    className={`bg-amber-300 text-stone-950 dark:bg-amber-400 dark:text-stone-950 rounded px-1 font-bold shadow-xs cursor-pointer inline-block ring-1 ring-amber-400/60 ${isAudioActive ? 'audio-word-active' : ''}`}
                    title={`Palabra guardada: "${cleanWord}"`}
                  >
                    {chunk}
                  </span>
                );
              }
              return (
                <span key={cIdx} className={isAudioActive ? 'audio-word-active' : ''}>
                  {renderHighlightedText(chunk)}
                </span>
              );
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
