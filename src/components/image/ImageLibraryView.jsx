import React, { useState, useEffect, useCallback } from 'react';
import {
  Camera,
  Search,
  Trash2,
  Plus,
  ArrowLeft,
  Calendar,
  Clock,
  BookOpen,
  AlertCircle,
  Loader2,
  Edit2,
  Check,
  X
} from 'lucide-react';
import {
  getAllImageDocuments,
  deleteImageDocument,
  updateImageDocumentTitle
} from '../../services/imageReaderLibraryStorage.js';
import { LanguageSelectDropdown } from '../LanguageSelectDropdown.jsx';
import { useSiteLanguage } from '../../context/SiteLanguageContext.jsx';
import { getLocalizedLanguageName, getLanguageMeta } from '../../constants/languages.js';

export function ImageLibraryView({
  targetLang = 'zh',
  setTargetLang,
  languages = [],
  onSelectDocument,
  onAddNew,
  onBackToHome
}) {
  const { isSpanish } = useSiteLanguage();
  const [documents, setDocuments] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);
  const [editingTitleId, setEditingTitleId] = useState(null);
  const [editingTitleText, setEditingTitleText] = useState('');

  const loadDocuments = useCallback(async () => {
    setLoading(true);
    try {
      const items = await getAllImageDocuments();
      setDocuments(items || []);
    } catch (e) {
      console.warn('[ImageLibraryView] Error loading image documents from IndexedDB:', e);
      setDocuments([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  const handleDelete = async (id, e) => {
    e.stopPropagation();
    if (deleteConfirmId === id) {
      try {
        await deleteImageDocument(id);
      } catch (err) {
        console.warn('Error deleting image document:', err);
      }
      setDeleteConfirmId(null);
      setDocuments(prev => prev.filter(d => d.id !== id));
      await loadDocuments();
    } else {
      setDeleteConfirmId(id);
      setTimeout(() => {
        setDeleteConfirmId(prev => (prev === id ? null : prev));
      }, 3500);
    }
  };

  const handleStartRename = (doc, e) => {
    e.stopPropagation();
    setEditingTitleId(doc.id);
    setEditingTitleText(doc.title || '');
  };

  const handleSaveRename = async (id, e) => {
    e.stopPropagation();
    if (!editingTitleText.trim()) {
      setEditingTitleId(null);
      return;
    }
    try {
      await updateImageDocumentTitle(id, editingTitleText.trim());
      setDocuments(prev => prev.map(d => d.id === id ? { ...d, title: editingTitleText.trim() } : d));
    } catch (err) {
      console.warn('Error renaming image document:', err);
    } finally {
      setEditingTitleId(null);
    }
  };

  const handleCancelRename = (e) => {
    e.stopPropagation();
    setEditingTitleId(null);
  };

  // Filter documents by active targetLang
  const languageFiltered = documents.filter((doc) => {
    const docLang = doc.targetLang || 'zh';
    return docLang === targetLang;
  });

  // Filter documents by search query
  const filtered = languageFiltered.filter((doc) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const title = (doc.title || '').toLowerCase();
    const desc = (doc.description || '').toLowerCase();
    return title.includes(q) || desc.includes(q);
  });

  const formatDate = (isoStr) => {
    if (!isoStr) return '';
    try {
      const d = new Date(isoStr);
      return d.toLocaleDateString(isSpanish ? 'es-ES' : 'en-US', {
        day: 'numeric',
        month: 'short'
      });
    } catch (e) {
      return '';
    }
  };

  const currentLangMeta = getLanguageMeta(targetLang);

  return (
    <div className="flex-1 overflow-y-auto w-full bg-[var(--app-bg)] text-[var(--text-primary)] flex flex-col justify-between">
      {/* Top sticky navigation bar */}
      <header className="sticky top-0 z-20 bg-white/80 dark:bg-[#201511]/85 backdrop-blur-xl border-b border-black/5 dark:border-white/10 px-3 sm:px-6 py-2.5 sm:py-3 flex items-center justify-between gap-3 shadow-sm">
        {/* Left: Back button & Title */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <button
            type="button"
            onClick={onBackToHome}
            className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center transition-all cursor-pointer active:scale-95 bg-black/5 hover:bg-black/10 dark:bg-white/10 dark:hover:bg-white/15 text-[var(--text-primary)] hover:text-rose-500 dark:hover:text-rose-300 shrink-0"
            title={isSpanish ? 'Volver al Inicio' : 'Back to Home'}
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-pink-600 via-rose-500 to-pink-400 flex items-center justify-center text-white shrink-0 shadow-sm">
              <Camera className="w-4 h-4" />
            </div>
            <h1 className="font-bold text-sm sm:text-base text-[var(--text-primary)] truncate">
              {isSpanish ? 'Lector de imágenes' : 'Image Reader'}
            </h1>
          </div>
        </div>

        {/* Right: + Nueva imagen button & Language Selector */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onAddNew}
            className="px-3 sm:px-4 py-1.5 rounded-xl font-bold text-xs bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-500 hover:to-pink-500 text-white shadow-xs hover:shadow-md transition-all flex items-center gap-1.5 cursor-pointer transform active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">{isSpanish ? 'Nueva imagen' : 'New Image'}</span>
          </button>

          {setTargetLang && (
            <LanguageSelectDropdown
              value={targetLang}
              onChange={setTargetLang}
              options={languages}
              variant="header"
              align="right"
            />
          )}
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-5xl mx-auto w-full px-3 sm:px-6 py-4 sm:py-6 flex-1 flex flex-col">
        {/* Section Title and Search Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-[var(--text-primary)]">
              {isSpanish ? 'Mis imágenes' : 'My Images'}
            </h2>
            <p className="text-xs text-[var(--text-secondary)] mt-0.5">
              {isSpanish
                ? `Imágenes guardadas para ${getLocalizedLanguageName(targetLang, currentLangMeta?.name || targetLang, isSpanish)}`
                : `Saved images for ${getLocalizedLanguageName(targetLang, currentLangMeta?.name || targetLang, isSpanish)}`}
              {' · '}
              <span className="font-semibold text-rose-500">{languageFiltered.length}</span>
            </p>
          </div>

          {/* Search filter input */}
          {languageFiltered.length > 0 && (
            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={isSpanish ? 'Buscar en mis imágenes...' : 'Search in my images...'}
                className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/15 text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:border-rose-500 focus:outline-hidden transition-all backdrop-blur-xs"
              />
            </div>
          )}
        </div>

        {/* Loading state */}
        {loading ? (
          <div className="flex-1 flex flex-col items-center justify-center py-16 text-[var(--text-secondary)] animate-fade-in">
            <Loader2 className="w-8 h-8 animate-spin text-rose-500 mb-3" />
            <p className="text-xs font-medium">{isSpanish ? 'Cargando tu biblioteca...' : 'Loading your library...'}</p>
          </div>
        ) : filtered.length === 0 ? (
          /* Empty state */
          <div className="flex-1 flex flex-col items-center justify-center py-16 text-center max-w-sm mx-auto animate-fade-in">
            <div className="w-16 h-16 rounded-3xl bg-[var(--surface-secondary)] border-2 border-dashed border-[var(--border-primary)] flex items-center justify-center text-[var(--text-secondary)] mb-4">
              <Camera className="w-8 h-8 opacity-50" />
            </div>
            <h3 className="text-base font-bold text-[var(--text-primary)] mb-1">
              {searchQuery.trim()
                ? (isSpanish ? 'No se encontraron resultados' : 'No matching results')
                : (isSpanish ? 'Aún no hay imágenes guardadas' : 'No saved images yet')}
            </h3>
            <p className="text-xs text-[var(--text-secondary)] mb-5 max-w-xs leading-relaxed">
              {searchQuery.trim()
                ? (isSpanish ? 'Intenta con otro término de búsqueda.' : 'Try a different search term.')
                : (isSpanish
                    ? `Toma una foto o sube una imagen en ${getLocalizedLanguageName(targetLang, currentLangMeta?.name || targetLang, isSpanish)} para estudiarla con audio y glosado.`
                    : `Snap a photo or upload an image in ${getLocalizedLanguageName(targetLang, currentLangMeta?.name || targetLang, isSpanish)} to study it with audio and glosses.`)}
            </p>
            {!searchQuery.trim() && (
              <button
                type="button"
                onClick={onAddNew}
                className="px-4 py-2 rounded-2xl font-bold text-xs bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-500 hover:to-pink-500 text-white shadow-md hover:shadow-lg transition-all flex items-center gap-2 cursor-pointer transform active:scale-95"
              >
                <Plus className="w-4 h-4" />
                <span>{isSpanish ? 'Agregar primera imagen' : 'Add First Image'}</span>
              </button>
            )}
          </div>
        ) : (
          /* Compact document list */
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 animate-fade-in">
            {filtered.map((doc) => {
              const langMeta = getLanguageMeta(doc.targetLang);
              const isDeleting = deleteConfirmId === doc.id;
              const isEditing = editingTitleId === doc.id;

              return (
                <div
                  key={doc.id}
                  onClick={() => !isEditing && onSelectDocument(doc)}
                  className="group relative flex min-h-[104px] gap-3 p-3 rounded-2xl bg-[var(--surface-primary)] hover:bg-[var(--surface-secondary)] border border-[var(--border-primary)] hover:border-rose-500/40 transition-all duration-200 shadow-xs hover:shadow-md cursor-pointer active:scale-[0.99]"
                >
                  {/* Compact thumbnail */}
                  <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-xl bg-[var(--surface-secondary)] overflow-hidden shrink-0">
                    {doc.imageBase64 ? (
                      <img
                        src={doc.imageBase64}
                        alt={doc.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-[var(--text-muted)]">
                        <Camera className="w-5 h-5 opacity-40" />
                      </div>
                    )}
                  </div>

                  {/* Discreet delete action */}
                  <button
                    type="button"
                    onClick={(e) => handleDelete(doc.id, e)}
                    title={isDeleting ? (isSpanish ? 'Confirmar eliminación' : 'Confirm delete') : (isSpanish ? 'Eliminar imagen' : 'Delete image')}
                    className={`absolute top-2.5 right-2.5 rounded-lg backdrop-blur-xs transition-all cursor-pointer flex items-center gap-1 ${
                      isDeleting
                        ? 'bg-rose-600 text-white shadow-md animate-pulse ring-1 ring-white/50 text-[10px] font-bold px-2 py-1'
                        : 'bg-[var(--surface-secondary)]/80 text-[var(--text-muted)] hover:text-rose-500 hover:bg-rose-500/10 opacity-60 sm:opacity-0 sm:group-hover:opacity-100 p-1.5'
                    }`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    {isDeleting && <span>{isSpanish ? 'Confirmar' : 'Confirm'}</span>}
                  </button>

                  {/* Document details */}
                  <div className="min-w-0 flex-1 flex flex-col pr-5">
                    <div className="flex items-start gap-2">
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold tracking-wide uppercase px-1.5 py-0.5 rounded-md bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-300 shrink-0">
                        <span>{langMeta?.flag || '🌐'}</span>
                        <span>{doc.level || 'B1'}</span>
                      </span>

                      {isEditing ? (
                        <div className="flex min-w-0 flex-1 items-center gap-1" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="text"
                            value={editingTitleText}
                            onChange={(e) => setEditingTitleText(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleSaveRename(doc.id, e);
                              if (e.key === 'Escape') handleCancelRename(e);
                            }}
                            autoFocus
                            className="min-w-0 flex-1 px-2 py-1 rounded-lg bg-[var(--input-bg)] border border-rose-500 text-xs text-[var(--text-primary)] font-semibold focus:outline-hidden"
                          />
                          <button
                            type="button"
                            onClick={(e) => handleSaveRename(doc.id, e)}
                            className="p-1 rounded-lg bg-emerald-600 text-white hover:bg-emerald-500 transition-colors cursor-pointer"
                            title={isSpanish ? 'Guardar' : 'Save'}
                          >
                            <Check className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            onClick={handleCancelRename}
                            className="p-1 rounded-lg bg-[var(--surface-secondary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
                            title={isSpanish ? 'Cancelar' : 'Cancel'}
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex min-w-0 flex-1 items-start gap-1 group/title">
                          <h3 className="min-w-0 flex-1 text-sm sm:text-base font-semibold text-[var(--text-primary)] line-clamp-1 group-hover:text-rose-500 transition-colors leading-snug">
                            {doc.title || (isSpanish ? 'Imagen sin título' : 'Untitled Image')}
                          </h3>
                          <button
                            type="button"
                            onClick={(e) => handleStartRename(doc, e)}
                            title={isSpanish ? 'Editar título' : 'Edit title'}
                            className="p-0.5 rounded text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)] opacity-0 group-hover/title:opacity-100 transition-opacity shrink-0"
                          >
                            <Edit2 className="w-3 h-3" />
                          </button>
                        </div>
                      )}
                    </div>

                    <p className="text-[11px] text-[var(--text-secondary)] line-clamp-2 min-h-[2.75rem] mt-1.5 leading-relaxed">
                      {doc.description || ''}
                    </p>

                    <div className="mt-auto pt-1.5 flex items-center gap-1.5 text-[11px] text-[var(--text-muted)] font-medium">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 opacity-70" />
                        <span>{formatDate(doc.updatedAt || doc.createdAt)}</span>
                      </span>
                      <span className="opacity-50">•</span>
                      <span className="flex items-center gap-1">
                        <BookOpen className="w-3.5 h-3.5 opacity-70" />
                        <span>{Array.isArray(doc.paragraphs) ? doc.paragraphs.length : 0} {isSpanish ? 'párrafos' : 'paragraphs'}</span>
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}

export default ImageLibraryView;
