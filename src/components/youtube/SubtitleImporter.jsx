import React, { useState, useRef } from 'react';
import { parseSubtitlesAuto } from '../../services/subtitleService.js';
import { FileText, Upload, CheckCircle2, RotateCcw, AlertCircle, FileCode, Pause, Play } from 'lucide-react';
import { useSiteLanguage } from '../../context/SiteLanguageContext.jsx';

export function SubtitleImporter({
  onSubtitlesLoaded,
  subtitlesCount = 0,
  currentFormat = null,
  onClearSubtitles,
  glossProgress = null,
  onStopOrPauseGlossing = null,
  onResumeGlossing = null
}) {
  const { isSpanish } = useSiteLanguage();
  const [isExpanded, setIsExpanded] = useState(false);
  const [tab, setTab] = useState('paste'); // 'paste' | 'file'
  const [pastedText, setPastedText] = useState('');
  const [error, setError] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef(null);

  // Handle pasted text submission
  const handleProcessPasted = () => {
    setError(null);
    if (!pastedText.trim()) {
      setError('Pega texto o contenido SRT/VTT en el campo antes de procesar.');
      return;
    }

    try {
      setIsProcessing(true);
      const { format, subtitles } = parseSubtitlesAuto(pastedText);

      if (!subtitles || subtitles.length === 0) {
        setError('No se detectaron líneas de texto válidas.');
        return;
      }

      if (onSubtitlesLoaded) {
        onSubtitlesLoaded(subtitles, format, 'Texto pegado');
      }
      setPastedText('');
      setIsExpanded(false);
    } catch (err) {
      setError('Error al procesar el texto: ' + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle file upload
  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setIsProcessing(true);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result;
        if (typeof content !== 'string') {
          setError('No se pudo leer el archivo seleccionado.');
          return;
        }

        const { format, subtitles } = parseSubtitlesAuto(content, file.name);

        if (!subtitles || subtitles.length === 0) {
          setError(`El archivo "${file.name}" no contiene líneas de subtítulos legibles.`);
          return;
        }

        if (onSubtitlesLoaded) {
          onSubtitlesLoaded(subtitles, format, file.name);
        }
        setIsExpanded(false);
      } catch (err) {
        setError('Error al parsear el archivo: ' + err.message);
      } finally {
        setIsProcessing(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };

    reader.onerror = () => {
      setError('Error al abrir el archivo.');
      setIsProcessing(false);
    };

    // Read with UTF-8 encoding to preserve Chinese, Arabic, Russian, Polish, etc.
    reader.readAsText(file, 'UTF-8');
  };

  // If subtitles are loaded and not manually expanded, show a slim, single-line compact bar
  if (subtitlesCount > 0 && !isExpanded) {
    return (
      <div className="px-3 py-1.5 rounded-xl bg-[#200d07] border border-[#482015] shadow-xs flex items-center justify-between text-xs transition-all">
        <div className="flex items-center space-x-2 text-stone-200 truncate">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          <span className="font-semibold text-emerald-300 text-xs truncate">
            {isSpanish ? 'Subtítulos cargados' : 'Subtitles loaded'}
          </span>
          <span className="text-stone-400 text-[11px] font-mono shrink-0">
            ({subtitlesCount} {isSpanish ? 'líneas' : 'lines'}{currentFormat ? ` · ${currentFormat.toUpperCase()}` : ''})
          </span>

          {/* Pause / Stop glossing in subtitle bar */}
          {glossProgress && glossProgress.isGlossing && onStopOrPauseGlossing && (
            <button
              type="button"
              onClick={onStopOrPauseGlossing}
              title={isSpanish ? 'Pausar / Detener glosado IA' : 'Pause / Stop AI glossing'}
              className="px-2 py-0.5 rounded-md bg-amber-950/90 hover:bg-amber-900 border border-amber-600 text-amber-200 text-[10px] font-bold transition-all flex items-center gap-1 cursor-pointer active:scale-95 shadow-xs animate-pulse"
            >
              <Pause className="w-2.5 h-2.5 fill-amber-300 text-amber-300" />
              <span>{isSpanish ? 'Pausar glosado' : 'Pause glossing'}</span>
            </button>
          )}

          {/* Resume glossing in subtitle bar */}
          {glossProgress && (glossProgress.isPaused || (!glossProgress.isGlossing && !glossProgress.isComplete && glossProgress.completed < glossProgress.total)) && onResumeGlossing && (
            <button
              type="button"
              onClick={onResumeGlossing}
              title={isSpanish ? 'Reanudar glosado IA' : 'Resume AI glossing'}
              className="px-2 py-0.5 rounded-md bg-emerald-950/90 hover:bg-emerald-900 border border-emerald-600 text-emerald-200 text-[10px] font-bold transition-all flex items-center gap-1 cursor-pointer active:scale-95 shadow-xs"
            >
              <Play className="w-2.5 h-2.5 fill-emerald-300 text-emerald-300" />
              <span>{isSpanish ? 'Reanudar glosado' : 'Resume glossing'}</span>
              <span className="opacity-80 font-mono text-[9px]">({glossProgress.completed}/{glossProgress.total})</span>
            </button>
          )}
        </div>

        <div className="flex items-center space-x-1.5 shrink-0">
          <button
            type="button"
            onClick={() => setIsExpanded(true)}
            className="px-2.5 py-1 rounded-lg bg-[#2e130a] hover:bg-[#3e190d] border border-[#4e2215] text-rose-200 hover:text-white font-medium text-[11px] transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer active:scale-95"
          >
            <FileCode className="w-3 h-3 text-rose-400" />
            <span>{isSpanish ? 'Cambiar / Importar otros' : 'Change / Import other'}</span>
          </button>

          {onClearSubtitles && (
            <button
              type="button"
              onClick={onClearSubtitles}
              title={isSpanish ? 'Borrar subtítulos' : 'Clear subtitles'}
              className="p-1 rounded-lg text-rose-300/60 hover:text-rose-200 hover:bg-[#381a11] transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="p-3.5 sm:p-4 rounded-2xl bg-[#200d07] border border-[#482015] shadow-lg shadow-black/30">
      <div className="flex items-center justify-between gap-2 mb-2.5">
        <div className="flex items-center space-x-2">
          <FileCode className="w-4 h-4 text-rose-400" />
          <h3 className="text-sm font-bold text-white tracking-wide">
            {isSpanish ? 'Subtítulos / Transcripción' : 'Subtitles / Transcript'}
          </h3>
        </div>

        {subtitlesCount > 0 && (
          <div className="flex items-center space-x-2">
            <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-300 bg-emerald-950/70 px-2 py-0.5 rounded-full border border-emerald-800">
              <CheckCircle2 className="w-3 h-3" />
              <span>{subtitlesCount} {isSpanish ? 'líneas' : 'lines'}</span>
            </span>
            <button
              type="button"
              onClick={() => setIsExpanded(false)}
              className="px-2.5 py-1 rounded-lg text-[11px] font-medium text-stone-300 hover:text-white bg-[#2e130a] hover:bg-[#3e190d] border border-[#4e2215] cursor-pointer"
            >
              {isSpanish ? '✕ Cerrar' : '✕ Close'}
            </button>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex p-1 bg-[#1e0f0a] rounded-xl border border-[#482519] text-xs font-semibold mb-3 max-w-xs">
        <button
          type="button"
          onClick={() => { setTab('paste'); setError(null); }}
          className={`flex-1 py-1.5 px-3 rounded-lg transition-all flex items-center justify-center gap-1.5 ${
            tab === 'paste'
              ? 'bg-gradient-to-r from-rose-600 to-pink-600 text-white shadow-xs'
              : 'text-rose-200/70 hover:text-white'
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          <span>Pegar transcript</span>
        </button>
        <button
          type="button"
          onClick={() => { setTab('file'); setError(null); }}
          className={`flex-1 py-1.5 px-3 rounded-lg transition-all flex items-center justify-center gap-1.5 ${
            tab === 'file'
              ? 'bg-gradient-to-r from-rose-600 to-pink-600 text-white shadow-xs'
              : 'text-rose-200/70 hover:text-white'
          }`}
        >
          <Upload className="w-3.5 h-3.5" />
          <span>Importar archivo</span>
        </button>
      </div>

      {/* Tab 1: Paste Text */}
      {tab === 'paste' && (
        <div className="space-y-2.5">
          <textarea
            rows={4}
            value={pastedText}
            onChange={(e) => setPastedText(e.target.value)}
            placeholder="Pega aquí el texto plano o el contenido de un archivo .srt o .vtt...&#10;Ejemplo:&#10;1&#10;00:00:01,000 --> 00:00:03,000&#10;Hello, how are you?"
            className="w-full bg-[#1e0f0a] text-white text-xs font-mono rounded-xl p-3 border border-[#5a2e20] placeholder-rose-300/30 focus:outline-none focus:ring-2 focus:ring-rose-500 shadow-inner resize-y"
          />

          <div className="flex items-center justify-between">
            <span className="text-[11px] text-rose-300/60">
              Detecta automáticamente SRT, WebVTT o texto simple línea por línea.
            </span>
            <button
              type="button"
              onClick={handleProcessPasted}
              disabled={isProcessing || !pastedText.trim()}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-500 hover:to-pink-500 text-white font-bold text-xs shadow-md disabled:opacity-40 active:scale-95 transition-all"
            >
              {isProcessing ? 'Procesando...' : 'Cargar transcript'}
            </button>
          </div>
        </div>
      )}

      {/* Tab 2: Upload File */}
      {tab === 'file' && (
        <div>
          <div
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-[#5a2e20] hover:border-rose-500/80 bg-[#1e0f0a]/60 hover:bg-[#1e0f0a] rounded-2xl p-5 text-center cursor-pointer transition-all group"
          >
            <Upload className="w-7 h-7 mx-auto text-rose-400 group-hover:scale-110 transition-transform mb-2" />
            <p className="text-xs font-bold text-rose-200 mb-0.5">
              Haz clic para seleccionar o arrastra tu archivo aquí
            </p>
            <p className="text-[11px] text-rose-300/60">
              Formatos soportados: <span className="font-semibold text-rose-300">.srt</span>, <span className="font-semibold text-rose-300">.vtt</span>, <span className="font-semibold text-rose-300">.txt</span> (codificación UTF-8)
            </p>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept=".srt,.vtt,.txt,text/plain"
            onChange={handleFileUpload}
            className="hidden"
          />
        </div>
      )}

      {/* Error display */}
      {error && (
        <div className="flex items-center space-x-1.5 mt-2.5 text-xs font-semibold text-amber-300 bg-amber-950/70 p-2.5 rounded-xl border border-amber-800 animate-fade-in">
          <AlertCircle className="w-4 h-4 flex-shrink-0 text-amber-400" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}

export default SubtitleImporter;
