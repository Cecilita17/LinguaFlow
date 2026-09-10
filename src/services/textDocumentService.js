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
 * Splits raw input text into natural paragraph units.
 * Supports double newlines, single newlines, and mixed spacing while preserving content.
 * 
 * @param {string} rawText
 * @param {string} targetLang
 * @returns {Array<{ id: string, index: number, text: string, tokens: Array, glosses: Array, tts: object }>}
 */
export function splitTextIntoParagraphs(rawText, targetLang = 'zh') {
  if (!rawText || typeof rawText !== 'string') return [];

  const normalized = rawText.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
  if (!normalized) return [];

  // Split by newlines so each natural line/paragraph is an independent unit of reading/TTS/glossing
  const rawParagraphs = normalized.split(/\n+/);

  const langMeta = getLanguageMeta(targetLang);
  const speechCode = langMeta?.speechCode || 'zh-CN';

  return rawParagraphs
    .map(p => p.trim())
    .filter(Boolean)
    .map((text, idx) => ({
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
