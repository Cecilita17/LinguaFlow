// Base URL for the backend API deployed on Render
export const API_BASE_URL = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_BASE_URL) || 'https://linguaflow-fef0.onrender.com';

import { processSmartConversation } from '../../server/conversationEngine.js';
import {
  GEMINI_MODEL_CONFIG,
  buildSystemInstruction,
  buildDataContextPrompt,
  cleanAndParseJSON
} from '../../server/promptTemplates.js';
import { SUPPORTED_LANGUAGES } from '../../server/languageData.js';
import { performFullGrammarCorrection } from './grammarEngine.js';

export function categorizeClientGeminiError(status, message) {
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
      userMessage: `El modelo de Gemini solicitado no fue encontrado o no está disponible para esta clave (${message}).`
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
      userMessage: `Error del servidor de Google Gemini (HTTP ${status}): ${message}.`
    };
  }

  return {
    type: 'server error',
    code: 'GEMINI_ERROR',
    userMessage: `Error de Google Gemini (HTTP ${status || 'N/A'}): ${message || 'Servicio no disponible'}.`
  };
}

/**
 * Robust chat service that communicates with /api/chat on Render/local backend
 * and gracefully falls back to direct client Gemini or the smart multi-turn linguistic engine.
 */
export async function sendChatMessage({
  message,
  targetLang,
  nativeLang,
  level = 'A2/B1',
  apiKey,
  history = []
}) {
  const cleanMsg = (message || '').trim();
  if (!cleanMsg) {
    throw new Error('El mensaje no puede estar vacío.');
  }

  const effectiveKey = (apiKey || '').trim().replace(/^["']|["']$/g, '');
  let lastGeminiError = null;
  let serverCorrection = null;
  let serverCode = null;

  // 1. If user entered Gemini API Key in Settings, call Google Gemini AI directly first (instant, 100% generative AI)
  if (effectiveKey) {
    try {
      const langObj = SUPPORTED_LANGUAGES.find(l => l.code === targetLang) || { name: targetLang, englishName: targetLang };
      const nativeObj = SUPPORTED_LANGUAGES.find(l => l.code === nativeLang) || { name: nativeLang, englishName: nativeLang };
      const targetLanguageName = langObj.englishName || langObj.name;

      const systemInstruction = buildSystemInstruction(targetLanguageName, nativeObj.name, level);
      const dataPrompt = buildDataContextPrompt({
        message: cleanMsg,
        targetLang: targetLanguageName,
        nativeLang: nativeObj.name,
        level,
        history
      });

      let activeModel = 'gemini-2.5-flash';
      const viteEnvModel = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_GEMINI_MODEL) || '';
      // Protect against obsolete models in env
      if (viteEnvModel && !viteEnvModel.includes('1.5') && !viteEnvModel.includes('2.0') && !viteEnvModel.includes('pro')) {
        activeModel = viteEnvModel.trim();
      }

      console.log(`Gemini model selected: ${activeModel}`);

      const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${activeModel}:generateContent?key=${effectiveKey}`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 12000); // 12s timeout

      let directHttpStatus = 0;
      let directGoogleMsg = '';

      try {
        const directRes = await fetch(geminiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({
            contents: [
              {
                role: 'user',
                parts: [{ text: `${systemInstruction}\n\n${dataPrompt}` }]
              }
            ],
            generationConfig: GEMINI_MODEL_CONFIG.generationConfig
          })
        });

        clearTimeout(timeoutId);
        directHttpStatus = directRes.status;

        if (directRes.ok) {
          const resJson = await directRes.json();
          const textContent = resJson?.candidates?.[0]?.content?.parts?.[0]?.text;
          if (textContent) {
            const parsed = cleanAndParseJSON(textContent);
            if (parsed && parsed.user_correction && parsed.bot_response) {
              console.log(`✅ Direct client Gemini responded using [${activeModel}]`);
              return {
                source: `direct_gemini (${activeModel})`,
                data: parsed
              };
            }
          }
        } else {
          const errData = await directRes.json().catch(() => ({}));
          directGoogleMsg = errData?.error?.message || directRes.statusText;
        }
      } catch (candErr) {
        clearTimeout(timeoutId);
        directHttpStatus = candErr.name === 'AbortError' ? 408 : 500;
        directGoogleMsg = candErr.name === 'AbortError' ? 'Network timeout: la solicitud a Google Gemini excedió el tiempo límite.' : candErr.message;
      }

      console.error(`Gemini request failed:\nmodel: ${activeModel}\nHTTP status: ${directHttpStatus}\nGoogle error message: ${directGoogleMsg}`);
      const categorized = categorizeClientGeminiError(directHttpStatus, directGoogleMsg);
      lastGeminiError = categorized.userMessage;
      serverCode = categorized.code;
    } catch (geminiErr) {
      console.warn('Direct Gemini call failed:', geminiErr.message);
    }
  }

  // 2. Try Render Backend API (/api/chat)
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000); // 12s timeout

    const response = await fetch(`${API_BASE_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        message: cleanMsg,
        targetLang,
        nativeLang,
        level,
        apiKey: effectiveKey,
        history: history.slice(-6)
      })
    });

    clearTimeout(timeoutId);

    if (response.ok) {
      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const resData = await response.json();
        if (resData && resData.success && resData.data?.user_correction && resData.data?.bot_response) {
          return {
            source: resData.source || 'server_api',
            data: resData.data
          };
        }
      }
    } else {
      console.warn(`/api/chat responded with status ${response.status}.`);
      const errData = await response.json().catch(() => ({}));
      if (errData?.error) {
        lastGeminiError = errData.error;
      }
      if (errData?.user_correction) {
        serverCorrection = errData.user_correction;
      }
      if (errData?.code) {
        serverCode = errData.code;
      }
    }
  } catch (netErr) {
    console.warn('/api/chat unreachable or timed out:', netErr.message);
  }

  // 3. Gemini is the SOLE generator of conversational responses.
  // When Gemini cannot be reached or no key is provided, NEVER fabricate a bot response.
  // Instead, compute strict deterministic pedagogical corrections for the student's message,
  // and throw a controlled error informing the user.
  console.log('Gemini AI unavailable for conversational response. Computing deterministic linguistics...');
  const deterministicCorrection = serverCorrection || await performFullGrammarCorrection(cleanMsg, targetLang, nativeLang, effectiveKey);
  
  const errorMessage = lastGeminiError || (effectiveKey
    ? 'El motor de conversación de Google Gemini no pudo generar una respuesta. Verifica tu conexión o clave en Ajustes ⚙️.'
    : 'Para conversar con LinguaFlow, ingresa tu API Key de Google Gemini en Ajustes ⚙️ (es gratis en Google AI Studio). Gemini es el motor exclusivo de conversación.');

  const error = new Error(errorMessage);
  error.code = serverCode || (effectiveKey ? 'GEMINI_FAILED' : 'MISSING_API_KEY');
  error.user_correction = deterministicCorrection;
  throw error;
}

