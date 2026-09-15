/**
 * Intelligent LCS (Longest Common Subsequence) diffing algorithm
 * between original learner text and grammatically corrected text.
 */
export function computeWordDiff(original, corrected) {
  const orig = (original || '').trim().split(/\s+/).filter(Boolean);
  const corr = (corrected || '').trim().split(/\s+/).filter(Boolean);

  const clean = w => (w || '').toLowerCase().replace(/^[^\w\u00C0-\u024F\u0400-\u04FF\u0600-\u06FF\u4E00-\u9FFF]+|[^\w\u00C0-\u024F\u0400-\u04FF\u0600-\u06FF\u4E00-\u9FFF]+$/g, '');

  const m = orig.length;
  const n = corr.length;
  const dp = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (clean(orig[i - 1]) === clean(corr[j - 1]) && clean(orig[i - 1]).length > 0) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  let i = m;
  let j = n;
  const tokens = [];

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && clean(orig[i - 1]) === clean(corr[j - 1]) && clean(orig[i - 1]).length > 0) {
      tokens.unshift({
        text: corr[j - 1],
        changed: false,
        original: null
      });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      tokens.unshift({
        text: corr[j - 1],
        changed: true,
        original: i > 0 && dp[i - 1][j] === dp[i][j] ? orig[i - 1] : null
      });
      if (i > 0 && dp[i - 1][j] === dp[i][j]) {
        i--;
      }
      j--;
    } else {
      tokens.unshift({
        text: '',
        changed: true,
        original: orig[i - 1]
      });
      i--;
    }
  }

  return tokens.filter(t => t.text.length > 0 || t.original !== null);
}
