/**
 * Text Document Service
 * Handles data structures, paragraph segmentation, active draft, and
 * persistent library storage for the standalone Text Reader in LinguaFlow.
 */

import { getLanguageMeta } from '../constants/languages.js';
import { API_BASE_URL } from './chatService.js';
import { tokenizeAndGlossLineOffline } from './subtitleGlossService.js';
import { upload } from '@vercel/blob/client';
import {
  saveTextDocument,
  getTextDocumentById,
  getAllTextDocuments,
  deleteTextDocument,
  getTextDocumentsCount,
  clearTextLibrary,
  migrateFromLocalStorage
} from './textLibraryStorage.js';

export {
  saveTextDocument,
  getTextDocumentById,
  getAllTextDocuments,
  deleteTextDocument,
  getTextDocumentsCount,
  clearTextLibrary,
  migrateFromLocalStorage
};

export const ACTIVE_DOC_STORAGE_KEY = 'linguaflow_active_text_doc_v1';
export const LIBRARY_DOCS_STORAGE_KEY = 'linguaflow_text_library_v1'; // Legacy key for migration purposes only

// In-memory fallback for active working draft
let memoryActiveDraft = null;

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
export function splitTextIntoParagraphs(rawText, targetLang = 'zh', nativeLang = 'es') {
  const segments = splitTextIntoNaturalSegments(rawText, targetLang);
  const langMeta = getLanguageMeta(targetLang);
  const speechCode = langMeta?.speechCode || 'zh-CN';

  return segments.map((text, idx) => ({
    id: `p-${idx + 1}`,
    index: idx,
    text,
    tokens: tokenizeAndGlossLineOffline(text, targetLang, nativeLang),
    glosses: [],
    tts: {
      speechCode,
      rate: 1.0
    }
  }));
}

/**
 * Helper: Normalizes text for deterministic audio segment alignment.
 * Strips punctuation, whitespace, and symbols across all scripts while preserving Unicode letter/number identity.
 */
function normalizeForAudioMatching(str) {
  if (!str || typeof str !== 'string') return '';
  return str.toLowerCase().replace(/[\p{P}\p{S}\s]+/gu, '').trim();
}

/**
 * Deterministically aligns paragraphs with Groq Whisper audio segments.
 * Computes exact audioStart and audioEnd timestamps for each paragraph without AI calls.
 * If a paragraph cannot be safely aligned, sets audioStart: null and audioEnd: null.
 *
 * @param {Array<object>} paragraphs
 * @param {Array<object>} audioSegments - Whisper verbose_json segments [{ start, end, text }, ...]
 * @returns {Array<object>}
 */