/**
 * Lookup a word definition from the backend API (Render)
 */
export async function lookupWordApi(word, targetLang, nativeLang, apiKey = '') {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    const res = await fetch(`${API_BASE_URL}/api/lookup-word`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        word,
        targetLang,
        nativeLang,
        apiKey: (apiKey || '').trim()
      })
    });

    clearTimeout(timeoutId);

    if (res.ok) {
      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const data = await res.json();
        if (data && data.success && data.data) {
          return data.data;
        }
      }
    }
  } catch (err) {
    console.warn('Word lookup API error, using fallback:', err.message);
  }
  return null;
}

/**
 * Fetch supported languages from the backend API (Render)
 */
export async function fetchLanguagesApi() {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    const res = await fetch(`${API_BASE_URL}/api/languages`, {
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (res.ok) {
      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const data = await res.json();
        if (data && data.languages && Array.isArray(data.languages)) {
          return data.languages;
        }
      }
    }
  } catch (err) {
    console.warn('Fetch languages API error, using default list:', err.message);
  }
  return null;
}

/**
 * Transcribe recorded audio using high-precision Multimodal AI (/api/transcribe)
 * Handles strong accents and mixed target + native language speech.
 */
export async function transcribeAudioApi({ audioBlob, targetLang, nativeLang, apiKey }) {
  if (!audioBlob || audioBlob.size === 0) return null;

  try {
    const base64Data = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(audioBlob);
    });

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 14000);

    const res = await fetch(`${API_BASE_URL}/api/transcribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        audioBase64: base64Data,
        mimeType: audioBlob.type || 'audio/webm',
        targetLang,
        nativeLang,
        apiKey: (apiKey || '').trim()
      })
    });

    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      if (data && data.success && data.transcript) {
        return data.transcript.trim();
      }
    } else {
      const err = await res.json().catch(() => ({}));
      console.warn('Audio transcribe endpoint error:', err?.error || res.statusText);
    }
  } catch (err) {
    console.warn('Audio transcribe fetch failed, using Web Speech transcript:', err.message);
  }

  return null;
}

