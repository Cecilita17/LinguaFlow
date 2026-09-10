/**
 * Subtitle Gloss Service
 * Provides:
 * 1. High-accuracy Chinese word segmentation (Intl.Segmenter for multi-character words like 今天, 自己, 欢迎, 收听)
 * 2. Instant offline lexicon resolution for high-frequency vocabulary and Pinyin
 * 3. Batch AI glossing via Groq API without breaking words into characters
 * 4. Persistent caching by videoId/content hash (v2) to eliminate duplicate requests
 */

import { API_BASE_URL } from './chatService.js';

// Comprehensive Chinese lexicon database for instant word + pinyin + gloss resolution
export const CHINESE_OFFLINE_DICT = {
  // Core vocabulary from YouTube transcript examples
  '欢迎': { pinyin: 'huānyíng', gloss: 'bienvenido' },
  '收听': { pinyin: 'shōutīng', gloss: 'escuchar' },
  '今天': { pinyin: 'jīntiān', gloss: 'hoy' },
  '明天': { pinyin: 'míngtiān', gloss: 'mañana' },
  '昨天': { pinyin: 'zuótiān', gloss: 'ayer' },
  '现在': { pinyin: 'xiànzài', gloss: 'ahora' },
  '这': { pinyin: 'zhè', gloss: 'este / esta' },
  '那': { pinyin: 'nà', gloss: 'ese / aquel' },
  '封': { pinyin: 'fēng', gloss: 'clasif. cartas' },
  '写给': { pinyin: 'xiě gěi', gloss: 'escrita a' },
  '写': { pinyin: 'xiě', gloss: 'escribir' },
  '给': { pinyin: 'gěi', gloss: 'dar / para' },
  '自己': { pinyin: 'zìjǐ', gloss: 'uno mismo' },
  '的': { pinyin: 'de', gloss: 'de' },
  '信': { pinyin: 'xìn', gloss: 'carta' },
  '你好': { pinyin: 'nǐ hǎo', gloss: 'hola' },
  '您好': { pinyin: 'nín hǎo', gloss: 'hola (formal)' },
  '我': { pinyin: 'wǒ', gloss: 'yo' },
  '我是': { pinyin: 'wǒ shì', gloss: 'yo soy' },
  '是': { pinyin: 'shì', gloss: 'ser' },
  '子轩': { pinyin: 'Zǐxuān', gloss: 'Zixuan (nombre)' },
  '想': { pinyin: 'xiǎng', gloss: 'querer / pensar' },
  '我想': { pinyin: 'wǒ xiǎng', gloss: 'quiero / pienso' },
  '和你': { pinyin: 'hé nǐ', gloss: 'contigo' },
  '和': { pinyin: 'hé', gloss: 'con / y' },
  '你': { pinyin: 'nǐ', gloss: 'tú' },
  '分享': { pinyin: 'fēnxiǎng', gloss: 'compartir' },
  '我们': { pinyin: 'wǒmen', gloss: 'nosotros' },
  '学习': { pinyin: 'xuéxí', gloss: 'aprender' },
  '学': { pinyin: 'xué', gloss: 'estudiar' },
  '中文': { pinyin: 'zhōngwén', gloss: 'idioma chino' },
  '汉语': { pinyin: 'hànyǔ', gloss: 'lengua china' },
  '说': { pinyin: 'shuō', gloss: 'hablar / decir' },
  '吃': { pinyin: 'chī', gloss: 'comer' },
  '喝': { pinyin: 'hē', gloss: 'beber' },
  '看': { pinyin: 'kàn', gloss: 'ver / mirar' },
  '听': { pinyin: 'tīng', gloss: 'escuchar' },
  '咖啡': { pinyin: 'kāfēi', gloss: 'café' },
  '茶': { pinyin: 'chá', gloss: 'té' },
  '水': { pinyin: 'shuǐ', gloss: 'agua' },
  '很': { pinyin: 'hěn', gloss: 'muy' },
  '太': { pinyin: 'tài', gloss: 'demasiado' },
  '高兴': { pinyin: 'gāoxìng', gloss: 'contento' },
  '好': { pinyin: 'hǎo', gloss: 'bien / bueno' },
  '累': { pinyin: 'lèi', gloss: 'cansado' },
  '困': { pinyin: 'kùn', gloss: 'con sueño' },
  '睡觉': { pinyin: 'shuìjiào', gloss: 'dormir' },
  '谢谢': { pinyin: 'xièxie', gloss: 'gracias' },
  '不客气': { pinyin: 'bù kèqi', gloss: 'de nada' },
  '再见': { pinyin: 'zàijiàn', gloss: 'adiós' },
  '了': { pinyin: 'le', gloss: 'ya / aspecto' },
  '吗': { pinyin: 'ma', gloss: '¿acaso?' },
  '呢': { pinyin: 'ne', gloss: '¿y...?' },
  '不': { pinyin: 'bù', gloss: 'no' },
  '在': { pinyin: 'zài', gloss: 'en / estar' },
  '有': { pinyin: 'yǒu', gloss: 'tener / haber' },
  '什么': { pinyin: 'shénme', gloss: 'qué' },
  '怎么': { pinyin: 'zěnme', gloss: 'cómo' },
  '朋友': { pinyin: 'péngyou', gloss: 'amigo' },
  '喜欢': { pinyin: 'xǐhuan', gloss: 'gustar' },
  '开心': { pinyin: 'kāixīn', gloss: 'alegre' },
  '故事': { pinyin: 'gùshi', gloss: 'historia' },
  '生活': { pinyin: 'shēnghuó', gloss: 'vida' },
  '时间': { pinyin: 'shíjiān', gloss: 'tiempo' },
  '工作': { pinyin: 'gōngzuò', gloss: 'trabajo' },
  '因为': { pinyin: 'yīnwèi', gloss: 'porque' },
  '所以': { pinyin: 'suǒyǐ', gloss: 'por eso' },
  '但是': { pinyin: 'dànshì', gloss: 'pero' },
  '如果': { pinyin: 'rúguǒ', gloss: 'si' },
  '虽然': { pinyin: 'suīrán', gloss: 'aunque' },
  '可以': { pinyin: 'kěyǐ', gloss: 'poder' },
  '能够': { pinyin: 'nénggòu', gloss: 'ser capaz' },
  '会': { pinyin: 'huì', gloss: 'saber / poder' },
  '大家': { pinyin: 'dàjiā', gloss: 'todos' },
  '希望': { pinyin: 'xīwàng', gloss: 'esperar / desear' },
  '世界': { pinyin: 'shìjiè', gloss: 'mundo' },
  '年': { pinyin: 'nián', gloss: 'año' },
  '月': { pinyin: 'yuè', gloss: 'mes' },
  '日': { pinyin: 'rì', gloss: 'día' },
  '人': { pinyin: 'rén', gloss: 'persona' },
  '爱': { pinyin: 'ài', gloss: 'amar / amor' }
};

