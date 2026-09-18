// server/pipelineHandlers.js
// Dedicated handlers for Low-Cost Voice Pipeline (STT -> Streaming LLM -> Streaming TTS)
import dotenv from 'dotenv';
import { SUPPORTED_LANGUAGES } from './languageData.js';

dotenv.config();

function setCorsHeaders(res) {
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

const PRIMARY_GROQ_MODEL = 'openai/gpt-oss-120b';
const GROQ_MODEL_ID_REGEX = /^[a-zA-Z0-9_./-]+$/;

export function getSanitizedGroqModel() {
  const envModel = (process.env.GROQ_MODEL || '').trim().replace(/^["']|["']$/g, '');
  if (envModel && GROQ_MODEL_ID_REGEX.test(envModel)) {
    return envModel;
  }
  return PRIMARY_GROQ_MODEL;
}

/**
 * Streaming LLM Conversational Endpoint for Pipeline Calls.
 * Streams text delta tokens in real-time via Server-Sent Events (SSE).
 * Bounded history (last 6 turns) guarantees fixed-cost, long-duration practice.
 */
export async function handlePipelineChatStream(req, res) {
  setCorsHeaders(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const body = parseRequestBody(req);
    const {
      message = '',
      history = [],
      targetLang = 'es',
      nativeLang = 'es',
      level = 'A2/B1',
      pipelineMode = 'current',
      apiKey: clientApiKey
    } = body;

    const rawMessage = (message || '').trim();
    if (!rawMessage) {
      return res.status(400).json({ error: 'El mensaje no puede estar vacío.' });
    }

    const effectiveApiKey = (
      process.env.GROQ_API_KEY ||
      (clientApiKey?.startsWith('gsk_') ? clientApiKey : '') ||
      (req.headers?.['x-api-key'] || '')
    ).trim().replace(/^[\"']|[\"']$/g, '');

    const activeModel = getSanitizedGroqModel();
    const langObj = SUPPORTED_LANGUAGES.find(l => l.code === targetLang) || { name: targetLang, englishName: targetLang };
    const nativeObj = SUPPORTED_LANGUAGES.find(l => l.code === nativeLang) || { name: nativeLang, englishName: nativeLang };
    const targetName = langObj.englishName || langObj.name;
    const nativeName = nativeObj.englishName || nativeObj.name;

    // Bounded dialogue history: maximum last 6 turns to keep context window tight
    const boundedHistory = Array.isArray(history) ? history.slice(-6) : [];

    const isIntegratedMode = pipelineMode === 'integrated';

    const systemPromptContent = isIntegratedMode
      ? `You are LinguaFlow AI, a natural, engaging language tutor for spoken voice calls with integrated pedagogical correction.
The student is practicing ${targetName}. Their native language is ${nativeName} and level is ${level}.

CRITICAL SPOKEN CONVERSATION & INTEGRATED CORRECTION RULES:
1. Speak EXCLUSIVELY in ${targetName}, using natural spoken phrasing suitable for oral conversation.
2. Keep your answer CONCISE (1 to 2 spoken sentences maximum) to keep the voice call interactive.
3. Understand the student's full intended meaning, even if they mix languages (code-switch) or make grammatical mistakes.
4. INTEGRATED PEDAGOGICAL CORRECTION:
   - If the student made grammatical errors, conjugation mistakes, wrong word choices, or inserted foreign/native words:
     * Reconstruct the COMPLETE, natural, grammatically correct sentence in ${targetName} that expresses the student's intended thought.
     * Enclose ONLY that complete reconstructed sentence in <correction>...</correction> tags within your natural response.
     * Example: Student says "czekam una solucion", you say: "Możesz powiedzieć: <correction>czekam na rozwiązanie</correction>. A czego dokładnie potrzebujesz?"
     * Example: Student says "Ja być w domu", you say: "Rozumiem, <correction>jestem w domu</correction>. ¿Qué estás haciendo hoy?"
     * Example: Student says "Ich glaube que mañana voy a trabajar", you say: "Entiendo, <correction>ich glaube, dass ich morgen arbeiten werde</correction>. ¿A qué hora comienzas?"
   - If the student's input was already 100% correct in ${targetName} without any foreign words or mistakes:
     * Respond directly, warmly, and naturally to the topic.
     * DO NOT use <correction> tags. DO NOT invent an artificial correction.
5. NEVER output markdown (except the <correction> tags), bullet points, numbers, emoji, or non-speech symbols.
6. NEVER repeat hello/greetings on every turn. Dive directly into natural spoken conversation.`
      : `You are LinguaFlow AI, a natural, cheerful, and engaging language tutor for spoken voice calls.
The student is practicing ${targetName}. Their native language is ${nativeName} and level is ${level}.

CRITICAL SPOKEN CONVERSATION RULES:
1. Speak EXCLUSIVELY in ${targetName}, using natural spoken phrasing suitable for oral conversation.
2. If the student speaks in English, Spanish, or another language, or mixes languages, understand their meaning completely, but ALWAYS reply strictly in ${targetName} to maintain immersive language practice.
3. Keep your answer CONCISE (1 to 2 spoken sentences maximum) to keep the voice call interactive.
4. Respond directly to the student's thought, comment, or question.
5. NEVER output markdown, asterisks, bullet points, numbers, emoji, or non-speech symbols.
6. NEVER repeat hello/greetings on every turn. Dive directly into natural spoken conversation.`;

    const formattedMessages = [
      {
        role: 'system',
        content: systemPromptContent
      }
    ];

    boundedHistory.forEach(item => {
      const role = item.sender === 'user' ? 'user' : 'assistant';
      const text = item.text || item.correctedText || '';
      if (text.trim()) {
        formattedMessages.push({ role, content: text.trim() });
      }
    });

    formattedMessages.push({ role: 'user', content: rawMessage });

    if (!effectiveApiKey) {
      // Offline fallback: respond with a deterministic spoken answer
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.write(`data: ${JSON.stringify({ delta: '¡Entendido! Continuemos practicando la conversación.' })}\n\n`);
      res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
      return res.end();
    }

    // Connect to Groq streaming API
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${effectiveApiKey}`
      },
      body: JSON.stringify({
        model: activeModel,
        messages: formattedMessages,
        temperature: 0.6,
        max_tokens: 350,
        stream: true
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      console.warn('Groq chat-stream error HTTP', response.status, errText);
      return res.status(response.status).json({ error: 'Error en Groq chat-stream', details: errText });
    }

    // Set SSE Headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith(':')) continue;
        if (trimmed === 'data: [DONE]') {
          res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
          continue;
        }
        if (trimmed.startsWith('data: ')) {
          try {
            const json = JSON.parse(trimmed.slice(6));
            const delta = json?.choices?.[0]?.delta?.content || '';
            if (delta) {
              res.write(`data: ${JSON.stringify({ delta })}\n\n`);
            }
          } catch (e) {}
        }
      }
    }

    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();

  } catch (err) {
    console.error('Server error in /api/pipeline/chat-stream:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Error interno en chat-stream' });
    } else {
      res.end();
    }
  }
}

/**
 * Official Cartesia Sonic Multilingual Voice Mapping.
 * Cartesia Sonic models (sonic-3.6, sonic-multilingual) natively support 40+ languages.
 * We provide curated, high-quality conversational voices per language while allowing
 * overrides via CARTESIA_VOICE_ID or client-provided UUID.
 */
export const CARTESIA_VOICES = {
  // English (Skylar / Friendly Guide)
  en: { voiceId: 'db6b0ed5-d5d3-463d-ae85-518a07d3c2b4', language: 'en' },
  // Spanish (Multilingual Warm Conversational)
  es: { voiceId: 'db6b0ed5-d5d3-463d-ae85-518a07d3c2b4', language: 'es' },
  // French (Conversational French / Multilingual)
  fr: { voiceId: 'a249eaff-1e96-4d2c-b23b-12efa4f66f41', language: 'fr' },
  // German (Multilingual)
  de: { voiceId: 'db6b0ed5-d5d3-463d-ae85-518a07d3c2b4', language: 'de' },
  // Italian (Multilingual)
  it: { voiceId: 'db6b0ed5-d5d3-463d-ae85-518a07d3c2b4', language: 'it' },
  // Portuguese (Multilingual)
  pt: { voiceId: 'db6b0ed5-d5d3-463d-ae85-518a07d3c2b4', language: 'pt' },
  // Russian (Multilingual)
  ru: { voiceId: 'db6b0ed5-d5d3-463d-ae85-518a07d3c2b4', language: 'ru' },
  // Polish (Multilingual)
  pl: { voiceId: 'db6b0ed5-d5d3-463d-ae85-518a07d3c2b4', language: 'pl' },
  // Dutch (Multilingual)
  nl: { voiceId: 'db6b0ed5-d5d3-463d-ae85-518a07d3c2b4', language: 'nl' },
  // Turkish (Multilingual)
  tr: { voiceId: 'db6b0ed5-d5d3-463d-ae85-518a07d3c2b4', language: 'tr' },
  // Mandarin Chinese (Multilingual)
  zh: { voiceId: 'db6b0ed5-d5d3-463d-ae85-518a07d3c2b4', language: 'zh' },
  // Arabic (Multilingual)
  ar: { voiceId: 'db6b0ed5-d5d3-463d-ae85-518a07d3c2b4', language: 'ar' },
  // Japanese (Multilingual)
  ja: { voiceId: 'db6b0ed5-d5d3-463d-ae85-518a07d3c2b4', language: 'ja' },
  // Korean (Multilingual)
  ko: { voiceId: 'db6b0ed5-d5d3-463d-ae85-518a07d3c2b4', language: 'ko' }
};

const DEFAULT_CARTESIA_VOICE_ID = 'db6b0ed5-d5d3-463d-ae85-518a07d3c2b4';
const DEFAULT_CARTESIA_MODEL = 'sonic-3.6';
const UUID_REGEX = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

/**
 * Streaming TTS Synthesis Endpoint for Pipeline Calls (Cartesia Sonic).
 * Streams Cartesia Sonic audio chunks directly to the client with ultra-low latency.
 *
 * Model selection:
 *   - Uses process.env.CARTESIA_MODEL if set (e.g. 'sonic-3.6', 'sonic-multilingual').
 *   - Defaults to 'sonic-3.6' (Cartesia recommended multilingual model).
 *
 * Voice selection:
 *   - Uses client-provided UUID if valid.
 *   - Maps targetLang to CARTESIA_VOICES[targetLang].
 *   - Uses process.env.CARTESIA_VOICE_ID if configured.
 *   - Defaults to DEFAULT_CARTESIA_VOICE_ID.
 *
 * Diagnostic logging:
 *   - Logs model, voice ID, target language, and safe key diagnostics (length, prefix 7 chars).
 *   - On Cartesia error: logs upstream HTTP status, Content-Type, and full error body.
 *   - NEVER logs or returns the full API key.
 */
export async function handlePipelineTTS(req, res) {
  setCorsHeaders(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const body = parseRequestBody(req);
    const {
      text = '',
      voice = '',
      targetLang = 'es'
    } = body;

    const cleanText = (text || '').trim();
    if (!cleanText) {
      return res.status(400).json({
        error: 'El texto a sintetizar no puede estar vacío.',
        upstream: 'self',
        status: 400,
        details: 'Empty text'
      });
    }

    // ── Model & Voice Resolution ─────────────────────────────────────────
    const cartesiaModel = (process.env.CARTESIA_MODEL || '').trim() || DEFAULT_CARTESIA_MODEL;
    const langConfig = CARTESIA_VOICES[targetLang] || CARTESIA_VOICES['es'];
    const resolvedLanguage = langConfig.language || targetLang || 'es';

    let resolvedVoiceId = DEFAULT_CARTESIA_VOICE_ID;
    if (voice && UUID_REGEX.test(voice.trim())) {
      resolvedVoiceId = voice.trim();
    } else if (langConfig && langConfig.voiceId) {
      resolvedVoiceId = langConfig.voiceId;
    } else if (process.env.CARTESIA_VOICE_ID && UUID_REGEX.test(process.env.CARTESIA_VOICE_ID.trim())) {
      resolvedVoiceId = process.env.CARTESIA_VOICE_ID.trim();
    }

    // ── Key diagnostics (safe: never log full key) ───────────────────────
    const rawKey = process.env.CARTESIA_API_KEY;
    const trimmedKey = (rawKey || '').trim();
    const hasKey = trimmedKey.length > 0;
    const keyLen = trimmedKey.length;
    const keyPrefix = hasKey ? trimmedKey.slice(0, 7) : '(none)';

    console.log(
      '[BackendPipelineTTS] (Cartesia) Request received.',
      'Text length:', cleanText.length,
      'TargetLang:', targetLang,
      'Cartesia language:', resolvedLanguage,
      'Model:', cartesiaModel,
      'Voice ID:', resolvedVoiceId,
      'Has CARTESIA_API_KEY:', hasKey,
      'Key length:', keyLen,
      'Key prefix:', keyPrefix
    );

    if (!hasKey) {
      console.warn('[BackendPipelineTTS] CARTESIA_API_KEY is MISSING or EMPTY in process.env');
      return res.status(500).json({
        error: 'Falta CARTESIA_API_KEY en el servidor para síntesis TTS.',
        upstream: 'self',
        status: 500,
        details: 'CARTESIA_API_KEY environment variable is not set on the server.'
      });
    }

    // ── Call Cartesia TTS API ────────────────────────────────────────────
    const response = await fetch('https://api.cartesia.ai/tts/bytes', {
      method: 'POST',
      headers: {
        'X-API-Key': trimmedKey,
        'Cartesia-Version': '2026-08-14',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model_id: cartesiaModel,
        transcript: cleanText,
        voice: {
          mode: 'id',
          id: resolvedVoiceId
        },
        output_format: {
          container: 'mp3',
          sample_rate: 44100,
          bit_rate: 128000
        },
        language: resolvedLanguage
      })
    });

    const upstreamContentType = response.headers.get('content-type') || '';

    console.log(
      '[BackendPipelineTTS] Cartesia response:',
      'HTTP', response.status,
      'Content-Type:', upstreamContentType,
      'Model:', cartesiaModel
    );

    if (!response.ok) {
      // Read full error body for server-side diagnostics
      const errText = await response.text();
      console.warn(
        '[BackendPipelineTTS] ⚠ Cartesia TTS REJECTED.',
        'HTTP status:', response.status,
        'Content-Type:', upstreamContentType,
        'Model used:', cartesiaModel,
        'Voice ID:', resolvedVoiceId,
        'Language:', resolvedLanguage,
        'Error body:', errText,
        '| Key info — present:', hasKey, 'len:', keyLen, 'prefix:', keyPrefix
      );

      // Parse error JSON if possible for richer details
      let parsedDetails = errText;
      try {
        const parsed = JSON.parse(errText);
        parsedDetails = parsed.error?.message || parsed.error || parsed.message || errText;
      } catch (_) { /* keep raw text */ }

      return res.status(response.status).json({
        error: `Error al sintetizar voz (upstream Cartesia, model: ${cartesiaModel})`,
        upstream: 'cartesia',
        status: response.status,
        model: cartesiaModel,
        voice: resolvedVoiceId,
        details: parsedDetails
      });
    }

    // ── Stream audio buffer directly to client ───────────────────────────
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    console.log('[BackendPipelineTTS] ✓ Cartesia audio generated OK. Bytes:', buffer.length, 'Model:', cartesiaModel, 'Voice:', resolvedVoiceId);

    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Cache-Control', 'no-cache');
    res.end(buffer);

  } catch (err) {
    console.error('[BackendPipelineTTS] Server error in /api/pipeline/tts:', err);
    if (!res.headersSent) {
      res.status(500).json({
        error: 'Error interno en síntesis TTS (Cartesia)',
        upstream: 'self',
        status: 500,
        details: err.message
      });
    }
  }
}
