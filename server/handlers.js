import dotenv from 'dotenv';
import {
  GROQ_MODEL_CONFIG,
  buildSystemInstruction,
  buildPedagogicalSystemInstruction,
  buildDataContextPrompt,
  cleanAndParseJSON
} from './promptTemplates.js';
import { SUPPORTED_LANGUAGES, computeWordDiff } from './languageData.js';
import { processDeterministicLinguistics, processSmartConversation } from './conversationEngine.js';
import { getArabicTransliteration } from './arabicTransliteration.js';

dotenv.config();

/**
 * Isolated Development Cost Audit Logger for LinguaFlow
 */
function logCostAudit({
  provider = 'groq',
  feature = 'other',
  model = '',
  voice = '',
  requestId = 'no disponible directamente',
  inputTokens = null,
  outputTokens = null,
  totalTokens = null,
  characters = null,
  durationMs = 0,
  retry = false,
  streaming = false,
  extra = ''
}) {
  const timestamp = new Date().toISOString();
  const reqIdStr = requestId || 'no disponible directamente';
  const inTokStr = inputTokens !== null && inputTokens !== undefined ? inputTokens : 'no disponible directamente';
  const outTokStr = outputTokens !== null && outputTokens !== undefined ? outputTokens : 'no disponible directamente';
  const totTokStr = totalTokens !== null && totalTokens !== undefined ? totalTokens : 'no disponible directamente';
  const charStr = characters !== null && characters !== undefined ? characters : 'no disponible directamente';

  console.log(
    `[COST_AUDIT] timestamp=${timestamp} provider=${provider} feature=${feature} model=${model || 'n/a'}${voice ? ` voice=${voice}` : ''} request_id=${reqIdStr} input_tokens=${inTokStr} output_tokens=${outTokStr} total_tokens=${totTokStr} characters=${charStr} duration_ms=${durationMs} retry=${retry} streaming=${streaming}${extra ? ` info="${extra}"` : ''}`
  );
}

function enrichArabicPayload(data, targetLang) {
  if (!data || typeof data !== 'object') return data;
  const isArabic = targetLang === 'ar';
  const isChinese = targetLang === 'zh';
  const allowsTranslit = isArabic || isChinese;

  if (data.user_correction?.diff_tokens && Array.isArray(data.user_correction.diff_tokens)) {
    data.user_correction.diff_tokens = data.user_correction.diff_tokens.map(token => {
      if (!token) return token;
      if (!allowsTranslit) {
        return { ...token, translit: null };
      }
      const text = token.text || '';
      if ((isArabic || /[\u0600-\u06FF]/.test(text)) && !token.translit) {
        return {
          ...token,
          translit: getArabicTransliteration(text)
        };
      }
      return token;
    });
  }

  if (data.bot_response?.tokens && Array.isArray(data.bot_response.tokens)) {
    data.bot_response.tokens = data.bot_response.tokens.map(token => {
      if (!token) return token;
      if (!allowsTranslit) {
        return { ...token, translit: null };
      }
      const text = token.word || token.text || token.clean_word || '';
      if ((isArabic || /[\u0600-\u06FF]/.test(text)) && !token.translit) {
        return {
          ...token,
          translit: getArabicTransliteration(text)
        };
      }
      return token;
    });
  }

  return data;
}

/**
 * Normalizes any valid or semi-structured JSON response from Groq into LinguaFlow's expected chat schema:
 * {
 *   user_correction: { original_text, corrected_text, has_errors, diff_tokens },
 *   bot_response: { text, translation, tokens, vocabulary }
 * }
 */
export function normalizeChatPayload(parsed, rawUserText = '', targetLang = 'es') {
  if (!parsed || typeof parsed !== 'object') return null;

  // 1. Unwrap root wrappers if any (e.g. { data: { ... } }, { result: { ... } }, { response: { ... } })
  let root = parsed;
  if (root.data && typeof root.data === 'object' && (root.data.user_correction || root.data.bot_response || root.data.text)) {
    root = root.data;
  } else if (root.result && typeof root.result === 'object' && (root.result.user_correction || root.result.bot_response || root.result.text)) {
    root = root.result;
  }

  // 2. Extract bot_response
  let rawBot = root.bot_response || root.botResponse || root.response || root.reply || root.bot_reply || root.assistant_response || root.ai_response || root.bot || root.assistant;
  if (!rawBot && typeof root.text === 'string' && root.text.trim()) {
    // Top-level object itself is the bot response
    rawBot = root;
  }

  if (!rawBot || typeof rawBot !== 'object') {
    return null; // A conversation turn requires a bot response
  }

  const botText = (rawBot.text || rawBot.reply || rawBot.response || rawBot.message || rawBot.content || '').trim();
  if (!botText) {
    return null; // Bot response must have non-empty text
  }

  const botTranslation = (rawBot.translation || rawBot.translated_text || rawBot.native_translation || rawBot.translatedText || '').trim();
  const rawTokens = Array.isArray(rawBot.tokens)
    ? rawBot.tokens
    : (Array.isArray(rawBot.word_tokens) ? rawBot.word_tokens : (Array.isArray(rawBot.words) ? rawBot.words : []));

  const normalizedTokens = rawTokens.map(tok => {
    if (!tok) return null;
    if (typeof tok === 'string') {
      return { word: tok, clean_word: tok, translit: null };
    }
    const word = String(tok.word || tok.text || tok.clean_word || '').trim();
    if (!word) return null;
    return {
      word,
      clean_word: String(tok.clean_word || tok.word || tok.text || word).trim(),
      translit: tok.translit || tok.pinyin || tok.pronunciation || null
    };
  }).filter(Boolean);

  const rawVocab = (rawBot.vocabulary && typeof rawBot.vocabulary === 'object')
    ? rawBot.vocabulary
    : ((rawBot.vocab && typeof rawBot.vocab === 'object') ? rawBot.vocab : {});

  // 3. Extract user_correction
  let rawCor = root.user_correction || root.userCorrection || root.correction || root.student_correction || root.studentCorrection || root.correction_analysis || root.analysis || root.user;

  let normalizedCorrection;
  if (rawCor && typeof rawCor === 'object') {
    const origText = String(rawCor.original_text || rawCor.originalText || rawCor.original || rawUserText).trim();
    const corrText = String(rawCor.corrected_text || rawCor.correctedText || rawCor.corrected || rawCor.text || origText).trim();
    const rawDiffTokens = Array.isArray(rawCor.diff_tokens)
      ? rawCor.diff_tokens
      : (Array.isArray(rawCor.diffTokens) ? rawCor.diffTokens : (Array.isArray(rawCor.tokens) ? rawCor.tokens : null));

    let diffTokens = rawDiffTokens && rawDiffTokens.length > 0
      ? rawDiffTokens.map(t => {
          if (!t) return null;
          if (typeof t === 'string') return { text: t, changed: false, original: null, translit: null };
          return {
            text: String(t.text || t.word || '').trim(),
            changed: Boolean(t.changed ?? t.isChanged ?? t.is_changed),
            original: t.original ? String(t.original).trim() : null,
            translit: t.translit || t.pinyin || null
          };
        }).filter(Boolean)
      : computeWordDiff(origText, corrText);

    const hasErrors = Boolean(rawCor.has_errors ?? rawCor.hasErrors ?? diffTokens.some(t => t.changed) ?? (corrText.toLowerCase() !== origText.toLowerCase()));

    normalizedCorrection = {
      original_text: origText,
      corrected_text: corrText,
      has_errors: hasErrors,
      diff_tokens: diffTokens
    };
  } else {
    // If user_correction was omitted by AI (e.g. no errors found), construct default safe correction
    normalizedCorrection = {
      original_text: rawUserText,
      corrected_text: rawUserText,
      has_errors: false,
      diff_tokens: computeWordDiff(rawUserText, rawUserText)
    };
  }

  return {
    user_correction: normalizedCorrection,
    bot_response: {
      text: botText,
      translation: botTranslation,
      tokens: normalizedTokens,
      vocabulary: rawVocab
    }
  };
}

