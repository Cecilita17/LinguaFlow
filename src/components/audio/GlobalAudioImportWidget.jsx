import React from 'react';
import { useLocalAudioImport } from '../../context/LocalAudioImportContext.jsx';
import { useSiteLanguage } from '../../context/SiteLanguageContext.jsx';
import {
  Headphones,
  Loader2,
  Minimize2,
  Maximize2,
  X,
  CheckCircle2,
  AlertCircle,
  FileText,
  Play
} from 'lucide-react';

export function GlobalAudioImportWidget({ onOpenDocument = null }) {
  const {
    status,
    fileName,
    progressPercent,
    currentChunk,
    totalChunks,
    statusMessage,
    isMinimized,
    resultDoc,
    error,
    cancelImport,
    clearTask,
    setMinimized,
    toggleMinimized
  } = useLocalAudioImport();

  const { isSpanish } = useSiteLanguage();

  if (status === 'idle') {
    return null;
  }

  const isWorking = status === 'transcribing' || status === 'loading-model';
  const isCompleted = status === 'completed';
  const isError = status === 'error';
  const isCancelled = status === 'cancelled';

  const handleOpenDoc = () => {
    if (resultDoc && typeof onOpenDocument === 'function') {
      onOpenDocument(resultDoc);
    }
    clearTask();
  };

  // 1. Minimized View (Floating Pill / Dock)
  if (isMinimized) {
    return (
      <aside
        aria-label={isSpanish ? 'Progreso de importación de audio' : 'Audio import progress'}
        className="fixed bottom-20 sm:bottom-6 right-3 sm:right-6 z-50 animate-bounce-subtle"
      >
        <button
          type="button"
          onClick={toggleMinimized}
          title={isSpanish ? 'Expandir estado de importación' : 'Expand import status'}
          className="flex items-center space-x-2.5 px-3.5 py-2 rounded-2xl bg-[var(--surface-primary)]/95 hover:bg-[var(--surface-hover)] border border-emerald-500/40 shadow-xl shadow-black/20 text-[var(--text-primary)] cursor-pointer transition-all duration-200 active:scale-95 backdrop-blur-xl group"
        >
          <div className="relative flex items-center justify-center">
            {isWorking ? (
              <Loader2 className="w-4 h-4 text-emerald-500 animate-spin" />
            ) : isCompleted ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-500" />
            )}
            <Headphones className="w-2.5 h-2.5 absolute text-emerald-600 dark:text-emerald-400" />
          </div>

          <div className="text-left flex flex-col min-w-0 pr-1">
            <span className="text-xs font-bold truncate max-w-[130px] sm:max-w-[180px]">
              {isWorking
                ? (isSpanish ? 'Importando archivo de audio' : 'Importing audio file')
                : isCompleted
                  ? (isSpanish ? 'Audio listo' : 'Audio ready')
                  : (isSpanish ? 'Error en audio' : 'Audio error')}
            </span>
            <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-mono font-bold">
              {isWorking ? `${progressPercent}%` : isCompleted ? (isSpanish ? 'Completado' : 'Completed') : (isSpanish ? 'Detenido' : 'Stopped')}
            </span>
          </div>

          <Maximize2 className="w-3.5 h-3.5 text-[var(--text-muted)] group-hover:text-[var(--text-primary)] shrink-0 transition-colors" />
        </button>
      </aside>
    );
  }

  // 2. Expanded View (Floating Non-blocking Card)
  return (
    <aside
      aria-label={isSpanish ? 'Detalles de importación de audio' : 'Audio import details'}
      className="fixed bottom-20 sm:bottom-6 right-3 sm:right-6 z-50 max-w-sm sm:max-w-md w-[calc(100vw-1.5rem)] sm:w-auto animate-fade-in"
    >
      <div className="p-4 sm:p-5 rounded-3xl bg-[var(--surface-primary)]/95 border border-[var(--border-primary)] shadow-2xl shadow-black/30 backdrop-blur-xl text-[var(--text-primary)] flex flex-col space-y-3">
        {/* Top Header */}
        <div className="flex items-center justify-between gap-2 border-b border-[var(--border-subtle)] pb-2.5">
          <div className="flex items-center space-x-2.5 min-w-0">
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
              isCompleted
                ? 'bg-emerald-500/20 text-emerald-500'
                : isError || isCancelled
                  ? 'bg-rose-500/20 text-rose-500'
                  : 'bg-gradient-to-tr from-emerald-600 to-teal-500 text-white shadow-md shadow-emerald-950/40'
            }`}>
              {isWorking ? (
                <Headphones className="w-4 h-4 animate-pulse" />
              ) : isCompleted ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-500" />
              )}
            </div>

            <div className="min-w-0">
              <h4 className="text-xs sm:text-sm font-bold truncate text-[var(--text-primary)]">
                {isCompleted
                  ? (isSpanish ? '¡Importación de archivo de audio completada!' : 'Audio file import completed!')
                  : isError
                    ? (isSpanish ? 'Error al importar archivo de audio' : 'Error importing audio file')
                    : isCancelled
                      ? (isSpanish ? 'Importación cancelada' : 'Import cancelled')
                      : (isSpanish ? 'Importando archivo de audio' : 'Importing audio file')}
              </h4>
              <p className="text-[11px] text-[var(--text-muted)] truncate max-w-[200px] sm:max-w-[240px]">
                {fileName || (isSpanish ? 'Audio en proceso' : 'Audio in progress')}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-1 shrink-0">
            <button
              type="button"
              onClick={() => setMinimized(true)}
              title={isSpanish ? 'Minimizar a barra flotante' : 'Minimize to floating pill'}
              className="p-1.5 rounded-lg hover:bg-[var(--surface-hover)] text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer transition-colors"
            >
              <Minimize2 className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={isWorking ? cancelImport : clearTask}
              title={isWorking ? (isSpanish ? 'Cancelar importación' : 'Cancel import') : (isSpanish ? 'Cerrar' : 'Close')}
              className="p-1.5 rounded-lg hover:bg-rose-500/15 text-[var(--text-muted)] hover:text-rose-500 cursor-pointer transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Progress status & percentage */}
        {isWorking && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-[var(--text-secondary)] font-medium truncate max-w-[220px]">
                {totalChunks > 1
                  ? (isSpanish ? `Fragmento ${currentChunk} de ${totalChunks}` : `Chunk ${currentChunk} of ${totalChunks}`)
                  : (statusMessage || (isSpanish ? 'Transcribiendo audio...' : 'Transcribing audio...'))}
              </span>
              <span className="text-emerald-600 dark:text-emerald-400 font-mono font-bold shrink-0">
                {progressPercent}%
              </span>
            </div>

            {/* Progress bar */}
            <div className="w-full h-2 rounded-full bg-[var(--surface-secondary)] overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full transition-all duration-300"
                style={{ width: `${Math.max(5, Math.min(100, progressPercent))}%` }}
              />
            </div>

            <p className="text-[11px] text-[var(--text-muted)] leading-tight truncate">
              {statusMessage || (isSpanish ? 'Puedes navegar por LinguaFlow mientras finaliza.' : 'You can browse LinguaFlow while it finishes.')}
            </p>
          </div>
        )}

        {/* Completed State Actions */}
        {isCompleted && resultDoc && (
          <div className="space-y-3 pt-1">
            <p className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold leading-snug">
              {isSpanish
                ? `El audio se ha sincronizado con ${resultDoc.paragraphsCount || resultDoc.paragraphs?.length || 0} párrafos en la Biblioteca.`
                : `Audio synchronized with ${resultDoc.paragraphsCount || resultDoc.paragraphs?.length || 0} paragraphs in Library.`}
            </p>

            <div className="flex items-center justify-end space-x-2 pt-1">
              <button
                type="button"
                onClick={clearTask}
                className="px-3 py-1.5 rounded-xl bg-[var(--surface-secondary)] hover:bg-[var(--surface-hover)] border border-[var(--border-primary)] text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer transition-colors"
              >
                {isSpanish ? 'Cerrar' : 'Close'}
              </button>
              <button
                type="button"
                onClick={handleOpenDoc}
                className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white text-xs font-bold shadow-md shadow-emerald-950/40 cursor-pointer flex items-center space-x-1.5 transition-all active:scale-95"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>{isSpanish ? 'Abrir lectura' : 'Open reading'}</span>
              </button>
            </div>
          </div>
        )}

        {/* Error / Cancelled State Actions */}
        {(isError || isCancelled) && (
          <div className="space-y-3 pt-1">
            <p className="text-xs text-rose-600 dark:text-rose-400 leading-snug">
              {error || statusMessage}
            </p>

            <div className="flex items-center justify-end pt-1">
              <button
                type="button"
                onClick={clearTask}
                className="px-3 py-1.5 rounded-xl bg-[var(--surface-secondary)] hover:bg-[var(--surface-hover)] border border-[var(--border-primary)] text-xs font-semibold text-[var(--text-primary)] cursor-pointer transition-colors"
              >
                {isSpanish ? 'Descartar' : 'Dismiss'}
              </button>
            </div>
          </div>
        )}

        {/* Bottom Actions during work */}
        {isWorking && (
          <div className="flex items-center justify-between pt-1 border-t border-[var(--border-subtle)]/50">
            <button
              type="button"
              onClick={() => setMinimized(true)}
              className="text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] font-medium flex items-center space-x-1 cursor-pointer"
            >
              <Minimize2 className="w-3.5 h-3.5" />
              <span>{isSpanish ? 'Minimizar tarea' : 'Minimize task'}</span>
            </button>

            <button
              type="button"
              onClick={cancelImport}
              className="px-2.5 py-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-bold cursor-pointer transition-colors active:scale-95"
            >
              {isSpanish ? 'Cancelar' : 'Cancel'}
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
