import React, { useState, useMemo } from 'react';
import { X, Search, Check, Sparkles } from 'lucide-react';
import { getLanguageMeta, LANGUAGE_FLAGS } from '../constants/languages.js';
import { useSiteLanguage } from '../context/SiteLanguageContext.jsx';

export function LanguageModal({
  isOpen,
  onClose,
  title,
  subtitle,
  currentLang = 'zh',
  onSelect,
  languages = []
}) {
  const { t } = useSiteLanguage();
  const modalTitle = title || t('select_lang_title');
  const modalSubtitle = subtitle || t('select_lang_subtitle');
  const [searchQuery, setSearchQuery] = useState('');

  if (!isOpen) return null;

  const filteredLanguages = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return languages;
    return languages.filter((l) => {
      const meta = getLanguageMeta(l.code);
      const nameMatch = (meta.name || l.name || '').toLowerCase().includes(q);
      const nativeMatch = (meta.nativeName || l.nativeName || '').toLowerCase().includes(q);
      const codeMatch = l.code.toLowerCase().includes(q);
      return nameMatch || nativeMatch || codeMatch;
    });
  }, [languages, searchQuery]);

  const handleSelect = (code) => {
    if (onSelect) {
      onSelect(code);
    }
    if (onClose) {
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-md animate-fade-in"
      onClick={onClose}
    >
      <div
        className="bg-[#1b0c07] text-white w-full max-w-lg rounded-3xl shadow-2xl border border-[#4d2318] p-5 sm:p-6 transform transition-all animate-scale-up max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[#3d1a10]">
          <div>
            <h3 className="text-lg font-bold text-white flex items-center space-x-2">
              <Sparkles className="w-4 h-4 text-rose-400" />
              <span>{modalTitle}</span>
            </h3>
            <p className="text-xs text-rose-200/60 mt-0.5">{modalSubtitle}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-stone-400 hover:text-white hover:bg-[#34160d] transition-colors cursor-pointer"
            aria-label="Cerrar modal de idioma"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search Bar */}
        <div className="my-3 relative">
          <Search className="w-4 h-4 text-rose-300/50 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('search_placeholder')}
            className="w-full bg-[#261009] border border-[#482015] focus:border-rose-500/70 rounded-2xl pl-10 pr-4 py-2 text-xs sm:text-sm text-white placeholder:text-stone-500 outline-none transition-all shadow-inner"
            autoFocus
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-rose-300/60 hover:text-rose-200 p-1 cursor-pointer"
            >
              {t('clear_search')}
            </button>
          )}
        </div>

        {/* Languages Grid */}
        <div
          className="flex-1 overflow-y-auto py-1 pr-1 grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[60vh]"
          style={{
            scrollbarWidth: 'thin',
            scrollbarColor: '#4d2318 transparent'
          }}
        >
          {filteredLanguages.map((l) => {
            const meta = getLanguageMeta(l.code);
            const flag = meta.flag || LANGUAGE_FLAGS[l.code] || '🌐';
            const name = meta.name || l.name || l.code;
            const native = meta.nativeName || l.nativeName || '';
            const isSelected = l.code === currentLang;

            return (
              <button
                key={l.code}
                type="button"
                onClick={() => handleSelect(l.code)}
                className={`flex items-center justify-between p-3 rounded-2xl border text-left transition-all duration-200 group cursor-pointer ${
                  isSelected
                    ? 'bg-gradient-to-r from-rose-950/90 to-[#3b170e] border-rose-500/80 text-white shadow-md shadow-rose-950/40 ring-1 ring-rose-500/50'
                    : 'bg-[#241009] hover:bg-[#30150d] border-[#441e13] hover:border-rose-500/40 text-stone-200'
                }`}
              >
                <div className="flex items-center space-x-3 truncate">
                  {/* Flag Tile */}
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center text-2xl shrink-0 border shadow-xs transition-transform group-hover:scale-105 ${
                      isSelected
                        ? 'bg-rose-900/40 border-rose-500/50'
                        : 'bg-black/35 border-white/5'
                    }`}
                  >
                    <span className="leading-none">{flag}</span>
                  </div>

                  {/* Language Names */}
                  <div className="truncate">
                    <div className="text-xs sm:text-sm font-bold text-white group-hover:text-rose-200 transition-colors truncate">
                      {name}
                    </div>
                    {native && native !== name && (
                      <div className="text-[11px] text-rose-300/70 font-medium truncate mt-0.5">
                        {native}
                      </div>
                    )}
                  </div>
                </div>

                {/* Active Checkmark Pill */}
                {isSelected ? (
                  <div className="w-6 h-6 rounded-full bg-rose-500 flex items-center justify-center text-white shrink-0 shadow-sm ml-2">
                    <Check className="w-3.5 h-3.5 stroke-[3]" />
                  </div>
                ) : (
                  <div className="w-6 h-6 rounded-full border border-[#4d2318] group-hover:border-rose-500/40 shrink-0 ml-2" />
                )}
              </button>
            );
          })}

          {filteredLanguages.length === 0 && (
            <div className="col-span-full py-8 text-center text-stone-400 text-xs">
              {t('no_languages_found')} &quot;{searchQuery}&quot;
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="mt-3 pt-3 border-t border-[#3d1a10] flex items-center justify-between text-[11px] text-rose-200/50">
          <span>{languages.length} {t('available_languages')}</span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-[#2e130b] hover:bg-[#3d1a10] text-rose-200 font-semibold transition-colors cursor-pointer"
          >
            {t('done_button')}
          </button>
        </div>
      </div>
    </div>
  );
}

export default LanguageModal;
