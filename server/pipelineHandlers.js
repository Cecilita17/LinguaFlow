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

    const systemPromptContent = `You are LinguaFlow AI, a warm, natural, and highly engaging language tutor for spoken voice calls with integrated pedagogical correction.
The student is practicing ${targetName}. Their native language is ${nativeName} and level is ${level}.

CORE PRINCIPLE: CORRECTION AND CONVERSATION ALWAYS COEXIST
Every single utterance by the student MUST be checked for linguistic errors, regardless of conversational intent (normal statements, questions, answers, follow-ups, meta-conversation, clarification requests, requests to repeat, requests to explain something, requests to speak more slowly, reactions, or mixed language).

The communicative intention determines WHAT you say after the correction; it NEVER skips, disables, or suppresses error checking.

DUAL-TASK EXECUTION MATRIX:
1. META-CONVERSATION WITH ERROR (e.g. asking what you said, asking for repetition, or asking meaning, but with language mistakes):
   -> Provide the correction in <correction>...</correction> AND answer/clarify/repeat directly using dialogue context.
2. META-CONVERSATION WITHOUT ERROR:
   -> Answer/clarify/repeat directly and naturally using dialogue context (no <correction> tags).
3. NORMAL CONVERSATION WITH ERROR:
   -> Provide the correction in <correction>...</correction> AND respond naturally with substance/follow-up question to advance the topic.
4. NORMAL CONVERSATION WITHOUT ERROR:
   -> Respond directly and engagingly to advance the topic (no <correction> tags).

CRITICAL PEDAGOGICAL & CONVERSATIONAL RULES:

1. COMPREHENSIVE LINGUISTIC CORRECTION (ON EVERY TURN):
   - Check every user turn for genuine grammatical, conjugation, word-order, agreement, or word-choice errors in ${targetName}, or unintentional code-switching.
   - When an error is present:
     * Reconstruct the complete, grammatically correct sentence in ${targetName} inside <correction>...</correction> tags.
     * Introduce the correction briefly and naturally in ${targetName} (e.g. "Możesz powiedzieć: <correction>...</correction>" or "Forma poprawna: <correction>...</correction>").
     * Then IMMEDIATELY fulfill the communicative intent in ${targetName}.
   - False positive protection: If the utterance is already 100% correct, DO NOT invent artificial corrections. Do not treat natural variants, colloquial speech, or valid cognates/loanwords as errors.

2. FULFILLING COMMUNICATIVE INTENT & CONTEXTUAL RELEVANCE:
   - Always address what the user actually asked or stated:
     * If they ask what you said, why you asked something, or ask to repeat/clarify -> provide the exact answer/clarification directly from conversation context.
     * If they share an opinion, experience, or fact -> react meaningfully to their point.
   - The correction must NEVER replace or suppress the conversational response. Both must coexist seamlessly.

3. ZERO PASSIVE ECHOING:
   - NEVER simply repeat, paraphrase, or parrot what the student just said back to them (e.g. DO NOT say "You went to the cinema. That is nice.").
   - Do not re-state the student's idea outside the <correction> tags.

4. ACTIVE DIALOGUE MOMENTUM:
   - Never end your turn with closed, dead-end phrases (e.g. "Brzmi przyjemnie.", "To ciekawe.", "Rozumiem.", "Qué bien.", "Entendido.", "Sounds nice.", "Interessant.").
   - Advance the dialogue by contributing a fresh perspective/detail or asking an engaging, open-ended question.

5. LANGUAGE & SPOKEN FORMAT:
   - Speak 100% EXCLUSIVELY in ${targetName}. Every word of your response—intros, corrections, answers, and questions—MUST be in ${targetName}. NEVER reply in ${nativeName}.
   - Keep responses CONCISE (1 to 2 spoken sentences, max 3 when including a correction) to maintain agile voice pacing.
   - NEVER output markdown (except <correction> tags), bullet points, emojis, asterisks, or non-speech symbols.
   - NEVER repeat greetings (hello/hi) on ongoing turns.

REPRESENTATIVE EXAMPLES:

- Meta-Question WITH Error (Target Polish, Native Spanish):
  Student: "Możesz powiedzieć jeszcze raz co mówiłaś?"
  AI: "Możesz powiedzieć: <correction>Możesz powtórzyć, co mówiłaś?</correction>. Jasne! Pytałam, jakie filmy lubisz najbardziej oglądać w wolnym czasie."

- Meta-Question WITHOUT Error (Target Polish):
  Student: "Co powiedziałaś przed chwilą?"
  AI: "Pytałam, jakie filmy lubisz najbardziej oglądać w wolnym czasie. Masz swój ulubiony gatunek?"

- Meta-Explanation WITH Error (Target Spanish, Native English):
  Student: "¿Qué significa esa palabra que tu dijiste?"
  AI: "Se dice: <correction>¿Qué significa esa palabra que dijiste?</correction>. Significa preparar comida con anticipación. ¿Sueles cocinar para toda la semana?"

- Normal Statement WITH Error (Target Polish, Native Spanish):
  Student: "Wczoraj ja pójść do kino con mis amigos"
  AI: "Możesz powiedzieć: <correction>Wczoraj poszedłem do kina ze znajomymi</correction>. Jaki film wybraliście?"

- Normal Statement WITH Error (Target German, Native English):
  Student: "Ich habe gestern gegessen ein Pizza"
  AI: "Sag lieber: <correction>Ich habe gestern eine Pizza gegessen</correction>. Hast du sie selbst gebacken oder bestellt?"

- Normal Statement WITHOUT Error (Target Spanish):
  Student: "Me gusta mucho cocinar comida italiana los fines de semana."
  AI: "¡Qué maravilla! La pasta fresca hecha en casa tiene un sabor increíble. ¿Cuál es el plato que mejor te sale?"

- Short Reaction WITHOUT Error + Dynamic Momentum (Target Polish):
  Student: "Zdecydowanie komedie."
  AI: "Dobra komedia to świetny sposób na relaks po całym dniu. Oglądałeś ostatnio coś, co naprawdę cię rozśmieszyło?"`;

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
    const startTime = Date.now();
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
        max_tokens: 1000,
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
    let finalFinishReason = 'stop';

    const processSseLine = (line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith(':')) return;
      if (trimmed === 'data: [DONE]') {
        res.write(`data: ${JSON.stringify({ done: true, finish_reason: finalFinishReason })}\n\n`);
        return;
      }
      if (trimmed.startsWith('data: ')) {
        try {
          const json = JSON.parse(trimmed.slice(6));
          const finishReason = json?.choices?.[0]?.finish_reason;
          if (finishReason) {
            finalFinishReason = finishReason;
          }
          const delta = json?.choices?.[0]?.delta?.content || '';
          if (delta) {
            res.write(`data: ${JSON.stringify({ delta })}\n\n`);
          }
        } catch (e) {}
      }
    };

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        processSseLine(line);
      }
    }

    // Flush any remaining buffer when stream finishes
    buffer += decoder.decode();
    if (buffer.trim()) {
      const remainingLines = buffer.split('\n');
      for (const line of remainingLines) {
        processSseLine(line);
      }
      buffer = '';
    }

    if (finalFinishReason === 'length') {
      console.warn(`[PipelineChatStream] WARNING: Groq generation reached max_tokens limit (finish_reason: length).`);
    } else {
      console.log(`[PipelineChatStream] Groq stream completed normally (finish_reason: ${finalFinishReason}).`);
    }

    const requestId = response.headers.get('x-request-id') || 'no disponible directamente';
    logCostAudit({
      provider: 'groq',
      feature: 'live_call_response',
      model: activeModel,
      requestId,
      inputTokens: 'no disponible directamente (streaming)',
      outputTokens: 'no disponible directamente (streaming)',
      totalTokens: 'no disponible directamente (streaming)',
      durationMs: Date.now() - startTime,
      retry: false,
      streaming: true,
      extra: `history_turns=${boundedHistory.length}, finish_reason=${finalFinishReason}`
    });

    res.write(`data: ${JSON.stringify({ done: true, finish_reason: finalFinishReason })}\n\n`);
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
    const startTime = Date.now();
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
      const fallbackVoiceId = langConfig?.voiceId || DEFAULT_CARTESIA_VOICE_ID;
      // Resilient fallback: if custom voice failed, retry with default voice for targetLang
      if (resolvedVoiceId !== fallbackVoiceId) {
        console.warn(`[BackendPipelineTTS] Custom voice ${resolvedVoiceId} failed (HTTP ${response.status}). Retrying with fallback voice ${fallbackVoiceId}...`);
        try {
          const fallbackResp = await fetch('https://api.cartesia.ai/tts/bytes', {
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
                id: fallbackVoiceId
              },
              output_format: {
                container: 'mp3',
                sample_rate: 44100,
                bit_rate: 128000
              },
              language: resolvedLanguage
            })
          });

          if (fallbackResp.ok) {
            const arrayBuffer = await fallbackResp.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);
            const fallbackReqId = fallbackResp.headers.get('x-request-id') || 'no disponible directamente';
            logCostAudit({
              provider: 'cartesia',
              feature: 'live_call_tts',
              model: cartesiaModel,
              voice: fallbackVoiceId,
              requestId: fallbackReqId,
              characters: cleanText.length,
              durationMs: Date.now() - startTime,
              retry: true,
              streaming: false,
              extra: `bytes=${buffer.length} fallback_from=${resolvedVoiceId} targetLang=${targetLang}`
            });
            console.log('[BackendPipelineTTS] ✓ Fallback Cartesia audio generated OK. Bytes:', buffer.length);
            res.setHeader('Content-Type', 'audio/mpeg');
            res.setHeader('Cache-Control', 'no-cache');
            return res.end(buffer);
          }
        } catch (retryErr) {
          console.error('[BackendPipelineTTS] Fallback retry failed:', retryErr);
        }
      }

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
    const requestId = response.headers.get('x-request-id') || 'no disponible directamente';
    logCostAudit({
      provider: 'cartesia',
      feature: 'live_call_tts',
      model: cartesiaModel,
      voice: resolvedVoiceId,
      requestId,
      characters: cleanText.length,
      durationMs: Date.now() - startTime,
      retry: false,
      streaming: false,
      extra: `bytes=${buffer.length} targetLang=${targetLang}`
    });
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

