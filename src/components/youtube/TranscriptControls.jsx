import React, { useRef } from 'react';
import { Search, RotateCcw, ArrowDown, ZoomIn, ZoomOut, X, Upload } from 'lucide-react';
import { useSiteLanguage } from '../../context/SiteLanguageContext.jsx';

export function TranscriptControls({
  searchQuery = '',
  onSearchChange,
  onResetToStart,
  autoScroll = true,
  onToggleAutoScroll,
  fontSize = 'base', // 'sm' | 'base' | 'lg' | 'xl'
  onChangeFontSize,
  onFileUpload,
  showTimestamps = true,
  onToggleTimestamps
}) {
  const { isSpanish } = useSiteLanguage();
  const fileInputRef = useRef(null);
  const fontSizes = ['sm', 'base', 'lg', 'xl'];

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file && onFileUpload) {
      onFileUpload(file);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

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
    <div className="flex flex-wrap items-center justify-between gap-2 p-2 sm:p-2.5 rounded-xl bg-[var(--surface-secondary)] border border-[var(--border-primary)] text-xs shadow-md">
      {/* Search Input */}
      <div className="relative flex-1 min-w-[170px]">
        <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={isSpanish ? "Buscar en el transcript..." : "Search transcript..."}
          className="w-full bg-[var(--input-bg)] text-[var(--text-primary)] text-xs pl-8 pr-7 py-1.5 rounded-lg border border-[var(--input-border)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-1 focus:ring-rose-500"
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => onSearchChange('')}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
          >
            <X className="w-3 h-3" />
          </button>
        )}
      </div>

      {/* Action Buttons Group */}
      <div className="flex flex-wrap items-center gap-1.5">
        {/* Rewind to start */}
        <button
          type="button"
          onClick={onResetToStart}
          title={isSpanish ? "Volver al inicio del vídeo y transcript" : "Rewind to video & transcript start"}
          className="p-1.5 rounded-lg bg-[var(--surface-primary)] hover:bg-[var(--surface-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-primary)] transition-colors flex items-center gap-1 cursor-pointer"
        >
          <RotateCcw className="w-3.5 h-3.5 text-rose-500 dark:text-rose-400" />
          <span className="hidden sm:inline text-[11px] font-medium">{isSpanish ? "Inicio" : "Start"}</span>
        </button>

        {/* Auto-scroll Toggle */}
        <button
          type="button"
          onClick={onToggleAutoScroll}
          title={autoScroll ? (isSpanish ? "Desactivar desplazamiento automático" : "Disable auto-scroll") : (isSpanish ? "Activar desplazamiento automático hacia la línea activa" : "Enable auto-scroll to active line")}
          className={`px-2.5 py-1.5 rounded-xl border text-[11px] font-semibold transition-all flex items-center gap-1.5 ${
            autoScroll
              ? 'bg-rose-600/90 text-white border-rose-500 shadow-xs'
              : 'bg-[var(--surface-primary)] text-[var(--text-muted)] border-[var(--border-primary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)]'
          }`}
        >
          <ArrowDown className={`w-3.5 h-3.5 ${autoScroll ? 'animate-bounce' : ''}`} />
          <span className="hidden sm:inline">Auto-scroll</span>
          <span className={`text-[9px] px-1 rounded ${autoScroll ? 'bg-rose-800 text-white' : 'bg-[var(--surface-secondary)] text-[var(--text-muted)]'}`}>
            {autoScroll ? 'ON' : 'OFF'}
          </span>
        </button>

        {/* Cambiar archivo Button */}
        <div className="relative inline-flex items-center">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            title={isSpanish ? "Cambiar archivo de subtítulos (.srt, .vtt, .txt)" : "Change subtitle file (.srt, .vtt, .txt)"}
            className="px-2.5 py-1.5 rounded-xl bg-[var(--surface-primary)] hover:bg-[var(--surface-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-primary)] hover:border-rose-500/60 text-[11px] font-semibold transition-all flex items-center gap-1.5 shadow-xs cursor-pointer active:scale-95"
          >
            <Upload className="w-3.5 h-3.5 text-rose-500 dark:text-rose-400" />
            <span>{isSpanish ? "Cambiar archivo" : "Change file"}</span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".srt,.vtt,.txt,text/plain"
            onChange={handleFileChange}
            className="hidden"
          />
        </div>

        {/* Font Size Adjusters */}
        <div className="flex items-center bg-[var(--surface-primary)] rounded-xl border border-[var(--border-primary)] p-0.5">
          <button
            type="button"
            onClick={handleZoomOut}
            disabled={fontSize === 'sm'}
            title="Reducir tamaño de letra"
            className="p-1 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] disabled:opacity-30 transition-colors"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <span className="text-[10px] font-bold px-1.5 text-rose-600 dark:text-rose-300 uppercase">
            {fontSize}
          </span>
          <button
            type="button"
            onClick={handleZoomIn}
            disabled={fontSize === 'xl'}
            title="Aumentar tamaño de letra"
            className="p-1 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] disabled:opacity-30 transition-colors"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

export default TranscriptControls;
