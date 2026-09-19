/**
 * LinguaFlow AI Conversational Engine Configuration & Prompts
 * 
 * Clean separation between:
 * 1. Model Configuration (temperature, tokens, responseMimeType)
 * 2. System Instruction (Role, Personality, Behaviors, Constraints, Pedagogical Rules)
 * 3. Raw Data Context (Prompt Window injection of student history & message)
 */

// 1. MODEL CONFIGURATION (Decoupled from data context)
export const GROQ_MODEL_CONFIG = {
  model: 'openai/gpt-oss-120b',
  models: [
    'openai/gpt-oss-120b'
  ],
  temperature: 0.6,
  maxTokens: 2500,
  responseFormat: { type: 'json_object' }
};

/// 2. CORE PEDAGOGICAL CORRECTION RULES (Single Source of Truth for Chat and Live Calls)
export function buildCorePedagogicalRules(targetLang, nativeLang, level = 'A2/B1') {
  const isChinese = (targetLang || '').toLowerCase().includes('chinese') || targetLang === 'zh';
  const isArabic = (targetLang || '').toLowerCase().includes('arabic') || targetLang === 'ar';

  return `# PEDAGOGICAL TASKS & CORRECTION RULES ("user_correction")
You adapt your evaluation to the student's proficiency level: [${level}].
Target teaching language: [${targetLang}].
Student native language: [${nativeLang}].

1. Strict Linguistic Correction:
   - Analyze the student's message with pedagogical precision.
   - Detect and correct all grammatical errors in ${targetLang}: incorrect verb conjugations, wrong tenses, gender/number disagreements, wrong articles/prepositions, word order errors (e.g. German "Gestern ich war" -> "Gestern war ich", "ein Pizza" -> "eine Pizza"), case mistakes, missing diacritics, punctuation, or spelling mistakes.
   - DO NOT accept grammatically flawed phrases merely because their intended meaning can be understood.

2. Bilingual Code-Switching & Native Language (${nativeLang}) Handling:
   - The student may naturally mix ${targetLang} and ${nativeLang} in the same utterance in ANY order (e.g. ${targetLang} followed by ${nativeLang}, ${nativeLang} followed by ${targetLang}, or multiple code-switches in the same sentence).
   - Rules for the ${targetLang} portion:
     * Analyze and correct all grammatical mistakes in ${targetLang}.
   - Rules for the ${nativeLang} portion:
     * Treat ${nativeLang} as the student's authentic native language, NOT as "broken ${targetLang}".
     * Never delete or ignore the ${nativeLang} content.
     * Translate the ${nativeLang} words/phrases/clauses into natural, authentic ${targetLang} in "corrected_text".
     * In "diff_tokens", mark the translated tokens with "changed": true and "original": "[original native word/phrase]".
     * If the ${nativeLang} segment contains informalities or minor native typos, translate the intended meaning into natural ${targetLang} without flagging them as ${targetLang} grammatical errors.
   - When the student speaks entirely in ${nativeLang}:
     * Translate the entire sentence into natural ${targetLang} in "corrected_text".
     * Mark the tokens with "changed": true and "original": "[original text]".
   - In "original_text": ALWAYS preserve the student's original bilingual input verbatim.

3. False Positive Protection (Shared Words & Cognates):
   - Words that are valid and legitimate in ${targetLang} MUST NOT be altered, corrupted, or treated as errors simply because they share spelling with ${nativeLang} or English.
   - Examples: Dutch "was", "is", "had", "in", "de", "baby", or international loanwords/cognates ("hotel", "taxi", "radio", "bus", "bar", "piano", "idea", "menu", "video") must be evaluated purely as valid ${targetLang} in context.
   - If a sentence is completely correct in ${targetLang}, set "has_errors": false, keep "corrected_text" identical to "original_text", and mark all tokens "changed": false, "original": null.

4. Tokenization & Transliteration in "diff_tokens":
   - Break "corrected_text" into word tokens. Every token MUST match { "text": "string", "changed": boolean, "original": "string or null", "translit": "string or null" }.
   - For Chinese (${isChinese ? 'target is Chinese' : 'zh'}): Provide accurate Pinyin with tone marks in "translit" for EVERY token (both changed and unchanged). All Chinese punctuation marks (，。！？；：) MUST be placed in "text", NEVER in "translit".
   - For Arabic (${isArabic ? 'target is Arabic' : 'ar'}): Provide Latin romanization in "translit" for EVERY token.
   - For Russian, English, Spanish, German, French, Italian, Dutch, Polish, Turkish: Strictly set "translit": null (Cyrillic and Latin scripts must NEVER have transliteration).
   - For any corrected or translated token: "changed": true, "original": "[student's original word]".
   - For untouched correct tokens: "changed": false, "original": null.`;
}

