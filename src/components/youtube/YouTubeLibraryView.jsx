import React, { useState, useEffect, useCallback } from 'react';
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
  FileText,
  Plus,
  ArrowLeft,
  Youtube
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
  nl: { name: 'Nederlands', flag: '🇳🇱' },
  tr: { name: 'Turco', flag: '🇹🇷' }
};

export function YouTubeLibraryView({
  onSelectVideo,
  onAddNew,
  onBackToHome,
  currentVideoId = ''
}) {
  const { isSpanish } = useSiteLanguage();
  const [transcripts, setTranscripts] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);

  const loadList = useCallback(async () => {
    setLoading(true);
    try {
      const items = await getAllSavedTranscripts();
      setTranscripts(items || []);
    } catch (e) {
      console.warn('Error loading transcripts in YouTubeLibraryView:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadList();
  }, [loadList]);

  const handleDelete = async (id, e) => {
    e.stopPropagation();
    if (deleteConfirmId === id) {
      try {
        await deleteTranscriptFromLibrary(id);
      } catch (err) {
        console.warn('Error deleting transcript:', err);
      }
      setDeleteConfirmId(null);
      setTranscripts(prev => prev.filter(t => t.id !== id && String(t.id) !== String(id)));
      await loadList();
    } else {
      setDeleteConfirmId(id);
      setTimeout(() => {
        setDeleteConfirmId(prev => (prev === id ? null : prev));
      }, 3500);
    }
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
        year: 'numeric'
      });
    } catch {
      return '';
    }
  };

  const getPlaybackProgress = (item) => {
    if (!item) return 0;
    if (item.isComplete) return 100;

    const subs = Array.isArray(item.subtitles) ? item.subtitles : [];
    const lastSub = subs.length > 0 ? subs[subs.length - 1] : null;
    const totalDuration = typeof item.duration === 'number' && item.duration > 0
      ? item.duration
      : (lastSub ? (lastSub.endTime || lastSub.startTime || 0) : 0);

    const currentTime = typeof item.lastPlaybackTime === 'number' && !isNaN(item.lastPlaybackTime)
      ? Math.max(0, item.lastPlaybackTime)
      : 0;

    if (totalDuration > 0 && currentTime > 0) {
      return Math.min(100, Math.max(0, Math.round((currentTime / totalDuration) * 100)));
    }

    if (subs.length > 0 && item.lastSubtitleId) {
      const subIdx = subs.findIndex(s => String(s.id) === String(item.lastSubtitleId));
      if (subIdx !== -1) {
        return Math.min(100, Math.max(0, Math.round(((subIdx + 1) / subs.length) * 100)));
      }
    }

    return 0;
  };

  return (
    <div className="flex flex-col h-full w-full max-w-5xl mx-auto px-3 sm:px-6 py-3 sm:py-5 overflow-hidden text-[var(--text-primary)]">
      {/* Top Header Bar */}
      <div className="flex-shrink-0 flex items-center justify-between gap-3 pb-3 sm:pb-4 border-b border-[var(--border-primary)]">
        <div className="flex items-center space-x-3">
          {onBackToHome && (
            <button
              type="button"
              onClick={onBackToHome}
              title={isSpanish ? 'Volver a Inicio' : 'Back to Home'}
              className="p-2 rounded-xl bg-[var(--surface-secondary)] hover:bg-[var(--surface-hover)] border border-[var(--border-primary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer flex items-center gap-1.5 text-xs font-semibold shadow-xs"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">{isSpanish ? 'Inicio' : 'Home'}</span>
            </button>
          )}

          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-rose-600 to-pink-500 flex items-center justify-center text-white shadow-md shadow-rose-950/40">
            <BookOpen className="w-5 h-5" />
          </div>

          <div>
            <h1 className="text-base sm:text-lg font-bold text-[var(--text-primary)] tracking-wide flex items-center gap-2">
              <span>{isSpanish ? 'Biblioteca de YouTube' : 'YouTube Library'}</span>
              <span className="text-[11px] bg-rose-500/15 text-rose-600 dark:text-rose-300 font-mono px-2 py-0.5 rounded-full border border-rose-500/30">
                {transcripts.length}
              </span>
            </h1>
            <p className="text-[11px] sm:text-xs text-[var(--text-muted)]">
              {isSpanish
                ? 'Tus vídeos y transcripciones guardadas con glosado instantáneo'
                : 'Your saved videos and transcripts with instant glossing'}
            </p>
          </div>
        </div>

        {/* Primary Call to Action: Add Video */}
        <button
          type="button"
          onClick={onAddNew}
          className="px-3.5 sm:px-4 py-2 rounded-xl bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-500 hover:to-pink-500 text-white text-xs sm:text-sm font-bold flex items-center gap-2 shadow-lg shadow-rose-950/40 active:scale-95 transition-all cursor-pointer shrink-0"
        >
          <Plus className="w-4 h-4 stroke-[2.5]" />
          <span>{isSpanish ? 'Añadir Vídeo' : 'Add Video'}</span>
        </button>
      </div>

      {/* Search & Stats Bar */}
      <div className="flex-shrink-0 pt-3 pb-3 flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={isSpanish ? 'Buscar por título, ID de vídeo o idioma...' : 'Search by title, video ID or language...'}
            className="w-full bg-[var(--input-bg)] text-[var(--text-primary)] text-xs sm:text-sm pl-9 pr-8 py-2.5 rounded-xl border border-[var(--input-border)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-1 focus:ring-rose-500 transition-all shadow-xs"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto pr-1 pb-4 custom-scrollbar min-h-0">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-[var(--text-muted)] text-xs sm:text-sm">
            <div className="w-8 h-8 border-2 border-rose-500 border-t-transparent rounded-full animate-spin mb-3" />
            <span>{isSpanish ? 'Cargando biblioteca de vídeos...' : 'Loading video library...'}</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 px-4 rounded-2xl border border-dashed border-[var(--border-primary)] bg-[var(--surface-secondary)] flex flex-col items-center justify-center my-6">
            <div className="w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center mb-3 text-rose-500 dark:text-rose-400">
              {searchQuery ? <Search className="w-7 h-7 opacity-70" /> : <Youtube className="w-7 h-7 opacity-70" />}
            </div>
            <h3 className="text-base font-bold text-[var(--text-primary)] mb-1">
              {searchQuery
                ? (isSpanish ? 'Sin coincidencias' : 'No matches found')
                : (isSpanish ? 'Tu biblioteca de YouTube está vacía' : 'Your YouTube library is empty')}
            </h3>
            <p className="text-xs sm:text-sm text-[var(--text-muted)] max-w-md mb-5 leading-relaxed">
              {searchQuery
                ? (isSpanish
                    ? 'No se encontraron vídeos con ese criterio de búsqueda. Prueba con otro título o idioma.'
                    : 'No saved transcripts matched your search query.')
                : (isSpanish
                    ? 'Importa un vídeo de YouTube con subtítulos para comenzar a leer y aprender con glosado instantáneo.'
                    : 'Import a YouTube video with subtitles to start reading and learning with instant glossing.')}
            </p>
            {!searchQuery && (
              <button
                type="button"
                onClick={onAddNew}
                className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-500 hover:to-pink-500 text-white text-xs sm:text-sm font-bold flex items-center gap-2 shadow-lg shadow-rose-950/40 active:scale-95 transition-all cursor-pointer"
              >
                <Plus className="w-4 h-4 stroke-[2.5]" />
                <span>{isSpanish ? 'Importar mi primer vídeo' : 'Import my first video'}</span>
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-4">
            {filtered.map((item) => {
              const langMeta = LANGUAGE_META[item.targetLanguage] || { name: item.targetLanguage.toUpperCase(), flag: '🌐' };
              const isCurrent = currentVideoId && item.videoId === currentVideoId;
              const isComplete = Boolean(item.isComplete);
              const completedCount = item.completedLinesCount || item.subtitlesCount;
              const thumbUrl = `https://img.youtube.com/vi/${item.videoId}/mqdefault.jpg`;
              const progressPercent = getPlaybackProgress(item);

              return (
                <div
                  key={item.id}
                  onClick={() => onSelectVideo(item)}
                  className={`group relative rounded-2xl border transition-all cursor-pointer flex flex-col overflow-hidden bg-[var(--surface-primary)] hover:bg-[var(--surface-secondary)] hover:border-rose-500/70 hover:shadow-xl dark:bg-[#220e08] dark:hover:bg-[#2b120a] dark:border-[#441f15] ${
                    isCurrent
                      ? 'border-rose-500 ring-1 ring-rose-500/50 shadow-md shadow-rose-950/20'
                      : 'border-[var(--border-primary)]'
                  }`}
                >
                  {/* Video Thumbnail Header */}
                  <div className="relative aspect-video w-full bg-black/60 overflow-hidden">
                    <img
                      src={thumbUrl}
                      alt={item.videoTitle || item.videoId}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      onError={(e) => {
                        e.target.style.display = 'none';
                      }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/30" />

                    {/* Language Badge */}
                    <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-black/75 backdrop-blur-xs border border-white/10 text-xs font-semibold text-rose-100 shadow-xs">
                      <span>{langMeta.flag}</span>
                      <span className="text-[11px]">{langMeta.name}</span>
                    </div>

                    {/* Status Badge */}
                    <div className="absolute top-2.5 right-2.5">
                      {isComplete ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-300 bg-emerald-950/80 backdrop-blur-xs border border-emerald-700/80 px-2 py-0.5 rounded-full shadow-xs">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>{isSpanish ? '✓ Completo' : '✓ Complete'}</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-300 bg-amber-950/80 backdrop-blur-xs border border-amber-700/80 px-2 py-0.5 rounded-full shadow-xs">
                          <Clock className="w-3 h-3" />
                          <span>{completedCount}/{item.subtitlesCount}</span>
                        </span>
                      )}
                    </div>

                    {/* Play Overlay */}
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/30">
                      <div className="w-11 h-11 rounded-full bg-rose-600/90 text-white flex items-center justify-center shadow-lg transform group-hover:scale-110 transition-transform">
                        <Play className="w-5 h-5 fill-white ml-0.5" />
                      </div>
                    </div>

                    {/* Playback Progress Bar */}
                    <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/60 overflow-hidden z-10">
                      <div
                        className="h-full bg-gradient-to-r from-rose-500 to-pink-500 transition-all duration-300"
                        style={{ width: `${progressPercent}%` }}
                      />
                    </div>
                  </div>

                  {/* Card Content */}
                  <div className="p-3.5 flex-1 flex flex-col justify-between">
                    <div>
                      <h4 className="text-sm font-bold text-[var(--text-primary)] group-hover:text-rose-600 dark:group-hover:text-rose-200 transition-colors line-clamp-2 leading-snug">
                        {item.videoTitle || item.videoId}
                      </h4>
                      <div className="flex items-center gap-2 text-[11px] text-[var(--text-muted)] mt-1.5 font-mono">
                        <span>ID: {item.videoId}</span>
                        <span>•</span>
                        <span>{item.subtitlesCount} {isSpanish ? 'líneas' : 'lines'}</span>
                      </div>
                    </div>

                    {/* Card Footer: Date + Actions */}
                    <div className="flex items-center justify-between pt-3 mt-2 border-t border-[var(--border-primary)] text-[11px] text-[var(--text-muted)]">
                      <span>{item.updatedAt ? formatDate(item.updatedAt) : ''}</span>

                      <div className="flex items-center space-x-1" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={(e) => handleDelete(item.id, e)}
                          title={isSpanish ? 'Eliminar de la biblioteca' : 'Delete from library'}
                          className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                            deleteConfirmId === item.id
                              ? 'bg-red-700 text-white animate-pulse'
                              : 'text-[var(--text-muted)] hover:text-red-500 hover:bg-[var(--surface-hover)]'
                          }`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Card Bottom Progress Bar */}
                    <div className="absolute bottom-0 left-0 right-0 h-1 bg-[var(--border-primary)]/40 overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-rose-500 to-pink-500 transition-all duration-300"
                        style={{ width: `${progressPercent}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default YouTubeLibraryView;
