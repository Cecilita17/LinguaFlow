import React, { useMemo } from 'react';
import { BookOpen, FileText, Headphones, Image as ImageIcon, Upload } from 'lucide-react';

const LANGUAGE_META = {
  zh: { label: '中文', flag: '🇨🇳' },
  ar: { label: 'العربية', flag: '🇸🇦' },
  pl: { label: 'Polski', flag: '🇵🇱' },
  ru: { label: 'Русский', flag: '🇷🇺' },
  en: { label: 'English', flag: '🇬🇧' },
  es: { label: 'Español', flag: '🇪🇸' },
  de: { label: 'Deutsch', flag: '🇩🇪' },
  fr: { label: 'Français', flag: '🇫🇷' },
  it: { label: 'Italiano', flag: '🇮🇹' },
  pt: { label: 'Português', flag: '🇧🇷' },
  nl: { label: 'Nederlands', flag: '🇳🇱' },
  tr: { label: 'Türkçe', flag: '🇹🇷' }
};

const PALETTES = [
  ['#8a3f2e', '#e8794d', '#f6c35e'],
  ['#344d73', '#5f8ec7', '#b6d8ef'],
  ['#415a4b', '#78a27f', '#d0c17b'],
  ['#65445f', '#a66b90', '#efb3a4'],
  ['#5d4934', '#a67743', '#e9c77b'],
  ['#37445e', '#687aa8', '#c4b5e1']
];

const BLOB_POSITIONS = [
  'top-[-16%] right-[-34%]',
  'top-[22%] right-[-44%]',
  'bottom-[-20%] left-[-35%]',
  'bottom-[4%] right-[-32%]',
  'top-[-24%] left-[-32%]'
];

function hashDocumentSeed(value) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function getDocumentTypeIcon(document) {
  if (document?.sourceType === 'audio' || document?.format === 'audio') return Headphones;
  if (document?.sourceType === 'epub' || document?.format === 'epub') return BookOpen;
  if (document?.sourceType === 'image') return ImageIcon;
  return FileText;
}

/**
 * A zero-cost, deterministic visual cover. It derives all visual state from
 * existing document data and intentionally never writes to document storage.
 */
export function DocumentCover({
  document,
  isSpanish = false,
  onAddManualCover = null,
  isUploading = false,
  className = ''
}) {
  const cover = useMemo(() => {
    const source = String(document?.id || document?.title || document?.targetLang || 'linguaflow-document');
    const seed = hashDocumentSeed(source);
    const palette = PALETTES[seed % PALETTES.length];
    return {
      palette,
      blobPosition: BLOB_POSITIONS[(seed >>> 3) % BLOB_POSITIONS.length],
      accentPosition: BLOB_POSITIONS[(seed >>> 7) % BLOB_POSITIONS.length],
      rotation: ((seed >>> 11) % 25) - 12,
      titleSize: ((seed >>> 16) % 2) === 0 ? 'text-[12px] sm:text-sm' : 'text-[13px] sm:text-[15px]'
    };
  }, [document?.id, document?.title, document?.targetLang]);

  const targetLang = document?.targetLang || document?.targetLanguage || '';
  const language = LANGUAGE_META[targetLang] || { label: targetLang.toUpperCase() || 'LinguaFlow', flag: '🌐' };
  const title = document?.title || (isSpanish ? 'Texto sin título' : 'Untitled text');
  const isRtl = targetLang === 'ar';
  const TypeIcon = getDocumentTypeIcon(document);
  const hasManualCover = typeof document?.coverImage === 'string' && document.coverImage.startsWith('data:image/');

  return (
    <div
      className={`relative w-24 sm:w-28 aspect-[3/4] self-center rounded-xl overflow-hidden shrink-0 border border-white/15 shadow-sm ${className}`}
      dir={isRtl ? 'rtl' : 'ltr'}
    >
      {hasManualCover ? (
        <img
          src={document.coverImage}
          alt={title}
          className="w-full h-full object-cover"
          loading="lazy"
        />
      ) : (
        <div
          className="relative w-full h-full overflow-hidden px-2.5 py-3 flex flex-col justify-between text-white"
          style={{ backgroundImage: `linear-gradient(145deg, ${cover.palette[0]} 0%, ${cover.palette[1]} 56%, ${cover.palette[2]} 150%)` }}
        >
          <span className={`absolute ${cover.blobPosition} w-24 h-24 rounded-full bg-white/20 blur-[1px]`} />
          <span
            className={`absolute ${cover.accentPosition} w-16 h-16 rounded-[38%] bg-black/15`}
            style={{ transform: `rotate(${cover.rotation}deg)` }}
          />
          <span className="absolute inset-0 opacity-[0.16]" style={{ backgroundImage: 'radial-gradient(rgba(255,255,255,.8) 0.7px, transparent 0.8px)', backgroundSize: '6px 6px' }} />

          <div className="relative flex items-center justify-between gap-1">
            <span className="text-[9px] font-bold uppercase tracking-[0.12em] text-white/85 truncate">
              {language.flag} {language.label}
            </span>
            <TypeIcon className="w-3.5 h-3.5 shrink-0 text-white/90" />
          </div>

          <div className="relative">
            <span className="block w-7 h-px bg-white/70 mb-2" />
            <h3 className={`${cover.titleSize} font-semibold leading-[1.18] tracking-tight line-clamp-4 text-white text-balance`}>
              {title}
            </h3>
          </div>

          <span className="relative text-[8px] font-semibold uppercase tracking-[0.15em] text-white/70">LinguaFlow</span>
        </div>
      )}

      {onAddManualCover && !hasManualCover && (
        <button
          type="button"
          onClick={onAddManualCover}
          disabled={isUploading}
          title={isSpanish ? 'Agregar portada personalizada' : 'Add custom cover'}
          aria-label={isSpanish ? 'Agregar portada personalizada' : 'Add custom cover'}
          className="absolute right-1.5 bottom-1.5 p-1.5 rounded-lg bg-black/45 hover:bg-black/65 text-white shadow-sm backdrop-blur-sm transition-colors cursor-pointer disabled:cursor-wait"
        >
          {isUploading ? <span className="block w-3.5 h-3.5 animate-spin rounded-full border-2 border-white/35 border-t-white" /> : <Upload className="w-3.5 h-3.5" />}
        </button>
      )}
    </div>
  );
}

export default DocumentCover;
