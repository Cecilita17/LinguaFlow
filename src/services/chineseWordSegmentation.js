import { JiebaDict } from 'jieba-zh-cn';

let lexicon;
let logTotal;
let maxWordLength;

function getLexicon() {
  if (lexicon) return lexicon;
  lexicon = new Map();
  let total = 0;
  maxWordLength = 1;
  for (const row of new TextDecoder().decode(JiebaDict).split('\n')) {
    const [word, count] = row.split(' ');
    if (!word || !/^[\u3400-\u9fff]+$/.test(word)) continue;
    const frequency = Number(count) || 1;
    lexicon.set(word, Math.log(frequency));
    total += frequency;
    maxWordLength = Math.max(maxWordLength, word.length);
  }
  logTotal = Math.log(total);
  return lexicon;
}

// Maximum-probability word segmentation over Jieba's frequency dictionary.
// Use the same lexical boundaries on every device, independent of ICU data.
function segmentHanzi(text, start) {
  const words = getLexicon();
  const scores = new Float64Array(text.length + 1);
  const next = new Uint32Array(text.length);
  for (let i = text.length - 1; i >= 0; i--) {
    scores[i] = -Infinity;
    for (let length = 1; length <= Math.min(maxWordLength, text.length - i); length++) {
      const frequency = words.get(text.slice(i, i + length));
      if (frequency === undefined && length !== 1) continue;
      const score = (frequency ?? 0) - logTotal + scores[i + length];
      if (score > scores[i]) {
        scores[i] = score;
        next[i] = i + length;
      }
    }
  }
  const result = [];
  for (let i = 0; i < text.length; i = next[i]) {
    result.push({ segment: text.slice(i, next[i]), index: start + i, isWordLike: true });
  }
  return result;
}

export function segmentChineseWords(text) {
  const result = [];
  for (const run of text.matchAll(/[\u3400-\u9fff]+|[^\u3400-\u9fff]+/gu)) {
    if (/^[\u3400-\u9fff]/.test(run[0])) {
      result.push(...segmentHanzi(run[0], run.index));
    } else {
      for (const part of run[0].matchAll(/\s+|[\p{L}\p{N}]+|[^\p{L}\p{N}\s]/gu)) {
        result.push({
          segment: part[0],
          index: run.index + part.index,
          isWordLike: /^[\p{L}\p{N}]/u.test(part[0])
        });
      }
    }
  }
  return result;
}
