/**
 * Audio Word Synchronization Utilities for LinguaFlow
 * 
 * Provides:
 * 1. Robust token character range mapping against spoken clean text.
 * 2. Active token resolution given a character index (charIndex -> token).
 * 3. Fallback character index estimator based on elapsed time and language speech rates
 *    when browser SpeechSynthesisUtterance.onboundary events are unavailable.
 */

import { PUNCTUATION_REGEX } from '../services/languageGlossStrategies.js';

export function normalizeAudioText(text) {
  if (!text || typeof text !== 'string') return '';
  return text
    .replace(/<[^>]*>/g, '')
    .trim();
}

export function computeTokenCharRanges(rawCleanText, tokens, targetLang = 'es') {
  if (!tokens || !Array.isArray(tokens) || tokens.length === 0) return [];
  const cleanText = normalizeAudioText(rawCleanText);
  if (!cleanText) return [];

  let pos = 0;
  const isChinese = targetLang === 'zh' || /[\u4E00-\u9FFF]/.test(cleanText);

  return tokens.map((tok) => {
    if (!tok) return { startChar: -1, endChar: -1, word: '', isPunctuation: false };

    const rawWord = typeof tok === 'string'
      ? tok
      : (tok.word ?? tok.text ?? tok.clean_word ?? '');
    const word = String(rawWord).trim();
    const isPunctuation = typeof tok === 'object' && typeof tok.isPunctuation === 'boolean'
      ? tok.isPunctuation
      : PUNCTUATION_REGEX.test(word);

    if (!word) {
      return { startChar: -1, endChar: -1, word: '', isPunctuation };
    }

    // Strictly forward search to preserve monotonic sequence and avoid mapping to earlier repeated words
    let foundIdx = cleanText.indexOf(word, pos);

    // Fallback 1: case-insensitive forward search
    if (foundIdx === -1) {
      const lowerClean = cleanText.toLowerCase();
      const lowerWord = word.toLowerCase();
      foundIdx = lowerClean.indexOf(lowerWord, pos);
    }

    // Fallback 2: stripped word forward search (letters/numbers/marks only)
    if (foundIdx === -1) {
      const strippedWord = word.replace(/[^\p{L}\p{N}\p{M}]/gu, '').trim();
      if (strippedWord) {
        foundIdx = cleanText.indexOf(strippedWord, pos);
        if (foundIdx === -1) {
          foundIdx = cleanText.toLowerCase().indexOf(strippedWord.toLowerCase(), pos);
        }
      }
    }

    if (foundIdx !== -1) {
      const endChar = foundIdx + word.length;
      pos = Math.max(pos, endChar);
      return { startChar: foundIdx, endChar, word, isPunctuation };
    }

    // Sequential monotonic fallback positioning
    const startChar = Math.min(cleanText.length, pos);
    const endChar = Math.min(cleanText.length, pos + word.length);
    pos = endChar + (isChinese || isPunctuation ? 0 : 1);
    return { startChar, endChar, word, isPunctuation };
  });
}

