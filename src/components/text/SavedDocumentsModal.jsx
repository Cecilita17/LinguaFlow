import React, { useState, useEffect } from 'react';
import {
  BookOpen,
  Search,
  Trash2,
  X,
  FileText,
  Plus,
  ArrowRight,
  Clock,
  Layers,
  Loader2,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import {
  getAllDocuments,
  deleteDocument
} from '../../services/textDocumentService.js';
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

export function SavedDocumentsModal({
  isOpen,
  onClose,
  onSelectDocument,
  onNewDocument,
  onDeleteDocument = null,
  currentDocumentId = ''
}) {
  const { isSpanish } = useSiteLanguage();
  const [documents, setDocuments] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [confirmingDeleteId, setConfirmingDeleteId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [notification, setNotification] = useState(null); // { type: 'success' | 'error', message: string }

  const loadDocuments = async () => {
    setLoading(true);
    try {
      const items = await getAllDocuments();
      setDocuments(items);
    } catch (e) {
      console.warn('[SavedDocumentsModal] Error loading saved text documents from IndexedDB:', e);
      setDocuments([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadDocuments();
      setConfirmingDeleteId(null);
      setDeletingId(null);
      setNotification(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleConfirmDelete = async (id, e) => {
    e.stopPropagation();
    if (deletingId) return; // Prevent double click
    setDeletingId(id);

    try {
      // Step 1: Execute single-layer delete via textDocumentService -> textLibraryStorage -> IndexedDB
      const success = await deleteDocument(id);

      if (success) {
        setNotification({
          type: 'success',
          message: isSpanish ? '✓ Texto eliminado de la biblioteca' : '✓ Text deleted from library'
        });
        setConfirmingDeleteId(null);

        // Step 2: Reload documents from IndexedDB immediately
        await loadDocuments();

        // Step 3: Inform parent (TextReaderPage) so active state / draft is cleared if this was the open document
        if (onDeleteDocument) {
          await onDeleteDocument(id);
        } else if (currentDocumentId === id && onNewDocument) {
          onNewDocument();
        }
      } else {
        setNotification({
          type: 'error',
          message: isSpanish
            ? 'No se pudo eliminar el texto. Intentá nuevamente.'
            : 'Could not delete text. Please try again.'
        });
      }
    } catch (err) {
      console.error('[SavedDocumentsModal] Error deleting document:', err);
      setNotification({
        type: 'error',
        message: isSpanish
          ? 'Error al eliminar el texto. Intentá nuevamente.'
          : 'Error deleting text. Please try again.'
      });
    } finally {
      setDeletingId(null);
      setTimeout(() => {
        setNotification((prev) => (prev?.type === 'success' ? null : prev));
      }, 3500);
    }
  };

  const handleSelect = (doc) => {
    if (onSelectDocument) {
      onSelectDocument(doc);
    }
    onClose();
  };

  const handleCreateNew = () => {
    if (onNewDocument) {
      onNewDocument();
    }
    onClose();
  };

  const filtered = documents.filter(doc => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const title = (doc.title || '').toLowerCase();
    const raw = (doc.rawText || '').toLowerCase();
    const lang = (doc.targetLang || '').toLowerCase();
    return title.includes(q) || raw.includes(q) || lang.includes(q);
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
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-xs animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl bg-[var(--surface-primary)] border border-[var(--border-primary)] rounded-3xl shadow-2xl shadow-black/70 flex flex-col max-h-[88vh] overflow-hidden text-[var(--text-primary)]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-5 py-3.5 border-b border-[var(--border-primary)] bg-[var(--surface-secondary)]">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-rose-600 to-pink-500 flex items-center justify-center text-white shadow-xs">
              <BookOpen className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-[var(--text-primary)] tracking-wide flex items-center gap-2">
                <span>{isSpanish ? 'Biblioteca de Textos' : 'Text Documents Library'}</span>
                <span className="text-[10px] bg-rose-500/15 text-rose-600 dark:text-rose-300 font-mono font-bold px-2 py-0.5 rounded-full border border-rose-500/30">
                  {documents.length}
                </span>
              </h3>
              <p className="text-[11px] text-[var(--text-muted)]">
                {isSpanish
                  ? 'Textos, glosas manuales y segmentaciones guardados localmente'
                  : 'Locally saved text documents, manual glosses, and segmentations'}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={handleCreateNew}
              className="px-2.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold flex items-center space-x-1.5 transition-all shadow-xs cursor-pointer"
              title={isSpanish ? 'Crear un nuevo texto' : 'Create new text'}
            >
              <Plus className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{isSpanish ? 'Nuevo texto' : 'New text'}</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)] rounded-lg transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Status Notification Toast/Banner */}
        {notification && (
          <div
            className={`px-4 py-2 text-xs font-semibold flex items-center justify-between border-b animate-fade-in ${
              notification.type === 'error'
                ? 'bg-red-500/15 text-red-600 dark:text-red-300 border-red-500/30'
                : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 border-emerald-500/30'
            }`}
          >
            <div className="flex items-center space-x-2">
              {notification.type === 'error' ? (
                <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
              ) : (
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-500" />
              )}
              <span>{notification.message}</span>
            </div>
            <button
              type="button"
              onClick={() => setNotification(null)}
              className="text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer ml-2"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Search & Filter Bar */}
        <div className="p-3 border-b border-[var(--border-primary)] bg-[var(--surface-tertiary)]">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={isSpanish ? 'Buscar por título, contenido o idioma...' : 'Search by title, text or language...'}
              className="w-full bg-[var(--input-bg)] text-[var(--text-primary)] text-xs pl-9 pr-8 py-2 rounded-xl border border-[var(--input-border)] placeholder-[var(--text-muted)] focus:outline-hidden focus:border-rose-500"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Document Items List */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-2.5 custom-scrollbar min-h-[220px]">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 text-[var(--text-muted)] text-xs">
              <div className="w-6 h-6 border-2 border-rose-500 border-t-transparent rounded-full animate-spin mb-2" />
              <span>{isSpanish ? 'Cargando biblioteca...' : 'Loading library...'}</span>
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 px-4 rounded-2xl border border-dashed border-[var(--border-primary)] bg-[var(--surface-secondary)]/50 flex flex-col items-center justify-center">
              <FileText className="w-10 h-10 text-rose-500/40 mb-2" />
              <h4 className="text-sm font-bold text-[var(--text-primary)] mb-1">
                {searchQuery
                  ? (isSpanish ? 'Sin coincidencias' : 'No matches found')
                  : (isSpanish ? 'No tenés textos guardados todavía.' : 'No saved texts yet.')}
              </h4>
              <p className="text-xs text-[var(--text-muted)] max-w-sm mb-4">
                {searchQuery
                  ? (isSpanish ? 'No se encontraron textos con ese criterio de búsqueda.' : 'No saved texts matched your query.')
                  : (isSpanish ? 'Los textos que importes y gloses se guardarán automáticamente en tu biblioteca para que nunca pierdas tu trabajo.' : 'Texts you import and gloss will be saved in your library automatically.')}
              </p>
              {!searchQuery && (
                <button
                  type="button"
                  onClick={handleCreateNew}
                  className="px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold flex items-center space-x-1.5 transition-all shadow-xs cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>{isSpanish ? 'Importar texto' : 'Import text'}</span>
                </button>
              )}
            </div>
          ) : (
            filtered.map((doc) => {
              const langMeta = LANGUAGE_META[doc.targetLang] || { name: (doc.targetLang || '').toUpperCase(), flag: '🌐' };
              const isCurrent = currentDocumentId && doc.id === currentDocumentId;
              const paraCount = doc.paragraphs?.length || doc.paragraphsCount || 0;
              const savedLanguages = doc.languageStates ? Object.keys(doc.languageStates) : [doc.targetLang];
              const isConfirming = confirmingDeleteId === doc.id;

              return (
                <div
                  key={doc.id}
                  onClick={() => !isConfirming && handleSelect(doc)}
                  className={`p-3 sm:p-3.5 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 group ${
                    isCurrent
                      ? 'bg-rose-500/10 border-rose-500/80 shadow-md shadow-rose-950/20'
                      : 'bg-[var(--surface-secondary)] border-[var(--border-primary)] hover:bg-[var(--surface-hover)] hover:border-rose-500/40'
                  } ${isConfirming ? 'ring-2 ring-red-500/50' : 'cursor-pointer'}`}
                >
                  {/* Left: Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="text-sm" title={langMeta.name}>
                        {langMeta.flag}
                      </span>
                      <span className="text-xs font-semibold text-[var(--text-secondary)]">
                        {langMeta.name} {doc.nativeLang ? <span className="text-[11px] opacity-70 font-mono font-normal">→ {doc.nativeLang.toUpperCase()}</span> : null}
                      </span>

                      {savedLanguages.length > 1 && (
                        <span
                          title={`Idiomas con estado guardado: ${savedLanguages.join(', ')}`}
                          className="text-[10px] px-1.5 py-0.2 rounded-md bg-[var(--surface-tertiary)] text-[var(--text-muted)] border border-[var(--border-primary)] font-mono flex items-center gap-1"
                        >
                          <Layers className="w-2.5 h-2.5 text-rose-500" />
                          <span>{savedLanguages.length} idms</span>
                        </span>
                      )}

                      {(doc.sourceType === 'epub' || doc.format === 'epub') && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-amber-500/15 text-amber-600 dark:text-amber-300 border border-amber-500/30 font-mono font-bold tracking-wider">
                          EPUB
                        </span>
                      )}

                      {isCurrent && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-500 text-white font-bold tracking-wide">
                          {isSpanish ? 'EN LECTURA' : 'CURRENT'}
                        </span>
                      )}
                    </div>

                    <div className="flex items-baseline gap-2 flex-wrap">
                      <h4 className="text-sm font-bold text-[var(--text-primary)] group-hover:text-rose-500 dark:group-hover:text-rose-300 transition-colors line-clamp-1">
                        {doc.title || (isSpanish ? 'Texto sin título' : 'Untitled text')}
                      </h4>
                      {doc.author && (
                        <span className="text-xs text-[var(--text-muted)] font-medium italic">
                          de {doc.author}
                        </span>
                      )}
                    </div>

                    {doc.rawText && (
                      <p className="text-xs text-[var(--text-muted)] line-clamp-1 mt-0.5 font-sans">
                        {doc.rawText.slice(0, 100)}
                      </p>
                    )}

                    <div className="flex items-center gap-3 mt-1.5 text-[11px] text-[var(--text-muted)] font-mono">
                      <span>{paraCount} {isSpanish ? 'párrafos' : 'paragraphs'}</span>
                      {doc.updatedAt && (
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3 opacity-60" />
                          {formatDate(doc.updatedAt)}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Right: Actions or Explicit Inline Confirmation */}
                  {isConfirming ? (
                    <div
                      className="flex items-center gap-2 bg-red-500/10 border border-red-500/50 rounded-xl px-3 py-2 animate-fade-in text-xs shrink-0 self-end sm:self-center"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <span className="text-red-600 dark:text-red-300 font-bold">
                        {isSpanish ? '¿Eliminar este texto?' : 'Delete this text?'}
                      </span>
                      <button
                        type="button"
                        disabled={Boolean(deletingId)}
                        onClick={(e) => {
                          e.stopPropagation();
                          setConfirmingDeleteId(null);
                        }}
                        className="px-2.5 py-1 rounded-lg bg-[var(--surface-secondary)] hover:bg-[var(--surface-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-primary)] text-xs font-semibold cursor-pointer transition-colors"
                      >
                        {isSpanish ? 'Cancelar' : 'Cancel'}
                      </button>
                      <button
                        type="button"
                        disabled={Boolean(deletingId)}
                        onClick={(e) => handleConfirmDelete(doc.id, e)}
                        className="px-3 py-1 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all shadow-xs disabled:opacity-50"
                      >
                        {deletingId === doc.id ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            <span>{isSpanish ? 'Eliminando...' : 'Deleting...'}</span>
                          </>
                        ) : (
                          <>
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>{isSpanish ? 'Eliminar' : 'Delete'}</span>
                          </>
                        )}
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSelect(doc);
                        }}
                        className="px-3 py-1.5 rounded-xl bg-rose-600/90 hover:bg-rose-500 text-white text-xs font-semibold flex items-center space-x-1 transition-all cursor-pointer shadow-xs"
                      >
                        <span>{isSpanish ? 'Abrir' : 'Open'}</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setConfirmingDeleteId(doc.id);
                        }}
                        className="p-2 rounded-xl border border-[var(--border-primary)] hover:border-red-500/70 bg-[var(--surface-secondary)] text-[var(--text-muted)] hover:text-red-500 transition-all cursor-pointer"
                        title={isSpanish ? 'Eliminar texto' : 'Delete text'}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

export default SavedDocumentsModal;
