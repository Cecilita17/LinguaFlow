export function glossErrorCodeForHttp(status, providerCode = '') {
  if (['context_length_exceeded', 'request_too_large'].includes(providerCode)) return 'GLOSS_INPUT_TOO_LARGE';
  if (['model_not_found', 'model_decommissioned'].includes(providerCode)) return 'GLOSS_MODEL_UNAVAILABLE';
  if (status === 429) return 'GLOSS_RATE_LIMIT';
  if (status === 401) return 'GLOSS_AUTH_FAILED';
  if (status === 403) return 'GLOSS_ACCESS_DENIED';
  if (status === 413) return 'GLOSS_INPUT_TOO_LARGE';
  if (status === 408 || status === 504) return 'GLOSS_TIMEOUT';
  if (status === 400 || status === 422) return 'GLOSS_INVALID_REQUEST';
  if (status >= 500) return 'GLOSS_PROVIDER_UNAVAILABLE';
  return 'GLOSS_HTTP_ERROR';
}

export function createGlossError(code, details = {}) {
  return Object.assign(new Error(code), details, { code });
}

// Carry diagnostic fields, never raw provider responses or credentials.
export function getGlossErrorDetails(error) {
  const result = { code: error?.code || 'GLOSS_UNKNOWN' };
  for (const key of ['status', 'providerStatus', 'providerCode', 'requestId', 'retryAfter',
    'timeoutSeconds', 'missingWordsCount', 'totalWords', 'missingWords', 'lineIds', 'finishReason']) {
    if (error?.[key] !== undefined) result[key] = error[key];
  }
  return result;
}

export function formatGlossError(error, t) {
  const details = getGlossErrorDetails(error);
  const code = String(details.code).replace(/[^A-Za-z0-9_-]/g, '').slice(0, 80);
  const reasonKey = `gloss_reason_${code.toLowerCase()}`;
  let reason = t(reasonKey);
  if (reason === reasonKey) reason = t('gloss_reason_gloss_unknown');
  const parts = [t('gloss_error_specific', { reason }), t('gloss_error_code', { code })];
  const status = details.providerStatus || details.status;
  if (Number.isInteger(status) && status >= 400) parts.push(`HTTP ${status}`);
  if (/^[A-Za-z0-9_-]{1,80}$/.test(details.providerCode || '')) parts.push(t('gloss_error_provider_code', { code: details.providerCode }));
  if (details.timeoutSeconds) parts.push(t('gloss_error_timeout', { seconds: details.timeoutSeconds }));
  if (details.missingWordsCount) {
    parts.push(t('gloss_error_missing_words', { missing: details.missingWordsCount, total: details.totalWords }));
    if (details.missingWords?.length) parts.push(t('gloss_error_examples', { words: details.missingWords.slice(0, 3).join(', ') }));
  }
  if (/^\d+$/.test(String(details.retryAfter || ''))) parts.push(t('gloss_error_retry_after', { seconds: details.retryAfter }));
  return parts.join(' · ');
}
