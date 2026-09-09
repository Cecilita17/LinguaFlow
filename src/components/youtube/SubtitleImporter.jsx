import React, { useState, useRef } from 'react';
import { parseSubtitlesAuto } from '../../services/subtitleService.js';
import { FileText, Upload, CheckCircle2, RotateCcw, AlertCircle, FileCode } from 'lucide-react';

export function SubtitleImporter({
  onSubtitlesLoaded,
  subtitlesCount = 0,
  currentFormat = null,
  onClearSubtitles
}) {
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

  return (
    <div className="p-4 sm:p-5 rounded-2xl bg-[#32170f]/90 border border-[#52271a] shadow-lg shadow-black/30">
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center space-x-2">
          <FileCode className="w-4 h-4 text-rose-400" />
          <h3 className="text-sm font-bold text-white tracking-wide">Subtítulos / Transcripción</h3>
        </div>

        {subtitlesCount > 0 && (
          <div className="flex items-center space-x-2">
            <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-300 bg-emerald-950/70 px-2.5 py-0.5 rounded-full border border-emerald-800">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>{subtitlesCount} líneas ({currentFormat?.toUpperCase() || 'OK'})</span>
            </span>
            {onClearSubtitles && (
              <button
                type="button"
                onClick={onClearSubtitles}
                title="Cambiar o borrar subtítulos"
                className="p-1 rounded-lg text-rose-300/60 hover:text-white hover:bg-[#482519] transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            )}
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