export function setCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-api-key');
}

function parseRequestBody(req) {
  if (!req.body) return {};
  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body);
    } catch (e) {
      return {};
    }
  }
  return req.body;
}

// Exclusively supported conversational model is openai/gpt-oss-120b on Groq
const PRIMARY_GROQ_MODEL = 'openai/gpt-oss-120b';

function getSanitizedGroqModel() {
  const envModel = (process.env.GROQ_MODEL || '').trim();
  // Protect against obsolete/cached environment variables (e.g. old llama or gemini)
  if (envModel && !envModel.includes('llama') && !envModel.includes('gemini') && !envModel.includes('3.3') && !envModel.includes('3.1') && !envModel.includes('8b') && !envModel.includes('70b')) {
    return envModel;
  }
  return PRIMARY_GROQ_MODEL;
}

export function categorizeGroqError(status, message) {
  const msgLower = (message || '').toLowerCase();

  // 1. Invalid API Key
  if (status === 401 || status === 403 || msgLower.includes('invalid api key') || msgLower.includes('invalid_api_key') || msgLower.includes('unauthorized') || msgLower.includes('authentication')) {
    return {
      type: 'invalid API key',
      code: 'INVALID_API_KEY',
      userMessage: 'Clave API de Groq inválida o no autorizada. Por favor verifica tu GROQ_API_KEY en el backend/servidor.'
    };
  }

  // 2. Model Not Found
  if (status === 404 || msgLower.includes('not found') || msgLower.includes('does not exist') || msgLower.includes('model_not_found')) {
    return {
      type: 'model not found',
      code: 'MODEL_NOT_FOUND',
      userMessage: `El modelo de Groq solicitado no fue encontrado (${message}).`
    };
  }

  // 3. Quota / Rate limit
  if (status === 429 || msgLower.includes('rate limit') || msgLower.includes('rate_limit_exceeded') || msgLower.includes('tokens per minute') || msgLower.includes('requests per minute')) {
    return {
      type: 'quota/rate limit',
      code: 'RATE_LIMIT_EXCEEDED',
      userMessage: 'Límite de solicitudes o tokens por minuto excedido en Groq (HTTP 429). Espera unos segundos antes de volver a enviar.'
    };
  }

  // 4. Network timeout
  if (status === 408 || msgLower.includes('timeout') || msgLower.includes('aborted') || msgLower.includes('aborterror')) {
    return {
      type: 'network timeout',
      code: 'NETWORK_TIMEOUT',
      userMessage: 'Tiempo de espera agotado al conectar con Groq. Revisa tu conexión a internet.'
    };
  }

  // 5. Server error
  if (status >= 500) {
    return {
      type: 'server error',
      code: 'GROQ_SERVER_ERROR',
      userMessage: `Error interno de los servidores de Groq (HTTP ${status}): ${message}.`
    };
  }

  return {
    type: 'server error',
    code: 'GROQ_ERROR',
    userMessage: `Error al conectar con Groq (HTTP ${status || 'N/A'}): ${message || 'Servicio no disponible'}.`
  };
}

// Health check
export function handleHealth(req, res) {
  setCorsHeaders(res);
  res.status(200).json({ status: 'ok', service: 'LinguaFlow API', model: getSanitizedGroqModel() });
}

// List of supported languages
export function handleLanguages(req, res) {
  setCorsHeaders(res);
  res.status(200).json({ languages: SUPPORTED_LANGUAGES });
}

