import React from 'react';
import { X, Volume2, Snail, BookA, Star } from 'lucide-react';
import { useSavedWords } from '../context/SavedWordsContext.jsx';

export function WordModal({ wordData, targetLang = 'zh', onClose, onPronounceWord }) {
  if (!wordData) return null;

  const { isWordSaved, toggleSavedWord } = useSavedWords();
  const { word, meaning, part_of_speech, translit } = wordData;
  const activeLang = targetLang || wordData.targetLang || 'zh';
  const isSaved = isWordSaved(word, activeLang);

  const isArabic = /[\u0600-\u06FF]/.test(word || '');

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in"
      onClick={onClose}
    >
      <div
        className="bg-[#fffdfc] dark:bg-stone-900 text-stone-900 dark:text-stone-100 w-full max-w-sm rounded-2xl shadow-2xl border border-stone-200 dark:border-stone-800 p-5 transform transition-all animate-scale-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-stone-100 dark:border-stone-800">
          <div className="flex items-center space-x-2 text-rose-600 dark:text-rose-400">
            <BookA className="w-5 h-5" />
            <span className="text-xs uppercase font-bold tracking-wider text-stone-400 dark:text-stone-500">
              Diccionario de Palabra Completa
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-stone-400 dark:text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Word Display */}
        <div className="my-4 text-center">
          {translit && (
            <span dir="ltr" className="text-base font-bold text-sky-600 dark:text-sky-400 tracking-wide block mb-1">
              {translit}
            </span>
          )}
          <h3
            dir={isArabic ? 'rtl' : 'ltr'}
            className={`${
              isArabic
                ? 'font-arabic text-4xl leading-relaxed font-bold'
                : 'text-3xl font-extrabold tracking-tight'
            } text-stone-900 dark:text-stone-50`}
          >
            {word}
          </h3>
          <div className="flex items-center justify-center gap-2 mt-2">
            {part_of_speech && (
              <span className="inline-block text-[11px] font-semibold text-rose-700 dark:text-rose-300 bg-rose-100 dark:bg-rose-950/60 border border-transparent dark:border-rose-800/40 px-2.5 py-0.5 rounded-full capitalize">
                {part_of_speech}
              </span>
            )}
            {/* Save / Delete Word Button */}
            <button
              type="button"
              onClick={() => toggleSavedWord(word, activeLang)}
              className={`inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-bold transition-all cursor-pointer border ${
                isSaved
                  ? 'bg-amber-300 dark:bg-amber-400 text-stone-950 border-amber-400 shadow-xs ring-2 ring-amber-400/40'
                  : 'bg-stone-100 dark:bg-stone-800 hover:bg-amber-50 dark:hover:bg-amber-950/40 text-stone-700 dark:text-stone-200 hover:text-amber-900 dark:hover:text-amber-300 border-stone-200 dark:border-stone-700 hover:border-amber-300 dark:hover:border-amber-500/50'
              }`}
              title={isSaved ? 'Eliminar de palabras guardadas' : 'Guardar palabra'}
            >
              <span>{isSaved ? '★ Guardada' : '☆ Guardar'}</span>
            </button>
          </div>
        </div>

        {/* Meaning Box */}
        <div className={`border rounded-xl p-3.5 mb-4 text-left ${
          wordData.error
            ? 'bg-amber-50/80 dark:bg-amber-950/40 border-amber-300/80 dark:border-amber-800/50'
            : 'bg-rose-50/70 dark:bg-stone-800/80 border border-rose-200/80 dark:border-stone-700/80'
        }`}>
          <span className={`text-[11px] font-bold block uppercase tracking-wider mb-1 ${
            wordData.error ? 'text-amber-800 dark:text-amber-400' : 'text-rose-800 dark:text-rose-400'
          }`}>
            {wordData.error ? 'Aviso del diccionario:' : 'Significado en tu idioma:'}
          </span>
          <p className="text-stone-850 dark:text-stone-100 text-base font-medium leading-snug">
            {wordData.error ? (
              <span className="text-xs text-amber-950 dark:text-amber-200 font-normal leading-relaxed block">
                {wordData.error}
              </span>
            ) : (
              meaning || 'Buscando definición...'
            )}
          </p>
        </div>

        {/* Pronunciation Controls */}
        <div className="flex items-center justify-center space-x-3 pt-2">
          <button
            onClick={() => onPronounceWord(word, 1.0)}
            className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-500 hover:to-pink-500 text-white text-xs font-semibold shadow-sm transition-all"
            title="Escuchar velocidad normal"
          >
            <Volume2 className="w-4 h-4" />
            <span>Pronunciar</span>
          </button>
          <button
            onClick={() => onPronounceWord(word, 0.7)}
            className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-stone-100 dark:bg-stone-800 hover:bg-rose-100 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-200 hover:text-rose-900 dark:hover:text-rose-300 text-xs font-medium transition-all border border-stone-200 dark:border-stone-700"
            title="Escuchar velocidad lenta (fácil)"
          >
            <Snail className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            <span>Lento (0.7x)</span>
          </button>
        </div>
      </div>
    </div>
  );
}
