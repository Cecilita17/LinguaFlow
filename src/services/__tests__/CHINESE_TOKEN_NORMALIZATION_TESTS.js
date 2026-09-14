/**
 * Test Suite for Chinese Token Normalization
 * 
 * Run these tests to validate the token normalization system works correctly.
 * Can be used with Jest, Vitest, or run manually in browser console.
 */

import {
  normalizeChineseTokens,
  validateChineseTokens,
  areTokensProblematic,
  inspectChineseTokens
} from '../src/services/chineseTokenNormalizer.js';

import {
  diagnoseSegmentationIssues,
  generateSegmentationReport,
  logSegmentationDiagnostics
} from '../src/services/segmentationDiagnostics.js';

// ============================================================
// TEST DATA
// ============================================================

const TEST_CASES = {
  // Perfect tokens (no repair needed)
  perfect: {
    text: '你好！很高兴和你练习中文。',
    tokens: [
      { word: '你好', translit: 'nǐ hǎo', gloss: 'hola', clean_word: '你好' },
      { word: '！', translit: null, gloss: null, clean_word: '！' },
      { word: '很', translit: 'hěn', gloss: 'muy', clean_word: '很' },
      { word: '高兴', translit: 'gāoxìng', gloss: 'contento', clean_word: '高兴' },
      { word: '和', translit: 'hé', gloss: 'y', clean_word: '和' },
      { word: '你', translit: 'nǐ', gloss: 'tú', clean_word: '你' },
      { word: '练习', translit: 'liànxí', gloss: 'practicar', clean_word: '练习' },
      { word: '中文', translit: 'zhōngwén', gloss: 'chino', clean_word: '中文' },
      { word: '。', translit: null, gloss: null, clean_word: '。' }
    ],
    expected: 'valid'
  },

  // Oversized token (whole sentence)
  oversized: {
    text: '你好！很高兴和你练习中文。',
    tokens: [
      { word: '你好！很高兴和你练习中文。', translit: 'nǐ hǎo hěn gāoxìng hé nǐ liànxí zhōngwén', gloss: null, clean_word: '你好很高兴和你练习中文' }
    ],
    expected: 'repair'
  },

  // Missing Pinyin
  missingPinyin: {
    text: '我叫小红',
    tokens: [
      { word: '我', translit: 'wǒ', gloss: 'yo', clean_word: '我' },
      { word: '叫', translit: null, gloss: null, clean_word: '叫' }, // Missing Pinyin
      { word: '小红', translit: 'xiǎo hóng', gloss: 'Xiaohong', clean_word: '小红' }
    ],
    expected: 'repair'
  },

  // Incomplete coverage
  incompleteCoverage: {
    text: '我想去北京',
    tokens: [
      { word: '我想', translit: 'wǒ xiǎng', gloss: 'quiero', clean_word: '我想' } // Only 2/4 chars
    ],
    expected: 'repair'
  },

  // Punctuation mixed with word
  punctuationMixed: {
    text: '你好，我叫小红。',
    tokens: [
      { word: '你好，', translit: 'nǐ hǎo', gloss: 'hola', clean_word: '你好' }, // Comma attached
      { word: '我', translit: 'wǒ', gloss: 'yo', clean_word: '我' },
      { word: '叫', translit: 'jiào', gloss: 'llamarse', clean_word: '叫' },
      { word: '小红。', translit: 'xiǎo hóng', gloss: 'Xiaohong', clean_word: '小红' } // Period attached
    ],
    expected: 'repair'
  }
};

// ============================================================
// TEST FUNCTIONS
// ============================================================

