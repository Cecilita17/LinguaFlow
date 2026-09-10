/**
 * Text Document Service
 * Handles data structures, paragraph segmentation, active draft, and
 * persistent library storage for the standalone Text Reader in LinguaFlow.
 */

import { getLanguageMeta } from '../constants/languages.js';
import { tokenizeAndGlossLineOffline } from './subtitleGlossService.js';

export const ACTIVE_DOC_STORAGE_KEY = 'linguaflow_active_text_doc_v1';
export const LIBRARY_DOCS_STORAGE_KEY = 'linguaflow_text_library_v1';

// In-memory fallback if localStorage is unavailable or disabled
const memoryDocStore = new Map();
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
export function splitTextIntoParagraphs(rawText, targetLang = 'zh') {
  const segments = splitTextIntoNaturalSegments(rawText, targetLang);
  const langMeta = getLanguageMeta(targetLang);
  const speechCode = langMeta?.speechCode || 'zh-CN';

  return segments.map((text, idx) => ({
    id: `p-${idx + 1}`,
    index: idx,
    text,
    tokens: tokenizeAndGlossLineOffline(text, targetLang),
    glosses: [],
    tts: {
      speechCode,
      rate: 0.95
    }
  }));
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
  const paragraphs = Array.isArray(rawDoc.paragraphs) ? rawDoc.paragraphs : splitTextIntoParagraphs(rawText, targetLang);

  let title = (rawDoc.title || '').trim();
  if (!title && paragraphs.length > 0) {
    const firstLine = paragraphs[0].text.trim();
    title = firstLine.slice(0, 40) + (firstLine.length > 40 ? '...' : '');
  }
  if (!title) title = 'Texto sin título';

  const languageStates = (rawDoc.languageStates && typeof rawDoc.languageStates === 'object')
    ? { ...rawDoc.languageStates }
    : {};

  if (!languageStates[targetLang] || !Array.isArray(languageStates[targetLang].paragraphs)) {
    languageStates[targetLang] = {
      targetLang,
      paragraphs,
      updatedAt: rawDoc.updatedAt || now
    };
  }

  return {
    id,
    title,
    rawText,
    targetLang,
    nativeLang,
    paragraphsCount: paragraphs.length,
    paragraphs,
    languageStates,
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
 * @param {string} params.rawText
 * @param {string} params.targetLang
 * @param {string} params.nativeLang
 * @param {Array} [params.paragraphs]
 * @param {object} [params.languageStates]
 * @param {string} [params.createdAt]
 * @returns {object} Normalized document object
 */
export function createTextDocument({
  id = null,
  title = '',
  rawText = '',
  targetLang = 'zh',
  nativeLang = 'es',
  paragraphs = null,
  languageStates = null,
  createdAt = null
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

  const initialStates = (languageStates && typeof languageStates === 'object')
    ? { ...languageStates }
    : {};

  if (!initialStates[targetLang]) {
    initialStates[targetLang] = {
      targetLang,
      paragraphs: effectiveParagraphs,
      updatedAt: now
    };
  }

  return {
    id: id || `doc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    title: derivedTitle,
    rawText,
    targetLang,
    nativeLang,
    paragraphsCount: effectiveParagraphs.length,
    paragraphs: effectiveParagraphs,
    languageStates: initialStates,
    createdAt: createdAt || now,
    updatedAt: now
  };
}

/**
 * Internal helper to read the library collection from localStorage with memory fallback.
 * 
 * @returns {Array<object>}
 */
function getStorageLibrary() {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const raw = localStorage.getItem(LIBRARY_DOCS_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          const list = parsed.map(normalizeDocument).filter(Boolean);
          list.forEach(doc => memoryDocStore.set(doc.id, doc));
          return list;
        }
      }
    }
  } catch (e) {
    console.warn('Failed to read text document library from localStorage:', e);
  }
  return Array.from(memoryDocStore.values());
}

/**
 * Internal helper to persist the library collection to localStorage and memory.
 * 
 * @param {Array<object>} docs
 */
function setStorageLibrary(docs) {
  const normalizedDocs = (Array.isArray(docs) ? docs : []).map(normalizeDocument).filter(Boolean);
  memoryDocStore.clear();
  normalizedDocs.forEach(d => memoryDocStore.set(d.id, d));
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.setItem(LIBRARY_DOCS_STORAGE_KEY, JSON.stringify(normalizedDocs));
    }
  } catch (e) {
    console.warn('Failed to write text document library to localStorage:', e);
  }
}

/**
 * Retrieves all saved text documents, sorted newest first by updatedAt.
 * 
 * @returns {Array<object>}
 */
export function getAllDocuments() {
  const docs = getStorageLibrary();
  return docs.sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0));
}

/**
 * Retrieves a single document by its unique id.
 * 
 * @param {string} id
 * @returns {object|null}
 */
export function getDocumentById(id) {
  if (!id) return null;
  const docs = getStorageLibrary();
  return docs.find(d => d.id === id) || memoryDocStore.get(id) || null;
}

/**
 * Saves or updates a document in persistent storage and marks active draft.
 * Preserves stable ID and createdAt, updates updatedAt, and syncs languageStates.
 * 
 * @param {object} doc
 * @returns {object} Saved normalized document
 */
export function saveDocument(doc) {
  if (!doc || typeof doc !== 'object') return null;
  const now = new Date().toISOString();
  const existing = doc.id ? getDocumentById(doc.id) : null;

  const targetLang = doc.targetLang || 'zh';
  const effectiveParagraphs = Array.isArray(doc.paragraphs) ? doc.paragraphs : [];

  const existingStates = (doc.languageStates && typeof doc.languageStates === 'object')
    ? { ...doc.languageStates }
    : (existing?.languageStates ? { ...existing.languageStates } : {});

  existingStates[targetLang] = {
    targetLang,
    paragraphs: effectiveParagraphs,
    updatedAt: now
  };

  const toSave = normalizeDocument({
    ...doc,
    createdAt: existing?.createdAt || doc.createdAt || now,
    updatedAt: now,
    languageStates: existingStates
  });

  const docs = getStorageLibrary();
  const idx = docs.findIndex(d => d.id === toSave.id);
  if (idx >= 0) {
    docs[idx] = toSave;
  } else {
    docs.unshift(toSave);
  }

  setStorageLibrary(docs);
  saveActiveDocumentDraft(toSave);
  return toSave;
}

/**
 * Deletes a document by id from storage. If it matches the active draft,
 * the draft is cleared as well.
 * 
 * @param {string} id
 * @returns {boolean}
 */
export function deleteDocument(id) {
  if (!id) return false;
  const docs = getStorageLibrary();
  const filtered = docs.filter(d => d.id !== id);
  setStorageLibrary(filtered);
  memoryDocStore.delete(id);

  try {
    const activeDraft = loadActiveDocumentDraft();
    if (activeDraft && activeDraft.id === id) {
      clearActiveDocumentDraft();
    }
  } catch (e) {}

  return true;
}

/**
 * Save active document draft to localStorage (with in-memory fallback)
 * so user doesn't lose text/glosses on tab switch.
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

  const normalized = normalizeDocument(doc);
  memoryActiveDraft = normalized;

  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.setItem(ACTIVE_DOC_STORAGE_KEY, JSON.stringify(normalized));
    }
  } catch (e) {
    console.warn('Failed to save active text document draft to localStorage:', e);
  }
}

/**
 * Load active document draft from localStorage (with in-memory fallback).
 * Gracefully migrates legacy drafts to library.
 * 
 * @returns {object|null}
 */
export function loadActiveDocumentDraft() {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const raw = localStorage.getItem(ACTIVE_DOC_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object' && Array.isArray(parsed.paragraphs)) {
          const normalized = normalizeDocument(parsed);
          if (normalized && normalized.id) {
            memoryActiveDraft = normalized;
            // Ensure library also has this draft
            const docs = getStorageLibrary();
            if (!docs.some(d => d.id === normalized.id)) {
              docs.unshift(normalized);
              setStorageLibrary(docs);
            }
          }
          return normalized;
        }
      }
    }
  } catch (e) {
    console.warn('Failed to load active text document draft from localStorage:', e);
  }

  return memoryActiveDraft;
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


