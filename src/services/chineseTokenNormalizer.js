/**
 * Chinese Token Normalizer
 * 
 * Robust normalization layer for Chinese tokens received from Groq.
 * Detects and repairs:
 * 1. Oversized tokens (whole sentences instead of words)
 * 2. Missing Pinyin in token segments
 * 3. Incomplete text coverage
 * 4. Punctuation issues
 * 
 * Uses dictionary-based word segmentation and local Pinyin recovery.
 */

import { pinyin as generatePinyin } from 'pinyin-pro';
import { segmentChineseWords } from './chineseWordSegmentation.js';

import { CHINESE_OFFLINE_DICT } from './languageGlossStrategies.js';

// Reject Hanzi accidentally returned in the pronunciation field.
function isUsablePinyin(value) {
  return typeof value === 'string' && /[a-züà-ǜ]/i.test(value)
    && !/[\u3400-\u9FFF]/.test(value);
}

export function resolveChinesePinyin(token) {
  const word = typeof token === 'string' ? token : (token?.word || token?.text || token?.clean_word || '');
  if (!/[\u3400-\u9FFF]/.test(word)) return null;
  for (const value of [token?.pinyin, token?.translit, token?.auxiliary]) {
    if (isUsablePinyin(value)) return value.trim();
  }
  return generatePinyin(word, { toneType: 'symbol', nonZh: 'consecutive' });
}

/**
 * Validates if Groq tokens properly cover the entire text
 * @param {string} text - Original Chinese text
 * @param {Array} tokens - Tokens from Groq
 * @returns {object} { isValid: boolean, coverage: number, issues: Array<string> }
 */
export function validateChineseTokens(text, tokens) {
  if (!text || !Array.isArray(tokens)) {
    return { isValid: false, coverage: 0, issues: ['No text or tokens provided'] };
  }

  const issues = [];
  let reconstructed = '';

  // Extract the actual text content from tokens
  for (const token of tokens) {
    const word = token.word || token.text || '';
    reconstructed += word;
  }

  // Check full coverage
  const coverage = (reconstructed.length / text.length) * 100;
  if (coverage < 95) {
    issues.push(`Low text coverage: ${coverage.toFixed(1)}% (expected ≥95%)`);
  }

  // Length alone cannot detect wrong or reordered words. Such tokens leave
  // the chat renderer stuck at a mismatch and force character fallbacks.
  if (reconstructed.replace(/\s+/g, '') !== text.replace(/\s+/g, '')) {
    issues.push('Token text does not match the message');
  }

  // Check for oversized tokens (whole sentence as single token)
  for (const token of tokens) {
    const word = token.word || token.text || '';
    // If token is very long and contains multiple CJK chars + logical structure, it's suspicious
    if (word.length > 8 && (word.match(/[\u4E00-\u9FFF]/g) || []).length > 3) {
      // Multi-character token is OK, but if it has sentence-like characteristics, flag it
      if (/[。！？；，、：]+/.test(word)) {
        issues.push(`Oversized token detected: "${word}" (contains punctuation within)`);
      }
    }
  }

  // Check for missing Pinyin
  for (const token of tokens) {
    const word = token.word || token.text || '';
    const translit = token.translit || token.pinyin || '';
    const isChinese = /[\u4E00-\u9FFF]/.test(word);

    if (isChinese && !isUsablePinyin(translit)) {
      issues.push(`No Pinyin for token: "${word}"`);
    }
  }

  // Detect character-by-character over-fragmentation:
  // \u22653 consecutive single-CJK-char tokens whose concatenation contains a known word
  // in the offline dictionary. If yes, we should merge them back into words.
  for (let i = 0; i < tokens.length; i++) {
    let run = 0;
    let buf = '';
    while (i + run < tokens.length) {
      const w = tokens[i + run].word || tokens[i + run].text || '';
      if (w.length === 1 && /[\u4E00-\u9FFF]/.test(w)) {
        buf += w;
        run++;
      } else {
        break;
      }
    }
    if (run >= 3) {
      // Any 2..6-char substring in dictionary?
      let mergeable = false;
      outer: for (let s = 0; s < buf.length; s++) {
        for (let len = Math.min(6, buf.length - s); len >= 2; len--) {
          if (CHINESE_OFFLINE_DICT[buf.slice(s, s + len)]) {
            mergeable = true;
            break outer;
          }
        }
      }
      if (mergeable) {
        issues.push(`Over-fragmentation: "${buf}" split character-by-character`);
      }
      i += run - 1;
    }
  }

  // Detect any token boundary inside a dictionary word, including just
  // two adjacent characters (压力) and partially split compounds.
  {
    const boundaries = new Set();
    let offset = 0;
    for (const token of tokens) {
      offset += (token.word || token.text || '').length;
      boundaries.add(offset);
    }
    for (const segment of segmentChineseWords(text)) {
      if (!segment.isWordLike || !/[\u4E00-\u9FFF]/.test(segment.segment)) continue;
      for (let i = segment.index + 1; i < segment.index + segment.segment.length; i++) {
        if (boundaries.has(i)) {
          issues.push(`Split Chinese word: "${segment.segment}"`);
          break;
        }
      }
    }
  }

  return {
    isValid: issues.length === 0,
    coverage: coverage,
    issues
  };
}

