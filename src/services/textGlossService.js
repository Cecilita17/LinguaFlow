import { buildGlossBatches, runGlossBatches } from '../utils/glossBatchPolicy.js';
import { getGlossErrorDetails } from '../utils/glossErrors.js';
/**
 * Standalone Text Gloss Service for LinguaFlow
 * Provides interlinear AI glossing for independent text documents and paragraphs.
 * 
 * Reuses 100% of the proven linguistic strategies:
 * - Chinese: Multi-character word segmentation via Intl.Segmenter, tone-marked Pinyin exclusively on Tier 1 (auxiliary), gloss below.
 * - Arabic: Preserves diacritics/tashkeel with Latin transliteration on Tier 1, gloss below.
 * - Polish: Words with diacritics, strictly NO transliteration.
 * - Russian/Bulgarian/Others: Word units with gloss, strictly NO transliteration.
 * 
 * Zero coupling to video players, timestamps, or video library storage.
 */

import {
  tokenizeAndGlossLineOffline,
  fetchBatchGlossesApi,
  mergeAiTokensWithSegmented,
  isGlossComplete,
  getLanguageGlossStrategy,
  PUNCTUATION_REGEX,
  glossSingleSubtitleLine,
  createIncompleteGlossError
} from './subtitleGlossService.js';

export {
  tokenizeAndGlossLineOffline,
  isGlossComplete,
  getLanguageGlossStrategy,
  PUNCTUATION_REGEX,
  glossSingleSubtitleLine
};

/**
 * Gloss a single text paragraph on demand with AI.
 * Reuses identical single-line AI glossing engine with language strategy rules.
 * 
 * @param {Object} params
 * @param {Object} params.paragraph - Paragraph object
 * @param {string} [params.targetLang='zh']
 * @param {string} [params.nativeLang='es']
 * @param {string} [params.apiKey='']
 * @param {AbortSignal} [params.abortSignal=null]
 * @returns {Promise<Object>} The updated paragraph object with glossed tokens
 */
export async function glossSingleParagraph({
  paragraph,
  targetLang = 'zh',
  nativeLang = 'es',
  apiKey = '',
  abortSignal = null
}) {
  return glossSingleSubtitleLine({
    sub: paragraph,
    targetLang,
    nativeLang,
    apiKey,
    abortSignal
  });
}

/**
 * Enriches an array of text paragraphs with interlinear glosses.
 * 
 * 1. Immediately segments and assigns offline tokens for 0ms initial render.
 * 2. If lines require AI resolution, batches them in chunks of 5 lines to Groq AI.
 * 3. Triggers real-time callbacks (`onUpdate`, `onProgress`) after each batch.
 * 4. Supports instant cancellation/pausing via `abortSignal`.
 * 
 * @param {object} params
 * @param {Array} params.paragraphs
 * @param {string} [params.targetLang='zh']
 * @param {string} [params.nativeLang='es']
 * @param {string} [params.apiKey='']
 * @param {AbortSignal} [params.abortSignal=null]
 * @param {Function} [params.onUpdate=null]
 * @param {Function} [params.onProgress=null]
 * @returns {Array} Immediately prepared paragraphs with offline tokens
 */
