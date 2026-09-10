import React, { useState, useRef } from 'react';
import { Send, Mic, X, Radio, Loader2, Sparkles } from 'lucide-react';
import { useSiteLanguage } from '../context/SiteLanguageContext.jsx';

export function InputBar({
  targetLang,
  nativeLang,
  onSendMessage,
  isRecording,
  recordingSeconds = 0,
  isTranscribingAudio = false,
  onStartRecording,
  onStopRecording,
  onCancelRecording,
  interimTranscript,
  isProcessing
}) {
  const { isSpanish } = useSiteLanguage();
  const [text, setText] = useState('');
  const [isHovered, setIsHovered] = useState(false);
  const [isDraggingCancel, setIsDraggingCancel] = useState(false);
  const inputRef = useRef(null);

  const startCoordsRef = useRef(null);
  const isPointerActiveRef = useRef(false);
  const pointerIdRef = useRef(null);

  const isArabic = targetLang === 'ar' || /[\u0600-\u06FF]/.test(text);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!text.trim() || isProcessing || isRecording || isTranscribingAudio) return;
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

  // Universal Pointer Events (Unified for Desktop Mouse, Mobile Touch & Stylus)
  const handlePointerDown = (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if (isProcessing || isTranscribingAudio) return;

    e.stopPropagation();

    startCoordsRef.current = { x: e.clientX, y: e.clientY };
    isPointerActiveRef.current = true;
    pointerIdRef.current = e.pointerId;
    setIsDraggingCancel(false);

    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch (err) {}

    onStartRecording();
  };

  const handlePointerMove = (e) => {
    if (!isPointerActiveRef.current || !startCoordsRef.current) return;
    const deltaY = startCoordsRef.current.y - e.clientY; // dragged up
    const deltaX = Math.abs(startCoordsRef.current.x - e.clientX);

    // Cancel only if dragged substantially away (> 70px vertical swipe)
    if (deltaY > 70 || deltaX > 120) {
      setIsDraggingCancel(true);
    } else {
      setIsDraggingCancel(false);
    }
  };

  const handlePointerUp = (e) => {
    if (!isPointerActiveRef.current) return;
    e.preventDefault();
    e.stopPropagation();
    isPointerActiveRef.current = false;

    try {
      if (pointerIdRef.current !== null && e.currentTarget.hasPointerCapture(pointerIdRef.current)) {
        e.currentTarget.releasePointerCapture(pointerIdRef.current);
      }
    } catch (err) {}
    pointerIdRef.current = null;

    if (isDraggingCancel) {
      onCancelRecording();
    } else {
      onStopRecording();
    }
    setIsDraggingCancel(false);
  };

  const handlePointerCancel = (e) => {
    if (!isPointerActiveRef.current) return;
    e.preventDefault();
    e.stopPropagation();
    isPointerActiveRef.current = false;
    pointerIdRef.current = null;

    // Guaranteed never to hang: if touch canceled by system, send recorded voice
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
                <span className="text-rose-300/60">Habla con tranquilidad... escuchamos en tu idioma o mixto</span>
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
              <span>{isDraggingCancel ? 'Suelta para cancelar la grabación' : 'Desliza hacia arriba para cancelar'}</span>
              <span className="font-semibold text-rose-200">Suelta para enviar</span>
            </div>
          </div>
        )}

        {/* AI Audio Transcribing Banner */}
        {isTranscribingAudio && (
          <div className="mb-3 px-4 py-2.5 bg-gradient-to-r from-amber-950/80 via-rose-950/80 to-amber-950/80 border border-amber-500/50 rounded-2xl flex items-center justify-between text-xs text-amber-200 animate-pulse shadow-lg">
            <div className="flex items-center space-x-2">
              <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
              <span className="font-semibold text-white">Transcribiendo audio con IA multimodal...</span>
            </div>
            <span className="text-[11px] text-amber-300/80 flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-amber-400" /> Reconociendo acentos y mezcla de idiomas
            </span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex items-center space-x-2.5">
          {/* Push-to-Talk Microphone Button (Press & Hold to Record, Release to Send) */}
          <div className="relative flex-shrink-0">
            <button
              type="button"
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerCancel}
              onMouseEnter={() => setIsHovered(true)}
              onMouseLeave={() => setIsHovered(false)}
              onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); }}
              disabled={isProcessing || isTranscribingAudio}
              title="Mantén presionado para hablar (máx. 1 min) • Suelta para enviar"
              style={{
                touchAction: 'none',
                WebkitTouchCallout: 'none',
                userSelect: 'none',
                WebkitUserSelect: 'none'
              }}
              className={`p-3.5 rounded-2xl transition-all shadow-md flex items-center justify-center select-none active:scale-95 touch-none cursor-pointer ${
                isRecording
                  ? 'bg-gradient-to-tr from-rose-600 to-pink-500 text-white scale-110 ring-4 ring-rose-500/40 shadow-rose-900/70 animate-pulse'
                  : isTranscribingAudio
                  ? 'bg-amber-900/80 text-amber-200 border border-amber-600/50 cursor-wait'
                  : 'bg-[#3b1e15] hover:bg-[#4d281c] text-rose-200 hover:text-white border border-[#5d3022] hover:border-rose-500/40 hover:shadow-lg'
              }`}
            >
              {isRecording ? (
                <Radio className="w-5 h-5 animate-spin fill-current" />
              ) : isTranscribingAudio ? (
                <Loader2 className="w-5 h-5 animate-spin text-amber-300" />
              ) : (
                <Mic className="w-5 h-5 transition-transform group-hover:scale-110" />
              )}
            </button>

            {/* Hover Tooltip */}
            {!isRecording && !isTranscribingAudio && isHovered && (
              <div className="absolute bottom-full left-0 mb-2 z-30 whitespace-nowrap bg-stone-900 text-rose-100 text-xs px-3 py-1.5 rounded-xl shadow-xl border border-stone-700 pointer-events-none animate-fade-in">
                🎙️ <span className="font-bold text-white">Mantén presionado</span> para hablar, <span className="font-bold text-amber-300">suelta para enviar</span>
              </div>
            )}
          </div>

          {/* Text Input */}
          <div className="relative flex-1">
            <input
              ref={inputRef}
              type="text"
              dir={isArabic ? 'rtl' : 'ltr'}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isProcessing || isRecording || isTranscribingAudio}
              placeholder={
                isRecording
                  ? isSpanish
                    ? "🔴 Grabando mensaje de voz... Suelta el micrófono para enviar"
                    : "🔴 Recording voice message... Release mic to send"
                  : isTranscribingAudio
                  ? isSpanish
                    ? "⏳ Transcribiendo audio con IA de alta precisión..."
                    : "⏳ Transcribing audio with high-precision AI..."
                  : isArabic
                  ? isSpanish
                    ? "اكتب رسالتك باللغة العربية هنا... (Escribe en árabe o mantén el micro)"
                    : "اكتب رسالتك باللغة العربية هنا... (Type in Arabic or hold mic)"
                  : isSpanish
                  ? "Escribe o mantén presionado el micrófono para hablar..."
                  : "Type or press and hold the mic to speak..."
              }
              className={`w-full bg-white border border-stone-200 rounded-2xl px-4 py-3 text-stone-900 placeholder-stone-400 text-sm sm:text-base outline-none focus:ring-2 focus:ring-rose-500 shadow-sm transition-all ${
                isArabic ? 'font-arabic text-right text-lg' : 'text-left'
              }`}
            />
          </div>

          {/* Send Button */}
          <button
            type="submit"
            disabled={!text.trim() || isProcessing || isRecording || isTranscribingAudio}
            title={isSpanish ? "Enviar mensaje" : "Send message"}
            className={`p-3 rounded-2xl transition-all shadow-md flex items-center justify-center flex-shrink-0 ${
              text.trim() && !isProcessing && !isRecording && !isTranscribingAudio
                ? 'bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-500 hover:to-pink-500 text-white shadow-rose-950/50 transform active:scale-95'
                : 'bg-[#3b1e15] text-rose-300/40 border border-[#4a261a] cursor-not-allowed'
            }`}
          >
            <Send className="w-5 h-5" />
          </button>
        </form>

        <div className="mt-2 text-center">
          <p className="text-[11px] text-rose-200/60">
            {isSpanish ? (
              <>
                Mantén presionado <span className="text-rose-300 font-semibold">🎙️ Mic</span> para hablar (soporta acentos y mezcla de idiomas) • Suelta para enviar.
              </>
            ) : (
              <>
                Press and hold <span className="text-rose-300 font-semibold">🎙️ Mic</span> to speak (supports accents & code-switching) • Release to send.
              </>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}
