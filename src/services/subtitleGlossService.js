/**
 * Subtitle Gloss Service
 * Provides:
 * 1. High-accuracy Chinese word segmentation (Intl.Segmenter for multi-character words like 今天, 自己, 欢迎, 收听)
 * 2. Instant offline lexicon resolution for high-frequency vocabulary and Pinyin
 * 3. Fast parallel batch AI glossing via Groq API without breaking words into characters
 * 4. Multi-strategy robust ID & positional matching so 100% of AI tokens are applied
 * 5. Persistent caching by videoId/content hash (v2) to eliminate duplicate requests
 */

import { API_BASE_URL } from './chatService.js';

// Comprehensive Chinese lexicon database for instant word + pinyin + gloss resolution (HSK 1-3 & conversation)
export const CHINESE_OFFLINE_DICT = {
  // Core conversational greetings & introduction
  '欢迎': { pinyin: 'huānyíng', gloss: 'bienvenido' },
  '收听': { pinyin: 'shōutīng', gloss: 'escuchar' },
  '你好': { pinyin: 'nǐ hǎo', gloss: 'hola' },
  '您好': { pinyin: 'nín hǎo', gloss: 'hola (formal)' },
  '早上好': { pinyin: 'zǎoshang hǎo', gloss: 'buenos días' },
  '晚上好': { pinyin: 'wǎnshang hǎo', gloss: 'buenas noches' },
  '谢谢': { pinyin: 'xièxie', gloss: 'gracias' },
  '不客气': { pinyin: 'bù kèqi', gloss: 'de nada' },
  '对不起': { pinyin: 'duìbuqǐ', gloss: 'perdón / disculpas' },
  '没关系': { pinyin: 'méi guānxi', gloss: 'no pasa nada' },
  '再见': { pinyin: 'zàijiàn', gloss: 'adiós / hasta luego' },
  '明天见': { pinyin: 'míngtiān jiàn', gloss: 'hasta mañana' },
  '好久不见': { pinyin: 'hǎojiǔ bùjiàn', gloss: 'cuánto tiempo' },

  // Pronouns
  '我': { pinyin: 'wǒ', gloss: 'yo' },
  '我的': { pinyin: 'wǒ de', gloss: 'mi / mío' },
  '我是': { pinyin: 'wǒ shì', gloss: 'yo soy' },
  '我们': { pinyin: 'wǒmen', gloss: 'nosotros' },
  '你': { pinyin: 'nǐ', gloss: 'tú' },
  '你的': { pinyin: 'nǐ de', gloss: 'tu / tuyo' },
  '你们': { pinyin: 'nǐmen', gloss: 'ustedes / vosotros' },
  '他': { pinyin: 'tā', gloss: 'él' },
  '他的': { pinyin: 'tā de', gloss: 'su (de él)' },
  '他们': { pinyin: 'tāmen', gloss: 'ellos' },
  '她': { pinyin: 'tā', gloss: 'ella' },
  '她的': { pinyin: 'tā de', gloss: 'su (de ella)' },
  '她们': { pinyin: 'tāmen', gloss: 'ellas' },
  '自己': { pinyin: 'zìjǐ', gloss: 'uno mismo' },
  '大家': { pinyin: 'dàjiā', gloss: 'todos' },
  '谁': { pinyin: 'shéi', gloss: 'quién' },
  '别人': { pinyin: 'biéren', gloss: 'los demás' },
  '什么': { pinyin: 'shénme', gloss: 'qué' },
  '这': { pinyin: 'zhè', gloss: 'este / esta' },
  '这个': { pinyin: 'zhè ge', gloss: 'este' },
  '这里': { pinyin: 'zhèlǐ', gloss: 'aquí' },
  '这封': { pinyin: 'zhè fēng', gloss: 'esta (carta)' },
  '那': { pinyin: 'nà', gloss: 'ese / aquel' },
  '那个': { pinyin: 'nà ge', gloss: 'ese / aquel' },
  '那里': { pinyin: 'nàlǐ', gloss: 'allí' },
  '哪': { pinyin: 'nǎ', gloss: 'cuál / dónde' },
  '哪里': { pinyin: 'nǎlǐ', gloss: 'dónde' },

  // Time & date words
  '今天': { pinyin: 'jīntiān', gloss: 'hoy' },
  '明天': { pinyin: 'míngtiān', gloss: 'mañana' },
  '昨天': { pinyin: 'zuótiān', gloss: 'ayer' },
  '现在': { pinyin: 'xiànzài', gloss: 'ahora' },
  '时间': { pinyin: 'shíjiān', gloss: 'tiempo' },
  '时候': { pinyin: 'shíhou', gloss: 'momento / cuando' },
  '年': { pinyin: 'nián', gloss: 'año' },
  '月': { pinyin: 'yuè', gloss: 'mes' },
  '日': { pinyin: 'rì', gloss: 'día' },
  '号': { pinyin: 'hào', gloss: 'día del mes' },
  '星期': { pinyin: 'xīngqī', gloss: 'semana' },
  '小时': { pinyin: 'xiǎoshí', gloss: 'hora' },
  '分钟': { pinyin: 'fēnzhōng', gloss: 'minuto' },
  '早上': { pinyin: 'zǎoshang', gloss: 'mañana temprano' },
  '中午': { pinyin: 'zhōngwǔ', gloss: 'mediodía' },
  '下午': { pinyin: 'xiàwǔ', gloss: 'tarde' },
  '晚上': { pinyin: 'wǎnshang', gloss: 'noche' },

  // Core verbs
  '是': { pinyin: 'shì', gloss: 'ser' },
  '有': { pinyin: 'yǒu', gloss: 'tener / haber' },
  '在': { pinyin: 'zài', gloss: 'en / estar' },
  '去': { pinyin: 'qù', gloss: 'ir' },
  '来': { pinyin: 'lái', gloss: 'venir' },
  '看': { pinyin: 'kàn', gloss: 'ver / mirar' },
  '听': { pinyin: 'tīng', gloss: 'escuchar' },
  '说': { pinyin: 'shuō', gloss: 'hablar / decir' },
  '读': { pinyin: 'dú', gloss: 'leer' },
  '写': { pinyin: 'xiě', gloss: 'escribir' },
  '写给': { pinyin: 'xiě gěi', gloss: 'escrita a' },
  '给': { pinyin: 'gěi', gloss: 'dar / para' },
  '想': { pinyin: 'xiǎng', gloss: 'pensar / querer' },
  '我想': { pinyin: 'wǒ xiǎng', gloss: 'pienso / quiero' },
  '要': { pinyin: 'yào', gloss: 'querer / necesitar' },
  '喜欢': { pinyin: 'xǐhuan', gloss: 'gustar' },
  '爱': { pinyin: 'ài', gloss: 'amar / amor' },
  '知道': { pinyin: 'zhīdào', gloss: 'saber' },
  '认识': { pinyin: 'rènshi', gloss: 'conocer' },
  '觉得': { pinyin: 'juéde', gloss: 'opinar / creer' },
  '懂': { pinyin: 'dǒng', gloss: 'entender' },
  '明白': { pinyin: 'míngbai', gloss: 'comprender' },
  '学习': { pinyin: 'xuéxí', gloss: 'aprender / estudiar' },
  '学': { pinyin: 'xué', gloss: 'estudiar' },
  '工作': { pinyin: 'gōngzuò', gloss: 'trabajar / trabajo' },
  '分享': { pinyin: 'fēnxiǎng', gloss: 'compartir' },
  '能够': { pinyin: 'nénggòu', gloss: 'ser capaz' },
  '能': { pinyin: 'néng', gloss: 'poder' },
  '可以': { pinyin: 'kěyǐ', gloss: 'poder / se puede' },
  '会': { pinyin: 'huì', gloss: 'saber / poder' },
  '开始': { pinyin: 'kāishǐ', gloss: 'empezar' },
  '结束': { pinyin: 'jiéshù', gloss: 'terminar' },
  '吃': { pinyin: 'chī', gloss: 'comer' },
  '喝': { pinyin: 'hē', gloss: 'beber' },
  '买': { pinyin: 'mǎi', gloss: 'comprar' },
  '卖': { pinyin: 'mài', gloss: 'vender' },
  '坐': { pinyin: 'zuò', gloss: 'sentarse / viajar en' },
  '走': { pinyin: 'zǒu', gloss: 'caminar / irse' },
  '睡觉': { pinyin: 'shuìjiào', gloss: 'dormir' },
  '找到': { pinyin: 'zhǎodào', gloss: 'encontrar' },
  '希望': { pinyin: 'xīwàng', gloss: 'desear / esperar' },
  '告诉': { pinyin: 'gàosu', gloss: 'decir / contar' },
  '帮助': { pinyin: 'bāngzhù', gloss: 'ayudar' },

  // Common Nouns
  '朋友': { pinyin: 'péngyou', gloss: 'amigo' },
  '老师': { pinyin: 'lǎoshī', gloss: 'profesor' },
  '学生': { pinyin: 'xuésheng', gloss: 'estudiante' },
  '人': { pinyin: 'rén', gloss: 'persona' },
  '男人': { pinyin: 'nánrén', gloss: 'hombre' },
  '女人': { pinyin: 'nǚrén', gloss: 'mujer' },
  '孩子': { pinyin: 'háizi', gloss: 'niño' },
  '中文': { pinyin: 'zhōngwén', gloss: 'idioma chino' },
  '汉语': { pinyin: 'hànyǔ', gloss: 'lengua china' },
  '英语': { pinyin: 'yīngyǔ', gloss: 'idioma inglés' },
  '中国': { pinyin: 'zhōngguó', gloss: 'China' },
  '信': { pinyin: 'xìn', gloss: 'carta' },
  '故事': { pinyin: 'gùshi', gloss: 'historia' },
  '生活': { pinyin: 'shēnghuó', gloss: 'vida' },
  '世界': { pinyin: 'shìjiè', gloss: 'mundo' },
  '地方': { pinyin: 'dìfang', gloss: 'lugar' },
  '家': { pinyin: 'jiā', gloss: 'casa / familia' },
  '学校': { pinyin: 'xuéxiào', gloss: 'escuela' },
  '咖啡': { pinyin: 'kāfēi', gloss: 'café' },
  '茶': { pinyin: 'chá', gloss: 'té' },
  '水': { pinyin: 'shuǐ', gloss: 'agua' },
  '问题': { pinyin: 'wèntí', gloss: 'pregunta / problema' },
  '名字': { pinyin: 'míngzi', gloss: 'nombre' },
  '子轩': { pinyin: 'Zǐxuān', gloss: 'Zixuan (nombre)' },
  '视频': { pinyin: 'shìpín', gloss: 'vídeo' },
  '音乐': { pinyin: 'yīnyuè', gloss: 'música' },

  // Adjectives
  '好': { pinyin: 'hǎo', gloss: 'bien / bueno' },
  '很多': { pinyin: 'hěn duō', gloss: 'muchos / mucho' },
  '多': { pinyin: 'duō', gloss: 'mucho' },
  '少': { pinyin: 'shǎo', gloss: 'poco' },
  '大': { pinyin: 'dà', gloss: 'grande' },
  '小': { pinyin: 'xiǎo', gloss: 'pequeño' },
  '高': { pinyin: 'gāo', gloss: 'alto' },
  '高兴': { pinyin: 'gāoxìng', gloss: 'contento' },
  '开心': { pinyin: 'kāixīn', gloss: 'feliz' },
  '快乐': { pinyin: 'kuàilè', gloss: 'alegre' },
  '漂亮': { pinyin: 'piàoliang', gloss: 'bonito / hermoso' },
  '累': { pinyin: 'lèi', gloss: 'cansado' },
  '困': { pinyin: 'kùn', gloss: 'con sueño' },
  '难': { pinyin: 'nán', gloss: 'difícil' },
  '容易': { pinyin: 'róngyì', gloss: 'fácil' },
  '对': { pinyin: 'duì', gloss: 'correcto / sí' },
  '重要': { pinyin: 'zhòngyào', gloss: 'importante' },

  // Adverbs & Conjunctions
  '很': { pinyin: 'hěn', gloss: 'muy' },
  '太': { pinyin: 'tài', gloss: 'demasiado' },
  '非常': { pinyin: 'fēicháng', gloss: 'sumamente' },
  '真': { pinyin: 'zhēn', gloss: 'realmente' },
  '真的': { pinyin: 'zhēn de', gloss: 'de verdad' },
  '不': { pinyin: 'bù', gloss: 'no' },
  '没': { pinyin: 'méi', gloss: 'no tener / no' },
  '没有': { pinyin: 'méiyǒu', gloss: 'no hay / no tener' },
  '也': { pinyin: 'yě', gloss: 'también' },
  '都': { pinyin: 'dōu', gloss: 'todos / ya' },
  '还': { pinyin: 'hái', gloss: 'todavía / aún' },
  '还有': { pinyin: 'háiyǒu', gloss: 'además / y' },
  '就': { pinyin: 'jiù', gloss: 'entonces / ya' },
  '只': { pinyin: 'zhǐ', gloss: 'solamente' },
  '一起': { pinyin: 'yìqǐ', gloss: 'juntos' },
  '常常': { pinyin: 'chángcháng', gloss: 'a menudo' },
  '因为': { pinyin: 'yīnwèi', gloss: 'porque' },
  '所以': { pinyin: 'suǒyǐ', gloss: 'por eso' },
  '但是': { pinyin: 'dànshì', gloss: 'pero' },
  '如果': { pinyin: 'rúguǒ', gloss: 'si (condicional)' },
  '虽然': { pinyin: 'suīrán', gloss: 'aunque' },
  '然后': { pinyin: 'ránhòu', gloss: 'luego / después' },
  '和': { pinyin: 'hé', gloss: 'y / con' },
  '跟你': { pinyin: 'gēn nǐ', gloss: 'contigo' },
  '跟你说': { pinyin: 'gēn nǐ shuō', gloss: 'decirte a ti' },
  '和你': { pinyin: 'hé nǐ', gloss: 'contigo' },

  // Particles & Measure words
  '的': { pinyin: 'de', gloss: 'de' },
  '地': { pinyin: 'de', gloss: '-mente (adverbio)' },
  '得': { pinyin: 'de', gloss: 'de (grado)' },
  '了': { pinyin: 'le', gloss: 'ya / aspecto' },
  '吗': { pinyin: 'ma', gloss: '¿acaso?' },
  '呢': { pinyin: 'ne', gloss: '¿y...?' },
  '吧': { pinyin: 'ba', gloss: '¿verdad? / vamos' },
  '着': { pinyin: 'zhe', gloss: 'aspecto continuo' },
  '过': { pinyin: 'guo', gloss: 'experiencia previa' },
  '个': { pinyin: 'gè', gloss: 'clasif. general' },
  '封': { pinyin: 'fēng', gloss: 'clasif. cartas' },
  '件': { pinyin: 'jiàn', gloss: 'clasif. asuntos/ropa' },
  '条': { pinyin: 'tiáo', gloss: 'clasif. largo' },
  '点': { pinyin: 'diǎn', gloss: 'un poco / punto' },
  '些': { pinyin: 'xiē', gloss: 'algunos' },
  '一': { pinyin: 'yī', gloss: 'uno' },
  '二': { pinyin: 'èr', gloss: 'dos' },
  '三': { pinyin: 'sān', gloss: 'tres' },
  '四': { pinyin: 'sì', gloss: 'cuatro' },
  '五': { pinyin: 'wǔ', gloss: 'cinco' },
  '六': { pinyin: 'liù', gloss: 'seis' },
  '七': { pinyin: 'qī', gloss: 'siete' },
  '八': { pinyin: 'bā', gloss: 'ocho' },
  '九': { pinyin: 'jiǔ', gloss: 'nueve' },
  '十': { pinyin: 'shí', gloss: 'diez' },
  '两': { pinyin: 'liǎng', gloss: 'dos (cantidad)' }
};