export function enrichParagraphsWithGlosses({
  paragraphs = [],
  targetLang = 'zh',
  nativeLang = 'es',
  apiKey = '',
  abortSignal = null,
  onUpdate = null,
  onProgress = null,
  failedParagraphIds = new Set()
}) {
  if (!Array.isArray(paragraphs) || paragraphs.length === 0) {
    return paragraphs;
  }

  const strategy = getLanguageGlossStrategy(targetLang);
  const totalParagraphs = paragraphs.length;

  // Step 1: Immediate offline preparation (zero latency)
  const prepared = paragraphs.map(p => {
    // If paragraph already has substantive tokens, preserve them unless empty
    if (Array.isArray(p.tokens) && p.tokens.length > 0) {
      return p;
    }
    const offlineTokens = tokenizeAndGlossLineOffline(p.text, targetLang, nativeLang);
    return {
      ...p,
      tokens: offlineTokens
    };
  });

  const getCompletedCount = (pList) => pList.filter(p => isGlossComplete(p, targetLang, nativeLang)).length;
  const initialCompleted = getCompletedCount(prepared);

  if (!onUpdate && !onProgress) {
    return prepared;
  }

  let currentParagraphs = [...prepared];
  const failedIds = failedParagraphIds;
  let lastErrorDetails = null;
  (async () => {

    const checkAborted = () => {
      if (abortSignal && abortSignal.aborted) {
        console.log('[LinguaFlow Text Gloss Engine] Processing paused or aborted by user.');
        if (onProgress) {
          const nowComp = getCompletedCount(currentParagraphs);
          onProgress({
            total: totalParagraphs,
            completed: nowComp,
            isGlossing: false,
            isPaused: true,
            isComplete: nowComp === totalParagraphs,
            failed: 0
          });
        }
        return true;
      }
      return false;
    };

    if (checkAborted()) return;

    // Check if already completely glossed
    if (initialCompleted === totalParagraphs) {
      if (onProgress) {
        onProgress({
          total: totalParagraphs,
          completed: totalParagraphs,
          isGlossing: false,
          isComplete: true,
          failed: 0
        });
      }
      return;
    }

    const missingParagraphs = currentParagraphs.filter(p => !failedIds.has(p.id) && !isGlossComplete(p, targetLang, nativeLang));

    if (onProgress) {
      onProgress({
        total: totalParagraphs,
        completed: initialCompleted,
        isGlossing: true,
        isComplete: false,
        failed: 0
      });
    }

    let actualAiRequestsCount = 0;
    const initialChunks = buildGlossBatches(missingParagraphs, targetLang);

    // Helper to process a batch of paragraphs
    const processBatch = async (batch) => {
      if (!Array.isArray(batch) || batch.length === 0) return;
      if (checkAborted()) return;

      actualAiRequestsCount++;
      const aiResults = await fetchBatchGlossesApi(batch, targetLang, nativeLang, apiKey, abortSignal, { throwOnError: true });
      if (checkAborted()) return;
      let hasNewData = false;

      if (Array.isArray(aiResults) && aiResults.length > 0) {
        aiResults.forEach((item, itemIdx) => {
          if (item && Array.isArray(item.tokens) && item.tokens.length > 0) {
            const rawId = String(item.id || '').trim();
            let idx = currentParagraphs.findIndex(p => String(p.id).trim() === rawId);
            if (idx === -1 && batch[itemIdx]) {
              idx = currentParagraphs.findIndex(p => p.id === batch[itemIdx].id);
            }
            if (idx === -1 && item.text) {
              const cleanText = item.text.trim();
              idx = currentParagraphs.findIndex(p => p.text && p.text.trim() === cleanText);
            }

            if (idx !== -1) {
              const p = currentParagraphs[idx];
              const mergedTokens = mergeAiTokensWithSegmented(p.tokens, item.tokens, targetLang, p.text || item.text, nativeLang);
              currentParagraphs[idx] = {
                ...p,
                tokens: mergedTokens
              };
              hasNewData = true;
            }
          }
        });
      }

      if (hasNewData && onUpdate) {
        onUpdate([...currentParagraphs]);
      }

      if (batch.some(paragraph => !isGlossComplete(currentParagraphs.find(item => item.id === paragraph.id), targetLang, nativeLang))) {
        throw createIncompleteGlossError(batch.map(paragraph => currentParagraphs.find(item => item.id === paragraph.id)), targetLang, nativeLang, aiResults);
      }

      if (onProgress) {
        const completed = getCompletedCount(currentParagraphs);
        onProgress({
          total: totalParagraphs,
          completed,
          isGlossing: true,
          isComplete: completed === totalParagraphs,
          failed: currentParagraphs.filter(line => failedIds.has(line.id) && !isGlossComplete(line, targetLang, nativeLang)).length
        });
      }
    };

    // Each line is attempted once; local failures do not prevent later batches.
    await runGlossBatches({
      batches: initialChunks,
      processBatch,
      isAborted: checkAborted,
      onRecoverableError: (error, batch) => {
        const pending = batch.filter(line => !isGlossComplete(currentParagraphs.find(item => item.id === line.id), targetLang, nativeLang));
        pending.forEach(line => failedIds.add(line.id));
        lastErrorDetails = getGlossErrorDetails(error);
        onProgress?.({
          total: totalParagraphs, completed: getCompletedCount(currentParagraphs),
          isGlossing: true, isComplete: false, failed: currentParagraphs.filter(line => failedIds.has(line.id) && !isGlossComplete(line, targetLang, nativeLang)).length,
          recoverableError: true, errorDetails: lastErrorDetails
        });
      }
    });
    if (checkAborted()) return;

    const finalCompleted = getCompletedCount(currentParagraphs);
    if (onProgress) {
      onProgress({
        total: totalParagraphs,
        completed: finalCompleted,
        isGlossing: false,
        isComplete: finalCompleted === totalParagraphs,
        failed: totalParagraphs - finalCompleted,
        lastErrorDetails
      });
    }
  })().catch(err => {
    if (abortSignal?.aborted) return;
    console.warn('Text glossing notice:', err);
    if (onProgress) {
      const finalCompleted = getCompletedCount(currentParagraphs);
      onProgress({
        total: totalParagraphs,
        completed: finalCompleted,
        isGlossing: false,
        isComplete: finalCompleted === totalParagraphs,
        failed: totalParagraphs - finalCompleted,
        error: true,
        errorDetails: getGlossErrorDetails(err)
      });
    }
  });

  return prepared;
}
