import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import { getLanguageMeta, LANGUAGE_FLAGS } from '../constants/languages.js';

export function LanguageSelectDropdown({
  value,
  onChange,
  options = [],
  label = null,
  icon = null,
  variant = 'header',
  align = 'left',
  className = ''
}) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Close when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [isOpen]);

  // Close on Escape key
  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const currentMeta = getLanguageMeta(value);
  const currentFlag = currentMeta.flag || LANGUAGE_FLAGS[typeof value === 'string' ? value : ''] || '🌐';
  const currentName = currentMeta.name || (typeof value === 'string' ? value : '');

  // Normalize options to ensure every item has { code, name, flag, nativeName }
  const normalizedOptions = (options || []).map((opt) => {
    if (typeof opt === 'string') {
      const meta = getLanguageMeta(opt);
      return { code: opt, name: meta.name || opt, flag: meta.flag, nativeName: meta.nativeName };
    }
    if (opt && typeof opt === 'object') {
      const code = opt.code || opt.id || opt.value || '';
      const meta = getLanguageMeta(code);
      return {
        ...opt,
        code,
        name: opt.name || meta.name || code,
        nativeName: opt.nativeName || opt.native || meta.nativeName || '',
        flag: opt.flag || meta.flag || LANGUAGE_FLAGS[code] || '🌐'
      };
    }
    return null;
  }).filter((opt) => Boolean(opt && opt.code));

  const handleSelect = (langCode) => {
    if (onChange && langCode) {
      onChange(langCode);
    }
    setIsOpen(false);
  };

  return (
    <div ref={dropdownRef} className={`relative inline-block text-left ${className}`}>
      {/* Hidden accessible select for screen-readers & test automation */}
      <select
        value={typeof value === 'string' ? value : ''}
        onChange={(e) => onChange && onChange(e.target.value)}
        aria-label={label || 'Seleccionar idioma'}
        tabIndex={-1}
        className="sr-only"
      >
        {normalizedOptions.map((opt) => (
          <option key={opt.code} value={opt.code}>
            {opt.flag} {opt.name}
          </option>
        ))}
      </select>

      {/* Aesthetic Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={label ? `${label}: ${currentName}` : currentName}
        className={`group flex items-center space-x-2 transition-all duration-200 outline-none select-none cursor-pointer ${
          variant === 'header'
            ? 'bg-[#33170e] hover:bg-[#431f13] text-stone-100 px-2.5 py-1.5 rounded-xl border border-[#522618] hover:border-rose-500/60 shadow-xs active:scale-[0.98]'
            : variant === 'card'
            ? 'w-full justify-between bg-[#230f09] hover:bg-[#30150d] text-stone-100 p-3 rounded-2xl border border-[#441e13] hover:border-rose-500/60 shadow-md'
            : variant === 'pill'
            ? 'bg-[#36160d] hover:bg-[#481f13] text-stone-100 px-3 py-1.5 rounded-xl border border-[#542416] hover:border-rose-500/60 shadow-xs'
            : 'bg-[#2b140d] hover:bg-[#381a11] text-stone-100 px-2.5 py-1 rounded-lg border border-[#482015]'
        }`}
      >
        {/* Optional Icon / Label */}
        {icon && <span className="shrink-0 text-rose-300">{icon}</span>}
        {label && (
          <span className="hidden sm:inline text-xs font-medium text-rose-200/75 shrink-0">
            {label}:
          </span>
        )}

        {/* Flag badge */}
        <div className="flex items-center justify-center w-6 h-6 rounded-md bg-black/30 border border-white/10 shadow-xs shrink-0 text-base leading-none">
          <span className="transform group-hover:scale-110 transition-transform">
            {currentFlag}
          </span>
        </div>

        {/* Language Name */}
        <span className="text-xs font-semibold text-white tracking-wide truncate max-w-[110px] sm:max-w-[140px]">
          {currentName}
        </span>

        {/* Smooth rotating chevron */}
        <ChevronDown
          className={`w-3.5 h-3.5 text-rose-300/80 shrink-0 transition-transform duration-200 ${
            isOpen ? 'rotate-180 text-rose-400' : 'group-hover:translate-y-0.5'
          }`}
        />
      </button>

      {/* Aesthetic Glassmorphism Popover Menu */}
      {isOpen && (
        <div
          role="listbox"
          className={`absolute mt-2 py-1.5 z-50 w-64 max-h-80 overflow-y-auto rounded-2xl bg-[#1c0c07]/98 backdrop-blur-xl border border-[#4d2318] shadow-2xl shadow-black/80 animate-fade-in ${
            align === 'right' ? 'right-0' : 'left-0'
          }`}
          style={{
            scrollbarWidth: 'thin',
            scrollbarColor: '#4d2318 transparent'
          }}
        >
          {/* Header in Popover */}
          <div className="px-3 py-1.5 mb-1 border-b border-[#3d1a10] flex items-center justify-between text-[11px] font-semibold tracking-wider uppercase text-rose-300/60">
            <span>{label ? `Elegir ${label}` : 'Seleccionar idioma'}</span>
            <span className="text-[10px] font-normal text-stone-400">
              {normalizedOptions.length} disponibles
            </span>
          </div>

          {/* Options list */}
          <div className="px-1 space-y-0.5">
            {normalizedOptions.map((opt) => {
              const isSelected = String(opt.code).toLowerCase() === String(value).toLowerCase();
              const flag = opt.flag || LANGUAGE_FLAGS[opt.code] || '🌐';
              const name = opt.name || opt.code;
              const native = opt.nativeName || '';

              return (
                <button
                  key={opt.code}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => handleSelect(opt.code)}
                  className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-left transition-all duration-150 group cursor-pointer ${
                    isSelected
                      ? 'bg-gradient-to-r from-rose-950/80 to-[#3b170e] border border-rose-500/50 text-white shadow-xs'
                      : 'hover:bg-[#2e130b] text-stone-200 hover:text-white border border-transparent'
                  }`}
                >
                  <div className="flex items-center space-x-2.5 truncate">
                    {/* Flag badge */}
                    <div
                      className={`w-7 h-7 rounded-lg flex items-center justify-center text-lg shrink-0 border transition-transform group-hover:scale-110 shadow-xs ${
                        isSelected
                          ? 'bg-rose-950/60 border-rose-500/40'
                          : 'bg-black/35 border-white/5'
                      }`}
                    >
                      <span className="leading-none">{flag}</span>
                    </div>

                    {/* Names: Spanish + Native */}
                    <div className="truncate">
                      <div className="text-xs font-semibold leading-tight truncate text-stone-100 group-hover:text-white">
                        {name}
                      </div>
                      {native && native !== name && (
                        <div className="text-[10px] leading-tight text-rose-300/70 font-normal mt-0.5 truncate">
                          {native}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Selected indicator */}
                  {isSelected && (
                    <div className="shrink-0 ml-2 w-5 h-5 rounded-full bg-rose-500/20 flex items-center justify-center border border-rose-500/50 text-rose-400">
                      <Check className="w-3 h-3 stroke-[3]" />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default LanguageSelectDropdown;
