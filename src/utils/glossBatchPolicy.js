// Leave room for Arabic transliteration and per-word JSON in a 4096-token response.
export function buildGlossBatches(lines, targetLang = 'en') {
  const wordBudget = targetLang === 'ar' ? 120 : 180;
  const characterBudget = targetLang === 'ar' ? 1500 : 2400;
  const batches = [];
  let batch = [], words = 0, characters = 0;
  for (const line of lines) {
    const text = String(line.text || '');
    const wordCount = (text.match(/[\p{L}\p{N}]+/gu) || []).length
      + (text.match(/\p{Script=Han}/gu) || []).length;
    if (batch.length && (batch.length >= 5 || words + wordCount > wordBudget || characters + text.length > characterBudget)) {
      batches.push(batch);
      batch = []; words = 0; characters = 0;
    }
    batch.push(line);
    words += wordCount; characters += text.length;
  }
  if (batch.length) batches.push(batch);
  return batches;
}

const recoverableCodes = new Set([
  'GLOSS_TRUNCATED', 'GLOSS_INCOMPLETE', 'GLOSS_EMPTY_RESPONSE',
  'GLOSS_INVALID_RESPONSE', 'GLOSS_INPUT_TOO_LARGE'
]);

export function isRecoverableGlossError(error) {
  return recoverableCodes.has(error?.code);
}

export async function runGlossBatches({ batches, processBatch, onRecoverableError, isAborted, delayMs = 150 }) {
  const attempted = new Set();
  for (const originalBatch of batches) {
    if (isAborted()) return;
    const batch = originalBatch.filter(line => {
      if (attempted.has(line.id)) return false;
      attempted.add(line.id);
      return true;
    });
    if (!batch.length) continue;
    try {
      await processBatch(batch);
    } catch (error) {
      if (isAborted()) return;
      if (!isRecoverableGlossError(error)) throw error;
      await onRecoverableError(error, batch);
    }
    if (isAborted()) return;
    if (delayMs) await new Promise(resolve => setTimeout(resolve, delayMs));
  }
}
