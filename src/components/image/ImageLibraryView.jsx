import React, { useState, useEffect, useCallback } from 'react';
import {
  Camera,
  Search,
  Trash2,
  Plus,
  ArrowLeft,
  Calendar,
  Clock,
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
import { getLanguageMeta } from '../../constants/languages.js';

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
      <header className="sticky top-0 z-20 bg-[var(--header-bg)] backdrop-blur-md border-b border-[var(--border-primary)] px-3 sm:px-6 py-3 flex items-center justify-between gap-3 shadow-xs">
        {/* Left: Back button & Title */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <button
            type="button"
            onClick={onBackToHome}
            className="p-2 rounded-xl text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)] transition-all cursor-pointer shrink-0"
            title={isSpanish ? 'Volver al Inicio' : 'Back to Home'}
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-emerald-600 via-teal-500 to-rose-500 flex items-center justify-center text-white shrink-0 shadow-sm">
              <Camera className="w-4 h-4" />
            </div>
            <h1 className="font-bold text-sm sm:text-base text-[var(--text-primary)] truncate">
              Image Reader
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
                ? `Imágenes guardadas para ${currentLangMeta?.name || targetLang}`
                : `Saved images for ${currentLangMeta?.name || targetLang}`}
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
                className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-[var(--surface-secondary)] border border-[var(--border-primary)] text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:border-rose-500 focus:outline-hidden transition-all"
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
                    ? `Toma una foto o sube una imagen en ${currentLangMeta?.name || targetLang} para estudiarla con audio y glosado.`
                    : `Snap a photo or upload an image in ${currentLangMeta?.name || targetLang} to study it with audio and glosses.`)}
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
          /* Cards Grid */
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5 sm:gap-4.5 animate-fade-in">
            {filtered.map((doc) => {
              const langMeta = getLanguageMeta(doc.targetLang);
              const isDeleting = deleteConfirmId === doc.id;
              const isEditing = editingTitleId === doc.id;

              return (
                <div
                  key={doc.id}
                  onClick={() => !isEditing && onSelectDocument(doc)}
                  className="group relative flex flex-col justify-between rounded-2xl bg-[var(--surface-primary)] hover:bg-[var(--surface-secondary)] border border-[var(--border-primary)] hover:border-rose-500/50 transition-all duration-200 shadow-xs hover:shadow-sm overflow-hidden cursor-pointer active:scale-[0.99]"
                >
                  {/* Compact Thumbnail Container */}
                  <div className="relative w-full aspect-[16/8] bg-[var(--surface-secondary)] overflow-hidden">
                    {doc.imageBase64 ? (
                      <img
                        src={doc.imageBase64}
                        alt={doc.title}
                        className="w-full h-full object-cover group-hover:scale-102 transition-transform duration-300"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-[var(--text-muted)]">
                        <Camera className="w-6 h-6 opacity-30" />
                      </div>
                    )}

                    {/* Delete action button - sleek floating button in top-right corner */}
                    <button
                      type="button"
                      onClick={(e) => handleDelete(doc.id, e)}
                      title={isDeleting ? (isSpanish ? 'Confirmar eliminación' : 'Confirm delete') : (isSpanish ? 'Eliminar imagen' : 'Delete image')}
                      className={`absolute top-2 right-2 rounded-lg backdrop-blur-xs transition-all cursor-pointer flex items-center gap-1 ${
                        isDeleting
                          ? 'bg-rose-600 text-white shadow-md animate-pulse ring-2 ring-white/50 text-[10px] font-bold px-2 py-1'
                          : 'bg-black/40 text-white/80 hover:text-white hover:bg-rose-600/90 opacity-70 sm:opacity-0 group-hover:opacity-100 p-1.5'
                      }`}
                    >
                      <Trash2 className="w-3 h-3" />
                      {isDeleting && <span>{isSpanish ? 'Confirmar' : 'Confirm'}</span>}
                    </button>
                  </div>

                  {/* Card Content Body */}
                  <div className="p-3 sm:p-3.5 flex-1 flex flex-col justify-between">
                    <div>
                      {/* Language & Level Tag - Clean & integrated */}
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold tracking-wide uppercase px-1.5 py-0.5 rounded-md bg-[var(--surface-secondary)] border border-[var(--border-primary)] text-[var(--text-secondary)]">
                          <span>{langMeta?.flag || '🌐'}</span>
                          <span>{doc.level || 'B1'}</span>
                        </span>
                      </div>

                      {/* Title or Inline Edit */}
                      {isEditing ? (
                        <div className="flex items-center gap-1 my-1" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="text"
                            value={editingTitleText}
                            onChange={(e) => setEditingTitleText(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleSaveRename(doc.id, e);
                              if (e.key === 'Escape') handleCancelRename(e);
                            }}
                            autoFocus
                            className="flex-1 px-2 py-1 rounded-lg bg-[var(--input-bg)] border border-rose-500 text-xs text-[var(--text-primary)] font-bold focus:outline-hidden"
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
                        <div className="flex items-start justify-between gap-1 group/title">
                          <h3 className="font-bold text-xs sm:text-sm text-[var(--text-primary)] line-clamp-1 group-hover:text-rose-500 transition-colors leading-snug">
                            {doc.title || (isSpanish ? 'Imagen sin título' : 'Untitled Image')}
                          </h3>
                          <button
                            type="button"
                            onClick={(e) => handleStartRename(doc, e)}
                            title={isSpanish ? 'Editar título' : 'Edit title'}
                            className="p-0.5 rounded text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)] opacity-0 group-hover/title:opacity-100 transition-opacity shrink-0"
                          >
                            <Edit2 className="w-2.5 h-2.5" />
                          </button>
                        </div>
                      )}

                      {/* Snippet / Description Preview */}
                      <p className="text-[11px] text-[var(--text-secondary)] line-clamp-2 mt-1 leading-relaxed">
                        {doc.description || ''}
                      </p>
                    </div>

                    {/* Card Footer: Date and Paragraphs count */}
                    <div className="mt-3 pt-2 border-t border-[var(--border-primary)]/40 flex items-center justify-between text-[10px] text-[var(--text-muted)] font-medium">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3 opacity-60" />
                        <span>{formatDate(doc.updatedAt || doc.createdAt)}</span>
                      </span>
                      <span>
                        {Array.isArray(doc.paragraphs) ? doc.paragraphs.length : 0} {isSpanish ? 'párrafos' : 'paragraphs'}
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
