import dotenv from 'dotenv';
import {
  GEMINI_MODEL_CONFIG,
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

// Supported conversational models
const PRIMARY_GEMINI_MODEL = 'gemini-3.6-flash';
const PRIMARY_GROQ_MODEL = (process.env.GROQ_MODEL || GROQ_MODEL_CONFIG?.model || 'llama-3.3-70b-versatile').trim();

export function detectProvider({ apiKey = '', requestedProvider = '' }) {
  const cleanKey = (apiKey || '').trim().replace(/^["']|["']$/g, '');
  if (cleanKey.startsWith('gsk_')) return 'groq';
  if (cleanKey.startsWith('AIza')) return 'gemini';
  if (requestedProvider === 'groq' || requestedProvider === 'gemini') return requestedProvider;
  if (process.env.GROQ_API_KEY && process.env.GROQ_API_KEY.trim()) return 'groq';
  if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim()) return 'gemini';
  return 'groq';
}

export function categorizeGroqError(status, message) {
  const msgLower = (message || '').toLowerCase();

  // 1. Invalid API Key
  if (status === 401 || status === 403 || msgLower.includes('invalid api key') || msgLower.includes('invalid_api_key') || msgLower.includes('unauthorized') || msgLower.includes('authentication')) {
    return {
      type: 'invalid API key',
      code: 'INVALID_API_KEY',
      userMessage: 'Clave API de Groq inválida o no autorizada. Por favor genera una nueva clave gratis en console.groq.com/keys e ingrésala en Ajustes ⚙️.'
    };
  }

  // 2. Model Not Found
  if (status === 404 || msgLower.includes('not found') || msgLower.includes('does not exist') || msgLower.includes('model_not_found')) {
    return {
      type: 'model not found',
      code: 'MODEL_NOT_FOUND',
      userMessage: `El modelo de Groq solicitado no fue encontrado o no está habilitado (${message}).`
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

function getSanitizedDefaultModel() {
  const envModel = (process.env.GEMINI_MODEL || '').trim();
  // Protect against obsolete/cached environment variables
  if (envModel && !envModel.includes('1.5') && !envModel.includes('2.0') && !envModel.includes('2.5') && !envModel.includes('pro')) {
    return envModel;
  }
  return PRIMARY_GEMINI_MODEL;
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

      const flash36 = availableNames.find(m => m.includes('3.6-flash'));
      if (flash36) {
        discoveredModel = flash36;
        return discoveredModel;
      }
    }
  } catch (e) {
    console.warn('Error querying ListModels:', e.message);
  }

  // If ListModels fails or key cannot list, strictly default to targetModel (gemini-3.6-flash)
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
      provider: clientProvider,
      history = []
    } = body;

    if (!message || !message.trim()) {
      return res.status(400).json({ error: 'El mensaje no puede estar vacío.' });
    }

    const provider = detectProvider({ apiKey: clientApiKey, requestedProvider: clientProvider });

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

    // ----------------------------------------------------
    // Provider: Groq (Ultra-fast Llama 3.3)
    // ----------------------------------------------------
    if (provider === 'groq') {
      const effectiveApiKey = (clientApiKey?.startsWith('gsk_') ? clientApiKey : (process.env.GROQ_API_KEY || clientApiKey || '')).trim().replace(/^["']|["']$/g, '');
      const activeModel = (process.env.GROQ_MODEL || GROQ_MODEL_CONFIG?.model || 'llama-3.3-70b-versatile').trim();

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
    } else {
      // ----------------------------------------------------
      // Provider: Google Gemini
      // ----------------------------------------------------
      const effectiveApiKey = (clientApiKey || process.env.GEMINI_API_KEY || '').trim().replace(/^["']|["']$/g, '');

      if (effectiveApiKey) {
        try {
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

          console.error(`Gemini request failed:\nmodel: ${activeModel}\nHTTP status: ${httpStatus}\nGoogle error message: ${googleErrorMessage}`);

          const deterministicCorrection = processDeterministicLinguistics(message.trim(), targetLang, nativeLang);
          const errorInfo = categorizeGeminiError(httpStatus, googleErrorMessage);

          return res.status(httpStatus >= 400 && httpStatus < 600 ? httpStatus : 503).json({
            success: false,
            error: errorInfo.userMessage,
            error_type: errorInfo.type,
            code: errorInfo.code,
            details: {
              provider: 'gemini',
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
    }

    // No API key provided: Return controlled error without fake/canned bot responses
    const deterministicCorrection = processDeterministicLinguistics(message.trim(), targetLang, nativeLang);
    return res.status(400).json({
      success: false,
      error: 'Para conversar con LinguaFlow, ingresa tu API Key de Groq (Recomendado ⚡ en console.groq.com/keys) o Google Gemini en Ajustes ⚙️.',
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
    const { word, targetLang, nativeLang, apiKey: clientApiKey, provider: clientProvider } = body;
    const provider = detectProvider({ apiKey: clientApiKey, requestedProvider: clientProvider });

    if (word) {
      if (provider === 'groq') {
        const effectiveApiKey = (clientApiKey?.startsWith('gsk_') ? clientApiKey : (process.env.GROQ_API_KEY || clientApiKey || '')).trim().replace(/^["']|["']$/g, '');
        if (effectiveApiKey) {
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
                model: (process.env.GROQ_MODEL || GROQ_MODEL_CONFIG?.model || 'llama-3.3-70b-versatile').trim(),
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
      } else {
        const effectiveApiKey = (clientApiKey || process.env.GEMINI_API_KEY || '').trim();
        if (effectiveApiKey) {
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

// Transcribe audio endpoint (Groq Whisper-large-v3 & Gemini Multimodal Audio)
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
      apiKey: clientApiKey,
      provider: clientProvider
    } = body;

    if (!audioBase64) {
      return res.status(400).json({ error: 'No se recibió archivo de audio.' });
    }

    const provider = detectProvider({ apiKey: clientApiKey, requestedProvider: clientProvider });
    const cleanBase64 = audioBase64.replace(/^data:[^;]+;base64,/, '');
    let cleanMime = (mimeType || 'audio/webm').split(';')[0].trim().toLowerCase();
    if (!cleanMime || cleanMime === 'audio/x-m4a') cleanMime = 'audio/mp4';

    const langObj = SUPPORTED_LANGUAGES.find(l => l.code === targetLang) || { name: targetLang, englishName: targetLang };
    const nativeObj = SUPPORTED_LANGUAGES.find(l => l.code === nativeLang) || { name: nativeLang, englishName: nativeLang };
    const targetName = langObj.englishName || langObj.name;
    const nativeName = nativeObj.englishName || nativeObj.name;

    // ----------------------------------------------------
    // Provider: Groq Whisper Large V3 (State of the art speech-to-text)
    // ----------------------------------------------------
    if (provider === 'groq') {
      const effectiveApiKey = (clientApiKey?.startsWith('gsk_') ? clientApiKey : (process.env.GROQ_API_KEY || clientApiKey || '')).trim().replace(/^["']|["']$/g, '');
      if (!effectiveApiKey) {
        return res.status(400).json({ error: 'No hay API key disponible para transcripción con Groq Whisper.' });
      }

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
        formData.append('prompt', `Multilingual learner practicing ${targetName} and ${nativeName}. Foreign accent or code-switching.`);

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
    }

    // ----------------------------------------------------
    // Provider: Gemini Multimodal Audio
    // ----------------------------------------------------
    const effectiveApiKey = (clientApiKey || process.env.GEMINI_API_KEY || '').trim();
    if (!effectiveApiKey) {
      return res.status(400).json({ error: 'No hay API key disponible para transcripción multimodal con Gemini.' });
    }

    const activeModel = await getBestGeminiModel(effectiveApiKey);
    console.log(`Gemini model selected: ${activeModel}`);

    const prompt = `You are an expert multilingual audio transcriber specialized in language learners.
The speaker is practicing target language: "${targetName}", and their native language is "${nativeName}".

CRITICAL INSTRUCTIONS:
1. The speaker may have a strong foreign accent (for example, native ${nativeName} accent while speaking ${targetName}). Transcribe the intended words accurately through the accent.
2. The speaker may mix words or whole sentences in BOTH "${targetName}" and "${nativeName}" (code-switching, e.g. mixing Polish and Spanish, Arabic and Spanish, German and Spanish, etc.). Transcribe EXACTLY what was said in the original languages.
3. Do NOT translate. Keep the original words in the languages spoken.
4. Output ONLY the raw transcribed text. Do NOT add quotes, markdown formatting, explanations, or timestamps.`;

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

