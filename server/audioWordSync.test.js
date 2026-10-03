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

function createSyncHarness(lang = 'zh', android = true, options = {}) {
  let now = 100;
  let tick = () => {};
  const { createAudioWordSynchronizer } = runInNewContext(
    source.replace(/^import .*;$/mg, '').replaceAll('export ', '') + '\n({ createAudioWordSynchronizer });',
    {
      Intl, PUNCTUATION_REGEX: /^[\p{P}\s]+$/u,
      performance: { now: () => now },
      setInterval: callback => { tick = callback; return 1; },
      clearInterval: () => { tick = () => {}; },
      console: { log() {}, warn() {} }
    }
  );
  const words = lang === 'ar' ? ['مرحبا', 'كيف', 'حالك'] : ['你好', '中国', '谢谢'];
  const text = words.join(' ');
  const sync = createAudioWordSynchronizer({ text, tokens: words.map(word => ({ word })), targetLang: lang, isAndroid: android, ...options });
  return { sync, index: i => text.indexOf(words[i]), advance(ms) { now += ms; tick(); } };
}

test('sparse word events recover pacing on mobile and desktop', () => {
  for (const android of [true, false]) {
    const h = createSyncHarness('zh', android);
    h.sync.handleStart();
    h.sync.handleBoundary({ charIndex: 0, name: 'word' });
    h.advance(200);
    assert.equal(h.sync.getActiveTokenPos(), 0, 'fresh events retain control');
    h.advance(1000);
    assert.ok(h.sync.getActiveTokenPos() > 0, 'missing events do not freeze the highlight');
    h.sync.handleBoundary({ charIndex: 0, name: 'word' });
    assert.equal(h.sync.getActiveTokenPos(), 0, 'a real event corrects fallback drift');
    h.sync.stop();
  }
});

test('Arabic word events correct the highlight immediately', () => {
  const h = createSyncHarness('ar');
  h.sync.handleStart();
  h.sync.handleBoundary({ charIndex: h.index(2), name: 'word' });
  assert.equal(h.sync.getActiveTokenPos(), 2);
  h.advance(100);
  assert.equal(h.sync.getActiveTokenPos(), 2);
  h.sync.stop();
});

test('paused speech cannot advance fallback highlighting', () => {
  const h = createSyncHarness();
  h.sync.handleStart();
  h.sync.handleBoundary({ charIndex: 0, name: 'word' });
  h.sync.handlePause();
  h.advance(5000);
  assert.equal(h.sync.getActiveTokenPos(), 0);
  h.sync.handleResume();
  h.advance(100);
  assert.equal(h.sync.getActiveTokenPos(), 0);
  h.sync.stop();
});

test('Android catches up to elapsed speech time after a delayed timer', () => {
  const h = createSyncHarness('zh', true);
  h.sync.handleStart();
  h.advance(1300);
  assert.equal(h.sync.getActiveTokenPos(), 2, 'a delayed tick must not leave the visual position one word behind');
  h.sync.stop();
});

test('fallback does not add a long grace delay after the estimated word end', () => {
  const h = createSyncHarness('zh', true);
  h.sync.handleStart();
  h.sync.handleBoundary({ charIndex: 0, name: 'word' });
  h.advance(650);
  assert.equal(h.sync.getActiveTokenPos(), 1);
  h.sync.stop();
});


test('completed speech measures real duration and applies it when the next queued chunk starts', () => {
  let scale = 1;
  const options = {
    getDurationScale: () => scale,
    onDurationMeasured: sample => { scale = sample.actualDurationMs / sample.estimatedDurationMs; }
  };
  const first = createSyncHarness('ar', true, options);
  const queued = createSyncHarness('ar', true, options);
  first.sync.handleStart();
  first.advance(700);
  first.sync.handleEnd();
  assert.ok(scale < 1, 'a faster real voice reduces the next estimated duration');
  queued.sync.handleStart();
  queued.advance(550);
  assert.equal(queued.sync.getActiveTokenPos(), 2);
  queued.sync.stop();
});

test('cancelled speech never trains the duration estimate', () => {
  let measured = false;
  const h = createSyncHarness('ar', true, { onDurationMeasured: () => { measured = true; } });
  h.sync.handleStart();
  h.advance(500);
  h.sync.stop();
  h.sync.handleEnd();
  assert.equal(measured, false);
});


test('slow playback does not apply the nonlinear engine rate to the visual clock', () => {
  for (const speed of [0.75, 0.80, 0.85, 1]) {
    const engineRate = speed < 1 ? Math.round((0.35 + ((speed - 0.60) / 0.40) * 0.65) * 1000) / 1000 : 1;
    const h = createSyncHarness('zh', true, { speechRate: speed, utteranceRate: engineRate });
    h.sync.handleStart();
    h.advance(1250 / speed);
    assert.equal(h.sync.getActiveTokenPos(), 2, `visual progress at ${speed}x must scale with playback speed`);
    h.sync.stop();
  }
});
