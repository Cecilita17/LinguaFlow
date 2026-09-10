import React, { useState } from 'react';
import { Play, Square, AlertCircle, Volume2, Languages, Check, X } from 'lucide-react';
import { PUNCTUATION_REGEX } from '../../services/languageGlossStrategies.js';
import { getTextDirection, isRtlLanguage, getLanguageMeta } from '../../constants/languages.js';
import { tokenizeAndGlossLineOffline } from '../../services/subtitleGlossService.js';

/**
 * TextParagraphItem
 * Renders an independent paragraph with:
 * 1. Interlinear tokens (Chinese Pinyin above word, Arabic tashkeel without Latin transliteration, Polish/Russian words + gloss)
 * 2. Dedicated right-aligned audio button (Play / Playing / Stop / Error)
 * 3. Dedicated manual glossing button (✎ Glosar manualmente) right below the audio button
 * 4. Interactive per-segment manual glossing interface (Spanish glosses, 0ms latency, zero AI calls)
 * 5. Interactive word click for dictionary definition lookup
 * 6. Authentic RTL support for Arabic, Hebrew, etc.
 */
export function TextParagraphItem({
  paragraph,
  targetLang = 'zh',
  fontSize = 'base',
  interlinearMode = true,
  isPlaying = false,
  isAudioError = false,
  onPlay = null,
  onStop = null,
  onWordClick = null,
  onSaveManualGlosses = null
}) {
  const { id, text, tokens = [] } = paragraph;
  const isChinese = targetLang === 'zh';
  const isRtl = isRtlLanguage(targetLang);
  const textDirection = getTextDirection(targetLang);
  const langMeta = getLanguageMeta(targetLang);

  // Local state for manual gloss editing
  const [isManualEditing, setIsManualEditing] = useState(false);
  const [tokenGlosses, setTokenGlosses] = useState({});

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

  // Open manual gloss editor
  const handleOpenManualGloss = (e) => {
    if (e) e.stopPropagation();
    const effectiveTokens = Array.isArray(tokens) && tokens.length > 0
      ? tokens
      : tokenizeAndGlossLineOffline(text, targetLang);

    const initialMap = {};
    effectiveTokens.forEach((tok, i) => {
      if (tok && !tok.isPunctuation) {
        initialMap[i] = tok.gloss || '';
      }
    });
    setTokenGlosses(initialMap);
    setIsManualEditing(true);
  };

  // Handle single token gloss input edit
  const handleGlossInputChange = (idx, value) => {
    setTokenGlosses(prev => ({
      ...prev,
      [idx]: value
    }));
  };

  // Save manual glosses
  const handleSaveManualGloss = (e) => {
    if (e) e.stopPropagation();
    const effectiveTokens = Array.isArray(tokens) && tokens.length > 0
      ? tokens
      : tokenizeAndGlossLineOffline(text, targetLang);

    const updatedTokens = effectiveTokens.map((tok, i) => {
      if (tok.isPunctuation) return tok;
      const userVal = tokenGlosses[i] !== undefined ? tokenGlosses[i].trim() : (tok.gloss || '');
      const hasUserVal = Boolean(userVal);
      return {
        ...tok,
        gloss: hasUserVal ? userVal : null,
        glossSource: hasUserVal ? 'manual' : tok.glossSource || null
      };
    });

    if (onSaveManualGlosses) {
      onSaveManualGlosses(paragraph.id, updatedTokens);
    }
    setIsManualEditing(false);
  };

  // Cancel manual gloss editing
  const handleCancelManualGloss = (e) => {
    if (e) e.stopPropagation();
    setIsManualEditing(false);
    setTokenGlosses({});
  };

  // Clear all gloss inputs in this segment
  const handleClearAllGlosses = (e) => {
    if (e) e.stopPropagation();
    const effectiveTokens = Array.isArray(tokens) && tokens.length > 0
      ? tokens
      : tokenizeAndGlossLineOffline(text, targetLang);
    const cleared = {};
    effectiveTokens.forEach((tok, i) => {
      if (tok && !tok.isPunctuation) {
        cleared[i] = '';
      }
    });
    setTokenGlosses(cleared);
  };

  return (
    <div
      className={`group/para relative p-4 sm:p-5 rounded-2xl sm:rounded-3xl transition-all border select-text ${
        isPlaying
          ? 'bg-gradient-to-r from-rose-950/80 via-[#3a180e]/90 to-[#2c120a] border-rose-500/80 shadow-lg shadow-rose-950/40 ring-2 ring-rose-500/30'
          : 'bg-[#24110a]/80 hover:bg-[#2c150d] border-[#441f14] hover:border-[#5a2a1c] shadow-md shadow-black/20'
      }`}
    >
      {isManualEditing ? (
        /* ============================================================ */
        /* MANUAL GLOSSING EDITOR INTERFACE                             */
        /* ============================================================ */
        <div className="w-full space-y-4 animate-fade-in select-text">
          {/* Header Bar */}
          <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-[#3e1b11]">
            <div className="flex items-center space-x-2">
              <span className="px-2.5 py-1 rounded-xl bg-rose-950/90 border border-rose-700/70 text-rose-300 text-xs font-bold flex items-center space-x-1.5">
                <Languages className="w-3.5 h-3.5" />
                <span>Glosado manual</span>
              </span>
              <span className="text-xs text-stone-300 font-medium">
                Párrafo {(paragraph.index ?? 0) + 1} • {langMeta?.name || targetLang.toUpperCase()} → Español
              </span>
              {isRtl && (
                <span className="text-[10px] px-2 py-0.5 rounded-md bg-amber-950/90 text-amber-300 border border-amber-800/70 font-mono">
                  RTL
                </span>
              )}
            </div>
            <span className="text-[11px] text-stone-400">
              Introduce la traducción o glosa en español para cada palabra
            </span>
          </div>

          {/* Sentence Context Preview */}
          <div
            dir={textDirection}
            style={{ direction: textDirection }}
            className={`px-3.5 py-2.5 rounded-xl bg-[#180b06] border border-[#38160d] text-stone-300 text-xs sm:text-sm leading-relaxed ${
              isRtl ? 'text-right' : 'text-left'
            }`}
          >
            <span className="text-stone-500 mr-1 select-none">“</span>
            <span className="select-text">{text}</span>
            <span className="text-stone-500 ml-1 select-none">”</span>
          </div>

          {/* Token Words Grid in Logical Order (preserves RTL visual flow without reversing memory) */}
          <div
            dir={textDirection}
            style={{ direction: textDirection }}
            className={`flex flex-wrap items-end gap-2 sm:gap-3 p-3.5 rounded-2xl bg-[#1a0c07] border border-[#3f1b11] ${
              isRtl ? 'justify-start text-right' : 'justify-start text-left'
            }`}
          >
            {(Array.isArray(tokens) && tokens.length > 0 ? tokens : tokenizeAndGlossLineOffline(text, targetLang)).map((tok, idx) => {
              const w = typeof tok === 'string' ? tok : (tok.word || tok.text);
              const isPunct = typeof tok === 'object' ? tok.isPunctuation : PUNCTUATION_REGEX.test(w);
              const aux = isChinese ? (tok.auxiliary || tok.pinyin || null) : null;

              if (isPunct) {
                return (
                  <span
                    key={idx}
                    dir={textDirection}
                    className="text-stone-500 font-semibold px-1 py-1 text-base select-none self-center isolate [unicode-bidi:isolate]"
                    title="Signo de puntuación"
                  >
                    {w}
                  </span>
                );
              }

              const currentVal = tokenGlosses[idx] !== undefined ? tokenGlosses[idx] : (tok.gloss || '');
              const wasManual = tok.glossSource === 'manual';

              return (
                <div
                  key={idx}
                  dir={textDirection}
                  className="flex flex-col items-center bg-[#251009] hover:bg-[#2d140b] border border-[#4d2216] focus-within:border-rose-500 focus-within:ring-1 focus-within:ring-rose-500/40 rounded-xl p-2 min-w-[70px] sm:min-w-[85px] transition-all shadow-xs isolate [unicode-bidi:isolate]"
                >
                  {/* Tier 1 (ONLY CHINESE): Tone-marked Pinyin */}
                  {isChinese && aux && (
                    <span className="text-[11px] text-rose-300 font-mono tracking-tight leading-none mb-1 select-text">
                      {aux}
                    </span>
                  )}

                  {/* Tier 2: Word in target script (Arabic with tashkīl in RTL, Russian Cyrillic, etc.) */}
                  <span
                    dir={textDirection}
                    className={`font-bold tracking-wide text-white text-sm sm:text-base leading-tight mb-1.5 select-text ${
                      isRtl ? 'text-right' : 'text-center'
                    }`}
                  >
                    {w}
                  </span>

                  {/* Tier 3: Spanish gloss input (STRICTLY LTR) */}
                  <input
                    type="text"
                    dir="ltr"
                    value={currentVal}
                    onChange={(e) => handleGlossInputChange(idx, e.target.value)}
                    placeholder="glosa..."
                    className="w-full text-center text-xs py-1 px-1.5 rounded-lg bg-[#180a05] border border-[#481f14] focus:border-rose-500 focus:outline-hidden text-rose-100 placeholder-stone-600 transition-all isolate [unicode-bidi:isolate]"
                  />

                  {/* Badge indicator if previously saved */}
                  {wasManual ? (
                    <span className="text-[9px] text-emerald-400/90 font-mono mt-1">manual ✓</span>
                  ) : tok.gloss ? (
                    <span className="text-[9px] text-stone-500 font-mono mt-1">auto</span>
                  ) : null}
                </div>
              );
            })}
          </div>

          {/* Action Buttons Bar */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            <div className="flex items-center space-x-2">
              {/* Save Button */}
              <button
                type="button"
                onClick={handleSaveManualGloss}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-rose-600 via-rose-500 to-pink-600 hover:from-rose-500 hover:to-pink-500 text-white text-xs font-bold flex items-center space-x-1.5 shadow-md shadow-rose-950/60 transition-all active:scale-95 cursor-pointer"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Guardar glosas</span>
              </button>

              {/* Cancel Button */}
              <button
                type="button"
                onClick={handleCancelManualGloss}
                className="px-3.5 py-2 rounded-xl bg-[#28130c] hover:bg-[#361910] border border-[#4a2217] text-stone-300 hover:text-white text-xs font-semibold flex items-center space-x-1.5 transition-all cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
                <span>Cancelar</span>
              </button>
            </div>

            {/* Clear Button */}
            <button
              type="button"
              onClick={handleClearAllGlosses}
              className="px-2.5 py-1.5 rounded-xl text-stone-400 hover:text-rose-300 text-xs font-medium transition-colors cursor-pointer"
            >
              Limpiar campos
            </button>
          </div>
        </div>
      ) : (
        /* ============================================================ */
        /* STANDARD VIEW (Text/Interlinear + Audio & Manual Buttons)   */
        /* ============================================================ */
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

            {/* Debajo del botón de audio: Glosar manualmente */}
            <button
              type="button"
              onClick={handleOpenManualGloss}
              aria-label="Glosar manualmente"
              title="Glosar manualmente este segmento"
              className="relative w-10 h-10 sm:w-11 sm:h-11 rounded-2xl flex items-center justify-center transition-all shadow-md active:scale-95 cursor-pointer bg-[#2a130b] hover:bg-[#38190e] border border-[#482015] hover:border-rose-500/60 text-stone-200 hover:text-white"
            >
              <Languages className="w-4 h-4 sm:w-5 sm:h-5 text-rose-400" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default TextParagraphItem;
