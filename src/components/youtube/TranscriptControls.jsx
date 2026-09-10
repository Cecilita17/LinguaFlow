import React from 'react';
import { Search, RotateCcw, ArrowDown, Clock, ZoomIn, ZoomOut, X, Languages } from 'lucide-react';

export function TranscriptControls({
  searchQuery = '',
  onSearchChange,
  onResetToStart,
  autoScroll = true,
  onToggleAutoScroll,
  fontSize = 'base', // 'sm' | 'base' | 'lg' | 'xl'
  onChangeFontSize,
  showTimestamps = true,
  onToggleTimestamps,
  interlinearMode = true,
  onToggleInterlinearMode
}) {
  const fontSizes = ['sm', 'base', 'lg', 'xl'];

  const handleZoomIn = () => {
    const idx = fontSizes.indexOf(fontSize);
    if (idx < fontSizes.length - 1) {
      onChangeFontSize(fontSizes[idx + 1]);
    }
  };

  const handleZoomOut = () => {
    const idx = fontSizes.indexOf(fontSize);
    if (idx > 0) {
      onChangeFontSize(fontSizes[idx - 1]);
    }
  };

  return (
    <div className="flex flex-wrap items-center justify-between gap-2.5 p-3 rounded-2xl bg-[#2b160f] border border-[#482519] text-xs">
      {/* Search Input */}
      <div className="relative flex-1 min-w-[180px]">
        <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-rose-300/50" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Buscar en el transcript..."
          className="w-full bg-[#1c0e09] text-white text-xs pl-8 pr-7 py-1.5 rounded-xl border border-[#482519] placeholder-rose-300/30 focus:outline-none focus:ring-1 focus:ring-rose-500"
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => onSearchChange('')}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-rose-300/60 hover:text-white"
          >
            <X className="w-3 h-3" />
          </button>
        )}
      </div>

      {/* Action Buttons Group */}
      <div className="flex flex-wrap items-center gap-1.5">
        {/* Interlinear Mode Toggle (Palabras + Pinyin + Glosa vs Texto Normal) */}
        {onToggleInterlinearMode && (
          <button
            type="button"
            onClick={onToggleInterlinearMode}
            title={interlinearMode ? "Cambiar a subtítulos tradicionales (texto plano)" : "Activar desglose interlineal (Pinyin + glosa por palabra)"}
            className={`px-2.5 py-1.5 rounded-xl border text-[11px] font-semibold transition-all flex items-center gap-1.5 ${
              interlinearMode
                ? 'bg-gradient-to-r from-rose-600 to-pink-600 text-white border-rose-400 shadow-xs'
                : 'bg-[#3b1e15] text-rose-200/60 border-[#5a2e20] hover:text-rose-200'
            }`}
          >
            <Languages className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Interlineal</span>
            <span className={`text-[9px] px-1 rounded ${interlinearMode ? 'bg-rose-900/80 text-white font-bold' : 'bg-[#1e0f0a] text-rose-300/50'}`}>
              {interlinearMode ? 'ON' : 'OFF'}
            </span>
          </button>
        )}

        {/* Rewind to start */}
        <button
          type="button"
          onClick={onResetToStart}
          title="Volver al inicio del vídeo y transcript"
          className="p-1.5 rounded-xl bg-[#3b1e15] hover:bg-[#482519] text-rose-200 border border-[#5a2e20] transition-colors flex items-center gap-1"
        >
          <RotateCcw className="w-3.5 h-3.5 text-rose-400" />
          <span className="hidden sm:inline text-[11px] font-medium">Inicio</span>
        </button>

        {/* Auto-scroll Toggle */}
        <button
          type="button"
          onClick={onToggleAutoScroll}
          title={autoScroll ? "Desactivar desplazamiento automático" : "Activar desplazamiento automático hacia la línea activa"}
          className={`px-2.5 py-1.5 rounded-xl border text-[11px] font-semibold transition-all flex items-center gap-1.5 ${
            autoScroll
              ? 'bg-rose-600/90 text-white border-rose-500 shadow-xs'
              : 'bg-[#3b1e15] text-rose-200/60 border-[#5a2e20] hover:text-rose-200'
          }`}
        >
          <ArrowDown className={`w-3.5 h-3.5 ${autoScroll ? 'animate-bounce' : ''}`} />
          <span className="hidden sm:inline">Auto-scroll</span>
          <span className={`text-[9px] px-1 rounded ${autoScroll ? 'bg-rose-800 text-white' : 'bg-[#1e0f0a] text-rose-300/50'}`}>
            {autoScroll ? 'ON' : 'OFF'}
          </span>
        </button>

        {/* Timestamps Toggle */}
        <button
          type="button"
          onClick={onToggleTimestamps}
          title={showTimestamps ? "Ocultar marcas de tiempo" : "Mostrar marcas de tiempo"}
          className={`px-2.5 py-1.5 rounded-xl border text-[11px] font-semibold transition-all flex items-center gap-1.5 ${
            showTimestamps
              ? 'bg-[#3b1e15] text-rose-200 border-[#5a2e20]'
              : 'bg-[#1e0f0a] text-rose-300/40 border-[#3b1e15]'
          }`}
        >
          <Clock className="w-3.5 h-3.5 text-rose-400" />
          <span className="hidden md:inline">Tiempo</span>
        </button>

        {/* Font Size Adjusters */}
        <div className="flex items-center bg-[#1c0e09] rounded-xl border border-[#482519] p-0.5">
          <button
            type="button"
            onClick={handleZoomOut}
            disabled={fontSize === 'sm'}
            title="Reducir tamaño de letra"
            className="p-1 rounded-lg text-rose-200/70 hover:text-white disabled:opacity-30 transition-colors"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <span className="text-[10px] font-bold px-1.5 text-rose-300 uppercase">
            {fontSize}
          </span>
          <button
            type="button"
            onClick={handleZoomIn}
            disabled={fontSize === 'xl'}
            title="Aumentar tamaño de letra"
            className="p-1 rounded-lg text-rose-200/70 hover:text-white disabled:opacity-30 transition-colors"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

export default TranscriptControls;