export const PUNCTUATION_REGEX = /^[，。！？；：、“”‘’（）《》…—,.!?;:'"()\- \t]+$/;

/**
 * Tokenize a single text line into words with offline Pinyin and glosses.
 * Uses Intl.Segmenter for Chinese multi-character words.
 */
export function tokenizeAndGlossLineOffline(rawText, targetLang = 'zh') {
  if (!rawText || typeof rawText !== 'string') return [];

  const text = rawText.trim();
  if (!text) return [];

  const tokens = [];

  if (targetLang === 'zh' || /[\u4E00-\u9FFF]/.test(text)) {
    try {
      if (typeof Intl !== 'undefined' && Intl.Segmenter) {
        const segmenter = new Intl.Segmenter('zh-CN', { granularity: 'word' });
        const segments = [...segmenter.segment(text)];

        for (const seg of segments) {
          const w = seg.segment.trim();
          if (!w) continue;

          const isPunctuation = PUNCTUATION_REGEX.test(w);
          const dictEntry = CHINESE_OFFLINE_DICT[w];

          tokens.push({
            text: w,
            word: w,
            pinyin: isPunctuation ? null : (dictEntry?.pinyin || null),
            gloss: isPunctuation ? null : (dictEntry?.gloss || null),
            isPunctuation
          });
        }

        if (tokens.length > 0) return tokens;
      }
    } catch (e) {
      console.warn('Intl.Segmenter fallback in subtitleGlossService:', e);
    }

    // Fallback if segmenter is somehow not available
    const fallbackWords = text.match(/[\u4E00-\u9FFF]{1,4}|[a-zA-Z0-9]+|[^\s]/g) || [text];
    for (const w of fallbackWords) {
      if (!w.trim()) continue;
      const isPunctuation = PUNCTUATION_REGEX.test(w);
      const dictEntry = CHINESE_OFFLINE_DICT[w];
      tokens.push({
        text: w,
        word: w,
        pinyin: isPunctuation ? null : (dictEntry?.pinyin || null),
        gloss: isPunctuation ? null : (dictEntry?.gloss || null),
        isPunctuation
      });
    }
    return tokens;
  }

  // Non-Chinese languages: word and punctuation tokenization
  const parts = text.split(/(\s+|[.,!?;:'"()\-]+)/).filter(p => p && p.trim().length > 0);
  return parts.map(word => {
    const isPunctuation = /^[.,!?;:'"()\-]+$/.test(word);
    return {
      text: word,
      word,
      pinyin: null,
      gloss: null,
      isPunctuation
    };
  });
}

/**
 * Call backend batch gloss endpoint to enrich a set of lines with AI glosses.
 * Crucially passes the client pre-segmented words so AI does NOT split them into characters!
 */
export async function fetchBatchGlossesApi(lines, targetLang = 'zh', nativeLang = 'es') {
  if (!Array.isArray(lines) || lines.length === 0) return [];

  const url = `${API_BASE_URL}/api/batch-gloss`;
  const fallbackUrl = `${API_BASE_URL}/batch-gloss`;

  const payload = {
    lines: lines.map(l => {
      const words = (l.tokens || [])
        .filter(t => !t.isPunctuation && (t.text || t.word))
        .map(t => t.text || t.word);
      return {
        id: l.id,
        text: l.text,
        words
      };
    }),
    targetLang,
    nativeLang
  };

  try {
    let res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!res.ok && res.status === 404) {
      res = await fetch(fallbackUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    }

    if (res.ok) {
      const data = await res.json();
      if (data.success && Array.isArray(data.lines)) {
        return data.lines;
      }
    }
  } catch (err) {
    console.warn('Network call to batch gloss API failed, using offline fallback:', err);
  }

  return [];
}

/**
 * Cache key generator for persistent storage (version 2 prevents stale single-character cache)
 */
function getStorageKey(videoId, subtitlesCount) {
  const cleanId = (videoId || 'generic').replace(/[^a-zA-Z0-9_-]/g, '');
  return `linguaflow_yt_gloss_v2_${cleanId}_${subtitlesCount}`;
}

/**
 * Load cached gloss lines from localStorage
 */
export function loadCachedGlosses(videoId, subtitlesCount) {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return {};
    const key = getStorageKey(videoId, subtitlesCount);
    const saved = localStorage.getItem(key);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed && typeof parsed === 'object') {
        return parsed;
      }
    }
  } catch (e) {
    console.warn('Failed to load glosses cache from storage:', e);
  }
  return {};
}

/**
 * Save cached gloss lines to localStorage
 */
export function saveCachedGlosses(videoId, subtitlesCount, cacheMap) {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;
    const key = getStorageKey(videoId, subtitlesCount);
    localStorage.setItem(key, JSON.stringify(cacheMap));
  } catch (e) {
    console.warn('Failed to save glosses cache to storage:', e);
  }
}

/**
 * Safely merge AI tokens onto pre-segmented client tokens.
 * NEVER breaks or splits client word units!
 */
export function mergeAiTokensWithSegmented(originalTokens = [], aiTokens = []) {
  if (!Array.isArray(aiTokens) || aiTokens.length === 0) {
    return originalTokens;
  }

  // Create lookup map by word
  const aiMap = new Map();
  aiTokens.forEach(item => {
    const w = (item.word || item.text || '').trim();
    if (w) {
      aiMap.set(w, item);
    }
  });

  return originalTokens.map(orig => {
    if (orig.isPunctuation) return orig;

    const w = orig.text || orig.word;
    const match = aiMap.get(w);

    if (match) {
      const pinyin = match.pinyin || orig.pinyin;
      let gloss = match.gloss || orig.gloss;

      // Sanitize: never allow gloss to duplicate pinyin or the Chinese word itself
      if (gloss && (gloss === pinyin || gloss === w)) {
        gloss = orig.gloss && orig.gloss !== pinyin ? orig.gloss : null;
      }

      return {
        ...orig,
        pinyin,
        gloss
      };
    }

    return orig;
  });
}

/**
 * Main orchestrator:
 * 1. Immediately prepares all lines with offline word segmentation + Pinyin (no waiting)
 * 2. Merges any already cached AI glosses from localStorage without re-splitting words
 * 3. Enqueues missing lines in chunks of 12 lines for background Groq batch enrichment
 * 4. Triggers onUpdate callback as each batch finishes without interrupting reading
 */
export function enrichSubtitlesWithGlosses({
  subtitles = [],
  targetLang = 'zh',
  nativeLang = 'es',
  videoId = '',
  onUpdate = null
}) {
  if (!Array.isArray(subtitles) || subtitles.length === 0) {
    return subtitles;
  }

  const cache = loadCachedGlosses(videoId, subtitles.length);

  // Phase 1: Apply offline tokenization & merge cached AI tokens
  const prepared = subtitles.map(sub => {
    const offlineTokens = tokenizeAndGlossLineOffline(sub.text, targetLang);

    // If we have AI enriched tokens in cache, merge them onto the pre-segmented words
    if (cache[sub.id] && Array.isArray(cache[sub.id]) && cache[sub.id].length > 0) {
      return {
        ...sub,
        tokens: mergeAiTokensWithSegmented(offlineTokens, cache[sub.id])
      };
    }

    return {
      ...sub,
      tokens: offlineTokens
    };
  });

  // Only request AI glosses for lines that are missing glosses on substantive words
  const missingLines = prepared.filter(sub => {
    if (cache[sub.id]) return false;
    return sub.tokens && sub.tokens.some(t => !t.isPunctuation && !t.gloss);
  });

  if (missingLines.length === 0 || !onUpdate) {
    return prepared;
  }

  // Phase 2: Background batch processing in chunks of 12 lines
  const CHUNK_SIZE = 12;
  const chunks = [];
  for (let i = 0; i < missingLines.length; i += CHUNK_SIZE) {
    chunks.push(missingLines.slice(i, i + CHUNK_SIZE));
  }

  (async () => {
    let currentSubtitles = [...prepared];

    for (const chunk of chunks) {
      const aiResults = await fetchBatchGlossesApi(chunk, targetLang, nativeLang);

      if (Array.isArray(aiResults) && aiResults.length > 0) {
        let hasNewData = false;

        aiResults.forEach(item => {
          if (item && item.id && Array.isArray(item.tokens) && item.tokens.length > 0) {
            cache[item.id] = item.tokens;
            hasNewData = true;

            const idx = currentSubtitles.findIndex(s => s.id === item.id);
            if (idx !== -1) {
              currentSubtitles[idx] = {
                ...currentSubtitles[idx],
                tokens: mergeAiTokensWithSegmented(currentSubtitles[idx].tokens, item.tokens)
              };
            }
          }
        });

        if (hasNewData) {
          saveCachedGlosses(videoId, subtitles.length, cache);
          if (onUpdate) {
            onUpdate([...currentSubtitles]);
          }
        }
      }

      await new Promise(r => setTimeout(r, 350));
    }
  })().catch(err => {
    console.warn('Background batch glossing notice:', err);
  });

  return prepared;
}
