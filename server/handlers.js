import dotenv from 'dotenv';
import {
  GROQ_MODEL_CONFIG,
  buildSystemInstruction,
  buildDataContextPrompt,
  cleanAndParseJSON
} from './promptTemplates.js';
import { SUPPORTED_LANGUAGES } from './languageData.js';
import { processDeterministicLinguistics, processSmartConversation } from './conversationEngine.js';

dotenv.config();

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

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 12000);

      let httpStatus = 0;
      let groqErrorMessage = '';
      let parsedData = null;

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
            max_tokens: 2500
          })
        });

        clearTimeout(timeoutId);
        httpStatus = response.status;

        if (response.ok) {
          const data = await response.json();
          const rawText = data?.choices?.[0]?.message?.content || '';
          parsedData = cleanAndParseJSON(rawText);

          if (parsedData && parsedData.user_correction && parsedData.bot_response) {
            console.log(`✅ Groq AI answered using [${activeModel}]`);
            return res.status(200).json({
              success: true,
              source: `groq (${activeModel})`,
              data: parsedData
            });
          } else {
            groqErrorMessage = `La respuesta de Groq no tuvo el formato JSON esperado: ${rawText.slice(0, 120)}`;
          }
        } else {
          const err = await response.json().catch(() => ({}));
          groqErrorMessage = err?.error?.message || response.statusText;
        }
      } catch (fetchErr) {
        clearTimeout(timeoutId);
        httpStatus = fetchErr.name === 'AbortError' ? 408 : 500;
        groqErrorMessage = fetchErr.name === 'AbortError' ? 'Network timeout: la solicitud a Groq excedió el tiempo límite.' : fetchErr.message;
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
      (clientApiKey?.startsWith('gsk_') ? clientApiKey : '') ||
      (req.headers['x-api-key'] || '')
    ).trim().replace(/^["']|["']$/g, '');

    const activeModel = getSanitizedGroqModel();

    if (word && effectiveApiKey) {
      console.log(`Groq model selected: ${activeModel}`);
      try {
        const prompt = `Give definition for "${word}" in language "${targetLang}" translated to "${nativeLang}".
Format strictly as JSON: {"word": "${word}", "meaning": "definition in ${nativeLang}", "part_of_speech": "noun/verb/adj", "translit": null}`;
        const controller = new AbortController();
        setTimeout(() => controller.abort(), 4000);

        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${effectiveApiKey}`
          },
          signal: controller.signal,
          body: JSON.stringify({
            model: activeModel,
            messages: [{ role: 'user', content: prompt }],
            response_format: { type: 'json_object' },
            temperature: 0.2,
            max_tokens: 300
          })
        });

        if (response.ok) {
          const data = await response.json();
          const rawText = data?.choices?.[0]?.message?.content;
          const parsed = cleanAndParseJSON(rawText);
          if (parsed) return res.status(200).json({ success: true, data: parsed });
        }
      } catch (err) {
        console.warn('Groq word lookup notice:', err.message);
      }
    }

    // Default dictionary fallback
    res.status(200).json({
      success: true,
      data: {
        word,
        meaning: `Término en práctica: "${word}".`,
        part_of_speech: 'término',
        translit: null
      }
    });
  } catch (err) {
    res.status(500).json({ error: 'Error en la búsqueda de palabra' });
  }
}

// Transcribe audio endpoint (Groq Whisper-large-v3)
export async function handleTranscribe(req, res) {
  setCorsHeaders(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const body = parseRequestBody(req);
    const {
      audioBase64,
      mimeType = 'audio/webm',
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

    const cleanBase64 = audioBase64.replace(/^data:[^;]+;base64,/, '');
    let cleanMime = (mimeType || 'audio/webm').split(';')[0].trim().toLowerCase();
    if (!cleanMime || cleanMime === 'audio/x-m4a') cleanMime = 'audio/mp4';

    const langObj = SUPPORTED_LANGUAGES.find(l => l.code === targetLang) || { name: targetLang, englishName: targetLang };
    const nativeObj = SUPPORTED_LANGUAGES.find(l => l.code === nativeLang) || { name: nativeLang, englishName: nativeLang };
    const targetName = langObj.englishName || langObj.name;
    const nativeName = nativeObj.englishName || nativeObj.name;

    console.log('Audio transcription requested with Groq Whisper [whisper-large-v3]');
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
      const whisperPrompt = `Multilingual speech with natural code-switching: ${targetName}, ${nativeName}, English, Polski (ą, ć, ę, ł, ń, ó, ś, ź, ż), Deutsch (ä, ö, ü, ß), Español (ñ, á, é, í, ó, ú), Français, 中文, Русский, العربية. Transcribe every spoken word in its original language in UTF-8 without translating or omitting words.`;
      formData.append('prompt', whisperPrompt);

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
        const transcript = groqData?.text?.trim();
        if (transcript) {
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
      console.log(`Analyzing batch gloss with Groq (${activeModel}) for ${lines.length} lines (lang: ${targetLang} -> ${nativeLang})`);
      const linesFormatted = lines
        .map((l, i) => `[ID: ${l.id || `line_${i + 1}`}]: "${(l.text || '').trim()}"`)
        .join('\n');

      const prompt = `You are a master linguistic professor and vocabulary glossing engine.
Analyze each subtitle line in language "${targetLang}" and provide authentic interlinear word-by-word glosses for a student whose native language is "${nativeLang}".

CRITICAL REQUIREMENTS:
- Segment multi-character words/compounds as single units (e.g. for Chinese: "欢迎", "收听", "今天", "这", "封", "写给", "自己", "的", "信"). DO NOT break multi-character words into individual characters!
- For each token provide:
  * "word": the exact word/compound in "${targetLang}"
  * "pinyin": Pinyin with tone marks for Chinese (e.g. "huānyíng", "jīntiān", "zìjǐ", "de"), or romanization for Arabic/Russian, or null for Latin scripts.
  * "gloss": accurate, direct, concise definition/translation of this specific word in "${nativeLang}" (e.g. "bienvenido", "hoy", "uno mismo", "de", "carta"). DO NOT output the whole sentence as the gloss!
- Omit isolated punctuation from glosses or give them null gloss.

Subtitle lines to process:
${linesFormatted}

Return STRICTLY valid JSON with no markdown formatting:
{
  "lines": [
    {
      "id": "line ID matching the input",
      "tokens": [
        {
          "word": "string",
          "pinyin": "string or null",
          "gloss": "string"
        }
      ]
    }
  ]
}`;

      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 20000);

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
                content: 'You are an expert multilingual linguistic parser and vocabulary glossing engine. You always return strictly valid JSON matching the schema with 100% accurate per-word glosses and zero generic placeholder templates.'
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
          const rawText = data?.choices?.[0]?.message?.content;
          const parsed = cleanAndParseJSON(rawText);
          if (parsed && Array.isArray(parsed.lines) && parsed.lines.length > 0) {
            return res.status(200).json({
              success: true,
              source: `groq (${activeModel})`,
              lines: parsed.lines
            });
          }
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


