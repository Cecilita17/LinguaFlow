import { processSmartConversation } from '../../server/conversationEngine.js';
import { getSystemPrompt } from '../../server/promptTemplates.js';
import { SUPPORTED_LANGUAGES } from '../../server/languageData.js';

/**
 * Robust chat service that communicates with /api/chat on Vercel/localhost
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

  // 1. Try Vercel / Local Backend API first (/api/chat)
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000); // 12s timeout

    const response = await fetch('/api/chat', {
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
  return {
    source: 'resilient_linguistic_engine',
    data: fallbackData
  };
}
