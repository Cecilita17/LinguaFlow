import React from 'react';

/**
 * Shared InterlinearGloss component used across all reading views (Text Reader, YouTube Reader, EPUB).
 * Guarantees:
 * 1. PRIORIDAD 1 — Never truncates: no ellipsis ("..."), no hidden overflow clipping.
 * 2. PRIORIDAD 2 — Tries to keep gloss in a single line using natural horizontal space (w-max).
 * 3. PRIORIDAD 3 — Gracefully wraps onto multiple lines as a fallback when length exceeds readable max-width.
 * 4. Supports all languages (LTR & RTL direction awareness).
 */
export function InterlinearGloss({
  gloss,
  isChinese = false,
  nativeLang = 'es',
  className = ''
}) {
  if (!gloss) return null;

  // Detect RTL for native language glosses (e.g. Arabic/Hebrew native speakers)
  const isRtlNative = nativeLang === 'ar' || nativeLang === 'he' || nativeLang === 'fa' || nativeLang === 'ur';
  const glossDir = isRtlNative ? 'rtl' : 'ltr';

  return (
    <span
      dir={glossDir}
      title={gloss}
      className={`interlinear-gloss font-normal leading-tight text-center select-text isolate [unicode-bidi:isolate] transition-colors whitespace-normal break-words [overflow-wrap:anywhere] w-max max-w-full text-[14px] sm:text-[15px] text-[var(--text-muted)] group-hover/token:text-rose-600 dark:group-hover/token:text-rose-300 group-hover/line:text-[var(--text-secondary)] ${
        isChinese
          ? 'mt-0.5 max-w-[160px] sm:max-w-[200px]'
          : 'mt-1 max-w-[180px] sm:max-w-[220px]'
      } ${className}`}
    >
      {gloss}
    </span>
  );
}

export default InterlinearGloss;