export function alignParagraphsWithAudioSegments(paragraphs, audioSegments) {
  if (!Array.isArray(paragraphs) || paragraphs.length === 0) return paragraphs || [];
  if (!Array.isArray(audioSegments) || audioSegments.length === 0) {
    return paragraphs.map(p => ({
      ...p,
      audioStart: typeof p?.audioStart === 'number' ? p.audioStart : null,
      audioEnd: typeof p?.audioEnd === 'number' ? p.audioEnd : null
    }));
  }

  // 1. Build cumulative segment stream with character offsets
  const segStream = [];
  let cumChar = 0;
  for (const seg of audioSegments) {
    const norm = normalizeForAudioMatching(seg.text);
    if (!norm) continue;
    const startChar = cumChar;
    const endChar = cumChar + norm.length;
    segStream.push({
      start: typeof seg.start === 'number' ? seg.start : 0,
      end: typeof seg.end === 'number' ? seg.end : 0,
      norm,
      startChar,
      endChar
    });
    cumChar = endChar;
  }

  if (segStream.length === 0 || cumChar === 0) {
    return paragraphs.map(p => ({
      ...p,
      audioStart: typeof p?.audioStart === 'number' ? p.audioStart : null,
      audioEnd: typeof p?.audioEnd === 'number' ? p.audioEnd : null
    }));
  }

  const allSegChars = segStream.map(s => s.norm).join('');

  function getTimeAtChar(charIdx, isEnd = false) {
    const bounded = Math.max(0, Math.min(charIdx, cumChar));
    for (let i = 0; i < segStream.length; i++) {
      const s = segStream[i];
      if (bounded >= s.startChar && bounded <= s.endChar) {
        if (bounded === s.startChar) return s.start;
        if (bounded === s.endChar) return s.end;
        const frac = (bounded - s.startChar) / Math.max(1, s.endChar - s.startChar);
        return Math.round((s.start + frac * (s.end - s.start)) * 100) / 100;
      }
    }
    return isEnd ? segStream[segStream.length - 1].end : 0;
  }

  // 2. Align each paragraph deterministically
  let cursor = 0;
  return paragraphs.map(para => {
    const paraNorm = normalizeForAudioMatching(para.text);
    if (!paraNorm) {
      return { ...para, audioStart: null, audioEnd: null };
    }

    // Try finding paragraph starting from cursor
    let matchIdx = allSegChars.indexOf(paraNorm, cursor);
    if (matchIdx === -1 && cursor > 0) {
      // Fallback: search from beginning if text had small reordering
      matchIdx = allSegChars.indexOf(paraNorm, 0);
    }

    // Fallback: match by substantial prefix (first 25 characters) if punctuation normalization caused slight trailing delta
    if (matchIdx === -1 && paraNorm.length > 25) {
      const prefix = paraNorm.slice(0, 25);
      const prefixIdx = allSegChars.indexOf(prefix, cursor);
      if (prefixIdx !== -1) {
        matchIdx = prefixIdx;
      }
    }

    if (matchIdx !== -1) {
      const charStart = matchIdx;
      const charEnd = matchIdx + paraNorm.length;
      const audioStart = getTimeAtChar(charStart, false);
      const audioEnd = getTimeAtChar(charEnd, true);
      cursor = Math.min(allSegChars.length, charEnd);

      return {
        ...para,
        audioStart,
        audioEnd: Math.max(audioStart, audioEnd)
      };
    }

    // Paragraph could not be reliably mapped: do NOT invent timestamps
    return {
      ...para,
      audioStart: null,
      audioEnd: null
    };
  });
}

/**
 * Normalizes a document object to guarantee all required properties exist,
 * including id, title, rawText, targetLang, nativeLang, paragraphs, languageStates,
 * createdAt, and updatedAt.
 * 
 * @param {object} rawDoc
 * @returns {object|null}
 */