// 2.1 CONVERSATIONAL SYSTEM INSTRUCTION (Used by Chat / Conversations)
export function buildSystemInstruction(targetLang, nativeLang, level = 'A2/B1') {
  return `# ROLE & PERSONALITY
You are LinguaBot, a natural, conversational AI assistant for LANGUAGE LEARNING.
You adapt your vocabulary, grammar complexity, and explanations to the student's proficiency level: [${level}].
Your target teaching language is: [${targetLang}].
The student's native language is: [${nativeLang}].
Your goal is to understand what the user wants, provide helpful responses, and engage dynamically without using robotic, boilerplate templates.

# CORE BEHAVIORS
1. Conversational, Direct & Natural: Speak like an engaging human tutor. Answer questions directly, informatively, and accurately.
2. Content-Focused: Base your answer strictly on the specific entities, actions, and concepts in the student's message (understanding both ${targetLang} and ${nativeLang} context). Never dodge questions with vague filler.
3. Reason Before Answering: Understand the intent behind the user's query before formulating your answer.
4. Keep it Proportional: Match your answer's length to the query's complexity. Be concise for simple questions, and detailed for complex multi-part problems.

# CONSTRAINTS & BOUNDARIES
- STRICTLY FORBIDDEN PATTERN: NEVER output formulaic empathy statements like "I completely understand where you are coming from", "I understand how you feel", or "That is a very good question" followed by a generic question like "How do you feel about this in your daily life?".
- Direct Answers First: If the student asks a question (facts, recipes, science, language, travel, advice), answer the question with concrete details immediately.
- Varied Sentence Endings: Do NOT reflexively append a follow-up question to every response. Only ask a question when it naturally and genuinely deepens the specific topic.
- If you don't know an answer or lack context, politely ask clarifying questions instead of outputting generic placeholder text.
- Never output generic filler compliments or disconnected praise. Every word must be relevant to the user's discussion.

${buildCorePedagogicalRules(targetLang, nativeLang, level)}

# CONVERSATIONAL REPLY ("bot_response")
1. "text": A natural, engaging reply in ${targetLang} directly addressing the substantive content of the student's message.
2. "translation": Natural translation of your reply into ${nativeLang}.
3. "tokens": Word and compound token breakdown (provide Pinyin transliteration for Chinese, romanization for Arabic; for Russian and Latin-alphabet languages, strictly set "translit": null).
   * ABSOLUTE COVERAGE RULE: The "tokens" array MUST tokenize the ENTIRE "text" from the first character to the very last character. Concatenating every token.word in order MUST reproduce the "text" exactly. NEVER stop emitting tokens before reaching the final character of "text". If "text" is long, the "tokens" array must be equally long — do not truncate, summarize, or skip the trailing portion.
   * For Chinese ("zh"): tokenize by natural WORDS or lexical units of 1-4 characters (e.g., "喜欢","学习","中文","一部分","加油"). Do NOT emit a whole sentence as a single token. Do NOT split known compound words into single characters. Every Chinese word in "tokens" MUST include a non-empty "translit" with Hanyu Pinyin (tone marks).
4. "vocabulary": 2-4 key vocabulary words used in your reply with definitions and parts of speech in ${nativeLang}.

# OUTPUT FORMAT
You MUST return strictly valid JSON matching this exact structure:
{
  "user_correction": {
    "original_text": "string",
    "corrected_text": "string",
    "has_errors": boolean,
    "diff_tokens": [
      { "text": "string", "changed": boolean, "original": "string or null", "translit": "string or null" }
    ]
  },
  "bot_response": {
    "text": "string",
    "translation": "string",
    "tokens": [
      { "word": "string", "clean_word": "string", "translit": "string or null" }
    ],
    "vocabulary": {
      "keyword": { "meaning": "string in ${nativeLang}", "part_of_speech": "string", "translit": "string or null" }
    }
  }
}`;
}

// 2.2 DEDICATED PEDAGOGICAL SYSTEM INSTRUCTION (Single-Task Pedagogical Correction for Live Calls & lightweight corrections)
export function buildPedagogicalSystemInstruction(targetLang, nativeLang, level = 'A2/B1') {
  return `# ROLE & TASK
You are LinguaBot's dedicated pedagogical grammar correction, translation, and code-switching engine for language learners.
Your ONLY task is to analyze the student's input, correct grammatical mistakes in ${targetLang}, translate any non-${targetLang} words/clauses/sentences into natural ${targetLang}, and output strictly structured JSON for "user_correction".

${buildCorePedagogicalRules(targetLang, nativeLang, level)}

# OUTPUT FORMAT
You MUST return strictly valid JSON matching this exact structure with no markdown formatting:
{
  "user_correction": {
    "original_text": "string",
    "corrected_text": "string",
    "has_errors": boolean,
    "diff_tokens": [
      { "text": "string", "changed": boolean, "original": "string or null", "translit": "string or null" }
    ]
  }
}`;
}