// Dedicated pedagogical correction endpoint for Live Calls & lightweight corrections
export async function handlePedagogicalCorrect(req, res) {
  setCorsHeaders(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const body = parseRequestBody(req);
    const {
      text,
      message,
      targetLang = 'es',
      nativeLang = 'es',
      level = 'A2/B1',
      apiKey: clientApiKey
    } = body;

    const rawText = (text || message || '').trim();
    if (!rawText) {
      return res.status(400).json({ error: 'El texto no puede estar vacío.' });
    }

    const effectiveApiKey = (
      process.env.GROQ_API_KEY ||
      (clientApiKey?.startsWith('gsk_') ? clientApiKey : '') ||
      (req.headers?.['x-api-key'] || '')
    ).trim().replace(/^["']|["']$/g, '');

    const activeModel = getSanitizedGroqModel();
    const isArabic = targetLang === 'ar';
    const isChinese = targetLang === 'zh';
    const langObj = SUPPORTED_LANGUAGES.find(l => l.code === targetLang) || { name: targetLang, englishName: targetLang };
    const nativeObj = SUPPORTED_LANGUAGES.find(l => l.code === nativeLang) || { name: nativeLang, englishName: nativeLang };
    const targetName = langObj.englishName || langObj.name;
    const nativeName = nativeObj.englishName || nativeObj.name;

    if (effectiveApiKey) {
      console.log(`Pedagogical correction requested with Groq [${activeModel}] for lang: ${targetLang}`);

      const systemPrompt = buildPedagogicalSystemInstruction(targetName, nativeName, level);
      const userPrompt = `=== STUDENT INPUT TO CORRECT ===\n"${rawText}"\n\nAnalyze the student's input according to pedagogical tasks and output strictly structured JSON for "user_correction".`;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);
      let httpStatus = 0;
      let groqErrorMessage = '';

      const startTime = Date.now();
      try {
        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${effectiveApiKey}`
          },
          signal: controller.signal,
          body: JSON.stringify({
            model: activeModel,
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userPrompt }
            ],
            response_format: { type: 'json_object' },
            temperature: 0.3,
            max_tokens: 800
          })
        });

        clearTimeout(timeoutId);
        httpStatus = response.status;

        if (response.ok) {
          const data = await response.json();
          const requestId = response.headers.get('x-request-id') || 'no disponible directamente';
          logCostAudit({
            provider: 'groq',
            feature: 'live_call_correction',
            model: activeModel,
            requestId,
            inputTokens: data?.usage?.prompt_tokens ?? 'no disponible directamente',
            outputTokens: data?.usage?.completion_tokens ?? 'no disponible directamente',
            totalTokens: data?.usage?.total_tokens ?? 'no disponible directamente',
            characters: rawText.length,
            durationMs: Date.now() - startTime,
            retry: false,
            streaming: false,
            extra: `status=${httpStatus}`
          });
          const rawContent = data?.choices?.[0]?.message?.content || '';
          const parsed = cleanAndParseJSON(rawContent);

          const cor = parsed?.user_correction || parsed;
          if (cor && typeof cor.corrected_text === 'string') {
            const corrected = cor.corrected_text.trim();
            const hasDiffTokens = Array.isArray(cor.diff_tokens) && cor.diff_tokens.length > 0;

            let diffTokens = hasDiffTokens
              ? cor.diff_tokens
              : computeWordDiff(rawText, corrected);

            // Transliteration rules: strictly for Arabic and Chinese
            const allowsTranslit = isArabic || isChinese;
            diffTokens = diffTokens.map(token => {
              if (!token) return token;
              if (!allowsTranslit) {
                return { ...token, translit: null };
              }
              const tokenText = token.text || '';
              if ((isArabic || /[\u0600-\u06FF]/.test(tokenText)) && !token.translit) {
                return {
                  ...token,
                  translit: getArabicTransliteration(tokenText)
                };
              }
              return token;
            });

            const hasErrors = Boolean(cor.has_errors || diffTokens.some(t => t.changed) || corrected.toLowerCase() !== rawText.toLowerCase());

            const resultPayload = {
              original_text: cor.original_text || rawText,
              corrected_text: corrected,
              has_errors: hasErrors,
              diff_tokens: diffTokens
            };

            return res.status(200).json({
              success: true,
              source: `groq (${activeModel})`,
              data: resultPayload,
              user_correction: resultPayload
            });
          }
        } else {
          const err = await response.json().catch(() => ({}));
          groqErrorMessage = err?.error?.message || response.statusText;
        }
      } catch (fetchErr) {
        clearTimeout(timeoutId);
        httpStatus = fetchErr.name === 'AbortError' ? 408 : 500;
        groqErrorMessage = fetchErr.name === 'AbortError' ? 'Timeout en corrección pedagógica Groq' : fetchErr.message;
      }

      console.warn(`Groq pedagogical correction failed [HTTP ${httpStatus}]: ${groqErrorMessage}. Using deterministic fallback.`);
    }

    // Seamless Fallback: Deterministic Grammar Engine & Linguistic Rules
    const deterministic = processDeterministicLinguistics(rawText, targetLang, nativeLang);
    return res.status(200).json({
      success: false,
      fallback: true,
      source: 'deterministic-linguistics',
      data: deterministic,
      user_correction: deterministic
    });

  } catch (error) {
    console.error('Server error in /api/pedagogical-correct:', error);
    const deterministic = processDeterministicLinguistics(req.body?.text || req.body?.message || '', req.body?.targetLang || 'es', req.body?.nativeLang || 'es');
    return res.status(200).json({
      success: false,
      fallback: true,
      data: deterministic,
      user_correction: deterministic
    });
  }
}

// Chat endpoint (Groq openai/gpt-oss-120b)
export async function handleChat(req, res) {
  setCorsHeaders(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const body = parseRequestBody(req);
    const {
      message,
      targetLang = 'es',
      nativeLang = 'es',
      level = 'A2/B1',
      apiKey: clientApiKey,
      history = []
    } = body;

    if (!message || !message.trim()) {
      return res.status(400).json({ error: 'El mensaje no puede estar vacío.' });
    }

    const langObj = SUPPORTED_LANGUAGES.find(l => l.code === targetLang) || { name: targetLang, englishName: targetLang };
    const nativeObj = SUPPORTED_LANGUAGES.find(l => l.code === nativeLang) || { name: nativeLang, englishName: nativeLang };
    const targetLanguageName = langObj.englishName || langObj.name;

    // 1. Clean Separation: System Instruction (Role, Personality, Rules)
    const systemInstruction = buildSystemInstruction(targetLanguageName, nativeObj.name, level);

    // 2. Clean Separation: Raw Data Context (Prompt Window injection)
    const dataPrompt = buildDataContextPrompt({
      message: message.trim(),
      targetLang: targetLanguageName,
      nativeLang: nativeObj.name,
      level,
      history
    });

    // Effective API Key is kept in backend/server environment (GROQ_API_KEY)
    const effectiveApiKey = (
      process.env.GROQ_API_KEY ||
      (clientApiKey?.startsWith('gsk_') ? clientApiKey : '') ||
      (req.headers['x-api-key'] || '')
    ).trim().replace(/^["']|["']$/g, '');

    const activeModel = getSanitizedGroqModel();

    if (effectiveApiKey) {
      console.log(`Groq model selected: ${activeModel}`);

      let httpStatus = 0;
      let groqErrorMessage = '';
      let normalizedResult = null;
      let attempts = 0;
      const maxAttempts = 2; // 1 primary attempt + 1 transient retry

      while (attempts < maxAttempts && !normalizedResult) {
        attempts++;
        const isRetry = attempts > 1;
        if (isRetry) {
          console.warn(`[Groq Chat] Retrying request (attempt ${attempts}/${maxAttempts})...`);
          await new Promise(r => setTimeout(r, 600));
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 12000);
        const startTime = Date.now();

        try {
          const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${effectiveApiKey}`
            },
            signal: controller.signal,
            body: JSON.stringify({
              model: activeModel,
              messages: [
                { role: 'system', content: systemInstruction },
                { role: 'user', content: dataPrompt }
              ],
              response_format: { type: 'json_object' },
              temperature: 0.6,
              max_tokens: 4000
            })
          });

          clearTimeout(timeoutId);
          httpStatus = response.status;

          if (response.ok) {
            const data = await response.json();
            const requestId = response.headers.get('x-request-id') || 'no disponible directamente';
            logCostAudit({
              provider: 'groq',
              feature: 'chat_response',
              model: activeModel,
              requestId,
              inputTokens: data?.usage?.prompt_tokens ?? 'no disponible directamente',
              outputTokens: data?.usage?.completion_tokens ?? 'no disponible directamente',
              totalTokens: data?.usage?.total_tokens ?? 'no disponible directamente',
              characters: message.length,
              durationMs: Date.now() - startTime,
              retry: isRetry,
              streaming: false,
              extra: `status=${httpStatus}`
            });
            const rawText = data?.choices?.[0]?.message?.content || '';
            const parsedData = cleanAndParseJSON(rawText);
            normalizedResult = normalizeChatPayload(parsedData, message.trim(), targetLang);

            if (normalizedResult) {
              console.log(`✅ Groq AI answered using [${activeModel}] (attempt ${attempts})`);
              const enrichedData = enrichArabicPayload(normalizedResult, targetLang);
              return res.status(200).json({
                success: true,
                source: `groq (${activeModel})`,
                data: enrichedData
              });
            } else {
              groqErrorMessage = `La respuesta de Groq no tuvo el formato JSON esperado: ${rawText.slice(0, 120)}`;
            }
          } else {
            const err = await response.json().catch(() => ({}));
            groqErrorMessage = err?.error?.message || response.statusText;
            if (httpStatus === 401 || httpStatus === 403 || httpStatus === 404) {
              break; // Don't retry client-side authentication or bad model errors
            }
          }
        } catch (fetchErr) {
          clearTimeout(timeoutId);
          httpStatus = fetchErr.name === 'AbortError' ? 408 : 500;
          groqErrorMessage = fetchErr.name === 'AbortError' ? 'Network timeout: la solicitud a Groq excedió el tiempo límite.' : fetchErr.message;
        }
      }

      console.error(`Groq request failed:\nmodel: ${activeModel}\nHTTP status: ${httpStatus}\nGroq error message: ${groqErrorMessage}`);

      const deterministicCorrection = processDeterministicLinguistics(message.trim(), targetLang, nativeLang);
      const errorInfo = categorizeGroqError(httpStatus, groqErrorMessage);

      return res.status(httpStatus >= 400 && httpStatus < 600 ? httpStatus : 503).json({
        success: false,
        error: errorInfo.userMessage,
        error_type: errorInfo.type,
        code: errorInfo.code,
        details: {
          provider: 'groq',
          model: activeModel,
          status: httpStatus,
          error: groqErrorMessage
        },
        user_correction: deterministicCorrection
      });
    }

    // No API key provided in backend/server
    const deterministicCorrection = processDeterministicLinguistics(message.trim(), targetLang, nativeLang);
    return res.status(400).json({
      success: false,
      error: 'Para conversar con LinguaFlow, configura la variable GROQ_API_KEY en el backend/servidor.',
      error_type: 'invalid API key',
      code: 'MISSING_API_KEY',
      user_correction: deterministicCorrection
    });

  } catch (error) {
    console.error('Server error in /api/chat:', error);
    res.status(500).json({ error: 'Error procesando la solicitud en el servidor.' });
  }
}