export function normalizeDocument(rawDoc) {
  if (!rawDoc || typeof rawDoc !== 'object') return null;
  const now = new Date().toISOString();
  const id = rawDoc.id || `doc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const targetLang = rawDoc.targetLang || 'zh';
  const nativeLang = rawDoc.nativeLang || 'es';
  const rawText = typeof rawDoc.rawText === 'string' ? rawDoc.rawText : '';
  const langKey = `${targetLang}_${nativeLang}`;

  // Resolve paragraphs: preserve non-empty array, or recover from languageStates or rawText
  let paragraphs = Array.isArray(rawDoc.paragraphs) && rawDoc.paragraphs.length > 0 ? rawDoc.paragraphs : [];
  if (paragraphs.length === 0 && rawDoc.languageStates && typeof rawDoc.languageStates === 'object') {
    if (Array.isArray(rawDoc.languageStates[langKey]?.paragraphs) && rawDoc.languageStates[langKey].paragraphs.length > 0) {
      paragraphs = rawDoc.languageStates[langKey].paragraphs;
    } else if (Array.isArray(rawDoc.languageStates[targetLang]?.paragraphs) && rawDoc.languageStates[targetLang].paragraphs.length > 0) {
      paragraphs = rawDoc.languageStates[targetLang].paragraphs;
    } else {
      const anyState = Object.values(rawDoc.languageStates).find(s => Array.isArray(s?.paragraphs) && s.paragraphs.length > 0);
      if (anyState) {
        paragraphs = anyState.paragraphs;
      }
    }
  }
  if (paragraphs.length === 0 && rawText.trim().length > 0) {
    paragraphs = splitTextIntoParagraphs(rawText, targetLang, nativeLang);
  }

  const effectiveRawText = rawText || (paragraphs.length > 0 ? paragraphs.map(p => p.text || '').join('\n\n') : '');

  let title = (rawDoc.title || '').trim();
  if (!title && paragraphs.length > 0) {
    const firstLine = paragraphs[0].text.trim();
    title = firstLine.slice(0, 40) + (firstLine.length > 40 ? '...' : '');
  }
  if (!title) title = 'Texto sin título';

  const languageStates = (rawDoc.languageStates && typeof rawDoc.languageStates === 'object')
    ? { ...rawDoc.languageStates }
    : {};

  if (!languageStates[langKey] || !Array.isArray(languageStates[langKey].paragraphs) || languageStates[langKey].paragraphs.length === 0) {
    if (paragraphs.length > 0) {
      languageStates[langKey] = {
        targetLang,
        nativeLang,
        paragraphs,
        updatedAt: rawDoc.updatedAt || now
      };
      // Maintain legacy targetLang key for backward compatibility
      if (!languageStates[targetLang]) {
        languageStates[targetLang] = languageStates[langKey];
      }
    }
  }

  const author = typeof rawDoc.author === 'string' ? rawDoc.author.trim() : '';
  const sourceType = rawDoc.sourceType || rawDoc.format || 'txt';
  const format = rawDoc.format || sourceType;
  const chapters = Array.isArray(rawDoc.chapters) ? rawDoc.chapters : [];
  const lastReadingPosition = (rawDoc.lastReadingPosition && typeof rawDoc.lastReadingPosition === 'object')
    ? rawDoc.lastReadingPosition
    : null;
  const audioSegments = Array.isArray(rawDoc.audioSegments) ? rawDoc.audioSegments : (rawDoc.audioMetadata?.segments || []);
  const audioDuration = typeof rawDoc.audioDuration === 'number' ? rawDoc.audioDuration : (rawDoc.audioMetadata?.duration || 0);
  const audioPathname = rawDoc.audioPathname || rawDoc.audioMetadata?.pathname || null;
  const audioMimeType = rawDoc.audioMimeType || rawDoc.audioMetadata?.mimeType || null;

  if ((sourceType === 'audio' || format === 'audio') && audioSegments.length > 0 && paragraphs.length > 0) {
    const needsAlignment = paragraphs.some(p => typeof p?.audioStart !== 'number');
    if (needsAlignment) {
      paragraphs = alignParagraphsWithAudioSegments(paragraphs, audioSegments);
    }
  }

  return {
    id,
    title,
    author,
    sourceType,
    format,
    rawText: effectiveRawText,
    targetLang,
    nativeLang,
    paragraphsCount: paragraphs.length,
    paragraphs,
    chapters,
    languageStates,
    audioPathname,
    audioMimeType,
    audioSegments,
    audioDuration,
    lastAudioPosition: rawDoc.lastAudioPosition !== undefined ? rawDoc.lastAudioPosition : null,
    lastAudioParagraphId: rawDoc.lastAudioParagraphId || (typeof rawDoc.lastAudioPosition === 'object' ? rawDoc.lastAudioPosition?.paragraphId : null) || null,
    lastAudioPositionUpdatedAt: typeof rawDoc.lastAudioPositionUpdatedAt === 'number'
      ? rawDoc.lastAudioPositionUpdatedAt
      : (typeof rawDoc.lastAudioPosition === 'object' && typeof rawDoc.lastAudioPosition?.updatedAt === 'number'
        ? rawDoc.lastAudioPosition.updatedAt
        : null),
    lastReadingPosition,
    createdAt: rawDoc.createdAt || now,
    updatedAt: rawDoc.updatedAt || now
  };
}

/**
 * Creates a normalized text document structure.
 * 
 * @param {object} params
 * @param {string} [params.id]
 * @param {string} params.title
 * @param {string} [params.author='']
 * @param {string} [params.sourceType='txt']
 * @param {string} [params.format='txt']
 * @param {string} params.rawText
 * @param {string} params.targetLang
 * @param {string} params.nativeLang
 * @param {Array} [params.paragraphs]
 * @param {Array} [params.chapters]
 * @param {object} [params.languageStates]
 * @param {Array} [params.audioSegments]
 * @param {number} [params.audioDuration]
 * @param {object} [params.lastAudioPosition]
 * @param {object} [params.lastReadingPosition]
 * @param {string} [params.createdAt]
 * @returns {object} Normalized document object
 */
export function createTextDocument({
  id = null,
  title = '',
  author = '',
  sourceType = 'txt',
  format = 'txt',
  rawText = '',
  targetLang = 'zh',
  nativeLang = 'es',
  paragraphs = null,
  chapters = null,
  languageStates = null,
  audioPathname = null,
  audioMimeType = null,
  audioSegments = null,
  audioDuration = null,
  lastAudioPosition = null,
  lastAudioParagraphId = null,
  lastAudioPositionUpdatedAt = null,
  lastReadingPosition = null,
  createdAt = null
}) {
  const now = new Date().toISOString();
  let effectiveParagraphs = paragraphs && Array.isArray(paragraphs) && paragraphs.length > 0
    ? paragraphs
    : splitTextIntoParagraphs(rawText, targetLang, nativeLang);

  const effectiveSourceType = sourceType || format || 'txt';
  const effectiveFormat = format || sourceType || 'txt';

  // Deterministically align paragraphs with audio segments if this is an audio document
  if ((effectiveSourceType === 'audio' || effectiveFormat === 'audio') && Array.isArray(audioSegments) && audioSegments.length > 0) {
    effectiveParagraphs = alignParagraphsWithAudioSegments(effectiveParagraphs, audioSegments);
  }

  // Derive a fallback title if empty
  let derivedTitle = (title || '').trim();
  if (!derivedTitle && effectiveParagraphs.length > 0) {
    const firstLine = effectiveParagraphs[0].text.trim();
    derivedTitle = firstLine.slice(0, 40) + (firstLine.length > 40 ? '...' : '');
  }
  if (!derivedTitle) {
    derivedTitle = 'Texto sin título';
  }

  const initialStates = (languageStates && typeof languageStates === 'object')
    ? { ...languageStates }
    : {};

  const langKey = `${targetLang}_${nativeLang}`;
  if (!initialStates[langKey]) {
    initialStates[langKey] = {
      targetLang,
      nativeLang,
      paragraphs: effectiveParagraphs,
      updatedAt: now
    };
  }
  if (!initialStates[targetLang]) {
    initialStates[targetLang] = initialStates[langKey];
  }

  return {
    id: id || `doc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    title: derivedTitle,
    author: (author || '').trim(),
    sourceType: effectiveSourceType,
    format: effectiveFormat,
    rawText,
    targetLang,
    nativeLang,
    paragraphsCount: effectiveParagraphs.length,
    paragraphs: effectiveParagraphs,
    chapters: Array.isArray(chapters) ? chapters : [],
    languageStates: initialStates,
    audioPathname: audioPathname || null,
    audioMimeType: audioMimeType || null,
    audioSegments: Array.isArray(audioSegments) ? audioSegments : [],
    audioDuration: typeof audioDuration === 'number' ? audioDuration : (Number(audioDuration) || 0),
    lastAudioPosition: lastAudioPosition !== undefined ? lastAudioPosition : null,
    lastAudioParagraphId: lastAudioParagraphId || (typeof lastAudioPosition === 'object' ? lastAudioPosition?.paragraphId : null) || null,
    lastAudioPositionUpdatedAt: typeof lastAudioPositionUpdatedAt === 'number'
      ? lastAudioPositionUpdatedAt
      : (typeof lastAudioPosition === 'object' && typeof lastAudioPosition?.updatedAt === 'number'
        ? lastAudioPosition.updatedAt
        : null),
    lastReadingPosition: lastReadingPosition || null,
    createdAt: createdAt || now,
    updatedAt: now
  };
}

