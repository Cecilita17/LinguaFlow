/**
 * Service for extracting Chinese characters (Hanzi) and stroke metadata
 * from corrected text and diff tokens.
 */

const HANZI_REGEX = /[\u4e00-\u9fff\u3400-\u4dbf]/;

/**
 * Extracts Hanzi characters from the corrected text and diff tokens.
 * Marks characters as isNewOrChanged if they came from a modified/new token.
 * 
 * @param {string} correctedText - The corrected Chinese sentence
 * @param {Array} diffTokens - Diff tokens from the pedagogical correction engine
 * @returns {{ allItems: Array, changedItems: Array }}
 */
export function extractHanziItems(correctedText = '', diffTokens = []) {
  const changedCharsSet = new Set();
  const tokenPinyinMap = new Map();

  // 1. Identify changed/new Chinese characters from diffTokens
  (diffTokens || []).forEach(token => {
    const text = token.text || '';
    const pinyin = token.translit || token.pinyin || '';
    const isChanged = Boolean(token.changed);

    for (const ch of text) {
      if (HANZI_REGEX.test(ch)) {
        if (isChanged) {
          changedCharsSet.add(ch);
        }
        if (pinyin && !tokenPinyinMap.has(ch)) {
          tokenPinyinMap.set(ch, pinyin);
        }
      }
    }
  });

  // 2. Extract every Hanzi character in the exact order of the corrected sentence
  const allItems = [];
  const textChars = Array.from(correctedText || '');

  textChars.forEach((ch, idx) => {
    if (HANZI_REGEX.test(ch)) {
      allItems.push({
        char: ch,
        sentenceIndex: idx,
        isNewOrChanged: changedCharsSet.has(ch),
        pinyin: tokenPinyinMap.get(ch) || null
      });
    }
  });

  const changedItems = allItems.filter(item => item.isNewOrChanged);

  return {
    allItems,
    changedItems
  };
}
