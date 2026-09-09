import React from 'react';
import { X, BookOpen, Volume2, Sparkles, CheckCircle2, ArrowRight } from 'lucide-react';

export function GrammarBreakdownModal({
  isOpen,
  onClose,
  sentenceBreakdown = [],
  originalText = '',
  correctedText = '',
  targetLang = 'nl',
  onPronounceWord
}) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/65 backdrop-blur-xs animate-fade-in"
      onClick={onClose}
    >
      <div
        className="bg-[#fffdfc] text-stone-900 w-full max-w-2xl max-h-[88vh] rounded-2xl shadow-2xl border border-stone-200 flex flex-col overflow-hidden animate-scale-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-stone-200 bg-gradient-to-r from-stone-50 via-rose-50/40 to-stone-50">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-rose-500 to-pink-500 text-white flex items-center justify-center shadow-xs">
              <BookOpen className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-stone-900 flex items-center gap-1.5">
                <span>Desglose Gramatical de la Oración</span>
                <span className="text-[10px] bg-rose-100 text-rose-800 font-semibold px-2 py-0.5 rounded-full uppercase tracking-wider">
                  {targetLang.toUpperCase()}
                </span>
              </h3>
              <p className="text-[11px] text-stone-500">Análisis morfosintáctico palabra por palabra</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body (Scrollable) */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 text-sm">
          {/* Sentence Summary Card */}
          <div className="bg-stone-50 border border-stone-200 rounded-xl p-3.5 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wide text-stone-500 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Frase corregida y analizada:
              </span>
              {onPronounceWord && (
                <button
                  type="button"
                  onClick={() => onPronounceWord(correctedText, targetLang)}
                  className="flex items-center space-x-1 text-xs text-rose-700 hover:text-rose-900 font-semibold bg-rose-100/70 hover:bg-rose-100 px-2.5 py-1 rounded-lg transition-colors"
                >
                  <Volume2 className="w-3.5 h-3.5" />
                  <span>Escuchar completa</span>
                </button>
              )}
            </div>
            <p className="text-base font-bold text-stone-900 tracking-wide">{correctedText}</p>

            {originalText && originalText.trim() !== correctedText.trim() && (
              <div className="pt-2 border-t border-stone-200/80 flex items-center gap-2 text-xs text-stone-600">
                <span className="font-semibold text-stone-500">Original:</span>
                <span className="line-through text-rose-800/80 font-mono">{originalText}</span>
                <ArrowRight className="w-3 h-3 text-stone-400" />
                <span className="text-emerald-700 font-semibold font-mono">{correctedText}</span>
              </div>
            )}
          </div>

          {/* Word Breakdown Cards */}
          <div className="space-y-2.5">
            <h4 className="text-xs font-bold text-stone-700 uppercase tracking-wider">
              Análisis palabra por palabra ({sentenceBreakdown.length} términos):
            </h4>

            {sentenceBreakdown.map((item) => (
              <div
                key={item.index}
                className={`p-3.5 rounded-xl border transition-all ${
                  item.wasCorrected
                    ? 'bg-amber-50/60 border-amber-300 shadow-xs'
                    : 'bg-white border-stone-200 hover:border-stone-300 shadow-xs'
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-bold text-stone-400">#{item.index}</span>
                    <span className="text-base font-extrabold text-stone-900 font-mono tracking-tight">
                      {item.word}
                    </span>
                    {onPronounceWord && (
                      <button
                        type="button"
                        onClick={() => onPronounceWord(item.cleanWord, targetLang)}
                        title="Escuchar pronunciación"
                        className="p-1 rounded-md text-rose-600 hover:bg-rose-50 transition-colors"
                      >
                        <Volume2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5">
                    {item.wasCorrected && (
                      <span className="text-[10px] font-bold bg-amber-200 text-amber-900 px-2 py-0.5 rounded-md border border-amber-300">
                        Corregido de: "{item.originalWord}"
                      </span>
                    )}
                    <span className="text-[11px] font-semibold bg-stone-100 text-stone-700 px-2 py-0.5 rounded-md border border-stone-200">
                      {item.pos}
                    </span>
                  </div>
                </div>

                {/* Explanation and Lemma */}
                <div className="text-xs space-y-1 text-stone-700">
                  <p className="leading-relaxed">
                    <span className="font-semibold text-stone-900">{item.word}:</span> {item.explanation}
                  </p>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-stone-500 pt-1">
                    {item.lemma && item.lemma !== item.cleanWord && (
                      <span>
                        <span className="font-semibold text-stone-700">Forma base (Lema):</span>{' '}
                        <span className="font-mono text-rose-700 font-medium">{item.lemma}</span>
                      </span>
                    )}
                    {item.meaning && (
                      <span>
                        <span className="font-semibold text-stone-700">Significado:</span>{' '}
                        <span className="text-stone-800 font-medium italic">{item.meaning}</span>
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-stone-200 bg-stone-50 flex items-center justify-between">
          <span className="text-xs text-stone-500 flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            Gramática explicada según la norma estándar
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-stone-900 hover:bg-stone-800 text-white font-semibold text-xs transition-colors shadow-xs"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
