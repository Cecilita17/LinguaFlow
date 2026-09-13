/**
 * Enhanced Prompt Template for Groq API
 * Language Learning Conversational AI with Robust Token Segmentation
 * 
 * Improvements:
 * 1. Explicit instruction for proper Chinese word segmentation
 * 2. Token structure validation requirements
 * 3. Fallback guidance when segmentation is uncertain
 * 4. Vocabulary gloss consistency rules
 */

export function buildSystemPrompt(targetLang, nativeLang) {
  const isChineseTarget = targetLang === 'zh';
  const commonInstructions = `You are a friendly and encouraging language learning assistant. Your role is to:
1. Engage in natural conversation in ${targetLang === 'zh' ? 'Mandarin Chinese' : targetLang}
2. Correct grammar errors gently and constructively
3. Provide vocabulary translations in ${nativeLang === 'es' ? 'Spanish' : nativeLang}
4. Help the learner understand cultural context and nuances`;

  if (isChineseTarget) {
    return `${commonInstructions}

CRITICAL: Chinese Word Segmentation Rules
==========================================
You MUST segment Chinese text into INDIVIDUAL WORDS, not phrases or whole sentences.
This is essential for the learner's UI to display Pinyin above each word correctly.

Segmentation Examples:
- ❌ WRONG: ["很高兴和你练习中文"] (whole sentence as one token)
- ✅ CORRECT: ["很", "高兴", "和", "你", "练习", "中文"]

- ❌ WRONG: ["我想去北京市"]
- ✅ CORRECT: ["我", "想", "去", "北京", "市"]

Guidelines:
1. Each token should represent ONE semantic unit (word, particle, or idiom)
2. Compound words like 高兴, 北京, 练习 count as single tokens
3. Particles (了, 吗, 呢, 的) are separate tokens
4. Punctuation marks go in separate tokens
5. If unsure about segmentation, break into smaller units rather than combining

Token Format Requirements:
- Each token object MUST have: { word, translit, gloss, clean_word }
- translit = Tone-marked Pinyin (e.g., "nǐ hǎo", NOT "ni hao")
- gloss = Brief Spanish meaning
- clean_word = Word without punctuation

Example valid token array:
[
  { word: "你好", translit: "nǐ hǎo", gloss: "hola", clean_word: "你好" },
  { word: "，", translit: null, gloss: null, clean_word: "，" },
  { word: "我", translit: "wǒ", gloss: "yo", clean_word: "我" },
  { word: "叫", translit: "jiào", gloss: "llamarse", clean_word: "叫" },
  { word: "小红", translit: "xiǎo hóng", gloss: "Xiaohong (nombre)", clean_word: "小红" }
]

NEVER:
- Combine multiple words into one token (e.g., "我想去" should NOT be a single token)
- Mix punctuation with words in the same token (e.g., "你好。" should be "你好" + "。")
- Omit Pinyin for any Chinese character
- Use Pinyin without tone marks (required for tone language)

If text coverage is incomplete or tokens don't match the original text 100%, 
add missing tokens explicitly rather than padding with oversized tokens.`;
  }

  return commonInstructions;
}

/**
 * Build the user message context with conversation history
 */
export function buildUserMessage(userText, targetLang, nativeLang, level, history) {
  const historyContext = history && history.length > 0
    ? `\n\nPrevious conversation:\n${history.slice(-3).map(m => {
        if (m.sender === 'user') return `User: ${m.text || m.correctedText}`;
        return `Assistant: ${m.text}`;
      }).join('\n')}`
    : '';

  return `[${level}] User (${nativeLang} speaker learning ${targetLang}): "${userText}"${historyContext}

Respond naturally, correct any errors, provide vocabulary, and return tokens.`;
}

/**
 * Validates Groq response structure before storing
 */
export function validateGroqResponse(response, targetLang) {
  if (!response || typeof response !== 'object') {
    throw new Error('Invalid response structure from Groq');
  }

  const { bot_response, user_correction } = response;

  // Validate bot response
  if (!bot_response) {
    throw new Error('Missing bot_response in Groq reply');
  }

  if (!bot_response.text || typeof bot_response.text !== 'string') {
    throw new Error('bot_response.text is missing or invalid');
  }

  if (!Array.isArray(bot_response.tokens)) {
    throw new Error('bot_response.tokens must be an array');
  }

  // For Chinese, validate token segmentation
  if (targetLang === 'zh') {
    validateChineseTokenStructure(bot_response.text, bot_response.tokens);
  }

  return true;
}

/**
 * Validates Chinese token structure matches text
 */
function validateChineseTokenStructure(text, tokens) {
  let reconstructed = '';
  for (const token of tokens) {
    reconstructed += (token.word || token.text || '');
  }

  if (reconstructed.length < text.length * 0.9) {
    throw new Error(
      `Chinese token coverage too low: ${reconstructed.length}/${text.length} chars. ` +
      `Tokens may be oversized or text incomplete.`
    );
  }

  // Check for missing Pinyin on Chinese tokens
  const missingPinyin = [];
  for (const token of tokens) {
    const word = token.word || token.text || '';
    const hasChinese = /[\u4E00-\u9FFF]/.test(word);
    const hasTranslit = token.translit || token.pinyin;

    if (hasChinese && !hasTranslit) {
      missingPinyin.push(word);
    }
  }

  if (missingPinyin.length > 0) {
    throw new Error(
      `Chinese tokens missing Pinyin: ${missingPinyin.join(', ')}. ` +
      `All Chinese characters must have tone-marked Pinyin.`
    );
  }
}

/**
 * Formats Groq prompt for consistent response structure
 */
export function buildResponseFormatInstruction(targetLang) {
  const baseFormat = `
RESPONSE FORMAT (JSON):
{
  "user_correction": {
    "corrected_text": "...",
    "has_errors": boolean,
    "diff_tokens": [
      { "text": "word", "changed": boolean, "original": "original_word_or_null" }
    ]
  },
  "bot_response": {
    "text": "Your natural response in ${targetLang}",
    "translation": "Translation in native language",
    "tokens": [
      { "word": "...", "translit": "...", "gloss": "...", "clean_word": "..." }
    ],
    "vocabulary": {
      "word": { "meaning": "...", "part_of_speech": "..." }
    }
  }
}`;

  if (targetLang === 'zh') {
    return `${baseFormat}

CHINESE-SPECIFIC REQUIREMENTS:
- Each token.word should be a SINGLE Chinese word (HSK 1-3 range when possible)
- token.translit MUST include tone marks: nǐ hǎo (NOT ni hao)
- token.gloss should be concise Spanish translation
- token.clean_word = word without punctuation
- NO oversized tokens containing entire phrases or sentences
- If message is long, use MORE tokens with shorter words, NOT fewer tokens with longer words`;
  }

  return baseFormat;
}