// Word lookup endpoint (Groq openai/gpt-oss-120b)
export async function handleLookupWord(req, res) {
  setCorsHeaders(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const body = parseRequestBody(req);
    const { word, targetLang, nativeLang, apiKey: clientApiKey } = body;
    const effectiveApiKey = (
      process.env.GROQ_API_KEY ||
      clientApiKey ||
      (req.headers['x-api-key'] || '')
    ).trim().replace(/^["']|["']$/g, '');

    const activeModel = getSanitizedGroqModel();
    const isChinese = targetLang === 'zh';
    const isArabic = targetLang === 'ar';
    const hasTranslit = isChinese || isArabic;

    if (word && effectiveApiKey) {
      console.log(`Groq model selected: ${activeModel}`);
      try {
        const prompt = `You are an expert bilingual dictionary lexicographer.
Provide a clear, precise definition for the word "${word}" (in language "${targetLang}") translated to the student's native language "${nativeLang}".
${isChinese ? 'Provide the standard Pinyin with tone marks for this COMPLETE word in "translit" (e.g. "hěn gāoxìng", "nǐ hǎo").' : ''}
${isArabic ? 'Provide Latin romanization in "translit" or null.' : ''}
${!hasTranslit ? 'Set "translit" to null.' : ''}

Format strictly as valid JSON matching this schema:
{
  "word": "${word}",
  "meaning": "concise clear definition in ${nativeLang}",
  "part_of_speech": "grammatical category in ${nativeLang} (e.g. sustantivo, verbo, adjetivo, adverbio)",
  "translit": ${hasTranslit ? '"phonetic pronunciation / Pinyin"' : 'null'}
}`;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 12000);

        const startTime = Date.now();
        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${effectiveApiKey}`
          },
          signal: controller.signal,
          body: JSON.stringify({
            model: activeModel,
            messages: [
              {
                role: 'system',
                content: 'You are an authoritative multilingual dictionary. Provide concise definitions in the requested native language with accurate grammatical part of speech and phonetic transliteration when appropriate. Always return strictly valid JSON.'
              },
              { role: 'user', content: prompt }
            ],
            response_format: { type: 'json_object' },
            temperature: 0.1,
            max_tokens: 350
          })
        });

        clearTimeout(timeoutId);

        if (response.ok) {
          const data = await response.json();
          const requestId = response.headers.get('x-request-id') || 'no disponible directamente';
          logCostAudit({
            provider: 'groq',
            feature: 'dictionary',
            model: activeModel,
            requestId,
            inputTokens: data?.usage?.prompt_tokens ?? 'no disponible directamente',
            outputTokens: data?.usage?.completion_tokens ?? 'no disponible directamente',
            totalTokens: data?.usage?.total_tokens ?? 'no disponible directamente',
            characters: word.length,
            durationMs: Date.now() - startTime,
            retry: false,
            streaming: false,
            extra: `word="${word}"`
          });
          const rawText = data?.choices?.[0]?.message?.content;
          const parsed = cleanAndParseJSON(rawText);
          if (parsed && (parsed.meaning || parsed.definition)) {
            return res.status(200).json({
              success: true,
              data: {
                word: parsed.word || word,
                meaning: parsed.meaning || parsed.definition,
                part_of_speech: parsed.part_of_speech || parsed.pos || null,
                translit: parsed.translit || parsed.pinyin || null
              }
            });
          }
        } else {
          const errText = await response.text();
          console.warn(`Groq word lookup error HTTP ${response.status}:`, errText);
        }
      } catch (err) {
        console.warn('Groq word lookup notice:', err.message);
      }
    }

    if (!effectiveApiKey) {
      return res.status(200).json({
        success: false,
        error: 'Para consultar la definición con IA, configura tu clave de Groq en Ajustes ⚙️.',
        data: null
      });
    }

    // Default error response if Groq failed
    res.status(200).json({
      success: false,
      error: 'No se pudo obtener la definición en este momento. Inténtalo de nuevo.',
      data: null
    });
  } catch (err) {
    res.status(500).json({ error: 'Error en la búsqueda de palabra' });
  }
}

/**
 * Strips secondary subtitle/translation artifacts produced by STT engines when transcribing
 * multilingual speech with natural code-switching.
 */
export function stripSttTranslationArtifacts(text, targetLang = 'es') {
  if (!text || typeof text !== 'string') return '';
  let cleaned = text.trim();
  if (!cleaned) return '';

  // 1. Remove bracketed / parenthetical translation or subtitle notes:
  // e.g. [Translation: ...], (English: ...), [Translated from Russian: ...]
  cleaned = cleaned
    .replace(/\[\s*(?:translated|english|translation|subtitles?|traducci[oó]n|en|es)?\s*:?[^\]]*\]/gi, '')
    .replace(/\(\s*(?:translated|english|translation|subtitles?|traducci[oó]n|en|es)\s*:?[^\)]*\)/gi, '')
    .trim();

  // 2. Multi-line handling: Whisper subtitle format (Line 1: original/code-switch, Line 2: English/secondary translation)
  const lines = cleaned.split(/\r?\n+/).map(l => l.trim()).filter(Boolean);
  if (lines.length > 1) {
    const nonLatinRegex = /[\u0400-\u04FF\u0600-\u06FF\u4E00-\u9FFF\u3040-\u30FF\uAC00-\uD7AF\u0370-\u03FF\u0590-\u05FF\u0900-\u097F\u0E00-\u0E7F]/;

    if (nonLatinRegex.test(lines[0])) {
      const nonLatinLines = lines.filter(l => nonLatinRegex.test(l));
      if (nonLatinLines.length > 0 && nonLatinLines.length < lines.length) {
        cleaned = nonLatinLines.join(' ');
      } else {
        cleaned = lines[0];
      }
    } else {
      cleaned = lines[0];
    }
  }

  // 3. Inline sentence translation handling (e.g. "Russian sentence. English translation.")
  const sentenceMatches = cleaned.match(/[^.!?]+[.!?]*/g);
  if (sentenceMatches && sentenceMatches.length >= 2) {
    const s1 = sentenceMatches[0].trim();
    const s2 = sentenceMatches.slice(1).join(' ').trim();
    const nonLatinRegex = /[\u0400-\u04FF\u0600-\u06FF\u4E00-\u9FFF\u3040-\u30FF\uAC00-\uD7AF\u0370-\u03FF\u0590-\u05FF\u0900-\u097F\u0E00-\u0E7F]/;

    // If Sentence 1 has non-Latin characters (e.g. Russian, Arabic, Chinese) and Sentence 2 has NO non-Latin characters (pure Latin/English)
    if (nonLatinRegex.test(s1) && !nonLatinRegex.test(s2)) {
      cleaned = s1;
    }
  }

  return cleaned.trim();
}

export function getWhisperPromptForLanguage(targetLang = 'es') {
  const lang = (targetLang || 'es').toLowerCase().split('-')[0];
  const prompts = {
    nl: 'Nederlandse gesproken taal. Precieze transcriptie van wat er gezegd wordt, inclusief eventuele code-switching. Niet vertalen.',
    de: 'Deutsche gesprochene Sprache. Genaue wörtliche Transkription des Gesprochenen inklusive Code-Switching. Nicht übersetzen.',
    es: 'Español hablado. Transcripción literal y exacta de las palabras dichas, incluyendo cambio de código. No traducir.',
    fr: 'Français parlé. Transcription exacte et littérale de ce qui est dit, y compris le code-switching. Ne pas traduire.',
    it: 'Italiano parlato. Trascrizione esatta e letterale di ciò que viene detto, incluso code-switching. Non tradurre.',
    pt: 'Português falado. Transcrição exata e literal do que é dito, incluindo code-switching. Não traduzir.',
    pl: 'Mówiony język polski. Dokładna, dosłowna transkrypcja wypowiedzi wraz z przełączaniem kodów. Nie tłumaczyć.',
    ru: 'Русская разговорная речь. Точная дословная расшифровка сказанного, включая переключение языков. Не переводить.',
    ar: 'كلام منطوق باللغة العربية. نسخ حرفي دقيق لما يقال دون ترجمة مع الحفاظ على أي تبديل بين اللغات.',
    zh: '中文普通话口语对话。准确逐字记录原话，保留混合语言，绝不翻译。',
    tr: 'Konuşulan Türkçe. Söylenenlerin tam ve kelimesi kelimesine dökümü, dil geçişleri dahil. Çeviri yapmayın.',
    en: 'Spoken English dialogue. Exact verbatim transcription of spoken words including code-switching. Do not translate.'
  };

  if (prompts[lang]) {
    return prompts[lang];
  }

  const langObj = SUPPORTED_LANGUAGES.find(l => l.code === lang);
  const targetName = langObj?.englishName || langObj?.name || lang;
  return `${targetName} spoken dialogue. Exact verbatim transcription of spoken words including code-switching. Do not translate.`;
}

// Transcribe audio endpoint (Groq Whisper-large-v3)
export async function handleTranscribe(req, res) {
  setCorsHeaders(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const body = parseRequestBody(req);
    const {
      audioBase64,
      mimeType,
      targetLang = 'es',
      nativeLang = 'es',
      apiKey: clientApiKey
    } = body;

    if (!audioBase64) {
      return res.status(400).json({ error: 'No se recibió archivo de audio.' });
    }

    const effectiveApiKey = (
      process.env.GROQ_API_KEY ||
      (clientApiKey?.startsWith('gsk_') ? clientApiKey : '') ||
      (req.headers['x-api-key'] || '')
    ).trim().replace(/^["']|["']$/g, '');

    if (!effectiveApiKey) {
      return res.status(400).json({ error: 'No hay GROQ_API_KEY configurada en el servidor para transcripción de audio.' });
    }

    const cleanBase64 = audioBase64.includes(',') ? audioBase64.split(',')[1] : audioBase64;
    let cleanMime = (mimeType || 'audio/webm').split(';')[0].trim().toLowerCase();
    if (!cleanMime || cleanMime === 'audio/x-m4a') cleanMime = 'audio/mp4';

    console.log(`Audio transcription requested with Groq Whisper [whisper-large-v3] (targetLang=${targetLang}, nativeLang=${nativeLang})`);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000);
    let httpStatus = 0;
    let groqErrorMessage = '';

    try {
      const audioBuffer = Buffer.from(cleanBase64, 'base64');
      const fileExt = cleanMime.includes('mp4') ? 'mp4' : (cleanMime.includes('wav') ? 'wav' : 'webm');
      const audioBlob = new Blob([audioBuffer], { type: cleanMime });

      const formData = new FormData();
      formData.append('file', audioBlob, `speech.${fileExt}`);
      formData.append('model', 'whisper-large-v3');
      formData.append('temperature', '0');
      formData.append('response_format', 'json');

      const whisperPrompt = getWhisperPromptForLanguage(targetLang);
      formData.append('prompt', whisperPrompt);

      const startTime = Date.now();
      const groqRes = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${effectiveApiKey}`
        },
        signal: controller.signal,
        body: formData
      });

      clearTimeout(timeoutId);
      httpStatus = groqRes.status;

      if (groqRes.ok) {
        const groqData = await groqRes.json();
        let transcript = groqData?.text?.trim();
        const requestId = groqRes.headers.get('x-request-id') || 'no disponible directamente';
        logCostAudit({
          provider: 'groq',
          feature: 'live_call_stt',
          model: 'whisper-large-v3',
          requestId,
          inputTokens: 'no disponible directamente',
          outputTokens: 'no disponible directamente',
          totalTokens: 'no disponible directamente',
          characters: transcript ? transcript.length : 0,
          durationMs: Date.now() - startTime,
          retry: false,
          streaming: false,
          extra: `status=${httpStatus} mime=${cleanMime}`
        });
        if (transcript) {
          transcript = stripSttTranslationArtifacts(transcript, targetLang);
          console.log(`✅ Audio transcribed via Groq Whisper: "${transcript}"`);
          return res.status(200).json({
            success: true,
            source: 'groq (whisper-large-v3)',
            transcript
          });
        }
      } else {
        const err = await groqRes.json().catch(() => ({}));
        groqErrorMessage = err?.error?.message || groqRes.statusText;
      }
    } catch (err) {
      clearTimeout(timeoutId);
      httpStatus = err.name === 'AbortError' ? 408 : 500;
      groqErrorMessage = err.name === 'AbortError' ? 'Network timeout: la transcripción con Groq excedió el tiempo límite.' : err.message;
    }

    console.error(`Groq Whisper request failed:\nHTTP status: ${httpStatus}\nGroq error message: ${groqErrorMessage}`);
    const errorInfo = categorizeGroqError(httpStatus, groqErrorMessage);
    return res.status(httpStatus >= 400 && httpStatus < 600 ? httpStatus : 500).json({
      error: errorInfo.userMessage,
      error_type: errorInfo.type
    });
  } catch (err) {
    console.error('Server error in /api/transcribe:', err);
    res.status(500).json({ error: 'Error en el servidor durante la transcripción de audio.' });
  }
}

