import React, { useState, useMemo } from 'react';
import { Volume2, Globe, CheckCircle2, Copy, Check, BookOpen, Trash2 } from 'lucide-react';
import { ChineseWritingPractice } from './ChineseWritingPractice.jsx';
import { useSiteLanguage } from '../context/SiteLanguageContext.jsx';
import { CHINESE_OFFLINE_DICT } from '../services/languageGlossStrategies.js';
import { useSavedWords } from '../context/SavedWordsContext.jsx';

export function ChatMessage({
  message,
  targetLang,
  nativeLang,
  showTransliteration,
  onWordClick,
  onPlayAudio,
  isAudioPlaying,
  onOpenGrammarBreakdown,
  onDeleteMessage
}) {
  const { t, isSpanish } = useSiteLanguage();
  const { isWordSaved } = useSavedWords();
  const [showTranslation, setShowTranslation] = useState(false);
  const [copied, setCopied] = useState(false);
  const [writingPracticeOpen, setWritingPracticeOpen] = useState(false);
  const [writingPracticeMode, setWritingPracticeMode] = useState('words'); // 'words' | 'sentence'
  const isUser = message.sender === 'user';

  const handleOpenWritingPractice = (mode) => {
    setWritingPracticeMode(mode);
    setWritingPracticeOpen(true);
  };

  // Check if current message is in Arabic script
  const isArabic = targetLang === 'ar' ||
    /[\u0600-\u06FF]/.test(message.text || '') ||
    (message.correctedText && /[\u0600-\u06FF]/.test(message.correctedText));

  const handleCopy = () => {
    const textToCopy = isUser ? (message.correctedText || message.text) : message.text;
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  // Chinese punctuation mapping and separation helper
  const PUNC_MAP = {
    ',': '，',
    '?': '？',
    '!': '！',
    '.': '。',
    ':': '：',
    ';': '；'
  };

  const splitChineseWordAndPunctuation = (word = '', translit = '') => {
    let cleanTranslit = (translit || '').trim();
    let punc = '';

    // 1. Check if translit contains trailing/leading punctuation
    const translitPuncMatch = cleanTranslit.match(/[，。！？；：、“”‘’（）《》…—,.!?;:'"()\-~]+$/);
    if (translitPuncMatch) {
      punc = translitPuncMatch[0].split('').map(c => PUNC_MAP[c] || c).join('');
      cleanTranslit = cleanTranslit.slice(0, -translitPuncMatch[0].length).trim();
    }
    cleanTranslit = cleanTranslit.replace(/[，。！？；：、“”‘’（）《》…—,.!?;:'"()\-~]+/g, '').trim();

    // 2. Check if word itself contains trailing punctuation
    let baseWord = (word || '').trim();
    const wordPuncMatch = baseWord.match(/[，。！？；：、“”‘’（）《》…—,.!?;:'"()\-~]+$/);
    if (wordPuncMatch) {
      punc = wordPuncMatch[0].split('').map(c => PUNC_MAP[c] || c).join('');
      baseWord = baseWord.slice(0, -wordPuncMatch[0].length).trim();
    }

    return {
      baseWord,
      cleanTranslit: cleanTranslit || null,
      punctuation: punc || null
    };
  };

  // Helper for rendering transliteration in user bubble (luminous, clear rose-tinted white)
  const renderUserRubyWord = (word, translit, key) => {
    if (targetLang === 'zh') {
      const { baseWord, cleanTranslit, punctuation } = splitChineseWordAndPunctuation(word, translit);

      if (!baseWord && punctuation) {
        return (
          <span key={key} className="text-white/90 text-[15px] sm:text-base font-normal select-text">
            {punctuation}
          </span>
        );
      }

      const isSaved = isWordSaved(baseWord, targetLang);

      return (
        <React.Fragment key={key}>
          {showTransliteration && cleanTranslit ? (
            <ruby className="user-ruby mx-0.5 inline-flex flex-col items-center">
              <rt dir="ltr" className="text-[12px] leading-tight text-pink-100 font-extrabold tracking-wider select-none drop-shadow-xs">
                {cleanTranslit}
              </rt>
              <span dir="ltr" className={`leading-relaxed ${isSaved ? 'bg-amber-300 text-stone-950 font-bold px-1 rounded shadow-xs' : ''}`}>{baseWord}</span>
            </ruby>
          ) : (
            <span dir="ltr" className={isSaved ? 'bg-amber-300 text-stone-950 font-bold px-1 rounded shadow-xs' : ''}>{baseWord}</span>
          )}
          {punctuation && (
            <span className="text-white/90 text-[15px] sm:text-base font-normal select-text">
              {punctuation}
            </span>
          )}
        </React.Fragment>
      );
    }

    const isSaved = isWordSaved(word, targetLang);
    if (showTransliteration && translit) {
      return (
        <ruby key={key} className="user-ruby mx-0.5 inline-flex flex-col items-center">
          <rt dir="ltr" className="text-[12px] leading-tight text-pink-100 font-extrabold tracking-wider select-none drop-shadow-xs">
            {translit}
          </rt>
          <span dir={isArabic ? 'rtl' : 'ltr'} className={`leading-relaxed ${isSaved ? 'bg-amber-300 text-stone-950 font-bold px-1 rounded shadow-xs' : ''}`}>{word}</span>
        </ruby>
      );
    }
    return <span key={key} dir={isArabic ? 'rtl' : 'ltr'} className={isSaved ? 'bg-amber-300 text-stone-950 font-bold px-1 rounded shadow-xs' : ''}>{word}</span>;
  };

  // Common Chinese Pinyin lexicon for guaranteed fallback
  const PINYIN_LEXICON = {
    '你好': 'nǐ hǎo', '您好': 'nín hǎo', '我': 'wǒ', '你': 'nǐ', '他': 'tā', '她': 'tā',
    '我们': 'wǒmen', '你们': 'nǐmen', '他们': 'tāmen', '想': 'xiǎng', '要': 'yào',
    '学': 'xué', '学习': 'xuéxí', '中文': 'zhōngwén', '汉语': 'hànyǔ', '说': 'shuō',
    '吃': 'chī', '喝': 'hē', '咖啡': 'kāfēi', '茶': 'chá', '水': 'shuǐ', '很': 'hěn',
    '太': 'tài', '好': 'hǎo', '高兴': 'gāoxìng', '累': 'lèi', '困': 'kùn',
    '睡觉': 'shuìjiào', '谢谢': 'xièxie', '不客气': 'bù kèqi', '再见': 'zàijiàn',
    '是': 'shì', '不': 'bù', '的': 'de', '了': 'le', '吗': 'ma', '呢': 'ne',
    '在': 'zài', '有': 'yǒu', '什么': 'shénme', '怎么': 'zěnme'
  };

  const resolveTranslit = (token) => {
    if (!token) return null;
    if (typeof token === 'string') return null;
    if (token.translit) return token.translit;
    if (token.pinyin) return token.pinyin;
    if (targetLang === 'zh') {
      const clean = (token.text || token.word || '').trim();
      if (PINYIN_LEXICON[clean]) return PINYIN_LEXICON[clean];
    }
    return null;
  };

  // USER MESSAGE BUBBLE
  if (isUser) {
    const diffTokens = message.diffTokens || [];
    const hasCorrection = message.hasCorrection || diffTokens.some(t => t.changed);
    const isChinese = targetLang === 'zh';

    return (
      <div className="flex flex-col items-end my-4 animate-fade-in group">
        <div className="flex items-center space-x-2 mb-1 px-1">
          <span className="text-xs font-semibold text-rose-200/80">{isSpanish ? 'Tú' : 'You'}</span>
          {hasCorrection ? (
            <span className="flex items-center space-x-1.5 text-[11px] font-semibold text-amber-200 bg-amber-950/80 px-2.5 py-0.5 rounded-full border border-amber-700/80 shadow-xs">
              <CheckCircle2 className="w-3.5 h-3.5 text-amber-300" />
              <span>{isSpanish ? 'Corregido automáticamente' : 'Auto-corrected'}</span>
            </span>
          ) : (
            <span className="flex items-center space-x-1.5 text-[11px] font-semibold text-emerald-200 bg-emerald-950/80 px-2.5 py-0.5 rounded-full border border-emerald-700/80 shadow-xs" title={isSpanish ? '¡Tu frase es correcta! Sin errores' : 'Your sentence is correct! No errors'}>
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>{t('no_errors')}</span>
            </span>
          )}
        </div>

        {/* User Message Row with Delete Button on the Left */}
        <div className="flex items-center justify-end gap-2 w-full">
          {onDeleteMessage && (
            <button
              type="button"
              onClick={() => onDeleteMessage(message.id)}
              className="p-1.5 text-stone-400 hover:text-rose-500 hover:bg-rose-50/50 dark:hover:bg-stone-800 rounded-lg transition-colors cursor-pointer shrink-0 opacity-70 hover:opacity-100"
              title={t('delete_message')}
              aria-label={t('delete_message')}
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}

          <div className="max-w-[88%] sm:max-w-[78%] bg-gradient-to-r from-rose-600 via-rose-500 to-pink-600 text-white rounded-2xl rounded-tr-xs px-4 py-3 shadow-lg shadow-black/30 border border-rose-400/30">
          {/* Main text display with RTL support for Arabic and Ruby Pinyin for Chinese */}
          <div
            dir={isArabic ? 'rtl' : 'ltr'}
            className={`${
              isArabic
                ? 'font-arabic text-right text-lg sm:text-xl leading-loose tracking-normal'
                : 'text-left text-[15px] sm:text-base leading-relaxed tracking-wide font-normal'
            }`}
          >
            {diffTokens && diffTokens.length > 0 ? (
              diffTokens.map((token, idx) => {
                const rawWord = token.text || '';
                const cleanWord = rawWord.trim();
                if (!cleanWord) return null;
                const needsSpace = !isChinese && idx > 0;
                const tokenTranslit = resolveTranslit(token);

                if (token.changed) {
                  if (isChinese) {
                    const { baseWord, cleanTranslit, punctuation } = splitChineseWordAndPunctuation(cleanWord, tokenTranslit);
                    return (
                      <React.Fragment key={idx}>
                        {needsSpace && ' '}
                        <span
                          dir="ltr"
                          className="relative inline-block mx-0.5 text-amber-300 font-extrabold tracking-wide underline decoration-amber-400/70 decoration-2 underline-offset-4 cursor-help group/word"
                          title={token.original ? `Original: "${token.original}"` : 'Palabra corregida'}
                        >
                          {showTransliteration && cleanTranslit ? (
                            <ruby className="user-ruby inline-flex flex-col items-center">
                              <rt dir="ltr" className="text-[11px] text-amber-200 font-black leading-tight select-none">
                                {cleanTranslit}
                              </rt>
                              <span>{baseWord}</span>
                            </ruby>
                          ) : (
                            <span>{baseWord}</span>
                          )}
                          {token.original && (
                            <span dir="ltr" className="hidden group-hover/word:block absolute bottom-full left-1/2 -translate-x-1/2 mb-1 z-20 whitespace-nowrap bg-stone-900 text-white text-[11px] px-2 py-0.5 rounded shadow-lg border border-stone-700">
                              Original: <span className="line-through text-rose-300">{token.original}</span>
                            </span>
                          )}
                        </span>
                        {punctuation && (
                          <span className="text-white/90 text-[15px] sm:text-base font-normal select-text">
                            {punctuation}
                          </span>
                        )}
                      </React.Fragment>
                    );
                  }

                  return (
                    <React.Fragment key={idx}>
                      {needsSpace && ' '}
                      <span
                        dir={isArabic ? 'rtl' : 'ltr'}
                        className="relative inline-block mx-0.5 text-amber-300 font-extrabold tracking-wide underline decoration-amber-400/70 decoration-2 underline-offset-4 cursor-help group/word"
                        title={token.original ? `Original: "${token.original}"` : 'Palabra corregida'}
                      >
                        {showTransliteration && tokenTranslit ? (
                          <ruby className="user-ruby inline-flex flex-col items-center">
                            <rt dir="ltr" className="text-[11px] text-amber-200 font-black leading-tight select-none">
                              {tokenTranslit}
                            </rt>
                            <span dir={isArabic ? 'rtl' : 'ltr'}>{cleanWord}</span>
                          </ruby>
                        ) : (
                          <span dir={isArabic ? 'rtl' : 'ltr'}>{cleanWord}</span>
                        )}
                        {token.original && (
                          <span dir="ltr" className="hidden group-hover/word:block absolute bottom-full left-1/2 -translate-x-1/2 mb-1 z-20 whitespace-nowrap bg-stone-900 text-white text-[11px] px-2 py-0.5 rounded shadow-lg border border-stone-700">
                            Original: <span className="line-through text-rose-300">{token.original}</span>
                          </span>
                        )}
                      </span>
                    </React.Fragment>
                  );
                }

                return (
                  <React.Fragment key={idx}>
                    {needsSpace && ' '}
                    {renderUserRubyWord(cleanWord, tokenTranslit, idx)}
                  </React.Fragment>
                );
              })
            ) : (
              <span dir={isArabic ? 'rtl' : 'ltr'}>{message.text}</span>
            )}
          </div>

          {/* Action buttons on user message */}
          <div className="mt-2.5 pt-1.5 border-t border-white/20 flex flex-wrap items-center justify-between gap-1.5 text-rose-100 text-xs">
            <div className="flex items-center space-x-1.5">
              {/* Sentence Grammar Breakdown button */}
              <button
                type="button"
                onClick={() => onOpenGrammarBreakdown && onOpenGrammarBreakdown(message)}
                className="px-2 py-1 bg-white/15 hover:bg-white/25 active:scale-95 rounded-lg transition-all flex items-center space-x-1 text-white text-[11px] font-semibold shadow-xs cursor-pointer"
                title={isSpanish ? "Ver desglose gramatical detallado de cada palabra" : "View detailed word-by-word grammar breakdown"}
              >
                <BookOpen className="w-3 h-3 text-amber-200" />
                <span>{t('view_breakdown')}</span>
              </button>

              {/* Chinese Writing Practice Button (Between Desglose and Escuchar) */}
              {isChinese && (
                <button
                  type="button"
                  onClick={() => handleOpenWritingPractice(hasCorrection ? 'words' : 'sentence')}
                  className="px-2 py-1 bg-white/15 hover:bg-white/25 active:scale-95 rounded-lg transition-all flex items-center space-x-1 text-white text-[11px] font-semibold shadow-xs cursor-pointer"
                  title={isSpanish ? "Practicar trazos de escritura en chino con Hanzi Writer" : "Practice Chinese stroke writing with Hanzi Writer"}
                >
                  <span className="text-xs leading-none">✍️</span>
                  <span>{t('practice_writing_short')}</span>
                </button>
              )}
            </div>

            <div className="flex items-center space-x-1">
              <button
                onClick={() => onPlayAudio(message.correctedText || message.text)}
                className="p-1 hover:text-white hover:bg-white/20 rounded-md transition-colors flex items-center space-x-1 cursor-pointer"
                title={isSpanish ? "Escuchar pronunciación correcta" : "Listen to correct pronunciation"}
              >
                <Volume2 className="w-3.5 h-3.5" />
                <span className="text-[11px] font-medium">{t('listen')}</span>
              </button>
              <button
                onClick={handleCopy}
                className="p-1 hover:text-white hover:bg-white/20 rounded-md transition-colors cursor-pointer"
                title={copied ? (isSpanish ? "Copiado" : "Copied") : (isSpanish ? "Copiar texto" : "Copy text")}
              >
                {copied ? <Check className="w-3.5 h-3.5 text-amber-200" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>
        </div>
      </div>

        {/* Chinese Writing Practice Modal */}
        {writingPracticeOpen && (
          <ChineseWritingPractice
            isOpen={writingPracticeOpen}
            onClose={() => setWritingPracticeOpen(false)}
            initialMode={writingPracticeMode}
            correctedText={message.correctedText || message.text}
            diffTokens={message.diffTokens || []}
            showTransliteration={showTransliteration}
          />
        )}
      </div>
    );
  }

  // BOT MESSAGE BUBBLE
  const tokens = message.tokens || [];

  // Reconcile message.text with tokens to guarantee 100% full text rendering without truncation
  const botSegments = useMemo(() => {
    const rawText = message.text || '';
    if (!rawText) return [];

    const isChinese = targetLang === 'zh';
    const result = [];
    let pos = 0;
    let tIdx = 0;
    const len = rawText.length;

    const matchesTokenAtPos = (token, p) => {
      if (!token) return null;
      const tokenObj = typeof token === 'string' ? { word: token } : token;
      const word = (tokenObj.word || tokenObj.text || '').trim();
      const clean = (tokenObj.clean_word || '').trim();

      if (word && rawText.startsWith(word, p)) {
        return { length: word.length, tokenObj };
      }
      if (clean && rawText.startsWith(clean, p)) {
        return { length: clean.length, tokenObj };
      }
      return null;
    };

    while (pos < len) {
      const remaining = rawText.slice(pos);

      // 1. Whitespace
      const spaceMatch = remaining.match(/^(\s+)/);
      if (spaceMatch) {
        result.push({
          type: 'space',
          text: spaceMatch[1]
        });
        pos += spaceMatch[1].length;
        continue;
      }

      // 2. Try matching next token from tokens array if available
      if (tIdx < tokens.length) {
        const match = matchesTokenAtPos(tokens[tIdx], pos);
        if (match) {
          result.push({
            type: 'word',
            text: rawText.slice(pos, pos + match.length),
            token: match.tokenObj,
            matchedFromTokens: true
          });
          pos += match.length;
          tIdx++;
          continue;
        }

        // Check if leading punctuation is present in text before token
        const punctMatch = remaining.match(/^([.,!?;:()¿¡'"“”‘’—–\-_/\\`~，。！？；：、“”‘’（）《》…]+)/);
        if (punctMatch) {
          const pStr = punctMatch[1];
          const afterPunct = pos + pStr.length;
          const matchAfterPunct = matchesTokenAtPos(tokens[tIdx], afterPunct);
          if (matchAfterPunct) {
            result.push({
              type: 'punctuation',
              text: pStr
            });
            pos += pStr.length;
            result.push({
              type: 'word',
              text: rawText.slice(pos, pos + matchAfterPunct.length),
              token: matchAfterPunct.tokenObj,
              matchedFromTokens: true
            });
            pos += matchAfterPunct.length;
            tIdx++;
            continue;
          }
        }
      }

      // 3. Fallback segmenting from text directly
      const punctMatch = remaining.match(/^([.,!?;:()¿¡'"“”‘’—–\-_/\\`~，。！？；：、“”‘’（）《》…]+)/);
      if (punctMatch) {
        result.push({
          type: 'punctuation',
          text: punctMatch[1]
        });
        pos += punctMatch[1].length;
        continue;
      }

      if (isChinese) {
        let matchedLen = 1;
        let matchedDict = null;
        for (let l = Math.min(6, remaining.length); l >= 2; l--) {
          const cand = remaining.slice(0, l);
          if (CHINESE_OFFLINE_DICT && CHINESE_OFFLINE_DICT[cand]) {
            matchedLen = l;
            matchedDict = CHINESE_OFFLINE_DICT[cand];
            break;
          }
        }
        const wordStr = remaining.slice(0, matchedLen);
        result.push({
          type: 'word',
          text: wordStr,
          token: {
            word: wordStr,
            clean_word: wordStr,
            translit: matchedDict?.pinyin || PINYIN_LEXICON[wordStr] || null
          },
          matchedFromTokens: false
        });
        pos += matchedLen;
      } else {
        const wordMatch = remaining.match(/^[^\s.,!?;:()¿¡'"“”‘’—–\-_/\\`~，。！？；：、“”‘’（）《》…]+/);
        if (wordMatch) {
          const wordStr = wordMatch[0];
          result.push({
            type: 'word',
            text: wordStr,
            token: {
              word: wordStr,
              clean_word: wordStr.replace(/[.,/#!$%^&*;:{}=\-_`~()¿?¡!]/g, '')
            },
            matchedFromTokens: false
          });
          pos += wordStr.length;
        } else {
          result.push({
            type: 'text',
            text: rawText[pos]
          });
          pos += 1;
        }
      }
    }

    return result;
  }, [message.text, tokens, targetLang]);

  return (
    <div className="flex flex-col items-start my-4 animate-fade-in group">
      <div className="flex items-center space-x-1.5 mb-1 px-1">
        <div className="w-4 h-4 rounded-full bg-gradient-to-tr from-rose-500 to-pink-400 flex items-center justify-center text-[10px] text-white font-bold shadow-xs">
          L
        </div>
        <span className="text-xs font-semibold text-rose-200/80">LinguaBot</span>
      </div>

      <div className="max-w-[88%] sm:max-w-[78%] bg-[#fffdfd] text-stone-900 border border-[#e8ded8] rounded-2xl rounded-tl-xs px-4 py-3 shadow-md shadow-black/20 hover:shadow-lg transition-all">
        {/* Hint for interactive words */}
        <div className="flex items-center space-x-1 text-[10px] text-stone-400 mb-1.5 font-normal select-none">
          <BookOpen className="w-2.5 h-2.5 text-rose-500/80 shrink-0" />
          <span>{t('tap_word_meaning')}</span>
        </div>

        {/* Bot Interactive Text with RTL support for Arabic and wrapping safeguard */}
        <div
          dir={isArabic ? 'rtl' : 'ltr'}
          className={`${
            isArabic
              ? 'font-arabic text-right text-lg sm:text-xl leading-loose tracking-normal'
              : 'text-left text-[15px] sm:text-base leading-relaxed tracking-wide font-normal'
          } text-stone-900 flex flex-wrap items-baseline gap-x-0.5 gap-y-0.5 break-words [overflow-wrap:anywhere]`}
        >
          {botSegments.map((segment, idx) => {
            if (segment.type === 'space') {
              if (segment.text.includes('\n')) {
                return <div key={idx} className="basis-full h-2" />;
              }
              return (
                <span key={idx} className="whitespace-pre-wrap select-text">
                  {segment.text}
                </span>
              );
            }

            if (segment.type === 'punctuation') {
              return (
                <span key={idx} dir={isArabic ? 'rtl' : 'ltr'} className="text-stone-400 px-0.5 select-text">
                  {segment.text}
                </span>
              );
            }

            if (segment.type === 'text') {
              return (
                <span key={idx} dir={isArabic ? 'rtl' : 'ltr'} className="select-text">
                  {segment.text}
                </span>
              );
            }

            const tokenObj = segment.token || { word: segment.text };
            const wordStr = segment.text;
            const clean = tokenObj.clean_word || wordStr.replace(/[.,/#!$%^&*;:{}=\-_`~()¿?¡!]/g, '').trim();

            if (targetLang === 'zh') {
              const tokenTranslit = resolveTranslit(tokenObj);
              const { baseWord, cleanTranslit, punctuation } = splitChineseWordAndPunctuation(wordStr, tokenTranslit);
              const cleanForLookup = clean || baseWord;
              const isSaved = isWordSaved(cleanForLookup, targetLang) || isWordSaved(baseWord, targetLang);

              return (
                <React.Fragment key={idx}>
                  {baseWord && (
                    <button
                      type="button"
                      dir="ltr"
                      onClick={() => onWordClick(cleanForLookup, message.vocabulary?.[cleanForLookup] || null)}
                      className="inline-flex items-baseline px-0.5 py-0 rounded hover:bg-rose-100/70 hover:text-rose-950 transition-all cursor-pointer group/item text-left"
                      title={isSaved ? `Palabra guardada: "${cleanForLookup}"` : `Clic para ver significado de "${cleanForLookup}"`}
                    >
                      {showTransliteration && cleanTranslit ? (
                        <ruby className="inline-flex flex-col items-center">
                          <rt dir="ltr" className="text-[11px] sm:text-[12px] text-sky-700 font-bold leading-tight select-none">
                            {cleanTranslit}
                          </rt>
                          <span
                            dir="ltr"
                            className={
                              isSaved
                                ? 'bg-amber-300 text-stone-950 dark:bg-amber-400 dark:text-stone-950 rounded px-1 font-bold shadow-xs ring-1 ring-amber-400/60'
                                : 'underline decoration-dotted decoration-stone-300 group-hover/item:decoration-rose-500 underline-offset-2 font-medium'
                            }
                          >
                            {baseWord}
                          </span>
                        </ruby>
                      ) : (
                        <span
                          dir="ltr"
                          className={
                            isSaved
                              ? 'bg-amber-300 text-stone-950 dark:bg-amber-400 dark:text-stone-950 rounded px-1 font-bold shadow-xs ring-1 ring-amber-400/60'
                              : 'underline decoration-dotted decoration-stone-300 group-hover/item:decoration-rose-500 underline-offset-2 font-medium'
                          }
                        >
                          {baseWord}
                        </span>
                      )}
                    </button>
                  )}
                  {punctuation && (
                    <span className="text-stone-500 text-[15px] sm:text-base font-normal select-text">
                      {punctuation}
                    </span>
                  )}
                </React.Fragment>
              );
            }

            const tokenTranslit = resolveTranslit(tokenObj);
            const isSaved = isWordSaved(clean, targetLang) || isWordSaved(wordStr, targetLang);

            return (
              <button
                key={idx}
                type="button"
                dir={isArabic ? 'rtl' : 'ltr'}
                onClick={() => onWordClick(clean, message.vocabulary?.[clean] || null)}
                className="inline-flex items-baseline px-0.5 py-0 rounded hover:bg-rose-100/70 hover:text-rose-950 transition-all cursor-pointer group/item"
                title={isSaved ? `Palabra guardada: "${clean}"` : `Clic para ver significado de "${clean}"`}
              >
                {showTransliteration && tokenTranslit ? (
                  <ruby className="inline-flex flex-col items-center">
                    <rt dir="ltr" className="text-[11px] sm:text-[12px] text-sky-700 font-bold leading-tight select-none">
                      {tokenTranslit}
                    </rt>
                    <span
                      dir={isArabic ? 'rtl' : 'ltr'}
                      className={
                        isSaved
                          ? 'bg-amber-300 text-stone-950 dark:bg-amber-400 dark:text-stone-950 rounded px-1 font-bold shadow-xs ring-1 ring-amber-400/60'
                          : 'underline decoration-dotted decoration-stone-300 group-hover/item:decoration-rose-500 underline-offset-2 font-medium'
                      }
                    >
                      {wordStr}
                    </span>
                  </ruby>
                ) : (
                  <span
                    dir={isArabic ? 'rtl' : 'ltr'}
                    className={
                      isSaved
                        ? 'bg-amber-300 text-stone-950 dark:bg-amber-400 dark:text-stone-950 rounded px-1 font-bold shadow-xs ring-1 ring-amber-400/60'
                        : 'underline decoration-dotted decoration-stone-300 group-hover/item:decoration-rose-500 underline-offset-2 font-medium'
                    }
                  >
                    {wordStr}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Translation Box (always LTR in native language) */}
        {showTranslation && message.translation && (
          <div dir="ltr" className="mt-2.5 pt-2.5 border-t border-stone-100 bg-rose-50/70 -mx-4 -mb-3 p-3 rounded-b-2xl animate-fade-in text-xs sm:text-sm text-stone-850 flex items-start space-x-2 border-t border-rose-100 text-left">
            <Globe className="w-3.5 h-3.5 text-rose-600 mt-0.5 flex-shrink-0" />
            <div>
              <span className="text-[10px] font-bold text-rose-800 block uppercase tracking-wider mb-0.5">
                {isSpanish ? 'Traducción completa:' : 'Full translation:'}
              </span>
              <p className="font-medium text-stone-850 leading-snug">{message.translation}</p>
            </div>
          </div>
        )}

        {/* Action Buttons Toolbar */}
        <div className="mt-2.5 pt-1.5 border-t border-stone-200/70 flex flex-wrap items-center justify-between gap-1.5 text-xs text-stone-500">
          <div className="flex items-center space-x-1.5">
            {/* Audio Button */}
            <button
              onClick={() => onPlayAudio(message.text)}
              className="flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-stone-100 hover:bg-rose-100 hover:text-rose-900 text-stone-700 text-[11px] font-medium transition-colors cursor-pointer"
              title={isSpanish ? "Escuchar en voz alta" : "Listen aloud"}
            >
              <Volume2 className="w-3.5 h-3.5 text-rose-600" />
              <span>{t('listen')}</span>
            </button>

            {/* Translate Button */}
            {message.translation && (
              <button
                onClick={() => setShowTranslation(!showTranslation)}
                className={`flex items-center space-x-1 px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors cursor-pointer ${
                  showTranslation
                    ? 'bg-rose-600 text-white'
                    : 'bg-stone-100 hover:bg-rose-100 hover:text-rose-900 text-stone-700'
                }`}
                title={isSpanish ? "Traducir la respuesta entera" : "Translate the entire response"}
              >
                <Globe className="w-3.5 h-3.5" />
                <span>
                  {showTranslation
                    ? isSpanish
                      ? 'Ocultar traducción'
                      : 'Hide translation'
                    : isSpanish
                    ? 'Traducir respuesta'
                    : 'Translate response'}
                </span>
              </button>
            )}
          </div>

          <button
            onClick={handleCopy}
            className="p-1 text-stone-400 hover:text-stone-700 hover:bg-stone-100 rounded-md transition-colors cursor-pointer"
            title={isSpanish ? "Copiar texto" : "Copy text"}
          >
            {copied ? <Check className="w-3.5 h-3.5 text-amber-600" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>
    </div>
  );
}
