import React from 'react';
import { Bookmark, Check, Volume2, Snail } from 'lucide-react';
import { useSavedWords } from '../context/SavedWordsContext.jsx';
import { useSiteLanguage } from '../context/SiteLanguageContext.jsx';

export function WordModal({ wordData, targetLang = 'zh', onClose, onPronounceWord }) {
  const { isWordSaved, toggleSavedWord } = useSavedWords();
  const { isSpanish } = useSiteLanguage();
  if (!wordData) return null;

  const { word, meaning, part_of_speech: partOfSpeech, translit } = wordData;
  const activeLang = targetLang || wordData.targetLang || 'zh';
  const isSaved = isWordSaved(word, activeLang);
  const isArabic = /[\u0600-\u06FF]/.test(word || '');

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 dark:bg-black/65 backdrop-blur-[2px] animate-fade-in"
      onClick={onClose}
      role="presentation"
    >
      <section
        className="w-full max-w-2xl rounded-t-[1.75rem] border border-b-0 border-[var(--border-primary)] bg-[var(--surface-primary)] text-[var(--text-primary)] px-5 pb-[max(1.4rem,env(safe-area-inset-bottom))] pt-3 shadow-[0_-18px_48px_rgba(0,0,0,0.32)] animate-fade-in"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={isSpanish ? 'Definición de palabra' : 'Word definition'}
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-[var(--text-muted)]/35" />

        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <span className="mb-1 block text-[10px] font-bold tracking-[0.16em] text-[var(--text-muted)]">
              {isSpanish ? 'DICCIONARIO' : 'DICTIONARY'}
            </span>
            {translit && (
              <span dir="ltr" className="mb-0.5 block text-sm font-semibold tracking-wide text-rose-500 dark:text-rose-300">
                {translit}
              </span>
            )}
            <h3
              dir={isArabic ? 'rtl' : 'ltr'}
              className={`${isArabic ? 'font-arabic text-4xl leading-relaxed' : 'text-3xl leading-tight'} break-words font-bold tracking-tight text-[var(--text-primary)]`}
            >
              {word}
            </h3>
            {partOfSpeech && (
              <span className="mt-2 inline-flex rounded-full bg-rose-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-rose-600 dark:text-rose-300">
                {partOfSpeech}
              </span>
            )}
          </div>

          <div className="flex shrink-0 items-center gap-2 pt-1">
            <button
              type="button"
              onClick={() => toggleSavedWord(word, activeLang)}
              className={`flex h-10 w-10 items-center justify-center rounded-full border transition-colors cursor-pointer ${
                isSaved
                  ? 'border-amber-400/70 bg-amber-400 text-stone-950'
                  : 'border-[var(--border-primary)] bg-[var(--surface-secondary)] text-[var(--text-secondary)] hover:border-amber-400/70 hover:text-amber-500'
              }`}
              title={isSaved ? (isSpanish ? 'Quitar de palabras guardadas' : 'Remove from saved words') : (isSpanish ? 'Guardar palabra' : 'Save word')}
              aria-label={isSaved ? (isSpanish ? 'Quitar de palabras guardadas' : 'Remove from saved words') : (isSpanish ? 'Guardar palabra' : 'Save word')}
            >
              {isSaved ? <Check className="h-4 w-4 stroke-[2.5]" /> : <Bookmark className="h-4 w-4" />}
            </button>
            <button
              type="button"
              onClick={() => onPronounceWord(word, 1.0)}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-[var(--border-primary)] bg-[var(--surface-secondary)] text-[var(--text-secondary)] transition-colors hover:border-rose-500/60 hover:text-rose-500 cursor-pointer"
              title={isSpanish ? 'Escuchar pronunciación' : 'Listen to pronunciation'}
              aria-label={isSpanish ? 'Escuchar pronunciación' : 'Listen to pronunciation'}
            >
              <Volume2 className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => onPronounceWord(word, 0.7)}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-[var(--border-primary)] bg-[var(--surface-secondary)] text-[var(--text-secondary)] transition-colors hover:border-rose-500/60 hover:text-rose-500 cursor-pointer"
              title={isSpanish ? 'Escuchar lento (0.7×)' : 'Listen slowly (0.7×)'}
              aria-label={isSpanish ? 'Escuchar lento (0.7×)' : 'Listen slowly (0.7×)'}
            >
              <Snail className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="mt-3 text-lg font-semibold leading-snug text-rose-600 dark:text-rose-300">
          {wordData.error
            ? <span className="text-sm font-medium text-amber-700 dark:text-amber-300">{wordData.error}</span>
            : (meaning || (isSpanish ? 'Buscando definición…' : 'Looking up definition…'))}
        </div>

        {wordData.sentence && (
          <div className="mt-5 border-t border-[var(--border-primary)] pt-4">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold tracking-[0.14em] text-[var(--text-muted)]">
                {isSpanish ? 'ORACIÓN' : 'SENTENCE'}
              </span>
              <Volume2 className="h-3.5 w-3.5 text-[var(--text-muted)]" />
            </div>
            <p className="mt-1.5 text-sm italic leading-relaxed text-[var(--text-secondary)]">{wordData.sentence}</p>
          </div>
        )}
      </section>
    </div>
  );
}
