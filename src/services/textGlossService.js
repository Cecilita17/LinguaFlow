/**
 * Standalone Text Gloss Service for LinguaFlow
 * Provides interlinear AI glossing for independent text documents and paragraphs.
 * 
 * Reuses 100% of the proven linguistic strategies:
 * - Chinese: Multi-character word segmentation via Intl.Segmenter, tone-marked Pinyin exclusively on Tier 1 (auxiliary), gloss below.
 * - Arabic: Preserves diacritics/tashkeel, strictly NO Latin transliteration.
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
  glossSingleSubtitleLine
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
  onProgress = null
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
    const offlineTokens = tokenizeAndGlossLineOffline(p.text, targetLang);
    return {
      ...p,
      tokens: offlineTokens
    };
  });

  const getCompletedCount = (pList) => pList.filter(p => isGlossComplete(p, targetLang)).length;
  const initialCompleted = getCompletedCount(prepared);

  if (!onUpdate) {
    return prepared;
  }

  (async () => {
    let currentParagraphs = [...prepared];

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

    const missingParagraphs = currentParagraphs.filter(p => !isGlossComplete(p, targetLang));

    if (onProgress) {
      onProgress({
        total: totalParagraphs,
        completed: initialCompleted,
        isGlossing: true,
        isComplete: false,
        failed: 0
      });
    }

    const CHUNK_SIZE = 5;
    const MAX_RETRIES = 2;
    const retryCountMap = new Map();
    let actualAiRequestsCount = 0;

    const initialChunks = [];
    for (let i = 0; i < missingParagraphs.length; i += CHUNK_SIZE) {
      initialChunks.push(missingParagraphs.slice(i, i + CHUNK_SIZE));
    }

    // Helper to process a batch of paragraphs
    const processBatch = async (batch) => {
      if (!Array.isArray(batch) || batch.length === 0) return [];
      if (checkAborted()) return [];

      actualAiRequestsCount++;
      const aiResults = await fetchBatchGlossesApi(batch, targetLang, nativeLang, apiKey, abortSignal);
      if (checkAborted()) return [];
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
              const mergedTokens = mergeAiTokensWithSegmented(p.tokens, item.tokens, targetLang);
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

      if (onProgress) {
        const completed = getCompletedCount(currentParagraphs);
        onProgress({
          total: totalParagraphs,
          completed,
          isGlossing: true,
          isComplete: completed === totalParagraphs,
          failed: 0
        });
      }

      return batch.filter(p => {
        const current = currentParagraphs.find(cp => cp.id === p.id) || p;
        return !isGlossComplete(current, targetLang);
      });
    };

    const pendingRetries = [];

    // Pass 1: Primary chunks of 5
    for (const chunk of initialChunks) {
      if (checkAborted()) return;
      const incomplete = await processBatch(chunk);
      if (checkAborted()) return;
      for (const p of incomplete) {
        const attempts = (retryCountMap.get(p.id) || 0) + 1;
        retryCountMap.set(p.id, attempts);
        if (attempts <= MAX_RETRIES) {
          pendingRetries.push(currentParagraphs.find(cp => cp.id === p.id) || p);
        }
      }
      await new Promise(r => setTimeout(r, 200));
    }

    // Pass 2: Retries in smaller batches of 3
    while (pendingRetries.length > 0) {
      if (checkAborted()) return;
      const retryBatch = pendingRetries.splice(0, 3);
      const incomplete = await processBatch(retryBatch);
      if (checkAborted()) return;
      for (const p of incomplete) {
        const attempts = (retryCountMap.get(p.id) || 0) + 1;
        retryCountMap.set(p.id, attempts);
        if (attempts <= MAX_RETRIES) {
          pendingRetries.push(currentParagraphs.find(cp => cp.id === p.id) || p);
        } else {
          console.warn(`Text paragraph "${p.id}" reached max retries. Retaining partial gloss.`);
        }
      }
      await new Promise(r => setTimeout(r, 300));
    }

    const finalCompleted = getCompletedCount(currentParagraphs);
    if (onProgress) {
      onProgress({
        total: totalParagraphs,
        completed: finalCompleted,
        isGlossing: false,
        isComplete: finalCompleted === totalParagraphs,
        failed: totalParagraphs - finalCompleted
      });
    }
  })().catch(err => {
    console.warn('Text glossing notice:', err);
    if (onProgress) {
      const finalCompleted = getCompletedCount(prepared);
      onProgress({
        total: totalParagraphs,
        completed: finalCompleted,
        isGlossing: false,
        isComplete: finalCompleted === totalParagraphs,
        failed: totalParagraphs - finalCompleted
      });
    }
  });

  return prepared;
}
