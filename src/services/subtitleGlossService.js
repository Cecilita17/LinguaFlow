/**
 * Subtitle Gloss Service
 * Provides:
 * 1. High-accuracy Chinese word segmentation (Intl.Segmenter for multi-character words like 今天, 自己, 欢迎, 收听)
 * 2. Instant offline lexicon resolution for high-frequency vocabulary and Pinyin
 * 3. Batch AI glossing via Groq API without blocking the UI
 * 4. Persistent caching by videoId/content hash to eliminate duplicate requests
 */

import { API_BASE_URL } from './chatService.js';

// High-frequency Chinese lexicon database for instant offline word + pinyin + gloss resolution
const CHINESE_OFFLINE_DICT = {
  '欢迎': { pinyin: 'huānyíng', gloss: 'bienvenido' },
  '收听': { pinyin: 'shōutīng', gloss: 'escuchar' },
  '今天': { pinyin: 'jīntiān', gloss: 'hoy' },
  '这': { pinyin: 'zhè', gloss: 'este / esta' },
  '封': { pinyin: 'fēng', gloss: 'clasif. (cartas)' },
  '写给': { pinyin: 'xiě gěi', gloss: 'escrita a' },
  '自己': { pinyin: 'zìjǐ', gloss: 'uno mismo' },
  '的': { pinyin: 'de', gloss: 'de' },
  '信': { pinyin: 'xìn', gloss: 'carta' },
  '你好': { pinyin: 'nǐ hǎo', gloss: 'hola' },
  '您好': { pinyin: 'nín hǎo', gloss: 'hola (formal)' },
  '我': { pinyin: 'wǒ', gloss: 'yo' },
  '是': { pinyin: 'shì', gloss: 'ser' },
  '子轩': { pinyin: 'Zǐxuān', gloss: 'Zixuan (nombre)' },
  '想': { pinyin: 'xiǎng', gloss: 'querer / desear' },
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
  '生活': { pinyin: 'shēnghuó', gloss: 'vida' },
  '时间': { pinyin: 'shíjiān', gloss: 'tiempo' },
  '工作': { pinyin: 'gōngzuò', gloss: 'trabajo' },
  '因为': { pinyin: 'yīnwèi', gloss: 'porque' },
  '所以': { pinyin: 'suǒyǐ', gloss: 'por eso' },
  '但是': { pinyin: 'dànshì', gloss: 'pero' },
  '如果': { pinyin: 'rúguǒ', gloss: 'si (condicional)' },
  '虽然': { pinyin: 'suīrán', gloss: 'aunque' },
  '可以': { pinyin: 'kěyǐ', gloss: 'poder / se puede' },
  '能够': { pinyin: 'nénggòu', gloss: 'ser capaz' },
  '会': { pinyin: 'huì', gloss: 'saber / futuro' },
  '现在': { pinyin: 'xiànzài', gloss: 'ahora' },
  '明天': { pinyin: 'míngtiān', gloss: 'mañana' },
  '昨天': { pinyin: 'zuótiān', gloss: 'ayer' },
  '年': { pinyin: 'nián', gloss: 'año' },
  '月': { pinyin: 'yuè', gloss: 'mes' },
  '日': { pinyin: 'rì', gloss: 'día' },
  '人': { pinyin: 'rén', gloss: 'persona' },
  '大家': { pinyin: 'dàjiā', gloss: 'todos' }
};

const PUNCTUATION_REGEX = /^[，。！？；：、“”‘’（）《》…—,.!?;:'"()\- \t]+$/;

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
        const segmenter = new Intl.Segmenter('zh', { granularity: 'word' });
        const segments = [...segmenter.segment(text)];

        for (const seg of segments) {
          const w = seg.segment.trim();
          if (!w) continue;

          const isPunctuation = PUNCTUATION_REGEX.test(w);
          const dictEntry = CHINESE_OFFLINE_DICT[w];

          tokens.push({
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

    // Fallback: character-by-character if segmenter fails
    for (const char of text) {
      if (!char.trim()) continue;
      const isPunctuation = PUNCTUATION_REGEX.test(char);
      const dictEntry = CHINESE_OFFLINE_DICT[char];
      tokens.push({
        word: char,
        pinyin: isPunctuation ? null : (dictEntry?.pinyin || null),
        gloss: isPunctuation ? null : (dictEntry?.gloss || null),
        isPunctuation
      });
    }
    return tokens;
  }

  // Non-Chinese: standard whitespace + word boundary tokenization
  const parts = text.split(/(\s+|[.,!?;:'"()\-]+)/).filter(p => p && p.trim().length > 0);
  return parts.map(word => {
    const isPunctuation = /^[.,!?;:'"()\-]+$/.test(word);
    return {
      word,
      pinyin: null,
      gloss: null,
      isPunctuation
    };
  });
}

/**
 * Call backend batch gloss endpoint to enrich a set of lines with AI glosses.
 */
export async function fetchBatchGlossesApi(lines, targetLang = 'zh', nativeLang = 'es') {
  if (!Array.isArray(lines) || lines.length === 0) return [];

  const url = `${API_BASE_URL}/api/batch-gloss`;
  const fallbackUrl = `${API_BASE_URL}/batch-gloss`;

  const payload = {
    lines: lines.map(l => ({ id: l.id, text: l.text })),
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
 * Cache key generator for persistent storage
 */
function getStorageKey(videoId, subtitlesCount) {
  const cleanId = (videoId || 'generic').replace(/[^a-zA-Z0-9_-]/g, '');
  return `linguaflow_yt_gloss_v1_${cleanId}_${subtitlesCount}`;
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
 * Main orchestrator:
 * 1. Immediately prepares all lines with offline tokenization + Pinyin (no waiting)
 * 2. Merges any already cached AI glosses from localStorage
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

  // Phase 1: Apply offline tokenization & cached AI tokens immediately
  const prepared = subtitles.map(sub => {
    // If we have AI enriched tokens in cache, use them!
    if (cache[sub.id] && Array.isArray(cache[sub.id]) && cache[sub.id].length > 0) {
      return {
        ...sub,
        tokens: cache[sub.id]
      };
    }

    // Otherwise apply offline word segmentation & lexicon
    const offlineTokens = tokenizeAndGlossLineOffline(sub.text, targetLang);
    return {
      ...sub,
      tokens: offlineTokens
    };
  });

  // If already full cached or not Chinese, return prepared
  const missingLines = prepared.filter(sub => {
    // Needs AI enrichment if it has no cached glosses and has meaningful words
    if (cache[sub.id]) return false;
    return sub.tokens && sub.tokens.some(t => !t.isPunctuation && !t.gloss);
  });

  if (missingLines.length === 0 || !onUpdate) {
    return prepared;
  }

  // Phase 2: Background batch processing (in chunks of 12 lines to keep latency low and responses fast)
  const CHUNK_SIZE = 12;
  const chunks = [];
  for (let i = 0; i < missingLines.length; i += CHUNK_SIZE) {
    chunks.push(missingLines.slice(i, i + CHUNK_SIZE));
  }

  // Run chunks sequentially in background to respect rate limits
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

            // Update in currentSubtitles
            const idx = currentSubtitles.findIndex(s => s.id === item.id);
            if (idx !== -1) {
              currentSubtitles[idx] = {
                ...currentSubtitles[idx],
                tokens: item.tokens
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

      // Small pause between batches
      await new Promise(r => setTimeout(r, 400));
    }
  })().catch(err => {
    console.warn('Background batch glossing notice:', err);
  });

  return prepared;
}
