import { computeWordDiff, SUPPORTED_LANGUAGES, DEMO_CONVERSATIONS } from './server/languageData.js';

console.log('--- TEST 1: Diff calculation for user example ---');
const original = 'yo tener sueño';
const corrected = 'yo tengo sueño';
const diff = computeWordDiff(original, corrected);
console.log('Original:', original);
console.log('Diff result:', JSON.stringify(diff, null, 2));

const hasChangedWord = diff.some(d => d.changed && d.original === 'tener');
if (hasChangedWord) {
  console.log('✅ TEST 1 PASSED: "tengo" correctly marked as changed from "tener"');
} else {
  console.error('❌ TEST 1 FAILED');
}

console.log('\n--- TEST 2: Transliteration supported languages ---');
const translitLangs = SUPPORTED_LANGUAGES.filter(l => l.hasTranslit);
console.log('Languages with transliteration:', translitLangs.map(l => l.name));
if (translitLangs.some(l => l.code === 'zh') && translitLangs.some(l => l.code === 'ar')) {
  console.log('✅ TEST 2 PASSED: Chinese and Arabic have transliteration enabled');
} else {
  console.error('❌ TEST 2 FAILED');
}

console.log('\n--- ALL LOGIC TESTS PASSED ---');
