/**
 * Text Document Service
 * Handles data structures, paragraph segmentation, and active draft persistence
 * for the standalone Text Reader in LinguaFlow.
 * 
 * Note: Database and library persistence (IndexedDB/remote) are reserved for a future command.
 */

import { getLanguageMeta } from '../constants/languages.js';

const ACTIVE_DOC_STORAGE_KEY = 'linguaflow_active_text_doc_v1';

/**
 * Helper: Splits a single block of text by terminal punctuation boundaries
 * (. 。 ! ！ ? ؟ ; ؛ and contextual colons : ：).
 * The punctuation mark is strictly preserved attached to the preceding segment!
 */
function splitBlockByPunctuation(block) {
  if (!block || typeof block !== 'string') return [];
  const text = block.trim();
  if (!text) return [];

  // Terminal punctuation: . 。 ! ！ ? ؟ ; ؛
  // Followed by optional closing quote/parenthesis: '"”’»)]}』」
  const terminalRegex = /([.。!！?؟;؛]['"”’»\)\]｝』」]*)/g;
  const segments = [];
  let lastIndex = 0;
  let match;

  while ((match = terminalRegex.exec(text)) !== null) {
    const punctEnd = match.index + match[0].length;
    const punct = match[1];

    // Decimal numbers: e.g. 3.14 should not split
    if (punct.startsWith('.')) {
      const prevChar = match.index > 0 ? text[match.index - 1] : '';
      const nextChar = punctEnd < text.length ? text[punctEnd] : '';
      if (/\d/.test(prevChar) && /\d/.test(nextChar)) {
        continue;
      }
      // Common abbreviations
      const precedingWord = text.slice(Math.max(0, match.index - 4), match.index).toLowerCase();
      if (/^(dr|mr|ms|vs|eg|ie)$/i.test(precedingWord)) {
        continue;
      }
    }

    const candidate = text.slice(lastIndex, punctEnd).trim();
    if (candidate) {
      segments.push(candidate);
      lastIndex = punctEnd;
    }
  }

  const remainder = text.slice(lastIndex).trim();
  if (remainder) {
    segments.push(remainder);
  }

  // Sub-segment non-trivial colons (: or ：)
  const colonSegments = [];
  for (const seg of segments) {
    const colonMatch = seg.match(/(?<!\d)[:：](?!\d)/);
    if (colonMatch && typeof colonMatch.index === 'number') {
      const colonIdx = colonMatch.index;
      const before = seg.slice(0, colonIdx + 1).trim();
      const after = seg.slice(colonIdx + 1).trim();

      const wordsBefore = before.split(/\s+/).filter(Boolean);
      const wordsAfter = after.split(/\s+/).filter(Boolean);

      const isSubstantiveBefore = before.length >= 12 || wordsBefore.length >= 3;
      const isSubstantiveAfter = after.length >= 12 || wordsAfter.length >= 3;

      if (isSubstantiveBefore && isSubstantiveAfter) {
        colonSegments.push(before);
        colonSegments.push(after);
        continue;
      }
    }
    colonSegments.push(seg);
  }

  return colonSegments;
}

/**
 * Helper: Splits an excessively long segment (> 170 chars) at natural pause points
 * (commas, connectors, spaces) without breaking words.
 */
function splitLongSegment(segment, maxLen = 170, minLen = 50) {
  if (!segment || segment.length <= maxLen) return [segment];

  const results = [];
  let remaining = segment.trim();

  while (remaining.length > maxLen) {
    const searchSlice = remaining.slice(0, maxLen);
    let splitIdx = -1;

    // 1. Prefer comma / pause punctuation: , ， ، — – ;
    const pauseMatches = [...searchSlice.matchAll(/[,，،—–…][\s\u2000-\u200b]*/g)];
    for (let i = pauseMatches.length - 1; i >= 0; i--) {
      const matchEnd = pauseMatches[i].index + pauseMatches[i][0].length;
      if (matchEnd >= minLen && matchEnd <= maxLen) {
        splitIdx = matchEnd;
        break;
      }
    }

    // 2. Otherwise prefer whitespace between words
    if (splitIdx === -1) {
      const spaceMatches = [...searchSlice.matchAll(/\s+/g)];
      for (let i = spaceMatches.length - 1; i >= 0; i--) {
        const matchEnd = spaceMatches[i].index;
        if (matchEnd >= minLen && matchEnd <= maxLen) {
          splitIdx = matchEnd;
          break;
        }
      }
    }

    // 3. For CJK scripts without spaces, break at maxLen boundary cleanly
    if (splitIdx === -1 && /[\u4e00-\u9fa5\u3040-\u30ff]/.test(searchSlice)) {
      splitIdx = Math.min(remaining.length, maxLen);
    }

    // Fallback: last space or next space
    if (splitIdx === -1) {
      const lastSpace = searchSlice.lastIndexOf(' ');
      if (lastSpace > 20) {
        splitIdx = lastSpace;
      } else {
        const nextSpace = remaining.indexOf(' ', maxLen);
        if (nextSpace !== -1 && nextSpace < maxLen + 40) {
          splitIdx = nextSpace;
        } else {
          splitIdx = maxLen;
        }
      }
    }

    const chunk = remaining.slice(0, splitIdx).trim();
    if (chunk) results.push(chunk);
    remaining = remaining.slice(splitIdx).trim();
  }

  if (remaining) results.push(remaining);
  return results;
}

/**
 * Centralized natural sentence & sub-paragraph segmentation algorithm.
 * 1. Respects original paragraphs separated by line breaks.
 * 2. Splits into natural sentence units using punctuation (. 。 ! ！ ? ؟ ; ؛ and : when appropriate).
 *    Crucially preserves punctuation attached to the preceding segment.
 * 3. Soft 120-180 char boundary for overly long sentences, splitting at commas or spaces without cutting words.
 * 
 * Shared between Text Reader and YouTube transcript importers.
 * 
 * @param {string} rawText
 * @param {string} [targetLang='zh']
 * @returns {string[]}
 */
export function splitTextIntoNaturalSegments(rawText, targetLang = 'zh') {
  if (!rawText || typeof rawText !== 'string') return [];

  const normalized = rawText.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
  if (!normalized) return [];

  // Level 1: Split by original paragraph line breaks
  const rawParagraphs = normalized.split(/\n+/).map(p => p.trim()).filter(Boolean);
  const naturalSegments = [];

  for (const para of rawParagraphs) {
    // Level 2: Split by sentence punctuation boundaries
    const punctSegments = splitBlockByPunctuation(para);

    for (const punctSeg of punctSegments) {
      // Level 3: Soft length limit (120-180 chars)
      const boundedSegments = splitLongSegment(punctSeg, 170, 50);
      for (const finalSeg of boundedSegments) {
        const clean = finalSeg.trim();
        if (clean) naturalSegments.push(clean);
      }
    }
  }

  return naturalSegments;
}

/**
 * Splits raw input text into natural paragraph units.
 * 
 * @param {string} rawText
 * @param {string} targetLang
 * @returns {Array<{ id: string, index: number, text: string, tokens: Array, glosses: Array, tts: object }>}
 */
export function splitTextIntoParagraphs(rawText, targetLang = 'zh') {
  const segments = splitTextIntoNaturalSegments(rawText, targetLang);
  const langMeta = getLanguageMeta(targetLang);
  const speechCode = langMeta?.speechCode || 'zh-CN';

  return segments.map((text, idx) => ({
    id: `p-${idx + 1}`,
    index: idx,
    text,
    tokens: [],
    glosses: [],
    tts: {
      speechCode,
      rate: 0.95
    }
  }));
}

/**
 * Creates a normalized text document structure ready for future library persistence.
 * 
 * @param {object} params
 * @param {string} [params.id]
 * @param {string} params.title
 * @param {string} params.rawText
 * @param {string} params.targetLang
 * @param {string} params.nativeLang
 * @param {Array} [params.paragraphs]
 * @returns {object} Normalized document object
 */
export function createTextDocument({
  id = null,
  title = '',
  rawText = '',
  targetLang = 'zh',
  nativeLang = 'es',
  paragraphs = null
}) {
  const now = new Date().toISOString();
  const effectiveParagraphs = paragraphs && Array.isArray(paragraphs) && paragraphs.length > 0
    ? paragraphs
    : splitTextIntoParagraphs(rawText, targetLang);

  // Derive a fallback title if empty
  let derivedTitle = (title || '').trim();
  if (!derivedTitle && effectiveParagraphs.length > 0) {
    const firstLine = effectiveParagraphs[0].text.trim();
    derivedTitle = firstLine.slice(0, 40) + (firstLine.length > 40 ? '...' : '');
  }
  if (!derivedTitle) {
    derivedTitle = 'Texto sin título';
  }

  return {
    id: id || `doc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    title: derivedTitle,
    rawText,
    targetLang,
    nativeLang,
    paragraphsCount: effectiveParagraphs.length,
    paragraphs: effectiveParagraphs,
    createdAt: now,
    updatedAt: now
  };
}

/**
 * Save active document draft to localStorage so user doesn't lose text/glosses on tab switch.
 * 
 * @param {object|null} doc
 */
export function saveActiveDocumentDraft(doc) {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;
    if (!doc) {
      localStorage.removeItem(ACTIVE_DOC_STORAGE_KEY);
      return;
    }
    const serialized = JSON.stringify({
      ...doc,
      updatedAt: new Date().toISOString()
    });
    localStorage.setItem(ACTIVE_DOC_STORAGE_KEY, serialized);
  } catch (e) {
    console.warn('Failed to save active text document draft:', e);
  }
}

/**
 * Load active document draft from localStorage.
 * 
 * @returns {object|null}
 */
export function loadActiveDocumentDraft() {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    const raw = localStorage.getItem(ACTIVE_DOC_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && Array.isArray(parsed.paragraphs)) {
      return parsed;
    }
  } catch (e) {
    console.warn('Failed to load active text document draft:', e);
  }
  return null;
}

/**
 * Clears active document draft from localStorage.
 */
export function clearActiveDocumentDraft() {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.removeItem(ACTIVE_DOC_STORAGE_KEY);
    }
  } catch (e) {}
}