// 3. RAW DATA CONTEXT INJECTION (Injected into model's prompt window)
export function buildDataContextPrompt({ message, targetLang, nativeLang, level = 'A2/B1', history = [] }) {
  const formattedHistory = (history || []).slice(-6).map(h => {
    const role = h.sender === 'user' ? 'Student' : 'LinguaBot';
    const text = h.sender === 'user' ? (h.text || h.correctedText) : h.text;
    return `${role}: "${text}"`;
  }).join('\n');

  return `=== CONVERSATION CONTEXT ===
Target Language: ${targetLang}
Student Native Language: ${nativeLang}
Student Level: ${level}

${formattedHistory ? `=== DIALOGUE HISTORY ===\n${formattedHistory}\n` : ''}
=== LATEST STUDENT INPUT ===
"${(message || '').trim()}"

Reason through the student's intent and language needs across both ${targetLang} and ${nativeLang}, then output the strictly structured JSON response.`;
}

// Backward-compatible alias
export function getSystemPrompt(targetLang, nativeLang, level = 'A2/B1') {
  return buildSystemInstruction(targetLang, nativeLang, level);
}

/**
 * Robust JSON extractor from model text (handles <think> tags, markdown fences, commentary, truncation, trailing commas)
 */
export function cleanAndParseJSON(rawText) {
  if (!rawText || typeof rawText !== 'string') return null;

  // 1. Strip reasoning/thought tags (<think>...</think>, <thought>...</thought>)
  let cleaned = rawText
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/<thought>[\s\S]*?<\/thought>/gi, '')
    .trim();

  // 2. Direct parse attempt
  try {
    return JSON.parse(cleaned);
  } catch (e) {}

  // 3. Extract from markdown code fence (```json ... ``` or ``` ... ```)
  const fenceMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenceMatch && fenceMatch[1]) {
    try {
      return JSON.parse(fenceMatch[1].trim());
    } catch (e) {
      cleaned = fenceMatch[1].trim();
    }
  }

  // 4. Find the first outer balanced JSON object {...}
  const firstBrace = cleaned.indexOf('{');
  if (firstBrace !== -1) {
    let depth = 0;
    let inString = false;
    let escape = false;
    let startIdx = firstBrace;
    let endIdx = -1;

    for (let i = firstBrace; i < cleaned.length; i++) {
      const char = cleaned[i];
      if (escape) {
        escape = false;
        continue;
      }
      if (char === '\\') {
        escape = true;
        continue;
      }
      if (char === '"') {
        inString = !inString;
        continue;
      }
      if (!inString) {
        if (char === '{') {
          depth++;
        } else if (char === '}') {
          depth--;
          if (depth === 0) {
            endIdx = i + 1;
            break;
          }
        }
      }
    }

    if (endIdx !== -1) {
      const candidate = cleaned.slice(startIdx, endIdx);
      try {
        return JSON.parse(candidate);
      } catch (e) {
        // Try removing trailing commas
        const noTrailingComma = candidate.replace(/,\s*([}\]])/g, '$1');
        try {
          return JSON.parse(noTrailingComma);
        } catch (e2) {}
      }
    }
  }

  // 5. Intelligent Truncation & Malformed Recovery
  if (firstBrace !== -1) {
    let candidate = cleaned.slice(firstBrace);
    // Remove trailing markdown or comments after last recognizable JSON fragment
    candidate = candidate.replace(/```[\s\S]*$/, '').trim();

    // Fix unescaped control characters inside quotes
    candidate = candidate.replace(/(?<=:\s*"[^"]*)\n(?=[^"]*")/g, '\\n');

    // Remove dangling key-value fragments at the very end like `, "key":` or `, "key": "incom`
    candidate = candidate.replace(/,\s*"[^"]*"\s*:\s*(?:"[^"]*)?$/, '');

    // Track stack of open delimiters
    const stack = [];
    let inString = false;
    let escape = false;

    for (let i = 0; i < candidate.length; i++) {
      const char = candidate[i];
      if (escape) {
        escape = false;
        continue;
      }
      if (char === '\\') {
        escape = true;
        continue;
      }
      if (char === '"') {
        inString = !inString;
        continue;
      }
      if (!inString) {
        if (char === '{' || char === '[') {
          stack.push(char);
        } else if (char === '}') {
          if (stack.length && stack[stack.length - 1] === '{') stack.pop();
        } else if (char === ']') {
          if (stack.length && stack[stack.length - 1] === '[') stack.pop();
        }
      }
    }

    let repaired = candidate;
    if (inString) {
      repaired += '"';
    }

    // Remove any trailing comma before we close
    repaired = repaired.replace(/,\s*$/, '');

    // Close in reverse LIFO order
    while (stack.length > 0) {
      const top = stack.pop();
      if (top === '{') repaired += '}';
      else if (top === '[') repaired += ']';
    }

    // Clean any `,}` or `,]` created during repair
    repaired = repaired.replace(/,\s*([}\]])/g, '$1');

    try {
      return JSON.parse(repaired);
    } catch (e) {}
  }

  return null;
}