/**
 * Detects if tokens are problematic (oversized, missing pinyin, incomplete)
 * @param {string} text
 * @param {Array} tokens
 * @returns {boolean}
 */
export function areTokensProblematic(text, tokens) {
  const validation = validateChineseTokens(text, tokens);
  return !validation.isValid;
}

/** Recover malformed tokens using device-independent dictionary segmentation. */
function segmentFullChineseText(text, sourceTokens = []) {
  if (!text) return [];

  const knownPinyin = new Map();
  const knownTokens = new Map(sourceTokens.map(token => [token?.word || token?.text, token]));
  for (const token of sourceTokens) {
    const word = String(token?.word || token?.text || '').trim();
    const pinyin = token?.translit || token?.pinyin || null;
    if (word && isUsablePinyin(pinyin)) knownPinyin.set(word, pinyin);
  }

  const result = [];
  try {
    for (const segment of segmentChineseWords(text)) {
      const word = segment.segment;
      if (!word || /^\s+$/.test(word)) continue;

      const isPunctuation = !segment.isWordLike || /^[，。！？；：、“”‘’（）《》…—,.!?;:'"()\-]+$/.test(word);
      const entry = isPunctuation ? null : CHINESE_OFFLINE_DICT[word];
      const pinyin = isPunctuation
        ? null
        : (knownPinyin.get(word) || entry?.pinyin || composePinyinFromChars(word) || null);

      result.push({
        ...knownTokens.get(word),
        word,
        text: word,
        translit: pinyin,
        pinyin,
        gloss: knownTokens.get(word)?.gloss || entry?.gloss || null,
        isPunctuation
      });
    }
  } catch (_) {
    return [];
  }

  return result;
}

/**
 * Resegments oversized Chinese tokens using the offline vocabulary and full word dictionary.
 * Strategy: dict longest-match first (gives pinyin), then the full word dictionary for
 * unknown words (gives word grouping even for proper nouns / rare vocabulary),
 * then single char with dict lookup.
 * @param {string} text - The oversized token word
 * @returns {Array} Array of resegmented token objects
 */
function resegmentOversizedToken(text) {
  const result = [];
  let i = 0;

  while (i < text.length) {
    const remaining = text.slice(i);

    // Punctuation
    const punctMatch = remaining.match(/^([，。！？；：、""''（）《》…—]+)/);
    if (punctMatch) {
      result.push({
        word: punctMatch[1],
        text: punctMatch[1],
        translit: null,
        pinyin: null,
        isPunctuation: true
      });
      i += punctMatch[1].length;
      continue;
    }

    // Try dictionary match (longest first)
    let dictMatched = false;
    for (let len = Math.min(6, remaining.length); len >= 2; len--) {
      const candidate = remaining.slice(0, len);
      if (CHINESE_OFFLINE_DICT[candidate]) {
        const entry = CHINESE_OFFLINE_DICT[candidate];
        result.push({
          word: candidate,
          text: candidate,
          translit: entry.pinyin || null,
          pinyin: entry.pinyin || null,
          gloss: entry.gloss || null,
          isPunctuation: false
        });
        i += len;
        dictMatched = true;
        break;
      }
    }
    if (dictMatched) continue;

    // Full word dictionary fallback \u2014 groups CJK chars into words even when the dict
    // does not know the compound (proper nouns like \u5E03\u5B9C\u8BFA\u65AF\u827E\u5229\u65AF, or idioms
    // like \u6D41\u8FDE\u5FD8\u8FD4). Pinyin comes from dict per token; if absent, stays null.
    if (/^[\u4E00-\u9FFF]/.test(remaining)) {
      let runEnd = 0;
      while (runEnd < remaining.length && /[\u4E00-\u9FFF]/.test(remaining[runEnd])) {
        runEnd++;
      }
      const run = remaining.slice(0, runEnd);
      let firstSeg = null;
      for (const s of segmentChineseWords(run)) { firstSeg = s.segment; break; }
      if (firstSeg && firstSeg.length >= 2) {
        const entry = CHINESE_OFFLINE_DICT[firstSeg];
        result.push({
          word: firstSeg,
          text: firstSeg,
          translit: entry?.pinyin || null,
          pinyin: entry?.pinyin || null,
          gloss: entry?.gloss || null,
          isPunctuation: false
        });
        i += firstSeg.length;
        continue;
      }
    }

    // Single CJK character (last resort)
    if (/^[\u4E00-\u9FFF]/.test(remaining)) {
      const char = remaining[0];
      const entry = CHINESE_OFFLINE_DICT[char];
      result.push({
        word: char,
        text: char,
        translit: entry?.pinyin || null,
        pinyin: entry?.pinyin || null,
        gloss: entry?.gloss || null,
        isPunctuation: false
      });
      i += 1;
      continue;
    }

    // Latin/numbers
    const wordMatch = remaining.match(/^[a-zA-Z0-9]+/);
    if (wordMatch) {
      result.push({
        word: wordMatch[0],
        text: wordMatch[0],
        translit: null,
        pinyin: null,
        isPunctuation: false
      });
      i += wordMatch[0].length;
      continue;
    }

    // Fallback: single character
    const single = remaining[0];
    result.push({
      word: single,
      text: single,
      translit: null,
      pinyin: null,
      isPunctuation: /[\s，。！？；：、""''（）《》…—]/.test(single)
    });
    i += 1;
  }

  return result;
}

/**
 * Normalizes Chinese tokens from Groq response
 * 
 * This is the main entry point. It:
 * 1. Validates token coverage and structure
 * 2. Detects oversized tokens and resegments them
 * 3. Fills in missing Pinyin from dictionary
 * 4. Ensures all text is covered
 * 
 * @param {string} originalText - The original Chinese text from bot
 * @param {Array} groqTokens - Tokens returned by Groq
 * @returns {Array} Normalized, reliable tokens
 */
export function normalizeChineseTokens(originalText, groqTokens) {
  if (!originalText || typeof originalText !== 'string') {
    return [];
  }

  const sourceTokens = Array.isArray(groqTokens) ? groqTokens : [];

  // A chat response can arrive without its optional token array. Build a
  // deterministic word-level representation instead of falling back to bare
  // characters, so existing messages also regain segmentation and pinyin.
  if (sourceTokens.length === 0) {
    const platformSegments = segmentFullChineseText(originalText, sourceTokens);
    return (platformSegments.length > 0
      ? platformSegments
      : mergeSingleCharsUsingDict(resegmentOversizedToken(originalText))
    ).map(token => ensureTokenHasPinyin(token));
  }

  const validation = validateChineseTokens(originalText, sourceTokens);

  // If tokens are valid and complete, return as-is (with pinyin filled)
  if (validation.isValid) {
    // A response can have complete coverage and Pinyin while still arriving
    // as adjacent individual Hanzi (for example 我 / 们).  Coverage alone is
    // not enough for the interlinear UI: merge only dictionary-confirmed
    // compounds so those messages remain word-based without inventing terms.
    return mergeSingleCharsUsingDict(
      sourceTokens.map(token => ensureTokenHasPinyin(token))
    ).map(token => ensureTokenHasPinyin(token));
  }

  console.warn('Chinese tokens validation issues:', validation.issues);

  // Recover malformed/incomplete AI responses with the full word dictionary.
  const platformSegments = segmentFullChineseText(originalText, sourceTokens);
  if (platformSegments.length > 0) {
    // Keep the existing offline vocabulary merges after lexical segmentation.
    return mergeSingleCharsUsingDict(platformSegments)
      .map(token => ensureTokenHasPinyin(token));
  }

  // Keep the existing recovery path if dictionary segmentation fails.
  const normalizedTokens = [];

  for (const token of sourceTokens) {
    const word = token.word || token.text || '';
    const isChinese = /[\u4E00-\u9FFF]/.test(word);

    if (!isChinese) {
      // Non-Chinese token, keep as-is
      normalizedTokens.push(ensureTokenHasPinyin(token));
      continue;
    }

    // Check if this token is oversized (more than 4-5 CJK chars = likely wrong)
    const chineseCharCount = (word.match(/[\u4E00-\u9FFF]/g) || []).length;
    
    if (chineseCharCount > 5 || (chineseCharCount > 3 && /[。！？；，、：]+/.test(word))) {
      // Oversized token - resegment it
      console.warn(`Resegmenting oversized token: "${word}"`);
      const resegmented = resegmentOversizedToken(word);
      normalizedTokens.push(...resegmented);
    } else {
      // Normal-sized token, ensure it has Pinyin
      normalizedTokens.push(ensureTokenHasPinyin(token));
    }
  }

  // Final pass: ensure ALL original text is covered
  const repaired = repairTextCoverage(originalText, normalizedTokens);
  // Merge accidental character-by-character splits back into words via the offline dict
  const merged = mergeSingleCharsUsingDict(repaired);
  // Final: fill Pinyin on every token that still lacks it (compound entry OR composed from single chars)
  return merged.map(t => ensureTokenHasPinyin(t));
}

/**
 * Merges runs of single-CJK-character tokens back into dictionary words.
 * Deterministic longest-match over the offline dictionary; keeps individual
 * characters untouched when the dictionary does not know a longer form.
 * Never invents Pinyin: transliteration comes from the dictionary entry.
 * @param {Array} tokens
 * @returns {Array}
 */
function mergeSingleCharsUsingDict(tokens) {
  if (!Array.isArray(tokens) || tokens.length === 0) return tokens;

  const result = [];
  let i = 0;
  while (i < tokens.length) {
    const t = tokens[i];
    const w = (t?.word || t?.text || '');
    const isSingleCjk = w.length === 1 && /[一-鿿]/.test(w);

    if (!isSingleCjk) {
      result.push(t);
      i++;
      continue;
    }

    // Collect the run of contiguous single-CJK tokens starting at i
    let j = i;
    let buf = '';
    while (j < tokens.length) {
      const cw = tokens[j]?.word || tokens[j]?.text || '';
      if (cw.length === 1 && /[一-鿿]/.test(cw)) {
        buf += cw;
        j++;
      } else {
        break;
      }
    }

    if (j - i < 2) {
      // Lone single-CJK token, nothing to merge
      result.push(t);
      i++;
      continue;
    }

    // Longest-match walk over buf (dict first; word dictionary for unknown; then single char)
    let p = 0;
    while (p < buf.length) {
      let matchedLen = 1;
      let matchedEntry = null;
      for (let len = Math.min(6, buf.length - p); len >= 2; len--) {
        const cand = buf.slice(p, p + len);
        if (CHINESE_OFFLINE_DICT[cand]) {
          matchedLen = len;
          matchedEntry = CHINESE_OFFLINE_DICT[cand];
          break;
        }
      }
      if (matchedEntry) {
        const word = buf.slice(p, p + matchedLen);
        result.push({
          word,
          text: word,
          translit: matchedEntry.pinyin || null,
          pinyin: matchedEntry.pinyin || null,
          gloss: matchedEntry.gloss || null,
          isPunctuation: false
        });
        p += matchedLen;
        continue;
      }

      // Full word dictionary fallback for unknown compound words
      {
        const rest = buf.slice(p);
        let firstSeg = null;
        for (const s of segmentChineseWords(rest)) { firstSeg = s.segment; break; }
        if (firstSeg && firstSeg.length >= 2) {
          const entry = CHINESE_OFFLINE_DICT[firstSeg];
          result.push({
            word: firstSeg,
            text: firstSeg,
            translit: entry?.pinyin || null,
            pinyin: entry?.pinyin || null,
            gloss: entry?.gloss || null,
            isPunctuation: false
          });
          p += firstSeg.length;
          continue;
        }
      }

      // Preserve the original single-char token (keeps any translit it had)
      result.push(tokens[i + p]);
      p += 1;
    }

    i = j;
  }

  return result;
}

/**
 * Composes Pinyin for a multi-character Chinese word by concatenating the
 * single-character Pinyin values from the offline dictionary. Returns null
 * if any character is missing from the dict (never invents).
 * @param {string} word
 * @returns {string|null}
 */
function composePinyinFromChars(word) {
  if (!word || word.length < 2) return null;
  const parts = [];
  for (const ch of word) {
    if (!/[\u4E00-\u9FFF]/.test(ch)) return null;
    const entry = CHINESE_OFFLINE_DICT[ch];
    if (!entry || !entry.pinyin) return null;
    parts.push(entry.pinyin);
  }
  return parts.join(' ');
}

/** Fill missing or malformed pronunciation using the local Pinyin engine. */
function ensureTokenHasPinyin(token) {
  if (!token) return token;

  const pronunciation = resolveChinesePinyin(token);
  if (!pronunciation) return token;
  return { ...token, translit: pronunciation, pinyin: pronunciation };
}

/**
 * Reconstructs full text coverage if tokens don't cover everything
 * @param {string} originalText
 * @param {Array} tokens
 * @returns {Array} Tokens with gaps filled
 */
function repairTextCoverage(originalText, tokens) {
  if (!tokens || tokens.length === 0) {
    // No tokens, create basic segmentation
    return resegmentOversizedToken(originalText);
  }

  // Reconstruct what tokens cover
  let reconstructed = '';
  for (const token of tokens) {
    reconstructed += (token.word || token.text || '');
  }

  // Check coverage
  if (reconstructed.length >= originalText.length) {
    // Full coverage achieved
    return tokens;
  }

  // Partial coverage - find gaps and resegment
  console.warn(`Text coverage incomplete: ${reconstructed.length}/${originalText.length} chars`);

  const result = [];
  let origPos = 0;
  let tokenIdx = 0;

  while (origPos < originalText.length && tokenIdx < tokens.length) {
    const token = tokens[tokenIdx];
    const tokenWord = token.word || token.text || '';

    // Try to match token in original text
    if (originalText.startsWith(tokenWord, origPos)) {
      result.push(token);
      origPos += tokenWord.length;
      tokenIdx++;
    } else {
      // Gap - resegment next portion
      const remaining = originalText.slice(origPos);
      const gapTokens = resegmentOversizedToken(remaining.slice(0, 20)); // next 20 chars
      
      if (gapTokens.length > 0) {
        result.push(gapTokens[0]);
        origPos += (gapTokens[0].word || gapTokens[0].text || '').length;
      } else {
        // Fallback: add single character
        result.push({
          word: remaining[0],
          text: remaining[0],
          translit: null,
          pinyin: null,
          isPunctuation: true
        });
        origPos += 1;
      }
    }
  }

  // Add remaining tokens
  while (tokenIdx < tokens.length) {
    result.push(tokens[tokenIdx]);
    tokenIdx++;
  }

  // Add any remaining text
  if (origPos < originalText.length) {
    const remaining = originalText.slice(origPos);
    const gapTokens = resegmentOversizedToken(remaining);
    result.push(...gapTokens);
  }

  return result;
}

/**
 * Debug/logging utility to inspect token status
 */
export function inspectChineseTokens(text, tokens) {
  console.group('🔍 Chinese Token Inspection');
  console.log('Original text:', text);
  console.log('Token count:', tokens.length);
  
  let reconstructed = '';
  tokens.forEach((t, idx) => {
    const w = t.word || t.text || '';
    reconstructed += w;
    console.log(`[${idx}] word="${w}" pinyin="${t.translit || t.pinyin || 'MISSING'}" gloss="${t.gloss || '-'}"`);
  });
  
  console.log('Reconstructed:', reconstructed);
  console.log('Coverage:', `${(reconstructed.length / text.length * 100).toFixed(1)}%`);
  console.groupEnd();
}

export { normalizeChineseTokens as normalizeChineseMessageTokens };
