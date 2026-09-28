/**
 * EPUB simplification helpers.
 *
 * The canonical EPUB paragraphs are never changed. Generated alternatives are
 * stored separately by block and projected into the reader only when selected.
 */
import { API_BASE_URL } from './chatService.js';
import { tokenizeAndGlossLineOffline } from './subtitleGlossService.js';
import { getLanguageMeta } from '../constants/languages.js';

export const EPUB_SIMPLIFICATION_LEVELS = ['beginner', 'medium'];
// Bump when pedagogical instructions change so weak older rewrites are not reused.
export const EPUB_SIMPLIFICATION_SOURCE_VERSION = 3;
const TARGET_WORDS_PER_BLOCK = 900;
const MIN_WORDS_PER_BLOCK = 800;
const MAX_WORDS_PER_BLOCK = 1200;
const inFlightRequests = new Map();

function countWords(text = '') {
  const matches = String(text).trim().match(/[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu);
  return matches ? matches.length : 0;
}

function stableHash(value = '') {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

export function buildEpubSimplificationBlocks(paragraphs = [], chapterId = '') {
  const source = paragraphs.filter((paragraph) => paragraph?.id && paragraph?.text);
  const blocks = [];
  let current = [];
  let currentWords = 0;

  const commit = () => {
    if (!current.length) return;
    const sourceParagraphIds = current.map((paragraph) => paragraph.id);
    const sourceText = current.map((paragraph) => paragraph.text.trim()).join('\n\n');
    const blockIndex = blocks.length;
    const sourceHash = stableHash(sourceText);
    blocks.push({
      id: `${chapterId || 'chapter'}_b${blockIndex + 1}`,
      index: blockIndex,
      chapterId,
      sourceParagraphIds,
      sourceParagraphs: current.map((paragraph) => ({ id: paragraph.id, text: paragraph.text.trim() })),
      sourceText,
      sourceWords: countWords(sourceText),
      sourceHash
    });
    current = [];
    currentWords = 0;
  };

  for (const paragraph of source) {
    const paragraphWords = Math.max(1, countWords(paragraph.text));
    const wouldExceed = current.length > 0 && currentWords + paragraphWords > MAX_WORDS_PER_BLOCK;
    const reachedTarget = currentWords >= TARGET_WORDS_PER_BLOCK && currentWords >= MIN_WORDS_PER_BLOCK;
    if (wouldExceed || reachedTarget) commit();
    current.push(paragraph);
    currentWords += paragraphWords;
  }
  commit();
  return blocks;
}

export function getSimplificationCacheKey({ documentId, chapterId, blockId, level, sourceHash }) {
  return [
    documentId || 'unsaved',
    chapterId || 'chapter',
    blockId || 'block',
    level,
    `v${EPUB_SIMPLIFICATION_SOURCE_VERSION}`,
    sourceHash
  ].join('::');
}

export function getCachedSimplification(document, block, level) {
  if (!document || !block || !EPUB_SIMPLIFICATION_LEVELS.includes(level)) return null;
  const key = getSimplificationCacheKey({
    documentId: document.id,
    chapterId: block.chapterId,
    blockId: block.id,
    level,
    sourceHash: block.sourceHash
  });
  return document.epubSimplifications?.[key] || null;
}

export function getParagraphRepresentationKey(paragraph, mode) {
  return mode?.kind === 'simplified'
    ? `${paragraph.id}::simplified::${mode.level}`
    : `${paragraph.id}::original`;
}

export function projectSimplifiedParagraphs({ paragraphs = [], document, level, nativeLang = 'es' }) {
  if (!document || !EPUB_SIMPLIFICATION_LEVELS.includes(level)) return paragraphs;
  const variantsBySourceId = new Map();
  const chapters = new Map();
  paragraphs.forEach((paragraph) => {
    if (!chapters.has(paragraph.chapterId)) chapters.set(paragraph.chapterId, []);
    chapters.get(paragraph.chapterId).push(paragraph);
  });

  chapters.forEach((chapterParagraphs, chapterId) => {
    buildEpubSimplificationBlocks(chapterParagraphs, chapterId).forEach((block) => {
      const cached = getCachedSimplification(document, block, level);
      cached?.paragraphs?.forEach((variant) => {
        if (variant?.sourceParagraphId && variant.text) {
          variantsBySourceId.set(variant.sourceParagraphId, variant);
        }
      });
    });
  });

  const speechCode = getLanguageMeta(document.targetLang)?.speechCode || 'zh-CN';
  return paragraphs.map((paragraph) => {
    const variant = variantsBySourceId.get(paragraph.id);
    if (!variant) return paragraph;
    return {
      ...paragraph,
      text: variant.text,
      tokens: Array.isArray(variant.tokens) && variant.tokens.length > 0
        ? variant.tokens
        : tokenizeAndGlossLineOffline(variant.text, document.targetLang, nativeLang),
      glosses: Array.isArray(variant.glosses) ? variant.glosses : [],
      tts: { ...(paragraph.tts || {}), speechCode },
      sourceParagraphId: paragraph.id,
      simplificationLevel: level
    };
  });
}

export function isSuspiciousSimplification(sourceText, simplifiedText) {
  const sourceWords = countWords(sourceText);
  const simplifiedWords = countWords(simplifiedText);
  if (sourceWords < 80) return simplifiedWords < Math.max(20, sourceWords * 0.45);
  return simplifiedWords < sourceWords * 0.58;
}

export async function simplifyEpubBlockApi({ block, documentId, targetLang, nativeLang = 'es', level, apiKey = '' }) {
  if (!block?.sourceText || !EPUB_SIMPLIFICATION_LEVELS.includes(level)) {
    throw new Error('El bloque de simplificación no es válido.');
  }
  const requestKey = getSimplificationCacheKey({
    documentId,
    chapterId: block.chapterId,
    blockId: block.id,
    level,
    sourceHash: block.sourceHash
  });
  if (inFlightRequests.has(requestKey)) return inFlightRequests.get(requestKey);

  const request = (async () => {
    const effectiveKey = String(apiKey || '').trim().replace(/^["']|["']$/g, '');
    const response = await fetch(`${API_BASE_URL}/api/simplify-epub-block`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(effectiveKey ? { 'x-api-key': effectiveKey } : {})
      },
      body: JSON.stringify({
        documentId,
        chapterId: block.chapterId,
        blockId: block.id,
        level,
        targetLang,
        apiKey: effectiveKey,
        sourceParagraphs: block.sourceParagraphs.map((paragraph) => ({
          sourceParagraphId: paragraph.id,
          text: paragraph.text
        }))
      })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.success || !Array.isArray(data.paragraphs)) {
      throw new Error(data?.error || 'No se pudo simplificar este bloque.');
    }

    const variants = data.paragraphs
      .filter((paragraph) => block.sourceParagraphIds.includes(paragraph?.sourceParagraphId) && String(paragraph?.text || '').trim())
      .map((paragraph) => ({
        sourceParagraphId: paragraph.sourceParagraphId,
        text: String(paragraph.text).trim(),
        tokens: tokenizeAndGlossLineOffline(String(paragraph.text).trim(), targetLang, nativeLang),
        glosses: []
      }));
    const minimumVariantCount = Math.ceil(block.sourceParagraphIds.length * 0.75);
    if (variants.length < minimumVariantCount) {
      throw new Error('La simplificación no conservó suficientes párrafos del bloque.');
    }
    const text = variants.map((paragraph) => paragraph.text).join('\n\n');
    if (isSuspiciousSimplification(block.sourceText, text)) {
      throw new Error('La respuesta de IA parece un resumen y no se guardó.');
    }
    return {
      key: requestKey,
      blockId: block.id,
      chapterId: block.chapterId,
      level,
      sourceVersion: EPUB_SIMPLIFICATION_SOURCE_VERSION,
      sourceHash: block.sourceHash,
      sourceParagraphIds: block.sourceParagraphIds,
      paragraphs: variants,
      generatedAt: new Date().toISOString()
    };
  })();
  inFlightRequests.set(requestKey, request);
  try {
    return await request;
  } finally {
    inFlightRequests.delete(requestKey);
  }
}