// Sentence Grammar Breakdown endpoint (Groq AI-powered deep morphosyntactic analysis)
export async function handleSentenceBreakdown(req, res) {
  setCorsHeaders(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const body = parseRequestBody(req);
    const {
      sentence,
      originalText = '',
      targetLang = 'es',
      nativeLang = 'es',
      apiKey: clientApiKey
    } = body;

    if (!sentence || !sentence.trim()) {
      return res.status(400).json({ error: 'Se requiere una oración para el desglose gramatical.' });
    }

    const effectiveApiKey = (
      process.env.GROQ_API_KEY ||
      (clientApiKey?.startsWith('gsk_') ? clientApiKey : '') ||
      (req.headers['x-api-key'] || '')
    ).trim().replace(/^["']|["']$/g, '');

    const activeModel = getSanitizedGroqModel();

    if (effectiveApiKey) {
      console.log(`Analyzing sentence breakdown with Groq (${activeModel}) for lang: ${targetLang}`);
      const prompt = `You are a master linguistic professor and grammar teacher analyzing a sentence for a language student.
Analyze the following sentence in language "${targetLang}" for a student whose native language is "${nativeLang}".

Sentence to analyze: "${sentence.trim()}"
Original sentence typed by student (before corrections, if any): "${originalText.trim()}"

Provide an authentic, word-by-word morphosyntactic grammatical breakdown.
CRITICAL REQUIREMENTS:
- DO NOT output generic placeholder templates like "Palabra léxica", "Término en...", or repetition of the word as meaning!
- Every single token must have:
  * "word": the exact word, compound, or particle in "${targetLang}". For Chinese, group meaningful words/characters properly (e.g. "你好", "想", "学习", "中文").
  * "pinyin": Pinyin with tone marks for Chinese (e.g. "nǐ hǎo"), standard romanization for Arabic/Russian, or null for Latin scripts.
  * "pos": Precise, authentic Part of Speech in ${nativeLang} (e.g., "Verbo transitivo (1.ª pers. sing., presente)", "Sustantivo común femenino acusativo", "Palabra interrogativa", "Pronombre personal", "Partícula modal / aspecto").
  * "lemma": The base/canonical dictionary lemma form (e.g., for "va" -> "ir", for "kawę" -> "kawa", for "learned" -> "learn").
  * "meaning": Authentic, natural translation/definition of this word in ${nativeLang}.
  * "explanation": A clear, educational grammatical explanation in ${nativeLang} explaining why this word appears in this form, its syntactic role in the sentence, agreement, case, or conjugation.
  * "wasCorrected": true if this word was corrected or translated from the student's original sentence, otherwise false.
  * "originalWord": The student's original word before correction, or null.

Return STRICTLY valid JSON with no markdown formatting:
{
  "sentence": "${sentence.trim()}",
  "targetLang": "${targetLang}",
  "nativeLang": "${nativeLang}",
  "tokens": [
    {
      "index": 1,
      "word": "string",
      "pinyin": "string or null",
      "pos": "string",
      "lemma": "string",
      "meaning": "string",
      "explanation": "string",
      "wasCorrected": false,
      "originalWord": null
    }
  ]
}`;

      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 12000);

        const startTime = Date.now();
        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${effectiveApiKey}`
          },
          signal: controller.signal,
          body: JSON.stringify({
            model: activeModel,
            messages: [
              {
                role: 'system',
                content: 'You are an expert multilingual morphosyntactic parser and language tutor. You always return strictly valid JSON matching the user prompt schema with 100% accurate grammatical analysis and zero placeholder templates.'
              },
              { role: 'user', content: prompt }
            ],
            response_format: { type: 'json_object' },
            temperature: 0.1,
            max_tokens: 2000
          })
        });

        clearTimeout(timeoutId);

        if (response.ok) {
          const data = await response.json();
          const requestId = response.headers.get('x-request-id') || 'no disponible directamente';
          logCostAudit({
            provider: 'groq',
            feature: 'sentence_breakdown',
            model: activeModel,
            requestId,
            inputTokens: data?.usage?.prompt_tokens ?? 'no disponible directamente',
            outputTokens: data?.usage?.completion_tokens ?? 'no disponible directamente',
            totalTokens: data?.usage?.total_tokens ?? 'no disponible directamente',
            characters: sentence ? sentence.length : 0,
            durationMs: Date.now() - startTime,
            retry: false,
            streaming: false
          });
          const rawText = data?.choices?.[0]?.message?.content;
          const parsed = cleanAndParseJSON(rawText);
          if (parsed && Array.isArray(parsed.tokens) && parsed.tokens.length > 0) {
            return res.status(200).json({
              success: true,
              source: `groq (${activeModel})`,
              data: parsed
            });
          }
        }
      } catch (err) {
        console.warn('AI sentence breakdown notice:', err.message);
      }
    }

    // Fallback response if API key is not configured or fails
    return res.status(200).json({
      success: false,
      fallback: true,
      message: 'API key no configurada o respuesta de red demorada.'
    });
  } catch (err) {
    console.error('Server error in /api/sentence-breakdown:', err);
    res.status(500).json({ error: 'Error en el servidor al generar el desglose gramatical.' });
  }
}

// Batch Subtitle Gloss endpoint (Groq AI-powered multi-line interlinear word glossing)
export async function handleBatchGloss(req, res) {
  setCorsHeaders(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const body = parseRequestBody(req);
    const {
      lines = [],
      targetLang = 'zh',
      nativeLang = 'es',
      apiKey: clientApiKey
    } = body;

    if (!Array.isArray(lines) || lines.length === 0) {
      return res.status(400).json({ error: 'Se requiere una lista de líneas para glosar.' });
    }

    const effectiveApiKey = (
      process.env.GROQ_API_KEY ||
      (clientApiKey?.startsWith('gsk_') ? clientApiKey : '') ||
      (req.headers['x-api-key'] || '')
    ).trim().replace(/^["']|["']$/g, '');

const activeModel = getSanitizedGroqModel();

    if (effectiveApiKey) {
      const hasSpecificUnknowns = lines.some(l => Array.isArray(l.unknownTokens) && l.unknownTokens.length > 0);
      const totalUnknownTokens = lines.reduce((acc, l) => acc + (Array.isArray(l.unknownTokens) ? l.unknownTokens.length : (Array.isArray(l.words) ? l.words.length : 0)), 0);
      console.log(`Analyzing batch gloss with Groq (${activeModel}) for ${lines.length} lines (lang: ${targetLang} -> ${nativeLang}) | Total tokens to resolve: ${totalUnknownTokens} (hybrid: ${hasSpecificUnknowns})`);

      const linesFormatted = lines
        .map((l, i) => {
          const id = l.id || `line_${i + 1}`;
          const text = (l.text || '').trim();
          if (Array.isArray(l.unknownTokens) && l.unknownTokens.length > 0) {
            return `[ID: ${id}] Sentence Context: "${text}" | ONLY generate tokens for these unknown words: [${l.unknownTokens.map(w => `"${w}"`).join(', ')}]`;
          }
          const wordsStr = Array.isArray(l.words) && l.words.length > 0
            ? ` | Pre-segmented words: [${l.words.map(w => `"${w}"`).join(', ')}]`
            : '';
          return `[ID: ${id}]: "${text}"${wordsStr}`;
        })
        .join('\n');

      const isChinese = targetLang === 'zh';
      const isArabic = targetLang === 'ar';
      const targetLangObj = SUPPORTED_LANGUAGES.find(l => l.code === targetLang) || { name: targetLang, englishName: targetLang };
      const nativeLangObj = SUPPORTED_LANGUAGES.find(l => l.code === nativeLang) || { name: nativeLang, englishName: nativeLang };
      const targetLangName = targetLangObj.englishName || targetLangObj.name;
      const nativeLangName = nativeLangObj.englishName || nativeLangObj.name;

      let languageRules = '';
      if (isChinese) {
        languageRules = `- CHINESE RULES (targetLang: 'zh'):
  * Generate tone-marked Pinyin in the "auxiliary" field (e.g. "huānyíng", "jīntiān", "de").
  * In the "word" field, provide the exact Chinese characters (Hanzi).
  * In the "gloss" field, provide the direct concise translation/meaning in ${nativeLangName} ("${nativeLang}").`;
      } else if (isArabic) {
        languageRules = `- ARABIC RULES (targetLang: 'ar'):
  * In the "word" field, provide the Arabic script word corresponding to the input token.
  * In the "auxiliary" field, provide the clear Latin transliteration / romanization with vowels (e.g. "marḥaban", "kayfa", "al-kitāb", "as-salāmu"). Never leave it null for real Arabic words.
  * In the "gloss" field, provide the direct concise translation/meaning in ${nativeLangName} ("${nativeLang}").`;
      } else {
        languageRules = `- RULES FOR ${targetLang.toUpperCase()} (${targetLangName}):
  * Do NOT generate pronunciation, transliteration, romanization, Pinyin, or any auxiliary text. STRICTLY set "auxiliary": null for all tokens.
  * In the "word" field, provide the exact word in ${targetLangName}.
  * In the "gloss" field, provide the direct concise translation/meaning in ${nativeLangName} ("${nativeLang}").`;
      }

      const prompt = `You are a master multilingual linguistic professor and vocabulary glossing engine.
Analyze each subtitle line in target source language "${targetLangName}" (code: "${targetLang}") and provide authentic interlinear word-by-word glosses for a student whose native language is "${nativeLangName}" (code: "${nativeLang}").

MANDATORY RULES:
- TRANSLATION LANGUAGE: Every single gloss MUST be translated INTO the student's native language: ${nativeLangName} ("${nativeLang}"). DO NOT return Spanish glosses unless nativeLang is explicitly "es" / Spanish.
- SOURCE MEANINGS: Word meanings MUST reflect the vocabulary, grammar, and context of the SOURCE language (${targetLangName}), even if the word's spelling is shared with other languages (e.g. "was", "is", "had", "in", "de", "baby" in Dutch must be parsed and glossed as authentic Dutch words in ${nativeLangName}).

CRITICAL REQUIREMENTS:
${isChinese ? `- CHINESE LEXICAL SEGMENTATION (MANDATORY):
  * Analyze the FULL SENTENCE and segment it into meaningful LEXICAL WORDS, NOT individual Hanzi characters.
  * Multi-character Chinese words MUST remain as a SINGLE TOKEN. Compound words MUST NOT be split into individual characters.
  * CORRECT EXAMPLES:
    - 喜欢 → one token { word: "喜欢", auxiliary: "xǐhuan", gloss: "gustar" }  — NOT 喜 + 欢 separately
    - 学习 → one token { word: "学习", auxiliary: "xuéxí", gloss: "aprender" } — NOT 学 + 习 separately
    - 中文 → one token { word: "中文", auxiliary: "zhōngwén", gloss: "idioma chino" } — NOT 中 + 文 separately
    - 朋友 → one token { word: "朋友", auxiliary: "péngyou", gloss: "amigo" }
    - 今天 → one token { word: "今天", auxiliary: "jīntiān", gloss: "hoy" }
    - 学校 → one token { word: "学校", auxiliary: "xuéxiào", gloss: "escuela" }
  * Use sentence context to determine correct word boundaries.
  * Return EXACTLY one token per meaningful lexical unit (word/phrase), not per character.
  * The "auxiliary" field MUST contain tone-marked Pinyin for the COMPLETE multi-character word.
  * The "gloss" field MUST contain the meaning of the COMPLETE multi-character word in ${nativeLangName}.
  * IGNORE any pre-segmented word list — perform fresh lexical analysis from the sentence text.
  * Single-character words that are genuinely independent (e.g., 我, 的, 很, 了, 在, 也, 和) stay as single tokens.` :
  hasSpecificUnknowns ? `- HYBRID CONTEXTUAL GLOSSING:
  * For lines with "ONLY generate tokens for these unknown words", analyze the full sentence context to understand the exact contextual meaning, but ONLY output tokens and glosses for the requested unknown words!
  * Do NOT generate tokens for words outside the unknown list. This saves tokens and preserves local dictionary resolutions.` : `- PRESERVE PRE-SEGMENTED WORDS: You MUST preserve the exact pre-segmented word units. DO NOT break multi-character words into individual characters!
  * Complete glossing: Provide an accurate gloss in ${nativeLangName} for all substantive words.`}
- LANGUAGE-SPECIFIC RULES:
${languageRules}
- Omit punctuation marks or give them null gloss and null auxiliary.
- EXACT IDS: You MUST preserve and return the EXACT same line ID string for each line as provided in the input (e.g. "srt_1", "srt_2").
- RETURN ALL LINES: You MUST return all ${lines.length} requested lines matching IDs [${lines.map(l => `"${l.id}"`).join(', ')}].

Subtitle lines to process:
${linesFormatted}

Return STRICTLY valid JSON with no markdown formatting:
{
  "lines": [
    {
      "id": "exact line ID from input",
      "tokens": [
        {
          "word": "string (exact word unit)",
          "auxiliary": ${isChinese ? '"string with tone-marked Pinyin for the COMPLETE word"' : (isArabic ? '"string with clear Latin transliteration (e.g. marḥaban, al-kitāb)"' : 'null')},
          "gloss": "string (direct concise meaning in ${nativeLangName})"
        }
      ]
    }
  ]
}`;

      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 25000);

        const startTime = Date.now();
        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${effectiveApiKey}`
          },
          signal: controller.signal,
          body: JSON.stringify({
            model: activeModel,
            messages: [
              {
                role: 'system',
                content: 'You are an expert multilingual linguistic parser and vocabulary glossing engine. You always return strictly valid JSON matching the schema with 100% accurate per-word glosses for all words and zero generic placeholder templates.'
              },
              { role: 'user', content: prompt }
            ],
            response_format: { type: 'json_object' },
            temperature: 0.1,
            max_tokens: 3500
          })
        });

        clearTimeout(timeoutId);

        if (response.ok) {
          const data = await response.json();
          const requestId = response.headers.get('x-request-id') || 'no disponible directamente';
          logCostAudit({
            provider: 'groq',
            feature: 'text_gloss_batch',
            model: activeModel,
            requestId,
            inputTokens: data?.usage?.prompt_tokens ?? 'no disponible directamente',
            outputTokens: data?.usage?.completion_tokens ?? 'no disponible directamente',
            totalTokens: data?.usage?.total_tokens ?? 'no disponible directamente',
            durationMs: Date.now() - startTime,
            retry: false,
            streaming: false,
            extra: `lines=${lines.length} total_tokens_target=${totalUnknownTokens}`
          });
          const rawText = data?.choices?.[0]?.message?.content;
          const parsed = cleanAndParseJSON(rawText);
          if (parsed && Array.isArray(parsed.lines) && parsed.lines.length > 0) {
            const requestedIds = new Set(lines.map(l => String(l.id)));
            const validLines = parsed.lines
              .filter(l => l && l.id && Array.isArray(l.tokens))
              .map(l => ({
                id: String(l.id),
                tokens: l.tokens.map(t => {
                  const w = String(t.word || t.text || '').trim();
                  const aux = isChinese
                    ? (t.auxiliary || t.pinyin || null)
                    : (isArabic ? (t.auxiliary || t.translit || getArabicTransliteration(w) || null) : null);
                  const gloss = t.gloss ? String(t.gloss).trim() : null;
                  return {
                    word: w,
                    auxiliary: aux,
                    gloss
                  };
                })
              }));

            const returnedIds = new Set(validLines.map(l => String(l.id)));
            const missingIds = [...requestedIds].filter(id => !returnedIds.has(id));

            return res.status(200).json({
              success: true,
              source: `groq (${activeModel})`,
              lines: validLines,
              isComplete: missingIds.length === 0,
              missingIds
            });
          }
        } else {
          const errText = await response.text();
          console.warn(`Groq batch gloss responded with HTTP ${response.status}:`, errText);
        }
      } catch (err) {
        console.warn('Batch gloss API notice:', err.message);
      }
    }

    return res.status(200).json({
      success: false,
      fallback: true,
      message: 'API key no configurada o respuesta demorada.'
    });
  } catch (err) {
    console.error('Server error in /api/batch-gloss:', err);
    res.status(500).json({ error: 'Error en el servidor al generar las glosas de subtítulos.' });
  }
}

