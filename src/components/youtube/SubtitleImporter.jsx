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
  onResumeGlossing = null,
  isExpanded: controlledExpanded = null,
  onToggleExpand = null,
  targetLang = 'zh'
}) {
  const { isSpanish } = useSiteLanguage();
  const [internalExpanded, setInternalExpanded] = useState(false);
  const isExpanded = controlledExpanded !== null ? controlledExpanded : internalExpanded;
  const setIsExpanded = onToggleExpand || setInternalExpanded;
  const [tab, setTab] = useState('paste'); // 'paste' | 'file'
  const [pastedText, setPastedText] = useState('');
  const [error, setError] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef(null);

  // Handle pasted text submission
  const handleProcessPasted = () => {
    setError(null);
    if (!pastedText.trim()) {
      setError(isSpanish ? 'Pega texto o contenido SRT/VTT en el campo antes de procesar.' : 'Paste text or SRT/VTT content into the field before processing.');
      return;
    }

    try {
      setIsProcessing(true);
      const { format, subtitles } = parseSubtitlesAuto(pastedText, '', targetLang);

      if (!subtitles || subtitles.length === 0) {
        setError(isSpanish ? 'No se detectaron líneas de texto válidas.' : 'No valid text lines were detected.');
        return;
      }

      if (onSubtitlesLoaded) {
        onSubtitlesLoaded(subtitles, format, isSpanish ? 'Texto pegado' : 'Pasted text');
      }
      setPastedText('');
      setIsExpanded(false);
    } catch (err) {
      setError((isSpanish ? 'Error al procesar el texto: ' : 'Error processing text: ') + err.message);
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
          setError(isSpanish ? 'No se pudo leer el archivo seleccionado.' : 'The selected file could not be read.');
          return;
        }

        const { format, subtitles } = parseSubtitlesAuto(content, file.name, targetLang);

        if (!subtitles || subtitles.length === 0) {
          setError(isSpanish ? `El archivo "${file.name}" no contiene líneas de subtítulos legibles.` : `The file "${file.name}" does not contain readable subtitle lines.`);
          return;
        }

        if (onSubtitlesLoaded) {
          try {
            onSubtitlesLoaded(subtitles, format, file.name);
            setIsExpanded(false);
          } catch (loadErr) {
            console.error('Error in onSubtitlesLoaded:', loadErr);
            setError((isSpanish ? 'Error processing transcript: ' : 'Error processing transcript: ') + (loadErr.message || (isSpanish ? 'Error desconocido' : 'Unknown error')));
          }
        } else {
          setIsExpanded(false);
        }
      } catch (err) {
        setError((isSpanish ? 'Error al analizar el archivo: ' : 'Error parsing file: ') + err.message);
      } finally {
        setIsProcessing(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };

    reader.onerror = () => {
      setError(isSpanish ? 'Error al abrir el archivo.' : 'Error opening file.');
      setIsProcessing(false);
    };

    // Read with UTF-8 encoding to preserve Chinese, Arabic, Russian, Polish, etc.
    reader.readAsText(file, 'UTF-8');
  };

  // When subtitles are already loaded and not expanded (and no error occurred), eliminate the intermediate bar
  if (subtitlesCount > 0 && !isExpanded && !error) {
    return null;
  }

  return (
    <div className="p-3.5 sm:p-4 rounded-2xl bg-[var(--surface-primary)] border border-[var(--border-primary)] shadow-lg text-[var(--text-primary)]">
      <div className="flex items-center justify-between gap-2 mb-2.5">
        <div className="flex items-center space-x-2">
          <FileCode className="w-4 h-4 text-rose-500 dark:text-rose-400" />
          <h3 className="text-sm font-bold text-[var(--text-primary)] tracking-wide">
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
              className="px-2.5 py-1 rounded-lg text-[11px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] bg-[var(--surface-secondary)] hover:bg-[var(--surface-hover)] border border-[var(--border-primary)] cursor-pointer"
            >
              {isSpanish ? '✕ Cerrar' : '✕ Close'}
            </button>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex p-1 bg-[var(--surface-secondary)] rounded-xl border border-[var(--border-primary)] text-xs font-semibold mb-3 max-w-xs">
        <button
          type="button"
          onClick={() => { setTab('paste'); setError(null); }}
          className={`flex-1 py-1.5 px-3 rounded-lg transition-all flex items-center justify-center gap-1.5 ${
            tab === 'paste'
              ? 'bg-gradient-to-r from-rose-600 to-pink-600 text-white shadow-xs'
              : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          <span>{isSpanish ? 'Pegar transcripción' : 'Paste transcript'}</span>
        </button>
        <button
          type="button"
          onClick={() => { setTab('file'); setError(null); }}
          className={`flex-1 py-1.5 px-3 rounded-lg transition-all flex items-center justify-center gap-1.5 ${
            tab === 'file'
              ? 'bg-gradient-to-r from-rose-600 to-pink-600 text-white shadow-xs'
              : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
          }`}
        >
          <Upload className="w-3.5 h-3.5" />
          <span>{isSpanish ? 'Importar archivo' : 'Import file'}</span>
        </button>
      </div>

      {/* Tab 1: Paste Text */}
      {tab === 'paste' && (
        <div className="space-y-2.5">
          <textarea
            rows={4}
            value={pastedText}
            onChange={(e) => setPastedText(e.target.value)}
            placeholder={isSpanish
              ? 'Pega aquí el texto plano o el contenido de un archivo .srt o .vtt...\nEjemplo:\n1\n00:00:01,000 --> 00:00:03,000\nHello, how are you?'
              : 'Paste plain text or the content of a .srt or .vtt file here...\nExample:\n1\n00:00:01,000 --> 00:00:03,000\nHello, how are you?'}
            className="w-full bg-[var(--input-bg)] text-[var(--text-primary)] text-xs font-mono rounded-xl p-3 border border-[var(--input-border)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-rose-500 shadow-inner resize-y"
          />

          <div className="flex items-center justify-between">
            <span className="text-[11px] text-[var(--text-muted)]">
              {isSpanish ? 'Detecta automáticamente SRT, WebVTT o texto simple línea por línea.' : 'Automatically detects SRT, WebVTT, or plain text line by line.'}
            </span>
            <button
              type="button"
              onClick={handleProcessPasted}
              disabled={isProcessing || !pastedText.trim()}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-500 hover:to-pink-500 text-white font-bold text-xs shadow-md disabled:opacity-40 active:scale-95 transition-all"
            >
              {isProcessing ? (isSpanish ? 'Procesando...' : 'Processing...') : (isSpanish ? 'Cargar transcripción' : 'Load transcript')}
            </button>
          </div>
        </div>
      )}

      {/* Tab 2: Upload File */}
      {tab === 'file' && (
        <div>
          <div
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-[var(--border-primary)] hover:border-rose-500/80 bg-[var(--surface-secondary)] hover:bg-[var(--surface-hover)] rounded-2xl p-5 text-center cursor-pointer transition-all group"
          >
            <Upload className="w-7 h-7 mx-auto text-rose-500 dark:text-rose-400 group-hover:scale-110 transition-transform mb-2" />
            <p className="text-xs font-bold text-[var(--text-primary)] mb-0.5">
              {isSpanish ? 'Haz clic para seleccionar o arrastra tu archivo aquí' : 'Click to select or drag your file here'}
            </p>
            <p className="text-[11px] text-[var(--text-muted)]">
              {isSpanish ? 'Formatos soportados: ' : 'Supported formats: '}<span className="font-semibold text-rose-600 dark:text-rose-300">.srt</span>, <span className="font-semibold text-rose-600 dark:text-rose-300">.vtt</span>, <span className="font-semibold text-rose-600 dark:text-rose-300">.txt</span> {isSpanish ? '(codificación UTF-8)' : '(UTF-8 encoding)'}
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