/**
 * Curated catalog of default known Cartesia voices for offline/fallback mode.
 */
export const DEFAULT_CARTESIA_CATALOG = [
  {
    id: 'db6b0ed5-d5d3-463d-ae85-518a07d3c2b4',
    name: 'Skylar (Multilingual Friendly Guide)',
    language: 'multilingual',
    is_owner: false,
    gender: 'female',
    description: 'Voz oficial clara y cálida recomendada para aprendizaje'
  },
  {
    id: 'a249eaff-1e96-4d2c-b23b-12efa4f66f41',
    name: 'Jacqueline (French Native)',
    language: 'fr',
    is_owner: false,
    gender: 'female',
    description: 'Voz nativa francesa conversacional'
  },
  {
    id: '694f9389-aac1-45b6-b726-9d9369183238',
    name: 'Sarah (Conversational English)',
    language: 'en',
    is_owner: false,
    gender: 'female',
    description: 'Voz natural en inglés con entonación expresiva'
  },
  {
    id: '87748186-23bb-4147-a173-2224b806680d',
    name: 'Pedro (Spanish Conversational)',
    language: 'es',
    is_owner: false,
    gender: 'male',
    description: 'Voz conversacional en español con tono amigable'
  }
];

/**
 * List Cartesia Voices endpoint (securely queried from backend).
 * Returns available cloned & public voices with safe metadata.
 */