export function runAllTests() {
  console.group('🧪 Chinese Token Normalization Test Suite');
  
  let passed = 0;
  let failed = 0;

  // Test 1: Perfect Tokens
  console.group('Test 1: Perfect Tokens (No Repair Needed)');
  try {
    const result = testPerfectTokens();
    console.log('✅ PASSED', result);
    passed++;
  } catch (e) {
    console.error('❌ FAILED', e.message);
    failed++;
  }
  console.groupEnd();

  // Test 2: Oversized Token Repair
  console.group('Test 2: Oversized Token Repair');
  try {
    const result = testOversizedTokenRepair();
    console.log('✅ PASSED', result);
    passed++;
  } catch (e) {
    console.error('❌ FAILED', e.message);
    failed++;
  }
  console.groupEnd();

  // Test 3: Missing Pinyin Repair
  console.group('Test 3: Missing Pinyin Repair');
  try {
    const result = testMissingPinyinRepair();
    console.log('✅ PASSED', result);
    passed++;
  } catch (e) {
    console.error('❌ FAILED', e.message);
    failed++;
  }
  console.groupEnd();

  // Test 4: Incomplete Coverage Repair
  console.group('Test 4: Incomplete Coverage Repair');
  try {
    const result = testIncompleteCoverageRepair();
    console.log('✅ PASSED', result);
    passed++;
  } catch (e) {
    console.error('❌ FAILED', e.message);
    failed++;
  }
  console.groupEnd();

  // Test 5: Punctuation Separation
  console.group('Test 5: Punctuation Separation');
  try {
    const result = testPunctuationSeparation();
    console.log('✅ PASSED', result);
    passed++;
  } catch (e) {
    console.error('❌ FAILED', e.message);
    failed++;
  }
  console.groupEnd();

  // Test 6: Diagnostics Report
  console.group('Test 6: Diagnostics Report Generation');
  try {
    const result = testDiagnosticsReport();
    console.log('✅ PASSED', result);
    passed++;
  } catch (e) {
    console.error('❌ FAILED', e.message);
    failed++;
  }
  console.groupEnd();

  console.log(`\n📊 Test Summary: ${passed} passed, ${failed} failed out of ${passed + failed}`);
  console.groupEnd();

  return { passed, failed, total: passed + failed };
}

// ============================================================
// INDIVIDUAL TEST IMPLEMENTATIONS
// ============================================================

function testPerfectTokens() {
  const { text, tokens } = TEST_CASES.perfect;
  const validation = validateChineseTokens(text, tokens);

  if (!validation.isValid) {
    throw new Error(`Expected valid tokens, got issues: ${validation.issues.join(', ')}`);
  }

  if (validation.coverage < 95) {
    throw new Error(`Coverage too low: ${validation.coverage}%`);
  }

  return {
    message: 'Perfect tokens validated without issues',
    coverage: validation.coverage.toFixed(1) + '%',
    issues: validation.issues.length
  };
}

function testOversizedTokenRepair() {
  const { text, tokens } = TEST_CASES.oversized;
  
  // Should detect as problematic
  const validation = validateChineseTokens(text, tokens);
  if (validation.isValid) {
    throw new Error('Expected oversized token to be detected as problematic');
  }

  // Should repair
  const repaired = normalizeChineseTokens(text, tokens);
  const repairedValidation = validateChineseTokens(text, repaired);

  if (!repairedValidation.isValid) {
    throw new Error(`Repair failed, still has issues: ${repairedValidation.issues.join(', ')}`);
  }

  if (repaired.length < tokens.length) {
    throw new Error('Repair should create more tokens, not fewer');
  }

  return {
    message: 'Oversized token successfully resegmented',
    tokensBefore: tokens.length,
    tokensAfter: repaired.length,
    coverageAfter: repairedValidation.coverage.toFixed(1) + '%'
  };
}

function testMissingPinyinRepair() {
  const { text, tokens } = TEST_CASES.missingPinyin;
  
  const validation = validateChineseTokens(text, tokens);
  if (validation.isValid) {
    throw new Error('Expected missing Pinyin to be detected');
  }

  const repaired = normalizeChineseTokens(text, tokens);
  
  // Check all Chinese tokens have Pinyin
  let missingCount = 0;
  repaired.forEach(token => {
    const hasChinese = /[\u4E00-\u9FFF]/.test(token.word);
    const hasPinyin = token.translit || token.pinyin;
    if (hasChinese && !hasPinyin) {
      missingCount++;
    }
  });

  if (missingCount > 0) {
    throw new Error(`Still ${missingCount} tokens without Pinyin after repair`);
  }

  return {
    message: 'All tokens now have Pinyin',
    tokensRepaired: repaired.length,
    allHavePinyin: true
  };
}

