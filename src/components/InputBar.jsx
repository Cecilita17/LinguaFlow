import React, { useState, useRef } from 'react';
import { Send, Mic, Square } from 'lucide-react';

export function InputBar({
  targetLang,
  onSendMessage,
  isListening,
  isSpeaking,
  onStartListening,
  onStopListening,
  handsFree,
  interimTranscript,
  isProcessing
}) {
  const [text, setText] = useState('');
  const inputRef = useRef(null);

  const isArabic = targetLang === 'ar' || /[\u0600-\u06FF]/.test(text);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!text.trim() || isProcessing) return;
    onSendMessage(text.trim());
    setText('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <div className="sticky bottom-0 bg-[#2b160f]/95 backdrop-blur-md border-t border-[#482519] px-4 py-3.5 z-20 transition-colors shadow-xl shadow-black/40">
      <div className="max-w-4xl mx-auto">
        {/* Live speech interim preview banner */}
        {(isListening || interimTranscript) && (
          <div className="mb-2.5 px-3.5 py-2 bg-[#1e0f0a] border border-rose-800/80 rounded-xl flex items-center justify-between text-xs text-rose-200 animate-fade-in shadow-inner">
            <div className="flex items-center space-x-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-pink-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500"></span>
              </span>
              <span className="font-semibold text-rose-300">Escuchando:</span>
              <span className="italic text-white font-medium">
                {interimTranscript || 'Habla ahora con tranquilidad...'}
              </span>
            </div>
            {/* Wave animation bars */}
            <div className="flex items-center space-x-1">
              <span className="w-1 h-3 bg-pink-400 rounded-full animate-soundwave [animation-delay:0.1s]"></span>
              <span className="w-1 h-5 bg-rose-400 rounded-full animate-soundwave [animation-delay:0.2s]"></span>
              <span className="w-1 h-2 bg-pink-300 rounded-full animate-soundwave [animation-delay:0.3s]"></span>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex items-center space-x-2.5">
          {/* Microphone Button */}
          <button
            type="button"
            onClick={isListening ? onStopListening : onStartListening}
            disabled={isProcessing}
            title={
              handsFree
                ? "El modo manos libres está activo (escucha automáticamente)"
                : isListening
                ? "Detener grabación"
                : "Pulsar para hablar (mensaje de voz)"
            }
            className={`p-3 rounded-2xl transition-all shadow-xs flex items-center justify-center flex-shrink-0 ${
              isListening
                ? 'bg-rose-500 hover:bg-rose-600 text-white animate-pulse shadow-rose-900/50'
                : handsFree
                ? 'bg-rose-950/80 text-rose-300 hover:bg-rose-900/80 border border-rose-800/60'
                : 'bg-[#3b1e15] hover:bg-[#4a261a] text-rose-200 border border-[#5a2e20]'
            }`}
          >
            {isListening ? (
              <Square className="w-5 h-5 fill-current" />
            ) : (
              <Mic className="w-5 h-5" />
            )}
          </button>

          {/* Text Input (White with crisp text and RTL support for Arabic) */}
          <div className="relative flex-1">
            <input
              ref={inputRef}
              type="text"
              dir={isArabic ? 'rtl' : 'ltr'}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isProcessing}
              placeholder={
                handsFree
                  ? "Modo manos libres activado (habla libremente o escribe aquí)..."
                  : isListening
                  ? "Escuchando tu voz..."
                  : isArabic
                  ? "اكتب رسالتك باللغة العربية هنا... (Escribe en árabe)"
                  : "Escribe tu mensaje en el idioma que estás practicando..."
              }
              className={`w-full bg-white border border-stone-200 rounded-2xl px-4 py-3 text-stone-900 placeholder-stone-400 text-sm sm:text-base outline-none focus:ring-2 focus:ring-rose-500 shadow-sm transition-all ${
                isArabic ? 'font-arabic text-right text-lg' : 'text-left'
              }`}
            />
          </div>

          {/* Send Button */}
          <button
            type="submit"
            disabled={!text.trim() || isProcessing}
            title="Enviar mensaje"
            className={`p-3 rounded-2xl transition-all shadow-md flex items-center justify-center flex-shrink-0 ${
              text.trim() && !isProcessing
                ? 'bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-500 hover:to-pink-500 text-white shadow-rose-950/50'
                : 'bg-[#3b1e15] text-rose-300/40 border border-[#4a261a] cursor-not-allowed'
            }`}
          >
            <Send className="w-5 h-5" />
          </button>
        </form>

        <div className="mt-2 text-center">
          <p className="text-[11px] text-rose-200/60">
            Consejo: escribe o habla con libertad; los errores se corrigen automáticamente y se resaltan en <span className="text-amber-300 font-bold">dorado</span>.
          </p>
        </div>
      </div>
    </div>
  );
}
