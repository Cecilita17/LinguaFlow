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
 * Uses offline dictionary + Intl.Segmenter as fallback for resegmentation.
 */

import { CHINESE_OFFLINE_DICT } from './languageGlossStrategies.js';

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
    
    if (isChinese && !translit) {
      issues.push(`No Pinyin for token: "${word}"`);
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

/**
 * Resegments oversized Chinese tokens using dictionary + Intl.Segmenter
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

    // Single CJK character
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
  if (!originalText || !Array.isArray(groqTokens) || groqTokens.length === 0) {
    return [];
  }

  const validation = validateChineseTokens(originalText, groqTokens);

  // If tokens are valid and complete, return as-is (with pinyin filled)
  if (validation.isValid) {
    return groqTokens.map(token => ensureTokenHasPinyin(token));
  }

  console.warn('Chinese tokens validation issues:', validation.issues);

  // Tokens are problematic - need repair
  const normalizedTokens = [];

  for (const token of groqTokens) {
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
  return repaired;
}

/**
 * Ensures a token has Pinyin from dictionary if it's Chinese
 * @param {object} token
 * @returns {object}
 */
function ensureTokenHasPinyin(token) {
  if (!token) return token;

  const word = token.word || token.text || '';
  const translit = token.translit || token.pinyin || '';

  // Already has Pinyin
  if (translit && translit.trim()) {
    return token;
  }

  // Is it Chinese?
  const isChinese = /[\u4E00-\u9FFF]/.test(word);
  if (!isChinese) {
    return token;
  }

  // Try to get from dictionary
  const entry = CHINESE_OFFLINE_DICT[word];
  if (entry && entry.pinyin) {
    return {
      ...token,
      translit: entry.pinyin,
      pinyin: entry.pinyin
    };
  }

  // No Pinyin available - return as-is (null is OK)
  return token;
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