/**
 * Retrieves all saved text documents from IndexedDB.
 * Delegates directly to textLibraryStorage.js (Single Source of Truth).
 * 
 * @returns {Promise<Array<object>>}
 */
export async function getAllDocuments() {
  return getAllTextDocuments();
}

/**
 * Retrieves a single document by its unique id from IndexedDB.
 * Delegates directly to textLibraryStorage.js.
 * 
 * @param {string} id
 * @returns {Promise<object|null>}
 */
export async function getDocumentById(id) {
  return getTextDocumentById(id);
}

/**
 * Saves or updates a document in the persistent IndexedDB library.
 * Delegates directly to textLibraryStorage.js and updates active draft in localStorage.
 * 
 * @param {object} doc
 * @returns {Promise<object>} Saved normalized document
 */
export async function saveDocument(doc) {
  if (!doc || typeof doc !== 'object') return null;
  const saved = await saveTextDocument(doc);
  if (saved) {
    saveActiveDocumentDraft(saved);
  }
  return saved;
}

/**
 * Deletes a document by id from IndexedDB. If it matches the active draft,
 * the draft is cleared from localStorage as well.
 * 
 * @param {string} id
 * @returns {Promise<boolean>}
 */
export async function deleteDocument(id) {
  if (!id) return false;
  const res = await deleteTextDocument(id);
  const activeDraft = loadActiveDocumentDraft();
  if (activeDraft && activeDraft.id === id) {
    clearActiveDocumentDraft();
  }
  return res;
}

