import React, { useState, useEffect } from 'react';
import {
  getAllSavedTranscripts,
  deleteTranscriptFromLibrary
} from '../../services/transcriptLibraryStorage.js';
import {
  BookOpen,
  Search,
  CheckCircle2,
  Clock,
  Trash2,
  X,
  Play,
  FileText
} from 'lucide-react';
import { useSiteLanguage } from '../../context/SiteLanguageContext.jsx';

const LANGUAGE_META = {
  zh: { name: 'Chino Mandarín', flag: '🇨🇳' },
  ar: { name: 'Árabe', flag: '🇸🇦' },
  pl: { name: 'Polaco', flag: '🇵🇱' },
  ru: { name: 'Ruso', flag: '🇷🇺' },
  en: { name: 'Inglés', flag: '🇬🇧' },
  es: { name: 'Español', flag: '🇪🇸' },
  de: { name: 'Alemán', flag: '🇩🇪' },
  fr: { name: 'Francés', flag: '🇫🇷' },
  it: { name: 'Italiano', flag: '🇮🇹' },
  nl: { name: 'Nederlands', flag: '🇳🇱' }
};

export function SavedTranscriptsModal({
  isOpen,
  onClose,
  onLoadTranscript,
  onDeleteTranscript,
  currentVideoId = ''
}) {
  const { isSpanish } = useSiteLanguage();
  const [transcripts, setTranscripts] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);

  // Load saved transcripts when modal opens
  const loadList = async () => {
    setLoading(true);
    try {
      const items = await getAllSavedTranscripts();
      setTranscripts(items);
    } catch (e) {
      console.warn('Error loading transcripts:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadList();
      setDeleteConfirmId(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleDelete = async (id, e) => {
    e.stopPropagation();
    if (deleteConfirmId === id) {
      await deleteTranscriptFromLibrary(id);
      setDeleteConfirmId(null);
      // Immediately filter it out from local React state
      setTranscripts(prev => prev.filter(t => t.id !== id && String(t.id) !== String(id)));
      if (onDeleteTranscript) {
        onDeleteTranscript(id);
      }
      await loadList();
    } else {
      setDeleteConfirmId(id);
      setTimeout(() => setDeleteConfirmId(prev => (prev === id ? null : prev)), 3500);
    }
  };

  const handleSelect = (item) => {
    if (onLoadTranscript) {
      onLoadTranscript(item);
    }
    onClose();
  };

  const filtered = transcripts.filter(item => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const title = (item.videoTitle || '').toLowerCase();
    const vid = (item.videoId || '').toLowerCase();
    const lang = (item.targetLanguage || '').toLowerCase();
    return title.includes(q) || vid.includes(q) || lang.includes(q);
  });

  const formatDate = (isoStr) => {
    if (!isoStr) return '';
    try {
      const d = new Date(isoStr);
      return d.toLocaleDateString(isSpanish ? 'es-ES' : 'en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return '';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-xs animate-fade-in">
      <div
        className="w-full max-w-2xl bg-[#1a0b06] border border-[#54271a] rounded-2xl shadow-2xl shadow-black/70 flex flex-col max-h-[88vh] overflow-hidden text-white"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-5 py-3.5 border-b border-[#441f15] bg-[#220e08]">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-rose-600 to-pink-500 flex items-center justify-center text-white shadow-xs">
              <BookOpen className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-white tracking-wide flex items-center gap-2">
                <span>{isSpanish ? 'Biblioteca de Transcripciones' : 'Saved Transcripts Library'}</span>
                <span className="text-[10px] bg-rose-950/80 text-rose-300 font-mono px-2 py-0.5 rounded-full border border-rose-800">
                  {transcripts.length}
                </span>
              </h3>
              <p className="text-[11px] text-rose-300/70">
                {isSpanish
                  ? 'Transcripciones y glosados guardados localmente ($0 en Groq al reutilizar)'
                  : 'Locally saved transcripts ($0 Groq cost on reuse)'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-stone-400 hover:text-white hover:bg-[#381a11] rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search & Filter Bar */}
        <div className="p-3 border-b border-[#3e1b12] bg-[#1d0c07]">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-rose-300/40" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={isSpanish ? 'Buscar por título, ID de vídeo o idioma...' : 'Search by title, video ID or language...'}
              className="w-full bg-[#120603] text-white text-xs pl-9 pr-8 py-2 rounded-xl border border-[#482015] placeholder-rose-300/30 focus:outline-none focus:ring-1 focus:ring-rose-500"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Transcript Items List */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-2.5 custom-scrollbar min-h-[220px]">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 text-rose-300/60 text-xs">
              <div className="w-6 h-6 border-2 border-rose-500 border-t-transparent rounded-full animate-spin mb-2" />
              <span>{isSpanish ? 'Cargando biblioteca...' : 'Loading library...'}</span>
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 px-4 rounded-xl border border-dashed border-[#441f15] bg-[#220e08]/40 flex flex-col items-center justify-center">
              <FileText className="w-10 h-10 text-rose-400/40 mb-2" />
              <h4 className="text-sm font-bold text-rose-200 mb-1">
                {searchQuery
                  ? (isSpanish ? 'Sin coincidencias' : 'No matches found')
                  : (isSpanish ? 'Biblioteca vacía' : 'Library is empty')}
              </h4>
              <p className="text-xs text-rose-300/60 max-w-sm">
                {searchQuery
                  ? (isSpanish ? 'No se encontraron transcripciones con ese criterio de búsqueda.' : 'No saved transcripts matched your query.')
                  : (isSpanish ? 'Cuando importes subtítulos y se glosen con IA, se guardarán aquí automáticamente para que nunca vuelvas a pagar por ellos.' : 'Subtitles you import and gloss with AI will be saved here automatically.')}
              </p>
            </div>
          ) : (
            filtered.map((item) => {
              const langMeta = LANGUAGE_META[item.targetLanguage] || { name: item.targetLanguage.toUpperCase(), flag: '🌐' };
              const isCurrent = currentVideoId && item.videoId === currentVideoId;
              const isComplete = Boolean(item.isComplete);
              const completedCount = item.completedLinesCount || item.subtitlesCount;

              return (
                <div
                  key={item.id}
                  onClick={() => handleSelect(item)}
                  className={`p-3 sm:p-3.5 rounded-xl border transition-all cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3 group ${
                    isCurrent
                      ? 'bg-[#2e140b] border-rose-500/80 shadow-md shadow-rose-950/30'
                      : 'bg-[#220e08] hover:bg-[#2b120a] border-[#441f15] hover:border-[#622d1e]'
                  }`}
                >
                  {/* Left: Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      {/* Language Flag Badge */}
                      <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-md bg-[#140603] border border-[#482015] font-semibold text-rose-200">
                        <span>{langMeta.flag}</span>
                        <span>{langMeta.name}</span>
                      </span>

                      {/* Status Badge */}
                      {isComplete ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-300 bg-emerald-950/70 border border-emerald-800 px-2 py-0.5 rounded-full">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>{isSpanish ? '✓ Completo' : '✓ Complete'}</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-300 bg-amber-950/70 border border-amber-800 px-2 py-0.5 rounded-full">
                          <Clock className="w-3 h-3" />
                          <span>{isSpanish ? `⏳ Parcial (${completedCount}/${item.subtitlesCount})` : `⏳ Partial (${completedCount}/${item.subtitlesCount})`}</span>
                        </span>
                      )}

                      {/* Current Video Badge */}
                      {isCurrent && (
                        <span className="text-[10px] font-bold text-rose-300 bg-rose-950/90 border border-rose-700 px-1.5 py-0.5 rounded">
                          {isSpanish ? 'Vídeo actual' : 'Current video'}
                        </span>
                      )}
                    </div>

                    {/* Title */}
                    <h4 className="text-xs sm:text-sm font-bold text-white group-hover:text-rose-200 transition-colors truncate">
                      {item.videoTitle || item.videoId}
                    </h4>

                    {/* Meta info */}
                    <div className="flex items-center gap-3 text-[11px] text-rose-300/60 mt-1">
                      <span className="font-mono">ID: {item.videoId}</span>
                      <span>•</span>
                      <span>{item.subtitlesCount} {isSpanish ? 'líneas' : 'lines'}</span>
                      {item.updatedAt && (
                        <>
                          <span>•</span>
                          <span>{formatDate(item.updatedAt)}</span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Right: Actions */}
                  <div className="flex items-center space-x-2 shrink-0 self-end sm:self-center">
                    {/* Load Button */}
                    <button
                      type="button"
                      onClick={() => handleSelect(item)}
                      className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-500 hover:to-pink-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm active:scale-95 transition-all cursor-pointer"
                    >
                      <Play className="w-3 h-3 fill-white" />
                      <span>{isSpanish ? 'Cargar' : 'Load'}</span>
                    </button>

                    {/* Delete Button */}
                    <button
                      type="button"
                      onClick={(e) => handleDelete(item.id, e)}
                      title={isSpanish ? 'Eliminar de la biblioteca' : 'Delete from library'}
                      className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                        deleteConfirmId === item.id
                          ? 'bg-red-700 text-white animate-pulse'
                          : 'text-stone-400 hover:text-red-400 hover:bg-[#3a180f]'
                      }`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2.5 bg-[#220e08] border-t border-[#441f15] flex items-center justify-between text-xs text-rose-300/60">
          <span>
            {isSpanish ? 'Los datos se guardan de forma permanente en tu dispositivo.' : 'Data is saved permanently in your device storage.'}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1 rounded-lg bg-[#2e130a] hover:bg-[#3e190d] border border-[#4e2215] text-rose-200 text-xs font-medium cursor-pointer"
          >
            {isSpanish ? 'Cerrar' : 'Close'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default SavedTranscriptsModal;