export const PUNCTUATION_REGEX = /^[，。！？；：、“”‘’（）《》…—,.!?;:'"()\- \t]+$/;

/**
 * Retrieve effective API key from argument or client configuration in localStorage
 */
export function getEffectiveApiKey(explicitKey = '') {
  if (explicitKey && typeof explicitKey === 'string' && explicitKey.trim()) {
    return explicitKey.trim().replace(/^["']|["']$/g, '');
  }
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const saved = localStorage.getItem('linguaflow_config');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed?.apiKey) {
          return parsed.apiKey.trim().replace(/^["']|["']$/g, '');
        }
      }
    }
  } catch (e) {}
  return '';
}

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
 * Rigorously checks whether a subtitle line is completely and authentically glossed.
 * Every substantive (non-punctuation) token must have a valid non-empty gloss string.
 * For Chinese, every substantive token with Chinese characters must also have tone-marked Pinyin.
 */
export function isGlossComplete(sub, targetLang = 'zh') {
  if (!sub || typeof sub !== 'object') return false;
  if (!Array.isArray(sub.tokens) || sub.tokens.length === 0) return false;

  const substantiveTokens = sub.tokens.filter(t => {
    if (!t) return false;
    if (t.isPunctuation) return false;
    const word = (t.text || t.word || '').trim();
    if (!word) return false;
    return !/^[\s.,/#!$%^&*;:{}=\-_`~()¿?¡!，。！？；：、“”‘’（）《》…—]+$/.test(word);
  });

  // If the line consists strictly of punctuation/notes, it's considered complete
  if (substantiveTokens.length === 0) return true;

  for (const token of substantiveTokens) {
    const gloss = typeof token.gloss === 'string' ? token.gloss.trim() : '';
    if (!gloss) {
      return false;
    }
    const word = (token.text || token.word || '').trim();
    if (gloss === word) {
      return false;
    }

    // For Chinese, check that Chinese characters have pinyin
    if (targetLang === 'zh' && /[\u4e00-\u9fa5]/.test(word)) {
      const pinyin = typeof token.pinyin === 'string' ? token.pinyin.trim() : '';
      if (!pinyin) {
        return false;
      }
    }
  }

  // Consistency check for Chinese: e.g. a 6+ character sentence shouldn't have only 1 substantive token
  if (targetLang === 'zh') {
    const rawChineseChars = (sub.text || '').replace(/[^\u4e00-\u9fa5]/g, '');
    if (rawChineseChars.length >= 6 && substantiveTokens.length <= 1) {
      return false;
    }
  }

  return true;
}

/**
 * Call backend batch gloss endpoint to enrich a set of lines with AI glosses.
 * Crucially passes the client pre-segmented words and effective API key.
 */
export async function fetchBatchGlossesApi(lines, targetLang = 'zh', nativeLang = 'es', apiKey = '') {
  if (!Array.isArray(lines) || lines.length === 0) return [];

  const url = `${API_BASE_URL}/api/batch-gloss`;
  const fallbackUrl = `${API_BASE_URL}/batch-gloss`;
  const effectiveKey = getEffectiveApiKey(apiKey);

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
    nativeLang,
    apiKey: effectiveKey
  };

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 28000);

      const headers = { 'Content-Type': 'application/json' };
      if (effectiveKey) {
        headers['x-api-key'] = effectiveKey;
      }

      let res = await fetch(url, {
        method: 'POST',
        headers,
        signal: controller.signal,
        body: JSON.stringify(payload)
      });

      if (!res.ok && res.status === 404) {
        res = await fetch(fallbackUrl, {
          method: 'POST',
          headers,
          signal: controller.signal,
          body: JSON.stringify(payload)
        });
      }

      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.lines)) {
          const linesResult = data.lines;
          linesResult.isComplete = Boolean(data.isComplete);
          linesResult.missingIds = data.missingIds || [];
          return linesResult;
        }
      }
    } catch (err) {
      console.warn(`Attempt ${attempt + 1} for batch gloss failed:`, err.message);
      if (attempt === 0) {
        await new Promise(r => setTimeout(r, 1000));
      }
    }
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
 * Robust matching to find the subtitle index in the full list corresponding to an AI response item.
 * Supports:
 * 1. Exact ID string match
 * 2. Numeric normalization (e.g. srt_1 vs line_1 vs 1)
 * 3. Positional index in the requested chunk
 * 4. Subtitle text matching
 */