/**
 * Extracts a lightweight session metadata object for localStorage.
 * Keeps localStorage usage to ~300 bytes instead of megabytes of paragraphs and glosses.
 * Full document contents are stored safely in IndexedDB.
 */
export function extractMinimalDraft(doc) {
  if (!doc || typeof doc !== 'object') return null;
  return {
    id: doc.id || null,
    title: doc.title || '',
    author: doc.author || '',
    sourceType: doc.sourceType || doc.format || 'txt',
    format: doc.format || doc.sourceType || 'txt',
    targetLang: doc.targetLang || 'zh',
    nativeLang: doc.nativeLang || 'es',
    paragraphsCount: typeof doc.paragraphsCount === 'number'
      ? doc.paragraphsCount
      : (Array.isArray(doc.paragraphs) ? doc.paragraphs.length : 0),
    audioPathname: doc.audioPathname || null,
    audioMimeType: doc.audioMimeType || null,
    audioDuration: typeof doc.audioDuration === 'number' ? doc.audioDuration : (Number(doc.audioDuration) || 0),
    lastAudioPosition: doc.lastAudioPosition !== undefined ? doc.lastAudioPosition : null,
    lastAudioParagraphId: doc.lastAudioParagraphId || (typeof doc.lastAudioPosition === 'object' ? doc.lastAudioPosition?.paragraphId : null) || null,
    lastAudioPositionUpdatedAt: typeof doc.lastAudioPositionUpdatedAt === 'number'
      ? doc.lastAudioPositionUpdatedAt
      : (typeof doc.lastAudioPosition === 'object' && typeof doc.lastAudioPosition?.updatedAt === 'number'
        ? doc.lastAudioPosition.updatedAt
        : null),
    lastReadingPosition: doc.lastReadingPosition || null,
    createdAt: doc.createdAt || null,
    updatedAt: doc.updatedAt || null,
    isMinimalDraft: true
  };
}

/**
 * Save active document draft.
 * - Stores the full document in memory (memoryActiveDraft) for immediate same-session access.
 * - Stores ONLY lightweight session metadata in localStorage to prevent QuotaExceededError.
 * 
 * @param {object|null} doc
 */
export function saveActiveDocumentDraft(doc) {
  if (!doc) {
    memoryActiveDraft = null;
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.removeItem(ACTIVE_DOC_STORAGE_KEY);
      }
    } catch (e) {}
    return;
  }

  // Keep full normalized document in memory
  try {
    const normalized = normalizeDocument(doc);
    memoryActiveDraft = normalized;
  } catch (normErr) {
    memoryActiveDraft = doc;
  }

  // Persist only minimal metadata in localStorage
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const minimal = extractMinimalDraft(doc);
      localStorage.setItem(ACTIVE_DOC_STORAGE_KEY, JSON.stringify(minimal));
    }
  } catch (e) {
    // Silently ignore quota exceeded errors — never interrupt audio or UI
  }
}

