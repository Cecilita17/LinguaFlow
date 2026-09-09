// Base URL for the backend API deployed on Render
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://linguaflow-fef0.onrender.com';

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

  // 1. Try Render Backend API first (/api/chat)
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
        apiKey: (apiKey || '').trim(),
        history: history.slice(-6)
      })
    });

    clearTimeout(timeoutId);

    if (response.ok) {
      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const resData = await response.json();
        if (resData && resData.success && resData.data?.user_correction && resData.data?.bot_response) {
          // If server didn't catch errors, run deep grammar analysis to guarantee detection
          if (!resData.data.user_correction.has_errors) {
            const deepCorrection = await performFullGrammarCorrection(cleanMsg, targetLang);
            if (deepCorrection && deepCorrection.has_errors) {
              resData.data.user_correction = deepCorrection;
            }
          }
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

  // 2. If user entered Gemini API Key in UI Settings, try direct Gemini API call
  const effectiveKey = (apiKey || '').trim();
  if (effectiveKey) {
    try {
      const langObj = SUPPORTED_LANGUAGES.find(l => l.code === targetLang) || { name: targetLang, englishName: targetLang };
      const nativeObj = SUPPORTED_LANGUAGES.find(l => l.code === nativeLang) || { name: nativeLang, englishName: nativeLang };
      const targetLanguageName = langObj.englishName || langObj.name;
      const systemPrompt = getSystemPrompt(targetLanguageName, nativeObj.name, level);

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
          text: `Student message in ${targetLanguageName}: "${cleanMsg}".
Please:
1. Correct errors in "user_correction" with "diff_tokens" (words changed have "changed": true and "original": "...").
2. Give a brief, natural response in ${targetLanguageName} (1-3 sentences) suitable for level ${level}.
3. Provide translation in ${nativeObj.name}.
4. Provide tokens (compounds for Chinese) and 2-3 key vocabulary words.
Return strictly valid JSON.`
        }]
      });

      const candidateModels = ['gemini-2.5-flash', 'gemini-1.5-flash', 'gemini-1.5-pro'];
      for (const model of candidateModels) {
        try {
          const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${effectiveKey}`;
          const directRes = await fetch(geminiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents,
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
                return {
                  source: `direct_gemini (${model})`,
                  data: parsed
                };
              }
            }
          }
        } catch (candErr) {
          // Continue to next model candidate
        }
      }
    } catch (geminiErr) {
      console.warn('Direct Gemini call failed:', geminiErr.message);
    }
  }

  // 3. Resilient smart multi-turn linguistic engine fallback
  console.log('Using resilient smart multi-turn linguistic engine...');
  const fallbackData = processSmartConversation(cleanMsg, targetLang, nativeLang, history);
  const deepCorrection = await performFullGrammarCorrection(cleanMsg, targetLang);
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
