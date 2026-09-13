/**
 * Chinese Token Segmentation Validation Utility
 * 
 * Provides detailed diagnostics for problematic token structures
 * from Groq, with specific guidance for fixing common issues.
 */

export const SEGMENTATION_ISSUES = {
  OVERSIZED_TOKEN: 'oversized_token',
  MISSING_PINYIN: 'missing_pinyin',
  INCOMPLETE_COVERAGE: 'incomplete_coverage',
  PUNCTUATION_MIXED: 'punctuation_mixed',
  WRONG_STRUCTURE: 'wrong_structure'
};

/**
 * Diagnoses specific segmentation problems
 * @param {string} text
 * @param {Array} tokens
 * @returns {Array<object>} Detailed issues with fixes
 */
export function diagnoseSegmentationIssues(text, tokens) {
  const issues = [];

  if (!tokens || tokens.length === 0) {
    return [{
      issue: SEGMENTATION_ISSUES.INCOMPLETE_COVERAGE,
      severity: 'critical',
      message: 'No tokens provided',
      fix: 'Resegment entire text character by character'
    }];
  }

  // Issue 1: Oversized tokens
  tokens.forEach((token, idx) => {
    const word = token.word || token.text || '';
    const chineseCount = (word.match(/[\u4E00-\u9FFF]/g) || []).length;

    if (chineseCount > 5) {
      issues.push({
        issue: SEGMENTATION_ISSUES.OVERSIZED_TOKEN,
        severity: 'high',
        token: word,
        index: idx,
        message: `Token too large: "${word}" contains ${chineseCount} Chinese characters (max 3-4 recommended)`,
        fix: `Split into smaller words: ${splitTokenSuggestion(word)}`
      });
    }

    // Punctuation mixed with word
    if (/[\u4E00-\u9FFF]/.test(word) && /[。！？；，、]/.test(word)) {
      issues.push({
        issue: SEGMENTATION_ISSUES.PUNCTUATION_MIXED,
        severity: 'medium',
        token: word,
        index: idx,
        message: `Punctuation mixed with Chinese: "${word}"`,
        fix: `Separate: "${word.replace(/[。！？；，、]/g, '')}" + "${word.match(/[。！？；，、]/g).join('')}"`
      });
    }
  });

  // Issue 2: Missing Pinyin
  tokens.forEach((token, idx) => {
    const word = token.word || token.text || '';
    if (/[\u4E00-\u9FFF]/.test(word) && !token.translit && !token.pinyin) {
      issues.push({
        issue: SEGMENTATION_ISSUES.MISSING_PINYIN,
        severity: 'high',
        token: word,
        index: idx,
        message: `No Pinyin for: "${word}"`,
        fix: `Add Pinyin with tone marks (e.g., "${word}" → "nǐ hǎo")`
      });
    }
  });

  // Issue 3: Coverage
  let reconstructed = '';
  tokens.forEach(t => {
    reconstructed += (t.word || t.text || '');
  });

  const coverage = (reconstructed.length / text.length) * 100;
  if (coverage < 90) {
    issues.push({
      issue: SEGMENTATION_ISSUES.INCOMPLETE_COVERAGE,
      severity: 'critical',
      coverage: coverage.toFixed(1),
      message: `Text coverage only ${coverage.toFixed(1)}% (need ≥90%)`,
      missing: findMissingText(text, reconstructed),
      fix: 'Add tokens for missing text'
    });
  }

  return issues;
}

/**
 * Suggests how to split an oversized token
 */
function splitTokenSuggestion(word) {
  if (word.length <= 2) return `"${word}"`;
  
  const parts = [];
  for (let i = 0; i < word.length; i++) {
    parts.push(`"${word[i]}"`);
  }
  return parts.join(' + ');
}

/**
 * Finds text that wasn't reconstructed
 */
function findMissingText(original, reconstructed) {
  const missing = [];
  let origPos = 0;
  let reconPos = 0;

  while (origPos < original.length && reconPos < reconstructed.length) {
    if (original[origPos] === reconstructed[reconPos]) {
      origPos++;
      reconPos++;
    } else {
      let gap = '';
      const startPos = origPos;
      while (origPos < original.length && original[origPos] !== reconstructed[reconPos]) {
        gap += original[origPos];
        origPos++;
      }
      if (gap) missing.push(gap);
    }
  }

  if (origPos < original.length) {
    missing.push(original.slice(origPos));
  }

  return missing;
}

/**
 * Generates a detailed report for debugging
 */
export function generateSegmentationReport(text, tokens) {
  const issues = diagnoseSegmentationIssues(text, tokens);
  
  return {
    summary: {
      totalIssues: issues.length,
      severity: issues.length === 0 ? 'none' : 
                issues.some(i => i.severity === 'critical') ? 'critical' :
                issues.some(i => i.severity === 'high') ? 'high' : 'medium',
      text: text,
      tokenCount: tokens.length
    },
    issues: issues,
    recommendations: generateRecommendations(issues)
  };
}

/**
 * Generates fix recommendations based on issues
 */
function generateRecommendations(issues) {
  const recs = [];

  if (issues.some(i => i.issue === SEGMENTATION_ISSUES.OVERSIZED_TOKEN)) {
    recs.push({
      priority: 1,
      action: 'Resegment oversized tokens',
      details: 'Break any token with 4+ Chinese characters into individual words'
    });
  }

  if (issues.some(i => i.issue === SEGMENTATION_ISSUES.MISSING_PINYIN)) {
    recs.push({
      priority: 2,
      action: 'Add missing Pinyin',
      details: 'Every Chinese character must have tone-marked Pinyin'
    });
  }

  if (issues.some(i => i.issue === SEGMENTATION_ISSUES.INCOMPLETE_COVERAGE)) {
    recs.push({
      priority: 0,
      action: 'Fix text coverage',
      details: 'Add tokens for all missing portions of the original text'
    });
  }

  if (issues.some(i => i.issue === SEGMENTATION_ISSUES.PUNCTUATION_MIXED)) {
    recs.push({
      priority: 3,
      action: 'Separate punctuation',
      details: 'Move punctuation to separate tokens'
    });
  }

  return recs.sort((a, b) => a.priority - b.priority);
}

/**
 * Logs detailed diagnostic info to console
 */
export function logSegmentationDiagnostics(text, tokens) {
  const report = generateSegmentationReport(text, tokens);
  
  console.group('🔍 Chinese Segmentation Diagnostic Report');
  console.log(`Text: "${text}"`);
  console.log(`Tokens: ${report.summary.tokenCount}`);
  console.log(`Severity: ${report.summary.severity.toUpperCase()}`);
  
  if (report.issues.length > 0) {
    console.group(`Issues (${report.issues.length})`);
    report.issues.forEach((issue, idx) => {
      console.log(`[${idx + 1}] ${issue.issue} (${issue.severity})`);
      console.log(`   Message: ${issue.message}`);
      if (issue.fix) console.log(`   Fix: ${issue.fix}`);
    });
    console.groupEnd();
  } else {
    console.log('✅ No issues detected');
  }

  if (report.recommendations.length > 0) {
    console.group('Recommendations');
    report.recommendations.forEach(rec => {
      console.log(`[${rec.priority}] ${rec.action}: ${rec.details}`);
    });
    console.groupEnd();
  }
  
  console.groupEnd();
}
