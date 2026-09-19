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

  const effectiveRate = Math.max(0.5, Math.min(2.0, typeof rate === 'number' ? rate : 1.0));

  let msPerChar = 68;
  if (targetLang === 'zh' || /[\u4E00-\u9FFF]/.test(text)) {
    msPerChar = 220;
  } else if (targetLang === 'ar' || /[\u0600-\u06FF]/.test(text)) {
    msPerChar = 85;
  } else if (targetLang === 'ru') {
    msPerChar = 75;
  }

  const baseDuration = len * msPerChar;
  return Math.max(400, baseDuration / effectiveRate);
}

/**
 * Creates an authoritative, boundary-driven audio token synchronizer.
 * 
 * Architecture:
 * 1. Monotonic token character range mapping against spoken text.
 * 2. Real-time boundary snapping on SpeechSynthesisUtterance.onboundary events (Single Source of Truth).
 * 3. Zero artificial catch-up queues, zero arbitrary lookaheads, zero fake progressive animations.
 * 4. Clean lifecycle management (onstart, onboundary, onpause, onresume, onend, onerror, stop).
 * 5. Structured DEV-mode diagnostics to measure exact timing between WebSpeech events and token ranges.
 */
export function createAudioWordSynchronizer({
  text = '',
  tokens = [],
  targetLang = 'es',
  speechRate = 1.0,
  onActiveCharChange = () => {},
  debug = false
}) {
  const cleanText = normalizeAudioText(text);
  const textLength = cleanText.length;
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

  let isRunning = false;
  let activeTokenPos = -1; // Index in wordTokens
  let highestVisitedTokenPos = -1;
  let boundaryCount = 0;
  const effectiveRate = Math.max(0.5, Math.min(2.0, typeof speechRate === 'number' ? speechRate : 1.0));

  function setActiveTokenPos(pos, isSnap = false) {
    if (wordTokens.length === 0) return;
    const clampedPos = Math.max(0, Math.min(wordTokens.length - 1, pos));

    // Monotonic progression: during speech, do not jump backwards
    if (!isSnap && clampedPos < highestVisitedTokenPos) {
      return;
    }

    activeTokenPos = clampedPos;
    if (clampedPos > highestVisitedTokenPos) {
      highestVisitedTokenPos = clampedPos;
    }

    const tok = wordTokens[clampedPos];
    if (tok) {
      onActiveCharChange(tok.startChar);
    }
  }

  function handleStart(event) {
    isRunning = true;
    boundaryCount = 0;
    activeTokenPos = 0;
    highestVisitedTokenPos = 0;

    const startTime = (typeof performance !== 'undefined' ? performance.now() : Date.now());

    if (debug) {
      console.log('[TTS_DEV_DEBUG:onstart]', {
        timestamp: startTime,
        text: cleanText,
        textLength,
        targetLang,
        speechRate: effectiveRate,
        wordTokensCount: wordTokens.length
      });
    }

    setActiveTokenPos(0, true);
  }

  function handleBoundary(event) {
    if (!isRunning || wordTokens.length === 0) return;
    boundaryCount++;

    const charIndex = typeof event?.charIndex === 'number' ? event.charIndex : -1;
    if (charIndex < 0) return;

    const matchedTokenIdx = findActiveTokenIndex(charIndex, tokenRanges);
    const matchedWordPos = wordTokens.findIndex(wt => wt.tokenIndex === matchedTokenIdx);
    
    const now = (typeof performance !== 'undefined' ? performance.now() : Date.now());
    const elapsedTime = typeof event?.elapsedTime === 'number' ? event.elapsedTime : null;

    if (debug) {
      console.log('[TTS_DEV_DEBUG:onboundary]', {
        timestamp: now,
        elapsedTime,
        charIndex,
        charLength: event?.charLength,
        name: event?.name,
        tokenIndex: matchedTokenIdx,
        token: tokenRanges[matchedTokenIdx]?.word || '',
        activeTokenIndex: matchedTokenIdx,
        matchedWordPos
      });
    }

    if (matchedWordPos >= 0) {
      // Ensure monotonic forward movement
      const targetPos = Math.max(highestVisitedTokenPos, matchedWordPos);
      setActiveTokenPos(targetPos, true);
    }
  }

  function handlePause(event) {
    if (debug) {
      console.log('[TTS_DEV_DEBUG:onpause]', {
        timestamp: (typeof performance !== 'undefined' ? performance.now() : Date.now()),
        activeTokenPos
      });
    }
  }

  function handleResume(event) {
    if (debug) {
      console.log('[TTS_DEV_DEBUG:onresume]', {
        timestamp: (typeof performance !== 'undefined' ? performance.now() : Date.now()),
        activeTokenPos
      });
    }
  }

  function handleEnd(event) {
    isRunning = false;
    if (debug) {
      console.log('[TTS_DEV_DEBUG:onend]', {
        timestamp: (typeof performance !== 'undefined' ? performance.now() : Date.now()),
        highestVisitedTokenPos,
        lastToken: wordTokens[highestVisitedTokenPos]?.word || null,
        totalWordTokens: wordTokens.length
      });
    }
    onActiveCharChange(-1);
  }

  function stop() {
    isRunning = false;
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