export function findMatchingSubtitleIndex(subtitlesList, chunkList, aiItem, itemIndex) {
  if (!aiItem || !Array.isArray(subtitlesList)) return -1;
  const rawId = String(aiItem.id || '').trim();
  const digitsOnly = rawId.replace(/\D+/g, '');

  // 1. Direct exact ID match
  let idx = subtitlesList.findIndex(s => String(s.id).trim() === rawId);
  if (idx !== -1) return idx;

  // 2. Numeric match (e.g. srt_1 vs 1 vs line_1)
  if (digitsOnly) {
    idx = subtitlesList.findIndex(s => String(s.id).replace(/\D+/g, '') === digitsOnly);
    if (idx !== -1) return idx;
  }

  // 3. Positional match within the chunk that was sent
  if (Array.isArray(chunkList) && chunkList[itemIndex]) {
    const chunkSubId = chunkList[itemIndex].id;
    idx = subtitlesList.findIndex(s => s.id === chunkSubId);
    if (idx !== -1) return idx;
  }

  // 4. Text match
  if (aiItem.text) {
    const cleanText = aiItem.text.trim();
    idx = subtitlesList.findIndex(s => s.text && (s.text.trim() === cleanText || s.text.includes(cleanText)));
    if (idx !== -1) return idx;
  }

  return -1;
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
    let match = aiMap.get(w);

    // If compound word had no direct match, check if AI returned constituent characters
    if (!match && w.length > 1) {
      const chars = [...w];
      const subMatches = chars.map(c => aiMap.get(c)).filter(Boolean);
      if (subMatches.length === chars.length) {
        match = {
          pinyin: subMatches.map(m => m.pinyin).filter(Boolean).join(' '),
          gloss: subMatches.map(m => m.gloss).filter(Boolean).join(' ')
        };
      }
    }

    if (match) {
      const pinyin = match.pinyin || orig.pinyin;
      let gloss = match.gloss || orig.gloss;

      // Sanitize: never allow gloss to duplicate pinyin or the Chinese word itself (except when gloss is genuinely a valid Spanish word like 'de')
      if (gloss && (gloss === pinyin || gloss === w)) {
        if (w === '的' && gloss.toLowerCase() === 'de') {
          gloss = 'de';
        } else {
          gloss = orig.gloss && orig.gloss !== pinyin ? orig.gloss : null;
        }
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
 * 3. Enqueues all incomplete lines in safe chunks of 5 lines (prevents response truncation)
 * 4. Validates returned IDs & completeness; retries any missing or incomplete lines up to 2 times
 * 5. Triggers onUpdate callback as each batch finishes so the user sees real-time glossing
 * 6. Provides onProgress callback with exact verified completed counts (e.g. 28 / 30 lines glossed)
 */
export function enrichSubtitlesWithGlosses({
  subtitles = [],
  targetLang = 'zh',
  nativeLang = 'es',
  apiKey = '',
  videoId = '',
  onUpdate = null,
  onProgress = null
}) {
  if (!Array.isArray(subtitles) || subtitles.length === 0) {
    return subtitles;
  }

  const totalSubtitles = subtitles.length;
  const cache = loadCachedGlosses(videoId, totalSubtitles);

  // Phase 1: Apply offline tokenization & merge cached AI tokens if available
  const prepared = subtitles.map(sub => {
    const offlineTokens = tokenizeAndGlossLineOffline(sub.text, targetLang);

    if (cache[sub.id] && Array.isArray(cache[sub.id]) && cache[sub.id].length > 0) {
      const mergedTokens = mergeAiTokensWithSegmented(offlineTokens, cache[sub.id]);
      return {
        ...sub,
        tokens: mergedTokens
      };
    }

    return {
      ...sub,
      tokens: offlineTokens
    };
  });

  const getCompletedCount = (subsList) => subsList.filter(s => isGlossComplete(s, targetLang)).length;
  const initialCompleted = getCompletedCount(prepared);

  // Identify lines that still need AI glossing (not complete)
  const missingLines = prepared.filter(sub => !isGlossComplete(sub, targetLang));

  if (missingLines.length === 0) {
    if (onProgress) {
      onProgress({
        total: totalSubtitles,
        completed: totalSubtitles,
        isGlossing: false,
        isComplete: true,
        failed: 0
      });
    }
    return prepared;
  }

  if (onProgress) {
    onProgress({
      total: totalSubtitles,
      completed: initialCompleted,
      isGlossing: true,
      isComplete: false,
      failed: 0
    });
  }

  if (!onUpdate) {
    return prepared;
  }

  // Phase 2: Reliable batch processing in small chunks of 5 lines + retrying missing IDs
  const CHUNK_SIZE = 5;
  const MAX_RETRIES = 2; // Up to 2 retries per missing line
  const retryCountMap = new Map();

  const initialChunks = [];
  for (let i = 0; i < missingLines.length; i += CHUNK_SIZE) {
    initialChunks.push(missingLines.slice(i, i + CHUNK_SIZE));
  }

  (async () => {
    let currentSubtitles = [...prepared];

    // Helper to process a single batch of lines
    const processBatch = async (batch) => {
      if (!Array.isArray(batch) || batch.length === 0) return [];

      const aiResults = await fetchBatchGlossesApi(batch, targetLang, nativeLang, apiKey);
      let hasNewData = false;

      if (Array.isArray(aiResults) && aiResults.length > 0) {
        aiResults.forEach((item, itemIdx) => {
          if (item && Array.isArray(item.tokens) && item.tokens.length > 0) {
            const idx = findMatchingSubtitleIndex(currentSubtitles, batch, item, itemIdx);
            if (idx !== -1) {
              const sub = currentSubtitles[idx];
              const mergedTokens = mergeAiTokensWithSegmented(sub.tokens, item.tokens);
              const candidateSub = {
                ...sub,
                tokens: mergedTokens
              };

              currentSubtitles[idx] = candidateSub;
              hasNewData = true;

              // Only persist to cache if the gloss is verified complete!
              if (isGlossComplete(candidateSub, targetLang)) {
                cache[sub.id] = mergedTokens;
              }
            }
          }
        });
      }

      if (hasNewData) {
        saveCachedGlosses(videoId, totalSubtitles, cache);
        if (onUpdate) {
          onUpdate([...currentSubtitles]);
        }
      }

      if (onProgress) {
        const completed = getCompletedCount(currentSubtitles);
        onProgress({
          total: totalSubtitles,
          completed,
          isGlossing: true,
          isComplete: completed === totalSubtitles,
          failed: 0
        });
      }

      // Identify which lines in this batch are STILL incomplete
      const stillIncomplete = batch.filter(sub => {
        const current = currentSubtitles.find(s => s.id === sub.id) || sub;
        return !isGlossComplete(current, targetLang);
      });

      return stillIncomplete;
    };

    const pendingRetries = [];

    // Pass 1: Process initial chunks of 5 lines
    for (const chunk of initialChunks) {
      const incomplete = await processBatch(chunk);
      for (const sub of incomplete) {
        const attempts = (retryCountMap.get(sub.id) || 0) + 1;
        retryCountMap.set(sub.id, attempts);
        if (attempts <= MAX_RETRIES) {
          pendingRetries.push(currentSubtitles.find(s => s.id === sub.id) || sub);
        }
      }
      await new Promise(r => setTimeout(r, 200));
    }

    // Pass 2 & 3: Retry missing or incomplete lines in smaller batches of 3
    while (pendingRetries.length > 0) {
      const retryBatch = pendingRetries.splice(0, 3);
      const incomplete = await processBatch(retryBatch);
      for (const sub of incomplete) {
        const attempts = (retryCountMap.get(sub.id) || 0) + 1;
        retryCountMap.set(sub.id, attempts);
        if (attempts <= MAX_RETRIES) {
          pendingRetries.push(currentSubtitles.find(s => s.id === sub.id) || sub);
        } else {
          console.warn(`Subtitle line "${sub.id}" reached max retries (${MAX_RETRIES}). Retaining best partial gloss.`);
        }
      }
      await new Promise(r => setTimeout(r, 300));
    }

    // Final verified progress update
    const finalCompleted = getCompletedCount(currentSubtitles);
    const failed = totalSubtitles - finalCompleted;
    if (onProgress) {
      onProgress({
        total: totalSubtitles,
        completed: finalCompleted,
        isGlossing: false,
        isComplete: finalCompleted === totalSubtitles,
        failed
      });
    }
  })().catch(err => {
    console.warn('Background batch glossing notice:', err);
    if (onProgress) {
      const finalCompleted = getCompletedCount(prepared);
      onProgress({
        total: totalSubtitles,
        completed: finalCompleted,
        isGlossing: false,
        isComplete: finalCompleted === totalSubtitles,
        failed: totalSubtitles - finalCompleted
      });
    }
  });

  return prepared;
}

