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
    const formattedMessages = [
      {
        role: 'system',
        content: `You are LinguaFlow AI, a natural, cheerful, and engaging language tutor for spoken voice calls.
The student is practicing ${targetName}. Their native language is ${nativeName} and level is ${level}.

CRITICAL SPOKEN CONVERSATION RULES:
1. Speak EXCLUSIVELY in ${targetName}, using natural spoken phrasing suitable for oral conversation.
2. Keep your answer CONCISE (1 to 2 spoken sentences maximum) to keep the voice call interactive.
3. Respond directly to the student's thought, comment, or question.
4. NEVER output markdown, asterisks, bullet points, numbers, emoji, or non-speech symbols.
5. NEVER repeat hello/greetings on every turn. Dive directly into natural spoken conversation.`
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
 * Streaming TTS Synthesis Endpoint for Pipeline Calls.
 * Streams OpenAI tts-1 audio chunks directly to the client with low latency.
 *
 * Diagnostic logging:
 *   - Logs whether OPENAI_API_KEY is set, its length, and the first 7 characters.
 *   - On OpenAI error: logs upstream HTTP status, Content-Type, and full error body.
 *   - NEVER logs or returns the full API key.
 */
export async function handlePipelineTTS(req, res) {
  setCorsHeaders(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const body = parseRequestBody(req);
    const {
      text = '',
      voice = 'alloy',
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

    // ── Key diagnostics (safe: never log full key) ──────────────────────
    const rawKey = process.env.OPENAI_API_KEY;
    const trimmedKey = (rawKey || '').trim();
    const hasKey = trimmedKey.length > 0;
    const keyLen = trimmedKey.length;
    const keyPrefix = hasKey ? trimmedKey.slice(0, 7) : '(none)';

    console.log(
      '[BackendPipelineTTS] Request received.',
      'Text length:', cleanText.length,
      'Voice:', voice,
      'Has OPENAI_API_KEY:', hasKey,
      'Key length:', keyLen,
      'Key prefix:', keyPrefix
    );

    if (!hasKey) {
      console.warn('[BackendPipelineTTS] OPENAI_API_KEY is MISSING or EMPTY in process.env');
      return res.status(500).json({
        error: 'Falta OPENAI_API_KEY en el servidor para síntesis TTS.',
        upstream: 'self',
        status: 500,
        details: 'OPENAI_API_KEY environment variable is not set on the server.'
      });
    }

    // ── Call OpenAI TTS-1 API ───────────────────────────────────────────
    const response = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${trimmedKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'tts-1',
        voice: voice || 'alloy',
        input: cleanText,
        response_format: 'mp3',
        speed: 1.0
      })
    });

    const upstreamContentType = response.headers.get('content-type') || '';

    console.log(
      '[BackendPipelineTTS] OpenAI response:',
      'HTTP', response.status,
      'Content-Type:', upstreamContentType
    );

    if (!response.ok) {
      // Read full error body for server-side diagnostics
      const errText = await response.text();
      console.warn(
        '[BackendPipelineTTS] ⚠ OpenAI TTS REJECTED.',
        'HTTP status:', response.status,
        'Content-Type:', upstreamContentType,
        'Error body:', errText,
        '| Key info — present:', hasKey, 'len:', keyLen, 'prefix:', keyPrefix
      );

      // Parse error JSON if possible for richer details
      let parsedDetails = errText;
      try {
        const parsed = JSON.parse(errText);
        parsedDetails = parsed.error?.message || parsed.error || errText;
      } catch (_) { /* keep raw text */ }

      return res.status(response.status).json({
        error: 'Error al sintetizar voz (upstream OpenAI)',
        upstream: 'openai',
        status: response.status,
        details: parsedDetails
      });
    }

    // ── Stream audio buffer directly to client ──────────────────────────
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    console.log('[BackendPipelineTTS] ✓ Audio generated OK. Bytes:', buffer.length);

    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Cache-Control', 'no-cache');
    res.end(buffer);

  } catch (err) {
    console.error('[BackendPipelineTTS] Server error in /api/pipeline/tts:', err);
    if (!res.headersSent) {
      res.status(500).json({
        error: 'Error interno en síntesis TTS',
        upstream: 'self',
        status: 500,
        details: err.message
      });
    }
  }
}