/**
 * Load active document draft (synchronous).
 * Returns memoryActiveDraft if populated, or the parsed localStorage metadata.
 * 
 * @returns {object|null}
 */
export function loadActiveDocumentDraft() {
  if (memoryActiveDraft) {
    return memoryActiveDraft;
  }

  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const raw = localStorage.getItem(ACTIVE_DOC_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          // If legacy draft with full paragraphs array exists, normalize it
          if (Array.isArray(parsed.paragraphs) && parsed.paragraphs.length > 0) {
            const normalized = normalizeDocument(parsed);
            if (normalized && normalized.id) {
              memoryActiveDraft = normalized;
            }
            return normalized;
          }
          // Otherwise return minimal draft metadata
          return parsed;
        }
      }
    }
  } catch (e) {
    // Non-fatal
  }

  return memoryActiveDraft;
}

/**
 * Loads the complete active document with all paragraphs and glosses from IndexedDB.
 * 
 * @returns {Promise<object|null>}
 */
export async function loadActiveDocumentFull() {
  const draft = loadActiveDocumentDraft();
  if (!draft) return null;

  // If already in memory with full paragraphs, return immediately
  if (Array.isArray(draft.paragraphs) && draft.paragraphs.length > 0) {
    return draft;
  }

  // Hydrate from IndexedDB by document ID
  if (draft.id) {
    try {
      const fullDoc = await getTextDocumentById(draft.id);
      if (fullDoc && Array.isArray(fullDoc.paragraphs) && fullDoc.paragraphs.length > 0) {
        const merged = {
          ...fullDoc,
          lastAudioPosition: draft.lastAudioPosition !== undefined ? draft.lastAudioPosition : fullDoc.lastAudioPosition,
          lastAudioParagraphId: draft.lastAudioParagraphId || fullDoc.lastAudioParagraphId || (typeof (draft.lastAudioPosition || fullDoc.lastAudioPosition) === 'object' ? (draft.lastAudioPosition || fullDoc.lastAudioPosition)?.paragraphId : null) || null,
          lastAudioPositionUpdatedAt: draft.lastAudioPositionUpdatedAt || fullDoc.lastAudioPositionUpdatedAt || null,
          lastReadingPosition: draft.lastReadingPosition || fullDoc.lastReadingPosition
        };
        memoryActiveDraft = merged;
        return merged;
      }
    } catch (err) {
      console.warn('Failed to hydrate active document from IndexedDB:', err);
    }
  }

  return draft;
}

/**
 * Clears active document draft from localStorage and in-memory cache.
 */
export function clearActiveDocumentDraft() {
  memoryActiveDraft = null;
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.removeItem(ACTIVE_DOC_STORAGE_KEY);
    }
  } catch (e) {}
}

/**
 * Calls the backend /api/generate-text endpoint to generate a reading text in the active target language.
 * @param {Object} options
 * @param {string} options.topic - Topic or prompt requested by the user
 * @param {string} options.targetLang - Active learning language code (e.g., 'de', 'ar', 'zh', 'pl', 'tr', 'nl', 'fr', 'es', 'en')
 * @param {string} [options.level='B1'] - CEFR level ('A1-A2', 'B1', 'B2', 'C1')
 * @param {string} [options.length='medium'] - Desired length ('short', 'medium', 'long')
 * @param {string} [options.apiKey=''] - Optional client override API key
 * @returns {Promise<{ success: boolean, title: string, text: string }>}
 */
