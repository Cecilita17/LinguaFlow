import React from 'react';
import { X, Volume2, Snail, BookA } from 'lucide-react';

export function WordModal({ wordData, onClose, onPronounceWord }) {
  if (!wordData) return null;

  const { word, meaning, part_of_speech, translit } = wordData;

  const isArabic = /[\u0600-\u06FF]/.test(word || '');

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in"
      onClick={onClose}
    >
      <div
        className="bg-[#fffdfc] text-stone-900 w-full max-w-sm rounded-2xl shadow-2xl border border-stone-200 p-5 transform transition-all animate-scale-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-stone-100">
          <div className="flex items-center space-x-2 text-rose-600">
            <BookA className="w-5 h-5" />
            <span className="text-xs uppercase font-bold tracking-wider text-stone-400">
              Diccionario de Palabra Completa
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Word Display */}
        <div className="my-4 text-center">
          {translit && (
            <span dir="ltr" className="text-base font-bold text-sky-600 tracking-wide block mb-1">
              {translit}
            </span>
          )}
          <h3
            dir={isArabic ? 'rtl' : 'ltr'}
            className={`${
              isArabic
                ? 'font-arabic text-4xl leading-relaxed font-bold'
                : 'text-3xl font-extrabold tracking-tight'
            } text-stone-900`}
          >
            {word}
          </h3>
          {part_of_speech && (
            <span className="inline-block mt-1.5 text-[11px] font-semibold text-rose-700 bg-rose-100 px-2.5 py-0.5 rounded-full capitalize">
              {part_of_speech}
            </span>
          )}
        </div>

        {/* Meaning Box */}
        <div className="bg-rose-50/70 border border-rose-200/80 rounded-xl p-3.5 mb-4 text-left">
          <span className="text-[11px] font-bold text-rose-800 block uppercase tracking-wider mb-1">
            Significado en tu idioma:
          </span>
          <p className="text-stone-850 text-base font-medium leading-snug">
            {meaning || 'Buscando definición...'}
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
            className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-stone-100 hover:bg-rose-100 text-stone-700 hover:text-rose-900 text-xs font-medium transition-all border border-stone-200"
            title="Escuchar velocidad lenta (fácil)"
          >
            <Snail className="w-4 h-4 text-amber-600" />
            <span>Lento (0.7x)</span>
          </button>
        </div>
      </div>
    </div>
  );
}
