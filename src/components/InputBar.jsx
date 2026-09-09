import React, { useState, useRef, useEffect } from 'react';
import { Send, Mic, Square, X, Radio } from 'lucide-react';

export function InputBar({
  targetLang,
  onSendMessage,
  isRecording,
  recordingSeconds = 0,
  onStartRecording,
  onStopRecording,
  onCancelRecording,
  interimTranscript,
  isProcessing
}) {
  const [text, setText] = useState('');
  const [isHovered, setIsHovered] = useState(false);
  const [isDraggingCancel, setIsDraggingCancel] = useState(false);
  const inputRef = useRef(null);

  const isArabic = targetLang === 'ar' || /[\u0600-\u06FF]/.test(text);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!text.trim() || isProcessing || isRecording) return;
    onSendMessage(text.trim());
    setText('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  // Format seconds as MM:SS
  const formatTime = (secs) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  // Push-to-Talk Handlers
  const handleMouseDown = (e) => {
    e.preventDefault();
    setIsDraggingCancel(false);
    onStartRecording();
  };

  const handleMouseUp = (e) => {
    e.preventDefault();
    if (isDraggingCancel) {
      onCancelRecording();
    } else {
      onStopRecording();
    }
    setIsDraggingCancel(false);
  };

  const handleMouseLeave = () => {
    if (isRecording) {
      setIsDraggingCancel(true);
    }
  };

  const handleMouseEnter = () => {
    if (isRecording) {
      setIsDraggingCancel(false);
    }
  };

  // Mobile Touch Handlers
  const handleTouchStart = (e) => {
    setIsDraggingCancel(false);
    onStartRecording();
  };

  const handleTouchMove = (e) => {
    if (!isRecording) return;
    const touch = e.touches[0];
    const target = document.elementFromPoint(touch.clientX, touch.clientY);
    const button = e.currentTarget;
    if (target !== button && !button.contains(target)) {
      setIsDraggingCancel(true);
    } else {
      setIsDraggingCancel(false);
    }
  };

  const handleTouchEnd = (e) => {
    e.preventDefault();
    if (isDraggingCancel) {
      onCancelRecording();
    } else {
      onStopRecording();
    }
    setIsDraggingCancel(false);
  };

  return (
    <div className="sticky bottom-0 bg-[#2b160f]/95 backdrop-blur-md border-t border-[#482519] px-4 py-3.5 z-20 transition-colors shadow-2xl shadow-black/60">
      <div className="max-w-4xl mx-auto">
        {/* Live Audio Recording Overlay Banner */}
        {isRecording && (
          <div className="mb-3 px-4 py-3 bg-gradient-to-r from-[#200e08] via-[#2f140c] to-[#200e08] border border-rose-600/70 rounded-2xl flex flex-col gap-2 text-xs text-rose-100 animate-fade-in shadow-xl shadow-rose-950/40">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-500 shadow-sm shadow-rose-500/50"></span>
                </span>
                <span className="font-bold text-rose-200 tracking-wide flex items-center gap-1.5 text-sm">
                  {isDraggingCancel ? (
                    <span className="text-amber-400 flex items-center gap-1 font-semibold">
                      <X className="w-4 h-4" /> Deslizado fuera: se cancelará al soltar
                    </span>
                  ) : (
                    <>
                      <span>Grabando voz:</span>
                      <span className="font-mono text-white bg-rose-950/80 px-2 py-0.5 rounded-lg border border-rose-800/60">
                        {formatTime(recordingSeconds)} / 1:00
                      </span>
                    </>
                  )}
                </span>
              </div>

              {/* Animated soundwave bars */}
              <div className="flex items-center space-x-1 px-2 py-1 bg-rose-950/60 rounded-lg border border-rose-800/40">
                <span className="w-1 h-3 bg-rose-400 rounded-full animate-soundwave [animation-delay:0.1s]"></span>
                <span className="w-1 h-5 bg-pink-400 rounded-full animate-soundwave [animation-delay:0.25s]"></span>
                <span className="w-1 h-6 bg-rose-300 rounded-full animate-soundwave [animation-delay:0.15s]"></span>
                <span className="w-1 h-4 bg-pink-300 rounded-full animate-soundwave [animation-delay:0.35s]"></span>
                <span className="w-1 h-2 bg-rose-400 rounded-full animate-soundwave [animation-delay:0.2s]"></span>
              </div>
            </div>

            {/* Live speech transcription text preview */}
            <div className="bg-[#140804] px-3 py-2 rounded-xl border border-rose-900/40 text-rose-100/90 italic text-sm min-h-[2.2rem] flex items-center">
              {interimTranscript ? (
                <span className="text-white font-medium not-italic">{interimTranscript}</span>
              ) : (
                <span className="text-rose-300/60">Habla ahora... estamos escuchando en tu idioma de práctica</span>
              )}
            </div>

            {/* Progress bar to 1 minute */}
            <div className="w-full bg-rose-950/80 h-1.5 rounded-full overflow-hidden border border-rose-800/40">
              <div
                className="bg-gradient-to-r from-rose-500 via-pink-400 to-amber-400 h-full transition-all duration-300 rounded-full"
                style={{ width: `${Math.min(100, (recordingSeconds / 60) * 100)}%` }}
              ></div>
            </div>

            <div className="flex justify-between text-[11px] text-rose-300/70 pt-0.5">
              <span>{isDraggingCancel ? 'Suelta el botón para cancelar la grabación' : 'Mantén presionado para seguir hablando'}</span>
              <span className="font-semibold text-rose-200">Suelta para enviar</span>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex items-center space-x-2.5">
          {/* Push-to-Talk Microphone Button (Press & Hold to Record, Release to Send) */}
          <div className="relative flex-shrink-0">
            <button
              type="button"
              onMouseDown={handleMouseDown}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseLeave}
              onMouseEnter={handleMouseEnter}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
              onContextMenu={(e) => e.preventDefault()}
              disabled={isProcessing}
              title="Mantén presionado para hablar (máx. 1 min) • Suelta para enviar"
              className={`p-3.5 rounded-2xl transition-all shadow-md flex items-center justify-center select-none active:scale-95 touch-none ${
                isRecording
                  ? 'bg-gradient-to-tr from-rose-600 to-pink-500 text-white scale-110 ring-4 ring-rose-500/40 shadow-rose-900/70 animate-pulse'
                  : 'bg-[#3b1e15] hover:bg-[#4d281c] text-rose-200 hover:text-white border border-[#5d3022] hover:border-rose-500/40 hover:shadow-lg'
              }`}
            >
              {isRecording ? (
                <Radio className="w-5 h-5 animate-spin fill-current" />
              ) : (
                <Mic className="w-5 h-5 transition-transform group-hover:scale-110" />
              )}
            </button>

            {/* Hover Tooltip */}
            {!isRecording && isHovered && (
              <div className="absolute bottom-full left-0 mb-2 z-30 whitespace-nowrap bg-stone-900 text-rose-100 text-xs px-3 py-1.5 rounded-xl shadow-xl border border-stone-700 pointer-events-none animate-fade-in">
                🎙️ <span className="font-bold text-white">Mantén presionado</span> para grabar voz, <span className="font-bold text-amber-300">suelta para enviar</span> (máx. 1 min)
              </div>
            )}
          </div>

          {/* Text Input (White with crisp text and RTL support for Arabic) */}
          <div className="relative flex-1">
            <input
              ref={inputRef}
              type="text"
              dir={isArabic ? 'rtl' : 'ltr'}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isProcessing || isRecording}
              placeholder={
                isRecording
                  ? "🔴 Grabando mensaje de voz... Suelta el micrófono para enviar"
                  : isArabic
                  ? "اكتب رسالتك باللغة العربية هنا... (Escribe en árabe o mantén el micro)"
                  : "Escribe o mantén presionado el micrófono para hablar..."
              }
              className={`w-full bg-white border border-stone-200 rounded-2xl px-4 py-3 text-stone-900 placeholder-stone-400 text-sm sm:text-base outline-none focus:ring-2 focus:ring-rose-500 shadow-sm transition-all ${
                isArabic ? 'font-arabic text-right text-lg' : 'text-left'
              }`}
            />
          </div>

          {/* Send Button */}
          <button
            type="submit"
            disabled={!text.trim() || isProcessing || isRecording}
            title="Enviar mensaje"
            className={`p-3 rounded-2xl transition-all shadow-md flex items-center justify-center flex-shrink-0 ${
              text.trim() && !isProcessing && !isRecording
                ? 'bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-500 hover:to-pink-500 text-white shadow-rose-950/50 transform active:scale-95'
                : 'bg-[#3b1e15] text-rose-300/40 border border-[#4a261a] cursor-not-allowed'
            }`}
          >
            <Send className="w-5 h-5" />
          </button>
        </form>

        <div className="mt-2 text-center">
          <p className="text-[11px] text-rose-200/60">
            Mantén presionado <span className="text-rose-300 font-semibold">🎙️ Mic</span> para enviar mensaje de voz (máx. 1 min) • Los errores gramaticales se corrigen automáticamente en <span className="text-amber-300 font-bold">dorado</span>.
          </p>
        </div>
      </div>
    </div>
  );
}
