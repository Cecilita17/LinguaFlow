export function createSimplificationError(code, details = {}) {
  return Object.assign(new Error(code), details, { code });
}

export function formatSimplificationError(error, t, isParagraph = true) {
  const code = String(error?.code || 'SIMPLIFY_UNKNOWN').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 80);
  const key = `simplification_reason_${code.toLowerCase()}`;
  const translated = t(key);
  const reason = translated === key ? t('simplification_reason_simplify_unknown') : translated;
  const parts = [t(isParagraph ? 'paragraph_simplification_error_specific' : 'simplification_error_specific', { reason }), t('gloss_error_code', { code })];
  if (error?.status >= 400) parts.push(`HTTP ${error.status}`);
  if (Number.isFinite(error?.outputWords) && Number.isFinite(error?.sourceWords)) {
    parts.push(t('simplification_error_words', { output: error.outputWords, source: error.sourceWords }));
  }
  if (Number.isFinite(error?.returnedParagraphs) && Number.isFinite(error?.expectedParagraphs)) {
    parts.push(t('simplification_error_paragraphs', { output: error.returnedParagraphs, source: error.expectedParagraphs }));
  }
  return parts.join(' · ');
}
