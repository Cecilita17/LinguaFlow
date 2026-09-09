import dotenv from 'dotenv';
import {
  GEMINI_MODEL_CONFIG,
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
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
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

// The exclusively supported conversational model is gemini-2.5-flash
const PRIMARY_MODEL = 'gemini-2.5-flash';

function getSanitizedDefaultModel() {
  const envModel = (process.env.GEMINI_MODEL || '').trim();
  // Protect against obsolete/cached environment variables
  if (envModel && !envModel.includes('1.5') && !envModel.includes('2.0') && !envModel.includes('pro')) {
    return envModel;
  }
  return PRIMARY_MODEL;
}

let discoveredModel = null;

async function getBestGeminiModel(apiKey) {
  if (discoveredModel) return discoveredModel;

  const targetModel = getSanitizedDefaultModel();

  try {
    const listRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
    if (listRes.ok) {
      const data = await listRes.json();
      const availableNames = (data.models || [])
        .filter(m => m.supportedGenerationMethods?.includes('generateContent'))
        .map(m => m.name.replace(/^models\//, ''));

      console.log('Available models for this key:', availableNames);

      if (availableNames.includes(targetModel)) {
        discoveredModel = targetModel;
        return discoveredModel;
      }

      const flash25 = availableNames.find(m => m.includes('2.5-flash'));
      if (flash25) {
        discoveredModel = flash25;
        return discoveredModel;
      }
    }
  } catch (e) {
    console.warn('Error querying ListModels:', e.message);
  }

  // If ListModels fails or key cannot list, strictly default to targetModel (gemini-2.5-flash)
  discoveredModel = targetModel;
  return discoveredModel;
}

export function categorizeGeminiError(status, message) {
  const msgLower = (message || '').toLowerCase();

  // 1. Invalid API Key
  if (status === 400 && (
    msgLower.includes('api key not valid') ||
    msgLower.includes('api_key_invalid') ||
    msgLower.includes('key not valid') ||
    msgLower.includes('invalid api key') ||
    msgLower.includes('api key expired')
  )) {
    return {
      type: 'invalid API key',
      code: 'INVALID_API_KEY',
      userMessage: 'Clave API de Gemini inválida. Por favor genera una nueva clave en Google AI Studio (aistudio.google.com) e ingrésala en Ajustes ⚙️.'
    };
  }

  // 2. Model Not Found
  if (status === 404 || msgLower.includes('not found') || msgLower.includes('not supported for generatecontent')) {
    return {
      type: 'model not found',
      code: 'MODEL_NOT_FOUND',
      userMessage: `El modelo de Gemini solicitado no fue encontrado o no está habilitado para esta clave (${message}).`
    };
  }

  // 3. Quota / Rate limit
  if (status === 429 || msgLower.includes('quota') || msgLower.includes('resource_exhausted') || msgLower.includes('rate limit')) {
    return {
      type: 'quota/rate limit',
      code: 'RATE_LIMIT_EXCEEDED',
      userMessage: 'Límite de cuota o peticiones excedido en Google Gemini (HTTP 429 Resource Exhausted). Espera unos segundos antes de volver a enviar.'
    };
  }

  // 4. Network timeout
  if (status === 408 || msgLower.includes('timeout') || msgLower.includes('aborted') || msgLower.includes('aborterror')) {
    return {
      type: 'network timeout',
      code: 'NETWORK_TIMEOUT',
      userMessage: 'Tiempo de espera agotado al conectar con Google Gemini. Revisa tu conexión a internet.'
    };
  }

  // 5. Server error (500, 502, 503, etc.)
  if (status >= 500) {
    return {
      type: 'server error',
      code: 'GEMINI_SERVER_ERROR',
      userMessage: `Error interno de los servidores de Google Gemini (HTTP ${status}): ${message}.`
    };
  }

  return {
    type: 'server error',
    code: 'GEMINI_ERROR',
    userMessage: `Error al conectar con Google Gemini (HTTP ${status || 'N/A'}): ${message || 'Servicio no disponible'}.`
  };
}



// Health check
export function handleHealth(req, res) {
  setCorsHeaders(res);
  res.status(200).json({ status: 'ok', service: 'LinguaFlow API' });
}

// List of supported languages
export function handleLanguages(req, res) {
  setCorsHeaders(res);
  res.status(200).json({ languages: SUPPORTED_LANGUAGES });
}

// Chat endpoint
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

    const effectiveApiKey = (clientApiKey || process.env.GEMINI_API_KEY || '').trim().replace(/^["']|["']$/g, '');

    // 1. Call Google Gemini AI
    if (effectiveApiKey) {
      try {
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

        const activeModel = await getBestGeminiModel(effectiveApiKey);
        console.log(`Gemini model selected: ${activeModel}`);

        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${activeModel}:generateContent?key=${effectiveApiKey}`;

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 12000); // 12s timeout

        let response;
        let httpStatus = 0;
        let googleErrorMessage = '';
        let parsedData = null;

        try {
          response = await fetch(geminiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            signal: controller.signal,
            body: JSON.stringify({
              contents: [{ role: 'user', parts: [{ text: `${systemInstruction}\n\n${dataPrompt}` }] }],
              generationConfig: GEMINI_MODEL_CONFIG.generationConfig
            })
          });

          clearTimeout(timeoutId);
          httpStatus = response.status;

          if (response.ok) {
            const data = await response.json();
            const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
            parsedData = cleanAndParseJSON(rawText);

            if (parsedData && parsedData.user_correction && parsedData.bot_response) {
              console.log(`✅ Gemini AI answered using [${activeModel}]`);
              return res.status(200).json({
                success: true,
                source: `gemini (${activeModel})`,
                data: parsedData
              });
            } else {
              googleErrorMessage = `La respuesta de ${activeModel} no tuvo el formato JSON esperado: ${rawText.slice(0, 120)}`;
            }
          } else {
            const err = await response.json().catch(() => ({}));
            googleErrorMessage = err?.error?.message || response.statusText;
          }
        } catch (fetchErr) {
          clearTimeout(timeoutId);
          httpStatus = fetchErr.name === 'AbortError' ? 408 : 500;
          googleErrorMessage = fetchErr.name === 'AbortError' ? 'Network timeout: la solicitud a Google Gemini excedió el tiempo límite.' : fetchErr.message;
        }

        // Required error logging format:
        console.error(`Gemini request failed:\nmodel: ${activeModel}\nHTTP status: ${httpStatus}\nGoogle error message: ${googleErrorMessage}`);

        const deterministicCorrection = processDeterministicLinguistics(message.trim(), targetLang, nativeLang);
        const errorInfo = categorizeGeminiError(httpStatus, googleErrorMessage);

        return res.status(httpStatus >= 400 && httpStatus < 600 ? httpStatus : 503).json({
          success: false,
          error: errorInfo.userMessage,
          error_type: errorInfo.type,
          code: errorInfo.code,
          details: {
            model: activeModel,
            status: httpStatus,
            google_error: googleErrorMessage
          },
          user_correction: deterministicCorrection
        });
      } catch (geminiErr) {
        console.warn('Gemini AI workflow threw:', geminiErr.message);
        const deterministicCorrection = processDeterministicLinguistics(message.trim(), targetLang, nativeLang);
        const errorInfo = categorizeGeminiError(500, geminiErr.message);
        return res.status(500).json({
          success: false,
          error: errorInfo.userMessage,
          error_type: errorInfo.type,
          code: errorInfo.code,
          user_correction: deterministicCorrection
        });
      }
    }

    // No API key provided: Return controlled error without fake/canned bot responses
    const deterministicCorrection = processDeterministicLinguistics(message.trim(), targetLang, nativeLang);
    return res.status(400).json({
      success: false,
      error: 'Para conversar con LinguaFlow, ingresa tu API Key de Google Gemini en Ajustes ⚙️ (es gratis en Google AI Studio). Gemini es el motor exclusivo de conversación.',
      error_type: 'invalid API key',
      code: 'MISSING_API_KEY',
      user_correction: deterministicCorrection
    });

  } catch (error) {
    console.error('Server error in /api/chat:', error);
    res.status(500).json({ error: 'Error procesando la solicitud en el servidor.' });
  }
}

// Word lookup endpoint
export async function handleLookupWord(req, res) {
  setCorsHeaders(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const body = parseRequestBody(req);
    const { word, targetLang, nativeLang, apiKey: clientApiKey } = body;
    const effectiveApiKey = (clientApiKey || process.env.GEMINI_API_KEY || '').trim();

    if (effectiveApiKey && word) {
      try {
        const modelName = discoveredModel || getSanitizedDefaultModel();
        const prompt = `Give definition for "${word}" in language "${targetLang}" translated to "${nativeLang}".
Format strictly as JSON: {"word": "${word}", "meaning": "definition in ${nativeLang}", "part_of_speech": "noun/verb/adj", "translit": null}`;

        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${effectiveApiKey}`;
        const controller = new AbortController();
        setTimeout(() => controller.abort(), 4000);

        const response = await fetch(geminiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { responseMimeType: 'application/json' }
          })
        });

        if (response.ok) {
          const data = await response.json();
          const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
          const parsed = cleanAndParseJSON(rawText);
          if (parsed) return res.status(200).json({ success: true, data: parsed });
        }
      } catch (err) {
        console.warn('Gemini word lookup error:', err.message);
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

// Transcribe audio endpoint (Gemini Multimodal Audio for heavy accents & mixed languages)
export async function handleTranscribe(req, res) {
  setCorsHeaders(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const body = parseRequestBody(req);
    const { audioBase64, mimeType = 'audio/webm', targetLang = 'es', nativeLang = 'es', apiKey: clientApiKey } = body;

    const effectiveApiKey = (clientApiKey || process.env.GEMINI_API_KEY || '').trim();

    if (!audioBase64) {
      return res.status(400).json({ error: 'No se recibió archivo de audio.' });
    }

    if (!effectiveApiKey) {
      return res.status(400).json({ error: 'No hay API key disponible para transcripción multimodal con IA.' });
    }

    const langObj = SUPPORTED_LANGUAGES.find(l => l.code === targetLang) || { name: targetLang, englishName: targetLang };
    const nativeObj = SUPPORTED_LANGUAGES.find(l => l.code === nativeLang) || { name: nativeLang, englishName: nativeLang };
    const targetName = langObj.englishName || langObj.name;
    const nativeName = nativeObj.englishName || nativeObj.name;

    const activeModel = await getBestGeminiModel(effectiveApiKey);
    console.log(`Gemini model selected: ${activeModel}`);

    const prompt = `You are an expert multilingual audio transcriber specialized in language learners.
The speaker is practicing target language: "${targetName}", and their native language is "${nativeName}".

CRITICAL INSTRUCTIONS:
1. The speaker may have a strong foreign accent (for example, native ${nativeName} accent while speaking ${targetName}). Transcribe the intended words accurately through the accent.
2. The speaker may mix words or whole sentences in BOTH "${targetName}" and "${nativeName}" (code-switching, e.g. mixing Polish and Spanish, Arabic and Spanish, German and Spanish, etc.). Transcribe EXACTLY what was said in the original languages.
3. Do NOT translate. Keep the original words in the languages spoken.
4. Output ONLY the raw transcribed text. Do NOT add quotes, markdown formatting, explanations, or timestamps.`;

    const cleanBase64 = audioBase64.replace(/^data:[^;]+;base64,/, '');
    let cleanMime = (mimeType || 'audio/webm').split(';')[0].trim().toLowerCase();
    if (!cleanMime || cleanMime === 'audio/x-m4a') cleanMime = 'audio/mp4';

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${activeModel}:generateContent?key=${effectiveApiKey}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 14000);

    let httpStatus = 0;
    let googleErrorMessage = '';

    try {
      const response = await fetch(geminiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  inlineData: {
                    mimeType: cleanMime,
                    data: cleanBase64
                  }
                },
                {
                  text: prompt
                }
              ]
            }
          ],
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 1000
          }
        })
      });

      clearTimeout(timeoutId);
      httpStatus = response.status;

      if (response.ok) {
        const data = await response.json();
        const transcript = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
        if (transcript) {
          console.log(`✅ Audio transcribed via Gemini [${activeModel}]: "${transcript}"`);
          return res.status(200).json({
            success: true,
            source: `gemini (${activeModel})`,
            transcript
          });
        }
      } else {
        const err = await response.json().catch(() => ({}));
        googleErrorMessage = err?.error?.message || response.statusText;
      }
    } catch (err) {
      clearTimeout(timeoutId);
      httpStatus = err.name === 'AbortError' ? 408 : 500;
      googleErrorMessage = err.name === 'AbortError' ? 'Network timeout: la transcripción excedió el tiempo límite.' : err.message;
    }

    console.error(`Gemini request failed:\nmodel: ${activeModel}\nHTTP status: ${httpStatus}\nGoogle error message: ${googleErrorMessage}`);
    const errorInfo = categorizeGeminiError(httpStatus, googleErrorMessage);
    return res.status(httpStatus >= 400 && httpStatus < 600 ? httpStatus : 500).json({
      error: errorInfo.userMessage,
      error_type: errorInfo.type
    });
  } catch (err) {
    console.error('Server error in /api/transcribe:', err);
    res.status(500).json({ error: 'Error en el servidor durante la transcripción de audio.' });
  }
}

