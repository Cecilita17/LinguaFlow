// server/realtimeHandlers.js
// Handles server-side ephemeral token generation for OpenAI Realtime WebRTC calls
import dotenv from 'dotenv';

dotenv.config();

const LANGUAGE_NAMES = {
  pl: 'Polaco (Polish)',
  zh: 'Chino Mandarín (Mandarin Chinese)',
  ar: 'Árabe (Arabic)',
  ru: 'Ruso (Russian)',
  nl: 'Neerlandés (Dutch)',
  de: 'Alemán (German)',
  it: 'Italiano (Italian)',
  pt: 'Portugués (Portuguese)',
  fr: 'Francés (French)',
  en: 'Inglés (English)',
  ja: 'Japonés (Japanese)',
  ko: 'Coreano (Korean)',
  es: 'Español (Spanish)'
};

export function setCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
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

/**
 * Generates an ephemeral session for OpenAI Realtime WebRTC API.
 * The secret OPENAI_API_KEY remains safely on the backend server.
 */
export async function handleRealtimeSession(req, res) {
  setCorsHeaders(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey || !apiKey.trim()) {
      return res.status(400).json({
        error: 'Falta configurar OPENAI_API_KEY en el backend (.env) para habilitar llamadas de voz en tiempo real.'
      });
    }

    const {
      targetLang = 'es',
      nativeLang = 'es',
      level = 'A2/B1'
    } = parseRequestBody(req);

    const targetLangName = LANGUAGE_NAMES[targetLang] || targetLang;
    const nativeLangName = LANGUAGE_NAMES[nativeLang] || nativeLang;

    const pedagogicalInstructions = `You are LinguaFlow AI, a warm, patient, and conversational language tutor for spoken practice.
The user is learning ${targetLangName}. Their native language is ${nativeLangName} and their proficiency level is ${level}.

Key Conversational Rules:
1. Speak exclusively or primarily in ${targetLangName}, using natural spoken phrasing suitable for a voice call.
2. Keep your turns concise (1 to 3 spoken sentences) to encourage back-and-forth dialogue. Do not give long lectures or monologues.
3. If the user makes a clear mistake or asks for clarification, give a brief, friendly correction or tip, then keep the conversation going with an open-ended question.
4. Adapt your vocabulary to the user's level (${level}).
5. Sound cheerful, warm, and natural as if speaking on a phone call.`;

    const response = await fetch('https://api.openai.com/v1/realtime/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey.trim()}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4o-realtime-preview',
        modalities: ['audio', 'text'],
        voice: 'cedar',
        instructions: pedagogicalInstructions,
        turn_detection: {
          type: 'server_vad',
          threshold: 0.5,
          prefix_padding_ms: 300,
          silence_duration_ms: 500
        },
        input_audio_transcription: {
          model: 'whisper-1'
        }
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('❌ OpenAI Realtime Session Error:', data);
      return res.status(response.status).json({
        error: data.error?.message || 'Error al solicitar sesión efímera a OpenAI Realtime API'
      });
    }

    return res.json(data);
  } catch (err) {
    console.error('❌ Server error creating realtime session:', err);
    return res.status(500).json({
      error: err.message || 'Error interno del servidor al crear sesión de llamada realtime'
    });
  }
}