export async function generateAiTextDocument({
  topic,
  targetLang = 'es',
  level = 'B1',
  length = 'medium',
  apiKey = ''
}) {
  const trimmedTopic = (topic || '').trim();
  if (!trimmedTopic) {
    throw new Error('Debes ingresar un tema para generar el texto.');
  }

  const effectiveKey = (apiKey || '').trim().replace(/^["']|["']$/g, '');
  const headers = { 'Content-Type': 'application/json' };
  if (effectiveKey) {
    headers['x-api-key'] = effectiveKey;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 25000);

  try {
    const response = await fetch(`${API_BASE_URL}/api/generate-text`, {
      method: 'POST',
      headers,
      signal: controller.signal,
      body: JSON.stringify({
        topic: trimmedTopic,
        targetLang,
        level,
        length,
        apiKey: effectiveKey
      })
    });

    clearTimeout(timeoutId);

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      const errMsg = data?.error || `Error del servidor (${response.status})`;
      throw new Error(errMsg);
    }

    if (!data.success || !data.text) {
      throw new Error(data?.error || 'No se pudo generar el texto en este momento.');
    }

    return {
      success: true,
      title: data.title || trimmedTopic,
      text: data.text
    };
  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      throw new Error('Tiempo de espera agotado al conectar con el servidor de IA.');
    }
    throw err;
  }
}

/**
 * Calls backend /api/translate-text to translate an individual paragraph text into native language.
 * @param {Object} options
 * @param {string} options.text - Raw text of the paragraph to translate
 * @param {string} options.targetLang - Source target language code (e.g. 'de', 'ar', 'zh', 'ru', etc.)
 * @param {string} options.nativeLang - Student's native language code (e.g. 'es', 'en', etc.)
 * @param {string} [options.apiKey=''] - Optional client override API key
 * @returns {Promise<{ success: boolean, translation: string }>}
 */
export async function translateParagraphTextApi({
  text,
  targetLang = 'es',
  nativeLang = 'es',
  apiKey = ''
}) {
  const trimmedText = (text || '').trim();
  if (!trimmedText) {
    throw new Error('No hay texto para traducir.');
  }

  const effectiveKey = (apiKey || '').trim().replace(/^["']|["']$/g, '');
  const headers = { 'Content-Type': 'application/json' };
  if (effectiveKey) {
    headers['x-api-key'] = effectiveKey;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch(`${API_BASE_URL}/api/translate-text`, {
      method: 'POST',
      headers,
      signal: controller.signal,
      body: JSON.stringify({
        text: trimmedText,
        targetLang,
        nativeLang,
        apiKey: effectiveKey
      })
    });

    clearTimeout(timeoutId);

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      const errMsg = data?.error || `Error del servidor (${response.status})`;
      throw new Error(errMsg);
    }

    if (!data.success || !data.translation) {
      throw new Error(data?.error || 'No se pudo obtener la traducción en este momento.');
    }

    return {
      success: true,
      translation: data.translation
    };
  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      throw new Error('Tiempo de espera agotado al conectar con el servidor de traducción.');
    }
    throw err;
  }
}

/**
 * Transcribes an uploaded audio file (.mp3, .wav, .m4a, .webm, .ogg)
 * by uploading binary directly to temporary storage (@vercel/blob)
 * and processing via Groq Whisper (/api/transcribe).
 *
 * @param {object} params
 * @param {File|Blob} params.audioFile - The audio file or blob to transcribe
 * @param {string} [params.targetLang='zh'] - Target language
 * @param {string} [params.nativeLang='es'] - Native language
 * @param {string} [params.apiKey=''] - Optional client Groq API key override
 * @param {Function} [params.onProgress] - Optional progress callback
 * @returns {Promise<{ success: boolean, transcript: string, segments: Array, duration: number, source?: string }>}
 */
