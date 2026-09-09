// Base URL for the backend API deployed on Render
export const API_BASE_URL = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_BASE_URL) || 'https://linguaflow-fef0.onrender.com';

import { processSmartConversation } from '../../server/conversationEngine.js';
import { getSystemPrompt } from '../../server/promptTemplates.js';
import { SUPPORTED_LANGUAGES } from '../../server/languageData.js';
import { performFullGrammarCorrection } from './grammarEngine.js';

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

  const effectiveKey = (apiKey || '').trim();

  // 1. If user entered Gemini API Key in Settings, call Google Gemini AI directly first (instant, 100% generative AI)
  if (effectiveKey) {
    try {
      const langObj = SUPPORTED_LANGUAGES.find(l => l.code === targetLang) || { name: targetLang, englishName: targetLang };
      const nativeObj = SUPPORTED_LANGUAGES.find(l => l.code === nativeLang) || { name: nativeLang, englishName: nativeLang };
      const targetLanguageName = langObj.englishName || langObj.name;
      const systemPrompt = getSystemPrompt(targetLanguageName, nativeObj.name, level);

      // Build conversation context
      const historyContext = history.slice(-4).map(h => {
        const role = h.sender === 'user' ? 'Student' : 'Tutor';
        const txt = h.sender === 'user' ? (h.correctedText || h.text) : h.text;
        return `${role}: "${txt}"`;
      }).join('\n');

      const fullPrompt = `${systemPrompt}

${historyContext ? `Previous conversation:\n${historyContext}\n` : ''}
Student's latest message to correct and respond to:
"${cleanMsg}"

INSTRUCTIONS:
1. In "user_correction":
   - "original_text": "${cleanMsg}"
   - "corrected_text": Corrected, natural ${targetLanguageName}. If student wrote any native words (${nativeObj.name}), TRANSLATE them into ${targetLanguageName}.
   - "has_errors": boolean
   - "diff_tokens": array of words with "changed": true and "original": "[student's original word]" for corrected/translated words.
2. In "bot_response":
   - "text": 1-3 conversational, natural sentences in ${targetLanguageName} directly addressing what the student said.
   - "translation": Translation of the bot response into ${nativeObj.name}.
   - "tokens": array of { word, clean_word, translit }.
   - "vocabulary": object of 2-3 key terms with { meaning, part_of_speech }.

Return strictly JSON matching this structure.`;

      const candidateModels = ['gemini-1.5-flash', 'gemini-2.0-flash', 'gemini-2.5-flash', 'gemini-1.5-pro'];
      let lastErrMessage = null;

      for (const model of candidateModels) {
        try {
          const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${effectiveKey}`;
          const directRes = await fetch(geminiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: fullPrompt }] }],
              generationConfig: {
                responseMimeType: 'application/json',
                temperature: 0.7,
                maxOutputTokens: 2500
              }
            })
          });

          if (directRes.ok) {
            const resJson = await directRes.json();
            const textContent = resJson?.candidates?.[0]?.content?.parts?.[0]?.text;
            if (textContent) {
              const cleanText = textContent.replace(/```json\s*/gi, '').replace(/```\s*$/gi, '').trim();
              const parsed = JSON.parse(cleanText);
              if (parsed && parsed.user_correction && parsed.bot_response) {
                console.log(`✅ Direct client Gemini responded using [${model}]`);
                return {
                  source: `direct_gemini (${model})`,
                  data: parsed
                };
              }
            }
          } else {
            const errData = await directRes.json().catch(() => ({}));
            lastErrMessage = errData?.error?.message || `HTTP ${directRes.status}`;
            console.warn(`Direct Gemini ${model} error (${directRes.status}):`, lastErrMessage);
          }
        } catch (candErr) {
          lastErrMessage = candErr.message;
        }
      }

      if (lastErrMessage) {
        console.warn('Direct Gemini attempts failed, checking backend /api/chat:', lastErrMessage);
      }
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
      console.warn(`/api/chat responded with status ${response.status}. Activating resilient client engine.`);
    }
  } catch (netErr) {
    console.warn('/api/chat unreachable or timed out. Activating resilient client engine:', netErr.message);
  }

  // 3. Resilient smart multi-turn linguistic engine (with ZERO generic praise templates)
  console.log('Using resilient smart multi-turn linguistic engine...');
  const fallbackData = processSmartConversation(cleanMsg, targetLang, nativeLang, history);
  const deepCorrection = await performFullGrammarCorrection(cleanMsg, targetLang, nativeLang, effectiveKey);
  if (deepCorrection && deepCorrection.has_errors) {
    fallbackData.user_correction = deepCorrection;
  }
  return {
    source: 'resilient_linguistic_engine',
    data: fallbackData
  };
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

