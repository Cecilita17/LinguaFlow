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
  Layers
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
  currentDocumentId = ''
}) {
  const { isSpanish } = useSiteLanguage();
  const [documents, setDocuments] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);

  const loadDocuments = () => {
    setLoading(true);
    try {
      const items = getAllDocuments();
      setDocuments(items);
    } catch (e) {
      console.warn('Error loading saved text documents:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadDocuments();
      setDeleteConfirmId(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleDelete = (id, e) => {
    e.stopPropagation();
    if (deleteConfirmId === id) {
      deleteDocument(id);
      setDeleteConfirmId(null);
      loadDocuments();
    } else {
      setDeleteConfirmId(id);
      setTimeout(() => {
        setDeleteConfirmId(prev => (prev === id ? null : prev));
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
                <span>{isSpanish ? 'Biblioteca de Textos' : 'Text Documents Library'}</span>
                <span className="text-[10px] bg-rose-950/80 text-rose-300 font-mono px-2 py-0.5 rounded-full border border-rose-800">
                  {documents.length}
                </span>
              </h3>
              <p className="text-[11px] text-rose-300/70">
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
              className="p-1.5 text-stone-400 hover:text-white hover:bg-[#381a11] rounded-lg transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Search & Filter Bar */}
        <div className="p-3 border-b border-[#3e1b12] bg-[#1d0c07]">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-rose-300/40" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={isSpanish ? 'Buscar por título, contenido o idioma...' : 'Search by title, text or language...'}
              className="w-full bg-[#120603] text-white text-xs pl-9 pr-8 py-2 rounded-xl border border-[#482015] placeholder-rose-300/30 focus:outline-none focus:ring-1 focus:ring-rose-500"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-white cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Document Items List */}
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
              <p className="text-xs text-rose-300/60 max-w-sm mb-4">
                {searchQuery
                  ? (isSpanish ? 'No se encontraron textos con ese criterio de búsqueda.' : 'No saved texts matched your query.')
                  : (isSpanish ? 'Los textos que importes y gloses se guardarán automáticamente aquí para que nunca pierdas tu trabajo.' : 'Texts you import and gloss will be saved here automatically.')}
              </p>
              {!searchQuery && (
                <button
                  type="button"
                  onClick={handleCreateNew}
                  className="px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold flex items-center space-x-1.5 transition-all shadow-xs cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>{isSpanish ? 'Crear mi primer texto' : 'Create first text'}</span>
                </button>
              )}
            </div>
          ) : (
            filtered.map((doc) => {
              const langMeta = LANGUAGE_META[doc.targetLang] || { name: (doc.targetLang || '').toUpperCase(), flag: '🌐' };
              const isCurrent = currentDocumentId && doc.id === currentDocumentId;
              const paraCount = doc.paragraphs?.length || doc.paragraphsCount || 0;
              const savedLanguages = doc.languageStates ? Object.keys(doc.languageStates) : [doc.targetLang];

              return (
                <div
                  key={doc.id}
                  onClick={() => handleSelect(doc)}
                  className={`p-3 sm:p-3.5 rounded-xl border transition-all cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3 group ${
                    isCurrent
                      ? 'bg-[#2f140c] border-rose-500/80 shadow-md shadow-rose-950/40'
                      : 'bg-[#180904] border-[#3f1c12] hover:bg-[#230d07] hover:border-[#5c281b]'
                  }`}
                >
                  {/* Left: Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="text-sm" title={langMeta.name}>
                        {langMeta.flag}
                      </span>
                      <span className="text-xs font-semibold text-rose-300/90">
                        {langMeta.name}
                      </span>

                      {savedLanguages.length > 1 && (
                        <span
                          title={`Idiomas con estado guardado: ${savedLanguages.join(', ')}`}
                          className="text-[10px] px-1.5 py-0.2 rounded-md bg-stone-900/80 text-stone-300 border border-stone-700/60 font-mono flex items-center gap-1"
                        >
                          <Layers className="w-2.5 h-2.5 text-rose-400" />
                          <span>{savedLanguages.length} idms</span>
                        </span>
                      )}

                      {isCurrent && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-500 text-white font-bold tracking-wide">
                          {isSpanish ? 'EN LECTURA' : 'CURRENT'}
                        </span>
                      )}
                    </div>

                    <h4 className="text-sm font-bold text-white group-hover:text-rose-200 transition-colors line-clamp-1">
                      {doc.title || (isSpanish ? 'Texto sin título' : 'Untitled text')}
                    </h4>

                    {doc.rawText && (
                      <p className="text-xs text-stone-400/80 line-clamp-1 mt-0.5 font-sans">
                        {doc.rawText.slice(0, 100)}
                      </p>
                    )}

                    <div className="flex items-center gap-3 mt-1.5 text-[11px] text-rose-300/60 font-mono">
                      <span>{paraCount} {isSpanish ? 'párrafos' : 'paragraphs'}</span>
                      {doc.updatedAt && (
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3 opacity-60" />
                          {formatDate(doc.updatedAt)}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Right: Actions */}
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
                      onClick={(e) => handleDelete(doc.id, e)}
                      className={`p-2 rounded-xl border transition-all cursor-pointer ${
                        deleteConfirmId === doc.id
                          ? 'bg-red-700 border-red-500 text-white animate-pulse'
                          : 'bg-[#230e08] border-[#441f15] hover:border-red-500/70 text-stone-400 hover:text-red-300'
                      }`}
                      title={deleteConfirmId === doc.id ? (isSpanish ? '¿Confirmar eliminación?' : 'Confirm delete?') : (isSpanish ? 'Eliminar texto' : 'Delete text')}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
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