function testIncompleteCoverageRepair() {
  const { text, tokens } = TEST_CASES.incompleteCoverage;
  
  const validation = validateChineseTokens(text, tokens);
  if (validation.coverage > 90) {
    throw new Error(`Expected low coverage, got ${validation.coverage}%`);
  }

  const repaired = normalizeChineseTokens(text, tokens);
  const repairedValidation = validateChineseTokens(text, repaired);

  if (repairedValidation.coverage < 95) {
    throw new Error(`Coverage still low after repair: ${repairedValidation.coverage}%`);
  }

  return {
    message: 'Text coverage increased to 100%',
    coverageBefore: validation.coverage.toFixed(1) + '%',
    coverageAfter: repairedValidation.coverage.toFixed(1) + '%'
  };
}

function testPunctuationSeparation() {
  const { text, tokens } = TEST_CASES.punctuationMixed;
  
  const repaired = normalizeChineseTokens(text, tokens);
  
  // Check no token has both Chinese and punctuation
  let mixedCount = 0;
  repaired.forEach(token => {
    const word = token.word || '';
    const hasChinese = /[\u4E00-\u9FFF]/.test(word);
    const hasPunct = /[。！？；，、]/g.test(word);
    if (hasChinese && hasPunct) {
      mixedCount++;
    }
  });

  if (mixedCount > 0) {
    throw new Error(`Still ${mixedCount} tokens with mixed punctuation`);
  }

  return {
    message: 'Punctuation successfully separated',
    tokensAfter: repaired.length,
    noPunctMixing: true
  };
}

function testDiagnosticsReport() {
  const { text, tokens } = TEST_CASES.oversized;
  
  const report = generateSegmentationReport(text, tokens);

  if (report.summary.severity === 'none') {
    throw new Error('Expected diagnostics to detect issues');
  }

  if (!Array.isArray(report.issues) || report.issues.length === 0) {
    throw new Error('Expected issues array to be populated');
  }

  if (!Array.isArray(report.recommendations)) {
    throw new Error('Expected recommendations array');
  }

  return {
    message: 'Diagnostics report generated successfully',
    issuesDetected: report.issues.length,
    recommendations: report.recommendations.length,
    severity: report.summary.severity
  };
}

// ============================================================
// HELPER: RUN TESTS IN BROWSER CONSOLE
// ============================================================

/**
 * Paste this in browser console:
 * 
 * import { runAllTests } from './CHINESE_TOKEN_NORMALIZATION_TESTS.js';
 * runAllTests();
 * 
 * Or for manual inspection:
 * 
 * import { logSegmentationDiagnostics } from './src/services/segmentationDiagnostics.js';
 * const testCase = TEST_CASES.oversized;
 * logSegmentationDiagnostics(testCase.text, testCase.tokens);
 */

export function runTestInBrowser(testName) {
  const testCase = TEST_CASES[testName];
  if (!testCase) {
    console.error(`Unknown test: ${testName}. Available: ${Object.keys(TEST_CASES).join(', ')}`);
    return;
  }

  console.group(`🔍 Inspecting: ${testName}`);
  console.log('Original text:', testCase.text);
  console.log('Original tokens:', testCase.tokens);
  console.log('Expected outcome:', testCase.expected);
  
  const validation = validateChineseTokens(testCase.text, testCase.tokens);
  console.log('Validation:', validation);

  if (!validation.isValid) {
    console.log('🔧 Normalizing...');
    logSegmentationDiagnostics(testCase.text, testCase.tokens);
    
    const repaired = normalizeChineseTokens(testCase.text, testCase.tokens);
    console.log('Repaired tokens:', repaired);
    
    const repairedValidation = validateChineseTokens(testCase.text, repaired);
    console.log('Repaired validation:', repairedValidation);
  } else {
    console.log('✅ Already valid, no repair needed');
  }
  
  console.groupEnd();
}

// ============================================================
// EXPORT TEST RUNNER
// ============================================================

export default {
  runAllTests,
  runTestInBrowser,
  TEST_CASES
};