export async function transcribeAudioFileApi({
  audioFile,
  targetLang = 'zh',
  nativeLang = 'es',
  apiKey = '',
  onProgress = null
}) {
  if (!audioFile) {
    throw new Error('No se seleccionó ningún archivo de audio.');
  }

  // Max 25 MB client validation
  const MAX_BYTES = 25 * 1024 * 1024;
  if (audioFile.size > MAX_BYTES) {
    const mbSize = (audioFile.size / (1024 * 1024)).toFixed(1);
    throw new Error(`El archivo de audio (${mbSize} MB) supera el límite permitido de 25 MB. Por favor elige un archivo más pequeño.`);
  }

  if (typeof onProgress === 'function') {
    onProgress('Subiendo archivo de audio a almacenamiento temporal...');
  }

  const rawExt = (audioFile.name || '').split('.').pop()?.toLowerCase();
  const validExts = ['mp3', 'wav', 'm4a', 'webm', 'ogg', 'aac', 'flac', 'opus'];
  const fileExt = validExts.includes(rawExt) ? rawExt : 'webm';
  const safePathname = `transcribe-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${fileExt}`;

  // 1. Direct binary upload to Vercel Blob storage (bypasses 4.5 MB Serverless body limit)
  let blobResult;
  const isLargeFile = audioFile.size > 5 * 1024 * 1024;
  const ticketUrl = (typeof window !== 'undefined' && !API_BASE_URL)
    ? '/api/transcribe-ticket'
    : `${API_BASE_URL}/api/transcribe-ticket`;

  console.log('[AudioImport] Prepared audio upload:', {
    pathname: safePathname,
    mimeType: audioFile.type || 'audio/webm',
    sizeBytes: audioFile.size,
    multipart: isLargeFile,
    access: 'private'
  });

  const uploadOptions = {
    access: 'private',
    handleUploadUrl: ticketUrl,
    contentType: audioFile.type || 'audio/webm',
    multipart: isLargeFile
  };

  try {
    blobResult = await upload(safePathname, audioFile, uploadOptions);
  } catch (uploadErr) {
    const errMsg = (uploadErr?.message || '').toLowerCase();
    // Fallback for public stores if configured with public access
    if (errMsg.includes('public access') || errMsg.includes('public store')) {
      console.warn('[AudioImport] Retrying upload with access: "public"');
      blobResult = await upload(safePathname, audioFile, {
        ...uploadOptions,
        access: 'public'
      });
    } else {
      console.error('[AudioImport] Direct audio upload to storage failed:', uploadErr);
      throw new Error(`Error al subir el archivo de audio al servidor: ${uploadErr.message || 'Fallo de red'}`);
    }
  }

  if (!blobResult || !blobResult.url) {
    throw new Error('No se recibió la confirmación de almacenamiento del archivo temporal.');
  }

  console.log('[AudioImport] SDK upload response:', {
    url: blobResult.url,
    pathname: blobResult.pathname,
    contentType: blobResult.contentType
  });

  // 2. Request backend transcription from the uploaded storage URL
  if (typeof onProgress === 'function') {
    onProgress('Transcribiendo con Groq Whisper (whisper-large-v3)...');
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 125000);

  const headers = { 'Content-Type': 'application/json' };
  const effectiveKey = (apiKey || '').trim().replace(/^["']|["']$/g, '');
  if (effectiveKey) {
    headers['x-api-key'] = effectiveKey;
  }

  try {
    const res = await fetch(`${API_BASE_URL}/api/transcribe`, {
      method: 'POST',
      headers,
      signal: controller.signal,
      body: JSON.stringify({
        fileUrl: blobResult.url,
        fileName: audioFile.name || safePathname,
        mimeType: audioFile.type || 'audio/webm',
        targetLang,
        nativeLang,
        apiKey: effectiveKey,
        timeoutMs: 120000,
        persistBlob: true
      })
    });

    clearTimeout(timeoutId);

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      const errMsg = data?.error || (res.status === 413 ? 'El archivo excede el tamaño máximo permitido por el servidor (HTTP 413).' : `Error del servidor de transcripción (${res.status})`);
      throw new Error(errMsg);
    }

    if (!data.success || !data.transcript) {
      throw new Error(data?.error || 'No se detectó contenido de voz en el audio.');
    }

    return {
      success: true,
      transcript: data.transcript.trim(),
      segments: Array.isArray(data.segments) ? data.segments : [],
      duration: typeof data.duration === 'number' ? data.duration : (Number(data.duration) || 0),
      source: data.source || 'groq (whisper-large-v3)',
      pathname: data.pathname || blobResult.pathname || null,
      mimeType: audioFile.type || blobResult.contentType || 'audio/webm',
      url: blobResult.url || data.url || null
    };
  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      throw new Error('Tiempo de espera agotado al transcribir el audio. Por favor intenta de nuevo.');
    }
    throw err;
  }
}
