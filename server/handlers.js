import dotenv from 'dotenv';
import { getSystemPrompt } from './promptTemplates.js';
import { SUPPORTED_LANGUAGES } from './languageData.js';
import { processSmartConversation } from './conversationEngine.js';

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

// Priority list of Gemini models to try (Google Generative AI v1beta)
const MODEL_CANDIDATES = [
  'gemini-2.5-flash',
  'gemini-2.0-flash',
  'gemini-1.5-flash',
  'gemini-1.5-pro',
  'gemini-2.0-flash-lite'
];

let discoveredModel = null;

async function getBestGeminiModel(apiKey) {
  if (discoveredModel) return discoveredModel;

  try {
    const listRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
    if (listRes.ok) {
      const data = await listRes.json();
      const availableNames = (data.models || [])
        .filter(m => m.supportedGenerationMethods?.includes('generateContent'))
        .map(m => m.name.replace(/^models\//, ''));

      console.log('Available models for this key:', availableNames);

      for (const cand of MODEL_CANDIDATES) {
        if (availableNames.includes(cand)) {
          discoveredModel = cand;
          console.log(`Auto-selected Gemini model: ${discoveredModel}`);
          return discoveredModel;
        }
      }

      if (availableNames.length > 0) {
        discoveredModel = availableNames[0];
        return discoveredModel;
      }
    }
  } catch (e) {
    console.warn('Error fetching model list:', e.message);
  }

  return 'gemini-2.5-flash';
}

/**
 * Robust JSON extractor from model text
 */
function cleanAndParseJSON(rawText) {
  if (!rawText) return null;

  // 1. Direct parse attempt
  try {
    return JSON.parse(rawText);
  } catch (e) {}

  // 2. Remove markdown code blocks if any
  let cleaned = rawText.replace(/```json\s*/gi, '').replace(/```\s*$/gi, '').trim();
  try {
    return JSON.parse(cleaned);
  } catch (e) {}

  // 3. Extract JSON object with regex
  const match = cleaned.match(/\{[\s\S]*\}/);
  if (match) {
    try {
      return JSON.parse(match[0]);
    } catch (e) {}
  }

  // 4. Try basic truncation recovery
  if (cleaned.startsWith('{')) {
    let repaired = cleaned;
    // Close missing string
    const quoteCount = (repaired.match(/"/g) || []).length;
    if (quoteCount % 2 !== 0) repaired += '"';

    // Count open braces
    const openBraces = (repaired.match(/\{/g) || []).length;
    const closeBraces = (repaired.match(/\}/g) || []).length;
    for (let i = 0; i < openBraces - closeBraces; i++) {
      repaired += '}';
    }

    try {
      return JSON.parse(repaired);
    } catch (e) {}
  }

  return null;
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

    const effectiveApiKey = (clientApiKey || process.env.GEMINI_API_KEY || '').trim();

    // 1. Call Google Gemini AI
    if (effectiveApiKey) {
      try {
        const langObj = SUPPORTED_LANGUAGES.find(l => l.code === targetLang) || { name: targetLang, englishName: targetLang };
        const nativeObj = SUPPORTED_LANGUAGES.find(l => l.code === nativeLang) || { name: nativeLang, englishName: nativeLang };
        const targetLanguageName = langObj.englishName || langObj.name;
        const systemPrompt = getSystemPrompt(targetLanguageName, nativeObj.name, level);

        const activeModel = await getBestGeminiModel(effectiveApiKey);

        // Build conversational history
        const contents = [
          { role: 'user', parts: [{ text: systemPrompt }] },
          { role: 'model', parts: [{ text: '{"status":"ready"}' }] }
        ];

        history.slice(-4).forEach(h => {
          if (h.sender === 'user') {
            contents.push({ role: 'user', parts: [{ text: h.correctedText || h.text }] });
          } else if (h.sender === 'bot') {
            contents.push({ role: 'model', parts: [{ text: h.text }] });
          }
        });

        contents.push({
          role: 'user',
          parts: [{
            text: `Student message in ${targetLanguageName}: "${message.trim()}".
Please:
1. Correct errors in "user_correction" with "diff_tokens" (words changed have "changed": true and "original": "...").
2. Give a brief, natural response in ${targetLanguageName} (1-3 sentences) suitable for level ${level}.
3. Provide translation in ${nativeObj.name}.
4. Provide tokens (compounds for Chinese) and 2-3 key vocabulary words.
Return strictly valid JSON.`
          }]
        });

        // Try active model first, then fallback models if 503/404 occurs
        const tryList = [activeModel, ...MODEL_CANDIDATES.filter(m => m !== activeModel)];
        const tried = new Set();

        for (const model of tryList) {
          if (tried.has(model)) continue;
          tried.add(model);

          try {
            const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${effectiveApiKey}`;

            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 9000); // 9s timeout per model

            const response = await fetch(geminiUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              signal: controller.signal,
              body: JSON.stringify({
                contents,
                generationConfig: {
                  responseMimeType: 'application/json',
                  temperature: 0.7,
                  maxOutputTokens: 3000
                }
              })
            });

            clearTimeout(timeoutId);

            if (response.ok) {
              const data = await response.json();
              const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
              const parsed = cleanAndParseJSON(rawText);

              if (parsed && parsed.user_correction && parsed.bot_response) {
                discoveredModel = model; // Remember the fast working model
                console.log(`✅ Gemini AI answered using [${model}]`);
                return res.status(200).json({
                  success: true,
                  source: `gemini (${model})`,
                  data: parsed
                });
              } else {
                console.warn(`Could not parse JSON from ${model}:`, rawText.slice(0, 100));
              }
            } else {
              const err = await response.json().catch(() => ({}));
              console.warn(`Model ${model} error (${response.status}):`, err?.error?.message || response.statusText);
            }
          } catch (fetchErr) {
            console.warn(`Call to ${model} threw:`, fetchErr.message);
          }
        }
      } catch (geminiErr) {
        console.warn('Gemini AI workflow failed, using local engine:', geminiErr.message);
      }
    }

    // 2. Local Intelligent Multi-Turn Fallback (Never hangs, handles continuous dialogue)
    console.log('Using smart multi-turn linguistic engine...');
    const fallbackData = processSmartConversation(message.trim(), targetLang, nativeLang, history);

    return res.status(200).json({
      success: true,
      source: 'smart_linguistic_engine',
      data: fallbackData
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
        const modelName = discoveredModel || 'gemini-3.8-flash';
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

    const tryList = [activeModel, ...MODEL_CANDIDATES.filter(m => m !== activeModel)];
    const tried = new Set();

    for (const model of tryList) {
      if (tried.has(model)) continue;
      tried.add(model);

      try {
        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${effectiveApiKey}`;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 12000);

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

        if (response.ok) {
          const data = await response.json();
          const transcript = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
          if (transcript) {
            console.log(`✅ Audio transcribed via Gemini [${model}]: "${transcript}"`);
            return res.status(200).json({
              success: true,
              source: `gemini (${model})`,
              transcript
            });
          }
        } else {
          const err = await response.json().catch(() => ({}));
          console.warn(`Audio transcription model ${model} error (${response.status}):`, err?.error?.message || response.statusText);
        }
      } catch (err) {
        console.warn(`Audio transcription call to ${model} threw:`, err.message);
      }
    }

    return res.status(500).json({ error: 'No se pudo transcribir el audio con los modelos disponibles.' });
  } catch (err) {
    console.error('Server error in /api/transcribe:', err);
    res.status(500).json({ error: 'Error en el servidor durante la transcripción de audio.' });
  }
}