// AI Text Generation endpoint for Text Reader
export async function handleGenerateText(req, res) {
  setCorsHeaders(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const body = parseRequestBody(req);
    const {
      topic = '',
      targetLang = 'es',
      level = 'B1',
      length = 'medium',
      apiKey: clientApiKey
    } = body;

    const trimmedTopic = (topic || '').trim();
    if (!trimmedTopic) {
      return res.status(400).json({ error: 'Debes proporcionar un tema o idea para generar el texto.' });
    }

    const effectiveApiKey = (
      process.env.GROQ_API_KEY ||
      (clientApiKey?.startsWith('gsk_') ? clientApiKey : '') ||
      (req.headers['x-api-key'] || '')
    ).trim().replace(/^["']|["']$/g, '');

    const activeModel = getSanitizedGroqModel();
    const langObj = SUPPORTED_LANGUAGES.find(l => l.code === targetLang) || { name: targetLang, englishName: targetLang };
    const targetName = langObj.englishName || langObj.name;
    const targetNativeName = langObj.name || targetName;

    const lengthGuidelines = {
      short: 'approx 150-200 words across 2 to 3 paragraphs',
      medium: 'approx 250-350 words across 3 to 5 paragraphs',
      long: 'approx 450-600 words across 4 to 6 paragraphs'
    };
    const lengthInstruction = lengthGuidelines[length] || lengthGuidelines.medium;

    if (effectiveApiKey) {
      console.log(`Generating text with Groq (${activeModel}) strictly in language: ${targetLang} (${targetName}) for topic: "${trimmedTopic}"`);

      const systemPrompt = `You are a professional author and multilingual language educator.
Your task is to write an engaging, authentic, and natural reading text STRICTLY and EXCLUSIVELY in ${targetName} (${targetNativeName}, language code: "${targetLang}").

CRITICAL RULES:
1. The entire text body MUST be written 100% in ${targetName} (${targetNativeName}). DO NOT include sentences, explanations, translations, or notes in any other language.
2. The text MUST match the learner's requested proficiency level: ${level}.
3. The length of the text should be ${lengthInstruction}.
4. Separate distinct paragraphs using double newlines ("\\n\\n"). Each paragraph should be coherent and formatted cleanly.
5. Provide a short, captivating title strictly in ${targetName}.
6. Output format: Return a JSON object with {"title": "Title in ${targetName}", "text": "Paragraph 1...\\n\\nParagraph 2..."} or directly the titled text in ${targetName}.`;

      const userPrompt = `Student requested topic / prompt: "${trimmedTopic}".
Proficiency level: ${level}.
Target language: ${targetName} (${targetNativeName}, code: ${targetLang}).

Write the complete reading text in ${targetName} now.`;

      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 20000);

        const startTime = Date.now();
        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${effectiveApiKey}`
          },
          signal: controller.signal,
          body: JSON.stringify({
            model: activeModel,
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userPrompt }
            ],
            temperature: 0.7,
            max_tokens: 2500
          })
        });

        clearTimeout(timeoutId);

        if (response.ok) {
          const data = await response.json();
          const requestId = response.headers.get('x-request-id') || 'no disponible directamente';
          logCostAudit({
            provider: 'groq',
            feature: 'ai_story_generation',
            model: activeModel,
            requestId,
            inputTokens: data?.usage?.prompt_tokens ?? 'no disponible directamente',
            outputTokens: data?.usage?.completion_tokens ?? 'no disponible directamente',
            totalTokens: data?.usage?.total_tokens ?? 'no disponible directamente',
            characters: trimmedTopic.length,
            durationMs: Date.now() - startTime,
            retry: false,
            streaming: false,
            extra: `level=${level} length=${length}`
          });
          const rawContent = data?.choices?.[0]?.message?.content || '';

          // 1. Try JSON parsing
          const parsed = cleanAndParseJSON(rawContent);
          if (parsed && typeof parsed.text === 'string' && parsed.text.trim()) {
            return res.status(200).json({
              success: true,
              source: `groq (${activeModel})`,
              title: (parsed.title || trimmedTopic).trim(),
              text: parsed.text.trim()
            });
          }

          // 2. If raw text or markdown format
          if (rawContent.trim()) {
            const lines = rawContent.trim().split('\n').map(l => l.trim()).filter(Boolean);
            let title = trimmedTopic;
            let textLines = [...lines];

            if (lines.length > 1 && (lines[0].startsWith('#') || (lines[0].length < 80 && !lines[0].endsWith('.')))) {
              title = lines[0].replace(/^#+\s*/, '').replace(/^[*"']+|[*"']+$/g, '').trim();
              textLines = lines.slice(1);
            }

            const cleanText = textLines.join('\n\n').trim() || rawContent.trim();
            return res.status(200).json({
              success: true,
              source: `groq (${activeModel})`,
              title: title || trimmedTopic,
              text: cleanText
            });
          }
        } else {
          const errText = await response.text();
          console.warn(`Groq text generation error HTTP ${response.status}:`, errText);
          const categorized = categorizeGroqError(response.status, errText);
          return res.status(response.status >= 400 && response.status < 600 ? response.status : 500).json({
            error: categorized.userMessage,
            error_type: categorized.type
          });
        }
      } catch (err) {
        console.warn('Groq generate text error:', err.message);
        const isTimeout = err.name === 'AbortError';
        return res.status(isTimeout ? 408 : 500).json({
          error: isTimeout
            ? 'Tiempo de espera agotado al generar el texto con IA. Por favor intenta nuevamente.'
            : `Error de conexión: ${err.message}`
        });
      }
    }

    return res.status(400).json({
      error: 'Para generar textos con IA, configura tu GROQ_API_KEY en el servidor o en Ajustes ⚙️.'
    });
  } catch (err) {
    console.error('Server error in /api/generate-text:', err);
    res.status(500).json({ error: 'Error interno en el servidor al generar el texto.' });
  }
}



