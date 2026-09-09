export const API_BASE_URL = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_BASE_URL)
  || (typeof process !== 'undefined' && process.env && process.env.API_BASE_URL)
  || (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') ? '' : (typeof window === 'undefined' ? 'http://localhost:3001' : 'https://linguaflow-fef0.onrender.com'));

import { performFullGrammarCorrection } from './grammarEngine.js';

export function categorizeClientGroqError(status, message) {
  const msgLower = (message || '').toLowerCase();

  // 1. Invalid API Key
  if (status === 401 || status === 403 || msgLower.includes('invalid api key') || msgLower.includes('invalid_api_key') || msgLower.includes('unauthorized')) {
    return {
      type: 'invalid API key',
      code: 'INVALID_API_KEY',
      userMessage: 'Clave API de Groq inválida o no autorizada. Por favor verifica la variable GROQ_API_KEY en el backend.'
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
  if (status === 429 || msgLower.includes('rate limit') || msgLower.includes('rate_limit_exceeded') || msgLower.includes('tokens per minute')) {
    return {
      type: 'quota/rate limit',
      code: 'RATE_LIMIT_EXCEEDED',
      userMessage: 'Límite de solicitudes o tokens por minuto alcanzado en Groq (HTTP 429). Espera unos segundos antes de volver a enviar.'
    };
  }

  // 4. Network timeout
  if (status === 408 || msgLower.includes('timeout') || msgLower.includes('aborted') || msgLower.includes('aborterror')) {
    return {
      type: 'network timeout',
      code: 'NETWORK_TIMEOUT',
      userMessage: 'Tiempo de espera agotado al conectar con el servidor. Revisa tu conexión a internet.'
    };
  }

  // 5. Server error
  if (status >= 500) {
    return {
      type: 'server error',
      code: 'GROQ_SERVER_ERROR',
      userMessage: `Error del servidor de Groq (HTTP ${status}): ${message}.`
    };
  }

  return {
    type: 'server error',
    code: 'GROQ_ERROR',
    userMessage: `Error al conectar con Groq (HTTP ${status || 'N/A'}): ${message || 'Servicio no disponible'}.`
  };
}

/**
 * Robust chat service that communicates with /api/chat backend API.
 * GROQ_API_KEY is securely kept strictly on the backend/server and never exposed to the frontend.
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
  let lastAIError = null;
  let serverCorrection = null;
  let serverCode = null;

  // 1. Communicate with Backend API (/api/chat)
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout

    const headers = { 'Content-Type': 'application/json' };
    if (effectiveKey) {
      headers['x-api-key'] = effectiveKey;
    }

    const response = await fetch(`${API_BASE_URL}/api/chat`, {
      method: 'POST',
      headers,
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
            source: resData.source || 'groq (openai/gpt-oss-120b)',
            data: resData.data
          };
        }
      }
    } else {
      console.warn(`/api/chat responded with status ${response.status}.`);
      const errData = await response.json().catch(() => ({}));
      if (errData?.error) {
        lastAIError = errData.error;
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
    lastAIError = netErr.name === 'AbortError'
      ? 'Network timeout: el servidor de LinguaFlow tardó demasiado en responder.'
      : 'No se pudo conectar con el servidor de LinguaFlow.';
    serverCode = netErr.name === 'AbortError' ? 'NETWORK_TIMEOUT' : 'SERVER_UNREACHABLE';
  }

  // 2. AI is the SOLE generator of conversational responses.
  // When AI cannot be reached or backend reports error, NEVER fabricate a bot response.
  // Instead, compute strict deterministic pedagogical corrections for the student's message,
  // and throw a controlled error informing the user.
  console.log('Conversational AI unavailable. Computing deterministic linguistics...');
  const deterministicCorrection = serverCorrection || await performFullGrammarCorrection(cleanMsg, targetLang, nativeLang);

  const errorMessage = lastAIError || 'Para conversar con LinguaFlow, configura la variable GROQ_API_KEY en el servidor.';

  const error = new Error(errorMessage);
  error.code = serverCode || 'AI_FAILED';
  error.user_correction = deterministicCorrection;
  throw error;
}

/**
 * Lookup a word definition from the backend API
 */
export async function lookupWordApi(word, targetLang, nativeLang, apiKey = '') {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    const headers = { 'Content-Type': 'application/json' };
    const effectiveKey = (apiKey || '').trim().replace(/^["']|["']$/g, '');
    if (effectiveKey) headers['x-api-key'] = effectiveKey;

    const res = await fetch(`${API_BASE_URL}/api/lookup-word`, {
      method: 'POST',
      headers,
      signal: controller.signal,
      body: JSON.stringify({
        word,
        targetLang,
        nativeLang,
        apiKey: effectiveKey
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
 * Fetch supported languages from the backend API
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
 * Transcribe recorded audio using Groq Whisper (/api/transcribe) on the backend
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

    const headers = { 'Content-Type': 'application/json' };
    const effectiveKey = (apiKey || '').trim().replace(/^["']|["']$/g, '');
    if (effectiveKey) headers['x-api-key'] = effectiveKey;

    const res = await fetch(`${API_BASE_URL}/api/transcribe`, {
      method: 'POST',
      headers,
      signal: controller.signal,
      body: JSON.stringify({
        audioBase64: base64Data,
        mimeType: audioBlob.type || 'audio/webm',
        targetLang,
        nativeLang,
        apiKey: effectiveKey
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

