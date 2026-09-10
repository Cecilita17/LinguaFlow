import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
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
  const [popoverCoords, setPopoverCoords] = useState(null);
  const dropdownRef = useRef(null);
  const triggerRef = useRef(null);
  const popoverRef = useRef(null);

  // Calculate viewport-aware coordinates for the portal popover
  const updatePosition = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const menuWidth = variant === 'card' ? rect.width : 256; // 16rem = 256px
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    const placeAbove = spaceBelow < 280 && spaceAbove > spaceBelow;

    const top = placeAbove ? undefined : (rect.bottom + 6);
    const bottom = placeAbove ? (window.innerHeight - rect.top + 6) : undefined;

    let left;
    if (variant === 'card') {
      left = rect.left;
    } else if (align === 'right') {
      left = rect.right - menuWidth;
    } else {
      left = rect.left;
    }

    // Boundary constraints: ensure menu doesn't go off screen
    const minPadding = 8;
    if (left + menuWidth > window.innerWidth - minPadding) {
      left = window.innerWidth - menuWidth - minPadding;
    }
    if (left < minPadding) {
      left = minPadding;
    }

    setPopoverCoords({
      top: top !== undefined ? `${top}px` : 'auto',
      bottom: bottom !== undefined ? `${bottom}px` : 'auto',
      left: `${left}px`,
      width: variant === 'card' ? `${rect.width}px` : '16rem',
      maxHeight: placeAbove ? `${Math.min(320, spaceAbove - 16)}px` : `${Math.min(320, spaceBelow - 16)}px`
    });
  }, [align, variant]);

  // Update position on open, scroll and resize
  useEffect(() => {
    if (isOpen) {
      updatePosition();
      window.addEventListener('resize', updatePosition);
      window.addEventListener('scroll', updatePosition, true);
    }
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [isOpen, updatePosition]);

  // Close when clicking outside both trigger and portal popover
  useEffect(() => {
    function handleClickOutside(event) {
      const isOutsideTrigger = dropdownRef.current && !dropdownRef.current.contains(event.target);
      const isOutsidePopover = popoverRef.current && !popoverRef.current.contains(event.target);
      if (isOutsideTrigger && isOutsidePopover) {
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
        ref={triggerRef}
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={label ? `${label}: ${currentName}` : currentName}
        className={`group flex items-center transition-all duration-200 outline-none select-none cursor-pointer dropdown-trigger-btn ${
          variant === 'header'
            ? 'space-x-2 bg-[var(--surface-primary)] hover:bg-[var(--surface-hover)] text-[var(--text-primary)] px-2.5 py-1.5 rounded-xl border border-[var(--border-primary)] hover:border-rose-500/60 shadow-xs active:scale-[0.98]'
            : variant === 'card'
            ? 'w-full justify-between bg-[var(--surface-primary)] hover:bg-[var(--surface-hover)] text-[var(--text-primary)] p-3 rounded-2xl border border-[var(--border-primary)] hover:border-rose-500/60 shadow-xs active:scale-[0.99]'
            : variant === 'pill'
            ? 'space-x-2 bg-[var(--surface-primary)] hover:bg-[var(--surface-hover)] text-[var(--text-primary)] px-3 py-1.5 rounded-xl border border-[var(--border-primary)] hover:border-rose-500/60 shadow-xs'
            : 'space-x-2 bg-[var(--surface-primary)] hover:bg-[var(--surface-hover)] text-[var(--text-primary)] px-2.5 py-1 rounded-lg border border-[var(--border-primary)]'
        }`}
      >
        {variant === 'card' ? (
          <div className="flex items-center space-x-3 text-left min-w-0">
            <div
              className="w-10 h-10 rounded-2xl border border-[var(--border-primary)] bg-[var(--surface-tertiary)] flex items-center justify-center text-2xl shadow-inner shrink-0 group-hover:scale-105 transition-transform dropdown-flag-box"
            >
              <span>{currentFlag}</span>
            </div>
            <div className="min-w-0">
              {label && (
                <div className="text-[11px] font-medium text-[var(--text-muted)] leading-tight">
                  {label}
                </div>
              )}
              <div className="text-sm font-bold text-[var(--text-primary)] group-hover:text-rose-500 dark:group-hover:text-rose-300 transition-colors flex items-center space-x-1.5 truncate">
                <span className="truncate">{currentName}</span>
                {currentMeta.nativeName && currentMeta.nativeName !== currentName && (
                  <span className="text-[10px] text-[var(--text-muted)] font-normal shrink-0">
                    · {currentMeta.nativeName}
                  </span>
                )}
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* Optional Icon / Label */}
            {icon && <span className="shrink-0 text-rose-500 dark:text-rose-400">{icon}</span>}
            {label && (
              <span className="hidden sm:inline text-xs font-medium text-[var(--text-muted)] shrink-0">
                {label}:
              </span>
            )}

            {/* Flag badge */}
            <div
              className="flex items-center justify-center w-6 h-6 rounded-md border border-[var(--border-primary)] bg-[var(--surface-tertiary)] shadow-xs shrink-0 text-base leading-none dropdown-flag-box"
            >
              <span className="transform group-hover:scale-110 transition-transform">
                {currentFlag}
              </span>
            </div>

            {/* Language Name */}
            <span className="text-xs font-semibold text-[var(--text-primary)] tracking-wide truncate max-w-[110px] sm:max-w-[140px] dropdown-lang-name">
              {currentName}
            </span>
          </>
        )}

        {/* Smooth rotating chevron */}
        <ChevronDown
          className={`w-3.5 h-3.5 text-rose-500 dark:text-rose-400 shrink-0 transition-transform duration-200 ${
            isOpen ? 'rotate-180' : 'group-hover:translate-y-0.5'
          }`}
        />
      </button>

      {/* Aesthetic Opaque Popover Menu Rendered via Portal (Never trapped behind text or overflow containers) */}
      {isOpen && popoverCoords && typeof document !== 'undefined' && createPortal(
        <div
          ref={popoverRef}
          role="listbox"
          style={{
            position: 'fixed',
            top: popoverCoords.top,
            bottom: popoverCoords.bottom,
            left: popoverCoords.left,
            width: popoverCoords.width,
            maxHeight: popoverCoords.maxHeight,
            zIndex: 9999,
            scrollbarWidth: 'thin'
          }}
          className="py-1.5 overflow-y-auto rounded-2xl bg-[var(--surface-primary)] border border-[var(--border-primary)] shadow-2xl animate-fade-in dropdown-popover text-[var(--text-primary)]"
        >
          {/* Header in Popover */}
          <div className="px-3 py-1.5 mb-1 border-b border-[var(--border-primary)] flex items-center justify-between text-[11px] font-semibold tracking-wider uppercase text-[var(--text-muted)] dropdown-popover-header">
            <span>{label ? `Elegir ${label}` : 'Seleccionar idioma'}</span>
          </div>

          {/* Options list */}
          <div className="px-1.5 space-y-1">
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
                  className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-left transition-all duration-150 group cursor-pointer border dropdown-option-btn ${
                    isSelected
                      ? 'bg-rose-500/15 border-rose-500/70 text-rose-600 dark:text-rose-300 font-bold shadow-xs dropdown-option-selected'
                      : 'bg-[var(--surface-secondary)] hover:bg-[var(--surface-hover)] border border-[var(--border-primary)] hover:border-rose-500/50 text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  <div className="flex items-center space-x-2.5 truncate">
                    {/* Flag badge */}
                    <div
                      className={`w-7 h-7 rounded-lg flex items-center justify-center text-lg shrink-0 border transition-transform group-hover:scale-110 shadow-xs dropdown-flag-box ${
                        isSelected
                          ? 'border-rose-500/60 bg-rose-500/20'
                          : 'border-[var(--border-primary)] bg-[var(--surface-tertiary)]'
                      }`}
                    >
                      <span className="leading-none">{flag}</span>
                    </div>

                    {/* Names: Target + Native */}
                    <div className="truncate">
                      <div className={`text-xs font-semibold leading-tight truncate ${isSelected ? 'text-rose-700 dark:text-rose-200' : 'text-[var(--text-primary)]'}`}>
                        {name}
                      </div>
                      {native && native !== name && (
                        <div className={`text-[10px] leading-tight font-normal mt-0.5 truncate ${isSelected ? 'text-rose-600/80 dark:text-rose-300/70' : 'text-[var(--text-muted)]'}`}>
                          {native}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Selected indicator */}
                  {isSelected && (
                    <div className="shrink-0 ml-2 w-5 h-5 rounded-full bg-rose-500/20 flex items-center justify-center border border-rose-500/50 text-rose-600 dark:text-rose-400">
                      <Check className="w-3 h-3 stroke-[3]" />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

export default LanguageSelectDropdown;
