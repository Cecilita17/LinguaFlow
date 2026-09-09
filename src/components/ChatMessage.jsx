import React, { useState } from 'react';
import { Volume2, Globe, CheckCircle2, Copy, Check, BookOpen, RotateCcw } from 'lucide-react';
import { ChineseWritingPractice } from './ChineseWritingPractice.jsx';

export function ChatMessage({
  message,
  targetLang,
  showTransliteration,
  onWordClick,
  onPlayAudio,
  isAudioPlaying,
  onOpenGrammarBreakdown,
  onReanalyzeMessage,
  isReanalyzing
}) {
  const [showTranslation, setShowTranslation] = useState(false);
  const [copied, setCopied] = useState(false);
  const [justReanalyzed, setJustReanalyzed] = useState(false);
  const [writingPracticeOpen, setWritingPracticeOpen] = useState(false);
  const [writingPracticeMode, setWritingPracticeMode] = useState('words'); // 'words' | 'sentence'
  const isUser = message.sender === 'user';

  const handleOpenWritingPractice = (mode) => {
    setWritingPracticeMode(mode);
    setWritingPracticeOpen(true);
  };

  const handleReanalyzeClick = async () => {
    if (onReanalyzeMessage) {
      await onReanalyzeMessage(message);
      setJustReanalyzed(true);
      setTimeout(() => setJustReanalyzed(false), 2500);
    }
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

  // Helper for rendering transliteration in user bubble (luminous, clear rose-tinted white)
  const renderUserRubyWord = (word, translit, key) => {
    if (showTransliteration && translit) {
      return (
        <ruby key={key} className="user-ruby mx-0.5 inline-flex flex-col items-center">
          <rt dir="ltr" className="text-[12px] leading-tight text-pink-100 font-extrabold tracking-wider select-none drop-shadow-xs">
            {translit}
          </rt>
          <span dir={isArabic ? 'rtl' : 'ltr'} className="leading-relaxed">{word}</span>
        </ruby>
      );
    }
    return <span key={key} dir={isArabic ? 'rtl' : 'ltr'}>{word}</span>;
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
    if (token.translit) return token.translit;
    if (token.pinyin) return token.pinyin;
    if (targetLang === 'zh') {
      const clean = (token.text || '').trim();
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
          <span className="text-xs font-semibold text-rose-200/80">Tú</span>
          {hasCorrection && (
            <span className="flex items-center space-x-1.5 text-[11px] font-semibold text-amber-200 bg-amber-950/80 px-2.5 py-0.5 rounded-full border border-amber-700/80 shadow-xs">
              <CheckCircle2 className="w-3.5 h-3.5 text-amber-300" />
              <span>Corregido automáticamente</span>
            </span>
          )}
        </div>

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
                className="px-2 py-1 bg-white/15 hover:bg-white/25 active:scale-95 rounded-lg transition-all flex items-center space-x-1 text-white text-[11px] font-semibold shadow-xs"
                title="Ver desglose gramatical detallado de cada palabra"
              >
                <BookOpen className="w-3 h-3 text-amber-200" />
                <span>Desglose</span>
              </button>

              {/* Re-analyze grammar button */}
              <button
                type="button"
                onClick={handleReanalyzeClick}
                disabled={isReanalyzing === message.id}
                className="px-2 py-1 bg-white/15 hover:bg-white/25 active:scale-95 rounded-lg transition-all flex items-center space-x-1 text-white text-[11px] font-semibold shadow-xs disabled:opacity-50"
                title="Volver a analizar corrección estricta"
              >
                {isReanalyzing === message.id ? (
                  <>
                    <RotateCcw className="w-3 h-3 text-amber-300 animate-spin" />
                    <span className="text-amber-200">Analizando...</span>
                  </>
                ) : justReanalyzed ? (
                  <>
                    <CheckCircle2 className="w-3 h-3 text-emerald-300" />
                    <span className="text-emerald-200">¡Actualizado!</span>
                  </>
                ) : (
                  <>
                    <RotateCcw className="w-3 h-3 text-rose-200" />
                    <span>Re-analizar</span>
                  </>
                )}
              </button>
            </div>

            <div className="flex items-center space-x-1">
              <button
                onClick={() => onPlayAudio(message.correctedText || message.text)}
                className="p-1 hover:text-white hover:bg-white/20 rounded-md transition-colors flex items-center space-x-1"
                title="Escuchar pronunciación correcta"
              >
                <Volume2 className="w-3.5 h-3.5" />
                <span className="text-[11px] font-medium">Escuchar</span>
              </button>
              <button
                onClick={handleCopy}
                className="p-1 hover:text-white hover:bg-white/20 rounded-md transition-colors"
                title="Copiar texto"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-amber-200" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>
        </div>

        {/* Chinese Writing Practice Buttons (ONLY when targetLang === 'zh' and message has correctedText) */}
        {isChinese && (message.correctedText || hasCorrection) && (
          <div className="flex flex-wrap items-center justify-end gap-2 mt-2 px-1 animate-fade-in">
            <button
              type="button"
              onClick={() => handleOpenWritingPractice('words')}
              className="px-3 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 active:scale-95 border border-amber-500/40 text-amber-200 text-xs font-bold shadow-sm transition-all flex items-center gap-1.5 backdrop-blur-xs"
              title="Practicar orden de trazos de caracteres corregidos con Hanzi Writer"
            >
              <span>✍️</span>
              <span>Practicar escritura</span>
            </button>
            <button
              type="button"
              onClick={() => handleOpenWritingPractice('sentence')}
              className="px-3 py-1.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 active:scale-95 border border-rose-500/40 text-rose-200 text-xs font-bold shadow-sm transition-all flex items-center gap-1.5 backdrop-blur-xs"
              title="Practicar la oración corregida completa carácter por carácter"
            >
              <span>📝</span>
              <span>Practicar oración</span>
            </button>
          </div>
        )}

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

  return (
    <div className="flex flex-col items-start my-4 animate-fade-in group">
      <div className="flex items-center space-x-1.5 mb-1 px-1">
        <div className="w-4 h-4 rounded-full bg-gradient-to-tr from-rose-500 to-pink-400 flex items-center justify-center text-[10px] text-white font-bold shadow-xs">
          L
        </div>
        <span className="text-xs font-semibold text-rose-200/80">LinguaBot</span>
      </div>

      <div className="max-w-[90%] sm:max-w-[82%] bg-[#fffdfd] text-stone-900 border border-[#e8ded8] rounded-2xl rounded-tl-xs p-4 shadow-md shadow-black/20 hover:shadow-lg transition-all">
        {/* Hint for interactive words */}
        <div className="flex items-center space-x-1 text-[11px] text-stone-500 mb-2 font-medium">
          <BookOpen className="w-3 h-3 text-rose-500" />
          <span>Haz clic en cualquier palabra para ver su significado</span>
        </div>

        {/* Bot Interactive Text with RTL support for Arabic */}
        <div
          dir={isArabic ? 'rtl' : 'ltr'}
          className={`${
            isArabic
              ? 'font-arabic text-right text-[19px] sm:text-[22px] leading-loose'
              : 'text-left text-[16px] sm:text-[17px] leading-relaxed'
          } text-stone-900 font-normal flex flex-wrap items-baseline gap-x-1.5 gap-y-1.5`}
        >
          {tokens && tokens.length > 0 ? (
            tokens.map((token, idx) => {
              const clean = token.clean_word || token.word.replace(/[.,/#!$%^&*;:{}=\-_`~()¿?¡!]/g, '');
              const isPunctuation = /^[\s.,!?;:()¿¡'"“”‘’]+$/.test(token.word);

              if (isPunctuation) {
                return (
                  <span key={idx} dir={isArabic ? 'rtl' : 'ltr'} className="text-stone-400 px-0.5">
                    {token.word}
                  </span>
                );
              }

              return (
                <button
                  key={idx}
                  type="button"
                  dir={isArabic ? 'rtl' : 'ltr'}
                  onClick={() => onWordClick(clean, message.vocabulary?.[clean] || null)}
                  className="inline-flex items-baseline px-1.5 py-0.5 rounded-lg hover:bg-rose-100 hover:text-rose-950 border border-transparent hover:border-rose-300 transition-all cursor-pointer group/item text-right"
                  title={`Clic para ver significado de "${clean}"`}
                >
                  {showTransliteration && token.translit ? (
                    <ruby className="inline-flex flex-col items-center">
                      <rt dir="ltr" className="text-[12px] text-sky-600 font-bold leading-tight select-none">
                        {token.translit}
                      </rt>
                      <span
                        dir={isArabic ? 'rtl' : 'ltr'}
                        className="underline decoration-dotted decoration-stone-300 group-hover/item:decoration-rose-500 underline-offset-4 font-medium"
                      >
                        {token.word}
                      </span>
                    </ruby>
                  ) : (
                    <span
                      dir={isArabic ? 'rtl' : 'ltr'}
                      className="underline decoration-dotted decoration-stone-300 group-hover/item:decoration-rose-500 underline-offset-4 font-medium"
                    >
                      {token.word}
                    </span>
                  )}
                </button>
              );
            })
          ) : (
            message.text.split(/(\s+)/).map((segment, idx) => {
              if (/^\s+$/.test(segment)) {
                return <span key={idx}> </span>;
              }
              const clean = segment.replace(/[.,/#!$%^&*;:{}=\-_`~()¿?¡!]/g, '');
              return (
                <button
                  key={idx}
                  type="button"
                  dir={isArabic ? 'rtl' : 'ltr'}
                  onClick={() => onWordClick(clean, message.vocabulary?.[clean] || null)}
                  className="hover:bg-rose-100 hover:text-rose-950 rounded px-1 underline decoration-dotted decoration-stone-300 underline-offset-4 cursor-pointer font-medium"
                >
                  {segment}
                </button>
              );
            })
          )}
        </div>

        {/* Translation Box (always LTR in native language) */}
        {showTranslation && message.translation && (
          <div dir="ltr" className="mt-3 pt-3 border-t border-stone-100 bg-rose-50/70 -mx-4 -mb-4 p-3.5 rounded-b-2xl animate-fade-in text-sm text-stone-850 flex items-start space-x-2 border-t border-rose-100 text-left">
            <Globe className="w-4 h-4 text-rose-600 mt-0.5 flex-shrink-0" />
            <div>
              <span className="text-[11px] font-bold text-rose-800 block uppercase tracking-wider mb-0.5">
                Traducción completa:
              </span>
              <p className="font-medium text-stone-850 leading-snug">{message.translation}</p>
            </div>
          </div>
        )}

        {/* Action Buttons Toolbar */}
        <div className="mt-3.5 pt-2.5 border-t border-stone-100 flex flex-wrap items-center justify-between gap-2 text-xs text-stone-500">
          <div className="flex items-center space-x-2">
            {/* Audio Button */}
            <button
              onClick={() => onPlayAudio(message.text)}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-stone-100 hover:bg-rose-100 hover:text-rose-900 text-stone-700 font-medium transition-colors"
              title="Escuchar en voz alta"
            >
              <Volume2 className="w-3.5 h-3.5 text-rose-600" />
              <span>Escuchar</span>
            </button>

            {/* Translate Button */}
            {message.translation && (
              <button
                onClick={() => setShowTranslation(!showTranslation)}
                className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl font-medium transition-colors ${
                  showTranslation
                    ? 'bg-rose-600 text-white'
                    : 'bg-stone-100 hover:bg-rose-100 hover:text-rose-900 text-stone-700'
                }`}
                title="Traducir la respuesta entera"
              >
                <Globe className="w-3.5 h-3.5" />
                <span>{showTranslation ? 'Ocultar traducción' : 'Traducir respuesta'}</span>
              </button>
            )}
          </div>

          <button
            onClick={handleCopy}
            className="p-1.5 text-stone-400 hover:text-stone-700 hover:bg-stone-100 rounded-lg transition-colors"
            title="Copiar texto"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-amber-600" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>
    </div>
  );
}