export async function handleListCartesiaVoices(req, res) {
  setCorsHeaders(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  const rawKey = process.env.CARTESIA_API_KEY;
  const trimmedKey = (rawKey || '').trim();

  // If no API key, return default catalog and mapping
  if (!trimmedKey) {
    return res.status(200).json({
      success: true,
      hasApiKey: false,
      voices: DEFAULT_CARTESIA_CATALOG,
      defaults: CARTESIA_VOICES
    });
  }

  try {
    const response = await fetch('https://api.cartesia.ai/voices', {
      method: 'GET',
      headers: {
        'X-API-Key': trimmedKey,
        'Cartesia-Version': '2026-08-14',
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      console.warn(`[BackendPipelineVoices] Cartesia returned HTTP ${response.status}. Falling back to default catalog.`);
      return res.status(200).json({
        success: true,
        hasApiKey: true,
        voices: DEFAULT_CARTESIA_CATALOG,
        defaults: CARTESIA_VOICES,
        warning: `Cartesia API returned HTTP ${response.status}`
      });
    }

    const json = await response.json();
    const rawVoices = Array.isArray(json) ? json : (Array.isArray(json?.data) ? json.data : []);

    // Sanitize and extract only safe metadata
    const sanitizedVoices = rawVoices.map(v => {
      const isOwner = Boolean(v.is_owner || v.isOwner || v.visibility === 'owner' || v.access === 'private');
      let lang = v.language || '';
      if (!lang && Array.isArray(v.accents) && v.accents.length > 0) {
        lang = v.accents[0]?.locale || v.accents[0]?.language || '';
      }
      return {
        id: v.id,
        name: v.name || 'Voz de Cartesia',
        description: v.description || v.tagline || '',
        language: lang,
        is_owner: isOwner,
        gender: v.gender || 'neutral',
        status: v.status || 'active'
      };
    }).filter(v => Boolean(v.id && UUID_REGEX.test(v.id)));

    // Merge in default catalog if missing
    const existingIds = new Set(sanitizedVoices.map(v => v.id));
    const mergedVoices = [...sanitizedVoices];
    for (const defVoice of DEFAULT_CARTESIA_CATALOG) {
      if (!existingIds.has(defVoice.id)) {
        mergedVoices.push(defVoice);
        existingIds.add(defVoice.id);
      }
    }

    return res.status(200).json({
      success: true,
      hasApiKey: true,
      voices: mergedVoices,
      defaults: CARTESIA_VOICES
    });

  } catch (err) {
    console.error('[BackendPipelineVoices] Error querying Cartesia voices:', err);
    return res.status(200).json({
      success: true,
      hasApiKey: true,
      voices: DEFAULT_CARTESIA_CATALOG,
      defaults: CARTESIA_VOICES,
      warning: 'Fallback used due to network error'
    });
  }
}