/** Split long TTS paragraphs only at punctuation, preserving original offsets. */
export function splitSpeechParagraph(text, tokens = [], targetLang = 'es', maxLength = 50) {
  const cleanText = normalizeAudioText(text);
  if (!cleanText) return [];
  let speechTokens = tokens;
  if (!speechTokens.length) {
    speechTokens = typeof Intl.Segmenter === 'function'
      ? Array.from(new Intl.Segmenter(targetLang, { granularity: 'word' }).segment(cleanText), part => ({ word: part.segment }))
      : (cleanText.match(/\S+|\s+/gu) || []).map(word => ({ word }));
  }
  const ranges = computeTokenCharRanges(cleanText, speechTokens, targetLang);
  // The length target is soft: extending a phrase is preferable to inserting
  // an utterance pause between words. Keep closing quotes with the punctuation.
  const pauseEnds = Array.from(cleanText.matchAll(/[.!?;:,。！？；：，،؛؟…]+[»”’"')\]}]*/gu))
    .filter((match) => {
      const before = cleanText[match.index - 1] || '';
      const after = cleanText[match.index + match[0].length] || '';
      // Numbers such as 3.14, 1,000 and 14:30 are not phrase boundaries.
      if (/^[.,:]$/.test(match[0]) && /\p{N}/u.test(before) && /\p{N}/u.test(after)) return false;
      // Do not cut inside dotted abbreviations or URLs.
      if (match[0] === '.' && /[\p{L}\p{N}]/u.test(after)) return false;
      return true;
    })
    .map((match) => match.index + match[0].length);
  const chunks = [];
  let start = 0;
  while (start < cleanText.length) {
    let end = cleanText.length;
    if (end - start > maxLength) {
      const pausesBeforeTarget = pauseEnds.filter(pauseEnd => pauseEnd - start >= 15 && pauseEnd <= start + maxLength);
      end = pausesBeforeTarget.at(-1)
        || pauseEnds.find(pauseEnd => pauseEnd > start + maxLength)
        || cleanText.length;
    }
    const raw = cleanText.slice(start, end);
    const offset = start + raw.length - raw.trimStart().length;
    const chunkText = raw.trim();
    if (chunkText) chunks.push({
      text: chunkText,
      offset,
      tokens: speechTokens.filter((_, index) => ranges[index].startChar >= offset && ranges[index].endChar <= end)
    });
    start = end;
  }
  return chunks;
}

export function findActiveTokenIndex(charIndex, tokenRanges) {
  if (typeof charIndex !== 'number' || charIndex < 0 || !tokenRanges || tokenRanges.length === 0) {
    return -1;
  }

  for (let i = 0; i < tokenRanges.length; i++) {
    const range = tokenRanges[i];
    if (range && range.startChar !== -1 && charIndex >= range.startChar && charIndex < range.endChar) {
      if (range.isPunctuation) {
        for (let p = i - 1; p >= 0; p--) {
          if (tokenRanges[p] && !tokenRanges[p].isPunctuation && tokenRanges[p].startChar !== -1) {
            return p;
          }
        }
        for (let n = i + 1; n < tokenRanges.length; n++) {
          if (tokenRanges[n] && !tokenRanges[n].isPunctuation && tokenRanges[n].startChar !== -1) {
            return n;
          }
        }
      }
      return i;
    }
  }

  let closestIdx = -1;
  for (let i = 0; i < tokenRanges.length; i++) {
    const range = tokenRanges[i];
    if (range && range.startChar !== -1 && range.startChar <= charIndex) {
      if (!range.isPunctuation) {
        closestIdx = i;
      }
    } else if (range && range.startChar > charIndex) {
      break;
    }
  }

  if (closestIdx === -1) {
    for (let i = 0; i < tokenRanges.length; i++) {
      if (tokenRanges[i] && !tokenRanges[i].isPunctuation && tokenRanges[i].startChar !== -1) {
        return i;
      }
    }
  }

  return closestIdx;
}

export function estimateSpeechDurationMs(text, targetLang = 'es', rate = 1.0) {
  if (!text) return 0;
  const len = text.trim().length;
  if (len === 0) return 0;

  const effectiveRate = Math.max(0.2, Math.min(2.0, typeof rate === 'number' ? rate : 1.0));

  let msPerChar = 68;
  if (targetLang === 'zh' || /[\u4E00-\u9FFF]/.test(text)) {
    msPerChar = 220;
  } else if (targetLang === 'ar' || /[\u0600-\u06FF]/.test(text)) {
    // Arabic browser voices generally speak more slowly than their early boundary
    // callbacks report, especially on Android. Use a conservative visual pace.
    msPerChar = 125;
  } else if (targetLang === 'ru') {
    msPerChar = 75;
  }

  const baseDuration = len * msPerChar;
  return Math.max(400, baseDuration / effectiveRate);
}

/**
 * Calculates the active token index based on current playback time and segment duration.
 * Reusable single-source-of-truth matching the algorithm used in YouTube Reader.
 */
export function calculateActiveTokenIndexFromTime(tokens, currentTime, startTime = 0, endTime = 0) {
  if (!tokens || !Array.isArray(tokens) || tokens.length === 0) return -1;
  const time = typeof currentTime === 'number' && !isNaN(currentTime) ? currentTime : 0;
  const start = typeof startTime === 'number' ? startTime : 0;
  const end = typeof endTime === 'number' && endTime > start ? endTime : start + 4.0;

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
}

/**
 * Calculates the active chunk index for plain text based on current playback time.
 */
export function calculateActiveChunkIndexFromTime(text, currentTime, startTime = 0, endTime = 0) {
  if (!text) return -1;
  const chunks = text.split(/([\s.,!?;:()¿¡'"“”‘’—–\-_/\\`~，。！？；：、“”‘’（）《》…]+)/);
  const time = typeof currentTime === 'number' && !isNaN(currentTime) ? currentTime : 0;
  const start = typeof startTime === 'number' ? startTime : 0;
  const end = typeof endTime === 'number' && endTime > start ? endTime : start + 4.0;
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
}

/**
 * Creates an authoritative, boundary-calibrated continuous audio token synchronizer.
 * 
 * Architecture:
 * 1. Monotonic token character range mapping against spoken text.
 * 2. Absolute time-derived progression: Visual token position is a continuous function
 *    of elapsed absolute time, NEVER a counter of received callbacks.
 * 3. Boundary Auto-Calibration: SpeechSynthesisUtterance.onboundary events serve as
 *    speed calibration anchors rather than instant jump triggers, preventing skipped words.
 * 4. Continuous High-Frequency Interpolation (25ms loop): Smoothly visits every intermediate
 *    word (1 -> 2 -> 3 -> 4 -> 5) even when Android/mobile browsers skip onboundary events.
 * 5. Clean lifecycle management (onstart, onboundary, onpause, onresume, onend, onerror, stop).
 */
export function createAudioWordSynchronizer({
  text = '',
  tokens = [],
  targetLang = 'es',
  speechRate = 1.0,
  utteranceRate = 1.0,
  paragraphId = '',
  playbackId = '',
  onActiveCharChange = () => {},
  getDurationScale = () => 1,
  onDurationMeasured = () => {},
  isAndroid = (typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent || '')),
  debug = false
}) {
  const cleanText = normalizeAudioText(text);
  const textLength = cleanText.length;
  const isArabic = targetLang === 'ar' || /[\u0600-\u06FF]/.test(cleanText);
  const tokenRanges = computeTokenCharRanges(cleanText, tokens, targetLang);

  // Extract valid non-punctuation word tokens
  const wordTokens = [];
  for (let i = 0; i < tokenRanges.length; i++) {
    const tr = tokenRanges[i];
    if (tr && tr.startChar !== -1 && !tr.isPunctuation && tr.word) {
      wordTokens.push({
        tokenIndex: i,
        startChar: tr.startChar,
        endChar: tr.endChar,
        word: tr.word
      });
    }
  }

  // Precalculate cumulative character weight ranges for every word token
  const tokenWeights = wordTokens.map(wt => Math.max(1, wt.word.length));
  const totalWeight = tokenWeights.reduce((sum, w) => sum + w, 0);
  const cumulativeRanges = [];
  let cumWeight = 0;
  for (let i = 0; i < wordTokens.length; i++) {
    const w = tokenWeights[i];
    cumulativeRanges.push({
      startOffset: cumWeight,
      endOffset: cumWeight + w,
      startFraction: totalWeight > 0 ? cumWeight / totalWeight : 0,
      endFraction: totalWeight > 0 ? (cumWeight + w) / totalWeight : 1
    });
    cumWeight += w;
  }

  let isRunning = false;
  let isPaused = false;
  let activeTokenPos = -1; // Index in wordTokens
  let highestVisitedTokenPos = -1;
  let targetBoundaryWordPos = -1;
  let lastConfirmedWordPos = -1;
  let hasConfirmedBoundary = false;
  let lastBoundaryWordPos = -1;
  let lastBoundaryTime = 0;
  let clockBaseTime = 0;
  let clockBaseFraction = 0;
  let boundaryCount = 0;
  let timerId = null;
  let startTime = 0;
  let pausedAt = 0;
  let totalPausedDuration = 0;
  let prevBoundaryWordPos = -1;

  // The engine rate is a nonlinear voice-control value, not a duration ratio.
  // Start from the user's playback speed; completed speech and word events
  // calibrate the estimate for the actual selected voice.
  const effectiveRate = Math.max(0.2, Math.min(2.0, typeof speechRate === 'number' ? speechRate : 1.0));
  const estimatedDurationMs = estimateSpeechDurationMs(cleanText, targetLang, effectiveRate);
  let calibratedDurationMs = estimatedDurationMs;

  function clearTimer() {
    if (timerId !== null) {
      clearInterval(timerId);
      timerId = null;
    }
  }

  function setActiveTokenPos(pos, source = 'snap') {
    if (wordTokens.length === 0) return;
    const isSnap = source === 'snap' || source === 'init' || source === 'boundary';
    const clampedPos = Math.max(0, Math.min(wordTokens.length - 1, pos));

    // Monotonic progression: during speech, do not jump backwards
    if (!isSnap && clampedPos < highestVisitedTokenPos) {
      return;
    }

    // Skip redundant calls if active token hasn't changed
    if (!isSnap && clampedPos === activeTokenPos) {
      return;
    }

    const previousWordPos = activeTokenPos;
    const beforeHighestVisited = highestVisitedTokenPos;

    activeTokenPos = clampedPos;
    if (source === 'boundary') highestVisitedTokenPos = clampedPos;
    if (clampedPos > highestVisitedTokenPos) {
      highestVisitedTokenPos = clampedPos;
    }

    const tok = wordTokens[clampedPos];
    const newActiveChar = tok ? tok.startChar : -1;
    const now = (typeof performance !== 'undefined' ? performance.now() : Date.now());
    const elapsed = startTime > 0 ? Math.round(Math.max(0, now - startTime - totalPausedDuration)) : 0;

    console.log(`[TTS_DIAGNOSTIC_VISUAL]
elapsed=${elapsed}ms
previousWordPos=${previousWordPos}
newWordPos=${clampedPos}
word="${tok?.word || ''}"
startChar=${newActiveChar}
calibratedDurationMs=${Math.round(calibratedDurationMs)}ms
highestVisitedTokenPos=${highestVisitedTokenPos}
targetBoundaryWordPos=${targetBoundaryWordPos}
source=${source}`);

    // --- DIAGNOSTIC: Log Synchronizer state transitions on Android (debug only) ---
    if (debug && isAndroid) {
      console.log(`[TextReaderSync:sync] [playback #${playbackId || 'default'}]
t=${elapsed}ms
activeTokenPos BEFORE: ${previousWordPos}
highestVisitedTokenPos BEFORE: ${beforeHighestVisited}
targetBoundaryWordPos: ${targetBoundaryWordPos}
lastConfirmedWordPos: ${lastConfirmedWordPos}
new activeTokenPos: ${clampedPos} (word="${tok?.word || ''}")
new activeCharIndex: ${newActiveChar}`);

      if (!isSnap && previousWordPos >= 0 && clampedPos - previousWordPos > 1) {
        console.warn(`[TextReaderSync:VISUAL_GAP] [playback #${playbackId || 'default'}] previous=${previousWordPos} current=${clampedPos} gap=${clampedPos - previousWordPos}`);
      }
    }

    if (tok) {
      onActiveCharChange(tok.startChar);
    }
  }

  function tick() {
    if (!isRunning || isPaused || wordTokens.length === 0) return;
    const now = (typeof performance !== 'undefined' ? performance.now() : Date.now());

    // Prefer real word events while they are fresh. Some voices stop emitting
    // them mid-utterance, so resume calibrated pacing after a word-sized grace period.
    if (hasConfirmedBoundary) {
      const range = cumulativeRanges[lastBoundaryWordPos];
      const wordDuration = range ? (range.endFraction - range.startFraction) * calibratedDurationMs : 0;
      const boundaryGraceMs = Math.max(100, Math.min(800, wordDuration));
      if (now - lastBoundaryTime < boundaryGraceMs) return;
    }

    // Use the elapsed-time position on every device. Stepping only one word
    // per tick leaves Android behind after a delayed timer or a long main-thread task.
    // 2. Absolute continuous time progression from calibrated anchor
    const elapsedSinceAnchor = Math.max(0, now - clockBaseTime);
    const safeDuration = Math.max(400, calibratedDurationMs);
    const dFrac = elapsedSinceAnchor / safeDuration;
    const currentFraction = Math.min(1.0, clockBaseFraction + dFrac);

    // Absolute time-derived word position lookup
    const targetOffset = currentFraction * totalWeight;
    let targetPos = 0;
    for (let i = 0; i < cumulativeRanges.length; i++) {
      if (targetOffset < cumulativeRanges[i].endOffset) {
        targetPos = i;
        break;
      }
    }
    if (currentFraction >= 1.0 || targetOffset >= totalWeight) {
      targetPos = wordTokens.length - 1;
    }

    // Advance smoothly and monotonically
    const nextPos = Math.max(highestVisitedTokenPos, targetPos);
    setActiveTokenPos(nextPos, 'temporal_estimate');
  }

  function startTimer() {
    clearTimer();
    if (!isRunning || wordTokens.length === 0) return;

    // High frequency 25ms tick loop guarantees smooth word-by-word visits on mobile & desktop
    timerId = setInterval(() => {
      tick();
    }, 25);
  }

  function handleStart(event) {
    isRunning = true;
    isPaused = false;
    boundaryCount = 0;
    activeTokenPos = 0;
    highestVisitedTokenPos = 0;
    targetBoundaryWordPos = 0;
    lastConfirmedWordPos = -1;
    hasConfirmedBoundary = false;
    lastBoundaryWordPos = 0;
    lastBoundaryTime = 0;
    totalPausedDuration = 0;
    prevBoundaryWordPos = -1;
    const learnedScale = getDurationScale();
    calibratedDurationMs = estimatedDurationMs * (Number.isFinite(learnedScale)
      ? Math.max(0.2, Math.min(4, learnedScale)) : 1);
    startTime = (typeof performance !== 'undefined' ? performance.now() : Date.now());
    clockBaseTime = startTime;
    clockBaseFraction = 0;

    console.log(`[TTS_DIAGNOSTIC_START]
paragraphId=${paragraphId || '(none)'}
targetLang=${targetLang}
speechRate=${speechRate}
utteranceRate=${utteranceRate}
textLength=${textLength}
tokenCount=${Array.isArray(tokens) ? tokens.length : 0}
wordTokenCount=${wordTokens.length}
estimatedDurationMs=${Math.round(estimatedDurationMs)}ms
timestamp=${Math.round(startTime)}`);

    if (debug && isAndroid) {
      console.log(`[TextReaderSync:tokens] [playback #${playbackId || 'default'}]
paragraphId: "${paragraphId}"
cleanText: "${cleanText}"
paragraph.tokens count: ${Array.isArray(tokens) ? tokens.length : 0}
wordTokens count: ${wordTokens.length}
wordTokens:
${wordTokens.map((wt, idx) => `  wordPos=${idx} tokenIndex=${wt.tokenIndex} word="${wt.word}" start=${wt.startChar} end=${wt.endChar}`).join('\n')}`);
    }

    if (debug) {
      console.log('[TTS_DEV_DEBUG:onstart]', {
        timestamp: startTime,
        text: cleanText,
        textLength,
        targetLang,
        speechRate: effectiveRate,
        estimatedDurationMs,
        wordTokensCount: wordTokens.length
      });
    }

    setActiveTokenPos(0, 'init');
    startTimer();
  }

  function handleBoundary(event) {
    if (!isRunning || wordTokens.length === 0) return;
    boundaryCount++;

    const charIndex = typeof event?.charIndex === 'number' ? event.charIndex : -1;
    if (charIndex < 0) return;

    const matchedTokenIdx = findActiveTokenIndex(charIndex, tokenRanges);
    const matchedWordPos = wordTokens.findIndex(wt => wt.tokenIndex === matchedTokenIdx);

    const now = (typeof performance !== 'undefined' ? performance.now() : Date.now());
    const elapsed = Math.max(0, now - startTime - totalPausedDuration);

    const calBefore = Math.round(calibratedDurationMs);

    if (isAndroid) {
      const matchedWord = matchedWordPos >= 0 ? wordTokens[matchedWordPos]?.word : '(none)';
      console.log(`[TextReaderSync:boundary] [playback #${playbackId || 'default'}]
t=${Math.round(elapsed)}ms
charIndex=${charIndex}
charLength=${event?.charLength ?? 'N/A'}
name="${event?.name || 'word'}"
tokenIndex=${matchedTokenIdx}
wordPos=${matchedWordPos}
word="${matchedWord}"`);

      if (matchedWordPos >= 0 && prevBoundaryWordPos >= 0 && matchedWordPos - prevBoundaryWordPos > 1) {
        console.warn(`[TextReaderSync:BOUNDARY_GAP] [playback #${playbackId || 'default'}] previous=${prevBoundaryWordPos} current=${matchedWordPos} gap=${matchedWordPos - prevBoundaryWordPos}`);
      }
      if (matchedWordPos >= 0) {
        prevBoundaryWordPos = matchedWordPos;
      }
    }

    if (matchedWordPos >= 0) {
      const boundaryFraction = cumulativeRanges[matchedWordPos]?.startFraction || 0;

      // Speed calibration between consecutive boundaries
      if (lastBoundaryWordPos >= 0 && matchedWordPos > lastBoundaryWordPos && lastBoundaryTime > 0) {
        const dt = now - lastBoundaryTime;
        const dFrac = boundaryFraction - (cumulativeRanges[lastBoundaryWordPos]?.startFraction || 0);
        if (dFrac > 0.02 && dt > 40) {
          const boundaryEstimatedTotal = dt / dFrac;
          const minSafe = estimatedDurationMs * 0.35;
          const maxSafe = estimatedDurationMs * 2.8;
          const clamped = Math.max(minSafe, Math.min(maxSafe, boundaryEstimatedTotal));
          calibratedDurationMs = 0.2 * calibratedDurationMs + 0.8 * clamped;
        }
      } else if (!isArabic && boundaryFraction > 0.05 && elapsed > 150) {
        const empiricalDuration = elapsed / boundaryFraction;
        const minSafe = estimatedDurationMs * 0.35;
        const maxSafe = estimatedDurationMs * 2.8;
        const clampedEmpirical = Math.max(minSafe, Math.min(maxSafe, empiricalDuration));
        calibratedDurationMs = 0.65 * calibratedDurationMs + 0.35 * clampedEmpirical;
      }

      lastBoundaryWordPos = matchedWordPos;
      lastBoundaryTime = now;

      // Every language uses the same character positions reported by its voice.
      // A fresh boundary also corrects any drift from fallback pacing.
      clockBaseTime = now;
      clockBaseFraction = boundaryFraction;
      hasConfirmedBoundary = true;
      lastConfirmedWordPos = matchedWordPos;
      targetBoundaryWordPos = matchedWordPos;
      setActiveTokenPos(matchedWordPos, 'boundary');
    }

    const calAfter = Math.round(calibratedDurationMs);
    const matchedWord = matchedWordPos >= 0 ? wordTokens[matchedWordPos]?.word : '(none)';

    console.log(`[TTS_DIAGNOSTIC_BOUNDARY]
elapsed=${Math.round(elapsed)}ms
charIndex=${charIndex}
charLength=${event?.charLength ?? 'N/A'}
name="${event?.name || 'word'}"
matchedTokenIdx=${matchedTokenIdx}
matchedWordPos=${matchedWordPos}
word="${matchedWord}"
calibratedDurationBefore=${calBefore}ms
calibratedDurationAfter=${calAfter}ms
targetBoundaryWordPos=${targetBoundaryWordPos}
highestVisitedTokenPos=${highestVisitedTokenPos}`);

    if (debug) {
      console.log('[TTS_DEV_DEBUG:onboundary]', {
        timestamp: now,
        charIndex,
        charLength: event?.charLength,
        name: event?.name,
        tokenIndex: matchedTokenIdx,
        token: tokenRanges[matchedTokenIdx]?.word || '',
        matchedWordPos,
        targetBoundaryWordPos,
        calibratedDurationMs
      });
    }
  }

  function handlePause(event) {
    isPaused = true;
    pausedAt = (typeof performance !== 'undefined' ? performance.now() : Date.now());
    clearTimer();
    if (debug) {
      console.log('[TTS_DEV_DEBUG:onpause]', {
        timestamp: pausedAt,
        activeTokenPos
      });
    }
  }

  function handleResume(event) {
    if (isPaused) {
      isPaused = false;
      const now = (typeof performance !== 'undefined' ? performance.now() : Date.now());
      if (pausedAt > 0) {
        const pauseDt = Math.max(0, now - pausedAt);
        totalPausedDuration += pauseDt;
        clockBaseTime += pauseDt;
        if (lastBoundaryTime > 0) {
          lastBoundaryTime += pauseDt;
        }
      }
      startTimer();
      if (debug) {
        console.log('[TTS_DEV_DEBUG:onresume]', {
          timestamp: now,
          activeTokenPos,
          totalPausedDuration
        });
      }
    }
  }

  function handleEnd(event) {
    const completed = isRunning;
    isRunning = false;
    isPaused = false;
    clearTimer();

    const now = (typeof performance !== 'undefined' ? performance.now() : Date.now());
    const actualDurationMs = startTime > 0 ? Math.round(Math.max(0, now - startTime - totalPausedDuration)) : 0;
    if (completed && actualDurationMs >= 250 && cleanText.length >= 10 && estimatedDurationMs > 0) {
      onDurationMeasured({ actualDurationMs, estimatedDurationMs });
    }
    const estDur = Math.round(estimatedDurationMs);
    const calDur = Math.round(calibratedDurationMs);
    const durationRatio = estDur > 0 ? (actualDurationMs / estDur).toFixed(3) : 'N/A';
    const lastWord = highestVisitedTokenPos >= 0 && wordTokens[highestVisitedTokenPos]
      ? wordTokens[highestVisitedTokenPos].word
      : '(none)';

    console.log(`[TTS_DIAGNOSTIC_END]
actualDurationMs=${actualDurationMs}ms
estimatedDurationMs=${estDur}ms
finalCalibratedDurationMs=${calDur}ms
durationRatio=${durationRatio}
lastWord="${lastWord}"
boundaryCount=${boundaryCount}
highestVisitedTokenPos=${highestVisitedTokenPos}
totalWordTokens=${wordTokens.length}`);

    if (debug) {
      console.log('[TTS_DEV_DEBUG:onend]', {
        timestamp: now,
        highestVisitedTokenPos,
        lastToken: lastWord,
        totalWordTokens: wordTokens.length
      });
    }
    onActiveCharChange(-1);
  }

  function stop() {
    isRunning = false;
    isPaused = false;
    clearTimer();
    onActiveCharChange(-1);
  }

  return {
    handleStart,
    handleBoundary,
    handlePause,
    handleResume,
    handleEnd,
    stop,
    wordTokens,
    tokenRanges,
    getActiveTokenPos: () => activeTokenPos,
    getHighestVisitedTokenPos: () => highestVisitedTokenPos,
    getBoundaryCount: () => boundaryCount
  };
}
