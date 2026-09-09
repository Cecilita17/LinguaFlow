import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { getSystemPrompt } from './promptTemplates.js';
import { SUPPORTED_LANGUAGES } from './languageData.js';
import { processSmartConversation } from './conversationEngine.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Priority list of Gemini models to try
const MODEL_CANDIDATES = [
  'gemini-3.8-flash',
  'gemini-3.7-flash',
  'gemini-3.6-flash',
  'gemini-3.5-flash',
  'gemini-flash-latest',
  'gemini-3.1-pro-preview'
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

  return 'gemini-3.8-flash';
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

// List of supported languages
app.get('/api/languages', (req, res) => {
  res.json({ languages: SUPPORTED_LANGUAGES });
});

// Chat endpoint
app.post('/api/chat', async (req, res) => {
  try {
    const {
      message,
      targetLang = 'es',
      nativeLang = 'es',
      level = 'A2/B1',
      apiKey: clientApiKey,
      history = []
    } = req.body;

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
                return res.json({
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

    return res.json({
      success: true,
      source: 'smart_linguistic_engine',
      data: fallbackData
    });

  } catch (error) {
    console.error('Server error in /api/chat:', error);
    res.status(500).json({ error: 'Error procesando la solicitud en el servidor.' });
  }
});

// Word lookup endpoint
app.post('/api/lookup-word', async (req, res) => {
  try {
    const { word, targetLang, nativeLang, apiKey: clientApiKey } = req.body;
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
          if (parsed) return res.json({ success: true, data: parsed });
        }
      } catch (err) {
        console.warn('Gemini word lookup error:', err.message);
      }
    }

    // Default dictionary fallback
    res.json({
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
});

app.listen(PORT, () => {
  console.log(`🚀 LinguaFlow Server running on http://localhost:${PORT}`);
});
