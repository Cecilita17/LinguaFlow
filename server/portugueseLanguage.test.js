import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { SUPPORTED_LANGUAGES, computeWordDiff } from './languageData.js';
import { LANGUAGE_METADATA, DEFAULT_TARGET_LANGUAGES, getLocalizedLanguageName } from '../src/constants/languages.js';
import { getLanguageGlossStrategy } from '../src/services/languageGlossStrategies.js';
import { tokenizeLiveCallTurn } from '../src/services/liveCallGlossService.js';

const appSource = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
const fallback = runInNewContext(appSource.slice(appSource.indexOf('const SUPPORTED_LANGUAGES ='), appSource.indexOf('const STORAGE_PREFIX =')) + '\nSUPPORTED_LANGUAGES;');
const epubSource = readFileSync(new URL('../src/services/epubService.js', import.meta.url), 'utf8');
const normalizeEpubLanguage = runInNewContext(epubSource.slice(epubSource.indexOf('export function normalizeEpubLanguage'), epubSource.indexOf('/**', epubSource.indexOf('export function normalizeEpubLanguage'))).replace('export ', '') + '\nnormalizeEpubLanguage;');

test('Portuguese is available in backend, frontend fallback and reader catalogs', () => {
 for (const catalog of [SUPPORTED_LANGUAGES, fallback, DEFAULT_TARGET_LANGUAGES]) {
  const language = catalog.find(item => item.code === 'pt');
  assert.ok(language);
  assert.equal(language.speechCode, 'pt-BR');
  assert.equal(language.hasTranslit, false);
 }
 assert.equal(LANGUAGE_METADATA.pt.nativeName, 'Português');
 assert.equal(getLocalizedLanguageName('pt', 'Portugués', false), 'Portuguese');
});
test('Portuguese EPUB metadata supports Brazil, Portugal and ISO 639-2', () => {
 for (const code of ['pt', 'pt-BR', 'pt-PT', 'por', ' PT-br ']) assert.equal(normalizeEpubLanguage(code), 'pt');
});
test('Portuguese glosses and call tokens preserve accents and complete words', () => {
 const text = 'Olá! Você fala português?';
 for (const tokens of [getLanguageGlossStrategy('pt').tokenize(text), tokenizeLiveCallTurn(text, 'pt')]) {
  const words = tokens.map(token => token.word);
  assert.ok(words.includes('Olá'));
  assert.ok(words.includes('Você'));
  assert.ok(words.includes('português'));
  assert.ok(tokens.every(token => !token.translit && !token.auxiliary));
 }
});
test('Portuguese corrections preserve unchanged accented words', () => {
 const tokens = computeWordDiff('Você fala português', 'Você fala inglês');
 assert.equal(tokens[0].changed, false);
 assert.equal(tokens[0].text, 'Você');
 assert.equal(tokens.at(-1).changed, true);
});
