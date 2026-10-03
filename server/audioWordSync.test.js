import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

// Isolate the pure splitting helpers from browser-only gloss service imports.
const source = readFileSync(new URL('../src/utils/audioWordSync.js', import.meta.url), 'utf8');
const { splitSpeechParagraph } = runInNewContext(
  source.slice(source.indexOf('export function normalizeAudioText'), source.indexOf('export function findActiveTokenIndex')).replaceAll('export ', '')
    + '\n({ splitSpeechParagraph });',
  { Intl, PUNCTUATION_REGEX: /^[\p{P}\s]+$/u }
);

function verifyOffsets(text, chunks) {
  for (const chunk of chunks) assert.equal(text.slice(chunk.offset, chunk.offset + chunk.text.length), chunk.text);
  assert.equal(chunks.map(chunk => chunk.text).join(' ').replace(/\s+/g, ''), text.replace(/\s+/g, ''));
}

test('Italian phrase stays intact across the old character limit', () => {
  const text = '« Dopo la catastrofe, si aprirono i varchi » continuò, e mi trattenni dal dirle che quella roba la sapevo già, perché preferivo che parlasse, che si aprisse.';
  const chunks = splitSpeechParagraph(text, [], 'it');
  assert.ok(chunks.some(chunk => chunk.text.includes('che quella roba la sapevo già,')));
  for (const chunk of chunks.slice(0, -1)) assert.match(chunk.text, /[.,;:!?][»”’"')\]}]*$/u);
  verifyOffsets(text, chunks);
});

test('long phrases without punctuation are not forcibly cut between words', () => {
  const text = Array(40).fill('parola').join(' ');
  const chunks = splitSpeechParagraph(text, [], 'it');
  assert.equal(chunks.length, 1);
  assert.equal(chunks[0].text, text);
});

test('Arabic and Chinese punctuation provide natural boundaries', () => {
  for (const [text, lang] of [
    ['هذا نص عربي طويل للقراءة، وهذه جملة أخرى طويلة أيضًا؛ هل يمكن سماعها بشكل طبيعي؟ نعم بالتأكيد.', 'ar'],
    ['这是一个很长的中文句子，我们应该在标点符号后面停顿。接下来继续读另外一句话，不要在单词之间突然停止。', 'zh']
  ]) {
    const chunks = splitSpeechParagraph(text, [], lang, 25);
    assert.ok(chunks.length > 1);
    for (const chunk of chunks.slice(0, -1)) assert.match(chunk.text, /[،؛؟。，]$/u);
    verifyOffsets(text, chunks);
  }
});

test('decimal numbers and times stay together', () => {
  for (const number of ['3.14', '1,000', '14:30']) {
    const text = 'a'.repeat(48) + ' ' + number + ' sono i valori corretti, continuiamo.';
    const chunks = splitSpeechParagraph(text, [], 'it');
    assert.ok(chunks.some(chunk => chunk.text.includes(number)));
    verifyOffsets(text, chunks);
  }
});

test('closing quotes and supplied token identities remain aligned', () => {
  const text = 'Una frase abbastanza lunga per iniziare. » Poi continuiamo con altre parole, senza tagli strani.';
  const tokens = Array.from(new Intl.Segmenter('it', { granularity: 'word' }).segment(text), part => ({ word: part.segment }));
  const chunks = splitSpeechParagraph(text, tokens, 'it');
  verifyOffsets(text, chunks);
  for (const chunk of chunks) for (const token of chunk.tokens) assert.ok(tokens.includes(token));
  const quoted = splitSpeechParagraph('Una frase abbastanza lunga per iniziare.» Poi continuiamo con altre parole.', [], 'it');
  assert.ok(quoted[0].text.endsWith('.»'));
});
